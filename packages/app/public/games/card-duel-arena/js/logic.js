// Card Duel Arena 斗牌竞技场 — deterministic rules, combat, AI and selfplay.
// Pure ES module (no DOM, no network) so the browser game, autotest and the
// balance harness all execute the exact same mathematics.

export const RULES = Object.freeze({
  startingHp: 30,
  startingHand: 5,
  maxEnergy: 10,
  secondGuard: 3,        // 后手补偿：第二行动方开局护甲（在首次己方回合开始时清除）
  maxTurns: 120,         // hard safety cap for simulations
  drawPerTurn: 1,
});

export const CLASSES = Object.freeze({
  blade: {
    id: 'blade', name: '赤刃剑士', short: '剑士', color: '#f07a4d',
    title: 'BLADE VANGUARD', desc: '稳攻稳守，反击与终结斩擅长收尾。',
    beats: 'ranger', tag: '克 游侠',
  },
  ranger: {
    id: 'ranger', name: '青羽游侠', short: '游侠', color: '#54d6a0',
    title: 'JADE RANGER', desc: '低费连击与闪避，节奏轻快。',
    beats: 'mage', tag: '克 法师',
  },
  mage: {
    id: 'mage', name: '紫雷法师', short: '法师', color: '#9a86ff',
    title: 'STORM ARCANIST', desc: '高爆发法术与灼烧，能量涌动滚雪球。',
    beats: 'blade', tag: '克 剑士',
  },
});

export const COUNTER_BONUS = 1.15;
export const COUNTER_OF = Object.freeze({ blade: 'ranger', ranger: 'mage', mage: 'blade' });

// The complete 20-card library. Every card is shared by at least one preset.
export const CARD_LIBRARY = Object.freeze([
  { id: 'quick_slash', name: '疾风斩', en: 'Quick Slash', cat: 'attack', cost: 1, dmg: 4, icon: 'slash', text: '造成 4 点伤害。' },
  { id: 'armor_break', name: '裂甲重击', en: 'Armor Break', cat: 'attack', cost: 2, dmg: 6, strip: 2, icon: 'hammer', text: '先削减目标 2 点护甲，再造成 6 点伤害。' },
  { id: 'twin_cut', name: '双刃连斩', en: 'Twin Cut', cat: 'attack', cost: 2, hits: [4, 4], icon: 'twin', text: '连续两段，各造成 4 点伤害。' },
  { id: 'ember_slash', name: '烈焰斩', en: 'Ember Slash', cat: 'attack', cost: 2, dmg: 5, burn: 2, burnTurns: 2, icon: 'flame', text: '造成 5 点伤害，并施加 2 层灼烧（2 回合）。' },
  { id: 'thunder_rush', name: '雷霆突袭', en: 'Thunder Rush', cat: 'attack', cost: 3, dmg: 10, icon: 'bolt', text: '造成 10 点伤害。' },
  { id: 'shadow_strike', name: '影袭', en: 'Shadow Strike', cat: 'attack', cost: 1, dmg: 3, bonus: 2, bonusIfHpBelow: 15, icon: 'dagger', text: '造成 3 点伤害；若目标生命 ≤15，改为 5 点。' },
  { id: 'execute', name: '终结斩', en: 'Execute', cat: 'attack', cost: 3, dmg: 9, bonus: 5, bonusIfHpBelow: 11, icon: 'exec', text: '造成 9 点伤害；若目标生命 ≤10，改为 14 点。' },
  { id: 'pierce_arrow', name: '穿云箭', en: 'Pierce Arrow', cat: 'attack', cost: 2, dmg: 5, pierce: true, icon: 'arrow', text: '造成 5 点无视护甲的伤害。' },
  { id: 'wood_guard', name: '木灵盾', en: 'Wood Guard', cat: 'defense', cost: 1, block: 5, icon: 'shield', text: '获得 5 点护甲。' },
  { id: 'iron_wall', name: '铁壁', en: 'Iron Wall', cat: 'defense', cost: 2, block: 10, icon: 'wall', text: '获得 10 点护甲。' },
  { id: 'riposte', name: '反击架势', en: 'Riposte', cat: 'defense', cost: 2, block: 6, nextAtk: 3, icon: 'riposte', text: '获得 6 点护甲，下一张伤害牌 +3。' },
  { id: 'evade', name: '轻身步', en: 'Evade', cat: 'defense', cost: 1, block: 3, draw: 1, icon: 'wind', text: '获得 3 点护甲并抽 1 张牌。' },
  { id: 'thorn_armor', name: '荆棘甲', en: 'Thorn Armor', cat: 'defense', cost: 2, block: 5, thorns: 3, thornsTurns: 1, icon: 'thorn', text: '获得 5 点护甲；本回合反伤 3 点。' },
  { id: 'heal_prayer', name: '治疗祷言', en: 'Healing Prayer', cat: 'defense', cost: 2, heal: 6, icon: 'prayer', text: '恢复 6 点生命。' },
  { id: 'arcane_bolt', name: '奥术箭', en: 'Arcane Bolt', cat: 'spell', cost: 1, dmg: 4, icon: 'arcane', text: '造成 4 点法术伤害。' },
  { id: 'fireball', name: '火球术', en: 'Fireball', cat: 'spell', cost: 3, dmg: 9, icon: 'fireball', text: '造成 9 点法术伤害。' },
  { id: 'might_bless', name: '力量祝福', en: 'Blessing of Might', cat: 'spell', cost: 1, nextAtk: 4, icon: 'bless', text: '下一张伤害牌 +4 伤害。' },
  { id: 'surge', name: '能量涌动', en: 'Surge', cat: 'spell', cost: 0, energy: 2, draw: 1, icon: 'surge', text: '获得 2 点能量并抽 1 张牌（上限 10）。' },
  { id: 'weaken', name: '虚弱诅咒', en: 'Weaken', cat: 'spell', cost: 2, weaken: 3, icon: 'curse', text: '目标下一张伤害牌 -3 伤害。' },
  { id: 'purify', name: '净化', en: 'Purify', cat: 'spell', cost: 1, heal: 3, cleanse: true, icon: 'purify', text: '恢复 3 点生命，清除自身灼烧与虚弱。' },
]);

