const chokidar = require('chokidar');
const { execSync } = require('child_process');
const path = require('path');

console.log('👀 Watching packages/games/ for changes...');
console.log('🔄 Auto-sync enabled - files will be synchronized automatically');
console.log('📁 Source: packages/games/');
console.log('📁 Target: packages/app/public/games/');
console.log('');

// Watch for changes in packages/games directory
const watcher = chokidar.watch('packages/games/**/*', {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('change', (filePath) => {
    console.log(`📝 File changed: ${filePath}`);
    syncGames();
  })
  .on('add', (filePath) => {
    console.log(`➕ File added: ${filePath}`);
    syncGames();
  })
  .on('unlink', (filePath) => {
    console.log(`🗑️ File removed: ${filePath}`);
    syncGames();
  })
  .on('addDir', (dirPath) => {
    console.log(`📁 Directory added: ${dirPath}`);
    syncGames();
  })
  .on('unlinkDir', (dirPath) => {
    console.log(`📁 Directory removed: ${dirPath}`);
    syncGames();
  });

let syncTimeout;
function syncGames() {
  // Debounce multiple rapid changes
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    try {
      console.log('🔄 Auto-syncing games...');
      execSync('node scripts/sync-games.js', { stdio: 'inherit' });
      console.log('✅ Auto-sync completed!');
      console.log('');
    } catch (error) {
      console.error('❌ Auto-sync failed:', error.message);
    }
  }, 500); // Wait 500ms for multiple changes
}

console.log('Press Ctrl+C to stop watching...');