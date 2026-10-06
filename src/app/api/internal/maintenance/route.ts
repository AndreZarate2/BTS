import {timingSafeEqual} from 'node:crypto';
import {cleanup,processQueue} from '@/lib/server/jobs';
import {json,errorResponse} from '@/lib/server/http';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(request:Request){
 const expected=process.env.CRON_SECRET,provided=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!expected||expected.length<32||!provided||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return json({error:'UNAUTHORIZED'},401);
 try{const retention=await cleanup(),processed=await processQueue();return json({processed,...retention});}catch(error){return errorResponse(error);}
}
