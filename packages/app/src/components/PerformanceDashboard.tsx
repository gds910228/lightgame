import React from 'react';
import styles from './PerformanceDashboard.module.css';
import { usePerformance } from '../contexts/PerformanceContext';

interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ isOpen, onClose }) => {
  const { buildInfo, runtimeStats, popularGames, clearStats } = usePerformance();

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.dashboard} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <h2>Performance Dashboard</h2>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.content}>
          {/* Build Information */}
          {buildInfo && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Build Information</h3>
              <div className={styles.grid}>
                <div>Total Games: {buildInfo.totalGames}</div>
                <div>Total Size: {buildInfo.totalSize}</div>
                <div>Eager Load: {buildInfo.eagerLoad}</div>
                <div>Lazy Load: {buildInfo.lazyLoad}</div>
              </div>
            </div>
          )}

          {/* Runtime Performance */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Runtime Performance</h3>
            <div className={styles.grid}>
              <div>Games Loaded: {runtimeStats.gamesLoaded}</div>
              <div>Avg Load Time: {runtimeStats.avgLoadTime}ms</div>
              <div>Error Rate: {runtimeStats.errorRate.toFixed(1)}%</div>
            </div>
          </div>

          {/* Popular Games */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Popular Games</h3>
            <ul>
              {popularGames.slice(0, 5).map((game, index) => (
                <li key={game.id}>
                  {index + 1}. {game.id} <span>{game.plays} plays</span>
                </li>
              ))}
              {popularGames.length === 0 && <li>No games played yet.</li>}
            </ul>
          </div>

          {/* Buttons */}
          <div className={styles.buttonGroup}>
            <button className={styles.button} onClick={() => window.location.reload()}>Refresh</button>
            <button className={`${styles.button} ${styles.secondary}`} onClick={clearStats}>Clear Stats</button>
          </div>

          {/* Tips */}
          <div className={`${styles.section} ${styles.tips}`}>
            <h3 className={styles.sectionTitle}>💡 Tips</h3>
            <ul>
              <li>Games under 1MB load instantly</li>
              <li>Large games use lazy loading automatically</li>
              <li>Performance data helps optimize user experience</li>
              <li>Check build summary for optimization opportunities</li>
            </ul>
          </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
