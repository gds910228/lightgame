// Five in Row Master 五子棋大师 — pure gomoku rules, forbidden-move checks and AI.
// No DOM, no audio, no network. 15x15 freestyle (five or more wins) with an
// optional simplified renju forbidden set for black: overline, double-four,
// double-three (documented in DESIGN.md).

export const N = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const DIRS = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal down-right
  [1, -1],  // diagonal down-left
];
export const DIR_NAMES = ['—', '|', '\\', '/'];
export const STAR_POINTS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
export const CENTER = [7, 7];

export const DIFFS = ['easy', 'medium', 'hard'];
export const DIFF_META = {
  easy:   { key: 'easy',   zh: '易', en: 'Easy',   depth: 0, root: 24, desc: '贪心启发式评分' },
  medium: { key: 'medium', zh: '中', en: 'Medium', depth: 2, root: 14, desc: 'Alpha-Beta 深度 2' },
  hard:   { key: 'hard',   zh: '难', en: 'Hard',   depth: 4, root: 12, desc: 'Alpha-Beta 深度 4 · 进攻偏向' },
};

// First-player balancing for same-tier self-play / public balance evidence.
// Black (first mover) samples the second-best root move with this probability;
// this offsets the large structural first-move advantage while keeping both
// sides on the exact same tier algorithm.  Tuned on 2026-11-26 (see DESIGN.md).
export const BALANCE_HANDICAP = { easy: 0.28, medium: 0.80, hard: 0.14 };
export const VARIETY = 0.055;

export function opp(p) { return p === BLACK ? WHITE : BLACK; }
export function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
export function at(board, r, c) { return inB(r, c) ? board[r * N + c] : 3; }
export function makeBoard() { return new Uint8Array(N * N); }
export function cloneBoard(b) { return Uint8Array.from(b); }
export function boardCount(b) {
  let n = 0;
  for (let i = 0; i < b.length; i++) if (b[i]) n++;
  return n;
}

