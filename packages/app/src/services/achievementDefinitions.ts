import type { AchievementDefinition } from '../types';

export const THIRTY_MINUTES_MS = 30 * 60 * 1000;
export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-play',
    title: 'First Steps',
    description: 'Play your first game',
    icon: '🎮',
    category: 'play',
    evaluate: (ctx) => ctx.totalPlays >= 1,
  },
  {
    id: 'explorer-5',
    title: 'Explorer',
    description: 'Play 5 different games',
    icon: '🗺️',
    category: 'play',
    evaluate: (ctx) => ctx.distinctGamesPlayed >= 5,
  },
  {
    id: 'explorer-10',
    title: 'Adventurer',
    description: 'Play 10 different games',
    icon: '🧭',
    category: 'play',
    evaluate: (ctx) => ctx.distinctGamesPlayed >= 10,
  },
  {
    id: 'explorer-20',
    title: 'World Traveler',
    description: 'Play 20 different games',
    icon: '🌍',
    category: 'play',
    evaluate: (ctx) => ctx.distinctGamesPlayed >= 20,
  },
  {
    id: 'playtime-30m',
    title: 'Half Hour Hero',
    description: 'Play for 30 minutes total',
    icon: '⏱️',
    category: 'duration',
    evaluate: (ctx) => ctx.totalPlayDurationMs >= THIRTY_MINUTES_MS,
  },
  {
    id: 'playtime-2h',
    title: 'Marathon Player',
    description: 'Play for 2 hours total',
    icon: '⏰',
    category: 'duration',
    evaluate: (ctx) => ctx.totalPlayDurationMs >= TWO_HOURS_MS,
  },
  {
    id: 'first-favorite',
    title: 'First Love',
    description: 'Favorite your first game',
    icon: '⭐',
    category: 'collection',
    evaluate: (ctx) => ctx.favoritesCount >= 1,
  },
  {
    id: 'collector-5',
    title: 'Collector',
    description: 'Favorite 5 games',
    icon: '💖',
    category: 'collection',
    evaluate: (ctx) => ctx.favoritesCount >= 5,
  },
  {
    id: 'dedication-10',
    title: 'Devoted',
    description: 'Play one game 10 times',
    icon: '🔥',
    category: 'play',
    evaluate: (ctx) => ctx.maxPlayCount >= 10,
  },
  {
    id: 'dedication-50',
    title: 'True Fan',
    description: 'Play one game 50 times',
    icon: '💎',
    category: 'play',
    evaluate: (ctx) => ctx.maxPlayCount >= 50,
  },
  {
    id: 'record-breaker',
    title: 'Record Breaker',
    description: 'Set a high score in any game',
    icon: '🏆',
    category: 'score',
    evaluate: (ctx) => ctx.hasHighScore,
  },
  {
    id: 'completionist',
    title: 'Completionist',
    description: 'Unlock all other achievements',
    icon: '👑',
    category: 'meta',
    isMeta: true,
    evaluate: (ctx) => ctx.unlockedCount >= ctx.totalAchievements - 1,
  },
];

export function getTotalAchievementCount(): number {
  return ACHIEVEMENTS.length;
}