export const CARD_MAP = Object.freeze(Object.fromEntries(CARD_LIBRARY.map(c => [c.id, c])));

const DECK_LISTS = {
  blade: [
    'quick_slash', 'quick_slash', 'quick_slash',
    'armor_break', 'armor_break',
    'twin_cut', 'twin_cut',
    'execute', 'execute',
    'wood_guard', 'wood_guard', 'wood_guard',
    'iron_wall', 'iron_wall',
    'riposte', 'riposte',
    'might_bless', 'might_bless',
    'purify', 'pierce_arrow',
  ],
  ranger: [
    'quick_slash', 'quick_slash', 'quick_slash',
    'shadow_strike', 'shadow_strike', 'shadow_strike',
    'pierce_arrow', 'pierce_arrow',
    'twin_cut', 'twin_cut',
    'evade', 'evade', 'evade',
    'riposte',
    'thorn_armor', 'thorn_armor',
    'might_bless', 'might_bless',
    'surge', 'surge',
  ],
  mage: [
    'arcane_bolt', 'arcane_bolt', 'arcane_bolt',
    'fireball', 'fireball', 'fireball',
    'ember_slash', 'ember_slash',
    'thunder_rush', 'thunder_rush',
    'iron_wall', 'iron_wall',
    'heal_prayer', 'heal_prayer',
    'surge', 'surge',
    'weaken', 'weaken',
    'purify', 'purify',
  ],
};

// Three preset 20-card decks, drawn from the 20-card library with duplicates.
export const CLASS_DECKS = Object.freeze(Object.fromEntries(
  Object.entries(DECK_LISTS).map(([id, list]) => [id, Object.freeze(list.slice())])
));

export const CAT_LABEL = Object.freeze({ attack: '攻击', defense: '防御', spell: '法术' });
export const CAT_COLOR = Object.freeze({ attack: '#ff8a62', defense: '#65e0c2', spell: '#b9a0ff' });

