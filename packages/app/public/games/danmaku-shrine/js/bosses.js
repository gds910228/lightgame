// Boss definitions for Danmaku Shrine: 4 bosses × 2 phases.
// Each phase: hp, duration (s), two spells rotating every SPELL_LEN seconds.
// Pattern functions receive helpers and fire bullets; see game.js.

export const SPELL_LEN = 15;                 // seconds per spell
export const BOSS_LIST = [
  {
    name: '朱红巫女 · 阿绯', short: '朱红巫女', color: '#e8504a', accent: '#ff8a70',
    phases: [
      { hp: 2100, dur: 30, spells: ['绯扇', '赤环'] },
      { hp: 2600, dur: 30, spells: ['焰螺旋', '红雹'] },
    ],
  },
  {
    name: '青岚侍 · 苍叶', short: '青岚侍', color: '#3aa0e8', accent: '#70c8ff',
    phases: [
      { hp: 2500, dur: 30, spells: ['十字岚', '跳弹碎屑'] },
      { hp: 3000, dur: 30, spells: ['苍雨', '疾风连弩'] },
    ],
  },
  {
    name: '幽蝶姬 · 白夜', short: '幽蝶姬', color: '#b06ce8', accent: '#d8a8ff',
    phases: [
      { hp: 2900, dur: 30, spells: ['蝶舞回廊', '诱引花瓣'] },
      { hp: 3400, dur: 30, spells: ['夜之帘', '双蝶螺旋'] },
    ],
  },
  {
    name: '魔境之主 · 无名', short: '魔境之主', color: '#e8a02c', accent: '#ffd166',
    phases: [
      { hp: 3300, dur: 30, spells: ['黄金涡', '魔界壁'] },
      { hp: 3900, dur: 30, spells: ['终焉螺旋', '无名狂想'] },
    ],
  },
];
