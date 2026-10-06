import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {boundedBytes,readBody,sameOrigin} from '@/lib/server/http';
import {normalizeImage} from '@/lib/server/images';
import {placementFrom} from '@/types/images';
describe('cuerpos y archivos no confiables',()=>{
 it('cancela un stream grande sin Content-Length antes de parsear',async()=>{let cancelled=false;const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1024));},cancel(){cancelled=true;}});await expect(boundedBytes(new Response(stream),2048)).rejects.toMatchObject({status:413});expect(cancelled).toBe(true);});
 it('permite JSON pequeño sin cabecera de tamaño',async()=>{expect(await readBody(new Request('http://localhost/api',{method:'POST',body:'{"action":"state"}',headers:{'content-type':'application/json'}}))).toEqual({action:'state'});});
 it('rechaza cuerpo no objeto',async()=>{await expect(readBody(new Request('http://localhost/api',{method:'POST',body:'[]'}))).rejects.toMatchObject({code:'INVALID_INPUT'});});
 it('rechaza CSRF de otra procedencia',()=>{expect(()=>sameOrigin(new Request('https://site.test/api',{headers:{origin:'https://evil.test'}}))).toThrow('FORBIDDEN');});
 it('permite la misma procedencia para previews variables',()=>{expect(()=>sameOrigin(new Request('https://preview-123.vercel.app/api',{headers:{origin:'https://preview-123.vercel.app'}}))).not.toThrow();});
 it('usa Host cuando Next normaliza localhost',()=>{expect(()=>sameOrigin(new Request('http://localhost:3000/api',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','sec-fetch-site':'same-origin'}}))).not.toThrow();});
 it('rechaza MIME falso',async()=>{const bytes=await sharp({create:{width:256,height:256,channels:3,background:'red'}}).png().toBuffer();await expect(normalizeImage(bytes,'image/jpeg')).rejects.toMatchObject({code:'INVALID_IMAGE'});});
 it('rechaza bytes que no son imágenes',async()=>{await expect(normalizeImage(Buffer.from('<svg onload="bad()"/>'),'image/png')).rejects.toMatchObject({code:'INVALID_IMAGE'});});
 it('normaliza WebP a JPEG sin metadatos',async()=>{const bytes=await sharp({create:{width:256,height:256,channels:3,background:'red'}}).webp().toBuffer();const meta=await sharp(await normalizeImage(bytes,'image/webp')).metadata();expect(meta.format).toBe('jpeg');expect(meta.exif).toBeUndefined();});
 it('limita placement y descarta valores no finitos',()=>{const p=placementFrom({x:999,y:-2,width:20,height:NaN,rotation:99,description:'x'.repeat(1000),preferred_crop:'script'});expect(p.x).toBe(.9);expect(p.y).toBe(0);expect(p.width).toBeLessThanOrEqual(.100001);expect(p.rotation).toBe(30);expect(p.description).toHaveLength(500);expect(p.preferred_crop).toBe('contain');});
});