// Deterministic PRNG (mulberry32) so self-play evidence is reproducible.
export function mulberry32(a) {
  a = (a >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==================== win / run detection ====================
export function runRange(board, r, c, dr, dc) {
  // Assumes (r,c) holds the player's stone. Returns contiguous run extents in
  // directional offsets, plus open-end count.
  if (!inB(r, c)) return null;
  const p = board[r * N + c];
  if (!p) return null;
  let lo = 0, hi = 0;
  while (inB(r + dr * (lo - 1), c + dc * (lo - 1)) && board[(r + dr * (lo - 1)) * N + (c + dc * (lo - 1))] === p) lo--;
  while (inB(r + dr * (hi + 1), c + dc * (hi + 1)) && board[(r + dr * (hi + 1)) * N + (c + dc * (hi + 1))] === p) hi++;
  let open = 0;
  if (inB(r + dr * (lo - 1), c + dc * (lo - 1)) && board[(r + dr * (lo - 1)) * N + (c + dc * (lo - 1))] === EMPTY) open++;
  if (inB(r + dr * (hi + 1), c + dc * (hi + 1)) && board[(r + dr * (hi + 1)) * N + (c + dc * (hi + 1))] === EMPTY) open++;
  return { lo, hi, len: hi - lo + 1, open };
}

export function findWin(board, r, c, player) {
  if (!inB(r, c)) return null;
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = DIRS[d];
    const rr = runRange(board, r, c, dr, dc);
    if (!rr || rr.len < 5) continue;
    const line = [];
    for (let k = rr.lo; k <= rr.hi; k++) {
      const nr = r + dr * k, nc = c + dc * k;
      if (inB(nr, nc)) line.push({ r: nr, c: nc });
    }
    return { player, dir: d, length: rr.len, overline: rr.len > 5, line };
  }
  return null;
}

export function wouldWin(board, r, c, player) {
  if (!inB(r, c) || board[r * N + c] !== EMPTY) return false;
  const id = r * N + c;
  board[id] = player;
  const w = findWin(board, r, c, player);
  board[id] = EMPTY;
  return !!w;
}

// ==================== forbidden set (black only, simplified renju) ====================
function cellOffset(board, r, c, dr, dc, k) {
  const rr = r + dr * k, cc = c + dc * k;
  return inB(rr, cc) ? board[rr * N + cc] : 3; // 3 = wall
}
function setOffset(board, r, c, dr, dc, k, v) {
  const rr = r + dr * k, cc = c + dc * k;
  if (inB(rr, cc)) board[rr * N + cc] = v;
}
function rangeAtOffset(board, r, c, dr, dc, k, p) {
  let lo = k, hi = k;
  while (cellOffset(board, r, c, dr, dc, lo - 1) === p) lo--;
  while (cellOffset(board, r, c, dr, dc, hi + 1) === p) hi++;
  return { lo, hi, len: hi - lo + 1 };
}
function isFourDir(board, r, c, dr, dc) {
  // Does this direction contain a point that completes exactly five through
  // the just-placed stone?
  for (let k = -4; k <= 4; k++) {
    if (k === 0 || cellOffset(board, r, c, dr, dc, k) !== EMPTY) continue;
    setOffset(board, r, c, dr, dc, k, BLACK);
    const rr = rangeAtOffset(board, r, c, dr, dc, k, BLACK);
    setOffset(board, r, c, dr, dc, k, EMPTY);
    if (rr.len === 5 && rr.lo <= 0 && rr.hi >= 0) return true;
  }
  return false;
}
function isLiveThreeDir(board, r, c, dr, dc) {
  // Can one more black stone turn this direction into a double-threat four
  // (two distinct points that each complete five through the new stone)?
  for (let k = -4; k <= 4; k++) {
    if (k === 0 || cellOffset(board, r, c, dr, dc, k) !== EMPTY) continue;
    setOffset(board, r, c, dr, dc, k, BLACK);
    const made = rangeAtOffset(board, r, c, dr, dc, k, BLACK);
    if (made.len >= 5) { setOffset(board, r, c, dr, dc, k, EMPTY); continue; }
    let wins = 0;
    for (let f = -4; f <= 4; f++) {
      if (f === k || f === 0 || cellOffset(board, r, c, dr, dc, f) !== EMPTY) continue;
      setOffset(board, r, c, dr, dc, f, BLACK);
      const rr = rangeAtOffset(board, r, c, dr, dc, f, BLACK);
      if (rr.len === 5 && rr.lo <= 0 && rr.hi >= 0) wins++;
      setOffset(board, r, c, dr, dc, f, EMPTY);
      if (wins >= 2) break;
    }
    setOffset(board, r, c, dr, dc, k, EMPTY);
    if (wins >= 2) return true;
  }
  return false;
}

export function checkForbidden(board, r, c) {
  // board must NOT yet contain the black stone. Returns {forbidden, reason}.
  if (!inB(r, c)) return { forbidden: false, reason: 'outside' };
  if (board[r * N + c] !== EMPTY) return { forbidden: false, reason: 'occupied' };
  const id = r * N + c;
  board[id] = BLACK;
  const counts = [];
  let overline = false, exactFive = false;
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = DIRS[d];
    const rr = runRange(board, r, c, dr, dc);
    counts.push(rr ? rr.len : 1);
    if (rr && rr.len >= 6) overline = true;
    if (rr && rr.len === 5) exactFive = true;
  }
  let res;
  if (overline) res = { forbidden: true, reason: 'overline' };
  else if (exactFive) res = { forbidden: false, reason: 'five' };
  else {
    let fours = 0, threes = 0;
    for (let d = 0; d < 4; d++) {
      const [dr, dc] = DIRS[d];
      if (isFourDir(board, r, c, dr, dc)) fours++;
      else if (isLiveThreeDir(board, r, c, dr, dc)) threes++;
    }
    if (fours >= 2) res = { forbidden: true, reason: 'double-four', fours, threes };
    else if (threes >= 2) res = { forbidden: true, reason: 'double-three', fours, threes };
    else res = { forbidden: false, reason: '', fours, threes };
  }
  board[id] = EMPTY;
  return res;
}

