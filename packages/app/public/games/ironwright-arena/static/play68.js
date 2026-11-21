// Ironwright Arena — local play68 compatibility layer (no trackers, no network).
// Legacy entry points stay on this origin; sharing delegates to the LightGame
// host through static/play68bar.js.

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
  window.descContent = 'Ironwright Arena — assemble a forge mech and fight three furnace wardens.';
  updateShareScore(bestScore);
  window.appid = '';
}

function updateShareScore(bestScore) {
  var n = Math.max(0, parseInt(bestScore, 10) || 0);
  window.shareTitle = n > 0
    ? 'Ironwright Arena — I cleared the forge with ' + n.toLocaleString('en-US') + ' points.'
    : 'Ironwright Arena — choose six weapons, six plates and four thrusters, then break three wardens.';
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
