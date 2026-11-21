// Orbit Kart Grand Prix - play68 compatibility layer
// Self-contained: home button always returns to the LightGame home page.

function play68_init() {
  try { updateShare(0); } catch (e) {}
}

function goHome() {
  try {
    if (window.parent && window.parent !== window) window.parent.location.href = '/';
    else window.location.href = '/';
  } catch (e) {
    try { window.location.href = '/'; } catch (e2) {}
  }
}

// Legacy aliases kept for platform compatibility.
function clickMore() { goHome(); }

function play68_submitScore(score) {
  try { updateShareScore(score); } catch (e) {}
  setTimeout(function () { try { show_share(score); } catch (e) {} }, 600);
}

function updateShare(bestScore) {
  window.imgUrl = 'static/icon.svg';
  window.lineLink = window.location.href;
  window.descContent = 'Can you hold the racing line for three laps?';
  updateShareScore(bestScore);
  window.appid = '';
}

function updateShareScore(bestScore) {
  var n = Number(bestScore) || 0;
  window.shareTitle = n > 0
    ? 'Orbit Kart Grand Prix - I scored ' + n + '! Can you beat me?'
    : 'Orbit Kart Grand Prix - drift, boost and win the star-ring circuit!';
}
