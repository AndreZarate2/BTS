import sharp from 'sharp';
import {geminiContent,imagePart,type GeminiConfig} from './gemini';
import {ProviderError} from './remote';

export interface SceneAnalysis {
 scenePeople:number;userPeople:number;faceClear:boolean;
 framing:'portrait'|'upper_body'|'full_body';
 position:'left'|'right'|'center';
 headHeightRatio:number;lighting:string;composition:string;
}
const properties={scenePeople:{type:'integer',minimum:0,maximum:40},userPeople:{type:'integer',minimum:0,maximum:40},faceClear:{type:'boolean'},framing:{type:'string',enum:['portrait','upper_body','full_body']},position:{type:'string',enum:['left','right','center']},headHeightRatio:{type:'number',minimum:0.025,maximum:0.8},lighting:{type:'string',maxLength:600},composition:{type:'string',maxLength:1200}};
const analysisSchema={type:'object',properties,required:Object.keys(properties),additionalProperties:false};
const qualityKeys=['onePersonAdded','artistsPreserved','naturalScale','grounded','coherentLighting','noCollage'];
const qualitySchema={type:'object',properties:Object.fromEntries(qualityKeys.map(k=>[k,{type:'boolean'}])),required:qualityKeys,additionalProperties:false};

export function parseAnalysis(value:unknown):SceneAnalysis {
 if(!value||typeof value!=='object')throw new ProviderError('ANALYSIS_INVALID');
 const v=value as Record<string,unknown>;
 for(const key of ['scenePeople','userPeople'])if(!Number.isInteger(v[key])||Number(v[key])<0||Number(v[key])>40)throw new ProviderError('ANALYSIS_INVALID');
 if(typeof v.faceClear!=='boolean'||!['portrait','upper_body','full_body'].includes(String(v.framing))||!['left','right','center'].includes(String(v.position))||typeof v.headHeightRatio!=='number'||!Number.isFinite(v.headHeightRatio)||v.headHeightRatio<.025||v.headHeightRatio>.8)throw new ProviderError('ANALYSIS_INVALID');
 for(const [key,max] of [['lighting',600],['composition',1200]] as const)if(typeof v[key]!=='string'||!v[key].length||v[key].length>max)throw new ProviderError('ANALYSIS_INVALID');
 if(v.userPeople!==1)throw new ProviderError('PHOTO_NEEDS_ONE_PERSON');
 if(!v.faceClear)throw new ProviderError('PHOTO_FACE_UNCLEAR');
 return Object.fromEntries(Object.keys(properties).map(key=>[key,v[key]])) as unknown as SceneAnalysis;
}
export function assertQuality(value:unknown){
 if(!value||typeof value!=='object'||qualityKeys.some(k=>typeof (value as Record<string,unknown>)[k]!=='boolean'))throw new ProviderError('QUALITY_CHECK_UNAVAILABLE');
 if(qualityKeys.some(k=>(value as Record<string,unknown>)[k]!==true))throw new ProviderError('COMPOSITION_REJECTED');
}
async function small(bytes:Uint8Array){return sharp(bytes,{limitInputPixels:12_000_000}).resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();}
async function jsonResult(config:GeminiConfig,prompt:string,images:Uint8Array[],schema:object,request:typeof fetch){
 const parts=await geminiContent(config,[{text:prompt},...await Promise.all(images.map(async bytes=>imagePart(await small(bytes))))],{responseMimeType:'application/json',responseJsonSchema:schema,temperature:0.1,maxOutputTokens:4096,thinkingConfig:{thinkingLevel:'low'}},request);
 try{return JSON.parse(parts.map(p=>p.text||'').join(''));}catch{throw new ProviderError('ANALYSIS_INVALID');}
}
export class SceneAnalyzer {
 constructor(private config:GeminiConfig,private request:typeof fetch=fetch){}
 async analyze(base:Uint8Array,user:Uint8Array):Promise<SceneAnalysis>{
  const value=await jsonResult(this.config,`Analyze TWO images for a natural photographic edit. IMAGE 1 is the artist scene to preserve; IMAGE 2 is the visitor reference. Count people in each. faceClear means the single visitor has a sufficiently visible, sharp face. Describe only visible, non-sensitive photographic properties. framing describes IMAGE 2. Choose a position near the existing group, at the same depth, without covering any original face. Estimate a natural added-person head height divided by IMAGE 1 height, matching nearby heads, NOT the blank area. Describe lighting, camera height, pose, shared floor/support plane, occlusion and contact shadows. If there is no room, suggest extending the canvas to one side while preserving the original people. For a portrait reference suggest a plausible body or a coherent waist-up crop of the whole scene. NEVER place a tiny bust in the empty sky/wall or paste an isolated rectangle. Return the requested JSON only.`,[base,user],analysisSchema,this.request);
  return parseAnalysis(value);
 }
 async verify(base:Uint8Array,user:Uint8Array,result:Uint8Array){
  const value=await jsonResult(this.config,`Check THREE images in order: original scene, visitor reference, generated result. Evaluate composition, not real-world identity. Return the requested boolean JSON. onePersonAdded: exactly one visitor corresponding visually to reference 2 has been added; artistsPreserved: original subjects remain, no original face is removed, overwritten or significantly changed; naturalScale: added person's head/body scale matches neighbors at the same depth; grounded: the body shares the scene's floor/support or a natural common portrait crop, not a floating detached bust; coherentLighting: light, color and shadows are reasonably consistent; noCollage: one coherent photograph, without frames, pasted rectangular backgrounds or isolated miniature cutouts. Set false for visible defects; do not approve an unchanged scene.`,[base,user,result],qualitySchema,this.request);
  assertQuality(value);
 }
}
