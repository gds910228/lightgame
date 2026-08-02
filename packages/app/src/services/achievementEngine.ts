import type {
  AchievementDefinition,
  AchievementEvaluationContext,
  AchievementsState,
  UnlockedAchievement,
} from '../types';
import { ACHIEVEMENTS } from './achievementDefinitions';

export interface EvaluationResult {
  newlyUnlocked: UnlockedAchievement[];
  next: Record<string, { unlockedAt: number }>;
}

/**
 * Pure function: evaluates which achievements should be newly unlocked.
 * Non-meta achievements are evaluated first, then meta achievements are evaluated
 * against the updated unlocked count (so completionist doesn't count itself).
 */
export function evaluateAchievements(
  ctx: Omit<AchievementEvaluationContext, 'unlockedCount' | 'totalAchievements'>,
  prevUnlocked: Record<string, { unlockedAt: number }>,
  now: number
): EvaluationResult {
  const next = { ...prevUnlocked };
  const newlyUnlocked: UnlockedAchievement[] = [];
  const totalAchievements = ACHIEVEMENTS.length;

  // First pass: non-meta achievements
  for (const def of ACHIEVEMENTS) {
    if (def.isMeta) continue;
    if (next[def.id]) continue;
    const fullCtx: AchievementEvaluationContext = {
      ...ctx,
      unlockedCount: Object.keys(next).length,
      totalAchievements,
    };
    if (def.evaluate(fullCtx)) {
      next[def.id] = { unlockedAt: now };
      newlyUnlocked.push({ id: def.id, unlockedAt: now });
    }
  }

  // Second pass: meta achievements (evaluate against updated count)
  for (const def of ACHIEVEMENTS) {
    if (!def.isMeta) continue;
    if (next[def.id]) continue;
    const fullCtx: AchievementEvaluationContext = {
      ...ctx,
      unlockedCount: Object.keys(next).length,
      totalAchievements,
    };
    if (def.evaluate(fullCtx)) {
      next[def.id] = { unlockedAt: now };
      newlyUnlocked.push({ id: def.id, unlockedAt: now });
    }
  }

  return { newlyUnlocked, next };
}

/** Builds the evaluation context from raw data. */
export function buildEvaluationContext(
  totalPlays: number,
  distinctGamesPlayed: number,
  totalPlayDurationMs: number,
  maxPlayCount: number,
  hasHighScore: boolean,
  favoritesCount: number
): Omit<AchievementEvaluationContext, 'unlockedCount' | 'totalAchievements'> {
  return { totalPlays, distinctGamesPlayed, totalPlayDurationMs, maxPlayCount, hasHighScore, favoritesCount };
}

export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isUnlocked(state: AchievementsState, id: string): boolean {
  return !!state.unlocked[id];
}
