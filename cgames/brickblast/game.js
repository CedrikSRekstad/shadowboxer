/* === BrickBlast - Breakout / Arkanoid === */
(function () {
    'use strict';

    // ─── Constants ───
    var BRICK_ROWS = 5;
    var BRICK_COLS = 10;
    var BRICK_PAD = 4;
    var BRICK_TOP_OFFSET = 40;
    var PADDLE_HEIGHT = 14;
    var BALL_RADIUS = 7;
    var BASE_BALL_SPEED = 380;
    var BALL_SPEED_INCREMENT = 8;
    var MAX_BALL_SPEED = 700;
    var POWERUP_SIZE = 20;
    var POWERUP_SPEED = 150;
    var POWERUP_CHANCE = 0.18;
    var POWERUP_DURATION = 8000;
    var LIVES_START = 3;
    var LEVEL_BONUS = 200;
    var TWO_PLAYER_TIME = 90; // seconds
    var PARTICLE_COUNT = 8;
    var PARTICLE_LIFE = 0.4;

    // Brick colors per row (bottom to top in visual order, row 0 = top)
    var ROW_COLORS = [
        { fill: '#ff4444', top: '#ff6666', bot: '#cc2222' },  // red
        { fill: '#ff8844', top: '#ffaa66', bot: '#cc6622' },  // orange
        { fill: '#ffcc00', top: '#ffdd44', bot: '#ccaa00' },  // yellow
        { fill: '#44cc44', top: '#66ee66', bot: '#229922' },  // green
        { fill: '#4488ff', top: '#66aaff', bot: '#2266cc' }   // blue
    ];

    var POWERUP_TYPES = ['W', 'M', 'F'];
    var POWERUP_COLORS = { W: '#44cc44', M: '#ff8844', F: '#ff4444' };

    // ─── Visual Constants ───
    var BALL_TRAIL_LENGTH = 8;
    var BRICK_CORNER_RADIUS = 4;
    var SCREEN_SHAKE_INTENSITY = 4;
    var SCREEN_SHAKE_DECAY = 0.9;
    var SPARKLE_COUNT = 2;
    var SPARKLE_LIFE = 0.5;
    var PADDLE_FLASH_DURATION = 0.15;
    var PARTICLE_GRAVITY = 400;

    // ─── Level Patterns ───
    // 1 = brick, 0 = empty. Each level is BRICK_ROWS x BRICK_COLS
    var LEVELS = [
        // Level 1: Full grid
        null, // null = full grid
        // Level 2: Checkerboard
        function (r, c) { return (r + c) % 2 === 0; },
        // Level 3: Diamond
        function (r, c) {
            var cr = Math.floor(BRICK_ROWS / 2);
            var cc = Math.floor(BRICK_COLS / 2);
            return Math.abs(r - cr) + Math.abs(c - cc) <= Math.max(cr, cc) - 1;
        },
        // Level 4: Inverted V
        function (r, c) {
            var mid = BRICK_COLS / 2;
            return c >= mid - r - 1 && c <= mid + r;
        },
        // Level 5: Stripes
        function (r) { return r % 2 === 0; },
        // Level 6: Border
        function (r, c) {
            return r === 0 || r === BRICK_ROWS - 1 || c === 0 || c === BRICK_COLS - 1;
        },
        // Level 7: Random ~60%
        function () { return Math.random() < 0.6; },
        // Level 8: Cross
        function (r, c) {
            return r === Math.floor(BRICK_ROWS / 2) || c === Math.floor(BRICK_COLS / 2);
        }
    ];

    // ─── State ───
    var canvas, ctx;
    var W, H;
    var mode = 0; // 0=none, 1=1P, 2=2P
    var paused = false;
    var gameRunning = false;
    var animId = null;
    var lastTime = 0;

    // Single player state
    var sp = {};
    // Two player state (array of 2 field states)
    var fields = [];
    var twoPlayerTimer = 0;

    // Particles
    var particles = [];

    // ─── Visual State ───
    var screenShake = { x: 0, y: 0, intensity: 0 };
    var sparkleParticles = [];
    var paddleFlashTimers = {}; // keyed by 'sp', '0', '1'

    // Input
    var keys = {};
    var touches = {};

    // ─── Initialization ───
    GameShell.init({ backUrl: '../' });

    // DOM refs
    var btnStart1P = document.getElementById('btn-1p');
    var btnStart2P = document.getElementById('btn-2p');
    var btnPause = document.getElementById('btn-pause');
    var btnResume = document.getElementById('btn-resume');
    var btnQuit = document.getElementById('btn-quit');
    var btnPlayAgain = document.getElementById('btn-play-again');
    var btnMenu = document.getElementById('btn-menu');
    var hud1P = document.getElementById('hud-1p');
    var hud2P = document.getElementById('hud-2p');
    var countdownOverlay = document.getElementById('countdown-overlay');
    var countdownNumber = document.getElementById('countdown-number');
    var pauseOverlay = document.getElementById('pause-overlay');

    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // ─── Events ───
    btnStart1P.addEventListener('click', function () {
        CGameAudio.play('select');
        startGame(1);
    });
    btnStart2P.addEventListener('click', function () {
        CGameAudio.play('select');
        startGame(2);
    });
    btnPause.addEventListener('click', togglePause);
    btnResume.addEventListener('click', togglePause);
    btnQuit.addEventListener('click', function () {
        CGameAudio.play('back');
        stopGame();
        GameShell.showScreen('title-screen');
    });
    btnPlayAgain.addEventListener('click', function () {
        CGameAudio.play('select');
        startGame(mode);
    });
    btnMenu.addEventListener('click', function () {
        CGameAudio.play('back');
        GameShell.showScreen('title-screen');
    });

    // Keyboard
    document.addEventListener('keydown', function (e) {
        keys[e.key] = true;
        if (e.key === 'Escape' && gameRunning) togglePause();
        if (e.key === ' ' && gameRunning) {
            // Launch ball if stuck
            launchBalls();
            e.preventDefault();
        }
    });
    document.addEventListener('keyup', function (e) {
        keys[e.key] = false;
    });

    // Touch
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Mouse (for desktop testing)
    canvas.addEventListener('mousemove', function (e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = W / rect.width;
        var mx = (e.clientX - rect.left) * scaleX;
        touches['mouse'] = { x: mx, y: 0 };
    });
    canvas.addEventListener('click', function () {
        if (gameRunning && !paused) launchBalls();
    });

    function handleTouch(e) {
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var scaleX = W / rect.width;
        for (var i = 0; i < e.touches.length; i++) {
            var t = e.touches[i];
            var tx = (t.clientX - rect.left) * scaleX;
            touches[t.identifier] = { x: tx, y: 0 };
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        // Remove ended touches
        var active = {};
        for (var i = 0; i < e.touches.length; i++) {
            active[e.touches[i].identifier] = true;
        }
        for (var id in touches) {
            if (!active[id] && id !== 'mouse') delete touches[id];
        }
        // Tap to launch
        if (gameRunning && !paused) launchBalls();
    }

    // Resize
    window.addEventListener('resize', resizeCanvas);

    // ─── Canvas Sizing ───
    function resizeCanvas() {
        var container = document.getElementById('canvas-container');
        if (!container) return;
        var cw = container.clientWidth;
        var ch = container.clientHeight;

        if (mode === 2) {
            // Two-player: wider canvas
            W = 800;
            H = 500;
        } else {
            W = 480;
            H = 640;
        }

        canvas.width = W;
        canvas.height = H;

        // Scale to fit
        var scale = Math.min(cw / W, ch / H);
        canvas.style.width = (W * scale) + 'px';
        canvas.style.height = (H * scale) + 'px';
    }

    // ─── Game Start ───
    function startGame(m) {
        mode = m;
        paused = false;
        gameRunning = false;
        particles = [];
        sparkleParticles = [];
        screenShake = { x: 0, y: 0, intensity: 0 };
        paddleFlashTimers = {};
        pauseOverlay.classList.add('hidden');

        resizeCanvas();

        if (mode === 1) {
            hud1P.classList.remove('hidden');
            hud2P.classList.add('hidden');
            initSinglePlayer();
        } else {
            hud1P.classList.add('hidden');
            hud2P.classList.remove('hidden');
            initTwoPlayer();
        }

        GameShell.showScreen('game-screen');
        countdown(function () {
            gameRunning = true;
            lastTime = performance.now();
            if (animId) cancelAnimationFrame(animId);
            gameLoop();
        });
    }

    function stopGame() {
        gameRunning = false;
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
    }

    // ─── Countdown ───
    function countdown(cb) {
        var count = 3;
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = count;
        CGameAudio.play('countdown');

        var interval = setInterval(function () {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
                CGameAudio.play('countdown');
            } else {
                countdownOverlay.classList.add('hidden');
                clearInterval(interval);
                cb();
            }
        }, 700);
    }

    // ─── Pause ───
    function togglePause() {
        if (!gameRunning) return;
        paused = !paused;
        pauseOverlay.classList.toggle('hidden', !paused);
        if (!paused) {
            lastTime = performance.now();
            gameLoop();
        }
        CGameAudio.play('click');
    }

    // ─── Single Player Init ───
    function initSinglePlayer() {
        sp = {
            score: 0,
            lives: LIVES_START,
            level: 1,
            bricks: [],
            paddle: { x: 0, y: 0, w: 80, h: PADDLE_HEIGHT },
            balls: [],
            powerups: [],
            activePowerups: { W: 0, F: 0 },
            basePaddleW: 80,
            brickW: 0,
            brickH: 0,
            launched: false
        };
        buildBricks(sp, 0);
        resetPaddle(sp);
        resetBall(sp);
        updateHUD1P();
    }

    function buildBricks(state, levelIdx) {
        state.bricks = [];
        var levelFn = LEVELS[levelIdx % LEVELS.length];
        var totalW = W - (mode === 2 ? 0 : 0);
        state.brickW = (totalW - BRICK_PAD * (BRICK_COLS + 1)) / BRICK_COLS;
        state.brickH = 18;

        for (var r = 0; r < BRICK_ROWS; r++) {
            for (var c = 0; c < BRICK_COLS; c++) {
                var active = levelFn ? levelFn(r, c) : true;
                if (active) {
                    state.bricks.push({
                        x: BRICK_PAD + c * (state.brickW + BRICK_PAD),
                        y: BRICK_TOP_OFFSET + r * (state.brickH + BRICK_PAD),
                        w: state.brickW,
                        h: state.brickH,
                        row: r,
                        alive: true,
                        hits: 0 // track hits for crack effect
                    });
                }
            }
        }
    }

    function resetPaddle(state) {
        var fieldW = mode === 2 ? W / 2 : W;
        state.paddle.w = state.basePaddleW;
        state.paddle.x = (fieldW - state.paddle.w) / 2;
        state.paddle.y = H - 40;
    }

    function resetBall(state) {
        state.balls = [];
        state.launched = false;
        state.powerups = [];
        state.activePowerups = { W: 0, F: 0 };
        state.paddle.w = state.basePaddleW;
        var fieldW = mode === 2 ? W / 2 : W;
        state.balls.push({
            x: fieldW / 2,
            y: state.paddle.y - BALL_RADIUS - 1,
            vx: 0,
            vy: 0,
            speed: BASE_BALL_SPEED + (state.level ? (state.level - 1) * 20 : 0),
            fireball: false,
            stuck: true,
            trail: [] // ball trail positions
        });
    }

    function launchBalls() {
        if (mode === 1) {
            launchFieldBalls(sp);
        } else {
            for (var i = 0; i < fields.length; i++) {
                launchFieldBalls(fields[i]);
            }
        }
    }

    function launchFieldBalls(state) {
        for (var i = 0; i < state.balls.length; i++) {
            var b = state.balls[i];
            if (b.stuck) {
                b.stuck = false;
                var angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
                b.vx = Math.cos(angle) * b.speed;
                b.vy = Math.sin(angle) * b.speed;
                state.launched = true;
            }
        }
    }

    // ─── Two Player Init ───
    function initTwoPlayer() {
        fields = [];
        twoPlayerTimer = TWO_PLAYER_TIME;

        for (var p = 0; p < 2; p++) {
            var f = {
                player: p,
                score: 0,
                bricks: [],
                paddle: { x: 0, y: 0, w: 70, h: PADDLE_HEIGHT },
                balls: [],
                powerups: [],
                activePowerups: { W: 0, F: 0 },
                basePaddleW: 70,
                brickW: 0,
                brickH: 0,
                launched: false,
                bricksCleared: false
            };
            buildBricks2P(f);
            resetPaddle2P(f);
            resetBall2P(f);
            fields.push(f);
        }
        updateHUD2P();
    }

    function buildBricks2P(f) {
        f.bricks = [];
        var halfW = W / 2 - 8;
        var cols = 8;
        f.brickW = (halfW - BRICK_PAD * (cols + 1)) / cols;
        f.brickH = 14;

        for (var r = 0; r < BRICK_ROWS; r++) {
            for (var c = 0; c < cols; c++) {
                f.bricks.push({
                    x: BRICK_PAD + c * (f.brickW + BRICK_PAD),
                    y: BRICK_TOP_OFFSET + r * (f.brickH + BRICK_PAD),
                    w: f.brickW,
                    h: f.brickH,
                    row: r,
                    alive: true,
                    hits: 0
                });
            }
        }
    }

    function resetPaddle2P(f) {
        var halfW = W / 2;
        f.paddle.w = f.basePaddleW;
        f.paddle.x = (halfW - f.paddle.w) / 2;
        f.paddle.y = H - 40;
    }

    function resetBall2P(f) {
        f.balls = [];
        f.launched = false;
        f.powerups = [];
        f.activePowerups = { W: 0, F: 0 };
        f.paddle.w = f.basePaddleW;
        var halfW = W / 2;
        f.balls.push({
            x: halfW / 2,
            y: f.paddle.y - BALL_RADIUS - 1,
            vx: 0,
            vy: 0,
            speed: BASE_BALL_SPEED,
            fireball: false,
            stuck: true,
            trail: []
        });
    }

    // ─── HUD Updates ───
    function updateHUD1P() {
        document.getElementById('score-1p').textContent = sp.score;
        document.getElementById('lives-1p').textContent = sp.lives;
        document.getElementById('level-1p').textContent = sp.level;
    }

    function updateHUD2P() {
        document.getElementById('score-2p-p1').textContent = 'P1: ' + fields[0].score;
        document.getElementById('score-2p-p2').textContent = 'P2: ' + fields[1].score;
        var min = Math.floor(twoPlayerTimer / 60);
        var sec = Math.floor(twoPlayerTimer % 60);
        document.getElementById('timer-2p').textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
    }

    // ─── Game Loop ───
    function gameLoop() {
        if (!gameRunning || paused) return;

        var now = performance.now();
        var dt = (now - lastTime) / 1000;
        if (dt > 0.05) dt = 0.05; // Cap delta time
        lastTime = now;

        update(dt);
        render();

        animId = requestAnimationFrame(gameLoop);
    }

    // ─── Update ───
    function update(dt) {
        updateParticles(dt);
        updateSparkles(dt);
        updateScreenShake(dt);
        updatePaddleFlashTimers(dt);

        if (mode === 1) {
            updateField(sp, dt, 0, W);
            updatePowerupTimers(sp, dt);
            updateBallTrails(sp);
            updateHUD1P();
        } else {
            twoPlayerTimer -= dt;
            if (twoPlayerTimer <= 0) {
                twoPlayerTimer = 0;
                endTwoPlayer();
                return;
            }
            for (var i = 0; i < 2; i++) {
                var ox = i * (W / 2);
                updateField(fields[i], dt, ox, W / 2);
                updatePowerupTimers(fields[i], dt);
                updateBallTrails(fields[i]);
            }
            // Check if either player cleared all bricks
            for (var j = 0; j < 2; j++) {
                if (!fields[j].bricksCleared && allBricksGone(fields[j])) {
                    fields[j].bricksCleared = true;
                    endTwoPlayer();
                    return;
                }
            }
            updateHUD2P();
        }
    }

    // ─── Visual Update Helpers ───
    function updateBallTrails(state) {
        for (var i = 0; i < state.balls.length; i++) {
            var b = state.balls[i];
            if (!b.trail) b.trail = [];
            if (!b.stuck) {
                b.trail.push({ x: b.x, y: b.y });
                if (b.trail.length > BALL_TRAIL_LENGTH) {
                    b.trail.shift();
                }
            } else {
                b.trail = [];
            }
        }
    }

    function updateScreenShake(dt) {
        if (screenShake.intensity > 0.1) {
            screenShake.x = (Math.random() - 0.5) * 2 * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * 2 * screenShake.intensity;
            screenShake.intensity *= SCREEN_SHAKE_DECAY;
        } else {
            screenShake.x = 0;
            screenShake.y = 0;
            screenShake.intensity = 0;
        }
    }

    function triggerScreenShake() {
        screenShake.intensity = SCREEN_SHAKE_INTENSITY;
    }

    function updateSparkles(dt) {
        for (var i = sparkleParticles.length - 1; i >= 0; i--) {
            var s = sparkleParticles[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vy += 60 * dt; // light gravity on sparkles
            s.life -= dt;
            if (s.life <= 0) sparkleParticles.splice(i, 1);
        }
    }

    function spawnSparkles(x, y, color) {
        for (var i = 0; i < SPARKLE_COUNT; i++) {
            var angle = Math.random() * Math.PI * 2;
            var spd = 20 + Math.random() * 60;
            sparkleParticles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 6,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 20,
                life: SPARKLE_LIFE + Math.random() * 0.3,
                maxLife: SPARKLE_LIFE + 0.3,
                color: color,
                size: 1.5 + Math.random() * 2.5
            });
        }
    }

    function updatePaddleFlashTimers(dt) {
        for (var key in paddleFlashTimers) {
            paddleFlashTimers[key] -= dt;
            if (paddleFlashTimers[key] <= 0) {
                delete paddleFlashTimers[key];
            }
        }
    }

    function triggerPaddleFlash(stateKey) {
        paddleFlashTimers[stateKey] = PADDLE_FLASH_DURATION;
    }

    function updateField(state, dt, fieldX, fieldW) {
        // Move paddle
        movePaddle(state, dt, fieldX, fieldW);

        // Update balls
        for (var i = state.balls.length - 1; i >= 0; i--) {
            var b = state.balls[i];
            if (b.stuck) {
                b.x = state.paddle.x + state.paddle.w / 2;
                b.y = state.paddle.y - BALL_RADIUS - 1;
                continue;
            }

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Wall collisions
            if (b.x - BALL_RADIUS < 0) {
                b.x = BALL_RADIUS;
                b.vx = Math.abs(b.vx);
                CGameAudio.play('bounce');
            }
            if (b.x + BALL_RADIUS > fieldW) {
                b.x = fieldW - BALL_RADIUS;
                b.vx = -Math.abs(b.vx);
                CGameAudio.play('bounce');
            }
            if (b.y - BALL_RADIUS < 0) {
                b.y = BALL_RADIUS;
                b.vy = Math.abs(b.vy);
                CGameAudio.play('bounce');
            }

            // Paddle collision
            if (b.vy > 0 && ballIntersectsRect(b, state.paddle)) {
                b.y = state.paddle.y - BALL_RADIUS - 1;
                var hitPos = (b.x - state.paddle.x) / state.paddle.w; // 0..1
                var angle = -Math.PI * (0.15 + 0.7 * (1 - hitPos)); // steeper at edges
                if (hitPos < 0) angle = -Math.PI * 0.85;
                if (hitPos > 1) angle = -Math.PI * 0.15;

                // Speed up slightly
                b.speed = Math.min(b.speed + BALL_SPEED_INCREMENT, MAX_BALL_SPEED);
                b.vx = Math.cos(angle) * b.speed;
                b.vy = Math.sin(angle) * b.speed;
                CGameAudio.play('bounce');

                // Trigger paddle flash
                var flashKey = mode === 1 ? 'sp' : String(state.player);
                triggerPaddleFlash(flashKey);
            }

            // Brick collisions
            for (var j = 0; j < state.bricks.length; j++) {
                var brick = state.bricks[j];
                if (!brick.alive) continue;

                if (ballIntersectsRect(b, brick)) {
                    brick.alive = false;
                    state.score += 10;
                    CGameAudio.play('hit');

                    // Particles
                    var color = ROW_COLORS[brick.row % ROW_COLORS.length].fill;
                    spawnParticles(fieldX + brick.x + brick.w / 2, brick.y + brick.h / 2, color);

                    // Screen shake on brick break
                    triggerScreenShake();

                    // Powerup drop
                    if (Math.random() < POWERUP_CHANCE) {
                        var type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                        state.powerups.push({
                            x: brick.x + brick.w / 2 - POWERUP_SIZE / 2,
                            y: brick.y + brick.h,
                            type: type
                        });
                    }

                    // Reflect ball (unless fireball)
                    if (!b.fireball) {
                        // Determine which side was hit
                        var overlapLeft = (b.x + BALL_RADIUS) - brick.x;
                        var overlapRight = (brick.x + brick.w) - (b.x - BALL_RADIUS);
                        var overlapTop = (b.y + BALL_RADIUS) - brick.y;
                        var overlapBottom = (brick.y + brick.h) - (b.y - BALL_RADIUS);

                        var minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                        if (minOverlap === overlapTop || minOverlap === overlapBottom) {
                            b.vy = -b.vy;
                        } else {
                            b.vx = -b.vx;
                        }
                    }
                    // Fireball: don't reflect, just keep going
                    break; // One brick per frame per ball
                }
            }

            // Ball lost below
            if (b.y - BALL_RADIUS > H) {
                state.balls.splice(i, 1);
            }
        }

        // If no balls left
        if (state.balls.length === 0) {
            if (mode === 1) {
                sp.lives--;
                updateHUD1P();
                if (sp.lives <= 0) {
                    gameOver1P();
                } else {
                    CGameAudio.play('lose');
                    resetBall(sp);
                }
            } else {
                // 2P: just reset ball
                CGameAudio.play('lose');
                resetBall2P(state);
            }
        }

        // Update powerups
        for (var k = state.powerups.length - 1; k >= 0; k--) {
            var pu = state.powerups[k];
            pu.y += POWERUP_SPEED * dt;

            // Spawn sparkle trail behind falling powerups
            var puColor = POWERUP_COLORS[pu.type];
            spawnSparkles(fieldX + pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE, puColor);

            // Catch
            if (pu.y + POWERUP_SIZE >= state.paddle.y &&
                pu.y <= state.paddle.y + state.paddle.h &&
                pu.x + POWERUP_SIZE >= state.paddle.x &&
                pu.x <= state.paddle.x + state.paddle.w) {
                applyPowerup(state, pu.type);
                state.powerups.splice(k, 1);
                CGameAudio.play('score');
                continue;
            }

            // Fell off
            if (pu.y > H) {
                state.powerups.splice(k, 1);
            }
        }

        // Check level clear (single player)
        if (mode === 1 && allBricksGone(sp)) {
            sp.score += LEVEL_BONUS;
            sp.level++;
            CGameAudio.play('win');
            buildBricks(sp, sp.level - 1);
            resetBall(sp);
            updateHUD1P();
            GameShell.showToast('Level ' + sp.level + '!', 1200);
        }
    }

    function allBricksGone(state) {
        for (var i = 0; i < state.bricks.length; i++) {
            if (state.bricks[i].alive) return false;
        }
        return true;
    }

    function movePaddle(state, dt, fieldX, fieldW) {
        var speed = 450;
        var moved = false;

        if (mode === 1) {
            // Keyboard: Left/Right or A/D
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                state.paddle.x -= speed * dt;
                moved = true;
            }
            if (keys['ArrowRight'] || keys['d'] || keys['D']) {
                state.paddle.x += speed * dt;
                moved = true;
            }
            // Touch/Mouse: move to touch position
            if (!moved) {
                for (var id in touches) {
                    var tx = touches[id].x;
                    state.paddle.x = tx - state.paddle.w / 2;
                    break;
                }
            }
        } else {
            // Two player
            var pIdx = state.player;
            if (pIdx === 0) {
                // P1: A/D
                if (keys['a'] || keys['A']) { state.paddle.x -= speed * dt; }
                if (keys['d'] || keys['D']) { state.paddle.x += speed * dt; }
            } else {
                // P2: Arrow keys
                if (keys['ArrowLeft']) { state.paddle.x -= speed * dt; }
                if (keys['ArrowRight']) { state.paddle.x += speed * dt; }
            }
            // Touch: drag on respective half
            var halfW = W / 2;
            for (var tid in touches) {
                var ttx = touches[tid].x;
                if (pIdx === 0 && ttx < halfW) {
                    state.paddle.x = ttx - state.paddle.w / 2;
                } else if (pIdx === 1 && ttx >= halfW) {
                    state.paddle.x = (ttx - halfW) - state.paddle.w / 2;
                }
            }
        }

        // Clamp paddle
        if (state.paddle.x < 0) state.paddle.x = 0;
        if (state.paddle.x + state.paddle.w > fieldW) {
            state.paddle.x = fieldW - state.paddle.w;
        }
    }

    function ballIntersectsRect(ball, rect) {
        var cx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
        var cy = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
        var dx = ball.x - cx;
        var dy = ball.y - cy;
        return (dx * dx + dy * dy) < (BALL_RADIUS * BALL_RADIUS);
    }

    // ─── Powerups ───
    function applyPowerup(state, type) {
        if (type === 'W') {
            // Wider paddle
            state.activePowerups.W = POWERUP_DURATION;
            state.paddle.w = state.basePaddleW * 1.5;
        } else if (type === 'M') {
            // Multi-ball: spawn 2 extra balls
            var existing = null;
            for (var i = 0; i < state.balls.length; i++) {
                if (!state.balls[i].stuck) { existing = state.balls[i]; break; }
            }
            if (existing) {
                for (var j = 0; j < 2; j++) {
                    var angle = Math.atan2(existing.vy, existing.vx) + (j === 0 ? 0.4 : -0.4);
                    state.balls.push({
                        x: existing.x,
                        y: existing.y,
                        vx: Math.cos(angle) * existing.speed,
                        vy: Math.sin(angle) * existing.speed,
                        speed: existing.speed,
                        fireball: existing.fireball,
                        stuck: false,
                        trail: []
                    });
                }
            }
        } else if (type === 'F') {
            // Fireball: balls go through bricks
            state.activePowerups.F = POWERUP_DURATION;
            for (var k = 0; k < state.balls.length; k++) {
                state.balls[k].fireball = true;
            }
        }
    }

    function updatePowerupTimers(state, dt) {
        var dtMs = dt * 1000;
        if (state.activePowerups.W > 0) {
            state.activePowerups.W -= dtMs;
            if (state.activePowerups.W <= 0) {
                state.activePowerups.W = 0;
                state.paddle.w = state.basePaddleW;
                // Clamp paddle position
                var fw = mode === 2 ? W / 2 : W;
                if (state.paddle.x + state.paddle.w > fw) {
                    state.paddle.x = fw - state.paddle.w;
                }
            }
        }
        if (state.activePowerups.F > 0) {
            state.activePowerups.F -= dtMs;
            if (state.activePowerups.F <= 0) {
                state.activePowerups.F = 0;
                for (var i = 0; i < state.balls.length; i++) {
                    state.balls[i].fireball = false;
                }
            }
        }
    }

    // ─── Particles ───
    function spawnParticles(x, y, color) {
        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var angle = Math.random() * Math.PI * 2;
            var spd = 80 + Math.random() * 200;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: PARTICLE_LIFE,
                maxLife: PARTICLE_LIFE,
                color: color,
                size: 2 + Math.random() * 3
            });
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += PARTICLE_GRAVITY * dt; // gravity
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ─── Game Over ───
    function gameOver1P() {
        stopGame();
        CGameAudio.play('lose');
        GameShell.addScore({ game: 'brickblast', score: sp.score, mode: '1P' });
        document.getElementById('winner-text').textContent = 'Game Over';
        document.getElementById('final-score').textContent = 'Score: ' + sp.score + '  |  Level: ' + sp.level;
        GameShell.showScreen('gameover-screen');
    }

    function endTwoPlayer() {
        stopGame();
        var p1 = fields[0].score;
        var p2 = fields[1].score;
        var p1Cleared = allBricksGone(fields[0]);
        var p2Cleared = allBricksGone(fields[1]);

        var winText = '';
        if (p1Cleared && !p2Cleared) {
            winText = 'Player 1 Wins!';
            CGameAudio.play('win');
        } else if (p2Cleared && !p1Cleared) {
            winText = 'Player 2 Wins!';
            CGameAudio.play('win');
        } else if (p1 > p2) {
            winText = 'Player 1 Wins!';
            CGameAudio.play('win');
        } else if (p2 > p1) {
            winText = 'Player 2 Wins!';
            CGameAudio.play('win');
        } else {
            winText = 'Draw!';
            CGameAudio.play('lose');
        }

        document.getElementById('winner-text').textContent = winText;
        document.getElementById('final-score').textContent = 'P1: ' + p1 + '  |  P2: ' + p2;
        GameShell.showScreen('gameover-screen');
    }

    // ─── Helper: parse hex color to RGB ───
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return { r: r, g: g, b: b };
    }

    function lightenColor(hex, amount) {
        var rgb = hexToRgb(hex);
        var r = Math.min(255, rgb.r + amount);
        var g = Math.min(255, rgb.g + amount);
        var b = Math.min(255, rgb.b + amount);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function darkenColor(hex, amount) {
        var rgb = hexToRgb(hex);
        var r = Math.max(0, rgb.r - amount);
        var g = Math.max(0, rgb.g - amount);
        var b = Math.max(0, rgb.b - amount);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    // ─── Rendering ───
    function render() {
        ctx.save();

        // Apply screen shake offset
        if (screenShake.intensity > 0) {
            ctx.translate(screenShake.x, screenShake.y);
        }

        // Background with radial gradient and grid
        renderBackground();

        if (mode === 1) {
            renderField(sp, 0, W);
        } else {
            // Draw divider
            var style = getComputedStyle(document.documentElement);
            ctx.save();
            ctx.strokeStyle = style.getPropertyValue('--border-color').trim() || 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(W / 2, 0);
            ctx.lineTo(W / 2, H);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Field 1 (left)
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W / 2, H);
            ctx.clip();
            renderField(fields[0], 0, W / 2);
            ctx.restore();

            // Field 2 (right)
            ctx.save();
            ctx.translate(W / 2, 0);
            ctx.beginPath();
            ctx.rect(0, 0, W / 2, H);
            ctx.clip();
            renderField(fields[1], W / 2, W / 2);
            ctx.restore();

            // Player labels
            ctx.font = 'bold 14px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            var p1Color = style.getPropertyValue('--p1-color').trim() || '#00b4ff';
            var p2Color = style.getPropertyValue('--p2-color').trim() || '#ff4466';
            ctx.fillStyle = p1Color;
            ctx.fillText('P1', W / 4, 20);
            ctx.fillStyle = p2Color;
            ctx.fillText('P2', W * 3 / 4, 20);
        }

        // Particles (global coords)
        renderParticles();

        // Sparkle particles (global coords)
        renderSparkles();

        // Launch hint
        if (mode === 1 && !sp.launched) {
            renderLaunchHint(W / 2, sp.paddle.y - 40);
        } else if (mode === 2) {
            for (var i = 0; i < fields.length; i++) {
                if (!fields[i].launched) {
                    var ox = i * (W / 2);
                    renderLaunchHint(ox + W / 4, fields[i].paddle.y - 40);
                }
            }
        }

        ctx.restore(); // restore screen shake translate
    }

    // ─── Background Rendering ───
    function renderBackground() {
        var style = getComputedStyle(document.documentElement);
        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        if (isDark) {
            // Rich deep blue/purple gradient instead of near-black
            var grad = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
            grad.addColorStop(0, '#1a1a3e');
            grad.addColorStop(0.5, '#141430');
            grad.addColorStop(1, '#0a0a1e');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Ambient glow behind brick area (soft colored light)
            var ambientGlow = ctx.createRadialGradient(W / 2, BRICK_TOP_OFFSET + 60, 20, W / 2, BRICK_TOP_OFFSET + 80, W * 0.6);
            ambientGlow.addColorStop(0, 'rgba(100, 60, 180, 0.12)');
            ambientGlow.addColorStop(0.5, 'rgba(60, 40, 140, 0.06)');
            ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = ambientGlow;
            ctx.fillRect(0, 0, W, H);

            // Side vignette glow (subtle warm accents)
            var leftGlow = ctx.createRadialGradient(0, H / 2, 0, 0, H / 2, W * 0.4);
            leftGlow.addColorStop(0, 'rgba(0, 100, 200, 0.04)');
            leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = leftGlow;
            ctx.fillRect(0, 0, W, H);

            var rightGlow = ctx.createRadialGradient(W, H / 2, 0, W, H / 2, W * 0.4);
            rightGlow.addColorStop(0, 'rgba(200, 50, 100, 0.04)');
            rightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = rightGlow;
            ctx.fillRect(0, 0, W, H);
        } else {
            // Light mode - clean soft background
            var gradL = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
            gradL.addColorStop(0, '#f0f2ff');
            gradL.addColorStop(0.5, '#e4e6f0');
            gradL.addColorStop(1, '#d8dce8');
            ctx.fillStyle = gradL;
            ctx.fillRect(0, 0, W, H);
        }

        // Visible grid pattern
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(120, 130, 200, 0.06)' : 'rgba(0, 0, 50, 0.05)';
        ctx.lineWidth = 1;
        var gridSize = 40;
        ctx.beginPath();
        for (var gx = 0; gx <= W; gx += gridSize) {
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, H);
        }
        for (var gy = 0; gy <= H; gy += gridSize) {
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
        }
        ctx.stroke();
        ctx.restore();

        // Bottom zone glow (where paddle operates)
        var paddleZone = ctx.createLinearGradient(0, H - 80, 0, H);
        if (isDark) {
            paddleZone.addColorStop(0, 'rgba(0, 0, 0, 0)');
            paddleZone.addColorStop(1, 'rgba(30, 40, 80, 0.15)');
        } else {
            paddleZone.addColorStop(0, 'rgba(0, 0, 0, 0)');
            paddleZone.addColorStop(1, 'rgba(0, 20, 60, 0.06)');
        }
        ctx.fillStyle = paddleZone;
        ctx.fillRect(0, H - 80, W, 80);
    }

    function renderField(state, fieldX, fieldW) {
        var style = getComputedStyle(document.documentElement);
        var pColor;
        if (mode === 2) {
            pColor = state.player === 0
                ? (style.getPropertyValue('--p1-color').trim() || '#00b4ff')
                : (style.getPropertyValue('--p2-color').trim() || '#ff4466');
        } else {
            pColor = style.getPropertyValue('--p1-color').trim() || '#00b4ff';
        }

        // Bricks
        for (var i = 0; i < state.bricks.length; i++) {
            var brick = state.bricks[i];
            if (!brick.alive) continue;
            var colors = ROW_COLORS[brick.row % ROW_COLORS.length];
            drawBrick(brick.x, brick.y, brick.w, brick.h, colors, brick);
        }

        // Powerups
        for (var j = 0; j < state.powerups.length; j++) {
            var pu = state.powerups[j];
            drawPowerup(pu.x, pu.y, pu.type);
        }

        // Paddle
        var flashKey = mode === 1 ? 'sp' : String(state.player);
        var flashAmount = paddleFlashTimers[flashKey] || 0;
        drawPaddle(state.paddle, pColor, flashAmount);

        // Balls
        for (var k = 0; k < state.balls.length; k++) {
            drawBall(state.balls[k]);
        }

        // Active powerup indicators
        drawPowerupIndicators(state, fieldW);
    }

    function drawBrick(x, y, w, h, colors, brick) {
        var r = BRICK_CORNER_RADIUS;

        ctx.save();

        // Brick glow shadow (gives depth against background)
        ctx.shadowColor = colors.fill;
        ctx.shadowBlur = 6;

        // Glossy gradient fill (lighter at top, darker at bottom)
        var grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, lightenColor(colors.fill, 50));
        grad.addColorStop(0.35, lightenColor(colors.fill, 10));
        grad.addColorStop(1, darkenColor(colors.fill, 30));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();

        // Reset shadow for detail drawing
        ctx.shadowBlur = 0;

        // Top highlight stripe (glossy effect)
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 1, w - 4, h * 0.3, [r - 1, r - 1, 0, 0]);
        ctx.fill();

        // Subtle border
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.stroke();

        // Crack lines when hit but not broken (hits > 0 but still alive)
        if (brick && brick.hits > 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1.5;
            var cx = x + w * 0.5;
            var cy = y + h * 0.5;
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.2, cy - h * 0.3);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + w * 0.15, cy + h * 0.35);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + w * 0.25, cy - h * 0.2);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawPaddle(paddle, color, flashAmount) {
        var x = paddle.x;
        var y = paddle.y;
        var w = paddle.w;
        var h = paddle.h;

        ctx.save();

        // Glow aura underneath the paddle
        var glowGrad = ctx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w * 0.5);
        var colorRgb = hexToRgb(color);
        glowGrad.addColorStop(0, 'rgba(' + colorRgb.r + ',' + colorRgb.g + ',' + colorRgb.b + ',0.25)');
        glowGrad.addColorStop(1, 'rgba(' + colorRgb.r + ',' + colorRgb.g + ',' + colorRgb.b + ',0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(x - w * 0.15, y, w * 1.3, h * 2.5);

        // Paddle body with linear gradient
        var bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
        bodyGrad.addColorStop(0, lightenColor(color, 50));
        bodyGrad.addColorStop(0.5, color);
        bodyGrad.addColorStop(1, darkenColor(color, 40));
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 2, w - 6, h / 2 - 1, 4);
        ctx.fill();

        // Hit flash overlay (white flash that fades)
        if (flashAmount > 0) {
            var flashAlpha = flashAmount / PADDLE_FLASH_DURATION;
            ctx.fillStyle = 'rgba(255,255,255,' + (flashAlpha * 0.6) + ')';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 6);
            ctx.fill();
        }

        ctx.restore();
    }

    function drawBall(ball) {
        ctx.save();

        // Draw trail (stored positions with decreasing alpha and size)
        if (ball.trail && ball.trail.length > 0) {
            for (var t = 0; t < ball.trail.length; t++) {
                var trailAlpha = (t + 1) / (ball.trail.length + 1) * 0.35;
                var trailSize = BALL_RADIUS * ((t + 1) / (ball.trail.length + 1)) * 0.8;
                ctx.globalAlpha = trailAlpha;
                if (ball.fireball) {
                    ctx.fillStyle = '#ff6622';
                } else {
                    ctx.fillStyle = '#aaccff';
                }
                ctx.beginPath();
                ctx.arc(ball.trail[t].x, ball.trail[t].y, trailSize, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Speed-based glow: increases with speed
        var speedRatio = Math.min(ball.speed / MAX_BALL_SPEED, 1);
        var baseGlow = 6;
        var maxExtraGlow = 18;
        var glowAmount = baseGlow + speedRatio * maxExtraGlow;

        if (ball.fireball) {
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = glowAmount + 6;
        } else {
            ctx.shadowColor = '#88bbff';
            ctx.shadowBlur = glowAmount;
        }

        // Ball with radial gradient (white center to accent edge)
        var ballGrad = ctx.createRadialGradient(
            ball.x - BALL_RADIUS * 0.3, ball.y - BALL_RADIUS * 0.3, BALL_RADIUS * 0.1,
            ball.x, ball.y, BALL_RADIUS
        );
        if (ball.fireball) {
            ballGrad.addColorStop(0, '#ffffaa');
            ballGrad.addColorStop(0.4, '#ff8833');
            ballGrad.addColorStop(1, '#cc3300');
        } else {
            ballGrad.addColorStop(0, '#ffffff');
            ballGrad.addColorStop(0.5, '#ddeeff');
            ballGrad.addColorStop(1, '#6699cc');
        }

        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight (no shadow)
        ctx.shadowBlur = 0;
        ctx.fillStyle = ball.fireball ? 'rgba(255,255,200,0.7)' : 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(ball.x - 2, ball.y - 2, BALL_RADIUS * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawPowerup(x, y, type) {
        var color = POWERUP_COLORS[type];
        var now = performance.now();

        ctx.save();

        // Pulsing glow effect
        var pulse = 0.6 + Math.sin(now / 200) * 0.4; // 0.2 to 1.0
        var colorRgb = hexToRgb(color);
        ctx.shadowColor = 'rgba(' + colorRgb.r + ',' + colorRgb.g + ',' + colorRgb.b + ',' + pulse + ')';
        ctx.shadowBlur = 8 + pulse * 8;

        // Gradient fill for powerup box
        var puGrad = ctx.createLinearGradient(x, y, x, y + POWERUP_SIZE);
        puGrad.addColorStop(0, lightenColor(color, 40));
        puGrad.addColorStop(1, darkenColor(color, 30));
        ctx.fillStyle = puGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, POWERUP_SIZE, POWERUP_SIZE, 4);
        ctx.fill();

        // Border with glow influence
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + pulse * 0.3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, POWERUP_SIZE, POWERUP_SIZE, 4);
        ctx.stroke();

        // Letter
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(type, x + POWERUP_SIZE / 2, y + POWERUP_SIZE / 2);

        ctx.restore();
    }

    function drawPowerupIndicators(state, fieldW) {
        var y = H - 14;
        var x = 6;
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        if (state.activePowerups.W > 0) {
            ctx.fillStyle = POWERUP_COLORS.W;
            var secs = Math.ceil(state.activePowerups.W / 1000);
            ctx.fillText('W:' + secs + 's', x, y);
            x += 46;
        }
        if (state.activePowerups.F > 0) {
            ctx.fillStyle = POWERUP_COLORS.F;
            var secsF = Math.ceil(state.activePowerups.F / 1000);
            ctx.fillText('F:' + secsF + 's', x, y);
        }
    }

    function renderParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = p.life / p.maxLife;
            var shrink = alpha; // particles shrink as they die
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;

            // Draw as small rounded rects for variety
            ctx.beginPath();
            var sz = p.size * shrink;
            ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function renderSparkles() {
        for (var i = 0; i < sparkleParticles.length; i++) {
            var s = sparkleParticles[i];
            var alpha = s.life / s.maxLife;
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = '#ffffff';

            // Draw as a small diamond/star shape
            var sz = s.size * alpha;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(performance.now() / 300 + i); // slow spin
            ctx.beginPath();
            ctx.moveTo(0, -sz);
            ctx.lineTo(sz * 0.3, 0);
            ctx.lineTo(0, sz);
            ctx.lineTo(-sz * 0.3, 0);
            ctx.closePath();
            ctx.fill();

            // Cross sparkle
            ctx.beginPath();
            ctx.moveTo(-sz, 0);
            ctx.lineTo(0, sz * 0.3);
            ctx.lineTo(sz, 0);
            ctx.lineTo(0, -sz * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    function renderLaunchHint(x, y) {
        ctx.save();
        var alpha = 0.5 + Math.sin(performance.now() / 400) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#a0a0b0';
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var hint = GameShell.getInputType() === 'touch' ? 'Tap to launch' : 'Click or Space to launch';
        ctx.fillText(hint, x, y);
        ctx.restore();
    }

    // ─── roundRect polyfill ───
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (typeof r === 'number') r = [r, r, r, r];
            if (Array.isArray(r) && r.length < 4) {
                while (r.length < 4) r.push(r[0] || 0);
            }
            var tl = r[0] || 0, tr = r[1] || r[0] || 0, br = r[2] || r[0] || 0, bl = r[3] || r[1] || r[0] || 0;
            this.moveTo(x + tl, y);
            this.lineTo(x + w - tr, y);
            this.quadraticCurveTo(x + w, y, x + w, y + tr);
            this.lineTo(x + w, y + h - br);
            this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
            this.lineTo(x + bl, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - bl);
            this.lineTo(x, y + tl);
            this.quadraticCurveTo(x, y, x + tl, y);
            this.closePath();
            return this;
        };
    }

})();
