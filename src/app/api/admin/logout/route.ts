import {cookies} from 'next/headers';
import {ADMIN_COOKIE,clearAdminSession} from '@/lib/server/auth';
import {service} from '@/lib/server/db';
import {isDemo} from '@/lib/server/config';
import {sameOrigin,json,errorResponse} from '@/lib/server/http';
export async function POST(request:Request){try{sameOrigin(request);const jar=await cookies(),token=jar.get(ADMIN_COOKIE)?.value;if(token&&!isDemo())await service().auth.admin.signOut(token,'local');await clearAdminSession();jar.delete('bts-demo-admin');return json({ok:true});}catch(error){return errorResponse(error);}}
