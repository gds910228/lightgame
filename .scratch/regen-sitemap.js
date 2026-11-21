// Regenerate packages/app/public/sitemap.xml from games.json (site has no generator).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const gamesPath = path.join(root, 'packages/app/public/games.json');
const outPath = path.join(root, 'packages/app/public/sitemap.xml');
const data = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
const games = [...data.games].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lastmod = g => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(g.date_added || '') ? g.date_added : '2026-11-19';
  return d + 'T00:00:00+00:00';
};
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
xml += `  <url>\n    <loc>https://games.misitebo.win/</loc>\n    <lastmod>2026-11-19T00:00:00+00:00</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
for (const g of games) {
  xml += `  <url>\n    <loc>https://games.misitebo.win/game/${esc(g.id)}</loc>\n    <lastmod>${lastmod(g)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
}
xml += '</urlset>\n';
fs.writeFileSync(outPath, xml);
console.log(`sitemap urls: ${games.length + 1}`);
