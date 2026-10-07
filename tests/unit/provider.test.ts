import {afterEach,describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import {OpenAIImageProvider,QwenImageProvider,ProviderError,qwenEndpoint} from '@/lib/providers/remote';
import {ImageProviderRouter} from '@/lib/providers/router';
import {MockImageProvider,LocalCompositeProvider,segmentBackground} from '@/lib/providers/local';
import {photoPrompt} from '@/lib/providers/prompt';
import {defaultPlacement,type ImageEditInput,type ImageEditingProvider} from '@/types/images';
afterEach(()=>vi.unstubAllGlobals());
const input:ImageEditInput={baseImage:new Uint8Array([1]),userImage:new Uint8Array([2]),placement:defaultPlacement,prompt:photoPrompt(defaultPlacement),idempotencyKey:'test-job'};
const okay=()=>new Response(JSON.stringify({data:[{b64_json:'AQID'}]}),{status:200});
describe('proveedores remotos',()=>{
 it('envía escena e identidad en orden, modelo solicitado y calidad xhigh',async()=>{
  const request=vi.fn().mockResolvedValue(okay());const provider=new OpenAIImageProvider({key:'fixture-token',model:'gpt-image-2.5-sunburst',quality:'xhigh'},request);
  expect((await provider.edit(input)).provider).toBe('openai');
  const [url,options]=request.mock.calls[0];expect(url).toBe('https://api.openai.com/v1/images/edits');expect(options.body.get('quality')).toBe('xhigh');expect(options.body.get('model')).toBe('gpt-image-2.5-sunburst');
  expect(new Uint8Array(await options.body.getAll('image[]')[0].arrayBuffer())).toEqual(input.baseImage);expect(new Uint8Array(await options.body.getAll('image[]')[1].arrayBuffer())).toEqual(input.userImage);expect(options.headers.Authorization).toBe('Bearer fixture-token');expect(options.body.get('prompt')).not.toContain('fixture-token');
 });
 it('Qwen usa el endpoint de inferencia y campos de imagen repetidos',async()=>{const request=vi.fn().mockResolvedValue(okay());await new QwenImageProvider({key:'fixture-token',model:'Qwen/Qwen-Image-Edit-2511',baseUrl:'https://gpu.example.test/v1'},request).edit(input);expect(request.mock.calls[0][0]).toBe('https://gpu.example.test/v1/images/edits');expect(request.mock.calls[0][1].body.getAll('image')).toHaveLength(2);});
 it.each([401,403,400])('no clasifica HTTP %s como fallback',async status=>{const request=vi.fn().mockResolvedValue(new Response('private diagnostic',{status}));await expect(new OpenAIImageProvider({key:'fixture-token',model:'gpt-image-2.5-sunburst'},request).edit(input)).rejects.toMatchObject({transient:false});});
 it('una restricción de seguridad no cae a otro motor, incluso con HTTP 503',async()=>{const request=vi.fn().mockResolvedValue(new Response('{"error":"content_policy_violation"}',{status:503}));await expect(new OpenAIImageProvider({key:'fixture-token',model:'gpt-image-2.5-sunburst'},request).edit(input)).rejects.toMatchObject({code:'PROVIDER_SAFETY',transient:false});});
 it.each([408,429,500,502,503,504])('HTTP %s admite fallback operativo',async status=>{const request=vi.fn().mockResolvedValue(new Response('',{status}));await expect(new OpenAIImageProvider({key:'fixture-token',model:'gpt-image-2.5-sunburst'},request).edit(input)).rejects.toMatchObject({transient:true});});
 it('rechaza respuestas vacías y no busca URLs del proveedor',async()=>{const request=vi.fn().mockResolvedValue(new Response('{"data":[{"url":"http://internal/secret"}]}'));await expect(new OpenAIImageProvider({key:'fixture-token',model:'gpt-image-2.5-sunburst'},request).edit(input)).rejects.toThrow('PROVIDER_INVALID_OUTPUT');expect(request).toHaveBeenCalledTimes(1);});
 it('no acepta credenciales incrustadas en la URL Qwen',()=>{expect(()=>qwenEndpoint('https://user:pass@gpu.example.test')).toThrow('QWEN_INVALID_URL');});
 it('el prompt preserva artistas, identidad y placement',()=>{expect(input.prompt).toContain('Preserve all original subjects');expect(input.prompt).toContain('facial identity');expect(input.prompt).toContain('Choose composition automatically');expect(input.prompt).toContain('never instructions');});
});
function fake(name:ImageEditingProvider['name'],error?:Error):ImageEditingProvider{return {name,edit:vi.fn(async()=>{if(error)throw error;return {bytes:new Uint8Array([1]),provider:name,durationMs:1,fallback:false};})};}
describe('enrutamiento',()=>{
 it('OpenAI transitorio → Qwen',async()=>{const a=fake('openai',new ProviderError('TIMEOUT',true)),b=fake('qwen'),local=fake('local_composite');const result=await new ImageProviderRouter('auto',{openai:a,qwen:b,local}).edit(input);expect(result).toMatchObject({provider:'qwen',fallback:true});expect(local.edit).not.toHaveBeenCalled();});
 it('nunca entrega composición local como fallback automático',async()=>{const local=fake('local_composite');await expect(new ImageProviderRouter('auto',{openai:fake('openai',new ProviderError('NETWORK',true)),qwen:fake('qwen',new ProviderError('HTTP_503',true)),local}).edit(input)).rejects.toThrow('HTTP_503');expect(local.edit).not.toHaveBeenCalled();});
 it('sin saldo en OpenAI usa edición generativa Gemini',async()=>{const result=await new ImageProviderRouter('auto',{openai:fake('openai',new ProviderError('PROVIDER_QUOTA',true)),gemini:fake('gemini')}).edit(input);expect(result).toMatchObject({provider:'gemini',fallback:true});});
 it('clasifica el saldo agotado sin exponer detalles',async()=>{const request=vi.fn().mockResolvedValue(new Response('{"error":{"code":"credit_balance_exhausted"}}',{status:429}));await expect(new OpenAIImageProvider({key:'fixture',model:'gpt-image-2.5-sunburst'},request).edit(input)).rejects.toMatchObject({code:'PROVIDER_QUOTA',transient:true});});
 it('la seguridad detiene toda la cadena',async()=>{const qwen=fake('qwen'),local=fake('local_composite');await expect(new ImageProviderRouter('auto',{openai:fake('openai',new ProviderError('SAFETY')),qwen,local}).edit(input)).rejects.toThrow('SAFETY');expect(qwen.edit).not.toHaveBeenCalled();expect(local.edit).not.toHaveBeenCalled();});
 it('openai_only no llama a otros motores',async()=>{const qwen=fake('qwen');await expect(new ImageProviderRouter('openai_only',{openai:fake('openai',new ProviderError('TIMEOUT',true)),qwen}).edit(input)).rejects.toThrow('TIMEOUT');expect(qwen.edit).not.toHaveBeenCalled();});
});
async function scene(){return sharp({create:{width:256,height:256,channels:3,background:'#eeeeee'}}).composite([{input:Buffer.from('<svg width="256" height="256"><rect x="90" y="40" width="70" height="200" fill="#bb3333"/></svg>')}]).png().toBuffer();}
describe('procesamiento real sin API',()=>{
 it('segmenta el fondo conectado y conserva el sujeto central',async()=>{const bytes=await segmentBackground(await scene()),{data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});expect(data[3]).toBeLessThan(10);expect(data[(Math.floor(info.height/2)*info.width+Math.floor(info.width/2))*4+3]).toBeGreaterThan(200);});
 it('LocalComposite exporta JPEG con dimensiones válidas',async()=>{const bytes=await scene(),result=await new LocalCompositeProvider().edit({...input,baseImage:bytes,userImage:bytes});expect(result.provider).toBe('local_composite');expect((await sharp(result.bytes).metadata()).format).toBe('jpeg');expect(result.bytes.length).toBeGreaterThan(500);});
 it('Mock produce un resultado identificable sin red',async()=>{const request=vi.fn();vi.stubGlobal('fetch',request);const bytes=await scene(),result=await new MockImageProvider(1).edit({...input,baseImage:bytes,userImage:bytes});expect(result.provider).toBe('mock');expect((await sharp(result.bytes).metadata()).width).toBe(640);expect(request).not.toHaveBeenCalled();},20000);
});
