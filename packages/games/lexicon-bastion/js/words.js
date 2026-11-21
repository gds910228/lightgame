// Lexicon Bastion — English word bank + deterministic RNG.
// All words are plain lowercase ASCII so they can be typed on any layout.
// Words are bucketed by their real length at module load (no hand-maintained
// length tables that can drift out of sync).

const ALL_WORDS = `
ink arc ore gem dye wax oak run sun tin red key war ash fog mud pot rim sap urn
hue jot kin lag maw nib orb pun raw tan vex web yew zen fig elm ivy bud dim ebb
fen ire jut keg lax mop nap jag

word ward wall gate lore mint seal oath rune loom dusk glow jade bolt pyre wisp
veil kiln moss reed fern clay coal iron salt sand tide wave fire gold ruby opal
onyx sage vine root bark leaf seed hive nest wing helm mask ring disk core node
line axis echo song hymn bell drum horn harp fort scar grim husk vine

stone guard quill amber spire charm sigil glyph prism forge chant tower vault
brush ember linen crest pearl ivory cedar birch aspen maple torch altar choir
psalm relic token verse motto claim crown brook creek marsh glade haven bayou
tithe fleet sable mirth

letter marble copper bronze candle script cipher shield pillar mortar banner
scroll quiver anvil cinder mosaic patina cobalt dapple belfry citron damask
fresco garnet herald mantle potion quartz ribbon signal timber velvet walnut
yellow warden chapel quarry

bastion citadel lantern rampart lattice crimson magenta verdant bulwark obelisk
sanctum keepers masons amulets whisper crystal templar gallery pennant chevron
fortify mystify javelin trident rambler murmur

palisade sentinel obsidian fortress inkstone inscribe capstone keystone monument
talisman archives lavender amethyst cinnabar bastille ramparts parapets bulwarks
sanctify sanctity luminary heraldic majestic

labyrinth parchment sculpture wardstone threshold sovereign architect chronicle
enchanter bastioned verdigris

stronghold watchtower battlement foundation illuminate portcullis archivists
chronicler tessellate sanctified munificent crenellate

battlements crenellated pierceable
`;

export const WORDS = {};
for (const w of ALL_WORDS.trim().split(/\s+/)) {
  if (!/^[a-z]{3,10}$/.test(w)) continue;
  (WORDS[w.length] = WORDS[w.length] || []).push(w);
}
export const WORD_COUNTS = Object.fromEntries(
  Object.keys(WORDS).map(k => [k, WORDS[k].length])
);

// Boss plaques: long, multi-segment ceremonial words.
export const BOSS_TABLE = [
  ['stronghold', 'battlement', 'sentinel'],
  ['impenetrable', 'fortification', 'constellation'],
  ['magnificence', 'architecture', 'transcription'],
  ['unbreakable', 'remembrance', 'invulnerable'],
  ['extraordinary', 'imperishable', 'labyrinthine'],
];

export function bossSegmentsFor(wave) {
  if (wave === 10) return BOSS_TABLE[1].slice(0, 3);
  const idx = Math.floor(wave / 8) % BOSS_TABLE.length;
  const pool = idx === 1 ? BOSS_TABLE[2] : BOSS_TABLE[idx];
  const n = wave <= 8 ? 2 : 3;
  return pool.slice(0, n);
}

// Seeded PRNG so "no NaN" / word-length assertions are reproducible.
export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWord(rng, cap, recent = [], minLen = 3) {
  cap = Math.max(3, Math.min(10, cap | 0));
  const lengths = Object.keys(WORDS)
    .map(Number)
    .filter(l => l >= minLen && l <= cap)
    .sort((a, b) => a - b);
  if (!lengths.length) return 'ink';
  // Bias toward the current cap so later waves feel longer and denser.
  let len;
  if (cap >= 6 && rng() < 0.42) len = cap;
  else len = lengths[Math.floor(rng() * lengths.length)];
  const pool = WORDS[len] || WORDS[3];
  for (let i = 0; i < 7; i++) {
    const w = pool[Math.floor(rng() * pool.length)];
    if (!recent.includes(w)) return w;
  }
  return pool[Math.floor(rng() * pool.length)];
}
