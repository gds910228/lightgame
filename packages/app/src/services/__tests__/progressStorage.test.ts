import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  defaultProgressState,
  migrateProgress,
  startPlay,
  addDuration,
  recordScore,
  mergeCustomProgress,
  getRecentGames,
  getTotalStats,
  getMaxPlayCount,
  hasAnyHighScore,
  PROGRESS_VERSION,
} from '../progressStorage';

const NOW = 1_700_000_000_000;

describe('defaultProgressState', () => {
  it('returns empty v1 state', () => {
    const s = defaultProgressState();
    expect(s.version).toBe(PROGRESS_VERSION);
    expect(s.games).toEqual({});
  });
});

describe('migrateProgress', () => {
  it('returns default for null/non-object/wrong version', () => {
    expect(migrateProgress(null)).toEqual(defaultProgressState());
    expect(migrateProgress('x')).toEqual(defaultProgressState());
    expect(migrateProgress({ version: 2, games: {} })).toEqual(defaultProgressState());
    expect(migrateProgress({ version: 1, games: { a: { playCount: -5 } } })).toEqual({ version: 1, games: {} });
  });
  it('sanitizes and keeps valid game records', () => {
    const raw = {
      version: 1,
      games: {
        good: { gameId: 'good', playCount: 3, totalPlayDurationMs: 1000, highScore: 50, lastScore: 40, firstPlayedAt: 1, lastPlayedAt: 2, customProgress: { a: 1 } },
        bad: { playCount: 1 },
      },
    };
    const result = migrateProgress(raw);
    expect(Object.keys(result.games)).toEqual(['good']);
    expect(result.games.good.playCount).toBe(3);
    expect(result.games.good.highScore).toBe(50);
  });
});

describe('startPlay', () => {
  it('creates a new game record on first play', () => {
    const s = startPlay(defaultProgressState(), 'g1', NOW);
    expect(s.games.g1.playCount).toBe(1);
    expect(s.games.g1.firstPlayedAt).toBe(NOW);
    expect(s.games.g1.lastPlayedAt).toBe(NOW);
    expect(s.games.g1.totalPlayDurationMs).toBe(0);
  });
  it('increments play count and updates lastPlayedAt on subsequent plays', () => {
    let s = startPlay(defaultProgressState(), 'g1', NOW);
    s = startPlay(s, 'g1', NOW + 1000);
    expect(s.games.g1.playCount).toBe(2);
    expect(s.games.g1.lastPlayedAt).toBe(NOW + 1000);
    expect(s.games.g1.firstPlayedAt).toBe(NOW);
  });
  it('does not mutate input state', () => {
    const initial = defaultProgressState();
    const s = startPlay(initial, 'g1', NOW);
    expect(initial.games.g1).toBeUndefined();
    expect(s).not.toBe(initial);
  });
});

describe('addDuration', () => {
  it('adds duration to existing game', () => {
    let s = startPlay(defaultProgressState(), 'g1', NOW);
    s = addDuration(s, 'g1', 5000);
    expect(s.games.g1.totalPlayDurationMs).toBe(5000);
    s = addDuration(s, 'g1', 2500);
    expect(s.games.g1.totalPlayDurationMs).toBe(7500);
  });
  it('ignores missing game or non-positive ms', () => {
    const s = startPlay(defaultProgressState(), 'g1', NOW);
    expect(addDuration(s, 'other', 100)).toBe(s);
    expect(addDuration(s, 'g1', 0)).toBe(s);
    expect(addDuration(s, 'g1', -5)).toBe(s);
  });
});

describe('recordScore', () => {
  it('creates a record with high score when game does not exist', () => {
    const { state, result } = recordScore(defaultProgressState(), 'g1', 50, NOW);
    expect(result.isNewHighScore).toBe(true);
    expect(result.highScore).toBe(50);
    expect(state.games.g1.highScore).toBe(50);
    expect(state.games.g1.lastScore).toBe(50);
  });
  it('updates high score only when new score is higher', () => {
    const s = recordScore(defaultProgressState(), 'g1', 50, NOW).state;
    const r2 = recordScore(s, 'g1', 30, NOW + 1);
    expect(r2.result.isNewHighScore).toBe(false);
    expect(r2.result.highScore).toBe(50);
    expect(r2.state.games.g1.highScore).toBe(50);
    expect(r2.state.games.g1.lastScore).toBe(30);
    const r3 = recordScore(r2.state, 'g1', 80, NOW + 2);
    expect(r3.result.isNewHighScore).toBe(true);
    expect(r3.state.games.g1.highScore).toBe(80);
  });
});

describe('mergeCustomProgress', () => {
  it('shallow-merges data into customProgress', () => {
    let s = startPlay(defaultProgressState(), 'g1', NOW);
    s = mergeCustomProgress(s, 'g1', { level: 2, coins: 100 });
    s = mergeCustomProgress(s, 'g1', { level: 3 });
    expect(s.games.g1.customProgress).toEqual({ level: 3, coins: 100 });
  });
  it('no-ops for missing game', () => {
    const s = defaultProgressState();
    expect(mergeCustomProgress(s, 'nope', { a: 1 })).toBe(s);
  });
});

describe('getRecentGames', () => {
  it('returns games sorted by lastPlayedAt desc, limited', () => {
    let s = defaultProgressState();
    s = startPlay(s, 'a', 1000);
    s = startPlay(s, 'b', 3000);
    s = startPlay(s, 'c', 2000);
    const recent = getRecentGames(s, 2);
    expect(recent.map((g) => g.gameId)).toEqual(['b', 'c']);
  });
});

describe('getTotalStats / getMaxPlayCount / hasAnyHighScore', () => {
  it('aggregates correctly across games', () => {
    let s = defaultProgressState();
    s = startPlay(s, 'a', 1); // 1 play
    s = startPlay(s, 'a', 2); // 2 plays
    s = startPlay(s, 'b', 3); // 1 play
    s = addDuration(s, 'a', 60_000);
    s = addDuration(s, 'b', 30_000);
    s = recordScore(s, 'b', 10, 4).state;
    const stats = getTotalStats(s);
    expect(stats.totalPlays).toBe(3);
    expect(stats.distinctGamesPlayed).toBe(2);
    expect(stats.totalPlayDurationMs).toBe(90_000);
    expect(getMaxPlayCount(s)).toBe(2);
    expect(hasAnyHighScore(s)).toBe(true);
  });
  it('hasAnyHighScore false when no scores', () => {
    const s = startPlay(defaultProgressState(), 'a', 1);
    expect(hasAnyHighScore(s)).toBe(false);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom-free node env: provide a minimal localStorage mock via globalThis
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
    };
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('loadProgress returns default on corrupt JSON', async () => {
    const { loadProgress, PROGRESS_STORAGE_KEY } = await import('../progressStorage');
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{not valid json');
    expect(loadProgress()).toEqual(defaultProgressState());
  });

  it('saveProgress writes and loadProgress reads round-trip', async () => {
    const { loadProgress, saveProgress } = await import('../progressStorage');
    const s = startPlay(defaultProgressState(), 'g1', NOW);
    saveProgress(s);
    const loaded = loadProgress();
    expect(loaded.games.g1.playCount).toBe(1);
  });

  it('saveProgress does not throw on storage error', async () => {
    const { saveProgress } = await import('../progressStorage');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => saveProgress(startPlay(defaultProgressState(), 'g', NOW))).not.toThrow();
  });
});
