import {after} from 'next/server';
import {handleApi} from '@/lib/server/api';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request:Request){return handleApi(request,callback=>after(callback));}
