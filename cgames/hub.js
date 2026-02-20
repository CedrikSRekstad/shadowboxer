/* === Cgames Hub === */
(function () {
    // Init shared systems
    GameShell.init({ backUrl: '../' });

    // Staggered card entrance animation
    var cards = document.querySelectorAll('.game-card');
    cards.forEach(function (card, i) {
        setTimeout(function () {
            card.classList.add('visible');
        }, i * 60);
    });

    // Card click sound
    cards.forEach(function (card) {
        card.addEventListener('click', function () {
            CGameAudio.play('select');
        });
    });

    // Draw mini previews on each card canvas
    var canvases = document.querySelectorAll('.preview-canvas');
    canvases.forEach(function (cvs) {
        var ctx = cvs.getContext('2d');
        var w = cvs.width, h = cvs.height;
        var game = cvs.getAttribute('data-game');
        drawPreview(ctx, w, h, game);
    });

    function drawPreview(ctx, w, h, game) {
        var isDark = document.body.getAttribute('data-theme') === 'dark';
        var bg = isDark ? '#1a1a2e' : '#e0e4ea';
        var fg = isDark ? '#ffffff' : '#1a1a2e';
        var accent = isDark ? '#ffdd00' : '#2563eb';
        var p1 = '#00b4ff';
        var p2 = '#ff4466';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        switch (game) {
            case 'ping-pong':
                ctx.fillStyle = fg;
                ctx.fillRect(8, h / 2 - 12, 4, 24);
                ctx.fillRect(w - 12, h / 2 - 12, 4, 24);
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = fg + '40';
                ctx.beginPath();
                ctx.moveTo(w / 2, 0);
                ctx.lineTo(w / 2, h);
                ctx.stroke();
                ctx.setLineDash([]);
                break;

            case 'air-hockey':
                ctx.strokeStyle = fg + '30';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 15, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, h / 2);
                ctx.lineTo(w, h / 2);
                ctx.stroke();
                ctx.fillStyle = p1;
                ctx.beginPath();
                ctx.arc(w / 2 - 20, h * 0.7, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = p2;
                ctx.beginPath();
                ctx.arc(w / 2 + 15, h * 0.3, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'memory':
                for (var r = 0; r < 2; r++) {
                    for (var c = 0; c < 4; c++) {
                        var x = 12 + c * 26;
                        var y = 12 + r * 28;
                        ctx.fillStyle = (r === 0 && c < 2) ? accent : fg + '20';
                        ctx.fillRect(x, y, 22, 24);
                        ctx.strokeStyle = fg + '30';
                        ctx.strokeRect(x, y, 22, 24);
                        if (r === 0 && c < 2) {
                            ctx.fillStyle = bg;
                            ctx.font = 'bold 14px sans-serif';
                            ctx.fillText(c === 0 ? '★' : '★', x + 5, y + 17);
                        } else {
                            ctx.fillStyle = fg + '40';
                            ctx.font = 'bold 14px sans-serif';
                            ctx.fillText('?', x + 7, y + 17);
                        }
                    }
                }
                break;

            case '2048':
                var colors = ['#eee4da', '#ede0c8', '#f2b179', '#f59563'];
                var nums = [2, 4, 8, 16, 2, 0, 4, 0, 0, 2, 0, 8, 0, 0, 2, 0];
                for (var r = 0; r < 4; r++) {
                    for (var c = 0; c < 4; c++) {
                        var x = 6 + c * 28;
                        var y = 4 + r * 19;
                        var v = nums[r * 4 + c];
                        ctx.fillStyle = v ? colors[Math.min(Math.log2(v) - 1, 3)] : fg + '10';
                        ctx.fillRect(x, y, 25, 16);
                        if (v) {
                            ctx.fillStyle = v > 4 ? '#fff' : '#776e65';
                            ctx.font = 'bold 9px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.fillText(v, x + 12, y + 12);
                            ctx.textAlign = 'start';
                        }
                    }
                }
                break;

            case 'wordle':
                var wColors = ['#538d4e', '#b59f3b', '#3a3a3c', '#538d4e', '#538d4e'];
                var letters = ['C', 'R', 'A', 'N', 'E'];
                for (var i = 0; i < 5; i++) {
                    var x = 10 + i * 22;
                    ctx.fillStyle = wColors[i];
                    ctx.fillRect(x, 25, 18, 18);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(letters[i], x + 9, 39);
                    ctx.textAlign = 'start';
                }
                for (var i = 0; i < 5; i++) {
                    ctx.fillStyle = fg + '15';
                    ctx.fillRect(10 + i * 22, 47, 18, 18);
                }
                break;

            case 'space-shooter':
                // Stars
                for (var i = 0; i < 15; i++) {
                    ctx.fillStyle = fg + '40';
                    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
                }
                // Ship
                ctx.fillStyle = p1;
                ctx.beginPath();
                ctx.moveTo(w / 2, h - 15);
                ctx.lineTo(w / 2 - 8, h - 5);
                ctx.lineTo(w / 2 + 8, h - 5);
                ctx.fill();
                // Enemies
                ctx.fillStyle = p2;
                for (var i = 0; i < 3; i++) {
                    ctx.fillRect(25 + i * 30, 12, 12, 8);
                }
                // Bullet
                ctx.fillStyle = accent;
                ctx.fillRect(w / 2 - 1, h - 25, 2, 8);
                break;

            case 'brickblast':
                var bColors = [p2, accent, p1, '#22c55e'];
                for (var r = 0; r < 3; r++) {
                    for (var c = 0; c < 5; c++) {
                        ctx.fillStyle = bColors[r % 4];
                        ctx.fillRect(8 + c * 22, 6 + r * 10, 18, 7);
                    }
                }
                ctx.fillStyle = fg;
                ctx.fillRect(w / 2 - 14, h - 10, 28, 4);
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(w / 2, h - 20, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'gravity-run':
                ctx.fillStyle = fg + '20';
                ctx.fillRect(0, h - 8, w, 8);
                ctx.fillRect(0, 0, w, 8);
                ctx.fillStyle = p1;
                ctx.fillRect(25, h - 18, 10, 10);
                ctx.fillStyle = p2 + '60';
                ctx.fillRect(60, 8, 15, 20);
                ctx.fillRect(90, h - 28, 15, 20);
                ctx.fillStyle = accent;
                ctx.font = '8px sans-serif';
                ctx.fillText('↕', 18, h - 10);
                break;

            case 'stampede':
                ctx.fillStyle = fg + '20';
                ctx.fillRect(0, h - 8, w, 8);
                ctx.fillStyle = p1;
                ctx.fillRect(20, h - 22, 8, 14);
                ctx.fillStyle = p2;
                ctx.fillRect(40, h - 22, 8, 14);
                ctx.fillStyle = fg + '40';
                ctx.fillRect(70, h - 16, 20, 8);
                ctx.fillRect(100, h - 30, 20, 3);
                break;

            case 'spin-wars':
                ctx.strokeStyle = fg + '30';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = p1;
                ctx.beginPath();
                ctx.arc(w / 2 - 12, h / 2, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = p2;
                ctx.beginPath();
                ctx.arc(w / 2 + 14, h / 2 - 5, 7, 0, Math.PI * 2);
                ctx.fill();
                // Spin lines
                ctx.strokeStyle = p1 + '60';
                ctx.beginPath();
                ctx.arc(w / 2 - 12, h / 2, 10, 0, Math.PI * 1.5);
                ctx.stroke();
                break;

            case 'animal-stack':
                ctx.fillStyle = fg + '20';
                ctx.fillRect(0, h - 6, w, 6);
                var animals = [
                    { x: w / 2 - 12, y: h - 18, c: '#8B4513', s: 14 },
                    { x: w / 2 - 8, y: h - 32, c: '#FFD700', s: 12 },
                    { x: w / 2 - 6, y: h - 44, c: '#FF69B4', s: 10 },
                ];
                animals.forEach(function (a) {
                    ctx.fillStyle = a.c;
                    ctx.beginPath();
                    ctx.arc(a.x + a.s / 2, a.y + a.s / 2, a.s / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(a.x + a.s / 2 - 2, a.y + a.s / 2 - 2, 1.5, 0, Math.PI * 2);
                    ctx.arc(a.x + a.s / 2 + 2, a.y + a.s / 2 - 2, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                });
                break;

            case 'slot-cars':
                ctx.strokeStyle = fg + '40';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(10, h - 15);
                ctx.bezierCurveTo(30, 10, 60, h - 10, 80, 15);
                ctx.bezierCurveTo(100, h - 15, 110, 20, 115, h / 2);
                ctx.stroke();
                ctx.fillStyle = p1;
                ctx.beginPath();
                ctx.arc(30, 35, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = p2;
                ctx.beginPath();
                ctx.arc(70, 55, 4, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'crash-it':
                ctx.fillStyle = fg + '20';
                ctx.fillRect(20, 10, 80, 60);
                ctx.strokeStyle = accent + '40';
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(60, 10);
                ctx.lineTo(60, 70);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = p1;
                ctx.fillRect(35, 30, 8, 14);
                ctx.fillStyle = p2;
                ctx.fillRect(75, 35, 8, 14);
                break;

            case 'canon-duel':
                // Terrain
                ctx.fillStyle = '#538d4e';
                ctx.beginPath();
                ctx.moveTo(0, h);
                ctx.lineTo(0, h - 20);
                ctx.lineTo(30, h - 25);
                ctx.lineTo(60, h - 15);
                ctx.lineTo(90, h - 30);
                ctx.lineTo(w, h - 20);
                ctx.lineTo(w, h);
                ctx.fill();
                ctx.fillStyle = p1;
                ctx.fillRect(8, h - 30, 10, 6);
                ctx.fillStyle = p2;
                ctx.fillRect(w - 18, h - 28, 10, 6);
                // Arc
                ctx.strokeStyle = accent + '60';
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(18, h - 30);
                ctx.quadraticCurveTo(w / 2, -10, w - 13, h - 28);
                ctx.stroke();
                ctx.setLineDash([]);
                break;

            case 'dart':
                ctx.strokeStyle = fg + '30';
                for (var r = 3; r > 0; r--) {
                    ctx.fillStyle = r === 3 ? p2 + '40' : r === 2 ? '#228B22' + '40' : accent + '60';
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, r * 12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.fillStyle = p2;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
                ctx.fill();
                // Dart
                ctx.fillStyle = fg;
                ctx.beginPath();
                ctx.moveTo(w / 2 + 5, h / 2 - 8);
                ctx.lineTo(w / 2 + 3, h / 2 - 5);
                ctx.lineTo(w / 2 + 8, h / 2 - 3);
                ctx.fill();
                break;

            case 'chess':
                for (var r = 0; r < 4; r++) {
                    for (var c = 0; c < 4; c++) {
                        ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863';
                        ctx.fillRect(20 + c * 20, 4 + r * 19, 20, 19);
                    }
                }
                ctx.fillStyle = '#000';
                ctx.font = '14px sans-serif';
                ctx.fillText('♜', 23, 18);
                ctx.fillText('♞', 43, 18);
                ctx.fillStyle = '#fff';
                ctx.font = '14px sans-serif';
                ctx.fillText('♔', 63, 70);
                ctx.fillText('♕', 43, 70);
                break;

            case 'shadow-fighter':
                // Arena floor
                ctx.fillStyle = fg + '15';
                ctx.fillRect(0, h - 10, w, 10);
                // P1 fighter (left, blue)
                ctx.fillStyle = p1;
                ctx.fillRect(28, h - 40, 10, 24); // body
                ctx.beginPath();
                ctx.arc(33, h - 46, 6, 0, Math.PI * 2); // head
                ctx.fill();
                // P1 arm (punching right)
                ctx.fillRect(38, h - 38, 14, 4);
                // P1 legs
                ctx.fillRect(28, h - 16, 4, 8);
                ctx.fillRect(34, h - 16, 4, 8);
                // P2 fighter (right, red)
                ctx.fillStyle = p2;
                ctx.fillRect(80, h - 40, 10, 24); // body
                ctx.beginPath();
                ctx.arc(85, h - 46, 6, 0, Math.PI * 2); // head
                ctx.fill();
                // P2 arm (blocking)
                ctx.fillRect(72, h - 40, 8, 4);
                // P2 legs
                ctx.fillRect(80, h - 16, 4, 8);
                ctx.fillRect(86, h - 16, 4, 8);
                // Impact spark
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(55, h - 35, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = accent + '40';
                ctx.beginPath();
                ctx.arc(55, h - 35, 6, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'tag':
                // Play area
                ctx.strokeStyle = fg + '25';
                ctx.lineWidth = 1;
                ctx.strokeRect(10, 10, w - 20, h - 20);
                // P1 (chaser, "IT")
                ctx.fillStyle = p2;
                ctx.beginPath();
                ctx.arc(35, h / 2, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 7px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('IT', 35, h / 2 + 3);
                ctx.textAlign = 'start';
                // P2 (runner)
                ctx.fillStyle = p1;
                ctx.beginPath();
                ctx.arc(85, h / 2 - 10, 8, 0, Math.PI * 2);
                ctx.fill();
                // Motion trail for runner
                ctx.fillStyle = p1 + '30';
                ctx.beginPath();
                ctx.arc(78, h / 2 - 8, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = p1 + '15';
                ctx.beginPath();
                ctx.arc(72, h / 2 - 5, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }
})();
