import sharp from 'sharp';
import {ApiError} from './http';
export async function normalizeImage(bytes:Uint8Array,mime?:string,maxBytes=10*1048576):Promise<Buffer>{
 if(bytes.length===0||bytes.length>maxBytes)throw new ApiError('INVALID_IMAGE');
 try{
  const image=sharp(bytes,{limitInputPixels:12_000_000,failOn:'error',animated:false}),meta=await image.metadata();
  const types:Record<string,string>={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
  if(!meta.format||!types[meta.format]||(mime&&mime!==types[meta.format])||!meta.width||!meta.height||meta.width<128||meta.height<128||(meta.pages||1)>1)throw new Error();
  return await image.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toBuffer();
 }catch{throw new ApiError('INVALID_IMAGE');}
}
export async function thumbnail(bytes:Uint8Array){return sharp(bytes,{limitInputPixels:12_000_000}).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).jpeg({quality:70}).toBuffer();}

export async function previewImage(bytes:Uint8Array){return sharp(bytes,{limitInputPixels:12_000_000}).resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();}
