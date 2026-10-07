import 'server-only';
import type {ProviderMode} from '@/types/images';
import {OpenAIImageProvider,QwenImageProvider} from './remote';
import {LocalCompositeProvider,MockImageProvider} from './local';
import {ImageProviderRouter} from './router';
import {GeminiImageProvider} from './gemini';
import {SceneAnalyzer} from './analysis';
import {intEnv} from '@/lib/server/config';
export function providerMode():ProviderMode {const value=process.env.IMAGE_PROVIDER_MODE||'auto';if(!['auto','gemini_only','openai_only','qwen_only','local_only','mock'].includes(value))throw new Error('INVALID_PROVIDER_MODE');if(value==='mock'&&(process.env.VERCEL||!['development','test'].includes(process.env.NODE_ENV||'')))throw new Error('MOCK_DISABLED_IN_PRODUCTION');return value as ProviderMode;}
export function createProviderRouter(allowGemini=false){
 const timeoutMs=intEnv('IMAGE_PROVIDER_TIMEOUT_MS',70000,1000,90000);
 return new ImageProviderRouter(providerMode(),{
  openai:process.env.OPENAI_API_KEY?new OpenAIImageProvider({key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',quality:process.env.OPENAI_IMAGE_QUALITY||'high',timeoutMs}):undefined,
  gemini:allowGemini&&process.env.GEMINI_API_KEY?new GeminiImageProvider({key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-image',timeoutMs:90000}):undefined,
  qwen:process.env.QWEN_BASE_URL?new QwenImageProvider({key:process.env.QWEN_API_KEY||'',baseUrl:process.env.QWEN_BASE_URL,model:process.env.QWEN_IMAGE_MODEL||'Qwen/Qwen-Image-Edit-2511',timeoutMs}):undefined,
  local:providerMode()==='local_only'?new LocalCompositeProvider():undefined,
  mock:new MockImageProvider()
 });
}
export function providerStatus(){return {mode:providerMode(),openai:!!process.env.OPENAI_API_KEY,gemini:!!process.env.GEMINI_API_KEY,analysis:!!process.env.GEMINI_API_KEY,qwen:!!process.env.QWEN_BASE_URL,local:providerMode()==='local_only'};}

export function createSceneAnalyzer(allowGemini:boolean){return allowGemini&&process.env.GEMINI_API_KEY&&!['mock','local_only'].includes(providerMode())?new SceneAnalyzer({key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_ANALYSIS_MODEL||'gemini-3.8-flash',timeoutMs:25000}):null;}
