/* === Cgames Hub - Animated Previews === */
(function () {
    // Init shared systems
    GameShell.init({ backUrl: '../' });

    // Staggered card entrance animation
    var cards = document.querySelectorAll('.game-card');
    cards.forEach(function (card, i) {
        setTimeout(function () {
            card.classList.add('visible');
        }, i * 70);
    });

    // Card click sound
    cards.forEach(function (card) {
        card.addEventListener('click', function () {
            CGameAudio.play('select');
        });
    });

    // ── Animated mini previews ──
    var canvases = document.querySelectorAll('.preview-canvas');
    var animStates = [];
    var animRunning = true;

    canvases.forEach(function (cvs, index) {
        var ctx2 = cvs.getContext('2d');
        ctx2.scale(2, 2);
        var w = cvs.width / 2, h = cvs.height / 2;
        var game = cvs.getAttribute('data-game');
        var state = initPreviewState(game, w, h);
        animStates.push({ cvs: cvs, ctx: ctx2, w: w, h: h, game: game, state: state });
    });

    var lastAnimTime = performance.now();

    function animateAllPreviews(timestamp) {
        if (!animRunning) return;
        var dt = Math.min((timestamp - lastAnimTime) / 1000, 0.05);
        lastAnimTime = timestamp;

        for (var i = 0; i < animStates.length; i++) {
            var a = animStates[i];
            updatePreview(a.state, a.game, a.w, a.h, dt);
            drawPreview(a.ctx, a.w, a.h, a.game, a.state);
        }

        requestAnimationFrame(animateAllPreviews);
    }

    requestAnimationFrame(animateAllPreviews);

    // Pause animations when page is not visible
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            animRunning = false;
        } else {
            animRunning = true;
            lastAnimTime = performance.now();
            requestAnimationFrame(animateAllPreviews);
        }
    });

    // ── Preview state init ──
    function initPreviewState(game, w, h) {
        var s = { t: Math.random() * 10 };

        switch (game) {
            case 'ping-pong':
                s.ballX = w / 2; s.ballY = h / 2;
                s.bvx = 40; s.bvy = 25;
                s.p1y = h / 2; s.p2y = h / 2;
                break;
            case 'air-hockey':
                s.puckX = w / 2; s.puckY = h / 2;
                s.pvx = 30; s.pvy = 20;
                break;
            case 'space-shooter':
                s.stars = [];
                for (var i = 0; i < 20; i++) s.stars.push({ x: Math.random() * w, y: Math.random() * h, s: 0.5 + Math.random() });
                s.shipX = w / 2;
                s.bullets = [];
                s.bulletTimer = 0;
                break;
            case 'brickblast':
                s.ballX = w / 2; s.ballY = h - 20;
                s.bvx = 30; s.bvy = -35;
                break;
            case 'gravity-run':
                s.playerY = h - 18; s.onCeiling = false;
                s.obstacles = [{ x: w + 20 }, { x: w + 80 }];
                break;
            case 'stampede':
                s.runFrame = 0; s.jumpY = 0; s.jumping = false;
                s.obstacles = [{ x: w + 30, type: 0 }, { x: w + 90, type: 1 }];
                break;
            case 'spin-wars':
                s.angle1 = 0; s.angle2 = Math.PI;
                s.r1 = 15; s.r2 = 15;
                break;
            case 'animal-stack':
                s.dropY = 0; s.dropping = true;
                break;
            case 'slot-cars':
                s.carPos = 0;
                break;
            case 'crash-it':
                s.car1X = w / 2 - 12; s.car2X = w / 2 + 12;
                s.wobble = 0;
                break;
            case 'canon-duel':
                s.projX = -10; s.projY = h; s.projT = 0; s.firing = true;
                break;
            case 'dart':
                s.dartAngle = 0; s.throwing = false;
                s.dartX = w / 2 + 30; s.dartY = h / 2;
                break;
        }
        return s;
    }

    // ── Preview update ──
    function updatePreview(s, game, w, h, dt) {
        s.t += dt;

        switch (game) {
            case 'ping-pong':
                s.ballX += s.bvx * dt; s.ballY += s.bvy * dt;
                if (s.ballX > w - 12 || s.ballX < 12) s.bvx = -s.bvx;
                if (s.ballY > h - 4 || s.ballY < 4) s.bvy = -s.bvy;
                s.p1y += (s.ballY - s.p1y) * 3 * dt;
                s.p2y += (s.ballY - s.p2y) * 2.5 * dt;
                break;
            case 'air-hockey':
                s.puckX += s.pvx * dt; s.puckY += s.pvy * dt;
                if (s.puckX > w - 6 || s.puckX < 6) s.pvx = -s.pvx;
                if (s.puckY > h - 6 || s.puckY < 6) s.pvy = -s.pvy;
                break;
            case 'space-shooter':
                for (var i = 0; i < s.stars.length; i++) {
                    s.stars[i].y += s.stars[i].s * 30 * dt;
                    if (s.stars[i].y > h) { s.stars[i].y = 0; s.stars[i].x = Math.random() * w; }
                }
                s.shipX = w / 2 + Math.sin(s.t * 1.5) * 20;
                s.bulletTimer += dt;
                if (s.bulletTimer > 0.4) {
                    s.bulletTimer = 0;
                    s.bullets.push({ x: s.shipX, y: h - 15 });
                }
                for (var bi = s.bullets.length - 1; bi >= 0; bi--) {
                    s.bullets[bi].y -= 80 * dt;
                    if (s.bullets[bi].y < 0) s.bullets.splice(bi, 1);
                }
                break;
            case 'brickblast':
                s.ballX += s.bvx * dt; s.ballY += s.bvy * dt;
                if (s.ballX > w - 4 || s.ballX < 4) s.bvx = -s.bvx;
                if (s.ballY < 4) s.bvy = Math.abs(s.bvy);
                if (s.ballY > h - 8) s.bvy = -Math.abs(s.bvy);
                break;
            case 'gravity-run':
                for (var oi = 0; oi < s.obstacles.length; oi++) {
                    s.obstacles[oi].x -= 40 * dt;
                    if (s.obstacles[oi].x < -15) s.obstacles[oi].x = w + 20 + Math.random() * 40;
                }
                break;
            case 'stampede':
                s.runFrame += dt * 8;
                for (var oi2 = 0; oi2 < s.obstacles.length; oi2++) {
                    s.obstacles[oi2].x -= 35 * dt;
                    if (s.obstacles[oi2].x < -20) {
                        s.obstacles[oi2].x = w + 20 + Math.random() * 50;
                        s.obstacles[oi2].type = Math.random() > 0.5 ? 1 : 0;
                    }
                }
                break;
            case 'spin-wars':
                s.angle1 += 6 * dt;
                s.angle2 -= 5 * dt;
                break;
            case 'animal-stack':
                if (s.dropping) {
                    s.dropY += 30 * dt;
                    if (s.dropY > h - 44) { s.dropY = 0; }
                }
                break;
            case 'slot-cars':
                s.carPos += 0.8 * dt;
                if (s.carPos > 1) s.carPos -= 1;
                break;
            case 'crash-it':
                s.wobble += dt * 3;
                s.car1X = w / 2 - 12 + Math.sin(s.wobble) * 8;
                s.car2X = w / 2 + 12 + Math.sin(s.wobble + 2) * 6;
                break;
            case 'canon-duel':
                if (s.firing) {
                    s.projT += dt * 1.5;
                    s.projX = 18 + s.projT * 60;
                    s.projY = h - 25 - Math.sin(s.projT * 1.5) * 50;
                    if (s.projX > w - 18) { s.firing = false; s.projT = 0; }
                } else {
                    s.projT += dt;
                    if (s.projT > 0.8) { s.firing = true; s.projT = 0; }
                }
                break;
            case 'dart':
                s.dartAngle = Math.sin(s.t * 2) * 0.3;
                break;
        }
    }

    // ── Preview draw ──
    function drawPreview(ctx, w, h, game, s) {
        var isDark = document.body.getAttribute('data-theme') !== 'light';
        var bg = isDark ? '#1a1a2e' : '#e0e4ea';
        var fg = isDark ? '#ffffff' : '#1a1a2e';
        var accent = isDark ? '#ffdd00' : '#2563eb';
        var p1 = '#00b4ff';
        var p2 = '#ff4466';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        switch (game) {
            case 'ping-pong':
                // Center line
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = fg + '20';
                ctx.beginPath();
                ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
                ctx.stroke();
                ctx.setLineDash([]);
                // Paddles with gradient
                drawGradientRect(ctx, 8, s.p1y - 12, 4, 24, p1, '#42d4ff');
                drawGradientRect(ctx, w - 12, s.p2y - 12, 4, 24, p2, '#ff7799');
                // Ball with glow
                ctx.shadowColor = accent;
                ctx.shadowBlur = 8;
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(s.ballX, s.ballY, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'air-hockey':
                // Rink
                ctx.strokeStyle = fg + '20';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 15, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
                ctx.stroke();
                // Strikers
                drawGlowCircle(ctx, w / 2 - 20, h * 0.7, 6, p1);
                drawGlowCircle(ctx, w / 2 + 15, h * 0.3, 6, p2);
                // Puck
                ctx.shadowColor = accent;
                ctx.shadowBlur = 6;
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(s.puckX, s.puckY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'memory':
                for (var r = 0; r < 2; r++) {
                    for (var c = 0; c < 4; c++) {
                        var x = 12 + c * 26, y = 12 + r * 28;
                        var matched = (r === 0 && c < 2);
                        ctx.fillStyle = matched ? accent : fg + '15';
                        ctx.beginPath();
                        ctx.roundRect(x, y, 22, 24, 3);
                        ctx.fill();
                        ctx.strokeStyle = matched ? accent + '60' : fg + '20';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        ctx.fillStyle = matched ? bg : fg + '30';
                        ctx.font = 'bold 14px sans-serif';
                        ctx.fillText(matched ? '\u2605' : '?', x + (matched ? 5 : 7), y + 17);
                    }
                }
                break;

            case '2048':
                var colors2048 = ['#eee4da', '#ede0c8', '#f2b179', '#f59563'];
                var nums = [2, 4, 8, 16, 2, 0, 4, 0, 0, 2, 0, 8, 0, 0, 2, 0];
                for (var r2 = 0; r2 < 4; r2++) {
                    for (var c2 = 0; c2 < 4; c2++) {
                        var x2 = 6 + c2 * 28, y2 = 4 + r2 * 19;
                        var v = nums[r2 * 4 + c2];
                        ctx.fillStyle = v ? colors2048[Math.min(Math.log2(v) - 1, 3)] : fg + '08';
                        ctx.beginPath();
                        ctx.roundRect(x2, y2, 25, 16, 2);
                        ctx.fill();
                        if (v) {
                            ctx.fillStyle = v > 4 ? '#fff' : '#776e65';
                            ctx.font = 'bold 9px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.fillText(v, x2 + 12, y2 + 12);
                            ctx.textAlign = 'start';
                        }
                    }
                }
                break;

            case 'wordle':
                var wColors = ['#538d4e', '#b59f3b', '#3a3a3c', '#538d4e', '#538d4e'];
                var letters = ['C', 'R', 'A', 'N', 'E'];
                for (var wi = 0; wi < 5; wi++) {
                    var wx = 10 + wi * 22;
                    ctx.fillStyle = wColors[wi];
                    ctx.beginPath();
                    ctx.roundRect(wx, 25, 18, 18, 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(letters[wi], wx + 9, 39);
                    ctx.textAlign = 'start';
                }
                for (var wi2 = 0; wi2 < 5; wi2++) {
                    ctx.fillStyle = fg + '10';
                    ctx.beginPath();
                    ctx.roundRect(10 + wi2 * 22, 47, 18, 18, 2);
                    ctx.fill();
                }
                break;

            case 'space-shooter':
                // Stars
                for (var si = 0; si < s.stars.length; si++) {
                    var star = s.stars[si];
                    ctx.fillStyle = fg;
                    ctx.globalAlpha = 0.2 + star.s * 0.3;
                    ctx.fillRect(star.x, star.y, 1.5, 1.5);
                }
                ctx.globalAlpha = 1;
                // Ship with glow
                ctx.shadowColor = p1;
                ctx.shadowBlur = 6;
                ctx.fillStyle = p1;
                ctx.beginPath();
                ctx.moveTo(s.shipX, h - 15);
                ctx.lineTo(s.shipX - 8, h - 5);
                ctx.lineTo(s.shipX + 8, h - 5);
                ctx.fill();
                ctx.shadowBlur = 0;
                // Thrust
                ctx.fillStyle = '#ff8800';
                ctx.globalAlpha = 0.6 + Math.sin(s.t * 20) * 0.3;
                ctx.beginPath();
                ctx.moveTo(s.shipX - 3, h - 5);
                ctx.lineTo(s.shipX, h);
                ctx.lineTo(s.shipX + 3, h - 5);
                ctx.fill();
                ctx.globalAlpha = 1;
                // Enemies
                ctx.fillStyle = p2;
                for (var ei = 0; ei < 3; ei++) {
                    ctx.fillRect(25 + ei * 30, 12, 12, 8);
                }
                // Bullets
                ctx.fillStyle = accent;
                ctx.shadowColor = accent;
                ctx.shadowBlur = 4;
                for (var bi2 = 0; bi2 < s.bullets.length; bi2++) {
                    ctx.fillRect(s.bullets[bi2].x - 1, s.bullets[bi2].y, 2, 6);
                }
                ctx.shadowBlur = 0;
                break;

            case 'brickblast':
                var bColors = [p2, accent, p1, '#22c55e'];
                for (var br = 0; br < 3; br++) {
                    for (var bc = 0; bc < 5; bc++) {
                        ctx.fillStyle = bColors[br % 4];
                        ctx.beginPath();
                        ctx.roundRect(8 + bc * 22, 6 + br * 10, 18, 7, 2);
                        ctx.fill();
                    }
                }
                // Paddle
                drawGradientRect(ctx, w / 2 - 14, h - 10, 28, 4, fg, fg + '80');
                // Ball
                ctx.shadowColor = accent;
                ctx.shadowBlur = 6;
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(s.ballX, s.ballY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'gravity-run':
                // Neon edges
                ctx.shadowColor = p1;
                ctx.shadowBlur = 4;
                ctx.fillStyle = p1 + '40';
                ctx.fillRect(0, h - 4, w, 4);
                ctx.fillRect(0, 0, w, 4);
                ctx.shadowBlur = 0;
                // Player
                ctx.fillStyle = p1;
                ctx.fillRect(25, h - 18, 10, 10);
                // Obstacles
                ctx.fillStyle = p2 + '60';
                for (var oi3 = 0; oi3 < s.obstacles.length; oi3++) {
                    ctx.fillRect(s.obstacles[oi3].x, h - 28, 12, 20);
                }
                break;

            case 'stampede':
                // Ground
                ctx.fillStyle = fg + '15';
                ctx.fillRect(0, h - 6, w, 6);
                // Runners with bobbing
                var bob = Math.sin(s.runFrame) * 2;
                ctx.fillStyle = p1;
                ctx.fillRect(20, h - 20 + bob, 8, 14);
                ctx.fillStyle = p2;
                ctx.fillRect(40, h - 20 - bob, 8, 14);
                // Obstacles
                ctx.fillStyle = fg + '35';
                for (var oi4 = 0; oi4 < s.obstacles.length; oi4++) {
                    var obs = s.obstacles[oi4];
                    if (obs.type === 0) ctx.fillRect(obs.x, h - 14, 18, 8);
                    else ctx.fillRect(obs.x, h - 28, 18, 3);
                }
                break;

            case 'spin-wars':
                // Arena
                ctx.strokeStyle = fg + '20';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2);
                ctx.stroke();
                // Spinning tops
                var t1x = w / 2 + Math.cos(s.angle1 * 0.3) * 12;
                var t1y = h / 2 + Math.sin(s.angle1 * 0.3) * 8;
                var t2x = w / 2 + Math.cos(s.angle2 * 0.3) * 14;
                var t2y = h / 2 + Math.sin(s.angle2 * 0.3) * 10;
                drawSpinTop(ctx, t1x, t1y, 7, p1, s.angle1);
                drawSpinTop(ctx, t2x, t2y, 7, p2, s.angle2);
                break;

            case 'animal-stack':
                ctx.fillStyle = fg + '15';
                ctx.fillRect(0, h - 6, w, 6);
                var animals = [
                    { x: w / 2 - 12, y: h - 18, c: '#8B4513', sz: 14 },
                    { x: w / 2 - 8, y: h - 32, c: '#FFD700', sz: 12 },
                    { x: w / 2 - 6, y: h - 44 + (s.dropping ? Math.sin(s.t * 3) * 2 : 0), c: '#FF69B4', sz: 10 },
                ];
                animals.forEach(function (a) {
                    // Shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.beginPath();
                    ctx.arc(a.x + a.sz / 2 + 1, a.y + a.sz / 2 + 1, a.sz / 2, 0, Math.PI * 2);
                    ctx.fill();
                    // Body
                    ctx.fillStyle = a.c;
                    ctx.beginPath();
                    ctx.arc(a.x + a.sz / 2, a.y + a.sz / 2, a.sz / 2, 0, Math.PI * 2);
                    ctx.fill();
                    // Eyes
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(a.x + a.sz / 2 - 2, a.y + a.sz / 2 - 2, 1.5, 0, Math.PI * 2);
                    ctx.arc(a.x + a.sz / 2 + 2, a.y + a.sz / 2 - 2, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                });
                break;

            case 'slot-cars':
                // Track
                ctx.strokeStyle = fg + '35';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(10, h - 15);
                ctx.bezierCurveTo(30, 10, 60, h - 10, 80, 15);
                ctx.bezierCurveTo(100, h - 15, 110, 20, 115, h / 2);
                ctx.stroke();
                // Cars moving along track
                var t1 = s.carPos;
                var t2 = (s.carPos + 0.3) % 1;
                var pos1 = getTrackPos(t1, w, h);
                var pos2 = getTrackPos(t2, w, h);
                drawGlowCircle(ctx, pos1.x, pos1.y, 4, p1);
                drawGlowCircle(ctx, pos2.x, pos2.y, 4, p2);
                break;

            case 'crash-it':
                // Road
                ctx.fillStyle = fg + '18';
                ctx.fillRect(20, 5, 80, h - 10);
                ctx.strokeStyle = accent + '30';
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(60, 5); ctx.lineTo(60, h - 5);
                ctx.stroke();
                ctx.setLineDash([]);
                // Cars
                drawMiniCar(ctx, s.car1X, 30, p1, isDark);
                drawMiniCar(ctx, s.car2X, 42, p2, isDark);
                break;

            case 'canon-duel':
                // Terrain
                ctx.fillStyle = '#538d4e';
                ctx.beginPath();
                ctx.moveTo(0, h); ctx.lineTo(0, h - 20);
                ctx.lineTo(30, h - 25); ctx.lineTo(60, h - 15);
                ctx.lineTo(90, h - 30); ctx.lineTo(w, h - 20);
                ctx.lineTo(w, h); ctx.fill();
                // Cannons
                ctx.fillStyle = p1;
                ctx.fillRect(8, h - 30, 10, 6);
                ctx.fillStyle = p2;
                ctx.fillRect(w - 18, h - 28, 10, 6);
                // Projectile arc
                if (s.firing) {
                    ctx.shadowColor = accent;
                    ctx.shadowBlur = 4;
                    ctx.fillStyle = accent;
                    ctx.beginPath();
                    ctx.arc(s.projX, s.projY, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    // Trail
                    ctx.strokeStyle = accent + '40';
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath();
                    ctx.moveTo(18, h - 27);
                    ctx.quadraticCurveTo(s.projX, s.projY - 20, s.projX, s.projY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                break;

            case 'dart':
                // Board rings
                ctx.strokeStyle = fg + '25';
                for (var dr = 3; dr > 0; dr--) {
                    ctx.fillStyle = dr === 3 ? p2 + '30' : dr === 2 ? '#228B22' + '30' : accent + '50';
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, dr * 12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                // Bullseye
                ctx.shadowColor = p2;
                ctx.shadowBlur = 4;
                ctx.fillStyle = p2;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                // Dart
                var dOff = Math.sin(s.t * 2) * 8;
                ctx.fillStyle = fg;
                ctx.beginPath();
                ctx.moveTo(w / 2 + 5 + dOff, h / 2 - 8);
                ctx.lineTo(w / 2 + 3 + dOff, h / 2 - 5);
                ctx.lineTo(w / 2 + 8 + dOff, h / 2 - 3);
                ctx.fill();
                break;

            case 'chess':
                for (var cr = 0; cr < 4; cr++) {
                    for (var cc = 0; cc < 4; cc++) {
                        ctx.fillStyle = (cr + cc) % 2 === 0 ? '#f0d9b5' : '#b58863';
                        ctx.fillRect(20 + cc * 20, 4 + cr * 19, 20, 19);
                    }
                }
                ctx.fillStyle = '#000';
                ctx.font = '14px sans-serif';
                ctx.fillText('\u265C', 23, 18);
                ctx.fillText('\u265E', 43, 18);
                ctx.fillStyle = '#fff';
                ctx.font = '14px sans-serif';
                ctx.fillText('\u2654', 63, 70);
                ctx.fillText('\u2655', 43, 70);
                break;

            case 'stickman-fighter':
                ctx.fillStyle = fg + '12';
                ctx.fillRect(0, h - 10, w, 10);
                // P1
                ctx.fillStyle = p1;
                ctx.fillRect(28, h - 40, 10, 24);
                ctx.beginPath(); ctx.arc(33, h - 46, 6, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(38, h - 38, 14, 4);
                ctx.fillRect(28, h - 16, 4, 8);
                ctx.fillRect(34, h - 16, 4, 8);
                // P2
                ctx.fillStyle = p2;
                ctx.fillRect(80, h - 40, 10, 24);
                ctx.beginPath(); ctx.arc(85, h - 46, 6, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(72, h - 40, 8, 4);
                ctx.fillRect(80, h - 16, 4, 8);
                ctx.fillRect(86, h - 16, 4, 8);
                // Impact
                ctx.fillStyle = accent;
                ctx.shadowColor = accent;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(55, h - 35, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;

            case 'tag':
                ctx.strokeStyle = fg + '20';
                ctx.lineWidth = 1;
                ctx.strokeRect(10, 10, w - 20, h - 20);
                // Chaser
                drawGlowCircle(ctx, 35, h / 2, 8, p2);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 7px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('IT', 35, h / 2 + 3);
                ctx.textAlign = 'start';
                // Runner with trail
                ctx.fillStyle = p1 + '15';
                ctx.beginPath(); ctx.arc(72, h / 2 - 5, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = p1 + '30';
                ctx.beginPath(); ctx.arc(78, h / 2 - 8, 6, 0, Math.PI * 2); ctx.fill();
                drawGlowCircle(ctx, 85, h / 2 - 10, 8, p1);
                break;
        }
    }

    // ── Helper draw functions ──
    function drawGradientRect(ctx, x, y, w, h, c1, c2) {
        var grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
    }

    function drawGlowCircle(ctx, x, y, r, color) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawSpinTop(ctx, x, y, r, color, angle) {
        ctx.save();
        ctx.translate(x, y);
        // Spin blur lines
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = 1;
        for (var i = 0; i < 3; i++) {
            var a = angle + i * (Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.arc(0, 0, r + 2, a, a + 1);
            ctx.stroke();
        }
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // Inner ring
        ctx.strokeStyle = '#ffffff30';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawMiniCar(ctx, x, y, color, isDark) {
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 7, 8, 14, 2);
        ctx.fill();
        // Windshield
        ctx.fillStyle = isDark ? 'rgba(100,200,255,0.3)' : 'rgba(100,150,200,0.4)';
        ctx.fillRect(x - 2, y - 6, 4, 4);
        // Headlights
        ctx.fillStyle = '#ffee88';
        ctx.fillRect(x - 3, y - 7, 2, 2);
        ctx.fillRect(x + 1, y - 7, 2, 2);
    }

    function getTrackPos(t, w, h) {
        // Approximate bezier position
        var t2 = t;
        if (t2 < 0.5) {
            var u = t2 * 2;
            return {
                x: 10 + u * 70,
                y: (h - 15) + (10 - (h - 15)) * u * u + ((h - 10) - 10) * u * (1 - u)
            };
        } else {
            var u2 = (t2 - 0.5) * 2;
            return {
                x: 80 + u2 * 35,
                y: 15 + (h / 2 - 15) * u2
            };
        }
    }
})();
