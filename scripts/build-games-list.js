/**
 * Build Games List Script
 * 
 * This script scans the /games directory, reads each game's metadata.json file,
 * and generates a consolidated games.json file in the public directory.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const GAMES_DIR = path.join(__dirname, '..', 'games');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'games.json');

// Ensure the output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
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