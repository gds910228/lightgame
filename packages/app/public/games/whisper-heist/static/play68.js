// Whisper Heist — play68 / lanrenmb compatibility layer, cleaned for local use.
// No trackers, no external images, no network calls. "More games"/goHome returns
// to the site root; sharing is delegated to the parent app when present.

function play68_init() {
  updateShare(0);
}

function goHome() {
  try {
    if (window.parent && window.parent !== window) window.parent.location.href = '/';
    else window.location.href = '/';
  } catch (e) {
    window.location.href = '/';
  }
}

function clickMore() { goHome(); }

function play68_submitScore(score) {
  updateShareScore(score);
  setTimeout(function () { if (typeof show_share === 'function') show_share(score); }, 600);
}

function dp_share(score) {
  if (typeof show_share === 'function') show_share(score);
}

function updateShare(bestScore) {
  lineLink = window.location.href;
  descContent = '避开灯下守卫，偷走十二只密匣。';
  updateShareScore(bestScore);
  appid = '';
}

function updateShareScore(bestScore) {
  if (bestScore > 0) {
    shareTitle = '声息窃影 · 我在灯下得了 ' + bestScore + ' 分，你呢？';
  } else {
    shareTitle = '声息窃影 · 灯匠夜游第 4 铺';
  }
}

window.goHome = window.goHome || goHome;
window.clickMore = window.clickMore || clickMore;
window.dp_share = window.dp_share || dp_share;
