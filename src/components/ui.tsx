'use client';
import {useEffect,useRef} from 'react';
import {Camera,LoaderCircle,X} from 'lucide-react';
export function Brand({compact=false}:{compact?:boolean}) {return <div className="brand"><span className="brand-mark"><Camera size={22}/></span><span>PHOTO<span className="brand-light"> EXPERIENCE</span>{!compact&&<small>THE BTS EDITION</small>}</span></div>;}
export function Spinner(){return <LoaderCircle className="spin" size={19} aria-label="Cargando"/>;}
export function Dialog({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current;el?.showModal();return ()=>el?.close();},[]);
 return <dialog ref={ref} onCancel={onClose} className="dialog"><button className="icon-btn dialog-close" aria-label="Cerrar" onClick={onClose}><X/></button><h2>{title}</h2>{children}</dialog>;
}
