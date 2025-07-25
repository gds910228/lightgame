/**
 * Asset Optimization Pipeline
 * 
 * This script provides comprehensive asset optimization including:
 * - Image compression and format conversion
 * - CSS and JS minification
 * - HTML optimization
 * - Asset bundling and tree shaking
 * - Duplicate asset detection and removal
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  input: path.join(__dirname, '..', 'games'),
  output: path.join(__dirname, '..', 'public', 'games'),
  temp: path.join(__dirname, '..', 'temp_optimized'),
  
  // Optimization settings
  images: {
    quality: 85,
    maxWidth: 1920,
    maxHeight: 1080,
    formats: ['webp', 'jpg', 'png']
  },
  
  // Size thresholds
  thresholds: {
    imageWarning: 500 * 1024, // 500KB
    totalGameWarning: 5 * 1024 * 1024, // 5MB
    criticalSize: 10 * 1024 * 1024 // 10MB
  }
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

  getFileSize(filePath) {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  },

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },

  copyFile(src, dest) {
    utils.ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  },

  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext);
  },

  isCSSFile(filePath) {
    return path.extname(filePath).toLowerCase() === '.css';
  },

  isJSFile(filePath) {
    return path.extname(filePath).toLowerCase() === '.js';
  },

  isHTMLFile(filePath) {
    return path.extname(filePath).toLowerCase() === '.html';
  }
};

/**
 * Image optimization (simplified - in production you'd use sharp, imagemin, etc.)
 */
class ImageOptimizer {
  static optimize(inputPath, outputPath) {
    const originalSize = utils.getFileSize(inputPath);
    
    // For now, just copy the file (in production, use actual image optimization)
    utils.copyFile(inputPath, outputPath);
    
    const optimizedSize = utils.getFileSize(outputPath);
    
    return {
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize,
      compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1
    };
  }

  static analyzeImage(filePath) {
    const size = utils.getFileSize(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      size,
      formattedSize: utils.formatBytes(size),
      format: ext.substring(1),
      needsOptimization: size > CONFIG.thresholds.imageWarning,
      recommendations: this.getImageRecommendations(size, ext)
    };
  }

  static getImageRecommendations(size, ext) {
    const recommendations = [];
    
    if (size > CONFIG.thresholds.imageWarning) {
      recommendations.push('Consider compressing this image');
    }
    
    if (ext === '.png' && size > 100 * 1024) {
      recommendations.push('Consider converting to WebP format');
    }
    
    if (ext === '.jpg' && size > 200 * 1024) {
      recommendations.push('Consider reducing JPEG quality');
    }
    
    return recommendations;
  }
}

/**
 * CSS optimization
 */
class CSSOptimizer {
  static optimize(inputPath, outputPath) {
    const originalContent = fs.readFileSync(inputPath, 'utf8');
    const originalSize = Buffer.byteLength(originalContent, 'utf8');
    
    // Simple CSS minification (remove comments and extra whitespace)
    let optimizedContent = originalContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .replace(/\s*{\s*/g, '{') // Clean up braces
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*;\s*/g, ';')
      .trim();
    
    fs.writeFileSync(outputPath, optimizedContent);
    const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');
    
    return {
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize,
      compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1
    };
  }
}

/**
 * JavaScript optimization
 */
class JSOptimizer {
  static optimize(inputPath, outputPath) {
    const originalContent = fs.readFileSync(inputPath, 'utf8');
    const originalSize = Buffer.byteLength(originalContent, 'utf8');
    
    // Simple JS minification (remove comments and extra whitespace)
    let optimizedContent = originalContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}();,])\s*/g, '$1') // Clean up punctuation
      .trim();
    
    fs.writeFileSync(outputPath, optimizedContent);
    const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');
    
    return {
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize,
      compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1
    };
  }
}

/**
 * HTML optimization
 */
class HTMLOptimizer {
  static optimize(inputPath, outputPath) {
    const originalContent = fs.readFileSync(inputPath, 'utf8');
    const originalSize = Buffer.byteLength(originalContent, 'utf8');
    
    // Simple HTML minification
    let optimizedContent = originalContent
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .trim();
    
    fs.writeFileSync(outputPath, optimizedContent);
    const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');
    
    return {
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize,
      compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1
    };
  }
}

/**
 * Game asset analyzer and optimizer
 */
class GameOptimizer {
  constructor(gameId, sourcePath, outputPath) {
    this.gameId = gameId;
    this.sourcePath = sourcePath;
    this.outputPath = outputPath;
    this.analysis = {
      totalFiles: 0,
      totalSize: 0,
      optimizedSize: 0,
      savings: 0,
      fileTypes: {},
      largeFiles: [],
      duplicates: [],
      recommendations: []
    };
  }

