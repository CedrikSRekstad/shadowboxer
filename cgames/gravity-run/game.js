/* === Gravity Run - Game Logic (Visually Enhanced) === */
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

    // Parallax star layers (3 layers at different speeds)
    var STAR_LAYERS = [
        { count: 40, speed: 0.12, sizeMin: 0.5, sizeMax: 1.5, alpha: 0.2 },
        { count: 25, speed: 0.3, sizeMin: 1, sizeMax: 2.5, alpha: 0.4 },
        { count: 12, speed: 0.55, sizeMin: 1.5, sizeMax: 3, alpha: 0.65 }
    ];

    // Nebula configuration
    var NEBULA_COUNT = 4;

    // Shield power-up settings
    var SHIELD_RADIUS = 10;
    var SHIELD_SPAWN_CHANCE = 0.08; // chance per obstacle group
    var SHIELD_MIN_INTERVAL = 2500; // min distance between shield spawns

    // ─── State ───────────────────────────────────────────────────
    var canvas, ctx;
    var mode = 1;              // 1 or 2 players
    var state = 'menu';        // menu | countdown | running | paused | over
    var players = [];
    var obstacles = [];
    var coins = [];
    var particles = [];
    var stars = [];
    var nebulae = [];
    var shields = [];          // shield pickups on the field
    var scrollSpeed = BASE_SPEED;
    var distance = 0;
    var nextObstacleX = 0;
    var countdownTimer = 0;
    var countdownNum = 3;
    var animFrameId = null;
    var lastTime = 0;
    var splitY = 0;            // y divider for 2P
    var globalTime = 0;        // accumulated time for animations
    var lastShieldDist = 0;    // distance tracker for shield spawn spacing

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

    // ─── Utility: parse hex color to {r,g,b} ────────────────────
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var num = parseInt(hex, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
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
            flipCooldown: 0,
            hasShield: false,     // shield power-up state
            shieldTimer: 0        // visual animation timer for shield
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

    // ─── Shield Pickup Generation ────────────────────────────────
    function generateShield(x, laneTop, laneH) {
        var ceilY = laneTop + BAND_H + SHIELD_RADIUS + 10;
        var floorY = laneTop + laneH - BAND_H - SHIELD_RADIUS - 10;
        var cy = ceilY + Math.random() * (floorY - ceilY);
        return { x: x, y: cy, collected: false, laneTop: laneTop, laneH: laneH, bobPhase: Math.random() * Math.PI * 2 };
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
                    size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
                    alpha: layer.alpha * (0.6 + Math.random() * 0.4),
                    twinklePhase: Math.random() * Math.PI * 2,
                    twinkleSpeed: 1 + Math.random() * 2,
                    laneTop: laneTop,
                    laneH: laneH
                });
            }
        });
        return result;
    }

    // ─── Nebulae (colored radial gradients that drift slowly) ───
    function initNebulae(laneTop, laneH) {
        var result = [];
        var nebulaColors = [
            { r: 80, g: 0, b: 180 },   // purple
            { r: 0, g: 100, b: 200 },   // blue
            { r: 180, g: 0, b: 80 },    // magenta
            { r: 0, g: 160, b: 140 }    // teal
        ];
        for (var i = 0; i < NEBULA_COUNT; i++) {
            var c = nebulaColors[i % nebulaColors.length];
            result.push({
                x: Math.random() * CANVAS_W,
                y: laneTop + BAND_H + Math.random() * (laneH - BAND_H * 2),
                radius: 80 + Math.random() * 120,
                color: c,
                alpha: 0.03 + Math.random() * 0.03,
                driftVx: (Math.random() - 0.5) * 8,
                driftVy: (Math.random() - 0.5) * 4,
                laneTop: laneTop,
                laneH: laneH
            });
        }
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
                color: color,
                type: 'default'
            });
        }
    }

    // Enhanced death explosion particles (with gravity and varied sizes)
    function spawnDeathExplosion(x, y, color) {
        for (var i = 0; i < 25; i++) {
            var angle = (Math.PI * 2 / 25) * i + (Math.random() - 0.5) * 0.4;
            var speed = 100 + Math.random() * 250;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 300 + Math.random() * 200,
                life: 0.5 + Math.random() * 0.6,
                maxLife: 0.5 + Math.random() * 0.6,
                size: 2 + Math.random() * 5,
                color: color,
                type: 'explosion'
            });
        }
        // A few bright core sparks
        for (var j = 0; j < 8; j++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 6,
                y: y + (Math.random() - 0.5) * 6,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                gravity: 0,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.2 + Math.random() * 0.3,
                size: 3 + Math.random() * 4,
                color: '#ffffff',
                type: 'spark'
            });
        }
    }

    // Coin collect sparkle particles
    function spawnCoinSparkle(x, y) {
        var sparkColors = ['#ffd700', '#ffec80', '#fff6cc', '#ffffff'];
        for (var i = 0; i < 10; i++) {
            var angle = (Math.PI * 2 / 10) * i;
            var speed = 60 + Math.random() * 100;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 80,
                life: 0.3 + Math.random() * 0.35,
                maxLife: 0.3 + Math.random() * 0.35,
                size: 1.5 + Math.random() * 3,
                color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                type: 'sparkle'
            });
        }
    }

    // Shield pop burst
    function spawnShieldPop(x, y, pColor) {
        var shieldColors = ['#44ffcc', '#88ffdd', '#aaffee', pColor];
        for (var i = 0; i < 18; i++) {
            var angle = (Math.PI * 2 / 18) * i;
            var speed = 80 + Math.random() * 160;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 60,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.4 + Math.random() * 0.3,
                size: 2 + Math.random() * 4,
                color: shieldColors[Math.floor(Math.random() * shieldColors.length)],
                type: 'sparkle'
            });
        }
    }

    // ─── Init / Reset ───────────────────────────────────────────
    function initGame() {
        readColors();
        scrollSpeed = BASE_SPEED;
        distance = 0;
        globalTime = 0;
        lastShieldDist = 0;
        obstacles = [];
        coins = [];
        particles = [];
        shields = [];
        players = [];

        if (mode === 1) {
            splitY = 0;
            players.push(createPlayer(0, 0, CANVAS_H));
            stars = initStars(0, CANVAS_H);
            nebulae = initNebulae(0, CANVAS_H);
        } else {
            splitY = Math.floor(CANVAS_H / 2);
            players.push(createPlayer(0, 0, splitY));
            players.push(createPlayer(1, splitY, CANVAS_H - splitY));
            stars = initStars(0, splitY).concat(initStars(splitY, CANVAS_H - splitY));
            nebulae = initNebulae(0, splitY).concat(initNebulae(splitY, CANVAS_H - splitY));
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
        globalTime += dt;

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

        // Scroll obstacles & coins & shields
        obstacles.forEach(function (o) { o.x -= scrollDx; });
        coins.forEach(function (c) { c.x -= scrollDx; });
        shields.forEach(function (s) { s.x -= scrollDx; });

        // Remove off-screen obstacles/coins/shields
        obstacles = obstacles.filter(function (o) { return o.x + o.w > -50; });
        coins = coins.filter(function (c) { return c.x > -50; });
        shields = shields.filter(function (s) { return s.x > -50 && !s.collected; });

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
                // Shield spawn chance
                if (!p.hasShield && (distance - lastShieldDist) > SHIELD_MIN_INTERVAL && Math.random() < SHIELD_SPAWN_CHANCE) {
                    shields.push(generateShield(nx - 20 - Math.random() * 40, p.laneTop, p.laneH));
                    lastShieldDist = distance;
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

        // Update nebulae (slow drift)
        nebulae.forEach(function (n) {
            n.x -= scrollDx * 0.05; // very slow parallax
            n.x += n.driftVx * dt;
            n.y += n.driftVy * dt;
            // Wrap around
            if (n.x < -n.radius) n.x += CANVAS_W + n.radius * 2;
            if (n.x > CANVAS_W + n.radius) n.x -= CANVAS_W + n.radius * 2;
            // Keep in lane vertically
            var minY = n.laneTop + BAND_H;
            var maxY = n.laneTop + n.laneH - BAND_H;
            if (n.y < minY) { n.y = minY; n.driftVy = Math.abs(n.driftVy); }
            if (n.y > maxY) { n.y = maxY; n.driftVy = -Math.abs(n.driftVy); }
        });

        // Update particles (with gravity for explosion types)
        particles.forEach(function (pt) {
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            if (pt.gravity) {
                pt.vy += pt.gravity * dt;
            }
            pt.life -= dt;
        });
        particles = particles.filter(function (pt) { return pt.life > 0; });

        // Update shield timers on players
        players.forEach(function (p) {
            if (p.hasShield) {
                p.shieldTimer += dt;
            }
        });

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
                if (p.hasShield) {
                    // Shield absorbs the hit
                    p.hasShield = false;
                    p.shieldTimer = 0;
                    var pColor = p.index === 0 ? colors.p1 : colors.p2;
                    spawnShieldPop(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, pColor);
                    CGameAudio.play('score'); // reuse score sound for shield pop
                    // Remove the obstacle that was hit
                    obstacles.splice(i, 1);
                    return;
                }
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
                spawnCoinSparkle(c.x, c.y);
            }
        }

        // Shield pickup collection
        for (var k = 0; k < shields.length; k++) {
            var s = shields[k];
            if (s.collected) continue;
            if (s.y < p.laneTop || s.y > p.laneTop + p.laneH) continue;

            var scx = px + pw / 2;
            var scy = py + ph / 2;
            var sdx = scx - s.x;
            var sdy = scy - s.y;
            if (Math.sqrt(sdx * sdx + sdy * sdy) < SHIELD_RADIUS + pw / 2) {
                s.collected = true;
                p.hasShield = true;
                p.shieldTimer = 0;
                CGameAudio.play('score');
                spawnParticles(s.x, s.y, '#44ffcc', 8);
            }
        }
    }

    function killPlayer(p) {
        p.alive = false;
        CGameAudio.play('hit');
        var pColor = p.index === 0 ? colors.p1 : colors.p2;
        spawnDeathExplosion(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, pColor);
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

        // ─── Nebula layer (behind stars) ────────────────────────
        nebulae.forEach(function (n) {
            if (n.laneTop !== player.laneTop) return;
            var grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            grad.addColorStop(0, 'rgba(' + n.color.r + ',' + n.color.g + ',' + n.color.b + ',' + (n.alpha * 1.5) + ')');
            grad.addColorStop(0.5, 'rgba(' + n.color.r + ',' + n.color.g + ',' + n.color.b + ',' + (n.alpha * 0.6) + ')');
            grad.addColorStop(1, 'rgba(' + n.color.r + ',' + n.color.g + ',' + n.color.b + ',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2);
        });

        // ─── Stars / parallax with twinkle ─────────────────────
        stars.forEach(function (s) {
            if (s.laneTop !== player.laneTop) return;
            var twinkle = 0.5 + 0.5 * Math.sin(globalTime * s.twinkleSpeed + s.twinklePhase);
            var alpha = s.alpha * (0.5 + twinkle * 0.5);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = colors.text;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            // Subtle glow on bigger stars
            if (s.size > 2) {
                ctx.globalAlpha = alpha * 0.3;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;

        // Ceiling band
        ctx.fillStyle = colors.bgSec;
        ctx.fillRect(0, ceilY, CANVAS_W, BAND_H);

        // Floor band
        ctx.fillStyle = colors.bgSec;
        ctx.fillRect(0, floorY, CANVAS_W, BAND_H);

        // ─── Neon glow edges (floor and ceiling) ────────────────
        var neonPulse = 0.7 + 0.3 * Math.sin(globalTime * 3);
        var pColor = player.index === 0 ? colors.p1 : colors.p2;

        // Ceiling edge neon glow
        ctx.save();
        ctx.shadowBlur = 15 * neonPulse;
        ctx.shadowColor = pColor;
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7 + 0.3 * neonPulse;
        ctx.beginPath();
        ctx.moveTo(0, ceilY + BAND_H);
        ctx.lineTo(CANVAS_W, ceilY + BAND_H);
        ctx.stroke();
        ctx.restore();

        // Floor edge neon glow
        ctx.save();
        ctx.shadowBlur = 15 * neonPulse;
        ctx.shadowColor = pColor;
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7 + 0.3 * neonPulse;
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(CANVAS_W, floorY);
        ctx.stroke();
        ctx.restore();

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

        // ─── Obstacles (enhanced with gradient + glow) ──────────
        obstacles.forEach(function (o) {
            if (o.x + o.w < 0 || o.x > CANVAS_W) return;
            // Only draw obstacles in this lane
            if (o.y < player.laneTop - 1 || o.y + o.h > player.laneTop + player.laneH + 1) return;

            if (o.spike) {
                drawSpike(o);
            } else {
                drawBlock(o);
            }
        });

        // ─── Shield pickups ─────────────────────────────────────
        shields.forEach(function (s) {
            if (s.collected) return;
            if (s.x < -30 || s.x > CANVAS_W + 30) return;
            if (s.laneTop !== player.laneTop) return;
            drawShieldPickup(s);
        });

        // ─── Coins (with sparkle and glow) ──────────────────────
        coins.forEach(function (c) {
            if (c.collected) return;
            if (c.x < -20 || c.x > CANVAS_W + 20) return;
            if (c.y < player.laneTop || c.y > player.laneTop + player.laneH) return;
            drawCoin(c);
        });

        // Player
        if (player.alive) {
            drawPlayer(player);
        }
    }

    // ─── Draw Block Obstacle (metallic gradient + glow) ─────────
    function drawBlock(o) {
        ctx.save();
        // Subtle danger glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = colors.danger;

        // Metallic gradient fill
        var grad = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
        var dc = hexToRgb(colors.danger);
        grad.addColorStop(0, 'rgba(' + Math.min(dc.r + 60, 255) + ',' + Math.min(dc.g + 30, 255) + ',' + Math.min(dc.b + 30, 255) + ',1)');
        grad.addColorStop(0.3, colors.danger);
        grad.addColorStop(0.7, 'rgba(' + Math.max(dc.r - 40, 0) + ',' + Math.max(dc.g - 20, 0) + ',' + Math.max(dc.b - 20, 0) + ',1)');
        grad.addColorStop(1, colors.danger);
        ctx.fillStyle = grad;
        ctx.fillRect(o.x, o.y, o.w, o.h);

        // Metallic highlight edge (top)
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(o.x, o.y, o.w, 2);
        // Left edge highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(o.x, o.y, 2, o.h);

        ctx.restore();
    }

    // ─── Draw Spike (metallic + glow) ───────────────────────────
    function drawSpike(o) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = colors.danger;

        var dc = hexToRgb(colors.danger);

        // Metallic gradient for spike
        var grad;
        if (o.surface === 'floor') {
            grad = ctx.createLinearGradient(o.x + o.w / 2, o.y, o.x + o.w / 2, o.y + o.h);
        } else {
            grad = ctx.createLinearGradient(o.x + o.w / 2, o.y + o.h, o.x + o.w / 2, o.y);
        }
        grad.addColorStop(0, 'rgba(' + Math.min(dc.r + 80, 255) + ',' + Math.min(dc.g + 40, 255) + ',' + Math.min(dc.b + 40, 255) + ',1)');
        grad.addColorStop(0.5, colors.danger);
        grad.addColorStop(1, 'rgba(' + Math.max(dc.r - 50, 0) + ',' + Math.max(dc.g - 30, 0) + ',' + Math.max(dc.b - 30, 0) + ',1)');

        ctx.fillStyle = grad;
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
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // ─── Draw Coin (sparkle + glow) ─────────────────────────────
    function drawCoin(c) {
        ctx.save();

        // Outer glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffd700';

        // Base coin with gradient
        var grad = ctx.createRadialGradient(c.x - 2, c.y - 2, 1, c.x, c.y, COIN_RADIUS);
        grad.addColorStop(0, '#fff6cc');
        grad.addColorStop(0.4, '#ffec80');
        grad.addColorStop(1, '#daa520');
        ctx.beginPath();
        ctx.arc(c.x, c.y, COIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner circle
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(c.x, c.y, COIN_RADIUS - 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffec80';
        ctx.fill();

        // Rotating sparkle/shine highlight
        var sparkAngle = globalTime * 3;
        var shineX = c.x + Math.cos(sparkAngle) * (COIN_RADIUS * 0.4);
        var shineY = c.y + Math.sin(sparkAngle) * (COIN_RADIUS * 0.4);
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(globalTime * 5);
        ctx.beginPath();
        ctx.arc(shineX, shineY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Cross sparkle lines
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(globalTime * 5);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        var sparkLen = 3 + Math.sin(globalTime * 4) * 1.5;
        ctx.beginPath();
        ctx.moveTo(shineX - sparkLen, shineY);
        ctx.lineTo(shineX + sparkLen, shineY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(shineX, shineY - sparkLen);
        ctx.lineTo(shineX, shineY + sparkLen);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ─── Draw Shield Pickup ─────────────────────────────────────
    function drawShieldPickup(s) {
        var bob = Math.sin(globalTime * 3 + s.bobPhase) * 3;
        var sy = s.y + bob;

        ctx.save();

        // Outer glow
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#44ffcc';

        // Bubble gradient
        var grad = ctx.createRadialGradient(s.x - 2, sy - 2, 1, s.x, sy, SHIELD_RADIUS);
        grad.addColorStop(0, 'rgba(170, 255, 238, 0.9)');
        grad.addColorStop(0.6, 'rgba(68, 255, 204, 0.5)');
        grad.addColorStop(1, 'rgba(68, 255, 204, 0.1)');
        ctx.beginPath();
        ctx.arc(s.x, sy, SHIELD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner bubble ring
        ctx.strokeStyle = 'rgba(170, 255, 238, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shield icon: small "S" or cross inside
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', s.x, sy + 1);

        // Pulsing ring
        var ringPulse = 0.3 + 0.3 * Math.sin(globalTime * 4 + s.bobPhase);
        ctx.globalAlpha = ringPulse;
        ctx.beginPath();
        ctx.arc(s.x, sy, SHIELD_RADIUS + 4 + Math.sin(globalTime * 4) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#44ffcc';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ─── Draw Player (astronaut/robot character with gradient) ──
    function drawPlayer(p) {
        var pColor = p.index === 0 ? colors.p1 : colors.p2;
        var pLight = p.index === 0 ? colors.p1Light : colors.p2Light;
        var pc = hexToRgb(pColor);

        // ─── Trail effect (last 6 positions with decreasing alpha) ──
        for (var i = 0; i < p.trail.length; i++) {
            var t = p.trail[i];
            var alpha = (1 - i / p.trail.length) * 0.35;
            var size = PLAYER_SIZE * (1 - i / p.trail.length) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pColor;
            ctx.beginPath();
            ctx.arc(t.x + PLAYER_SIZE / 2, t.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        var cx = p.x + PLAYER_SIZE / 2;
        var cy = p.y + PLAYER_SIZE / 2;
        var isUpsideDown = !p.onFloor;

        ctx.save();

        // Translate to center and flip if upside down
        ctx.translate(cx, cy);
        if (isUpsideDown) {
            ctx.scale(1, -1);
        }

        // ─── Body (rounded rectangle with gradient) ─────────────
        var bodyW = PLAYER_SIZE - 4;
        var bodyH = PLAYER_SIZE - 6;
        var bodyX = -bodyW / 2;
        var bodyY = -2;

        var bodyGrad = ctx.createLinearGradient(bodyX, bodyY, bodyX + bodyW, bodyY + bodyH);
        bodyGrad.addColorStop(0, pLight);
        bodyGrad.addColorStop(0.5, pColor);
        bodyGrad.addColorStop(1, 'rgba(' + Math.max(pc.r - 40, 0) + ',' + Math.max(pc.g - 40, 0) + ',' + Math.max(pc.b - 40, 0) + ',1)');
        ctx.fillStyle = bodyGrad;
        roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 3);
        ctx.fill();

        // Body highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(ctx, bodyX + 1, bodyY + 1, bodyW - 2, bodyH / 2, 2);
        ctx.fill();

        // ─── Head (circle with gradient, like helmet visor) ─────
        var headRadius = 6;
        var headY = -6;

        var headGrad = ctx.createRadialGradient(-1, headY - 1, 1, 0, headY, headRadius);
        headGrad.addColorStop(0, pLight);
        headGrad.addColorStop(1, pColor);
        ctx.beginPath();
        ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();

        // Visor (dark reflective area)
        ctx.beginPath();
        ctx.arc(0, headY, headRadius - 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,10,30,0.7)';
        ctx.fill();

        // Visor shine
        ctx.beginPath();
        ctx.arc(-1.5, headY - 1.5, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();

        // Eyes inside visor
        ctx.fillStyle = '#fff';
        ctx.fillRect(-3, headY - 2, 2.5, 2.5);
        ctx.fillRect(1, headY - 2, 2.5, 2.5);

        // Pupils
        ctx.fillStyle = '#111';
        ctx.fillRect(-2, headY - 1, 1.2, 1.2);
        ctx.fillRect(2, headY - 1, 1.2, 1.2);

        // ─── Limbs (small arms and legs) ────────────────────────
        // Arms
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Left arm
        ctx.beginPath();
        ctx.moveTo(bodyX - 1, bodyY + 3);
        ctx.lineTo(bodyX - 5, bodyY + bodyH * 0.5 + Math.sin(globalTime * 8) * 2);
        ctx.stroke();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW + 1, bodyY + 3);
        ctx.lineTo(bodyX + bodyW + 5, bodyY + bodyH * 0.5 - Math.sin(globalTime * 8) * 2);
        ctx.stroke();

        // Legs
        var legPhase = Math.sin(globalTime * 10) * 2;
        // Left leg
        ctx.beginPath();
        ctx.moveTo(-3, bodyY + bodyH);
        ctx.lineTo(-4 + legPhase, bodyY + bodyH + 5);
        ctx.stroke();
        // Right leg
        ctx.beginPath();
        ctx.moveTo(3, bodyY + bodyH);
        ctx.lineTo(4 - legPhase, bodyY + bodyH + 5);
        ctx.stroke();

        ctx.restore();

        // ─── Shield bubble around player ────────────────────────
        if (p.hasShield) {
            ctx.save();
            var shieldPulse = 0.3 + 0.15 * Math.sin(globalTime * 4);
            var shieldR = PLAYER_SIZE * 0.85 + Math.sin(globalTime * 3) * 2;

            ctx.shadowBlur = 12;
            ctx.shadowColor = '#44ffcc';

            // Semi-transparent bubble
            ctx.globalAlpha = shieldPulse;
            var shieldGrad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, shieldR);
            shieldGrad.addColorStop(0, 'rgba(170, 255, 238, 0.1)');
            shieldGrad.addColorStop(0.7, 'rgba(68, 255, 204, 0.15)');
            shieldGrad.addColorStop(1, 'rgba(68, 255, 204, 0.3)');
            ctx.beginPath();
            ctx.arc(cx, cy, shieldR, 0, Math.PI * 2);
            ctx.fillStyle = shieldGrad;
            ctx.fill();

            // Bubble outline
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(globalTime * 5);
            ctx.strokeStyle = '#88ffdd';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Highlight gleam on bubble
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(cx - shieldR * 0.3, cy - shieldR * 0.3, shieldR * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }

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

    // ─── Utility: rounded rectangle path ────────────────────────
    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
    }

    // ─── Draw Particles (enhanced with shapes) ──────────────────
    function drawParticles() {
        particles.forEach(function (pt) {
            var alpha = pt.life / pt.maxLife;
            ctx.globalAlpha = alpha;

            if (pt.type === 'sparkle') {
                // Draw as a small star/diamond shape
                ctx.save();
                ctx.translate(pt.x, pt.y);
                ctx.rotate(globalTime * 5);
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                var s = pt.size;
                ctx.moveTo(0, -s);
                ctx.lineTo(s * 0.3, -s * 0.3);
                ctx.lineTo(s, 0);
                ctx.lineTo(s * 0.3, s * 0.3);
                ctx.lineTo(0, s);
                ctx.lineTo(-s * 0.3, s * 0.3);
                ctx.lineTo(-s, 0);
                ctx.lineTo(-s * 0.3, -s * 0.3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else if (pt.type === 'spark') {
                // Bright core spark - circle with glow
                ctx.save();
                ctx.shadowBlur = 6;
                ctx.shadowColor = pt.color;
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                // Default / explosion - slightly rounded squares
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
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
