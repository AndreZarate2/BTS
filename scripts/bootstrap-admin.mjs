import {createClient} from '@supabase/supabase-js';
// Ejecutar: node --env-file=.env.setup scripts/bootstrap-admin.mjs
const url=process.env.SUPABASE_URL||'https://pchyfdbbjeouqopudogj.supabase.co';
if(url!=='https://pchyfdbbjeouqopudogj.supabase.co')throw new Error('El script está limitado al proyecto Web bts.');
const secret=process.env.SUPABASE_SECRET_KEY,email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;
if(!secret||!email||!password||password.length<14)throw new Error('Completa SUPABASE_SECRET_KEY, ADMIN_EMAIL y una ADMIN_PASSWORD de al menos 14 caracteres en .env.setup.');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{bts_admin:true}});
if(error)throw new Error(`No se creó el administrador (${error.code||'error'}). No se modificaron cuentas existentes.`);
const member=await db.rpc('bts_register_admin',{p_user:data.user.id});
if(member.error)throw new Error('Cuenta creada, pero falta registrar su membresía. Usa scripts/register-admin.mjs con ADMIN_USER_ID.');
console.log('Administrador creado y autorizado. Ya puedes iniciar sesión. Borra ADMIN_PASSWORD y SUPABASE_SECRET_KEY de .env.setup cuando termines.');
