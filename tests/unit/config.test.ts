import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {providerMode} from '@/lib/providers/factory';
import {isDemo} from '@/lib/server/config';
afterEach(()=>vi.unstubAllEnvs());
describe('protección del entorno de producción',()=>{
 it('usa proveedores reales por defecto',()=>{vi.stubEnv('IMAGE_PROVIDER_MODE',undefined);expect(providerMode()).toBe('auto');});
 it('rechaza mock en producción y no permite el login de prueba',()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('IMAGE_PROVIDER_MODE','mock');vi.stubEnv('BTS_DEMO_MODE','true');expect(()=>providerMode()).toThrow('MOCK_DISABLED_IN_PRODUCTION');expect(isDemo()).toBe(false);});
 it('rechaza mock en Vercel incluso con entorno de desarrollo',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','1');vi.stubEnv('IMAGE_PROVIDER_MODE','mock');vi.stubEnv('BTS_DEMO_MODE','true');expect(()=>providerMode()).toThrow('MOCK_DISABLED_IN_PRODUCTION');expect(isDemo()).toBe(false);});
 it('permite las pruebas locales aisladas',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL',undefined);vi.stubEnv('IMAGE_PROVIDER_MODE','mock');vi.stubEnv('BTS_DEMO_MODE','true');expect(providerMode()).toBe('mock');expect(isDemo()).toBe(true);});
 it('no activa datos temporales con los proveedores reales',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL',undefined);vi.stubEnv('IMAGE_PROVIDER_MODE','auto');vi.stubEnv('BTS_DEMO_MODE','true');expect(isDemo()).toBe(false);});
});
