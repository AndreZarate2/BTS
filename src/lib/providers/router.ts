import type {ImageEditingProvider,ImageEditInput,ImageEditResult,ProviderMode} from '@/types/images';
import {ProviderError} from './remote';
export class ImageProviderRouter {
 constructor(private mode:ProviderMode,private providers:{openai?:ImageEditingProvider;gemini?:ImageEditingProvider;qwen?:ImageEditingProvider;local?:ImageEditingProvider;mock?:ImageEditingProvider}){}
 async edit(input:ImageEditInput,onStage:(provider:string)=>Promise<void>=async()=>{}):Promise<ImageEditResult>{
  const list=this.mode==='browser_local'?[]:this.mode==='mock'?[this.providers.mock]:this.mode==='gemini_only'?[this.providers.gemini]:this.mode==='openai_only'?[this.providers.openai]:(this.mode==='qwen_only'||this.mode==='qwen_free')?[this.providers.qwen]:this.mode==='local_only'?[this.providers.local]:[this.providers.openai,this.providers.gemini,this.providers.qwen];
  const available=list.filter((p):p is ImageEditingProvider=>!!p);
  if(!available.length)throw new ProviderError('PROVIDER_NOT_CONFIGURED');
  let last:unknown;let failures=0;
  for(const provider of available){
   await onStage(provider.name);
   try{const result=await provider.edit(input);return {...result,fallback:failures>0||(this.mode==='auto'&&provider.name!=='openai')};}
   catch(error){last=error;if(this.mode!=='auto'||!(error instanceof ProviderError)||!error.transient)throw error;failures++;}
  }
  throw last||new ProviderError('GENERATION_FAILED');
 }
}
