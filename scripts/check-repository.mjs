import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),ignored=new Set(['node_modules','.next','.git','.vercel','.supabase-runtime','test-results','playwright-report','coverage']);
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(ignored.has(e.name)||e.name.endsWith('.zip')||e.name.endsWith('.log')||e.name.endsWith('.tsbuildinfo')||(e.name.startsWith('.env')&&!e.name.endsWith('.example')))continue;const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else files.push(path.relative(root,f).split(path.sep).join('/'));}}await walk(root);
const exact=new Set(files),lower=new Map(),errors=[];
for(const f of files){const folded=f.toLowerCase();if(lower.has(folded))errors.push(`Colisión de mayúsculas: ${f}`);lower.set(folded,f);}
const suspicious=[/hf_[A-Za-z0-9]{25,}/,/AQ\.[A-Za-z0-9_-]{35,}/,/AIza[A-Za-z0-9_-]{30,}/,/sk-(?:proj-)?[A-Za-z0-9_-]{35,}/,/sb_secret_[A-Za-z0-9_-]{15,}/,/postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/];
for(const f of files){if(!/\.(?:tsx?|m?js|json|sql|md|toml|cmd|yml|example)$/.test(f))continue;const text=await readFile(path.join(root,f),'utf8');
 if(/\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u2020\u20ac\u2122]/.test(text))errors.push(`Texto mal codificado en ${f}`);
 if(suspicious.some(pattern=>pattern.test(text)))errors.push(`Posible secreto en ${f}`);
 for(const jwt of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){try{if(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url')).role==='service_role')errors.push(`JWT privilegiado en ${f}`);}catch{}}
 if(/\.(?:tsx?|m?js|json|cmd)$/.test(f)&&/[A-Z]:[\\/]Users[\\/]|\/home\/[^/\s]+\//.test(text))errors.push(`Ruta local absoluta en ${f}`);
 if(!/\.(?:tsx?|m?js)$/.test(f))continue;
 for(const match of text.matchAll(/(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]/g)){const spec=match[1];if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;
 const base=spec.startsWith('@/')?'src/'+spec.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(f),spec));
 const variants=[base,...['.ts','.tsx','.js','.mjs','.json','/index.ts','/index.tsx'].map(s=>base+s)];
 if(!variants.some(p=>exact.has(p))){if(f==='next-env.d.ts')continue;errors.push(`Import no resoluble con mayúsculas exactas: ${f} -> ${spec}`);}
 }}
for(const required of ['package-lock.json','.gitignore','.env.example','src/app/page.tsx','src/app/admin/page.tsx','src/app/admin/login/page.tsx'])if(!exact.has(required))errors.push(`Falta ${required}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log(`PASS: ${files.length} archivos; imports, mayúsculas, rutas y patrones de secretos.`);