export function classCounter(attacker, defender) {
  return COUNTER_OF[attacker] === defender ? COUNTER_BONUS : 1;
}
export function counterRelation(attacker, defender) {
  if (COUNTER_OF[attacker] === defender) return 'advantage';
  if (COUNTER_OF[defender] === attacker) return 'disadvantage';
  return 'neutral';
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashInt(a, b, c) {
  let h = (a >>> 0) ^ Math.imul(b >>> 0, 0x9e3779b1) ^ Math.imul(c >>> 0, 0x85ebca6b);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return h >>> 0 || 1;
}

function xorshift(state) {
  let x = state >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x || 1;
}
function nextAi(state, side) {
  const k = side === 'p2' ? 'p2Seed' : 'p1Seed';
  const n = xorshift(state.ai[k]);
  state.ai[k] = n;
  return (n >>> 0) / 4294967296;
}
function copyState(state) { return JSON.parse(JSON.stringify(state)); }
function otherSide(side) { return side === 'p2' ? 'p1' : 'p2'; }
function playerOf(state, side) { return side === 'p2' ? state.p2 : state.p1; }
function targetOf(state, side) { return side === 'p2' ? state.p1 : state.p2; }

function shuffleWith(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    state.rngState = xorshift(state.rngState);
    const j = state.rngState % (i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function newPlayer(side, cls, seed) {
  return {
    side, cls,
    hp: RULES.startingHp, maxHp: RULES.startingHp,
    block: 0,
    energy: 1, maxEnergy: 1,
    hand: [], deck: [], discard: [],
    burn: 0, burnT: 0,
    nextAtk: 0, weaken: 0,
    thorns: 0, thornsT: 0,
    firstTurnDone: false,
    damageDealt: 0,
    cardsPlayed: 0,
    turnsTaken: 0,
    p1Seed: 0,
  };
}

export function createBattle(opts = {}) {
  const p1class = CLASSES[opts.p1class] ? opts.p1class : 'blade';
  const p2class = CLASSES[opts.p2class] ? opts.p2class : 'ranger';
  const firstSide = opts.firstSide === 'p2' ? 'p2' : 'p1';
  const seed = (Number.isFinite(opts.seed) ? opts.seed : 1) >>> 0 || 1;
  const seedN = seed >>> 0;
  const state = {
    p1class, p2class, firstSide,
    p1: newPlayer('p1', p1class, seedN),
    p2: newPlayer('p2', p2class, seedN),
    active: firstSide,
    turn: 1,
    over: false,
    winner: null,
    reason: '',
    rngState: hashInt(seedN, 0x51ed, 0x9e37),
    ai: {
      p1Seed: hashInt(seedN, 0x11a1, 0x7f4a),
      p2Seed: hashInt(seedN, 0x22b2, 0x7f4a),
    },
    events: [],
    log: [],
    maxTurns: Number.isFinite(opts.maxTurns) ? opts.maxTurns : RULES.maxTurns,
    compensation: Number.isFinite(opts.compensation) ? opts.compensation : RULES.secondGuard,
  };

  // Both decks are complete 20-card lists, shuffled deterministically.
  for (const p of [state.p1, state.p2]) {
    p.deck = shuffleWith(state, CLASS_DECKS[p.cls].slice());
    drawCards(state, p, RULES.startingHand, true);
  }

  const first = playerOf(state, firstSide);
  const second = playerOf(state, otherSide(firstSide));
  if (state.compensation > 0) second.block = state.compensation;

  // The first turn begins immediately (1 energy, no extra draw).
  beginTurn(state, first, { initial: true });
  state.log.push({ t: 0, kind: 'start', text: `${CLASSES[p1class].short} 对 ${CLASSES[p2class].short} · ${firstSide === 'p1' ? '先手 P1' : '先手 P2'}` });
  return state;
}

export function drawCards(state, player, n = 1, silent = false) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!player.deck.length) {
      if (!player.discard.length) break;
      player.deck = shuffleWith(state, player.discard.splice(0));
      if (!silent) state.log.push({ t: state.turn, kind: 'reshuffle', side: player.side, text: `${player.side.toUpperCase()} 弃牌堆洗回牌库` });
    }
    if (!player.deck.length) break;
    const id = player.deck.pop();
    player.hand.push(id);
    out.push(id);
  }
  return out;
}

