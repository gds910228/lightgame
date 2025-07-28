/**
 * Build Games List Script
 * 
 * This script scans the /games directory, reads each game's metadata.json file,
 * and generates a consolidated games.json file in the public directory.
 * 它还会将游戏文件复制到 public/games 目录，确保部署时游戏可访问。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GAMES_DIR = path.join(__dirname, '..', 'public', 'games');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'games.json');
const PUBLIC_GAMES_DIR = path.join(__dirname, '..', 'public', 'games');

// Ensure the output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Ensure the public games directory exists
if (!fs.existsSync(PUBLIC_GAMES_DIR)) {
  fs.mkdirSync(PUBLIC_GAMES_DIR, { recursive: true });
}

/**
 * 递归复制目录及其内容
 */
function copyFolderRecursive(source, target) {
  // 检查目标目录是否存在，不存在则创建
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // 读取源目录中的所有项目
  const items = fs.readdirSync(source, { withFileTypes: true });
  
  // 处理每个项目
  for (const item of items) {
    const sourceFilePath = path.join(source, item.name);
    const targetFilePath = path.join(target, item.name);
    
    if (item.isDirectory()) {
      // 如果是目录，递归复制
      copyFolderRecursive(sourceFilePath, targetFilePath);
    } else {
      // 如果是文件，直接复制
      fs.copyFileSync(sourceFilePath, targetFilePath);
    }
  }
}

/**
 * Scans the games directory and builds a list of all games with their metadata
 */
function buildGamesList() {
  console.log('Building games list...');
  
  try {
    // Get all subdirectories in the games directory
    const gameDirs = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`Found ${gameDirs.length} potential game directories`);
    
    // Array to store all valid games
    const games = [];
    
    // Process each game directory
    for (const gameDir of gameDirs) {
      const metadataPath = path.join(GAMES_DIR, gameDir, 'metadata.json');
      
      // Check if metadata.json exists
      if (fs.existsSync(metadataPath)) {
        try {
          // Read and parse the metadata file
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          
          // Validate required fields
          const requiredFields = ['id', 'title', 'category', 'description', 'controls'];
          const missingFields = requiredFields.filter(field => !metadata[field]);
          
          if (missingFields.length > 0) {
            console.warn(`Warning: Game "${gameDir}" is missing required fields: ${missingFields.join(', ')}`);
            continue;
          }
          
          // Add the game path
          metadata.path = `/games/${gameDir}/index.html`;
          
          // Fix image path if it's relative
          if (metadata.image && metadata.image.startsWith('./')) {
            metadata.image = `/games/${gameDir}/${metadata.image.substring(2)}`;
          }
          
          // Add to games list
          games.push(metadata);
          console.log(`Added game: ${metadata.title}`);
        } catch (error) {
          console.error(`Error processing game "${gameDir}": ${error.message}`);
        }
      } else {
        console.warn(`Warning: Directory "${gameDir}" does not contain a metadata.json file`);
      }
    }
    
    // Sort games alphabetically by title
    games.sort((a, b) => a.title.localeCompare(b.title));
    
    // Write the consolidated games.json file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ games }, null, 2));
    
    console.log(`Successfully wrote ${games.length} games to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error(`Error building games list: ${error.message}`);
    process.exit(1);
  }
}

// Run the build process
buildGamesList(); 