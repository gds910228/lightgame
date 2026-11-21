import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('pageerror',e));
await p.goto('http://localhost:8626/ironwright-arena/');
await p.waitForFunction('window.G');
console.log(await p.evaluate(()=>{
 const a=G.statsFor('cleaver'), b=G.statsFor('autocannon'), c=G.statsFor('beam');
 return {a,b,c, conds:[a.dmg>b.dmg,a.fireDelay>b.fireDelay,a.heat!==b.heat,b.weaponMode==='auto',c.weaponMode==='beam',a.weaponMode==='melee']};
}));
await b.close();