function beginTurn(state, player, opts = {}) {
  state.active = player.side;
  // Personal block expires at the start of your own turn. Any attack from the
  // opponent during the previous turn already had a chance to consume it.
  player.block = 0;
  if (player.thornsT > 0) {
    player.thornsT -= 1;
    if (player.thornsT <= 0) { player.thornsT = 0; player.thorns = 0; }
  }

  // Burn resolves before energy refill, directly to HP, ignoring block.
  if (player.burnT > 0 && player.burn > 0) {
    const dmg = player.burn;
    player.hp = Math.max(0, player.hp - dmg);
    player.burnT -= 1;
    if (player.burnT <= 0) { player.burnT = 0; player.burn = 0; }
    state.events.push({ type: 'burn', target: player.side, amount: dmg, hpAfter: player.hp });
    state.log.push({ t: state.turn, kind: 'burn', side: player.side, text: `灼烧 ${player.side.toUpperCase()} -${dmg}` });
    if (player.hp <= 0) {
      finishBattle(state, otherSide(player.side), 'burn');
      return false;
    }
  }

  if (player.firstTurnDone) player.maxEnergy = Math.min(RULES.maxEnergy, player.maxEnergy + 1);
  else player.firstTurnDone = true;
  player.energy = player.maxEnergy;
  player.turnsTaken += 1;

  if (!opts.initial) {
    drawCards(state, player, RULES.drawPerTurn);
    state.log.push({ t: state.turn, kind: 'turn', side: player.side, text: `${player.side.toUpperCase()} 回合 · 能量 ${player.energy}/${player.maxEnergy}` });
  }
  return true;
}

function finishBattle(state, winner, reason) {
  if (state.over) return;
  state.over = true;
  state.winner = winner;
  state.reason = reason || 'ko';
  state.active = state.winner === 'p1' ? 'p2' : 'p1';
}

function cardHits(card, actor, target) {
  let hits = Array.isArray(card.hits) ? card.hits.slice() : (card.dmg ? [card.dmg] : []);
  if (card.bonus && card.bonusIfHpBelow && target.hp <= card.bonusIfHpBelow) hits = hits.map(v => v + card.bonus);
  return hits;
}

function damageCard(state, actor, target, card, events) {
  const hits = cardHits(card, actor, target);
  if (!hits.length) return 0;
  let atkBonus = actor.nextAtk;
  let atkPenalty = actor.weaken;
  let totalHp = 0;
  for (let i = 0; i < hits.length; i++) {
    if (target.hp <= 0 || state.over) break;
    let base = hits[i];
    if (i === 0) {
      base = Math.max(0, base + atkBonus - atkPenalty);
      atkBonus = 0; atkPenalty = 0;
    }
    const mult = classCounter(actor.cls, target.cls);
    const raw = Math.max(0, Math.round(base * mult));
    let blocked = 0;
    let hpLoss = raw;
    if (!card.pierce) {
      blocked = Math.min(target.block, raw);
      target.block -= blocked;
      hpLoss = raw - blocked;
    }
    target.hp = Math.max(0, target.hp - hpLoss);
    totalHp += hpLoss;
    actor.damageDealt += hpLoss;
    events.push({
      type: 'damage', by: actor.side, target: target.side, card: card.id,
      raw, blocked, hpLoss, hpAfter: target.hp, counter: mult > 1 ? mult : 1,
    });
    state.log.push({
      t: state.turn, kind: 'damage', side: actor.side,
      text: `${card.name} → ${target.side.toUpperCase()} -${hpLoss}${blocked ? `（护甲吸收 ${blocked}）` : ''}${mult > 1 ? ' · 职业克制 ×1.15' : ''}`,
    });
  }
  // Consume buffs/penalties even when block absorbed the whole hit.
  actor.nextAtk = 0;
  actor.weaken = 0;

  if (target.hp <= 0) {
    finishBattle(state, actor.side, 'ko');
    return totalHp;
  }

  if (target.thorns > 0 && target.thornsT > 0) {
    const th = target.thorns;
    actor.hp = Math.max(0, actor.hp - th);
    state.events.push({ type: 'thorns', by: target.side, target: actor.side, amount: th, hpAfter: actor.hp });
    state.log.push({ t: state.turn, kind: 'thorns', side: target.side, text: `荆棘反伤 ${actor.side.toUpperCase()} -${th}` });
    if (actor.hp <= 0) finishBattle(state, target.side, 'thorns');
  }
  return totalHp;
}

