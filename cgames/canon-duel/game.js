/* === Canon Duel - game.js === */
(function () {
    'use strict';

    // ── Constants ──
    var W = 900, H = 520;
    var GRAVITY = 350;
    var MAX_POWER = 600;
    var POWER_CHARGE_RATE = 400;
    var AIM_SPEED = 1.2;       // radians per second
    var PROJECTILE_R = 4;
    var EXPLOSION_R = 32;
    var CANNON_W = 28, CANNON_H = 18;
    var BARREL_LEN = 26, BARREL_W = 6;
    var HP_MAX = 100;
    var HIT_DAMAGE = 25;
    var TRAIL_MAX = 40;
    var PREVIEW_DOTS = 50;
    var WIND_MAX = 80;

    // ── State ──
    var canvas, ctx;
    var mode = '1p'; // '1p' or '2p'
    var paused = false;
    var gameState = 'idle'; // idle, aiming, charging, firing, exploding, aiTurn, gameOver
    var currentPlayer = 0; // 0 = P1, 1 = P2
    var wind = 0;

    var terrain = []; // heightmap: terrain[x] = ground Y from top
    var players = [];
    var projectile = null;
    var particles = [];
    var trailPoints = [];
    var turnTransitionTimer = 0;

    // Input
    var keys = {};
    var touchState = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, playerIdx: -1 };

    // AI
    var aiTimer = 0;
    var aiPhase = ''; // 'thinking', 'aiming', 'charging'
    var aiTargetAngle = 0;
    var aiTargetPower = 0;
    var aiChargeTime = 0;

    // ── Initialization ──
    GameShell.init({ backUrl: '../' });

    // Button bindings
    document.getElementById('btn-1p').addEventListener('click', function () {
        CGameAudio.play('select');
        mode = '1p';
        startGame();
    });
    document.getElementById('btn-2p').addEventListener('click', function () {
        CGameAudio.play('select');
        mode = '2p';
        startGame();
    });
    document.getElementById('btn-pause').addEventListener('click', function () {
        CGameAudio.play('click');
        togglePause();
    });
    document.getElementById('btn-resume').addEventListener('click', function () {
        CGameAudio.play('click');
        togglePause();
    });
    document.getElementById('btn-quit').addEventListener('click', function () {
        CGameAudio.play('back');
        paused = false;
        document.getElementById('pause-overlay').classList.add('hidden');
        GameShell.showScreen('title-screen');
    });
    document.getElementById('btn-play-again').addEventListener('click', function () {
        CGameAudio.play('select');
        startGame();
    });
    document.getElementById('btn-menu').addEventListener('click', function () {
        CGameAudio.play('back');
        GameShell.showScreen('title-screen');
    });

    // Canvas setup
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;

    // ── Input handlers ──
    document.addEventListener('keydown', function (e) {
        keys[e.code] = true;
        if (e.code === 'Escape') {
            if (gameState !== 'gameOver') togglePause();
        }
        // Prevent scrolling
        if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter'].indexOf(e.code) >= 0) {
            e.preventDefault();
        }
    });
    document.addEventListener('keyup', function (e) {
        keys[e.code] = false;
        // Release to fire
        if (gameState === 'charging') {
            if (currentPlayer === 0 && e.code === 'Space') {
                fireProjectile();
            }
            if (currentPlayer === 1 && e.code === 'Enter' && mode === '2p') {
                fireProjectile();
            }
        }
    });

    // Touch controls
    canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (gameState !== 'aiming' && gameState !== 'charging') return;
        var touch = e.touches[0];
        var rect = canvas.getBoundingClientRect();
        var sx = (touch.clientX - rect.left) * (W / rect.width);
        var sy = (touch.clientY - rect.top) * (H / rect.height);
        touchState.active = true;
        touchState.startX = sx;
        touchState.startY = sy;
        touchState.curX = sx;
        touchState.curY = sy;
        touchState.playerIdx = currentPlayer;
    });
    canvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        if (!touchState.active) return;
        var touch = e.touches[0];
        var rect = canvas.getBoundingClientRect();
        touchState.curX = (touch.clientX - rect.left) * (W / rect.width);
        touchState.curY = (touch.clientY - rect.top) * (H / rect.height);
    });
    canvas.addEventListener('touchend', function (e) {
        e.preventDefault();
        if (!touchState.active) return;
        touchState.active = false;
        if (gameState === 'aiming' || gameState === 'charging') {
            // Calculate angle and power from drag
            var p = players[currentPlayer];
            var dx = touchState.curX - touchState.startX;
            var dy = touchState.curY - touchState.startY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 10) {
                // Aim towards touch drag direction (away from drag for slingshot feel)
                var angle = Math.atan2(-dy, currentPlayer === 0 ? dx : -dx);
                p.angle = clamp(angle, 0.1, Math.PI / 2 - 0.05);
                p.power = clamp(dist / 200 * MAX_POWER, 80, MAX_POWER);
                fireProjectile();
            }
        }
    });

    // Resize handler
    function resizeCanvas() {
        var container = document.getElementById('canvas-container');
        if (!container) return;
        var cw = container.clientWidth;
        var ch = container.clientHeight;
        var scale = Math.min(cw / W, ch / H);
        canvas.style.width = (W * scale) + 'px';
        canvas.style.height = (H * scale) + 'px';
    }
    window.addEventListener('resize', resizeCanvas);

    // ── Terrain generation ──
    function generateTerrain() {
        terrain = new Array(W);
        var baseH = H * 0.55;
        // Generate using several sine waves for hilly terrain
        var freq1 = 0.005 + Math.random() * 0.005;
        var freq2 = 0.012 + Math.random() * 0.008;
        var freq3 = 0.025 + Math.random() * 0.01;
        var amp1 = 40 + Math.random() * 40;
        var amp2 = 20 + Math.random() * 20;
        var amp3 = 8 + Math.random() * 8;
        var phase1 = Math.random() * Math.PI * 2;
        var phase2 = Math.random() * Math.PI * 2;
        var phase3 = Math.random() * Math.PI * 2;

        for (var x = 0; x < W; x++) {
            var h = baseH;
            h += Math.sin(x * freq1 + phase1) * amp1;
            h += Math.sin(x * freq2 + phase2) * amp2;
            h += Math.sin(x * freq3 + phase3) * amp3;

            // Create a valley/flat area in the middle third
            var midFactor = 1 - Math.pow(Math.max(0, 1 - Math.abs(x - W / 2) / (W * 0.2)), 2) * 0.3;
            h *= midFactor;

            // Ensure edges are reasonable for cannon placement
            var edgeDist = Math.min(x, W - 1 - x);
            if (edgeDist < 60) {
                var edgeFactor = edgeDist / 60;
                h = h * edgeFactor + baseH * (1 - edgeFactor);
            }

            terrain[x] = Math.floor(clamp(h, H * 0.25, H * 0.8));
        }
    }

    function destroyTerrain(cx, cy, radius) {
        var r2 = radius * radius;
        for (var x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, Math.ceil(cx + radius)); x++) {
            var dx = x - cx;
            // How deep does the circle cut at this x?
            var maxDy = Math.sqrt(Math.max(0, r2 - dx * dx));
            var cutTop = cy - maxDy;
            var cutBot = cy + maxDy;
            // If the terrain surface is within the explosion circle, push it down
            if (terrain[x] < cutBot && terrain[x] > cutTop) {
                terrain[x] = Math.min(H + 10, Math.floor(cutBot));
            }
            // If terrain is above the explosion, and the explosion bottom is below terrain, carve it
            if (terrain[x] <= cutTop && cutBot > terrain[x]) {
                // Only affect if explosion center is near terrain level
                if (cy > terrain[x] - radius) {
                    terrain[x] = Math.min(H + 10, Math.floor(cutBot));
                }
            }
        }
    }

    // ── Player setup ──
    function createPlayers() {
        var p1x = 50 + Math.floor(Math.random() * 30);
        var p2x = W - 50 - Math.floor(Math.random() * 30);
        players = [
            {
                x: p1x,
                y: terrain[p1x] - CANNON_H / 2,
                angle: Math.PI / 4,
                power: MAX_POWER * 0.5,
                hp: HP_MAX,
                color: getComputedStyle(document.documentElement).getPropertyValue('--p1-color').trim() || '#00b4ff',
                lightColor: getComputedStyle(document.documentElement).getPropertyValue('--p1-light').trim() || '#42d4ff',
                name: 'P1',
                dir: 1 // faces right
            },
            {
                x: p2x,
                y: terrain[p2x] - CANNON_H / 2,
                angle: Math.PI / 4,
                power: MAX_POWER * 0.5,
                hp: HP_MAX,
                color: getComputedStyle(document.documentElement).getPropertyValue('--p2-color').trim() || '#ff4466',
                lightColor: getComputedStyle(document.documentElement).getPropertyValue('--p2-light').trim() || '#ff7799',
                name: 'P2',
                dir: -1 // faces left
            }
        ];
    }

    // ── Game flow ──
    function startGame() {
        generateTerrain();
        createPlayers();
        wind = (Math.random() * 2 - 1) * WIND_MAX;
        currentPlayer = 0;
        projectile = null;
        particles = [];
        trailPoints = [];
        gameState = 'aiming';
        paused = false;
        turnTransitionTimer = 0;
        document.getElementById('pause-overlay').classList.add('hidden');
        updateTurnIndicator();
        GameShell.showScreen('game-screen');
        resizeCanvas();
    }

    function togglePause() {
        paused = !paused;
        document.getElementById('pause-overlay').classList.toggle('hidden', !paused);
    }

    function updateTurnIndicator() {
        var el = document.getElementById('turn-indicator');
        if (currentPlayer === 0) {
            el.textContent = "P1's Turn";
            el.className = 'turn-indicator p1-turn';
        } else {
            el.textContent = mode === '1p' ? "AI's Turn" : "P2's Turn";
            el.className = 'turn-indicator p2-turn';
        }
    }

    function nextTurn() {
        currentPlayer = 1 - currentPlayer;
        wind += (Math.random() * 2 - 1) * 20;
        wind = clamp(wind, -WIND_MAX, WIND_MAX);
        updateTurnIndicator();
        trailPoints = [];

        // Update cannon Y positions (terrain may have changed)
        for (var i = 0; i < 2; i++) {
            players[i].y = terrain[Math.floor(clamp(players[i].x, 0, W - 1))] - CANNON_H / 2;
        }

        if (mode === '1p' && currentPlayer === 1) {
            gameState = 'aiTurn';
            aiPhase = 'thinking';
            aiTimer = 0.5 + Math.random() * 0.5;
        } else {
            gameState = 'aiming';
        }
    }

    function fireProjectile() {
        var p = players[currentPlayer];
        var cosA = Math.cos(p.angle);
        var sinA = Math.sin(p.angle);
        var dir = p.dir;
        var barrelEndX = p.x + dir * cosA * BARREL_LEN;
        var barrelEndY = p.y - sinA * BARREL_LEN;

        projectile = {
            x: barrelEndX,
            y: barrelEndY,
            vx: dir * cosA * p.power,
            vy: -sinA * p.power,
            owner: currentPlayer
        };
        trailPoints = [];
        gameState = 'firing';
        CGameAudio.play('whoosh');
    }

    function checkProjectileCollision() {
        if (!projectile) return false;
        var px = Math.floor(projectile.x);
        var py = Math.floor(projectile.y);

        // Out of bounds
        if (px < -50 || px > W + 50 || py > H + 50) {
            return 'miss';
        }

        // Terrain collision
        if (px >= 0 && px < W && py >= terrain[px]) {
            return 'terrain';
        }

        // Player collision
        for (var i = 0; i < 2; i++) {
            if (i === projectile.owner) continue;
            var p = players[i];
            var hw = CANNON_W / 2 + 6;
            var hh = CANNON_H / 2 + 6;
            if (projectile.x > p.x - hw && projectile.x < p.x + hw &&
                projectile.y > p.y - hh && projectile.y < p.y + hh) {
                return 'hit_' + i;
            }
        }

        return false;
    }

    function createExplosion(x, y, big) {
        var count = big ? 40 : 20;
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 30 + Math.random() * 120;
            var life = 0.4 + Math.random() * 0.6;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: life,
                maxLife: life,
                r: 2 + Math.random() * 3,
                color: big ?
                    (Math.random() > 0.5 ? '#ff6633' : '#ffcc00') :
                    (Math.random() > 0.5 ? '#aa8855' : '#887744')
            });
        }
    }

    function handleImpact(result) {
        gameState = 'exploding';
        var ex = projectile.x;
        var ey = projectile.y;

        if (result.indexOf('hit_') === 0) {
            var hitIdx = parseInt(result.charAt(4));
            players[hitIdx].hp = Math.max(0, players[hitIdx].hp - HIT_DAMAGE);
            createExplosion(ex, ey, true);
            destroyTerrain(ex, ey, EXPLOSION_R * 1.2);
            CGameAudio.play('hit');
            CGameAudio.play('score');

            if (players[hitIdx].hp <= 0) {
                // Game over
                setTimeout(function () {
                    endGame(1 - hitIdx);
                }, 1200);
                projectile = null;
                return;
            }
        } else if (result === 'terrain') {
            createExplosion(ex, ey, false);
            destroyTerrain(ex, ey, EXPLOSION_R);
            CGameAudio.play('hit');
        } else {
            // miss - no explosion for off-screen shots
        }

        projectile = null;

        // Delay then switch turn
        turnTransitionTimer = 1.0;
    }

    function endGame(winnerIdx) {
        gameState = 'gameOver';
        var winner = players[winnerIdx];
        var isP1Winner = winnerIdx === 0;

        var winnerName;
        if (mode === '1p') {
            winnerName = isP1Winner ? 'You Win!' : 'AI Wins!';
        } else {
            winnerName = 'Player ' + (winnerIdx + 1) + ' Wins!';
        }

        document.getElementById('winner-text').textContent = winnerName;
        document.getElementById('winner-text').style.color = winner.color;
        document.getElementById('final-score').textContent =
            winner.name + ': ' + winner.hp + ' HP remaining';

        if (isP1Winner || mode === '2p') {
            CGameAudio.play('win');
        } else {
            CGameAudio.play('lose');
        }

        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 800);
    }

    // ── AI Logic ──
    function updateAI(dt) {
        if (aiPhase === 'thinking') {
            aiTimer -= dt;
            if (aiTimer <= 0) {
                // Calculate target angle and power using simulation
                var ai = players[1];
                var target = players[0];
                var dx = target.x - ai.x; // negative since AI is on right
                var dist = Math.abs(dx);
                var dy = target.y - ai.y;

                // Use a fixed angle and solve for power, then adjust
                // Start with 45 degrees and a reasonable power guess
                var bestAngle = Math.PI / 4;
                var bestPower = MAX_POWER * 0.5;
                var bestDist = Infinity;

                // Try several angle/power combos via simulation
                for (var tryA = 0; tryA < 8; tryA++) {
                    var testAngle = 0.2 + tryA * 0.15;
                    // Estimate power needed: range ~ v^2 * sin(2a) / g
                    // v = sqrt(range * g / sin(2a))
                    var sin2a = Math.sin(2 * testAngle);
                    if (sin2a < 0.1) continue;
                    var testPower = Math.sqrt(dist * GRAVITY / sin2a);
                    // Adjust for height difference
                    testPower += dy * 0.5;
                    // Adjust for wind (AI faces left, wind positive = headwind for leftward shot)
                    testPower += wind * dist * 0.001;
                    testPower = clamp(testPower, 120, MAX_POWER);

                    // Simulate trajectory
                    var sx = ai.x, sy = ai.y;
                    var svx = ai.dir * Math.cos(testAngle) * testPower;
                    var svy = -Math.sin(testAngle) * testPower;
                    var simDt = 0.016;
                    var landed = false;
                    for (var step = 0; step < 300; step++) {
                        sx += svx * simDt;
                        sy += svy * simDt;
                        svy += GRAVITY * simDt;
                        svx += wind * simDt;
                        if (sy > H + 20 || sx < -20 || sx > W + 20) break;
                        var tix = Math.floor(clamp(sx, 0, W - 1));
                        if (sy >= terrain[tix]) { landed = true; break; }
                        // Check near target
                        var tdx = sx - target.x;
                        var tdy = sy - target.y;
                        if (Math.abs(tdx) < 20 && Math.abs(tdy) < 20) {
                            var d = Math.sqrt(tdx * tdx + tdy * tdy);
                            if (d < bestDist) {
                                bestDist = d;
                                bestAngle = testAngle;
                                bestPower = testPower;
                            }
                            landed = true;
                            break;
                        }
                    }
                    if (landed) {
                        var fdx = sx - target.x;
                        var fdy = sy - target.y;
                        var fd = Math.sqrt(fdx * fdx + fdy * fdy);
                        if (fd < bestDist) {
                            bestDist = fd;
                            bestAngle = testAngle;
                            bestPower = testPower;
                        }
                    }
                }

                // Add random error for fun
                var errorMag = 0.08 + Math.random() * 0.12;
                bestAngle += (Math.random() * 2 - 1) * errorMag;
                bestPower += (Math.random() * 2 - 1) * bestPower * 0.1;

                aiTargetAngle = clamp(bestAngle, 0.15, Math.PI / 2 - 0.05);
                aiTargetPower = clamp(bestPower, 120, MAX_POWER);

                aiPhase = 'aiming';
                aiTimer = 0.4 + Math.random() * 0.4;
            }
            return;
        }

        if (aiPhase === 'aiming') {
            // Smoothly move to target angle
            var diff = aiTargetAngle - players[1].angle;
            var step = AIM_SPEED * 1.5 * dt;
            if (Math.abs(diff) < step) {
                players[1].angle = aiTargetAngle;
                aiTimer -= dt;
                if (aiTimer <= 0) {
                    aiPhase = 'charging';
                    players[1].power = 0;
                    aiChargeTime = aiTargetPower / POWER_CHARGE_RATE;
                    aiTimer = 0;
                }
            } else {
                players[1].angle += Math.sign(diff) * step;
            }
            return;
        }

        if (aiPhase === 'charging') {
            players[1].power += POWER_CHARGE_RATE * dt;
            aiTimer += dt;
            if (aiTimer >= aiChargeTime || players[1].power >= aiTargetPower) {
                players[1].power = clamp(players[1].power, 80, MAX_POWER);
                fireProjectile();
                aiPhase = '';
            }
        }
    }

    // ── Update ──
    function update(dt) {
        if (paused || gameState === 'gameOver') return;

        // Update particles
        for (var i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vy += GRAVITY * 0.5 * dt;
            pt.life -= dt;
            if (pt.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Transition timer
        if (turnTransitionTimer > 0) {
            turnTransitionTimer -= dt;
            if (turnTransitionTimer <= 0 && gameState === 'exploding') {
                nextTurn();
            }
            return;
        }

        // Aiming
        if (gameState === 'aiming') {
            var p = players[currentPlayer];
            if (currentPlayer === 0) {
                if (keys['KeyW']) p.angle = Math.min(p.angle + AIM_SPEED * dt, Math.PI / 2 - 0.05);
                if (keys['KeyS']) p.angle = Math.max(p.angle - AIM_SPEED * dt, 0.1);
                if (keys['Space']) {
                    gameState = 'charging';
                    p.power = 0;
                }
            } else if (mode === '2p') {
                if (keys['ArrowUp']) p.angle = Math.min(p.angle + AIM_SPEED * dt, Math.PI / 2 - 0.05);
                if (keys['ArrowDown']) p.angle = Math.max(p.angle - AIM_SPEED * dt, 0.1);
                if (keys['Enter']) {
                    gameState = 'charging';
                    p.power = 0;
                }
            }
        }

        // Charging
        if (gameState === 'charging') {
            var p2 = players[currentPlayer];
            p2.power += POWER_CHARGE_RATE * dt;
            if (p2.power >= MAX_POWER) {
                p2.power = MAX_POWER;
                fireProjectile();
            }
        }

        // AI
        if (gameState === 'aiTurn') {
            updateAI(dt);
        }

        // Projectile physics
        if (gameState === 'firing' && projectile) {
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
            projectile.vy += GRAVITY * dt;
            projectile.vx += wind * dt;

            // Trail
            trailPoints.push({ x: projectile.x, y: projectile.y });
            if (trailPoints.length > TRAIL_MAX) trailPoints.shift();

            // Check collision
            var result = checkProjectileCollision();
            if (result) {
                handleImpact(result);
            }
        }
    }

    // ── Drawing ──
    function draw() {
        ctx.clearRect(0, 0, W, H);

        if (gameState === 'idle' || players.length === 0) return;

        drawSky();
        drawTerrain();
        drawWind();
        drawPlayers();
        drawHealthBars();

        if (gameState === 'aiming' || gameState === 'charging') {
            drawAngleIndicator();
            drawAimPreview();
            drawPowerBar();
        }
        if (gameState === 'aiTurn') {
            drawPowerBar();
        }

        if (gameState === 'aiming') {
            drawControlHint();
        }

        drawTrail();
        drawProjectile();
        drawParticles();
    }

    function drawControlHint() {
        var hint;
        if (currentPlayer === 0) {
            hint = 'W/S: Aim  |  Hold SPACE: Charge & Fire';
        } else {
            hint = 'Up/Down: Aim  |  Hold ENTER: Charge & Fire';
        }
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRect(W / 2 - 140, H - 28, 280, 22, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hint, W / 2, H - 17);
    }

    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        var theme = document.body.getAttribute('data-theme');
        if (theme === 'light') {
            grad.addColorStop(0, '#87CEEB');
            grad.addColorStop(0.6, '#c8e6f5');
            grad.addColorStop(1, '#e8f0e0');
        } else {
            grad.addColorStop(0, '#0a0a2e');
            grad.addColorStop(0.4, '#1a1a4e');
            grad.addColorStop(0.8, '#2a1a3e');
            grad.addColorStop(1, '#1a2a1e');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    function drawTerrain() {
        // Fill terrain
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (var x = 0; x < W; x++) {
            ctx.lineTo(x, terrain[x]);
        }
        ctx.lineTo(W, H);
        ctx.closePath();

        // Gradient fill
        var theme = document.body.getAttribute('data-theme');
        var grad = ctx.createLinearGradient(0, H * 0.3, 0, H);
        if (theme === 'light') {
            grad.addColorStop(0, '#4a9e3f');
            grad.addColorStop(0.4, '#3d8b35');
            grad.addColorStop(1, '#7a5c3a');
        } else {
            grad.addColorStop(0, '#2d6b2d');
            grad.addColorStop(0.4, '#1f4f1f');
            grad.addColorStop(1, '#4a3520');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        // Top edge highlight
        ctx.beginPath();
        ctx.moveTo(0, terrain[0]);
        for (var x2 = 1; x2 < W; x2++) {
            ctx.lineTo(x2, terrain[x2]);
        }
        ctx.strokeStyle = theme === 'light' ? '#5cb85c' : '#3a8a3a';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawWind() {
        var cx = W / 2;
        var cy = 20;
        var arrowLen = Math.abs(wind) / WIND_MAX * 60;
        var dir = wind > 0 ? 1 : -1;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(cx - 55, cy - 12, 110, 24, 6);
        ctx.fill();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (Math.abs(wind) < 5) {
            ctx.fillText('WIND: CALM', cx, cy);
        } else {
            // Arrow
            var startX = cx - dir * arrowLen / 2;
            var endX = cx + dir * arrowLen / 2;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, cy);
            ctx.lineTo(endX, cy);
            // Arrowhead
            ctx.lineTo(endX - dir * 8, cy - 5);
            ctx.moveTo(endX, cy);
            ctx.lineTo(endX - dir * 8, cy + 5);
            ctx.stroke();

            // Wind strength text
            var strength = Math.abs(wind) < 30 ? 'Light' : Math.abs(wind) < 60 ? 'Medium' : 'Strong';
            ctx.fillText('WIND: ' + strength, cx, cy + 16);
        }
    }

    function drawPlayers() {
        for (var i = 0; i < 2; i++) {
            var p = players[i];
            var px = p.x;
            var py = p.y;

            // Cannon base (rectangle)
            ctx.fillStyle = p.color;
            ctx.fillRect(px - CANNON_W / 2, py - CANNON_H / 2, CANNON_W, CANNON_H);

            // Darker bottom half
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(px - CANNON_W / 2, py, CANNON_W, CANNON_H / 2);

            // Barrel
            ctx.save();
            ctx.translate(px, py);
            var cosA = Math.cos(p.angle);
            var sinA = Math.sin(p.angle);
            var bex = p.dir * cosA * BARREL_LEN;
            var bey = -sinA * BARREL_LEN;
            ctx.lineCap = 'round';

            // Barrel outline (drawn first, thicker)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(bex, bey);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = BARREL_W + 2;
            ctx.stroke();

            // Barrel fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(bex, bey);
            ctx.strokeStyle = p.lightColor;
            ctx.lineWidth = BARREL_W;
            ctx.stroke();

            ctx.restore();

            // Wheels
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(px - 8, py + CANNON_H / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px + 8, py + CANNON_H / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.arc(px - 8, py + CANNON_H / 2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px + 8, py + CANNON_H / 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawHealthBars() {
        for (var i = 0; i < 2; i++) {
            var p = players[i];
            var bw = 50;
            var bh = 6;
            var bx = p.x - bw / 2;
            var by = p.y - CANNON_H / 2 - 18;

            // Name label
            ctx.fillStyle = p.color;
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            var label = (mode === '1p' && i === 1) ? 'AI' : p.name;
            ctx.fillText(label, p.x, by - 2);

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            roundRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
            ctx.fill();

            // HP bar
            var hpFrac = p.hp / HP_MAX;
            var hpW = bw * hpFrac;
            if (hpW > 1) {
                var barColor = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.25 ? '#fbbf24' : '#ef4444';
                ctx.fillStyle = barColor;
                roundRect(bx, by, hpW, bh, 2);
                ctx.fill();
            }

            // HP text
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.hp + '', p.x, by + bh / 2);
        }
    }

    function drawAngleIndicator() {
        var p = players[currentPlayer];
        var deg = Math.round(p.angle * 180 / Math.PI);
        var labelX = p.x + p.dir * 35;
        var labelY = p.y - 30;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(deg + '\u00B0', labelX, labelY);
    }

    function drawAimPreview() {
        var p = players[currentPlayer];
        var cosA = Math.cos(p.angle);
        var sinA = Math.sin(p.angle);
        var startX = p.x + p.dir * cosA * BARREL_LEN;
        var startY = p.y - sinA * BARREL_LEN;

        var power = (gameState === 'charging') ? p.power : p.power || MAX_POWER * 0.3;
        if (gameState === 'aiming') power = MAX_POWER * 0.3; // show preview at low power

        var vx = p.dir * cosA * power;
        var vy = -sinA * power;

        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();

        var sx = startX, sy = startY;
        ctx.moveTo(sx, sy);
        var stepDt = 0.02;
        for (var i = 0; i < PREVIEW_DOTS; i++) {
            sx += vx * stepDt;
            sy += vy * stepDt;
            vy += GRAVITY * stepDt;
            vx += wind * stepDt;
            if (sy > H || sx < 0 || sx > W) break;
            // Check terrain
            var tx = Math.floor(clamp(sx, 0, W - 1));
            if (sy >= terrain[tx]) break;
            ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawPowerBar() {
        var p = players[currentPlayer];
        if (gameState !== 'charging' && !(gameState === 'aiTurn' && aiPhase === 'charging')) return;

        var barW = 60;
        var barH = 8;
        var bx = p.x - barW / 2;
        var by = p.y + CANNON_H / 2 + 12;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3);
        ctx.fill();

        // Power fill
        var frac = p.power / MAX_POWER;
        var fillW = barW * frac;
        if (fillW > 1) {
            var color = frac < 0.5 ? '#4ade80' : frac < 0.8 ? '#fbbf24' : '#ef4444';
            ctx.fillStyle = color;
            roundRect(bx, by, fillW, barH, 2);
            ctx.fill();
        }

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('POWER', p.x, by + barH + 2);
    }

    function drawTrail() {
        if (trailPoints.length < 2) return;
        for (var i = 1; i < trailPoints.length; i++) {
            var alpha = i / trailPoints.length * 0.6;
            var r = (i / trailPoints.length) * 3;
            ctx.fillStyle = 'rgba(255, 200, 50, ' + alpha + ')';
            ctx.beginPath();
            ctx.arc(trailPoints[i].x, trailPoints[i].y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawProjectile() {
        if (!projectile) return;
        // Glow
        ctx.fillStyle = 'rgba(255, 100, 30, 0.4)';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, PROJECTILE_R * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = '#ff6633';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, PROJECTILE_R, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, PROJECTILE_R * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var pt = particles[i];
            var alpha = pt.life / pt.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── Helpers ──
    function clamp(v, mn, mx) {
        return v < mn ? mn : v > mx ? mx : v;
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ── Main Loop ──
    var lastTime = 0;
    function loop(timestamp) {
        requestAnimationFrame(loop);
        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.05) dt = 0.05; // cap at 50ms

        update(dt);
        draw();
    }

    requestAnimationFrame(function (ts) {
        lastTime = ts;
        requestAnimationFrame(loop);
    });

})();
