import {createHash,randomUUID} from 'node:crypto';
import type {ImageEditingProvider,ImageEditInput,ImageEditResult} from '@/types/images';
import {boundedBytes} from '@/lib/server/http';
import {ProviderError} from './remote';

// Fixed destination: do not accept image URLs or Space names supplied by visitors.
export const QWEN_SPACE='https://lpx55-qwen-image-edit-2511-turbo-lightning.hf.space';
const API=QWEN_SPACE+'/gradio_api';
const MAX_EVENT_BYTES=512_000;
type FileResult={image?:{url?:unknown}};

function failure(value:unknown):ProviderError {
 const detail=typeof value==='string'?value:JSON.stringify(value)||'';
 if(/quota|GPU (?:time|duration)|exceeded.*(?:limit|usage)/i.test(detail))return new ProviderError('QWEN_FREE_QUOTA');
 if(/sign.?in|log.?in|unauthorized|authentication/i.test(detail))return new ProviderError('HF_AUTH_REQUIRED');
 if(/queue.*full|busy|GPU.*(?:unavailable|available)|zerogpu|capacity/i.test(detail))return new ProviderError('QWEN_FREE_BUSY');
 if(/safety|moderation|content.policy/i.test(detail))return new ProviderError('PROVIDER_SAFETY');
 return new ProviderError('QWEN_FREE_UNAVAILABLE');
}

export function qwenResultUrl(value:unknown):string {
 if(typeof value!=='string')throw new ProviderError('PROVIDER_INVALID_OUTPUT');
 let url:URL;
 try{url=new URL(value);}catch{throw new ProviderError('PROVIDER_INVALID_OUTPUT');}
 // Never send the HF credential to an output URL on another host, even after redirects.
 if(url.origin!==QWEN_SPACE||url.username||url.password||url.search||url.hash||!url.pathname.startsWith('/gradio_api/file=/tmp/gradio/'))throw new ProviderError('PROVIDER_INVALID_OUTPUT');
 return url.href;
}

