import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const fixture=vi.hoisted(()=>({
 user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000002',
 status:'selfie_uploaded',owned:true,updateError:false,updates:[] as unknown[],
 rpc:vi.fn(),schedule:vi.fn()
}));
vi.mock('@/lib/server/auth',()=>({identity:async()=>({id:fixture.user,admin:false})}));
vi.mock('@/lib/server/jobs',()=>({processJob:vi.fn(),cleanup:vi.fn(),removeMedia:vi.fn()}));
vi.mock('@/lib/server/db',()=>({service:()=>({rpc:fixture.rpc,from:(table:string)=>{
 let mutation=false,returning=false;
 const value=()=>({data:table==='user_access'?{status:'approved'}:!fixture.owned?null:mutation?(returning?{id:fixture.session}:null):{id:fixture.session,user_id:fixture.user,status:fixture.status},error:mutation&&fixture.updateError?{message:'database error'}:null});
 const chain={
  select:vi.fn(()=>{if(mutation)returning=true;return chain;}),
  update:vi.fn((data:unknown)=>{mutation=true;fixture.updates.push(data);return chain;}),
  eq:vi.fn(()=>chain),single:vi.fn(async()=>value()),
  then:(resolve:(result:ReturnType<typeof value>)=>unknown)=>Promise.resolve(value()).then(resolve)
 };
 return chain;
}})}));
import {handleApi} from '@/lib/server/api';
import {PHOTO_CONSENT_VERSION,HUGGINGFACE_CONSENT_VERSION} from '@/lib/consent';

beforeEach(()=>{
 vi.stubEnv('BTS_DEMO_MODE','false');vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_only');vi.stubEnv('QWEN_BASE_URL','https://gpu.example.test');
 fixture.status='selfie_uploaded';fixture.owned=true;fixture.updateError=false;fixture.updates=[];fixture.schedule.mockReset();
 fixture.rpc.mockReset().mockImplementation(async(name:string)=>({data:name==='bts_rate_limit'?true:{created:true,job:{id:'job-fixture',status:'queued'}},error:null}));
});
afterEach(()=>vi.unstubAllEnvs());
const generate=(overrides:object={})=>handleApi(new Request('https://app.example.test/api/bts',{method:'POST',headers:{Origin:'https://app.example.test','Content-Type':'application/json'},body:JSON.stringify({action:'generate',session_id:fixture.session,consent:true,consent_version:PHOTO_CONSENT_VERSION,...overrides})}),fixture.schedule);

describe('generación a través del handler real, sin la demo',()=>{
 it('guarda consentimiento con retorno de fila, acepta la solicitud y programa el trabajo',async()=>{
  // Supabase returns data:null for UPDATE without SELECT. This test catches the production regression.
  const response=await generate();expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ok:true,job_id:'job-fixture'});
  expect(fixture.updates[0]).toMatchObject({consent_version:PHOTO_CONSENT_VERSION});
  expect(fixture.rpc).toHaveBeenCalledWith('bts_enqueue_generation',expect.objectContaining({p_user:fixture.user,p_session:fixture.session}));
  expect(fixture.schedule).toHaveBeenCalledTimes(1);
 });
 it('un error real al guardar no encola ni oculta el fallo',async()=>{fixture.updateError=true;const response=await generate();expect(response.status).toBe(409);expect(fixture.schedule).not.toHaveBeenCalled();expect(fixture.rpc.mock.calls.some(([name])=>name==='bts_enqueue_generation')).toBe(false);});
 it('no modifica una sesión ajena',async()=>{fixture.owned=false;expect((await generate()).status).toBe(409);expect(fixture.updates).toHaveLength(0);});
 it('requiere consentimiento explícito vigente',async()=>{expect((await generate({consent:false})).status).toBe(400);expect(fixture.updates).toHaveLength(0);});
 it('no consume un intento cuando falta conectar Hugging Face',async()=>{
  vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_free');vi.stubEnv('HF_TOKEN',undefined);
  const response=await generate({consent_version:HUGGINGFACE_CONSENT_VERSION});expect(response.status).toBe(503);
  expect(await response.json()).toEqual({error:'HF_AUTH_REQUIRED'});expect(fixture.updates).toHaveLength(0);expect(fixture.schedule).not.toHaveBeenCalled();
 });
 it('el consentimiento anterior no autoriza subir imágenes al Space público',async()=>{
  vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_free');vi.stubEnv('HF_TOKEN','fixture-token');
  const response=await generate();expect(response.status).toBe(400);expect(await response.json()).toEqual({error:'PHOTO_CONSENT_REQUIRED'});expect(fixture.updates).toHaveLength(0);
 });
 it('acepta el consentimiento específico de Hugging Face',async()=>{
  vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_free');vi.stubEnv('HF_TOKEN','fixture-token');
  expect((await generate({consent_version:HUGGINGFACE_CONSENT_VERSION})).status).toBe(202);expect(fixture.updates[0]).toMatchObject({consent_version:HUGGINGFACE_CONSENT_VERSION});
 });
});
