// Opt-in integration test using temporary synthetic records and images. Real providers may charge.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(path.join(process.cwd(),'package.json'));
const {createClient}=require('@supabase/supabase-js');
const sharp=require('sharp');
const base='http://127.0.0.1:3000',project=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(project!=='https://pchyfdbbjeouqopudogj.supabase.co')throw new Error('PROJECT_MISMATCH');
const authOptions={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(project,process.env.SUPABASE_SECRET_KEY,authOptions);
const visitor=createClient(project,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authOptions);
let userId,token,cookies='',artistId,templateId,sessionId,channel;
let realtimeResolve;
const realtimeEvent=new Promise(resolve=>{realtimeResolve=resolve;});
const checks=[];
function record(check,extra={}){const result={check,passed:true,...extra};checks.push(result);console.log(JSON.stringify(result));}
function checked(result){if(result.error)throw new Error('SUPABASE_'+(result.error.code||result.error.status||'ERROR'));return result.data;}
async function call(action,values={},file,admin=false,raw=false){
 const headers={Origin:base,...(admin?{Cookie:cookies}:{Authorization:'Bearer '+token})};
 let body;
 if(file){body=new FormData();body.set('action',action);for(const [key,value] of Object.entries(values))body.set(key,String(value));body.set('file',new File([file.bytes],file.name,{type:file.type}));}
 else{headers['Content-Type']='application/json';body=JSON.stringify({action,...values});}
 const response=await fetch(base+'/api/bts',{method:'POST',headers,body,signal:AbortSignal.timeout(95000)});
 if(raw)return response;
 if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(action+':'+response.status+':'+String(value.error||'ERROR'));}
 return response.json();
}
try{
 const config=await (await fetch(base+'/api/config')).json();if(config.demo||config.mode==='mock')throw new Error('TEST_MODE_ACTIVE');record('production_mode',config);
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
 if(!login.ok)throw new Error('ADMIN_LOGIN_'+login.status);
 const setCookies=login.headers.getSetCookie();cookies=setCookies.map(value=>value.split(';')[0]).join('; ');if(!setCookies.length||!setCookies.every(value=>value.toLowerCase().includes('httponly')))throw new Error('COOKIE_PROTECTION');record('real_admin_login');
 const signup=checked(await visitor.auth.signInAnonymously());userId=signup.user.id;token=signup.session.access_token;record('real_anonymous_signup');
 await call('request_access',{name:'QA release temporal'});const pending=await call('state');if(pending.access.status!=='pending')throw new Error('EXPECTED_PENDING');record('persistent_access_request');
 await visitor.realtime.setAuth(token);
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('REALTIME_SUBSCRIBE_TIMEOUT')),15000);
  channel=visitor.channel('release-qa-'+userId).on('postgres_changes',{event:'*',schema:'public',table:'user_access',filter:'user_id=eq.'+userId},payload=>{console.log(JSON.stringify({realtimeEvent:payload.eventType,status:payload.new.status,errors:payload.errors??null}));if(payload.new.status==='approved')realtimeResolve(true);}).on('system',{},message=>{console.log(JSON.stringify({realtimeSystem:message.status,message:message.message}));if(message.status==='ok'){clearTimeout(timeout);resolve();}}).subscribe(status=>{console.log(JSON.stringify({realtimeStatus:status}));});
 });
 await call('admin_transition',{user_id:userId,transition:'approve'},undefined,true);
 const approved=await call('state');if(approved.access.status!=='approved')throw new Error('APPROVAL_NOT_PERSISTED');record('real_approval_polling');
 const realtime=await Promise.race([realtimeEvent,new Promise(resolve=>setTimeout(()=>resolve(false),20000))]);checks.push({check:'real_realtime_approval',passed:realtime});console.log(JSON.stringify(checks.at(-1)));
 if(process.env.ACCESS_ONLY==='true'){if(!realtime)throw new Error('REALTIME_NOT_RECEIVED');throw new Error('ACCESS_ONLY_COMPLETE');}
 const artist=checked(await service.from('artists').insert({name:'QA release temporal',slug:'qa-release-'+crypto.randomUUID(),enabled:true,display_order:999}).select('id').single());artistId=artist.id;
 const label='QA release '+crypto.randomUUID();const image=await readFile('tests/fixtures/escenario.webp');
 await call('admin_upload_template',{artist_id:artistId,label},{bytes:image,name:'qa.webp',type:'image/webp'},true);
 const templates=await call('admin_templates',{artist_id:artistId},undefined,true);templateId=templates.find(item=>item.label===label)?.id;if(!templateId)throw new Error('TEMPLATE_MISSING');record('real_private_template_upload');
 const catalog=await call('artists');if(!catalog.some(item=>item.id===artistId))throw new Error('CATALOG_MISSING');
 await call('choose_artist',{artist_id:artistId});const selected=await call('state');sessionId=selected.session.id;
 const selfie=await readFile('tests/fixtures/selfie.png');await call('upload_selfie',{session_id:sessionId,consent:'true'},{bytes:selfie,name:'selfie.png',type:'image/png'});record('real_selfie_upload');
 await call('generate',{session_id:sessionId});
 let state;const deadline=Date.now()+120000;
 do{await new Promise(resolve=>setTimeout(resolve,2000));state=await call('state');if(state.job?.status==='failed')throw new Error('JOB_FAILED_'+state.job.error_code);if(state.session?.status==='ready')break;}while(Date.now()<deadline);
 if(state.session.status!=='ready'||state.job.provider==='mock')throw new Error('REAL_GENERATION_NOT_READY');record('real_generation',{provider:state.job.provider,fallback:state.job.fallback_used});
 const download=await call('download',{session_id:sessionId},undefined,false,true);if(!download.ok)throw new Error('DOWNLOAD_FAILED');const output=Buffer.from(await download.arrayBuffer());const metadata=await sharp(output).metadata();if(metadata.format!=='jpeg')throw new Error('INVALID_RESULT');
 await mkdir('test-results',{recursive:true});await writeFile('test-results/real-release-result.jpg',output);record('real_download',{width:metadata.width,height:metadata.height,bytes:output.length});
 const second=await call('download',{session_id:sessionId},undefined,false,true);if(second.ok)throw new Error('SECOND_DOWNLOAD_ACCEPTED');record('single_download_enforced');
 const consumed=await call('state');if(consumed.session.status!=='consumed')throw new Error('EXPECTED_CONSUMED');record('consumed_persisted');
}catch(error){if(error.message==='ACCESS_ONLY_COMPLETE')record('realtime_verification_complete');else{console.error(JSON.stringify({success:false,error:String(error.message).slice(0,200)}));process.exitCode=1;}}
finally{
 try{
  if(channel)await visitor.removeChannel(channel);
  if(userId){
   const sessions=checked(await service.from('photo_sessions').select('id,selfie_path,result_path').eq('user_id',userId));
   for(const session of sessions){for(const [bucket,key] of [['user-selfies',session.selfie_path],['generated-images',session.result_path]]){if(key){checked(await service.storage.from(bucket).remove([key]));checked(await service.rpc('bts_forget_media',{p_path:key}));}}}
   checked(await service.from('download_events').delete().eq('user_id',userId));
   checked(await service.from('generation_jobs').delete().eq('user_id',userId));
   checked(await service.from('photo_sessions').delete().eq('user_id',userId));
   checked(await service.from('audit_logs').delete().or('target_user_id.eq.'+userId+',actor_user_id.eq.'+userId));
   await visitor.auth.signOut();checked(await service.auth.admin.deleteUser(userId));
  }
  if(artistId){
   const templates=checked(await service.from('templates').select('id,storage_path,thumbnail_path').eq('artist_id',artistId));
   for(const template of templates){checked(await service.storage.from('artist-templates').remove([template.storage_path,template.thumbnail_path].filter(Boolean)));checked(await service.from('audit_logs').delete().eq('entity_id',template.id));}
   checked(await service.from('templates').delete().eq('artist_id',artistId));checked(await service.from('artists').delete().eq('id',artistId));
  }
  if(cookies)await fetch(base+'/api/admin/logout',{method:'POST',headers:{Origin:base,Cookie:cookies}});
  record('synthetic_data_removed');
 }catch(error){console.error(JSON.stringify({cleanupFailed:true,error:String(error.message).slice(0,200)}));process.exitCode=1;}
 await writeFile(process.env.ACCESS_ONLY==='true'?'test-results/real-realtime-checks.json':'test-results/real-release-checks.json',JSON.stringify(checks,null,2));
}
process.exit(process.exitCode||0);
