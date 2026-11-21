// Whisper Heist — share/home bridge. Delegates sharing to the parent app's
// ShareButton (window.parent.handleGlobalShare) with a graceful fallback.
// Keeps legacy names so any external launcher keeps working.

var HOME_PATH = HOME_PATH || '/';
var HORIZONTAL = HORIZONTAL || false;
var lineLink = window.location.href;
var descContent = '避开灯下守卫，偷走十二只密匣。';
var shareTitle = '声息窃影 · 灯匠夜游第 4 铺';
var appid = '';

function callParentShare(score) {
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(score);
      return true;
    }
  } catch (e) {}
  return false;
}

function show_share(score) {
  if (typeof updateShareScore === 'function') updateShareScore(score || 0);
  if (callParentShare(score)) return;
  if (navigator.share) {
    navigator.share({ title: shareTitle, text: descContent, url: lineLink }).catch(function () {});
  }
}
function box_show_share(score) { show_share(score); }
function show_share_page(score) { show_share(score); }
function shareFriend(score) { show_share(score); }
function shareTimeline(score) { show_share(score); }
function shareWeibo(score) { show_share(score); }

// legacy no-ops
function closeshare() {}
function closewx() {}
function addShareWX() {}
function addWXQR() {}
function addShareButtons() {}

if (typeof play68_init === 'function') play68_init();

document.oncontextmenu = function () { return false; };
