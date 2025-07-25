/**
 * Integrated Build Script with Optimization
 * 
 * This script combines all optimization features:
 * 1. Asset optimization and compression
 * 2. Game manifest generation
 * 3. Performance monitoring setup
 * 4. Build size analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runOptimization } from './asset-optimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  gamesDir: path.join(__dirname, '..', 'games'),
  publicDir: path.join(__dirname, '..', 'public'),
  outputDir: path.join(__dirname, '..', 'public', 'games'),
  manifestFile: path.join(__dirname, '..', 'public', 'games.json'),
  optimizationReport: path.join(__dirname, '..', 'public', 'optimization-report.json')
};

/**
 * Utility functions
 */
const utils = {
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    function calculateSize(currentPath) {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          calculateSize(fullPath);
        } else {
          try {
            totalSize += fs.statSync(fullPath).size;
          } catch (error) {
            // Skip files that can't be accessed
          }
        }
      }
    }
    
    try {
      calculateSize(dirPath);
    } catch (error) {
      console.warn(`Warning: Could not calculate size for ${dirPath}`);
    }
    
    return totalSize;
  }
};

/**
 * Enhanced game manifest generation with optimization data
 */
async function generateEnhancedManifest() {
  console.log('📋 Generating enhanced game manifest...');
  
  const games = [];
  const gameDirs = fs.readdirSync(CONFIG.gamesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  // Load optimization report if available
  let optimizationData = {};
  if (fs.existsSync(CONFIG.optimizationReport)) {
    try {
      const report = JSON.parse(fs.readFileSync(CONFIG.optimizationReport, 'utf8'));
      optimizationData = report.gameResults.reduce((acc, game) => {
        acc[game.gameId] = game;
        return acc;
      }, {});
    } catch (error) {
      console.warn('Could not load optimization report:', error.message);
    }
  }

  for (const gameDir of gameDirs) {
    const metadataPath = path.join(CONFIG.gamesDir, gameDir, 'metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const gameOutputDir = path.join(CONFIG.outputDir, gameDir);
        
        // Calculate actual output size
        const actualSize = fs.existsSync(gameOutputDir) 
          ? utils.getDirectorySize(gameOutputDir) 
          : 0;

        // Enhanced game object with optimization data
        const enhancedGame = {
          ...metadata,
          path: `/games/${gameDir}/index.html`,
          
          // Performance data
          performance: {
            size: actualSize,
            formattedSize: utils.formatBytes(actualSize),
            loadingStrategy: actualSize > 5 * 1024 * 1024 ? 'lazy' : 'eager',
            priority: actualSize < 1024 * 1024 ? 'high' : 'normal',
            preload: actualSize < 500 * 1024 // Preload small games
          },
          
          // Optimization data if available
          ...(optimizationData[gameDir] && {
            optimization: {
              originalSize: optimizationData[gameDir].totalSize,
              optimizedSize: optimizationData[gameDir].optimizedSize,
              savings: optimizationData[gameDir].savings,
              compressionRatio: optimizationData[gameDir].compressionRatio,
              recommendations: optimizationData[gameDir].recommendations
            }
          })
        };

        // Fix image path if relative
        if (enhancedGame.image && enhancedGame.image.startsWith('./')) {
          enhancedGame.image = `/games/${gameDir}/${enhancedGame.image.substring(2)}`;
        }

        games.push(enhancedGame);
        console.log(`   ✅ ${metadata.title} (${utils.formatBytes(actualSize)})`);
        
      } catch (error) {
        console.error(`   ❌ Error processing ${gameDir}:`, error.message);
      }
    }
  }

  // Sort games by priority and size
  games.sort((a, b) => {
    // High priority games first
    if (a.performance.priority !== b.performance.priority) {
      return a.performance.priority === 'high' ? -1 : 1;
    }
    // Then by title
    return a.title.localeCompare(b.title);
  });

  // Generate manifest with metadata
  const manifest = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    totalGames: games.length,
    totalSize: games.reduce((sum, game) => sum + game.performance.size, 0),
    
    // Performance summary
    performance: {
      eagerLoadGames: games.filter(g => g.performance.loadingStrategy === 'eager').length,
      lazyLoadGames: games.filter(g => g.performance.loadingStrategy === 'lazy').length,
      preloadGames: games.filter(g => g.performance.preload).length,
      averageGameSize: games.length > 0 
        ? games.reduce((sum, game) => sum + game.performance.size, 0) / games.length 
        : 0
    },
    
    games
  };

  // Add formatted total size
  manifest.formattedTotalSize = utils.formatBytes(manifest.totalSize);
  manifest.performance.formattedAverageSize = utils.formatBytes(manifest.performance.averageGameSize);

  // Write manifest
  fs.writeFileSync(CONFIG.manifestFile, JSON.stringify(manifest, null, 2));
  
  console.log(`📄 Manifest generated with ${games.length} games`);
  console.log(`📊 Total size: ${manifest.formattedTotalSize}`);
  console.log(`⚡ Eager load: ${manifest.performance.eagerLoadGames} games`);
  console.log(`🔄 Lazy load: ${manifest.performance.lazyLoadGames} games`);
  
  return manifest;
}

