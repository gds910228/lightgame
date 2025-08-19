const { URL } = require('node:url');

const WHITELIST = new Set(['1games.io']);

function normalizeHost(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch {
    return '';
  }
}

function hostnameInWhitelist(u) {
  const host = normalizeHost(u);
  return WHITELIST.has(host);
}

function hasBlockingXFO(headers) {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();
  return xfo.includes('deny') || xfo.includes('sameorigin');
}

function parseCspFrameAncestors(csp) {
  const parts = csp.split(';').map(s => s.trim().toLowerCase());
  const fa = parts.find(s => s.startsWith('frame-ancestors'));
  return fa || null;
}

function hasBlockingCSP(headers) {
  const csp = headers.get('content-security-policy') || '';
  const fa = parseCspFrameAncestors(csp);
  if (!fa) return false;
  if (fa.includes("'none'")) return true;
  // Strict: if frame-ancestors exists but doesn't include *, block
  return !fa.includes('*');
}

async function doFetch(url, method) {
  return await fetch(url, {
    method,
    redirect: 'manual',
    headers: {
      'User-Agent': 'Lightgame-Embed-Checker/1.0',
      'Accept': '*/*'
    },
    referrerPolicy: 'no-referrer'
  });
}

async function headOrGet(url) {
  let res = await doFetch(url, 'HEAD');
  if (res.status === 405 || res.status === 501) {
    res = await doFetch(url, 'GET');
  }
  return res;
}

async function canEmbed(url, maxRedirects = 3) {
  if (!hostnameInWhitelist(url)) {
    return { ok: false, reason: 'domain_not_whitelisted' };
  }
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    try {
      const res = await headOrGet(current);
      // handle redirects
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return { ok: false, reason: `redirect_without_location_${res.status}` };
        const next = new URL(loc, current).toString();
        if (!hostnameInWhitelist(next)) {
          return { ok: false, reason: 'redirected_to_non_whitelisted_domain' };
        }
        current = next;
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        return { ok: false, reason: `status_${res.status}` };
      }
      if (hasBlockingXFO(res.headers)) return { ok: false, reason: 'xfo_block' };
      if (hasBlockingCSP(res.headers)) return { ok: false, reason: 'csp_block' };
      return { ok: true, url: current };
    } catch (e) {
      return { ok: false, reason: 'network_error' };
    }
  }
  return { ok: false, reason: 'too_many_redirects' };
}

module.exports = {
  canEmbed,
  WHITELIST,
  hostnameInWhitelist
};