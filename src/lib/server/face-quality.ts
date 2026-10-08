import 'server-only';
import sharp from 'sharp';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ProviderError} from '@/lib/providers/remote';

const requireRuntime=createRequire(path.join(process.cwd(),'package.json'));
type Face={box:{x:number;y:number;width:number;height:number};descriptor:number[]};
// Descriptors exist only in memory for this job. No identity database, names or biometric logs.
let ready:Promise<{tf:typeof import('@tensorflow/tfjs');face:typeof import('@vladmandic/face-api')}>|undefined;
async function runtime(){
 return ready??=(async()=>{
  const tfModule=await import('@tensorflow/tfjs');
  const tf=('default' in tfModule?tfModule.default:tfModule) as typeof import('@tensorflow/tfjs');
  const wasmModule=await import('@tensorflow/tfjs-backend-wasm');
  const wasm=('default' in wasmModule?wasmModule.default:wasmModule) as typeof import('@tensorflow/tfjs-backend-wasm');
  const faceModule=await import('@vladmandic/face-api/dist/face-api.node-wasm.js');
  const face=('default' in faceModule?faceModule.default:faceModule) as typeof import('@vladmandic/face-api');
  wasm.setWasmPaths(path.dirname(requireRuntime.resolve('@tensorflow/tfjs-backend-wasm'))+path.sep);
  await tf.setBackend('wasm');await tf.ready();
  const models=path.join(path.dirname(requireRuntime.resolve('@vladmandic/face-api/package.json')),'model');
  await Promise.all([face.nets.ssdMobilenetv1.loadFromDisk(models),face.nets.faceLandmark68Net.loadFromDisk(models),face.nets.faceRecognitionNet.loadFromDisk(models)]);
  return {tf,face};
 })().catch(()=>{ready=undefined;throw new ProviderError('PHOTO_CHECK_UNAVAILABLE');});
}
function overlap(a:Face['box'],b:Face['box']){const intersection=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return intersection/Math.min(a.width*a.height,b.width*b.height);}
async function detect(bytes:Uint8Array,tiled=false):Promise<Face[]>{
 const {tf,face}=await runtime(),meta=await sharp(bytes).metadata();const width=meta.width!,height=meta.height!;
 const regions=[{left:0,top:0,width,height}];
 if(tiled&&(width>768||height>768))for(const left of new Set([0,Math.max(0,width-768)]))for(const top of new Set([0,Math.max(0,height-768)]))regions.push({left,top,width:Math.min(width,768),height:Math.min(height,768)});
 const faces:Face[]=[];
 for(const region of regions){
  const {data,info}=await sharp(bytes).extract(region).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const tensor=tf.tensor3d(new Uint8Array(data),[info.height,info.width,3]);
  try{
   const found=await face.detectAllFaces(tensor as unknown as Parameters<typeof face.detectAllFaces>[0],new face.SsdMobilenetv1Options({minConfidence:.5,maxResults:20})).withFaceLandmarks().withFaceDescriptors();
   for(const item of found){const b=item.detection.box;const candidate={box:{x:b.x+region.left,y:b.y+region.top,width:b.width,height:b.height},descriptor:Array.from(item.descriptor)};if(!faces.some(other=>overlap(other.box,candidate.box)>.45))faces.push(candidate);}
  }finally{tensor.dispose();}
 }
 return faces;
}
export function focusScore(data:Uint8Array,width:number,height:number){
 let n=0,sum=0,squares=0;
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x,v=4*data[i]-data[i-1]-data[i+1]-data[i-width]-data[i+width];n++;sum+=v;squares+=v*v;}
 return n?squares/n-(sum/n)**2:0;
}
export function assertPhotoMetrics(count:number,width:number,height:number,focus:number){
 if(count!==1)throw new ProviderError(count===0?'PHOTO_FACE_UNCLEAR':'PHOTO_NEEDS_ONE_PERSON');
 if(Math.min(width,height)<120)throw new ProviderError('PHOTO_FACE_TOO_SMALL');
 if(focus<30)throw new ProviderError('PHOTO_FACE_BLURRY');
}
export async function inspectPortrait(bytes:Uint8Array){
 const faces=await detect(bytes);if(faces.length!==1)assertPhotoMetrics(faces.length,0,0,0);
 const face=faces[0];
 assertPhotoMetrics(1,face.box.width,face.box.height,await faceFocus(bytes,face));
 return face;
}
async function faceFocus(bytes:Uint8Array,face:Face){
 const meta=await sharp(bytes).metadata(),left=Math.max(0,Math.floor(face.box.x)),top=Math.max(0,Math.floor(face.box.y));
 const {data,info}=await sharp(bytes).extract({left,top,width:Math.min(meta.width!-left,Math.floor(face.box.width)),height:Math.min(meta.height!-top,Math.floor(face.box.height))}).resize(128,128).greyscale().raw().toBuffer({resolveWithObject:true});
 return focusScore(data,info.width,info.height);
}
export function assertResultDetail(width:number,height:number,focus:number){
 if(![width,height,focus].every(Number.isFinite)||Math.min(width,height)<120||focus<30)throw new ProviderError('PHOTO_RESULT_BLURRY');
}
export function assertFaceSimilarity(distances:number[]){
 if(distances.some(value=>!Number.isFinite(value)||value<0))throw new ProviderError('PHOTO_LIKENESS_REJECTED');
 const sorted=[...distances].sort((a,b)=>a-b);
 // A conservative visual correspondence check, not a guarantee of identity or authenticity.
 if(!sorted.length||sorted[0]>.42||(sorted.length>1&&sorted[1]-sorted[0]<.08))throw new ProviderError('PHOTO_LIKENESS_REJECTED');
}
export async function verifyPortrait(reference:Uint8Array,result:Uint8Array){
 const source=await detect(reference);if(source.length!==1)throw new ProviderError('PHOTO_FACE_UNCLEAR');
 const output=await detect(result,true);
 const distances=output.map(item=>Math.sqrt(item.descriptor.reduce((sum,value,i)=>sum+(value-source[0].descriptor[i])**2,0)));
 assertFaceSimilarity(distances);
 const matched=output[distances.indexOf(Math.min(...distances))];
 assertResultDetail(matched.box.width,matched.box.height,await faceFocus(result,matched));
}

export async function sceneFaceBoxes(bytes:Uint8Array){return (await detect(bytes,true)).map(face=>face.box);}
