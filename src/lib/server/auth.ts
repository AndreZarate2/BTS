import 'server-only';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import type {User,Session} from '@supabase/supabase-js';
import {service,authClient} from './db';
import {ApiError,checked} from './http';
import {isDemo} from './config';
export const ADMIN_COOKIE='bts-admin-access';
export async function setAdminSession(session:Session){
 const jar=await cookies(),options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
 jar.set(ADMIN_COOKIE,session.access_token,{...options,maxAge:session.expires_in});
 jar.set('bts-admin-refresh',session.refresh_token,{...options,maxAge:86400});
}
export async function clearAdminSession(){const jar=await cookies();jar.delete(ADMIN_COOKIE);jar.delete('bts-admin-refresh');}
export async function allowedAdmin(user:User){return !user.is_anonymous&&user.app_metadata?.bts_admin===true&&checked(await service().rpc('bts_admin_allowed',{p_user:user.id}))===true;}
export async function identity(request:Request):Promise<{id:string;admin:boolean;email?:string}>{
 if(isDemo()){const {demoIdentity}=await import('./demo');return demoIdentity(request);}
 const jar=await cookies(),bearer=request.headers.get('authorization');
 const token=bearer?.startsWith('Bearer ')?bearer.slice(7):jar.get(ADMIN_COOKIE)?.value;
 if(!token)throw new ApiError('UNAUTHORIZED',401);
 let {data:{user},error}=await authClient().auth.getUser(token);
 if((error||!user)&&!bearer&&jar.get('bts-admin-refresh')?.value){
  const refreshed=await authClient().auth.refreshSession({refresh_token:jar.get('bts-admin-refresh')!.value});
  if(refreshed.data.session){await setAdminSession(refreshed.data.session);user=refreshed.data.user;error=refreshed.error;}
 }
 if(error||!user)throw new ApiError('UNAUTHORIZED',401);
 return {id:user.id,email:user.email,admin:await allowedAdmin(user)};
}
export async function requireAdmin(){
 const jar=await cookies();
 if(isDemo()){const {demoAdminCookie}=await import('./demo');if(demoAdminCookie(jar.get('bts-demo-admin')?.value))return;redirect('/admin/login');}
 const token=jar.get(ADMIN_COOKIE)?.value;if(!token)redirect('/admin/login');
 const {data:{user},error}=await authClient().auth.getUser(token);
 if(error||!user||!await allowedAdmin(user))redirect('/admin/login');
}
