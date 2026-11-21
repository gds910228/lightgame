import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:720}});
const logs=[]; p.on('console',m=>{ if(m.type()!=='log') logs.push(m.type()+': '+m.text()); });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8624/glyphbeast-trail/?autostart=1');
await p.waitForTimeout(400);
const res = await p.evaluate(() => {
  const out=[];
  const S=()=>G.state();
  // boss 0, level 12 party, auto fight
  G.setSeed(1234);
  G.setParty([{id:'emberbadger',lvl:12},{id:'tideotter',lvl:12},{id:'reedfox',lvl:12},{id:'lamprabbit',lvl:12}]);
  G.setBosses(0); G.startBoss(0); G.upd(70);
  let guard=0;
  while(guard++<200){
    const s=S();
    if(!s.battle || s.mode!=='battle') break;
    if(s.battle.phase==='result') break;
    if(s.battle.phase==='menu'){
      // choose first alive skill, prefer damage
      const a=s.battle.active; const sp=G.species[a.id]; const d=sp.skills.findIndex(k=>k.type==='damage');
      G.useSkill(d);
    } else if(s.battle.phase==='switch'){
      const i=s.party.findIndex(x=>x.hp>0); G.switchTo(i);
    }
    G.upd(90);
  }
  out.push({stage:'boss0', guard, mode:S().mode, phase:S().battle?S().battle.phase:'-', result:S().battle?S().battle.result:null, bosses:S().bosses});
  if(S().battle && S().battle.phase==='result'){ G.continueBattleResult(); out.push({afterContinue:S().mode,bosses:S().bosses,party:S().party.map(x=>[x.id,x.level,Math.round(x.hp),x.maxHp])}); }
  // capture flow wild
  G.clearBattle(); G.setParty([{id:'emberbadger',lvl:14}]); G.setSeals(5); G.setSeed(99);
  G.startWild('gravelrhino',8); G.upd(70);
  G.setEnemyHp(5);
  out.push({chance:S().battle? G.captureChance():0, seals:S().seals});
  G.throwSeal(); G.upd(200);
  out.push({afterSeal:S().mode, phase:S().battle?S().battle.phase:'-', result:S().battle?S().battle.result:null, caught:S().caught, party:S().party.map(x=>x.id), reserves:S().reserves.map(x=>x.id), seals:S().seals});
  G.clearBattle();
  // switch flow with player faint
  G.setParty([{id:'emberbadger',lvl:5},{id:'tideotter',lvl:5}]);
  G.startWild('gravelrhino',16); G.upd(70); G.setActiveHp(1);
  G.useSkill(0); G.upd(240);
  out.push({switchPhase:S().battle?S().battle.phase:'-', activeIdx:S().battle?S().battle.activeIdx:-1, party:S().party.map(x=>[x.id,Math.ceil(x.hp)])});
  if(S().battle && S().battle.phase==='switch'){ G.switchTo(1); out.push({switched:S().battle.activeIdx, phase:S().battle.phase}); }
  G.clearBattle();
  return out;
});
console.log(JSON.stringify(res,null,2));
console.log('pageerrors', errs); console.log('consoleWarnErr', logs);
await b.close();
