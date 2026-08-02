import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import type { AchievementsState, UnlockedAchievement, AchievementDefinition } from '../types';
import { loadAchievements, saveAchievements } from '../services/achievementStorage';
import { ACHIEVEMENTS } from '../services/achievementDefinitions';
import { evaluateAchievements } from '../services/achievementEngine';
import { hasAnyHighScore } from '../services/progressStorage';
import { useProgress } from './ProgressContext';
import { useFavorites } from './FavoritesContext';

interface AchievementsContextType {
  definitions: AchievementDefinition[];
  unlocked: Record<string, { unlockedAt: number }>;
  unlockedCount: number;
  totalCount: number;
  queue: UnlockedAchievement[];
  dismissUnlock: (id: string) => void;
  isUnlocked: (id: string) => boolean;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

const MAX_QUEUE = 5;

export const AchievementsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { progress, totalStats, maxPlayCount } = useProgress();
  const { favorites } = useFavorites();
  const [state, setState] = useState<AchievementsState>(() => loadAchievements());
  const [queue, setQueue] = useState<UnlockedAchievement[]>([]);
  const unlockedRef = useRef(state.unlocked);
  unlockedRef.current = state.unlocked;

  // Persist on change
  useEffect(() => {
    saveAchievements(state);
  }, [state]);

  // Evaluate achievements whenever progress or favorites change
  useEffect(() => {
    const ctx = {
      totalPlays: totalStats.totalPlays,
      distinctGamesPlayed: totalStats.distinctGamesPlayed,
      totalPlayDurationMs: totalStats.totalPlayDurationMs,
      maxPlayCount,
      hasHighScore: hasAnyHighScore(progress),
      favoritesCount: favorites.length,
    };
    const result = evaluateAchievements(ctx, unlockedRef.current, Date.now());
    if (result.newlyUnlocked.length > 0) {
      setState((prev) => ({ ...prev, unlocked: result.next }));
      setQueue((prev) => {
        const combined = [...prev, ...result.newlyUnlocked];
        return combined.slice(-MAX_QUEUE);
      });
    }
  }, [totalStats, maxPlayCount, progress, favorites]);

  const dismissUnlock = useCallback((id: string) => {
    setQueue((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const isUnlocked = useCallback((id: string) => !!state.unlocked[id], [state]);

  const unlockedCount = useMemo(() => Object.keys(state.unlocked).length, [state]);

  const value = useMemo<AchievementsContextType>(() => ({
    definitions: ACHIEVEMENTS,
    unlocked: state.unlocked,
    unlockedCount,
    totalCount: ACHIEVEMENTS.length,
    queue,
    dismissUnlock,
    isUnlocked,
  }), [state.unlocked, unlockedCount, queue, dismissUnlock, isUnlocked]);

  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
};

export const useAchievements = (): AchievementsContextType => {
  const ctx = useContext(AchievementsContext);
  if (!ctx) throw new Error('useAchievements must be used within an AchievementsProvider');
  return ctx;
};
