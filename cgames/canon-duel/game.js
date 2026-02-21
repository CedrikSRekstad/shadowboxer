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
    var FIRE_TRAIL_MAX = 15;
    var POWER_SHOT_THRESHOLD = 0.8; // 80% power

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

    // Visual enhancement state
    var globalTime = 0; // accumulated time for animations
    var stars = []; // dark mode twinkling stars
    var clouds = []; // light mode drifting clouds
    var shockwaves = []; // expanding ring effects
    var smokeParticles = []; // lingering smoke
    var windStreaks = []; // animated wind dashes
    var fireTrail = []; // last N positions of projectile for fire trail
    var screenShake = { x: 0, y: 0, intensity: 0 }; // screen shake
    var powerShotText = { active: false, timer: 0, x: 0, y: 0 }; // "POWER SHOT!" text
    var isPowerShot = false; // whether current shot is a power shot

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

    // ── Generate stars for dark mode ──
    function generateStars() {
        stars = [];
        for (var i = 0; i < 120; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.55,
                r: 0.5 + Math.random() * 1.5,
                phase: Math.random() * Math.PI * 2,
                speed: 1.5 + Math.random() * 2.5,
                baseAlpha: 0.3 + Math.random() * 0.7
            });
        }
    }

    // ── Generate clouds for light mode ──
    function generateClouds() {
        clouds = [];
        for (var i = 0; i < 6; i++) {
            clouds.push({
                x: Math.random() * W,
                y: 30 + Math.random() * 100,
                w: 60 + Math.random() * 80,
                h: 20 + Math.random() * 15,
                speed: 5 + Math.random() * 10,
                alpha: 0.25 + Math.random() * 0.25
            });
        }
    }

    // ── Initialize wind streaks ──
    function initWindStreaks() {
        windStreaks = [];
        for (var i = 0; i < 12; i++) {
            windStreaks.push({
                x: Math.random() * W,
                y: 50 + Math.random() * (H * 0.5),
                len: 10 + Math.random() * 20,
                alpha: 0.1 + Math.random() * 0.2,
                speed: 0 // will be set based on wind
            });
        }
    }

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
                dir: 1, // faces right
                recoilOffset: 0 // cannon recoil animation
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
                dir: -1, // faces left
                recoilOffset: 0
            }
        ];
    }

    // ── Game flow ──
    function startGame() {
        generateTerrain();
        createPlayers();
        generateStars();
        generateClouds();
        initWindStreaks();
        wind = (Math.random() * 2 - 1) * WIND_MAX;
        currentPlayer = 0;
        projectile = null;
        particles = [];
        trailPoints = [];
        shockwaves = [];
        smokeParticles = [];
        fireTrail = [];
        screenShake = { x: 0, y: 0, intensity: 0 };
        powerShotText = { active: false, timer: 0, x: 0, y: 0 };
        isPowerShot = false;
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
        fireTrail = [];
        isPowerShot = false;

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

        // Check for power shot
        isPowerShot = (p.power / MAX_POWER) >= POWER_SHOT_THRESHOLD;

        projectile = {
            x: barrelEndX,
            y: barrelEndY,
            vx: dir * cosA * p.power,
            vy: -sinA * p.power,
            owner: currentPlayer,
            rotation: 0 // rotation animation
        };
        trailPoints = [];
        fireTrail = [];
        gameState = 'firing';

        // Trigger recoil
        p.recoilOffset = -5;

        // Show power shot text
        if (isPowerShot) {
            powerShotText = {
                active: true,
                timer: 1.5,
                x: p.x,
                y: p.y - 50
            };
        }

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
        var sizeMultiplier = isPowerShot ? 1.3 : 1.0;
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = (30 + Math.random() * 120) * sizeMultiplier;
            var life = 0.4 + Math.random() * 0.6;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: life,
                maxLife: life,
                r: (2 + Math.random() * 3) * sizeMultiplier,
                color: big ?
                    (Math.random() > 0.5 ? '#ff6633' : '#ffcc00') :
                    (Math.random() > 0.5 ? '#aa8855' : '#887744')
            });
        }

        // Add extra spark particles for variety
        var sparkCount = big ? 15 : 8;
        for (var j = 0; j < sparkCount; j++) {
            var sa = Math.random() * Math.PI * 2;
            var sp = (60 + Math.random() * 180) * sizeMultiplier;
            var sl = 0.2 + Math.random() * 0.4;
            particles.push({
                x: x, y: y,
                vx: Math.cos(sa) * sp,
                vy: Math.sin(sa) * sp - 60,
                life: sl,
                maxLife: sl,
                r: 1 + Math.random() * 1.5,
                color: '#ffffff'
            });
        }

        // Add shockwave
        var shockMaxR = (big ? 60 : 40) * sizeMultiplier;
        shockwaves.push({
            x: x,
            y: y,
            radius: 5,
            maxRadius: shockMaxR,
            alpha: 1.0,
            lineWidth: big ? 3 : 2
        });

        // Add smoke particles
        var smokeCount = big ? 12 : 6;
        for (var k = 0; k < smokeCount; k++) {
            var sma = Math.random() * Math.PI * 2;
            var smSpeed = 10 + Math.random() * 25;
            smokeParticles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(sma) * smSpeed,
                vy: -15 - Math.random() * 25, // drift upward
                life: 1.5 + Math.random() * 1.5,
                maxLife: 1.5 + Math.random() * 1.5,
                r: 5 + Math.random() * 8,
                alpha: 0.4 + Math.random() * 0.2
            });
        }

        // Screen shake
        var shakeIntensity = (big ? 8 : 4) * sizeMultiplier;
        screenShake.intensity = shakeIntensity;
    }

    function handleImpact(result) {
        gameState = 'exploding';
        var ex = projectile.x;
        var ey = projectile.y;
        var explosionRadius = isPowerShot ? EXPLOSION_R * 1.3 : EXPLOSION_R;

        if (result.indexOf('hit_') === 0) {
            var hitIdx = parseInt(result.charAt(4));
            players[hitIdx].hp = Math.max(0, players[hitIdx].hp - HIT_DAMAGE);
            createExplosion(ex, ey, true);
            destroyTerrain(ex, ey, explosionRadius * 1.2);
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
            destroyTerrain(ex, ey, explosionRadius);
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

        globalTime += dt;

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

        // Update smoke particles
        for (var si = smokeParticles.length - 1; si >= 0; si--) {
            var sm = smokeParticles[si];
            sm.x += sm.vx * dt;
            sm.y += sm.vy * dt;
            sm.vx *= 0.98; // slow down horizontally
            sm.vy *= 0.97; // slow deceleration upward
            sm.r += 3 * dt; // slowly expand
            sm.life -= dt;
            if (sm.life <= 0) {
                smokeParticles.splice(si, 1);
            }
        }

        // Update shockwaves
        for (var wi = shockwaves.length - 1; wi >= 0; wi--) {
            var sw = shockwaves[wi];
            sw.radius += 120 * dt; // expand
            sw.alpha -= 1.8 * dt; // fade
            if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
                shockwaves.splice(wi, 1);
            }
        }

        // Update screen shake
        if (screenShake.intensity > 0.1) {
            screenShake.x = (Math.random() - 0.5) * 2 * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * 2 * screenShake.intensity;
            screenShake.intensity *= 0.88;
        } else {
            screenShake.x = 0;
            screenShake.y = 0;
            screenShake.intensity = 0;
        }

        // Update cannon recoil
        for (var ri = 0; ri < players.length; ri++) {
            if (Math.abs(players[ri].recoilOffset) > 0.05) {
                players[ri].recoilOffset *= 0.85;
            } else {
                players[ri].recoilOffset = 0;
            }
        }

        // Update wind streaks
        for (var wsi = 0; wsi < windStreaks.length; wsi++) {
            var ws = windStreaks[wsi];
            ws.x += wind * 0.8 * dt;
            // Wrap around
            if (ws.x > W + 30) ws.x = -30;
            if (ws.x < -30) ws.x = W + 30;
            // Subtle vertical drift
            ws.y += Math.sin(globalTime * 0.5 + wsi) * 0.3;
        }

        // Update clouds
        for (var ci = 0; ci < clouds.length; ci++) {
            var cl = clouds[ci];
            cl.x += cl.speed * dt + wind * 0.05 * dt;
            if (cl.x > W + cl.w) cl.x = -cl.w;
            if (cl.x < -cl.w) cl.x = W + cl.w;
        }

        // Update power shot text
        if (powerShotText.active) {
            powerShotText.timer -= dt;
            powerShotText.y -= 20 * dt; // float upward
            if (powerShotText.timer <= 0) {
                powerShotText.active = false;
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
            projectile.rotation += 8 * dt; // rotation animation

            // Trail
            trailPoints.push({ x: projectile.x, y: projectile.y });
            if (trailPoints.length > TRAIL_MAX) trailPoints.shift();

            // Fire trail (last 15 positions)
            fireTrail.push({ x: projectile.x, y: projectile.y });
            if (fireTrail.length > FIRE_TRAIL_MAX) fireTrail.shift();

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

        // Apply screen shake
        ctx.save();
        ctx.translate(screenShake.x, screenShake.y);

        drawSky();
        drawTerrain();
        drawWindStreaks();
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
        drawFireTrail();
        drawProjectile();
        drawParticles();
        drawSmokeParticles();
        drawShockwaves();
        drawPowerShotText();

        ctx.restore(); // end screen shake
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
            grad.addColorStop(0, '#5BADE2');
            grad.addColorStop(0.25, '#87CEEB');
            grad.addColorStop(0.5, '#a8dcf0');
            grad.addColorStop(0.7, '#c8e6f5');
            grad.addColorStop(0.85, '#ddeedd');
            grad.addColorStop(1, '#e8f0e0');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Draw clouds
            drawClouds();
        } else {
            grad.addColorStop(0, '#050520');
            grad.addColorStop(0.2, '#0a0a2e');
            grad.addColorStop(0.4, '#1a1a4e');
            grad.addColorStop(0.6, '#221545');
            grad.addColorStop(0.8, '#2a1a3e');
            grad.addColorStop(0.9, '#1f2a25');
            grad.addColorStop(1, '#1a2a1e');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Draw twinkling stars
            drawStars();
        }
    }

    function drawStars() {
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var twinkle = 0.5 + 0.5 * Math.sin(globalTime * s.speed + s.phase);
            var alpha = s.baseAlpha * twinkle;
            ctx.fillStyle = 'rgba(255, 255, 240, ' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawClouds() {
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            ctx.fillStyle = 'rgba(255, 255, 255, ' + c.alpha.toFixed(3) + ')';
            // Draw cloud as overlapping ellipses
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x - c.w * 0.25, c.y + 2, c.w * 0.35, c.h * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.25, c.y + 1, c.w * 0.38, c.h * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.05, c.y - c.h * 0.25, c.w * 0.3, c.h * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawTerrain() {
        var theme = document.body.getAttribute('data-theme');

        // Fill terrain
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (var x = 0; x < W; x++) {
            ctx.lineTo(x, terrain[x]);
        }
        ctx.lineTo(W, H);
        ctx.closePath();

        // Layered gradient fill (grass on top, dirt/rock below)
        var grad = ctx.createLinearGradient(0, H * 0.25, 0, H);
        if (theme === 'light') {
            grad.addColorStop(0, '#5ab84a');
            grad.addColorStop(0.08, '#4a9e3f');
            grad.addColorStop(0.2, '#3d8b35');
            grad.addColorStop(0.4, '#8a6b3a');
            grad.addColorStop(0.65, '#7a5c3a');
            grad.addColorStop(0.85, '#5a4030');
            grad.addColorStop(1, '#4a3525');
        } else {
            grad.addColorStop(0, '#3a8a3a');
            grad.addColorStop(0.08, '#2d6b2d');
            grad.addColorStop(0.2, '#1f4f1f');
            grad.addColorStop(0.4, '#5a4020');
            grad.addColorStop(0.65, '#4a3520');
            grad.addColorStop(0.85, '#3a2a18');
            grad.addColorStop(1, '#2a1e12');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        // Subtle horizontal texture lines in the terrain
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (var xt = 0; xt < W; xt++) {
            ctx.lineTo(xt, terrain[xt]);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.clip();

        ctx.strokeStyle = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (var ly = Math.floor(H * 0.3); ly < H; ly += 8) {
            ctx.beginPath();
            ctx.moveTo(0, ly);
            ctx.lineTo(W, ly);
            ctx.stroke();
        }
        ctx.restore();

        // Top edge highlight
        ctx.beginPath();
        ctx.moveTo(0, terrain[0]);
        for (var x2 = 1; x2 < W; x2++) {
            ctx.lineTo(x2, terrain[x2]);
        }
        ctx.strokeStyle = theme === 'light' ? '#6cd06c' : '#40a040';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Grass blade details at the terrain edge
        drawGrassBlades(theme);
    }

    function drawGrassBlades(theme) {
        var grassColor1 = theme === 'light' ? '#5cb85c' : '#3a8a3a';
        var grassColor2 = theme === 'light' ? '#4aa04a' : '#2d7a2d';
        var grassDarkColor = theme === 'light' ? '#3a8030' : '#1f5f1f';

        // Draw grass blades every few pixels along terrain
        for (var x = 0; x < W; x += 3) {
            var ty = terrain[x];
            // Skip if terrain is off-screen low
            if (ty > H - 5) continue;

            // Vary grass height
            var bladeH = 3 + Math.sin(x * 0.7) * 2 + Math.cos(x * 1.3) * 1.5;
            var windSway = Math.sin(globalTime * 1.5 + x * 0.05) * 1.2;

            ctx.strokeStyle = (x % 6 < 3) ? grassColor1 : grassColor2;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, ty);
            ctx.lineTo(x + windSway, ty - bladeH);
            ctx.stroke();

            // Every 9th blade is thicker and taller
            if (x % 9 === 0) {
                ctx.strokeStyle = grassDarkColor;
                ctx.lineWidth = 1.5;
                var tallH = bladeH + 3;
                ctx.beginPath();
                ctx.moveTo(x + 1, ty);
                ctx.lineTo(x + 1 + windSway * 1.3, ty - tallH);
                ctx.stroke();
            }
        }
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

    function drawWindStreaks() {
        if (Math.abs(wind) < 5) return;

        var windDir = wind > 0 ? 1 : -1;
        var windMag = Math.abs(wind) / WIND_MAX;
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.06 + windMag * 0.1).toFixed(3) + ')';
        ctx.lineWidth = 1;

        for (var i = 0; i < windStreaks.length; i++) {
            var ws = windStreaks[i];
            var streakLen = ws.len * windMag;
            // Dashed line effect
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.moveTo(ws.x, ws.y);
            ctx.lineTo(ws.x + windDir * streakLen, ws.y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    function drawPlayers() {
        for (var i = 0; i < 2; i++) {
            var p = players[i];
            var px = p.x;
            var py = p.y;

            // Cannon base with metallic gradient
            var baseGrad = ctx.createLinearGradient(px - CANNON_W / 2, py - CANNON_H / 2, px - CANNON_W / 2, py + CANNON_H / 2);
            baseGrad.addColorStop(0, p.lightColor);
            baseGrad.addColorStop(0.4, p.color);
            baseGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
            ctx.fillStyle = baseGrad;
            roundRect(px - CANNON_W / 2, py - CANNON_H / 2, CANNON_W, CANNON_H, 3);
            ctx.fill();

            // Metallic edge highlight on top
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - CANNON_W / 2 + 3, py - CANNON_H / 2);
            ctx.lineTo(px + CANNON_W / 2 - 3, py - CANNON_H / 2);
            ctx.stroke();

            // Rivets / bolts on the base
            var rivetColor = 'rgba(80, 80, 80, 0.6)';
            var rivetHighlight = 'rgba(200, 200, 200, 0.4)';
            var rivetPositions = [
                { rx: px - CANNON_W / 2 + 5, ry: py - 2 },
                { rx: px + CANNON_W / 2 - 5, ry: py - 2 },
                { rx: px - CANNON_W / 2 + 5, ry: py + CANNON_H / 2 - 4 },
                { rx: px + CANNON_W / 2 - 5, ry: py + CANNON_H / 2 - 4 }
            ];
            for (var rv = 0; rv < rivetPositions.length; rv++) {
                var rp = rivetPositions[rv];
                ctx.fillStyle = rivetColor;
                ctx.beginPath();
                ctx.arc(rp.rx, rp.ry, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = rivetHighlight;
                ctx.beginPath();
                ctx.arc(rp.rx - 0.5, rp.ry - 0.5, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Barrel with recoil
            ctx.save();
            ctx.translate(px, py);
            var cosA = Math.cos(p.angle);
            var sinA = Math.sin(p.angle);

            // Recoil offset applied along barrel direction
            var recoilX = p.dir * cosA * p.recoilOffset;
            var recoilY = -sinA * p.recoilOffset;

            var bex = p.dir * cosA * BARREL_LEN + recoilX;
            var bey = -sinA * BARREL_LEN + recoilY;
            var bStartX = recoilX;
            var bStartY = recoilY;
            ctx.lineCap = 'round';

            // Barrel outline (drawn first, thicker)
            ctx.beginPath();
            ctx.moveTo(bStartX, bStartY);
            ctx.lineTo(bex, bey);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = BARREL_W + 3;
            ctx.stroke();

            // Barrel metallic gradient
            var barrelGrad = ctx.createLinearGradient(bStartX, bStartY, bex, bey);
            barrelGrad.addColorStop(0, '#888888');
            barrelGrad.addColorStop(0.3, '#bbbbbb');
            barrelGrad.addColorStop(0.6, '#cccccc');
            barrelGrad.addColorStop(1, '#999999');
            ctx.beginPath();
            ctx.moveTo(bStartX, bStartY);
            ctx.lineTo(bex, bey);
            ctx.strokeStyle = barrelGrad;
            ctx.lineWidth = BARREL_W;
            ctx.stroke();

            // Barrel highlight stripe (thin bright line along top edge)
            ctx.beginPath();
            var perpX = sinA * p.dir * 1.5;
            var perpY = cosA * 1.5;
            ctx.moveTo(bStartX + perpX, bStartY + perpY);
            ctx.lineTo(bex + perpX, bey + perpY);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
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
            // Wheel hub detail
            ctx.fillStyle = '#777';
            ctx.beginPath();
            ctx.arc(px - 8, py + CANNON_H / 2, 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px + 8, py + CANNON_H / 2, 1.2, 0, Math.PI * 2);
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

        // Power shot threshold marker
        var threshX = bx + barW * POWER_SHOT_THRESHOLD;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(threshX, by - 1);
        ctx.lineTo(threshX, by + barH + 1);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        var powerLabel = 'POWER';
        if (frac >= POWER_SHOT_THRESHOLD) {
            powerLabel = 'POWER!';
            ctx.fillStyle = '#ff4444';
        }
        ctx.fillText(powerLabel, p.x, by + barH + 2);
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

    function drawFireTrail() {
        if (fireTrail.length < 2) return;
        for (var i = 0; i < fireTrail.length; i++) {
            var frac = i / fireTrail.length;
            var r = (isPowerShot ? 5 : 3.5) * frac;
            // Interpolate color: red at tail -> orange in middle -> yellow near head
            var red = 255;
            var green = Math.floor(50 + frac * 150);
            var blue = Math.floor(frac * 30);
            var alpha = 0.3 + frac * 0.5;
            ctx.fillStyle = 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(fireTrail[i].x, fireTrail[i].y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawProjectile() {
        if (!projectile) return;

        var projR = isPowerShot ? PROJECTILE_R * 1.4 : PROJECTILE_R;

        // Glow with shadowBlur
        ctx.save();
        ctx.shadowColor = isPowerShot ? 'rgba(255, 60, 0, 0.8)' : 'rgba(255, 100, 30, 0.6)';
        ctx.shadowBlur = isPowerShot ? 20 : 12;

        // Rotation animation around projectile
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.rotation);

        // Core
        ctx.fillStyle = isPowerShot ? '#ff4400' : '#ff6633';
        ctx.beginPath();
        ctx.arc(0, 0, projR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // undo translate/rotate
        ctx.restore(); // undo shadow

        // Outer glow (no shadow)
        ctx.fillStyle = isPowerShot ? 'rgba(255, 60, 0, 0.35)' : 'rgba(255, 100, 30, 0.3)';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projR * 3, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projR * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Extra bright point
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projR * 0.2, 0, Math.PI * 2);
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

    function drawSmokeParticles() {
        for (var i = 0; i < smokeParticles.length; i++) {
            var sm = smokeParticles[i];
            var lifeFrac = sm.life / sm.maxLife;
            var alpha = sm.alpha * lifeFrac * 0.6;
            var gray = 120 + Math.floor((1 - lifeFrac) * 80);
            ctx.fillStyle = 'rgba(' + gray + ', ' + gray + ', ' + gray + ', ' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawShockwaves() {
        for (var i = 0; i < shockwaves.length; i++) {
            var sw = shockwaves[i];
            if (sw.alpha <= 0) continue;
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + clamp(sw.alpha, 0, 1).toFixed(3) + ')';
            ctx.lineWidth = sw.lineWidth * sw.alpha;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawPowerShotText() {
        if (!powerShotText.active) return;
        var alpha = clamp(powerShotText.timer / 1.5, 0, 1);
        // Scale up then fade
        var scale = 1 + (1 - alpha) * 0.5;
        ctx.save();
        ctx.translate(powerShotText.x, powerShotText.y);
        ctx.scale(scale, scale);
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Outline
        ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.7).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.strokeText('POWER SHOT!', 0, 0);
        // Fill with gradient from orange to red
        ctx.fillStyle = 'rgba(255, 80, 0, ' + alpha.toFixed(3) + ')';
        ctx.fillText('POWER SHOT!', 0, 0);
        ctx.restore();
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
