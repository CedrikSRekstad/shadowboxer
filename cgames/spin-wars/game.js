/* === Spin Wars - Beyblade-style Battle Game === */
(function () {
    'use strict';

    // ---- Constants ----
    var ARENA_RATIO = 0.88;          // arena diameter relative to smallest canvas dimension
    var TOP_RADIUS = 22;             // base top radius in pixels
    var MAX_SPIN = 100;              // max spin value
    var SPIN_DECAY = 2.8;            // spin lost per second naturally
    var FRICTION = 0.985;            // velocity friction per frame (at 60fps equiv)
    var STEER_FORCE = 600;           // force applied by player input (px/s^2)
    var EDGE_PULL = 280;             // force pulling toward edge in danger zone
    var EDGE_SPIN_DRAIN = 12;        // extra spin lost per second when touching arena wall
    var COLLISION_SPIN_DRAIN = 6;    // spin drained from weaker top on collision
    var BOUNCE_RESTITUTION = 0.75;   // how bouncy collisions are
    var WOBBLE_THRESHOLD = 25;       // spin level below which wobble starts
    var TRAIL_LENGTH = 12;           // number of trail points
    var SPARK_COUNT = 8;             // sparks per collision
    var ROUNDS_TO_WIN = 2;           // best of 3
    var COUNTDOWN_SECS = 3;
    var DT_CAP = 50;                 // max delta time in ms

    // ---- Visual Enhancement State ----
    var screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
    var confettiParticles = [];
    var winnerGlow = { active: false, index: -1, intensity: 0 };
    var arenaGlowPhase = 0;

    // ---- State ----
    var canvas, ctx;
    var W, H;                        // canvas dimensions
    var arenaX, arenaY, arenaR;      // arena center and radius
    var mode = '1p';                 // '1p' or '2p'
    var paused = false;
    var gameRunning = false;
    var roundScores = [0, 0];        // [p1 wins, p2 wins]
    var currentRound = 1;
    var tops = [];                   // [top1, top2]
    var particles = [];
    var keys = {};
    var lastTime = 0;
    var countdownTimer = 0;
    var countdownValue = 0;
    var roundEndTimer = 0;
    var roundWinner = -1;

    // Touch joystick state
    var joysticks = [
        { active: false, touchId: null, baseX: 0, baseY: 0, knobX: 0, knobY: 0, dx: 0, dy: 0 },
        { active: false, touchId: null, baseX: 0, baseY: 0, knobX: 0, knobY: 0, dx: 0, dy: 0 }
    ];

    // ---- CSS Variable Helpers ----
    function getCSSColor(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    // ---- Color Utilities for Metallic Gradients ----
    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var num = parseInt(hex, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function rgbToString(rgb, a) {
        if (a !== undefined) {
            return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
        }
        return 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
    }

    function lightenColor(rgb, amount) {
        return {
            r: Math.min(255, rgb.r + Math.floor((255 - rgb.r) * amount)),
            g: Math.min(255, rgb.g + Math.floor((255 - rgb.g) * amount)),
            b: Math.min(255, rgb.b + Math.floor((255 - rgb.b) * amount))
        };
    }

    function darkenColor(rgb, amount) {
        return {
            r: Math.max(0, Math.floor(rgb.r * (1 - amount))),
            g: Math.max(0, Math.floor(rgb.g * (1 - amount))),
            b: Math.max(0, Math.floor(rgb.b * (1 - amount)))
        };
    }

    // ---- Top Factory ----
    function createTop(index, x, y) {
        return {
            index: index,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            spin: MAX_SPIN,
            angle: 0,              // visual rotation angle
            radius: TOP_RADIUS,
            alive: true,
            wobbleOffset: 0,
            trail: [],
            flashTimer: 0          // hit flash
        };
    }

    // ---- Particle Factory ----
    function spawnSparks(x, y, count, nx, ny) {
        // nx, ny: optional collision normal direction for directional sparks
        for (var i = 0; i < count; i++) {
            var angle;
            if (nx !== undefined && ny !== undefined) {
                // Directional sparks: spread around the collision normal
                var baseAngle = Math.atan2(ny, nx);
                angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.8;
            } else {
                angle = Math.random() * Math.PI * 2;
            }
            var speed = 80 + Math.random() * 200;
            var colorRand = Math.random();
            var sparkColor;
            if (colorRand < 0.3) {
                sparkColor = '#ffffff';
            } else if (colorRand < 0.65) {
                sparkColor = '#ffdd00';
            } else {
                sparkColor = '#ff8800';
            }
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.3 + Math.random() * 0.3,
                size: 2 + Math.random() * 3,
                color: sparkColor,
                type: 'spark'
            });
        }
    }

    function spawnElimSparks(x, y) {
        for (var i = 0; i < 20; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 50 + Math.random() * 300;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 0.5 + Math.random() * 0.5,
                size: 3 + Math.random() * 4,
                color: Math.random() < 0.3 ? '#ffffff' : (Math.random() < 0.5 ? '#ffdd00' : '#ff4444'),
                type: 'spark'
            });
        }
    }

    // ---- Confetti Spawner ----
    function spawnConfetti(x, y, count) {
        var confettiColors = ['#ff4444', '#44ff44', '#4488ff', '#ffdd00', '#ff88ff', '#44ffff', '#ffffff', '#ff8800'];
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 100 + Math.random() * 300;
            confettiParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100 - Math.random() * 150,
                life: 1.5 + Math.random() * 1.0,
                maxLife: 1.5 + Math.random() * 1.0,
                size: 3 + Math.random() * 5,
                color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 10,
                gravity: 200 + Math.random() * 100,
                width: 4 + Math.random() * 6,
                height: 2 + Math.random() * 3
            });
        }
    }

    // ---- Screen Shake Trigger ----
    function triggerScreenShake(intensity) {
        screenShake.intensity = Math.min(screenShake.intensity + intensity, 15);
    }

    // ---- Resize ----
    function resize() {
        var container = document.getElementById('canvas-container');
        var rect = container.getBoundingClientRect();
        W = Math.floor(rect.width);
        H = Math.floor(rect.height);
        if (W < 1) W = 400;
        if (H < 1) H = 400;
        canvas.width = W;
        canvas.height = H;
        var minDim = Math.min(W, H);
        arenaR = Math.floor(minDim * ARENA_RATIO / 2);
        arenaX = Math.floor(W / 2);
        arenaY = Math.floor(H / 2);
    }

    // ---- Round Setup ----
    function setupRound() {
        var offset = arenaR * 0.45;
        tops = [
            createTop(0, arenaX - offset, arenaY),
            createTop(1, arenaX + offset, arenaY)
        ];
        particles = [];
        confettiParticles = [];
        winnerGlow = { active: false, index: -1, intensity: 0 };
        roundWinner = -1;
        roundEndTimer = 0;
    }

    // ---- Countdown ----
    function startCountdown(cb) {
        countdownValue = COUNTDOWN_SECS;
        countdownTimer = 1;
        var overlay = document.getElementById('countdown-overlay');
        var numEl = document.getElementById('countdown-number');
        overlay.classList.remove('hidden');
        numEl.textContent = countdownValue;
        CGameAudio.play('countdown');

        var interval = setInterval(function () {
            countdownValue--;
            if (countdownValue > 0) {
                numEl.textContent = countdownValue;
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
                CGameAudio.play('countdown');
            } else {
                numEl.textContent = 'GO!';
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
                CGameAudio.play('select');
                setTimeout(function () {
                    overlay.classList.add('hidden');
                    countdownTimer = 0;
                    if (cb) cb();
                }, 400);
                clearInterval(interval);
            }
        }, 800);
    }

    // ---- Input ----
    function setupInput() {
        document.addEventListener('keydown', function (e) {
            keys[e.key] = true;
            keys[e.code] = true;
            // Prevent arrow scrolling
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) {
                e.preventDefault();
            }
        });
        document.addEventListener('keyup', function (e) {
            keys[e.key] = false;
            keys[e.code] = false;
        });

        // Touch joysticks
        var canvasContainer = document.getElementById('canvas-container');
        canvasContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvasContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvasContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvasContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    function handleTouchStart(e) {
        if (!gameRunning || paused || countdownTimer > 0) return;
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var tx = t.clientX - rect.left;
            var ty = t.clientY - rect.top;
            // Left half = P1, Right half = P2
            var playerIdx = (tx < W / 2) ? 0 : 1;
            // In 1P mode, only P1 joystick works (AI controls P2)
            if (mode === '1p' && playerIdx === 1) continue;
            var j = joysticks[playerIdx];
            if (!j.active) {
                j.active = true;
                j.touchId = t.identifier;
                j.baseX = tx;
                j.baseY = ty;
                j.knobX = tx;
                j.knobY = ty;
                j.dx = 0;
                j.dy = 0;
            }
        }
    }

    function handleTouchMove(e) {
        if (!gameRunning || paused) return;
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            for (var p = 0; p < 2; p++) {
                var j = joysticks[p];
                if (j.active && j.touchId === t.identifier) {
                    var tx = t.clientX - rect.left;
                    var ty = t.clientY - rect.top;
                    var maxR = 50;
                    var ddx = tx - j.baseX;
                    var ddy = ty - j.baseY;
                    var dist = Math.sqrt(ddx * ddx + ddy * ddy);
                    if (dist > maxR) {
                        ddx = ddx / dist * maxR;
                        ddy = ddy / dist * maxR;
                    }
                    j.knobX = j.baseX + ddx;
                    j.knobY = j.baseY + ddy;
                    j.dx = ddx / maxR;
                    j.dy = ddy / maxR;
                }
            }
        }
    }

    function handleTouchEnd(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            for (var p = 0; p < 2; p++) {
                var j = joysticks[p];
                if (j.active && j.touchId === t.identifier) {
                    j.active = false;
                    j.touchId = null;
                    j.dx = 0;
                    j.dy = 0;
                }
            }
        }
    }

    function getPlayerInput(index) {
        var dx = 0, dy = 0;

        // Touch joystick
        if (joysticks[index].active) {
            dx = joysticks[index].dx;
            dy = joysticks[index].dy;
            return { dx: dx, dy: dy };
        }

        // Keyboard
        if (index === 0) {
            if (keys['a'] || keys['A'] || keys['KeyA']) dx -= 1;
            if (keys['d'] || keys['D'] || keys['KeyD']) dx += 1;
            if (keys['w'] || keys['W'] || keys['KeyW']) dy -= 1;
            if (keys['s'] || keys['S'] || keys['KeyS']) dy += 1;
        } else {
            if (keys['ArrowLeft']) dx -= 1;
            if (keys['ArrowRight']) dx += 1;
            if (keys['ArrowUp']) dy -= 1;
            if (keys['ArrowDown']) dy += 1;
        }

        // Normalize diagonal
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) { dx /= len; dy /= len; }

        return { dx: dx, dy: dy };
    }

    // ---- AI ----
    function getAIInput(aiTop, playerTop) {
        if (!aiTop.alive || !playerTop.alive) return { dx: 0, dy: 0 };

        var toCenterX = arenaX - aiTop.x;
        var toCenterY = arenaY - aiTop.y;
        var centerDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

        var toPlayerX = playerTop.x - aiTop.x;
        var toPlayerY = playerTop.y - aiTop.y;
        var playerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);

        var dx = 0, dy = 0;
        var spinRatio = aiTop.spin / MAX_SPIN;
        var pSpinRatio = playerTop.spin / MAX_SPIN;

        // Determine strategy
        var aggressive = (spinRatio > pSpinRatio + 0.1) || (spinRatio > 0.4 && pSpinRatio < 0.3);
        var defensive = (spinRatio < pSpinRatio - 0.15) || (spinRatio < 0.25);

        if (aggressive && playerDist > 10) {
            // Rush toward player
            dx = toPlayerX / playerDist;
            dy = toPlayerY / playerDist;
            // Try to push player toward edge
            var pEdgeDist = arenaR - Math.sqrt(
                (playerTop.x - arenaX) * (playerTop.x - arenaX) +
                (playerTop.y - arenaY) * (playerTop.y - arenaY)
            );
            if (pEdgeDist < arenaR * 0.35) {
                // Player is near edge, go aggressive
                dx = toPlayerX / playerDist;
                dy = toPlayerY / playerDist;
            }
        } else if (defensive) {
            // Move toward center to stay safe
            if (centerDist > arenaR * 0.25) {
                dx = toCenterX / centerDist;
                dy = toCenterY / centerDist;
            }
            // If player is too close, dodge sideways
            if (playerDist < arenaR * 0.4) {
                var perpX = -toPlayerY / playerDist;
                var perpY = toPlayerX / playerDist;
                dx += perpX * 0.6;
                dy += perpY * 0.6;
            }
        } else {
            // Balanced: orbit near center, occasionally attack
            if (centerDist > arenaR * 0.35) {
                dx += toCenterX / centerDist * 0.5;
                dy += toCenterY / centerDist * 0.5;
            }
            // Approach player when close enough
            if (playerDist < arenaR * 0.6) {
                dx += toPlayerX / playerDist * 0.5;
                dy += toPlayerY / playerDist * 0.5;
            }
        }

        // Avoid the edge
        if (centerDist > arenaR * 0.65) {
            var edgeWeight = (centerDist - arenaR * 0.65) / (arenaR * 0.35);
            dx += (toCenterX / centerDist) * edgeWeight * 1.5;
            dy += (toCenterY / centerDist) * edgeWeight * 1.5;
        }

        // Normalize
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) { dx /= len; dy /= len; }

        // Slight imperfection
        dx += (Math.random() - 0.5) * 0.15;
        dy += (Math.random() - 0.5) * 0.15;

        len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) { dx /= len; dy /= len; }

        return { dx: dx, dy: dy };
    }

    // ---- Physics Update ----
    function update(dt) {
        if (paused || countdownTimer > 0 || !gameRunning) return;

        // Update arena glow phase
        arenaGlowPhase += dt * 3;

        // Update screen shake
        if (screenShake.intensity > 0.1) {
            screenShake.x = (Math.random() - 0.5) * 2 * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * 2 * screenShake.intensity;
            screenShake.intensity *= Math.pow(screenShake.decay, dt * 60);
        } else {
            screenShake.x = 0;
            screenShake.y = 0;
            screenShake.intensity = 0;
        }

        // Update winner glow
        if (winnerGlow.active) {
            winnerGlow.intensity = Math.min(winnerGlow.intensity + dt * 3, 1);
        }

        // Handle round end timer
        if (roundWinner >= 0) {
            roundEndTimer -= dt;
            if (roundEndTimer <= 0) {
                finishRound();
            }
            updateParticles(dt);
            updateConfetti(dt);
            return;
        }

        var aliveCount = 0;
        var aliveIdx = -1;

        for (var i = 0; i < 2; i++) {
            var top = tops[i];
            if (!top.alive) continue;

            // Get input
            var input;
            if (i === 1 && mode === '1p') {
                input = getAIInput(tops[1], tops[0]);
            } else {
                input = getPlayerInput(i);
            }

            // Apply steering force
            var forceMul = STEER_FORCE * (0.5 + 0.5 * (top.spin / MAX_SPIN)); // weaker steering when low spin
            top.vx += input.dx * forceMul * dt;
            top.vy += input.dy * forceMul * dt;

            // Apply friction (frame-rate independent)
            var frictionFactor = Math.pow(FRICTION, dt * 60);
            top.vx *= frictionFactor;
            top.vy *= frictionFactor;

            // Update position
            top.x += top.vx * dt;
            top.y += top.vy * dt;

            // Spin decay
            top.spin -= SPIN_DECAY * dt;

            // Distance from arena center
            var ddx = top.x - arenaX;
            var ddy = top.y - arenaY;
            var dist = Math.sqrt(ddx * ddx + ddy * ddy);

            // Edge danger zone: pull toward edge and drain spin
            var edgeBoundary = arenaR * 0.7;
            if (dist > edgeBoundary) {
                var edgeRatio = (dist - edgeBoundary) / (arenaR - edgeBoundary);
                edgeRatio = Math.min(edgeRatio, 1);
                // Slight outward pull (slippery edge)
                var nx = ddx / dist;
                var ny = ddy / dist;
                top.vx += nx * EDGE_PULL * edgeRatio * dt;
                top.vy += ny * EDGE_PULL * edgeRatio * dt;
                // Extra spin drain near edge
                top.spin -= EDGE_SPIN_DRAIN * edgeRatio * dt;
            }

            // Arena boundary collision
            if (dist + top.radius > arenaR) {
                var nx2 = ddx / dist;
                var ny2 = ddy / dist;
                // Push back inside
                top.x = arenaX + nx2 * (arenaR - top.radius);
                top.y = arenaY + ny2 * (arenaR - top.radius);
                // Reflect velocity
                var dot = top.vx * nx2 + top.vy * ny2;
                if (dot > 0) {
                    top.vx -= 2 * dot * nx2 * BOUNCE_RESTITUTION;
                    top.vy -= 2 * dot * ny2 * BOUNCE_RESTITUTION;
                    top.spin -= 3; // lose spin on wall hit
                    CGameAudio.play('bounce');
                    spawnSparks(top.x + nx2 * top.radius, top.y + ny2 * top.radius, 3);
                    triggerScreenShake(Math.min(Math.sqrt(dot * dot) * 0.02, 6));
                }
            }

            // Check if pushed out (should not happen after clamping, but fallback)
            if (dist > arenaR + top.radius * 2) {
                top.alive = false;
                spawnElimSparks(top.x, top.y);
                CGameAudio.play('lose');
            }

            // Check spin death
            if (top.spin <= 0) {
                top.spin = 0;
                top.alive = false;
                spawnElimSparks(top.x, top.y);
                CGameAudio.play('lose');
            }

            // Visual rotation
            top.angle += (top.spin / MAX_SPIN) * 15 * dt;

            // Wobble when spin is low
            if (top.spin < WOBBLE_THRESHOLD && top.alive) {
                top.wobbleOffset = (Math.random() - 0.5) * (1 - top.spin / WOBBLE_THRESHOLD) * 4;
            } else {
                top.wobbleOffset = 0;
            }

            // Trail
            top.trail.push({ x: top.x, y: top.y });
            if (top.trail.length > TRAIL_LENGTH) top.trail.shift();

            // Flash timer
            if (top.flashTimer > 0) top.flashTimer -= dt;

            if (top.alive) {
                aliveCount++;
                aliveIdx = i;
            }
        }

        // Top-to-top collision
        if (tops[0].alive && tops[1].alive) {
            var t1 = tops[0], t2 = tops[1];
            var cdx = t2.x - t1.x;
            var cdy = t2.y - t1.y;
            var cdist = Math.sqrt(cdx * cdx + cdy * cdy);
            var minDist = t1.radius + t2.radius;

            if (cdist < minDist && cdist > 0.1) {
                // Separate
                var overlap = minDist - cdist;
                var cnx = cdx / cdist;
                var cny = cdy / cdist;
                t1.x -= cnx * overlap / 2;
                t1.y -= cny * overlap / 2;
                t2.x += cnx * overlap / 2;
                t2.y += cny * overlap / 2;

                // Relative velocity along collision normal
                var relVx = t1.vx - t2.vx;
                var relVy = t1.vy - t2.vy;
                var relDot = relVx * cnx + relVy * cny;

                // Only resolve if moving toward each other
                if (relDot > 0) {
                    // Spin-based knockback: higher spin = more force dealt
                    var spin1Ratio = t1.spin / MAX_SPIN;
                    var spin2Ratio = t2.spin / MAX_SPIN;

                    var knockback1 = BOUNCE_RESTITUTION * (0.5 + spin2Ratio * 0.8);
                    var knockback2 = BOUNCE_RESTITUTION * (0.5 + spin1Ratio * 0.8);

                    t1.vx -= cnx * relDot * knockback1;
                    t1.vy -= cny * relDot * knockback1;
                    t2.vx += cnx * relDot * knockback2;
                    t2.vy += cny * relDot * knockback2;

                    // Spin drain: weaker top loses more spin
                    if (t1.spin > t2.spin) {
                        t2.spin -= COLLISION_SPIN_DRAIN * spin1Ratio;
                        t1.spin -= COLLISION_SPIN_DRAIN * 0.2;
                    } else {
                        t1.spin -= COLLISION_SPIN_DRAIN * spin2Ratio;
                        t2.spin -= COLLISION_SPIN_DRAIN * 0.2;
                    }

                    t1.spin = Math.max(0, t1.spin);
                    t2.spin = Math.max(0, t2.spin);

                    t1.flashTimer = 0.1;
                    t2.flashTimer = 0.1;

                    // Directional sparks at collision point
                    var mx = (t1.x + t2.x) / 2;
                    var my = (t1.y + t2.y) / 2;
                    // Spawn sparks flying away from both tops
                    spawnSparks(mx, my, SPARK_COUNT / 2, cnx, cny);
                    spawnSparks(mx, my, SPARK_COUNT / 2, -cnx, -cny);
                    CGameAudio.play('hit');

                    // Screen shake proportional to impact speed
                    var impactSpeed = Math.abs(relDot);
                    triggerScreenShake(Math.min(impactSpeed * 0.03, 10));
                }
            }
        }

        // Update particles
        updateParticles(dt);
        updateConfetti(dt);

        // Update spin bars
        document.getElementById('spin-bar-p1').style.width = (tops[0].spin / MAX_SPIN * 100) + '%';
        document.getElementById('spin-bar-p2').style.width = (tops[1].spin / MAX_SPIN * 100) + '%';

        // Check round end
        if (aliveCount <= 1 && roundWinner < 0) {
            if (aliveCount === 1) {
                roundWinner = aliveIdx;
                // Spawn confetti around winner
                var winner = tops[aliveIdx];
                spawnConfetti(winner.x, winner.y, 60);
                winnerGlow = { active: true, index: aliveIdx, intensity: 0 };
            } else {
                // Both died - draw, nobody scores
                roundWinner = -2;
            }
            roundEndTimer = 1.5;
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function updateConfetti(dt) {
        for (var i = confettiParticles.length - 1; i >= 0; i--) {
            var p = confettiParticles[i];
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.98;
            p.rotation += p.rotSpeed * dt;
            p.life -= dt;
            if (p.life <= 0) {
                confettiParticles.splice(i, 1);
            }
        }
    }

    function finishRound() {
        if (roundWinner >= 0) {
            roundScores[roundWinner]++;
            var winnerName = roundWinner === 0 ? 'P1' : 'P2';
            showRoundOverlay(winnerName + ' wins the round!');
            CGameAudio.play('score');
        } else {
            showRoundOverlay('Draw!');
        }
        updateScoreDisplay();

        // Check match win
        if (roundScores[0] >= ROUNDS_TO_WIN || roundScores[1] >= ROUNDS_TO_WIN) {
            setTimeout(function () {
                endMatch();
            }, 1800);
            return;
        }

        // Next round
        currentRound++;
        document.getElementById('round-info').textContent = 'Round ' + currentRound;
        setTimeout(function () {
            hideRoundOverlay();
            setupRound();
            startCountdown(function () {
                // round is live
            });
        }, 1800);
    }

    function showRoundOverlay(text) {
        var overlay = document.getElementById('round-overlay');
        var textEl = document.getElementById('round-text');
        textEl.textContent = text;
        overlay.classList.remove('hidden');
    }

    function hideRoundOverlay() {
        document.getElementById('round-overlay').classList.add('hidden');
    }

    function endMatch() {
        gameRunning = false;
        hideRoundOverlay();
        var winner = roundScores[0] >= ROUNDS_TO_WIN ? 0 : 1;
        var winnerName = winner === 0 ? 'Player 1' : 'Player 2';
        if (mode === '1p' && winner === 1) winnerName = 'CPU';

        document.getElementById('winner-text').textContent = winnerName + ' Wins!';
        document.getElementById('winner-text').style.color =
            winner === 0 ? getCSSColor('--p1-color') : getCSSColor('--p2-color');
        document.getElementById('final-score').textContent = roundScores[0] + ' - ' + roundScores[1];

        CGameAudio.play(winner === 0 ? 'win' : (mode === '1p' ? 'lose' : 'win'));
        GameShell.showScreen('gameover-screen');
    }

    function updateScoreDisplay() {
        document.getElementById('score-p1').textContent = roundScores[0];
        document.getElementById('score-p2').textContent = roundScores[1];
    }

    // ---- Draw ----
    function draw() {
        // Background
        ctx.fillStyle = getCSSColor('--canvas-bg');
        ctx.fillRect(0, 0, W, H);

        // Apply screen shake
        ctx.save();
        ctx.translate(screenShake.x, screenShake.y);

        drawArena();

        // Trails
        for (var i = 0; i < 2; i++) {
            drawTrail(tops[i]);
        }

        // Speed blur / motion lines
        for (var ib = 0; ib < 2; ib++) {
            drawSpeedBlur(tops[ib]);
        }

        // Tops
        for (var i2 = 0; i2 < 2; i2++) {
            drawTop(tops[i2]);
        }

        // Particles
        drawParticles();

        // Confetti
        drawConfetti();

        // End screen shake transform
        ctx.restore();

        // Touch joysticks (drawn outside shake transform)
        drawJoysticks();
    }

    function drawArena() {
        var isDark = document.body.getAttribute('data-theme') !== 'light';

        // Outer shadow
        ctx.save();
        ctx.beginPath();
        ctx.arc(arenaX, arenaY, arenaR + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();

        // Arena base with radial gradient for depth
        var baseGrad = ctx.createRadialGradient(arenaX, arenaY - arenaR * 0.15, arenaR * 0.1, arenaX, arenaY, arenaR);
        if (isDark) {
            baseGrad.addColorStop(0, '#252545');
            baseGrad.addColorStop(0.6, '#1a1a30');
            baseGrad.addColorStop(1, '#111125');
        } else {
            baseGrad.addColorStop(0, '#e0e4f0');
            baseGrad.addColorStop(0.6, '#d0d4e0');
            baseGrad.addColorStop(1, '#b8bcc8');
        }
        ctx.beginPath();
        ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // Textured floor: concentric rings with alternating subtle shade differences
        var ringCount = 14;
        for (var r = ringCount; r >= 1; r--) {
            var ringR = (arenaR / (ringCount + 1)) * r;
            ctx.beginPath();
            ctx.arc(arenaX, arenaY, ringR, 0, Math.PI * 2);
            if (r % 2 === 0) {
                ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.018)' : 'rgba(0, 0, 0, 0.018)';
            } else {
                ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.025)' : 'rgba(255, 255, 255, 0.025)';
            }
            ctx.fill();
        }

        // Concentric ring lines (visible guide rings)
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
        ctx.lineWidth = 1;
        var guideRingCount = 5;
        for (var gr = 1; gr <= guideRingCount; gr++) {
            ctx.beginPath();
            ctx.arc(arenaX, arenaY, (arenaR / (guideRingCount + 1)) * gr, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Danger zone ring (red tint near edge)
        var dangerStart = arenaR * 0.7;
        var gradient = ctx.createRadialGradient(arenaX, arenaY, dangerStart, arenaX, arenaY, arenaR);
        gradient.addColorStop(0, 'rgba(255, 50, 50, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.06)');
        gradient.addColorStop(1, 'rgba(255, 50, 50, 0.18)');
        ctx.beginPath();
        ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Pulsing red glow on arena edge
        var pulseVal = 0.5 + 0.5 * Math.sin(arenaGlowPhase);
        var edgeGlowAlpha = 0.15 + pulseVal * 0.2;
        ctx.beginPath();
        ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 40, 40, ' + edgeGlowAlpha + ')';
        ctx.lineWidth = 4 + pulseVal * 3;
        ctx.shadowColor = 'rgba(255, 40, 40, ' + (edgeGlowAlpha * 0.8) + ')';
        ctx.shadowBlur = 12 + pulseVal * 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Center dot
        ctx.beginPath();
        ctx.arc(arenaX, arenaY, 4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
        ctx.fill();

        // Arena border ring (on top of glow)
        ctx.beginPath();
        ctx.arc(arenaX, arenaY, arenaR, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    function drawTrail(top) {
        if (!top.alive || top.trail.length < 2) return;
        var color = top.index === 0 ? getCSSColor('--p1-color') : getCSSColor('--p2-color');
        var rgb = hexToRgb(color);
        var spinRatio = top.spin / MAX_SPIN;

        ctx.save();
        ctx.lineCap = 'round';
        for (var i = 1; i < top.trail.length; i++) {
            var progress = i / top.trail.length;
            var alpha = progress * 0.4 * spinRatio;
            // Wider when spinning faster
            var width = top.radius * (0.3 + spinRatio * 0.5) * progress;
            ctx.beginPath();
            ctx.moveTo(top.trail[i - 1].x, top.trail[i - 1].y);
            ctx.lineTo(top.trail[i].x, top.trail[i].y);
            ctx.strokeStyle = rgbToString(rgb, alpha);
            ctx.lineWidth = width;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawSpeedBlur(top) {
        if (!top.alive) return;
        var speed = Math.sqrt(top.vx * top.vx + top.vy * top.vy);
        var speedThreshold = 80;
        if (speed < speedThreshold) return;

        var speedFactor = Math.min((speed - speedThreshold) / 300, 1);
        var color = top.index === 0 ? getCSSColor('--p1-color') : getCSSColor('--p2-color');
        var rgb = hexToRgb(color);
        var x = top.x + top.wobbleOffset;
        var y = top.y + top.wobbleOffset;

        // Normalize velocity to get motion direction
        var nvx = -top.vx / speed;
        var nvy = -top.vy / speed;

        ctx.save();
        // Draw motion lines behind the top
        var lineCount = 3 + Math.floor(speedFactor * 4);
        for (var i = 0; i < lineCount; i++) {
            // Perpendicular offset for spread
            var perpX = -nvy;
            var perpY = nvx;
            var spreadOffset = (i / (lineCount - 1) - 0.5) * top.radius * 1.4;

            var startX = x + perpX * spreadOffset + nvx * top.radius;
            var startY = y + perpY * spreadOffset + nvy * top.radius;
            var lineLen = 10 + speedFactor * 30 + Math.random() * 10;
            var endX = startX + nvx * lineLen;
            var endY = startY + nvy * lineLen;

            var alpha = speedFactor * 0.3 * (1 - Math.abs(i / (lineCount - 1) - 0.5) * 2);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = rgbToString(rgb, alpha);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawTop(top) {
        if (!top.alive) return;

        var x = top.x + top.wobbleOffset;
        var y = top.y + top.wobbleOffset;
        var r = top.radius;
        var spinRatio = top.spin / MAX_SPIN;
        var baseColor = top.index === 0 ? getCSSColor('--p1-color') : getCSSColor('--p2-color');
        var baseRgb = hexToRgb(baseColor);
        var highlightRgb = lightenColor(baseRgb, 0.7);
        var darkRgb = darkenColor(baseRgb, 0.5);

        ctx.save();

        // Winner glow
        if (winnerGlow.active && winnerGlow.index === top.index) {
            var glowPulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.008);
            var glowAlpha = winnerGlow.intensity * glowPulse * 0.6;
            ctx.beginPath();
            ctx.arc(x, y, r + 18, 0, Math.PI * 2);
            ctx.fillStyle = rgbToString(highlightRgb, glowAlpha * 0.3);
            ctx.shadowColor = rgbToString(baseRgb, glowAlpha);
            ctx.shadowBlur = 30 * winnerGlow.intensity;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // Glow when flash (collision hit)
        if (top.flashTimer > 0) {
            ctx.beginPath();
            ctx.arc(x, y, r + 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (top.flashTimer * 3) + ')';
            ctx.shadowColor = 'rgba(255, 255, 255, ' + (top.flashTimer * 2) + ')';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // Spin ring background track
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Spin ring (shows remaining spin as arc) with glow and pulse
        var spinPulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005 * (1 + spinRatio * 3));
        ctx.beginPath();
        ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * spinRatio);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 6 + spinPulse * 8 * spinRatio;
        ctx.globalAlpha = 0.7 + spinPulse * 0.3 * spinRatio;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Speed lines / motion blur around top when spinning fast
        if (spinRatio > 0.4) {
            var lineAlpha = (spinRatio - 0.4) / 0.6 * 0.25;
            var speedLineCount = 6 + Math.floor(spinRatio * 6);
            ctx.globalAlpha = lineAlpha;
            ctx.strokeStyle = rgbToString(highlightRgb, 1);
            ctx.lineWidth = 1;
            for (var sl = 0; sl < speedLineCount; sl++) {
                var slAngle = top.angle + (sl / speedLineCount) * Math.PI * 2;
                var slR1 = r + 2;
                var slR2 = r + 5 + spinRatio * 6;
                var arcSpread = 0.15 + spinRatio * 0.2;
                ctx.beginPath();
                ctx.arc(x, y, slR1 + (slR2 - slR1) * 0.5, slAngle - arcSpread, slAngle + arcSpread);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // Main body: metallic gradient (highlight offset from center)
        var highlightOffX = -r * 0.3;
        var highlightOffY = -r * 0.3;
        var bodyGrad = ctx.createRadialGradient(
            x + highlightOffX, y + highlightOffY, r * 0.05,
            x, y, r
        );
        bodyGrad.addColorStop(0, rgbToString(lightenColor(baseRgb, 0.85)));  // bright highlight
        bodyGrad.addColorStop(0.25, rgbToString(lightenColor(baseRgb, 0.4)));
        bodyGrad.addColorStop(0.55, rgbToString(baseRgb));
        bodyGrad.addColorStop(0.85, rgbToString(darkenColor(baseRgb, 0.3)));
        bodyGrad.addColorStop(1, rgbToString(darkRgb));  // dark edge

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Concentric groove rings on top surface
        var grooveCount = 4;
        for (var gi = 1; gi <= grooveCount; gi++) {
            var grooveR = r * (gi / (grooveCount + 1));
            ctx.beginPath();
            ctx.arc(x, y, grooveR, 0, Math.PI * 2);
            if (gi % 2 === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            } else {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            }
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Spinning cross lines (shows rotation)
        ctx.translate(x, y);
        ctx.rotate(top.angle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        for (var l = 0; l < 3; l++) {
            var lineAngle = (l * Math.PI * 2) / 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(lineAngle) * r * 0.55, Math.sin(lineAngle) * r * 0.55);
            ctx.stroke();
        }

        // Center dot with metallic specular highlight
        var centerGrad = ctx.createRadialGradient(-1, -1, 0, 0, 0, 4);
        centerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        centerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
        centerGrad.addColorStop(1, 'rgba(200, 200, 200, 0.3)');
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = centerGrad;
        ctx.fill();

        ctx.restore();

        // Low spin warning pulsing ring
        if (top.spin < WOBBLE_THRESHOLD) {
            var pulseAlpha = (1 - top.spin / WOBBLE_THRESHOLD) * 0.5 * (0.5 + 0.5 * Math.sin(Date.now() * 0.01));
            ctx.beginPath();
            ctx.arc(x, y, r + 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 80, 80, ' + pulseAlpha + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    function drawParticles() {
        ctx.save();
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            // Add glow to spark particles
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6 * alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.restore();
    }

    function drawConfetti() {
        if (confettiParticles.length === 0) return;
        ctx.save();
        for (var i = 0; i < confettiParticles.length; i++) {
            var p = confettiParticles[i];
            var alpha = Math.min(1, p.life / (p.maxLife * 0.3));
            ctx.globalAlpha = alpha;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            ctx.restore();
        }
        ctx.restore();
    }

    function drawJoysticks() {
        if (GameShell.getInputType() !== 'touch') return;

        ctx.save();
        for (var i = 0; i < 2; i++) {
            // In 1P mode, no joystick for P2
            if (mode === '1p' && i === 1) continue;

            var j = joysticks[i];
            if (!j.active) continue;

            var color = i === 0 ? getCSSColor('--p1-color') : getCSSColor('--p2-color');

            // Base circle
            ctx.beginPath();
            ctx.arc(j.baseX, j.baseY, 50, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Knob
            ctx.beginPath();
            ctx.arc(j.knobX, j.knobY, 22, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }

    // ---- Game Loop ----
    function gameLoop(timestamp) {
        if (!gameRunning && !roundEndTimer) {
            requestAnimationFrame(gameLoop);
            return;
        }

        if (!lastTime) lastTime = timestamp;
        var dtMs = timestamp - lastTime;
        if (dtMs > DT_CAP) dtMs = DT_CAP;
        var dt = dtMs / 1000;
        lastTime = timestamp;

        update(dt);
        draw();

        requestAnimationFrame(gameLoop);
    }

    // ---- Start Game ----
    function startGame(selectedMode) {
        mode = selectedMode;
        roundScores = [0, 0];
        currentRound = 1;
        paused = false;
        gameRunning = true;

        updateScoreDisplay();
        document.getElementById('round-info').textContent = 'Round 1';
        document.getElementById('spin-bar-p1').style.width = '100%';
        document.getElementById('spin-bar-p2').style.width = '100%';

        GameShell.showScreen('game-screen');
        resize();
        setupRound();

        lastTime = 0;
        startCountdown(function () {
            // game is now live
        });
    }

    // ---- Pause ----
    function togglePause() {
        if (!gameRunning) return;
        paused = !paused;
        document.getElementById('pause-overlay').classList.toggle('hidden', !paused);
    }

    // ---- Initialize ----
    function init() {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');

        GameShell.init({ backUrl: '../' });
        setupInput();

        // Title buttons
        document.getElementById('btn-1p').addEventListener('click', function () {
            CGameAudio.play('select');
            startGame('1p');
        });
        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('select');
            startGame('2p');
        });

        // Game buttons
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
            gameRunning = false;
            paused = false;
            document.getElementById('pause-overlay').classList.add('hidden');
            GameShell.showScreen('title-screen');
        });

        // Game Over buttons
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('select');
            startGame(mode);
        });
        document.getElementById('btn-menu').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('title-screen');
        });

        // Keyboard pause (Escape)
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && gameRunning) {
                togglePause();
            }
        });

        // Resize
        window.addEventListener('resize', function () {
            if (gameRunning) resize();
        });

        resize();
        requestAnimationFrame(gameLoop);
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
