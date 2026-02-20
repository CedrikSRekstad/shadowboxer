/* === Stampede - Side-scrolling obstacle runner === */
(function () {
    'use strict';

    // ── Init shell ──
    GameShell.init({ backUrl: '../' });

    // ── DOM refs ──
    var canvas = document.getElementById('game-canvas');
    var ctx = canvas.getContext('2d');
    var container = document.getElementById('canvas-container');
    var hudP1 = document.getElementById('hud-p1');
    var hudP2 = document.getElementById('hud-p2');
    var hudSep = document.getElementById('hud-sep');
    var gameoverTitle = document.getElementById('gameover-title');
    var gameoverScores = document.getElementById('gameover-scores');
    var pauseOverlay = document.getElementById('pause-overlay');

    // ── Constants ──
    var BASE_SPEED = 280;          // pixels per second at start
    var SPEED_RAMP = 18;           // extra px/s per 500 distance
    var GRAVITY = 2200;            // px/s^2
    var JUMP_VEL = -680;           // initial jump velocity
    var GROUND_Y_RATIO = 0.78;    // ground line as ratio of canvas height
    var PLAYER_W = 28;
    var PLAYER_H = 52;
    var DUCK_H = 26;
    var DUCK_DURATION = 400;       // ms
    var MIN_OBSTACLE_GAP = 220;    // min px between obstacles
    var COIN_SIZE = 16;
    var COIN_POINTS = 50;

    // Obstacle dimensions
    var OBS_LOW_W = 30;
    var OBS_LOW_H = 30;
    var OBS_HIGH_W = 36;
    var OBS_HIGH_H = 24;
    var OBS_HIGH_Y_OFFSET = 60;    // how high above ground

    // ── State ──
    var mode = 1;            // 1 or 2 players
    var paused = false;
    var gameOver = false;
    var animId = null;
    var lastTime = 0;
    var distance = 0;        // score distance (from player)
    var speed = BASE_SPEED;
    var groundY = 0;
    var players = [];
    var obstacles = [];
    var coins = [];
    var particles = [];
    var bgLayers = [];
    var groundOffset = 0;
    var totalScrolled = 0;       // total pixels scrolled since game start
    var spawnedUpTo = 0;         // how far (in scroll-space) we have spawned obstacles
    var coinSpawnedUpTo = 0;     // how far we have spawned coins

    // Canvas dimensions
    var W = 800;
    var H = 450;

    // ── CSS color helpers ──
    var style = getComputedStyle(document.documentElement);
    function cssVar(name) {
        return style.getPropertyValue(name).trim();
    }

    function refreshColors() {
        style = getComputedStyle(document.documentElement);
    }

    // ── Player class ──
    function Player(index) {
        this.idx = index;
        this.x = 80 + index * 20;
        this.baseY = 0;
        this.y = 0;
        this.w = PLAYER_W;
        this.h = PLAYER_H;
        this.vy = 0;
        this.jumping = false;
        this.ducking = false;
        this.duckTimer = 0;
        this.alive = true;
        this.distance = 0;
        this.coinScore = 0;
        this.legPhase = 0;
    }

    Player.prototype.jump = function () {
        if (!this.alive || this.jumping) return;
        this.vy = JUMP_VEL;
        this.jumping = true;
        this.ducking = false;
        this.duckTimer = 0;
        CGameAudio.play('whoosh');
    };

    Player.prototype.duck = function () {
        if (!this.alive || this.jumping) return;
        this.ducking = true;
        this.duckTimer = DUCK_DURATION;
        CGameAudio.play('click');
    };

    Player.prototype.update = function (dt) {
        if (!this.alive) return;

        // Distance tracking (in abstract "meters")
        this.distance += speed * dt / 1000;

        // Jump physics
        if (this.jumping) {
            this.vy += GRAVITY * dt / 1000;
            this.y += this.vy * dt / 1000;
            if (this.y >= this.baseY) {
                this.y = this.baseY;
                this.vy = 0;
                this.jumping = false;
            }
        }

        // Duck timer
        if (this.ducking) {
            this.duckTimer -= dt;
            if (this.duckTimer <= 0) {
                this.ducking = false;
                this.duckTimer = 0;
            }
        }

        // Running animation phase
        this.legPhase += dt * 0.012 * (speed / BASE_SPEED);

        // Dust particles when running on ground
        if (!this.jumping && Math.random() < 0.3) {
            particles.push({
                x: this.x - 4,
                y: this.baseY + this.h,
                vx: -speed * 0.3 + (Math.random() - 0.5) * 30,
                vy: -20 - Math.random() * 40,
                life: 300 + Math.random() * 200,
                maxLife: 500,
                size: 2 + Math.random() * 3
            });
        }
    };

    Player.prototype.getHitbox = function () {
        var h = this.ducking ? DUCK_H : this.h;
        var topY = this.y + this.h - h; // bottom-aligned hitbox
        return {
            x: this.x,
            y: topY,
            w: this.w,
            h: h
        };
    };

    Player.prototype.draw = function (c) {
        if (!this.alive) return;
        var color = this.idx === 0 ? cssVar('--p1-color') : cssVar('--p2-color');
        var lightColor = this.idx === 0 ? cssVar('--p1-light') : cssVar('--p2-light');
        var hb = this.getHitbox();
        var cx = hb.x + hb.w / 2;
        var bottom = hb.y + hb.h;

        c.save();

        if (this.ducking) {
            // Crouched figure
            var bodyY = bottom - hb.h;
            // Head
            c.fillStyle = color;
            c.beginPath();
            c.arc(cx, bodyY + 6, 7, 0, Math.PI * 2);
            c.fill();
            // Horizontal body
            c.strokeStyle = color;
            c.lineWidth = 4;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(cx - 10, bodyY + 14);
            c.lineTo(cx + 10, bodyY + 14);
            c.stroke();
            // Bent legs
            c.beginPath();
            c.moveTo(cx + 10, bodyY + 14);
            c.lineTo(cx + 6, bottom);
            c.stroke();
            c.beginPath();
            c.moveTo(cx - 10, bodyY + 14);
            c.lineTo(cx - 6, bottom);
            c.stroke();
        } else {
            // Standing / running / jumping
            var bodyTop = hb.y;
            // Head
            c.fillStyle = color;
            c.beginPath();
            c.arc(cx, bodyTop + 8, 8, 0, Math.PI * 2);
            c.fill();
            // Torso
            c.strokeStyle = color;
            c.lineWidth = 4;
            c.lineCap = 'round';
            var bodyMidY = bodyTop + 30;
            c.beginPath();
            c.moveTo(cx, bodyTop + 16);
            c.lineTo(cx, bodyMidY);
            c.stroke();
            // Arms
            var armSwing = this.jumping ? 0.4 : Math.sin(this.legPhase) * 0.5;
            c.beginPath();
            c.moveTo(cx, bodyTop + 20);
            c.lineTo(cx - 10, bodyTop + 26 + armSwing * 8);
            c.stroke();
            c.beginPath();
            c.moveTo(cx, bodyTop + 20);
            c.lineTo(cx + 10, bodyTop + 26 - armSwing * 8);
            c.stroke();
            // Legs
            var legSwing = this.jumping ? 0.3 : Math.sin(this.legPhase) * 0.6;
            c.beginPath();
            c.moveTo(cx, bodyMidY);
            c.lineTo(cx - 8 + legSwing * 10, bottom);
            c.stroke();
            c.beginPath();
            c.moveTo(cx, bodyMidY);
            c.lineTo(cx + 8 - legSwing * 10, bottom);
            c.stroke();
        }

        // Glow effect
        c.shadowColor = lightColor;
        c.shadowBlur = 8;
        c.fillStyle = lightColor;
        c.globalAlpha = 0.3;
        c.beginPath();
        c.arc(cx, hb.y + hb.h / 2, 6, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;

        c.restore();
    };

    // ── Obstacle factory ──
    function createObstacle(type, screenX) {
        if (type === 'low') {
            var variant = Math.random() < 0.5 ? 'rock' : 'log';
            return {
                type: 'low',
                variant: variant,
                x: screenX,
                y: groundY - OBS_LOW_H,
                w: OBS_LOW_W,
                h: OBS_LOW_H
            };
        } else {
            var variant2 = Math.random() < 0.5 ? 'branch' : 'bird';
            return {
                type: 'high',
                variant: variant2,
                x: screenX,
                y: groundY - OBS_HIGH_Y_OFFSET - OBS_HIGH_H,
                w: OBS_HIGH_W,
                h: OBS_HIGH_H,
                wingPhase: 0
            };
        }
    }

    function createCoin(screenX) {
        return {
            x: screenX,
            y: groundY - 50 - Math.random() * 40,
            size: COIN_SIZE,
            collected: false,
            bobPhase: Math.random() * Math.PI * 2
        };
    }

    // ── Background ──
    function initBackground() {
        bgLayers = [
            { offset: 0, speed: 0.05 }, // far mountains
            { offset: 0, speed: 0.15 }, // near hills
            { offset: 0, speed: 0.4 }   // bushes
        ];
    }

    // ── Resize ──
    function resize() {
        var rect = container.getBoundingClientRect();
        var aspect = W / H;
        var cw = rect.width;
        var ch = rect.height;
        if (cw / ch > aspect) {
            cw = ch * aspect;
        } else {
            ch = cw / aspect;
        }
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        canvas.width = W;
        canvas.height = H;
        groundY = Math.floor(H * GROUND_Y_RATIO);
    }

    // ── Input ──
    var keys = {};

    document.addEventListener('keydown', function (e) {
        if (gameOver) return;
        keys[e.code] = true;

        // P1: W or Space to jump, S to duck
        if (e.code === 'KeyW' || e.code === 'Space') {
            e.preventDefault();
            if (players[0]) players[0].jump();
        }
        if (e.code === 'KeyS') {
            e.preventDefault();
            if (players[0]) players[0].duck();
        }

        // P2: Arrow Up to jump, Arrow Down to duck
        if (mode === 2) {
            if (e.code === 'ArrowUp') {
                e.preventDefault();
                if (players[1]) players[1].jump();
            }
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                if (players[1]) players[1].duck();
            }
        }

        // Pause
        if (e.code === 'Escape' || e.code === 'KeyP') {
            e.preventDefault();
            togglePause();
        }
    });

    document.addEventListener('keyup', function (e) {
        keys[e.code] = false;
    });

    // Touch controls
    function setupTouch() {
        var p1Jump = document.getElementById('touch-p1-jump');
        var p1Duck = document.getElementById('touch-p1-duck');
        var p2Jump = document.getElementById('touch-p2-jump');
        var p2Duck = document.getElementById('touch-p2-duck');

        function addTouchHandler(el, fn) {
            el.addEventListener('touchstart', function (e) {
                e.preventDefault();
                fn();
            }, { passive: false });
        }

        addTouchHandler(p1Jump, function () { if (players[0]) players[0].jump(); });
        addTouchHandler(p1Duck, function () { if (players[0]) players[0].duck(); });
        addTouchHandler(p2Jump, function () { if (players[1]) players[1].jump(); });
        addTouchHandler(p2Duck, function () { if (players[1]) players[1].duck(); });

        // Swipe detection on canvas
        var touchStarts = {};
        canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            for (var i = 0; i < e.changedTouches.length; i++) {
                var t = e.changedTouches[i];
                touchStarts[t.identifier] = { x: t.clientX, y: t.clientY };
            }
        }, { passive: false });

        canvas.addEventListener('touchend', function (e) {
            var rect = canvas.getBoundingClientRect();
            var midX = rect.left + rect.width / 2;
            for (var i = 0; i < e.changedTouches.length; i++) {
                var t = e.changedTouches[i];
                var start = touchStarts[t.identifier];
                if (!start) continue;
                var dy = t.clientY - start.y;
                var pIdx = (start.x < midX) ? 0 : (mode === 2 ? 1 : 0);
                if (Math.abs(dy) > 15) {
                    if (dy < 0 && players[pIdx]) players[pIdx].jump();
                    if (dy > 0 && players[pIdx]) players[pIdx].duck();
                } else {
                    // Tap = jump
                    if (players[pIdx]) players[pIdx].jump();
                }
                delete touchStarts[t.identifier];
            }
        }, { passive: false });
    }

    // ── Pause ──
    function togglePause() {
        if (gameOver) return;
        paused = !paused;
        if (paused) {
            pauseOverlay.classList.remove('hidden');
            CGameAudio.play('click');
        } else {
            pauseOverlay.classList.add('hidden');
            lastTime = performance.now();
            CGameAudio.play('click');
            animId = requestAnimationFrame(gameLoop);
        }
    }

    // ── Generate obstacles ahead ──
    // spawnedUpTo tracks total scroll-space distance we've filled with obstacles.
    // New obstacles spawn at screen x = W + (spawnedUpTo - totalScrolled).
    function generateObstacles() {
        var horizon = totalScrolled + W + 400; // how far ahead to fill

        while (spawnedUpTo < horizon) {
            var gap = MIN_OBSTACLE_GAP + Math.random() * 160;
            spawnedUpTo += gap;

            // Convert to current screen x
            var screenX = W + (spawnedUpTo - totalScrolled);

            // 40% low, 40% high, 20% double (low then high)
            var roll = Math.random();
            if (roll < 0.4) {
                obstacles.push(createObstacle('low', screenX));
            } else if (roll < 0.8) {
                obstacles.push(createObstacle('high', screenX));
            } else {
                obstacles.push(createObstacle('low', screenX));
                var extraGap = 80 + Math.random() * 60;
                obstacles.push(createObstacle('high', screenX + extraGap));
                spawnedUpTo += extraGap;
            }
        }

        // Coins
        var coinHorizon = totalScrolled + W + 400;
        while (coinSpawnedUpTo < coinHorizon) {
            coinSpawnedUpTo += 300 + Math.random() * 400;
            var cx = W + (coinSpawnedUpTo - totalScrolled);
            coins.push(createCoin(cx));
        }
    }

    // ── Collision ──
    function rectsOverlap(a, b) {
        return a.x < b.x + b.w &&
               a.x + a.w > b.x &&
               a.y < b.y + b.h &&
               a.y + a.h > b.y;
    }

    // ── Start game ──
    function startGame(playerCount) {
        mode = playerCount;
        gameOver = false;
        paused = false;
        distance = 0;
        speed = BASE_SPEED;
        obstacles = [];
        coins = [];
        particles = [];
        totalScrolled = 0;
        spawnedUpTo = 0;
        coinSpawnedUpTo = 0;
        groundOffset = 0;

        refreshColors();
        resize();
        initBackground();

        players = [];
        for (var i = 0; i < playerCount; i++) {
            var p = new Player(i);
            p.baseY = groundY - PLAYER_H;
            p.y = p.baseY;
            if (playerCount === 2) {
                p.x = 60 + i * 30;
            }
            players.push(p);
        }

        // HUD visibility
        if (mode === 2) {
            hudP2.classList.remove('hidden');
            hudSep.classList.remove('hidden');
        } else {
            hudP2.classList.add('hidden');
            hudSep.classList.add('hidden');
        }

        // Touch control P2 visibility
        var touchRight = document.getElementById('touch-right');
        if (mode === 1) {
            touchRight.style.visibility = 'hidden';
        } else {
            touchRight.style.visibility = 'visible';
        }

        pauseOverlay.classList.add('hidden');

        generateObstacles();

        GameShell.showScreen('game-screen');
        CGameAudio.play('click');

        lastTime = performance.now();
        if (animId) cancelAnimationFrame(animId);
        animId = requestAnimationFrame(gameLoop);
    }

    // ── Game loop ──
    function gameLoop(now) {
        if (paused || gameOver) return;

        var dt = now - lastTime;
        lastTime = now;
        if (dt > 50) dt = 50; // cap delta time

        update(dt);
        draw();

        animId = requestAnimationFrame(gameLoop);
    }

    // ── Update ──
    function update(dt) {
        var anyAlive = false;

        // Speed ramp based on max distance
        var maxDist = 0;
        for (var i = 0; i < players.length; i++) {
            if (players[i].distance > maxDist) maxDist = players[i].distance;
        }
        distance = maxDist;
        speed = BASE_SPEED + Math.floor(distance / 500) * SPEED_RAMP;

        // Pixels scrolled this frame
        var scrollDelta = speed * dt / 1000;
        totalScrolled += scrollDelta;

        // Update players
        for (var i = 0; i < players.length; i++) {
            players[i].update(dt);
            if (players[i].alive) anyAlive = true;
        }

        // Move obstacles left
        for (var i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= scrollDelta;
            if (obstacles[i].variant === 'bird') {
                obstacles[i].wingPhase += dt * 0.008;
            }
            if (obstacles[i].x + obstacles[i].w < -50) {
                obstacles.splice(i, 1);
            }
        }

        // Move coins left
        for (var i = coins.length - 1; i >= 0; i--) {
            coins[i].x -= scrollDelta;
            coins[i].bobPhase += dt * 0.005;
            if (coins[i].x < -50) {
                coins.splice(i, 1);
            }
        }

        // Collision check for each alive player
        for (var p = 0; p < players.length; p++) {
            if (!players[p].alive) continue;
            var phb = players[p].getHitbox();

            // vs obstacles
            for (var i = 0; i < obstacles.length; i++) {
                var obs = obstacles[i];
                var ohb = { x: obs.x, y: obs.y, w: obs.w, h: obs.h };
                if (rectsOverlap(phb, ohb)) {
                    players[p].alive = false;
                    CGameAudio.play('hit');
                    // Death burst particles
                    var pcol = players[p].idx === 0 ? cssVar('--p1-color') : cssVar('--p2-color');
                    for (var k = 0; k < 15; k++) {
                        particles.push({
                            x: phb.x + phb.w / 2,
                            y: phb.y + phb.h / 2,
                            vx: (Math.random() - 0.5) * 200,
                            vy: -100 - Math.random() * 200,
                            life: 600 + Math.random() * 400,
                            maxLife: 1000,
                            size: 3 + Math.random() * 4,
                            color: pcol
                        });
                    }
                    break;
                }
            }

            // Coin collection
            if (players[p].alive) {
                for (var i = coins.length - 1; i >= 0; i--) {
                    if (coins[i].collected) continue;
                    var cbox = {
                        x: coins[i].x - coins[i].size / 2,
                        y: coins[i].y + Math.sin(coins[i].bobPhase) * 5 - coins[i].size / 2,
                        w: coins[i].size,
                        h: coins[i].size
                    };
                    if (rectsOverlap(phb, cbox)) {
                        coins[i].collected = true;
                        players[p].coinScore += COIN_POINTS;
                        CGameAudio.play('score');
                        // Sparkle
                        for (var k = 0; k < 6; k++) {
                            particles.push({
                                x: coins[i].x,
                                y: coins[i].y,
                                vx: (Math.random() - 0.5) * 120,
                                vy: -60 - Math.random() * 80,
                                life: 300 + Math.random() * 200,
                                maxLife: 500,
                                size: 2 + Math.random() * 2,
                                color: '#ffdd00'
                            });
                        }
                    }
                }
            }
        }

        // Particles physics
        for (var i = particles.length - 1; i >= 0; i--) {
            var pt = particles[i];
            pt.x += pt.vx * dt / 1000;
            pt.y += pt.vy * dt / 1000;
            pt.vy += 400 * dt / 1000;
            pt.life -= dt;
            if (pt.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Background parallax
        for (var i = 0; i < bgLayers.length; i++) {
            bgLayers[i].offset -= scrollDelta * bgLayers[i].speed;
        }

        // Ground scroll
        groundOffset -= scrollDelta;

        // Spawn more obstacles/coins ahead
        generateObstacles();

        // Update HUD
        var p1Score = players[0] ? Math.floor(players[0].distance + players[0].coinScore) : 0;
        hudP1.textContent = 'P1: ' + p1Score + 'm';
        if (mode === 2 && players[1]) {
            var p2Score = Math.floor(players[1].distance + players[1].coinScore);
            hudP2.textContent = 'P2: ' + p2Score + 'm';
        }

        // Game over when nobody alive
        if (!anyAlive) {
            endGame();
        }
    }

    // ── Draw ──
    function draw() {
        var canvasBg = cssVar('--canvas-bg');
        var accentColor = cssVar('--accent');
        var isDark = document.body.getAttribute('data-theme') !== 'light';

        // Clear
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, W, H);

        // Sky gradient
        var skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        if (isDark) {
            skyGrad.addColorStop(0, '#0a0a1a');
            skyGrad.addColorStop(1, '#15152e');
        } else {
            skyGrad.addColorStop(0, '#87CEEB');
            skyGrad.addColorStop(1, '#c8e6f5');
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, groundY);

        // Parallax mountains / hills / bushes
        drawMountains(ctx, bgLayers[0].offset, groundY, isDark ? '#1a1a35' : '#a0b8d0', 0.6, 80);
        drawMountains(ctx, bgLayers[1].offset, groundY, isDark ? '#22223d' : '#8aa8c0', 0.4, 50);
        drawBushes(ctx, bgLayers[2].offset, groundY, isDark ? '#2a2a48' : '#6a9a70');

        // Ground fill
        ctx.fillStyle = isDark ? '#2a2a3e' : '#8B7355';
        ctx.fillRect(0, groundY, W, H - groundY);

        // Ground line
        ctx.strokeStyle = isDark ? '#444466' : '#6B5B3E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // Ground texture dashes (scrolling)
        ctx.strokeStyle = isDark ? '#333355' : '#7a6848';
        ctx.lineWidth = 1;
        var gOff = ((groundOffset % 40) + 40) % 40;
        for (var gx = -40 + gOff; gx < W + 40; gx += 40) {
            ctx.beginPath();
            ctx.moveTo(gx, groundY + 8);
            ctx.lineTo(gx + 15, groundY + 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx + 20, groundY + 18);
            ctx.lineTo(gx + 30, groundY + 18);
            ctx.stroke();
        }

        // Obstacles
        for (var i = 0; i < obstacles.length; i++) {
            drawObstacle(ctx, obstacles[i], isDark);
        }

        // Coins
        for (var i = 0; i < coins.length; i++) {
            if (!coins[i].collected) drawCoin(ctx, coins[i]);
        }

        // Players
        for (var i = 0; i < players.length; i++) {
            players[i].draw(ctx);
        }

        // Particles
        for (var i = 0; i < particles.length; i++) {
            var pt = particles[i];
            var alpha = Math.max(0, pt.life / pt.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pt.color || (isDark ? '#8888aa' : '#aa9977');
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Speed level indicator
        var speedLevel = Math.floor(distance / 500);
        if (speedLevel > 0) {
            ctx.fillStyle = accentColor;
            ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('Speed x' + (speedLevel + 1), W - 12, 24);
            ctx.textAlign = 'left';
        }
    }

    // ── Draw helpers ──
    function drawMountains(c, offset, baseY, color, heightFactor, segWidth) {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, baseY);
        var off = ((offset % segWidth) + segWidth) % segWidth;
        for (var x = -segWidth + off; x <= W + segWidth; x += segWidth) {
            var peakH = 30 + Math.abs(Math.sin(x * 0.005 + offset * 0.001)) * heightFactor * 100;
            c.lineTo(x, baseY - peakH);
            c.lineTo(x + segWidth / 2, baseY - peakH * 0.4);
        }
        c.lineTo(W + segWidth, baseY);
        c.closePath();
        c.fill();
    }

    function drawBushes(c, offset, baseY, color) {
        c.fillStyle = color;
        var bOff = ((offset % 60) + 60) % 60;
        for (var x = -60 + bOff; x <= W + 60; x += 60) {
            var bushH = 10 + Math.abs(Math.sin(x * 0.03)) * 15;
            c.beginPath();
            c.arc(x, baseY, bushH, Math.PI, 0);
            c.fill();
        }
    }

    function drawObstacle(c, obs, isDark) {
        c.save();
        if (obs.type === 'low') {
            if (obs.variant === 'rock') {
                // Triangular rock
                c.fillStyle = isDark ? '#666688' : '#888877';
                c.beginPath();
                c.moveTo(obs.x, obs.y + obs.h);
                c.lineTo(obs.x + obs.w / 2, obs.y);
                c.lineTo(obs.x + obs.w, obs.y + obs.h);
                c.closePath();
                c.fill();
                // Highlight face
                c.fillStyle = isDark ? '#7777aa' : '#999988';
                c.beginPath();
                c.moveTo(obs.x + obs.w * 0.3, obs.y + obs.h);
                c.lineTo(obs.x + obs.w / 2, obs.y + 4);
                c.lineTo(obs.x + obs.w * 0.6, obs.y + obs.h * 0.5);
                c.closePath();
                c.fill();
            } else {
                // Log
                c.fillStyle = isDark ? '#5a4a3a' : '#8B6914';
                roundRect(c, obs.x, obs.y + 4, obs.w, obs.h - 4, 5);
                c.fill();
                // Tree rings
                c.strokeStyle = isDark ? '#4a3a2a' : '#7a5a10';
                c.lineWidth = 1;
                c.beginPath();
                c.arc(obs.x + obs.w / 2, obs.y + obs.h / 2 + 2, 5, 0, Math.PI * 2);
                c.stroke();
                c.beginPath();
                c.arc(obs.x + obs.w / 2, obs.y + obs.h / 2 + 2, 9, 0, Math.PI * 2);
                c.stroke();
            }
        } else {
            if (obs.variant === 'branch') {
                // Horizontal branch
                c.fillStyle = isDark ? '#5a4a3a' : '#6B4226';
                c.fillRect(obs.x, obs.y + obs.h / 2 - 3, obs.w, 6);
                // Leaves
                c.fillStyle = isDark ? '#3a5a3a' : '#2d8a2d';
                for (var lx = obs.x + 5; lx < obs.x + obs.w; lx += 10) {
                    c.beginPath();
                    c.ellipse(lx, obs.y + obs.h / 2 - 6, 5, 3, 0, 0, Math.PI * 2);
                    c.fill();
                }
            } else {
                // Bird
                var wingY = Math.sin(obs.wingPhase) * 6;
                var bx = obs.x + obs.w / 2;
                var by = obs.y + obs.h / 2;
                // Body
                c.fillStyle = isDark ? '#888899' : '#555566';
                c.beginPath();
                c.ellipse(bx, by, 10, 6, 0, 0, Math.PI * 2);
                c.fill();
                // Wings
                c.strokeStyle = isDark ? '#9999aa' : '#666677';
                c.lineWidth = 3;
                c.lineCap = 'round';
                c.beginPath();
                c.moveTo(bx - 6, by);
                c.lineTo(bx - 14, by + wingY - 6);
                c.stroke();
                c.beginPath();
                c.moveTo(bx + 6, by);
                c.lineTo(bx + 14, by + wingY - 6);
                c.stroke();
                // Beak
                c.fillStyle = isDark ? '#dd8833' : '#cc7722';
                c.beginPath();
                c.moveTo(bx - 10, by - 1);
                c.lineTo(bx - 16, by + 1);
                c.lineTo(bx - 10, by + 2);
                c.closePath();
                c.fill();
            }
        }
        c.restore();
    }

    function drawCoin(c, coin) {
        var bobY = Math.sin(coin.bobPhase) * 5;
        c.save();
        c.fillStyle = '#ffdd00';
        c.shadowColor = '#ffdd00';
        c.shadowBlur = 6;
        c.beginPath();
        c.arc(coin.x, coin.y + bobY, coin.size / 2, 0, Math.PI * 2);
        c.fill();
        // Inner dot
        c.fillStyle = '#ffaa00';
        c.shadowBlur = 0;
        c.beginPath();
        c.arc(coin.x, coin.y + bobY, coin.size / 4, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.arcTo(x + w, y, x + w, y + r, r);
        c.lineTo(x + w, y + h - r);
        c.arcTo(x + w, y + h, x + w - r, y + h, r);
        c.lineTo(x + r, y + h);
        c.arcTo(x, y + h, x, y + h - r, r);
        c.lineTo(x, y + r);
        c.arcTo(x, y, x + r, y, r);
        c.closePath();
    }

    // ── End game ──
    function endGame() {
        gameOver = true;
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }

        var p1Score = players[0] ? Math.floor(players[0].distance + players[0].coinScore) : 0;

        if (mode === 1) {
            gameoverTitle.textContent = 'Game Over';
            gameoverScores.innerHTML =
                '<span class="p1-label">Distance: ' + p1Score + 'm</span>';
            CGameAudio.play('lose');
            GameShell.addScore({ game: 'stampede', mode: '1P', score: p1Score });
        } else {
            var p2Score = players[1] ? Math.floor(players[1].distance + players[1].coinScore) : 0;
            var winner = '';
            if (p1Score > p2Score) {
                winner = 'P1 Wins!';
                CGameAudio.play('win');
            } else if (p2Score > p1Score) {
                winner = 'P2 Wins!';
                CGameAudio.play('win');
            } else {
                winner = 'Tie!';
                CGameAudio.play('lose');
            }
            gameoverTitle.textContent = winner;
            gameoverScores.innerHTML =
                '<span class="p1-label">P1: ' + p1Score + 'm</span><br>' +
                '<span class="p2-label">P2: ' + p2Score + 'm</span>';
            GameShell.addScore({ game: 'stampede', mode: '2P', score: Math.max(p1Score, p2Score) });
        }

        // Brief delay before showing game over screen
        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 600);
    }

    // ── Button handlers ──
    document.getElementById('btn-1p').addEventListener('click', function () {
        startGame(1);
    });

    document.getElementById('btn-2p').addEventListener('click', function () {
        startGame(2);
    });

    document.getElementById('btn-pause').addEventListener('click', function () {
        togglePause();
    });

    document.getElementById('btn-resume').addEventListener('click', function () {
        togglePause();
    });

    document.getElementById('btn-quit').addEventListener('click', function () {
        gameOver = true;
        paused = false;
        if (animId) cancelAnimationFrame(animId);
        pauseOverlay.classList.add('hidden');
        GameShell.showScreen('title-screen');
        CGameAudio.play('back');
    });

    document.getElementById('btn-retry').addEventListener('click', function () {
        startGame(mode);
    });

    document.getElementById('btn-menu').addEventListener('click', function () {
        GameShell.showScreen('title-screen');
        CGameAudio.play('back');
    });

    // ── Observe resize ──
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(container);

    // ── Init touch ──
    setupTouch();

    // ── Initial resize ──
    resize();

})();