export function playCard(state, side, selector) {
  if (!state || state.over) return { ok: false, error: 'over' };
  if (state.active !== side) return { ok: false, error: 'not-turn' };
  const actor = playerOf(state, side);
  const target = targetOf(state, side);
  let idx = -1;
  if (typeof selector === 'number' && Number.isInteger(selector)) idx = selector;
  else if (typeof selector === 'string') {
    if (/^\d+$/.test(selector)) idx = parseInt(selector, 10);
    else idx = actor.hand.findIndex(id => id === selector);
  }
  if (idx < 0 || idx >= actor.hand.length) return { ok: false, error: 'no-card' };
  const card = CARD_MAP[actor.hand[idx]];
  if (!card) return { ok: false, error: 'bad-card' };
  if (card.cost > actor.energy) return { ok: false, error: 'energy', card };

  const events = [];
  actor.energy -= card.cost;
  actor.hand.splice(idx, 1);
  actor.cardsPlayed += 1;
  events.push({ type: 'play', by: side, card: card.id, cat: card.cat, cost: card.cost, energyAfter: actor.energy });
  state.log.push({ t: state.turn, kind: 'play', side, text: `${side.toUpperCase()} 打出【${card.name}】` });

  if (card.strip && target.block > 0) {
    const stripped = Math.min(target.block, card.strip);
    target.block -= stripped;
    events.push({ type: 'strip', target: target.side, amount: stripped, blockAfter: target.block });
  }

  if (card.dmg || card.hits) damageCard(state, actor, target, card, events);

  if (card.block) {
    actor.block += card.block;
    events.push({ type: 'block', by: side, amount: card.block, blockAfter: actor.block });
  }
  if (card.heal) {
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + card.heal);
    events.push({ type: 'heal', by: side, amount: actor.hp - before, hpAfter: actor.hp });
  }
  if (card.cleanse) {
    const burned = actor.burn, weak = actor.weaken;
    actor.burn = 0; actor.burnT = 0; actor.weaken = 0;
    events.push({ type: 'cleanse', by: side, burn: burned, weaken: weak });
  }
  if (card.nextAtk) {
    actor.nextAtk += card.nextAtk;
    events.push({ type: 'buff', by: side, amount: card.nextAtk, nextAtk: actor.nextAtk });
  }
  if (card.energy) {
    const before = actor.energy;
    actor.energy = Math.min(RULES.maxEnergy, actor.energy + card.energy);
    events.push({ type: 'energy', by: side, amount: actor.energy - before, energyAfter: actor.energy });
  }
  if (card.burn && !state.over) {
    target.burn += card.burn;
    target.burnT = Math.max(target.burnT, card.burnTurns || 1);
    events.push({ type: 'applyBurn', target: target.side, amount: card.burn, turns: card.burnTurns || 1 });
  }
  if (card.thorns && !state.over) {
    actor.thorns = Math.max(actor.thorns, card.thorns);
    actor.thornsT = Math.max(actor.thornsT, card.thornsTurns || 1);
    events.push({ type: 'thornsUp', by: side, amount: card.thorns, turns: actor.thornsT });
  }
  if (card.weaken && !state.over) {
    target.weaken = Math.max(target.weaken, card.weaken);
    events.push({ type: 'weaken', target: target.side, amount: target.weaken });
  }
  if (card.draw && !state.over) {
    const drawn = drawCards(state, actor, card.draw);
    events.push({ type: 'draw', by: side, count: drawn.length, ids: drawn });
  }

  actor.discard.push(card.id);
  state.events = events;
  return { ok: true, card, events, handIndex: idx };
}

export function endTurn(state) {
  if (!state || state.over) return { ok: false, error: 'over' };
  const old = state.active;
  if (state.turn >= state.maxTurns) {
    const winner = state.p1.hp === state.p2.hp ? (state.firstSide) : (state.p1.hp > state.p2.hp ? 'p1' : 'p2');
    finishBattle(state, winner, 'timeout');
    return { ok: true, over: true, winner };
  }
  const next = otherSide(old);
  state.turn += 1;
  state.events = [{ type: 'endTurn', from: old, to: next }];
  if (!beginTurn(state, playerOf(state, next))) {
    return { ok: true, over: true, winner: state.winner, events: state.events };
  }
  return { ok: true, active: state.active, events: state.events };
}

