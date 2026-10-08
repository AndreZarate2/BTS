import 'server-only';
import {identity} from './auth';
import {service} from './db';
import {isDemo,intEnv} from './config';
import {ApiError,checked,maybe,errorResponse,json,readBody,sameOrigin,uuid} from './http';
import {normalizeImage,thumbnail,previewImage} from './images';
import {inspectPortrait} from './face-quality';
import {ProviderError} from '@/lib/providers/remote';
import {cleanup,processJob,removeMedia} from './jobs';
import {providerStatus,providerMode,assertProviderConfigured} from '@/lib/providers/factory';
import {huggingFaceHealth} from '@/lib/providers/huggingface';
import {qwenHealth} from '@/lib/providers/remote';
import {consentVersion,consentAllowsMode} from '@/lib/consent';
import {placementFrom} from '@/types/images';
import type {Database,Json} from '@/types/database';
type SessionRow=Database['public']['Tables']['photo_sessions']['Row'];
type JobRow=Database['public']['Tables']['generation_jobs']['Row'];
type Enqueued={created:boolean;job:JobRow|null};
type Schedule=(callback:()=>Promise<void>)=>void;
const now=()=>new Date().toISOString();
async function audit(actor:string,action:string,entity:string|null=null,metadata:object={}){maybe(await service().from('audit_logs').insert({actor_user_id:actor,action,entity_id:entity,metadata:metadata as Json}));}
export async function rateLimit(key:string,limit=30,seconds=60){if(!checked(await service().rpc('bts_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds})))throw new ApiError('RATE_LIMITED',429);}
async function sessionFor(user:string,id:string){
 const access=checked(await service().from('user_access').select('status').eq('user_id',user).single());
 if(access.status!=='approved')throw new ApiError('ACCESS_REQUIRED',403);
 return checked(await service().from('photo_sessions').select('*').eq('id',id).eq('user_id',user).single());
}
async function signedThumbnail(path:string|null){return path?checked(await service().storage.from('artist-templates').createSignedUrl(path,120)).signedUrl:undefined;}
async function enqueue(user:string,id:string,schedule:Schedule){
 assertProviderConfigured();
 const claim=checked(await service().rpc('bts_enqueue_generation',{p_user:user,p_session:id,p_max_attempts:intEnv('IMAGE_MAX_RETRIES',2,1,2)})) as unknown as Enqueued;
 const job=claim.job;if(job?.status==='queued')schedule(()=>processJob(job.id));
 return json({ok:true,job_id:claim.job?.id},202);
}
export async function handleApi(request:Request,schedule:Schedule):Promise<Response>{
 try{
  sameOrigin(request);
  if(isDemo()){const {demoApi}=await import('./demo');return demoApi(request,schedule);}
  const actor=await identity(request);
  await rateLimit(`requests:${actor.id}`,180,60);
  const body=await readBody(request),action=String(body.action||'');
  if(action.startsWith('admin_')&&!actor.admin)throw new ApiError('FORBIDDEN',403);
  const db=service();
  if(['upload_selfie','admin_upload_template'].includes(action))await rateLimit(`uploads:${actor.id}`,12,60);
  if(['generate','admin_retry'].includes(action))await rateLimit(`generation:${actor.id}`,6,60);
  if(action==='request_access'){
   const name=String(body.name||'').trim();if(name.length<2||name.length>60)throw new ApiError('INVALID_NAME');
   await rateLimit(`access:${actor.id}`,5,300);
   checked(await db.rpc('bts_request_access',{p_user:actor.id,p_name:name,p_rate_key:actor.id}));return json({ok:true});
  }
  if(action==='state'){
   const access=maybe(await db.from('user_access').select('*').eq('user_id',actor.id).maybeSingle());
   const profile=maybe(await db.from('profiles').select('*').eq('id',actor.id).maybeSingle());
   const sessions=checked(await db.from('photo_sessions').select('*,artists(name)').eq('user_id',actor.id).order('created_at',{ascending:false}).limit(1));
   const jobs=checked(await db.from('generation_jobs').select('*').eq('user_id',actor.id).order('created_at',{ascending:false}).limit(1));
   if(jobs[0]?.status==='queued')schedule(()=>processJob(jobs[0].id));
   return json({access,profile,session:sessions[0]||null,job:jobs[0]||null,mode:providerStatus().mode});
  }
  if(action==='artists'){
   const access=maybe(await db.from('user_access').select('status').eq('user_id',actor.id).maybeSingle());
   if(access?.status!=='approved')throw new ApiError('ACCESS_REQUIRED',403);
   const artists=checked(await db.from('artists').select('*,templates(id,thumbnail_path)').eq('enabled',true).eq('templates.active',true).is('templates.deleted_at',null).order('display_order'));
   return json(await Promise.all(artists.filter(a=>a.templates.length>0).map(async a=>({...a,templates:undefined,cover:await signedThumbnail(a.templates[0].thumbnail_path)}))));
  }
  if(action==='choose_artist')return json(checked(await db.rpc('bts_choose_artist',{p_user:actor.id,p_artist:uuid(body.artist_id)})));
  if(action==='upload_selfie'){
   const id=uuid(body.session_id),session=await sessionFor(actor.id,id);
   if(!['artist_selected','selfie_uploaded','failed'].includes(session.status)||session.attempts>=2||body.consent!=='true')throw new ApiError('INVALID_TRANSITION');
   if(!(body.file instanceof File))throw new ApiError('INVALID_IMAGE');
   const bytes=await normalizeImage(new Uint8Array(await body.file.arrayBuffer()),body.file.type),path=`${actor.id}/${id}/${crypto.randomUUID()}.jpg`;
   if(providerMode()==='qwen_free')try{await inspectPortrait(bytes);}catch(error){throw new ApiError(error instanceof ProviderError?error.code:'PHOTO_CHECK_UNAVAILABLE',422);}
   maybe(await db.rpc('bts_track_media',{p_session:id,p_bucket:'user-selfies',p_path:path}));
   try{
    checked(await db.storage.from('user-selfies').upload(path,bytes,{contentType:'image/jpeg'}));
    const attached=checked(await db.rpc('bts_attach_selfie',{p_user:actor.id,p_session:id,p_path:path})) as unknown as SessionRow&{previous_selfie_path:string|null};
    if(attached.previous_selfie_path)await removeMedia('user-selfies',attached.previous_selfie_path).catch(()=>{});
   }catch(error){await removeMedia('user-selfies',path).catch(()=>{});throw error;}
   return json({ok:true});
  }
  if(action==='generate'){
   const version=consentVersion(providerMode());
   if(body.consent!==true||body.consent_version!==version)throw new ApiError('PHOTO_CONSENT_REQUIRED');
   const session=await sessionFor(actor.id,uuid(body.session_id));
   if(!['selfie_uploaded','failed'].includes(session.status))throw new ApiError('INVALID_TRANSITION');
   assertProviderConfigured();
   // Supabase mutations return data:null unless rows are explicitly requested.
   checked(await db.from('photo_sessions').update({consent_version:version,consent_at:now()}).eq('id',session.id).eq('user_id',actor.id).select('id').single());
   return enqueue(actor.id,session.id,schedule);
  }
  if(action==='preview'||action==='download'||action==='admin_preview'){
   const id=uuid(body.session_id),session=action==='admin_preview'?checked(await db.from('photo_sessions').select('*').eq('id',id).single()):await sessionFor(actor.id,id);
   if(!session.result_path||(!actor.admin&&session.status!=='ready'))throw new ApiError('DOWNLOAD_USED',409);
   await rateLimit(`downloads:${actor.id}`,20,60);
   const blob=checked(await db.storage.from('generated-images').download(session.result_path));
   if(action!=='download')return new Response(new Uint8Array(await previewImage(new Uint8Array(await blob.arrayBuffer()))),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store'}});
   checked(await db.rpc('bts_redeem_download',{p_user:actor.id,p_session:id}));
   return new Response(blob,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="BTS-mi-momento.jpg"'}});
  }
  if(action==='admin_dashboard'){
   const profiles=checked(await db.from('profiles').select('*,user_access(*),photo_sessions(*,artists(name))').order('created_at',{ascending:false}).limit(1000));
   const logs=checked(await db.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(100));
   const artists=checked(await db.from('artists').select('*,templates(id,active,label,deleted_at)').is('templates.deleted_at',null).order('display_order'));
   const jobs=checked(await db.from('generation_jobs').select('*').order('created_at',{ascending:false}).limit(1000));
   const users=profiles.map(p=>({...p,access:p.user_access,session:p.photo_sessions.sort((a:{created_at:string},b:{created_at:string})=>b.created_at.localeCompare(a.created_at))[0]||null}));
   const providers=providerStatus();
   return json({users,logs,artists,jobs,providers,provider_configured:providers.configured});
  }
  if(action==='admin_transition')return json(checked(await db.rpc('bts_admin_transition',{p_actor:actor.id,p_user:uuid(body.user_id),p_action:String(body.transition)})));
  if(action==='admin_bulk_approve'){
   if(!Array.isArray(body.user_ids)||body.user_ids.length>50)throw new ApiError('INVALID_INPUT');
   const results=[];for(const id of new Set(body.user_ids.map(uuid))){const result=await db.rpc('bts_admin_transition',{p_actor:actor.id,p_user:id,p_action:'approve'});results.push({id,ok:!result.error});}return json({results});
  }
  if(action==='admin_retry'){
   const session=checked(await db.from('photo_sessions').select('id,user_id,status,consent_version').eq('id',uuid(body.session_id)).single());
   if(session.status!=='failed')throw new ApiError('INVALID_TRANSITION');
   if(!consentAllowsMode(session.consent_version,providerMode()))throw new ApiError('PHOTO_CONSENT_REQUIRED');
   await audit(actor.id,'generation_retry',session.id);return enqueue(session.user_id,session.id,schedule);
  }
  if(action==='admin_templates'){
   const rows=checked(await db.from('templates').select('*').eq('artist_id',uuid(body.artist_id)).is('deleted_at',null).order('created_at',{ascending:false}));
   return json(await Promise.all(rows.map(async row=>{const usage=await db.from('photo_sessions').select('id',{count:'exact',head:true}).eq('template_id',row.id);if(usage.error)throw new ApiError('OPERATION_FAILED');return {...row,url:await signedThumbnail(row.thumbnail_path),uses:usage.count||0};})));
  }
  if(action==='admin_upload_template'){
   const artist=checked(await db.from('artists').select('id,name').eq('id',uuid(body.artist_id)).single());
   if(!(body.file instanceof File))throw new ApiError('INVALID_IMAGE');
   const bytes=await normalizeImage(new Uint8Array(await body.file.arrayBuffer()),body.file.type),id=crypto.randomUUID(),path=`${artist.id}/${id}.jpg`,thumbPath=`${artist.id}/${id}-preview.jpg`;
   try{
    checked(await db.storage.from('artist-templates').upload(path,bytes,{contentType:'image/jpeg'}));
    checked(await db.storage.from('artist-templates').upload(thumbPath,await thumbnail(bytes),{contentType:'image/jpeg'}));
    maybe(await db.from('templates').insert({id,artist_id:artist.id,storage_path:path,thumbnail_path:thumbPath,label:String(body.label||body.file.name).slice(0,100),placement:{...placementFrom(null)},created_by:actor.id}));
   }catch(error){await db.storage.from('artist-templates').remove([path,thumbPath]);throw error;}
   await audit(actor.id,'template_uploaded',id,{artist:artist.name});return json({ok:true});
  }
  if(action==='admin_placement'){
   const id=uuid(body.template_id),placement=placementFrom(body.placement);
   maybe(await db.from('templates').update({placement:{...placement}}).eq('id',id).is('deleted_at',null));await audit(actor.id,'placement_updated',id);return json({ok:true});
  }
  if(action==='admin_artist_toggle'){
   if(typeof body.enabled!=='boolean')throw new ApiError('INVALID_INPUT');const id=uuid(body.artist_id);
   maybe(await db.from('artists').update({enabled:body.enabled}).eq('id',id));await audit(actor.id,'artist_toggled',id,{enabled:body.enabled});return json({ok:true});
  }
  if(action==='admin_template_toggle'||action==='admin_template_delete'){
   const id=uuid(body.template_id);
   if(action==='admin_template_toggle'&&typeof body.active!=='boolean')throw new ApiError('INVALID_INPUT');
   maybe(await db.from('templates').update(action==='admin_template_delete'?{active:false,deleted_at:now()}:{active:body.active===true}).eq('id',id).is('deleted_at',null));
   await audit(actor.id,action==='admin_template_delete'?'template_deleted':'template_toggled',id);return json({ok:true});
  }
  if(action==='admin_health')return json({providers:providerStatus(),qwen:providerMode()==='qwen_free'?await huggingFaceHealth(process.env.HF_TOKEN||''):process.env.QWEN_BASE_URL?await qwenHealth(process.env.QWEN_BASE_URL,process.env.QWEN_API_KEY||''):{configured:false,reachable:false}});
  if(action==='admin_cleanup'){const result=await cleanup();await audit(actor.id,'images_cleaned',null,result);return json(result);}
  throw new ApiError('UNKNOWN_ACTION',404);
 }catch(error){return errorResponse(error);}
}
