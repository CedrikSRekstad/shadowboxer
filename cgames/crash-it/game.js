/* === Crash It - Car Bumping Game on a Winding Road === */
(function () {
    'use strict';

    // ── DOM refs ──
    var canvas = document.getElementById('game-canvas');
    var ctx = canvas.getContext('2d');
    var container = document.getElementById('canvas-container');
    var scoreP1El = document.getElementById('score-p1');
    var scoreP2El = document.getElementById('score-p2');
    var roundInfoEl = document.getElementById('round-info');
    var winnerTextEl = document.getElementById('winner-text');
    var finalScoreEl = document.getElementById('final-score');
    var countdownOverlay = document.getElementById('countdown-overlay');
    var countdownNumber = document.getElementById('countdown-number');
    var pauseOverlay = document.getElementById('pause-overlay');
    var roundOverlay = document.getElementById('round-overlay');
    var roundText = document.getElementById('round-text');

    // ── Constants ──
    var ROAD_SEGMENT_LEN = 4;
    var ROAD_BASE_WIDTH = 190;
    var ROAD_MIN_WIDTH = 90;
    var CAR_SPEED = 210;
    var STEER_SPEED = 200;
    var CAR_W = 24;   // ~20% bigger (was 20)
    var CAR_H = 43;   // ~20% bigger (was 36)
    var ROAD_VISIBLE_AHEAD = 600;
    var ROAD_CURVE_STRENGTH = 0.004;
    var NARROW_RATE = 0.012;
    var WIN_SCORE = 2;
    var BUMP_FORCE = 280;
    var BUMP_COOLDOWN = 0.3;
    var SPEED_UP_RATE = 10;

    // Drift constants
    var DRIFT_ACCEL = 8;           // how fast lateral vel builds (lower = more drift)
    var DRIFT_DECAY = 0.92;        // lateral vel decay when NOT steering (per-frame at 60fps)
    var DRIFT_THRESHOLD = 60;      // speed threshold to show drift visuals
    var DRIFT_ANGLE_MULT = 0.0025; // how much lateral vel affects visual angle
    var DRIFT_SMOKE_INTERVAL = 0.04; // seconds between drift smoke puffs

    // Boost pad constants
    var BOOST_PAD_W = 30;
    var BOOST_PAD_H = 50;
    var BOOST_SPEED_MULT = 1.3;
    var BOOST_DURATION = 1.0;
    var BOOST_SPAWN_INTERVAL = 300; // road distance between possible spawns

    // Oil slick constants
    var OIL_RADIUS = 18;
    var OIL_SLOW_MULT = 0.6;
    var OIL_SLIDE_FORCE = 180;
    var OIL_DURATION = 0.7;
    var OIL_SPAWN_INTERVAL = 400;

    // ── State ──
    var mode = 0;
    var paused = false;
    var running = false;
    var scores = [0, 0];
    var currentRound = 0;
    var roundActive = false;

    // Road
    var road = [];
    var roadDistance = 0;
    var roadCurve = 0;
    var roadCurveTarget = 0;
    var roadCurveTimer = 0;
    var roadHalfWidth = ROAD_BASE_WIDTH;
    var cameraY = 0;

    // Players
    var players = [];

    // Particles
    var particles = [];

    // Smoke particles (exhaust trails)
    var smokeParticles = [];

    // Hazards
    var boostPads = [];
    var oilSlicks = [];
    var nextBoostSpawn = 200;
    var nextOilSpawn = 350;

    // Asphalt noise texture (pre-generated)
    var asphaltPattern = null;

    // Input
    var keys = {};
    var touchState = { p1: 0, p2: 0 };

    // Animation
    var lastTime = 0;
    var animId = null;
    var roundTimer = 0;

    // Screen shake
    var shakeTimer = 0;
    var shakeIntensity = 0;

    // ── Init ──
    GameShell.init({ backUrl: '../' });

    // ── Pre-generate asphalt noise texture ──
    function generateAsphaltPattern() {
        var patCanvas = document.createElement('canvas');
        patCanvas.width = 64;
        patCanvas.height = 64;
        var patCtx = patCanvas.getContext('2d');
        patCtx.fillStyle = 'rgba(0,0,0,0)';
        patCtx.fillRect(0, 0, 64, 64);
        for (var i = 0; i < 120; i++) {
            var px = Math.random() * 64;
            var py = Math.random() * 64;
            var bright = Math.random() * 0.15;
            patCtx.fillStyle = Math.random() < 0.5
                ? 'rgba(255,255,255,' + bright + ')'
                : 'rgba(0,0,0,' + (bright + 0.05) + ')';
            patCtx.fillRect(px, py, 1, 1);
        }
        asphaltPattern = ctx.createPattern(patCanvas, 'repeat');
    }

    // ── Button handlers ──
    document.getElementById('btn-1p').addEventListener('click', function () {
        CGameAudio.play('select');
        mode = 1;
        startMatch();
    });

    document.getElementById('btn-2p').addEventListener('click', function () {
        CGameAudio.play('select');
        mode = 2;
        startMatch();
    });

    document.getElementById('btn-pause').addEventListener('click', function () {
        if (running) togglePause();
    });

    document.getElementById('btn-resume').addEventListener('click', function () {
        CGameAudio.play('click');
        togglePause();
    });

    document.getElementById('btn-quit').addEventListener('click', function () {
        CGameAudio.play('back');
        stopGame();
        GameShell.showScreen('title-screen');
    });

    document.getElementById('btn-play-again').addEventListener('click', function () {
        CGameAudio.play('select');
        startMatch();
    });

    document.getElementById('btn-menu').addEventListener('click', function () {
        CGameAudio.play('back');
        GameShell.showScreen('title-screen');
    });

    var touchZoneP2 = document.getElementById('touch-zone-p2');

    // ── Input ──
    document.addEventListener('keydown', function (e) {
        keys[e.key.toLowerCase()] = true;
        if (e.key === 'Escape' && running) togglePause();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(e.key.toLowerCase()) >= 0) {
            e.preventDefault();
        }
    });
    document.addEventListener('keyup', function (e) {
        keys[e.key.toLowerCase()] = false;
    });

    // Touch
    function setupTouch(id, cb) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', function (e) { e.preventDefault(); cb(true); }, { passive: false });
        el.addEventListener('touchend', function (e) { e.preventDefault(); cb(false); }, { passive: false });
        el.addEventListener('mousedown', function (e) { e.preventDefault(); cb(true); });
        el.addEventListener('mouseup', function (e) { e.preventDefault(); cb(false); });
    }

    setupTouch('touch-p1-left', function (down) { touchState.p1 = down ? -1 : (touchState.p1 === -1 ? 0 : touchState.p1); });
    setupTouch('touch-p1-right', function (down) { touchState.p1 = down ? 1 : (touchState.p1 === 1 ? 0 : touchState.p1); });
    setupTouch('touch-p2-left', function (down) { touchState.p2 = down ? -1 : (touchState.p2 === -1 ? 0 : touchState.p2); });
    setupTouch('touch-p2-right', function (down) { touchState.p2 = down ? 1 : (touchState.p2 === 1 ? 0 : touchState.p2); });

    // ── Canvas resize ──
    function resizeCanvas() {
        var rect = container.getBoundingClientRect();
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
        generateAsphaltPattern();
    }
    window.addEventListener('resize', resizeCanvas);

    // ── Road generation ──
    function initRoad() {
        road = [];
        roadDistance = 0;
        roadCurve = 0;
        roadCurveTarget = 0;
        roadCurveTimer = 0;
        roadHalfWidth = ROAD_BASE_WIDTH;
        cameraY = 0;
        boostPads = [];
        oilSlicks = [];
        nextBoostSpawn = 200;
        nextOilSpawn = 350;

        var cx = canvas.width / 2;
        for (var i = 0; i < 400; i++) {
            road.push({ x: cx, y: -i * ROAD_SEGMENT_LEN, hw: ROAD_BASE_WIDTH });
            roadDistance += ROAD_SEGMENT_LEN;
        }
    }

    function extendRoad(targetY) {
        var lastSeg = road[road.length - 1];
        var lastX = lastSeg.x;
        var lastY = lastSeg.y;

        while (lastY > targetY - ROAD_VISIBLE_AHEAD) {
            roadCurveTimer -= ROAD_SEGMENT_LEN;
            if (roadCurveTimer <= 0) {
                roadCurveTarget = (Math.random() - 0.5) * 2 * ROAD_CURVE_STRENGTH;
                roadCurveTimer = 100 + Math.random() * 300;
            }

            roadCurve += (roadCurveTarget - roadCurve) * 0.05;
            roadHalfWidth = Math.max(ROAD_MIN_WIDTH, ROAD_BASE_WIDTH - roadDistance * NARROW_RATE);

            lastX += roadCurve * ROAD_SEGMENT_LEN * 100;
            lastY -= ROAD_SEGMENT_LEN;
            roadDistance += ROAD_SEGMENT_LEN;

            var margin = roadHalfWidth + 30;
            if (lastX < margin) { lastX = margin; roadCurve = Math.abs(roadCurve); }
            if (lastX > canvas.width - margin) { lastX = canvas.width - margin; roadCurve = -Math.abs(roadCurve); }

            road.push({ x: lastX, y: lastY, hw: roadHalfWidth });

            // Spawn boost pads
            if (roadDistance >= nextBoostSpawn) {
                if (Math.random() < 0.45) {
                    var laneOff = (Math.random() - 0.5) * roadHalfWidth * 1.0;
                    boostPads.push({
                        x: lastX + laneOff,
                        y: lastY,
                        hw: roadHalfWidth,
                        pulse: Math.random() * Math.PI * 2
                    });
                }
                nextBoostSpawn = roadDistance + BOOST_SPAWN_INTERVAL + Math.random() * 200;
            }

            // Spawn oil slicks
            if (roadDistance >= nextOilSpawn) {
                if (Math.random() < 0.35) {
                    var oilLaneOff = (Math.random() - 0.5) * roadHalfWidth * 0.8;
                    oilSlicks.push({
                        x: lastX + oilLaneOff,
                        y: lastY,
                        phase: Math.random() * Math.PI * 2
                    });
                }
                nextOilSpawn = roadDistance + OIL_SPAWN_INTERVAL + Math.random() * 250;
            }
        }
    }

    function pruneRoad(bottomY) {
        while (road.length > 2 && road[0].y > bottomY + 200) {
            road.shift();
        }
        // Prune off-screen hazards
        for (var bi = boostPads.length - 1; bi >= 0; bi--) {
            if (boostPads[bi].y > bottomY + 200) boostPads.splice(bi, 1);
        }
        for (var oi = oilSlicks.length - 1; oi >= 0; oi--) {
            if (oilSlicks[oi].y > bottomY + 200) oilSlicks.splice(oi, 1);
        }
    }

    function getRoadAt(worldY) {
        var lo = 0, hi = road.length - 1;
        while (lo < hi - 1) {
            var mid = (lo + hi) >> 1;
            if (road[mid].y > worldY) lo = mid;
            else hi = mid;
        }

        var segA = road[lo];
        var segB = road[hi];
        if (!segA || !segB) return { x: canvas.width / 2, hw: ROAD_BASE_WIDTH };

        var range = segA.y - segB.y;
        var t = range > 0 ? (segA.y - worldY) / range : 0;
        t = Math.max(0, Math.min(1, t));

        return {
            x: segA.x + (segB.x - segA.x) * t,
            hw: segA.hw + (segB.hw - segA.hw) * t
        };
    }

    // ── Player (car) creation ──
    function createPlayer(index, laneOffset) {
        var startY = -50;
        var roadInfo = getRoadAt(startY);
        var startX = roadInfo.x + laneOffset;

        return {
            index: index,
            x: startX,
            y: startY,
            worldY: startY,
            vx: 0,
            steer: 0,
            alive: true,
            speed: CAR_SPEED,
            bumpCooldown: 0,
            angle: 0,
            tireMarks: [],
            spinTimer: 0,
            spinDir: 0,
            // Drift
            lateralVel: 0,
            drifting: false,
            driftSmokeCooldown: 0,
            // New visual/gameplay properties
            hits: 0,
            flashTimer: 0,
            boostTimer: 0,
            oilTimer: 0,
            oilSlideDir: 0
        };
    }

    // ── Particles ──
    function spawnParticles(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 50 + Math.random() * 200;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.5,
                maxLife: 0.4 + Math.random() * 0.5,
                r: 2 + Math.random() * 4,
                color: color
            });
        }
    }

    function spawnSparks(x, y, count) {
        var sparkColors = ['#ffdd00', '#ff8800', '#ffffff', '#ffaa44'];
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 100 + Math.random() * 250;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.2 + Math.random() * 0.3,
                r: 1 + Math.random() * 2,
                color: sparkColors[Math.floor(Math.random() * sparkColors.length)]
            });
        }
    }

    // Enhanced collision: debris chunks
    function spawnDebris(x, y, count) {
        var debrisColors = ['#555', '#777', '#999', '#444', '#888'];
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 80 + Math.random() * 180;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.6,
                maxLife: 0.5 + Math.random() * 0.6,
                r: 3 + Math.random() * 5,
                color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
                isDebris: true,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 10
            });
        }
    }

    // Smoke particle spawning (exhaust trails)
    function spawnSmoke(x, y, intensity) {
        if (Math.random() > intensity) return;
        smokeParticles.push({
            x: x + (Math.random() - 0.5) * 4,
            y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 10,
            life: 0.4 + Math.random() * 0.4,
            maxLife: 0.4 + Math.random() * 0.4,
            r: 2 + Math.random() * 3,
            alpha: 0.25 + Math.random() * 0.15
        });
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            if (p.isDebris) {
                p.vy += 120 * dt; // gravity for debris
                p.rotation += p.rotSpeed * dt;
            }
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        // Update smoke
        for (var si = smokeParticles.length - 1; si >= 0; si--) {
            var sp = smokeParticles[si];
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.r += 4 * dt; // expand
            sp.life -= dt;
            if (sp.life <= 0) smokeParticles.splice(si, 1);
        }
        if (smokeParticles.length > 300) smokeParticles.splice(0, smokeParticles.length - 300);
    }

    function drawParticles(offsetY) {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            if (p.isDebris) {
                ctx.save();
                ctx.translate(p.x, p.y + offsetY);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y + offsetY, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawSmoke(offsetY) {
        for (var i = 0; i < smokeParticles.length; i++) {
            var sp = smokeParticles[i];
            var lifeRatio = sp.life / sp.maxLife;
            var alpha = sp.alpha * lifeRatio;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y + offsetY, sp.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200,200,210,0.6)';
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── AI ──
    function updateAI(player, opponent, dt) {
        if (!player.alive) return;

        var lookAhead = player.worldY - 100;
        var ri = getRoadAt(lookAhead);

        var targetX = ri.x;

        // Try to ram the opponent
        if (opponent && opponent.alive) {
            var dx = opponent.x - player.x;
            if (Math.abs(dx) < ri.hw * 0.7) {
                targetX = opponent.x + (Math.random() < 0.3 ? 0 : dx * 0.3);
            }
        }

        // Add wobble for imperfect AI
        targetX += Math.sin(roundTimer * 3) * 12;

        var steer = 0;
        var diff = targetX - player.x;
        if (diff < -10) steer = -1;
        else if (diff > 10) steer = 1;

        player.steer = steer;
    }

    // ── Get player input ──
    function getPlayerInput(pIndex) {
        var steer = 0;
        if (pIndex === 0) {
            if (keys['a']) steer -= 1;
            if (keys['d']) steer += 1;
            if (mode === 1) {
                if (keys['arrowleft']) steer -= 1;
                if (keys['arrowright']) steer += 1;
            }
            if (touchState.p1 !== 0) steer = touchState.p1;
        } else {
            if (keys['arrowleft']) steer -= 1;
            if (keys['arrowright']) steer += 1;
            if (touchState.p2 !== 0) steer = touchState.p2;
        }
        return Math.max(-1, Math.min(1, steer));
    }

    // ── Collision between cars ──
    function checkCarCollision() {
        if (players.length < 2) return;
        var p1 = players[0];
        var p2 = players[1];
        if (!p1.alive || !p2.alive) return;

        var dx = p1.x - p2.x;
        var dy = p1.worldY - p2.worldY;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // Cars overlap (simplified circle collision using average car dimension)
        var collisionDist = (CAR_W + CAR_H) / 2;
        if (dist < collisionDist && p1.bumpCooldown <= 0 && p2.bumpCooldown <= 0) {
            // Calculate bump direction
            var nx = dist > 0.01 ? dx / dist : 1;
            var ny = dist > 0.01 ? dy / dist : 0;

            // Apply lateral bump force (push cars apart)
            p1.vx += nx * BUMP_FORCE;
            p2.vx -= nx * BUMP_FORCE;

            // Add slight spin effect
            p1.spinTimer = 0.25;
            p1.spinDir = nx > 0 ? 1 : -1;
            p2.spinTimer = 0.25;
            p2.spinDir = nx > 0 ? -1 : 1;

            p1.bumpCooldown = BUMP_COOLDOWN;
            p2.bumpCooldown = BUMP_COOLDOWN;

            // Track hits for damage indicator
            p1.hits++;
            p2.hits++;
            p1.flashTimer = 0.15;
            p2.flashTimer = 0.15;

            // Enhanced sparks & debris at collision point
            var cx = (p1.x + p2.x) / 2;
            var cy = (p1.worldY + p2.worldY) / 2;
            var impactSpeed = Math.abs(p1.vx) + Math.abs(p2.vx);
            var sparkCount = Math.min(35, 15 + Math.floor(impactSpeed / 30));
            spawnSparks(cx, cy, sparkCount);
            spawnDebris(cx, cy, 6);

            CGameAudio.play('hit');
            // Screen shake proportional to impact speed
            var shakeStr = Math.min(14, 6 + impactSpeed / 50);
            triggerShake(shakeStr, 0.3);
        }
    }

    var edgeBounceCD = [0, 0];

    function checkRoadBounds() {
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            var ri = getRoadAt(player.worldY);
            var dx = Math.abs(player.x - ri.x);

            if (dx > ri.hw - CAR_W * 0.3) {
                // Off the road!
                player.alive = false;
                spawnParticles(player.x, player.worldY, getPlayerColor(p), 25);
                spawnSparks(player.x, player.worldY, 12);
                spawnDebris(player.x, player.worldY, 8);
                CGameAudio.play('lose');
                triggerShake(7, 0.35);

                var winner = p === 0 ? 1 : 0;
                endRound(winner);
                return;
            }

            // Bounce sound when near edge
            if (dx > ri.hw * 0.75 && edgeBounceCD[p] <= 0) {
                CGameAudio.play('bounce');
                edgeBounceCD[p] = 0.4;
            }
            if (edgeBounceCD[p] > 0) edgeBounceCD[p] -= 1 / 60;
        }
    }

    // ── Hazard collision checks ──
    function checkHazards() {
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            // Boost pads
            for (var bi = 0; bi < boostPads.length; bi++) {
                var bp = boostPads[bi];
                var bdx = Math.abs(player.x - bp.x);
                var bdy = Math.abs(player.worldY - bp.y);
                if (bdx < (CAR_W / 2 + BOOST_PAD_W / 2) && bdy < (CAR_H / 2 + BOOST_PAD_H / 2)) {
                    if (player.boostTimer <= 0) {
                        player.boostTimer = BOOST_DURATION;
                        // Visual feedback: yellow sparks
                        spawnParticles(player.x, player.worldY, '#ffdd00', 8);
                    }
                }
            }

            // Oil slicks
            for (var oi = 0; oi < oilSlicks.length; oi++) {
                var oil = oilSlicks[oi];
                var odx = player.x - oil.x;
                var ody = player.worldY - oil.y;
                var odist = Math.sqrt(odx * odx + ody * ody);
                if (odist < (CAR_W / 2 + OIL_RADIUS)) {
                    if (player.oilTimer <= 0) {
                        player.oilTimer = OIL_DURATION;
                        player.oilSlideDir = (Math.random() < 0.5 ? -1 : 1);
                        // Spawn dark particles
                        spawnParticles(player.x, player.worldY, '#333', 6);
                    }
                }
            }
        }
    }

    // ── Colors ──
    function getPlayerColor(index) {
        var style = getComputedStyle(document.documentElement);
        return index === 0 ? style.getPropertyValue('--p1-color').trim() : style.getPropertyValue('--p2-color').trim();
    }

    function getPlayerLightColor(index) {
        var style = getComputedStyle(document.documentElement);
        return index === 0 ? style.getPropertyValue('--p1-light').trim() : style.getPropertyValue('--p2-light').trim();
    }

    // ── Match & round flow ──
    function startMatch() {
        scores = [0, 0];
        currentRound = 0;
        updateScoreHUD();

        if (touchZoneP2) {
            touchZoneP2.style.display = mode === 2 ? '' : 'none';
        }

        GameShell.showScreen('game-screen');
        resizeCanvas();
        startRound();
    }

    function startRound() {
        currentRound++;
        roundInfoEl.textContent = 'Round ' + currentRound;
        roundActive = false;
        roundTimer = 0;
        paused = false;
        particles = [];
        smokeParticles = [];

        pauseOverlay.classList.add('hidden');
        roundOverlay.classList.add('hidden');

        resizeCanvas();
        initRoad();

        // Create players on opposite sides of the road
        players = [];
        players.push(createPlayer(0, -35));
        players.push(createPlayer(1, 35));

        // Countdown
        doCountdown(3, function () {
            roundActive = true;
            running = true;
            lastTime = performance.now();
            if (animId) cancelAnimationFrame(animId);
            gameLoop(performance.now());
        });
    }

    function doCountdown(count, cb) {
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = count;
        CGameAudio.play('countdown');

        drawFrame();

        if (count <= 1) {
            countdownNumber.textContent = 'GO!';
            setTimeout(function () {
                countdownOverlay.classList.add('hidden');
                cb();
            }, 500);
            return;
        }

        setTimeout(function () {
            doCountdown(count - 1, cb);
        }, 700);
    }

    function endRound(winnerIndex) {
        roundActive = false;
        running = false;
        if (animId) cancelAnimationFrame(animId);

        if (winnerIndex >= 0) {
            scores[winnerIndex]++;
            updateScoreHUD();
        }

        var msg = '';
        if (winnerIndex === -1) {
            msg = 'Draw!';
        } else {
            msg = 'P' + (winnerIndex + 1) + ' scores!';
            CGameAudio.play('score');
        }

        if (scores[0] >= WIN_SCORE || scores[1] >= WIN_SCORE) {
            setTimeout(function () {
                showGameOver();
            }, 1200);
        } else {
            setTimeout(function () {
                startRound();
            }, 1500);
        }

        roundOverlay.classList.remove('hidden');
        roundText.textContent = msg;

        lastTime = performance.now();
        animatePostRound();
    }

    function animatePostRound() {
        var now = performance.now();
        var dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        updateParticles(dt);
        drawFrame();

        if (particles.length > 0 || smokeParticles.length > 0) {
            requestAnimationFrame(animatePostRound);
        }
    }

    function showGameOver() {
        roundOverlay.classList.add('hidden');
        var winner = scores[0] >= WIN_SCORE ? 0 : 1;

        if (mode === 1) {
            winnerTextEl.textContent = winner === 0 ? 'You Win!' : 'AI Wins!';
        } else {
            winnerTextEl.textContent = 'Player ' + (winner + 1) + ' Wins!';
        }
        winnerTextEl.style.color = getPlayerColor(winner);
        finalScoreEl.textContent = scores[0] + ' - ' + scores[1];

        CGameAudio.play(winner === 0 || mode === 2 ? 'win' : 'lose');
        GameShell.showScreen('gameover-screen');
    }

    function updateScoreHUD() {
        scoreP1El.textContent = scores[0];
        scoreP2El.textContent = scores[1];
    }

    function togglePause() {
        paused = !paused;
        pauseOverlay.classList.toggle('hidden', !paused);
        if (!paused && running) {
            lastTime = performance.now();
            gameLoop(performance.now());
        }
    }

    function stopGame() {
        running = false;
        roundActive = false;
        if (animId) cancelAnimationFrame(animId);
    }

    // ── Update ──
    function update(dt) {
        if (!roundActive) return;

        roundTimer += dt;

        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            // Get steer input
            if (mode === 1 && p === 1) {
                updateAI(player, players[0], dt);
            } else {
                player.steer = getPlayerInput(p);
            }

            // Steering reduces forward speed slightly
            var steerPenalty = 1 - Math.abs(player.steer) * 0.12;

            // Speed up over time
            player.speed = CAR_SPEED + roundTimer * SPEED_UP_RATE;

            // Apply boost
            if (player.boostTimer > 0) {
                player.boostTimer -= dt;
                player.speed *= BOOST_SPEED_MULT;
            }

            // Apply oil slick effect
            if (player.oilTimer > 0) {
                player.oilTimer -= dt;
                player.speed *= OIL_SLOW_MULT;
                player.x += player.oilSlideDir * OIL_SLIDE_FORCE * dt;
            }

            // Move forward
            player.worldY -= player.speed * steerPenalty * dt;
            player.y = player.worldY;

            // ─── Drift-based lateral movement ───
            // Target lateral velocity from steering input
            var targetLatVel = player.steer * STEER_SPEED * 1.2;

            // Lateral velocity accelerates toward target (not instant)
            var lerpFactor = 1 - Math.pow(1 / (DRIFT_ACCEL + 1), dt * 60);
            player.lateralVel += (targetLatVel - player.lateralVel) * lerpFactor;

            // When NOT steering, lateral velocity decays (car straightens out)
            if (Math.abs(player.steer) < 0.1) {
                player.lateralVel *= Math.pow(DRIFT_DECAY, dt * 60);
            }

            // Kill tiny residual drift
            if (Math.abs(player.lateralVel) < 2) player.lateralVel = 0;

            // Apply drift movement
            player.x += player.lateralVel * dt;

            // Determine drift state (for visuals)
            player.drifting = Math.abs(player.lateralVel) > DRIFT_THRESHOLD;

            // Apply bump velocity (decays over time)
            player.x += player.vx * dt;
            player.vx *= Math.pow(0.04, dt); // fast decay

            // Bump cooldown
            if (player.bumpCooldown > 0) player.bumpCooldown -= dt;

            // Flash timer
            if (player.flashTimer > 0) player.flashTimer -= dt;

            // Spin effect (visual only)
            if (player.spinTimer > 0) {
                player.spinTimer -= dt;
                player.angle = player.spinDir * player.spinTimer * 3;
            } else {
                // Drift angle: the car rotates more during drift
                var driftAngle = player.lateralVel * DRIFT_ANGLE_MULT;
                // Clamp max visual rotation
                if (driftAngle > 0.4) driftAngle = 0.4;
                if (driftAngle < -0.4) driftAngle = -0.4;
                player.angle = driftAngle;
            }

            // Tire marks when drifting or bumped hard
            if (player.drifting || Math.abs(player.vx) > 100) {
                player.tireMarks.push({ x: player.x - 7, y: player.worldY + CAR_H / 2, alpha: 0.6 });
                player.tireMarks.push({ x: player.x + 7, y: player.worldY + CAR_H / 2, alpha: 0.6 });
            }

            // Drift smoke (tire smoke when drifting)
            player.driftSmokeCooldown -= dt;
            if (player.drifting && player.driftSmokeCooldown <= 0) {
                player.driftSmokeCooldown = DRIFT_SMOKE_INTERVAL;
                // Spawn smoke at rear tires
                var rearY = player.worldY + CAR_H / 2 + 1;
                var smokeDir = player.lateralVel > 0 ? -1 : 1;
                smokeParticles.push({
                    x: player.x - 8 + (Math.random() - 0.5) * 4,
                    y: rearY,
                    vx: smokeDir * (10 + Math.random() * 20),
                    vy: (Math.random() - 0.5) * 8,
                    life: 0.5 + Math.random() * 0.3,
                    maxLife: 0.5 + Math.random() * 0.3,
                    r: 3 + Math.random() * 4,
                    alpha: 0.35
                });
                smokeParticles.push({
                    x: player.x + 8 + (Math.random() - 0.5) * 4,
                    y: rearY,
                    vx: smokeDir * (10 + Math.random() * 20),
                    vy: (Math.random() - 0.5) * 8,
                    life: 0.5 + Math.random() * 0.3,
                    maxLife: 0.5 + Math.random() * 0.3,
                    r: 3 + Math.random() * 4,
                    alpha: 0.35
                });
            }

            // Exhaust smoke
            var accel = Math.abs(player.steer) > 0.5 ? 0.7 : 0.35;
            if (player.boostTimer > 0) accel = 1.0;
            spawnSmoke(player.x - 3, player.worldY + CAR_H / 2 + 2, accel);
            spawnSmoke(player.x + 3, player.worldY + CAR_H / 2 + 2, accel);
        }

        // Camera follows average position of alive players
        var avgY = 0;
        var aliveCount = 0;
        for (var pi = 0; pi < players.length; pi++) {
            if (players[pi].alive) {
                avgY += players[pi].worldY;
                aliveCount++;
            }
        }
        if (aliveCount > 0) {
            cameraY = avgY / aliveCount;
        }

        // Extend & prune road
        extendRoad(cameraY - ROAD_VISIBLE_AHEAD);
        pruneRoad(cameraY + canvas.height);

        // Check car-on-car collision
        checkCarCollision();
        if (!roundActive) return;

        // Check road bounds
        checkRoadBounds();
        if (!roundActive) return;

        // Check hazards (boost pads, oil slicks)
        checkHazards();

        // Fade tire marks
        for (var p2 = 0; p2 < players.length; p2++) {
            var marks = players[p2].tireMarks;
            for (var mi = marks.length - 1; mi >= 0; mi--) {
                marks[mi].alpha -= dt * 0.5;
                if (marks[mi].alpha <= 0) marks.splice(mi, 1);
            }
            if (marks.length > 200) marks.splice(0, marks.length - 200);
        }

        // Update particles
        updateParticles(dt);
    }

    function triggerShake(intensity, duration) {
        shakeIntensity = intensity;
        shakeTimer = duration;
    }

    // ── Draw ──
    function drawFrame() {
        var W = canvas.width;
        var H = canvas.height;

        var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        var shakeX = 0, shakeY = 0;
        if (shakeTimer > 0) {
            shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
            shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
            shakeTimer -= 1 / 60;
            shakeIntensity *= 0.95;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        var offsetY = -cameraY + H * 0.65;

        drawRoad(offsetY, W, H);
        drawTireMarks(offsetY);
        drawSmoke(offsetY);
        drawBoostPads(offsetY);
        drawOilSlicks(offsetY);
        drawCars(offsetY);
        drawParticles(offsetY);
        drawEdgeWarnings(offsetY);

        ctx.restore();
    }

    function drawRoad(offsetY, W, H) {
        if (road.length < 2) return;

        var theme = document.body.getAttribute('data-theme');

        var roadColor = theme === 'dark' ? '#2a2a3e' : '#888899';
        var roadEdgeColor = theme === 'dark' ? '#444466' : '#666677';
        var roadLineColor = theme === 'dark' ? '#3a3a55' : '#aaaabb';
        var grassColor1 = theme === 'dark' ? '#0a1a0a' : '#88bb66';
        var grassColor2 = theme === 'dark' ? '#0d220d' : '#6da84f';

        // Parallax grass background with gradient texture
        var grassGrad = ctx.createLinearGradient(0, 0, W, 0);
        grassGrad.addColorStop(0, grassColor2);
        grassGrad.addColorStop(0.3, grassColor1);
        grassGrad.addColorStop(0.7, grassColor1);
        grassGrad.addColorStop(1, grassColor2);
        ctx.fillStyle = grassGrad;
        ctx.fillRect(0, 0, W, H);

        // Grass texture dots (parallax - move slower than road)
        var grassParallax = offsetY * 0.6;
        var grassSeed = 12345;
        function seededRand() {
            grassSeed = (grassSeed * 16807 + 0) % 2147483647;
            return (grassSeed & 0xfffffff) / 0x10000000;
        }
        grassSeed = 12345;
        ctx.globalAlpha = 0.15;
        for (var gi = 0; gi < 80; gi++) {
            var gx = seededRand() * W;
            var gy = (seededRand() * (H + 200) - 100 + grassParallax) % (H + 200);
            if (gy < -10) gy += H + 200;
            var gr = 1 + seededRand() * 2;
            ctx.fillStyle = seededRand() < 0.5
                ? (theme === 'dark' ? '#1a3a1a' : '#5a9944')
                : (theme === 'dark' ? '#0f2f0f' : '#77aa55');
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        var leftPath = [];
        var rightPath = [];

        for (var j = 0; j < road.length; j++) {
            var s = road[j];
            var sy = s.y + offsetY;
            if (sy < -50 || sy > H + 100) continue;
            leftPath.push({ x: s.x - s.hw, y: sy });
            rightPath.push({ x: s.x + s.hw, y: sy });
        }

        if (leftPath.length > 1) {
            // Fill road surface
            ctx.beginPath();
            ctx.moveTo(leftPath[0].x, leftPath[0].y);
            for (var k = 1; k < leftPath.length; k++) {
                ctx.lineTo(leftPath[k].x, leftPath[k].y);
            }
            for (var k2 = rightPath.length - 1; k2 >= 0; k2--) {
                ctx.lineTo(rightPath[k2].x, rightPath[k2].y);
            }
            ctx.closePath();
            ctx.fillStyle = roadColor;
            ctx.fill();

            // Asphalt texture overlay
            if (asphaltPattern) {
                ctx.save();
                ctx.clip(); // clip to road shape (path still active)
                ctx.fillStyle = asphaltPattern;
                ctx.globalAlpha = 0.3;
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = 1;
                ctx.restore();
            }

            // Gradient grass borders (left side)
            for (var lb = 0; lb < leftPath.length - 1; lb++) {
                var lp1 = leftPath[lb];
                var lp2 = leftPath[lb + 1];
                var borderW = 12;
                var borderGrad = ctx.createLinearGradient(lp1.x - borderW, 0, lp1.x, 0);
                borderGrad.addColorStop(0, grassColor1);
                borderGrad.addColorStop(1, roadEdgeColor);
                ctx.fillStyle = borderGrad;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(lp1.x - borderW, lp1.y);
                ctx.lineTo(lp1.x, lp1.y);
                ctx.lineTo(lp2.x, lp2.y);
                ctx.lineTo(lp2.x - borderW, lp2.y);
                ctx.closePath();
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Gradient grass borders (right side)
            for (var rb = 0; rb < rightPath.length - 1; rb++) {
                var rp1 = rightPath[rb];
                var rp2 = rightPath[rb + 1];
                var borderWR = 12;
                var borderGradR = ctx.createLinearGradient(rp1.x, 0, rp1.x + borderWR, 0);
                borderGradR.addColorStop(0, roadEdgeColor);
                borderGradR.addColorStop(1, grassColor1);
                ctx.fillStyle = borderGradR;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(rp1.x, rp1.y);
                ctx.lineTo(rp1.x + borderWR, rp1.y);
                ctx.lineTo(rp2.x + borderWR, rp2.y);
                ctx.lineTo(rp2.x, rp2.y);
                ctx.closePath();
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Road edges
            ctx.beginPath();
            ctx.moveTo(leftPath[0].x, leftPath[0].y);
            for (var le = 1; le < leftPath.length; le++) {
                ctx.lineTo(leftPath[le].x, leftPath[le].y);
            }
            ctx.strokeStyle = roadEdgeColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(rightPath[0].x, rightPath[0].y);
            for (var re = 1; re < rightPath.length; re++) {
                ctx.lineTo(rightPath[re].x, rightPath[re].y);
            }
            ctx.strokeStyle = roadEdgeColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Rumble strips
            var rumbleColor1 = theme === 'dark' ? '#cc3333' : '#cc2222';
            var rumbleColor2 = '#ffffff';
            for (var ri2 = 0; ri2 < leftPath.length; ri2 += 3) {
                var block = Math.floor(ri2 / 3);
                var c = (block % 2 === 0) ? rumbleColor1 : rumbleColor2;
                ctx.fillStyle = c;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(leftPath[ri2].x - 4, leftPath[ri2].y - 1, 8, 3);
                ctx.fillRect(rightPath[ri2].x - 4, rightPath[ri2].y - 1, 8, 3);
            }
            ctx.globalAlpha = 1;

            // Center dashed line
            ctx.beginPath();
            ctx.setLineDash([15, 15]);
            for (var cl = 0; cl < leftPath.length; cl++) {
                var cx2 = (leftPath[cl].x + rightPath[cl].x) / 2;
                var cy2 = leftPath[cl].y;
                if (cl === 0) ctx.moveTo(cx2, cy2);
                else ctx.lineTo(cx2, cy2);
            }
            ctx.strokeStyle = roadLineColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);

            // Additional lane markings (quarter lines for wider roads)
            ctx.beginPath();
            ctx.setLineDash([8, 20]);
            for (var ql = 0; ql < leftPath.length; ql++) {
                var qx = leftPath[ql].x + (rightPath[ql].x - leftPath[ql].x) * 0.25;
                var qy = leftPath[ql].y;
                if (ql === 0) ctx.moveTo(qx, qy);
                else ctx.lineTo(qx, qy);
            }
            ctx.strokeStyle = roadLineColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.stroke();

            ctx.beginPath();
            for (var ql2 = 0; ql2 < leftPath.length; ql2++) {
                var qx2 = leftPath[ql2].x + (rightPath[ql2].x - leftPath[ql2].x) * 0.75;
                var qy2 = leftPath[ql2].y;
                if (ql2 === 0) ctx.moveTo(qx2, qy2);
                else ctx.lineTo(qx2, qy2);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
    }

    function drawTireMarks(offsetY) {
        var theme = document.body.getAttribute('data-theme');
        var markColor = theme === 'dark' ? '180,180,180' : '60,60,60';

        for (var p = 0; p < players.length; p++) {
            var marks = players[p].tireMarks;
            for (var i = 0; i < marks.length; i++) {
                var m = marks[i];
                var sy = m.y + offsetY;
                ctx.fillStyle = 'rgba(' + markColor + ',' + m.alpha + ')';
                ctx.fillRect(m.x - 1.5, sy - 2, 3, 4);
            }
        }
    }

    // ── Draw boost pads ──
    function drawBoostPads(offsetY) {
        var H = canvas.height;
        for (var i = 0; i < boostPads.length; i++) {
            var bp = boostPads[i];
            var sy = bp.y + offsetY;
            if (sy < -80 || sy > H + 80) continue;

            var px = bp.x;
            var pw = BOOST_PAD_W;
            var ph = BOOST_PAD_H;
            var pulse = 0.7 + 0.3 * Math.sin(roundTimer * 5 + bp.pulse);

            // Glow underneath
            ctx.globalAlpha = 0.2 * pulse;
            ctx.beginPath();
            ctx.ellipse(px, sy, pw * 0.8, ph * 0.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#ffaa00';
            ctx.fill();
            ctx.globalAlpha = 1;

            // Pad body with gradient
            ctx.save();
            ctx.translate(px, sy);
            var padGrad = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
            padGrad.addColorStop(0, '#ffcc00');
            padGrad.addColorStop(0.5, '#ff8800');
            padGrad.addColorStop(1, '#ff6600');
            ctx.fillStyle = padGrad;
            ctx.globalAlpha = 0.8 * pulse;
            ctx.beginPath();
            ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 4);
            ctx.fill();

            // Border
            ctx.strokeStyle = '#ffee66';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6 * pulse;
            ctx.stroke();

            // Arrow pattern (chevrons pointing up)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7 * pulse;
            for (var a = 0; a < 3; a++) {
                var ay = -ph / 2 + 10 + a * 14;
                ctx.beginPath();
                ctx.moveTo(-7, ay + 6);
                ctx.lineTo(0, ay);
                ctx.lineTo(7, ay + 6);
                ctx.stroke();
            }

            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    // ── Draw oil slicks ──
    function drawOilSlicks(offsetY) {
        var H = canvas.height;
        for (var i = 0; i < oilSlicks.length; i++) {
            var oil = oilSlicks[i];
            var sy = oil.y + offsetY;
            if (sy < -60 || sy > H + 60) continue;

            var ox = oil.x;

            // Dark base circle
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.arc(ox, sy, OIL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#1a1a22';
            ctx.fill();

            // Rainbow sheen (radial gradient with low alpha)
            var rainbowGrad = ctx.createRadialGradient(
                ox - 3, sy - 3, 2,
                ox, sy, OIL_RADIUS
            );
            var phase = roundTimer * 0.5 + oil.phase;
            rainbowGrad.addColorStop(0, 'hsla(' + ((phase * 60) % 360) + ',80%,60%,0.35)');
            rainbowGrad.addColorStop(0.3, 'hsla(' + ((phase * 60 + 60) % 360) + ',70%,55%,0.25)');
            rainbowGrad.addColorStop(0.6, 'hsla(' + ((phase * 60 + 150) % 360) + ',75%,50%,0.2)');
            rainbowGrad.addColorStop(1, 'hsla(' + ((phase * 60 + 240) % 360) + ',60%,45%,0.1)');
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(ox, sy, OIL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = rainbowGrad;
            ctx.fill();

            // Subtle highlight
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.ellipse(ox - 4, sy - 4, OIL_RADIUS * 0.4, OIL_RADIUS * 0.3, -0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            ctx.globalAlpha = 1;
        }
    }

    function drawCars(offsetY) {
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            drawCar(player, offsetY);
        }
    }

    function drawCar(player, offsetY) {
        var color = getPlayerColor(player.index);
        var lightColor = getPlayerLightColor(player.index);
        var theme = document.body.getAttribute('data-theme');

        var sx = player.x;
        var sy = player.worldY + offsetY;

        if (!player.alive) {
            ctx.globalAlpha = 0.3;
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(player.angle);

        var hw = CAR_W / 2;
        var hh = CAR_H / 2;

        // Car shadow (offset and slightly larger)
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.roundRect(-hw + 2, -hh + 3, CAR_W + 1, CAR_H + 1, 5);
        ctx.fill();

        // Car body with gradient paint job
        var bodyGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
        bodyGrad.addColorStop(0, shadeColor(color, -25));
        bodyGrad.addColorStop(0.3, color);
        bodyGrad.addColorStop(0.5, shadeColor(color, 20));
        bodyGrad.addColorStop(0.7, color);
        bodyGrad.addColorStop(1, shadeColor(color, -25));
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, CAR_W, CAR_H, 5);
        ctx.fill();

        // Hood section (lighter area at front)
        var hoodGrad = ctx.createLinearGradient(0, -hh, 0, -hh + CAR_H * 0.35);
        hoodGrad.addColorStop(0, lightColor);
        hoodGrad.addColorStop(1, color);
        ctx.fillStyle = hoodGrad;
        ctx.beginPath();
        ctx.roundRect(-hw + 2, -hh + 1, CAR_W - 4, CAR_H * 0.33, [4, 4, 1, 1]);
        ctx.fill();

        // Trunk section (slightly darker at rear)
        ctx.fillStyle = shadeColor(color, -15);
        ctx.beginPath();
        ctx.roundRect(-hw + 2, hh - CAR_H * 0.25, CAR_W - 4, CAR_H * 0.23, [1, 1, 4, 4]);
        ctx.fill();

        // Windshield (front) with glass reflection
        var wsColor = theme === 'dark' ? 'rgba(80,180,240,0.55)' : 'rgba(80,140,200,0.6)';
        ctx.fillStyle = wsColor;
        ctx.beginPath();
        ctx.roundRect(-hw + 3, -hh + 4, CAR_W - 6, 10, [3, 3, 1, 1]);
        ctx.fill();
        // Glass reflection stripe
        var reflGrad = ctx.createLinearGradient(-hw + 3, -hh + 4, hw - 3, -hh + 14);
        reflGrad.addColorStop(0, 'rgba(255,255,255,0.0)');
        reflGrad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
        reflGrad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = reflGrad;
        ctx.beginPath();
        ctx.roundRect(-hw + 3, -hh + 4, CAR_W - 6, 10, [3, 3, 1, 1]);
        ctx.fill();

        // Rear window
        ctx.fillStyle = theme === 'dark' ? 'rgba(50,50,75,0.6)' : 'rgba(70,70,100,0.5)';
        ctx.beginPath();
        ctx.roundRect(-hw + 4, hh - 13, CAR_W - 8, 7, [1, 1, 2, 2]);
        ctx.fill();

        // Side mirrors (small protruding rectangles)
        ctx.fillStyle = shadeColor(color, -10);
        ctx.fillRect(-hw - 3, -hh + 8, 3, 4);
        ctx.fillRect(hw, -hh + 8, 3, 4);

        // Headlights (two bright areas at front)
        ctx.fillStyle = '#ffee88';
        ctx.beginPath();
        ctx.roundRect(-hw + 1, -hh, 5, 3, 1);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(hw - 6, -hh, 5, 3, 1);
        ctx.fill();

        // Headlight glow
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.ellipse(-hw + 3, -hh - 3, 6, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffee88';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hw - 3, -hh - 3, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = player.alive ? 1 : 0.3;

        // Taillights
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.roundRect(-hw + 1, hh - 3, 5, 3, 1);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(hw - 6, hh - 3, 5, 3, 1);
        ctx.fill();

        // Wheels with gradient rims
        drawWheel(-hw - 3, -hh + 5, 4, 9, theme);  // Front-left
        drawWheel(hw - 1, -hh + 5, 4, 9, theme);    // Front-right
        drawWheel(-hw - 3, hh - 14, 4, 9, theme);    // Rear-left
        drawWheel(hw - 1, hh - 14, 4, 9, theme);     // Rear-right

        // Roof center line (subtle highlight)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -hh + 16);
        ctx.lineTo(0, hh - 16);
        ctx.stroke();

        // Player number on roof
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText('P' + (player.index + 1), 0, 2);
        ctx.shadowBlur = 0;

        // Boost glow effect
        if (player.boostTimer > 0) {
            ctx.globalAlpha = 0.3 * (player.boostTimer / BOOST_DURATION);
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.roundRect(-hw - 2, -hh - 2, CAR_W + 4, CAR_H + 4, 6);
            ctx.fill();
            ctx.globalAlpha = player.alive ? 1 : 0.3;
        }

        // Damage red tint overlay (increases with hits)
        if (player.hits > 0 && player.alive) {
            var damageAlpha = Math.min(0.5, player.hits * 0.08);
            ctx.globalAlpha = damageAlpha;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.roundRect(-hw, -hh, CAR_W, CAR_H, 5);
            ctx.fill();
            ctx.globalAlpha = player.alive ? 1 : 0.3;
        }

        // White flash on hit
        if (player.flashTimer > 0) {
            ctx.globalAlpha = player.flashTimer / 0.15 * 0.6;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(-hw, -hh, CAR_W, CAR_H, 5);
            ctx.fill();
            ctx.globalAlpha = player.alive ? 1 : 0.3;
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // Helper: draw a wheel with gradient rim
    function drawWheel(x, y, w, h, theme) {
        // Tire
        ctx.fillStyle = theme === 'dark' ? '#0a0a0a' : '#222';
        ctx.fillRect(x, y, w, h);
        // Rim gradient
        var rimGrad = ctx.createLinearGradient(x, y + 1, x + w, y + 1);
        rimGrad.addColorStop(0, '#666');
        rimGrad.addColorStop(0.5, '#ccc');
        rimGrad.addColorStop(1, '#666');
        ctx.fillStyle = rimGrad;
        ctx.fillRect(x + 0.5, y + 2, w - 1, h - 4);
        // Hub
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Helper: shade a hex color lighter or darker
    function shadeColor(hex, amount) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
        var g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
        var b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
        return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    }

    function drawEdgeWarnings(offsetY) {
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            var ri = getRoadAt(player.worldY);
            var dx = Math.abs(player.x - ri.x);
            var danger = dx / (ri.hw - CAR_W * 0.3);

            if (danger > 0.7) {
                var alpha = (danger - 0.7) / 0.3 * 0.5;
                alpha *= 0.5 + 0.5 * Math.sin(roundTimer * 12);
                var sy = player.worldY + offsetY;

                ctx.beginPath();
                ctx.arc(player.x, sy, CAR_W + 6, 0, Math.PI * 2);
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2;
                ctx.globalAlpha = alpha;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }
    }

    // ── Game loop ──
    function gameLoop(timestamp) {
        if (!running || paused) return;

        var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        update(dt);
        drawFrame();

        animId = requestAnimationFrame(gameLoop);
    }

})();
