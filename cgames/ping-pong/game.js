/* === Ping Pong - Cgames === */
(function () {
    'use strict';

    // ── Constants ──
    var WIN_SCORE = 7;
    var PADDLE_WIDTH_RATIO = 0.015;    // relative to canvas width
    var PADDLE_HEIGHT_RATIO = 0.18;    // relative to canvas height
    var PADDLE_MARGIN_RATIO = 0.03;    // distance from edge
    var BALL_RADIUS_RATIO = 0.012;     // relative to canvas width
    var BALL_SPEED_INITIAL = 0.55;     // relative to canvas width per second
    var BALL_SPEED_INCREMENT = 0.02;   // speed gain per rally hit
    var BALL_SPEED_MAX = 1.2;
    var PADDLE_SPEED = 0.9;            // relative to canvas height per second
    var MAX_BOUNCE_ANGLE = Math.PI / 3; // 60 degrees

    // ── AI Difficulty settings ──
    var AI_SETTINGS = {
        easy:   { reaction: 0.35, errorRange: 60, speedMult: 0.6, predictionNoise: 80 },
        medium: { reaction: 0.6,  errorRange: 30, speedMult: 0.85, predictionNoise: 35 },
        hard:   { reaction: 0.9,  errorRange: 8,  speedMult: 1.0, predictionNoise: 8 }
    };

    // ── State ──
    var canvas, ctx;
    var gameWidth, gameHeight;
    var mode = '1p';          // '1p' or '2p'
    var difficulty = 'medium';
    var paused = false;
    var running = false;
    var lastTime = 0;
    var animFrameId = null;

    // Colors read from CSS
    var colors = {
        canvasBg: '#0d0d1a',
        p1: '#00b4ff',
        p2: '#ff4466',
        accent: '#ffdd00',
        line: 'rgba(255,255,255,0.15)',
        text: '#ffffff'
    };

    // Game objects
    var paddle1, paddle2, ball;
    var score1 = 0, score2 = 0;
    var rallyCount = 0;
    var serveSide = 1; // 1 = left serves, 2 = right serves
    var serveDelay = 0;
    var countdownActive = false;

    // Input state
    var keys = {};
    var touches = {}; // touchId -> { y }

    // AI state
    var aiTargetY = 0;
    var aiError = 0;
    var aiReactionTimer = 0;

    // ── DOM refs ──
    var scoreP1El, scoreP2El;
    var countdownOverlay, countdownNumber;
    var pauseOverlay;

    // ── Initialization ──
    function initGame() {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        scoreP1El = document.getElementById('score-p1');
        scoreP2El = document.getElementById('score-p2');
        countdownOverlay = document.getElementById('countdown-overlay');
        countdownNumber = document.getElementById('countdown-number');
        pauseOverlay = document.getElementById('pause-overlay');

        // Init shared shell
        GameShell.init({ backUrl: '../' });

        setupButtons();
        setupInput();
        readColors();

        // Observe theme changes to update colors
        var observer = new MutationObserver(function () { readColors(); });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

        // Handle resize
        window.addEventListener('resize', onResize);
    }

    function readColors() {
        var style = getComputedStyle(document.documentElement);
        colors.canvasBg = style.getPropertyValue('--canvas-bg').trim() || colors.canvasBg;
        colors.p1 = style.getPropertyValue('--p1-color').trim() || colors.p1;
        colors.p2 = style.getPropertyValue('--p2-color').trim() || colors.p2;
        colors.accent = style.getPropertyValue('--accent').trim() || colors.accent;
        colors.text = style.getPropertyValue('--text-primary').trim() || colors.text;

        // Derive line color from theme
        var theme = document.body.getAttribute('data-theme');
        colors.line = theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
    }

    // ── Button Setup ──
    function setupButtons() {
        var btn1p = document.getElementById('btn-1p');
        var btn2p = document.getElementById('btn-2p');
        var diffSelect = document.getElementById('difficulty-select');
        var diffButtons = diffSelect.querySelectorAll('[data-diff]');
        var btnPause = document.getElementById('btn-pause');
        var btnResume = document.getElementById('btn-resume');
        var btnQuit = document.getElementById('btn-quit');
        var btnPlayAgain = document.getElementById('btn-play-again');
        var btnMenu = document.getElementById('btn-menu');

        btn1p.addEventListener('click', function () {
            CGameAudio.play('select');
            mode = '1p';
            diffSelect.classList.remove('hidden');
        });

        btn2p.addEventListener('click', function () {
            CGameAudio.play('select');
            mode = '2p';
            diffSelect.classList.add('hidden');
            startMatch();
        });

        diffButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                CGameAudio.play('select');
                difficulty = btn.getAttribute('data-diff');
                startMatch();
            });
        });

        btnPause.addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });

        btnResume.addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });

        btnQuit.addEventListener('click', function () {
            CGameAudio.play('back');
            stopGame();
            GameShell.showScreen('title-screen');
            document.getElementById('difficulty-select').classList.add('hidden');
        });

        btnPlayAgain.addEventListener('click', function () {
            CGameAudio.play('select');
            startMatch();
        });

        btnMenu.addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('title-screen');
            document.getElementById('difficulty-select').classList.add('hidden');
        });
    }

    // ── Input ──
    function setupInput() {
        document.addEventListener('keydown', function (e) {
            keys[e.key] = true;
            // Prevent scrolling with arrow keys
            if (['ArrowUp', 'ArrowDown', 'w', 's', ' '].indexOf(e.key) !== -1) {
                e.preventDefault();
            }
            // Escape to pause
            if (e.key === 'Escape' && running) {
                togglePause();
            }
        });

        document.addEventListener('keyup', function (e) {
            keys[e.key] = false;
        });

        // Touch input for paddles
        canvas && canvas.addEventListener('touchstart', handleTouch, { passive: false });
        canvas && canvas.addEventListener('touchmove', handleTouch, { passive: false });
        canvas && canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas && canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    function handleTouch(e) {
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var x = t.clientX - rect.left;
            var y = t.clientY - rect.top;
            // Scale to canvas coordinates
            var scaleX = canvas.width / rect.width;
            var scaleY = canvas.height / rect.height;
            touches[t.identifier] = {
                x: x * scaleX,
                y: y * scaleY,
                side: (x < rect.width / 2) ? 'left' : 'right'
            };
        }
    }

    function handleTouchEnd(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            delete touches[e.changedTouches[i].identifier];
        }
    }

    // ── Canvas resize ──
    function onResize() {
        if (!canvas) return;
        var container = document.getElementById('canvas-container');
        if (!container) return;
        var w = container.clientWidth;
        var h = container.clientHeight;

        // Use device pixel ratio for sharp rendering
        var dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        gameWidth = w;
        gameHeight = h;
    }

    // ── Match start ──
    function startMatch() {
        score1 = 0;
        score2 = 0;
        rallyCount = 0;
        serveSide = 1;
        updateScoreDisplay();
        GameShell.showScreen('game-screen');
        onResize();
        startCountdown(function () {
            resetBall();
            running = true;
            paused = false;
            pauseOverlay.classList.add('hidden');
            lastTime = performance.now();
            gameLoop(lastTime);
        });
    }

    function startCountdown(callback) {
        countdownActive = true;
        resetPositions();
        running = false;
        paused = false;
        pauseOverlay.classList.add('hidden');

        // Draw initial frame
        draw();

        var count = 3;
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = count;

        var interval = setInterval(function () {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
                // Re-trigger animation
                countdownNumber.style.animation = 'none';
                void countdownNumber.offsetWidth;
                countdownNumber.style.animation = '';
                CGameAudio.play('countdown');
            } else {
                clearInterval(interval);
                countdownOverlay.classList.add('hidden');
                countdownActive = false;
                CGameAudio.play('countdown');
                if (callback) callback();
            }
        }, 700);

        CGameAudio.play('countdown');
    }

    function resetPositions() {
        var pw = gameWidth * PADDLE_WIDTH_RATIO;
        var ph = gameHeight * PADDLE_HEIGHT_RATIO;
        var margin = gameWidth * PADDLE_MARGIN_RATIO;

        paddle1 = {
            x: margin,
            y: gameHeight / 2 - ph / 2,
            w: pw,
            h: ph,
            vy: 0
        };

        paddle2 = {
            x: gameWidth - margin - pw,
            y: gameHeight / 2 - ph / 2,
            w: pw,
            h: ph,
            vy: 0
        };

        var br = gameWidth * BALL_RADIUS_RATIO;
        ball = {
            x: gameWidth / 2,
            y: gameHeight / 2,
            r: Math.max(br, 4),
            vx: 0,
            vy: 0,
            speed: 0
        };

        aiTargetY = gameHeight / 2;
        aiError = 0;
        aiReactionTimer = 0;
    }

    function resetBall() {
        ball.x = gameWidth / 2;
        ball.y = gameHeight / 2;
        ball.speed = gameWidth * BALL_SPEED_INITIAL;
        rallyCount = 0;

        // Serve direction
        var angle = (Math.random() * 0.8 - 0.4); // -0.4 to 0.4 radians
        var dir = serveSide === 1 ? 1 : -1;
        ball.vx = dir * Math.cos(angle) * ball.speed;
        ball.vy = Math.sin(angle) * ball.speed;

        serveDelay = 0;
        aiError = (Math.random() - 0.5) * 2 * AI_SETTINGS[difficulty].errorRange;
    }

    // ── Pause ──
    function togglePause() {
        if (!running && !paused) return;
        paused = !paused;

        if (paused) {
            pauseOverlay.classList.remove('hidden');
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        } else {
            pauseOverlay.classList.add('hidden');
            lastTime = performance.now();
            gameLoop(lastTime);
        }
    }

    function stopGame() {
        running = false;
        paused = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        pauseOverlay.classList.add('hidden');
        countdownOverlay.classList.add('hidden');
    }

    // ── Game Loop ──
    function gameLoop(timestamp) {
        if (!running || paused) return;

        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // Cap delta time to prevent tunneling after tab switch
        if (dt > 0.05) dt = 0.05;

        update(dt);
        draw();

        animFrameId = requestAnimationFrame(gameLoop);
    }

    // ── Update ──
    function update(dt) {
        // Handle serve delay
        if (serveDelay > 0) {
            serveDelay -= dt;
            if (serveDelay <= 0) {
                resetBall();
            }
            updatePaddles(dt);
            return;
        }

        updatePaddles(dt);
        updateBall(dt);
        checkCollisions();
        checkScore();
    }

    function updatePaddles(dt) {
        var speed = gameHeight * PADDLE_SPEED;

        // ── Player 1 (left) - keyboard: W/S ──
        var p1Dir = 0;
        if (keys['w'] || keys['W']) p1Dir = -1;
        if (keys['s'] || keys['S']) p1Dir = 1;

        // Touch input for P1
        var p1Touch = getTouchForSide('left');
        if (p1Touch !== null) {
            var p1Center = paddle1.y + paddle1.h / 2;
            var diff = p1Touch - p1Center;
            if (Math.abs(diff) > 5) {
                p1Dir = diff > 0 ? 1 : -1;
                // Make touch control proportional
                var touchSpeed = Math.min(Math.abs(diff) / 50, 1);
                paddle1.y += p1Dir * speed * touchSpeed * dt;
                p1Dir = 0; // prevent double movement
            }
        }

        paddle1.y += p1Dir * speed * dt;
        paddle1.y = clamp(paddle1.y, 0, gameHeight - paddle1.h);

        // ── Player 2 / AI (right) ──
        if (mode === '2p') {
            var p2Dir = 0;
            if (keys['ArrowUp']) p2Dir = -1;
            if (keys['ArrowDown']) p2Dir = 1;

            // Touch input for P2
            var p2Touch = getTouchForSide('right');
            if (p2Touch !== null) {
                var p2Center = paddle2.y + paddle2.h / 2;
                var diff2 = p2Touch - p2Center;
                if (Math.abs(diff2) > 5) {
                    p2Dir = diff2 > 0 ? 1 : -1;
                    var touchSpeed2 = Math.min(Math.abs(diff2) / 50, 1);
                    paddle2.y += p2Dir * speed * touchSpeed2 * dt;
                    p2Dir = 0;
                }
            }

            paddle2.y += p2Dir * speed * dt;
        } else {
            updateAI(dt);
        }

        paddle2.y = clamp(paddle2.y, 0, gameHeight - paddle2.h);
    }

    function getTouchForSide(side) {
        var ids = Object.keys(touches);
        for (var i = 0; i < ids.length; i++) {
            var t = touches[ids[i]];
            if (t.side === side) return t.y;
        }
        return null;
    }

    // ── AI ──
    function updateAI(dt) {
        var ai = AI_SETTINGS[difficulty];
        var paddleCenter = paddle2.y + paddle2.h / 2;
        var speed = gameHeight * PADDLE_SPEED * ai.speedMult;

        // Update reaction timer
        aiReactionTimer -= dt;
        if (aiReactionTimer <= 0) {
            aiReactionTimer = 0.1 + Math.random() * 0.15;
            // Predict where ball will be
            aiTargetY = predictBallY() + aiError;

            // Occasionally recalculate error
            if (Math.random() < 0.15) {
                aiError = (Math.random() - 0.5) * 2 * ai.errorRange;
            }
        }

        // Move toward target
        var target = aiTargetY;
        var diff = target - paddleCenter;

        // Dead zone - don't move if close enough
        var deadZone = paddle2.h * 0.1;
        if (Math.abs(diff) < deadZone) return;

        // Smooth movement with reaction speed
        var moveAmount = diff * ai.reaction;
        moveAmount = clamp(moveAmount, -speed * dt, speed * dt);
        paddle2.y += moveAmount;
    }

    function predictBallY() {
        // If ball moving away from AI, go to center
        if (ball.vx <= 0) {
            return gameHeight / 2;
        }

        var ai = AI_SETTINGS[difficulty];
        // Simple prediction: where will ball be at paddle2.x?
        var dx = paddle2.x - ball.x;
        if (ball.vx <= 0) return ball.y;

        var timeToReach = dx / ball.vx;
        var predictedY = ball.y + ball.vy * timeToReach;

        // Add noise to prediction
        predictedY += (Math.random() - 0.5) * ai.predictionNoise;

        // Simulate bounces
        while (predictedY < 0 || predictedY > gameHeight) {
            if (predictedY < 0) predictedY = -predictedY;
            if (predictedY > gameHeight) predictedY = 2 * gameHeight - predictedY;
        }

        return predictedY;
    }

    // ── Ball ──
    function updateBall(dt) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Top/bottom wall bounce
        if (ball.y - ball.r < 0) {
            ball.y = ball.r;
            ball.vy = Math.abs(ball.vy);
            CGameAudio.play('bounce');
        }
        if (ball.y + ball.r > gameHeight) {
            ball.y = gameHeight - ball.r;
            ball.vy = -Math.abs(ball.vy);
            CGameAudio.play('bounce');
        }
    }

    function checkCollisions() {
        // Paddle 1 (left)
        if (ball.vx < 0 && ball.x - ball.r <= paddle1.x + paddle1.w &&
            ball.x - ball.r >= paddle1.x - ball.r * 0.5 &&
            ball.y >= paddle1.y && ball.y <= paddle1.y + paddle1.h) {
            handlePaddleHit(paddle1, 1);
        }

        // Paddle 2 (right)
        if (ball.vx > 0 && ball.x + ball.r >= paddle2.x &&
            ball.x + ball.r <= paddle2.x + paddle2.w + ball.r * 0.5 &&
            ball.y >= paddle2.y && ball.y <= paddle2.y + paddle2.h) {
            handlePaddleHit(paddle2, -1);
        }
    }

    function handlePaddleHit(paddle, dirX) {
        // Calculate hit position: -1 (top) to 1 (bottom)
        var hitPos = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
        hitPos = clamp(hitPos, -1, 1);

        // Calculate bounce angle
        var angle = hitPos * MAX_BOUNCE_ANGLE;

        // Increase speed with rally
        rallyCount++;
        ball.speed = Math.min(
            gameWidth * (BALL_SPEED_INITIAL + BALL_SPEED_INCREMENT * rallyCount),
            gameWidth * BALL_SPEED_MAX
        );

        ball.vx = dirX * Math.cos(angle) * ball.speed;
        ball.vy = Math.sin(angle) * ball.speed;

        // Push ball out of paddle
        if (dirX > 0) {
            ball.x = paddle.x + paddle.w + ball.r;
        } else {
            ball.x = paddle.x - ball.r;
        }

        CGameAudio.play('hit');

        // Recalculate AI target after hit
        if (mode === '1p') {
            var ai = AI_SETTINGS[difficulty];
            aiError = (Math.random() - 0.5) * 2 * ai.errorRange;
            aiReactionTimer = 0; // force immediate recalculation
        }
    }

    function checkScore() {
        var scored = false;
        var scorer = 0;

        // Ball passed left side
        if (ball.x + ball.r < 0) {
            score2++;
            scorer = 2;
            serveSide = 1;
            scored = true;
        }

        // Ball passed right side
        if (ball.x - ball.r > gameWidth) {
            score1++;
            scorer = 1;
            serveSide = 2;
            scored = true;
        }

        if (scored) {
            CGameAudio.play('score');
            updateScoreDisplay();
            flashScore(scorer);

            // Check for win
            if (score1 >= WIN_SCORE || score2 >= WIN_SCORE) {
                endMatch();
                return;
            }

            // Reset ball with short delay
            ball.vx = 0;
            ball.vy = 0;
            ball.x = gameWidth / 2;
            ball.y = gameHeight / 2;
            serveDelay = 0.8;
        }
    }

    function updateScoreDisplay() {
        scoreP1El.textContent = score1;
        scoreP2El.textContent = score2;
    }

    function flashScore(player) {
        var el = player === 1 ? scoreP1El : scoreP2El;
        el.classList.remove('score-flash');
        void el.offsetWidth;
        el.classList.add('score-flash');
    }

    function endMatch() {
        running = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        var winner = score1 >= WIN_SCORE ? 1 : 2;
        var winnerText = document.getElementById('winner-text');
        var finalScore = document.getElementById('final-score');

        if (mode === '1p') {
            if (winner === 1) {
                winnerText.textContent = 'You Win!';
                winnerText.style.color = colors.p1;
                CGameAudio.play('win');
            } else {
                winnerText.textContent = 'AI Wins!';
                winnerText.style.color = colors.p2;
                CGameAudio.play('lose');
            }
        } else {
            winnerText.textContent = 'Player ' + winner + ' Wins!';
            winnerText.style.color = winner === 1 ? colors.p1 : colors.p2;
            CGameAudio.play('win');
        }

        finalScore.textContent = score1 + ' - ' + score2;

        // Small delay before showing game over screen
        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 600);
    }

    // ── Drawing ──
    function draw() {
        if (!ctx || !gameWidth || !gameHeight) return;

        // Clear
        ctx.fillStyle = colors.canvasBg;
        ctx.fillRect(0, 0, gameWidth, gameHeight);

        drawCenterLine();
        drawPaddle(paddle1, colors.p1);
        drawPaddle(paddle2, colors.p2);
        drawBall();
    }

    function drawCenterLine() {
        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gameWidth / 2, 0);
        ctx.lineTo(gameWidth / 2, gameHeight);
        ctx.stroke();
        ctx.restore();
    }

    function drawPaddle(p, color) {
        var radius = Math.min(p.w / 2, 6);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(p.x + radius, p.y);
        ctx.lineTo(p.x + p.w - radius, p.y);
        ctx.arcTo(p.x + p.w, p.y, p.x + p.w, p.y + radius, radius);
        ctx.lineTo(p.x + p.w, p.y + p.h - radius);
        ctx.arcTo(p.x + p.w, p.y + p.h, p.x + p.w - radius, p.y + p.h, radius);
        ctx.lineTo(p.x + radius, p.y + p.h);
        ctx.arcTo(p.x, p.y + p.h, p.x, p.y + p.h - radius, radius);
        ctx.lineTo(p.x, p.y + radius);
        ctx.arcTo(p.x, p.y, p.x + radius, p.y, radius);
        ctx.closePath();
        ctx.fill();

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawBall() {
        if (!ball) return;

        ctx.fillStyle = colors.accent;
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Trail effect - draw a faint trail behind the ball
        if (ball.vx !== 0 || ball.vy !== 0) {
            var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            var trailLen = Math.min(speed * 0.02, ball.r * 3);
            var nx = -ball.vx / speed;
            var ny = -ball.vy / speed;

            ctx.fillStyle = colors.accent;
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(ball.x + nx * trailLen * 0.5, ball.y + ny * trailLen * 0.5, ball.r * 0.7, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.1;
            ctx.beginPath();
            ctx.arc(ball.x + nx * trailLen, ball.y + ny * trailLen, ball.r * 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
        }
    }

    // ── Utility ──
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    // ── Start ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        initGame();
    }
})();
