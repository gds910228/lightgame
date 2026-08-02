import type { GameProgress, ProgressState, TotalStats, RecordScoreResult } from '../types';

export const PROGRESS_STORAGE_KEY = 'lightgame-progress';
export const PROGRESS_VERSION = 1;

export function defaultProgressState(): ProgressState {
  return { version: PROGRESS_VERSION, games: {} };
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isValidScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}
function sanitizeGameProgress(gameId: string, raw: unknown): GameProgress | null {
  if (!isObject(raw)) return null;
  const playCount = typeof raw.playCount === 'number' && raw.playCount >= 0 ? Math.floor(raw.playCount) : 0;
  const totalPlayDurationMs = typeof raw.totalPlayDurationMs === 'number' && raw.totalPlayDurationMs >= 0 ? raw.totalPlayDurationMs : 0;
  const highScore = isValidScore(raw.highScore) ? raw.highScore : null;
  const lastScore = isValidScore(raw.lastScore) ? raw.lastScore : null;
  const firstPlayedAt = typeof raw.firstPlayedAt === 'number' ? raw.firstPlayedAt : 0;
  const lastPlayedAt = typeof raw.lastPlayedAt === 'number' ? raw.lastPlayedAt : 0;
  const customProgress = isObject(raw.customProgress) ? raw.customProgress : null;
  if (!firstPlayedAt || !lastPlayedAt) return null;
  return { gameId, playCount, totalPlayDurationMs, highScore, lastScore, firstPlayedAt, lastPlayedAt, customProgress };
}
export function migrateProgress(raw: unknown): ProgressState {
  if (!isObject(raw) || raw.version !== PROGRESS_VERSION) return defaultProgressState();
  const games: Record<string, GameProgress> = {};
  if (isObject(raw.games)) {
    for (const [id, g] of Object.entries(raw.games)) {
      const p = sanitizeGameProgress(id, g);
      if (p) games[id] = p;
    }
  }
  return { version: PROGRESS_VERSION, games };
}
export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return defaultProgressState();
    return migrateProgress(JSON.parse(raw));
  } catch (err) {
    console.error('Error loading progress:', err);
    return defaultProgressState();
  }
}
export function saveProgress(state: ProgressState): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving progress:', err);
  }
}
export function startPlay(state: ProgressState, gameId: string, now: number): ProgressState {
  const existing = state.games[gameId];
  const game: GameProgress = existing
    ? { ...existing, playCount: existing.playCount + 1, lastPlayedAt: now }
    : { gameId, playCount: 1, totalPlayDurationMs: 0, highScore: null, lastScore: null, firstPlayedAt: now, lastPlayedAt: now, customProgress: null };
  return { ...state, games: { ...state.games, [gameId]: game } };
}
export function addDuration(state: ProgressState, gameId: string, ms: number): ProgressState {
  const existing = state.games[gameId];
  if (!existing || ms <= 0) return state;
  return { ...state, games: { ...state.games, [gameId]: { ...existing, totalPlayDurationMs: existing.totalPlayDurationMs + ms } } };
}
export function recordScore(state: ProgressState, gameId: string, score: number, now: number): { state: ProgressState; result: RecordScoreResult } {
  const existing = state.games[gameId];
  if (!existing) {
    const game: GameProgress = { gameId, playCount: 0, totalPlayDurationMs: 0, highScore: score, lastScore: score, firstPlayedAt: now, lastPlayedAt: now, customProgress: null };
    return { state: { ...state, games: { ...state.games, [gameId]: game } }, result: { isNewHighScore: true, highScore: score } };
  }
  const isNewHighScore = existing.highScore === null || score > existing.highScore;
  const game: GameProgress = { ...existing, lastScore: score, highScore: isNewHighScore ? score : existing.highScore, lastPlayedAt: now };
  return { state: { ...state, games: { ...state.games, [gameId]: game } }, result: { isNewHighScore, highScore: game.highScore as number } };
}
export function mergeCustomProgress(state: ProgressState, gameId: string, data: Record<string, unknown>): ProgressState {
  const existing = state.games[gameId];
  if (!existing) return state;
  return { ...state, games: { ...state.games, [gameId]: { ...existing, customProgress: { ...(existing.customProgress || {}), ...data } } } };
}
export function getRecentGames(state: ProgressState, limit: number): GameProgress[] {
  return Object.values(state.games).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).slice(0, limit);
}
export function getTotalStats(state: ProgressState): TotalStats {
  const games = Object.values(state.games);
  return {
    totalPlays: games.reduce((s, g) => s + g.playCount, 0),
    distinctGamesPlayed: games.length,
    totalPlayDurationMs: games.reduce((s, g) => s + g.totalPlayDurationMs, 0),
  };
}
export function getMaxPlayCount(state: ProgressState): number {
  return Object.values(state.games).reduce((m, g) => Math.max(m, g.playCount), 0);
}
export function hasAnyHighScore(state: ProgressState): boolean {
  return Object.values(state.games).some(g => g.highScore !== null && g.highScore > 0);
}
