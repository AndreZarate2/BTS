import 'server-only';
import type {ProviderMode} from '@/types/images';
import {OpenAIImageProvider,QwenImageProvider} from './remote';
import {LocalCompositeProvider,MockImageProvider} from './local';
import {ImageProviderRouter} from './router';
import {intEnv} from '@/lib/server/config';
export function providerMode():ProviderMode {const value=process.env.IMAGE_PROVIDER_MODE||'auto';if(!['auto','openai_only','qwen_only','local_only','mock'].includes(value))throw new Error('INVALID_PROVIDER_MODE');if(value==='mock'&&(process.env.VERCEL||!['development','test'].includes(process.env.NODE_ENV||'')))throw new Error('MOCK_DISABLED_IN_PRODUCTION');return value as ProviderMode;}
export function createProviderRouter(){
 const timeoutMs=intEnv('IMAGE_PROVIDER_TIMEOUT_MS',70000,1000,90000);
 return new ImageProviderRouter(providerMode(),{
  openai:process.env.OPENAI_API_KEY?new OpenAIImageProvider({key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',quality:process.env.OPENAI_IMAGE_QUALITY||'high',timeoutMs}):undefined,
  qwen:process.env.QWEN_BASE_URL?new QwenImageProvider({key:process.env.QWEN_API_KEY||'',baseUrl:process.env.QWEN_BASE_URL,model:process.env.QWEN_IMAGE_MODEL||'Qwen/Qwen-Image-Edit-2511',timeoutMs}):undefined,
  local:process.env.IMAGE_ENABLE_LOCAL_FALLBACK!=='false'?new LocalCompositeProvider():undefined,
  mock:new MockImageProvider()
 });
}
export function providerStatus(){return {mode:providerMode(),openai:!!process.env.OPENAI_API_KEY,qwen:!!process.env.QWEN_BASE_URL,local:process.env.IMAGE_ENABLE_LOCAL_FALLBACK!=='false'};}
