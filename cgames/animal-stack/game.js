/* === Animal Stack Game === */
(function () {
    'use strict';

    // ─── Animal Definitions ───
    var ANIMALS = [
        { name: 'Bear',    bodyColor: '#8B5E3C', earColor: '#6B4226', bellyColor: '#C4956A', type: 'round-ears' },
        { name: 'Cat',     bodyColor: '#9E9E9E', earColor: '#757575', bellyColor: '#D5D5D5', type: 'pointy-ears' },
        { name: 'Frog',    bodyColor: '#4CAF50', earColor: '#388E3C', bellyColor: '#A5D6A7', type: 'big-eyes' },
        { name: 'Fox',     bodyColor: '#FF8C00', earColor: '#E65100', bellyColor: '#FFE0B2', type: 'pointy-ears' },
        { name: 'Panda',   bodyColor: '#F5F5F5', earColor: '#212121', bellyColor: '#FFFFFF', type: 'panda' },
        { name: 'Penguin', bodyColor: '#37474F', earColor: '#263238', bellyColor: '#ECEFF1', type: 'penguin' },
        { name: 'Bunny',   bodyColor: '#F5F5F5', earColor: '#FFCDD2', bellyColor: '#FFFFFF', type: 'long-ears' }
    ];

    var GRAVITY = 900;
    var SWING_SPEED_BASE = 2.2;
    var SWING_AMPLITUDE_RATIO = 0.35;
    var DROP_SOUND_THRESHOLD = 10;
    var MAX_MISSED = 3;
    var GAME_TIME_2P = 90; // seconds

    // ─── Visual Constants ───
    var PERFECT_THRESHOLD = 0.15; // 15% of center for perfect landing
    var SQUASH_INITIAL = 0.3;
    var SQUASH_DECAY = 8; // how fast squash decays back to 0
    var WIND_GUST_INTERVAL_MIN = 3;
    var WIND_GUST_INTERVAL_MAX = 7;
    var CLOUD_COUNT = 5;

    // ─── State ───
    var mode = 1;
    var running = false;
    var canvas1p, ctx1p, canvas2p, ctx2p;
    var players = [];
    var animId = null;
    var lastTime = 0;
    var timer2p = 0;
    var gameEnded = false;
    var globalTime = 0; // for clouds/wind animation

    // ─── Drawing: Animal (with squash/stretch support) ───
    function drawAnimal(ctx, x, y, radius, animalIdx, alpha, scaleX, scaleY) {
        var a = ANIMALS[animalIdx % ANIMALS.length];
        ctx.save();
        ctx.globalAlpha = alpha !== undefined ? alpha : 1;

        // Apply squash/stretch scaling around animal center
        var sx = scaleX !== undefined ? scaleX : 1;
        var sy = scaleY !== undefined ? scaleY : 1;
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        ctx.translate(-x, -y);

        var r = radius;

        // Ears first (behind body)
        switch (a.type) {
            case 'round-ears': // Bear
                ctx.fillStyle = a.earColor;
                ctx.beginPath();
                ctx.arc(x - r * 0.65, y - r * 0.65, r * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + r * 0.65, y - r * 0.65, r * 0.35, 0, Math.PI * 2);
                ctx.fill();
                // Inner ear
                ctx.fillStyle = a.bellyColor;
                ctx.beginPath();
                ctx.arc(x - r * 0.65, y - r * 0.65, r * 0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + r * 0.65, y - r * 0.65, r * 0.18, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'pointy-ears': // Cat, Fox
                ctx.fillStyle = a.earColor;
                ctx.beginPath();
                ctx.moveTo(x - r * 0.7, y - r * 0.3);
                ctx.lineTo(x - r * 0.35, y - r * 1.15);
                ctx.lineTo(x - r * 0.05, y - r * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x + r * 0.7, y - r * 0.3);
                ctx.lineTo(x + r * 0.35, y - r * 1.15);
                ctx.lineTo(x + r * 0.05, y - r * 0.5);
                ctx.closePath();
                ctx.fill();
                break;
            case 'big-eyes': // Frog
                ctx.fillStyle = a.bodyColor;
                ctx.beginPath();
                ctx.arc(x - r * 0.5, y - r * 0.75, r * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + r * 0.5, y - r * 0.75, r * 0.35, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'panda': // Panda
                ctx.fillStyle = a.earColor;
                ctx.beginPath();
                ctx.arc(x - r * 0.65, y - r * 0.65, r * 0.32, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + r * 0.65, y - r * 0.65, r * 0.32, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'penguin': // Penguin - small wings drawn after body
                break;
            case 'long-ears': // Bunny
                ctx.fillStyle = a.bodyColor;
                ctx.strokeStyle = a.earColor;
                ctx.lineWidth = r * 0.12;
                // Left ear
                ctx.beginPath();
                ctx.ellipse(x - r * 0.3, y - r * 1.1, r * 0.18, r * 0.55, -0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Right ear
                ctx.beginPath();
                ctx.ellipse(x + r * 0.3, y - r * 1.1, r * 0.18, r * 0.55, 0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Inner ear
                ctx.fillStyle = a.earColor;
                ctx.beginPath();
                ctx.ellipse(x - r * 0.3, y - r * 1.1, r * 0.09, r * 0.35, -0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(x + r * 0.3, y - r * 1.1, r * 0.09, r * 0.35, 0.15, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        // Body
        ctx.fillStyle = a.bodyColor;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = a.bellyColor;
        if (a.type === 'penguin') {
            ctx.beginPath();
            ctx.ellipse(x, y + r * 0.15, r * 0.55, r * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(x, y + r * 0.15, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
        }

        // Face
        var eyeSize = r * 0.12;
        var eyeY = y - r * 0.15;
        var eyeSpread = r * 0.3;

        if (a.type === 'panda') {
            // Panda eye patches
            ctx.fillStyle = a.earColor;
            ctx.beginPath();
            ctx.ellipse(x - eyeSpread, eyeY, r * 0.22, r * 0.18, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x + eyeSpread, eyeY, r * 0.22, r * 0.18, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // White eyes on patches
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x - eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            // Pupils
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x - eyeSpread, eyeY, eyeSize * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + eyeSpread, eyeY, eyeSize * 0.55, 0, Math.PI * 2);
            ctx.fill();
        } else if (a.type === 'big-eyes') {
            // Frog big eyes (on the bumps)
            var frogEyeY = y - r * 0.75;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x - r * 0.5, frogEyeY, r * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + r * 0.5, frogEyeY, r * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x - r * 0.5, frogEyeY, r * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + r * 0.5, frogEyeY, r * 0.12, 0, Math.PI * 2);
            ctx.fill();
            // Wide smile
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = r * 0.06;
            ctx.beginPath();
            ctx.arc(x, y + r * 0.1, r * 0.35, 0.15, Math.PI - 0.15);
            ctx.stroke();
        } else {
            // Standard eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x - eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            // Eye shine
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(x - eyeSpread + eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + eyeSpread + eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }

        // Nose / mouth
        if (a.type !== 'big-eyes') {
            // Small nose
            var noseY = y + r * 0.05;
            if (a.type === 'penguin') {
                // Beak
                ctx.fillStyle = '#FFA726';
                ctx.beginPath();
                ctx.moveTo(x, noseY - r * 0.05);
                ctx.lineTo(x - r * 0.15, noseY + r * 0.12);
                ctx.lineTo(x + r * 0.15, noseY + r * 0.12);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = a.type === 'pointy-ears' && a.bodyColor === '#FF8C00' ? '#000' : '#5D4037';
                ctx.beginPath();
                ctx.ellipse(x, noseY, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
                ctx.fill();
                // Tiny smile
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = r * 0.04;
                ctx.beginPath();
                ctx.arc(x, noseY + r * 0.08, r * 0.15, 0.2, Math.PI - 0.2);
                ctx.stroke();
            }
        }

        // Blush (cheeks)
        if (a.type !== 'penguin') {
            ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
            ctx.beginPath();
            ctx.ellipse(x - r * 0.5, y + r * 0.05, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x + r * 0.5, y + r * 0.05, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // ─── Player State Factory ───
    function createPlayer(areaWidth, areaHeight) {
        return {
            tower: [],           // { x, y, radius, animalIdx, vx, settled, squash }
            swinging: null,      // current animal swinging at top
            falling: [],         // animals falling off
            missed: 0,
            score: 0,
            cameraY: 0,
            targetCameraY: 0,
            animalIndex: 0,
            areaWidth: areaWidth,
            areaHeight: areaHeight,
            baseY: areaHeight - 40,
            gameOver: false,
            wobbleTime: 0,
            particles: [],
            dropPressed: false,
            // Visual enhancement state
            popups: [],          // floating text popups
            clouds: initClouds(areaWidth, areaHeight),
            windGusts: [],
            windTimer: WIND_GUST_INTERVAL_MIN + Math.random() * (WIND_GUST_INTERVAL_MAX - WIND_GUST_INTERVAL_MIN),
            grassBlades: initGrass(areaWidth)
        };
    }

    // ─── Cloud Initialization ───
    function initClouds(areaWidth, areaHeight) {
        var clouds = [];
        for (var i = 0; i < CLOUD_COUNT; i++) {
            clouds.push({
                x: Math.random() * areaWidth * 1.5 - areaWidth * 0.25,
                y: 30 + Math.random() * areaHeight * 0.25,
                w: 40 + Math.random() * 60,
                h: 18 + Math.random() * 20,
                speed: 5 + Math.random() * 12,
                alpha: 0.2 + Math.random() * 0.25
            });
        }
        return clouds;
    }

    // ─── Grass Initialization ───
    function initGrass(areaWidth) {
        var blades = [];
        var count = Math.floor(areaWidth / 4);
        for (var i = 0; i < count; i++) {
            blades.push({
                x: (areaWidth / count) * i + Math.random() * 4,
                h: 4 + Math.random() * 8,
                lean: (Math.random() - 0.5) * 0.4,
                shade: Math.random() * 0.3
            });
        }
        return blades;
    }

    // ─── Animal Size ───
    function getAnimalRadius(score, baseWidth) {
        var base = baseWidth * 0.1;
        var minR = baseWidth * 0.04;
        var r = base - score * 1.2;
        return Math.max(r, minR);
    }

    // ─── Spawn Swinging Animal ───
    function spawnSwinging(p) {
        var r = getAnimalRadius(p.score, p.areaWidth);
        p.swinging = {
            angle: 0,
            radius: r,
            animalIdx: p.animalIndex % ANIMALS.length,
            swingSpeed: SWING_SPEED_BASE + p.score * 0.08,
            amplitude: p.areaWidth * SWING_AMPLITUDE_RATIO,
            centerX: p.areaWidth / 2,
            dropped: false,
            x: p.areaWidth / 2,
            y: 0,
            vy: 0,
            vx: 0,
            settled: false
        };
        p.animalIndex++;
    }

    // ─── Get Top of Tower ───
    function getTowerTopY(p) {
        if (p.tower.length === 0) return p.baseY;
        var top = p.baseY;
        for (var i = 0; i < p.tower.length; i++) {
            var ty = p.tower[i].y - p.tower[i].radius;
            if (ty < top) top = ty;
        }
        return top;
    }

    // ─── Drop Animal ───
    function dropAnimal(p) {
        if (!p.swinging || p.swinging.dropped || p.gameOver) return;
        p.swinging.dropped = true;
        // Horizontal velocity from swing
        var swingVx = Math.cos(p.swinging.angle) * p.swinging.amplitude * p.swinging.swingSpeed * 0.3;
        p.swinging.vx = swingVx;
        p.swinging.vy = 0;
        CGameAudio.play('click');
    }

    // ─── Perfect Landing Check ───
    function isPerfectLanding(p, sw) {
        var targetX;
        if (p.tower.length === 0) {
            targetX = p.areaWidth / 2;
        } else {
            var top = getTopAnimal(p);
            targetX = top ? top.x : p.areaWidth / 2;
        }
        var dist = Math.abs(sw.x - targetX);
        var maxDist = sw.radius * PERFECT_THRESHOLD;
        return dist <= maxDist;
    }

    // ─── Spawn Popup Text ───
    function spawnPopup(p, x, y, text, color) {
        p.popups.push({
            x: x,
            y: y,
            text: text,
            life: 1.2,
            maxLife: 1.2,
            color: color || '#FFD700',
            vy: -60,
            scale: 1.5
        });
    }

    // ─── Spawn Sparkle Particles (for perfect landing) ───
    function spawnSparkles(p, x, y, count) {
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            var speed = 80 + Math.random() * 120;
            p.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 80,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1.0,
                color: ['#FFD700', '#FFF176', '#FFFFFF', '#FFE082', '#FFAB00'][Math.floor(Math.random() * 5)],
                type: 'sparkle',
                size: 2 + Math.random() * 3,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    // ─── Spawn Dust Particles (for normal landing) ───
    function spawnDust(p, x, y, count) {
        for (var i = 0; i < count; i++) {
            var angle = -Math.PI + Math.random() * Math.PI; // spread upward
            var speed = 30 + Math.random() * 50;
            p.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: -Math.abs(Math.sin(angle) * speed) - 10,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6,
                color: '#B0926A',
                type: 'dust',
                size: 2 + Math.random() * 3,
                rotation: 0
            });
        }
    }

    // ─── Spawn Debris Particles (for stack collapse / miss) ───
    function spawnDebris(p, x, y, count) {
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 / count) * i + Math.random() * 0.8;
            var speed = 100 + Math.random() * 150;
            p.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100,
                life: 0.7 + Math.random() * 0.5,
                maxLife: 1.2,
                color: ['#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8', '#795548'][Math.floor(Math.random() * 5)],
                type: 'debris',
                size: 3 + Math.random() * 4,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    // ─── Spawn Wind Gust ───
    function spawnWindGust(p) {
        var yStart = Math.random() * p.areaHeight * 0.8;
        var direction = Math.random() > 0.5 ? 1 : -1;
        var streakCount = 3 + Math.floor(Math.random() * 4);
        for (var i = 0; i < streakCount; i++) {
            p.windGusts.push({
                x: direction > 0 ? -20 - Math.random() * 40 : p.areaWidth + 20 + Math.random() * 40,
                y: yStart + (Math.random() - 0.5) * 60,
                length: 20 + Math.random() * 40,
                speed: (150 + Math.random() * 100) * direction,
                life: 1.5 + Math.random() * 1.0,
                maxLife: 2.5,
                alpha: 0.15 + Math.random() * 0.15
            });
        }
    }

    // ─── Update Player ───
    function updatePlayer(p, dt) {
        if (p.gameOver) return;

        p.wobbleTime += dt;

        // Update clouds
        for (var ci = 0; ci < p.clouds.length; ci++) {
            var cloud = p.clouds[ci];
            cloud.x += cloud.speed * dt;
            if (cloud.x > p.areaWidth + cloud.w) {
                cloud.x = -cloud.w * 1.5;
                cloud.y = 30 + Math.random() * p.areaHeight * 0.25;
            }
        }

        // Update wind gusts
        p.windTimer -= dt;
        if (p.windTimer <= 0) {
            spawnWindGust(p);
            p.windTimer = WIND_GUST_INTERVAL_MIN + Math.random() * (WIND_GUST_INTERVAL_MAX - WIND_GUST_INTERVAL_MIN);
        }
        for (var wi = p.windGusts.length - 1; wi >= 0; wi--) {
            var wg = p.windGusts[wi];
            wg.x += wg.speed * dt;
            wg.life -= dt;
            if (wg.life <= 0) {
                p.windGusts.splice(wi, 1);
            }
        }

        // Update popups
        for (var pi = p.popups.length - 1; pi >= 0; pi--) {
            var popup = p.popups[pi];
            popup.y += popup.vy * dt;
            popup.life -= dt;
            popup.scale = Math.max(1.0, popup.scale - dt * 2);
            if (popup.life <= 0) {
                p.popups.splice(pi, 1);
            }
        }

        // Update squash on tower animals
        for (var si = 0; si < p.tower.length; si++) {
            var ta = p.tower[si];
            if (ta.squash !== undefined && ta.squash > 0.001) {
                ta.squash *= Math.exp(-SQUASH_DECAY * dt);
                if (ta.squash < 0.001) ta.squash = 0;
            }
        }

        // Update swinging animal
        var sw = p.swinging;
        if (sw && !sw.dropped) {
            sw.angle += sw.swingSpeed * dt;
            sw.x = sw.centerX + Math.sin(sw.angle) * sw.amplitude;
            sw.y = 30 + sw.radius + p.cameraY;
        } else if (sw && sw.dropped) {
            // Falling
            sw.vy += GRAVITY * dt;
            sw.y += sw.vy * dt;
            sw.x += sw.vx * dt;

            // Check landing
            var landY = getLandingY(p, sw);
            if (sw.y + sw.radius >= landY) {
                sw.y = landY - sw.radius;
                sw.vy = 0;

                // Check overlap with top of stack
                var overlap = checkOverlap(p, sw);
                if (overlap >= 0.7) {
                    // Perfect land
                    sw.x = getSnapX(p, sw);
                    sw.settled = true;
                    var perfect = isPerfectLanding(p, sw);
                    var newTowerEntry = { x: sw.x, y: sw.y, radius: sw.radius, animalIdx: sw.animalIdx, vx: 0, settled: true, squash: SQUASH_INITIAL };
                    p.tower.push(newTowerEntry);
                    if (perfect) {
                        p.score += 2; // double points for perfect
                        spawnPopup(p, sw.x, sw.y - sw.radius - 15, 'PERFECT!', '#FFD700');
                        spawnSparkles(p, sw.x, sw.y - sw.radius, 16);
                    } else {
                        p.score++;
                    }
                    CGameAudio.play('score');
                    spawnParticles(p, sw.x, sw.y - sw.radius, 8);
                    spawnDust(p, sw.x, sw.y + sw.radius, 6);
                    p.swinging = null;
                    updateCamera(p);
                    spawnSwinging(p);
                } else if (overlap >= 0.5) {
                    // Slides a bit
                    var slideDir = sw.x > getSnapX(p, sw) ? 1 : -1;
                    sw.x += slideDir * sw.radius * 0.2;
                    sw.settled = true;
                    p.tower.push({ x: sw.x, y: sw.y, radius: sw.radius, animalIdx: sw.animalIdx, vx: 0, settled: true, squash: SQUASH_INITIAL });
                    p.score++;
                    CGameAudio.play('pop');
                    spawnParticles(p, sw.x, sw.y - sw.radius, 4);
                    spawnDust(p, sw.x, sw.y + sw.radius, 4);
                    p.swinging = null;
                    updateCamera(p);
                    spawnSwinging(p);
                } else {
                    // Falls off
                    var fallDir = sw.x >= p.areaWidth / 2 ? 1 : -1;
                    p.falling.push({ x: sw.x, y: sw.y, radius: sw.radius, animalIdx: sw.animalIdx, vx: fallDir * 120, vy: -150, alpha: 1 });
                    p.missed++;
                    CGameAudio.play('lose');
                    spawnDebris(p, sw.x, sw.y, 10);
                    p.swinging = null;
                    if (p.missed >= MAX_MISSED) {
                        p.gameOver = true;
                    } else {
                        spawnSwinging(p);
                    }
                }
            }

            // Off screen sides - falls
            if (sw && sw.dropped && (sw.x < -sw.radius * 2 || sw.x > p.areaWidth + sw.radius * 2)) {
                p.falling.push({ x: sw.x, y: sw.y, radius: sw.radius, animalIdx: sw.animalIdx, vx: 0, vy: 0, alpha: 1 });
                p.missed++;
                CGameAudio.play('lose');
                spawnDebris(p, sw.x, sw.y, 8);
                p.swinging = null;
                if (p.missed >= MAX_MISSED) {
                    p.gameOver = true;
                } else {
                    spawnSwinging(p);
                }
            }
        }

        // Update falling animals
        for (var i = p.falling.length - 1; i >= 0; i--) {
            var f = p.falling[i];
            f.vy += GRAVITY * dt;
            f.y += f.vy * dt;
            f.x += f.vx * dt;
            f.alpha -= dt * 0.8;
            if (f.alpha <= 0 || f.y > p.baseY + 200 + p.cameraY) {
                p.falling.splice(i, 1);
            }
        }

        // Update particles
        for (var j = p.particles.length - 1; j >= 0; j--) {
            var pt = p.particles[j];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vy += 200 * dt;
            if (pt.type === 'sparkle') {
                pt.rotation += 5 * dt;
            }
            pt.life -= dt;
            if (pt.life <= 0) {
                p.particles.splice(j, 1);
            }
        }

        // Smooth camera
        p.cameraY += (p.targetCameraY - p.cameraY) * Math.min(1, dt * 4);
    }

    function getLandingY(p, sw) {
        if (p.tower.length === 0) return p.baseY;
        // Find the topmost animal the dropping one could land on
        var landY = p.baseY;
        for (var i = 0; i < p.tower.length; i++) {
            var t = p.tower[i];
            var dx = Math.abs(sw.x - t.x);
            if (dx < sw.radius + t.radius * 0.5) {
                var top = t.y - t.radius;
                if (top < landY) landY = top;
            }
        }
        return landY;
    }

    function checkOverlap(p, sw) {
        if (p.tower.length === 0) {
            // Landing on ground - check if within bounds
            var centerDist = Math.abs(sw.x - p.areaWidth / 2);
            var maxDist = sw.radius * 1.5;
            return 1 - Math.min(1, centerDist / maxDist);
        }
        // Find the top animal
        var topAnimal = getTopAnimal(p);
        if (!topAnimal) return 1;
        var dx = Math.abs(sw.x - topAnimal.x);
        var maxOverlap = topAnimal.radius + sw.radius * 0.3;
        return 1 - Math.min(1, dx / maxOverlap);
    }

    function getTopAnimal(p) {
        if (p.tower.length === 0) return null;
        var top = p.tower[0];
        for (var i = 1; i < p.tower.length; i++) {
            if (p.tower[i].y < top.y) top = p.tower[i];
        }
        return top;
    }

    function getSnapX(p, sw) {
        if (p.tower.length === 0) return p.areaWidth / 2;
        var top = getTopAnimal(p);
        return top ? top.x : p.areaWidth / 2;
    }

    function updateCamera(p) {
        var topY = getTowerTopY(p);
        var visibleTop = p.areaHeight * 0.35;
        if (topY - p.cameraY < visibleTop) {
            p.targetCameraY = topY - visibleTop;
        }
    }

    function spawnParticles(p, x, y, count) {
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            p.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * (60 + Math.random() * 80),
                vy: Math.sin(angle) * (60 + Math.random() * 80) - 50,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8,
                color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'][Math.floor(Math.random() * 5)],
                type: 'confetti',
                size: 3,
                rotation: 0
            });
        }
    }

    // ─── Draw Sky Background ───
    function drawSky(ctx, p, width, isDark) {
        var heightFactor = Math.min(p.score / 20, 1); // darken sky as stack grows

        var bgGrad = ctx.createLinearGradient(0, 0, 0, p.areaHeight);
        if (isDark) {
            var topR = Math.floor(13 - heightFactor * 5);
            var topG = Math.floor(17 - heightFactor * 8);
            var topB = Math.floor(23 + heightFactor * 20);
            bgGrad.addColorStop(0, 'rgb(' + topR + ',' + topG + ',' + topB + ')');
            bgGrad.addColorStop(1, '#161b22');
        } else {
            // Blue at top, transitions to light blue/white at horizon
            // Gets more purple/dark as stack gets higher
            var r1 = Math.floor(100 - heightFactor * 40);
            var g1 = Math.floor(160 - heightFactor * 60);
            var b1 = Math.floor(230 + heightFactor * 20);
            var r2 = Math.floor(220 + heightFactor * 10);
            var g2 = Math.floor(235 - heightFactor * 30);
            var b2 = Math.floor(250 - heightFactor * 20);
            bgGrad.addColorStop(0, 'rgb(' + Math.min(255, r1) + ',' + Math.max(0, g1) + ',' + Math.min(255, b1) + ')');
            bgGrad.addColorStop(0.7, 'rgb(' + Math.min(255, r2) + ',' + Math.max(0, g2) + ',' + Math.min(255, b2) + ')');
            bgGrad.addColorStop(1, '#f0f4f8');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, p.areaHeight);
    }

    // ─── Draw Clouds ───
    function drawClouds(ctx, p, width, isDark) {
        for (var i = 0; i < p.clouds.length; i++) {
            var c = p.clouds[i];
            ctx.save();
            ctx.globalAlpha = isDark ? c.alpha * 0.3 : c.alpha;
            ctx.fillStyle = isDark ? '#334155' : '#FFFFFF';

            // Draw cloud as overlapping ellipses
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x - c.w * 0.25, c.y + c.h * 0.1, c.w * 0.35, c.h * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.3, c.y + c.h * 0.05, c.w * 0.4, c.h * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // ─── Draw Wind Gusts ───
    function drawWindGusts(ctx, p, isDark) {
        for (var i = 0; i < p.windGusts.length; i++) {
            var wg = p.windGusts[i];
            var lifeRatio = wg.life / wg.maxLife;
            // Fade in and out
            var fadeAlpha = lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : lifeRatio > 0.3 ? 1 : lifeRatio / 0.3;
            ctx.save();
            ctx.globalAlpha = wg.alpha * fadeAlpha;
            ctx.strokeStyle = isDark ? 'rgba(200,220,255,0.5)' : 'rgba(150,180,220,0.6)';
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(wg.x, wg.y);
            ctx.lineTo(wg.x + wg.length * (wg.speed > 0 ? 1 : -1), wg.y + (Math.random() - 0.5) * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ─── Draw Grass ───
    function drawGrass(ctx, p, width, isDark) {
        var baseY = p.baseY;
        for (var i = 0; i < p.grassBlades.length; i++) {
            var b = p.grassBlades[i];
            var sway = Math.sin(globalTime * 1.5 + b.x * 0.05) * 2;
            ctx.save();
            ctx.globalAlpha = 0.7 + b.shade * 0.3;
            if (isDark) {
                var green = Math.floor(100 + b.shade * 60);
                ctx.strokeStyle = 'rgb(30,' + green + ',30)';
            } else {
                var greenVal = Math.floor(140 + b.shade * 80);
                ctx.strokeStyle = 'rgb(60,' + greenVal + ',60)';
            }
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(b.x, baseY);
            ctx.quadraticCurveTo(b.x + b.lean * b.h + sway, baseY - b.h * 0.6, b.x + b.lean * b.h * 1.5 + sway * 1.3, baseY - b.h);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ─── Draw Shadow Under Animal ───
    function drawAnimalShadow(ctx, x, y, radius, stackIndex, totalStack, baseY) {
        // Shadow gets smaller and more transparent higher up
        var heightRatio = stackIndex / Math.max(totalStack, 1);
        var shadowAlpha = 0.25 * (1 - heightRatio * 0.7);
        var shadowScale = 1 - heightRatio * 0.4;
        var shadowOffsetY = radius * 0.85;

        ctx.save();
        ctx.globalAlpha = shadowAlpha;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + shadowOffsetY, radius * 0.8 * shadowScale, radius * 0.2 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ─── Draw Height Indicator ───
    function drawHeightIndicator(ctx, p, width, isDark) {
        var barX = width - 18;
        var barTop = 40;
        var barBottom = p.areaHeight - 10;
        var barHeight = barBottom - barTop;
        var maxDisplayHeight = 30;

        // Draw ruler line
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = isDark ? '#FFFFFF' : '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barX, barTop);
        ctx.lineTo(barX, barBottom);
        ctx.stroke();

        // Draw milestone markers
        ctx.globalAlpha = 0.3;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';

        var milestones = [5, 10, 15, 20, 25, 30];
        for (var m = 0; m < milestones.length; m++) {
            var milestone = milestones[m];
            var my = barBottom - (milestone / maxDisplayHeight) * barHeight;
            if (my > barTop) {
                ctx.beginPath();
                ctx.moveTo(barX - 6, my);
                ctx.lineTo(barX + 2, my);
                ctx.stroke();
                ctx.fillText(milestone.toString(), barX - 8, my + 3);
            }
        }

        // Draw current height fill
        var currentHeight = Math.min(p.score, maxDisplayHeight);
        var fillHeight = (currentHeight / maxDisplayHeight) * barHeight;
        var fillGrad = ctx.createLinearGradient(0, barBottom - fillHeight, 0, barBottom);
        if (isDark) {
            fillGrad.addColorStop(0, 'rgba(100,200,255,0.5)');
            fillGrad.addColorStop(1, 'rgba(100,200,255,0.15)');
        } else {
            fillGrad.addColorStop(0, 'rgba(50,150,250,0.5)');
            fillGrad.addColorStop(1, 'rgba(50,150,250,0.15)');
        }
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = fillGrad;
        ctx.fillRect(barX - 3, barBottom - fillHeight, 6, fillHeight);

        // Current height marker
        if (p.score > 0) {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = isDark ? '#64B5F6' : '#1976D2';
            ctx.beginPath();
            var markerY = barBottom - fillHeight;
            ctx.moveTo(barX - 8, markerY);
            ctx.lineTo(barX + 4, markerY - 4);
            ctx.lineTo(barX + 4, markerY + 4);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    // ─── Draw Popups ───
    function drawPopups(ctx, p) {
        for (var i = 0; i < p.popups.length; i++) {
            var popup = p.popups[i];
            var lifeRatio = popup.life / popup.maxLife;
            ctx.save();
            ctx.globalAlpha = lifeRatio;
            ctx.font = 'bold ' + Math.floor(16 * popup.scale) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Outline
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 3;
            ctx.strokeText(popup.text, popup.x, popup.y);

            // Fill
            ctx.fillStyle = popup.color;
            ctx.fillText(popup.text, popup.x, popup.y);

            ctx.restore();
        }
    }

    // ─── Render Player ───
    function renderPlayer(ctx, p, offsetX, width) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, 0, width, p.areaHeight);
        ctx.clip();
        ctx.translate(offsetX, 0);

        // Background sky
        var isDark = document.body.getAttribute('data-theme') === 'dark';
        drawSky(ctx, p, width, isDark);

        // Clouds (in screen space, not affected by camera)
        drawClouds(ctx, p, width, isDark);

        // Wind gusts (in screen space)
        drawWindGusts(ctx, p, isDark);

        ctx.save();
        ctx.translate(0, -p.cameraY);

        // Ground
        ctx.fillStyle = isDark ? '#1e3a1e' : '#7ec87e';
        ctx.fillRect(0, p.baseY, width, p.areaHeight + Math.abs(p.cameraY) + 100);
        // Grass line
        ctx.fillStyle = isDark ? '#2d5a2d' : '#5ab85a';
        ctx.fillRect(0, p.baseY, width, 4);

        // Grass blades
        drawGrass(ctx, p, width, isDark);

        // Tower wobble
        var wobbleAmount = Math.min(p.score * 0.15, 3);
        var wobble = Math.sin(p.wobbleTime * 2) * wobbleAmount;

        // Draw tower animals (with shadows and squash/stretch)
        ctx.save();
        ctx.translate(wobble, 0);
        for (var i = 0; i < p.tower.length; i++) {
            var t = p.tower[i];
            // Draw shadow under animal
            drawAnimalShadow(ctx, t.x, t.y, t.radius, i, p.tower.length, p.baseY);

            // Calculate squash/stretch
            var squash = t.squash || 0;
            var scaleX = 1 + squash;
            var scaleY = 1 - squash;

            drawAnimal(ctx, t.x, t.y, t.radius, t.animalIdx, 1, scaleX, scaleY);
        }
        ctx.restore();

        // Draw swinging animal
        if (p.swinging) {
            var sw = p.swinging;
            if (!sw.dropped) {
                // Draw swing line
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(sw.centerX, p.cameraY);
                ctx.lineTo(sw.x, sw.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            drawAnimal(ctx, sw.dropped ? sw.x + wobble : sw.x, sw.y, sw.radius, sw.animalIdx, 1);
        }

        // Draw falling animals
        for (var j = 0; j < p.falling.length; j++) {
            var f = p.falling[j];
            drawAnimal(ctx, f.x, f.y, f.radius, f.animalIdx, Math.max(0, f.alpha));
        }

        // Draw particles
        for (var k = 0; k < p.particles.length; k++) {
            var pt = p.particles[k];
            var alpha = pt.life / pt.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;

            if (pt.type === 'sparkle') {
                // Draw as a small 4-pointed star
                ctx.fillStyle = pt.color;
                ctx.translate(pt.x, pt.y);
                ctx.rotate(pt.rotation);
                ctx.beginPath();
                var sz = pt.size;
                for (var sp = 0; sp < 4; sp++) {
                    var a1 = (sp / 4) * Math.PI * 2;
                    var a2 = ((sp + 0.5) / 4) * Math.PI * 2;
                    ctx.lineTo(Math.cos(a1) * sz, Math.sin(a1) * sz);
                    ctx.lineTo(Math.cos(a2) * sz * 0.3, Math.sin(a2) * sz * 0.3);
                }
                ctx.closePath();
                ctx.fill();
            } else if (pt.type === 'dust') {
                ctx.fillStyle = pt.color;
                ctx.globalAlpha = alpha * 0.6;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (pt.type === 'debris') {
                ctx.fillStyle = pt.color;
                ctx.translate(pt.x, pt.y);
                ctx.rotate(pt.rotation + globalTime * 3);
                ctx.fillRect(-pt.size * 0.5, -pt.size * 0.5, pt.size, pt.size);
            } else {
                // Original confetti particles
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size || 3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // Draw popups (in world space)
        drawPopups(ctx, p);

        ctx.restore(); // undo camera translate

        // Height indicator on the right side
        drawHeightIndicator(ctx, p, width, isDark);

        // Height markers on the left side
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        for (var h = 1; h <= 30; h++) {
            var markerY = p.baseY - h * 40 - p.cameraY;
            if (markerY > -20 && markerY < p.areaHeight + 20) {
                ctx.fillRect(0, markerY, 15, 1);
                ctx.fillText(h.toString(), 2, markerY - 3);
            }
        }

        // Lives indicator (1P) or label (2P)
        if (mode === 1) {
            var livesLeft = MAX_MISSED - p.missed;
            ctx.font = '14px sans-serif';
            ctx.fillStyle = isDark ? '#fff' : '#333';
            ctx.textAlign = 'right';
            var heartStr = '';
            for (var li = 0; li < MAX_MISSED; li++) {
                heartStr += li < livesLeft ? '\u2764 ' : '\u2661 ';
            }
            ctx.fillText(heartStr.trim(), width - 24, 24);
        }

        ctx.restore(); // undo clip and translate
    }

    // ─── Canvas Setup ───
    function setupCanvas(canvas, container) {
        var rect = container.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return { w: rect.width, h: rect.height, ctx: ctx };
    }

    // ─── Start Game ───
    function startGame(playerMode) {
        mode = playerMode;
        gameEnded = false;
        globalTime = 0;
        players = [];

        if (mode === 1) {
            GameShell.showScreen('game-screen');
            canvas1p = document.getElementById('game-canvas-1p');
            var container1p = document.getElementById('canvas-container-1p');
            var info1 = setupCanvas(canvas1p, container1p);
            ctx1p = info1.ctx;
            var p = createPlayer(info1.w, info1.h);
            players.push(p);
            spawnSwinging(p);
            updateHUD();
        } else {
            GameShell.showScreen('game-screen-2p');
            canvas2p = document.getElementById('game-canvas-2p');
            var container2p = document.getElementById('canvas-container-2p');
            var info2 = setupCanvas(canvas2p, container2p);
            ctx2p = info2.ctx;
            var halfW = Math.floor(info2.w / 2);
            var p1 = createPlayer(halfW, info2.h);
            var p2 = createPlayer(halfW, info2.h);
            players.push(p1, p2);
            spawnSwinging(p1);
            spawnSwinging(p2);
            timer2p = GAME_TIME_2P;
            updateHUD();
        }

        running = true;
        lastTime = performance.now();
        if (animId) cancelAnimationFrame(animId);
        gameLoop();
    }

    // ─── Game Loop ───
    function gameLoop() {
        var now = performance.now();
        var dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
        lastTime = now;

        if (running) {
            globalTime += dt;

            // Update
            for (var i = 0; i < players.length; i++) {
                updatePlayer(players[i], dt);
            }

            // 2P timer
            if (mode === 2) {
                timer2p -= dt;
                if (timer2p <= 0) timer2p = 0;
            }

            // Check game over
            if (mode === 1) {
                if (players[0].gameOver) {
                    endGame();
                }
            } else {
                var bothDone = players[0].gameOver && players[1].gameOver;
                if (bothDone || timer2p <= 0) {
                    endGame();
                }
            }

            updateHUD();

            // Render
            if (mode === 1) {
                renderPlayer(ctx1p, players[0], 0, players[0].areaWidth);
            } else {
                var w = players[0].areaWidth;
                // Clear
                ctx2p.clearRect(0, 0, w * 2, players[0].areaHeight);
                renderPlayer(ctx2p, players[0], 0, w);
                renderPlayer(ctx2p, players[1], w, w);
                // Divider
                var isDark = document.body.getAttribute('data-theme') === 'dark';
                ctx2p.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
                ctx2p.lineWidth = 2;
                ctx2p.beginPath();
                ctx2p.moveTo(w, 0);
                ctx2p.lineTo(w, players[0].areaHeight);
                ctx2p.stroke();

                // Player labels
                ctx2p.font = 'bold 13px sans-serif';
                ctx2p.textAlign = 'center';
                ctx2p.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--p1-color').trim();
                ctx2p.fillText('P1', w / 2, 18);
                ctx2p.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--p2-color').trim();
                ctx2p.fillText('P2', w + w / 2, 18);

                // Timer
                ctx2p.font = 'bold 14px sans-serif';
                ctx2p.fillStyle = isDark ? '#fff' : '#333';
                ctx2p.textAlign = 'center';
                var timeLeft = Math.ceil(timer2p);
                ctx2p.fillText(timeLeft + 's', w, 18);
            }
        }

        animId = requestAnimationFrame(gameLoop);
    }

    // ─── HUD Update ───
    function updateHUD() {
        if (mode === 1) {
            var el = document.getElementById('hud-height');
            var elLives = document.getElementById('hud-lives');
            if (el) el.textContent = players[0].score;
            if (elLives) elLives.textContent = MAX_MISSED - players[0].missed;
        } else {
            var e1 = document.getElementById('hud-height-p1');
            var e2 = document.getElementById('hud-height-p2');
            if (e1) e1.textContent = players[0].score;
            if (e2) e2.textContent = players[1].score;
        }
    }

    // ─── End Game ───
    function endGame() {
        if (gameEnded) return;
        gameEnded = true;
        running = false;

        if (mode === 1) {
            document.getElementById('gameover-stats').classList.remove('hidden');
            document.getElementById('go-2p-stats').classList.add('hidden');
            document.getElementById('go-height').textContent = players[0].score;
            document.getElementById('gameover-title').textContent = 'Game Over';
            CGameAudio.play('lose');
            GameShell.addScore({ game: 'animal-stack', mode: '1P', score: players[0].score });
        } else {
            document.getElementById('gameover-stats').classList.add('hidden');
            document.getElementById('go-2p-stats').classList.remove('hidden');
            document.getElementById('go-p1-height').textContent = players[0].score;
            document.getElementById('go-p2-height').textContent = players[1].score;
            if (players[0].score > players[1].score) {
                document.getElementById('gameover-title').textContent = 'Player 1 Wins!';
                CGameAudio.play('win');
            } else if (players[1].score > players[0].score) {
                document.getElementById('gameover-title').textContent = 'Player 2 Wins!';
                CGameAudio.play('win');
            } else {
                document.getElementById('gameover-title').textContent = 'It\'s a Tie!';
                CGameAudio.play('pop');
            }
        }

        setTimeout(function () {
            GameShell.showScreen('gameover-screen');
        }, 600);
    }

    // ─── Resize Handler ───
    function handleResize() {
        if (!running) return;
        if (mode === 1 && canvas1p) {
            var container1p = document.getElementById('canvas-container-1p');
            var info1 = setupCanvas(canvas1p, container1p);
            ctx1p = info1.ctx;
            players[0].areaWidth = info1.w;
            players[0].areaHeight = info1.h;
            players[0].baseY = info1.h - 40;
        } else if (mode === 2 && canvas2p) {
            var container2p = document.getElementById('canvas-container-2p');
            var info2 = setupCanvas(canvas2p, container2p);
            ctx2p = info2.ctx;
            var halfW = Math.floor(info2.w / 2);
            players[0].areaWidth = halfW;
            players[0].areaHeight = info2.h;
            players[0].baseY = info2.h - 40;
            players[1].areaWidth = halfW;
            players[1].areaHeight = info2.h;
            players[1].baseY = info2.h - 40;
        }
    }

    // ─── Input ───
    document.addEventListener('keydown', function (e) {
        if (!running || gameEnded) return;
        if (mode === 1) {
            if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Enter') {
                e.preventDefault();
                dropAnimal(players[0]);
            }
        } else {
            // P1: Space or W
            if (e.code === 'Space' || e.code === 'KeyW') {
                e.preventDefault();
                dropAnimal(players[0]);
            }
            // P2: Enter or ArrowUp
            if (e.code === 'Enter' || e.code === 'ArrowUp') {
                e.preventDefault();
                dropAnimal(players[1]);
            }
        }
    });

    // Touch input
    function handleTouch(e) {
        if (!running || gameEnded) return;
        e.preventDefault();
        var touches = e.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            var t = touches[i];
            if (mode === 1) {
                dropAnimal(players[0]);
            } else {
                // Split screen: left half = P1, right half = P2
                var rect = canvas2p.getBoundingClientRect();
                var touchX = t.clientX - rect.left;
                if (touchX < rect.width / 2) {
                    dropAnimal(players[0]);
                } else {
                    dropAnimal(players[1]);
                }
            }
        }
    }

    // Mouse click for desktop
    function handleClick(e) {
        if (!running || gameEnded) return;
        if (mode === 1) {
            dropAnimal(players[0]);
        } else {
            var rect = canvas2p.getBoundingClientRect();
            var clickX = e.clientX - rect.left;
            if (clickX < rect.width / 2) {
                dropAnimal(players[0]);
            } else {
                dropAnimal(players[1]);
            }
        }
    }

    // Attach input listeners once per canvas (tracked to avoid duplicates)
    var attached1p = false, attached2p = false;
    function attachInput() {
        if (canvas1p && !attached1p) {
            canvas1p.addEventListener('touchstart', handleTouch, { passive: false });
            canvas1p.addEventListener('click', handleClick);
            attached1p = true;
        }
        if (canvas2p && !attached2p) {
            canvas2p.addEventListener('touchstart', handleTouch, { passive: false });
            canvas2p.addEventListener('click', handleClick);
            attached2p = true;
        }
    }

    // ─── Button Handlers ───
    GameShell.init({ backUrl: '../' });

    document.getElementById('btn-1p').addEventListener('click', function () {
        CGameAudio.play('click');
        startGame(1);
        setTimeout(attachInput, 50);
    });

    document.getElementById('btn-2p').addEventListener('click', function () {
        CGameAudio.play('click');
        startGame(2);
        setTimeout(attachInput, 50);
    });

    document.getElementById('btn-back-game').addEventListener('click', function () {
        CGameAudio.play('back');
        running = false;
        if (animId) cancelAnimationFrame(animId);
        GameShell.showScreen('title-screen');
    });

    document.getElementById('btn-back-game-2p').addEventListener('click', function () {
        CGameAudio.play('back');
        running = false;
        if (animId) cancelAnimationFrame(animId);
        GameShell.showScreen('title-screen');
    });

    document.getElementById('btn-play-again').addEventListener('click', function () {
        CGameAudio.play('click');
        startGame(mode);
        setTimeout(attachInput, 50);
    });

    document.getElementById('btn-go-menu').addEventListener('click', function () {
        CGameAudio.play('back');
        running = false;
        if (animId) cancelAnimationFrame(animId);
        GameShell.showScreen('title-screen');
    });

    window.addEventListener('resize', handleResize);

})();