export function totalCards(player) {
  return player.hand.length + player.deck.length + player.discard.length;
}

export function energyForTurn(turnOfPlayer) {
  return Math.min(RULES.maxEnergy, Math.max(1, turnOfPlayer));
}

export function effectiveCardDamage(state, side, selector) {
  const actor = playerOf(state, side);
  const target = targetOf(state, side);
  let card = CARD_MAP[selector];
  if (!card && Number.isInteger(selector)) card = CARD_MAP[actor.hand[selector]];
  if (!card) return null;
  const hits = cardHits(card, actor, target);
  let bonus = actor.nextAtk, penalty = actor.weaken;
  let hpDamage = 0, blocked = 0;
  let simBlock = target.block;
  let simHp = target.hp;
  for (let i = 0; i < hits.length; i++) {
    let base = hits[i];
    if (i === 0) { base = Math.max(0, base + bonus - penalty); bonus = 0; penalty = 0; }
    const raw = Math.max(0, Math.round(base * classCounter(actor.cls, target.cls)));
    let b = 0;
    if (!card.pierce) { b = Math.min(simBlock, raw); simBlock -= b; }
    const hp = raw - b;
    blocked += b; hpDamage += hp; simHp = Math.max(0, simHp - hp);
  }
  return {
    raw: hpDamage + blocked, hpDamage, blocked,
    lethal: simHp <= 0, targetHpAfter: simHp,
    hits: hits.length, pierce: !!card.pierce,
  };
}

export function cardValue(state, side, selector) {
  const actor = playerOf(state, side);
  const target = targetOf(state, side);
  const card = typeof selector === 'string' ? CARD_MAP[selector] : CARD_MAP[actor.hand[selector]];
  if (!card) return -Infinity;
  const dmg = effectiveCardDamage(state, side, selector);
  let v = 0;
  if (dmg) {
    v += dmg.hpDamage * 1.05 + dmg.blocked * 0.3;
    if (dmg.lethal) v += 80;
  }
  if (card.strip) v += Math.min(target.block, card.strip) * 0.45;
  if (card.block) v += card.block * 0.58;
  if (card.heal) v += Math.min(Math.max(0, actor.maxHp - actor.hp), card.heal) * 1.05;
  if (card.draw) v += card.draw * 1.7;
  if (card.energy) v += Math.min(card.energy, Math.max(0, RULES.maxEnergy - actor.energy)) * 2.1;
  if (card.nextAtk) v += card.nextAtk * (actor.hand.length > 1 ? 0.72 : 0.35);
  if (card.burn) v += card.burn * (card.burnTurns || 1) * 0.82;
  if (card.thorns) v += card.thorns * (card.thornsTurns || 1) * 0.58;
  if (card.weaken) v += card.weaken * 0.72;
  if (card.cleanse) v += (actor.burn > 0 ? actor.burn * actor.burnT * 0.8 : 0) + (actor.weaken > 0 ? actor.weaken * 0.8 : 0);
  // Slight preference for using energy efficiently: prevent zero-impact cards.
  if (v <= 0.02 && !card.draw && !card.energy) v = -1;
  return v;
}

export function playableIndices(state, side) {
  const p = playerOf(state, side);
  const out = [];
  for (let i = 0; i < p.hand.length; i++) {
    const c = CARD_MAP[p.hand[i]];
    if (c && c.cost <= p.energy) out.push(i);
  }
  return out;
}

function chooseEasy(state, side) {
  const legal = playableIndices(state, side);
  if (!legal.length) return { type: 'end' };
  // Random legal: mostly plays a random affordable card, sometimes banks tempo.
  if (nextAi(state, side) < 0.14) return { type: 'end' };
  const idx = legal[Math.floor(nextAi(state, side) * legal.length) % legal.length];
  return { type: 'play', index: idx };
}