// ==================== move scoring ====================
const PATTERNS = [
  ['11111', 5000000],
  ['011110', 320000],
  ['11110', 16000], ['01111', 16000],
  ['11011', 13000], ['10111', 13000], ['11101', 13000],
  ['011100', 5200], ['001110', 5200],
  ['011010', 4200], ['010110', 4200],
  ['211100', 760], ['001112', 760],
  ['211010', 460], ['010112', 460],
  ['210110', 520], ['011012', 520],
  ['001100', 700], ['011000', 500], ['000110', 500],
  ['010100', 220], ['001010', 220],
];

function lineCode(board, r, c, dr, dc, p) {
  let s = '';
  for (let k = -4; k <= 4; k++) {
    if (k === 0) { s += '1'; continue; }
    const v = cellOffset(board, r, c, dr, dc, k);
    if (v === p) s += '1';
    else if (v === EMPTY) s += '0';
    else s += '2';
  }
  return s;
}
function dirPatternScore(board, r, c, dr, dc, p) {
  const code = lineCode(board, r, c, dr, dc, p);
  let best = 0;
  for (let i = 0; i < PATTERNS.length; i++) {
    const pat = PATTERNS[i];
    let pos = code.indexOf(pat[0]);
    while (pos >= 0) {
      if (pos <= 4 && 4 < pos + pat[0].length && pat[1] > best) best = pat[1];
      pos = code.indexOf(pat[0], pos + 1);
    }
    if (best >= 5000000) break;
  }
  return best;
}

export function pointScore(board, r, c, p) {
  if (!inB(r, c) || board[r * N + c] !== EMPTY) return -1;
  const id = r * N + c;
  board[id] = p;
  let s = 0;
  for (let d = 0; d < 4; d++) s += dirPatternScore(board, r, c, DIRS[d][0], DIRS[d][1], p);
  board[id] = EMPTY;
  const cd = Math.abs(r - 7) + Math.abs(c - 7);
  s += Math.max(0, 20 - cd * 2);
  return s;
}

const RUN_VALUE = [
  [0, 4, 30, 240, 5000, 4500000], // len 0..5 closed-ish (one open end)
];
function quickDirScore(board, r, c, dr, dc, p) {
  let lo = 0, hi = 0;
  while (cellOffset(board, r, c, dr, dc, lo - 1) === p) lo--;
  while (cellOffset(board, r, c, dr, dc, hi + 1) === p) hi++;
  const len = hi - lo + 1;
  let open = 0;
  if (cellOffset(board, r, c, dr, dc, lo - 1) === EMPTY) open++;
  if (cellOffset(board, r, c, dr, dc, hi + 1) === EMPTY) open++;
  const base = RUN_VALUE[0][Math.min(5, len)] || 0;
  return base * (open === 2 ? 1.7 : open === 1 ? 1 : .28);
}
export function quickPointScore(board, r, c, p) {
  if (!inB(r, c) || board[r * N + c] !== EMPTY) return -1;
  let mine = 0, theirs = 0;
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = DIRS[d];
    mine += quickDirScore(board, r, c, dr, dc, p);
    theirs += quickDirScore(board, r, c, dr, dc, opp(p));
  }
  const cd = Math.abs(r - 7) + Math.abs(c - 7);
  return mine + theirs * .92 + Math.max(0, 18 - cd * 2);
}

