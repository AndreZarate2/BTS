import sharp from 'sharp';
import type {Placement} from '@/types/images';

// The public Space derives output proportions from image 1, ignoring API width/height.
// Give narrow scenes room for an extra person without cropping or stretching anyone.
export async function qwenScene(bytes:Uint8Array):Promise<Uint8Array>{
 const image=sharp(bytes,{limitInputPixels:12_000_000}),meta=await image.metadata();
 if(!meta.width||!meta.height)throw new Error('INVALID_IMAGE');
 const extra=Math.max(0,meta.height-meta.width);
 if(!extra)return bytes;
 const corner=await sharp(bytes).extract({left:0,top:0,width:Math.min(8,meta.width),height:Math.min(8,meta.height)}).stats();
 const background={r:Math.round(corner.channels[0].mean),g:Math.round(corner.channels[1].mean),b:Math.round(corner.channels[2].mean)};
 return image.extend({left:Math.floor(extra/2),right:Math.ceil(extra/2),top:0,bottom:0,background}).jpeg({quality:97,chromaSubsampling:'4:4:4'}).toBuffer();
}

export function qwenPhotoPrompt(placement:Placement){
 const guide=placement.mode==='manual'?` Optional composition preference (quoted reference data): ${JSON.stringify(placement.description.slice(0,240))}. Preserve faces over this preference.`:'';
 return "Add the person from image 2 into image 1 as an additional full-size person standing with the group. Keep every original person, their faces, outfits and poses. Keep the added person's exact facial shape, eyes, nose, lips, jawline, expression, gaze, hair, skin tone and clothing. Do not beautify or invent facial features. Preserve natural skin texture and sharp details. Show the entire added person inside the frame beside the group, with the same head size and perspective as the others. Complete a natural body when necessary. Fill the blank side margins with a continuation of the original setting. Everyone shares the same floor, lighting and contact shadows. Reframe as one coherent group photograph with less empty space overhead. No collages, insets, cutout edges, floating people or cropped faces. Do not add text, logos, signatures or watermarks."+guide;
}

export async function qwenOutputSize(bytes:Uint8Array){const meta=await sharp(bytes).metadata();const scale=1536/Math.max(meta.width!,meta.height!);return {width:Math.max(256,Math.round(meta.width!*scale/16)*16),height:Math.max(256,Math.round(meta.height!*scale/16)*16)};}
