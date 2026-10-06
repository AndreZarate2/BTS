import sharp from 'sharp';
import type {ImageEditingProvider,ImageEditInput,ImageEditResult} from '@/types/images';
// Connected-background segmentation. Best with a plain, contrasting background.
// Only pixels connected to the image border can become transparent.
export async function segmentBackground(bytes:Uint8Array){
 const {data,info}=await sharp(bytes,{limitInputPixels:12_000_000}).resize({width:768,height:1024,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const border:number[][]=[];for(let x=0;x<w;x+=Math.max(1,Math.floor(w/20))){for(const y of [0,h-1]){const i=(y*w+x)*4;border.push([data[i],data[i+1],data[i+2]]);}}
 for(let y=0;y<h;y+=Math.max(1,Math.floor(h/20))){for(const x of [0,w-1]){const i=(y*w+x)*4;border.push([data[i],data[i+1],data[i+2]]);}}
 const colors=[0,1,2].map(c=>border.map(p=>p[c]).sort((a,b)=>a-b)[Math.floor(border.length/2)]);
 function enqueue(p:number){if(p<0||p>=w*h||seen[p])return;seen[p]=1;const i=p*4;const distance=Math.hypot(data[i]-colors[0],data[i+1]-colors[1],data[i+2]-colors[2]);if(distance<68){data[i+3]=0;queue[tail++]=p;}}
 for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x);}for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1);}
 while(head<tail){const p=queue[head++],x=p%w;enqueue(p-w);enqueue(p+w);if(x>0)enqueue(p-1);if(x<w-1)enqueue(p+1);}
 // Feather the extracted alpha to reduce hard cutout edges.
 const alpha=await sharp(data,{raw:{width:w,height:h,channels:4}}).extractChannel(3).blur(.6).toBuffer();
 for(let p=0;p<w*h;p++)data[p*4+3]=alpha[p];
 return sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
}
export class LocalCompositeProvider implements ImageEditingProvider {
 name='local_composite' as const;
 async edit(input:ImageEditInput):Promise<ImageEditResult>{
  const start=Date.now(),base=await sharp(input.baseImage).resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).toBuffer();
  const meta=await sharp(base).metadata(),w=meta.width!,h=meta.height!,p=input.placement;
  const cutout=await segmentBackground(input.userImage),stats=await sharp(base).stats(),own=await sharp(input.userImage).stats();
  const ratio=Math.max(.75,Math.min(1.25,stats.channels.slice(0,3).reduce((s,c)=>s+c.mean,0)/Math.max(1,own.channels.slice(0,3).reduce((s,c)=>s+c.mean,0))));
  const patch=await sharp(cutout).modulate({brightness:ratio,saturation:.94}).linear(1.03,-3).resize({width:Math.max(1,Math.round(w*p.width)),height:Math.max(1,Math.round(h*p.height)),fit:p.preferred_crop,background:'#00000000'}).rotate(p.rotation,{background:'#00000000'}).resize({width:Math.max(1,Math.round(w*p.width)),height:Math.max(1,Math.round(h*p.height)),fit:'inside'}).png().toBuffer();
  const pm=await sharp(patch).metadata(),left=Math.min(w-pm.width!,Math.round(p.x*w)),top=Math.min(h-pm.height!,Math.round(p.y*h));
  const shadow=await sharp(patch).tint('#15121e').modulate({brightness:.2}).blur(5).png().toBuffer();
  const {data,info}=await sharp(base).composite([{input:shadow,left:Math.min(w-pm.width!,left+4),top:Math.min(h-pm.height!,top+6),blend:'over'},{input:patch,left,top,blend:'over'}]).raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<data.length;i++){const grain=((i*1664525+1013904223)>>>24)%5-2;data[i]=Math.max(0,Math.min(255,data[i]+grain));}
  const bytes=await sharp(data,{raw:{width:info.width,height:info.height,channels:info.channels}}).jpeg({quality:91}).toBuffer();
  return {bytes,provider:this.name,fallback:false,durationMs:Date.now()-start};
 }
}
export class MockImageProvider implements ImageEditingProvider {
 name='mock' as const;
 constructor(private latency=700){}
 async edit(input:ImageEditInput):Promise<ImageEditResult>{
  const start=Date.now();await new Promise(resolve=>setTimeout(resolve,this.latency));
  const overlay=Buffer.from('<svg width="640" height="90"><rect width="640" height="90" fill="#1b1228"/><text x="28" y="56" font-family="sans-serif" font-size="25" fill="#d8c4ff">BTS · IMAGEN DE PRUEBA / MOCK</text></svg>');
  const bytes=await sharp(input.baseImage).resize(640,800,{fit:'cover'}).composite([{input:overlay,left:0,top:710}]).jpeg().toBuffer();
  return {bytes,provider:this.name,fallback:false,durationMs:Date.now()-start};
 }
}
