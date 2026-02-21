/* === Air Hockey - Cgames (Visual Overhaul) === */
(function () {
    'use strict';

    // ─── Constants ───
    var WIN_SCORE = 7;
    var TABLE_RATIO = 1.6;
    var GOAL_WIDTH_RATIO = 0.40;
    var PADDLE_RADIUS_RATIO = 0.065;
    var PUCK_RADIUS_RATIO = 0.04;
    var PUCK_MAX_SPEED = 1200;
    var PUCK_FRICTION = 0.998;
    var PADDLE_SPEED = 500;
    var WALL_BOUNCE = 0.85;
    var PADDLE_HIT_BOOST = 1.3;
    var COUNTDOWN_SECS = 3;
    var TRAIL_LENGTH = 8;
    var TRAIL_SPEED_THRESHOLD = 300;

    var AI_PRESETS = {
        easy:   { reaction: 0.12, maxSpeed: 0.45, errorMargin: 60, aggressiveness: 0.15 },
        medium: { reaction: 0.06, maxSpeed: 0.70, errorMargin: 30, aggressiveness: 0.40 },
        hard:   { reaction: 0.02, maxSpeed: 0.92, errorMargin: 8,  aggressiveness: 0.70 }
    };

    // ─── State ───
    var canvas, ctx;
    var tw, th, tx, ty;
    var scale = 1;
    var mode = '1p';
    var aiDiff = 'medium';
    var aiConf;
    var paused = false;
    var running = false;
    var countdownActive = false;
    var globalTime = 0;

    var score = { p1: 0, p2: 0 };
    var goalWidth;
    var paddleR, puckR;

    var puck = { x: 0, y: 0, vx: 0, vy: 0 };
    var p1 = { x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0 };
    var p2 = { x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0 };

    var trail = [];
    var particles = [];
    var screenShake = { x: 0, y: 0, intensity: 0 };
    var goalFlash = { active: false, timer: 0, player: 0 };
    var scuffMarks = [];

    var keys = {};
    var mouse = { down: false, x: 0, y: 0, active: false };
    var touches = {};

    var aiTargetX = 0, aiTargetY = 0, aiUpdateTimer = 0;

    var colors = {};

    var elScoreP1, elScoreP2, elWinner, elFinalScore;
    var elCountdownOverlay, elCountdownNumber;
    var elPauseOverlay;
    var containerEl;

    // ─── Init ───
    function init() {
        GameShell.init({ backUrl: '../' });

        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        containerEl = document.getElementById('canvas-container');

        elScoreP1 = document.getElementById('score-p1');
        elScoreP2 = document.getElementById('score-p2');
        elWinner = document.getElementById('winner-text');
        elFinalScore = document.getElementById('final-score');
        elCountdownOverlay = document.getElementById('countdown-overlay');
        elCountdownNumber = document.getElementById('countdown-number');
        elPauseOverlay = document.getElementById('pause-overlay');

        bindUI();
        bindInput();
        window.addEventListener('resize', resizeCanvas);
    }

    // ─── UI ───
    function bindUI() {
        document.getElementById('btn-1p').addEventListener('click', function () {
            CGameAudio.play('select');
            mode = '1p';
            document.getElementById('difficulty-select').classList.remove('hidden');
        });
        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('select');
            mode = '2p';
            document.getElementById('difficulty-select').classList.add('hidden');
            startGame();
        });
        var diffBtns = document.querySelectorAll('[data-diff]');
        for (var i = 0; i < diffBtns.length; i++) {
            diffBtns[i].addEventListener('click', function () {
                CGameAudio.play('select');
                aiDiff = this.getAttribute('data-diff');
                startGame();
            });
        }
        document.getElementById('btn-pause').addEventListener('click', function () {
            if (!running || countdownActive) return;
            togglePause();
        });
        document.getElementById('btn-resume').addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });
        document.getElementById('btn-quit').addEventListener('click', function () {
            CGameAudio.play('back');
            running = false; paused = false;
            elPauseOverlay.classList.add('hidden');
            GameShell.showScreen('title-screen');
            document.getElementById('difficulty-select').classList.add('hidden');
        });
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('select');
            startGame();
        });
        document.getElementById('btn-menu').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('title-screen');
            document.getElementById('difficulty-select').classList.add('hidden');
        });
    }

    // ─── Input ───
    function bindInput() {
        window.addEventListener('keydown', function (e) {
            keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape' && running && !countdownActive) togglePause();
        });
        window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

        canvas.addEventListener('mousedown', function (e) {
            var pos = canvasPos(e.clientX, e.clientY);
            mouse.down = true; mouse.x = pos.x; mouse.y = pos.y; mouse.active = true;
        });
        window.addEventListener('mousemove', function (e) {
            if (!mouse.down) return;
            var pos = canvasPos(e.clientX, e.clientY);
            mouse.x = pos.x; mouse.y = pos.y;
        });
        window.addEventListener('mouseup', function () { mouse.down = false; mouse.active = false; });

        canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            for (var i = 0; i < e.changedTouches.length; i++) {
                var t = e.changedTouches[i];
                var pos = canvasPos(t.clientX, t.clientY);
                var player = pos.y > (ty + th / 2) ? 1 : 2;
                touches[t.identifier] = { x: pos.x, y: pos.y, player: player };
            }
        }, { passive: false });
        canvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            for (var i = 0; i < e.changedTouches.length; i++) {
                var t = e.changedTouches[i];
                if (touches[t.identifier]) {
                    var pos = canvasPos(t.clientX, t.clientY);
                    touches[t.identifier].x = pos.x; touches[t.identifier].y = pos.y;
                }
            }
        }, { passive: false });
        canvas.addEventListener('touchend', function (e) {
            for (var i = 0; i < e.changedTouches.length; i++) delete touches[e.changedTouches[i].identifier];
        });
        canvas.addEventListener('touchcancel', function (e) {
            for (var i = 0; i < e.changedTouches.length; i++) delete touches[e.changedTouches[i].identifier];
        });
    }

    function canvasPos(cx, cy) {
        var rect = canvas.getBoundingClientRect();
        return { x: (cx - rect.left) * canvas.width / rect.width, y: (cy - rect.top) * canvas.height / rect.height };
    }

    // ─── Canvas ───
    function resizeCanvas() {
        if (!containerEl) return;
        var cw = containerEl.clientWidth, ch = containerEl.clientHeight, pad = 10;
        var maxW = cw - pad * 2, maxH = ch - pad * 2;
        var tableW = maxW, tableH = tableW * TABLE_RATIO;
        if (tableH > maxH) { tableH = maxH; tableW = tableH / TABLE_RATIO; }
        canvas.width = Math.round(tableW + pad * 2);
        canvas.height = Math.round(tableH + pad * 2);
        tw = Math.round(tableW); th = Math.round(tableH);
        tx = Math.round((canvas.width - tw) / 2);
        ty = Math.round((canvas.height - th) / 2);
        scale = tw / 600;
        goalWidth = tw * GOAL_WIDTH_RATIO;
        paddleR = tw * PADDLE_RADIUS_RATIO;
        puckR = tw * PUCK_RADIUS_RATIO;
    }

    // ─── Start ───
    function startGame() {
        score.p1 = 0; score.p2 = 0;
        updateScoreUI();
        aiConf = AI_PRESETS[aiDiff] || AI_PRESETS.medium;
        paused = false; running = true;
        particles = []; scuffMarks = [];
        goalFlash = { active: false, timer: 0, player: 0 };
        screenShake = { x: 0, y: 0, intensity: 0 };
        globalTime = 0;
        elPauseOverlay.classList.add('hidden');
        GameShell.showScreen('game-screen');
        resizeCanvas(); readColors(); resetPositions();
        startCountdown(function () {
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        });
    }

    function readColors() {
        var s = getComputedStyle(document.body);
        colors.bg = s.getPropertyValue('--canvas-bg').trim() || '#0d0d1a';
        colors.p1 = s.getPropertyValue('--p1-color').trim() || '#00b4ff';
        colors.p1Light = s.getPropertyValue('--p1-light').trim() || '#42d4ff';
        colors.p2 = s.getPropertyValue('--p2-color').trim() || '#ff4466';
        colors.p2Light = s.getPropertyValue('--p2-light').trim() || '#ff7799';
        colors.accent = s.getPropertyValue('--accent').trim() || '#ffdd00';
        colors.textMuted = s.getPropertyValue('--text-muted').trim() || '#666680';
        colors.border = s.getPropertyValue('--border-color').trim() || 'rgba(255,255,255,0.1)';
        colors.bgSecondary = s.getPropertyValue('--bg-secondary').trim() || '#1a1a2e';
    }

    function resetPositions() {
        puck.x = tx + tw / 2; puck.y = ty + th / 2; puck.vx = 0; puck.vy = 0;
        p1.x = tx + tw / 2; p1.y = ty + th - paddleR * 2.5;
        p1.vx = 0; p1.vy = 0; p1.prevX = p1.x; p1.prevY = p1.y;
        p2.x = tx + tw / 2; p2.y = ty + paddleR * 2.5;
        p2.vx = 0; p2.vy = 0; p2.prevX = p2.x; p2.prevY = p2.y;
        trail = [];
    }

    // ─── Countdown ───
    function startCountdown(cb) {
        countdownActive = true;
        var count = COUNTDOWN_SECS;
        elCountdownOverlay.classList.remove('hidden');
        elCountdownNumber.textContent = count;
        CGameAudio.play('countdown');
        drawFrame();
        var interval = setInterval(function () {
            count--;
            if (count > 0) {
                elCountdownNumber.textContent = count;
                elCountdownNumber.style.animation = 'none';
                void elCountdownNumber.offsetWidth;
                elCountdownNumber.style.animation = '';
                CGameAudio.play('countdown');
                drawFrame();
            } else {
                elCountdownOverlay.classList.add('hidden');
                countdownActive = false;
                clearInterval(interval);
                CGameAudio.play('score');
                if (cb) cb();
            }
        }, 1000);
    }

    function togglePause() {
        paused = !paused;
        if (paused) { elPauseOverlay.classList.remove('hidden'); }
        else { elPauseOverlay.classList.add('hidden'); lastTime = performance.now(); requestAnimationFrame(gameLoop); }
    }

    // ─── Game loop ───
    var lastTime = 0;
    function gameLoop(timestamp) {
        if (!running || paused) return;
        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.05) dt = 0.05;
        globalTime += dt;
        update(dt);
        drawFrame();
        requestAnimationFrame(gameLoop);
    }

    // ─── Update ───
    function update(dt) {
        p1.prevX = p1.x; p1.prevY = p1.y;
        p2.prevX = p2.x; p2.prevY = p2.y;

        updateP1(dt);
        if (mode === '2p') updateP2Human(dt); else updateAI(dt);

        if (dt > 0) {
            p1.vx = (p1.x - p1.prevX) / dt; p1.vy = (p1.y - p1.prevY) / dt;
            p2.vx = (p2.x - p2.prevX) / dt; p2.vy = (p2.y - p2.prevY) / dt;
        }

        updatePuck(dt);
        checkGoal();

        // Screen shake
        if (screenShake.intensity > 0.5) {
            screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.intensity *= 0.9;
        } else { screenShake.x = 0; screenShake.y = 0; screenShake.intensity = 0; }

        // Goal flash
        if (goalFlash.active) {
            goalFlash.timer -= dt;
            if (goalFlash.timer <= 0) goalFlash.active = false;
        }

        // Particles
        for (var i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.x += pt.vx * dt; pt.y += pt.vy * dt;
            pt.life -= dt;
            pt.vy += 100 * dt;
            if (pt.life <= 0) particles.splice(i, 1);
        }
        if (particles.length > 150) particles.splice(0, particles.length - 150);

        // Scuff marks fade
        for (var j = scuffMarks.length - 1; j >= 0; j--) {
            scuffMarks[j].alpha -= dt * 0.15;
            if (scuffMarks[j].alpha <= 0) scuffMarks.splice(j, 1);
        }
        if (scuffMarks.length > 100) scuffMarks.splice(0, scuffMarks.length - 100);
    }

    function updateP1(dt) {
        var speed = PADDLE_SPEED * scale;
        var moved = false;
        var touchP1 = getTouchForPlayer(1);
        if (touchP1) { p1.x = touchP1.x; p1.y = touchP1.y; moved = true; }
        else if (mouse.active && mouse.down && mouse.y > ty + th / 2) {
            p1.x = mouse.x; p1.y = mouse.y; moved = true;
        }
        if (!moved) {
            var useArrows = (mode !== '2p');
            if (keys['w'] || (useArrows && keys['arrowup'])) p1.y -= speed * dt;
            if (keys['s'] || (useArrows && keys['arrowdown'])) p1.y += speed * dt;
            if (keys['a'] || (useArrows && keys['arrowleft'])) p1.x -= speed * dt;
            if (keys['d'] || (useArrows && keys['arrowright'])) p1.x += speed * dt;
        }
        constrainPaddle(p1, 'bottom');
    }

    function updateP2Human(dt) {
        var speed = PADDLE_SPEED * scale;
        var moved = false;
        var touchP2 = getTouchForPlayer(2);
        if (touchP2) { p2.x = touchP2.x; p2.y = touchP2.y; moved = true; }
        if (!moved) {
            if (keys['arrowup']) p2.y -= speed * dt;
            if (keys['arrowdown']) p2.y += speed * dt;
            if (keys['arrowleft']) p2.x -= speed * dt;
            if (keys['arrowright']) p2.x += speed * dt;
        }
        constrainPaddle(p2, 'top');
    }

    function updateAI(dt) {
        aiUpdateTimer -= dt;
        if (aiUpdateTimer <= 0) { aiUpdateTimer = aiConf.reaction; computeAITarget(); }
        var speed = PADDLE_SPEED * scale * aiConf.maxSpeed;
        var dx = aiTargetX - p2.x, dy = aiTargetY - p2.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) { var mv = Math.min(speed * dt, dist); p2.x += (dx / dist) * mv; p2.y += (dy / dist) * mv; }
        constrainPaddle(p2, 'top');
    }

    function computeAITarget() {
        var centerX = tx + tw / 2, homeY = ty + paddleR * 2.5;
        var errorX = (Math.random() - 0.5) * aiConf.errorMargin * scale;
        var errorY = (Math.random() - 0.5) * aiConf.errorMargin * scale * 0.5;
        if (puck.vy < -30 * scale) {
            var targetY = ty + th * 0.2;
            var timeToLine = (puck.y - targetY) / (-puck.vy);
            if (timeToLine > 0 && timeToLine < 2) {
                aiTargetX = reflectX(puck.x + puck.vx * timeToLine) + errorX;
                aiTargetY = targetY + errorY;
            } else { aiTargetX = centerX + errorX; aiTargetY = homeY + errorY; }
        } else if (puck.y < ty + th / 2 && aiConf.aggressiveness > Math.random()) {
            aiTargetX = puck.x + errorX; aiTargetY = puck.y + puckR + paddleR + errorY;
        } else { aiTargetX = centerX + errorX; aiTargetY = homeY + errorY; }
    }

    function reflectX(px) {
        var left = tx + puckR, right = tx + tw - puckR, w = right - left;
        if (w <= 0) return tx + tw / 2;
        var rel = ((px - left) % (2 * w) + 2 * w) % (2 * w);
        if (rel > w) rel = 2 * w - rel;
        return left + rel;
    }

    function constrainPaddle(paddle, half) {
        var minX = tx + paddleR, maxX = tx + tw - paddleR, midY = ty + th / 2;
        if (half === 'bottom') { paddle.y = clamp(paddle.y, midY + paddleR, ty + th - paddleR); }
        else { paddle.y = clamp(paddle.y, ty + paddleR, midY - paddleR); }
        paddle.x = clamp(paddle.x, minX, maxX);
    }

    // ─── Puck ───
    function updatePuck(dt) {
        var frictionPerSec = Math.pow(PUCK_FRICTION, 60);
        puck.vx *= Math.pow(frictionPerSec, dt);
        puck.vy *= Math.pow(frictionPerSec, dt);

        var maxSpd = PUCK_MAX_SPEED * scale;
        var spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        if (spd > maxSpd) { puck.vx = (puck.vx / spd) * maxSpd; puck.vy = (puck.vy / spd) * maxSpd; }

        puck.x += puck.vx * dt;
        puck.y += puck.vy * dt;

        var leftWall = tx + puckR, rightWall = tx + tw - puckR;
        if (puck.x < leftWall) { puck.x = leftWall; puck.vx = Math.abs(puck.vx) * WALL_BOUNCE; CGameAudio.play('bounce'); spawnWallSparks(leftWall, puck.y); }
        else if (puck.x > rightWall) { puck.x = rightWall; puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE; CGameAudio.play('bounce'); spawnWallSparks(rightWall, puck.y); }

        var goalLeft = tx + (tw - goalWidth) / 2, goalRight = goalLeft + goalWidth;
        var topWall = ty + puckR, bottomWall = ty + th - puckR;

        if (puck.y < topWall && (puck.x < goalLeft || puck.x > goalRight)) {
            puck.y = topWall; puck.vy = Math.abs(puck.vy) * WALL_BOUNCE; CGameAudio.play('bounce'); spawnWallSparks(puck.x, topWall);
        }
        if (puck.y > bottomWall && (puck.x < goalLeft || puck.x > goalRight)) {
            puck.y = bottomWall; puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE; CGameAudio.play('bounce'); spawnWallSparks(puck.x, bottomWall);
        }

        handlePaddleCollision(p1, 1);
        handlePaddleCollision(p2, 2);

        spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        if (spd > TRAIL_SPEED_THRESHOLD * scale) {
            trail.push({ x: puck.x, y: puck.y });
            if (trail.length > TRAIL_LENGTH) trail.shift();
            // Scuff marks at high speed
            if (spd > TRAIL_SPEED_THRESHOLD * scale * 2 && Math.random() < 0.3) {
                scuffMarks.push({ x: puck.x + (Math.random() - 0.5) * 4, y: puck.y + (Math.random() - 0.5) * 4, alpha: 0.2, size: 1 + Math.random() * 2 });
            }
        } else {
            if (trail.length > 0) trail.shift();
        }
    }

    function handlePaddleCollision(paddle, playerNum) {
        var dx = puck.x - paddle.x, dy = puck.y - paddle.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = paddleR + puckR;
        if (dist < minDist && dist > 0) {
            var nx = dx / dist, ny = dy / dist;
            puck.x += nx * (minDist - dist); puck.y += ny * (minDist - dist);
            var relVx = puck.vx - paddle.vx, relVy = puck.vy - paddle.vy;
            var relDotN = relVx * nx + relVy * ny;
            if (relDotN < 0) {
                puck.vx -= 2 * relDotN * nx; puck.vy -= 2 * relDotN * ny;
                puck.vx += paddle.vx * PADDLE_HIT_BOOST; puck.vy += paddle.vy * PADDLE_HIT_BOOST;
            }
            CGameAudio.play('hit');

            // Impact particles
            var hitSpeed = Math.sqrt(paddle.vx * paddle.vx + paddle.vy * paddle.vy);
            var particleCount = Math.min(15, Math.floor(hitSpeed / 50) + 4);
            var col = playerNum === 1 ? colors.p1 : colors.p2;
            for (var i = 0; i < particleCount; i++) {
                var angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.5;
                var spd = 50 + Math.random() * 200;
                particles.push({
                    x: puck.x - nx * puckR, y: puck.y - ny * puckR,
                    vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
                    life: 0.3 + Math.random() * 0.4, maxLife: 0.7,
                    size: 1.5 + Math.random() * 3, color: col
                });
            }

            if (hitSpeed > 200 * scale) screenShake.intensity = Math.min(8, hitSpeed / 80);
        }
    }

    function spawnWallSparks(x, y) {
        for (var i = 0; i < 5; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 150, vy: (Math.random() - 0.5) * 150,
                life: 0.2 + Math.random() * 0.2, maxLife: 0.4,
                size: 1 + Math.random() * 2, color: 'rgba(200,220,255,0.8)'
            });
        }
    }

    // ─── Goal ───
    function checkGoal() {
        var goalLeft = tx + (tw - goalWidth) / 2, goalRight = goalLeft + goalWidth;
        if (puck.y > ty + th + puckR * 2) {
            if (puck.x > goalLeft && puck.x < goalRight) { scorePoint(2); return; }
            resetPuckAfterGoal();
        }
        if (puck.y < ty - puckR * 2) {
            if (puck.x > goalLeft && puck.x < goalRight) { scorePoint(1); return; }
            resetPuckAfterGoal();
        }
    }

    function scorePoint(player) {
        CGameAudio.play('score');
        if (player === 1) score.p1++; else score.p2++;
        updateScoreUI();
        goalFlash = { active: true, timer: 0.8, player: player };
        screenShake.intensity = 10;

        // Goal celebration particles
        var goalY = player === 1 ? ty : ty + th;
        for (var i = 0; i < 25; i++) {
            particles.push({
                x: tx + tw / 2 + (Math.random() - 0.5) * goalWidth,
                y: goalY,
                vx: (Math.random() - 0.5) * 200,
                vy: (player === 1 ? 1 : -1) * (50 + Math.random() * 150),
                life: 0.5 + Math.random() * 0.5, maxLife: 1,
                size: 2 + Math.random() * 4,
                color: player === 1 ? colors.p1 : colors.p2
            });
        }

        if (score.p1 >= WIN_SCORE || score.p2 >= WIN_SCORE) { endGame(); return; }
        running = false; resetPositions();
        startCountdown(function () { running = true; lastTime = performance.now(); requestAnimationFrame(gameLoop); });
    }

    function resetPuckAfterGoal() {
        puck.x = tx + tw / 2; puck.y = ty + th / 2; puck.vx = 0; puck.vy = 0; trail = [];
    }

    function updateScoreUI() { elScoreP1.textContent = score.p1; elScoreP2.textContent = score.p2; }

    function endGame() {
        running = false;
        var winner = score.p1 >= WIN_SCORE ? 1 : 2;
        elWinner.textContent = mode === '1p' ? (winner === 1 ? 'You Win!' : 'AI Wins!') : ('Player ' + winner + ' Wins!');
        elWinner.style.color = winner === 1 ? colors.p1 : colors.p2;
        elFinalScore.textContent = score.p1 + ' - ' + score.p2;
        CGameAudio.play(winner === 1 ? 'win' : 'lose');
        GameShell.showScreen('gameover-screen');
    }

    function getTouchForPlayer(player) {
        for (var id in touches) { if (touches[id].player === player) return touches[id]; }
        return null;
    }

    // ─── Drawing ───
    function drawFrame() {
        readColors();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        if (screenShake.intensity > 0.5) ctx.translate(screenShake.x, screenShake.y);

        drawTable();
        drawScuffMarks();
        drawTrail();
        drawPuck();
        drawPaddleVisual(p1, colors.p1, colors.p1Light);
        drawPaddleVisual(p2, colors.p2, colors.p2Light);
        drawParticles();

        ctx.restore();
    }

    function drawTable() {
        var isDark = document.body.getAttribute('data-theme') !== 'light';

        // Ice surface gradient
        var iceGrad = ctx.createLinearGradient(tx, ty, tx, ty + th);
        if (isDark) {
            iceGrad.addColorStop(0, '#161630');
            iceGrad.addColorStop(0.5, '#1c1c3a');
            iceGrad.addColorStop(1, '#161630');
        } else {
            iceGrad.addColorStop(0, '#dce8f8');
            iceGrad.addColorStop(0.5, '#e8f0ff');
            iceGrad.addColorStop(1, '#dce8f8');
        }
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 12 * scale);
        ctx.fillStyle = iceGrad;
        ctx.fill();

        // Subtle ice texture lines
        ctx.save();
        ctx.globalAlpha = isDark ? 0.03 : 0.05;
        ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
        ctx.lineWidth = 0.5;
        for (var i = 0; i < 20; i++) {
            var lx = tx + Math.random() * tw;
            ctx.beginPath();
            ctx.moveTo(lx, ty);
            ctx.lineTo(lx + (Math.random() - 0.5) * 30, ty + th);
            ctx.stroke();
        }
        ctx.restore();

        // Table border with glow
        ctx.strokeStyle = isDark ? 'rgba(100,120,200,0.3)' : 'rgba(60,80,150,0.3)';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 12 * scale);
        ctx.stroke();

        // Center line (glowing)
        var centerPulse = 0.3 + Math.sin(globalTime * 2) * 0.1;
        ctx.strokeStyle = isDark ? 'rgba(100,140,255,' + centerPulse + ')' : 'rgba(40,60,180,' + centerPulse + ')';
        ctx.lineWidth = 2 * scale;
        ctx.setLineDash([8 * scale, 8 * scale]);
        ctx.beginPath();
        ctx.moveTo(tx, ty + th / 2);
        ctx.lineTo(tx + tw, ty + th / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center circle with glow
        ctx.beginPath();
        ctx.arc(tx + tw / 2, ty + th / 2, tw * 0.12, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? 'rgba(100,140,255,' + (centerPulse * 0.8) + ')' : 'rgba(40,60,180,' + (centerPulse * 0.8) + ')';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(tx + tw / 2, ty + th / 2, 4 * scale, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(100,140,255,0.4)' : 'rgba(40,60,180,0.4)';
        ctx.fill();

        // Goal areas with glow
        var goalLeft = tx + (tw - goalWidth) / 2;
        drawGoalArea(goalLeft, ty, goalWidth, colors.p1, goalFlash.active && goalFlash.player === 1);
        drawGoalArea(goalLeft, ty + th - 6 * scale, goalWidth, colors.p2, goalFlash.active && goalFlash.player === 2);
    }

    function drawGoalArea(x, y, w, color, flashing) {
        var alpha = flashing ? 0.5 + Math.sin(globalTime * 15) * 0.3 : 0.3;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x, y, w, 6 * scale);
        ctx.globalAlpha = 1;

        // Goal posts with metallic look
        var postGrad = ctx.createLinearGradient(x - 3 * scale, y, x, y);
        postGrad.addColorStop(0, color);
        postGrad.addColorStop(1, lightenColor(color, 1.5));
        ctx.fillStyle = postGrad;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x - 3 * scale, y, 3 * scale, 6 * scale);
        ctx.fillRect(x + w, y, 3 * scale, 6 * scale);
        ctx.globalAlpha = 1;

        // Goal glow when flashing
        if (flashing) {
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.2;
            ctx.fillRect(x, y - 5 * scale, w, 16 * scale);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    function drawScuffMarks() {
        for (var i = 0; i < scuffMarks.length; i++) {
            var sm = scuffMarks[i];
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(180,200,220,' + sm.alpha + ')';
            ctx.fill();
        }
    }

    function drawPaddleVisual(paddle, color, lightColor) {
        // Outer glow ring
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR + 3 * scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        // Metallic gradient paddle
        var grad = ctx.createRadialGradient(
            paddle.x - paddleR * 0.3, paddle.y - paddleR * 0.3, paddleR * 0.05,
            paddle.x, paddle.y, paddleR
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, lightColor);
        grad.addColorStop(0.6, color);
        grad.addColorStop(1, darkenColor(color, 0.6));
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner ring (metallic handle)
        var innerGrad = ctx.createRadialGradient(
            paddle.x - paddleR * 0.1, paddle.y - paddleR * 0.1, paddleR * 0.05,
            paddle.x, paddle.y, paddleR * 0.45
        );
        innerGrad.addColorStop(0, lightenColor(color, 1.3));
        innerGrad.addColorStop(1, darkenColor(color, 0.5));
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Rim highlight
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        // Specular highlight
        ctx.beginPath();
        ctx.arc(paddle.x - paddleR * 0.25, paddle.y - paddleR * 0.25, paddleR * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
    }

    function drawPuck() {
        var spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        var speedNorm = Math.min(spd / (PUCK_MAX_SPEED * scale), 1);

        // Shadow
        ctx.beginPath();
        ctx.arc(puck.x + 2 * scale, puck.y + 2 * scale, puckR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();

        // Speed-based glow
        if (speedNorm > 0.3) {
            ctx.save();
            ctx.shadowColor = colors.accent;
            ctx.shadowBlur = speedNorm * 20;
            ctx.beginPath();
            ctx.arc(puck.x, puck.y, puckR + speedNorm * 3, 0, Math.PI * 2);
            ctx.fillStyle = colors.accent;
            ctx.globalAlpha = speedNorm * 0.15;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Puck gradient
        var grad = ctx.createRadialGradient(
            puck.x - puckR * 0.3, puck.y - puckR * 0.3, puckR * 0.1,
            puck.x, puck.y, puckR
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, lightenColor(colors.accent, 1.2));
        grad.addColorStop(0.7, colors.accent);
        grad.addColorStop(1, darkenColor(colors.accent, 0.5));
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, puckR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, puckR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();
    }

    function drawTrail() {
        for (var i = 0; i < trail.length; i++) {
            var alpha = ((i + 1) / trail.length) * 0.35;
            var r = puckR * (0.4 + 0.5 * (i / trail.length));
            ctx.beginPath();
            ctx.arc(trail[i].x, trail[i].y, r, 0, Math.PI * 2);
            ctx.fillStyle = colors.accent;
            ctx.globalAlpha = alpha;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var pt = particles[i];
            var alpha = pt.life / pt.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ─── Utility ───
    function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

    function darkenColor(hex, factor) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        var r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
        var g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
        var b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
        return '#' + ((1 << 24) + (clamp(r,0,255) << 16) + (clamp(g,0,255) << 8) + clamp(b,0,255)).toString(16).slice(1);
    }

    function lightenColor(hex, factor) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        var r = Math.min(255, Math.round(parseInt(hex.substr(0, 2), 16) * factor));
        var g = Math.min(255, Math.round(parseInt(hex.substr(2, 2), 16) * factor));
        var b = Math.min(255, Math.round(parseInt(hex.substr(4, 2), 16) * factor));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // ─── Polyfill ───
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (typeof r === 'number') r = [r, r, r, r];
            var tl = r[0]||0, tr = r[1]||r[0]||0, br = r[2]||r[0]||0, bl = r[3]||r[1]||r[0]||0;
            this.moveTo(x + tl, y); this.lineTo(x + w - tr, y);
            this.quadraticCurveTo(x + w, y, x + w, y + tr); this.lineTo(x + w, y + h - br);
            this.quadraticCurveTo(x + w, y + h, x + w - br, y + h); this.lineTo(x + bl, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - bl); this.lineTo(x, y + tl);
            this.quadraticCurveTo(x, y, x + tl, y); this.closePath();
            return this;
        };
    }

    // ─── Boot ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})();
