import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import type { ProgressState, GameProgress, TotalStats, RecordScoreResult, PlaySession } from '../types';
import {
  loadProgress,
  saveProgress,
  startPlay as startPlayReducer,
  addDuration as addDurationReducer,
  recordScore as recordScoreReducer,
  mergeCustomProgress,
  getRecentGames,
  getTotalStats,
  getMaxPlayCount,
} from '../services/progressStorage';

interface ProgressContextType {
  progress: ProgressState;
  totalStats: TotalStats;
  maxPlayCount: number;
  recordPlayStart: (gameId: string) => void;
  recordPlayEnd: () => void;
  flushSession: () => void;
  recordScore: (gameId: string, score: number) => RecordScoreResult;
  recordProgress: (gameId: string, data: Record<string, unknown>) => void;
  recordEvent: (gameId: string, event: string, data?: Record<string, unknown>) => void;
  getProgress: (gameId: string) => GameProgress | undefined;
  getRecent: (limit?: number) => GameProgress[];
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

const FLUSH_INTERVAL_MS = 30_000;

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const sessionRef = useRef<PlaySession | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to the latest state so synchronous reporters (e.g. recordScore) can
  // compute and return a result without depending on when the state updater runs.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Persist on change
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const clearFlushInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const recordPlayStart = useCallback((gameId: string) => {
    const now = Date.now();
    // End previous session if any
    if (sessionRef.current) {
      const elapsed = now - sessionRef.current.lastFlushAt;
      if (elapsed > 0) {
        setProgress((prev) => addDurationReducer(prev, sessionRef.current!.gameId, elapsed));
      }
    }
    sessionRef.current = { gameId, startAt: now, lastFlushAt: now };
    setProgress((prev) => startPlayReducer(prev, gameId, now));

    clearFlushInterval();
    intervalRef.current = setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      // Don't accrue background time
      if (document.hidden) {
        sessionRef.current = { ...session, lastFlushAt: Date.now() };
        return;
      }
      const tick = Date.now();
      const elapsed = tick - session.lastFlushAt;
      if (elapsed > 0) {
        setProgress((prev) => addDurationReducer(prev, session.gameId, elapsed));
        sessionRef.current = { ...session, lastFlushAt: tick };
      }
    }, FLUSH_INTERVAL_MS);
  }, [clearFlushInterval]);

  const flushSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const now = Date.now();
    const elapsed = now - session.lastFlushAt;
    if (elapsed > 0) {
      setProgress((prev) => addDurationReducer(prev, session.gameId, elapsed));
      sessionRef.current = { ...session, lastFlushAt: now };
    }
  }, []);

  const recordPlayEnd = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const now = Date.now();
    const elapsed = now - session.lastFlushAt;
    if (elapsed > 0) {
      setProgress((prev) => addDurationReducer(prev, session.gameId, elapsed));
    }
    sessionRef.current = null;
    clearFlushInterval();
  }, [clearFlushInterval]);

  const recordScore = useCallback((gameId: string, score: number): RecordScoreResult => {
    const now = Date.now();
    // Compute synchronously against the latest state so the caller gets a reliable result.
    const { state, result } = recordScoreReducer(progressRef.current, gameId, score, now);
    setProgress(state);
    return result;
  }, []);

  const recordProgress = useCallback((gameId: string, data: Record<string, unknown>) => {
    setProgress((prev) => mergeCustomProgress(prev, gameId, data));
  }, []);

  const recordEvent = useCallback((gameId: string, event: string, data?: Record<string, unknown>) => {
    setProgress((prev) => mergeCustomProgress(prev, gameId, { lastEvent: event, lastEventAt: Date.now(), ...(data || {}) }));
  }, []);

  const getProgress = useCallback((gameId: string) => progress.games[gameId], [progress]);

  const getRecent = useCallback((limit = 8) => getRecentGames(progress, limit), [progress]);

  const resetProgress = useCallback(() => {
    sessionRef.current = null;
    clearFlushInterval();
    setProgress({ version: 1, games: {} });
  }, [clearFlushInterval]);

  // Reset session clock (without accruing duration) — used when returning to foreground
  const resetSessionClock = useCallback(() => {
    const session = sessionRef.current;
    if (session) {
      sessionRef.current = { ...session, lastFlushAt: Date.now() };
    }
  }, []);

  // Flush duration synchronously to localStorage (for beforeunload).
  // Use progressRef (latest in-memory state) rather than loadProgress() to avoid
  // losing updates (e.g. a score) that were setState but not yet persisted by the effect.
  const flushSync = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const now = Date.now();
    const elapsed = now - session.lastFlushAt;
    if (elapsed > 0) {
      saveProgress(addDurationReducer(progressRef.current, session.gameId, elapsed));
      sessionRef.current = { ...session, lastFlushAt: now };
    }
  }, []);

  // Visibility & unmount handling: don't accrue background time, don't lose in-flight time
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        flushSession();
      } else {
        resetSessionClock();
      }
    };
    const handleBeforeUnload = () => {
      flushSync();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushSession, resetSessionClock, flushSync]);

  // Flush on unmount (use latest in-memory state, not stale localStorage)
  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (session) {
        const elapsed = Date.now() - session.lastFlushAt;
        if (elapsed > 0) {
          saveProgress(addDurationReducer(progressRef.current, session.gameId, elapsed));
        }
      }
      clearFlushInterval();
    };
  }, [clearFlushInterval]);

  const totalStats = useMemo(() => getTotalStats(progress), [progress]);
  const maxPlayCount = useMemo(() => getMaxPlayCount(progress), [progress]);

  const value = useMemo<ProgressContextType>(() => ({
    progress,
    totalStats,
    maxPlayCount,
    recordPlayStart,
    recordPlayEnd,
    flushSession,
    recordScore,
    recordProgress,
    recordEvent,
    getProgress,
    getRecent,
    resetProgress,
  }), [progress, totalStats, maxPlayCount, recordPlayStart, recordPlayEnd, flushSession, recordScore, recordProgress, recordEvent, getProgress, getRecent, resetProgress]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
};

export const useProgress = (): ProgressContextType => {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within a ProgressProvider');
  return ctx;
};
