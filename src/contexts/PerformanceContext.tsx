import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define interfaces for our performance data
interface BuildInfo {
  totalGames: number;
  totalSize: string;
  eagerLoad: number;
  lazyLoad: number;
}

interface RuntimeStats {
  gamesLoaded: number;
  avgLoadTime: number;
  errorRate: number;
}

interface PopularGame {
  id: string;
  plays: number;
}

interface PerformanceContextType {
  buildInfo: BuildInfo | null;
  runtimeStats: RuntimeStats;
  popularGames: PopularGame[];
  recordGameLoad: (loadTime: number) => void;
  recordGamePlay: (gameId: string) => void;
  recordLoadError: () => void;
  clearStats: () => void;
}

// Create the context with a default value
const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

// Define the provider component
export const PerformanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [runtimeStats, setRuntimeStats] = useState<RuntimeStats>({
    gamesLoaded: 0,
    avgLoadTime: 0,
    errorRate: 0,
  });
  const [popularGames, setPopularGames] = useState<PopularGame[]>([]);
  const [totalLoadTime, setTotalLoadTime] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Load initial data from localStorage and fetch actual game count
  useEffect(() => {
    try {
      const storedPlays = localStorage.getItem('popularGames');
      if (storedPlays) {
        setPopularGames(JSON.parse(storedPlays));
      }
    } catch (error) {
      console.error("Failed to parse popular games from localStorage", error);
      setPopularGames([]);
    }
    
    // Fetch actual game count from games.json
    const fetchGameCount = async () => {
      try {
        const response = await fetch('/games.json');
        const data = await response.json();
        const gameCount = data.games ? data.games.length : 8;
        setBuildInfo({
          totalGames: gameCount,
          totalSize: '2.1 MB', // More realistic size
          eagerLoad: gameCount,
          lazyLoad: 0,
        });
      } catch (error) {
        console.error('Failed to fetch games.json:', error);
        // Fallback to default values
        setBuildInfo({
          totalGames: 8,
          totalSize: '2.1 MB',
          eagerLoad: 8,
          lazyLoad: 0,
        });
      }
    };
    
    fetchGameCount();
  }, []);

  const recordGameLoad = useCallback((loadTime: number) => {
    setRuntimeStats(prevStats => {
        const newGamesLoaded = prevStats.gamesLoaded + 1;
        const newTotalLoadTime = totalLoadTime + loadTime;
        setTotalLoadTime(newTotalLoadTime);
        return {
            ...prevStats,
            gamesLoaded: newGamesLoaded,
            avgLoadTime: Math.round(newTotalLoadTime / newGamesLoaded),
            errorRate: (errorCount / (newGamesLoaded + errorCount)) * 100,
        };
    });
  }, [totalLoadTime, errorCount]);

  const recordGamePlay = useCallback((gameId: string) => {
    setPopularGames(prevGames => {
      const gameIndex = prevGames.findIndex(g => g.id === gameId);
      let newGames;
      if (gameIndex > -1) {
        newGames = [...prevGames];
        newGames[gameIndex] = { ...newGames[gameIndex], plays: newGames[gameIndex].plays + 1 };
      } else {
        newGames = [...prevGames, { id: gameId, plays: 1 }];
      }
      newGames.sort((a, b) => b.plays - a.plays);
      localStorage.setItem('popularGames', JSON.stringify(newGames));
      return newGames;
    });
  }, []);

  const recordLoadError = useCallback(() => {
    setErrorCount(prev => prev + 1);
    setRuntimeStats(prevStats => ({
        ...prevStats,
        errorRate: ((errorCount + 1) / (prevStats.gamesLoaded + errorCount + 1)) * 100,
    }));
  }, [errorCount]);

  const clearStats = useCallback(() => {
    setRuntimeStats({ gamesLoaded: 0, avgLoadTime: 0, errorRate: 0 });
    setPopularGames([]);
    setTotalLoadTime(0);
    setErrorCount(0);
    localStorage.removeItem('popularGames');
  }, []);

  const value = {
    buildInfo,
    runtimeStats,
    popularGames,
    recordGameLoad,
    recordGamePlay,
    recordLoadError,
    clearStats,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

// Custom hook to use the performance context
export const usePerformance = (): PerformanceContextType => {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};