// Western Showdown Trio — pure game logic, AI records and benchmark model.
// No DOM / browser APIs here so the same code can be imported by Node for the
// deterministic 200-run tier benchmark described in DESIGN.md.

export const W = 960;
export const H = 540;
export const CX = W / 2;

export const MINIS = ['quick', 'color', 'memory'];
export const MINI_NAMES = {
  quick: '拔枪对决',
  color: '抢色按压',
  memory: '记忆对决',
};
export const MINI_EN = {
  quick: 'QUICK DRAW',
  color: 'COLOR GRAB',
  memory: 'MEMORY DUEL',
};
export const MINI_HINTS = {
  quick: '等待信号亮起再拔枪；抢跑即判负',
  color: '按目标颜色名，按下同色按钮；错按扣分',
  memory: '翻开两张相同牌组；双方同时抢配',
};

export const DIFFS = ['slow', 'medium', 'fast'];
export const DIFF_LABELS = { slow: '慢枪', medium: '中枪', fast: '快枪' };
export const DIFF_ZH = { slow: '慢', medium: '中', fast: '快' };
export const DIFF_SUB = {
  slow: 'AI 记录迟缓 · 适合熟悉三连',
  medium: 'AI 记录稳健 · 有来有回',
  fast: 'AI 记录极速 · 手快者胜',
};

// AI "records" are sampled distributions, not a live symmetrical AI duel.
// L3 is deliberately a record-challenge: the player tries to beat a score
// drawn from that tier's distribution.
export const AI_PROFILES = {
  slow: {
    key: 'slow', label: '慢枪', zh: '慢',
    quickMedian: 0.392, quickSigma: 0.21, quickFalse: 0.055,
    colorMedian: 0.770, colorSigma: 0.18, colorAcc: 0.855, colorThink: 0.36,
    colorLock: 0.51, colorReset: 0.37,
    memThink: 1.7, memInterval: 6.6, memSigma: 0.19, memMissChance: 0.85,
  },
  medium: {
    key: 'medium', label: '中枪', zh: '中',
    quickMedian: 0.300, quickSigma: 0.18, quickFalse: 0.035,
    colorMedian: 0.635, colorSigma: 0.17, colorAcc: 0.89, colorThink: 0.34,
    colorLock: 0.50, colorReset: 0.35,
    memThink: 1.4, memInterval: 5.1, memSigma: 0.17, memMissChance: 0.55,
  },
  fast: {
    key: 'fast', label: '快枪', zh: '快',
    quickMedian: 0.262, quickSigma: 0.16, quickFalse: 0.020,
    colorMedian: 0.535, colorSigma: 0.16, colorAcc: 0.925, colorThink: 0.33,
    colorLock: 0.49, colorReset: 0.34,
    memThink: 1.05, memInterval: 4.60, memSigma: 0.16, memMissChance: 0.32,
  },
};

// The common scripted human model used for the tier-separation benchmark.
// Reaction times are log-normal around the median; accuracy / memory pace are
// documented in DESIGN.md so the 200-run table can be reproduced.
export const HUMAN_MODEL = {
  quickMedian: 0.318, quickSigma: 0.20, quickFalse: 0.050,
  colorMedian: 0.545, colorSigma: 0.18, colorAcc: 0.900, colorThink: 0.38,
  colorLock: 0.50, colorReset: 0.35,
  memThink: 1.2, memInterval: 5.35, memSigma: 0.18, memMissChance: 0.50,
};

export const QUICK_SIGNAL_MIN = 1.10;
export const QUICK_SIGNAL_MAX = 3.20;
export const QUICK_TIMEOUT = 4.0;
export const INTRO_TIME = 3.0;
export const RESULT_TIME = 2.25;
export const COLOR_DURATION = 20.0;
export const COLOR_BASE = 100;
export const COLOR_BONUS_MAX = 80;
export const COLOR_BONUS_WINDOW = 1200; // ms
export const COLOR_WRONG_PENALTY = 50;
export const COLOR_LOCK_OK = 0.18;
export const COLOR_LOCK_WRONG = 0.55;
export const COLOR_NEXT_DELAY = 0.28;
export const MEMORY_DURATION = 30.0;
export const MEMORY_PAIRS = 6;
export const MEMORY_COLS = 4;
export const MEMORY_ROWS = 3;
export const MEMORY_CARDS = MEMORY_PAIRS * 2;
export const MEMORY_MISS_FLIP = 0.70;

