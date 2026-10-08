/* global Vision */
/* Local processing only. Runtime, model and photos stay on the same origin/device. */
const nativeFetch=self.fetch.bind(self);
const localUrl=value=>new URL(value instanceof Request?value.url:String(value),self.location.href).origin===self.location.origin;
self.fetch=(input,options)=>localUrl(input)?nativeFetch(input,options):Promise.reject(new Error('External connections disabled'));
const nativeOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...options){if(!localUrl(url))throw new Error('External connections disabled');return Reflect.apply(nativeOpen,this,[method,url,...options]);};
importScripts('/vendor/mediapipe/1.1.0/vision_bundle.js');
const base='/vendor/mediapipe/1.1.0';
self.onmessage=async({data:{portrait,scene}})=>{
 let segmenter,detector;
 try{
  const files=await Vision.FilesetResolver.forVisionTasks(base+'/wasm');
  segmenter=await Vision.ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:base+'/selfie-multiclass.tflite',delegate:'CPU'},runningMode:'IMAGE',outputConfidenceMasks:true,outputCategoryMask:false});
  detector=await Vision.FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:base+'/face-detector.tflite',delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.5});
  const faces=detector.detect(portrait).detections;
  if(faces.length!==1)throw Error(faces.length?'LOCAL_ONE_PERSON':'LOCAL_FACE_NOT_FOUND');
  const sourceFace=faces[0].boundingBox;
  const sceneFaces=detector.detect(scene).detections.map(item=>item.boundingBox);
  for(const x of [0,Math.floor(scene.width/2)])for(const y of [0,Math.floor(scene.height/2)]){
   const tile=new OffscreenCanvas(Math.ceil(scene.width/2),Math.ceil(scene.height/2));tile.getContext('2d').drawImage(scene,-x,-y);
   for(const item of detector.detect(tile).detections){const b={...item.boundingBox,originX:item.boundingBox.originX+x,originY:item.boundingBox.originY+y};if(!sceneFaces.some(v=>Math.hypot(v.originX-b.originX,v.originY-b.originY)<Math.min(v.width,b.width)*.6))sceneFaces.push(b);}
  }
  const result=segmenter.segment(portrait),background=result.confidenceMasks[0],faceMask=result.confidenceMasks[3];
  const b=background.getAsFloat32Array(),f=faceMask.getAsFloat32Array(),mask=new OffscreenCanvas(background.width,background.height),m=mask.getContext('2d'),pixels=m.createImageData(mask.width,mask.height);
  for(let i=0;i<b.length;i++){let a=Math.max(0,Math.min(1,(1-b[i]-.12)/.72));a=a*a*(3-2*a);if(f[i]>.2)a=1;pixels.data[i*4+3]=Math.round(a*255);}
  m.putImageData(pixels,0,0);result.close();
  const canvas=new OffscreenCanvas(portrait.width,portrait.height),c=canvas.getContext('2d',{willReadFrequently:true});
  c.drawImage(portrait,0,0);c.globalCompositeOperation='destination-in';c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(mask,0,0,canvas.width,canvas.height);c.globalCompositeOperation='source-over';
  const rgba=c.getImageData(0,0,canvas.width,canvas.height),seen=new Uint8Array(canvas.width*canvas.height),queue=new Int32Array(seen.length);let head=0,tail=0;
  const sx=Math.min(canvas.width-1,Math.max(0,Math.round(sourceFace.originX+sourceFace.width/2))),sy=Math.min(canvas.height-1,Math.max(0,Math.round(sourceFace.originY+sourceFace.height/2)));
  const push=p=>{if(p<0||p>=seen.length||seen[p]||rgba.data[p*4+3]<20)return;seen[p]=1;queue[tail++]=p;};push(sy*canvas.width+sx);
  while(head<tail){const p=queue[head++],x=p%canvas.width;push(p-canvas.width);push(p+canvas.width);if(x>0)push(p-1);if(x<canvas.width-1)push(p+1);}
  if(tail<seen.length*.01)throw Error('LOCAL_CUTOUT_EMPTY');
  for(let p=0;p<seen.length;p++)if(!seen[p])rgba.data[p*4+3]=0;c.putImageData(rgba,0,0);
  let left=canvas.width,right=0,top=canvas.height,bottom=0,count=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(rgba.data[(y*canvas.width+x)*4+3]>160){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
  if(count<canvas.width*canvas.height*.02)throw Error('LOCAL_CUTOUT_EMPTY');
  const pad=3;left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(canvas.width-1,right+pad);bottom=Math.min(canvas.height-1,bottom+pad);
  const cutout=new OffscreenCanvas(right-left+1,bottom-top+1);cutout.getContext('2d').drawImage(canvas,left,top,cutout.width,cutout.height,0,0,cutout.width,cutout.height);
  const blob=await cutout.convertToBlob({type:'image/png'});
  const original=new OffscreenCanvas(cutout.width,cutout.height);original.getContext('2d').drawImage(portrait,left,top,cutout.width,cutout.height,0,0,cutout.width,cutout.height);
  self.postMessage({ok:true,blob,original:await original.convertToBlob({type:'image/png'}),face:{x:sourceFace.originX-left,y:sourceFace.originY-top,width:sourceFace.width,height:sourceFace.height},sceneFaces:sceneFaces.map(b=>({x:b.originX,y:b.originY,width:b.width,height:b.height}))});
 }catch(error){self.postMessage({ok:false,error:error instanceof Error&&error.message.startsWith('LOCAL_')?error.message:'LOCAL_PROCESSING_UNAVAILABLE'});}
 finally{segmenter?.close();detector?.close();portrait?.close();scene?.close();}
};
