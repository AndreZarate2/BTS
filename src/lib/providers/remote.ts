import type {ImageEditingProvider,ImageEditInput,ImageEditResult,ProviderName} from '@/types/images';
import {boundedBytes} from '@/lib/server/http';
export class ProviderError extends Error {
 constructor(public code:string,public transient=false){super(code);}
}
export interface RemoteConfig {key:string;model:string;quality?:string;timeoutMs?:number;baseUrl?:string;}
abstract class RemoteProvider implements ImageEditingProvider {
 abstract name:ProviderName;
 constructor(protected config:RemoteConfig,private request:typeof fetch=fetch){}
 protected abstract endpoint():string;
 async edit(input:ImageEditInput):Promise<ImageEditResult>{
  const start=Date.now(),body=new FormData();
  body.append('model',this.config.model);body.append('prompt',input.prompt);
  const field=this.name==='qwen'?'image':'image[]';
  body.append(field,new Blob([Buffer.from(input.baseImage)],{type:'image/jpeg'}),'scene.jpg');
  body.append(field,new Blob([Buffer.from(input.userImage)],{type:'image/jpeg'}),'reference.jpg');
  body.append('output_format','jpeg');body.append('size','auto');body.append('n','1');
  if(this.name==='openai'){
   body.append('quality',this.config.quality||'high');
   if(this.config.model.startsWith('gpt-image-1'))body.append('input_fidelity','high');
  }else body.append('response_format','b64_json');
  let response:Response;const endpoint=this.endpoint();
  try{response=await this.request(endpoint,{method:'POST',redirect:'error',headers:{...(this.config.key?{Authorization:`Bearer ${this.config.key}`}:{ }),'Idempotency-Key':input.idempotencyKey},body,signal:AbortSignal.timeout(this.config.timeoutMs||70000)});}
  catch{throw new ProviderError('PROVIDER_NETWORK',true);}
  if(!response.ok){
   // Authorization, safety and invalid-request errors never fall through to another provider.
   const transient=[408,429,500,502,503,504].includes(response.status);
   let denied=false;
   try{const info=new TextDecoder().decode(await boundedBytes(response,16384));denied=/moderation|safety|content_policy|policy_violation/i.test(info);}catch{throw new ProviderError('PROVIDER_UNREADABLE_ERROR');}
   throw new ProviderError(denied?'PROVIDER_SAFETY':`PROVIDER_HTTP_${response.status}`,transient&&!denied);
  }
  let data:{data?:{b64_json?:unknown}[]};
  try{data=JSON.parse(new TextDecoder().decode(await boundedBytes(response,28_000_000)));}catch{throw new ProviderError('PROVIDER_INVALID_OUTPUT');}
  const raw=data.data?.[0]?.b64_json;
  if(typeof raw!=='string'||!raw.length||raw.length>28_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw new ProviderError('PROVIDER_INVALID_OUTPUT');
  return {bytes:Buffer.from(raw,'base64'),provider:this.name,fallback:false,durationMs:Date.now()-start};
 }
}
export class OpenAIImageProvider extends RemoteProvider {
 name='openai' as const;
 protected endpoint(){if(!this.config.key)throw new ProviderError('OPENAI_NOT_CONFIGURED');return 'https://api.openai.com/v1/images/edits';}
}
export function qwenEndpoint(base:string){
 let url:URL;try{url=new URL(base);}catch{throw new ProviderError('QWEN_NOT_CONFIGURED');}
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(local&&process.env.NODE_ENV!=='production'&&url.protocol==='http:')))throw new ProviderError('QWEN_INVALID_URL');
 url.pathname=url.pathname.replace(/\/$/,'').replace(/\/v1$/,'')+'/v1/images/edits';return url.toString();
}
export class QwenImageProvider extends RemoteProvider {name='qwen' as const;protected endpoint(){return qwenEndpoint(this.config.baseUrl||'');}}
export async function qwenHealth(base:string,key:string){
 const url=new URL(qwenEndpoint(base));url.pathname=url.pathname.replace(/images\/edits$/,'models');
 try{const response=await fetch(url,{headers:key?{Authorization:`Bearer ${key}`}:{},redirect:'error',signal:AbortSignal.timeout(5000)});return {configured:true,reachable:response.ok};}catch{return {configured:true,reachable:false};}
}
