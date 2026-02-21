/* === Slot Cars Racing Game === */
(function () {
    'use strict';

    // ── Constants ──
    var LAPS_TO_WIN = 3;
    var MAX_SPEED = 600;        // pixels per second along path
    var ACCELERATION = 400;     // px/s^2 while throttle held
    var FRICTION = 200;         // px/s^2 deceleration when released
    var STALL_TIME = 1.0;       // seconds stalled after flying off
    var LANE_OFFSET = 14;       // half-distance between inner/outer lane
    var TRACK_WIDTH = 52;       // visible road width
    var CAR_LENGTH = 18;
    var CAR_WIDTH = 10;
    var SAFE_SPEED_FACTOR = 14; // safeSpeed = sqrt(radius) * factor  (tuned)

    // ── Visual Constants ──
    var VIS_CAR_LENGTH = 24;
    var VIS_CAR_WIDTH = 13;
    var SMOKE_MAX = 200;
    var SPEED_LINE_MAX = 80;
    var SKID_TRAIL_MAX = 400;

    // ── State ──
    var mode = '1p';            // '1p' or '2p'
    var running = false;
    var paused = false;
    var gameOver = false;
    var countdown = 0;

    var canvas, ctx, cw, ch;
    var track = null;           // current track data
    var cars = [];              // [car0, car1]
    var skidMarks = [];         // persistent skid marks array
    var inputState = { p1: false, p2: false };
    var touchIds = { p1: null, p2: null };

    // ── Visual particle arrays ──
    var smokeParticles = [];
    var speedLines = [];
    var skidTrails = [[], []];  // per-car connected skid trails
    var finishLineTime = 0;     // animation timer for finish line

    // ── Track texture cache ──
    var trackTextureCanvas = null;
    var trackTextureDirty = true;

    // ── Track Definitions ──
    // Each track is an array of control points {x, y} in normalized 0-1 coords
    // They will be scaled to canvas size. We build a cubic Catmull-Rom spline.

    var trackDefs = [
        // Track 0: Oval with chicane
        {
            name: 'Speedway',
            points: [
                { x: 0.50, y: 0.15 },
                { x: 0.80, y: 0.15 },
                { x: 0.90, y: 0.30 },
                { x: 0.85, y: 0.50 },
                { x: 0.75, y: 0.55 },
                { x: 0.70, y: 0.65 },
                { x: 0.80, y: 0.80 },
                { x: 0.65, y: 0.90 },
                { x: 0.35, y: 0.90 },
                { x: 0.20, y: 0.80 },
                { x: 0.30, y: 0.65 },
                { x: 0.25, y: 0.55 },
                { x: 0.15, y: 0.50 },
                { x: 0.10, y: 0.30 },
                { x: 0.20, y: 0.15 }
            ]
        },
        // Track 1: Figure-8 ish
        {
            name: 'Twister',
            points: [
                { x: 0.50, y: 0.12 },
                { x: 0.75, y: 0.15 },
                { x: 0.88, y: 0.30 },
                { x: 0.80, y: 0.48 },
                { x: 0.60, y: 0.50 },
                { x: 0.40, y: 0.52 },
                { x: 0.20, y: 0.48 },
                { x: 0.12, y: 0.65 },
                { x: 0.25, y: 0.82 },
                { x: 0.50, y: 0.88 },
                { x: 0.75, y: 0.82 },
                { x: 0.88, y: 0.65 },
                { x: 0.80, y: 0.52 },
                { x: 0.60, y: 0.50 },
                { x: 0.40, y: 0.48 },
                { x: 0.20, y: 0.30 },
                { x: 0.25, y: 0.15 }
            ]
        },
        // Track 2: Tight technical circuit
        {
            name: 'Technical',
            points: [
                { x: 0.50, y: 0.12 },
                { x: 0.70, y: 0.12 },
                { x: 0.85, y: 0.20 },
                { x: 0.88, y: 0.38 },
                { x: 0.78, y: 0.45 },
                { x: 0.65, y: 0.40 },
                { x: 0.60, y: 0.50 },
                { x: 0.70, y: 0.60 },
                { x: 0.85, y: 0.65 },
                { x: 0.88, y: 0.80 },
                { x: 0.75, y: 0.90 },
                { x: 0.50, y: 0.85 },
                { x: 0.25, y: 0.90 },
                { x: 0.12, y: 0.80 },
                { x: 0.15, y: 0.60 },
                { x: 0.30, y: 0.50 },
                { x: 0.20, y: 0.35 },
                { x: 0.12, y: 0.20 },
                { x: 0.30, y: 0.12 }
            ]
        }
    ];

    // ── Catmull-Rom Spline Utilities ──

    function catmullRom(p0, p1, p2, p3, t) {
        var t2 = t * t;
        var t3 = t2 * t;
        return {
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    }

    function catmullRomDerivative(p0, p1, p2, p3, t) {
        var t2 = t * t;
        return {
            x: 0.5 * ((-p0.x + p2.x) +
                (4 * p0.x - 10 * p1.x + 8 * p2.x - 2 * p3.x) * t +
                (-3 * p0.x + 9 * p1.x - 9 * p2.x + 3 * p3.x) * t2),
            y: 0.5 * ((-p0.y + p2.y) +
                (4 * p0.y - 10 * p1.y + 8 * p2.y - 2 * p3.y) * t +
                (-3 * p0.y + 9 * p1.y - 9 * p2.y + 3 * p3.y) * t2)
        };
    }

    // Build a sampled path from control points (closed loop)
    function buildTrackPath(def, w, h) {
        var pts = def.points.map(function (p) {
            return { x: p.x * w, y: p.y * h };
        });
        var n = pts.length;
        var samples = [];
        var SEGMENTS_PER_SECTION = 30;

        for (var i = 0; i < n; i++) {
            var p0 = pts[(i - 1 + n) % n];
            var p1 = pts[i];
            var p2 = pts[(i + 1) % n];
            var p3 = pts[(i + 2) % n];
            for (var j = 0; j < SEGMENTS_PER_SECTION; j++) {
                var t = j / SEGMENTS_PER_SECTION;
                var pos = catmullRom(p0, p1, p2, p3, t);
                var der = catmullRomDerivative(p0, p1, p2, p3, t);
                var len = Math.sqrt(der.x * der.x + der.y * der.y);
                samples.push({
                    x: pos.x,
                    y: pos.y,
                    dx: der.x / len,
                    dy: der.y / len,
                    angle: Math.atan2(der.y, der.x)
                });
            }
        }

        // Compute cumulative arc lengths
        var totalLen = 0;
        var arcLengths = [0];
        for (var i = 1; i < samples.length; i++) {
            var dx = samples[i].x - samples[i - 1].x;
            var dy = samples[i].y - samples[i - 1].y;
            totalLen += Math.sqrt(dx * dx + dy * dy);
            arcLengths.push(totalLen);
        }
        // Close the loop
        var dxClose = samples[0].x - samples[samples.length - 1].x;
        var dyClose = samples[0].y - samples[samples.length - 1].y;
        totalLen += Math.sqrt(dxClose * dxClose + dyClose * dyClose);

        // Compute curvature at each sample (for safe speed calculations)
        for (var i = 0; i < samples.length; i++) {
            var prev = samples[(i - 1 + samples.length) % samples.length];
            var next = samples[(i + 1) % samples.length];
            // Change in angle
            var dAngle = next.angle - prev.angle;
            // Normalize to [-PI, PI]
            while (dAngle > Math.PI) dAngle -= 2 * Math.PI;
            while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
            // Arc distance between prev and next
            var segDx = next.x - prev.x;
            var segDy = next.y - prev.y;
            var segDist = Math.sqrt(segDx * segDx + segDy * segDy);
            if (segDist < 0.01) segDist = 0.01;
            var curvature = Math.abs(dAngle) / segDist;
            var radius = (curvature > 0.0001) ? (1 / curvature) : 99999;
            samples[i].radius = radius;
            samples[i].curvature = curvature;
            samples[i].safeSpeed = Math.min(MAX_SPEED, Math.sqrt(radius) * SAFE_SPEED_FACTOR);
        }

        return {
            samples: samples,
            arcLengths: arcLengths,
            totalLength: totalLen,
            name: def.name
        };
    }

    // Get position and direction at a given distance along the path
    function sampleAtDist(track, dist) {
        // Normalize dist to [0, totalLength)
        var d = dist % track.totalLength;
        if (d < 0) d += track.totalLength;

        var samples = track.samples;
        var arcs = track.arcLengths;

        // Binary search for the segment
        var lo = 0, hi = arcs.length - 1;
        while (lo < hi - 1) {
            var mid = (lo + hi) >> 1;
            if (arcs[mid] <= d) lo = mid;
            else hi = mid;
        }

        var segLen = arcs[hi] - arcs[lo];
        var t = (segLen > 0.001) ? (d - arcs[lo]) / segLen : 0;

        var s0 = samples[lo];
        var s1 = samples[hi % samples.length];

        return {
            x: s0.x + (s1.x - s0.x) * t,
            y: s0.y + (s1.y - s0.y) * t,
            angle: s0.angle + angleDiff(s0.angle, s1.angle) * t,
            dx: s0.dx + (s1.dx - s0.dx) * t,
            dy: s0.dy + (s1.dy - s0.dy) * t,
            radius: s0.radius + (s1.radius - s0.radius) * t,
            safeSpeed: s0.safeSpeed + (s1.safeSpeed - s0.safeSpeed) * t,
            index: lo
        };
    }

    function angleDiff(a, b) {
        var d = b - a;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return d;
    }

    // ── Car Object ──

    function createCar(playerIndex, laneSign) {
        return {
            player: playerIndex,       // 0 = P1, 1 = P2/AI
            dist: 0,                   // distance along track path
            speed: 0,                  // current speed (px/s)
            laneSign: laneSign,        // -1 = inner, +1 = outer
            lap: 0,
            stalled: 0,               // stall timer remaining
            stallFlash: 0,            // visual flash timer
            isAI: false,
            aiThrottle: false,
            x: 0, y: 0, angle: 0      // rendered position
        };
    }

    // ── AI Logic ──

    function updateAI(car, dt) {
        // Look ahead on the track to decide throttle
        var lookAhead = car.speed * 0.5 + 40; // look further at higher speed
        var ahead = sampleAtDist(track, car.dist + lookAhead);
        var safeSpd = ahead.safeSpeed;

        // AI personality: sometimes slightly aggressive, sometimes cautious
        // Use a deterministic wobble based on distance
        var wobble = Math.sin(car.dist * 0.005) * 0.15;
        var targetSpeed = safeSpd * (0.88 + wobble);

        if (car.speed < targetSpeed * 0.95) {
            car.aiThrottle = true;
        } else if (car.speed > targetSpeed) {
            car.aiThrottle = false;
        }

        // On straights, go full throttle
        if (ahead.radius > 200) {
            car.aiThrottle = true;
        }
    }

    // ── Canvas Setup ──

    function resizeCanvas() {
        var container = document.getElementById('canvas-container');
        var rect = container.getBoundingClientRect();
        var w = Math.floor(rect.width);
        var h = Math.floor(rect.height);
        canvas.width = w;
        canvas.height = h;
        cw = w;
        ch = h;
        trackTextureDirty = true;
    }

    // ── Game Init ──

    function startGame(selectedMode) {
        mode = selectedMode;
        gameOver = false;
        paused = false;
        running = true;
        skidMarks = [];
        smokeParticles = [];
        speedLines = [];
        skidTrails = [[], []];
        finishLineTime = 0;
        trackTextureDirty = true;

        // Show game screen FIRST so container has dimensions
        GameShell.showScreen('game-screen');
        resizeCanvas();

        // Pick random track
        var idx = Math.floor(Math.random() * trackDefs.length);
        track = buildTrackPath(trackDefs[idx], cw, ch);

        // Create cars
        cars = [
            createCar(0, -1),  // P1 inner lane
            createCar(1, 1)    // P2/AI outer lane
        ];

        if (mode === '1p') {
            cars[1].isAI = true;
        }

        // Position cars at start (small positive offset so lap detection works)
        cars[0].dist = 20;
        cars[1].dist = 5; // P2 slightly behind at start

        updateCarPositions();

        // Update HUD
        updateHUD();

        startCountdown();
    }

    function updateCarPositions() {
        for (var i = 0; i < cars.length; i++) {
            var car = cars[i];
            var s = sampleAtDist(track, car.dist);
            // Offset perpendicular to track direction for lane
            var perpX = -s.dy;
            var perpY = s.dx;
            car.x = s.x + perpX * car.laneSign * LANE_OFFSET;
            car.y = s.y + perpY * car.laneSign * LANE_OFFSET;
            car.angle = s.angle;
        }
    }

    // ── Countdown ──

    function startCountdown() {
        countdown = 3;
        running = false;

        var overlay = document.getElementById('countdown-overlay');
        var numEl = document.getElementById('countdown-number');
        overlay.classList.remove('hidden');
        numEl.textContent = '3';
        CGameAudio.play('countdown');

        var interval = setInterval(function () {
            countdown--;
            if (countdown > 0) {
                numEl.textContent = String(countdown);
                numEl.style.animation = 'none';
                void numEl.offsetWidth; // force reflow
                numEl.style.animation = '';
                CGameAudio.play('countdown');
            } else if (countdown === 0) {
                numEl.textContent = 'GO!';
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
                CGameAudio.play('score');
            } else {
                clearInterval(interval);
                overlay.classList.add('hidden');
                running = true;
            }
        }, 800);
    }

    // ── Update ──

    function update(dt) {
        if (!running || paused || gameOver) return;

        finishLineTime += dt;

        for (var i = 0; i < cars.length; i++) {
            var car = cars[i];

            // Handle stall
            if (car.stalled > 0) {
                car.stalled -= dt;
                car.stallFlash -= dt;
                car.speed = 0;
                if (car.stalled <= 0) {
                    car.stalled = 0;
                }
                // End skid trail on stall
                var trail = skidTrails[i];
                if (trail.length > 0 && trail[trail.length - 1] !== null) {
                    trail.push(null);
                }
                continue;
            }

            // Get throttle input
            var throttle = false;
            if (car.isAI) {
                updateAI(car, dt);
                throttle = car.aiThrottle;
            } else if (car.player === 0) {
                throttle = inputState.p1;
            } else {
                throttle = inputState.p2;
            }

            // Update speed
            if (throttle) {
                car.speed += ACCELERATION * dt;
            } else {
                car.speed -= FRICTION * dt;
            }
            if (car.speed > MAX_SPEED) car.speed = MAX_SPEED;
            if (car.speed < 0) car.speed = 0;

            // Check curve safety
            var s = sampleAtDist(track, car.dist);
            if (car.speed > s.safeSpeed * 1.15 && s.radius < 300) {
                // Flying off! Add skid marks and stall
                var perpX = -s.dy;
                var perpY = s.dx;
                var carX = s.x + perpX * car.laneSign * LANE_OFFSET;
                var carY = s.y + perpY * car.laneSign * LANE_OFFSET;

                // Add skid marks leading off track
                for (var sk = 0; sk < 8; sk++) {
                    skidMarks.push({
                        x: carX + (Math.random() - 0.5) * 12,
                        y: carY + (Math.random() - 0.5) * 12,
                        alpha: 0.6,
                        size: 2 + Math.random() * 3
                    });
                }

                // Burst of smoke on crash
                for (var sp = 0; sp < 12; sp++) {
                    smokeParticles.push({
                        x: carX + (Math.random() - 0.5) * 10,
                        y: carY + (Math.random() - 0.5) * 10,
                        vx: (Math.random() - 0.5) * 40,
                        vy: -Math.random() * 30 - 10,
                        life: 0.6 + Math.random() * 0.5,
                        maxLife: 1.1,
                        alpha: 0.7,
                        size: 4 + Math.random() * 5
                    });
                }

                // End skid trail segment
                var trail = skidTrails[i];
                if (trail.length > 0 && trail[trail.length - 1] !== null) {
                    trail.push(null);
                }

                CGameAudio.play('hit');
                car.stalled = STALL_TIME;
                car.stallFlash = STALL_TIME;
                car.speed = 0;
                continue;
            }

            // Move along track
            var prevDist = car.dist;
            car.dist += car.speed * dt;

            // Lap detection: check if we crossed the start/finish
            // We use raw dist (not modulo) to track laps via floor(dist / totalLength)
            var prevLapCount = Math.floor(prevDist / track.totalLength);
            var curLapCount = Math.floor(car.dist / track.totalLength);
            if (curLapCount > prevLapCount && curLapCount >= 1) {
                car.lap = curLapCount;
                if (car.lap <= LAPS_TO_WIN) {
                    CGameAudio.play('score');
                }
                updateHUD();

                if (car.lap >= LAPS_TO_WIN) {
                    endGame(car.player);
                    return;
                }
            }

            // Add skid marks when going fast on curves (but not flying off)
            if (car.speed > s.safeSpeed * 0.85 && s.radius < 250) {
                if (Math.random() < 0.3) {
                    var spx = -s.dy;
                    var spy = s.dx;
                    skidMarks.push({
                        x: s.x + spx * car.laneSign * LANE_OFFSET + (Math.random() - 0.5) * 4,
                        y: s.y + spy * car.laneSign * LANE_OFFSET + (Math.random() - 0.5) * 4,
                        alpha: 0.25,
                        size: 1.5 + Math.random() * 1.5
                    });
                }
            }

            // ── Visual: Skid trail (connected line) ──
            if (car.speed > s.safeSpeed * 0.8 && s.radius < 250) {
                var tpx = -s.dy;
                var tpy = s.dx;
                var tx = s.x + tpx * car.laneSign * LANE_OFFSET;
                var ty = s.y + tpy * car.laneSign * LANE_OFFSET;
                var intensity = Math.min(1, (car.speed / s.safeSpeed - 0.8) / 0.35);
                skidTrails[i].push({ x: tx, y: ty, alpha: 0.15 + intensity * 0.35 });
            } else {
                // Break the trail
                var trail = skidTrails[i];
                if (trail.length > 0 && trail[trail.length - 1] !== null) {
                    trail.push(null);
                }
            }

            // ── Visual: Tire smoke near safe speed limit ──
            if (car.speed > s.safeSpeed * 0.8 && s.radius < 300) {
                var smokeIntensity = (car.speed / s.safeSpeed - 0.8) / 0.35;
                smokeIntensity = Math.min(1, Math.max(0, smokeIntensity));
                // More smoke = closer to flying off
                if (Math.random() < smokeIntensity * 0.6) {
                    var spx2 = -s.dy;
                    var spy2 = s.dx;
                    var sx = s.x + spx2 * car.laneSign * LANE_OFFSET;
                    var sy = s.y + spy2 * car.laneSign * LANE_OFFSET;
                    smokeParticles.push({
                        x: sx + (Math.random() - 0.5) * 6,
                        y: sy + (Math.random() - 0.5) * 6,
                        vx: (Math.random() - 0.5) * 15,
                        vy: -Math.random() * 20 - 5,
                        life: 0.4 + Math.random() * 0.4,
                        maxLife: 0.8,
                        alpha: 0.2 + smokeIntensity * 0.3,
                        size: 2 + Math.random() * 3
                    });
                }
            }

            // ── Visual: Speed lines on straights ──
            if (car.speed > MAX_SPEED * 0.5 && s.radius > 200) {
                var slIntensity = (car.speed - MAX_SPEED * 0.5) / (MAX_SPEED * 0.5);
                if (Math.random() < slIntensity * 0.4) {
                    var backDx = -s.dx;
                    var backDy = -s.dy;
                    var perpSlx = -s.dy;
                    var perpSly = s.dx;
                    var offset = (Math.random() - 0.5) * VIS_CAR_WIDTH * 1.2;
                    speedLines.push({
                        x: car.x + backDx * VIS_CAR_LENGTH * 0.5 + perpSlx * offset,
                        y: car.y + backDy * VIS_CAR_LENGTH * 0.5 + perpSly * offset,
                        dx: backDx,
                        dy: backDy,
                        length: 8 + Math.random() * 16 * slIntensity,
                        life: 0.15 + Math.random() * 0.2,
                        maxLife: 0.35,
                        alpha: 0.3 + slIntensity * 0.4,
                        carIndex: i
                    });
                }
            }
        }

        // Fade old skid marks
        for (var i = skidMarks.length - 1; i >= 0; i--) {
            skidMarks[i].alpha -= dt * 0.08;
            if (skidMarks[i].alpha <= 0) {
                skidMarks.splice(i, 1);
            }
        }
        // Cap skid marks
        if (skidMarks.length > 500) {
            skidMarks.splice(0, skidMarks.length - 500);
        }

        // Update smoke particles
        for (var i = smokeParticles.length - 1; i >= 0; i--) {
            var p = smokeParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.size += dt * 6;  // expand
            p.alpha -= dt * 0.8;
            if (p.life <= 0 || p.alpha <= 0) {
                smokeParticles.splice(i, 1);
            }
        }
        if (smokeParticles.length > SMOKE_MAX) {
            smokeParticles.splice(0, smokeParticles.length - SMOKE_MAX);
        }

        // Update speed lines
        for (var i = speedLines.length - 1; i >= 0; i--) {
            var sl = speedLines[i];
            sl.life -= dt;
            sl.alpha -= dt * 2;
            if (sl.life <= 0 || sl.alpha <= 0) {
                speedLines.splice(i, 1);
            }
        }
        if (speedLines.length > SPEED_LINE_MAX) {
            speedLines.splice(0, speedLines.length - SPEED_LINE_MAX);
        }

        // Trim skid trails
        for (var ci = 0; ci < 2; ci++) {
            if (skidTrails[ci].length > SKID_TRAIL_MAX) {
                skidTrails[ci].splice(0, skidTrails[ci].length - SKID_TRAIL_MAX);
            }
        }

        updateCarPositions();
    }

    // ── HUD ──

    function updateHUD() {
        var p1El = document.getElementById('hud-p1');
        var p2El = document.getElementById('hud-p2');
        var sep = document.getElementById('hud-sep');

        var c0 = cars[0];
        var c1 = cars[1];
        p1El.textContent = 'Lap ' + Math.min(c0.lap + 1, LAPS_TO_WIN) + '/' + LAPS_TO_WIN;
        p2El.textContent = 'Lap ' + Math.min(c1.lap + 1, LAPS_TO_WIN) + '/' + LAPS_TO_WIN;

        sep.classList.remove('hidden');
        p2El.classList.remove('hidden');
    }

    // ── End Game ──

    function endGame(winnerIndex) {
        gameOver = true;
        running = false;

        var winnerText = document.getElementById('winner-text');
        var finalScore = document.getElementById('final-score');

        if (mode === '1p') {
            if (winnerIndex === 0) {
                winnerText.textContent = 'You Win!';
                winnerText.style.color = 'var(--accent)';
                CGameAudio.play('win');
            } else {
                winnerText.textContent = 'AI Wins!';
                winnerText.style.color = 'var(--accent-secondary)';
                CGameAudio.play('lose');
            }
        } else {
            if (winnerIndex === 0) {
                winnerText.textContent = 'Player 1 Wins!';
                winnerText.style.color = 'var(--p1-color)';
            } else {
                winnerText.textContent = 'Player 2 Wins!';
                winnerText.style.color = 'var(--p2-color)';
            }
            CGameAudio.play('win');
        }

        finalScore.textContent = LAPS_TO_WIN + ' laps completed';

        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 600);
    }

    // ── Rendering ──

    function render() {
        if (!track) return;

        ctx.clearRect(0, 0, cw, ch);

        var isDark = document.body.getAttribute('data-theme') !== 'light';

        // Draw background terrain
        drawBackground(isDark);

        // Draw track
        drawTrack(isDark);

        // Draw skid trails (connected lines)
        drawSkidTrails(isDark);

        // Draw skid marks (dots - legacy)
        drawSkidMarks(isDark);

        // Draw speed lines
        drawSpeedLines(isDark);

        // Draw finish line
        drawFinishLine(isDark);

        // Draw smoke particles (behind cars)
        drawSmoke(isDark);

        // Draw cars
        drawCars(isDark);

        // Draw speed bars
        drawSpeedBars(isDark);

        // Draw touch zones hint (on touch devices)
        if (document.body.classList.contains('touch-device') && running && !paused) {
            drawTouchHint(isDark);
        }
    }

    // ── Background with grass/terrain gradient ──

    function drawBackground(isDark) {
        var grd = ctx.createRadialGradient(cw * 0.5, ch * 0.5, Math.min(cw, ch) * 0.15, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.7);
        if (isDark) {
            grd.addColorStop(0, '#1a2a1a');
            grd.addColorStop(0.5, '#152015');
            grd.addColorStop(1, '#0d150d');
        } else {
            grd.addColorStop(0, '#8fbc8f');
            grd.addColorStop(0.5, '#7aaa7a');
            grd.addColorStop(1, '#6a9a6a');
        }
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, cw, ch);

        // Subtle grass texture - sparse small dots
        ctx.globalAlpha = isDark ? 0.06 : 0.08;
        // Use deterministic seed based on canvas size so it doesn't flicker
        var seed = (cw * 7 + ch * 13) | 0;
        for (var gi = 0; gi < 300; gi++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            var gx = (seed % cw);
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            var gy = (seed % ch);
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            var gs = 1 + (seed % 3);
            ctx.fillStyle = isDark ? '#3a5a3a' : '#5a8a5a';
            ctx.fillRect(gx, gy, gs, gs);
        }
        ctx.globalAlpha = 1;
    }

    // ── Build track texture (cached off-screen canvas) ──

    function buildTrackTexture(isDark) {
        if (!trackTextureDirty && trackTextureCanvas) return;
        trackTextureDirty = false;

        var tc = document.createElement('canvas');
        tc.width = cw;
        tc.height = ch;
        var tctx = tc.getContext('2d');

        var samples = track.samples;

        // -- Asphalt base with lighter center --
        // We draw the track in three layers: dark edges, medium, light center

        // Layer 1: Outer dark edge (full width + border)
        tctx.beginPath();
        tctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            tctx.lineTo(samples[i].x, samples[i].y);
        }
        tctx.closePath();
        tctx.strokeStyle = isDark ? '#28283a' : '#787888';
        tctx.lineWidth = TRACK_WIDTH + 6;
        tctx.lineCap = 'round';
        tctx.lineJoin = 'round';
        tctx.stroke();

        // Layer 2: Main asphalt (dark)
        tctx.beginPath();
        tctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            tctx.lineTo(samples[i].x, samples[i].y);
        }
        tctx.closePath();
        tctx.strokeStyle = isDark ? '#333348' : '#9a9aaa';
        tctx.lineWidth = TRACK_WIDTH;
        tctx.lineCap = 'round';
        tctx.lineJoin = 'round';
        tctx.stroke();

        // Layer 3: Lighter center strip
        tctx.beginPath();
        tctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            tctx.lineTo(samples[i].x, samples[i].y);
        }
        tctx.closePath();
        tctx.strokeStyle = isDark ? '#3e3e55' : '#b0b0c0';
        tctx.lineWidth = TRACK_WIDTH * 0.55;
        tctx.lineCap = 'round';
        tctx.lineJoin = 'round';
        tctx.stroke();

        // Asphalt grain/noise texture
        // Use clip to only put noise on the track
        tctx.save();
        tctx.beginPath();
        // Build outline path for clipping
        for (var i = 0; i < samples.length; i++) {
            var s = samples[i];
            var px = s.x + (-s.dy) * (TRACK_WIDTH / 2 + 2);
            var py = s.y + (s.dx) * (TRACK_WIDTH / 2 + 2);
            if (i === 0) tctx.moveTo(px, py);
            else tctx.lineTo(px, py);
        }
        for (var i = samples.length - 1; i >= 0; i--) {
            var s = samples[i];
            var px = s.x - (-s.dy) * (TRACK_WIDTH / 2 + 2);
            var py = s.y - (s.dx) * (TRACK_WIDTH / 2 + 2);
            tctx.lineTo(px, py);
        }
        tctx.closePath();
        tctx.clip();

        // Scatter random alpha dots for grain
        var noiseSeed = 42;
        for (var ni = 0; ni < 1500; ni++) {
            noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
            var nx = (noiseSeed % cw);
            noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
            var ny = (noiseSeed % ch);
            noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
            var na = ((noiseSeed % 40) + 10) / 255;
            tctx.fillStyle = isDark
                ? 'rgba(180,180,200,' + na + ')'
                : 'rgba(60,60,80,' + na + ')';
            tctx.fillRect(nx, ny, 1, 1);
        }
        tctx.restore();

        // White edge markings (dashed lines along track edges)
        var edgeOffsets = [TRACK_WIDTH / 2 + 1, -(TRACK_WIDTH / 2 + 1)];
        tctx.setLineDash([10, 14]);
        tctx.lineWidth = 1.5;
        tctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)';
        for (var ei = 0; ei < edgeOffsets.length; ei++) {
            tctx.beginPath();
            for (var i = 0; i < samples.length; i++) {
                var s = samples[i];
                var off = edgeOffsets[ei];
                var ex = s.x + (-s.dy) * off;
                var ey = s.y + (s.dx) * off;
                if (i === 0) tctx.moveTo(ex, ey);
                else tctx.lineTo(ex, ey);
            }
            tctx.closePath();
            tctx.stroke();
        }
        tctx.setLineDash([]);

        // Lane divider (dashed center line)
        tctx.beginPath();
        tctx.setLineDash([8, 12]);
        tctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            tctx.lineTo(samples[i].x, samples[i].y);
        }
        tctx.closePath();
        tctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)';
        tctx.lineWidth = 1.5;
        tctx.stroke();
        tctx.setLineDash([]);

        trackTextureCanvas = tc;
    }

    function drawTrack(isDark) {
        buildTrackTexture(isDark);
        if (trackTextureCanvas) {
            ctx.drawImage(trackTextureCanvas, 0, 0);
        }
    }

    function drawFinishLine(isDark) {
        // Draw animated checkerboard finish line at the start position
        var s = track.samples[0];
        var perpX = -s.dy;
        var perpY = s.dx;

        var halfW = TRACK_WIDTH / 2 + 2;
        var x1 = s.x + perpX * halfW;
        var y1 = s.y + perpY * halfW;
        var x2 = s.x - perpX * halfW;
        var y2 = s.y - perpY * halfW;

        ctx.save();

        // Base line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isDark ? '#ffffff' : '#222222';
        ctx.lineWidth = 7;
        ctx.stroke();

        // Animated checkerboard pattern
        var steps = 10;
        var shimmerPhase = finishLineTime * 3; // controls flutter speed
        for (var row = 0; row < 2; row++) {
            for (var i = 0; i < steps; i++) {
                var t = i / steps;
                var px = x1 + (x2 - x1) * t;
                var py = y1 + (y2 - y1) * t;
                // Offset for row
                var rowOff = (row - 0.5) * 4;
                var rx = px + s.dx * rowOff;
                var ry = py + s.dy * rowOff;

                // Shimmer: slight alpha wave
                var shimmer = 0.85 + 0.15 * Math.sin(shimmerPhase + i * 0.7 + row * Math.PI);
                var isWhite = (i + row) % 2 === 0;

                if (isWhite) {
                    ctx.fillStyle = isDark
                        ? 'rgba(255,255,255,' + shimmer + ')'
                        : 'rgba(255,255,255,' + shimmer + ')';
                } else {
                    ctx.fillStyle = isDark
                        ? 'rgba(20,20,35,' + shimmer + ')'
                        : 'rgba(0,0,0,' + shimmer + ')';
                }

                // Slight size flutter
                var sizeFlutter = 3.2 + 0.3 * Math.sin(shimmerPhase * 1.5 + i * 1.1);
                ctx.fillRect(rx - sizeFlutter, ry - sizeFlutter, sizeFlutter * 2, sizeFlutter * 2);
            }
        }
        ctx.restore();
    }

    function drawSkidTrails(isDark) {
        // Connected line trails per car
        var trailColors = [
            isDark ? 'rgba(40,40,40,' : 'rgba(30,30,30,',
            isDark ? 'rgba(40,40,40,' : 'rgba(30,30,30,'
        ];

        for (var ci = 0; ci < 2; ci++) {
            var trail = skidTrails[ci];
            if (trail.length < 2) continue;

            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            var inSegment = false;
            ctx.beginPath();
            for (var ti = 0; ti < trail.length; ti++) {
                var pt = trail[ti];
                if (pt === null) {
                    // End current segment, stroke it
                    if (inSegment) {
                        ctx.stroke();
                        ctx.beginPath();
                        inSegment = false;
                    }
                    continue;
                }
                if (!inSegment) {
                    ctx.strokeStyle = trailColors[ci] + Math.min(pt.alpha, 0.45) + ')';
                    ctx.moveTo(pt.x, pt.y);
                    inSegment = true;
                } else {
                    ctx.lineTo(pt.x, pt.y);
                }
            }
            if (inSegment) {
                ctx.stroke();
            }
        }
    }

    function drawSkidMarks(isDark) {
        for (var i = 0; i < skidMarks.length; i++) {
            var sm = skidMarks[i];
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2);
            var baseColor = isDark ? '50,50,50' : '30,30,30';
            ctx.fillStyle = 'rgba(' + baseColor + ',' + (sm.alpha * 0.7) + ')';
            ctx.fill();
        }
    }

    function drawSmoke(isDark) {
        for (var i = 0; i < smokeParticles.length; i++) {
            var p = smokeParticles[i];
            var a = Math.max(0, p.alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
            if (isDark) {
                ctx.fillStyle = 'rgba(180,180,195,' + (a * 0.5) + ')';
            } else {
                ctx.fillStyle = 'rgba(160,160,170,' + (a * 0.6) + ')';
            }
            ctx.fill();
        }
    }

    function drawSpeedLines(isDark) {
        var carColors = [
            isDark ? [0, 180, 255] : [37, 99, 235],
            isDark ? [255, 68, 102] : [233, 69, 96]
        ];

        for (var i = 0; i < speedLines.length; i++) {
            var sl = speedLines[i];
            var a = Math.max(0, sl.alpha);
            var col = carColors[sl.carIndex];
            ctx.beginPath();
            ctx.moveTo(sl.x, sl.y);
            ctx.lineTo(sl.x + sl.dx * sl.length, sl.y + sl.dy * sl.length);
            ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (a * 0.4) + ')';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    function drawCars(isDark) {
        var colors = [
            {
                bodyDark: isDark ? '#005a99' : '#1a4fa0',
                bodyLight: isDark ? '#00c8ff' : '#3b8bff',
                accent: isDark ? '#42d4ff' : '#60a5fa',
                windshield: isDark ? 'rgba(150,220,255,0.4)' : 'rgba(180,220,255,0.6)'
            },
            {
                bodyDark: isDark ? '#991133' : '#a02040',
                bodyLight: isDark ? '#ff5577' : '#ff6688',
                accent: isDark ? '#ff99aa' : '#ff8899',
                windshield: isDark ? 'rgba(255,180,190,0.4)' : 'rgba(255,200,210,0.6)'
            }
        ];

        for (var i = 0; i < cars.length; i++) {
            var car = cars[i];
            var col = colors[i];

            // Flash when stalled
            if (car.stalled > 0 && Math.floor(car.stallFlash * 8) % 2 === 0) {
                continue; // skip drawing (flash effect)
            }

            // Get throttle state for headlights
            var throttle = false;
            if (car.isAI) throttle = car.aiThrottle;
            else if (car.player === 0) throttle = inputState.p1;
            else throttle = inputState.p2;

            ctx.save();
            ctx.translate(car.x, car.y);
            ctx.rotate(car.angle);

            var hl = VIS_CAR_LENGTH;
            var hw = VIS_CAR_WIDTH;

            // -- Shadow --
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(1, 2, hl / 2 + 1, hw / 2 + 1, 0, 0, Math.PI * 2);
            ctx.fill();

            // -- Body gradient (front to back) --
            var bodyGrad = ctx.createLinearGradient(-hl / 2, 0, hl / 2, 0);
            bodyGrad.addColorStop(0, col.bodyDark);
            bodyGrad.addColorStop(0.4, col.bodyLight);
            bodyGrad.addColorStop(0.7, col.bodyLight);
            bodyGrad.addColorStop(1, col.bodyDark);

            // Rounded car body
            var r = 3;
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.moveTo(-hl / 2 + r, -hw / 2);
            ctx.lineTo(hl / 2 - r, -hw / 2);
            ctx.quadraticCurveTo(hl / 2, -hw / 2, hl / 2, -hw / 2 + r);
            ctx.lineTo(hl / 2, hw / 2 - r);
            ctx.quadraticCurveTo(hl / 2, hw / 2, hl / 2 - r, hw / 2);
            ctx.lineTo(-hl / 2 + r, hw / 2);
            ctx.quadraticCurveTo(-hl / 2, hw / 2, -hl / 2, hw / 2 - r);
            ctx.lineTo(-hl / 2, -hw / 2 + r);
            ctx.quadraticCurveTo(-hl / 2, -hw / 2, -hl / 2 + r, -hw / 2);
            ctx.closePath();
            ctx.fill();

            // Body outline
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.7;
            ctx.stroke();

            // -- Hood section (front third, lighter) --
            ctx.fillStyle = col.accent;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(hl / 2 - hl * 0.35, -hw / 2 + 2, hl * 0.2, hw - 4);
            ctx.globalAlpha = 1;

            // -- Windshield (angled glass) --
            ctx.fillStyle = col.windshield;
            ctx.beginPath();
            var wsX = hl / 2 - hl * 0.32;
            ctx.moveTo(wsX, -hw / 2 + 2);
            ctx.lineTo(wsX + 3, -hw / 2 + 2);
            ctx.lineTo(wsX + 2.5, hw / 2 - 2);
            ctx.lineTo(wsX, hw / 2 - 2);
            ctx.closePath();
            ctx.fill();

            // -- Rear windshield --
            ctx.fillStyle = col.windshield;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(-hl / 2 + 3, -hw / 2 + 2.5, 2.5, hw - 5);
            ctx.globalAlpha = 1;

            // -- Taillights (red dots at back) --
            ctx.fillStyle = 'rgba(255,50,50,0.7)';
            ctx.fillRect(-hl / 2, -hw / 2 + 1, 2, 2.5);
            ctx.fillRect(-hl / 2, hw / 2 - 3.5, 2, 2.5);

            // -- Headlights --
            if (throttle && car.stalled <= 0) {
                // Glow effect
                ctx.save();
                ctx.shadowColor = 'rgba(255,255,180,0.8)';
                ctx.shadowBlur = 12;
                ctx.fillStyle = 'rgba(255,255,200,0.9)';
                ctx.beginPath();
                ctx.arc(hl / 2 + 1, -hw / 2 + 2.5, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(hl / 2 + 1, hw / 2 - 2.5, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Headlight beam (subtle cone)
                ctx.globalAlpha = 0.08;
                ctx.fillStyle = '#ffffcc';
                ctx.beginPath();
                ctx.moveTo(hl / 2, -hw / 2 + 1);
                ctx.lineTo(hl / 2 + 18, -hw * 0.8);
                ctx.lineTo(hl / 2 + 18, hw * 0.8);
                ctx.lineTo(hl / 2, hw / 2 - 1);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            } else {
                // Dim headlights when not throttling
                ctx.fillStyle = 'rgba(255,255,200,0.3)';
                ctx.beginPath();
                ctx.arc(hl / 2 + 0.5, -hw / 2 + 2.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(hl / 2 + 0.5, hw / 2 - 2.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    function drawSpeedBars(isDark) {
        var barW = 60;
        var barH = 6;

        for (var i = 0; i < cars.length; i++) {
            var car = cars[i];
            var s = sampleAtDist(track, car.dist);
            var pct = car.speed / MAX_SPEED;

            // Position near the car
            var bx = car.x - barW / 2;
            var by = car.y - VIS_CAR_WIDTH - 10;

            // Background with slight rounding
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.moveTo(bx + 2, by);
            ctx.lineTo(bx + barW - 2, by);
            ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + 2);
            ctx.lineTo(bx + barW, by + barH - 2);
            ctx.quadraticCurveTo(bx + barW, by + barH, bx + barW - 2, by + barH);
            ctx.lineTo(bx + 2, by + barH);
            ctx.quadraticCurveTo(bx, by + barH, bx, by + barH - 2);
            ctx.lineTo(bx, by + 2);
            ctx.quadraticCurveTo(bx, by, bx + 2, by);
            ctx.closePath();
            ctx.fill();

            // Gradient fill based on speed vs safe speed
            var ratio = (s.safeSpeed > 0) ? car.speed / s.safeSpeed : 0;
            var fillW = barW * pct;
            if (fillW > 0.5) {
                var grd = ctx.createLinearGradient(bx, by, bx + barW, by);
                grd.addColorStop(0, '#2ecc40');      // green
                grd.addColorStop(0.5, '#f1c40f');     // yellow
                grd.addColorStop(0.85, '#e94560');     // red
                grd.addColorStop(1, '#ff1744');        // hot red

                ctx.fillStyle = grd;
                ctx.fillRect(bx, by, fillW, barH);
            }

            // Danger glow when near or above safe speed
            if (ratio > 0.85) {
                var glowIntensity = Math.min(1, (ratio - 0.85) / 0.3);
                ctx.save();
                ctx.shadowColor = 'rgba(255,30,60,' + (glowIntensity * 0.8) + ')';
                ctx.shadowBlur = 6 + glowIntensity * 6;
                ctx.fillStyle = 'rgba(255,50,70,' + (glowIntensity * 0.3) + ')';
                ctx.fillRect(bx, by, fillW, barH);
                ctx.restore();
            }

            // Border
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);

            // Player label
            ctx.fillStyle = i === 0
                ? (isDark ? '#00b4ff' : '#2563eb')
                : (isDark ? '#ff4466' : '#e94560');
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            var label = car.isAI ? 'AI' : ('P' + (i + 1));
            ctx.fillText(label, bx + barW / 2, by - 2);
        }
    }

    function drawTouchHint(isDark) {
        // Draw subtle divider in center
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(cw / 2, 0);
        ctx.lineTo(cw / 2, ch);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels at bottom
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isDark ? 'rgba(0,180,255,0.3)' : 'rgba(37,99,235,0.3)';
        ctx.fillText('P1 - HOLD', cw * 0.25, ch - 8);

        if (mode === '2p') {
            ctx.fillStyle = isDark ? 'rgba(255,68,102,0.3)' : 'rgba(233,69,96,0.3)';
            ctx.fillText('P2 - HOLD', cw * 0.75, ch - 8);
        }

        ctx.restore();
    }

    // ── Game Loop ──

    var lastTime = 0;

    function gameLoop(timestamp) {
        if (!timestamp) timestamp = 0;
        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // Cap delta time at 50ms
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;

        if (!paused) {
            update(dt);
        }
        render();

        requestAnimationFrame(gameLoop);
    }

    // ── Input Handling ──

    function setupInput() {
        // Keyboard
        document.addEventListener('keydown', function (e) {
            var key = e.key.toLowerCase();

            // Always prevent default for game keys (even on repeat) to avoid page scroll
            if (key === 'w' || key === ' ' || key === 'arrowup' || key === 'enter') {
                e.preventDefault();
            }

            if (e.repeat) return;

            if (key === 'w' || key === ' ') {
                inputState.p1 = true;
            }
            if (key === 'arrowup' || key === 'enter') {
                inputState.p2 = true;
            }

            // Pause with Escape
            if (key === 'escape' && running && !gameOver) {
                togglePause();
            }
        });

        document.addEventListener('keyup', function (e) {
            var key = e.key.toLowerCase();
            if (key === 'w' || key === ' ') {
                inputState.p1 = false;
            }
            if (key === 'arrowup' || key === 'enter') {
                inputState.p2 = false;
            }
        });

        // Touch
        canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            for (var i = 0; i < e.changedTouches.length; i++) {
                var touch = e.changedTouches[i];
                if (touch.clientX < window.innerWidth / 2) {
                    inputState.p1 = true;
                    touchIds.p1 = touch.identifier;
                } else {
                    if (mode === '2p') {
                        inputState.p2 = true;
                        touchIds.p2 = touch.identifier;
                    } else {
                        // In 1P, right side also controls P1
                        inputState.p1 = true;
                        touchIds.p1 = touch.identifier;
                    }
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', function (e) {
            e.preventDefault();
            for (var i = 0; i < e.changedTouches.length; i++) {
                var touch = e.changedTouches[i];
                if (touch.identifier === touchIds.p1) {
                    inputState.p1 = false;
                    touchIds.p1 = null;
                }
                if (touch.identifier === touchIds.p2) {
                    inputState.p2 = false;
                    touchIds.p2 = null;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchcancel', function (e) {
            inputState.p1 = false;
            inputState.p2 = false;
            touchIds.p1 = null;
            touchIds.p2 = null;
        });

        // Mouse (for testing - left click = P1 throttle)
        canvas.addEventListener('mousedown', function (e) {
            if (e.button === 0) {
                if (mode === '2p' && e.clientX > window.innerWidth / 2) {
                    inputState.p2 = true;
                } else {
                    inputState.p1 = true;
                }
            }
        });

        canvas.addEventListener('mouseup', function (e) {
            if (e.button === 0) {
                inputState.p1 = false;
                inputState.p2 = false;
            }
        });

        canvas.addEventListener('mouseleave', function () {
            inputState.p1 = false;
            inputState.p2 = false;
        });
    }

    // ── Pause ──

    function togglePause() {
        paused = !paused;
        var overlay = document.getElementById('pause-overlay');
        if (paused) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    // ── UI Bindings ──

    function setupUI() {
        // Title screen buttons
        document.getElementById('btn-1p').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame('1p');
        });

        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame('2p');
        });

        // Pause button
        document.getElementById('btn-pause').addEventListener('click', function () {
            if (running && !gameOver) {
                CGameAudio.play('click');
                togglePause();
            }
        });

        // Resume
        document.getElementById('btn-resume').addEventListener('click', function () {
            CGameAudio.play('click');
            togglePause();
        });

        // Quit
        document.getElementById('btn-quit').addEventListener('click', function () {
            CGameAudio.play('back');
            running = false;
            paused = false;
            gameOver = true;
            document.getElementById('pause-overlay').classList.add('hidden');
            inputState.p1 = false;
            inputState.p2 = false;
            GameShell.showScreen('title-screen');
        });

        // Play again
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame(mode);
        });

        // Menu
        document.getElementById('btn-menu').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('title-screen');
        });

        // Handle resize
        window.addEventListener('resize', function () {
            if (canvas) {
                resizeCanvas();
                if (track) {
                    var idx = -1;
                    for (var i = 0; i < trackDefs.length; i++) {
                        if (trackDefs[i].name === track.name) { idx = i; break; }
                    }
                    if (idx >= 0) {
                        // Rebuild track at new size, preserving car progress
                        var carDists = cars.map(function (c) {
                            return c.dist / track.totalLength;
                        });
                        var carLaps = cars.map(function (c) { return c.lap; });
                        track = buildTrackPath(trackDefs[idx], cw, ch);
                        for (var i = 0; i < cars.length; i++) {
                            cars[i].dist = carDists[i] * track.totalLength;
                            cars[i].lap = carLaps[i];
                        }
                        updateCarPositions();
                    }
                }
            }
        });
    }

    // ── Register Custom Audio ──

    function registerSounds() {
        CGameAudio.register('engine', function (ctx, now) {
            CGameAudio.osc('sawtooth', 120, now, 0.08, 0.03);
            CGameAudio.osc('square', 80, now, 0.06, 0.02);
        });

        CGameAudio.register('screech', function (ctx, now) {
            CGameAudio.noise(now, 0.15, 0.12);
            CGameAudio.osc('sawtooth', 800, now, 0.1, 0.06);
        });
    }

    // ── Boot ──

    function init() {
        GameShell.init({ backUrl: '../' });
        registerSounds();

        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');

        resizeCanvas();
        setupInput();
        setupUI();

        // Start render loop (game logic only runs when running=true)
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
