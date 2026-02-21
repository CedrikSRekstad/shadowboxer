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
    var landedDarts = [];      // {x, y, player, score, label, angle}

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

    // ── Visual effects state ──
    var ripples = [];          // {x, y, radius, maxRadius, alpha, color}
    var scorePopups = [];      // {x, y, text, life, maxLife, color, vy}
    var particles = [];        // {x, y, vx, vy, life, maxLife, color, size}
    var bullseyeFlash = 0;     // timer for bullseye flash effect
    var dartTrail = [];        // {x, y, alpha} trail points during flight

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

        // Reset visual effects
        ripples = [];
        scorePopups = [];
        particles = [];
        bullseyeFlash = 0;
        dartTrail = [];

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

        // Reset trail
        dartTrail = [];

        CGameAudio.play('whoosh');
    }

    function onDartLanded() {
        var dx = dartAnim.endX - boardCX;
        var dy = dartAnim.endY - boardCY;
        var result = calcScore(dx, dy);

        // Compute dart angle from flight path
        var flightAngle = Math.atan2(
            dartAnim.endY - dartAnim.startY,
            dartAnim.endX - dartAnim.startX
        );

        var dart = {
            x: dartAnim.endX,
            y: dartAnim.endY,
            player: currentPlayer,
            score: result.points,
            label: result.label,
            angle: flightAngle
        };

        landedDarts.push(dart);
        dartsThrown++;
        players[currentPlayer].totalDarts++;
        turnScores.push(result.points);

        // Spawn impact ripple
        spawnRipple(dart.x, dart.y, result.points);

        // Spawn score popup
        spawnScorePopup(dart.x, dart.y, result);

        // Bullseye celebration
        if (result.isBull && result.points === 50) {
            spawnBullseyeCelebration(dart.x, dart.y);
            bullseyeFlash = 0.5;
        }

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

        // Update visual effects
        updateRipples(dt);
        updateScorePopups(dt);
        updateParticles(dt);
        if (bullseyeFlash > 0) bullseyeFlash -= dt;
    }

    // ── Visual Effects Update ──
    function updateRipples(dt) {
        for (var i = ripples.length - 1; i >= 0; i--) {
            var r = ripples[i];
            r.radius += dt * 120;
            r.alpha -= dt * 2.0;
            if (r.alpha <= 0 || r.radius >= r.maxRadius) {
                ripples.splice(i, 1);
            }
        }
    }

    function updateScorePopups(dt) {
        for (var i = scorePopups.length - 1; i >= 0; i--) {
            var p = scorePopups[i];
            p.life -= dt;
            p.y += p.vy * dt;
            if (p.life <= 0) {
                scorePopups.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 80 * dt; // gravity
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function spawnRipple(x, y, points) {
        var col = points >= 40 ? '#ffd700' : points > 0 ? '#ffffff' : '#ff4444';
        var maxR = points >= 40 ? 50 : 30;
        ripples.push({ x: x, y: y, radius: 3, maxRadius: maxR, alpha: 0.7, color: col });
        if (points >= 40) {
            ripples.push({ x: x, y: y, radius: 1, maxRadius: 65, alpha: 0.4, color: col });
        }
    }

    function spawnScorePopup(x, y, result) {
        var text, color;
        if (result.points === 0) {
            text = 'MISS';
            color = '#ff4444';
        } else if (result.isBull && result.points === 50) {
            text = 'BULLSEYE!';
            color = '#ffd700';
        } else if (result.isBull && result.points === 25) {
            text = 'BULL 25';
            color = '#ffcc00';
        } else if (result.label.charAt(0) === 'T') {
            text = 'TRIPLE ' + result.label.substring(1, result.label.indexOf(' ')) + '!';
            color = '#ff6600';
        } else if (result.label.charAt(0) === 'D') {
            text = 'DOUBLE ' + result.label.substring(1, result.label.indexOf(' '));
            color = '#44ccff';
        } else {
            text = '+' + result.points;
            color = '#ffffff';
        }
        scorePopups.push({
            x: x,
            y: y - 15,
            text: text,
            life: 1.5,
            maxLife: 1.5,
            color: color,
            vy: -45
        });
    }

    function spawnBullseyeCelebration(x, y) {
        var goldColors = ['#ffd700', '#ffaa00', '#ffee44', '#fff4b0', '#ff8800'];
        for (var i = 0; i < 30; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 40 + Math.random() * 120;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: 0.8 + Math.random() * 0.7,
                maxLife: 1.5,
                color: goldColors[Math.floor(Math.random() * goldColors.length)],
                size: 1.5 + Math.random() * 3
            });
        }
    }

    // ── Determine which segment the crosshair is aiming at ──
    function getAimedSegmentIndex() {
        var dx = crosshair.x - boardCX;
        var dy = crosshair.y - boardCY;
        var angle = Math.atan2(dy, dx);
        var segAngle = angle + Math.PI / 2 + SEGMENT_ANGLE / 2;
        if (segAngle < 0) segAngle += Math.PI * 2;
        if (segAngle >= Math.PI * 2) segAngle -= Math.PI * 2;
        var segIndex = Math.floor(segAngle / SEGMENT_ANGLE);
        if (segIndex < 0) segIndex = 0;
        if (segIndex > 19) segIndex = 19;
        return segIndex;
    }

    // ── Rendering ──
    function render() {
        // Clear
        var style = getComputedStyle(document.body);
        var bgColor = style.getPropertyValue('--canvas-bg').trim() || '#0d0d1a';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        drawBoardShadow();
        drawDartboard();
        drawRipples();
        drawLandedDarts();
        drawDartAnimation();
        drawParticles();
        drawScorePopups();
        if (canThrow && !waitingNextTurn && !bustShowing) {
            drawCrosshair();
        }
    }

    // ── Board Shadow ──
    function drawBoardShadow() {
        var cx = boardCX;
        var cy = boardCY;
        var R = boardRadius;

        // Drop shadow - dark circle offset down-right
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx + R * 0.03, cy + R * 0.04, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.filter = 'blur(8px)';
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
    }

    function drawDartboard() {
        var cx = boardCX;
        var cy = boardCY;
        var R = boardRadius;

        // Wood ring around the board
        drawWoodRing(cx, cy, R);

        // Background circle
        ctx.beginPath();
        ctx.arc(cx, cy, R * DOUBLE_OUTER_R, 0, Math.PI * 2);
        ctx.fillStyle = COL_BOARD_BG;
        ctx.fill();

        // Get aimed segment for glow effect
        var aimedSeg = -1;
        if (canThrow && !waitingNextTurn && !bustShowing) {
            aimedSeg = getAimedSegmentIndex();
        }

        // Draw segments with gradients
        for (var i = 0; i < 20; i++) {
            var startAngle = -Math.PI / 2 - SEGMENT_ANGLE / 2 + i * SEGMENT_ANGLE;
            var endAngle = startAngle + SEGMENT_ANGLE;

            var isEven = (i % 2 === 0);

            // Outer single (between triple and double)
            drawSegmentGradient(cx, cy, R * TRIPLE_OUTER_R, R * DOUBLE_INNER_R, startAngle, endAngle,
                isEven ? COL_BLACK : COL_WHITE, isEven ? '#2a2a2a' : '#e8dcc0');

            // Inner single (between bull and triple)
            drawSegmentGradient(cx, cy, R * BULL_OUTER_R, R * TRIPLE_INNER_R, startAngle, endAngle,
                isEven ? COL_BLACK : COL_WHITE, isEven ? '#2a2a2a' : '#e8dcc0');

            // Double ring
            drawSegmentGradient(cx, cy, R * DOUBLE_INNER_R, R * DOUBLE_OUTER_R, startAngle, endAngle,
                isEven ? '#e83030' : '#22a83a', isEven ? '#a81818' : '#146820');

            // Triple ring
            drawSegmentGradient(cx, cy, R * TRIPLE_INNER_R, R * TRIPLE_OUTER_R, startAngle, endAngle,
                isEven ? '#e83030' : '#22a83a', isEven ? '#a81818' : '#146820');
        }

        // Outer bull (with gradient)
        var bullGrad = ctx.createRadialGradient(cx, cy, R * BULL_INNER_R, cx, cy, R * BULL_OUTER_R);
        bullGrad.addColorStop(0, '#22a83a');
        bullGrad.addColorStop(1, '#146820');
        ctx.beginPath();
        ctx.arc(cx, cy, R * BULL_OUTER_R, 0, Math.PI * 2);
        ctx.fillStyle = bullGrad;
        ctx.fill();

        // Inner bull (with gradient + optional flash)
        var innerBullGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * BULL_INNER_R);
        if (bullseyeFlash > 0) {
            var flashAlpha = Math.min(1, bullseyeFlash * 2);
            innerBullGrad.addColorStop(0, 'rgba(255, 240, 100, ' + flashAlpha + ')');
            innerBullGrad.addColorStop(0.5, '#ff3030');
            innerBullGrad.addColorStop(1, '#b01515');
        } else {
            innerBullGrad.addColorStop(0, '#e83030');
            innerBullGrad.addColorStop(1, '#a81818');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, R * BULL_INNER_R, 0, Math.PI * 2);
        ctx.fillStyle = innerBullGrad;
        ctx.fill();

        // Wire lines with 3D metallic effect
        drawWires(cx, cy, R);

        // Numbers with glow for aimed segment
        drawNumbers(cx, cy, R, aimedSeg);
    }

    function drawWoodRing(cx, cy, R) {
        var outerR = R * 1.02;
        var innerR = R * DOUBLE_OUTER_R;

        // Wood base ring
        var woodGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        woodGrad.addColorStop(0, '#5a3a1a');
        woodGrad.addColorStop(0.3, '#6b4423');
        woodGrad.addColorStop(0.6, '#543218');
        woodGrad.addColorStop(1, '#3a2210');
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = woodGrad;
        ctx.fill();

        // Subtle wood grain lines
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#2a1808';
        ctx.lineWidth = 0.5;
        for (var a = 0; a < Math.PI * 2; a += 0.3) {
            ctx.beginPath();
            ctx.arc(cx, cy, innerR + (outerR - innerR) * (0.2 + Math.sin(a * 7) * 0.15), a, a + 0.2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawSegmentGradient(cx, cy, innerR, outerR, startAngle, endAngle, innerColor, outerColor) {
        // Create radial gradient from inner to outer
        var grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(1, outerColor);

        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
    }

    function drawWires(cx, cy, R) {
        // Radial wires with 3D effect
        for (var i = 0; i < 20; i++) {
            var angle = -Math.PI / 2 - SEGMENT_ANGLE / 2 + i * SEGMENT_ANGLE;
            var x1 = cx + Math.cos(angle) * R * BULL_OUTER_R;
            var y1 = cy + Math.sin(angle) * R * BULL_OUTER_R;
            var x2 = cx + Math.cos(angle) * R * DOUBLE_OUTER_R;
            var y2 = cy + Math.sin(angle) * R * DOUBLE_OUTER_R;

            // Dark shadow line
            ctx.beginPath();
            ctx.moveTo(x1 + 0.5, y1 + 0.5);
            ctx.lineTo(x2 + 0.5, y2 + 0.5);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Main wire
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 0.9;
            ctx.stroke();

            // Highlight line
            ctx.beginPath();
            ctx.moveTo(x1 - 0.4, y1 - 0.4);
            ctx.lineTo(x2 - 0.4, y2 - 0.4);
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Ring wires with 3D effect
        var rings = [BULL_INNER_R, BULL_OUTER_R, TRIPLE_INNER_R, TRIPLE_OUTER_R, DOUBLE_INNER_R, DOUBLE_OUTER_R];
        for (var r = 0; r < rings.length; r++) {
            var radius = R * rings[r];

            // Dark shadow
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Main wire
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 0.9;
            ctx.stroke();

            // Highlight
            ctx.beginPath();
            ctx.arc(cx - 0.3, cy - 0.3, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.35)';
            ctx.lineWidth = 0.4;
            ctx.stroke();
        }
    }

    function drawNumbers(cx, cy, R, aimedSeg) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var numSize = Math.max(10, R * 0.065);
        ctx.font = 'bold ' + numSize + 'px "Segoe UI", sans-serif';

        for (var i = 0; i < 20; i++) {
            var angle = -Math.PI / 2 + i * SEGMENT_ANGLE;
            var nx = cx + Math.cos(angle) * R * NUMBER_R;
            var ny = cy + Math.sin(angle) * R * NUMBER_R;

            var isAimed = (i === aimedSeg);

            ctx.save();

            // Glow effect for aimed segment number
            if (isAimed) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#ffd700';
                ctx.fillText(BOARD_NUMBERS[i], nx, ny);
                ctx.shadowBlur = 0;
            }

            ctx.restore();

            // Draw shadow for readability
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(BOARD_NUMBERS[i], nx + 1, ny + 1);

            // Main text
            ctx.fillStyle = isAimed ? '#ffd700' : COL_WHITE;
            ctx.fillText(BOARD_NUMBERS[i], nx, ny);
        }
    }

    // ── Ripple Effects ──
    function drawRipples() {
        for (var i = 0; i < ripples.length; i++) {
            var r = ripples[i];
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = r.alpha;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // ── Particles ──
    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();

            // Small glow
            ctx.save();
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    // ── Score Popups ──
    function drawScorePopups() {
        for (var i = 0; i < scorePopups.length; i++) {
            var p = scorePopups[i];
            var alpha = Math.max(0, p.life / p.maxLife);
            var scale = 0.8 + (1 - alpha) * 0.4;
            var fontSize = Math.max(12, boardRadius * 0.07) * scale;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold ' + fontSize + 'px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text outline
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 3;
            ctx.strokeText(p.text, p.x, p.y);

            // Text fill
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);

            // Glow for high-value hits
            if (p.color === '#ffd700' || p.color === '#ff6600') {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
                ctx.fillText(p.text, p.x, p.y);
            }

            ctx.restore();
        }
    }

    // ── Landed Darts (dart shapes) ──
    function drawLandedDarts() {
        for (var i = 0; i < landedDarts.length; i++) {
            var d = landedDarts[i];
            var col = d.player === 0 ? getCSS('--p1-color') : getCSS('--p2-color');
            var colLight = d.player === 0 ? getCSS('--p1-light') : getCSS('--p2-light');

            drawDartShape(d.x, d.y, d.angle, col, colLight);
        }
    }

    function drawDartShape(x, y, angle, color, lightColor) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // The dart is oriented along the positive X axis (tip at right).
        // Since the dart flies from bottom to target, the tip points toward the board.

        var tipLen = 5;
        var shaftLen = 14;
        var flightLen = 10;
        var shaftWidth = 1.8;
        var flightWidth = 5;

        // Point / tip (silver)
        ctx.beginPath();
        ctx.moveTo(tipLen, 0);
        ctx.lineTo(0, -shaftWidth * 0.6);
        ctx.lineTo(0, shaftWidth * 0.6);
        ctx.closePath();
        ctx.fillStyle = '#ccc';
        ctx.fill();

        // Shaft (darker)
        ctx.fillStyle = '#444';
        ctx.fillRect(-shaftLen, -shaftWidth / 2, shaftLen, shaftWidth);

        // Flight (player colored) - triangle at the back
        ctx.beginPath();
        ctx.moveTo(-shaftLen, 0);
        ctx.lineTo(-shaftLen - flightLen, -flightWidth);
        ctx.lineTo(-shaftLen - flightLen, flightWidth);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Flight outline for visibility
        ctx.strokeStyle = lightColor || '#fff';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Small highlight on shaft
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(-shaftLen, -shaftWidth / 2, shaftLen, shaftWidth * 0.4);

        ctx.restore();
    }

    function drawDartAnimation() {
        if (!dartAnim || dartAnim.done) return;

        var progress = dartAnim.t / dartAnim.duration;
        // Ease out
        var ease = 1 - Math.pow(1 - progress, 3);

        var x = dartAnim.startX + (dartAnim.endX - dartAnim.startX) * ease;
        var y = dartAnim.startY + (dartAnim.endY - dartAnim.startY) * ease;

        var col = dartAnim.player === 0 ? getCSS('--p1-color') : getCSS('--p2-color');
        var colLight = dartAnim.player === 0 ? getCSS('--p1-light') : getCSS('--p2-light');

        // Store trail point
        dartTrail.push({ x: x, y: y, alpha: 1.0 });
        // Fade older trail points
        for (var ti = 0; ti < dartTrail.length; ti++) {
            dartTrail[ti].alpha -= 0.08;
        }
        // Remove dead trail points
        while (dartTrail.length > 0 && dartTrail[0].alpha <= 0) {
            dartTrail.shift();
        }

        // Draw motion trail
        if (dartTrail.length > 1) {
            for (var ti = 1; ti < dartTrail.length; ti++) {
                var t0 = dartTrail[ti - 1];
                var t1 = dartTrail[ti];
                ctx.beginPath();
                ctx.moveTo(t0.x, t0.y);
                ctx.lineTo(t1.x, t1.y);
                ctx.strokeStyle = col;
                ctx.lineWidth = 2.5 * t1.alpha;
                ctx.globalAlpha = t1.alpha * 0.5;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // Calculate flight angle and add spin rotation
        var flightAngle = Math.atan2(
            dartAnim.endY - dartAnim.startY,
            dartAnim.endX - dartAnim.startX
        );
        var spinAngle = flightAngle + Math.sin(progress * Math.PI * 6) * 0.25;

        // Draw rotating dart shape
        drawDartShape(x, y, spinAngle, col, colLight);
    }

    function drawCrosshair() {
        var x = crosshair.x;
        var y = crosshair.y;
        var size = 14;

        ctx.save();

        // Outer reticle rings (pulsing)
        var pulse = 0.4 + Math.sin(aimTime * 5) * 0.2;
        var pulse2 = 0.3 + Math.sin(aimTime * 5 + 1) * 0.15;

        // Outer pulsing reticle circle
        ctx.beginPath();
        ctx.arc(x, y, size + 6 + Math.sin(aimTime * 4) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + pulse2 + ')';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Middle reticle circle
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + pulse + ')';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Glowing crosshair lines
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 6;
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

        // Center dot with glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 200, 50, 0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    function getCSS(prop) {
        return getComputedStyle(document.body).getPropertyValue(prop).trim();
    }

    // ── Start ──
    init();
})();
