export type ProviderName='openai'|'gemini'|'qwen'|'local_composite'|'mock';
export type ProviderMode='auto'|'gemini_only'|'openai_only'|'qwen_only'|'qwen_free'|'local_only'|'mock';
export type JobStatus='queued'|'processing'|'ready'|'failed'|'cancelled';
export interface Placement {mode?:'auto'|'manual';x:number;y:number;width:number;height:number;rotation:number;description:string;preferred_crop:'contain'|'cover';}
export interface ImageEditInput {baseImage:Uint8Array;userImage:Uint8Array;placement:Placement;prompt:string;idempotencyKey:string;deadlineAt?:number;outputSize?:{width:number;height:number};}
export interface ImageEditResult {bytes:Uint8Array;provider:ProviderName;fallback:boolean;durationMs:number;}
export interface ImageEditingProvider {name:ProviderName;edit(input:ImageEditInput):Promise<ImageEditResult>;}
export const defaultPlacement:Placement={mode:'auto',x:.55,y:.18,width:.4,height:.78,rotation:0,description:'Integrar a la persona al lado de los artistas, sin ocultarlos.',preferred_crop:'contain'};
export function placementFrom(value:unknown):Placement {
 const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
 const number=(k:string,fallback:number,min:number,max:number)=>typeof v[k]==='number'&&Number.isFinite(v[k])?Math.max(min,Math.min(max,v[k] as number)):fallback;
 const x=number('x',.55,0,.9),y=number('y',.18,0,.9);
 return {mode:v.mode==='manual'?'manual':'auto',x,y,width:number('width',.4,.1,1-x),height:number('height',.78,.1,1-y),rotation:number('rotation',0,-30,30),description:typeof v.description==='string'?v.description.slice(0,500):defaultPlacement.description,preferred_crop:v.preferred_crop==='cover'?'cover':'contain'};
}
