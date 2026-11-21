import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const OUT = '/mnt/tos/workspace/.scratch/guizang3/crucible-atelier';
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
const errs = [], warns = [], perrs = [], reqs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning') warns.push(m.text()); });
p.on('pageerror', e => perrs.push(String(e)));
p.on('request', r => reqs.push(r.url()));
await p.goto('http://localhost:8631/.scratch/guizang3/crucible-atelier/envelope.html', { waitUntil: 'load' });
await p.waitForFunction(() => {
  const f = document.getElementById('f');
  return f && f.contentWindow && f.contentWindow.G && f.contentWindow.G.state;
}, { timeout: 30000 });
await p.waitForTimeout(500);

const trigger = async (code) => {
  await p.evaluate(code);
  await p.waitForTimeout(250);
};

await trigger(`(() => { const G = document.getElementById('f').contentWindow.G; G.startGame(true); G.grantItem('water', 4); G.grantItem('ash', 4); G.craft('mist'); G.reportProgress(true); })()`);
await trigger(`(() => { document.getElementById('f').contentWindow.G.forceFail(); })()`);
await trigger(`(() => { document.getElementById('f').contentWindow.G.forceComplete(); })()`);
await p.waitForTimeout(400);

const msgs = await p.evaluate('window.msgs');
const external = reqs.filter(u => !u.includes('localhost'));
const readyMsg = msgs.find(m => m.type === 'lightgame:ready');
const reports = msgs.filter(m => m.type === 'lightgame:report').map(m => m.payload);
const progress = reports.find(r => r && r.kind === 'progress');
const event = reports.find(r => r && r.kind === 'event');
const gameOver = reports.find(r => r && r.kind === 'gameOver');
const complete = reports.find(r => r && r.kind === 'complete');
const readyReport = reports.find(r => r && r.kind === 'ready');

const checks = {
  readyMessage: !!readyMsg && readyMsg.gameId === 'crucible-atelier' && readyMsg.v === 1,
  readyReport: !!readyReport,
  progressEnvelope: !!progress && !!progress.data && progress.data.kind === 'progress',
  eventEnvelope: !!event && typeof event.event === 'string' && event.event.length > 0 && !!event.data,
  gameOverEnvelope: !!gameOver && Number.isInteger(gameOver.score) && gameOver.progress && Number.isFinite(gameOver.progress.value) && !!gameOver.data,
  completeEnvelope: !!complete && Number.isInteger(complete.score),
  reportFrameCount: reports.length,
  externalRequests: external.length,
  consoleErrors: errs.length,
  consoleWarnings: warns.length,
  pageErrors: perrs.length,
};
const out = { checks, sample: { readyMsg, readyReport, progress, event, gameOver, complete }, consoleErrors: errs, consoleWarnings: warns, pageErrors: perrs, external };
fs.writeFileSync(`${OUT}/envelope.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await b.close();
