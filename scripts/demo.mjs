import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p',process.env.PORT||'3000'],{stdio:'inherit',env:{...process.env,BTS_DEMO_MODE:'true',IMAGE_PROVIDER_MODE:'mock'}});
child.on('exit',code=>process.exit(code||0));
process.on('SIGINT',()=>child.kill('SIGINT'));
