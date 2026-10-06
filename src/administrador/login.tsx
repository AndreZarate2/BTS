'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {Brand,Spinner} from '@/components/ui';
import {errorMessage,getConfig} from '@/lib/backend';
export default function AdminLogin(){
 const router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[demo,setDemo]=useState(false);
 useEffect(()=>{void getConfig().then(config=>setDemo(config.demo));},[]);
 async function login(){setBusy(true);setError('');try{const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,demo})});if(!response.ok){const value=await response.json();throw new Error(errorMessage(value.error));}setPassword('');router.replace('/admin');router.refresh();}catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar sesión.');}finally{setBusy(false);}}
 return <main className="admin-login"><section className="login-story"><Brand/><div className="login-art"/><h1>Detrás de cada foto,<br/><span>un gran momento.</span></h1><p>Administra accesos, prepara los escenarios y haz que cada experiencia cuente.</p></section><section className="login-form-wrap"><form className="login-form" onSubmit={event=>{event.preventDefault();void login();}}><p className="eyebrow"><ShieldCheck size={15}/> ACCESO DEL ORGANIZADOR</p><h2>Bienvenido de nuevo.</h2><p>{demo?'Demo local con datos temporales. No envía fotos a proveedores.':'Ingresa para preparar la próxima experiencia.'}</p>{!demo&&<><div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></div><div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div></>}{error&&<p className="inline-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?<Spinner/>:<>{demo?'Entrar a la demo':'Entrar al panel'}<ArrowRight size={18}/></>}</button><p className="form-note"><ShieldCheck size={13}/>{demo?'Solo disponible en desarrollo local.':'Solo para administradores autorizados.'}</p><Link className="text-btn" href="/">Volver a la experiencia</Link></form></section></main>;
}
