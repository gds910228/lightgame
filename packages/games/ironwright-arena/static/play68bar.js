// Ironwright Arena — local share/home bridge.
// Sharing delegates to the LightGame host (window.parent.handleGlobalShare).
// No external images, trackers, prompts or network calls.

var HOME_PATH = HOME_PATH || '/';
var RESOURCE_IMG_PATH = RESOURCE_IMG_PATH || 'static/';
var HORIZONTAL = HORIZONTAL || false;
var COVER_SHOW_TIME = COVER_SHOW_TIME || 0;
var imgUrl = 'thumbnail.jpg';
var lineLink = window.location.href;
var descContent = 'Ironwright Arena — assemble a forge mech and fight three furnace wardens.';
var shareTitle = 'Ironwright Arena — choose six weapons, six plates and four thrusters, then break three wardens.';
var appid = '';

function callParentShare(score) {
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(score);
      return true;
    }
  } catch (e) { }
  return false;
}

function show_share(score) {
  if (callParentShare(score)) return;
  try {
    if (navigator.share) {
      navigator.share({ title: shareTitle, text: descContent, url: lineLink }).catch(function () { });
    }
  } catch (e) { }
}

function box_show_share(score) { show_share(score); }
function show_share_page(score) { show_share(score); }
function shareFriend(score) { show_share(score); }
function shareTimeline(score) { show_share(score); }
function shareWeibo(score) { show_share(score); }
function closeshare() { }
function closewx() { }
function addShareWX() { }
function addWXQR() { }
function addShareButtons() { }
function toggle(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('class', el.getAttribute('class') === 'hide' ? 'show' : 'hide');
}
function delay(el, src, ms) {
  window.setTimeout(function () { if (el) el.setAttribute('src', src); }, ms);
}
function isMobile() {
  return /android|iphone|ipod|blackberry|meego|symbianos|windowsphone|ucbrowser/i.test(navigator.userAgent);
}
function isIOS() { return /iphone|ipod|ios/i.test(navigator.userAgent); }
function isWeixin() { return /MicroMessenger/i.test(navigator.userAgent); }

try {
  window.show_share = window.show_share || show_share;
  window.box_show_share = window.box_show_share || box_show_share;
  window.dp_share = window.dp_share || show_share;
  window.clickMore = window.clickMore || function () { if (typeof goHome === 'function') goHome(); };
} catch (e) { }
try { document.oncontextmenu = function () { return false; }; } catch (e) { }
