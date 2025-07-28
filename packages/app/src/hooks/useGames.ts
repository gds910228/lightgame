import { useState, useEffect } from 'react';
import { Game } from '../types';
import { getAllGames } from '../services/gameService';

export const useAllGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const data = await getAllGames();
        setGames(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch games:', err);
        setError('Failed to load games. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  return { games, loading, error };
}; 