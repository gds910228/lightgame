// Lexicon Bastion — play68 compatibility layer (local only, no trackers).
// Legacy names are preserved for the site bridge; navigation stays on this
// origin and sharing delegates to the host app's handleGlobalShare().

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
    try { window.location.href = '/'; } catch (e2) { }
  }
}

function play68_submitScore(score) {
  updateShareScore(score);
  setTimeout(function () { show_share(score); }, 900);
}

function updateShare(bestScore) {
  imgUrl = 'thumbnail.jpg';
  lineLink = window.location.href;
  descContent = 'Lexicon Bastion — type the falling words, fire the word-fortress.';
  updateShareScore(bestScore);
  appid = '';
}

function updateShareScore(bestScore) {
  const n = Math.max(0, parseInt(bestScore, 10) || 0);
  shareTitle = n > 0
    ? 'Lexicon Bastion — I scored ' + n + ' in the endless word siege. Can you type faster?'
    : 'Lexicon Bastion — type English words to hold the stone word-fortress.';
}

// Aliases used by older wrappers.
function clickMore() { goHome(); }
function dp_share(score) { if (typeof show_share === 'function') show_share(score); }
function gameOver(score) { if (typeof play68_submitScore === 'function') play68_submitScore(score); }

try {
  window.goHome = window.goHome || goHome;
  window.clickMore = window.clickMore || clickMore;
  window.dp_share = window.dp_share || dp_share;
  window.play68_submitScore = window.play68_submitScore || play68_submitScore;
} catch (e) { }
