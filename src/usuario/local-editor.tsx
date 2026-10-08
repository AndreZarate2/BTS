'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Move,RotateCcw,Scissors,X} from 'lucide-react';
import {Spinner} from '@/components/ui';
import {rawApi} from '@/lib/backend';
import {initialComposition,limitPosition,type Composition,type FaceBox} from '@/lib/local-composition';
import {placementFrom} from '@/types/images';

type Assets={scene:ImageBitmap;person:HTMLCanvasElement;original:ImageBitmap;initial:ImageBitmap;settings:Composition};
const messages:Record<string,string>={LOCAL_ONE_PERSON:'Usa una foto en la que aparezcas solo tú.',LOCAL_FACE_NOT_FOUND:'No pudimos localizar tu rostro. Usa una foto más cercana y de frente.',LOCAL_CUTOUT_EMPTY:'No pudimos separar a la persona del fondo. Prueba otra foto con mejor luz.',LOCAL_PROCESSING_UNAVAILABLE:'Este navegador no pudo iniciar el recorte local. Prueba Chrome, Edge o Safari actualizado.'};
function paint(canvas:HTMLCanvasElement,assets:Assets,settings:Composition){
 const {scene,person}=assets;canvas.width=scene.width;canvas.height=scene.height;
 const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(scene,0,0);
 c.save();c.translate(settings.x,settings.y);c.scale(settings.scale,settings.scale);
 if(settings.shadow){c.shadowColor=`rgba(20,15,30,${settings.shadow})`;c.shadowBlur=8/settings.scale;c.shadowOffsetY=4/settings.scale;c.shadowOffsetX=2/settings.scale;}
 c.filter=`brightness(${settings.brightness})`;
 if(settings.warmth){
  const tint=document.createElement('canvas');tint.width=person.width;tint.height=person.height;const t=tint.getContext('2d')!;t.drawImage(person,0,0);t.globalCompositeOperation='source-atop';t.fillStyle=settings.warmth>0?`rgba(255,164,84,${settings.warmth/400})`:`rgba(110,165,255,${-settings.warmth/400})`;t.fillRect(0,0,tint.width,tint.height);c.drawImage(tint,0,0);
 }else c.drawImage(person,0,0);c.restore();
}
async function scaledBitmap(file:Blob){const source=await createImageBitmap(file);const scale=Math.min(1,2048/Math.max(source.width,source.height));if(scale===1)return source;const resized=await createImageBitmap(source,{resizeWidth:Math.round(source.width*scale),resizeHeight:Math.round(source.height*scale),resizeQuality:'high'});source.close();return resized;}
export default function LocalEditor({file,sessionId,onClose,onSave}:{file:File;sessionId:string;onClose:()=>void;onSave:(file:File)=>Promise<void>}){
 const [assets,setAssets]=useState<Assets|null>(null),[settings,setSettings]=useState<Composition|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[tool,setTool]=useState<'move'|'erase'|'restore'>('move'),[brush,setBrush]=useState(24);
 const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;start:Composition}|null>(null),saving=useRef(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 useEffect(()=>{
  let cancelled=false,worker:Worker|undefined,loaded:Assets|undefined;const controller=new AbortController();
  async function load(){
   const response=await rawApi('local_scene',{session_id:sessionId});const scene=await scaledBitmap(await response.blob());
   const placement=placementFrom(JSON.parse(response.headers.get('X-Photo-Placement')||'{}'));const sceneFaces=JSON.parse(response.headers.get('X-Photo-Faces')||'[]') as FaceBox[];const portrait=await scaledBitmap(file);
   if(cancelled){scene.close();portrait.close();return;}
   try{
    const sceneCopy=await createImageBitmap(scene);
    const result=await new Promise<{blob:Blob;original:Blob;face:FaceBox;sceneFaces:FaceBox[]}>((resolve,reject)=>{
     worker=new Worker('/workers/portrait-v1.js');const timer=setTimeout(()=>{worker?.terminate();reject(Error('El recorte tardó demasiado. Prueba una foto más pequeña.'));},60000);
     controller.signal.addEventListener('abort',()=>{clearTimeout(timer);worker?.terminate();reject(Error('CANCELLED'));},{once:true});
     worker.onerror=()=>{clearTimeout(timer);reject(Error(messages.LOCAL_PROCESSING_UNAVAILABLE));};worker.onmessage=({data})=>{clearTimeout(timer);if(data.ok)resolve(data);else reject(Error(messages[data.error]||messages.LOCAL_PROCESSING_UNAVAILABLE));};worker.postMessage({portrait,scene:sceneCopy},[portrait,sceneCopy]);
    });
    const initial=await createImageBitmap(result.blob),original=await createImageBitmap(result.original),person=document.createElement('canvas');person.width=initial.width;person.height=initial.height;person.getContext('2d')!.drawImage(initial,0,0);
    const settings=initialComposition(scene,person,result.face,sceneFaces.length?sceneFaces:result.sceneFaces,placement);loaded={scene,person,original,initial,settings};
    if(cancelled){scene.close();original.close();initial.close();return;}setAssets(loaded);setSettings(settings);
   }catch(e){scene.close();throw e;}finally{worker?.terminate();}
  }
  void load().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'No pudimos preparar el montaje.');});
  return()=>{cancelled=true;controller.abort();worker?.terminate();loaded?.scene.close();loaded?.initial.close();loaded?.original.close();};
 },[file,sessionId]);
 useEffect(()=>{if(canvas.current&&assets&&settings)paint(canvas.current,assets,settings);},[assets,settings,revision]);
 function update(key:keyof Composition,value:number){setSettings(current=>current?{...current,[key]:value}:current);}
 function drawBrush(x:number,y:number){if(!assets||!settings)return;const c=assets.person.getContext('2d')!;c.save();c.beginPath();c.arc((x-settings.x)/settings.scale,(y-settings.y)/settings.scale,brush/settings.scale,0,Math.PI*2);c.clip();if(tool==='erase')c.clearRect(0,0,assets.person.width,assets.person.height);else c.drawImage(assets.original,0,0);c.restore();setRevision(v=>v+1);}
 function point(e:React.PointerEvent<HTMLCanvasElement>){const rect=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-rect.left)/rect.width*e.currentTarget.width,y:(e.clientY-rect.top)/rect.height*e.currentTarget.height};}
 function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){if(!settings||busy)return;e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);drag.current={...p,start:settings};if(tool!=='move')drawBrush(p.x,p.y);}
 function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){if(!drag.current||!assets||!settings||busy)return;const p=point(e);if(tool!=='move'){drawBrush(p.x,p.y);return;}const start=drag.current;setSettings({...settings,x:limitPosition(start.start.x+p.x-start.x,assets.scene.width,assets.person.width*settings.scale),y:limitPosition(start.start.y+p.y-start.y,assets.scene.height,assets.person.height*settings.scale)});}
 async function save(){if(!assets||!settings||saving.current)return;saving.current=true;setBusy(true);setError('');try{const output=document.createElement('canvas');paint(output,assets,settings);const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('No pudimos guardar la imagen.')),'image/jpeg',.96));if(blob.size>3.8*1048576)throw Error('El montaje es demasiado pesado. Usa una foto más pequeña.');await onSave(new File([blob],'BTS-montaje.jpg',{type:'image/jpeg'}));}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar. Conservamos tu montaje para reintentar.');}finally{saving.current=false;setBusy(false);}}
 function reset(){if(!assets)return;const c=assets.person.getContext('2d')!;c.clearRect(0,0,assets.person.width,assets.person.height);c.drawImage(assets.initial,0,0);setSettings(assets.settings);setRevision(v=>v+1);}
 return <div className="local-overlay"><div className="local-studio" role="dialog" aria-modal="true" aria-labelledby="local-title" ref={dialog} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();if(e.key==='Tab'){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}>
  <header className="local-heading"><div><p className="eyebrow">TU ROSTRO ORIGINAL · SIN CUOTA DE IA</p><h2 id="local-title">Hazlo tuyo.</h2><p>Ajusta tu foto antes de guardar el recuerdo.</p></div><button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Cerrar editor"><X/></button></header>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {!assets||!settings?<div className="local-loading" role="status">{!error&&<Spinner/>}<p>{error?'Puedes volver y elegir otra foto.':'Separando a la persona del fondo en tu dispositivo…'}</p><small>La primera vez se descarga el motor. Tus fotos no se envían a servicios de IA.</small></div>:<div className="local-grid"><div className="local-canvas-wrap"><canvas ref={canvas} role="img" aria-label="Vista previa del montaje. Usa los controles de posición para ajustarlo." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} style={{cursor:tool==='move'?'grab':'crosshair'}}/><p>Arrastra para colocar tu foto. El rostro y la pose se conservan.</p></div><aside className="local-controls">
   <div className="local-tools">{([['move','Mover',Move],['erase','Borrar',Scissors],['restore','Recuperar',RotateCcw]] as const).map(([value,label,Icon])=><button key={value} className={tool===value?'selected':''} aria-pressed={tool===value} onClick={()=>setTool(value)} disabled={busy}><Icon size={16}/>{label}</button>)}</div>
   {tool!=='move'&&<label>Tamaño del pincel <input type="range" min="4" max="80" value={brush} onChange={e=>setBrush(Number(e.target.value))}/><small>{tool==='erase'?'Pinta sobre los restos de fondo que quieras quitar.':'Pinta para recuperar detalles de la foto original.'}</small></label>}
   <label>Tamaño <input aria-label="Tamaño de la persona" type="range" min="0.05" max={Math.min(3,assets.scene.height*1.2/assets.person.height)} step="0.005" value={settings.scale} disabled={busy} onChange={e=>update('scale',Number(e.target.value))}/></label>
   <label>Posición horizontal <input type="range" min={-assets.person.width*settings.scale*.15} max={assets.scene.width-assets.person.width*settings.scale*.15} step="1" value={settings.x} disabled={busy} onChange={e=>update('x',Number(e.target.value))}/></label>
   <label>Posición vertical <input type="range" min={-assets.person.height*settings.scale*.15} max={assets.scene.height-assets.person.height*settings.scale*.15} step="1" value={settings.y} disabled={busy} onChange={e=>update('y',Number(e.target.value))}/></label>
   <label>Luz <input type="range" min="0.7" max="1.3" step="0.01" value={settings.brightness} disabled={busy} onChange={e=>update('brightness',Number(e.target.value))}/></label>
   <label>Temperatura <input type="range" min="-50" max="50" value={settings.warmth} disabled={busy} onChange={e=>update('warmth',Number(e.target.value))}/></label>
   <label>Sombra suave <input type="range" min="0" max="0.35" step="0.01" value={settings.shadow} disabled={busy} onChange={e=>update('shadow',Number(e.target.value))}/></label>
   <button className="text-btn" onClick={reset} disabled={busy}><RotateCcw size={15}/> Restablecer ajustes</button>
   <p className="local-note">Elige cuerpo completo si quieres mostrar las piernas. Una selfie conserva su encuadre: este montaje no inventa partes del cuerpo.</p>
   <button className="primary" onClick={()=>void save()} disabled={busy}>{busy?<Spinner/>:<><Check size={18}/> Guardar este montaje</>}</button><small>Puedes ajustar todo antes de guardar. La descarga se realiza en el siguiente paso.</small>
  </aside></div>}
 </div></div>;
}
