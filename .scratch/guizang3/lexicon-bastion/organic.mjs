import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT='/mnt/tos/workspace/.scratch/guizang3/lexicon-bastion/';
const BASE='http://localhost:8622/lexicon-bastion/';
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e));
await p.goto(BASE,{waitUntil:'load'});
await p.click('#startbtn');
await p.evaluate(() => {
  window.__log = [];
  window.__auto = setInterval(() => {
    try {
      const s = window.G.state();
      if (s.mode === 'draft') {
        const c = s.draft.find(x => x.affordable) || s.draft[0];
        if (c) window.G.buyUpgrade(c.kind);
        window.__log.push({ t: 'draft', wave: s.wave });
        return;
      }
      if (s.mode === 'play') {
        const es = window.G.enemies().filter(e => e.alive).sort((a,b)=>b.y-a.y);
        if (es.length) { window.G.typeText(es[0].word); }
        if (s.charge > 92) { /* let it fire naturally on next letter */ }
      }
    } catch (e) { window.__log.push({ t: 'ERR', e: String(e) }); }
  }, 90);
});
await p.waitForTimeout(18000);
await p.screenshot({ path: OUT+'organic-18s.png' });
const res = await p.evaluate(() => {
  clearInterval(window.__auto);
  return { state: window.G.state(), log: window.__log.filter(x=>x.t!=='draft').slice(-20), drafts: window.__log.filter(x=>x.t==='draft'), boot: window.__BOOTERR.length };
});
console.log(JSON.stringify({ res, errs }, null, 2));
await b.close();
