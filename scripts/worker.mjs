// Optional recovery worker for self-hosting. Persistent state always stays in Supabase.
const origin=process.env.APP_ORIGIN||'http://localhost:3000';
if(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32)throw new Error('Configura CRON_SECRET con 32 caracteres o más.');
const endpoint=new URL('/api/internal/maintenance',origin);
if(endpoint.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(endpoint.hostname))throw new Error('APP_ORIGIN requiere HTTPS.');
let running=true;process.on('SIGINT',()=>{running=false;});
while(running){try{const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(290000)});console.log(`Worker: HTTP ${response.status}`);}catch{console.error('Worker: conexión no disponible.');}if(running)await new Promise(resolve=>setTimeout(resolve,30000));}
