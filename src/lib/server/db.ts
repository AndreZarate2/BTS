import 'server-only';
import type {Database} from '@/types/database';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {projectUrl} from './config';
import {ApiError} from './http';
let db:SupabaseClient<Database>|undefined;
export function service(){
 if(!process.env.SUPABASE_SECRET_KEY)throw new ApiError('SERVER_NOT_CONFIGURED',503);
 return db??=createClient<Database>(projectUrl(),process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function authClient(){
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!key)throw new ApiError('SERVER_NOT_CONFIGURED',503);
 return createClient(projectUrl(),key,{auth:{persistSession:false,autoRefreshToken:false}});
}
