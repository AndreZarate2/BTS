import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {providerMode,createProviderRouter,createSceneAnalyzer} from '@/lib/providers/factory';
import {isDemo} from '@/lib/server/config';
afterEach(()=>vi.unstubAllEnvs());
describe('protección del entorno de producción',()=>{
 it('usa proveedores reales por defecto',()=>{vi.stubEnv('IMAGE_PROVIDER_MODE',undefined);expect(providerMode()).toBe('auto');});
 it('rechaza mock en producción y no permite el login de prueba',()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('IMAGE_PROVIDER_MODE','mock');vi.stubEnv('BTS_DEMO_MODE','true');expect(()=>providerMode()).toThrow('MOCK_DISABLED_IN_PRODUCTION');expect(isDemo()).toBe(false);});
 it('rechaza mock en Vercel incluso con entorno de desarrollo',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','1');vi.stubEnv('IMAGE_PROVIDER_MODE','mock');vi.stubEnv('BTS_DEMO_MODE','true');expect(()=>providerMode()).toThrow('MOCK_DISABLED_IN_PRODUCTION');expect(isDemo()).toBe(false);});
 it('permite las pruebas locales aisladas',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL',undefined);vi.stubEnv('IMAGE_PROVIDER_MODE','mock');vi.stubEnv('BTS_DEMO_MODE','true');expect(providerMode()).toBe('mock');expect(isDemo()).toBe(true);});
 it('no activa datos temporales con los proveedores reales',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL',undefined);vi.stubEnv('IMAGE_PROVIDER_MODE','auto');vi.stubEnv('BTS_DEMO_MODE','true');expect(isDemo()).toBe(false);});
});

describe('consentimiento para Google',()=>{
 it('sin consentimiento v2 no crea analizador ni envía fotos a Gemini',async()=>{
  vi.stubEnv('IMAGE_PROVIDER_MODE','auto');vi.stubEnv('GEMINI_API_KEY','fixture');vi.stubEnv('OPENAI_API_KEY',undefined);vi.stubEnv('QWEN_BASE_URL',undefined);
  expect(createSceneAnalyzer(false)).toBe(null);
  await expect(createProviderRouter(false).edit({baseImage:new Uint8Array([1]),userImage:new Uint8Array([2]),placement:{x:0,y:0,width:1,height:1,rotation:0,description:'',preferred_crop:'contain'},prompt:'test',idempotencyKey:'test'})).rejects.toThrow('PROVIDER_NOT_CONFIGURED');
 });
 it('el consentimiento explícito habilita el análisis configurado',()=>{vi.stubEnv('IMAGE_PROVIDER_MODE','auto');vi.stubEnv('GEMINI_API_KEY','fixture');expect(createSceneAnalyzer(true)).not.toBe(null);});
});
