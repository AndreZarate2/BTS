import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {focusScore,assertPhotoMetrics,assertFaceSimilarity,assertResultDetail} from '@/lib/server/face-quality';
it('rechaza fondos sin rostro, grupos, caras pequeñas y fotos borrosas',()=>{
 expect(()=>assertPhotoMetrics(0,200,200,100)).toThrow('PHOTO_FACE_UNCLEAR');expect(()=>assertPhotoMetrics(2,200,200,100)).toThrow('PHOTO_NEEDS_ONE_PERSON');expect(()=>assertPhotoMetrics(1,60,80,100)).toThrow('PHOTO_FACE_TOO_SMALL');expect(()=>assertPhotoMetrics(1,200,200,24)).toThrow('PHOTO_FACE_BLURRY');expect(()=>assertPhotoMetrics(1,200,200,100)).not.toThrow();
});
it('rechaza una cara diferente o varias correspondencias ambiguas',()=>{expect(()=>assertFaceSimilarity([.62,.71])).toThrow('PHOTO_LIKENESS_REJECTED');expect(()=>assertFaceSimilarity([.31,.34])).toThrow('PHOTO_LIKENESS_REJECTED');expect(()=>assertFaceSimilarity([.32,.61])).not.toThrow();expect(()=>assertFaceSimilarity([])).toThrow();expect(()=>assertFaceSimilarity([Number.NaN])).toThrow();expect(()=>assertFaceSimilarity([.47,.65])).toThrow('PHOTO_LIKENESS_REJECTED');});
it('una superficie uniforme carece de detalle',()=>{expect(focusScore(new Uint8Array(256).fill(128),16,16)).toBe(0);});

it('no entrega rostros generados pequeños, borrosos o con métricas inválidas',()=>{expect(()=>assertResultDetail(200,200,24)).toThrow('PHOTO_RESULT_BLURRY');expect(()=>assertResultDetail(80,100,120)).toThrow('PHOTO_RESULT_BLURRY');expect(()=>assertResultDetail(200,200,Number.NaN)).toThrow('PHOTO_RESULT_BLURRY');expect(()=>assertResultDetail(180,200,80)).not.toThrow();});
