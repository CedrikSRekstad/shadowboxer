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
    var CAR_W = 20;
    var CAR_H = 36;
    var ROAD_VISIBLE_AHEAD = 600;
    var ROAD_CURVE_STRENGTH = 0.004;
    var NARROW_RATE = 0.012;
    var WIN_SCORE = 2;
    var BUMP_FORCE = 280;
    var BUMP_COOLDOWN = 0.3;
    var SPEED_UP_RATE = 10;

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
        }
    }

    function pruneRoad(bottomY) {
        while (road.length > 2 && road[0].y > bottomY + 200) {
            road.shift();
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
            spinDir: 0
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

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles(offsetY) {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y + offsetY, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
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

            // Sparks at collision point
            var cx = (p1.x + p2.x) / 2;
            var cy = (p1.worldY + p2.worldY) / 2;
            spawnSparks(cx, cy, 15);

            CGameAudio.play('hit');
            triggerShake(6, 0.25);
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

        if (particles.length > 0) {
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

            // Move forward
            player.worldY -= player.speed * steerPenalty * dt;
            player.y = player.worldY;

            // Lateral movement from steering
            player.x += player.steer * STEER_SPEED * dt;

            // Apply bump velocity (decays over time)
            player.x += player.vx * dt;
            player.vx *= Math.pow(0.04, dt); // fast decay

            // Bump cooldown
            if (player.bumpCooldown > 0) player.bumpCooldown -= dt;

            // Spin effect (visual only)
            if (player.spinTimer > 0) {
                player.spinTimer -= dt;
                player.angle = player.spinDir * player.spinTimer * 3;
            } else {
                // Natural lean into turns
                player.angle = player.steer * 0.15;
            }

            // Tire marks when bumped hard
            if (Math.abs(player.vx) > 100) {
                player.tireMarks.push({ x: player.x - 6, y: player.worldY + CAR_H / 2, alpha: 0.5 });
                player.tireMarks.push({ x: player.x + 6, y: player.worldY + CAR_H / 2, alpha: 0.5 });
            }
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
        var grassColor = theme === 'dark' ? '#0a1a0a' : '#88bb66';

        ctx.fillStyle = grassColor;
        ctx.fillRect(0, 0, W, H);

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
            // Fill road
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

        // Car shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.roundRect(-hw + 2, -hh + 3, CAR_W, CAR_H, 4);
        ctx.fill();

        // Car body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, CAR_W, CAR_H, 4);
        ctx.fill();

        // Car body highlight (lighter center stripe)
        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.roundRect(-hw + 3, -hh + 2, CAR_W - 6, CAR_H - 4, 3);
        ctx.fill();

        // Windshield (front)
        var wsColor = theme === 'dark' ? 'rgba(100,200,255,0.4)' : 'rgba(100,150,200,0.5)';
        ctx.fillStyle = wsColor;
        ctx.beginPath();
        ctx.roundRect(-hw + 3, -hh + 3, CAR_W - 6, 8, [3, 3, 0, 0]);
        ctx.fill();

        // Rear window
        ctx.fillStyle = theme === 'dark' ? 'rgba(60,60,80,0.5)' : 'rgba(80,80,100,0.4)';
        ctx.beginPath();
        ctx.roundRect(-hw + 4, hh - 10, CAR_W - 8, 6, [0, 0, 2, 2]);
        ctx.fill();

        // Headlights (two small bright dots at front)
        ctx.fillStyle = '#ffee88';
        ctx.fillRect(-hw + 2, -hh, 4, 3);
        ctx.fillRect(hw - 6, -hh, 4, 3);

        // Taillights
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(-hw + 2, hh - 3, 4, 3);
        ctx.fillRect(hw - 6, hh - 3, 4, 3);

        // Wheels (4 small dark rectangles)
        ctx.fillStyle = theme === 'dark' ? '#111' : '#333';
        // Front-left
        ctx.fillRect(-hw - 2, -hh + 4, 3, 8);
        // Front-right
        ctx.fillRect(hw - 1, -hh + 4, 3, 8);
        // Rear-left
        ctx.fillRect(-hw - 2, hh - 12, 3, 8);
        // Rear-right
        ctx.fillRect(hw - 1, hh - 12, 3, 8);

        // Player number on roof
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P' + (player.index + 1), 0, 2);

        ctx.restore();
        ctx.globalAlpha = 1;
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
