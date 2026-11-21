// Shadowspire Ninja — share / home bridge.
// Sharing delegates to the site's window.parent.handleGlobalShare(score);
// "more games" returns to the local site root. No external assets or trackers.

var HOME_PATH = HOME_PATH || '/';
var imgUrl = '';
var lineLink = window.location.href;
var descContent = 'A paper-cut ninja tower climb with wall-jump chains, dash i-frames and lantern dust.';
var shareTitle = 'Shadowspire Ninja 影峰登天';
var appid = '';

function callParentShare(score) {
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(Number(score) || 0);
      return true;
    }
  } catch (e) { }
  return false;
}

function show_share(score) {
  if (callParentShare(score)) return;
  if (navigator.share) {
    navigator.share({ title: shareTitle, text: descContent, url: lineLink }).catch(function () { });
  }
}

function dp_share(score) {
  show_share(Number(score) || 0);
}

// legacy aliases
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

if (typeof play68_init === 'function') {
  try { play68_init(); } catch (e) { }
}

document.oncontextmenu = function () { return false; };
