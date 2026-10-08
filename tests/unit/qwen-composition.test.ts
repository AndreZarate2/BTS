import {it,expect} from 'vitest';
import sharp from 'sharp';
import {qwenScene} from '@/lib/providers/qwen-composition';
it('da espacio a una plantilla vertical y mantiene los píxeles y escala del centro',async()=>{
 const source=await sharp({create:{width:200,height:400,channels:3,background:'#c2b4d6'}}).composite([{input:await sharp({create:{width:60,height:100,channels:3,background:'#123456'}}).png().toBuffer(),left:70,top:200}]).png().toBuffer();
 const result=await qwenScene(source),meta=await sharp(result).metadata();expect([meta.width,meta.height]).toEqual([400,400]);
 const pixel=await sharp(result).extract({left:200,top:250,width:1,height:1}).raw().toBuffer();expect(Math.abs(pixel[0]-0x12)).toBeLessThan(5);expect(Math.abs(pixel[1]-0x34)).toBeLessThan(5);
});
it('mantiene una plantilla horizontal sin recodificarla',async()=>{
 const source=await sharp({create:{width:400,height:200,channels:3,background:'#eee'}}).jpeg().toBuffer();expect(await qwenScene(source)).toBe(source);
});