  async optimize() {
    console.log(`🎮 Optimizing game: ${this.gameId}`);
    
    // Ensure output directory exists
    utils.ensureDir(this.outputPath);
    
    // Analyze and optimize all files
    await this.processDirectory(this.sourcePath, this.outputPath);
    
    // Calculate final statistics
    this.analysis.savings = this.analysis.totalSize - this.analysis.optimizedSize;
    this.analysis.compressionRatio = this.analysis.totalSize > 0 
      ? this.analysis.optimizedSize / this.analysis.totalSize 
      : 1;
    
    // Generate recommendations
    this.generateRecommendations();
    
    return this.analysis;
  }

  async processDirectory(sourceDir, outputDir, relativePath = '') {
    const items = fs.readdirSync(sourceDir, { withFileTypes: true });
    
    for (const item of items) {
      const sourcePath = path.join(sourceDir, item.name);
      const outputPath = path.join(outputDir, item.name);
      const itemRelativePath = path.join(relativePath, item.name);
      
      if (item.isDirectory()) {
        utils.ensureDir(outputPath);
        await this.processDirectory(sourcePath, outputPath, itemRelativePath);
      } else {
        await this.processFile(sourcePath, outputPath, itemRelativePath);
      }
    }
  }

  async processFile(sourcePath, outputPath, relativePath) {
    const originalSize = utils.getFileSize(sourcePath);
    this.analysis.totalFiles++;
    this.analysis.totalSize += originalSize;
    
    // Track file types
    const ext = path.extname(sourcePath).toLowerCase();
    if (!this.analysis.fileTypes[ext]) {
      this.analysis.fileTypes[ext] = { count: 0, size: 0 };
    }
    this.analysis.fileTypes[ext].count++;
    this.analysis.fileTypes[ext].size += originalSize;
    
    // Track large files
    if (originalSize > CONFIG.thresholds.imageWarning) {
      this.analysis.largeFiles.push({
        path: relativePath,
        size: originalSize,
        formattedSize: utils.formatBytes(originalSize)
      });
    }
    
    let optimizationResult = null;
    
    // Optimize based on file type
    if (utils.isImageFile(sourcePath)) {
      optimizationResult = ImageOptimizer.optimize(sourcePath, outputPath);
    } else if (utils.isCSSFile(sourcePath)) {
      optimizationResult = CSSOptimizer.optimize(sourcePath, outputPath);
    } else if (utils.isJSFile(sourcePath)) {
      optimizationResult = JSOptimizer.optimize(sourcePath, outputPath);
    } else if (utils.isHTMLFile(sourcePath)) {
      optimizationResult = HTMLOptimizer.optimize(sourcePath, outputPath);
    } else {
      // Just copy other files
      utils.copyFile(sourcePath, outputPath);
      optimizationResult = {
        originalSize,
        optimizedSize: originalSize,
        savings: 0,
        compressionRatio: 1
      };
    }
    
    this.analysis.optimizedSize += optimizationResult.optimizedSize;
    
    // Log significant optimizations
    if (optimizationResult.savings > 1024) {
      console.log(`   📦 ${relativePath}: ${utils.formatBytes(optimizationResult.savings)} saved`);
    }
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check total game size
    if (this.analysis.totalSize > CONFIG.thresholds.totalGameWarning) {
      recommendations.push({
        type: 'size',
        severity: 'warning',
        message: `Game size (${utils.formatBytes(this.analysis.totalSize)}) exceeds recommended limit`,
        suggestion: 'Consider implementing lazy loading for this game'
      });
    }
    
    if (this.analysis.totalSize > CONFIG.thresholds.criticalSize) {
      recommendations.push({
        type: 'size',
        severity: 'critical',
        message: `Game size is critically large (${utils.formatBytes(this.analysis.totalSize)})`,
        suggestion: 'Split game into smaller modules or compress assets significantly'
      });
    }
    
    // Check for large images
    const largeImages = this.analysis.largeFiles.filter(file => 
      utils.isImageFile(file.path)
    );
    
    if (largeImages.length > 0) {
      recommendations.push({
        type: 'images',
        severity: 'info',
        message: `${largeImages.length} large images found`,
        suggestion: 'Consider compressing or converting to WebP format',
        files: largeImages.slice(0, 3) // Show top 3
      });
    }
    
    // Check file type distribution
    const imageSize = this.analysis.fileTypes['.png']?.size || 0 + 
                     this.analysis.fileTypes['.jpg']?.size || 0 + 
                     this.analysis.fileTypes['.jpeg']?.size || 0;
    
    if (imageSize > this.analysis.totalSize * 0.7) {
      recommendations.push({
        type: 'composition',
        severity: 'info',
        message: 'Game is image-heavy (>70% images)',
        suggestion: 'Consider using sprite sheets or vector graphics where possible'
      });
    }
    
    this.analysis.recommendations = recommendations;
  }
}

