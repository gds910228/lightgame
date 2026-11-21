// Crucible Atelier — local play68 compatibility layer.
// No trackers and no network: all legacy entry points stay on this origin,
// sharing delegates to the LightGame host via static/play68bar.js.

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
  window.imgUrl = 'thumbnail.jpg';
  window.lineLink = window.location.href;
  window.descContent = 'Crucible Atelier — a night-indigo idle alchemy workshop: 36 recipes, four automation lines and an eight-hour offline furnace.';
  updateShareScore(bestScore);
  window.appid = '';
}

function updateShareScore(bestScore) {
  var n = Math.max(0, parseInt(bestScore, 10) || 0);
  window.shareTitle = n > 0
    ? 'Crucible Atelier — my atelier reached ' + n.toLocaleString('en-US') + '. Can you forge the Starfall Crucible?'
    : 'Crucible Atelier — gather dew and ash, climb the recipe tree and forge the Starfall Crucible.';
}

function clickMore() { goHome(); }
function dp_share(score) { if (typeof show_share === 'function') show_share(score); }

try {
  window.goHome = window.goHome || goHome;
  window.clickMore = window.clickMore || clickMore;
  window.dp_share = window.dp_share || dp_share;
  window.play68_submitScore = window.play68_submitScore || play68_submitScore;
  if (typeof play68_init === 'function') play68_init();
} catch (e) { }
