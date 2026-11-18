import fs from 'node:fs';
const p = 'D:/WorkProjects/AI/Lightgame/packages/games/super-mario-adventure/index.html';
const s = fs.readFileSync(p, 'utf8');
const out = s.replace(/<script[^>]*src=["'][^"']*images\/stats[^"']*["'][^>]*>\s*<\/script>\s*/gi, '');
console.log('removed bytes:', s.length - out.length);
fs.writeFileSync(p, out);
