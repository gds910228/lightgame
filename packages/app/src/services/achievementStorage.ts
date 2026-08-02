import type { AchievementsState } from '../types';

export const ACHIEVEMENTS_STORAGE_KEY = 'lightgame-achievements';
export const ACHIEVEMENTS_VERSION = 1;

export function defaultAchievementsState(): AchievementsState {
  return { version: ACHIEVEMENTS_VERSION, unlocked: {} };
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export function migrateAchievements(raw: unknown): AchievementsState {
  if (!isObject(raw) || raw.version !== ACHIEVEMENTS_VERSION) return defaultAchievementsState();
  const unlocked: Record<string, { unlockedAt: number }> = {};
  if (isObject(raw.unlocked)) {
    for (const [id, val] of Object.entries(raw.unlocked)) {
      if (isObject(val) && typeof val.unlockedAt === 'number') {
        unlocked[id] = { unlockedAt: val.unlockedAt };
      }
    }
  }
  return { version: ACHIEVEMENTS_VERSION, unlocked };
}
export function loadAchievements(): AchievementsState {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return defaultAchievementsState();
    return migrateAchievements(JSON.parse(raw));
  } catch (err) {
    console.error('Error loading achievements:', err);
    return defaultAchievementsState();
  }
}
export function saveAchievements(state: AchievementsState): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving achievements:', err);
  }
}