export const COLORS = [
  { key: 'red', zh: '红', hex: '#e2493f', dark: '#7c1e19', bright: '#ff8b7d' },
  { key: 'blue', zh: '蓝', hex: '#3f7fe2', dark: '#173a7c', bright: '#8bb7ff' },
  { key: 'yellow', zh: '黄', hex: '#e8b53b', dark: '#7d5c10', bright: '#ffe08b' },
  { key: 'green', zh: '绿', hex: '#3fae6a', dark: '#175c34', bright: '#8bf0b4' },
];
export const COLOR_KEYS = COLORS.map(c => c.key);
export const COLOR_BY_KEY = Object.fromEntries(COLORS.map(c => [c.key, c]));

export const CARD_ICONS = [
  { key: 'hat', zh: '警长帽', glyph: 'hat' },
  { key: 'boot', zh: '马靴', glyph: 'boot' },
  { key: 'star', zh: '警徽', glyph: 'star' },
  { key: 'skull', zh: '骷髅', glyph: 'skull' },
  { key: 'horseshoe', zh: '马蹄铁', glyph: 'horseshoe' },
  { key: 'bottle', zh: '威士忌', glyph: 'bottle' },
];

export const DIFF_ALIASES = {
  '1': 'slow', easy: 'slow', slow: 'slow', '慢': 'slow', '慢枪': 'slow',
  '2': 'medium', normal: 'medium', medium: 'medium', '中': 'medium', '中枪': 'medium',
  '3': 'fast', hard: 'fast', fast: 'fast', '快': 'fast', '快枪': 'fast',
};