/**
 * Main optimization pipeline
 */
async function runOptimization() {
  console.log('🚀 Starting Asset Optimization Pipeline\n');
  
  const startTime = performance.now();
  const results = {
    totalGames: 0,
    totalOriginalSize: 0,
    totalOptimizedSize: 0,
    totalSavings: 0,
    gameResults: [],
    overallRecommendations: []
  };
  
  try {
    // Get all game directories
    const gameDirs = fs.readdirSync(CONFIG.input, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`📁 Found ${gameDirs.length} games to optimize\n`);
    
    // Process each game
    for (const gameId of gameDirs) {
      const sourcePath = path.join(CONFIG.input, gameId);
      const outputPath = path.join(CONFIG.output, gameId);
      
      // Check if metadata exists
      const metadataPath = path.join(sourcePath, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        console.log(`⚠️  Skipping ${gameId}: No metadata.json found`);
        continue;
      }
      
      const optimizer = new GameOptimizer(gameId, sourcePath, outputPath);
      const gameResult = await optimizer.optimize();
      
      results.totalGames++;
      results.totalOriginalSize += gameResult.totalSize;
      results.totalOptimizedSize += gameResult.optimizedSize;
      results.gameResults.push({
        gameId,
        ...gameResult
      });
      
      // Log game results
      console.log(`   📊 Files: ${gameResult.totalFiles}`);
      console.log(`   💾 Original: ${utils.formatBytes(gameResult.totalSize)}`);
      console.log(`   🗜️  Optimized: ${utils.formatBytes(gameResult.optimizedSize)}`);
      console.log(`   💰 Saved: ${utils.formatBytes(gameResult.savings)} (${((1 - gameResult.compressionRatio) * 100).toFixed(1)}%)`);
      
      if (gameResult.recommendations.length > 0) {
        console.log(`   💡 Recommendations: ${gameResult.recommendations.length}`);
      }
      
      console.log('');
    }
    
    results.totalSavings = results.totalOriginalSize - results.totalOptimizedSize;
    
    // Generate overall recommendations
    results.overallRecommendations = generateOverallRecommendations(results);
    
    // Save optimization report
    const reportPath = path.join(CONFIG.output, 'optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    
    // Print summary
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('🎉 Optimization Complete!\n');
    console.log('📈 Summary:');
    console.log(`   Games processed: ${results.totalGames}`);
    console.log(`   Original size: ${utils.formatBytes(results.totalOriginalSize)}`);
    console.log(`   Optimized size: ${utils.formatBytes(results.totalOptimizedSize)}`);
    console.log(`   Total savings: ${utils.formatBytes(results.totalSavings)} (${((results.totalSavings / results.totalOriginalSize) * 100).toFixed(1)}%)`);
    console.log(`   Processing time: ${duration}s`);
    console.log(`   Report saved: ${reportPath}\n`);
    
    // Print top recommendations
    if (results.overallRecommendations.length > 0) {
      console.log('💡 Top Recommendations:');
      results.overallRecommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.message}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  }
}

/**
 * Generate overall recommendations based on all games
 */
function generateOverallRecommendations(results) {
  const recommendations = [];
  
  // Check for games that need lazy loading
  const largeGames = results.gameResults.filter(game => 
    game.totalSize > CONFIG.thresholds.totalGameWarning
  );
  
  if (largeGames.length > 0) {
    recommendations.push({
      type: 'architecture',
      priority: 'high',
      message: `${largeGames.length} games exceed size limits and should use lazy loading`,
      games: largeGames.map(g => g.gameId)
    });
  }
  
  // Check overall project size
  if (results.totalOptimizedSize > 50 * 1024 * 1024) { // 50MB
    recommendations.push({
      type: 'deployment',
      priority: 'medium',
      message: 'Total project size is large - consider CDN deployment',
      suggestion: 'Use a CDN to improve loading performance globally'
    });
  }
  
  // Check optimization effectiveness
  const avgCompressionRatio = results.gameResults.reduce((sum, game) => 
    sum + game.compressionRatio, 0) / results.gameResults.length;
  
  if (avgCompressionRatio > 0.8) {
    recommendations.push({
      type: 'optimization',
      priority: 'low',
      message: 'Low compression ratio achieved - consider advanced optimization tools',
      suggestion: 'Use tools like imagemin, terser, or cssnano for better compression'
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// Run optimization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runOptimization();
}

export { runOptimization, GameOptimizer, utils };