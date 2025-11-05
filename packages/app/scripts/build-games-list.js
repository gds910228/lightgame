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
const METADATA_SOURCE_DIR = path.join(__dirname, '..', '..', 'games'); // Source metadata from packages/games
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

function findCandidateImage(sourceRoot, gameDir) {
  const dir = path.join(sourceRoot, gameDir);

  const primary = [
    'icon.png', 'icon.jpg', 'icon.jpeg', 'icon.svg',
    'share.png', 'share.jpg', 'share.jpeg', 'share.svg',
    'thumbnail.png', 'thumbnail.jpg', 'thumbnail.jpeg', 'thumbnail.svg',
    `${gameDir}.png`, `${gameDir}.jpg`, `${gameDir}.jpeg`, `${gameDir}.svg`
  ];

  // 1) Try primary names at root
  for (const name of primary) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return name;
  }

  // 2) Try primary names in common subdirs
  const subdirs = ['images', 'img', 'assets', 'res', 'resource'];
  for (const sub of subdirs) {
    for (const name of primary) {
      const rel = path.join(sub, name);
      const p = path.join(dir, rel);
      if (fs.existsSync(p)) return rel.replace(/\\/g, '/');
    }
  }

  // 3) Fallback: first image file in subdirs
  const exts = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  for (const sub of subdirs) {
    const subPath = path.join(dir, sub);
    if (!fs.existsSync(subPath)) continue;
    try {
      const files = fs.readdirSync(subPath, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && exts.some(ext => f.name.toLowerCase().endsWith(ext))) {
          return path.join(sub, f.name).replace(/\\/g, '/');
        }
      }
    } catch {}
  }

  // 4) Fallback: first image file in root
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      if (f.isFile() && exts.some(ext => f.name.toLowerCase().endsWith(ext))) {
        return f.name;
      }
    }
  } catch {}

  return null;
}

/**
 * Scans the metadata source directory and builds a list of all games with their metadata
 */
function buildGamesList() {
  console.log('Building games list from metadata source...');
  
  try {
    // Get all subdirectories in the metadata source directory
    const gameDirs = fs.readdirSync(METADATA_SOURCE_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`Found ${gameDirs.length} potential game directories in metadata source`);
    
    // Array to store all valid games
    const games = [];
    
    // Process each game directory
    for (const gameDir of gameDirs) {
      const metadataPath = path.join(METADATA_SOURCE_DIR, gameDir, 'metadata.json');
      
      // Check if metadata.json exists in source
      if (fs.existsSync(metadataPath)) {
        try {
          // Read and parse the metadata file from source
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          
          // Validate required fields
          const requiredFields = ['id', 'title', 'category', 'description', 'controls'];
          const missingFields = requiredFields.filter(field => !metadata[field]);
          
          if (missingFields.length > 0) {
            console.warn(`Warning: Game "${gameDir}" is missing required fields: ${missingFields.join(', ')}`);
            continue;
          }
          
          // Normalize fields and ensure compatibility
          // Unified path (wrapper for iframe or local index)
          const gameId = metadata.id || gameDir;
          metadata.path = `/games/${gameId}/index.html`;

          // Detect type (iframe/local)
          metadata.type = (metadata.embedUrl || metadata.iframe_url) ? 'iframe' : 'local';

          // Normalize asset paths (image/thumbnail/cover)
          const normalizeAsset = (p) => {
            if (!p) return p;
            if (/^https?:\/\//i.test(p)) return p;     // keep absolute URL
            if (p.startsWith('/')) return p;           // already absolute in site
            if (p.startsWith('./')) return `/games/${gameId}/${p.substring(2)}`;
            return `/games/${gameId}/${p}`;
          };

          // image normalize with robust fallback
          const candidate = (!metadata.image && !metadata.thumbnail)
            ? findCandidateImage(METADATA_SOURCE_DIR, gameDir)
            : null;

          if (!metadata.image && metadata.thumbnail) {
            metadata.image = normalizeAsset(metadata.thumbnail);
          } else if (!metadata.image && candidate) {
            metadata.image = normalizeAsset(candidate);
          } else if (metadata.image) {
            metadata.image = normalizeAsset(metadata.image);
          }

          // ensure thumbnail if missing and image points within /games/{slug}/
          if (!metadata.thumbnail && metadata.image && metadata.image.startsWith(`/games/${gameId}/`)) {
            metadata.thumbnail = metadata.image.replace(`/games/${gameId}/`, '');
          }

          if (metadata.cover) {
            metadata.cover = normalizeAsset(metadata.cover);
          }

          // verify existence and fallback if missing
          const existsRel = (rel) => {
            try { return fs.existsSync(path.join(METADATA_SOURCE_DIR, gameDir, rel)); } catch { return false; }
          };

          // fix image pointing to non-existent source file
          if (metadata.image && metadata.image.startsWith(`/games/${gameId}/`)) {
            const rel = metadata.image.slice((`/games/${gameId}/`).length);
            if (!existsRel(rel)) {
              const alt = findCandidateImage(METADATA_SOURCE_DIR, gameDir);
              if (alt) {
                metadata.image = normalizeAsset(alt);
                if (!metadata.thumbnail) metadata.thumbnail = alt;
              }
            }
          }

          // fix thumbnail missing file
          if (metadata.thumbnail && !existsRel(metadata.thumbnail)) {
            const alt = findCandidateImage(METADATA_SOURCE_DIR, gameDir);
            if (alt) {
              metadata.thumbnail = alt;
              if (!metadata.image || metadata.image.startsWith(`/games/${gameId}/`)) {
                metadata.image = normalizeAsset(alt);
              }
            }
          }

          // Add to games list
          games.push(metadata);
          console.log(`Added game: ${metadata.title} (${metadata.category})`);
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
    const gamesData = { games };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gamesData, null, 2));
    
    console.log(`Successfully wrote ${games.length} games to ${OUTPUT_FILE}`);
    console.log('Games list built from metadata source successfully!');
  } catch (error) {
    console.error(`Error building games list: ${error.message}`);
    process.exit(1);
  }
}

// Run the build process
buildGamesList(); 