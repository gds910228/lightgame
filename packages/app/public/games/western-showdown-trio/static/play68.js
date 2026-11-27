// Western Showdown Trio — local play68 compatibility layer (no external services).
// "More games" returns to the hosting site root.
(function () {
  function goHome() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.location.href = '/';
        return;
      }
    } catch (e) { }
    try { window.location.href = '/'; } catch (e2) { }
  }

  window.goHome = goHome;
  window.clickMore = goHome;
  window.play68_home = goHome;
  window.play68_init = function () { };
  window.play68_submitScore = function (score) {
    if (typeof window.dp_share === 'function') {
      try { window.dp_share(score); } catch (e) { }
    }
  };
})();
