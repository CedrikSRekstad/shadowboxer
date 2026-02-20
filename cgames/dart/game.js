/* === Dart Game === */
(function () {
    'use strict';

    // ── Constants ──
    var BOARD_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    var SEGMENT_ANGLE = Math.PI * 2 / 20;
    var FREE_PLAY_ROUNDS = 10;

    // Board radii as fractions of board radius
    var BULL_INNER_R = 0.032;   // inner bull (50pts)
    var BULL_OUTER_R = 0.08;    // outer bull (25pts)
    var TRIPLE_INNER_R = 0.485;
    var TRIPLE_OUTER_R = 0.535;
    var DOUBLE_INNER_R = 0.89;
    var DOUBLE_OUTER_R = 0.95;
    var SINGLE_INNER_R = 0.08;  // start of singles after bull
    var NUMBER_R = 0.98;        // where numbers are drawn

    // Colors
    var COL_BLACK = '#1a1a1a';
    var COL_WHITE = '#f0e6d0';
    var COL_RED = '#d42020';
    var COL_GREEN = '#1b8a2a';
    var COL_WIRE = '#888';
    var COL_BOARD_BG = '#2a2a20';

    // ── State ──
    var canvas, ctx;
    var W, H;
    var boardCX, boardCY, boardRadius;
    var gameMode = '301';      // '301', '501', 'free'
    var numPlayers = 1;
    var currentPlayer = 0;     // 0 or 1
    var dartsThrown = 0;       // 0-2 in current turn
    var paused = false;
    var gameOver = false;
    var waitingNextTurn = false;
    var waitTimer = 0;
    var bustShowing = false;
    var bustTimer = 0;

    var players = [];
    var landedDarts = [];      // {x, y, player, score, label}

    // Crosshair state
    var crosshair = { x: 0, y: 0 };
    var aimTime = 0;
    var aimSpeedBase = 1.0;

    // Dart animation state
    var dartAnim = null; // { startX, startY, endX, endY, t, duration, player, done }

    // Throw state
    var canThrow = true;

    // Turn score tracking for bust logic
    var turnStartScore = 0;
    var turnScores = [];

    // Round tracking for free play
    var currentRound = 1;

    // ── DOM refs ──
    var elP1Hud, elP2Hud, elP1Score, elP2Score;
    var elTurnInfo, elTurnDarts, elThrowInfo, elLastThrow;
    var elPause, elBust;
    var elWinner, elFinalScore;

    // ── Init ──
    function init() {
        GameShell.init({ backUrl: '../' });

        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');

        elP1Hud = document.getElementById('p1-hud');
        elP2Hud = document.getElementById('p2-hud');
        elP1Score = document.getElementById('hud-p1-score');
        elP2Score = document.getElementById('hud-p2-score');
        elTurnInfo = document.getElementById('turn-info');
        elTurnDarts = document.getElementById('turn-darts');
        elThrowInfo = document.getElementById('throw-info');
        elLastThrow = document.getElementById('last-throw-text');
        elPause = document.getElementById('pause-overlay');
        elBust = document.getElementById('bust-overlay');
        elWinner = document.getElementById('winner-text');
        elFinalScore = document.getElementById('final-score');

        setupMenuEvents();
        setupGameEvents();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        GameShell.showScreen('title-screen');
    }

    // ── Menu ──
    function setupMenuEvents() {
        document.getElementById('btn-1p').addEventListener('click', function () {
            CGameAudio.play('click');
            numPlayers = 1;
            showModeSelect();
        });
        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('click');
            numPlayers = 2;
            showModeSelect();
        });
        document.getElementById('btn-back-players').addEventListener('click', function () {
            CGameAudio.play('back');
            hideModeSelect();
        });

        var modeButtons = document.querySelectorAll('[data-mode]');
        for (var i = 0; i < modeButtons.length; i++) {
            modeButtons[i].addEventListener('click', function () {
                CGameAudio.play('select');
                gameMode = this.getAttribute('data-mode');
                startGame();
            });
        }

        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame();
        });
        document.getElementById('btn-menu').addEventListener('click', function () {
            CGameAudio.play('back');
            hideModeSelect();
            GameShell.showScreen('title-screen');
        });

        document.getElementById('btn-pause').addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });
        document.getElementById('btn-resume').addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });
        document.getElementById('btn-quit').addEventListener('click', function () {
            CGameAudio.play('back');
            paused = false;
            elPause.classList.add('hidden');
            hideModeSelect();
            GameShell.showScreen('title-screen');
        });
    }

    function showModeSelect() {
        document.getElementById('player-select').classList.add('hidden');
        document.getElementById('mode-select').classList.remove('hidden');
    }

    function hideModeSelect() {
        document.getElementById('player-select').classList.remove('hidden');
        document.getElementById('mode-select').classList.add('hidden');
    }

    // ── Game Start ──
    function startGame() {
        var startScore = gameMode === '501' ? 501 : gameMode === '301' ? 301 : 0;

        players = [
            { score: startScore, totalDarts: 0, roundScores: [] },
            { score: startScore, totalDarts: 0, roundScores: [] }
        ];

        currentPlayer = 0;
        dartsThrown = 0;
        landedDarts = [];
        gameOver = false;
        paused = false;
        waitingNextTurn = false;
        bustShowing = false;
        canThrow = true;
        dartAnim = null;
        currentRound = 1;
        turnStartScore = players[0].score;
        turnScores = [];
        aimTime = 0;

        // Update HUD
        if (numPlayers === 2) {
            elP2Hud.classList.remove('hidden');
        } else {
            elP2Hud.classList.add('hidden');
        }

        updateHUD();
        elLastThrow.textContent = 'Press Space / Tap to throw';

        GameShell.showScreen('game-screen');
        elPause.classList.add('hidden');
        elBust.classList.add('hidden');

        resizeCanvas();
        lastTime = 0;
        requestAnimationFrame(gameLoop);
    }

    // ── Input ──
    function setupGameEvents() {
        document.addEventListener('keydown', function (e) {
            if (gameOver) return;
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                attemptThrow();
            }
            if (e.code === 'Escape' || e.code === 'KeyP') {
                togglePause();
            }
        });

        canvas.addEventListener('click', function (e) {
            if (gameOver) return;
            attemptThrow();
        });

        canvas.addEventListener('touchstart', function (e) {
            if (gameOver) return;
            e.preventDefault();
            attemptThrow();
        }, { passive: false });
    }

    function togglePause() {
        if (gameOver) return;
        paused = !paused;
        if (paused) {
            elPause.classList.remove('hidden');
        } else {
            elPause.classList.add('hidden');
            lastTime = 0;
            requestAnimationFrame(gameLoop);
        }
    }

    // ── Throw Logic ──
    function attemptThrow() {
        if (paused || !canThrow || gameOver || waitingNextTurn || bustShowing) return;
        if (dartAnim && !dartAnim.done) return;

        canThrow = false;

        // Calculate target position (crosshair + random spread)
        var spreadFactor = 8 + dartsThrown * 3; // more spread on later darts
        var spread = (Math.random() - 0.5) * boardRadius * 0.04 * spreadFactor / 8;
        var spreadY = (Math.random() - 0.5) * boardRadius * 0.04 * spreadFactor / 8;

        var targetX = crosshair.x + spread;
        var targetY = crosshair.y + spreadY;

        // Start dart animation from bottom of canvas
        dartAnim = {
            startX: boardCX + (Math.random() - 0.5) * 40,
            startY: H + 20,
            endX: targetX,
            endY: targetY,
            t: 0,
            duration: 0.25,
            player: currentPlayer,
            done: false
        };

        CGameAudio.play('whoosh');
    }

    function onDartLanded() {
        var dx = dartAnim.endX - boardCX;
        var dy = dartAnim.endY - boardCY;
        var result = calcScore(dx, dy);

        var dart = {
            x: dartAnim.endX,
            y: dartAnim.endY,
            player: currentPlayer,
            score: result.points,
            label: result.label
        };

        landedDarts.push(dart);
        dartsThrown++;
        players[currentPlayer].totalDarts++;
        turnScores.push(result.points);

        if (result.points >= 40) {
            CGameAudio.play('score');
        } else if (result.points > 0) {
            CGameAudio.play('hit');
        } else {
            CGameAudio.play('click');
        }

        // Score logic
        if (gameMode === 'free') {
            players[currentPlayer].score += result.points;
            elLastThrow.textContent = (currentPlayer === 0 ? 'P1' : 'P2') + ' threw ' + result.label + ' (' + result.points + ')';
            updateHUD();

            if (dartsThrown >= 3) {
                endTurn();
            } else {
                elTurnDarts.textContent = 'Dart ' + (dartsThrown + 1) + '/3';
                canThrow = true;
            }
        } else {
            // 301/501 mode
            var newScore = turnStartScore;
            for (var i = 0; i < turnScores.length; i++) {
                newScore -= turnScores[i];
            }

            // Check bust
            if (newScore < 0 || newScore === 1) {
                // BUST - revert
                players[currentPlayer].score = turnStartScore;
                elLastThrow.textContent = 'BUST! Score reverted to ' + turnStartScore;
                updateHUD();
                showBust();
                return;
            }

            // Check win - must finish on double or bullseye
            if (newScore === 0) {
                if (result.isDouble || result.isBull) {
                    players[currentPlayer].score = 0;
                    updateHUD();
                    CGameAudio.play('win');
                    elLastThrow.textContent = (currentPlayer === 0 ? 'P1' : 'P2') + ' checks out with ' + result.label + '!';
                    endGame();
                    return;
                } else {
                    // Must finish on double - bust
                    players[currentPlayer].score = turnStartScore;
                    elLastThrow.textContent = 'BUST! Must finish on a double or bullseye';
                    updateHUD();
                    showBust();
                    return;
                }
            }

            players[currentPlayer].score = newScore;
            elLastThrow.textContent = (currentPlayer === 0 ? 'P1' : 'P2') + ' threw ' + result.label + ' (' + result.points + ') - Remaining: ' + newScore;
            updateHUD();

            if (dartsThrown >= 3) {
                endTurn();
            } else {
                elTurnDarts.textContent = 'Dart ' + (dartsThrown + 1) + '/3';
                canThrow = true;
            }
        }
    }

    function showBust() {
        bustShowing = true;
        bustTimer = 1.5;
        elBust.classList.remove('hidden');
        CGameAudio.play('error');
        updateHUD();
    }

    function endTurn() {
        waitingNextTurn = true;
        waitTimer = 1.2;

        // Store round scores for free play
        var turnTotal = 0;
        for (var i = 0; i < turnScores.length; i++) turnTotal += turnScores[i];
        players[currentPlayer].roundScores.push(turnTotal);
    }

    function advanceTurn() {
        waitingNextTurn = false;
        dartsThrown = 0;
        turnScores = [];
        landedDarts = [];

        if (numPlayers === 2) {
            currentPlayer = 1 - currentPlayer;
            if (currentPlayer === 0) {
                currentRound++;
            }
        } else {
            currentRound++;
        }

        // Check free play end
        if (gameMode === 'free') {
            var maxRounds = FREE_PLAY_ROUNDS;
            if (numPlayers === 1 && currentRound > maxRounds) {
                endGame();
                return;
            }
            if (numPlayers === 2 && currentRound > maxRounds && currentPlayer === 0) {
                endGame();
                return;
            }
        }

        turnStartScore = players[currentPlayer].score;
        canThrow = true;
        updateHUD();
        elTurnDarts.textContent = 'Dart 1/3';

        var pLabel = currentPlayer === 0 ? 'P1' : 'P2';
        if (gameMode === 'free') {
            elLastThrow.textContent = pLabel + '\'s turn - Round ' + currentRound + '/' + FREE_PLAY_ROUNDS;
        } else {
            elLastThrow.textContent = pLabel + '\'s turn - Remaining: ' + players[currentPlayer].score;
        }
    }

    function endGame() {
        gameOver = true;

        if (gameMode === 'free') {
            if (numPlayers === 1) {
                elWinner.textContent = 'Game Over!';
                elFinalScore.textContent = 'Final Score: ' + players[0].score + ' in ' + players[0].totalDarts + ' darts';
                CGameAudio.play('win');
            } else {
                if (players[0].score > players[1].score) {
                    elWinner.textContent = 'Player 1 Wins!';
                    elWinner.style.color = 'var(--p1-color)';
                } else if (players[1].score > players[0].score) {
                    elWinner.textContent = 'Player 2 Wins!';
                    elWinner.style.color = 'var(--p2-color)';
                } else {
                    elWinner.textContent = 'It\'s a Tie!';
                    elWinner.style.color = 'var(--accent)';
                }
                elFinalScore.textContent = 'P1: ' + players[0].score + ' | P2: ' + players[1].score;
                CGameAudio.play(players[0].score >= players[1].score ? 'win' : 'lose');
            }
        } else {
            // 301/501
            if (numPlayers === 1) {
                elWinner.textContent = 'Checked Out!';
                elWinner.style.color = 'var(--accent)';
                elFinalScore.textContent = 'Finished in ' + players[0].totalDarts + ' darts';
                CGameAudio.play('win');
            } else {
                var winnerIdx = players[0].score === 0 ? 0 : 1;
                elWinner.textContent = 'Player ' + (winnerIdx + 1) + ' Wins!';
                elWinner.style.color = winnerIdx === 0 ? 'var(--p1-color)' : 'var(--p2-color)';
                elFinalScore.textContent = (winnerIdx === 0 ? 'P1' : 'P2') + ' checked out in ' + players[winnerIdx].totalDarts + ' darts';
            }
        }

        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 800);
    }

    // ── Scoring ──
    function calcScore(dx, dy) {
        var dist = Math.sqrt(dx * dx + dy * dy);
        var normDist = dist / boardRadius;
        var angle = Math.atan2(dy, dx);

        // Inner bull
        if (normDist <= BULL_INNER_R) {
            return { points: 50, label: 'Bull (50)', isDouble: false, isBull: true };
        }
        // Outer bull
        if (normDist <= BULL_OUTER_R) {
            return { points: 25, label: 'Bull (25)', isDouble: false, isBull: true };
        }

        // Determine segment
        // Segment 0 (20) is centered at the top (-PI/2), going clockwise
        var segAngle = angle + Math.PI / 2 + SEGMENT_ANGLE / 2;
        if (segAngle < 0) segAngle += Math.PI * 2;
        if (segAngle >= Math.PI * 2) segAngle -= Math.PI * 2;
        var segIndex = Math.floor(segAngle / SEGMENT_ANGLE);
        if (segIndex < 0) segIndex = 0;
        if (segIndex > 19) segIndex = 19;
        var segValue = BOARD_NUMBERS[segIndex];

        // Off the board
        if (normDist > DOUBLE_OUTER_R) {
            return { points: 0, label: 'Miss', isDouble: false, isBull: false };
        }

        // Double ring
        if (normDist >= DOUBLE_INNER_R && normDist <= DOUBLE_OUTER_R) {
            return { points: segValue * 2, label: 'D' + segValue + ' (' + (segValue * 2) + ')', isDouble: true, isBull: false };
        }

        // Triple ring
        if (normDist >= TRIPLE_INNER_R && normDist <= TRIPLE_OUTER_R) {
            return { points: segValue * 3, label: 'T' + segValue + ' (' + (segValue * 3) + ')', isDouble: false, isBull: false };
        }

        // Single
        return { points: segValue, label: '' + segValue, isDouble: false, isBull: false };
    }

    // ── HUD ──
    function updateHUD() {
        if (gameMode === 'free') {
            elP1Score.textContent = players[0].score;
            if (numPlayers === 2) elP2Score.textContent = players[1].score;
        } else {
            elP1Score.textContent = players[0].score;
            if (numPlayers === 2) elP2Score.textContent = players[1].score;
        }

        elP1Hud.classList.toggle('active-turn', currentPlayer === 0);
        if (numPlayers === 2) {
            elP2Hud.classList.toggle('active-turn', currentPlayer === 1);
        }

        elTurnDarts.textContent = 'Dart ' + Math.min(dartsThrown + 1, 3) + '/3';
    }

    // ── Canvas Resize ──
    function resizeCanvas() {
        var container = document.getElementById('canvas-container');
        if (!container) return;
        var rect = container.getBoundingClientRect();
        W = Math.floor(rect.width);
        H = Math.floor(rect.height);
        if (W < 1) W = 400;
        if (H < 1) H = 400;
        canvas.width = W;
        canvas.height = H;

        var size = Math.min(W, H) * 0.88;
        boardRadius = size / 2;
        boardCX = W / 2;
        boardCY = H / 2;
    }

    // ── Game Loop ──
    var lastTime = 0;
    function gameLoop(timestamp) {
        if (paused || gameOver) return;

        if (lastTime === 0) lastTime = timestamp;
        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.05) dt = 0.05;
        if (dt <= 0) dt = 0.016;

        update(dt);
        render();

        requestAnimationFrame(gameLoop);
    }

    function update(dt) {
        // Update aim crosshair
        if (canThrow && !waitingNextTurn && !bustShowing) {
            aimTime += dt;
            var speed = aimSpeedBase + dartsThrown * 0.35;
            // Figure-8 pattern
            var t = aimTime * speed;
            var fx = Math.sin(t * 1.7) * 0.55 + Math.sin(t * 0.6) * 0.3;
            var fy = Math.sin(t * 1.3) * 0.45 + Math.cos(t * 0.9) * 0.35;
            crosshair.x = boardCX + fx * boardRadius * 0.75;
            crosshair.y = boardCY + fy * boardRadius * 0.75;
        }

        // Dart flight animation
        if (dartAnim && !dartAnim.done) {
            dartAnim.t += dt;
            if (dartAnim.t >= dartAnim.duration) {
                dartAnim.t = dartAnim.duration;
                dartAnim.done = true;
                onDartLanded();
            }
        }

        // Wait timer for turn transition
        if (waitingNextTurn) {
            waitTimer -= dt;
            if (waitTimer <= 0) {
                advanceTurn();
            }
        }

        // Bust timer
        if (bustShowing) {
            bustTimer -= dt;
            if (bustTimer <= 0) {
                bustShowing = false;
                elBust.classList.add('hidden');
                // End turn after bust
                dartsThrown = 0;
                turnScores = [];
                landedDarts = [];
                if (numPlayers === 2) {
                    currentPlayer = 1 - currentPlayer;
                    if (currentPlayer === 0) currentRound++;
                } else {
                    currentRound++;
                }
                turnStartScore = players[currentPlayer].score;
                canThrow = true;
                updateHUD();
                var pLabel = currentPlayer === 0 ? 'P1' : 'P2';
                elLastThrow.textContent = pLabel + '\'s turn - Remaining: ' + players[currentPlayer].score;
            }
        }
    }

    // ── Rendering ──
    function render() {
        // Clear
        var style = getComputedStyle(document.body);
        var bgColor = style.getPropertyValue('--canvas-bg').trim() || '#0d0d1a';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        drawDartboard();
        drawLandedDarts();
        drawDartAnimation();
        if (canThrow && !waitingNextTurn && !bustShowing) {
            drawCrosshair();
        }
    }

    function drawDartboard() {
        var cx = boardCX;
        var cy = boardCY;
        var R = boardRadius;

        // Background circle
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = COL_BOARD_BG;
        ctx.fill();

        // Draw segments
        for (var i = 0; i < 20; i++) {
            var startAngle = -Math.PI / 2 - SEGMENT_ANGLE / 2 + i * SEGMENT_ANGLE;
            var endAngle = startAngle + SEGMENT_ANGLE;

            var isEven = (i % 2 === 0);

            // Outer single (between triple and double)
            drawSegment(cx, cy, R * TRIPLE_OUTER_R, R * DOUBLE_INNER_R, startAngle, endAngle,
                isEven ? COL_BLACK : COL_WHITE);

            // Inner single (between bull and triple)
            drawSegment(cx, cy, R * BULL_OUTER_R, R * TRIPLE_INNER_R, startAngle, endAngle,
                isEven ? COL_BLACK : COL_WHITE);

            // Double ring
            drawSegment(cx, cy, R * DOUBLE_INNER_R, R * DOUBLE_OUTER_R, startAngle, endAngle,
                isEven ? COL_RED : COL_GREEN);

            // Triple ring
            drawSegment(cx, cy, R * TRIPLE_INNER_R, R * TRIPLE_OUTER_R, startAngle, endAngle,
                isEven ? COL_RED : COL_GREEN);
        }

        // Outer bull
        ctx.beginPath();
        ctx.arc(cx, cy, R * BULL_OUTER_R, 0, Math.PI * 2);
        ctx.fillStyle = COL_GREEN;
        ctx.fill();

        // Inner bull
        ctx.beginPath();
        ctx.arc(cx, cy, R * BULL_INNER_R, 0, Math.PI * 2);
        ctx.fillStyle = COL_RED;
        ctx.fill();

        // Wire lines
        ctx.strokeStyle = COL_WIRE;
        ctx.lineWidth = 0.8;

        // Radial wires
        for (var i = 0; i < 20; i++) {
            var angle = -Math.PI / 2 - SEGMENT_ANGLE / 2 + i * SEGMENT_ANGLE;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * R * BULL_OUTER_R, cy + Math.sin(angle) * R * BULL_OUTER_R);
            ctx.lineTo(cx + Math.cos(angle) * R * DOUBLE_OUTER_R, cy + Math.sin(angle) * R * DOUBLE_OUTER_R);
            ctx.stroke();
        }

        // Ring wires
        var rings = [BULL_INNER_R, BULL_OUTER_R, TRIPLE_INNER_R, TRIPLE_OUTER_R, DOUBLE_INNER_R, DOUBLE_OUTER_R];
        for (var r = 0; r < rings.length; r++) {
            ctx.beginPath();
            ctx.arc(cx, cy, R * rings[r], 0, Math.PI * 2);
            ctx.stroke();
        }

        // Numbers
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var numSize = Math.max(10, R * 0.065);
        ctx.font = 'bold ' + numSize + 'px "Segoe UI", sans-serif';
        ctx.fillStyle = COL_WHITE;

        for (var i = 0; i < 20; i++) {
            var angle = -Math.PI / 2 + i * SEGMENT_ANGLE;
            var nx = cx + Math.cos(angle) * R * NUMBER_R;
            var ny = cy + Math.sin(angle) * R * NUMBER_R;

            // Draw shadow for readability
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(BOARD_NUMBERS[i], nx + 1, ny + 1);
            ctx.fillStyle = COL_WHITE;
            ctx.fillText(BOARD_NUMBERS[i], nx, ny);
        }
    }

    function drawSegment(cx, cy, innerR, outerR, startAngle, endAngle, color) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawLandedDarts() {
        for (var i = 0; i < landedDarts.length; i++) {
            var d = landedDarts[i];
            var col = d.player === 0 ? getCSS('--p1-color') : getCSS('--p2-color');
            var colLight = d.player === 0 ? getCSS('--p1-light') : getCSS('--p2-light');

            // Dart marker: small circle with inner dot
            ctx.beginPath();
            ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = col;
            ctx.fill();
            ctx.strokeStyle = colLight;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner dot
            ctx.beginPath();
            ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            // Score label
            if (d.label) {
                ctx.font = 'bold ' + Math.max(9, boardRadius * 0.04) + 'px "Segoe UI", sans-serif';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2.5;
                ctx.strokeText(d.label, d.x, d.y - 12);
                ctx.fillText(d.label, d.x, d.y - 12);
            }
        }
    }

    function drawDartAnimation() {
        if (!dartAnim || dartAnim.done) return;

        var progress = dartAnim.t / dartAnim.duration;
        // Ease out
        var ease = 1 - Math.pow(1 - progress, 3);

        var x = dartAnim.startX + (dartAnim.endX - dartAnim.startX) * ease;
        var y = dartAnim.startY + (dartAnim.endY - dartAnim.startY) * ease;

        var col = dartAnim.player === 0 ? getCSS('--p1-color') : getCSS('--p2-color');

        // Trail
        ctx.beginPath();
        ctx.moveTo(dartAnim.startX + (dartAnim.endX - dartAnim.startX) * Math.max(0, ease - 0.2),
            dartAnim.startY + (dartAnim.endY - dartAnim.startY) * Math.max(0, ease - 0.2));
        ctx.lineTo(x, y);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Dart tip
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawCrosshair() {
        var x = crosshair.x;
        var y = crosshair.y;
        var size = 14;

        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.5;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x - 4, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + size, y);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x, y + size);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Outer ring (pulsing)
        var pulse = 0.6 + Math.sin(aimTime * 6) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + pulse + ')';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    function getCSS(prop) {
        return getComputedStyle(document.body).getPropertyValue(prop).trim();
    }

    // ── Start ──
    init();
})();
