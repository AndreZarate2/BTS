import 'server-only';
export const PROJECT_URL='https://pchyfdbbjeouqopudogj.supabase.co';
export function isDemo(){return process.env.BTS_DEMO_MODE==='true'&&process.env.IMAGE_PROVIDER_MODE==='mock'&&process.env.NODE_ENV==='development'&&!process.env.VERCEL;}
export function intEnv(name:string,fallback:number,min:number,max:number){const n=Number(process.env[name]||fallback);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
export function projectUrl(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL||PROJECT_URL;if(url!==PROJECT_URL)throw new Error('PROJECT_MISMATCH');return url;}
