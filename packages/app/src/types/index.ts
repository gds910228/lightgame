export interface Game {
  id: string;
  title: string;
  category: string | string[];
  image: string;
  description: string;
  controls: string;
  path: string;
  tags: string[];
}
export interface GamesData { games: Game[]; }
export interface GameProgress {
  gameId: string;
  playCount: number;
  totalPlayDurationMs: number;
  highScore: number | null;
  lastScore: number | null;
  firstPlayedAt: number;
  lastPlayedAt: number;
  customProgress: Record<string, unknown> | null;
}
export interface ProgressState { version: 1; games: Record<string, GameProgress>; }
export interface TotalStats { totalPlays: number; distinctGamesPlayed: number; totalPlayDurationMs: number; }
export interface RecordScoreResult { isNewHighScore: boolean; highScore: number; }
export interface PlaySession { gameId: string; startAt: number; lastFlushAt: number; }
export type AchievementCategory = 'play' | 'duration' | 'collection' | 'score' | 'meta';
export interface AchievementEvaluationContext {
  totalPlays: number; distinctGamesPlayed: number; totalPlayDurationMs: number;
  maxPlayCount: number; hasHighScore: boolean; favoritesCount: number;
  unlockedCount: number; totalAchievements: number;
}
export interface AchievementDefinition {
  id: string; title: string; description: string; icon: string;
  category: AchievementCategory; isMeta?: boolean;
  evaluate: (ctx: AchievementEvaluationContext) => boolean;
}
export interface UnlockedAchievement { id: string; unlockedAt: number; }
export interface AchievementsState { version: 1; unlocked: Record<string, { unlockedAt: number }>; }
export type LightGameReportPayload =
  | { kind: 'score'; score: number; label?: string }
  | { kind: 'progress'; data: Record<string, unknown> }
  | { kind: 'gameOver'; score?: number; progress?: Record<string, unknown> }
  | { kind: 'complete'; score?: number }
  | { kind: 'event'; event: string; data?: Record<string, unknown> };
export interface LightGameReportMessage { source: 'lightgame'; type: 'lightgame:report'; payload: LightGameReportPayload; }
export interface LightGameReadyMessage { source: 'lightgame'; type: 'lightgame:ready'; gameId: string; v: 1; }