function chooseGreedy(state, side) {
  const legal = playableIndices(state, side);
  if (!legal.length) return { type: 'end' };
  let best = null, bestV = 0.12;
  for (const idx of legal) {
    const v = cardValue(state, side, idx);
    if (v > bestV) { bestV = v; best = idx; }
  }
  return best === null ? { type: 'end' } : { type: 'play', index: best };
}

function evalForSide(state, side) {
  if (state.over) return state.winner === side ? 100000 : -100000;
  const me = playerOf(state, side);
  const op = targetOf(state, side);
  return (me.hp - op.hp) * 3.1
    + (me.block - op.block) * 0.62
    + (me.hand.length - op.hand.length) * 1.45
    + (me.energy - op.energy) * 0.35
    + (op.burn * op.burnT - me.burn * me.burnT) * 0.75
    + (me.nextAtk - op.nextAtk) * 0.42
    + (me.thorns - op.thorns) * 0.35
    + (op.hp <= 10 ? 0.5 : 0);
}

function autoplayGreedyTurn(state, side) {
  let guard = 0;
  while (!state.over && state.active === side && guard++ < 24) {
    const a = chooseGreedy(state, side);
    if (a.type === 'end') break;
    const r = playCard(state, side, a.index);
    if (!r.ok) break;
  }
  if (!state.over && state.active === side) endTurn(state);
}

function chooseLookahead(state, side) {
  const legal = playableIndices(state, side);
  const opp = otherSide(side);

  // Baseline: end the turn now and let the opponent's greedy policy respond.
  let base = copyState(state);
  endTurn(base);
  autoplayGreedyTurn(base, opp);
  let bestScore = evalForSide(base, side);
  let best = { type: 'end' };

  for (const idx of legal) {
    const s = copyState(state);
    const r = playCard(s, side, idx);
    if (!r.ok) continue;
    if (s.over) {
      if (s.winner === side) return { type: 'play', index: idx };
      continue;
    }
    // Finish our own turn greedily, then let the opponent take a full greedy turn.
    autoplayGreedyTurn(s, side);
    if (!s.over) autoplayGreedyTurn(s, opp);
    let score = evalForSide(s, side);
    // Small preference for immediate pressure / progress on the chosen card.
    const dmg = effectiveCardDamage(state, side, idx);
    if (dmg) score += dmg.hpDamage * 0.2;
    if (score > bestScore + 0.001) { bestScore = score; best = { type: 'play', index: idx }; }
  }
  return best;
}

export function chooseAction(state, diff = 'medium', side = state.active) {
  const d = typeof diff === 'number' ? (['easy', 'medium', 'hard'][Math.max(0, Math.min(2, diff - 1))]) : diff;
  if (d === 'easy') return chooseEasy(state, side);
  if (d === 'hard') return chooseLookahead(state, side);
  return chooseGreedy(state, side);
}

export function applyAction(state, diff = 'medium', side = state.active) {
  const action = chooseAction(state, diff, side);
  if (action.type === 'end') return { kind: 'end', result: endTurn(state) };
  const result = playCard(state, side, action.index);
  return { kind: 'play', action, result };
}

export function playAIMatch(state, diff = 'medium', actionCap = 800) {
  let actions = 0;
  while (!state.over && actions++ < actionCap) {
    applyAction(state, diff);
  }
  if (!state.over) {
    const winner = state.p1.hp === state.p2.hp ? state.firstSide : (state.p1.hp > state.p2.hp ? 'p1' : 'p2');
    finishBattle(state, winner, 'timeout');
  }
  return state;
}

export const BENCH_PAIRS = Object.freeze([
  ['blade', 'ranger'], ['ranger', 'blade'],
  ['ranger', 'mage'], ['mage', 'ranger'],
  ['mage', 'blade'], ['blade', 'mage'],
]);

