/**
 * Validate all games:
 * - JSON schema validation (AJV). If AJV not installed, prints guidance.
 * - Iframe precheck (only allow 1games.io, pass XFO/CSP checks).
 * - Local game must contain index.html.
 * Exits with code 1 on any failure.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'packages', 'games');
const SCHEMA_PATH = path.join(__dirname, 'schemas', 'metadata.schema.json');
const { canEmbed } = require('./lib/can-embed');

let Ajv, addFormats;
try {
  Ajv = require('ajv').default;
  addFormats = require('ajv-formats').default;
} catch (e) {
  console.error('Missing dependencies: ajv and ajv-formats are required.');
  console.error('Please install them: npm i -D ajv ajv-formats');
  process.exit(1);
}

function isIframe(meta) {
  return Boolean(meta && (meta.embedUrl || meta.iframe_url));
}

function getSlug(dirName, meta) {
  return (meta && meta.id) ? String(meta.id) : dirName;
}

async function validateLocalGame(dirName, meta) {
  const slug = getSlug(dirName, meta);
  const indexPath = path.join(GAMES_DIR, dirName, 'index.html');
  try {
    await fsp.stat(indexPath);
  } catch {
    return `Local game "${slug}" missing index.html`;
  }
  return null;
}

async function validateIframeGame(dirName, meta) {
  const slug = getSlug(dirName, meta);
  const url = meta.embedUrl || meta.iframe_url;
  if (!url) return `Iframe game "${slug}" missing embed URL`;
  const res = await canEmbed(url);
  if (!res.ok) return `Iframe game "${slug}" precheck failed: ${res.reason}`;
  return null;
}

function loadSchema() {
  try {
    const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load schema at', SCHEMA_PATH, e.message);
    process.exit(1);
  }
}

async function main() {
  const schema = loadSchema();
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const entries = fs.readdirSync(GAMES_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
  const errors = [];
  let passed = 0;

  for (const entry of entries) {
    const dirName = entry.name;
    const metaPath = path.join(GAMES_DIR, dirName, 'metadata.json');
    if (!fs.existsSync(metaPath)) {
      errors.push(`Game "${dirName}" missing metadata.json`);
      continue;
    }
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      errors.push(`Game "${dirName}" invalid metadata.json: ${e.message}`);
      continue;
    }

    const valid = validate(meta);
    if (!valid) {
      const msgs = (validate.errors || []).map(e => `${e.instancePath || ''} ${e.message}`).join('; ');
      errors.push(`Game "${getSlug(dirName, meta)}" schema invalid: ${msgs}`);
      continue;
    }

    try {
      if (isIframe(meta)) {
        const msg = await validateIframeGame(dirName, meta);
        if (msg) errors.push(msg);
        else passed++;
      } else {
        const msg = await validateLocalGame(dirName, meta);
        if (msg) errors.push(msg);
        else passed++;
      }
    } catch (e) {
      errors.push(`Game "${getSlug(dirName, meta)}" validation error: ${e.message}`);
    }
  }

  if (errors.length) {
    console.error('❌ Validation failed:');
    for (const m of errors) console.error(' -', m);
    console.error(`Summary: ${passed} passed, ${errors.length} failed, total ${passed + errors.length}`);
    process.exit(1);
  } else {
    console.log(`✅ All games passed validation. Total: ${passed}`);
  }
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});