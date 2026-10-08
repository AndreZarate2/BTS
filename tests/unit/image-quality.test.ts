import {it,expect} from 'vitest';
import sharp from 'sharp';
import {previewImage,thumbnail,normalizeImage} from '@/lib/server/images';
import {qwenOutputSize} from '@/lib/providers/qwen-composition';
it('la vista previa conserva 1536px y no reutiliza la miniatura de 640px',async()=>{
 const input=await sharp({create:{width:1536,height:1024,channels:3,background:'#aaa'}}).jpeg().toBuffer();
 const preview=await sharp(await previewImage(input)).metadata(),thumb=await sharp(await thumbnail(input)).metadata();expect(preview.width).toBe(1536);expect(thumb.width).toBe(640);expect(preview.chromaSubsampling).toBe('4:4:4');
});
it('conserva los colores de detalle y no amplía una entrada pequeña',async()=>{
 const input=await sharp({create:{width:300,height:400,channels:3,background:'#fac'}}).png().toBuffer();const meta=await sharp(await normalizeImage(input)).metadata();expect([meta.width,meta.height]).toEqual([300,400]);expect(meta.chromaSubsampling).toBe('4:4:4');
});
it('solicita alta resolución con la proporción del escenario',async()=>{
 const input=await sharp({create:{width:900,height:600,channels:3,background:'#fac'}}).png().toBuffer();expect(await qwenOutputSize(input)).toEqual({width:1536,height:1024});
});
