import { describe, it, expect } from 'vitest';
import { evaluateAchievements } from '../achievementEngine';
import { ACHIEVEMENTS } from '../achievementDefinitions';

const NOW = 1_700_000_000_000;

function ctx(over: Partial<{
  totalPlays: number; distinctGamesPlayed: number; totalPlayDurationMs: number;
  maxPlayCount: number; hasHighScore: boolean; favoritesCount: number;
}> = {}) {
  return {
    totalPlays: 0,
    distinctGamesPlayed: 0,
    totalPlayDurationMs: 0,
    maxPlayCount: 0,
    hasHighScore: false,
    favoritesCount: 0,
    ...over,
  };
}

describe('evaluateAchievements - individual thresholds', () => {
  it('unlocks first-play on first play', () => {
    const r = evaluateAchievements(ctx({ totalPlays: 1 }), {}, NOW);
    expect(r.newlyUnlocked.map((u) => u.id)).toContain('first-play');
    expect(r.next['first-play']?.unlockedAt).toBe(NOW);
  });

  it('unlocks explorer tiers at 5/10/20 distinct games', () => {
    const r5 = evaluateAchievements(ctx({ totalPlays: 5, distinctGamesPlayed: 5 }), {}, NOW);
    expect(r5.newlyUnlocked.map((u) => u.id)).toContain('explorer-5');
    const r10 = evaluateAchievements(ctx({ totalPlays: 10, distinctGamesPlayed: 10 }), {}, NOW);
    expect(r10.newlyUnlocked.map((u) => u.id)).toEqual(expect.arrayContaining(['explorer-5', 'explorer-10']));
    const r20 = evaluateAchievements(ctx({ totalPlays: 20, distinctGamesPlayed: 20 }), {}, NOW);
    expect(r20.newlyUnlocked.map((u) => u.id)).toEqual(expect.arrayContaining(['explorer-5', 'explorer-10', 'explorer-20']));
  });

  it('unlocks duration tiers at 30m and 2h', () => {
    const r30 = evaluateAchievements(ctx({ totalPlayDurationMs: 30 * 60_000 }), {}, NOW);
    expect(r30.newlyUnlocked.map((u) => u.id)).toContain('playtime-30m');
    const r2h = evaluateAchievements(ctx({ totalPlayDurationMs: 2 * 60 * 60_000 }), {}, NOW);
    expect(r2h.newlyUnlocked.map((u) => u.id)).toEqual(expect.arrayContaining(['playtime-30m', 'playtime-2h']));
  });

  it('unlocks favorite tiers at 1 and 5 favorites', () => {
    const r1 = evaluateAchievements(ctx({ favoritesCount: 1 }), {}, NOW);
    expect(r1.newlyUnlocked.map((u) => u.id)).toContain('first-favorite');
    const r5 = evaluateAchievements(ctx({ favoritesCount: 5 }), {}, NOW);
    expect(r5.newlyUnlocked.map((u) => u.id)).toEqual(expect.arrayContaining(['first-favorite', 'collector-5']));
  });

  it('unlocks dedication tiers at max play count 10 and 50', () => {
    const r10 = evaluateAchievements(ctx({ maxPlayCount: 10, totalPlays: 10 }), {}, NOW);
    expect(r10.newlyUnlocked.map((u) => u.id)).toContain('dedication-10');
    const r50 = evaluateAchievements(ctx({ maxPlayCount: 50, totalPlays: 50 }), {}, NOW);
    expect(r50.newlyUnlocked.map((u) => u.id)).toEqual(expect.arrayContaining(['dedication-10', 'dedication-50']));
  });

  it('unlocks record-breaker when any high score exists', () => {
    const r = evaluateAchievements(ctx({ hasHighScore: true }), {}, NOW);
    expect(r.newlyUnlocked.map((u) => u.id)).toContain('record-breaker');
  });
});

describe('evaluateAchievements - meta completionist', () => {
  it('does NOT unlock completionist when only some achievements are met', () => {
    const r = evaluateAchievements(ctx({ totalPlays: 1 }), {}, NOW);
    expect(r.newlyUnlocked.map((u) => u.id)).not.toContain('completionist');
  });

  it('unlocks completionist only when all other 11 are unlocked', () => {
    // Build a prevUnlocked set containing every non-meta achievement
    const prevUnlocked: Record<string, { unlockedAt: number }> = {};
    ACHIEVEMENTS.filter((a) => !a.isMeta).forEach((a) => { prevUnlocked[a.id] = { unlockedAt: NOW }; });
    const r = evaluateAchievements(ctx(), prevUnlocked, NOW);
    expect(r.newlyUnlocked.map((u) => u.id)).toContain('completionist');
    expect(r.next['completionist']).toBeDefined();
  });

  it('does not count completionist itself toward the requirement (no self-lock)', () => {
    // Empty ctx, empty prev: completionist must not unlock just because totalCount includes itself
    const r = evaluateAchievements(ctx(), {}, NOW);
    expect(r.next['completionist']).toBeUndefined();
  });
});

describe('evaluateAchievements - idempotency', () => {
  it('does not re-unlock already unlocked achievements', () => {
    const prev = { 'first-play': { unlockedAt: NOW - 1000 } };
    const r = evaluateAchievements(ctx({ totalPlays: 5, distinctGamesPlayed: 5 }), prev, NOW);
    expect(r.newlyUnlocked.find((u) => u.id === 'first-play')).toBeUndefined();
    // explorer-5 is a new unlock (distinct=5 satisfies it, first-play already in prev)
    expect(r.newlyUnlocked.map((u) => u.id)).toContain('explorer-5');
  });

  it('returns empty newlyUnlocked on second evaluation of the same state', () => {
    const first = evaluateAchievements(ctx({ totalPlays: 3, distinctGamesPlayed: 1 }), {}, NOW);
    const second = evaluateAchievements(ctx({ totalPlays: 3, distinctGamesPlayed: 1 }), first.next, NOW);
    expect(second.newlyUnlocked).toHaveLength(0);
    expect(second.next).toEqual(first.next);
  });
});
