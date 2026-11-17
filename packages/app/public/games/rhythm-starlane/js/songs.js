// songs.js — 节奏星轨曲库与谱面生成（纯数据 + 确定性生成，无 DOM/音频依赖）。
// 3 首原创合成曲。谱面 note 时间 = LEADIN + (小节号×4拍 + 十六分步/4) × (60/BPM)。
// 每首歌由「拍型序列 seq」驱动：seq[小节] 从 patterns 中选用一种拍型（十六分步数组）。
// 难度差异：gran 过滤（E 只保留四分位 / N 保留八分位 / H 全保留）+ 双押率 + 下落速度。

export const LEADIN = 2.5;        // 开头准备拍（秒），音乐从 0s 起播
export const MIN_GAP = 0.09;      // 同轨道两 note 最小时间间隔（秒）

export const DIFFS = [
  { id: 'E', name: '轻松', hint: '稀疏谱面 · 慢速下落', gran: 4, doubleRate: 0.06, fall: 2.3 },
  { id: 'N', name: '普通', hint: '标准密度 · 中速下落', gran: 2, doubleRate: 0.16, fall: 1.8 },
  { id: 'H', name: '高难', hint: '全密谱面 · 快速下落', gran: 1, doubleRate: 0.30, fall: 1.35 },
];
// gran: 保留十六分步号能被 gran 整除的拍点（4=四分 2=八分 1=十六分）
// doubleRate: 强拍(四分位)单点变双押的概率；fall: note 从出生到判定线的秒数

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// 拍型以十六分步（0-15）表示，如 [0,4,8,12] = 四分音符 ×4
export const SONGS = [
  {
    id: 0, name: '霓虹脉动', en: 'Neon Pulse', theme: '赛博夜城 · 电子疾走',
    bpm: 128, key: 57,                 // A3 小调，Am F C G 走向
    leadWave: 'square', padWave: 'triangle',
    chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]],
    drums: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14] },
    patterns: {
      P1: [0, 4, 8, 12],                       // 四分基本型
      P2: [0, 4, 6, 8, 12, 14],                // 切分推进
      P3: [0, 2, 4, 8, 10, 12, 14],            // 八分驱动
      P4: [0, 4, 8, 10, 12, 14, 15],           // 密集收尾
      P5: [0, 6, 8, 14],                       // 反拍悬停
    },
    seq: ['P1','P1','P1','P1','P2','P1','P2','P1','P2','P1','P5','P1','P3','P3','P4','P4','P3','P2','P3','P4','P3','P2','P3','P4','P3','P4','P3','P4','P5','P1','P5','P1','P3','P2','P3','P4','P1','P1','P5','P5'],
    laneSeq: [0, 2, 1, 3, 2, 0, 3, 1],
  },
  {
    id: 1, name: '星尘漫游', en: 'Stardust Drift', theme: '深空星云 · 梦境慢舞',
    bpm: 96, key: 50,                  // D3 大调，D A Bm G 走向
    leadWave: 'triangle', padWave: 'sine',
    chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 8, 12]],
    drums: { k: [0, 8], s: [4, 12], h: [0, 4, 8, 12] },
    patterns: {
      Q1: [0, 4, 8, 12],
      Q2: [0, 4, 10, 12],
      Q3: [0, 4, 8, 12, 14],
      Q4: [0, 8, 12],                        // 慢拍留白
      Q5: [0, 6, 10],                        // 切分叹息
    },
    seq: ['Q4','Q1','Q4','Q1','Q2','Q1','Q2','Q1','Q3','Q2','Q3','Q2','Q4','Q1','Q4','Q1','Q3','Q3','Q2','Q2','Q1','Q1','Q5','Q5','Q4','Q4','Q1','Q1'],
    laneSeq: [1, 3, 0, 2, 3, 1, 2, 0],
  },
  {
    id: 2, name: '超频引擎', en: 'Overdrive Engine', theme: '机械核心 · 高速爆发',
    bpm: 160, key: 52,                 // E3 小调，Em D C G 走向
    leadWave: 'sawtooth', padWave: 'sawtooth',
    chords: [[0, 3, 7], [10, 14, 17], [8, 12, 15], [3, 7, 10]],
    drums: { k: [0, 3, 8, 11], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
    patterns: {
      R1: [0, 4, 8, 12],
      R2: [0, 2, 4, 8, 10, 12],
      R3: [0, 2, 4, 6, 8, 10, 12, 14],       // 全八分
      R4: [0, 3, 4, 8, 11, 12, 14, 15],      // 十六分爆点
      R5: [0, 8, 10, 14],
    },
    seq: ['R1','R1','R1','R1','R2','R1','R2','R1','R2','R1','R2','R1','R3','R2','R3','R4','R3','R2','R3','R4','R3','R2','R3','R4','R3','R2','R3','R4','R5','R5','R5','R5','R3','R4','R3','R4','R3','R4','R3','R4','R2','R1','R2','R1'],
    laneSeq: [3, 1, 2, 0, 1, 3, 0, 2],
  },
];

