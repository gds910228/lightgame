import React from 'react';
import { Link } from 'react-router-dom';
import { useAchievements } from '../contexts/AchievementsContext';
import { useProgress } from '../contexts/ProgressContext';
import { formatDuration, formatNumber, formatDate } from '../services/format';
import SEO from '../components/SEO';
import AchievementIcon from '../components/AchievementIcon';
import RecentlyPlayed from '../components/RecentlyPlayed';

const StatCard: React.FC<{ icon: string; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-dark-card rounded-xl p-4 border border-dark-border text-center">
    <i className={`${icon} ${color} text-2xl mb-2`}></i>
    <p className="text-white text-2xl font-bold">{value}</p>
    <p className="text-gray-500 text-sm">{label}</p>
  </div>
);

const AchievementsPage: React.FC = () => {
  const { definitions, unlocked, unlockedCount, totalCount, isUnlocked } = useAchievements();
  const { totalStats, getRecent } = useProgress();
  const recent = getRecent(8);

  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <SEO
        title="My Achievements - LightGame"
        description="Track your gaming progress, achievements, and stats on LightGame."
      />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <i className="fas fa-trophy text-neon-yellow"></i>
          My Achievements
        </h1>
        <p className="text-gray-400">Track your progress across all games</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="fas fa-gamepad" label="Games Played" value={formatNumber(totalStats.distinctGamesPlayed)} color="text-neon-blue" />
        <StatCard icon="fas fa-play" label="Total Plays" value={formatNumber(totalStats.totalPlays)} color="text-neon-green" />
        <StatCard icon="fas fa-clock" label="Total Time" value={formatDuration(totalStats.totalPlayDurationMs)} color="text-neon-purple" />
        <StatCard icon="fas fa-medal" label="Achievements" value={`${unlockedCount}/${totalCount}`} color="text-neon-yellow" />
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Completion</span>
          <span className="text-neon-yellow font-semibold">{progressPercent}%</span>
        </div>
        <div className="h-3 bg-dark-bg rounded-full overflow-hidden border border-dark-border">
          <div
            className="h-full bg-gradient-to-r from-neon-yellow to-neon-pink transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Recently Played */}
      {recent.length > 0 && <RecentlyPlayed />}

      {/* Achievement Grid */}
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <i className="fas fa-award text-neon-yellow"></i>
        All Achievements
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {definitions.map((def) => {
          const isDefUnlocked = isUnlocked(def.id);
          const unlockedAt = isDefUnlocked ? (unlocked[def.id]?.unlockedAt ?? 0) : 0;
          return (
            <div
              key={def.id}
              className={`rounded-xl p-4 border transition-all ${
                isDefUnlocked
                  ? 'bg-dark-card border-neon-yellow/40 shadow-lg shadow-neon-yellow/10'
                  : 'bg-dark-card/50 border-dark-border opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <AchievementIcon icon={def.icon} unlocked={isDefUnlocked} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className={`font-bold ${isDefUnlocked ? 'text-white' : 'text-gray-400'}`}>{def.title}</p>
                  <p className="text-sm text-gray-500">{def.description}</p>
                  {isDefUnlocked && (
                    <p className="text-xs text-neon-yellow mt-1">
                      <i className="fas fa-check-circle mr-1"></i>
                      Unlocked {formatDate(unlockedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      {totalStats.totalPlays === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">Start playing to unlock achievements!</p>
          <Link to="/" className="btn btn-primary inline-flex items-center">
            <i className="fas fa-play mr-2"></i>
            Browse Games
          </Link>
        </div>
      )}
    </div>
  );
};

export default AchievementsPage;
