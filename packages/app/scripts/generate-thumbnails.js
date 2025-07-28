// Generate game thumbnails
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root directory
const rootDir = path.join(__dirname, '..');

// Thumbnails directory
const thumbnailsDir = path.join(rootDir, 'public', 'images', 'thumbnails');

// Ensure thumbnails directory exists
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Generate simple SVG thumbnails for each game
const games = [
  { id: 'snake', title: 'Snake Game', color: '#4CAF50', icon: 'M20,20 L40,20 L40,40 L60,40 L60,60 L20,60 Z' },
  { id: 'tetris', title: 'Tetris', color: '#2196F3', icon: 'M20,20 L40,20 L40,40 L60,40 L60,20 L80,20 L80,40 L60,40 L60,60 L40,60 L40,40 L20,40 Z' },
  { id: 'space-shooter', title: 'Space Shooter', color: '#FF5722', icon: 'M50,20 L60,40 L80,50 L60,60 L50,80 L40,60 L20,50 L40,40 Z' }
];

// Generate SVG thumbnails
games.forEach(game => {
  const svgContent = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0" />
  <rect width="100%" height="100%" fill="${game.color}30" />
  <path d="${game.icon}" fill="${game.color}" stroke="#333" stroke-width="2" />
  <text x="50%" y="75%" font-family="Arial" font-size="16" text-anchor="middle" fill="#333">${game.title}</text>
</svg>
  `.trim();

  const outputPath = path.join(thumbnailsDir, `${game.id}.svg`);
  fs.writeFileSync(outputPath, svgContent);
  console.log(`Generated thumbnail for ${game.title} at ${outputPath}`);
});

console.log('All thumbnails generated successfully!'); 