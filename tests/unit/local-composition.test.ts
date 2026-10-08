import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {initialComposition,limitPosition} from '@/lib/local-composition';
import {consentVersion,consentAllowsMode,LOCAL_CONSENT_VERSION,PHOTO_CONSENT_VERSION,HUGGINGFACE_CONSENT_VERSION} from '@/lib/consent';
import {createProviderRouter,createSceneAnalyzer,providerStatus} from '@/lib/providers/factory';
import {defaultPlacement} from '@/types/images';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('el modo local nunca llama a un proveedor externo aunque tenga claves',async()=>{
 vi.stubEnv('IMAGE_PROVIDER_MODE','browser_local');vi.stubEnv('OPENAI_API_KEY','fixture');vi.stubEnv('GEMINI_API_KEY','fixture');vi.stubEnv('HF_TOKEN','fixture');vi.stubEnv('QWEN_BASE_URL','https://fixture.example');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 expect(providerStatus()).toMatchObject({mode:'browser_local',configured:true,analysis:false,local:true});expect(createSceneAnalyzer(true)).toBe(null);
 await expect(createProviderRouter(true,true).edit({baseImage:new Uint8Array(),userImage:new Uint8Array(),placement:defaultPlacement,prompt:'',idempotencyKey:'fixture'})).rejects.toThrow('PROVIDER_NOT_CONFIGURED');expect(fetch).not.toHaveBeenCalled();
});
it('el consentimiento de montaje no autoriza generación externa ni viceversa',()=>{
 expect(consentVersion('browser_local')).toBe(LOCAL_CONSENT_VERSION);expect(consentAllowsMode(LOCAL_CONSENT_VERSION,'browser_local')).toBe(true);
 for(const mode of ['auto','qwen_free','qwen_only','openai_only','gemini_only'])expect(consentAllowsMode(LOCAL_CONSENT_VERSION,mode)).toBe(false);
 for(const version of [null,PHOTO_CONSENT_VERSION,HUGGINGFACE_CONSENT_VERSION])expect(consentAllowsMode(version,'browser_local')).toBe(false);
});
it('usa el tamaño de los rostros de la escena sin deformar a la persona',()=>{
 const s=initialComposition({width:1200,height:900},{width:400,height:800},{x:100,y:20,width:100,height:100},[{x:200,y:300,width:90,height:90},{x:500,y:300,width:100,height:100}]);
 expect(s.scale).toBe(1);expect(s.x).toBeGreaterThanOrEqual(0);expect(s.x+400*s.scale).toBeLessThanOrEqual(1200);expect(s.y+800*s.scale).toBeLessThanOrEqual(900);expect(s.brightness).toBe(1);
});
it('el encuadre inicial cabe en plantillas estrechas y respeta la posición manual',()=>{
 const s=initialComposition({width:500,height:1600},{width:1000,height:500},{x:20,y:20,width:100,height:100},[],{...defaultPlacement,mode:'manual',x:.1,y:.2,width:.4,height:.7});
 expect(s.scale).toBe(.2);expect(s.x).toBe(50);expect(s.y).toBe(320);expect(limitPosition(-1000,500,200)).toBe(-30);expect(limitPosition(1000,500,200)).toBe(470);
});