// ==================== candidate generation ====================
const _mark = new Uint8Array(N * N);
export function genCandidates(board, player, limit, opts = {}) {
  const stones = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r * N + c]) stones.push(r * N + c);
  if (!stones.length) return [{ r: 7, c: 7, score: 1, idx: 52 }];
  _mark.fill(0);
  for (let i = 0; i < stones.length; i++) {
    const sr = (stones[i] / N) | 0, sc = stones[i] % N;
    const r0 = Math.max(0, sr - 2), r1 = Math.min(N - 1, sr + 2);
    const c0 = Math.max(0, sc - 2), c1 = Math.min(N - 1, sc + 2);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!board[r * N + c]) _mark[r * N + c] = 1;
    }
  }
  const full = !!opts.full;
  const list = [];
  for (let idx = 0; idx < N * N; idx++) {
    if (!_mark[idx] || board[idx]) continue;
    const r = (idx / N) | 0, c = idx % N;
    if (full && opts.forbidden && player === BLACK) {
      if (checkForbidden(board, r, c).forbidden) continue;
    }
    const score = full ? pointScore(board, r, c, player) : quickPointScore(board, r, c, player);
    list.push({ r, c, idx, score });
  }
  if (!list.length) {
    for (let idx = 0; idx < N * N; idx++) if (!board[idx]) {
      const r = (idx / N) | 0, c = idx % N;
      if (full && opts.forbidden && player === BLACK && checkForbidden(board, r, c).forbidden) continue;
      list.push({ r, c, idx, score: 0 });
    }
  }
  list.sort((a, b) => b.score - a.score || (Math.abs(a.r - 7) + Math.abs(a.c - 7)) - (Math.abs(b.r - 7) + Math.abs(b.c - 7)));
  if (list.length > limit) list.length = limit;
  return list;
}

// ==================== board evaluation ====================
export const LINES = (() => {
  const lines = [];
  for (let r = 0; r < N; r++) {
    const l = []; for (let c = 0; c < N; c++) l.push(r * N + c); lines.push(l);
  }
  for (let c = 0; c < N; c++) {
    const l = []; for (let r = 0; r < N; r++) l.push(r * N + c); lines.push(l);
  }
  for (let s = -(N - 5); s <= N - 5; s++) {
    const l = [];
    for (let r = 0; r < N; r++) { const c = r + s; if (c >= 0 && c < N) l.push(r * N + c); }
    if (l.length >= 5) lines.push(l);
  }
  for (let s = 4; s <= 2 * (N - 1) - 4; s++) {
    const l = [];
    for (let r = 0; r < N; r++) { const c = s - r; if (c >= 0 && c < N) l.push(r * N + c); }
    if (l.length >= 5) lines.push(l);
  }
  return lines;
})();

const W5 = [0, 1, 9, 70, 900, 9000000];
const W6 = [0, 0, 3, 70, 1500, 60000];

export function scoreBoardFor(board, p) {
  const o = opp(p);
  let s = 0;
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li], L = line.length;
    for (let i = 0; i + 5 <= L; i++) {
      let mine = 0, theirs = 0;
      for (let j = 0; j < 5; j++) {
        const v = board[line[i + j]];
        if (v === p) mine++;
        else if (v === o) theirs++;
      }
      if (!theirs) s += W5[mine];
      else if (!mine) { /* opponent handled by its own call */ }
    }
    for (let i = 0; i + 6 <= L; i++) {
      let mine = 0, theirs = 0;
      for (let j = 0; j < 6; j++) {
        const v = board[line[i + j]];
        if (v === p) mine++;
        else if (v === o) theirs++;
      }
      if (!theirs) s += W6[mine];
    }
  }
  return s;
}

export function evaluateBoard(board, root, attack) {
  const a = scoreBoardFor(board, root);
  const b = scoreBoardFor(board, opp(root));
  return a * (attack || 1) - b * (attack ? 1.02 : 1.08);
}

// ==================== minimax / alpha-beta ====================
const WIN_SCORE = 1e8;
const INF = 1e12;
function capFor(depth) {
  if (depth >= 4) return 8;
  if (depth === 3) return 8;
  if (depth === 2) return 6;
  return 4;
}

