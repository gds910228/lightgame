/**
 * Build games list script for CI/CD
 * This script delegates to the actual build script in packages/app
 */

const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Running build-games-list script...');
  
  // Change to the app directory and run the actual script
  const appDir = path.join(__dirname, '..', 'packages', 'app');
  const scriptPath = path.join(appDir, 'scripts', 'build-games-list.js');
  
  console.log(`Executing: node ${scriptPath}`);
  execSync(`node ${scriptPath}`, { 
    cwd: appDir,
    stdio: 'inherit' 
  });
  
  console.log('Build games list completed successfully!');
} catch (error) {
  console.error(`Error running build-games-list: ${error.message}`);
  process.exit(1);
}