/**
 * Generate build summary report
 */
function generateBuildSummary(manifest, optimizationReport) {
  const summary = {
    buildTime: new Date().toISOString(),
    games: {
      total: manifest.totalGames,
      totalSize: manifest.totalSize,
      formattedTotalSize: manifest.formattedTotalSize,
      averageSize: manifest.performance.averageGameSize,
      formattedAverageSize: manifest.performance.formattedAverageSize
    },
    performance: {
      eagerLoadGames: manifest.performance.eagerLoadGames,
      lazyLoadGames: manifest.performance.lazyLoadGames,
      preloadGames: manifest.performance.preloadGames,
      loadingStrategies: {
        eager: manifest.games.filter(g => g.performance.loadingStrategy === 'eager').map(g => g.id),
        lazy: manifest.games.filter(g => g.performance.loadingStrategy === 'lazy').map(g => g.id)
      }
    },
    optimization: optimizationReport ? {
      totalSavings: optimizationReport.totalSavings,
      formattedSavings: utils.formatBytes(optimizationReport.totalSavings),
      compressionRatio: optimizationReport.totalSavings / optimizationReport.totalOriginalSize,
      recommendations: optimizationReport.overallRecommendations
    } : null,
    recommendations: []
  };

  // Generate build recommendations
  if (summary.games.totalSize > 50 * 1024 * 1024) {
    summary.recommendations.push({
      type: 'size',
      severity: 'warning',
      message: 'Total project size exceeds 50MB - consider CDN deployment'
    });
  }

  if (summary.performance.lazyLoadGames === 0 && summary.games.total > 5) {
    summary.recommendations.push({
      type: 'performance',
      severity: 'info',
      message: 'Consider implementing lazy loading for better initial load performance'
    });
  }

  return summary;
}

/**
 * Main build process
 */
async function runOptimizedBuild() {
  console.log('🚀 Starting Optimized Build Process\n');
  const startTime = performance.now();

  try {
    // Step 1: Run asset optimization
    console.log('Step 1: Asset Optimization');
    await runOptimization();
    console.log('');

    // Step 2: Generate enhanced manifest
    console.log('Step 2: Enhanced Manifest Generation');
    const manifest = await generateEnhancedManifest();
    console.log('');

    // Step 3: Load optimization report
    let optimizationReport = null;
    if (fs.existsSync(CONFIG.optimizationReport)) {
      optimizationReport = JSON.parse(fs.readFileSync(CONFIG.optimizationReport, 'utf8'));
    }

    // Step 4: Generate build summary
    console.log('Step 3: Build Summary Generation');
    const buildSummary = generateBuildSummary(manifest, optimizationReport);
    
    const summaryPath = path.join(CONFIG.publicDir, 'build-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(buildSummary, null, 2));
    console.log(`📋 Build summary saved: ${summaryPath}`);

    // Final summary
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n🎉 Optimized Build Complete!');
    console.log('📈 Final Summary:');
    console.log(`   Build time: ${duration}s`);
    console.log(`   Games: ${buildSummary.games.total}`);
    console.log(`   Total size: ${buildSummary.games.formattedTotalSize}`);
    
    if (buildSummary.optimization) {
      console.log(`   Savings: ${buildSummary.optimization.formattedSavings} (${(buildSummary.optimization.compressionRatio * 100).toFixed(1)}%)`);
    }
    
    console.log(`   Eager load: ${buildSummary.performance.eagerLoadGames} games`);
    console.log(`   Lazy load: ${buildSummary.performance.lazyLoadGames} games`);

    if (buildSummary.recommendations.length > 0) {
      console.log('\n💡 Build Recommendations:');
      buildSummary.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.message}`);
      });
    }

    console.log('\n✨ Your optimized game platform is ready!');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runOptimizedBuild();
}

export { runOptimizedBuild, generateEnhancedManifest };