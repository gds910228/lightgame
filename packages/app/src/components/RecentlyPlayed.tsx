import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgress } from '../contexts/ProgressContext';
import { getAllGames } from '../services/gameService';
import { formatDuration } from '../services/format';
import type { Game } from '../types';

const RecentlyPlayed: React.FC = () => {
  const { getRecent } = useProgress();
  const [games, setGames] = useState<Game[]>([]);
  const recent = getRecent(8);

  useEffect(() => {
    let active = true;
    getAllGames().then((all) => {
      if (active) setGames(all);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (recent.length === 0) return null;

  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <i className="fas fa-history text-neon-blue"></i>
        Recently Played
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {recent.map((p) => {
          const game = gameMap.get(p.gameId);
          return (
            <Link
              key={p.gameId}
              to={`/game/${p.gameId}`}
              className="bg-dark-card rounded-lg overflow-hidden border border-dark-border hover:border-neon-blue/50 transition-all group"
            >
              <div className="relative h-20 bg-dark-bg">
                {game?.image && (
                  <img src={game.image} alt={game.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-card to-transparent"></div>
              </div>
              <div className="p-2">
                <p className="text-white text-sm font-medium truncate group-hover:text-neon-blue transition-colors">
                  {game?.title || p.gameId}
                </p>
                <p className="text-gray-500 text-xs">
                  {p.playCount} plays · {formatDuration(p.totalPlayDurationMs)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecentlyPlayed;
