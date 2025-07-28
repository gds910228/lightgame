const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const GAMES_SOURCE_DIR = path.resolve(__dirname, '../../games');
const GAMES_OUTPUT_DIR = path.resolve(__dirname, '../public/games');
const GAMES_JSON_PATH = path.resolve(__dirname, '../public/games.json');

console.log('🎮 Starting game optimization process...');
console.log(`Source: ${GAMES_SOURCE_DIR}`);
console.log(`Output: ${GAMES_OUTPUT_DIR}`);

// Ensure output directory exists
if (!fs.existsSync(GAMES_OUTPUT_DIR)) {
  fs.mkdirSync(GAMES_OUTPUT_DIR, { recursive: true });
}

// Clean output directory
console.log('🧹 Cleaning output directory...');
if (fs.existsSync(GAMES_OUTPUT_DIR)) {
  fs.rmSync(GAMES_OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(GAMES_OUTPUT_DIR, { recursive: true });
}

// Get list of games from source directory
const gameDirectories = fs.readdirSync(GAMES_SOURCE_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

console.log(`📁 Found ${gameDirectories.length} games to optimize:`, gameDirectories);

const games = [];

// Process each game
gameDirectories.forEach(gameDir => {
  console.log(`\n🔄 Processing game: ${gameDir}`);
  
  const sourceGamePath = path.join(GAMES_SOURCE_DIR, gameDir);
  const outputGamePath = path.join(GAMES_OUTPUT_DIR, gameDir);
  
  // Create output directory for this game
  fs.mkdirSync(outputGamePath, { recursive: true });
  
  // Copy and optimize files
  copyAndOptimizeDirectory(sourceGamePath, outputGamePath);
  
  // Try to extract game metadata
  const gameMetadata = extractGameMetadata(sourceGamePath, gameDir);
  if (gameMetadata) {
    games.push(gameMetadata);
    console.log(`✅ Added game: ${gameMetadata.title}`);
  }
});

// Generate games.json
console.log(`\n📝 Generating games.json with ${games.length} games...`);
fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2));

console.log('🎉 Game optimization completed successfully!');
console.log(`📊 Total games processed: ${games.length}`);

// Calculate total size
const totalSize = calculateDirectorySize(GAMES_OUTPUT_DIR);
console.log(`📦 Total optimized size: ${formatBytes(totalSize)}`);

function copyAndOptimizeDirectory(sourceDir, outputDir) {
  const items = fs.readdirSync(sourceDir, { withFileTypes: true });
  
  items.forEach(item => {
    const sourcePath = path.join(sourceDir, item.name);
    const outputPath = path.join(outputDir, item.name);
    
    if (item.isDirectory()) {
      fs.mkdirSync(outputPath, { recursive: true });
      copyAndOptimizeDirectory(sourcePath, outputPath);
    } else {
      optimizeAndCopyFile(sourcePath, outputPath);
    }
  });
}

function optimizeAndCopyFile(sourcePath, outputPath) {
  const ext = path.extname(sourcePath).toLowerCase();
  
  try {
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      // For now, just copy images - we'll add compression later
      fs.copyFileSync(sourcePath, outputPath);
      console.log(`  📷 Copied image: ${path.basename(sourcePath)}`);
    } else if (['.js', '.css'].includes(ext)) {
      // For now, just copy JS/CSS - we'll add minification later
      fs.copyFileSync(sourcePath, outputPath);
      console.log(`  📄 Copied ${ext.slice(1).toUpperCase()}: ${path.basename(sourcePath)}`);
    } else {
      // Copy other files as-is
      fs.copyFileSync(sourcePath, outputPath);
      console.log(`  📋 Copied: ${path.basename(sourcePath)}`);
    }
  } catch (error) {
    console.warn(`  ⚠️  Warning: Could not copy ${sourcePath}: ${error.message}`);
  }
}

function extractGameMetadata(gameDir, gameDirName) {
  // Try to find index.html or main HTML file
  const possibleIndexFiles = ['index.html', 'game.html', `${gameDirName}.html`];
  let indexFile = null;
  
  for (const fileName of possibleIndexFiles) {
    const filePath = path.join(gameDir, fileName);
    if (fs.existsSync(filePath)) {
      indexFile = filePath;
      break;
    }
  }
  
  if (!indexFile) {
    console.warn(`  ⚠️  No index file found for ${gameDirName}`);
    return null;
  }
  
  try {
    const htmlContent = fs.readFileSync(indexFile, 'utf-8');
    
    // Extract title from HTML
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : gameDirName;
    
    // Clean up title (remove common suffixes)
    title = title.replace(/\s*-\s*微信HTML5在线朋友圈游戏/i, '');
    title = title.replace(/\s*-\s*HTML5游戏/i, '');
    
    // Try to extract description from meta tags
    const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : `A fun ${title} game`;
    
    // Look for thumbnail image
    let thumbnail = null;
    const imgMatches = htmlContent.match(/<img[^>]*src=["']([^"']+)["']/gi);
    if (imgMatches && imgMatches.length > 0) {
      // Try to find a good thumbnail image
      for (const imgMatch of imgMatches) {
        const srcMatch = imgMatch.match(/src=["']([^"']+)["']/i);
        if (srcMatch) {
          const imgSrc = srcMatch[1];
          if (imgSrc.includes('thumb') || imgSrc.includes('preview') || imgSrc.includes('icon')) {
            thumbnail = `/games/${gameDirName}/${imgSrc}`;
            break;
          }
        }
      }
      
      // If no specific thumbnail found, use the first image
      if (!thumbnail && imgMatches.length > 0) {
        const firstImgMatch = imgMatches[0].match(/src=["']([^"']+)["']/i);
        if (firstImgMatch) {
          thumbnail = `/games/${gameDirName}/${firstImgMatch[1]}`;
        }
      }
    }
    
    // Default thumbnail if none found
    if (!thumbnail) {
      thumbnail = `/images/game-placeholder.png`;
    }
    
    return {
      id: gameDirName,
      title: title,
      description: description,
      thumbnail: thumbnail,
      url: `/games/${gameDirName}/`,
      category: 'Casual', // Default category
      tags: ['HTML5', 'Browser Game']
    };
    
  } catch (error) {
    console.warn(`  ⚠️  Error reading ${indexFile}: ${error.message}`);
    return null;
  }
}

function calculateDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);
    
    if (stats.isDirectory()) {
      const items = fs.readdirSync(currentPath);
      items.forEach(item => {
        calculateSize(path.join(currentPath, item));
      });
    } else {
      totalSize += stats.size;
    }
  }
  
  if (fs.existsSync(dirPath)) {
    calculateSize(dirPath);
  }
  
  return totalSize;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}