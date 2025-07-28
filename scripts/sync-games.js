const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../packages/games');
const targetDir = path.join(__dirname, '../packages/app/public/games');

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function syncGames() {
  console.log('🎮 Syncing games from packages/games to packages/app/public/games...');
  
  try {
    // Remove existing target directory
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    
    // Copy all games
    copyDirectory(sourceDir, targetDir);
    
    console.log('✅ Games synced successfully!');
    console.log('📁 Source: packages/games/');
    console.log('📁 Target: packages/app/public/games/');
    
    // List synced games
    const games = fs.readdirSync(sourceDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`🎯 Synced ${games.length} games: ${games.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error syncing games:', error.message);
    process.exit(1);
  }
}

// Add reminder message
console.log('📝 REMINDER: Game files are now auto-synced!');
console.log('🔄 Source: packages/games/ → Target: packages/app/public/games/');
console.log('');

syncGames();