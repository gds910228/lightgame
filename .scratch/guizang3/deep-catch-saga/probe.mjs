// debug probe: reproduce T18 / T24 steps and dump internal state
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8612/deep-catch-saga/?autotest=1', { waitUntil: 'load' });
await page.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });

const out = await page.evaluate(async () => {
  const G = window.__G, S = () => G.state(), SS = () => G.stages.S;
  const log = [];
  // --- T18 probe ---
  G.setNoAuto(true);
  for (const l of [0, 2, 5]) {
    G.setDepthStage(l);
    log.push(`[set${l}] stage=${S().stage} depth=${S().depth} layer=${S().layer} cap=${S().cap}`);
    for (let i = 0; i < 2; i++) {
      G.forceBite();
      log.push(`  bite: stage=${S().stage} fishId=${S().fishId} layer=${S().layer} fishQ=${S().fishQ} depth=${S().depth}`);
      G.abortReel();
    }
  }
  // --- T24 probe (fresh reel) ---
  G.setDepthStage(0); G.clearObstacles();
  G.forceBite(0);
  log.push(`[T20] stage=${S().stage} fishQ=${S().fishQ} tension=${S().tension}`);
  G.setPhase('calm'); G.reel(true); G.upd(30);
  log.push(`[T21] prog=${S().progress} tension=${S().tension} phase=${S().phase}`);
  G.setPhase('struggle'); const t1 = S().tension; G.upd(1); G.reel(true); G.upd(30);
  log.push(`[T22] t1=${t1} tension=${S().tension} phase=${S().phase} phaseT=${SS().phaseT}`);
  G.reel(false); G.upd(30);
  log.push(`[T23] tension=${S().tension} phase=${S().phase} phaseT=${SS().phaseT}`);
  G.setPhase('struggle'); G.reel(true);
  for (let i = 0; i < 3; i++) {
    G.setTension(97); G.upd(6);
    log.push(`  burst${i}: tension=${S().tension} bursts=${S().bursts} phase=${S().phase} stage=${S().stage} reason=${S().retractReason}`);
  }
  log.push(`[T24] bursts=${S().bursts} stage=${S().stage} reason=${S().retractReason}`);
  return log;
});
console.log(out.join('\n'));
console.log('pageerrors:', errs.length ? errs : 'NONE');
await browser.close();
