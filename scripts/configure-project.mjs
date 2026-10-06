// Configura accesos y secretos del backend completo ya publicado por autorización del propietario.
// No despliega ni modifica el código de la Edge Function.
const project='pchyfdbbjeouqopudogj',token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw new Error('Falta SUPABASE_ACCESS_TOKEN en .env.setup. Se obtiene en la cuenta de Supabase.');
async function management(path,method='GET',body){const response=await fetch(`https://api.supabase.com/v1/projects/${project}/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!response.ok)throw new Error(`Supabase rechazó la configuración (${response.status}). Verifica los permisos del token.`);return response.status===204?null:response.json();}
await management('config/auth','PATCH',{external_anonymous_users_enabled:true});
console.log('Acceso anónimo habilitado. El acceso a fotos sigue requiriendo aprobación del administrador.');
const auth=await management('config/auth');
if(!auth?.external_anonymous_users_enabled)throw new Error('La verificación no confirmó el acceso anónimo.');
console.log('Configuración verificada. Puedes retirar el token local cuando termines.');