export function diffKey(v) {
  if (v === undefined || v === null) return 'medium';
  const k = DIFF_ALIASES[String(v).trim().toLowerCase()];
  return k || 'medium';
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function clamp01(v) { return clamp(v, 0, 1); }
export function finite(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// Small deterministic RNG shared by gameplay records and the benchmark.
export function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng) {
  // Box-Muller, clamped to avoid absurd tails.
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return clamp(z, -3.2, 3.2);
}

export function lognormal(rng, median, sigma) {
  return Math.max(0.06, median * Math.exp((sigma || 0) * randn(rng)));
}

// ---------------- quick draw ----------------

export function sampleQuickRecord(profile, rng) {
  const falseStart = rng() < (profile.quickFalse || 0);
  const falseAt = falseStart ? 0.18 + rng() * 0.85 : null;
  const reaction = falseStart ? null : lognormal(rng, profile.quickMedian, profile.quickSigma);
  return { falseStart, falseAt, reaction };
}

export function sampleHumanQuick(rng) {
  return sampleQuickRecord(HUMAN_MODEL, rng);
}

// False start always loses. If both false-start, the earlier trigger loses.
export function quickOutcome(p1, p2) {
  const f1 = !!(p1 && p1.falseStart);
  const f2 = !!(p2 && p2.falseStart);
  if (f1 || f2) {
    if (f1 && f2) {
      const a = finite(p1.falseAt, -1), b = finite(p2.falseAt, -1);
      if (a < b) return 'p2';
      if (b < a) return 'p1';
      return 'draw';
    }
    return f1 ? 'p2' : 'p1';
  }
  const r1 = p1 && p1.reaction != null ? finite(p1.reaction, null) : null;
  const r2 = p2 && p2.reaction != null ? finite(p2.reaction, null) : null;
  if (r1 == null && r2 == null) return 'draw';
  if (r1 == null) return 'p2';
  if (r2 == null) return 'p1';
  if (Math.abs(r1 - r2) < 1e-9) return 'draw';
  return r1 < r2 ? 'p1' : 'p2';
}

// ---------------- color grab ----------------

export function colorGain(rtMs) {
  const rt = Math.max(0, finite(rtMs, COLOR_BONUS_WINDOW));
  const bonus = Math.round(COLOR_BONUS_MAX * clamp01((COLOR_BONUS_WINDOW - rt) / COLOR_BONUS_WINDOW));
  return COLOR_BASE + Math.max(0, bonus);
}

export function colorPressDelta(correct, rtMs) {
  return correct ? colorGain(rtMs) : -COLOR_WRONG_PENALTY;
}

export function simulateColorRecord(profile, rng, duration = COLOR_DURATION) {
  const events = [];
  let score = 0, correct = 0, wrong = 0;
  let t = Math.max(0.2, profile.colorThink || 0.35);
  let guard = 0;
  while (t < duration && guard++ < 200) {
    let got = false;
    for (let tries = 0; tries < 3; tries++) {
      const rt = lognormal(rng, profile.colorMedian, profile.colorSigma);
      t += rt;
      if (t > duration) break;
      if (rng() < profile.colorAcc) {
        const pts = colorGain(rt * 1000);
        events.push({ t, pts, ok: true, rt });
        score += pts; correct++; got = true;
        break;
      }
      events.push({ t, pts: -COLOR_WRONG_PENALTY, ok: false, rt });
      score -= COLOR_WRONG_PENALTY; wrong++;
      t += profile.colorLock || 0.5;
      if (t > duration) break;
    }
    if (!got && t > duration) break;
    t += profile.colorReset || 0.35;
  }
  return { score, correct, wrong, events, finalScore: score, targets: correct + wrong };
}

export function simulateHumanColor(rng, duration = COLOR_DURATION) {
  return simulateColorRecord(HUMAN_MODEL, rng, duration);
}

export function compareColor(a, b) {
  const sa = finite(a && a.score, 0), sb = finite(b && b.score, 0);
  if (sa > sb) return 'p1';
  if (sb > sa) return 'p2';
  const ca = finite(a && a.correct, 0), cb = finite(b && b.correct, 0);
  if (ca > cb) return 'p1';
  if (cb > ca) return 'p2';
  const wa = finite(a && a.wrong, 0), wb = finite(b && b.wrong, 0);
  if (wa < wb) return 'p1';
  if (wb < wa) return 'p2';
  return 'draw';
}

// ---------------- memory duel ----------------

export function simulateMemoryRecord(profile, rng, duration = MEMORY_DURATION, maxPairs = MEMORY_PAIRS) {
  const times = [];
  let t = Math.max(0.2, profile.memThink || 1);
  let guard = 0;
  while (times.length < maxPairs && guard++ < 80) {
    t += lognormal(rng, profile.memInterval, profile.memSigma);
    if (t > duration) break;
    times.push(t);
  }
  let misses = 0;
  for (let i = 0; i < times.length; i++) if (rng() < (profile.memMissChance || 0)) misses++;
  return {
    pairs: times.length,
    times,
    misses,
    lastAt: times.length ? times[times.length - 1] : Infinity,
    pairRate: times.length / Math.max(0.001, duration),
  };
}

export function simulateHumanMemory(rng, duration = MEMORY_DURATION, maxPairs = MEMORY_PAIRS) {
  return simulateMemoryRecord(HUMAN_MODEL, rng, duration, maxPairs);
}

// Higher pairs wins. Ties break on fewer misses, then earlier final claim.
export function compareMemory(a, b) {
  const pa = finite(a && a.pairs, 0), pb = finite(b && b.pairs, 0);
  if (pa > pb) return 'p1';
  if (pb > pa) return 'p2';
  const ma = finite(a && a.misses, 0), mb = finite(b && b.misses, 0);
  if (ma < mb) return 'p1';
  if (mb < ma) return 'p2';
  const la = finite(a && a.lastAt, Infinity), lb = finite(b && b.lastAt, Infinity);
  if (la < lb - 1e-9) return 'p1';
  if (lb < la - 1e-9) return 'p2';
  return 'draw';
}

// ---------------- full match simulation / benchmark ----------------

export function simulateMatchVsAI(diff, seed) {
  const d = diffKey(diff);
  const profile = AI_PROFILES[d];
  const rng = mulberry32((seed >>> 0) || 1);
  const humanName = 'scripted human';

  const aiQ = sampleQuickRecord(profile, rng);
  const huQ = sampleHumanQuick(rng);
  const quick = quickOutcome(huQ, aiQ);

  const aiC = simulateColorRecord(profile, rng, COLOR_DURATION);
  const huC = simulateHumanColor(rng, COLOR_DURATION);
  const color = compareColor(huC, aiC);

  const aiM = simulateMemoryRecord(profile, rng, MEMORY_DURATION, MEMORY_PAIRS);
  const huM = simulateHumanMemory(rng, MEMORY_DURATION, MEMORY_PAIRS);
  const memory = compareMemory(huM, aiM);

  let p1 = 0, p2 = 0;
  const bump = (r) => { if (r === 'p1') p1++; else if (r === 'p2') p2++; };
  bump(quick); bump(color); bump(memory);

  let tiebreaks = 0, tiebreak = null;
  while (p1 === p2 && tiebreaks < 20) {
    tiebreaks++;
    const a = sampleQuickRecord(profile, rng);
    const h = sampleHumanQuick(rng);
    const r = quickOutcome(h, a);
    tiebreak = r;
    bump(r);
  }

  const winner = p1 > p2 ? 'p1' : p2 > p1 ? 'p2' : 'draw';
  return {
    diff: d, human: humanName,
    quick, color, memory, tiebreak, tiebreaks,
    p1Wins: p1, p2Wins: p2,
    playerScore: p1 * 100 + p2,
    ai: {
      quick: aiQ, color: { score: aiC.score, correct: aiC.correct, wrong: aiC.wrong },
      memory: { pairs: aiM.pairs, misses: aiM.misses },
    },
    player: {
      quick: huQ, color: { score: huC.score, correct: huC.correct, wrong: huC.wrong },
      memory: { pairs: huM.pairs, misses: huM.misses },
    },
    winner,
  };
}

// Deterministic benchmark: n matches per tier against the same human model.
export function runRecordBench(n = 200, diff = 'medium', seed = 0x57a7e001) {
  const count = clamp(Math.floor(finite(n, 200)), 1, 5000);
  const d = diffKey(diff);
  const baseSeed = (seed >>> 0) || 0x57a7e001;
  let wins = 0, losses = 0, draws = 0;
  let sumPlayerWins = 0, sumAiWins = 0, sumScore = 0, sumTiebreaks = 0;
  const mini = {
    quick: { win: 0, loss: 0, draw: 0 },
    color: { win: 0, loss: 0, draw: 0 },
    memory: { win: 0, loss: 0, draw: 0 },
  };
  const sample = [];
  for (let i = 0; i < count; i++) {
    const s = (baseSeed + Math.imul(i + 1, 0x9E3779B1)) >>> 0;
    const r = simulateMatchVsAI(d, s);
    if (r.winner === 'p1') wins++;
    else if (r.winner === 'p2') losses++;
    else draws++;
    sumPlayerWins += r.p1Wins;
    sumAiWins += r.p2Wins;
    sumScore += r.playerScore;
    sumTiebreaks += r.tiebreaks;
    for (const k of MINIS) {
      const res = r[k];
      if (res === 'p1') mini[k].win++;
      else if (res === 'p2') mini[k].loss++;
      else mini[k].draw++;
    }
    if (i < 3) sample.push(r);
  }
  return {
    diff: d,
    label: DIFF_LABELS[d],
    n: count,
    humanModel: HUMAN_MODEL,
    winRate: wins / count,
    lossRate: losses / count,
    drawRate: draws / count,
    avgPlayerWins: sumPlayerWins / count,
    avgAiWins: sumAiWins / count,
    avgScore: sumScore / count,
    avgTiebreaks: sumTiebreaks / count,
    mini,
    miniWinRate: {
      quick: mini.quick.win / count,
      color: mini.color.win / count,
      memory: mini.memory.win / count,
    },
    sample,
    seed: baseSeed,
  };
}

// Small helper used by the UI and tests to make a deterministic shuffled board.
export function buildMemoryBoard(seed) {
  const rng = mulberry32((seed >>> 0) || 1);
  const deck = [];
  for (let pair = 0; pair < MEMORY_PAIRS; pair++) {
    const icon = CARD_ICONS[pair % CARD_ICONS.length];
    deck.push({ icon: icon.key, zh: icon.zh, glyph: icon.glyph, pair });
    deck.push({ icon: icon.key, zh: icon.zh, glyph: icon.glyph, pair });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }
  return deck.map((c, i) => ({ ...c, index: i, matchedBy: null, faceUp: false, flipBackT: 0, owner: null }));
}

export function findPairIndices(cards, pairOrIcon) {
  const out = [];
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].pair === pairOrIcon || cards[i].icon === pairOrIcon) out.push(i);
  }
  return out;
}
