import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:90000,
 expect:{timeout:15000},
 use:{baseURL:'http://127.0.0.1:3000',channel:process.platform==='win32'?'msedge':undefined,trace:'retain-on-failure'},
 projects:[
  {name:'desktop',use:{viewport:{width:1440,height:1000}}},
  {name:'mobile-320',use:{viewport:{width:320,height:568},isMobile:true,hasTouch:true}},
  {name:'mobile-360',use:{viewport:{width:360,height:800},isMobile:true,hasTouch:true}},
  {name:'mobile-390',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  {name:'mobile-430',use:{viewport:{width:430,height:932},isMobile:true,hasTouch:true}},
  {name:'mobile-landscape',use:{viewport:{width:844,height:390},isMobile:true,hasTouch:true}},
  {name:'tablet',use:{viewport:{width:768,height:1024},hasTouch:true}},
 ],
 webServer:{command:'node scripts/demo.mjs',url:'http://127.0.0.1:3000/api/config',reuseExistingServer:false,timeout:120000},
});
