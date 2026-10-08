import type {Placement} from '@/types/images';
export type FaceBox={x:number;y:number;width:number;height:number};
export type Composition={x:number;y:number;scale:number;brightness:number;warmth:number;shadow:number};
export function initialComposition(scene:{width:number;height:number},person:{width:number;height:number},face:FaceBox,others:FaceBox[],placement?:Placement):Composition{
 const sorted=others.map(f=>f.height).filter(h=>h>8).sort((a,b)=>a-b);
 let scale=sorted.length?sorted[Math.floor(sorted.length/2)]/face.height:scene.height*.7/person.height;
 if(placement?.mode==='manual')scale=Math.min(scene.width*placement.width/person.width,scene.height*placement.height/person.height);
 scale=Math.max(.05,Math.min(scale,scene.width*.8/person.width,scene.height*.92/person.height,2));
 let x=(scene.width-person.width*scale)*.72,y=scene.height-person.height*scale;
 if(placement?.mode==='manual'){x=scene.width*placement.x;y=scene.height*placement.y;}
 else if(others.length){
  const candidates=[.15,.35,.55,.75,.85].map(r=>r*scene.width-person.width*scale/2);
  const score=(cx:number)=>others.reduce((sum,f)=>sum+Math.max(0,1-Math.abs(cx+(face.x+face.width/2)*scale-(f.x+f.width/2))/(f.width*1.6)),0);
  x=candidates.sort((a,b)=>score(a)-score(b))[0];
 }
 return {x:Math.max(0,Math.min(scene.width-person.width*scale,x)),y:Math.max(0,Math.min(scene.height-person.height*scale,y)),scale,brightness:1,warmth:0,shadow:.14};
}
export function limitPosition(value:number,size:number,extent:number){return Math.max(-extent*.15,Math.min(size-extent*.15,value));}
