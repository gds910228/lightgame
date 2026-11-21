import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless:true, executablePath:'/usr/local/bin/chromium', args:['--no-sandbox','--use-gl=swiftshader'] });
const out=[];
for (let round=1; round<=2; round++) {
  const page = await browser.newPage({ viewport:{width:1280,height:720} });
  const errors=[], warnings=[], requests=[];
  page.on('console', m => { if(m.type()==='error') errors.push(m.text()); if(m.type()==='warning') warnings.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.goto('http://127.0.0.1:8620/orbit-kart-grand-prix/?autotest=1');
  await page.waitForFunction('window.__TEST && window.__TEST.done', {timeout:180000});
  const test = await page.evaluate(() => window.__TEST);
  const res = {round, pass:test.pass, fail:test.fail, total:test.total, failed:test.results.filter(r=>!r.ok), errors, scriptWarnings:warnings.filter(w=>!w.includes('GL Driver Message')), glWarnings:warnings.filter(w=>w.includes('GL Driver Message')).length, external:requests.filter(u=>!u.startsWith('http://127.0.0.1:8620'))};
  out.push(res);
  console.log(JSON.stringify(res));
  await page.close();
}
fs.writeFileSync('.scratch/guizang3/orbit-kart-grand-prix/audit.json', JSON.stringify(out,null,2));
await browser.close();
