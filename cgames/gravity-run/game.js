/* === Gravity Run - Game Logic === */
(function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────────────
    var CANVAS_W = 800;
    var CANVAS_H = 500;
    var BAND_H = 40;           // floor / ceiling thickness
    var PLAYER_SIZE = 22;
    var GRAVITY = 1800;        // px/s^2
    var COIN_RADIUS = 8;
    var TRAIL_LENGTH = 8;
    var BASE_SPEED = 220;      // initial scroll speed px/s
    var SPEED_INCREASE = 4;    // px/s per second of play
    var MAX_SPEED = 650;
    var OBSTACLE_GAP_MIN = 160;// min px between obstacles
    var OBSTACLE_GAP_MAX = 320;
    var SAFE_CORRIDOR = 80;    // guaranteed safe vertical gap

    // Parallax star layers
    var STAR_LAYERS = [
        { count: 30, speed: 0.15, size: 1, alpha: 0.25 },
        { count: 20, speed: 0.3, size: 1.5, alpha: 0.4 },
        { count: 10, speed: 0.5, size: 2, alpha: 0.6 }
    ];

    // ─── State ───────────────────────────────────────────────────
    var canvas, ctx;
    var mode = 1;              // 1 or 2 players
    var state = 'menu';        // menu | countdown | running | paused | over
    var players = [];
    var obstacles = [];
    var coins = [];
    var particles = [];
    var stars = [];
    var scrollSpeed = BASE_SPEED;
    var distance = 0;
    var nextObstacleX = 0;
    var countdownTimer = 0;
    var countdownNum = 3;
    var animFrameId = null;
    var lastTime = 0;
    var splitY = 0;            // y divider for 2P

    // Theme-aware colours (recalculated each frame from CSS vars)
    var colors = {};

    function readColors() {
        var s = getComputedStyle(document.documentElement);
        colors.bg = s.getPropertyValue('--canvas-bg').trim() || '#0d0d1a';
        colors.bgSec = s.getPropertyValue('--bg-secondary').trim() || '#1a1a2e';
        colors.text = s.getPropertyValue('--text-primary').trim() || '#fff';
        colors.muted = s.getPropertyValue('--text-muted').trim() || '#666';
        colors.p1 = s.getPropertyValue('--p1-color').trim() || '#00b4ff';
        colors.p1Light = s.getPropertyValue('--p1-light').trim() || '#42d4ff';
        colors.p2 = s.getPropertyValue('--p2-color').trim() || '#ff4466';
        colors.p2Light = s.getPropertyValue('--p2-light').trim() || '#ff7799';
        colors.accent = s.getPropertyValue('--accent').trim() || '#ffdd00';
        colors.danger = s.getPropertyValue('--danger').trim() || '#e94560';
    }

    // ─── Player Object ──────────────────────────────────────────
    function createPlayer(index, laneTop, laneH) {
        return {
            index: index,
            x: 120,
            y: laneTop + laneH - BAND_H - PLAYER_SIZE,
            vy: 0,
            onFloor: true,        // true = gravity down, false = gravity up (ceiling)
            alive: true,
            distance: 0,
            coins: 0,
            laneTop: laneTop,
            laneH: laneH,
            trail: [],
            flipCooldown: 0
        };
    }

    // ─── Obstacle Generation ────────────────────────────────────
    function generateObstacle(x, laneTop, laneH) {
        var floorY = laneTop + laneH - BAND_H;
        var ceilY = laneTop + BAND_H;
        var playH = laneH - BAND_H * 2;

        // Difficulty scaling: more obstacles as distance grows
        var diff = Math.min(distance / 5000, 1); // 0..1

        // Decide type: floor, ceiling, or both
        var r = Math.random();
        var type;
        if (r < 0.35) type = 'floor';
        else if (r < 0.7) type = 'ceiling';
        else type = 'both';

        var obs = [];

        if (type === 'floor' || type === 'both') {
            var h = 20 + Math.random() * (20 + 30 * diff);
            var w = 18 + Math.random() * 20;
            var isSpike = Math.random() < 0.4;
            obs.push({
                x: x,
                y: floorY - h,
                w: w,
                h: h,
                spike: isSpike,
                surface: 'floor'
            });
        }

        if (type === 'ceiling' || type === 'both') {
            var h2 = 20 + Math.random() * (20 + 30 * diff);
            var w2 = 18 + Math.random() * 20;
            var isSpike2 = Math.random() < 0.4;
            obs.push({
                x: x + (type === 'both' ? 0 : 0),
                y: ceilY,
                w: w2,
                h: h2,
                spike: isSpike2,
                surface: 'ceiling'
            });
        }

        // If both, ensure safe corridor between them
        if (type === 'both' && obs.length === 2) {
            var floorObs = obs[0];
            var ceilObs = obs[1];
            var gap = floorObs.y - (ceilObs.y + ceilObs.h);
            if (gap < SAFE_CORRIDOR) {
                var fix = (SAFE_CORRIDOR - gap) / 2 + 2;
                floorObs.h -= fix;
                floorObs.y += fix;
                ceilObs.h -= fix;
            }
        }

        return obs;
    }

    function generateCoin(x, laneTop, laneH) {
        var ceilY = laneTop + BAND_H + COIN_RADIUS + 5;
        var floorY = laneTop + laneH - BAND_H - COIN_RADIUS - 5;
        var cy = ceilY + Math.random() * (floorY - ceilY);
        return { x: x, y: cy, collected: false };
    }

    // ─── Stars / Parallax ───────────────────────────────────────
    function initStars(laneTop, laneH) {
        var result = [];
        STAR_LAYERS.forEach(function (layer) {
            for (var i = 0; i < layer.count; i++) {
                result.push({
                    x: Math.random() * CANVAS_W,
                    y: laneTop + BAND_H + Math.random() * (laneH - BAND_H * 2),
                    speed: layer.speed,
                    size: layer.size,
                    alpha: layer.alpha,
                    laneTop: laneTop,
                    laneH: laneH
                });
            }
        });
        return result;
    }

    // ─── Particles ──────────────────────────────────────────────
    function spawnParticles(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 300,
                vy: (Math.random() - 0.5) * 300,
                life: 0.3 + Math.random() * 0.4,
                maxLife: 0.3 + Math.random() * 0.4,
                size: 2 + Math.random() * 3,
                color: color
            });
        }
    }

    // ─── Init / Reset ───────────────────────────────────────────
    function initGame() {
        readColors();
        scrollSpeed = BASE_SPEED;
        distance = 0;
        obstacles = [];
        coins = [];
        particles = [];
        players = [];

        if (mode === 1) {
            splitY = 0;
            players.push(createPlayer(0, 0, CANVAS_H));
            stars = initStars(0, CANVAS_H);
        } else {
            splitY = Math.floor(CANVAS_H / 2);
            players.push(createPlayer(0, 0, splitY));
            players.push(createPlayer(1, splitY, CANVAS_H - splitY));
            stars = initStars(0, splitY).concat(initStars(splitY, CANVAS_H - splitY));
        }

        nextObstacleX = CANVAS_W + 200;
        generateInitialContent();
    }

    function generateInitialContent() {
        // Pre-fill some obstacles ahead
        var x = nextObstacleX;
        for (var i = 0; i < 8; i++) {
            players.forEach(function (p) {
                var obs = generateObstacle(x, p.laneTop, p.laneH);
                obs.forEach(function (o) { obstacles.push(o); });
                // Coin between obstacles sometimes
                if (Math.random() < 0.6) {
                    coins.push(generateCoin(x - 40 - Math.random() * 60, p.laneTop, p.laneH));
                }
            });
            var gap = OBSTACLE_GAP_MIN + Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
            var diff = Math.min(distance / 5000, 1);
            gap *= (1 - diff * 0.35);
            x += gap;
        }
        nextObstacleX = x;
    }

    // ─── Canvas Setup ───────────────────────────────────────────
    function setupCanvas() {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        var container = document.getElementById('canvas-container');
        var w = container.clientWidth;
        var h = container.clientHeight;

        // Maintain aspect ratio
        var scale = Math.min(w / CANVAS_W, h / CANVAS_H);
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        canvas.style.width = (CANVAS_W * scale) + 'px';
        canvas.style.height = (CANVAS_H * scale) + 'px';
    }

    // ─── Input ──────────────────────────────────────────────────
    var inputMap = {};

    function handleFlip(playerIdx) {
        if (state !== 'running') return;
        var p = players[playerIdx];
        if (!p || !p.alive) return;
        if (p.flipCooldown > 0) return;

        p.onFloor = !p.onFloor;
        p.vy = 0; // reset velocity, gravity takes over
        p.flipCooldown = 0.15;
        CGameAudio.play('whoosh');
    }

    function onKeyDown(e) {
        if (inputMap[e.code]) return;
        inputMap[e.code] = true;

        if (state === 'running') {
            // P1 controls
            if (e.code === 'Space' || e.code === 'KeyW') {
                e.preventDefault();
                handleFlip(0);
            }
            // P2 controls
            if (mode === 2 && (e.code === 'ArrowUp' || e.code === 'Enter')) {
                e.preventDefault();
                handleFlip(1);
            }
        }

        if (e.code === 'Escape') {
            if (state === 'running') togglePause();
            else if (state === 'paused') togglePause();
        }
    }

    function onKeyUp(e) {
        inputMap[e.code] = false;
    }

    function onTouchStart(e) {
        if (state !== 'running') return;
        e.preventDefault();

        var rect = canvas.getBoundingClientRect();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var tx = e.changedTouches[i].clientX - rect.left;
            var halfW = rect.width / 2;

            if (mode === 1) {
                handleFlip(0);
            } else {
                if (tx < halfW) handleFlip(0);
                else handleFlip(1);
            }
        }
    }

    function bindInput() {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('mousedown', function (e) {
            if (state !== 'running') return;
            if (mode === 1) {
                handleFlip(0);
            } else {
                var rect = canvas.getBoundingClientRect();
                var mx = e.clientX - rect.left;
                if (mx < rect.width / 2) handleFlip(0);
                else handleFlip(1);
            }
        });
    }

    // ─── Game Loop ──────────────────────────────────────────────
    function startLoop() {
        lastTime = performance.now();
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    function loop(now) {
        animFrameId = requestAnimationFrame(loop);
        var dt = (now - lastTime) / 1000;
        lastTime = now;
        if (dt > 0.05) dt = 0.05; // cap at 50ms

        readColors();

        if (state === 'countdown') {
            updateCountdown(dt);
        } else if (state === 'running') {
            update(dt);
        }

        draw();
    }

    // ─── Countdown ──────────────────────────────────────────────
    function startCountdown() {
        state = 'countdown';
        countdownTimer = 0;
        countdownNum = 3;
        var overlay = document.getElementById('countdown-overlay');
        var numEl = document.getElementById('countdown-number');
        overlay.classList.remove('hidden');
        numEl.textContent = '3';
        CGameAudio.play('countdown');
    }

    function updateCountdown(dt) {
        countdownTimer += dt;
        var newNum = 3 - Math.floor(countdownTimer);
        if (newNum !== countdownNum && newNum >= 1) {
            countdownNum = newNum;
            var numEl = document.getElementById('countdown-number');
            numEl.textContent = String(countdownNum);
            numEl.style.animation = 'none';
            void numEl.offsetHeight; // reflow
            numEl.style.animation = '';
            CGameAudio.play('countdown');
        }
        if (countdownTimer >= 3) {
            countdownNum = 0;
            document.getElementById('countdown-overlay').classList.add('hidden');
            state = 'running';
        }
    }

    // ─── Update ─────────────────────────────────────────────────
    function update(dt) {
        // Increase speed over time
        scrollSpeed = Math.min(BASE_SPEED + distance * SPEED_INCREASE / 100, MAX_SPEED);

        var scrollDx = scrollSpeed * dt;
        distance += scrollDx;

        // Update players
        var allDead = true;
        players.forEach(function (p) {
            if (!p.alive) return;
            allDead = false;
            updatePlayer(p, dt);
            p.distance = distance;
        });

        // Scroll obstacles & coins
        obstacles.forEach(function (o) { o.x -= scrollDx; });
        coins.forEach(function (c) { c.x -= scrollDx; });

        // Remove off-screen obstacles/coins
        obstacles = obstacles.filter(function (o) { return o.x + o.w > -50; });
        coins = coins.filter(function (c) { return c.x > -50; });

        // Generate new content ahead
        var farthestObs = 0;
        obstacles.forEach(function (o) { if (o.x + o.w > farthestObs) farthestObs = o.x + o.w; });
        while (farthestObs < CANVAS_W + 400) {
            var diff = Math.min(distance / 5000, 1);
            var gap = OBSTACLE_GAP_MIN + Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
            gap *= (1 - diff * 0.35);
            gap = Math.max(gap, 100);
            var nx = farthestObs + gap;
            players.forEach(function (p) {
                if (!p.alive) return;
                var obs = generateObstacle(nx, p.laneTop, p.laneH);
                obs.forEach(function (o) { obstacles.push(o); });
                if (Math.random() < 0.5) {
                    coins.push(generateCoin(nx - 30 - Math.random() * 50, p.laneTop, p.laneH));
                }
            });
            farthestObs = nx + 40;
        }

        // Collision detection
        players.forEach(function (p) {
            if (!p.alive) return;
            checkCollisions(p);
        });

        // Update stars (parallax scroll)
        stars.forEach(function (s) {
            s.x -= scrollDx * s.speed;
            if (s.x < 0) {
                s.x += CANVAS_W;
                s.y = s.laneTop + BAND_H + Math.random() * (s.laneH - BAND_H * 2);
            }
        });

        // Update particles
        particles.forEach(function (pt) {
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
        });
        particles = particles.filter(function (pt) { return pt.life > 0; });

        // Update HUD
        updateHUD();

        // Check game over
        if (allDead || (mode === 2 && players.filter(function (p) { return !p.alive; }).length >= 1)) {
            // In 2P, game ends when either dies. In 1P, when the player dies.
            if (mode === 1 && allDead) {
                endGame();
            } else if (mode === 2) {
                // Wait a tiny beat then end
                var deadCount = players.filter(function (p) { return !p.alive; }).length;
                if (deadCount >= 1) {
                    endGame();
                }
            }
        }
    }

    function updatePlayer(p, dt) {
        p.flipCooldown -= dt;
        if (p.flipCooldown < 0) p.flipCooldown = 0;

        var floorY = p.laneTop + p.laneH - BAND_H - PLAYER_SIZE;
        var ceilY = p.laneTop + BAND_H;

        // Apply gravity
        if (p.onFloor) {
            p.vy += GRAVITY * dt;  // gravity pulls down
        } else {
            p.vy -= GRAVITY * dt;  // gravity pulls up (toward ceiling)
        }

        p.y += p.vy * dt;

        // Clamp to surfaces
        if (p.y >= floorY) {
            p.y = floorY;
            p.vy = 0;
        }
        if (p.y <= ceilY) {
            p.y = ceilY;
            p.vy = 0;
        }

        // Trail
        p.trail.unshift({ x: p.x, y: p.y + PLAYER_SIZE / 2 });
        if (p.trail.length > TRAIL_LENGTH) p.trail.length = TRAIL_LENGTH;
    }

    function checkCollisions(p) {
        var px = p.x;
        var py = p.y;
        var pw = PLAYER_SIZE;
        var ph = PLAYER_SIZE;

        // Obstacle collision (AABB)
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            // Only check obstacles in this player's lane
            if (o.y < p.laneTop || o.y + o.h > p.laneTop + p.laneH + 1) continue;

            if (px + pw > o.x + 3 && px < o.x + o.w - 3 &&
                py + ph > o.y + 3 && py < o.y + o.h - 3) {
                killPlayer(p);
                return;
            }
        }

        // Coin collection
        for (var j = 0; j < coins.length; j++) {
            var c = coins[j];
            if (c.collected) continue;
            // Only coins in this player's lane
            if (c.y < p.laneTop || c.y > p.laneTop + p.laneH) continue;

            var cx = px + pw / 2;
            var cy = py + ph / 2;
            var dx = cx - c.x;
            var dy = cy - c.y;
            if (Math.sqrt(dx * dx + dy * dy) < COIN_RADIUS + pw / 2) {
                c.collected = true;
                p.coins++;
                CGameAudio.play('score');
                spawnParticles(c.x, c.y, '#ffd700', 6);
            }
        }
    }

    function killPlayer(p) {
        p.alive = false;
        CGameAudio.play('hit');
        spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, colors.danger, 15);
    }

    // ─── HUD ────────────────────────────────────────────────────
    function updateHUD() {
        var dist = Math.floor(distance / 10);
        document.getElementById('hud-p1').textContent = dist + 'm';
        if (mode === 2) {
            document.getElementById('hud-p2').textContent = dist + 'm';
        }
    }

    // ─── Draw ───────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        if (mode === 1) {
            drawLane(players[0], 0, CANVAS_H);
        } else {
            // Draw each lane
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, CANVAS_W, splitY);
            ctx.clip();
            drawLane(players[0], 0, splitY);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, splitY, CANVAS_W, CANVAS_H - splitY);
            ctx.clip();
            drawLane(players[1], splitY, CANVAS_H - splitY);
            ctx.restore();

            // Divider line
            ctx.strokeStyle = colors.muted;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(0, splitY);
            ctx.lineTo(CANVAS_W, splitY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Player labels
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = colors.p1;
            ctx.fillText('P1', 8, 18 + 44);
            ctx.fillStyle = colors.p2;
            ctx.fillText('P2', 8, splitY + 18 + 44);
        }

        // Draw particles on top
        drawParticles();
    }

    function drawLane(player, laneTop, laneH) {
        var floorY = laneTop + laneH - BAND_H;
        var ceilY = laneTop;

        // Background
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, laneTop, CANVAS_W, laneH);

        // Stars / parallax
        stars.forEach(function (s) {
            if (s.laneTop !== player.laneTop) return;
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = colors.text;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1;

        // Ceiling band
        ctx.fillStyle = colors.bgSec;
        ctx.fillRect(0, ceilY, CANVAS_W, BAND_H);
        // Ceiling edge
        ctx.fillStyle = colors.muted;
        ctx.fillRect(0, ceilY + BAND_H - 2, CANVAS_W, 2);

        // Floor band
        ctx.fillStyle = colors.bgSec;
        ctx.fillRect(0, floorY, CANVAS_W, BAND_H);
        // Floor edge
        ctx.fillStyle = colors.muted;
        ctx.fillRect(0, floorY, CANVAS_W, 2);

        // Grid lines on bands (subtle)
        ctx.strokeStyle = colors.muted;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        var gridSpacing = 30;
        var gridOffset = (distance * 0.5) % gridSpacing;
        for (var gx = -gridOffset; gx < CANVAS_W; gx += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(gx, floorY);
            ctx.lineTo(gx, floorY + BAND_H);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx, ceilY);
            ctx.lineTo(gx, ceilY + BAND_H);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Obstacles
        obstacles.forEach(function (o) {
            if (o.x + o.w < 0 || o.x > CANVAS_W) return;
            // Only draw obstacles in this lane
            if (o.y < player.laneTop - 1 || o.y + o.h > player.laneTop + player.laneH + 1) return;

            if (o.spike) {
                drawSpike(o);
            } else {
                ctx.fillStyle = colors.danger;
                ctx.fillRect(o.x, o.y, o.w, o.h);
                // Highlight edge
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(o.x, o.y, o.w, 2);
            }
        });

        // Coins
        coins.forEach(function (c) {
            if (c.collected) return;
            if (c.x < -20 || c.x > CANVAS_W + 20) return;
            if (c.y < player.laneTop || c.y > player.laneTop + player.laneH) return;

            // Glow
            ctx.beginPath();
            ctx.arc(c.x, c.y, COIN_RADIUS + 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,215,0,0.2)';
            ctx.fill();
            // Coin
            ctx.beginPath();
            ctx.arc(c.x, c.y, COIN_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            // Inner circle
            ctx.beginPath();
            ctx.arc(c.x, c.y, COIN_RADIUS - 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffec80';
            ctx.fill();
        });

        // Player
        if (player.alive) {
            drawPlayer(player);
        }
    }

    function drawSpike(o) {
        ctx.fillStyle = colors.danger;
        ctx.beginPath();
        if (o.surface === 'floor') {
            // Triangle pointing up
            ctx.moveTo(o.x, o.y + o.h);
            ctx.lineTo(o.x + o.w / 2, o.y);
            ctx.lineTo(o.x + o.w, o.y + o.h);
        } else {
            // Triangle pointing down
            ctx.moveTo(o.x, o.y);
            ctx.lineTo(o.x + o.w / 2, o.y + o.h);
            ctx.lineTo(o.x + o.w, o.y);
        }
        ctx.closePath();
        ctx.fill();

        // Edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    function drawPlayer(p) {
        var pColor = p.index === 0 ? colors.p1 : colors.p2;
        var pLight = p.index === 0 ? colors.p1Light : colors.p2Light;

        // Trail
        for (var i = 0; i < p.trail.length; i++) {
            var t = p.trail[i];
            var alpha = (1 - i / p.trail.length) * 0.35;
            var size = PLAYER_SIZE * (1 - i / p.trail.length) * 0.6;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pColor;
            ctx.fillRect(t.x - size / 2, t.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;

        // Player body
        ctx.fillStyle = pColor;
        ctx.fillRect(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE);

        // Inner highlight
        ctx.fillStyle = pLight;
        ctx.fillRect(p.x + 3, p.y + 3, PLAYER_SIZE - 6, PLAYER_SIZE - 6);

        // Eyes (adjust based on gravity direction)
        ctx.fillStyle = '#fff';
        var eyeY = p.onFloor ? p.y + 6 : p.y + PLAYER_SIZE - 10;
        ctx.fillRect(p.x + 5, eyeY, 4, 4);
        ctx.fillRect(p.x + 13, eyeY, 4, 4);

        // Pupils
        ctx.fillStyle = '#111';
        ctx.fillRect(p.x + 7, eyeY + 1, 2, 2);
        ctx.fillRect(p.x + 15, eyeY + 1, 2, 2);

        // Gravity indicator arrow
        ctx.fillStyle = pColor;
        ctx.globalAlpha = 0.5;
        var arrowX = p.x + PLAYER_SIZE / 2;
        var arrowY = p.onFloor ? p.y + PLAYER_SIZE + 4 : p.y - 4;
        ctx.beginPath();
        if (p.onFloor) {
            ctx.moveTo(arrowX - 4, arrowY);
            ctx.lineTo(arrowX, arrowY + 5);
            ctx.lineTo(arrowX + 4, arrowY);
        } else {
            ctx.moveTo(arrowX - 4, arrowY);
            ctx.lineTo(arrowX, arrowY - 5);
            ctx.lineTo(arrowX + 4, arrowY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawParticles() {
        particles.forEach(function (pt) {
            var alpha = pt.life / pt.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        });
        ctx.globalAlpha = 1;
    }

    // ─── Pause ──────────────────────────────────────────────────
    function togglePause() {
        if (state === 'running') {
            state = 'paused';
            document.getElementById('pause-overlay').classList.remove('hidden');
            CGameAudio.play('click');
        } else if (state === 'paused') {
            document.getElementById('pause-overlay').classList.add('hidden');
            state = 'running';
            lastTime = performance.now();
            CGameAudio.play('click');
        }
    }

    // ─── End Game ───────────────────────────────────────────────
    function endGame() {
        state = 'over';
        stopLoop();

        var dist = Math.floor(distance / 10);
        var totalCoins = 0;
        players.forEach(function (p) { totalCoins += p.coins; });

        if (mode === 1) {
            document.getElementById('winner-text').textContent = 'Game Over';
            document.getElementById('final-score').textContent = dist + 'm';
            document.getElementById('final-coins').textContent = totalCoins + ' coins';
            CGameAudio.play('lose');
            GameShell.addScore({ game: 'gravity-run', score: dist, mode: '1P' });
        } else {
            var p1alive = players[0].alive;
            var p2alive = players[1].alive;
            var winner;
            if (p1alive && !p2alive) winner = 1;
            else if (!p1alive && p2alive) winner = 2;
            else winner = 0; // both dead

            if (winner === 1) {
                document.getElementById('winner-text').innerHTML = '<span class="p1-label">Player 1</span> Wins!';
                CGameAudio.play('win');
            } else if (winner === 2) {
                document.getElementById('winner-text').innerHTML = '<span class="p2-label">Player 2</span> Wins!';
                CGameAudio.play('win');
            } else {
                document.getElementById('winner-text').textContent = 'Draw!';
                CGameAudio.play('lose');
            }
            document.getElementById('final-score').textContent = dist + 'm';
            var coinText = 'P1: ' + players[0].coins + ' | P2: ' + players[1].coins + ' coins';
            document.getElementById('final-coins').textContent = coinText;
        }

        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 600);
    }

    // ─── Screen Management ──────────────────────────────────────
    function showGame() {
        GameShell.showScreen('game-screen');

        // Resize canvas now that game screen is visible
        resizeCanvas();

        // Show/hide 2P HUD elements
        var sep = document.getElementById('hud-sep');
        var hudP2 = document.getElementById('hud-p2');
        if (mode === 2) {
            sep.classList.remove('hidden');
            hudP2.classList.remove('hidden');
        } else {
            sep.classList.add('hidden');
            hudP2.classList.add('hidden');
        }

        initGame();
        startLoop();
        startCountdown();
    }

    // ─── Boot ───────────────────────────────────────────────────
    function boot() {
        setupCanvas();
        bindInput();
        GameShell.init({ backUrl: '../' });

        // Title buttons
        document.getElementById('btn-1p').addEventListener('click', function () {
            CGameAudio.play('click');
            mode = 1;
            showGame();
        });

        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('click');
            mode = 2;
            showGame();
        });

        // Pause buttons
        document.getElementById('btn-pause').addEventListener('click', function () {
            if (state === 'running' || state === 'paused') togglePause();
        });
        document.getElementById('btn-resume').addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });
        document.getElementById('btn-quit').addEventListener('click', function () {
            CGameAudio.play('click');
            stopLoop();
            state = 'menu';
            document.getElementById('pause-overlay').classList.add('hidden');
            GameShell.showScreen('title-screen');
        });

        // Game over buttons
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('click');
            showGame();
        });
        document.getElementById('btn-menu').addEventListener('click', function () {
            CGameAudio.play('click');
            state = 'menu';
            GameShell.showScreen('title-screen');
        });

        // Draw initial frame for title screen background
        readColors();
    }

    boot();
})();
