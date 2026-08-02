import React from 'react';
import { useProgress } from '../contexts/ProgressContext';
import { formatDuration, formatScore, formatNumber, formatDate } from '../services/format';

interface GameProgressCardProps {
  gameId: string;
}

const StatItem: React.FC<{ label: string; value: string; icon: string; color: string }> = ({ label, value, icon, color }) => (
  <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
    <i className={`${icon} ${color} text-lg mb-1`}></i>
    <p className="text-gray-900 font-bold text-base">{value}</p>
    <p className="text-gray-600 text-xs font-medium">{label}</p>
  </div>
);

const GameProgressCard: React.FC<GameProgressCardProps> = ({ gameId }) => {
  const { getProgress } = useProgress();
  const progress = getProgress(gameId);

  if (!progress || progress.playCount === 0) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-dashed border-gray-300 text-center">
        <i className="fas fa-gamepad text-gray-400 text-2xl mb-2"></i>
        <p className="text-gray-600 text-sm">Haven't played yet. Hit play to start tracking!</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <i className="fas fa-chart-line text-primary-500"></i>
        Your Progress
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatItem label="Plays" value={formatNumber(progress.playCount)} icon="fas fa-play" color="text-primary-500" />
        <StatItem label="Time" value={formatDuration(progress.totalPlayDurationMs)} icon="fas fa-clock" color="text-green-600" />
        <StatItem label="Best Score" value={formatScore(progress.highScore)} icon="fas fa-trophy" color="text-amber-500" />
        <StatItem label="Last Played" value={formatDate(progress.lastPlayedAt)} icon="fas fa-calendar" color="text-purple-600" />
      </div>
    </div>
  );
};

export default GameProgressCard;
