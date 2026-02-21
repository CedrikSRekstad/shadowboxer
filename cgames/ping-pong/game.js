/* === Ping Pong - Cgames (Visual Overhaul) === */
(function () {
    'use strict';

    // ── Constants ──
    var WIN_SCORE = 7;
    var PADDLE_WIDTH_RATIO = 0.015;
    var PADDLE_HEIGHT_RATIO = 0.18;
    var PADDLE_MARGIN_RATIO = 0.03;
    var BALL_RADIUS_RATIO = 0.012;
    var BALL_SPEED_INITIAL = 0.55;
    var BALL_SPEED_INCREMENT = 0.02;
    var BALL_SPEED_MAX = 1.2;
    var PADDLE_SPEED = 0.9;
    var MAX_BOUNCE_ANGLE = Math.PI / 3;

    // AI Difficulty settings
    var AI_SETTINGS = {
        easy:   { reaction: 0.35, errorRange: 60, speedMult: 0.6, predictionNoise: 80 },
        medium: { reaction: 0.6,  errorRange: 30, speedMult: 0.85, predictionNoise: 35 },
        hard:   { reaction: 0.9,  errorRange: 8,  speedMult: 1.0, predictionNoise: 8 }
    };

    // ── State ──
    var canvas, ctx;
    var gameWidth, gameHeight;
    var mode = '1p';
    var difficulty = 'medium';
    var paused = false;
    var running = false;
    var lastTime = 0;
    var animFrameId = null;
    var globalTime = 0;

    // Colors
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
    var serveSide = 1;
    var serveDelay = 0;
    var countdownActive = false;

    // Visual systems
    var particles = [];
    var ballTrail = [];
    var screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
    var bgStars = [];
    var scorePopups = [];

    // Input state
    var keys = {};
    var touches = {};

    // AI state
    var aiTargetY = 0;
    var aiError = 0;
    var aiReactionTimer = 0;

    // DOM refs
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

        GameShell.init({ backUrl: '../' });
        setupButtons();
        setupInput();
        readColors();

        var observer = new MutationObserver(function () { readColors(); });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

        window.addEventListener('resize', onResize);

        initStars();
    }

    function initStars() {
        bgStars = [];
        for (var i = 0; i < 60; i++) {
            bgStars.push({
                x: Math.random(),
                y: Math.random(),
                size: 0.5 + Math.random() * 1.5,
                twinkleSpeed: 1 + Math.random() * 3,
                twinkleOffset: Math.random() * Math.PI * 2,
                brightness: 0.2 + Math.random() * 0.4
            });
        }
    }

    function readColors() {
        var style = getComputedStyle(document.documentElement);
        colors.canvasBg = style.getPropertyValue('--canvas-bg').trim() || colors.canvasBg;
        colors.p1 = style.getPropertyValue('--p1-color').trim() || colors.p1;
        colors.p2 = style.getPropertyValue('--p2-color').trim() || colors.p2;
        colors.accent = style.getPropertyValue('--accent').trim() || colors.accent;
        colors.text = style.getPropertyValue('--text-primary').trim() || colors.text;

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
            if (['ArrowUp', 'ArrowDown', 'w', 's', ' '].indexOf(e.key) !== -1) {
                e.preventDefault();
            }
            if (e.key === 'Escape' && running) {
                togglePause();
            }
        });

        document.addEventListener('keyup', function (e) {
            keys[e.key] = false;
        });

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
        particles = [];
        ballTrail = [];
        scorePopups = [];
        screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
        globalTime = 0;
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

        draw();

        var count = 3;
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = count;

        var interval = setInterval(function () {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
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

        paddle1 = { x: margin, y: gameHeight / 2 - ph / 2, w: pw, h: ph, vy: 0, hitFlash: 0 };
        paddle2 = { x: gameWidth - margin - pw, y: gameHeight / 2 - ph / 2, w: pw, h: ph, vy: 0, hitFlash: 0 };

        var br = gameWidth * BALL_RADIUS_RATIO;
        ball = { x: gameWidth / 2, y: gameHeight / 2, r: Math.max(br, 4), vx: 0, vy: 0, speed: 0 };

        aiTargetY = gameHeight / 2;
        aiError = 0;
        aiReactionTimer = 0;
        ballTrail = [];
    }

    function resetBall() {
        ball.x = gameWidth / 2;
        ball.y = gameHeight / 2;
        ball.speed = gameWidth * BALL_SPEED_INITIAL;
        rallyCount = 0;
        ballTrail = [];

        var angle = (Math.random() * 0.8 - 0.4);
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
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        } else {
            pauseOverlay.classList.add('hidden');
            lastTime = performance.now();
            gameLoop(lastTime);
        }
    }

    function stopGame() {
        running = false;
        paused = false;
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        pauseOverlay.classList.add('hidden');
        countdownOverlay.classList.add('hidden');
    }

    // ── Game Loop ──
    function gameLoop(timestamp) {
        if (!running || paused) return;

        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.05) dt = 0.05;

        globalTime += dt;
        update(dt);
        draw();

        animFrameId = requestAnimationFrame(gameLoop);
    }

    // ── Update ──
    function update(dt) {
        // Screen shake decay
        if (screenShake.intensity > 0.5) {
            screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.intensity *= screenShake.decay;
        } else {
            screenShake.x = 0;
            screenShake.y = 0;
            screenShake.intensity = 0;
        }

        // Update particles
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.vy += 200 * dt; // gravity
            if (p.life <= 0) particles.splice(i, 1);
        }
        if (particles.length > 200) particles.splice(0, particles.length - 200);

        // Update score popups
        for (var j = scorePopups.length - 1; j >= 0; j--) {
            var sp = scorePopups[j];
            sp.y -= 60 * dt;
            sp.life -= dt;
            if (sp.life <= 0) scorePopups.splice(j, 1);
        }

        // Update paddle hit flash
        if (paddle1 && paddle1.hitFlash > 0) paddle1.hitFlash -= dt * 4;
        if (paddle2 && paddle2.hitFlash > 0) paddle2.hitFlash -= dt * 4;

        // Handle serve delay
        if (serveDelay > 0) {
            serveDelay -= dt;
            if (serveDelay <= 0) resetBall();
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

        // Player 1
        var p1Dir = 0;
        if (keys['w'] || keys['W']) p1Dir = -1;
        if (keys['s'] || keys['S']) p1Dir = 1;

        var p1Touch = getTouchForSide('left');
        if (p1Touch !== null) {
            var p1Center = paddle1.y + paddle1.h / 2;
            var diff = p1Touch - p1Center;
            if (Math.abs(diff) > 5) {
                p1Dir = diff > 0 ? 1 : -1;
                var touchSpeed = Math.min(Math.abs(diff) / 50, 1);
                paddle1.y += p1Dir * speed * touchSpeed * dt;
                p1Dir = 0;
            }
        }

        paddle1.vy = p1Dir * speed;
        paddle1.y += p1Dir * speed * dt;
        paddle1.y = clamp(paddle1.y, 0, gameHeight - paddle1.h);

        // Player 2 / AI
        if (mode === '2p') {
            var p2Dir = 0;
            if (keys['ArrowUp']) p2Dir = -1;
            if (keys['ArrowDown']) p2Dir = 1;

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

            paddle2.vy = p2Dir * speed;
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

        aiReactionTimer -= dt;
        if (aiReactionTimer <= 0) {
            aiReactionTimer = 0.1 + Math.random() * 0.15;
            aiTargetY = predictBallY() + aiError;
            if (Math.random() < 0.15) {
                aiError = (Math.random() - 0.5) * 2 * ai.errorRange;
            }
        }

        var target = aiTargetY;
        var diff = target - paddleCenter;
        var deadZone = paddle2.h * 0.1;
        if (Math.abs(diff) < deadZone) return;

        var moveAmount = diff * ai.reaction;
        moveAmount = clamp(moveAmount, -speed * dt, speed * dt);
        paddle2.y += moveAmount;
    }

    function predictBallY() {
        if (ball.vx <= 0) return gameHeight / 2;

        var ai = AI_SETTINGS[difficulty];
        var dx = paddle2.x - ball.x;
        if (ball.vx <= 0) return ball.y;

        var timeToReach = dx / ball.vx;
        var predictedY = ball.y + ball.vy * timeToReach;
        predictedY += (Math.random() - 0.5) * ai.predictionNoise;

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

        // Store trail position
        if (ball.vx !== 0 || ball.vy !== 0) {
            ballTrail.push({ x: ball.x, y: ball.y, age: 0 });
            if (ballTrail.length > 12) ballTrail.shift();
        }

        // Top/bottom wall bounce
        if (ball.y - ball.r < 0) {
            ball.y = ball.r;
            ball.vy = Math.abs(ball.vy);
            CGameAudio.play('bounce');
            spawnWallParticles(ball.x, ball.r, 'up');
        }
        if (ball.y + ball.r > gameHeight) {
            ball.y = gameHeight - ball.r;
            ball.vy = -Math.abs(ball.vy);
            CGameAudio.play('bounce');
            spawnWallParticles(ball.x, gameHeight - ball.r, 'down');
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
        var hitPos = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
        hitPos = clamp(hitPos, -1, 1);

        var angle = hitPos * MAX_BOUNCE_ANGLE;

        rallyCount++;
        ball.speed = Math.min(
            gameWidth * (BALL_SPEED_INITIAL + BALL_SPEED_INCREMENT * rallyCount),
            gameWidth * BALL_SPEED_MAX
        );

        ball.vx = dirX * Math.cos(angle) * ball.speed;
        ball.vy = Math.sin(angle) * ball.speed;

        if (dirX > 0) {
            ball.x = paddle.x + paddle.w + ball.r;
        } else {
            ball.x = paddle.x - ball.r;
        }

        CGameAudio.play('hit');

        // Paddle hit flash
        paddle.hitFlash = 1.0;

        // Spawn impact particles
        var hitX = dirX > 0 ? paddle.x + paddle.w : paddle.x;
        spawnHitParticles(hitX, ball.y, dirX, paddle === paddle1 ? colors.p1 : colors.p2);

        // Smash shot detection (paddle moving fast)
        var paddleSpeed = Math.abs(paddle.vy);
        if (paddleSpeed > gameHeight * 0.5) {
            ball.speed *= 1.15;
            ball.vx *= 1.15;
            ball.vy *= 1.15;
            // Extra particles for smash
            spawnHitParticles(hitX, ball.y, dirX, colors.accent);
            screenShake.intensity = 5;
        }

        if (mode === '1p') {
            var ai = AI_SETTINGS[difficulty];
            aiError = (Math.random() - 0.5) * 2 * ai.errorRange;
            aiReactionTimer = 0;
        }
    }

    function checkScore() {
        var scored = false;
        var scorer = 0;

        if (ball.x + ball.r < 0) {
            score2++;
            scorer = 2;
            serveSide = 1;
            scored = true;
        }

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

            // Screen shake on score
            screenShake.intensity = 12;

            // Score popup
            var popX = scorer === 1 ? gameWidth * 0.25 : gameWidth * 0.75;
            scorePopups.push({
                x: popX,
                y: gameHeight / 2,
                text: '+1',
                color: scorer === 1 ? colors.p1 : colors.p2,
                life: 1.2
            });

            // Goal particles burst
            var goalX = scorer === 1 ? gameWidth : 0;
            for (var i = 0; i < 20; i++) {
                particles.push({
                    x: goalX,
                    y: ball.y + (Math.random() - 0.5) * 60,
                    vx: (Math.random() - 0.5) * 300 * (scorer === 1 ? -1 : 1),
                    vy: (Math.random() - 0.5) * 200,
                    life: 0.6 + Math.random() * 0.6,
                    maxLife: 1.2,
                    size: 2 + Math.random() * 4,
                    color: scorer === 1 ? colors.p1 : colors.p2
                });
            }

            if (score1 >= WIN_SCORE || score2 >= WIN_SCORE) {
                endMatch();
                return;
            }

            ball.vx = 0;
            ball.vy = 0;
            ball.x = gameWidth / 2;
            ball.y = gameHeight / 2;
            ballTrail = [];
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
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

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

        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 600);
    }

    // ── Particle Spawners ──
    function spawnHitParticles(x, y, dirX, color) {
        for (var i = 0; i < 12; i++) {
            var angle = (Math.random() - 0.5) * Math.PI * 0.8;
            var speed = 100 + Math.random() * 250;
            particles.push({
                x: x,
                y: y,
                vx: dirX * Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.4,
                maxLife: 0.7,
                size: 1.5 + Math.random() * 3,
                color: color
            });
        }
    }

    function spawnWallParticles(x, y, dir) {
        for (var i = 0; i < 6; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y,
                vx: (Math.random() - 0.5) * 100,
                vy: dir === 'up' ? Math.random() * 80 : -Math.random() * 80,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.5,
                size: 1 + Math.random() * 2,
                color: colors.accent
            });
        }
    }

    // ── Drawing ──
    function draw() {
        if (!ctx || !gameWidth || !gameHeight) return;

        ctx.save();

        // Apply screen shake
        if (screenShake.intensity > 0.5) {
            ctx.translate(screenShake.x, screenShake.y);
        }

        // Background
        drawBackground();

        // Grid lines
        drawGrid();

        // Center line
        drawCenterLine();

        // Ball trail
        drawBallTrail();

        // Paddles
        drawPaddle(paddle1, colors.p1);
        drawPaddle(paddle2, colors.p2);

        // Ball
        drawBall();

        // Particles
        drawParticles();

        // Score popups
        drawScorePopups();

        // Rally counter
        if (rallyCount > 2 && ball.speed > 0) {
            drawRallyCounter();
        }

        ctx.restore();
    }

    function drawBackground() {
        // Gradient background
        var isDark = document.body.getAttribute('data-theme') !== 'light';
        if (isDark) {
            var grad = ctx.createRadialGradient(gameWidth / 2, gameHeight / 2, 0, gameWidth / 2, gameHeight / 2, gameWidth * 0.7);
            grad.addColorStop(0, '#12122a');
            grad.addColorStop(1, '#0a0a18');
            ctx.fillStyle = grad;
        } else {
            var gradL = ctx.createRadialGradient(gameWidth / 2, gameHeight / 2, 0, gameWidth / 2, gameHeight / 2, gameWidth * 0.7);
            gradL.addColorStop(0, '#f0f4ff');
            gradL.addColorStop(1, '#e0e8f8');
            ctx.fillStyle = gradL;
        }
        ctx.fillRect(0, 0, gameWidth, gameHeight);

        // Stars (dark theme only)
        if (isDark) {
            for (var i = 0; i < bgStars.length; i++) {
                var star = bgStars[i];
                var twinkle = star.brightness + Math.sin(globalTime * star.twinkleSpeed + star.twinkleOffset) * 0.15;
                ctx.fillStyle = 'rgba(255,255,255,' + clamp(twinkle, 0.05, 0.6) + ')';
                ctx.beginPath();
                ctx.arc(star.x * gameWidth, star.y * gameHeight, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawGrid() {
        var isDark = document.body.getAttribute('data-theme') !== 'light';
        var gridAlpha = isDark ? 0.04 : 0.06;
        var spacing = 40;

        ctx.strokeStyle = isDark ? 'rgba(100,140,255,' + gridAlpha + ')' : 'rgba(0,0,60,' + gridAlpha + ')';
        ctx.lineWidth = 0.5;

        for (var x = spacing; x < gameWidth; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gameHeight);
            ctx.stroke();
        }
        for (var y = spacing; y < gameHeight; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gameWidth, y);
            ctx.stroke();
        }
    }

    function drawCenterLine() {
        var pulse = 0.12 + Math.sin(globalTime * 2) * 0.05;
        var isDark = document.body.getAttribute('data-theme') !== 'light';

        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = isDark
            ? 'rgba(100,140,255,' + pulse + ')'
            : 'rgba(0,0,100,' + pulse + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gameWidth / 2, 0);
        ctx.lineTo(gameWidth / 2, gameHeight);
        ctx.stroke();
        ctx.restore();

        // Center circle
        ctx.beginPath();
        ctx.arc(gameWidth / 2, gameHeight / 2, 30, 0, Math.PI * 2);
        ctx.strokeStyle = isDark
            ? 'rgba(100,140,255,' + (pulse * 0.8) + ')'
            : 'rgba(0,0,100,' + (pulse * 0.8) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawPaddle(p, color) {
        if (!p) return;
        var radius = Math.min(p.w / 2, 6);

        // Outer glow aura
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 20 + (p.hitFlash > 0 ? 15 : 0);

        // Gradient fill
        var grad = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
        var lightColor = lightenColor(color, 1.4);
        var darkColor = lightenColor(color, 0.7);
        grad.addColorStop(0, lightColor);
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, darkColor);
        ctx.fillStyle = grad;

        // Rounded rect path
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

        // Hit flash overlay
        if (p.hitFlash > 0) {
            ctx.fillStyle = 'rgba(255,255,255,' + (p.hitFlash * 0.5) + ')';
            ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.restore();

        // Highlight stripe
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(p.x + 1, p.y + 2, p.w * 0.3, p.h - 4);
    }

    function drawBallTrail() {
        if (!ball || ballTrail.length < 2) return;

        for (var i = 0; i < ballTrail.length; i++) {
            var t = ballTrail[i];
            var alpha = (i / ballTrail.length) * 0.4;
            var size = ball.r * (0.3 + 0.5 * (i / ballTrail.length));

            ctx.beginPath();
            ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
            ctx.fillStyle = colors.accent;
            ctx.globalAlpha = alpha;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function drawBall() {
        if (!ball) return;

        var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        var glowIntensity = Math.min(speed / (gameWidth * 0.8), 1);

        // Outer glow
        ctx.save();
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 15 + glowIntensity * 15;

        // Gradient ball
        var grad = ctx.createRadialGradient(
            ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.1,
            ball.x, ball.y, ball.r
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, colors.accent);
        grad.addColorStop(1, lightenColor(colors.accent, 0.6));
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();

        // Speed lines when fast
        if (speed > gameWidth * 0.6) {
            var nx = -ball.vx / speed;
            var ny = -ball.vy / speed;
            for (var i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(
                    ball.x + nx * ball.r * i * 1.5 + (Math.random() - 0.5) * 3,
                    ball.y + ny * ball.r * i * 1.5 + (Math.random() - 0.5) * 3
                );
                ctx.lineTo(
                    ball.x + nx * ball.r * (i * 1.5 + 1),
                    ball.y + ny * ball.r * (i * 1.5 + 1)
                );
                ctx.strokeStyle = 'rgba(255,221,0,' + (0.4 - i * 0.1) + ')';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawScorePopups() {
        for (var i = 0; i < scorePopups.length; i++) {
            var sp = scorePopups[i];
            var alpha = Math.min(sp.life, 1);
            var scale = 1 + (1 - alpha) * 0.5;
            ctx.save();
            ctx.translate(sp.x, sp.y);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = sp.color;
            ctx.font = 'bold ' + Math.round(gameWidth * 0.05) + 'px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = sp.color;
            ctx.shadowBlur = 10;
            ctx.fillText(sp.text, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    function drawRallyCounter() {
        var alpha = Math.min(0.4, 0.1 + rallyCount * 0.03);
        ctx.save();
        ctx.font = 'bold ' + Math.round(gameWidth * 0.08) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
        ctx.fillText(rallyCount, gameWidth / 2, gameHeight / 2);
        ctx.restore();
    }

    // ── Color Utility ──
    function lightenColor(hex, factor) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        var r = Math.min(255, Math.round(parseInt(hex.substr(0, 2), 16) * factor));
        var g = Math.min(255, Math.round(parseInt(hex.substr(2, 2), 16) * factor));
        var b = Math.min(255, Math.round(parseInt(hex.substr(4, 2), 16) * factor));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

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
