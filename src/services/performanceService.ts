/**
 * Performance Monitoring Service
 * 
 * Tracks game loading performance, user interactions, and system metrics
 */

interface GameLoadMetrics {
  gameId: string;
  loadStartTime: number;
  loadEndTime?: number;
  loadDuration?: number;
  fileSize?: number;
  errorCount: number;
  retryCount: number;
}

interface PerformanceMetrics {
  totalGamesLoaded: number;
  averageLoadTime: number;
  totalErrors: number;
  popularGames: { [gameId: string]: number };
  loadingPatterns: GameLoadMetrics[];
}

class PerformanceService {
  private metrics: PerformanceMetrics;
  private currentLoads: Map<string, GameLoadMetrics>;
  private readonly STORAGE_KEY = 'lightgame_performance_metrics';

  constructor() {
    this.metrics = this.loadMetrics();
    this.currentLoads = new Map();
  }

  /**
   * Load metrics from localStorage
   */
  private loadMetrics(): PerformanceMetrics {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load performance metrics:', error);
    }

    return {
      totalGamesLoaded: 0,
      averageLoadTime: 0,
      totalErrors: 0,
      popularGames: {},
      loadingPatterns: []
    };
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Failed to save performance metrics:', error);
    }
  }

  /**
   * Start tracking game load
   */
  startGameLoad(gameId: string, fileSize?: number): void {
    const loadMetric: GameLoadMetrics = {
      gameId,
      loadStartTime: performance.now(),
      fileSize,
      errorCount: 0,
      retryCount: 0
    };

    this.currentLoads.set(gameId, loadMetric);
    
    // Track game popularity
    this.metrics.popularGames[gameId] = (this.metrics.popularGames[gameId] || 0) + 1;
  }

  /**
   * Complete game load tracking
   */
  completeGameLoad(gameId: string): void {
    const loadMetric = this.currentLoads.get(gameId);
    if (!loadMetric) return;

    loadMetric.loadEndTime = performance.now();
    loadMetric.loadDuration = loadMetric.loadEndTime - loadMetric.loadStartTime;

    // Update global metrics
    this.metrics.totalGamesLoaded++;
    this.updateAverageLoadTime(loadMetric.loadDuration);
    
    // Store loading pattern (keep last 100 loads)
    this.metrics.loadingPatterns.push(loadMetric);
    if (this.metrics.loadingPatterns.length > 100) {
      this.metrics.loadingPatterns.shift();
    }

    this.currentLoads.delete(gameId);
    this.saveMetrics();

    console.log(`Game ${gameId} loaded in ${loadMetric.loadDuration.toFixed(2)}ms`);
  }

  /**
   * Record game load error
   */
  recordGameError(gameId: string, error: string): void {
    const loadMetric = this.currentLoads.get(gameId);
    if (loadMetric) {
      loadMetric.errorCount++;
    }

    this.metrics.totalErrors++;
    this.saveMetrics();

    console.error(`Game ${gameId} error:`, error);
  }

  /**
   * Record game load retry
   */
  recordGameRetry(gameId: string): void {
    const loadMetric = this.currentLoads.get(gameId);
    if (loadMetric) {
      loadMetric.retryCount++;
    }
  }

  /**
   * Update average load time
   */
  private updateAverageLoadTime(newLoadTime: number): void {
    const totalTime = this.metrics.averageLoadTime * (this.metrics.totalGamesLoaded - 1);
    this.metrics.averageLoadTime = (totalTime + newLoadTime) / this.metrics.totalGamesLoaded;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const recentLoads = this.metrics.loadingPatterns.slice(-10);
    const recentAverageTime = recentLoads.length > 0 
      ? recentLoads.reduce((sum, load) => sum + (load.loadDuration || 0), 0) / recentLoads.length
      : 0;

    return {
      totalGamesLoaded: this.metrics.totalGamesLoaded,
      averageLoadTime: Math.round(this.metrics.averageLoadTime),
      recentAverageTime: Math.round(recentAverageTime),
      totalErrors: this.metrics.totalErrors,
      errorRate: this.metrics.totalGamesLoaded > 0 
        ? (this.metrics.totalErrors / this.metrics.totalGamesLoaded * 100).toFixed(1)
        : '0',
      popularGames: Object.entries(this.metrics.popularGames)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([gameId, count]) => ({ gameId, count }))
    };
  }

  /**
   * Get detailed analytics
   */
  getDetailedAnalytics() {
    const loadTimes = this.metrics.loadingPatterns
      .filter(load => load.loadDuration !== undefined)
      .map(load => load.loadDuration!);

    const fileSizes = this.metrics.loadingPatterns
      .filter(load => load.fileSize !== undefined)
      .map(load => load.fileSize!);

    return {
      summary: this.getPerformanceSummary(),
      loadTimeDistribution: {
        min: loadTimes.length > 0 ? Math.min(...loadTimes) : 0,
        max: loadTimes.length > 0 ? Math.max(...loadTimes) : 0,
        median: this.calculateMedian(loadTimes),
        p95: this.calculatePercentile(loadTimes, 95)
      },
      fileSizeAnalysis: {
        averageSize: fileSizes.length > 0 
          ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length
          : 0,
        totalSize: fileSizes.reduce((sum, size) => sum + size, 0)
      },
      trends: this.calculateTrends()
    };
  }

  /**
   * Calculate median value
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends() {
    const recentLoads = this.metrics.loadingPatterns.slice(-20);
    const olderLoads = this.metrics.loadingPatterns.slice(-40, -20);

    const recentAvg = recentLoads.length > 0
      ? recentLoads.reduce((sum, load) => sum + (load.loadDuration || 0), 0) / recentLoads.length
      : 0;

    const olderAvg = olderLoads.length > 0
      ? olderLoads.reduce((sum, load) => sum + (load.loadDuration || 0), 0) / olderLoads.length
      : 0;

    return {
      loadTimeImprovement: olderAvg > 0 ? ((olderAvg - recentAvg) / olderAvg * 100).toFixed(1) : '0',
      isImproving: recentAvg < olderAvg,
      recentErrorRate: recentLoads.length > 0
        ? (recentLoads.filter(load => load.errorCount > 0).length / recentLoads.length * 100).toFixed(1)
        : '0'
    };
  }

  /**
   * Clear all metrics (for testing/reset)
   */
  clearMetrics(): void {
    this.metrics = {
      totalGamesLoaded: 0,
      averageLoadTime: 0,
      totalErrors: 0,
      popularGames: {},
      loadingPatterns: []
    };
    this.currentLoads.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();
export default performanceService;