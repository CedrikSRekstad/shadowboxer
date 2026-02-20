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
    }

    // ── Game Init ──

    function startGame(selectedMode) {
        mode = selectedMode;
        gameOver = false;
        paused = false;
        running = true;
        skidMarks = [];

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

        // Show game screen and start countdown
        GameShell.showScreen('game-screen');
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

        // Draw track
        drawTrack(isDark);

        // Draw skid marks
        drawSkidMarks(isDark);

        // Draw finish line
        drawFinishLine(isDark);

        // Draw cars
        drawCars(isDark);

        // Draw speed bars
        drawSpeedBars(isDark);

        // Draw touch zones hint (on touch devices)
        if (document.body.classList.contains('touch-device') && running && !paused) {
            drawTouchHint(isDark);
        }
    }

    function drawTrack(isDark) {
        var samples = track.samples;

        // Draw road surface (wide grey path)
        ctx.beginPath();
        ctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            ctx.lineTo(samples[i].x, samples[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = isDark ? '#3a3a50' : '#b0b0c0';
        ctx.lineWidth = TRACK_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw white borders (outer)
        ctx.beginPath();
        ctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            ctx.lineTo(samples[i].x, samples[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = isDark ? '#606080' : '#888898';
        ctx.lineWidth = TRACK_WIDTH + 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'destination-over';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';

        // Draw lane divider (dashed center line)
        ctx.beginPath();
        ctx.setLineDash([8, 12]);
        ctx.moveTo(samples[0].x, samples[0].y);
        for (var i = 1; i < samples.length; i++) {
            ctx.lineTo(samples[i].x, samples[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawFinishLine(isDark) {
        // Draw checkerboard finish line at the start position
        var s = track.samples[0];
        var perpX = -s.dy;
        var perpY = s.dx;

        var halfW = TRACK_WIDTH / 2 + 2;
        var x1 = s.x + perpX * halfW;
        var y1 = s.y + perpY * halfW;
        var x2 = s.x - perpX * halfW;
        var y2 = s.y - perpY * halfW;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isDark ? '#ffffff' : '#222222';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Checkerboard pattern on the line
        var steps = 8;
        for (var i = 0; i < steps; i++) {
            var t = i / steps;
            var px = x1 + (x2 - x1) * t;
            var py = y1 + (y2 - y1) * t;
            if (i % 2 === 0) {
                ctx.fillStyle = isDark ? '#ffffff' : '#000000';
            } else {
                ctx.fillStyle = isDark ? '#333344' : '#cccccc';
            }
            ctx.fillRect(px - 3, py - 3, 6, 6);
        }
        ctx.restore();
    }

    function drawSkidMarks(isDark) {
        for (var i = 0; i < skidMarks.length; i++) {
            var sm = skidMarks[i];
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2);
            var baseColor = isDark ? '200,200,200' : '60,60,60';
            ctx.fillStyle = 'rgba(' + baseColor + ',' + sm.alpha + ')';
            ctx.fill();
        }
    }

    function drawCars(isDark) {
        var colors = [
            { body: isDark ? '#00b4ff' : '#2563eb', top: isDark ? '#42d4ff' : '#60a5fa' },
            { body: isDark ? '#ff4466' : '#e94560', top: isDark ? '#ff7799' : '#ff7799' }
        ];

        for (var i = 0; i < cars.length; i++) {
            var car = cars[i];
            var col = colors[i];

            // Flash when stalled
            if (car.stalled > 0 && Math.floor(car.stallFlash * 8) % 2 === 0) {
                continue; // skip drawing (flash effect)
            }

            ctx.save();
            ctx.translate(car.x, car.y);
            ctx.rotate(car.angle);

            // Car body (rectangle)
            ctx.fillStyle = col.body;
            ctx.fillRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH);

            // Car top highlight
            ctx.fillStyle = col.top;
            ctx.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 2, CAR_LENGTH - 6, CAR_WIDTH - 4);

            // Windshield
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
            ctx.fillRect(CAR_LENGTH / 2 - 5, -CAR_WIDTH / 2 + 1, 3, CAR_WIDTH - 2);

            // Headlights when throttle active
            var throttle = false;
            if (car.isAI) throttle = car.aiThrottle;
            else if (car.player === 0) throttle = inputState.p1;
            else throttle = inputState.p2;

            if (throttle && car.stalled <= 0) {
                ctx.fillStyle = 'rgba(255,255,200,0.8)';
                ctx.fillRect(CAR_LENGTH / 2, -2, 3, 4);
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
            var by = car.y - CAR_WIDTH - 8;

            // Background
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
            ctx.fillRect(bx, by, barW, barH);

            // Fill color based on speed vs safe speed
            var ratio = (s.safeSpeed > 0) ? car.speed / s.safeSpeed : 0;
            var fillColor;
            if (ratio < 0.7) {
                fillColor = '#538d4e'; // green - safe
            } else if (ratio < 0.95) {
                fillColor = '#b59f3b'; // yellow - caution
            } else {
                fillColor = '#e94560'; // red - danger
            }

            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, by, barW * pct, barH);

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