async function complete(response:Response):Promise<unknown> {
 if(!response.headers.get('content-type')?.includes('text/event-stream')||!response.body)throw new ProviderError('PROVIDER_INVALID_OUTPUT');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',total=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)throw new ProviderError('QWEN_FREE_UNAVAILABLE');
   total+=value.byteLength;if(total>MAX_EVENT_BYTES)throw new ProviderError('PROVIDER_INVALID_OUTPUT');
   pending+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
   let boundary:number;
   while((boundary=pending.indexOf('\n\n'))!==-1){
    const block=pending.slice(0,boundary);pending=pending.slice(boundary+2);
    const lines=block.split('\n'),event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();
    if(event!=='complete'&&event!=='error')continue;
    let data:unknown;
    try{data=JSON.parse(lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n'));}catch{throw new ProviderError('PROVIDER_INVALID_OUTPUT');}
    if(event==='error')throw failure(data);
    return data;
   }
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export class HuggingFaceQwenProvider implements ImageEditingProvider {
 name='qwen' as const;
 constructor(private token:string,private request:typeof fetch=fetch){}
 async edit(input:ImageEditInput):Promise<ImageEditResult>{
  if(!this.token)throw new ProviderError('HF_AUTH_REQUIRED');
  const start=Date.now(),remaining=Math.min(210000,(input.deadlineAt||Infinity)-start);
  if(remaining<=0)throw new ProviderError('PROVIDER_TIMEOUT');
  const signal=AbortSignal.timeout(Math.ceil(remaining));
  const headers={Authorization:`Bearer ${this.token}`};
  const call=async(url:string,init:RequestInit={})=>{
   let response:Response;
   try{response=await this.request(url,{...init,headers:{...headers,...init.headers},redirect:'error',signal});}
   catch{throw new ProviderError(signal.aborted?'PROVIDER_TIMEOUT':'QWEN_FREE_UNAVAILABLE');}
   if(!response.ok){
    if(response.status===401||response.status===403)throw new ProviderError('HF_AUTH_REQUIRED');
    if(response.status===429)throw new ProviderError('QWEN_FREE_QUOTA');
    throw new ProviderError('QWEN_FREE_UNAVAILABLE');
   }
   return response;
  };
  const json=async(response:Response)=>{
   try{return JSON.parse(new TextDecoder().decode(await boundedBytes(response,MAX_EVENT_BYTES))) as unknown;}catch{throw new ProviderError('PROVIDER_INVALID_OUTPUT');}
  };
  try{
   // Keep this mode free: reject paid/unknown accounts before uploading any photo.
   const account=await json(await call('https://huggingface.co/api/whoami-v2')) as {type?:string;isPro?:boolean;orgs?:{isEnterprise?:boolean;canPay?:boolean}[]};
   if(account.type!=='user'||account.isPro!==false||account.orgs?.some(org=>org.isEnterprise||org.canPay))throw new ProviderError('HF_FREE_ACCOUNT_REQUIRED');
   const body=new FormData();
   body.append('files',new Blob([Buffer.from(input.baseImage)],{type:'image/jpeg'}),'scene.jpg');
   body.append('files',new Blob([Buffer.from(input.userImage)],{type:'image/jpeg'}),'reference.jpg');
   const paths=await json(await call(API+'/upload',{method:'POST',body}));
   if(!Array.isArray(paths)||paths.length!==2||paths.some(path=>typeof path!=='string'||!/^\/tmp\/gradio\/[a-zA-Z0-9/_\-.]+$/.test(path)||path.includes('..')))throw new ProviderError('PROVIDER_INVALID_OUTPUT');
   const images=paths.map(path=>({image:{path,meta:{_type:'gradio.FileData'}},caption:null}));
   const seed=createHash('sha256').update(input.idempotencyKey).digest().readUInt32BE(0)%2147483647;
   // Gradio stores the slider override flags per session; without them it silently
   // ignores dimensions and returns a 1024px image. These endpoints affect only this session.
   const sessionHash=randomUUID();
   const invoke=async(name:'lambda'|'lambda_1'|'infer',data:unknown[])=>{
    const submitted=await json(await call(API+'/call/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,session_hash:sessionHash})})) as {event_id?:unknown};
    if(typeof submitted.event_id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(submitted.event_id))throw new ProviderError('PROVIDER_INVALID_OUTPUT');
    return complete(await call(API+'/call/'+name+'/'+submitted.event_id));
   };
   const size=input.outputSize||{width:1536,height:1536};
   if([size.width,size.height].some(value=>!Number.isInteger(value)||value<256||value>1536||value%16!==0))throw new ProviderError('PROVIDER_INVALID_OUTPUT');
   await invoke('lambda',[]);await invoke('lambda_1',[]);
   const data=await invoke('infer',[images,input.prompt,seed,false,1,4,size.height,size.width,false,1]);
   const gallery=Array.isArray(data)?data[0]:null;
   if(!Array.isArray(gallery)||gallery.length!==1)throw new ProviderError('PROVIDER_INVALID_OUTPUT');
   const image=await call(qwenResultUrl((gallery[0] as FileResult)?.image?.url));
   if(!/^image\/(png|jpeg|webp)(;|$)/.test(image.headers.get('content-type')||''))throw new ProviderError('PROVIDER_INVALID_OUTPUT');
   const bytes=await boundedBytes(image,20*1048576);
   return {bytes,provider:'qwen',fallback:false,durationMs:Date.now()-start};
  }catch(error){
   if(signal.aborted)throw new ProviderError('PROVIDER_TIMEOUT');
   if(error instanceof ProviderError)throw error;
   throw new ProviderError('QWEN_FREE_UNAVAILABLE');
  }
 }
}

export async function huggingFaceHealth(token:string){
 if(!token)return {configured:false,reachable:false,code:'HF_AUTH_REQUIRED'};
 try{
  const response=await fetch('https://huggingface.co/api/whoami-v2',{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(6000)});
  if(!response.ok)return {configured:true,reachable:false,code:'HF_AUTH_REQUIRED'};
  const account=JSON.parse(new TextDecoder().decode(await boundedBytes(response,128000))) as {type?:string;isPro?:boolean;orgs?:{isEnterprise?:boolean;canPay?:boolean}[]};
  if(account.type!=='user'||account.isPro!==false||account.orgs?.some(org=>org.isEnterprise||org.canPay))return {configured:true,reachable:false,code:'HF_FREE_ACCOUNT_REQUIRED'};
  const info=await fetch(API+'/info',{redirect:'error',signal:AbortSignal.timeout(6000)});
  return {configured:true,reachable:info.ok,code:info.ok?'QWEN_FREE_AVAILABLE':'QWEN_FREE_UNAVAILABLE'};
 }catch{return {configured:true,reachable:false,code:'QWEN_FREE_UNAVAILABLE'};}
}
