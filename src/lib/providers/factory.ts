import 'server-only';
import type {ProviderMode} from '@/types/images';
import {OpenAIImageProvider,QwenImageProvider} from './remote';
import {LocalCompositeProvider,MockImageProvider} from './local';
import {ImageProviderRouter} from './router';
import {GeminiImageProvider} from './gemini';
import {SceneAnalyzer} from './analysis';
import {intEnv} from '@/lib/server/config';
import {ApiError} from '@/lib/server/http';
import {HuggingFaceQwenProvider} from './huggingface';
export function providerMode():ProviderMode {const value=process.env.IMAGE_PROVIDER_MODE||'auto';if(!['auto','gemini_only','openai_only','qwen_only','qwen_free','local_only','browser_local','mock'].includes(value))throw new Error('INVALID_PROVIDER_MODE');if(value==='mock'&&(process.env.VERCEL||!['development','test'].includes(process.env.NODE_ENV||'')))throw new Error('MOCK_DISABLED_IN_PRODUCTION');return value as ProviderMode;}
export function createProviderRouter(allowGemini=false,allowHuggingFace=false){
 const timeoutMs=intEnv('IMAGE_PROVIDER_TIMEOUT_MS',70000,1000,90000);
 return new ImageProviderRouter(providerMode(),{
  openai:process.env.OPENAI_API_KEY?new OpenAIImageProvider({key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',quality:process.env.OPENAI_IMAGE_QUALITY||'high',timeoutMs}):undefined,
  gemini:allowGemini&&process.env.GEMINI_API_KEY?new GeminiImageProvider({key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-image',timeoutMs:90000}):undefined,
  qwen:providerMode()==='qwen_free'?(allowHuggingFace&&process.env.HF_TOKEN?new HuggingFaceQwenProvider(process.env.HF_TOKEN):undefined):process.env.QWEN_BASE_URL?new QwenImageProvider({key:process.env.QWEN_API_KEY||'',baseUrl:process.env.QWEN_BASE_URL,model:process.env.QWEN_IMAGE_MODEL||'Qwen/Qwen-Image-Edit-2511',timeoutMs}):undefined,
  local:providerMode()==='local_only'?new LocalCompositeProvider():undefined,
  mock:new MockImageProvider()
 });
}
export function providerStatus(){
 const mode=providerMode(),openai=!!process.env.OPENAI_API_KEY,gemini=!!process.env.GEMINI_API_KEY;
 const qwen=mode==='qwen_free'?!!process.env.HF_TOKEN:!!process.env.QWEN_BASE_URL;
 const configured=mode==='qwen_free'||mode==='qwen_only'?qwen:mode==='openai_only'?openai:mode==='gemini_only'?gemini:mode==='auto'?openai||gemini||qwen:true;
 return {mode,openai,gemini,analysis:gemini&&!['qwen_free','qwen_only','mock','local_only','browser_local'].includes(mode),qwen,local:mode==='local_only'||mode==='browser_local',configured};
}
export function assertProviderConfigured(){
 if(!providerStatus().configured)throw new ApiError(providerMode()==='qwen_free'?'HF_AUTH_REQUIRED':'PROVIDER_NOT_CONFIGURED',503);
}

export function createSceneAnalyzer(allowGemini:boolean){return allowGemini&&process.env.GEMINI_API_KEY&&!['mock','local_only','browser_local','qwen_only','qwen_free'].includes(providerMode())?new SceneAnalyzer({key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_ANALYSIS_MODEL||'gemini-3.8-flash',timeoutMs:25000}):null;}
