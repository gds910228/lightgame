import React, { useState, useEffect } from 'react';
import performanceService from '../services/performanceService';

interface PerformanceStats {
  totalGamesLoaded: number;
  averageLoadTime: number;
  recentAverageTime: number;
  totalErrors: number;
  errorRate: string;
  popularGames: Array<{ gameId: string; count: number }>;
}

interface BuildInfo {
  totalGames: number;
  totalSize: string;
  eagerLoadGames: number;
  lazyLoadGames: number;
  optimization?: {
    totalSavings: string;
    compressionRatio: number;
  };
}

const PerformanceDashboard: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadPerformanceData();
    loadBuildInfo();
  }, []);

  const loadPerformanceData = () => {
    const performanceStats = performanceService.getPerformanceSummary();
    setStats(performanceStats);
  };

  const loadBuildInfo = async () => {
    try {
      const response = await fetch('/build-summary.json');
      if (response.ok) {
        const data = await response.json();
        setBuildInfo({
          totalGames: data.games.total,
          totalSize: data.games.formattedTotalSize,
          eagerLoadGames: data.performance.eagerLoadGames,
          lazyLoadGames: data.performance.lazyLoadGames,
          optimization: data.optimization ? {
            totalSavings: data.optimization.formattedSavings,
            compressionRatio: data.optimization.compressionRatio
          } : undefined
        });
      }
    } catch (error) {
      console.log('Build summary not available:', error);
    }
  };

  const clearStats = () => {
    performanceService.clearMetrics();
    loadPerformanceData();
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
        title="Show Performance Dashboard"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-96 overflow-y-auto z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-900">Performance Dashboard</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Build Information */}
        {buildInfo && (
          <div className="bg-blue-50 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 mb-2">Build Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-blue-700">Total Games:</span>
                <span className="ml-2 font-medium">{buildInfo.totalGames}</span>
              </div>
              <div>
                <span className="text-blue-700">Total Size:</span>
                <span className="ml-2 font-medium">{buildInfo.totalSize}</span>
              </div>
              <div>
                <span className="text-blue-700">Eager Load:</span>
                <span className="ml-2 font-medium">{buildInfo.eagerLoadGames}</span>
              </div>
              <div>
                <span className="text-blue-700">Lazy Load:</span>
                <span className="ml-2 font-medium">{buildInfo.lazyLoadGames}</span>
              </div>
              {buildInfo.optimization && (
                <>
                  <div>
                    <span className="text-blue-700">Savings:</span>
                    <span className="ml-2 font-medium">{buildInfo.optimization.totalSavings}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Compression:</span>
                    <span className="ml-2 font-medium">{(buildInfo.optimization.compressionRatio * 100).toFixed(1)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Runtime Performance */}
        {stats && (
          <div className="bg-green-50 rounded-lg p-3">
            <h4 className="font-medium text-green-900 mb-2">Runtime Performance</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Games Loaded:</span>
                <span className="font-medium">{stats.totalGamesLoaded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Avg Load Time:</span>
                <span className="font-medium">{stats.averageLoadTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Recent Avg:</span>
                <span className="font-medium">{stats.recentAverageTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Error Rate:</span>
                <span className="font-medium">{stats.errorRate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Popular Games */}
        {stats && stats.popularGames.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-3">
            <h4 className="font-medium text-purple-900 mb-2">Popular Games</h4>
            <div className="space-y-1 text-sm">
              {stats.popularGames.slice(0, 3).map((game, index) => (
                <div key={game.gameId} className="flex justify-between">
                  <span className="text-purple-700">{index + 1}. {game.gameId}</span>
                  <span className="font-medium">{game.count} plays</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Indicators */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-yellow-50 rounded-lg p-2 text-center">
            <div className="text-yellow-800 text-xs font-medium">Load Performance</div>
            <div className="text-lg font-bold text-yellow-900">
              {stats && stats.recentAverageTime < 2000 ? '🟢' : stats && stats.recentAverageTime < 5000 ? '🟡' : '🔴'}
            </div>
            <div className="text-xs text-yellow-700">
              {stats && stats.recentAverageTime < 2000 ? 'Excellent' : stats && stats.recentAverageTime < 5000 ? 'Good' : 'Needs Work'}
            </div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <div className="text-red-800 text-xs font-medium">Error Rate</div>
            <div className="text-lg font-bold text-red-900">
              {stats && parseFloat(stats.errorRate) < 5 ? '🟢' : stats && parseFloat(stats.errorRate) < 15 ? '🟡' : '🔴'}
            </div>
            <div className="text-xs text-red-700">
              {stats && parseFloat(stats.errorRate) < 5 ? 'Low' : stats && parseFloat(stats.errorRate) < 15 ? 'Medium' : 'High'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <button
            onClick={loadPerformanceData}
            className="flex-1 bg-blue-600 text-white text-sm py-2 px-3 rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={clearStats}
            className="flex-1 bg-gray-600 text-white text-sm py-2 px-3 rounded hover:bg-gray-700 transition-colors"
          >
            Clear Stats
          </button>
        </div>

        {/* Optimization Tips */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="font-medium text-gray-900 mb-2">💡 Tips</h4>
          <ul className="text-xs text-gray-700 space-y-1">
            <li>• Games under 1MB load instantly</li>
            <li>• Large games use lazy loading automatically</li>
            <li>• Performance data helps optimize user experience</li>
            <li>• Check build summary for optimization opportunities</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;