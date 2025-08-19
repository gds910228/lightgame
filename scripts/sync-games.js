const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { canEmbed } = require('./lib/can-embed');

const sourceDir = path.join(__dirname, '../packages/games');
const targetDir = path.join(__dirname, '../packages/app/public/games');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function emptyDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
}

function copyDirectory(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function parseAspect(meta) {
  // priority: meta.aspectRatio "W:H" -> width/height -> default 16:9
  if (typeof meta.aspectRatio === 'string' && /^[0-9]+:[0-9]+$/.test(meta.aspectRatio)) {
    const [w, h] = meta.aspectRatio.split(':').map(n => Math.max(1, parseInt(n, 10) || 0));
    return { w, h };
  }
  if (Number.isFinite(meta.width) && Number.isFinite(meta.height) && meta.width > 0 && meta.height > 0) {
    return { w: Math.round(meta.width), h: Math.round(meta.height) };
  }
  return { w: 16, h: 9 };
}

function renderWrapperHTML({ title, description, embedUrl, allow = 'fullscreen; autoplay', sandbox = '' }, ratio) {
  const ratioW = String(ratio.w);
  const ratioH = String(ratio.h);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>${escapeHtml(title || 'Play')}</title>
    <meta name="description" content="${escapeHtml(description || title || '')}">
    <style>
      :root { --bg: #0b0f17; --fg: #e5e7eb; --acc: #22d3ee; }
      html,body { height:100%; }
      body {
        margin:0; background: var(--bg); color: var(--fg);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        display:flex; align-items:center; justify-content:center; padding:16px;
      }
      .wrap { width: min(1200px, 100%); }
      .frame {
        position: relative; width: 100%;
        background: #111827; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.4);
      }
      .ratio { width: 100%; height: 0; padding-top: calc(100% * ${ratioH} / ${ratioW}); }
      iframe {
        position:absolute; inset:0; width:100%; height:100%; border:0; display:none; background:#000;
      }
      .overlay {
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:16px;
        background: radial-gradient(1200px 600px at 50% 40%, rgba(34,211,238,.15), transparent 70%);
      }
      .btn {
        appearance: none; border:0; border-radius: 10px;
        padding: 12px 20px; cursor: pointer; font-weight: 600; letter-spacing: .2px;
        color: #0b0f17; background: var(--acc);
        box-shadow: 0 6px 20px rgba(34,211,238,.25);
      }
      .toolbar {
        display:flex; justify-content: flex-end; gap: 8px; padding: 10px;
        position:absolute; right:0; top:0; z-index:2;
      }
      .toolbtn {
        background: rgba(255,255,255,.08); color:#e5e7eb; border: 1px solid rgba(255,255,255,.1);
        border-radius: 8px; padding: 6px 10px; cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="frame">
        <div class="ratio"></div>
        <div class="toolbar">
          <button class="toolbtn" id="fullscreen">全屏</button>
        </div>
        <iframe id="game" ${sandbox ? `sandbox="${sandbox}"` : ''} allow="${allow}"></iframe>
        <div class="overlay">
          <button class="btn" id="start">开始游戏</button>
        </div>
      </div>
    </div>
    <script>
      const src = ${JSON.stringify(embedUrl || '')};
      const iframe = document.getElementById("game");
      const start = document.getElementById("start");
      const overlay = document.querySelector(".overlay");
      const fsBtn = document.getElementById("fullscreen");
      start.addEventListener("click", () => {
        if (!src) return;
        iframe.src = src;
        iframe.style.display = "block";
        overlay.style.display = "none";
      });
      fsBtn.addEventListener("click", async () => {
        const el = document.documentElement;
        try { await (el.requestFullscreen?.call(el) || el.webkitRequestFullscreen?.call(el)); } catch {}
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#39;');
}

async function processIframeGame(dirName, meta) {
  const slug = meta.id || dirName;
  const embedUrl = meta.embedUrl || meta.iframe_url;
  if (!embedUrl) {
    throw new Error(`Game "${dirName}" marked as iframe (has iframe_url/embedUrl?) but no URL found`);
  }
  const pre = await canEmbed(embedUrl);
  if (!pre.ok) {
    throw new Error(`Game "${slug}" iframe precheck failed: ${pre.reason}`);
  }
  const destDir = path.join(targetDir, slug);
  await fsp.mkdir(destDir, { recursive: true });
  const ratio = parseAspect(meta);
  const html = renderWrapperHTML({
    title: meta.title || slug,
    description: meta.description || '',
    embedUrl: embedUrl,
    allow: meta.allow || 'fullscreen; autoplay',
    sandbox: meta.sandbox ? String(meta.sandbox) : ''
  }, ratio);
  await fsp.writeFile(path.join(destDir, 'index.html'), html, 'utf8');
}

async function processLocalGame(dirName) {
  const src = path.join(sourceDir, dirName);
  const dest = path.join(targetDir, dirName);
  copyDirectory(src, dest);
}

async function syncGames() {
  console.log('🎮 Syncing games by metadata (local copy + iframe wrapper)...');
  try {
    // Clean target and rebuild
    emptyDir(targetDir);

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true }).filter(d => d.isDirectory());
    const errors = [];
    let copied = 0;
    let wrapped = 0;

    for (const entry of entries) {
      const dirName = entry.name;
      const gameDir = path.join(sourceDir, dirName);
      const metaPath = path.join(gameDir, 'metadata.json');

      if (!fs.existsSync(metaPath)) {
        console.warn(`⚠️  Skip "${dirName}": missing metadata.json`);
        continue;
      }

      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (e) {
        errors.push(`Game "${dirName}" invalid metadata.json: ${e.message}`);
        continue;
      }

      const isIframe = Boolean(meta.embedUrl || meta.iframe_url);
      try {
        if (isIframe) {
          await processIframeGame(dirName, meta);
          wrapped++;
          console.log(`🧩 Wrapped iframe game: ${meta.id || dirName}`);
        } else {
          await processLocalGame(dirName);
          copied++;
          console.log(`📦 Copied local game: ${meta.id || dirName}`);
        }
      } catch (e) {
        errors.push(e.message);
      }
    }

    console.log(`✅ Done. Local copied: ${copied}, Iframe wrapped: ${wrapped}`);
    if (errors.length) {
      console.error('❌ Some games failed to sync:');
      for (const msg of errors) console.error(' - ' + msg);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error syncing games:', error.message);
    process.exit(1);
  }
}

console.log('🔄 Source: packages/games/ → Target: packages/app/public/games/');
console.log('');

syncGames();