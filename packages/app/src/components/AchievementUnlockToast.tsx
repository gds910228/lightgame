import React, { useEffect, useRef } from 'react';
import { useAchievements } from '../contexts/AchievementsContext';
import { getAchievementById } from '../services/achievementEngine';
import AchievementIcon from './AchievementIcon';

const AUTO_DISMISS_MS = 4000;

const AchievementUnlockToast: React.FC = () => {
  const { queue, dismissUnlock } = useAchievements();
  const current = queue[0];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!current) return;
    timerRef.current = setTimeout(() => {
      dismissUnlock(current.id);
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, dismissUnlock]);

  if (!current) return null;

  const def = getAchievementById(current.id);
  if (!def) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] pointer-events-none">
      <div className="animate-slide-in bg-dark-card/95 backdrop-blur-md border-2 border-neon-yellow/50 rounded-xl px-5 py-4 shadow-2xl shadow-neon-yellow/20 flex items-center gap-4 min-w-[280px] max-w-[90vw]">
        <AchievementIcon icon={def.icon} unlocked size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-neon-yellow text-xs font-semibold uppercase tracking-wider">Achievement Unlocked!</p>
          <p className="text-white font-bold text-base truncate">{def.title}</p>
          <p className="text-gray-400 text-sm truncate">{def.description}</p>
        </div>
        <button
          onClick={() => dismissUnlock(current.id)}
          className="text-gray-400 hover:text-white transition-colors pointer-events-auto p-1"
          aria-label="Dismiss"
        >
          <i className="fas fa-times text-lg"></i>
        </button>
      </div>
    </div>
  );
};

export default AchievementUnlockToast;
