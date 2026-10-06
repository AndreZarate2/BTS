import {authClient} from '@/lib/server/db';
import {allowedAdmin,setAdminSession} from '@/lib/server/auth';
import {rateLimit} from '@/lib/server/api';
import {isDemo} from '@/lib/server/config';
import {ApiError,errorResponse,json,readBody,sameOrigin} from '@/lib/server/http';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
export async function POST(request:Request){try{
 sameOrigin(request);const body=await readBody(request);
 if(isDemo()){const {demoLogin}=await import('@/lib/server/demo');return demoLogin(request,body);}
 const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
 if(email.length>254||!email.includes('@')||password.length>256)throw new ApiError('INVALID_LOGIN',401);
 await rateLimit('admin-login-global',120,60);await rateLimit(`admin-login:${createHash('sha256').update(email).digest('hex')}`,10,600);
 const client=authClient();const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error||!data.session||!await allowedAdmin(data.user)){if(data.session)await client.auth.signOut();throw new ApiError('INVALID_LOGIN',401);}
 await setAdminSession(data.session);return json({ok:true});
 }catch(error){return errorResponse(error);}}
