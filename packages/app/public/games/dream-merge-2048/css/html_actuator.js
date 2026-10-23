function HTMLActuator() {
    this.tileContainer = document.querySelector(".tile-container"),
    this.scoreContainer = document.querySelector(".score-container"),
    this.bestContainer = document.querySelector(".best-container"),
    this.messageContainer = document.querySelector(".game-message"),
    this.steps_num = 0,
    this.score = 0
}
HTMLActuator.prototype.actuate = function(e, t) {
    var n = this;
    window.requestAnimationFrame(function() {
        n.clearContainer(n.tileContainer),
        e.cells.forEach(function(e) {
            e.forEach(function(e) {
                e && n.addTile(e)
            })
        }),
        n.updateScore(t.score),
        n.updateBestScore(t.bestScore),
        t.terminated && (t.over ? n.message(!1) : t.won && n.message(!0))
    })
},
HTMLActuator.prototype.continueGame = function() {
    this.clearMessage()
},
HTMLActuator.prototype.clearContainer = function(e) {
    while (e.firstChild) e.removeChild(e.firstChild)
},
HTMLActuator.prototype.addTile = function(e) {
    var t = this,
    n = document.createElement("div"),
    r = document.createElement("div"),
    i = e.previousPosition || {
        x: e.x,
        y: e.y
    },
    s = this.positionClass(i),
    o = ["tile", "tile-" + e.value, s];
    e.value > 512 && o.push("tile-super"),
    this.applyClasses(n, o),
    r.classList.add("tile-inner");
    switch (e.value) {
    case 2:
        r.textContent = "I Want Love";
        break;
    case 4:
        r.textContent = "New Phone";
        break;
    case 8:
        r.textContent = "Travel Abroad";
        break;
    case 16:
        r.textContent = "World Cup";
        break;
    case 32:
        r.textContent = "Champion";
        break;
    case 64:
        r.textContent = "Legend";
        break;
    case 128:
        r.textContent = "Big City";
        break;
    case 256:
        r.textContent = "Find a Dream"
        break;
    case 512:
        r.textContent = "Dream Come True"
    }
    e.previousPosition ? window.requestAnimationFrame(function() {
        o[2] = t.positionClass({
            x: e.x,
            y: e.y
        }),
        t.applyClasses(n, o)
    }) : e.mergedFrom ? (o.push("tile-merged"), this.applyClasses(n, o), e.mergedFrom.forEach(function(e) {
        t.addTile(e)
    })) : (o.push("tile-new"), this.applyClasses(n, o)),
    n.appendChild(r),
    this.tileContainer.appendChild(n)
},
HTMLActuator.prototype.applyClasses = function(e, t) {
    e.setAttribute("class", t.join(" "))
},
HTMLActuator.prototype.normalizePosition = function(e) {
    return {
        x: e.x + 1,
        y: e.y + 1
    }
},
HTMLActuator.prototype.positionClass = function(e) {
    return e = this.normalizePosition(e),
    "tile-position-" + e.x + "-" + e.y
},
HTMLActuator.prototype.updateScore = function(e) {
    this.clearContainer(this.scoreContainer);
    var t = e - this.score;
    this.score = e,
    this.scoreContainer.textContent = this.score,
    share_score = this.score;
    if (t > 0) {
        var n = document.createElement("div");
        n.classList.add("score-addition"),
        n.textContent = "+" + t,
        this.scoreContainer.appendChild(n)
    }
},
HTMLActuator.prototype.updateBestScore = function(e) {
    this.bestContainer.textContent = e
},
HTMLActuator.prototype.message = function(e) {
    var t = e ? "game-won": "game-over",
    n = e ? "You did it!": "Game over!";
    this.messageContainer.classList.add(t),
    this.messageContainer.getElementsByTagName("p")[0].textContent = n
},
HTMLActuator.prototype.clearMessage = function() {
    this.messageContainer.classList.remove("game-won"),
    this.messageContainer.classList.remove("game-over")
}