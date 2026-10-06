export class ApiError extends Error {
 constructor(public code:string,public status=400){super(code);}
}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export function checked<T>(result:{data:T;error:unknown}):NonNullable<T> {
 if(result.error||result.data===null||result.data===undefined)throw new ApiError('OPERATION_FAILED',409);
 return result.data;
}
export function maybe<T>(result:{data:T;error:unknown}):T {if(result.error)throw new ApiError('OPERATION_FAILED',409);return result.data;}
export function uuid(value:unknown):string {
 if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new ApiError('INVALID_ID');
 return value;
}
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin'),target=new URL(request.url);
 // Next may normalize the internal URL to localhost; Host is the browser-facing authority.
 const host=request.headers.get('host');if(host){if(!/^[a-z0-9.:[\]-]+$/i.test(host))throw new ApiError('FORBIDDEN',403);target.host=host;}
 const protocol=request.headers.get('x-forwarded-proto');if(protocol==='https'||protocol==='http')target.protocol=protocol+':';
 if((origin&&origin!==target.origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError('FORBIDDEN',403);
}
// Enforce actual bytes, including chunked bodies without Content-Length.
export async function boundedBytes(response:Request|Response,maxBytes:number):Promise<Uint8Array>{
 if(Number(response.headers.get('content-length')||0)>maxBytes)throw new ApiError('PAYLOAD_TOO_LARGE',413);
 const reader=response.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ApiError('PAYLOAD_TOO_LARGE',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function readBody(request:Request):Promise<Record<string,unknown>>{
 const type=request.headers.get('content-type')||'';
 const multipart=type.startsWith('multipart/form-data');
 const bytes=await boundedBytes(request,multipart?4*1024*1024:64*1024);
 try{
  if(multipart){const form=await new Response(Buffer.from(bytes),{headers:{'Content-Type':type}}).formData();return Object.fromEntries(form.entries());}
  const value:unknown=JSON.parse(new TextDecoder().decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
  return value as Record<string,unknown>;
 }catch{throw new ApiError('INVALID_INPUT');}
}
export function errorResponse(error:unknown){return error instanceof ApiError?json({error:error.code},error.status):json({error:'OPERATION_FAILED'},500);}
