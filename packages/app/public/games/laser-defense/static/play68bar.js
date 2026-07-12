// Laser Defense - share/home bridge (cleaned from legacy play68/lanrenmb platform)
// 2026-07-11 cleanup: removed baidu/cnzz trackers, external image links, WeChat QR UI,
// onbeforeunload prompt. Share now delegates to parent app's ShareButton via
// window.parent.handleGlobalShare (exposed by GameDetailPage).
// All function/variable names kept for backward compat with game logic (gm12.min.js).

function isMobile() {
	return navigator.userAgent.match(/android|iphone|ipod|blackberry|meego|symbianos|windowsphone|ucbrowser/i);
}
function isIOS() {
	return navigator.userAgent.match(/iphone|ipod|ios/i);
}
function isWeixin() {
	return /MicroMessenger/i.test(navigator.userAgent);
}
function toggle(e) {
	var t = document.getElementById(e);
	if (!t) return;
	t.setAttribute("class", t.getAttribute("class") === "hide" ? "show" : "hide");
}
function delay(e, t, n) {
	window.setTimeout(function() { if (e) e.setAttribute("src", t); }, n);
}

// Global config (local paths only; kept for backward compat)
var HOME_PATH = HOME_PATH || "/",
	RESOURCE_IMG_PATH = RESOURCE_IMG_PATH || "static/",
	HORIZONTAL = HORIZONTAL || false,
	COVER_SHOW_TIME = COVER_SHOW_TIME || 2000;
var imgUrl = "static/icon.png";
var lineLink = window.location.href;
var descContent = "Can your fingers draw faster than mine?";
var shareTitle = "Laser Defense - draw laser lines to defend your base!";
var appid = "";

// Share: delegate to parent app's ShareButton (GameDetailPage exposes window.handleGlobalShare)
function callParentShare(score) {
	try {
		if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
			window.parent.handleGlobalShare(score);
			return true;
		}
	} catch (e) {}
	return false;
}
function show_share() {
	if (!callParentShare() && navigator.share) {
		navigator.share({ title: shareTitle, text: descContent, url: lineLink }).catch(function() {});
	}
}
function box_show_share() { show_share(); }
function show_share_page() { show_share(); }

// Legacy stubs (no-op) - kept so any game call won't crash
function shareFriend() {}
function shareTimeline() {}
function shareWeibo() {}
function closeshare() {}
function closewx() {}
function addShareWX() {}
function addWXQR() {}
function addShareButtons() {}

// Init
if (typeof play68_init === 'function') {
	play68_init();
}

document.oncontextmenu = function() { return false; };
