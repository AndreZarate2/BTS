import 'server-only';
import {service} from './db';
import {checked,maybe} from './http';
import {intEnv} from './config';
import {normalizeImage} from './images';
import {createProviderRouter,createSceneAnalyzer} from '@/lib/providers/factory';
import {ProviderError} from '@/lib/providers/remote';
import {photoPrompt} from '@/lib/providers/prompt';
import {PHOTO_CONSENT_VERSION} from '@/lib/consent';
import {placementFrom} from '@/types/images';
import type {Database} from '@/types/database';
type Claimed={job:Database['public']['Tables']['generation_jobs']['Row'];session:Database['public']['Tables']['photo_sessions']['Row']};
export async function removeMedia(bucket:string,path:string){
 checked(await service().storage.from(bucket).remove([path]));
 maybe(await service().rpc('bts_forget_media',{p_path:path}));
}
export async function processJob(id:string){
 const db=service();
 const claimed=maybe(await db.rpc('bts_claim_job',{p_job:id})) as unknown as Claimed|null;
 if(!claimed)return;
 const {job,session}=claimed;let path:string|null=null;let stage='starting';const start=Date.now();
 try{
  const template=checked(await db.from('templates').select('storage_path,placement').eq('id',session.template_id!).single());
  const base=checked(await db.storage.from('artist-templates').download(template.storage_path));
  const selfie=checked(await db.storage.from('user-selfies').download(session.selfie_path!));
  const placement=placementFrom(template.placement);
  const baseImage=new Uint8Array(await base.arrayBuffer()),userImage=new Uint8Array(await selfie.arrayBuffer());
  const allowGemini=session.consent_version===PHOTO_CONSENT_VERSION;
  const analyzer=createSceneAnalyzer(allowGemini);
  if(analyzer)maybe(await db.from('generation_jobs').update({stage:'analyzing_scene'}).eq('id',job.id).eq('lock_token',job.lock_token!));
  const analysis=analyzer?await analyzer.analyze(baseImage,userImage):undefined;
  const result=await createProviderRouter(allowGemini).edit({baseImage,userImage,placement,prompt:photoPrompt(placement,analysis),idempotencyKey:job.id,deadlineAt:start+230000},async provider=>{
   stage=provider;
   maybe(await db.from('generation_jobs').update({stage:`processing_${provider}`,provider}).eq('id',job.id).eq('lock_token',job.lock_token!).eq('status','processing'));
  });
  const bytes=await normalizeImage(result.bytes,undefined,20*1048576);
  if(analyzer){maybe(await db.from('generation_jobs').update({stage:'checking_composition'}).eq('id',job.id).eq('lock_token',job.lock_token!));await analyzer.verify(baseImage,userImage,bytes);}
  path=`${job.user_id}/${session.id}/${job.id}.jpg`;
  maybe(await db.rpc('bts_track_media',{p_session:session.id,p_bucket:'generated-images',p_path:path}));
  checked(await db.storage.from('generated-images').upload(path,bytes,{contentType:'image/jpeg'}));
  const saved=checked(await db.rpc('bts_finish_job',{p_job:job.id,p_lock:job.lock_token!,p_path:path,p_provider:result.provider,p_fallback:result.fallback,p_duration:Date.now()-start,p_error:null}));
  if(!saved)await removeMedia('generated-images',path);
 }catch(error){
  if(path)await removeMedia('generated-images',path).catch(()=>{});
  const code=error instanceof ProviderError?error.code:'GENERATION_FAILED';
  checked(await db.rpc('bts_finish_job',{p_job:job.id,p_lock:job.lock_token!,p_path:null,p_provider:stage,p_fallback:stage==='qwen'||stage==='gemini',p_duration:Date.now()-start,p_error:code}));
 }
}
export async function processQueue(){
 const rows=checked(await service().from('generation_jobs').select('id').eq('status','queued').order('created_at').limit(3));
 await Promise.all(rows.map(row=>processJob(row.id)));
 return rows.length;
}
export async function cleanup(){
 const cutoff=new Date(Date.now()-intEnv('PHOTO_RETENTION_HOURS',24,1,720)*3600000).toISOString();
 const count=checked(await service().rpc('bts_expire_sessions',{p_cutoff:cutoff}));
 const objects=checked(await service().rpc('bts_expired_media',{p_cutoff:cutoff})) as {bucket:string;path:string}[];
 let removed=0;for(const object of objects){await removeMedia(object.bucket,object.path);removed++;}
 return {count,removed};
}
