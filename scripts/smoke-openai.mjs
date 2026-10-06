// Opt-in live request, billed by OpenAI. Uses synthetic fixtures only; never prints credentials.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import sharp from 'sharp';
if(!process.env.OPENAI_API_KEY)throw new Error('Configura OPENAI_API_KEY en .env.local.');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const http=dataUrl(compile(await readFile(new URL('../src/lib/server/http.ts',import.meta.url),'utf8')));
const remote=compile(await readFile(new URL('../src/lib/providers/remote.ts',import.meta.url),'utf8')).replace("@/lib/server/http",http);
const {OpenAIImageProvider}=await import(dataUrl(remote));
const scene=await sharp({create:{width:512,height:512,channels:3,background:'#393047'}}).jpeg().toBuffer();
const reference=await sharp({create:{width:256,height:256,channels:3,background:'#dbb6ed'}}).composite([{input:Buffer.from('<svg width="256" height="256"><circle cx="128" cy="90" r="42" fill="#6662bf"/><rect x="78" y="140" width="100" height="110" rx="30" fill="#6662bf"/></svg>')}]).jpeg().toBuffer();
try{
 const provider=new OpenAIImageProvider({key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',quality:process.env.OPENAI_IMAGE_QUALITY||'high',timeoutMs:90000},async(...args)=>{const response=await fetch(...args);if(!response.ok){const body=await response.clone().json().catch(()=>({}));const code=String(body.error?.code||'unknown').replace(/[^a-zA-Z0-9_]/g,'').slice(0,80);console.log(JSON.stringify({httpStatus:response.status,errorCode:code}));}return response;});
 const result=await provider.edit({baseImage:scene,userImage:reference,prompt:'Use image 1 as the background. Add the simple purple toy figure from image 2 to the center. Keep a minimal studio composition. This is a synthetic software integration test.',placement:{x:.3,y:.2,width:.4,height:.7,rotation:0,description:'center',preferred_crop:'contain'},idempotencyKey:crypto.randomUUID()});
 const metadata=await sharp(result.bytes).metadata();await mkdir('test-results',{recursive:true});await writeFile('test-results/openai-smoke.jpg',result.bytes);
 console.log(JSON.stringify({success:true,provider:result.provider,width:metadata.width,height:metadata.height,format:metadata.format,durationMs:result.durationMs}));
}catch(error){console.error(JSON.stringify({success:false,code:error.code||'UNEXPECTED_ERROR'}));process.exitCode=1;}