export function runSelfplay(n = 200, diff = 'medium', firstSide = null, opts = {}) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  const forcedFirst = firstSide === 'p1' || firstSide === 'p2' ? firstSide : null;
  const diffKey = typeof diff === 'number' ? (['easy', 'medium', 'hard'][Math.max(0, Math.min(2, diff - 1))]) : (diff || 'medium');
  const seedBase = Number.isFinite(opts.seedBase) ? opts.seedBase >>> 0 : 20261126;
  let firstWins = 0, secondWins = 0, p1Wins = 0, p2Wins = 0, turns = 0, errors = 0;
  const byFirst = { p1: { games: 0, wins: 0 }, p2: { games: 0, wins: 0 } };
  for (let i = 0; i < n; i++) {
    try {
      const first = forcedFirst || (i % 2 === 0 ? 'p1' : 'p2');
      // Decouple class matchup from initiative: both sides of every counter
      // pair are represented equally among first players.
      const pair = BENCH_PAIRS[Math.floor(i / 2) % BENCH_PAIRS.length];
      const p1class = pair[0], p2class = pair[1];
      const seed = (seedBase + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
      const state = createBattle({
        p1class, p2class, seed, firstSide: first,
        compensation: Number.isFinite(opts.compensation) ? opts.compensation : undefined,
      });
      playAIMatch(state, diffKey);
      const winner = state.winner;
      if (winner === 'p1') p1Wins++; else if (winner === 'p2') p2Wins++;
      if (winner === first) firstWins++; else if (winner === otherSide(first)) secondWins++;
      byFirst[first].games += 1;
      if (winner === first) byFirst[first].wins += 1;
      turns += state.turn;
    } catch (e) { errors++; }
  }
  const played = n - errors;
  return {
    games: n, played, diff: diffKey, errors,
    firstWins, secondWins,
    firstRate: firstWins / Math.max(1, played),
    secondRate: secondWins / Math.max(1, played),
    p1Wins, p2Wins,
    p1Rate: p1Wins / Math.max(1, played),
    avgTurns: turns / Math.max(1, played),
    byFirst,
  };
}

// Fixed greedy benchmark: tested tier's win rate when alternating seats and
// initiative. The opponent always uses the greedy value bot. Classes are
// balanced across counter relationships through BENCH_PAIRS.
export function runBenchmark(n = 200, diff = 'medium', opts = {}) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  const diffKey = typeof diff === 'number' ? (['easy', 'medium', 'hard'][Math.max(0, Math.min(2, diff - 1))]) : (diff || 'medium');
  const seedBase = Number.isFinite(opts.seedBase) ? opts.seedBase >>> 0 : 20261127;
  let wins = 0, losses = 0, games = 0, errors = 0, turns = 0;
  const seatWins = { p1: 0, p2: 0 }, seatGames = { p1: 0, p2: 0 };
  for (let i = 0; i < n; i++) {
    try {
      const firstSide = i % 2 === 0 ? 'p1' : 'p2';
      const testedSide = Math.floor(i / 2) % 2 === 0 ? 'p1' : 'p2';
      const botSide = otherSide(testedSide);
      // Classes rotate every four games; seat and initiative each alternate,
      // so neither tested side nor first side is correlated with class counter.
      const pair = BENCH_PAIRS[Math.floor(i / 4) % BENCH_PAIRS.length];
      const classes = { p1: pair[0], p2: pair[1] };
      const seed = (seedBase + Math.imul(i + 3, 0x85ebca6b)) >>> 0;
      const state = createBattle({
        p1class: classes.p1, p2class: classes.p2, seed, firstSide,
        compensation: Number.isFinite(opts.compensation) ? opts.compensation : undefined,
      });
      // Tested tier acts on its seat; the fixed benchmark bot acts on the other.
      let guard = 0;
      while (!state.over && guard++ < 900) {
        const side = state.active;
        const d = side === testedSide ? diffKey : 'medium';
        applyAction(state, d, side);
      }
      if (!state.over) {
        const w = state.p1.hp === state.p2.hp ? state.firstSide : (state.p1.hp > state.p2.hp ? 'p1' : 'p2');
        finishBattle(state, w, 'timeout');
      }
      games++;
      if (state.winner === testedSide) wins++; else losses++;
      seatGames[testedSide]++;
      if (state.winner === testedSide) seatWins[testedSide]++;
      turns += state.turn;
    } catch (e) { errors++; }
  }
  return {
    games, errors, diff: diffKey, wins, losses,
    winRate: wins / Math.max(1, games),
    avgTurns: turns / Math.max(1, games),
    seatWins, seatGames,
  };
}

export function snapshotCard(id) {
  const c = CARD_MAP[id];
  return c ? { ...c } : null;
}
