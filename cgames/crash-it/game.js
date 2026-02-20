/* === Crash It - Snake-Cars on a Winding Road === */
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
    var ROAD_SEGMENT_LEN = 4;       // pixels per road segment
    var ROAD_BASE_WIDTH = 180;       // starting road half-width
    var ROAD_MIN_WIDTH = 70;         // minimum road half-width
    var CAR_SPEED = 200;             // pixels/sec forward on road
    var STEER_SPEED = 180;           // pixels/sec lateral
    var HEAD_RADIUS = 10;
    var BODY_RADIUS = 7;
    var BODY_COUNT = 12;
    var BODY_SPACING = 14;           // distance between segments
    var ROAD_VISIBLE_AHEAD = 600;    // how far ahead to generate road
    var ROAD_CURVE_STRENGTH = 0.004; // max curvature per segment
    var NARROW_RATE = 0.015;         // how fast road narrows per second
    var WIN_SCORE = 2;              // first to 2 wins (best of 3)

    // ── State ──
    var mode = 0;         // 1 or 2 players
    var paused = false;
    var running = false;
    var scores = [0, 0];
    var currentRound = 0;
    var roundActive = false;

    // Road
    var road = [];        // array of {x, y, hw} where hw = half-width
    var roadDistance = 0;  // total distance generated
    var roadCurve = 0;    // current curvature
    var roadCurveTarget = 0;
    var roadCurveTimer = 0;
    var roadHalfWidth = ROAD_BASE_WIDTH;
    var cameraY = 0;      // how far up the road we've scrolled

    // Players
    var players = [];

    // Particles
    var particles = [];

    // Input
    var keys = {};
    var touchState = { p1: 0, p2: 0 }; // -1 left, 0 none, 1 right

    // Animation
    var lastTime = 0;
    var animId = null;
    var roundTimer = 0;   // elapsed time in current round

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

    // Hide P2 touch zone in 1P
    var touchZoneP2 = document.getElementById('touch-zone-p2');

    // ── Input ──
    document.addEventListener('keydown', function (e) {
        keys[e.key.toLowerCase()] = true;
        if (e.key === 'Escape' && running) togglePause();
    });
    document.addEventListener('keyup', function (e) {
        keys[e.key.toLowerCase()] = false;
    });

    // Touch
    function setupTouch(id, cb) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', function (e) { e.preventDefault(); cb(true); });
        el.addEventListener('touchend', function (e) { e.preventDefault(); cb(false); });
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

        // Starting straight section
        var cx = canvas.width / 2;
        for (var i = 0; i < 400; i++) {
            road.push({ x: cx, y: -i * ROAD_SEGMENT_LEN, hw: ROAD_BASE_WIDTH });
            roadDistance += ROAD_SEGMENT_LEN;
        }
    }

    function extendRoad(targetY) {
        // Generate road segments until we have enough ahead
        var lastSeg = road[road.length - 1];
        var lastX = lastSeg.x;
        var lastY = lastSeg.y;

        while (lastY > targetY - ROAD_VISIBLE_AHEAD) {
            // Update curve direction periodically
            roadCurveTimer -= ROAD_SEGMENT_LEN;
            if (roadCurveTimer <= 0) {
                roadCurveTarget = (Math.random() - 0.5) * 2 * ROAD_CURVE_STRENGTH;
                roadCurveTimer = 100 + Math.random() * 300;
            }

            // Smooth curve transition
            roadCurve += (roadCurveTarget - roadCurve) * 0.05;

            // Narrow the road over distance
            roadHalfWidth = Math.max(ROAD_MIN_WIDTH, ROAD_BASE_WIDTH - roadDistance * NARROW_RATE);

            lastX += roadCurve * ROAD_SEGMENT_LEN * 100;
            lastY -= ROAD_SEGMENT_LEN;
            roadDistance += ROAD_SEGMENT_LEN;

            // Clamp road center so it stays on canvas
            var margin = roadHalfWidth + 30;
            if (lastX < margin) { lastX = margin; roadCurve = Math.abs(roadCurve); }
            if (lastX > canvas.width - margin) { lastX = canvas.width - margin; roadCurve = -Math.abs(roadCurve); }

            road.push({ x: lastX, y: lastY, hw: roadHalfWidth });
        }
    }

    function pruneRoad(bottomY) {
        // Remove road segments that have scrolled below visible area
        while (road.length > 2 && road[0].y > bottomY + 200) {
            road.shift();
        }
    }

    // Get road properties at a given world Y
    function getRoadAt(worldY) {
        // Binary search for the closest segment
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

        var segs = [];
        for (var i = 0; i < BODY_COUNT + 1; i++) {
            segs.push({
                x: startX,
                y: startY + i * BODY_SPACING,
                r: i === 0 ? HEAD_RADIUS : BODY_RADIUS
            });
        }

        return {
            index: index,
            segments: segs,
            steer: 0,      // -1 left, 1 right, 0 none
            alive: true,
            speed: CAR_SPEED,
            // Track position on road in world coords
            worldY: startY
        };
    }

    // ── Particles ──
    function spawnParticles(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 50 + Math.random() * 150;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 0.5 + Math.random() * 0.5,
                r: 2 + Math.random() * 4,
                color: color
            });
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
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

        var head = player.segments[0];
        var worldY = player.worldY;
        var lookAhead = worldY - 80;
        var ri = getRoadAt(lookAhead);

        // Steer toward road center with some offset toward opponent
        var targetX = ri.x;

        // If opponent is alive, try to steer toward them
        if (opponent && opponent.alive) {
            var opHead = opponent.segments[0];
            var dx = opHead.x - head.x;
            // Ram toward opponent's head, but only if relatively close laterally
            if (Math.abs(dx) < ri.hw * 0.8) {
                targetX = opHead.x;
            }
        }

        // Add some randomness for imperfect AI
        targetX += Math.sin(roundTimer * 2.5) * 15;

        var steer = 0;
        var diff = targetX - head.x;
        if (diff < -8) steer = -1;
        else if (diff > 8) steer = 1;

        player.steer = steer;
    }

    // ── Get player input ──
    function getPlayerInput(pIndex) {
        var steer = 0;
        if (pIndex === 0) {
            // P1: A/D always
            if (keys['a']) steer -= 1;
            if (keys['d']) steer += 1;
            // In 1P mode, P1 can also use arrow keys
            if (mode === 1) {
                if (keys['arrowleft']) steer -= 1;
                if (keys['arrowright']) steer += 1;
            }
            // Touch
            if (touchState.p1 !== 0) steer = touchState.p1;
        } else {
            // P2: Arrow keys
            if (keys['arrowleft']) steer -= 1;
            if (keys['arrowright']) steer += 1;
            // Touch
            if (touchState.p2 !== 0) steer = touchState.p2;
        }
        return Math.max(-1, Math.min(1, steer));
    }

    // ── Collision detection ──
    function circlesCollide(ax, ay, ar, bx, by, br) {
        var dx = ax - bx;
        var dy = ay - by;
        var dist = Math.sqrt(dx * dx + dy * dy);
        return dist < ar + br;
    }

    function checkCollisions() {
        if (players.length < 2) return;
        var p1 = players[0];
        var p2 = players[1];

        if (!p1.alive || !p2.alive) return;

        var h1 = p1.segments[0];
        var h2 = p2.segments[0];

        // Head-to-head collision - both lose (draw, replay round)
        if (circlesCollide(h1.x, h1.y, h1.r, h2.x, h2.y, h2.r)) {
            // Both crash
            var colors = [getPlayerColor(0), getPlayerColor(1)];
            spawnParticles(h1.x, h1.y, colors[0], 20);
            spawnParticles(h2.x, h2.y, colors[1], 20);
            p1.alive = false;
            p2.alive = false;
            CGameAudio.play('hit');
            triggerShake(8, 0.4);
            endRound(-1); // draw
            return;
        }

        // P1 head hits P2 body
        for (var i = 1; i < p2.segments.length; i++) {
            var seg = p2.segments[i];
            if (circlesCollide(h1.x, h1.y, h1.r, seg.x, seg.y, seg.r)) {
                spawnParticles(h1.x, h1.y, getPlayerColor(0), 20);
                spawnParticles(seg.x, seg.y, getPlayerColor(1), 10);
                p1.alive = false;
                CGameAudio.play('hit');
                triggerShake(6, 0.3);
                endRound(1); // P2 wins round (P1 crashed into P2's body)
                return;
            }
        }

        // P2 head hits P1 body
        for (var j = 1; j < p1.segments.length; j++) {
            var seg2 = p1.segments[j];
            if (circlesCollide(h2.x, h2.y, h2.r, seg2.x, seg2.y, seg2.r)) {
                spawnParticles(h2.x, h2.y, getPlayerColor(1), 20);
                spawnParticles(seg2.x, seg2.y, getPlayerColor(0), 10);
                p2.alive = false;
                CGameAudio.play('hit');
                triggerShake(6, 0.3);
                endRound(0); // P1 wins round (P2 crashed into P1's body)
                return;
            }
        }
    }

    var edgeBounceCD = [0, 0]; // cooldown per player for bounce sound

    function checkRoadBounds() {
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            var head = player.segments[0];
            var ri = getRoadAt(player.worldY);
            var dx = Math.abs(head.x - ri.x);

            if (dx > ri.hw - HEAD_RADIUS * 0.3) {
                // Off the road!
                player.alive = false;
                spawnParticles(head.x, head.y, getPlayerColor(p), 25);
                CGameAudio.play('lose');
                triggerShake(5, 0.3);

                // Other player wins
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

        // Show/hide P2 touch zone
        if (touchZoneP2) {
            touchZoneP2.style.display = mode === 2 ? '' : 'none';
        }

        GameShell.showScreen('game-screen');
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
        players.push(createPlayer(0, -30));
        players.push(createPlayer(1, 30));

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

        // Render initial frame during countdown
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

        // winnerIndex: 0 = P1, 1 = P2, -1 = draw
        if (winnerIndex >= 0) {
            scores[winnerIndex]++;
            updateScoreHUD();
        }

        // Show round result
        var msg = '';
        if (winnerIndex === -1) {
            msg = 'Draw!';
        } else {
            msg = 'P' + (winnerIndex + 1) + ' scores!';
            CGameAudio.play('score');
        }

        // Check for match winner
        if (scores[0] >= WIN_SCORE || scores[1] >= WIN_SCORE) {
            // Delay before showing game over
            setTimeout(function () {
                showGameOver();
            }, 1200);
        } else {
            // Next round after delay
            setTimeout(function () {
                startRound();
            }, 1500);
        }

        // Show brief overlay
        roundOverlay.classList.remove('hidden');
        roundText.textContent = msg;

        // Keep rendering particles after round ends
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

        // Move both players forward
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            // Get steer input
            if (mode === 1 && p === 1) {
                updateAI(player, players[0], dt);
            } else {
                player.steer = getPlayerInput(p);
            }

            // Move head forward (up in world space) and laterally
            var head = player.segments[0];

            // Steering reduces forward speed slightly (turning friction)
            var steerPenalty = 1 - Math.abs(player.steer) * 0.15;

            player.worldY -= player.speed * steerPenalty * dt;
            head.y = player.worldY;
            head.x += player.steer * STEER_SPEED * dt;

            // Body follows head (chain/snake behavior)
            for (var i = 1; i < player.segments.length; i++) {
                var prev = player.segments[i - 1];
                var seg = player.segments[i];

                var dx = seg.x - prev.x;
                var dy = seg.y - prev.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > BODY_SPACING) {
                    var ratio = BODY_SPACING / dist;
                    seg.x = prev.x + dx * ratio;
                    seg.y = prev.y + dy * ratio;
                }
            }
        }

        // Camera follows the leading player (or average)
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

        // Extend road ahead
        extendRoad(cameraY - ROAD_VISIBLE_AHEAD);

        // Prune old road
        var bottomWorldY = cameraY + canvas.height;
        pruneRoad(bottomWorldY);

        // Speed up slightly over time
        for (var sp = 0; sp < players.length; sp++) {
            if (players[sp].alive) {
                players[sp].speed = CAR_SPEED + roundTimer * 8;
            }
        }

        // Check collisions
        checkCollisions();
        if (!roundActive) return; // round might have ended

        checkRoadBounds();
        if (!roundActive) return;

        // Update particles
        updateParticles(dt);
    }

    // Screen shake
    var shakeTimer = 0;
    var shakeIntensity = 0;

    function triggerShake(intensity, duration) {
        shakeIntensity = intensity;
        shakeTimer = duration;
    }

    // ── Draw ──
    function drawFrame() {
        var W = canvas.width;
        var H = canvas.height;

        // Background
        var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        // Apply screen shake
        var shakeX = 0, shakeY = 0;
        if (shakeTimer > 0) {
            shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
            shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
            shakeTimer -= 1 / 60;
            shakeIntensity *= 0.95;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // World-to-screen offset
        var offsetY = -cameraY + H * 0.65; // camera position: player is in lower portion

        // Draw road
        drawRoad(offsetY, W, H);

        // Draw players
        for (var p = 0; p < players.length; p++) {
            drawPlayer(players[p], offsetY);
        }

        // Draw particles
        drawParticles(offsetY);

        // Draw road edge indicators if near edge
        drawEdgeWarnings(offsetY);

        ctx.restore();
    }

    function drawRoad(offsetY, W, H) {
        if (road.length < 2) return;

        var theme = document.body.getAttribute('data-theme');

        // Road fill color
        var roadColor = theme === 'dark' ? '#2a2a3e' : '#888899';
        var roadEdgeColor = theme === 'dark' ? '#444466' : '#666677';
        var roadLineColor = theme === 'dark' ? '#3a3a55' : '#aaaabb';
        var grassColor = theme === 'dark' ? '#0a1a0a' : '#88bb66';

        // Draw grass background
        ctx.fillStyle = grassColor;
        ctx.fillRect(0, 0, W, H);

        // Build visible road edge paths
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

            // Road edges (solid lines)
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

            // Rumble strips along edges (alternating colored blocks)
            var rumbleColor1 = theme === 'dark' ? '#cc3333' : '#cc2222';
            var rumbleColor2 = '#ffffff';
            var rumbleSize = 8;
            for (var ri2 = 0; ri2 < leftPath.length; ri2 += 3) {
                var block = Math.floor(ri2 / 3);
                var c = (block % 2 === 0) ? rumbleColor1 : rumbleColor2;
                ctx.fillStyle = c;
                ctx.globalAlpha = 0.6;
                // Left rumble
                ctx.fillRect(leftPath[ri2].x - 4, leftPath[ri2].y - 1, rumbleSize, 3);
                // Right rumble
                ctx.fillRect(rightPath[ri2].x - 4, rightPath[ri2].y - 1, rumbleSize, 3);
            }
            ctx.globalAlpha = 1;

            // Center dashed line
            ctx.beginPath();
            ctx.setLineDash([15, 15]);
            for (var cl = 0; cl < leftPath.length; cl++) {
                var cx = (leftPath[cl].x + rightPath[cl].x) / 2;
                var cy = leftPath[cl].y;
                if (cl === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = roadLineColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function drawPlayer(player, offsetY) {
        var color = getPlayerColor(player.index);
        var lightColor = getPlayerLightColor(player.index);

        // Draw body segments (back to front)
        for (var i = player.segments.length - 1; i >= 1; i--) {
            var seg = player.segments[i];
            var screenY = seg.y + offsetY;
            var alpha = player.alive ? 1 : 0.4;

            ctx.globalAlpha = alpha;

            // Body glow
            ctx.beginPath();
            ctx.arc(seg.x, screenY, seg.r + 2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha * 0.3;
            ctx.fill();

            // Body segment
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(seg.x, screenY, seg.r, 0, Math.PI * 2);
            ctx.fillStyle = lightColor;
            ctx.fill();

            // Connector line to previous
            if (i > 0) {
                var prev = player.segments[i - 1];
                ctx.beginPath();
                ctx.moveTo(seg.x, screenY);
                ctx.lineTo(prev.x, prev.y + offsetY);
                ctx.strokeStyle = color;
                ctx.lineWidth = BODY_RADIUS * 1.2;
                ctx.lineCap = 'round';
                ctx.globalAlpha = alpha * 0.5;
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;

        // Draw head
        var head = player.segments[0];
        var headScreenY = head.y + offsetY;

        if (!player.alive) ctx.globalAlpha = 0.4;

        // Head glow
        ctx.beginPath();
        ctx.arc(head.x, headScreenY, HEAD_RADIUS + 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = (player.alive ? 1 : 0.4) * 0.3;
        ctx.fill();

        // Head fill
        ctx.globalAlpha = player.alive ? 1 : 0.4;
        ctx.beginPath();
        ctx.arc(head.x, headScreenY, HEAD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Head highlight (white dot)
        ctx.beginPath();
        ctx.arc(head.x - 2, headScreenY - 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = (player.alive ? 1 : 0.4) * 0.6;
        ctx.fill();

        // Eyes on the head (direction-facing)
        ctx.globalAlpha = player.alive ? 1 : 0.3;
        var eyeOffset = player.steer * 2;
        // Left eye
        ctx.beginPath();
        ctx.arc(head.x - 3 + eyeOffset, headScreenY - 2, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x - 3 + eyeOffset + player.steer, headScreenY - 2, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();

        // Right eye
        ctx.beginPath();
        ctx.arc(head.x + 3 + eyeOffset, headScreenY - 2, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x + 3 + eyeOffset + player.steer, headScreenY - 2, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    function drawEdgeWarnings(offsetY) {
        // Flash warning if player is near road edge
        for (var p = 0; p < players.length; p++) {
            var player = players[p];
            if (!player.alive) continue;

            var head = player.segments[0];
            var ri = getRoadAt(player.worldY);
            var dx = Math.abs(head.x - ri.x);
            var danger = dx / (ri.hw - HEAD_RADIUS);

            if (danger > 0.7) {
                var alpha = (danger - 0.7) / 0.3 * 0.4;
                alpha *= 0.5 + 0.5 * Math.sin(roundTimer * 12);
                var headScreenY = head.y + offsetY;

                ctx.beginPath();
                ctx.arc(head.x, headScreenY, HEAD_RADIUS + 8, 0, Math.PI * 2);
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
