/* === Space Shooter - Cgames === */
(function () {
    'use strict';

    // ── Constants ──
    var CANVAS_W = 480;
    var CANVAS_H = 640;
    var DT_CAP = 50;
    var STAR_COUNT = 80;
    var BULLET_SPEED = 500;
    var PLAYER_SPEED = 280;
    var PLAYER_W = 28;
    var PLAYER_H = 32;
    var BULLET_W = 4;
    var BULLET_H = 12;
    var INVULN_TIME = 1.5;
    var FIRE_RATE = 0.15; // seconds between shots
    var SPREAD_FIRE_RATE = 0.2;
    var POWERUP_SPEED = 80;
    var POWERUP_SIZE = 20;
    var POWERUP_DURATION = 8;
    var VERSUS_TIME = 120; // seconds

    // Enemy constants
    var E_BASIC = 0, E_ZIGZAG = 1, E_DIVEBOMBER = 2;
    var ENEMY_DEFS = [
        { type: E_BASIC, hp: 1, speed: 120, size: 22, score: 100, color: '#ff6644' },
        { type: E_ZIGZAG, hp: 2, speed: 100, size: 20, score: 200, color: '#ffaa22' },
        { type: E_DIVEBOMBER, hp: 3, speed: 90, size: 24, score: 300, color: '#cc44ff' }
    ];

    // Power-up types
    var PW_SPREAD = 0, PW_SHIELD = 1, PW_SPEED = 2;
    var POWERUP_COLORS = ['#00ff88', '#44ccff', '#ffcc00'];
    var POWERUP_LABELS = ['S', 'D', 'F'];

    // ── State ──
    var canvas, ctx;
    var gameMode = '1p'; // '1p', 'coop', 'versus'
    var gameRunning = false;
    var paused = false;
    var players = [];
    var bullets = [];
    var enemies = [];
    var particles = [];
    var powerups = [];
    var stars = [];
    var wave = 0;
    var waveTimer = 0;
    var waveDelay = 0;
    var enemiesToSpawn = 0;
    var spawnTimer = 0;
    var versusTimer = 0;
    var waveAnnounceTimer = 0;
    var keys = {};

    // Touch state
    var touchJoystick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
    var touchFiring = false;

    // ── Visual FX State ──
    var screenShake = { x: 0, y: 0, intensity: 0 };
    var shockwaves = [];
    var nebulaLayer = []; // pre-computed nebula cloud positions
    var starLayers = [[], [], []]; // 3 parallax layers

    // ── Helpers ──
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function rand(lo, hi) { return Math.random() * (hi - lo) + lo; }
    function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
    function rectHit(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    function dist(a, b) {
        var dx = a.x - b.x, dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ── Color helpers for gradients ──
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return { r: r, g: g, b: b };
    }

    function lightenColor(hex, amount) {
        var c = hexToRgb(hex);
        c.r = Math.min(255, c.r + amount);
        c.g = Math.min(255, c.g + amount);
        c.b = Math.min(255, c.b + amount);
        return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    }

    function darkenColor(hex, amount) {
        var c = hexToRgb(hex);
        c.r = Math.max(0, c.r - amount);
        c.g = Math.max(0, c.g - amount);
        c.b = Math.max(0, c.b - amount);
        return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    }

    // ── Parallax Stars & Nebula ──
    function initStars() {
        stars = [];
        starLayers = [[], [], []];

        // Layer 0: far, slow, small, dim
        for (var i = 0; i < 40; i++) {
            starLayers[0].push({
                x: rand(0, CANVAS_W),
                y: rand(0, CANVAS_H),
                s: rand(0.5, 1.2),
                speed: rand(20, 50),
                brightness: rand(0.15, 0.35)
            });
        }
        // Layer 1: mid
        for (var i = 0; i < 30; i++) {
            starLayers[1].push({
                x: rand(0, CANVAS_W),
                y: rand(0, CANVAS_H),
                s: rand(1.0, 2.0),
                speed: rand(60, 110),
                brightness: rand(0.3, 0.6)
            });
        }
        // Layer 2: near, fast, bright
        for (var i = 0; i < 20; i++) {
            starLayers[2].push({
                x: rand(0, CANVAS_W),
                y: rand(0, CANVAS_H),
                s: rand(1.5, 2.8),
                speed: rand(120, 200),
                brightness: rand(0.5, 0.9)
            });
        }

        // Legacy stars array (keep for compat)
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: rand(0, CANVAS_W),
                y: rand(0, CANVAS_H),
                s: rand(0.5, 2.5),
                speed: rand(40, 160)
            });
        }

        // Generate nebula cloud positions
        nebulaLayer = [];
        for (var i = 0; i < 5; i++) {
            nebulaLayer.push({
                x: rand(0, CANVAS_W),
                y: rand(0, CANVAS_H),
                radius: rand(80, 180),
                color: ['#1a0033', '#001a33', '#0d1a2e', '#1a0a2e', '#0a1a1a'][i],
                hue: rand(0, 360),
                speed: rand(5, 15),
                alpha: rand(0.04, 0.1)
            });
        }
    }

    function updateStars(dt) {
        // Update parallax layers
        for (var layer = 0; layer < 3; layer++) {
            var arr = starLayers[layer];
            for (var i = 0; i < arr.length; i++) {
                var s = arr[i];
                s.y += s.speed * dt;
                if (s.y > CANVAS_H) {
                    s.y = -2;
                    s.x = rand(0, CANVAS_W);
                }
            }
        }

        // Update nebula clouds (slow drift)
        for (var i = 0; i < nebulaLayer.length; i++) {
            var n = nebulaLayer[i];
            n.y += n.speed * dt;
            if (n.y - n.radius > CANVAS_H) {
                n.y = -n.radius;
                n.x = rand(0, CANVAS_W);
            }
        }

        // Legacy stars update (kept for compatibility)
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            s.y += s.speed * dt;
            if (s.y > CANVAS_H) {
                s.y = -2;
                s.x = rand(0, CANVAS_W);
            }
        }
    }

    function drawBackground() {
        var style = getComputedStyle(document.documentElement);
        var bgColor = style.getPropertyValue('--canvas-bg').trim() || '#0d0d1a';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Draw nebula clouds (soft radial gradients)
        for (var i = 0; i < nebulaLayer.length; i++) {
            var n = nebulaLayer[i];
            var grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            // Shift hue subtly over time
            var pulse = Math.sin(Date.now() * 0.0003 + i * 1.5) * 0.02;
            var nebColors = [
                'rgba(60, 20, 120,',  // purple
                'rgba(20, 60, 120,',  // blue
                'rgba(20, 80, 80,',   // teal
                'rgba(80, 20, 100,',  // magenta
                'rgba(30, 50, 80,'    // deep blue
            ];
            var baseAlpha = n.alpha + pulse;
            grad.addColorStop(0, nebColors[i % nebColors.length] + (baseAlpha * 1.5).toFixed(3) + ')');
            grad.addColorStop(0.5, nebColors[i % nebColors.length] + (baseAlpha * 0.5).toFixed(3) + ')');
            grad.addColorStop(1, nebColors[i % nebColors.length] + '0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }

        // Draw parallax star layers
        var starColors = ['#8888cc', '#aaaadd', '#ffffff'];
        for (var layer = 0; layer < 3; layer++) {
            var arr = starLayers[layer];
            for (var i = 0; i < arr.length; i++) {
                var s = arr[i];
                // Twinkling effect
                var twinkle = Math.sin(Date.now() * 0.003 + i * 7 + layer * 100) * 0.15;
                ctx.globalAlpha = clamp(s.brightness + twinkle, 0.05, 1.0);
                ctx.fillStyle = starColors[layer];
                ctx.fillRect(s.x, s.y, s.s, s.s);
            }
        }
        ctx.globalAlpha = 1;
    }

    // ── Screen Shake ──
    function triggerShake(intensity) {
        screenShake.intensity = Math.max(screenShake.intensity, intensity);
    }

    function updateScreenShake(dt) {
        if (screenShake.intensity > 0.1) {
            screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
            screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
            screenShake.intensity *= 0.9;
        } else {
            screenShake.x = 0;
            screenShake.y = 0;
            screenShake.intensity = 0;
        }
    }

    // ── Shockwave System ──
    function spawnShockwave(x, y, maxRadius, color) {
        shockwaves.push({
            x: x,
            y: y,
            radius: 5,
            maxRadius: maxRadius || 50,
            life: 1.0,
            color: color || '#ffffff'
        });
    }

    function updateShockwaves(dt) {
        for (var i = shockwaves.length - 1; i >= 0; i--) {
            var sw = shockwaves[i];
            sw.life -= dt * 2.5;
            sw.radius += (sw.maxRadius - sw.radius) * dt * 6;
            if (sw.life <= 0) {
                shockwaves.splice(i, 1);
            }
        }
    }

    function drawShockwaves() {
        for (var i = 0; i < shockwaves.length; i++) {
            var sw = shockwaves[i];
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = Math.max(1, 3 * sw.life);
            ctx.globalAlpha = sw.life * 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
    }

    // ── Player ──
    function createPlayer(index) {
        var startX = index === 0 ? CANVAS_W * 0.35 : CANVAS_W * 0.65;
        if (gameMode === '1p') startX = CANVAS_W * 0.5;
        return {
            index: index,
            x: startX - PLAYER_W / 2,
            y: CANVAS_H - 70,
            w: PLAYER_W,
            h: PLAYER_H,
            vx: 0,
            vy: 0,
            lives: 3,
            score: 0,
            alive: true,
            invuln: 0,
            fireTimer: 0,
            firing: false,
            speed: PLAYER_SPEED,
            spreadShot: false,
            spreadTimer: 0,
            shield: false,
            speedBoost: false,
            speedTimer: 0,
            color: index === 0 ? getComputedProp('--p1-color') : getComputedProp('--p2-color'),
            lightColor: index === 0 ? getComputedProp('--p1-light') : getComputedProp('--p2-light')
        };
    }

    function getComputedProp(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || (name === '--p1-color' ? '#00b4ff' : '#ff4466');
    }

    function updatePlayer(p, dt) {
        if (!p.alive) return;

        // Move
        var spd = p.speedBoost ? p.speed * 1.5 : p.speed;
        p.x += p.vx * spd * dt;
        p.y += p.vy * spd * dt;
        p.x = clamp(p.x, 0, CANVAS_W - p.w);
        p.y = clamp(p.y, 0, CANVAS_H - p.h);

        // Invulnerability
        if (p.invuln > 0) p.invuln -= dt;

        // Power-up timers
        if (p.spreadTimer > 0) {
            p.spreadTimer -= dt;
            if (p.spreadTimer <= 0) p.spreadShot = false;
        }
        if (p.speedTimer > 0) {
            p.speedTimer -= dt;
            if (p.speedTimer <= 0) p.speedBoost = false;
        }

        // Firing
        p.fireTimer -= dt;
        if (p.firing && p.fireTimer <= 0) {
            fireBullet(p);
            p.fireTimer = p.spreadShot ? SPREAD_FIRE_RATE : FIRE_RATE;
        }
    }

    function fireBullet(p) {
        var cx = p.x + p.w / 2;
        var by = p.y - 4;

        bullets.push({
            x: cx - BULLET_W / 2,
            y: by,
            w: BULLET_W,
            h: BULLET_H,
            vy: -BULLET_SPEED,
            vx: 0,
            owner: p.index,
            color: p.color,
            trail: []
        });

        if (p.spreadShot) {
            bullets.push({
                x: cx - BULLET_W / 2 - 8,
                y: by + 4,
                w: BULLET_W,
                h: BULLET_H,
                vy: -BULLET_SPEED * 0.96,
                vx: -BULLET_SPEED * 0.2,
                owner: p.index,
                color: p.color,
                trail: []
            });
            bullets.push({
                x: cx - BULLET_W / 2 + 8,
                y: by + 4,
                w: BULLET_W,
                h: BULLET_H,
                vy: -BULLET_SPEED * 0.96,
                vx: BULLET_SPEED * 0.2,
                owner: p.index,
                color: p.color,
                trail: []
            });
        }

        CGameAudio.play('whoosh');
    }

    function drawPlayer(p) {
        if (!p.alive) return;

        // Blink when invulnerable
        if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) return;

        var cx = p.x + p.w / 2;
        var cy = p.y + p.h / 2;
        var isMoving = (p.vx !== 0 || p.vy !== 0 || p.firing);

        // Engine thrust animation (flickering orange/yellow glow behind ship)
        if (isMoving || p.firing) {
            var thrustLength = 8 + Math.random() * 10;
            var thrustWidth = 6 + Math.random() * 4;
            var thrustGrad = ctx.createLinearGradient(cx, p.y + p.h, cx, p.y + p.h + thrustLength);
            thrustGrad.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
            thrustGrad.addColorStop(0.4, 'rgba(255, 120, 0, 0.6)');
            thrustGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');

            // Left engine flame
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx - 6, p.y + p.h - 2);
            ctx.lineTo(cx - 6 - thrustWidth / 2, p.y + p.h + thrustLength);
            ctx.lineTo(cx - 6 + thrustWidth / 2, p.y + p.h + thrustLength);
            ctx.closePath();
            ctx.fillStyle = thrustGrad;
            ctx.globalAlpha = 0.7 + Math.random() * 0.3;
            ctx.fill();

            // Right engine flame
            ctx.beginPath();
            ctx.moveTo(cx + 6, p.y + p.h - 2);
            ctx.lineTo(cx + 6 - thrustWidth / 2, p.y + p.h + thrustLength);
            ctx.lineTo(cx + 6 + thrustWidth / 2, p.y + p.h + thrustLength);
            ctx.closePath();
            ctx.fill();

            // Engine glow halo
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(cx, p.y + p.h + 2, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 150, 0, 0.3)';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Shield glow
        if (p.shield) {
            ctx.beginPath();
            ctx.arc(cx, cy, p.w * 0.9, 0, Math.PI * 2);
            ctx.strokeStyle = '#44ccff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.008) * 0.2;
            ctx.shadowColor = '#44ccff';
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Speed boost trail
        if (p.speedBoost) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 8;
            ctx.fillRect(p.x + 3, p.y + p.h, p.w - 6, 8);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Ship body with gradient fill
        var bodyGrad = ctx.createLinearGradient(cx, p.y, cx, p.y + p.h);
        bodyGrad.addColorStop(0, lightenColor(p.color, 60));
        bodyGrad.addColorStop(0.4, p.color);
        bodyGrad.addColorStop(1, darkenColor(p.color, 50));

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(cx, p.y);
        ctx.lineTo(p.x, p.y + p.h);
        ctx.lineTo(cx - 4, p.y + p.h - 8);
        ctx.lineTo(cx + 4, p.y + p.h - 8);
        ctx.lineTo(p.x + p.w, p.y + p.h);
        ctx.closePath();
        ctx.fill();

        // Subtle ship glow aura
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Cockpit with gradient
        var cockpitGrad = ctx.createLinearGradient(cx, p.y + 6, cx, p.y + p.h * 0.6);
        cockpitGrad.addColorStop(0, lightenColor(p.lightColor, 80));
        cockpitGrad.addColorStop(1, p.lightColor);

        ctx.fillStyle = cockpitGrad;
        ctx.beginPath();
        ctx.moveTo(cx, p.y + 6);
        ctx.lineTo(cx - 5, p.y + p.h * 0.6);
        ctx.lineTo(cx + 5, p.y + p.h * 0.6);
        ctx.closePath();
        ctx.fill();

        // Static engine glow dots (always visible)
        ctx.fillStyle = '#ff8800';
        ctx.globalAlpha = 0.6 + Math.random() * 0.3;
        ctx.fillRect(cx - 5, p.y + p.h - 2, 4, 4 + Math.random() * 4);
        ctx.fillRect(cx + 1, p.y + p.h - 2, 4, 4 + Math.random() * 4);
        ctx.globalAlpha = 1;
    }

    function hitPlayer(p) {
        if (p.invuln > 0 || !p.alive) return;

        if (p.shield) {
            p.shield = false;
            p.invuln = 0.5;
            CGameAudio.play('hit');
            spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#44ccff', 8);
            spawnShockwave(p.x + p.w / 2, p.y + p.h / 2, 30, '#44ccff');
            return;
        }

        p.lives--;
        CGameAudio.play('hit');
        spawnExplosionParticles(p.x + p.w / 2, p.y + p.h / 2, p.color, 15);
        spawnShockwave(p.x + p.w / 2, p.y + p.h / 2, 40, p.color);
        triggerShake(5);

        if (p.lives <= 0) {
            p.alive = false;
            spawnExplosionParticles(p.x + p.w / 2, p.y + p.h / 2, p.color, 30);
            spawnShockwave(p.x + p.w / 2, p.y + p.h / 2, 70, '#ffffff');
            triggerShake(12);
            CGameAudio.play('lose');
        } else {
            p.invuln = INVULN_TIME;
            // Reset position
            p.x = (p.index === 0 ? CANVAS_W * 0.35 : CANVAS_W * 0.65) - PLAYER_W / 2;
            if (gameMode === '1p') p.x = CANVAS_W * 0.5 - PLAYER_W / 2;
            p.y = CANVAS_H - 70;
        }

        updateHUD();
    }

    // ── Bullets ──
    function updateBullets(dt) {
        for (var i = bullets.length - 1; i >= 0; i--) {
            var b = bullets[i];
            // Store trail position
            b.trail.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
            if (b.trail.length > 8) b.trail.shift();

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            if (b.y < -20 || b.y > CANVAS_H + 20 || b.x < -20 || b.x > CANVAS_W + 20) {
                bullets.splice(i, 1);
            }
        }
    }

    function drawBullets() {
        for (var i = 0; i < bullets.length; i++) {
            var b = bullets[i];

            // Streak trail with glow
            ctx.save();
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;

            for (var t = 0; t < b.trail.length; t++) {
                var alpha = (t / b.trail.length) * 0.5;
                ctx.fillStyle = b.color;
                ctx.globalAlpha = alpha;
                var sz = 1 + (t / b.trail.length) * 3;
                ctx.fillRect(b.trail[t].x - sz / 2, b.trail[t].y - sz / 2, sz, sz);
            }
            ctx.globalAlpha = 1;

            // Main bullet with strong glow
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 12;

            // Gradient fill for bullet
            var bGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
            bGrad.addColorStop(0, '#ffffff');
            bGrad.addColorStop(0.3, lightenColor(b.color, 60));
            bGrad.addColorStop(1, b.color);
            ctx.fillStyle = bGrad;
            ctx.fillRect(b.x, b.y, b.w, b.h);

            // Extra bright core
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(b.x + 1, b.y, b.w - 2, b.h * 0.4);
            ctx.globalAlpha = 1;

            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    // ── Enemies ──
    function createEnemy(type, x) {
        var def = ENEMY_DEFS[type];
        return {
            type: type,
            x: x - def.size / 2,
            y: -def.size - 10,
            w: def.size,
            h: def.size,
            hp: def.hp,
            maxHp: def.hp,
            speed: def.speed,
            score: def.score,
            color: def.color,
            timer: 0,
            zigDir: Math.random() < 0.5 ? 1 : -1,
            alive: true
        };
    }

    function updateEnemies(dt) {
        for (var i = enemies.length - 1; i >= 0; i--) {
            var e = enemies[i];
            if (!e.alive) { enemies.splice(i, 1); continue; }

            e.timer += dt;

            switch (e.type) {
                case E_BASIC:
                    e.y += e.speed * dt;
                    break;
                case E_ZIGZAG:
                    e.y += e.speed * dt;
                    e.x += Math.sin(e.timer * 3) * 120 * dt * e.zigDir;
                    break;
                case E_DIVEBOMBER:
                    // Aim at nearest alive player
                    var target = nearestPlayer(e);
                    if (target) {
                        var angle = Math.atan2(target.y - e.y, (target.x + target.w / 2) - (e.x + e.w / 2));
                        e.x += Math.cos(angle) * e.speed * dt;
                        e.y += Math.sin(angle) * e.speed * dt;
                    } else {
                        e.y += e.speed * dt;
                    }
                    break;
            }

            // Keep in horizontal bounds
            e.x = clamp(e.x, -e.w * 0.5, CANVAS_W - e.w * 0.5);

            // Off screen bottom
            if (e.y > CANVAS_H + 40) {
                enemies.splice(i, 1);
            }
        }
    }

    function nearestPlayer(e) {
        var best = null, bestD = 99999;
        for (var i = 0; i < players.length; i++) {
            if (!players[i].alive) continue;
            var d = dist(
                { x: e.x + e.w / 2, y: e.y + e.h / 2 },
                { x: players[i].x + players[i].w / 2, y: players[i].y + players[i].h / 2 }
            );
            if (d < bestD) { bestD = d; best = players[i]; }
        }
        return best;
    }

    function drawEnemies() {
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            var cx = e.x + e.w / 2;
            var cy = e.y + e.h / 2;
            var half = e.w / 2;

            // Glow aura behind enemy
            ctx.save();
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 14;

            // Create gradient fill for enemy
            var eGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, half);
            eGrad.addColorStop(0, lightenColor(e.color, 80));
            eGrad.addColorStop(0.5, e.color);
            eGrad.addColorStop(1, darkenColor(e.color, 40));
            ctx.fillStyle = eGrad;

            switch (e.type) {
                case E_BASIC:
                    // Square with rotation
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(e.timer * 1.5);
                    ctx.fillRect(-half, -half, e.w, e.h);
                    ctx.restore();
                    break;
                case E_ZIGZAG:
                    // Diamond
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y);
                    ctx.lineTo(e.x + e.w, cy);
                    ctx.lineTo(cx, e.y + e.h);
                    ctx.lineTo(e.x, cy);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case E_DIVEBOMBER:
                    // Hexagon-ish
                    ctx.beginPath();
                    for (var a = 0; a < 6; a++) {
                        var angle = (Math.PI * 2 / 6) * a - Math.PI / 2;
                        var px = cx + Math.cos(angle) * half;
                        var py = cy + Math.sin(angle) * half;
                        if (a === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;
            }

            ctx.shadowBlur = 0;
            ctx.restore();

            // Subtle pulsing outline
            ctx.strokeStyle = lightenColor(e.color, 40);
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005 + i) * 0.15;
            switch (e.type) {
                case E_BASIC:
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(e.timer * 1.5);
                    ctx.strokeRect(-half - 2, -half - 2, e.w + 4, e.h + 4);
                    ctx.restore();
                    break;
                case E_ZIGZAG:
                    ctx.beginPath();
                    ctx.moveTo(cx, e.y - 2);
                    ctx.lineTo(e.x + e.w + 2, cy);
                    ctx.lineTo(cx, e.y + e.h + 2);
                    ctx.lineTo(e.x - 2, cy);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                case E_DIVEBOMBER:
                    ctx.beginPath();
                    for (var a = 0; a < 6; a++) {
                        var angle = (Math.PI * 2 / 6) * a - Math.PI / 2;
                        var px = cx + Math.cos(angle) * (half + 2);
                        var py = cy + Math.sin(angle) * (half + 2);
                        if (a === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;

            // HP bar for multi-hit enemies
            if (e.maxHp > 1) {
                var barW = e.w + 4;
                var barH = 3;
                var barX = e.x - 2;
                var barY = e.y - 6;
                ctx.fillStyle = '#333';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = '#00ff44';
                ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
            }
        }
    }

    // ── Power-ups ──
    function spawnPowerup(x, y) {
        if (Math.random() > 0.25) return; // 25% drop rate
        var type = randInt(0, 2);
        powerups.push({
            x: x - POWERUP_SIZE / 2,
            y: y,
            w: POWERUP_SIZE,
            h: POWERUP_SIZE,
            type: type,
            timer: 0
        });
    }

    function updatePowerups(dt) {
        for (var i = powerups.length - 1; i >= 0; i--) {
            var pw = powerups[i];
            pw.y += POWERUP_SPEED * dt;
            pw.timer += dt;
            if (pw.y > CANVAS_H + 30) {
                powerups.splice(i, 1);
                continue;
            }

            // Check pickup by players
            for (var j = 0; j < players.length; j++) {
                var p = players[j];
                if (!p.alive) continue;
                if (rectHit(pw, p)) {
                    applyPowerup(p, pw.type);
                    powerups.splice(i, 1);
                    break;
                }
            }
        }
    }

    function applyPowerup(p, type) {
        CGameAudio.play('score');
        spawnParticles(p.x + p.w / 2, p.y, POWERUP_COLORS[type], 8);

        switch (type) {
            case PW_SPREAD:
                p.spreadShot = true;
                p.spreadTimer = POWERUP_DURATION;
                break;
            case PW_SHIELD:
                p.shield = true;
                break;
            case PW_SPEED:
                p.speedBoost = true;
                p.speedTimer = POWERUP_DURATION;
                break;
        }
    }

    function drawPowerups() {
        for (var i = 0; i < powerups.length; i++) {
            var pw = powerups[i];
            var cx = pw.x + pw.w / 2;
            var cy = pw.y + pw.h / 2;
            var pulsePhase = Math.sin(pw.timer * 5);
            var pulseScale = 1 + pulsePhase * 0.1;
            var glowIntensity = 10 + pulsePhase * 8;

            ctx.save();

            // Outer pulsing glow aura
            ctx.shadowColor = POWERUP_COLORS[pw.type];
            ctx.shadowBlur = glowIntensity;

            // Outer glow ring
            ctx.beginPath();
            ctx.arc(cx, cy, pw.w * 0.7 * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = POWERUP_COLORS[pw.type];
            ctx.globalAlpha = 0.12 + Math.sin(pw.timer * 5) * 0.08;
            ctx.fill();
            ctx.globalAlpha = 1;

            // Icon circle with gradient
            var pwGrad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, pw.w / 2);
            pwGrad.addColorStop(0, lightenColor(POWERUP_COLORS[pw.type], 80));
            pwGrad.addColorStop(0.6, POWERUP_COLORS[pw.type]);
            pwGrad.addColorStop(1, darkenColor(POWERUP_COLORS[pw.type], 40));
            ctx.beginPath();
            ctx.arc(cx, cy, (pw.w / 2) * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = pwGrad;
            ctx.fill();

            // Glow ring border
            ctx.strokeStyle = lightenColor(POWERUP_COLORS[pw.type], 60);
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5 + pulsePhase * 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.shadowBlur = 0;

            // Label
            ctx.fillStyle = '#000';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(POWERUP_LABELS[pw.type], cx, cy);

            ctx.restore();
        }
    }

    // ── Particles ──
    function spawnParticles(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            var angle = rand(0, Math.PI * 2);
            var speed = rand(50, 200);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: rand(0.3, 0.8),
                maxLife: rand(0.3, 0.8),
                size: rand(2, 5),
                color: color
            });
        }
    }

    // Enhanced explosion particles with varied colors
    function spawnExplosionParticles(x, y, baseColor, count) {
        var explosionColors = ['#ffffff', '#ffff44', '#ffaa00', '#ff6600', baseColor];

        for (var i = 0; i < count; i++) {
            var angle = rand(0, Math.PI * 2);
            var speed = rand(60, 280);
            var colorIdx = Math.floor(rand(0, explosionColors.length));
            var life = rand(0.3, 1.0);
            particles.push({
                x: x + rand(-3, 3),
                y: y + rand(-3, 3),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life,
                maxLife: life,
                size: rand(2, 7),
                color: explosionColors[colorIdx]
            });
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            // Slow down particles slightly for a nicer look
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        ctx.save();
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var lifeRatio = clamp(p.life / p.maxLife, 0, 1);
            var currentSize = p.size * lifeRatio;

            ctx.fillStyle = p.color;
            ctx.globalAlpha = lifeRatio;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6 * lifeRatio;

            // Draw as circle for softer look
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ── Wave System ──
    function startWave() {
        wave++;
        waveDelay = 2;
        waveAnnounceTimer = 1.5;

        // Calculate enemies for wave
        var baseCount = 5 + wave * 3;
        if (gameMode === 'coop') baseCount = Math.floor(baseCount * 2);
        if (gameMode === 'versus') baseCount = Math.floor(baseCount * 1.2);
        enemiesToSpawn = baseCount;
        spawnTimer = 0;

        // Show wave announcement
        showWaveAnnounce('Wave ' + wave);

        updateHUD();
    }

    function showWaveAnnounce(text) {
        var container = document.getElementById('canvas-container');
        var existing = container.querySelector('.wave-announce');
        if (existing) existing.remove();

        var el = document.createElement('div');
        el.className = 'wave-announce';
        el.textContent = text;
        container.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.remove(); }, 1600);
    }

    function updateWaveSpawning(dt) {
        if (waveDelay > 0) {
            waveDelay -= dt;
            return;
        }

        if (enemiesToSpawn > 0) {
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                // Pick enemy type based on wave
                var type = E_BASIC;
                var r = Math.random();
                if (wave >= 3 && r < 0.15 + wave * 0.02) {
                    type = E_DIVEBOMBER;
                } else if (wave >= 2 && r < 0.3 + wave * 0.03) {
                    type = E_ZIGZAG;
                }

                var x = rand(30, CANVAS_W - 30);
                enemies.push(createEnemy(type, x));
                enemiesToSpawn--;

                // Spawn interval decreases with wave
                spawnTimer = Math.max(0.3, 1.2 - wave * 0.05);
            }
        } else if (enemies.length === 0) {
            // Wave complete
            waveTimer += dt;
            if (waveTimer > 1.5) {
                waveTimer = 0;
                startWave();
            }
        }
    }

    // ── Collisions ──
    function checkCollisions() {
        // Bullets vs enemies
        for (var i = bullets.length - 1; i >= 0; i--) {
            var b = bullets[i];
            // Only player bullets (going up) hit enemies
            if (b.vy >= 0) continue;

            for (var j = enemies.length - 1; j >= 0; j--) {
                var e = enemies[j];
                if (!e.alive) continue;

                if (rectHit(b, e)) {
                    e.hp--;
                    bullets.splice(i, 1);

                    if (e.hp <= 0) {
                        e.alive = false;
                        spawnExplosionParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 18);
                        spawnShockwave(e.x + e.w / 2, e.y + e.h / 2, 35 + e.w, e.color);
                        triggerShake(4);
                        CGameAudio.play('hit');
                        spawnPowerup(e.x + e.w / 2, e.y + e.h / 2);

                        // Award score to bullet owner
                        if (players[b.owner]) {
                            players[b.owner].score += e.score;
                            updateHUD();
                        }
                    } else {
                        spawnParticles(b.x + b.w / 2, b.y, '#fff', 4);
                        CGameAudio.play('pop');
                    }
                    break;
                }
            }
        }

        // Bullets vs players (versus mode)
        if (gameMode === 'versus') {
            for (var i = bullets.length - 1; i >= 0; i--) {
                var b = bullets[i];
                for (var j = 0; j < players.length; j++) {
                    var p = players[j];
                    if (!p.alive || p.index === b.owner) continue;
                    if (rectHit(b, p)) {
                        bullets.splice(i, 1);
                        hitPlayer(p);
                        break;
                    }
                }
            }
        }

        // Enemies vs players
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (!e.alive) continue;

            for (var j = 0; j < players.length; j++) {
                var p = players[j];
                if (!p.alive || p.invuln > 0) continue;

                if (rectHit(e, p)) {
                    hitPlayer(p);
                    e.alive = false;
                    spawnExplosionParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 14);
                    spawnShockwave(e.x + e.w / 2, e.y + e.h / 2, 40, e.color);
                    triggerShake(6);
                }
            }
        }

        // Player pickup power-ups handled in updatePowerups
    }

    // ── Input ──
    function handleInput() {
        // P1 controls
        var p1 = players[0];
        if (p1 && p1.alive) {
            var p1vx = 0, p1vy = 0;
            if (keys['KeyW'] || keys['KeyW'.toLowerCase()] || keys['w']) p1vy = -1;
            if (keys['KeyS'] || keys['KeyS'.toLowerCase()] || keys['s']) p1vy = 1;
            if (keys['KeyA'] || keys['KeyA'.toLowerCase()] || keys['a']) p1vx = -1;
            if (keys['KeyD'] || keys['KeyD'.toLowerCase()] || keys['d']) p1vx = 1;

            // Touch override for P1
            if (touchJoystick.active) {
                p1vx = touchJoystick.dx;
                p1vy = touchJoystick.dy;
            }

            // Normalize diagonal
            if (p1vx !== 0 && p1vy !== 0) {
                var len = Math.sqrt(p1vx * p1vx + p1vy * p1vy);
                p1vx /= len;
                p1vy /= len;
            }

            p1.vx = p1vx;
            p1.vy = p1vy;
            p1.firing = !!(keys['KeyC'] || keys['c'] || keys['Space'] || keys[' '] || touchFiring);
        }

        // P2 controls
        if (players.length > 1) {
            var p2 = players[1];
            if (p2 && p2.alive) {
                var p2vx = 0, p2vy = 0;
                if (keys['ArrowUp']) p2vy = -1;
                if (keys['ArrowDown']) p2vy = 1;
                if (keys['ArrowLeft']) p2vx = -1;
                if (keys['ArrowRight']) p2vx = 1;

                if (p2vx !== 0 && p2vy !== 0) {
                    var len2 = Math.sqrt(p2vx * p2vx + p2vy * p2vy);
                    p2vx /= len2;
                    p2vy /= len2;
                }

                p2.vx = p2vx;
                p2.vy = p2vy;
                p2.firing = !!(keys['Period'] || keys['.'] || keys['Enter']);
            }
        }
    }

    // ── Game Over Check ──
    function checkGameOver() {
        if (gameMode === '1p') {
            if (!players[0].alive) {
                endGame();
            }
        } else if (gameMode === 'coop') {
            var allDead = true;
            for (var i = 0; i < players.length; i++) {
                if (players[i].alive) allDead = false;
            }
            if (allDead) endGame();
        } else if (gameMode === 'versus') {
            // Check time limit
            if (versusTimer <= 0) {
                endGame();
                return;
            }
            // Check if only one alive
            var aliveCount = 0;
            for (var i = 0; i < players.length; i++) {
                if (players[i].alive) aliveCount++;
            }
            if (aliveCount <= 1) {
                endGame();
            }
        }
    }

    function endGame() {
        gameRunning = false;

        // Build results
        var titleEl = document.getElementById('gameover-title');
        var scoresEl = document.getElementById('gameover-scores');
        scoresEl.innerHTML = '';

        if (gameMode === '1p') {
            titleEl.textContent = 'Game Over';
            scoresEl.innerHTML = '<div class="final-score">Score: ' + players[0].score + '</div>' +
                '<div>Wave ' + wave + ' reached</div>';
            CGameAudio.play('lose');
            GameShell.addScore({ game: 'space-shooter', mode: '1p', score: players[0].score, wave: wave });
        } else if (gameMode === 'coop') {
            var total = players[0].score + players[1].score;
            titleEl.textContent = 'Game Over';
            scoresEl.innerHTML =
                '<div class="p1-final">P1: ' + players[0].score + '</div>' +
                '<div class="p2-final">P2: ' + players[1].score + '</div>' +
                '<div class="final-score">Total: ' + total + '</div>' +
                '<div>Wave ' + wave + ' reached</div>';
            CGameAudio.play('lose');
            GameShell.addScore({ game: 'space-shooter', mode: 'coop', score: total, wave: wave });
        } else if (gameMode === 'versus') {
            var p1 = players[0], p2 = players[1];
            var winnerText = '';
            if (!p1.alive && p2.alive) {
                winnerText = 'Player 2 Wins!';
                titleEl.textContent = 'Player 2 Wins!';
                CGameAudio.play('win');
            } else if (p1.alive && !p2.alive) {
                winnerText = 'Player 1 Wins!';
                titleEl.textContent = 'Player 1 Wins!';
                CGameAudio.play('win');
            } else if (p1.score > p2.score) {
                winnerText = 'Player 1 Wins!';
                titleEl.textContent = 'Player 1 Wins!';
                CGameAudio.play('win');
            } else if (p2.score > p1.score) {
                winnerText = 'Player 2 Wins!';
                titleEl.textContent = 'Player 2 Wins!';
                CGameAudio.play('win');
            } else {
                winnerText = 'Draw!';
                titleEl.textContent = 'Draw!';
                CGameAudio.play('lose');
            }
            scoresEl.innerHTML =
                '<div class="p1-final">P1: ' + p1.score + '</div>' +
                '<div class="p2-final">P2: ' + p2.score + '</div>' +
                '<div class="winner-text">' + winnerText + '</div>';
        }

        GameShell.showScreen('gameover-screen');
    }

    // ── HUD ──
    function updateHUD() {
        var p1 = players[0];
        if (p1) {
            document.getElementById('hud-p1').textContent = 'P1: ' + p1.score;
            var hearts1 = '';
            for (var i = 0; i < p1.lives; i++) hearts1 += '\u2665';
            for (var i = p1.lives; i < 3; i++) hearts1 += '\u2661';
            document.getElementById('hud-lives-1').textContent = hearts1;
        }

        document.getElementById('hud-wave').textContent = 'Wave ' + wave;

        if (players.length > 1) {
            var p2 = players[1];
            document.getElementById('hud-p2').textContent = 'P2: ' + p2.score;
            document.getElementById('hud-p2').classList.remove('hidden');
            var hearts2 = '';
            for (var i = 0; i < p2.lives; i++) hearts2 += '\u2665';
            for (var i = p2.lives; i < 3; i++) hearts2 += '\u2661';
            document.getElementById('hud-lives-2').textContent = hearts2;
            document.getElementById('hud-lives-2').classList.remove('hidden');
        } else {
            document.getElementById('hud-p2').classList.add('hidden');
            document.getElementById('hud-lives-2').classList.add('hidden');
        }

        if (gameMode === 'versus') {
            var timerEl = document.getElementById('hud-timer');
            timerEl.classList.remove('hidden');
            var m = Math.floor(versusTimer / 60);
            var s = Math.floor(versusTimer % 60);
            timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        } else {
            document.getElementById('hud-timer').classList.add('hidden');
        }
    }

    // ── Canvas Resize ──
    function resizeCanvas() {
        var container = document.getElementById('canvas-container');
        var cw = container.clientWidth;
        var ch = container.clientHeight;

        var scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
        canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
        canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
    }

    // ── Main Loop ──
    var lastTime = 0;
    function gameLoop(time) {
        if (!gameRunning) return;

        var dt = (time - lastTime) / 1000;
        lastTime = time;
        if (dt > DT_CAP / 1000) dt = DT_CAP / 1000;
        if (dt <= 0) dt = 1 / 60;

        if (!paused) {
            handleInput();

            // Update
            updateStars(dt);
            for (var i = 0; i < players.length; i++) updatePlayer(players[i], dt);
            updateBullets(dt);
            updateEnemies(dt);
            updatePowerups(dt);
            updateParticles(dt);
            updateShockwaves(dt);
            updateScreenShake(dt);
            updateWaveSpawning(dt);
            checkCollisions();

            // Versus timer
            if (gameMode === 'versus') {
                versusTimer -= dt;
                if (Math.floor((versusTimer + dt)) !== Math.floor(versusTimer)) {
                    updateHUD();
                }
            }

            checkGameOver();
        }

        // Draw
        draw();

        requestAnimationFrame(gameLoop);
    }

    function draw() {
        ctx.save();

        // Apply screen shake offset
        if (screenShake.intensity > 0.1) {
            ctx.translate(screenShake.x, screenShake.y);
        }

        // Parallax background with nebula
        drawBackground();

        drawPowerups();
        drawBullets();
        drawEnemies();
        for (var i = 0; i < players.length; i++) drawPlayer(players[i]);
        drawParticles();
        drawShockwaves();

        ctx.restore();
    }

    // ── Start / Stop ──
    function startGame(mode) {
        gameMode = mode;
        gameRunning = true;
        paused = false;
        wave = 0;
        waveTimer = 0;
        waveDelay = 0;
        enemiesToSpawn = 0;
        spawnTimer = 0;
        versusTimer = VERSUS_TIME;
        bullets = [];
        enemies = [];
        particles = [];
        powerups = [];
        shockwaves = [];
        screenShake = { x: 0, y: 0, intensity: 0 };

        players = [createPlayer(0)];
        if (mode === 'coop' || mode === 'versus') {
            players.push(createPlayer(1));
        }

        initStars();
        updateHUD();

        GameShell.showScreen('game-screen');
        resizeCanvas();

        // Start first wave after brief delay
        setTimeout(function () {
            if (gameRunning) startWave();
        }, 500);

        lastTime = performance.now();
        requestAnimationFrame(gameLoop);

        CGameAudio.play('select');
    }

    function stopGame() {
        gameRunning = false;
        paused = false;
    }

    // ── Touch Controls ──
    function setupTouch() {
        var joystickEl = document.getElementById('touch-joystick');
        var knobEl = document.getElementById('joystick-knob');
        var fireEl = document.getElementById('touch-fire');

        if (!joystickEl || !fireEl) return;

        // Joystick
        joystickEl.addEventListener('touchstart', function (e) {
            e.preventDefault();
            var touch = e.changedTouches[0];
            var rect = joystickEl.getBoundingClientRect();
            touchJoystick.active = true;
            touchJoystick.id = touch.identifier;
            touchJoystick.cx = rect.left + rect.width / 2;
            touchJoystick.cy = rect.top + rect.height / 2;
            touchJoystick.dx = 0;
            touchJoystick.dy = 0;
        }, { passive: false });

        document.addEventListener('touchmove', function (e) {
            for (var i = 0; i < e.changedTouches.length; i++) {
                var t = e.changedTouches[i];
                if (t.identifier === touchJoystick.id && touchJoystick.active) {
                    var dx = t.clientX - touchJoystick.cx;
                    var dy = t.clientY - touchJoystick.cy;
                    var maxR = 40;
                    var d = Math.sqrt(dx * dx + dy * dy);
                    if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; }
                    touchJoystick.dx = dx / maxR;
                    touchJoystick.dy = dy / maxR;

                    // Move knob visually
                    if (knobEl) {
                        knobEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                    }
                }
            }
        }, { passive: true });

        var resetJoystick = function (e) {
            for (var i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchJoystick.id) {
                    touchJoystick.active = false;
                    touchJoystick.dx = 0;
                    touchJoystick.dy = 0;
                    if (knobEl) knobEl.style.transform = '';
                }
            }
        };
        document.addEventListener('touchend', resetJoystick);
        document.addEventListener('touchcancel', resetJoystick);

        // Fire button
        fireEl.addEventListener('touchstart', function (e) {
            e.preventDefault();
            touchFiring = true;
            fireEl.classList.add('active');
        }, { passive: false });

        var stopFire = function (e) {
            e.preventDefault();
            touchFiring = false;
            fireEl.classList.remove('active');
        };
        fireEl.addEventListener('touchend', stopFire, { passive: false });
        fireEl.addEventListener('touchcancel', stopFire, { passive: false });
    }

    // ── Init ──
    function init() {
        GameShell.init({ backUrl: '../' });

        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;

        // Keyboard
        document.addEventListener('keydown', function (e) {
            keys[e.code] = true;
            keys[e.key] = true;

            // Prevent scrolling with game keys
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
                e.preventDefault();
            }

            // Pause with Escape
            if (e.code === 'Escape' && gameRunning) {
                togglePause();
            }
        });

        document.addEventListener('keyup', function (e) {
            keys[e.code] = false;
            keys[e.key] = false;
        });

        // Buttons
        document.getElementById('btn-1p').addEventListener('click', function () {
            startGame('1p');
        });
        document.getElementById('btn-2p-coop').addEventListener('click', function () {
            startGame('coop');
        });
        document.getElementById('btn-2p-vs').addEventListener('click', function () {
            startGame('versus');
        });
        document.getElementById('btn-pause').addEventListener('click', function () {
            if (gameRunning) togglePause();
        });
        document.getElementById('btn-resume').addEventListener('click', function () {
            togglePause();
        });
        document.getElementById('btn-quit').addEventListener('click', function () {
            paused = false;
            stopGame();
            GameShell.showScreen('title-screen');
        });
        document.getElementById('btn-retry').addEventListener('click', function () {
            startGame(gameMode);
        });
        document.getElementById('btn-menu').addEventListener('click', function () {
            stopGame();
            GameShell.showScreen('title-screen');
        });

        // Resize
        window.addEventListener('resize', function () {
            if (gameRunning) resizeCanvas();
        });

        // Touch
        setupTouch();

        // Register custom sounds
        CGameAudio.register('shoot', function (ctx, now) {
            CGameAudio.osc('square', 880, now, 0.04, 0.06);
            CGameAudio.osc('sine', 1200, now + 0.02, 0.03, 0.04);
        });

        CGameAudio.register('explosion', function (ctx, now) {
            CGameAudio.noise(now, 0.15, 0.12);
            CGameAudio.osc('sawtooth', 100, now, 0.15, 0.1);
        });

        // Draw initial stars on title
        initStars();
        drawTitleBg();
    }

    function drawTitleBg() {
        // Animate stars on title screen
        if (document.getElementById('title-screen').classList.contains('active')) {
            // We just draw once as a nice bg effect - handled by CSS
        }
    }

    function togglePause() {
        paused = !paused;
        if (paused) {
            GameShell.showScreen('pause-overlay');
        } else {
            GameShell.showScreen('game-screen');
            lastTime = performance.now();
        }
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
