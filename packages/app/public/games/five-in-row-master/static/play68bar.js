// Five in Row Master — parent-site share bridge.
// Delegates to GameDetailPage's window.parent.handleGlobalShare(score) when
// embedded; otherwise uses the native share sheet. No tracking, no network.
(function () {
  function callParentShare(score) {
    try {
      if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
        window.parent.handleGlobalShare(score);
        return true;
      }
    } catch (e) { }
    return false;
  }

  function shareScore(score) {
    score = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
    if (callParentShare(score)) return true;
    try {
      if (navigator.share) {
        navigator.share({
          title: 'Five in Row Master 五子棋大师',
          text: '五子棋大师 · 棋盘分 ' + score,
          url: window.location.href
        }).catch(function () { });
        return true;
      }
    } catch (e) { }
    return false;
  }

  window.callParentShare = callParentShare;
  window.dp_share = shareScore;
  window.show_share = shareScore;
  window.box_show_share = shareScore;
  window.show_share_page = shareScore;
  window.shareFriend = function () { };
  window.shareTimeline = function () { };
  window.shareWeibo = function () { };
  window.closeshare = function () { };
  window.closewx = function () { };
  window.addShareWX = function () { };
  window.addWXQR = function () { };
  window.addShareButtons = function () { };
  window.isMobile = function () {
    return /android|iphone|ipod|blackberry|meego|symbianos|windowsphone|ucbrowser/i.test(navigator.userAgent);
  };
  window.isIOS = function () { return /iphone|ipod|ios/i.test(navigator.userAgent); };
  window.isWeixin = function () { return /MicroMessenger/i.test(navigator.userAgent); };
  window.HOME_PATH = window.HOME_PATH || '/';
  window.RESOURCE_IMG_PATH = window.RESOURCE_IMG_PATH || 'static/';
})();