function search(board, depth, alpha, beta, turn, root, ctx) {
  const cands = genCandidates(board, turn, capFor(depth), { quick: true, forbidden: ctx.forbidden });
  if (!cands.length) return 0;
  const maximize = turn === root;
  let best = maximize ? -INF : INF;
  for (let i = 0; i < cands.length; i++) {
    const m = cands[i];
    board[m.idx] = turn;
    let v;
    if (wouldWinPlaced(board, m.r, m.c, turn)) {
      const mate = WIN_SCORE - (ctx.maxDepth - depth) * 1000;
      v = maximize ? mate : -mate;
    } else if (depth <= 1) {
      v = evaluateBoard(board, root, ctx.attack);
    } else {
      v = search(board, depth - 1, alpha, beta, opp(turn), root, ctx);
    }
    board[m.idx] = EMPTY;
    if (maximize) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}
function wouldWinPlaced(board, r, c, p) {
  // board already contains p at (r,c)
  for (let d = 0; d < 4; d++) {
    const rr = runRange(board, r, c, DIRS[d][0], DIRS[d][1]);
    if (rr && rr.len >= 5) return true;
  }
  return false;
}

// Greedy ranked list (easy tier / fixed baseline).
function greedyRanked(board, player, opts) {
  const rng = opts.rng || Math.random;
  const cands = genCandidates(board, player, 24, { full: true, forbidden: opts.forbidden });
  const out = [];
  for (let i = 0; i < cands.length; i++) {
    const m = cands[i];
    const atk = pointScore(board, m.r, m.c, player);
    const def = pointScore(board, m.r, m.c, opp(player));
    let score = atk + def * (opts.defWeight == null ? .85 : opts.defWeight);
    if (opts.noise) score += rng() * opts.noise;
    out.push({ move: { r: m.r, c: m.c }, score, atk, def });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// Minimax ranked root list.
function minimaxRanked(board, player, diff, opts) {
  const meta = DIFF_META[diff] || DIFF_META.medium;
  const depth = meta.depth;
  const ctx = {
    maxDepth: depth,
    forbidden: !!opts.forbidden,
    attack: diff === 'hard' ? 1.14 : 1.0,
  };
  const rng = opts.rng || Math.random;
  const cands = genCandidates(board, player, meta.root, { full: true, forbidden: opts.forbidden });
  const out = [];
  let alpha = -INF;
  for (let i = 0; i < cands.length; i++) {
    const m = cands[i];
    board[m.idx] = player;
    let score;
    if (wouldWinPlaced(board, m.r, m.c, player)) score = WIN_SCORE;
    else score = search(board, depth - 1, alpha, INF, opp(player), player, ctx);
    board[m.idx] = EMPTY;
    // small deterministic-ish jitter only breaks exact ties / near ties
    if (opts.jitter) score += (rng() - .5) * opts.jitter;
    if (score > alpha) alpha = score;
    out.push({ move: { r: m.r, c: m.c }, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export function rankMoves(board, player, diff, opts = {}) {
  if (diff === 'easy') {
    const r = greedyRanked(board, player, { ...opts, noise: opts.noise == null ? 900 : opts.noise });
    return r;
  }
  return minimaxRanked(board, player, diff, opts);
}

export function pickMove(board, player, diff, opts = {}) {
  const rng = opts.rng || Math.random;
  let ranked;
  if (diff === 'easy') ranked = greedyRanked(board, player, opts);
  else ranked = minimaxRanked(board, player, diff, opts);
  if (!ranked.length) return null;
  let k = 0;
  if (diff === 'easy') {
    const r = rng();
    k = r < .64 ? 0 : r < .89 ? 1 : 2;
  }
  if (opts.handicapProb && rng() < opts.handicapProb) k += 1;
  else if (opts.varietyProb && rng() < opts.varietyProb) k += 1;
  if (k >= ranked.length) k = ranked.length - 1;
  const pick = ranked[k].move;
  return { r: pick.r, c: pick.c };
}

// ==================== self-play / balance harness ====================
export function baselineMove(board, player, forbidden) {
  const ranked = greedyRanked(board, player, { forbidden, defWeight: .9, noise: 0, rng: () => .5 });
  if (!ranked.length) return null;
  return { r: ranked[0].move.r, c: ranked[0].move.c };
}

function playGame(diffBlack, diffWhite, seed, opts = {}) {
  const rng = mulberry32(seed);
  const board = makeBoard();
  const forbidden = !!opts.forbidden;
  const history = [];
  let turn = BLACK;
  for (let ply = 0; ply < N * N; ply++) {
    let move = null;
    const isTierBlack = diffBlack !== 'baseline';
    const isTierWhite = diffWhite !== 'baseline';
    if (turn === BLACK) {
      if (isTierBlack) {
        const optsB = {
          rng, forbidden,
          handicapProb: opts.balance
            ? (opts.handicap != null ? opts.handicap : (BALANCE_HANDICAP[diffBlack] || 0))
            : 0,
          varietyProb: opts.variety ? VARIETY : 0,
          jitter: diffBlack === 'easy' ? 0 : 1,
        };
        move = pickMove(board, BLACK, diffBlack, optsB);
      } else {
        move = baselineMove(board, BLACK, forbidden);
      }
    } else {
      if (isTierWhite) {
        const optsW = {
          rng, forbidden,
          handicapProb: 0,
          varietyProb: opts.variety ? VARIETY : 0,
          jitter: diffWhite === 'easy' ? 0 : 1,
        };
        move = pickMove(board, WHITE, diffWhite, optsW);
      } else {
        move = baselineMove(board, WHITE, forbidden);
      }
    }
    if (!move) return { winner: EMPTY, full: true, plies: history.length };
    // Safety: if a forbidden move was somehow produced, fall back to any legal.
    if (forbidden && turn === BLACK && checkForbidden(board, move.r, move.c).forbidden) {
      const alt = genCandidates(board, BLACK, N * N, { full: true, forbidden: true })[0];
      if (!alt) return { winner: EMPTY, full: true, plies: history.length };
      move = { r: alt.r, c: alt.c };
    }
    const idx = move.r * N + move.c;
    if (board[idx]) return { winner: EMPTY, full: true, plies: history.length };
    board[idx] = turn;
    history.push({ r: move.r, c: move.c, p: turn });
    if (findWin(board, move.r, move.c, turn)) {
      return { winner: turn, plies: history.length, history };
    }
    turn = opp(turn);
  }
  return { winner: EMPTY, full: true, plies: history.length, history };
}

export function runSelfplay(n, diff, seed = 20261126, opts = {}) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let first = 0, second = 0, draws = 0, plies = 0;
  const games = Math.max(1, parseInt(n, 10) || 1);
  for (let i = 0; i < games; i++) {
    const g = playGame(diff, diff, (seed + i * 2654435761) >>> 0, { balance: true, variety: true, forbidden: !!opts.forbidden, handicap: opts.handicap });
    plies += g.plies;
    if (g.winner === BLACK) first++;
    else if (g.winner === WHITE) second++;
    else draws++;
  }
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return {
    tier: diff, games, firstWins: first, secondWins: second, draws,
    firstRate: Math.round(first / games * 1000) / 10,
    secondRate: Math.round(second / games * 1000) / 10,
    drawRate: Math.round(draws / games * 1000) / 10,
    avgPlies: Math.round(plies / games * 10) / 10,
    ms: Math.round((t1 - t0) * 10) / 10,
  };
}

export function runBenchmark(n, diff, seed = 20261126, opts = {}) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let wins = 0, losses = 0, draws = 0, asBlack = 0, asWhite = 0, plies = 0;
  const games = Math.max(1, parseInt(n, 10) || 1);
  for (let i = 0; i < games; i++) {
    const tierIsBlack = i % 2 === 0;
    const s = (seed + i * 40503) >>> 0;
    const g = tierIsBlack
      ? playGame(diff, 'baseline', s, { balance: false, variety: true, forbidden: !!opts.forbidden })
      : playGame('baseline', diff, s, { balance: false, variety: true, forbidden: !!opts.forbidden });
    plies += g.plies;
    const tierColor = tierIsBlack ? BLACK : WHITE;
    if (!g.winner) draws++;
    else if (g.winner === tierColor) { wins++; if (tierIsBlack) asBlack++; else asWhite++; }
    else losses++;
  }
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return {
    tier: diff, games, wins, losses, draws,
    winRate: Math.round(wins / games * 1000) / 10,
    ms: Math.round((t1 - t0) * 10) / 10,
    avgPlies: Math.round(plies / games * 10) / 10,
    tierAsBlackWins: asBlack, tierAsWhiteWins: asWhite,
  };
}
