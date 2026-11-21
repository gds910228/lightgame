// Shadowspire Ninja — play68 compatibility layer (local-only, no trackers).
// Kept for old launcher calls: goHome / clickMore / play68_submitScore.

function play68_init() {
  updateShare(0);
}

function goHome() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.location.href = '/';
    } else {
      window.location.href = '/';
    }
  } catch (e) {
    try { window.location.href = '/'; } catch (err) { }
  }
}

function clickMore() {
  goHome();
}

function play68_submitScore(score) {
  updateShareScore(score);
  if (typeof dp_share === 'function') dp_share(score);
}

function updateShare(bestScore) {
  updateShareScore(bestScore);
}

function updateShareScore(bestScore) {
  window.shareTitle = Number(bestScore) > 0
    ? 'Shadowspire Ninja — 我登到了 ' + Math.floor(bestScore) + 'm，来追我！'
    : 'Shadowspire Ninja 影峰登天 — 蹬墙、冲刺，登上 1200m 星阁';
  window.descContent = 'A paper-cut ninja tower climb with wall-jump chains, dash i-frames and lantern dust.';
  window.lineLink = window.location.href;
  window.appid = '';
}
