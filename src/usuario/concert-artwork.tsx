'use client';
import Image from 'next/image';
import {useEffect,useRef} from 'react';
import {ArrowDown,Camera,Layers3,Sparkles} from 'lucide-react';

export function ConcertArtwork(){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const motion=matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const draw=()=>{frame=0;const element=ref.current;if(!element)return;const amount=motion.matches?0:Math.min(1,Math.max(0,scrollY/Math.max(innerHeight,1)));element.style.setProperty('--record-turn',`${-7+amount*18}deg`);element.style.setProperty('--record-lift',`${amount*-36}px`);};
  const update=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  draw();addEventListener('scroll',update,{passive:true});addEventListener('resize',update);motion.addEventListener('change',update);
  return()=>{cancelAnimationFrame(frame);removeEventListener('scroll',update);removeEventListener('resize',update);motion.removeEventListener('change',update);};
 },[]);
 return <div className="concert-artwork" ref={ref}>
  <div className="concert-topline"><span>BTS · ARIRANG</span><span>PHOTO EXPERIENCE</span></div>
  <div className="record-halo" aria-hidden="true"/><div className="concert-record"><Image src="/images/arirang-concert.png" alt="Logo ARIRANG de BTS" width={768} height={1024} priority sizes="(max-width: 600px) 85vw, 480px"/></div>
  <span className="record-index" aria-hidden="true">01—07</span><div className="concert-caption"><span>EL RECUERDO<br/><strong>EMPIEZA CONTIGO.</strong></span><span className="concert-spark" aria-hidden="true">✳</span></div>
 </div>;
}

export function ConcertStory(){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{
  const root=ref.current;if(!root||!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}},{threshold:.12});
  root.classList.add('motion-ready');root.querySelectorAll('.story-reveal').forEach(element=>observer.observe(element));return()=>observer.disconnect();
 },[]);
 return <section className="concert-story" ref={ref} aria-label="Cómo vivir tu experiencia">
  <div className="story-divider"><span>DESLIZA. IMAGINA. RECUERDA.</span><ArrowDown size={16}/></div>
  <div className="story-heading story-reveal"><p className="eyebrow">DE TU GALERÍA A ESE MOMENTO</p><h2>Una foto tuya.<br/><span>Una historia nueva.</span></h2><p>Escoge a tu artista, comparte tu mejor foto y deja que la escena cobre vida a tu lado.</p></div>
  <div className="story-cards">{[
   {n:'01',icon:Layers3,title:'Encuentra tu escena',text:'Elige entre los artistas y las plantillas que el organizador prepara para el evento.'},
   {n:'02',icon:Camera,title:'Hazla tuya',text:'Sube una foto individual, nítida y con buena luz. Tu rostro será la referencia para la nueva imagen.'},
   {n:'03',icon:Sparkles,title:'Guarda el momento',text:'Creamos una composición con IA que adapta la perspectiva, la escala y la iluminación a la escena.'}
  ].map(item=><article className="story-card story-reveal" key={item.n}><div><span>{item.n}</span><item.icon size={22}/></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
  <div className="story-finale story-reveal"><span>ARIRANG</span><p>Hay canciones que se quedan.<br/>Y fotos que te llevan de vuelta.</p><a className="secondary" href="#display-name">Comenzar mi experiencia ↑</a></div>
 </section>;
}
