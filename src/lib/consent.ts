// v2 explicitly includes Google Gemini analysis and image editing.
export const PHOTO_CONSENT_VERSION='photo-ai-v2';
// Separate consent: public Spaces can expose temporary files to anyone with their URL.
export const HUGGINGFACE_CONSENT_VERSION='photo-qwen-hf-lpx55-v1';
export function consentVersion(mode:string|undefined){return mode==='qwen_free'?HUGGINGFACE_CONSENT_VERSION:PHOTO_CONSENT_VERSION;}

export function consentAllowsMode(version:string|null|undefined,mode:string){
 return mode==='qwen_free'?version===HUGGINGFACE_CONSENT_VERSION:!version?.startsWith('photo-qwen-hf-');
}
