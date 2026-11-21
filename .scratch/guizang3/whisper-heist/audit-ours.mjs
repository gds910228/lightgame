import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
for(let round=1;round<=2;round++){
 const p=await b.newPage({viewport:{width:1280,height:720}}); const errors=[],warnings=[],reqs=[];
 p.on('console',m=>{if(m.type()==='error')errors.push(m.text()); if(m.type()==='warning')warnings.push(m.text())});
 p.on('pageerror',e=>errors.push(String(e))); p.on('request',r=>reqs.push(r.url()));
 await p.goto('http://127.0.0.1:8613/whisper-heist/?autotest=1');
 await p.waitForFunction('window.__TEST && window.__TEST.done',{timeout:180000});
 const t=await p.evaluate(()=>window.__TEST);
 console.log(JSON.stringify({round,pass:t.pass,fail:t.fail,total:t.total,failed:t.results.filter(r=>!r.ok),errors,warnings,external:reqs.filter(u=>!u.startsWith('http://127.0.0.1:8613'))}));
 await p.close();
}
await b.close();
