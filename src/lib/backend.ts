import {createClient} from '@supabase/supabase-js';
import {validPhoto} from './model';
let client:ReturnType<typeof createClient>|undefined;
export function supabase() {
 if(!client) client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://pchyfdbbjeouqopudogj.supabase.co',process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'not-configured',{auth:{storageKey:'bts-user-session',persistSession:true,autoRefreshToken:true}});
 return client;
}
export async function api<T>(action:string,values:Record<string,unknown>={},file?:File):Promise<T> {
 const response=await rawApi(action,values,file);
 return response.json();
}
export interface ClientConfig {demo:boolean;mode:string;supabaseConfigured:boolean;}
let configPromise:Promise<ClientConfig>|undefined;
export function getConfig(){return configPromise??=fetch('/api/config',{cache:'no-store'}).then(r=>r.json());}
export async function hasSession(){if((await getConfig()).demo)return true;return !!(await supabase().auth.getSession()).data.session;}
export async function requestUserAccess(name:string){
 if(!(await getConfig()).demo){
  if(!(await supabase().auth.getSession()).data.session){const result=await supabase().auth.signInAnonymously();if(result.error)throw new Error(result.error.message.includes('disabled')?'El organizador está preparando los accesos.':'No pudimos iniciar tu sesión. Inténtalo de nuevo.');}
 }
 return api('request_access',{name});
}
export async function rawApi(action:string,values:Record<string,unknown>={},file?:File):Promise<Response> {
 const config=await getConfig();let body:BodyInit;const headers:Record<string,string>={};
 if(!config.demo&&!action.startsWith('admin_')){
  const {data:{session}}=await supabase().auth.getSession();if(!session)throw new Error('Tu sesión ha caducado. Vuelve a entrar.');headers.Authorization=`Bearer ${session.access_token}`;
 }
 if(file){const form=new FormData();form.append('action',action);form.append('file',await canonicalPhoto(file));Object.entries(values).forEach(([key,value])=>form.append(key,String(value)));body=form;}
 else{headers['Content-Type']='application/json';body=JSON.stringify({action,...values});}
 const response=await fetch('/api/bts',{method:'POST',headers,body,cache:'no-store'});
 if(!response.ok){let code='';try{code=(await response.json()).error;}catch{}throw new Error(errorMessage(code));}return response;
}
// WebP y la orientación EXIF se decodifican en el dispositivo. Solo se envía JPEG sin metadatos.
export async function canonicalPhoto(file:File):Promise<File> {
 if(!validPhoto(file))throw new Error(errorMessage('INVALID_IMAGE'));
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error('No pudimos leer esa imagen. Prueba con otra foto.');}
 try {
  if(bitmap.width<128||bitmap.height<128||bitmap.width*bitmap.height>50_000_000)throw new Error(errorMessage('INVALID_IMAGE'));
  // Accept standard 12/24/48 MP camera photos; the server only receives the reduced JPEG.
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const context=canvas.getContext('2d');if(!context)throw new Error('No pudimos preparar la foto en este navegador.');
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No pudimos preparar la foto.')),'image/jpeg',.88));
  if(blob.size>3.8*1048576)throw new Error('La foto sigue siendo muy grande. Recórtala e inténtalo otra vez.');
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
 } finally {bitmap.close();}
}
export function errorMessage(code:string):string {
 const messages:Record<string,string>={
  SERVER_NOT_CONFIGURED:'El organizador debe completar la configuración del servidor.',
  RATE_LIMITED:'Has realizado varias acciones seguidas. Espera un minuto y vuelve a intentar.',
  PAYLOAD_TOO_LARGE:'La imagen es demasiado grande. Elige una foto más pequeña.',
  INVALID_LOGIN:'No se pudo iniciar sesión. Comprueba tus credenciales y permisos.',
  PROVIDER_NOT_CONFIGURED:'El organizador aún está configurando la generación de fotos. Tu acceso se conserva.',
  INVALID_IMAGE:'Usa una imagen JPG, PNG o WebP de hasta 10 MB, entre 128 px y 50 megapíxeles.',
  INVALID_NAME:'Escribe un nombre entre 2 y 60 caracteres.',
  FORBIDDEN:'Esta cuenta no tiene permisos de administrador.',
  ACCESS_REQUIRED:'Tu acceso todavía no está activo. Espera la aprobación del organizador.',
  DOWNLOAD_USED:'La descarga ya se utilizó. El organizador puede reactivar tu acceso.',
  OPERATION_FAILED:'No se pudo completar la acción. Actualiza el estado e inténtalo de nuevo.',
  UNAUTHORIZED:'Tu sesión ha caducado. Vuelve a entrar.',
  INVALID_TRANSITION:'El estado cambió. Actualiza para continuar.'
 };return messages[code]||'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
}
