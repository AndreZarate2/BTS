import 'server-only';
import {cookies} from 'next/headers';
import {randomUUID,randomInt} from 'node:crypto';
import type {AdminUser,Artist,PhotoSession,Template,Audit,GenerationJob} from '@/lib/model';
import {isDemo} from './config';
import {ApiError,errorResponse,json,readBody,uuid} from './http';
import {normalizeImage,thumbnail} from './images';
import {MockImageProvider} from '@/lib/providers/local';
import {placementFrom} from '@/types/images';
interface DemoUser extends AdminUser {selfie?:Uint8Array;result?:Uint8Array;}
interface DemoTemplate extends Template {bytes:Uint8Array;}
interface DemoStore {tokens:Map<string,{id:string;admin:boolean;expires:number}>;users:Map<string,DemoUser>;artists:Artist[];templates:DemoTemplate[];jobs:GenerationJob[];logs:Audit[];limits:Map<string,{hits:number;at:number}>;}
declare global {var btsDemoStore:DemoStore|undefined;}
function store():DemoStore {
 if(!isDemo())throw new ApiError('NOT_FOUND',404);
 const db=globalThis.btsDemoStore??={tokens:new Map(),users:new Map(),artists:['Jungkook','V','Jimin','Jin','RM','J-Hope','Suga','BTS Group'].map((name,i)=>({id:randomUUID(),name,slug:name.toLowerCase().replaceAll(' ','-'),display_order:i,enabled:true})),templates:[],jobs:[],logs:[],limits:new Map()};
 for(const [token,session] of db.tokens)if(session.expires<Date.now()){db.tokens.delete(token);if(!session.admin)db.users.delete(session.id);}
 return db;
}
function local(request:Request){if(!isDemo()||!['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname))throw new ApiError('NOT_FOUND',404);}
export function demoAdminCookie(token?:string){return !!token&&store().tokens.get(token)?.admin===true&&store().tokens.get(token)!.expires>Date.now();}
export async function demoIdentity(request:Request,admin=false){
 local(request);const token=(await cookies()).get(admin?'bts-demo-admin':'bts-demo-user')?.value,identity=token?store().tokens.get(token):undefined;
 if(!identity||identity.expires<Date.now()||(admin&&!identity.admin))throw new ApiError('UNAUTHORIZED',401);
 return {...identity,email:identity.admin?'Demo local':undefined};
}
async function tokenCookie(id:string,admin:boolean){
 const token=randomUUID();store().tokens.set(token,{id,admin,expires:Date.now()+3600000});
 (await cookies()).set(admin?'bts-demo-admin':'bts-demo-user',token,{httpOnly:true,sameSite:'strict',path:'/',maxAge:3600});
}
export async function demoLogin(request:Request,body:Record<string,unknown>){local(request);if(body.demo!==true)throw new ApiError('INVALID_LOGIN',401);await tokenCookie(randomUUID(),true);return json({ok:true});}
function log(action:string,target:string|null=null,entity:string|null=null){const db=store();db.logs.unshift({id:db.logs.length+1,actor_user_id:'demo',action,target_user_id:target,entity_id:entity,created_at:new Date().toISOString(),metadata:{}});db.logs=db.logs.slice(0,100);}
function publicUser(user:DemoUser){const {selfie:_,result:__,...rest}=user;void _;void __;return rest;}
function publicTemplate(template:DemoTemplate){const {bytes:_,...rest}=template;void _;return {...rest,uses:[...store().users.values()].flatMap(u=>u.photo_sessions).filter(s=>s.template_id===template.id).length};}
function newSession(user:DemoUser){const session:PhotoSession={id:randomUUID(),user_id:user.id,status:'approved',artist_id:null,template_id:null,attempts:0,created_at:new Date().toISOString(),ready_at:null,downloaded_at:null,error_message:null,error_code:null,artists:null};user.photo_sessions.unshift(session);user.session=session;delete user.selfie;delete user.result;}
function transition(id:string,action:string){
 const user=store().users.get(id);if(!user)throw new ApiError('NOT_FOUND',404);
 const state=user.access.status;
 if(action==='approve'&&state==='pending'){user.access.status='approved';newSession(user);}
 else if(action==='reject'&&state==='pending')user.access.status='rejected';
 else if(action==='block'&&state==='approved'){user.access.status='blocked';if(user.session)user.session.status='cancelled';}
 else if(action==='reactivate'&&['consumed','blocked','rejected'].includes(state)){user.access.status='approved';user.access.reactivation_count++;if(user.session&&user.session.status!=='consumed')user.session.status='cancelled';newSession(user);}
 else throw new ApiError('INVALID_TRANSITION',409);
 user.access.updated_at=new Date().toISOString();log(action,id);
}
function limit(id:string,action:string){const key=id+action,db=store(),entry=db.limits.get(key);if(!entry||Date.now()-entry.at>60000)db.limits.set(key,{hits:1,at:Date.now()});else if(++entry.hits>(action.includes('upload')?12:180))throw new ApiError('RATE_LIMITED',429);}
async function generate(user:DemoUser,schedule:(fn:()=>Promise<void>)=>void){
 const session=user.session;if(!session)throw new ApiError('INVALID_TRANSITION');
 if(['queued','processing','ready'].includes(session.status))return json({ok:true},202);
 if(user.access.status!=='approved'||!user.selfie||!['selfie_uploaded','failed'].includes(session.status)||session.attempts>=2)throw new ApiError('INVALID_TRANSITION');
 const template=store().templates.find(t=>t.id===session.template_id);if(!template)throw new ApiError('NO_TEMPLATES');
 session.status='queued';session.attempts++;
 const job:GenerationJob={id:randomUUID(),session_id:session.id,user_id:user.id,status:'queued',stage:'queued',provider:null,fallback_used:false,duration_ms:null,created_at:new Date().toISOString(),error_code:null};store().jobs.unshift(job);
 const selfie=user.selfie;
 schedule(async()=>{
  if(job.status!=='queued'||session.status!=='queued')return;job.status='processing';job.stage='processing_mock';session.status='processing';
  try{const result=await new MockImageProvider().edit({baseImage:template.bytes,userImage:selfie,placement:placementFrom(template.placement),prompt:'',idempotencyKey:job.id});
   if(user.access.status!=='approved'||user.session?.id!==session.id||session.status!=='processing'){job.status='cancelled';return;}
   user.result=result.bytes;session.status='ready';session.provider='mock';session.ready_at=new Date().toISOString();job.status='ready';job.stage='ready';job.provider='mock';job.duration_ms=result.durationMs;log('generation_ready',user.id,job.id);
  }catch{session.status='failed';session.error_message='No pudimos preparar la imagen de prueba.';job.status='failed';job.error_code='GENERATION_FAILED';}
 });return json({ok:true,job_id:job.id},202);
}
export async function demoApi(request:Request,schedule:(fn:()=>Promise<void>)=>void):Promise<Response>{
 try{
  local(request);const body=await readBody(request),action=String(body.action||''),db=store();
  if(action==='request_access'){
   let id:string;try{id=(await demoIdentity(request)).id;}catch{if(db.users.size>=50)throw new ApiError('RATE_LIMITED',429);id=randomUUID();await tokenCookie(id,false);}
   if(db.users.has(id))return json({ok:true});
   const name=String(body.name||'').trim();if(name.length<2||name.length>60)throw new ApiError('INVALID_NAME');
   const date=new Date().toISOString();db.users.set(id,{id,display_name:name,created_at:date,access:{user_id:id,status:'pending',requested_at:date,approved_at:null,updated_at:date,reactivation_count:0},session:null,photo_sessions:[]});log('access_requested',id);return json({ok:true});
  }
  if(action==='state'){
   let user:DemoUser|undefined;try{user=db.users.get((await demoIdentity(request)).id);}catch{return json({access:null,profile:null,session:null,mode:'mock'});}
   return json({access:user?.access||null,profile:user?{id:user.id,display_name:user.display_name,created_at:user.created_at}:null,session:user?.session||null,job:db.jobs.find(j=>j.user_id===user?.id)||null,mode:'mock'});
  }
  const actor=await demoIdentity(request,action.startsWith('admin_'));limit(actor.id,action);
  if(action==='admin_dashboard')return json({users:[...db.users.values()].map(publicUser),artists:db.artists.map(a=>({...a,templates:db.templates.filter(t=>t.artist_id===a.id&&!t.deleted_at).map(publicTemplate)})),logs:db.logs,jobs:db.jobs,providers:{mode:'mock',openai:false,qwen:false,local:true},provider_configured:true});
  if(action==='admin_transition'){transition(uuid(body.user_id),String(body.transition));return json({ok:true});}
  if(action==='admin_bulk_approve'){if(!Array.isArray(body.user_ids)||body.user_ids.length>50)throw new ApiError('INVALID_INPUT');const results=body.user_ids.map(id=>{try{transition(uuid(id),'approve');return {id,ok:true};}catch{return {id,ok:false};}});return json({results});}
  if(action==='admin_templates')return json(db.templates.filter(t=>t.artist_id===uuid(body.artist_id)&&!t.deleted_at).map(publicTemplate));
  if(action==='admin_upload_template'){
   const artistId=uuid(body.artist_id);if(!db.artists.some(a=>a.id===artistId)||!(body.file instanceof File)||db.templates.length>=30)throw new ApiError('INVALID_INPUT');
   const bytes=await normalizeImage(new Uint8Array(await body.file.arrayBuffer()),body.file.type),preview=await thumbnail(bytes);
   db.templates.push({id:randomUUID(),artist_id:artistId,label:String(body.label||'Escenario').slice(0,100),active:true,created_at:new Date().toISOString(),deleted_at:null,placement:placementFrom(null),bytes,url:`data:image/jpeg;base64,${preview.toString('base64')}`});log('template_uploaded');return json({ok:true});
  }
  if(action==='admin_artist_toggle'){const artist=db.artists.find(a=>a.id===uuid(body.artist_id));if(!artist||typeof body.enabled!=='boolean')throw new ApiError('INVALID_INPUT');artist.enabled=body.enabled;return json({ok:true});}
  if(['admin_template_toggle','admin_template_delete','admin_placement'].includes(action)){
   const template=db.templates.find(t=>t.id===uuid(body.template_id));if(!template)throw new ApiError('NOT_FOUND');
   if(action==='admin_template_toggle'){if(typeof body.active!=='boolean')throw new ApiError('INVALID_INPUT');template.active=body.active;}
   if(action==='admin_template_delete'){template.deleted_at=new Date().toISOString();template.active=false;}
   if(action==='admin_placement')template.placement=placementFrom(body.placement);return json({ok:true});
  }
  if(action==='admin_health')return json({providers:{mode:'mock'},qwen:{configured:false,reachable:false}});
  if(action==='admin_cleanup'){let count=0;for(const user of db.users.values()){delete user.selfie;delete user.result;if(user.session)user.session.status='cancelled';user.access.status='consumed';count++;}return json({count});}
  if(action==='admin_retry'){const user=[...db.users.values()].find(u=>u.session?.id===uuid(body.session_id));if(!user)throw new ApiError('NOT_FOUND');return generate(user,schedule);}
  const user=action==='admin_preview'?[...db.users.values()].find(u=>u.photo_sessions.some(s=>s.id===body.session_id)):db.users.get(actor.id);
  if(!user||(!actor.admin&&user.access.status!=='approved'))throw new ApiError('ACCESS_REQUIRED',403);
  if(action==='artists')return json(db.artists.filter(a=>a.enabled&&db.templates.some(t=>t.artist_id===a.id&&t.active&&!t.deleted_at)).map(a=>({...a,cover:db.templates.find(t=>t.artist_id===a.id&&t.active&&!t.deleted_at)?.url})));
  const session=user.session;if(!session)throw new ApiError('INVALID_TRANSITION');
  if(action==='choose_artist'){
   if(session.template_id)return json(session);const id=uuid(body.artist_id),templates=db.templates.filter(t=>t.artist_id===id&&t.active&&!t.deleted_at),artist=db.artists.find(a=>a.id===id&&a.enabled);
   if(!artist||!templates.length)throw new ApiError('NO_TEMPLATES');session.artist_id=id;session.artists={name:artist.name};session.template_id=templates[randomInt(templates.length)].id;session.status='artist_selected';return json(session);
  }
  if(body.session_id!==session.id)throw new ApiError('NOT_FOUND',404);
  if(action==='upload_selfie'){
   if(!['artist_selected','selfie_uploaded','failed'].includes(session.status)||session.attempts>=2||body.consent!=='true'||!(body.file instanceof File))throw new ApiError('INVALID_TRANSITION');
   const bytes=await normalizeImage(new Uint8Array(await body.file.arrayBuffer()),body.file.type);if(!['artist_selected','selfie_uploaded','failed'].includes(session.status))throw new ApiError('INVALID_TRANSITION');user.selfie=bytes;session.status='selfie_uploaded';return json({ok:true});
  }
  if(action==='generate')return generate(user,schedule);
  if(['preview','download','admin_preview'].includes(action)){
   if(!user.result||(!actor.admin&&session.status!=='ready'))throw new ApiError('DOWNLOAD_USED',409);
   const result=Buffer.from(user.result);
   if(action==='download'){if(session.downloaded_at)throw new ApiError('DOWNLOAD_USED',409);session.status='consumed';session.downloaded_at=new Date().toISOString();user.access.status='consumed';log('download_redeemed',user.id);}
   return new Response(new Uint8Array(action==='download'?result:await thumbnail(result)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store',...(action==='download'?{'Content-Disposition':'attachment; filename="BTS-mi-momento.jpg"'}:{})}});
  }
  throw new ApiError('UNKNOWN_ACTION',404);
 }catch(error){return errorResponse(error);}
}