// ==================== 音乐事件（按谱实时合成的数据源） ====================
const musics = [];
export function buildMusic(idx) {
  if (musics[idx]) return musics[idx];
  const song = SONGS[idx], spb = 60 / song.bpm;   // spb: 每拍秒数
  const melody = [], pads = [], drums = [], bass = [];
  let mi = 0;
  song.seq.forEach((pn, bar) => {
    const pat = song.patterns[pn];
    const chord = song.chords[bar % song.chords.length];
    const barT = LEADIN + bar * 4 * spb;
    pads.push({ t: barT, type: 'pad', freqs: chord.map(c => midiToFreq(song.key + c + 12)), dur: 3.8 * spb, wave: song.padWave });
    bass.push({ t: barT, type: 'bass', f: midiToFreq(song.key + chord[0] - 12), dur: 1.9 * spb });
    bass.push({ t: barT + 2 * spb, type: 'bass', f: midiToFreq(song.key + chord[0] - 12), dur: 1.9 * spb });
    for (const st of song.drums.k) drums.push({ t: barT + st * spb / 4, type: 'kick' });
    for (const st of song.drums.s) drums.push({ t: barT + st * spb / 4, type: 'snare' });
    for (const st of song.drums.h) drums.push({ t: barT + st * spb / 4, type: 'hat' });
    for (const st of pat) {
      // 旋律：和弦琶音循环 + 半小节强位翻高八度（确定性、与谱面同拍）
      const midi = song.key + 12 + chord[mi % chord.length] + (st % 8 === 0 ? 12 : 0);
      melody.push({ t: barT + st * spb / 4, type: 'lead', midi, f: midiToFreq(midi), dur: 0, wave: song.leadWave, strong: st % 4 === 0 });
      mi++;
    }
  });
  for (let i = 0; i < melody.length; i++) {
    const nx = melody[i + 1] ? melody[i + 1].t : melody[i].t + spb;
    melody[i].dur = Math.min(spb * .95, Math.max(.12, nx - melody[i].t));
  }
  const evq = [...melody, ...pads, ...drums, ...bass].sort((a, b) => a.t - b.t);
  const music = { song, melody, pads, drums, bass, evq, length: LEADIN + song.seq.length * 4 * spb, spb };
  musics[idx] = music;
  return music;
}

// ==================== 谱面生成（按难度） ====================
const charts = new Map();
export function buildChart(songIdx, diffIdx) {
  const diff = DIFFS[diffIdx];
  const key = songIdx + '_' + diff.id;
  if (charts.has(key)) return charts.get(key);
  const song = SONGS[songIdx];
  const music = buildMusic(songIdx);
  const rng = mulberry32(0x5eed00 + songIdx * 7919 + diffIdx * 104729);
  const notes = [];
  let li = 0;
  song.seq.forEach((pn, bar) => {
    for (const st of song.patterns[pn]) {
      if (st % diff.gran !== 0) continue;                    // 难度密度过滤
      const t = LEADIN + (bar * 4 + st / 4) * (60 / song.bpm); // 拍 → 秒
      const lane = song.laneSeq[li++ % song.laneSeq.length];  // 轨道按歌内序列循环
      const dbl = st % 4 === 0 && rng() < diff.doubleRate;    // 强拍双押（种子确定性）
      notes.push({ t, lane, j: null, dbl });
    }
  });
  // 双押：对侧轨同拍补一条
  const dbls = notes.filter(n => n.dbl);
  for (const n of dbls) notes.push({ t: n.t, lane: (n.lane + 2) % 4, j: null, dbl: false });
  // 排序（同拍按轨道）+ 同轨最小间隔确定性修正
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  const lastT = [-9, -9, -9, -9];
  let i = 0;
  while (i < notes.length) {
    const t = notes[i].t;
    let j = i;
    const claimed = new Set();
    while (j < notes.length && notes[j].t === t) j++;
    for (let k = i; k < j; k++) {
      const n = notes[k];
      let l = n.lane, tries = 0;
      while (tries < 4 && (t - lastT[l] < MIN_GAP || claimed.has(l))) { l = (l + 1) % 4; tries++; }
      if (tries < 4) n.lane = l;
      claimed.add(n.lane);
      lastT[n.lane] = t;
    }
    i = j;
  }
  const chart = { songIdx, diffId: diff.id, notes, music, length: music.length, fall: diff.fall };
  charts.set(key, chart);
  return chart;
}
