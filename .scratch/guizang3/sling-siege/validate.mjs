// Standalone level data validator (node, no browser): checks the same rules
// the in-page autotest will enforce. Usage: node validate.mjs
import { LEVELS, SANDBOX, WORLD, CHAPTERS } from 'file:///D:/WorkProjects/AI/Lightgame/packages/games/sling-siege/js/levels.js';

const GY = WORLD.GROUND_Y;
let bad = 0;
const fail = (msg) => { bad++; console.log('FAIL:', msg); };

const EH = { small: 34, medium: 42, large: 52 };
const EW = { small: 26, medium: 32, large: 40 };

function overlaps(a, b, pad = 2) {
  const ax0 = a[0] - a[2] / 2 + pad, ax1 = a[0] + a[2] / 2 - pad;
  const ay0 = a[1] - a[3] / 2 + pad, ay1 = a[1] + a[3] / 2 - pad;
  const bx0 = b[0] - b[2] / 2, bx1 = b[0] + b[2] / 2;
  const by0 = b[1] - b[3] / 2, by1 = b[1] + b[3] / 2;
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

if (LEVELS.length !== 24) fail(`LEVELS.length = ${LEVELS.length} != 24`);
LEVELS.forEach((L, li) => {
  const tag = `L${L.no}`;
  if (L.no !== li + 1) fail(`${tag} 序号错位`);
  if (!(L.par >= 1 && L.par <= 8)) fail(`${tag} par=${L.par} 异常`);
  const ammoSum = (L.ammo.ball || 0) + (L.ammo.tnt || 0) + (L.ammo.tri || 0);
  if (ammoSum <= 0) fail(`${tag} 弹丸配给为 0`);
  if (ammoSum < L.par + 2) fail(`${tag} 弹丸 ${ammoSum} < par+2=${L.par + 2}`);
  const ne = L.enemies.length;
  if (ne < 2 || ne > 5) fail(`${tag} 敌人数 ${ne} 超出 2-5`);

  const rects = L.blocks.map(b => [b[1], b[2], b[3], b[4]]);
  // block-block overlap
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      if (overlaps(rects[i], rects[j])) fail(`${tag} 块 ${i}(${L.blocks[i]}) 与 块 ${j}(${L.blocks[j]}) 重叠`);
  // ground / bounds
  for (const b of L.blocks) {
    if (b[2] + b[4] / 2 > GY + 1) fail(`${tag} 块 ${b} 陷入地下`);
    if (b[1] - b[3] / 2 < 0 || b[1] + b[3] / 2 > WORLD.W || b[2] - b[4] / 2 < 0) fail(`${tag} 块 ${b} 越界`);
    if (b[3] < 14 || b[4] < 14) fail(`${tag} 块 ${b} 太小`);
  }
  // blocks vs platforms
  for (const p of L.platforms) {
    const pr = [p[0], p[1], p[2], p[3]];
    for (let i = 0; i < rects.length; i++)
      if (overlaps(rects[i], pr)) fail(`${tag} 块 ${i} 与静台 ${p} 重叠`);
    if (p[1] + p[3] / 2 > GY + 1) fail(`${tag} 静台 ${p} 陷入地下`);
  }
  // enemies: supported + not intersecting blocks
  for (const e of L.enemies) {
    const [type, ex, feetY] = e;
    const w = EW[type], h = EH[type];
    const rect = [ex, feetY - h / 2, w, h];
    let sup = null;
    for (const b of L.blocks) {
      const top = b[2] - b[4] / 2;
      const bx0 = b[1] - b[3] / 2, bx1 = b[1] + b[3] / 2;
      if (feetY >= top - 2 && feetY <= top + 8 && ex - w / 2 < bx1 - 6 && ex + w / 2 > bx0 + 6) sup = 'block';
      if (overlaps(rect, [b[1], b[2], b[3], b[4]], 2)) fail(`${tag} 敌人 ${e} 与块 ${b} 相交`);
    }
    for (const p of L.platforms) {
      const top = p[1] - p[3] / 2;
      if (feetY >= top - 2 && feetY <= top + 8 && ex - w / 2 < p[0] + p[2] / 2 - 6 && ex + w / 2 > p[0] - p[2] / 2 + 6) sup = 'plat';
      if (overlaps(rect, [p[0], p[1], p[2], p[3]], 2)) fail(`${tag} 敌人 ${e} 与静台 ${p} 相交`);
    }
    if (feetY >= GY - 2 && feetY <= GY + 8) sup = 'ground';
    if (!sup) fail(`${tag} 敌人 ${e} 无支撑 (feetY=${feetY})`);
    if (ex < 20 || ex > WORLD.W - 20) fail(`${tag} 敌人 ${e} 越界`);
  }
});

// chapter defs cover 1..24 contiguously
let cov = 0;
for (const c of CHAPTERS) {
  if (c.to - c.from !== 7) fail(`章节 ${c.name} 范围不是 8 关`);
  for (let n = c.from; n <= c.to; n++) cov |= 1 << n;
}
if (cov !== ((1 << 25) - 2)) fail('章节未连续覆盖 1-24');

console.log(bad === 0 ? `OK: 24 levels valid (sandbox ${SANDBOX.sandbox ? 'ok' : 'MISSING'}).` : `${bad} problems found.`);
process.exit(bad === 0 ? 0 : 1);
