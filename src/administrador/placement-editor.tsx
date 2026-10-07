'use client';
import {useState} from 'react';
import type {Template} from '@/lib/model';
import {placementFrom,type Placement} from '@/types/images';
import {Dialog,Spinner} from '@/components/ui';
export function PlacementEditor({template,onClose,onSave}:{template:Template;onClose:()=>void;onSave:(placement:Placement)=>Promise<void>}){
 const [placement,setPlacement]=useState(placementFrom(template.placement)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const manual=placement.mode==='manual';
 return <Dialog title="Composición de la foto" onClose={onClose}>
  <p className="placement-auto-note">Por defecto, la IA analiza cada plantilla y la foto del usuario para elegir escala, luz y posición. Las plantillas nuevas se adaptan automáticamente.</p>
  <div className="placement-preview"><img src={template.url} alt="Escenario de referencia"/>{manual&&<div className="placement-box" style={{left:`${placement.x*100}%`,top:`${placement.y*100}%`,width:`${placement.width*100}%`,height:`${placement.height*100}%`,transform:`rotate(${placement.rotation}deg)`}}>ZONA SUGERIDA</div>}</div>
  <form onSubmit={async event=>{event.preventDefault();setBusy(true);try{await onSave(placementFrom(placement));}catch{setError('No pudimos guardar la composición.');}finally{setBusy(false);}}}>
   <label className="placement-mode"><input type="checkbox" checked={manual} onChange={event=>setPlacement({...placement,mode:event.target.checked?'manual':'auto'})}/> Sugerir una posición manual para esta plantilla</label>
   {manual&&<><p className="placement-auto-note">La zona es orientativa. La escala natural de la persona y los rostros originales siempre tienen prioridad.</p><div className="placement-fields">{([{key:'x',label:'Posición horizontal',max:.9},{key:'y',label:'Posición vertical',max:.9},{key:'width',label:'Ancho',max:1},{key:'height',label:'Alto',max:1},{key:'rotation',label:'Rotación',max:30}] as const).map(field=><label key={field.key}>{field.label}<input aria-label={field.label} type="range" min={field.key==='rotation'?-30:0} max={field.max} step={field.key==='rotation'?1:.01} value={placement[field.key]} onChange={event=>setPlacement(p=>placementFrom({...p,[field.key]:Number(event.target.value)}))}/></label>)}</div><label className="field">Indicaciones<textarea maxLength={500} value={placement.description} onChange={e=>setPlacement({...placement,description:e.target.value})}/></label></>}
   {error&&<p role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?<Spinner/>:'Guardar posición'}</button></div>
  </form>
 </Dialog>;
}
