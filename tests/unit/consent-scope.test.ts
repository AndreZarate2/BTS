import {describe,it,expect} from 'vitest';
import {consentAllowsMode,HUGGINGFACE_CONSENT_VERSION,PHOTO_CONSENT_VERSION} from '@/lib/consent';
describe('consentimiento al cambiar el proveedor',()=>{
 it.each(['auto','openai_only','gemini_only','qwen_only'])('un consentimiento solo Hugging Face no habilita %s',mode=>{expect(consentAllowsMode(HUGGINGFACE_CONSENT_VERSION,mode)).toBe(false);});
 it('la autorización anterior no habilita el Space público',()=>{expect(consentAllowsMode(PHOTO_CONSENT_VERSION,'qwen_free')).toBe(false);expect(consentAllowsMode(null,'qwen_free')).toBe(false);});
 it('solo la versión exacta habilita el Space seleccionado',()=>{expect(consentAllowsMode(HUGGINGFACE_CONSENT_VERSION,'qwen_free')).toBe(true);expect(consentAllowsMode('photo-qwen-hf-v1','qwen_free')).toBe(false);});
 it('conserva los proveedores originalmente autorizados para sesiones anteriores',()=>{expect(consentAllowsMode(PHOTO_CONSENT_VERSION,'auto')).toBe(true);expect(consentAllowsMode(null,'openai_only')).toBe(true);});
});
