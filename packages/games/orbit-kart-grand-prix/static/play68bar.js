// Orbit Kart Grand Prix - parent-app share bridge.
// Share delegates to the site's ShareButton; no trackers, no external requests.

var HOME_PATH = HOME_PATH || '/';
var imgUrl = 'static/icon.svg';
var lineLink = window.location.href;
var descContent = 'Can you hold the racing line for three laps?';
var shareTitle = 'Orbit Kart Grand Prix - drift, boost and win the star-ring circuit!';
var appid = '';

function callParentShare(score) {
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(Number(score) || 0);
      return true;
    }
  } catch (e) {}
  return false;
}

function show_share(score) {
  if (callParentShare(score)) return;
  try {
    if (navigator.share) {
      navigator.share({ title: shareTitle, text: descContent, url: lineLink }).catch(function () {});
    }
  } catch (e) {}
}

function dp_share(score) { show_share(score); }
function box_show_share(score) { show_share(score); }
function show_share_page(score) { show_share(score); }
function shareFriend(score) { show_share(score); }
function shareTimeline(score) { show_share(score); }
function shareWeibo(score) { show_share(score); }
function closeshare() {}
function closewx() {}
function addShareWX() {}
function addWXQR() {}
function addShareButtons() {}
function isMobile() {
  return /android|iphone|ipod|blackberry|meego|symbianos|windowsphone|ucbrowser/i.test(navigator.userAgent);
}
function isIOS() { return /iphone|ipod|ios/i.test(navigator.userAgent); }
function isWeixin() { return /MicroMessenger/i.test(navigator.userAgent); }
function toggle(el) {
  var t = document.getElementById(el);
  if (t) t.setAttribute('class', t.getAttribute('class') === 'hide' ? 'show' : 'hide');
}

if (typeof play68_init === 'function') {
  try { play68_init(); } catch (e) {}
}
document.oncontextmenu = function () { return false; };
