// play.js — 判定 / 连击 / Fever / 计分核心（纯逻辑，无 DOM / canvas / 音频依赖）。
// 判定窗：|Δ| ≤ 40ms PERFECT，≤ 90ms GOOD，其余（含过线未击）MISS。
// 分数：PERFECT 100 / GOOD 50 × combo 加成（每 25 连击 +5%，封顶 +100%）× Fever ×2。

export const PERFECT_WIN = 0.040;
export const GOOD_WIN = 0.090;
export const SCORE_P = 100, SCORE_G = 50;
export const FEVER_AT = 50, FEVER_TIME = 8, FEVER_MULT = 2;
export const COMBO_STEP = 25, COMBO_BONUS = 0.05;   // 封顶 10 档 → ×1.5

export function judgeFor(delta) {
  const a = Math.abs(delta);
  return a <= PERFECT_WIN ? 'perfect' : a <= GOOD_WIN ? 'good' : 'miss';
}

export function comboBonus(combo) {
  return 1 + Math.min(Math.floor(combo / COMBO_STEP), 10) * COMBO_BONUS;
}

// 准确率：PERFECT=100% 权重、GOOD=50% 权重、MISS=0（total 含未判定）
export function accOf(p, g, total) {
  return total > 0 ? (p + g * .5) / total * 100 : 0;
}

export function gradeFor(acc) {
  return acc >= 95 ? 'S' : acc >= 85 ? 'A' : acc >= 70 ? 'B' : acc >= 55 ? 'C' : 'D';
}

export function makePlay() {
  let score = 0, combo = 0, maxCombo = 0, fever = false, feverT = 0, p = 0, g = 0, m = 0;

  function reset() {
    score = 0; combo = 0; maxCombo = 0; fever = false; feverT = 0; p = 0; g = 0; m = 0;
  }

  // judge 仅接受 'perfect' | 'good'（过早/过晚按压由调用方忽略，过线未击走 missNote）
  function hit(judge) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    let feverStarted = false;
    if (!fever && combo % FEVER_AT === 0) { fever = true; feverT = FEVER_TIME; feverStarted = true; }
    const base = judge === 'perfect' ? SCORE_P : SCORE_G;
    const gain = Math.round(base * comboBonus(combo) * (fever ? FEVER_MULT : 1));
    score += gain;
    if (judge === 'perfect') p++; else g++;
    return { judge, gain, combo, feverStarted };
  }

  function missNote() {
    m++; combo = 0;
    if (fever) { fever = false; feverT = 0; }   // MISS 断连同时熄灭 Fever
    return { judge: 'miss' };
  }

  function tick(dt) {
    if (fever) { feverT -= dt; if (feverT <= 0) { fever = false; feverT = 0; } }
  }

  function setCombo(v) { combo = Math.max(0, v | 0); if (combo > maxCombo) maxCombo = combo; }
  function setScore(v) { score = Math.max(0, v | 0); }

  return {
    reset, hit, missNote, tick, setCombo, setScore,
    get score() { return score; },
    get combo() { return combo; },
    get maxCombo() { return maxCombo; },
    get fever() { return fever; },
    get feverT() { return feverT; },
    get perfect() { return p; },
    get good() { return g; },
    get miss() { return m; },
    get judged() { return p + g + m; },
  };
}
