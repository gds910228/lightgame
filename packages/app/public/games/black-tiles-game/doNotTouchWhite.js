// Black Tiles Game - Simplified Version
(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initGame();
    });

    function initGame() {
        var canvas = document.getElementById('linkScreen');
        if (!canvas) {
            console.error('Canvas not found');
            return;
        }

        var ctx = canvas.getContext('2d');
        var gameState = {
            mode: 'menu', // menu, playing, gameOver
            score: 0,
            tiles: [],
            gameSpeed: 2,
            lastRowTime: 0,
            rowInterval: 2000, // milliseconds between new rows
            animationId: null
        };

        // Game configuration
        var config = {
            tileWidth: canvas.width / 4,
            tileHeight: canvas.height / 4,
            blackTileColor: '#333333',
            whiteTileColor: '#FFFFFF',
            clickedTileColor: '#666666',
            borderWidth: 3  // Add border width for better visibility
        };

        // Menu buttons
        var buttons = [
            { x: 0, y: 0, width: canvas.width / 2, height: canvas.height / 3, text: 'Classic', action: startGame },
            { x: canvas.width / 2, y: 0, width: canvas.width / 2, height: canvas.height / 3, text: 'Zen', action: startGame },
            { x: 0, y: canvas.height / 3, width: canvas.width / 2, height: canvas.height / 3, text: 'Arcade', action: startGame },
            { x: canvas.width / 2, y: canvas.height / 3, width: canvas.width / 2, height: canvas.height / 3, text: 'Speed', action: startGame },
            { x: 0, y: 2 * canvas.height / 3, width: canvas.width / 2, height: canvas.height / 3, text: 'Relay', action: startGame },
            { x: canvas.width / 2, y: 2 * canvas.height / 3, width: canvas.width / 2, height: canvas.height / 3, text: 'More Games', action: goToHome }
        ];

        // Input handling
        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('touchstart', handleTouch);

        function handleClick(event) {
            var rect = canvas.getBoundingClientRect();
            var x = (event.clientX - rect.left) * (canvas.width / rect.width);
            var y = (event.clientY - rect.top) * (canvas.height / rect.height);
            processInput(x, y);
        }

        function handleTouch(event) {
            event.preventDefault();
            var rect = canvas.getBoundingClientRect();
            var touch = event.touches[0];
            var x = (touch.clientX - rect.left) * (canvas.width / rect.width);
            var y = (touch.clientY - rect.top) * (canvas.height / rect.height);
            processInput(x, y);
        }

        function processInput(x, y) {
            if (gameState.mode === 'menu') {
                // Check button clicks
                for (var i = 0; i < buttons.length; i++) {
                    var btn = buttons[i];
                    if (x >= btn.x && x < btn.x + btn.width && y >= btn.y && y < btn.y + btn.height) {
                        btn.action();
                        return;
                    }
                }
            } else if (gameState.mode === 'playing') {
                // Check tile clicks with expanded click area for better usability
                for (var row = 0; row < gameState.tiles.length; row++) {
                    for (var col = 0; col < gameState.tiles[row].length; col++) {
                        var tile = gameState.tiles[row][col];
                        var tileX = col * config.tileWidth;
                        var tileY = tile.y;

                        // Expanded click area (add 10px padding around tiles)
                        var clickPadding = 10;
                        var expandedX = tileX - clickPadding;
                        var expandedY = tileY - clickPadding;
                        var expandedWidth = config.tileWidth + clickPadding * 2;
                        var expandedHeight = config.tileHeight + clickPadding * 2;

                        if (x >= expandedX && x < expandedX + expandedWidth &&
                            y >= expandedY && y < expandedY + expandedHeight &&
                            !tile.clicked) {
                            handleTileClick(tile);
                            return;
                        }
                    }
                }
            } else if (gameState.mode === 'gameOver') {
                // Check restart and home buttons with larger click area
                var buttonWidth = 120;
                var buttonHeight = 50;
                var buttonY = canvas.height - buttonHeight - 20;
                var clickPadding = 10;

                // Restart button with expanded area
                if (x >= canvas.width / 2 - buttonWidth - clickPadding &&
                    x < canvas.width / 2 + clickPadding &&
                    y >= buttonY - clickPadding && y < buttonY + buttonHeight + clickPadding) {
                    startGame();
                    return;
                }

                // Home button with expanded area
                if (x >= canvas.width / 2 + clickPadding &&
                    x < canvas.width / 2 + buttonWidth + clickPadding &&
                    y >= buttonY - clickPadding && y < buttonY + buttonHeight + clickPadding) {
                    showMenu();
                    return;
                }
            }
        }

        function handleTileClick(tile) {
            if (tile.type === 'black') {
                tile.clicked = true;
                tile.color = config.clickedTileColor;
                gameState.score++;

                console.log('Score:', gameState.score, 'Current speed:', gameState.gameSpeed, 'Interval:', gameState.rowInterval);

                // More gradual difficulty increase
                if (gameState.score % 15 === 0 && gameState.gameSpeed < 5.0) {
                    gameState.gameSpeed += 0.3;
                    if (gameState.rowInterval > 1200) {
                        gameState.rowInterval -= 150;
                    }
                    console.log('Difficulty increased! New speed:', gameState.gameSpeed, 'New interval:', gameState.rowInterval);
                }
            } else if (tile.type === 'white') {
                gameOver();
            }
        }

        function startGame() {
            console.log('Starting new game - resetting all game state');

            // Cancel any existing animation frame
            if (gameState.animationId) {
                cancelAnimationFrame(gameState.animationId);
                gameState.animationId = null;
            }

            // Completely reset game state
            gameState.mode = 'playing';
            gameState.score = 0;
            gameState.tiles = [];
            gameState.lastRowTime = Date.now();

            // Force reset game speed to initial values
            gameState.gameSpeed = 2.0;  // Start with slow speed
            gameState.rowInterval = 2500;  // Longer intervals between rows

            console.log('Game initialized with speed:', gameState.gameSpeed, 'interval:', gameState.rowInterval);

            // Create initial rows with proper spacing
            for (var i = 0; i < 4; i++) {
                addRow(-(i + 1) * config.tileHeight);
            }

            // Start game loop with a small delay to ensure proper initialization
            setTimeout(function() {
                gameLoop();
            }, 100);
        }

        function showMenu() {
            gameState.mode = 'menu';
            gameState.tiles = [];
            gameLoop();
        }

        function gameOver() {
            gameState.mode = 'gameOver';
            gameLoop();
        }

        function goToHome() {
            window.location.href = '/';
        }

        function addRow(yPosition) {
            // Ensure each row has exactly one black tile
            var blackTileIndex = Math.floor(Math.random() * 4);
            var row = [];

            for (var i = 0; i < 4; i++) {
                row.push({
                    type: i === blackTileIndex ? 'black' : 'white',
                    color: i === blackTileIndex ? config.blackTileColor : config.whiteTileColor,
                    y: yPosition || 0,
                    clicked: false,
                    rowId: Date.now() + Math.random() // Unique identifier for this row
                });
            }

            gameState.tiles.push(row);
        }

        function updateGame() {
            if (gameState.mode !== 'playing') return;

            var currentTime = Date.now();

            // Add new row periodically
            if (currentTime - gameState.lastRowTime > gameState.rowInterval) {
                addRow(-config.tileHeight);
                gameState.lastRowTime = currentTime;
            }

            // Move tiles down
            for (var row = 0; row < gameState.tiles.length; row++) {
                for (var col = 0; col < gameState.tiles[row].length; col++) {
                    gameState.tiles[row][col].y += gameState.gameSpeed;
                }
            }

            // Remove rows that are off screen
            gameState.tiles = gameState.tiles.filter(function(row) {
                return row[0].y < canvas.height + config.tileHeight;
            });

            // Only check game over condition for the lowest visible row
            // This prevents premature game over when tiles are still moving
            if (gameState.tiles.length > 0) {
                var lowestRow = gameState.tiles[gameState.tiles.length - 1];
                var lowestVisibleRow = null;

                // Find the row that's actually at the bottom of the screen
                for (var i = gameState.tiles.length - 1; i >= 0; i--) {
                    var row = gameState.tiles[i];
                    if (row[0].y + config.tileHeight >= canvas.height * 0.8) { // Check if row is in bottom 20% of screen
                        lowestVisibleRow = row;
                        break;
                    }
                }

                // Only game over if a black tile in the bottom area hasn't been clicked
                if (lowestVisibleRow) {
                    for (var col = 0; col < lowestVisibleRow.length; col++) {
                        var tile = lowestVisibleRow[col];
                        if (tile.type === 'black' && !tile.clicked && tile.y > canvas.height * 0.8) {
                            gameOver();
                            return;
                        }
                    }
                }
            }
        }

        function render() {
            // Clear canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (gameState.mode === 'menu') {
                renderMenu();
            } else if (gameState.mode === 'playing') {
                renderGame();
            } else if (gameState.mode === 'gameOver') {
                renderGameOver();
            }
        }

        function renderMenu() {
            // Draw menu buttons
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (var i = 0; i < buttons.length; i++) {
                var btn = buttons[i];

                // Button background
                ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#2a2a2a';
                ctx.fillRect(btn.x, btn.y, btn.width, btn.height);

                // Button border
                ctx.strokeStyle = '#444444';
                ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

                // Button text
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(btn.text, btn.x + btn.width / 2, btn.y + btn.height / 2);
            }
        }

        function renderGame() {
            // Draw tiles
            for (var row = 0; row < gameState.tiles.length; row++) {
                for (var col = 0; col < gameState.tiles[row].length; col++) {
                    var tile = gameState.tiles[row][col];
                    var x = col * config.tileWidth + config.borderWidth;
                    var y = tile.y + config.borderWidth;
                    var width = config.tileWidth - config.borderWidth * 2;
                    var height = config.tileHeight - config.borderWidth * 2;

                    // Fill tile with color
                    ctx.fillStyle = tile.color;
                    ctx.fillRect(x, y, width, height);

                    // Draw border with better visibility
                    ctx.strokeStyle = '#666666';
                    ctx.lineWidth = config.borderWidth;
                    ctx.strokeRect(x, y, width, height);

                    // Add highlight for black tiles to make them more clickable
                    if (tile.type === 'black' && !tile.clicked) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.fillRect(x + width * 0.1, y + height * 0.1, width * 0.8, height * 0.8);
                    }
                }
            }

            // Draw score and game info
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('Score: ' + gameState.score, 15, 15);

            // Draw speed indicator
            ctx.font = '14px Arial';
            ctx.fillText('Speed: ' + gameState.gameSpeed.toFixed(1), 15, 40);
        }

        function renderGameOver() {
            // Game over text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '30px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 50);

            ctx.font = '20px Arial';
            ctx.fillText('Final Score: ' + gameState.score, canvas.width / 2, canvas.height / 2);

            // Draw restart and home buttons
            var buttonWidth = 100;
            var buttonHeight = 40;
            var buttonY = canvas.height - buttonHeight - 20;

            // Restart button
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(canvas.width / 2 - buttonWidth - 10, buttonY, buttonWidth, buttonHeight);
            ctx.strokeStyle = '#444444';
            ctx.strokeRect(canvas.width / 2 - buttonWidth - 10, buttonY, buttonWidth, buttonHeight);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '16px Arial';
            ctx.fillText('Restart', canvas.width / 2 - buttonWidth / 2 - 10, buttonY + buttonHeight / 2);

            // Home button
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(canvas.width / 2 + 10, buttonY, buttonWidth, buttonHeight);
            ctx.strokeStyle = '#444444';
            ctx.strokeRect(canvas.width / 2 + 10, buttonY, buttonWidth, buttonHeight);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('Home', canvas.width / 2 + buttonWidth / 2 + 10, buttonY + buttonHeight / 2);
        }

        function gameLoop() {
            updateGame();
            render();

            if (gameState.mode !== 'menu' || gameState.animationId) {
                gameState.animationId = requestAnimationFrame(gameLoop);
            }
        }

        // Start with menu
        showMenu();
    }
})();