// Laser Defense - play68 compat layer
// Cleaned from legacy lanrenmb.com platform (2026-07-11):
// - goHome now navigates to site home "/" (was external lanrenmb URL)
// - share delegates to parent app's ShareButton (see play68bar.js)

function play68_init() {
	updateShare(0);
}

function goHome() {
	// "More games" button -> site home page
	try {
		if (window.parent && window.parent !== window) {
			window.parent.location.href = '/';
		} else {
			window.location.href = '/';
		}
	} catch (e) {
		window.location.href = '/';
	}
}

function play68_submitScore(score) {
	updateShareScore(score);
	setTimeout(function() { show_share(score); }, 1000);
}

function updateShare(bestScore) {
	imgUrl = 'static/icon.png';
	lineLink = window.location.href;
	descContent = "Can your fingers draw faster than mine?";
	updateShareScore(bestScore);
	appid = '';
}

function updateShareScore(bestScore) {
	if (bestScore > 0) {
		shareTitle = "Laser Defense - I scored " + bestScore + "! Can you beat me?";
	} else {
		shareTitle = "Laser Defense - draw laser lines to defend your base!";
	}
}
