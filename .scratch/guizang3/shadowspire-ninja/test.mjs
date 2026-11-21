import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const ROOT = '/mnt/tos/workspace';
const OUT = path.join(ROOT, '.scratch/guizang3/shadowspire-ninja');
const BASE = 'http://localhost:8611/shadowspire-ninja/';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox'],
});

const rounds = [];
for (let round = 1; round <= 2; round++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const consoleEvents = [];
  const pageErrors = [];
  const requests = [];
  const failed = [];
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') consoleEvents.push({ type: m.type(), text: m.text() });
  });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  page.on('requestfailed', r => failed.push({ url: r.url(), err: r.failure()?.errorText || '' }));

  await page.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__TEST && window.__TEST.done, { timeout: 120000 });
  await page.waitForTimeout(250);
  const data = await page.evaluate(() => ({
    test: window.__TEST,
    bootErr: window.__BOOTERR || [],
    gErr: (window.G && window.G.err) || [],
    mode: window.G && window.G.state().mode,
    titleHidden: document.getElementById('title').classList.contains('hide'),
    titleBest: document.getElementById('titlebest').textContent,
    savedBest: localStorage.getItem('ssn.best'),
  }));
  const external = requests.filter(u => !u.startsWith('http://localhost:8611/') && !u.startsWith('data:'));
  rounds.push({ round, data, consoleEvents, pageErrors, requests, external, failed });
  await ctx.close();
}

console.log(JSON.stringify(rounds.map(r => ({
  round: r.round,
  pass: r.data.test.pass,
  fail: r.data.test.fail,
  total: r.data.test.total,
  crashed: !!r.data.test.crashed,
  failures: r.data.test.results ? r.data.test.results.filter(x => !x.ok) : [],
  consoleEvents: r.consoleEvents,
  pageErrors: r.pageErrors,
  external: r.external,
  failed: r.failed,
  bootErr: r.data.bootErr,
  gErr: r.data.gErr,
  mode: r.data.mode,
  titleHidden: r.data.titleHidden,
  titleBest: r.data.titleBest,
  savedBest: r.data.savedBest,
  requests: [...new Set(r.requests)],
})), null, 2));

const ok = rounds.length === 2 && rounds.every(r => r.data.test.fail === 0 && r.consoleEvents.length === 0 && r.pageErrors.length === 0 && r.external.length === 0 && r.data.bootErr.length === 0 && r.data.gErr.length === 0);
if (!ok) {
  console.error('AUDIT FAIL');
  process.exitCode = 1;
} else {
  console.log('AUDIT PASS: two consecutive rounds clean');
}
await browser.close();
