// LightGame 反馈表单端点（Cloudflare Worker）
// POST /feedback  JSON: { name, email, game, feedbackType, message, rating, turnstileToken, website }
// 安全层：Origin 白名单 → 内存限速 → honeypot → 字段校验 → Turnstile 人机验证 → Resend 发信
// 所有密钥都在 Worker secrets（TURNSTILE_SECRET_KEY / RESEND_API_KEY / FEEDBACK_TO_EMAIL），不入仓库、不进浏览器

const ALLOWED_ORIGINS = [
  'https://games.misitebo.win',
  'https://lightgame.pages.dev',
  'http://localhost:5173',
];

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// 尽力而为的内存限速（按 isolate 实例）：每 IP 每 15 分钟 5 次
const RATE = { max: 5, windowMs: 15 * 60 * 1000 };
const hits = new Map(); // ip -> timestamp[]

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE.max;
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

async function verifyTurnstile(token, ip, secret) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const verdict = await res.json();
  return verdict.success === true;
}

async function sendViaResend(env, { name, email, game, feedbackType, message, rating, ip }) {
  const lines = [
    `Name: ${name || 'Anonymous'}`,
    `Email: ${email || '(not provided)'}`,
    `Game: ${game}`,
    `Type: ${feedbackType}`,
    `Rating: ${rating || 'n/a'}`,
    `IP: ${ip}`,
    '',
    message,
  ];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LightGame Feedback <feedback@misitebo.win>',
      to: [env.FEEDBACK_TO_EMAIL],
      reply_to: email || undefined,
      subject: `[LightGame] ${feedbackType} · ${game}${rating ? ` · ${rating}/5` : ''}`,
      text: lines.join('\n'),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('resend send failed:', res.status, detail.slice(0, 500));
  }
  return res.ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method === 'GET') return json({ ok: true, service: 'lightgame-feedback' }, 200, origin);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin_not_allowed' }, 403, origin);
    if (limited(ip)) return json({ error: 'rate_limited' }, 429, origin);

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400, origin);
    }

    // honeypot：机器人填了 → 假装成功，静默丢弃
    if (typeof data.website === 'string' && data.website !== '') return json({ ok: true }, 200, origin);

    const name = String(data.name || '').slice(0, 100);
    const email = String(data.email || '').trim().slice(0, 200);
    const game = String(data.game || 'Entire Website').slice(0, 120);
    const feedbackType = String(data.feedbackType || 'Other').slice(0, 40);
    const message = String(data.message || '').trim().slice(0, 4000);
    const rating = String(data.rating || '').slice(0, 10);
    const token = String(data.turnstileToken || '');

    if (message.length < 10) return json({ error: 'message_too_short' }, 400, origin);
    if (email && !EMAIL_RE.test(email)) return json({ error: 'bad_email' }, 400, origin);
    if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.FEEDBACK_TO_EMAIL) {
      return json({ error: 'server_not_configured' }, 500, origin);
    }

    if (!(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
      return json({ error: 'captcha_failed' }, 403, origin);
    }

    const sent = await sendViaResend(env, { name, email, game, feedbackType, message, rating, ip });
    if (!sent) return json({ error: 'send_failed' }, 502, origin);
    return json({ ok: true }, 200, origin);
  },
};
