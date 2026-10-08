import {afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {HuggingFaceQwenProvider,QWEN_SPACE,qwenResultUrl} from '@/lib/providers/huggingface';
import {createProviderRouter,createSceneAnalyzer,providerStatus} from '@/lib/providers/factory';
import {defaultPlacement} from '@/types/images';

const input={baseImage:new Uint8Array([1,2]),userImage:new Uint8Array([3,4]),placement:defaultPlacement,prompt:'Integrate visitor into scene',idempotencyKey:'fixture-job'};
const resultUrl=QWEN_SPACE+'/gradio_api/file=/tmp/gradio/abc123/image.webp';
const json=(data:unknown)=>Response.json(data);
const stream=(event:string,data:unknown)=>new Response(`event: heartbeat\ndata: null\n\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`,{headers:{'Content-Type':'text/event-stream'}});
function transport(last=stream('complete',[[{image:{url:resultUrl}}],42])){
 return vi.fn<typeof fetch>().mockResolvedValueOnce(json({type:'user',isPro:false,orgs:[]}))
 .mockResolvedValueOnce(json(['/tmp/gradio/aaa/scene.jpg','/tmp/gradio/bbb/reference.jpg']))
 .mockResolvedValueOnce(json({event_id:'height123'})).mockResolvedValueOnce(stream('complete',[]))
 .mockResolvedValueOnce(json({event_id:'width123'})).mockResolvedValueOnce(stream('complete',[]))
 .mockResolvedValueOnce(json({event_id:'event123'})).mockResolvedValueOnce(last)
 .mockResolvedValueOnce(new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}}));
}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('Qwen 2511 en el Space gratuito Lightning/AIO',()=>{
 it('sube dos fotos en orden, activa alta resolución por sesión y recupera el resultado',async()=>{
  const request=transport(),result=await new HuggingFaceQwenProvider('fixture-token',request).edit(input);
  expect(result).toMatchObject({provider:'qwen',fallback:false});expect(result.bytes.length).toBe(3);
  const body=request.mock.calls[1][1]!.body as FormData;const images=body.getAll('files') as File[];
  expect(new Uint8Array(await images[0].arrayBuffer())).toEqual(input.baseImage);expect(new Uint8Array(await images[1].arrayBuffer())).toEqual(input.userImage);
  const submitted=JSON.parse(request.mock.calls[6][1]!.body as string);
  expect(submitted.data[1]).toBe(input.prompt);expect(submitted.data.slice(3)).toEqual([false,1,4,1536,1536,false,1]);
  expect(JSON.parse(request.mock.calls[2][1]!.body as string).session_hash).toBe(submitted.session_hash);expect(JSON.parse(request.mock.calls[4][1]!.body as string).session_hash).toBe(submitted.session_hash);expect(request.mock.calls[8][0]).toBe(resultUrl);expect(request.mock.calls.every(([,init])=>init?.redirect==='error')).toBe(true);
 });
 it('sin token falla antes de enviar fotos',async()=>{const request=vi.fn();await expect(new HuggingFaceQwenProvider('',request).edit(input)).rejects.toThrow('HF_AUTH_REQUIRED');expect(request).not.toHaveBeenCalled();});
 it('rechaza cuentas con plan de pago antes de subir imágenes',async()=>{const request=vi.fn().mockResolvedValue(json({type:'user',isPro:true}));await expect(new HuggingFaceQwenProvider('fixture',request).edit(input)).rejects.toThrow('HF_FREE_ACCOUNT_REQUIRED');expect(request).toHaveBeenCalledTimes(1);});
 it('detecta cuota agotada sin exponer el mensaje interno',async()=>{const request=transport(stream('error',{message:'You have exceeded your GPU quota (180s requested) private-debug'}));await expect(new HuggingFaceQwenProvider('fixture',request).edit(input)).rejects.toThrow('QWEN_FREE_QUOTA');expect(request).toHaveBeenCalledTimes(8);});
 it('maneja errores ocultos del Space sin inventar un resultado',async()=>{await expect(new HuggingFaceQwenProvider('fixture',transport(stream('error',null))).edit(input)).rejects.toThrow('QWEN_FREE_UNAVAILABLE');});
 it.each(['https://evil.test/gradio_api/file=/tmp/gradio/a.jpg',QWEN_SPACE+'/gradio_api/file=/etc/passwd',QWEN_SPACE+'/gradio_api/file=/tmp/gradio/a.jpg?token=secret','http://127.0.0.1/private'])('no descarga una URL de salida insegura: %s',url=>{expect(()=>qwenResultUrl(url)).toThrow('PROVIDER_INVALID_OUTPUT');});
 it('una salida manipulada no recibe la credencial',async()=>{const request=transport(stream('complete',[[{image:{url:'https://evil.test/a.jpg'}}],0]));await expect(new HuggingFaceQwenProvider('fixture',request).edit(input)).rejects.toThrow('PROVIDER_INVALID_OUTPUT');expect(request).toHaveBeenCalledTimes(8);});
 it('respeta la fecha límite antes de hacer llamadas',async()=>{const request=vi.fn();await expect(new HuggingFaceQwenProvider('fixture',request).edit({...input,deadlineAt:Date.now()-1})).rejects.toThrow('PROVIDER_TIMEOUT');expect(request).not.toHaveBeenCalled();});
 it('el modo gratuito ignora claves OpenAI y Gemini existentes',async()=>{
  vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_free');vi.stubEnv('HF_TOKEN','fixture-token');vi.stubEnv('OPENAI_API_KEY','fixture-openai');vi.stubEnv('GEMINI_API_KEY','fixture-gemini');
  const request=transport();vi.stubGlobal('fetch',request);
  expect(createSceneAnalyzer(true)).toBe(null);expect(providerStatus().analysis).toBe(false);
  const result=await createProviderRouter(false,true).edit(input);expect(result.provider).toBe('qwen');
  expect(request.mock.calls.every(([url])=>String(url).startsWith('https://huggingface.co/')||String(url).startsWith(QWEN_SPACE+'/'))).toBe(true);
 });
 it('no envía al Space con el consentimiento antiguo, ni cae a un proveedor pagado',async()=>{
  vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_free');vi.stubEnv('HF_TOKEN','fixture-token');vi.stubEnv('OPENAI_API_KEY','fixture-openai');const request=vi.fn();vi.stubGlobal('fetch',request);
  await expect(createProviderRouter(true,false).edit(input)).rejects.toThrow('PROVIDER_NOT_CONFIGURED');expect(request).not.toHaveBeenCalled();
 });
 it('Qwen propio tampoco depende de una API de análisis pagada',()=>{vi.stubEnv('IMAGE_PROVIDER_MODE','qwen_only');vi.stubEnv('GEMINI_API_KEY','fixture');expect(createSceneAnalyzer(true)).toBe(null);});
});
