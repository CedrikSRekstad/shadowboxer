/* === Air Hockey - Cgames === */
(function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────────────
    var WIN_SCORE = 7;
    var TABLE_RATIO = 1.6;          // height / width  (portrait)
    var GOAL_WIDTH_RATIO = 0.40;    // 40% of table width
    var PADDLE_RADIUS_RATIO = 0.065; // relative to table width
    var PUCK_RADIUS_RATIO = 0.04;
    var PUCK_MAX_SPEED = 1200;      // px/s at 600px table width (scales)
    var PUCK_FRICTION = 0.998;      // per-frame multiplier at 60fps
    var PADDLE_SPEED = 500;         // keyboard movement px/s (scales)
    var WALL_BOUNCE = 0.85;         // energy kept on wall bounce
    var PADDLE_HIT_BOOST = 1.3;     // multiplier for paddle velocity transfer
    var COUNTDOWN_SECS = 3;
    var TRAIL_LENGTH = 6;
    var TRAIL_SPEED_THRESHOLD = 300; // min puck speed to draw trail

    // AI difficulty presets: {reaction, maxSpeed, errorMargin, aggressiveness}
    var AI_PRESETS = {
        easy:   { reaction: 0.12, maxSpeed: 0.45, errorMargin: 60, aggressiveness: 0.15 },
        medium: { reaction: 0.06, maxSpeed: 0.70, errorMargin: 30, aggressiveness: 0.40 },
        hard:   { reaction: 0.02, maxSpeed: 0.92, errorMargin: 8,  aggressiveness: 0.70 }
    };

    // ─── State ───────────────────────────────────────────────────
    var canvas, ctx;
    var tw, th;                     // table dimensions in px
    var tx, ty;                     // table offset on canvas
    var scale = 1;                  // scale factor from base 600px width
    var mode = '1p';                // '1p' or '2p'
    var aiDiff = 'medium';
    var aiConf;
    var paused = false;
    var running = false;
    var countdownActive = false;

    var score = { p1: 0, p2: 0 };
    var goalWidth;
    var paddleR, puckR;

    // Objects
    var puck = { x: 0, y: 0, vx: 0, vy: 0 };
    var p1 = { x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0 };
    var p2 = { x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0 };

    // Puck trail
    var trail = [];

    // Input state
    var keys = {};
    var mouse = { down: false, x: 0, y: 0, active: false };
    var touches = {};  // id -> { x, y, player }

    // AI internal state
    var aiTargetX = 0;
    var aiTargetY = 0;
    var aiUpdateTimer = 0;

    // CSS color cache (read from CSS vars)
    var colors = {};

    // ─── DOM refs ────────────────────────────────────────────────
    var elScoreP1, elScoreP2, elWinner, elFinalScore;
    var elCountdownOverlay, elCountdownNumber;
    var elPauseOverlay;
    var containerEl;

    // ─── Init ────────────────────────────────────────────────────
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

    // ─── UI bindings ─────────────────────────────────────────────
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
            running = false;
            paused = false;
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

    // ─── Input ───────────────────────────────────────────────────
    function bindInput() {
        window.addEventListener('keydown', function (e) {
            keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape' && running && !countdownActive) {
                togglePause();
            }
        });
        window.addEventListener('keyup', function (e) {
            keys[e.key.toLowerCase()] = false;
        });

        // Mouse / single-pointer for P1
        canvas.addEventListener('mousedown', function (e) {
            var pos = canvasPos(e.clientX, e.clientY);
            mouse.down = true;
            mouse.x = pos.x;
            mouse.y = pos.y;
            mouse.active = true;
        });
        window.addEventListener('mousemove', function (e) {
            if (!mouse.down) return;
            var pos = canvasPos(e.clientX, e.clientY);
            mouse.x = pos.x;
            mouse.y = pos.y;
        });
        window.addEventListener('mouseup', function () {
            mouse.down = false;
            mouse.active = false;
        });

        // Touch: multi-touch for 2P
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
                    touches[t.identifier].x = pos.x;
                    touches[t.identifier].y = pos.y;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', function (e) {
            for (var i = 0; i < e.changedTouches.length; i++) {
                delete touches[e.changedTouches[i].identifier];
            }
        });

        canvas.addEventListener('touchcancel', function (e) {
            for (var i = 0; i < e.changedTouches.length; i++) {
                delete touches[e.changedTouches[i].identifier];
            }
        });
    }

    function canvasPos(clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // ─── Canvas sizing ───────────────────────────────────────────
    function resizeCanvas() {
        if (!containerEl) return;
        var cw = containerEl.clientWidth;
        var ch = containerEl.clientHeight;
        var pad = 10;
        var maxW = cw - pad * 2;
        var maxH = ch - pad * 2;

        // Portrait table: width < height
        var tableW = maxW;
        var tableH = tableW * TABLE_RATIO;
        if (tableH > maxH) {
            tableH = maxH;
            tableW = tableH / TABLE_RATIO;
        }

        canvas.width = Math.round(tableW + pad * 2);
        canvas.height = Math.round(tableH + pad * 2);

        tw = Math.round(tableW);
        th = Math.round(tableH);
        tx = Math.round((canvas.width - tw) / 2);
        ty = Math.round((canvas.height - th) / 2);

        scale = tw / 600;

        goalWidth = tw * GOAL_WIDTH_RATIO;
        paddleR = tw * PADDLE_RADIUS_RATIO;
        puckR = tw * PUCK_RADIUS_RATIO;
    }

    // ─── Game start ──────────────────────────────────────────────
    function startGame() {
        score.p1 = 0;
        score.p2 = 0;
        updateScoreUI();

        aiConf = AI_PRESETS[aiDiff] || AI_PRESETS.medium;
        paused = false;
        running = true;
        elPauseOverlay.classList.add('hidden');

        GameShell.showScreen('game-screen');
        resizeCanvas();
        readColors();

        resetPositions();
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
        // Puck center
        puck.x = tx + tw / 2;
        puck.y = ty + th / 2;
        puck.vx = 0;
        puck.vy = 0;

        // P1 bottom center
        p1.x = tx + tw / 2;
        p1.y = ty + th - paddleR * 2.5;
        p1.vx = 0;
        p1.vy = 0;
        p1.prevX = p1.x;
        p1.prevY = p1.y;

        // P2 top center
        p2.x = tx + tw / 2;
        p2.y = ty + paddleR * 2.5;
        p2.vx = 0;
        p2.vy = 0;
        p2.prevX = p2.x;
        p2.prevY = p2.y;

        trail = [];
    }

    // ─── Countdown ───────────────────────────────────────────────
    function startCountdown(cb) {
        countdownActive = true;
        var count = COUNTDOWN_SECS;
        elCountdownOverlay.classList.remove('hidden');
        elCountdownNumber.textContent = count;
        CGameAudio.play('countdown');

        // Draw initial frame so table is visible behind countdown
        drawFrame();

        var interval = setInterval(function () {
            count--;
            if (count > 0) {
                elCountdownNumber.textContent = count;
                // Re-trigger animation
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

    // ─── Pause ───────────────────────────────────────────────────
    function togglePause() {
        paused = !paused;
        if (paused) {
            elPauseOverlay.classList.remove('hidden');
        } else {
            elPauseOverlay.classList.add('hidden');
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }

    // ─── Game loop ───────────────────────────────────────────────
    var lastTime = 0;

    function gameLoop(timestamp) {
        if (!running || paused) return;

        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.05) dt = 0.05; // cap at 50ms

        update(dt);
        drawFrame();

        requestAnimationFrame(gameLoop);
    }

    // ─── Update ──────────────────────────────────────────────────
    function update(dt) {
        // Save previous positions for velocity calc
        p1.prevX = p1.x;
        p1.prevY = p1.y;
        p2.prevX = p2.x;
        p2.prevY = p2.y;

        updateP1(dt);
        if (mode === '2p') {
            updateP2Human(dt);
        } else {
            updateAI(dt);
        }

        // Compute paddle velocities from position change
        if (dt > 0) {
            p1.vx = (p1.x - p1.prevX) / dt;
            p1.vy = (p1.y - p1.prevY) / dt;
            p2.vx = (p2.x - p2.prevX) / dt;
            p2.vy = (p2.y - p2.prevY) / dt;
        }

        updatePuck(dt);
        checkGoal();
    }

    // ─── Player 1 movement ──────────────────────────────────────
    function updateP1(dt) {
        var speed = PADDLE_SPEED * scale;
        var moved = false;

        // Touch input (highest priority)
        var touchP1 = getTouchForPlayer(1);
        if (touchP1) {
            p1.x = touchP1.x;
            p1.y = touchP1.y;
            moved = true;
        }
        // Mouse input
        else if (mouse.active && mouse.down) {
            // Only allow if mouse is in bottom half
            if (mouse.y > ty + th / 2) {
                p1.x = mouse.x;
                p1.y = mouse.y;
                moved = true;
            }
        }

        // Keyboard (WASD always, arrows only in 1P)
        if (!moved) {
            var useArrows = (mode !== '2p');
            if (keys['w'] || (useArrows && keys['arrowup']))    p1.y -= speed * dt;
            if (keys['s'] || (useArrows && keys['arrowdown']))  p1.y += speed * dt;
            if (keys['a'] || (useArrows && keys['arrowleft']))  p1.x -= speed * dt;
            if (keys['d'] || (useArrows && keys['arrowright'])) p1.x += speed * dt;
        }

        // Constrain to bottom half
        constrainPaddle(p1, 'bottom');
    }

    // ─── Player 2 movement (human) ─────────────────────────────
    function updateP2Human(dt) {
        var speed = PADDLE_SPEED * scale;
        var moved = false;

        // Touch input
        var touchP2 = getTouchForPlayer(2);
        if (touchP2) {
            p2.x = touchP2.x;
            p2.y = touchP2.y;
            moved = true;
        }

        // Keyboard (Arrow keys in 2P mode)
        if (!moved) {
            if (keys['arrowup']) p2.y -= speed * dt;
            if (keys['arrowdown']) p2.y += speed * dt;
            if (keys['arrowleft']) p2.x -= speed * dt;
            if (keys['arrowright']) p2.x += speed * dt;
        }

        // Constrain to top half
        constrainPaddle(p2, 'top');
    }

    // ─── AI ─────────────────────────────────────────────────────
    function updateAI(dt) {
        aiUpdateTimer -= dt;
        if (aiUpdateTimer <= 0) {
            aiUpdateTimer = aiConf.reaction;
            computeAITarget();
        }

        var speed = PADDLE_SPEED * scale * aiConf.maxSpeed;
        var dx = aiTargetX - p2.x;
        var dy = aiTargetY - p2.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2) {
            var move = Math.min(speed * dt, dist);
            p2.x += (dx / dist) * move;
            p2.y += (dy / dist) * move;
        }

        constrainPaddle(p2, 'top');
    }

    function computeAITarget() {
        var centerX = tx + tw / 2;
        var homeY = ty + paddleR * 2.5;
        var errorX = (Math.random() - 0.5) * aiConf.errorMargin * scale;
        var errorY = (Math.random() - 0.5) * aiConf.errorMargin * scale * 0.5;

        // If puck is moving toward AI goal (top)
        if (puck.vy < -30 * scale) {
            // Predict where puck will cross the AI's defensive line
            var targetY = ty + th * 0.2;
            var timeToLine = (puck.y - targetY) / (-puck.vy);
            if (timeToLine > 0 && timeToLine < 2) {
                var predictedX = puck.x + puck.vx * timeToLine;
                // Reflect off walls
                predictedX = reflectX(predictedX);
                aiTargetX = predictedX + errorX;
                aiTargetY = targetY + errorY;
            } else {
                aiTargetX = centerX + errorX;
                aiTargetY = homeY + errorY;
            }
        }
        // Puck in AI's half and moving slowly or toward player: be aggressive
        else if (puck.y < ty + th / 2 && aiConf.aggressiveness > Math.random()) {
            aiTargetX = puck.x + errorX;
            aiTargetY = puck.y + puckR + paddleR + errorY;
        }
        // Default: return to home position
        else {
            aiTargetX = centerX + errorX;
            aiTargetY = homeY + errorY;
        }
    }

    function reflectX(px) {
        var left = tx + puckR;
        var right = tx + tw - puckR;
        var w = right - left;
        if (w <= 0) return tx + tw / 2;
        var rel = px - left;
        rel = rel % (2 * w);
        if (rel < 0) rel += 2 * w;
        if (rel > w) rel = 2 * w - rel;
        return left + rel;
    }

    // ─── Paddle constraint ───────────────────────────────────────
    function constrainPaddle(paddle, half) {
        var minX = tx + paddleR;
        var maxX = tx + tw - paddleR;
        var midY = ty + th / 2;

        if (half === 'bottom') {
            var minY = midY + paddleR;
            var maxY = ty + th - paddleR;
            paddle.y = clamp(paddle.y, minY, maxY);
        } else {
            var minYT = ty + paddleR;
            var maxYT = midY - paddleR;
            paddle.y = clamp(paddle.y, minYT, maxYT);
        }

        paddle.x = clamp(paddle.x, minX, maxX);
    }

    // ─── Puck physics ────────────────────────────────────────────
    function updatePuck(dt) {
        // Friction (frame-rate independent)
        var frictionPerSec = Math.pow(PUCK_FRICTION, 60);
        var friction = Math.pow(frictionPerSec, dt);
        puck.vx *= friction;
        puck.vy *= friction;

        // Speed cap
        var maxSpd = PUCK_MAX_SPEED * scale;
        var spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        if (spd > maxSpd) {
            puck.vx = (puck.vx / spd) * maxSpd;
            puck.vy = (puck.vy / spd) * maxSpd;
        }

        // Move
        puck.x += puck.vx * dt;
        puck.y += puck.vy * dt;

        // Wall collisions (left/right)
        var leftWall = tx + puckR;
        var rightWall = tx + tw - puckR;

        if (puck.x < leftWall) {
            puck.x = leftWall;
            puck.vx = Math.abs(puck.vx) * WALL_BOUNCE;
            CGameAudio.play('bounce');
        } else if (puck.x > rightWall) {
            puck.x = rightWall;
            puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE;
            CGameAudio.play('bounce');
        }

        // Top/bottom walls (except goal area)
        var goalLeft = tx + (tw - goalWidth) / 2;
        var goalRight = goalLeft + goalWidth;
        var topWall = ty + puckR;
        var bottomWall = ty + th - puckR;

        // Top wall
        if (puck.y < topWall) {
            if (puck.x < goalLeft || puck.x > goalRight) {
                puck.y = topWall;
                puck.vy = Math.abs(puck.vy) * WALL_BOUNCE;
                CGameAudio.play('bounce');
            }
            // else: in goal area, let it go
        }

        // Bottom wall
        if (puck.y > bottomWall) {
            if (puck.x < goalLeft || puck.x > goalRight) {
                puck.y = bottomWall;
                puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE;
                CGameAudio.play('bounce');
            }
        }

        // Paddle-puck collisions
        handlePaddleCollision(p1);
        handlePaddleCollision(p2);

        // Trail
        spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        if (spd > TRAIL_SPEED_THRESHOLD * scale) {
            trail.push({ x: puck.x, y: puck.y, alpha: 1 });
            if (trail.length > TRAIL_LENGTH) trail.shift();
        } else {
            // Fade existing trail
            if (trail.length > 0) trail.shift();
        }
    }

    function handlePaddleCollision(paddle) {
        var dx = puck.x - paddle.x;
        var dy = puck.y - paddle.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = paddleR + puckR;

        if (dist < minDist && dist > 0) {
            // Normal vector
            var nx = dx / dist;
            var ny = dy / dist;

            // Separate objects
            var overlap = minDist - dist;
            puck.x += nx * overlap;
            puck.y += ny * overlap;

            // Relative velocity
            var relVx = puck.vx - paddle.vx;
            var relVy = puck.vy - paddle.vy;
            var relDotN = relVx * nx + relVy * ny;

            // Only resolve if objects are approaching
            if (relDotN < 0) {
                // Elastic collision: puck is much lighter than paddle
                puck.vx -= 2 * relDotN * nx;
                puck.vy -= 2 * relDotN * ny;

                // Add paddle velocity boost
                puck.vx += paddle.vx * PADDLE_HIT_BOOST;
                puck.vy += paddle.vy * PADDLE_HIT_BOOST;
            }

            CGameAudio.play('hit');
        }
    }

    // ─── Goal detection ──────────────────────────────────────────
    function checkGoal() {
        var goalLeft = tx + (tw - goalWidth) / 2;
        var goalRight = goalLeft + goalWidth;

        // P2 scored (puck past bottom)
        if (puck.y > ty + th + puckR * 2) {
            if (puck.x > goalLeft && puck.x < goalRight) {
                scorePoint(2);
                return;
            }
            // Went off edge, reset
            resetPuckAfterGoal();
        }

        // P1 scored (puck past top)
        if (puck.y < ty - puckR * 2) {
            if (puck.x > goalLeft && puck.x < goalRight) {
                scorePoint(1);
                return;
            }
            resetPuckAfterGoal();
        }
    }

    function scorePoint(player) {
        CGameAudio.play('score');
        if (player === 1) {
            score.p1++;
        } else {
            score.p2++;
        }
        updateScoreUI();

        if (score.p1 >= WIN_SCORE || score.p2 >= WIN_SCORE) {
            endGame();
            return;
        }

        // Brief countdown before next round
        running = false;
        resetPositions();
        startCountdown(function () {
            running = true;
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        });
    }

    function resetPuckAfterGoal() {
        puck.x = tx + tw / 2;
        puck.y = ty + th / 2;
        puck.vx = 0;
        puck.vy = 0;
        trail = [];
    }

    function updateScoreUI() {
        elScoreP1.textContent = score.p1;
        elScoreP2.textContent = score.p2;
    }

    // ─── Game over ───────────────────────────────────────────────
    function endGame() {
        running = false;
        var winner = score.p1 >= WIN_SCORE ? 1 : 2;

        if (mode === '1p') {
            elWinner.textContent = winner === 1 ? 'You Win!' : 'AI Wins!';
        } else {
            elWinner.textContent = 'Player ' + winner + ' Wins!';
        }
        elWinner.style.color = winner === 1 ? colors.p1 : colors.p2;
        elFinalScore.textContent = score.p1 + ' - ' + score.p2;

        CGameAudio.play(winner === 1 ? 'win' : 'lose');

        GameShell.showScreen('gameover-screen');
    }

    // ─── Touch helpers ───────────────────────────────────────────
    function getTouchForPlayer(player) {
        var best = null;
        for (var id in touches) {
            if (touches[id].player === player) {
                best = touches[id];
            }
        }
        return best;
    }

    // ─── Drawing ─────────────────────────────────────────────────
    function drawFrame() {
        readColors(); // re-read in case theme changed

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawTable();
        drawTrail();
        drawPuck();
        drawPaddle(p1, colors.p1, colors.p1Light);
        drawPaddle(p2, colors.p2, colors.p2Light);
    }

    function drawTable() {
        // Table background
        ctx.fillStyle = colors.bgSecondary;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 12 * scale);
        ctx.fill();

        // Table border
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 12 * scale);
        ctx.stroke();

        // Center line
        ctx.strokeStyle = colors.textMuted;
        ctx.lineWidth = 2 * scale;
        ctx.setLineDash([8 * scale, 8 * scale]);
        ctx.beginPath();
        ctx.moveTo(tx, ty + th / 2);
        ctx.lineTo(tx + tw, ty + th / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center circle
        ctx.strokeStyle = colors.textMuted;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(tx + tw / 2, ty + th / 2, tw * 0.12, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = colors.textMuted;
        ctx.beginPath();
        ctx.arc(tx + tw / 2, ty + th / 2, 4 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Goal areas
        var goalLeft = tx + (tw - goalWidth) / 2;

        // Top goal
        drawGoalArea(goalLeft, ty, goalWidth, colors.p1);
        // Bottom goal
        drawGoalArea(goalLeft, ty + th - 6 * scale, goalWidth, colors.p2);
    }

    function drawGoalArea(x, y, w, color) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, w, 6 * scale);
        ctx.globalAlpha = 1;

        // Goal posts
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x - 3 * scale, y, 3 * scale, 6 * scale);
        ctx.fillRect(x + w, y, 3 * scale, 6 * scale);
        ctx.globalAlpha = 1;
    }

    function drawPaddle(paddle, color, lightColor) {
        // Glow
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR + 4 * scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Main circle
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR, 0, Math.PI * 2);
        var grad = ctx.createRadialGradient(
            paddle.x - paddleR * 0.3, paddle.y - paddleR * 0.3, paddleR * 0.1,
            paddle.x, paddle.y, paddleR
        );
        grad.addColorStop(0, lightColor);
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner circle (handle)
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Border
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddleR, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
    }

    function drawPuck() {
        // Shadow
        ctx.beginPath();
        ctx.arc(puck.x + 2 * scale, puck.y + 2 * scale, puckR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Main puck
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, puckR, 0, Math.PI * 2);
        var grad = ctx.createRadialGradient(
            puck.x - puckR * 0.3, puck.y - puckR * 0.3, puckR * 0.1,
            puck.x, puck.y, puckR
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, colors.accent);
        grad.addColorStop(1, darkenColor(colors.accent, 0.7));
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, puckR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
    }

    function drawTrail() {
        for (var i = 0; i < trail.length; i++) {
            var t = trail[i];
            var alpha = ((i + 1) / trail.length) * 0.3;
            var r = puckR * (0.5 + 0.5 * (i / trail.length));

            ctx.beginPath();
            ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
            ctx.fillStyle = colors.accent;
            ctx.globalAlpha = alpha;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ─── Utility ─────────────────────────────────────────────────
    function clamp(v, min, max) {
        return v < min ? min : v > max ? max : v;
    }

    function darkenColor(hex, factor) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
        var g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
        var b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // ─── Polyfill roundRect ──────────────────────────────────────
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (typeof r === 'number') r = [r, r, r, r];
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

    // ─── Boot ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
