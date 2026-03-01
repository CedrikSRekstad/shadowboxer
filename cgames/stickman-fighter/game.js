(function () {
    'use strict';

    /* ========== CONSTANTS ========== */
    var GRAVITY = 1400;
    var GROUND_Y_RATIO = 0.88;
    var MOVE_SPEED = 260;
    var JUMP_VELOCITY = -600;
    var MAX_HEALTH = 100;
    var ROUNDS_TO_WIN = 2;
    var COUNTDOWN_SECS = 3;
    var DT_CAP = 0.05;
    var KNOCKBACK_BASE = 300;
    var STUN_DURATION = 0.28;
    var BLOCK_DAMAGE_MULT = 0.25;
    var BLOCK_KNOCKBACK_MULT = 0.35;

    /* Stickman dimensions */
    var HEAD_RADIUS = 13;
    var BODY_LEN = 38;
    var UPPER_ARM = 20;
    var LOWER_ARM = 18;
    var UPPER_LEG = 22;
    var LOWER_LEG = 20;
    var LINE_W = 4.5;
    var GLOW_BLUR = 7;

    /* Attack defs: damage, range, startup, active, recovery, knockback */
    var ATTACKS = {
        punch:     { dmg: 10, range: 50, startup: 0.04, active: 0.10, recovery: 0.18, kb: 280, kbUp: 0.15 },
        kick:      { dmg: 18, range: 60, startup: 0.07, active: 0.12, recovery: 0.28, kb: 420, kbUp: 0.25 },
        jumpPunch: { dmg: 13, range: 50, startup: 0.03, active: 0.14, recovery: 0.12, kb: 320, kbUp: 0.30 },
        jumpKick:  { dmg: 22, range: 60, startup: 0.04, active: 0.14, recovery: 0.16, kb: 520, kbUp: 0.35 }
    };

    /* Visual FX */
    var SHAKE_DECAY = 0.88;
    var SPARK_COUNT = 10;
    var HIT_STOP_FRAMES = 4;

    /* ========== STATE ========== */
    var canvas, ctx, W, H, groundY;
    var gameRunning = false;
    var paused = false;
    var roundScores = [0, 0];
    var currentRound = 0;
    var fighters = [];
    var particles = [];
    var shake = { x: 0, y: 0, intensity: 0 };
    var hitStop = 0;
    var keys = {};
    var prevKeys = {};
    var lastTime = 0;
    var animId = null;
    var roundOverTimer = 0;
    var roundWinnerIdx = -1;

    /* DOM refs */
    var canvasContainer, p1HealthEl, p2HealthEl;
    var scoreP1El, scoreP2El, roundInfoEl;
    var countdownOverlay, countdownNumber;
    var pauseOverlay, roundOverlay, roundResultEl;

    /* ========== COLORS ========== */
    function getCSSVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function isDark() {
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    /* ========== FIGHTER ========== */
    function createFighter(idx, x) {
        return {
            idx: idx,
            x: x,
            y: groundY,
            vx: 0,
            vy: 0,
            facingRight: idx === 0,
            health: MAX_HEALTH,
            grounded: true,
            blocking: false,
            /* attack state machine */
            atkState: 'idle',
            atkType: null,
            atkTimer: 0,
            atkHit: false,
            /* stun */
            stunTimer: 0,
            /* anim */
            walkCycle: 0,
            idleBob: Math.random() * Math.PI * 2,
            hitFlash: 0,
            /* trail for attack swing */
            trailPts: []
        };
    }

    /* ========== INPUT ========== */
    function justPressed(key) {
        return keys[key] && !prevKeys[key];
    }

    function handleInput(f) {
        if (f.stunTimer > 0) { f.blocking = false; return; }
        if (f.atkState !== 'idle') return;

        var moveDir = 0;
        var jump = false;
        var block = false;
        var punch = false;
        var kick = false;

        if (f.idx === 0) {
            if (keys['a']) moveDir -= 1;
            if (keys['d']) moveDir += 1;
            if (keys['w']) jump = true;
            if (keys['s']) block = true;
            if (justPressed('f')) punch = true;
            if (justPressed('g')) kick = true;
        } else {
            if (keys['arrowleft']) moveDir -= 1;
            if (keys['arrowright']) moveDir += 1;
            if (keys['arrowup']) jump = true;
            if (keys['arrowdown']) block = true;
            if (justPressed('k')) punch = true;
            if (justPressed('l')) kick = true;
        }

        /* movement */
        if (f.blocking && f.grounded) {
            f.vx = 0;
        } else {
            f.vx = moveDir * MOVE_SPEED;
        }

        /* auto-face opponent */
        var opp = fighters[1 - f.idx];
        if (opp && f.atkState === 'idle') {
            f.facingRight = opp.x > f.x;
        }

        /* jump */
        if (jump && f.grounded && !block) {
            f.vy = JUMP_VELOCITY;
            f.grounded = false;
            CGameAudio.play('click');
        }

        /* block */
        f.blocking = block && f.grounded;

        /* attacks (use justPressed so holding doesn't repeat) */
        if (punch) {
            startAttack(f, f.grounded ? 'punch' : 'jumpPunch');
        }
        if (kick) {
            startAttack(f, f.grounded ? 'kick' : 'jumpKick');
        }
    }

    /* ========== ATTACKS ========== */
    function startAttack(f, type) {
        if (f.atkState !== 'idle' || f.stunTimer > 0 || f.blocking) return;
        var atk = ATTACKS[type];
        f.atkState = 'startup';
        f.atkType = type;
        f.atkTimer = atk.startup;
        f.atkHit = false;
        f.trailPts = [];
    }

    function updateAttack(f, dt) {
        if (f.atkState === 'idle') return;
        var atk = ATTACKS[f.atkType];
        f.atkTimer -= dt;

        if (f.atkState === 'startup' && f.atkTimer <= 0) {
            f.atkState = 'active';
            f.atkTimer = atk.active;
            CGameAudio.play('click');
        } else if (f.atkState === 'active' && f.atkTimer <= 0) {
            f.atkState = 'recovery';
            f.atkTimer = atk.recovery;
        } else if (f.atkState === 'recovery' && f.atkTimer <= 0) {
            f.atkState = 'idle';
            f.atkType = null;
            f.trailPts = [];
        }
    }

    /* ========== HIT DETECTION ========== */
    function checkHit(attacker, defender) {
        if (attacker.atkState !== 'active' || attacker.atkHit) return;
        var atk = ATTACKS[attacker.atkType];
        var dir = attacker.facingRight ? 1 : -1;

        /* hitbox point at end of attacking limb */
        var hx = attacker.x + dir * atk.range;
        var hy;
        if (attacker.atkType === 'kick' || attacker.atkType === 'jumpKick') {
            hy = attacker.y - BODY_LEN * 0.3;
        } else {
            hy = attacker.y - BODY_LEN * 0.75;
        }

        /* defender body center */
        var dx = hx - defender.x;
        var dy = hy - (defender.y - BODY_LEN * 0.5);
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 42) {
            attacker.atkHit = true;

            var dmg = atk.dmg;
            var kb = atk.kb;

            if (defender.blocking) {
                dmg *= BLOCK_DAMAGE_MULT;
                kb *= BLOCK_KNOCKBACK_MULT;
                CGameAudio.play('bounce');
                spawnBlockSparks((attacker.x + defender.x) / 2, hy);
            } else {
                CGameAudio.play('hit');
                defender.stunTimer = STUN_DURATION;
                spawnHitSparks((attacker.x + defender.x) / 2, hy, dir);
                shake.intensity = Math.min(dmg * 0.5, 14);
                hitStop = HIT_STOP_FRAMES;
            }

            defender.health = Math.max(0, defender.health - dmg);
            defender.vx += dir * kb;
            defender.vy -= kb * atk.kbUp;
            defender.hitFlash = 0.14;
            defender.grounded = false;

            updateHealthBars();
        }
    }

    /* ========== PHYSICS ========== */
    function updateFighter(f, dt) {
        /* stun */
        if (f.stunTimer > 0) {
            f.stunTimer -= dt;
        }

        /* gravity */
        if (!f.grounded) {
            f.vy += GRAVITY * dt;
        }

        /* apply vel */
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        /* ground */
        if (f.y >= groundY) {
            f.y = groundY;
            f.vy = 0;
            f.grounded = true;
        }

        /* walls */
        var pad = 25;
        if (f.x < pad) { f.x = pad; if (f.vx < 0) f.vx = 0; }
        if (f.x > W - pad) { f.x = W - pad; if (f.vx > 0) f.vx = 0; }

        /* friction for knockback */
        if (f.grounded && f.atkState === 'idle') {
            f.vx *= Math.pow(0.82, dt * 60);
        }
        if (!f.grounded) {
            f.vx *= Math.pow(0.96, dt * 60);
        }

        /* decay */
        if (f.hitFlash > 0) f.hitFlash -= dt;

        /* walk cycle */
        if (f.grounded && Math.abs(f.vx) > 20 && f.atkState === 'idle') {
            f.walkCycle += dt * 14;
        }
        f.idleBob += dt * 2.5;

        /* attack */
        updateAttack(f, dt);
    }

    /* ========== PARTICLES ========== */
    function spawnHitSparks(x, y, dir) {
        for (var i = 0; i < SPARK_COUNT; i++) {
            var angle = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.2;
            var speed = 120 + Math.random() * 300;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 80,
                life: 0.2 + Math.random() * 0.2,
                maxLife: 0.2 + Math.random() * 0.2,
                size: 2 + Math.random() * 4,
                color: Math.random() < 0.4 ? '#ffffff' : (Math.random() < 0.5 ? '#ffdd00' : '#ff6600')
            });
        }
    }

    function spawnBlockSparks(x, y) {
        for (var i = 0; i < 6; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 60 + Math.random() * 120;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: 0.15 + Math.random() * 0.1,
                maxLife: 0.15 + Math.random() * 0.1,
                size: 2 + Math.random() * 2,
                color: '#88ccff'
            });
        }
    }

    function spawnKOBurst(x, y) {
        for (var i = 0; i < 30; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 80 + Math.random() * 350;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.4,
                maxLife: 0.4 + Math.random() * 0.4,
                size: 3 + Math.random() * 5,
                color: ['#ff4466', '#ffdd00', '#ffffff', '#ff6600', '#00b4ff'][Math.floor(Math.random() * 5)]
            });
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 400 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    /* ========== DRAWING ========== */
    function drawArena() {
        var dark = isDark();
        /* sky */
        var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        if (dark) {
            bgGrad.addColorStop(0, '#0a0a1e');
            bgGrad.addColorStop(0.6, '#141430');
            bgGrad.addColorStop(1, '#1a1a3e');
        } else {
            bgGrad.addColorStop(0, '#b8cfe8');
            bgGrad.addColorStop(1, '#dde2ea');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        /* subtle background details */
        if (dark) {
            /* distant city silhouette */
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            var bx = 0;
            while (bx < W) {
                var bw = 20 + Math.sin(bx * 0.3) * 15 + 10;
                var bh = 30 + Math.sin(bx * 0.17 + 1) * 40 + 20;
                ctx.fillRect(bx, groundY - bh, bw - 3, bh);
                bx += bw;
            }
        }

        /* ground */
        var gGrad = ctx.createLinearGradient(0, groundY, 0, H);
        if (dark) {
            gGrad.addColorStop(0, '#22223a');
            gGrad.addColorStop(1, '#18182e');
        } else {
            gGrad.addColorStop(0, '#8a8a9e');
            gGrad.addColorStop(1, '#7a7a90');
        }
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, groundY, W, H - groundY);

        /* ground line glow */
        ctx.save();
        ctx.shadowColor = dark ? 'rgba(100,120,255,0.3)' : 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = dark ? 'rgba(100,120,255,0.25)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();
        ctx.restore();
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    /* ========== STICKMAN DRAWING ========== */
    function drawLimb(x1, y1, angle1, len1, angle2, len2) {
        var mx = x1 + Math.cos(angle1) * len1;
        var my = y1 + Math.sin(angle1) * len1;
        var ex = mx + Math.cos(angle2) * len2;
        var ey = my + Math.sin(angle2) * len2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        return { mx: mx, my: my, ex: ex, ey: ey };
    }

    function drawStickman(f) {
        var color = f.idx === 0 ? getCSSVar('--p1-color') : getCSSVar('--p2-color');
        var lightColor = f.idx === 0 ? getCSSVar('--p1-light') : getCSSVar('--p2-light');
        if (!lightColor) lightColor = color;
        var dir = f.facingRight ? 1 : -1;

        /* hip position */
        var hipX = f.x;
        var hipY = f.y;
        var neckX = hipX;
        var neckY = hipY - BODY_LEN;

        /* idle bob */
        var bob = 0;
        if (f.grounded && f.atkState === 'idle' && Math.abs(f.vx) < 20) {
            bob = Math.sin(f.idleBob) * 1.5;
            neckY += bob;
            hipY += bob * 0.5;
        }

        /* head pos */
        var headX = neckX;
        var headY = neckY - HEAD_RADIUS;

        /* compute pose angles */
        var pose = computePose(f, dir);

        ctx.save();

        /* hit flash */
        if (f.hitFlash > 0) {
            color = '#ffffff';
            lightColor = '#ffffff';
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_W;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = lightColor || color;
        ctx.shadowBlur = GLOW_BLUR;

        /* body */
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(neckX, neckY);
        ctx.stroke();

        /* head */
        ctx.beginPath();
        ctx.arc(headX, headY, HEAD_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        /* front arm (attack arm) */
        var frontArmResult = drawLimb(neckX, neckY, pose.fUpperArm, UPPER_ARM, pose.fLowerArm, LOWER_ARM);

        /* back arm */
        ctx.globalAlpha = 0.6;
        drawLimb(neckX, neckY, pose.bUpperArm, UPPER_ARM, pose.bLowerArm, LOWER_ARM);
        ctx.globalAlpha = 1;

        /* front leg */
        var frontLegResult = drawLimb(hipX, hipY, pose.fUpperLeg, UPPER_LEG, pose.fLowerLeg, LOWER_LEG);

        /* back leg */
        ctx.globalAlpha = 0.6;
        drawLimb(hipX, hipY, pose.bUpperLeg, UPPER_LEG, pose.bLowerLeg, LOWER_LEG);
        ctx.globalAlpha = 1;

        /* attack trail */
        if (f.atkState === 'active' && f.trailPts.length > 1) {
            ctx.save();
            ctx.strokeStyle = lightColor || color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 12;
            ctx.shadowColor = lightColor || color;
            for (var t = 1; t < f.trailPts.length; t++) {
                ctx.globalAlpha = t / f.trailPts.length * 0.5;
                ctx.beginPath();
                ctx.moveTo(f.trailPts[t - 1].x, f.trailPts[t - 1].y);
                ctx.lineTo(f.trailPts[t].x, f.trailPts[t].y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        /* store trail point for attack swing */
        if (f.atkState === 'active') {
            var trailEnd;
            if (f.atkType === 'kick' || f.atkType === 'jumpKick') {
                trailEnd = frontLegResult;
            } else {
                trailEnd = frontArmResult;
            }
            f.trailPts.push({ x: trailEnd.ex, y: trailEnd.ey });
            if (f.trailPts.length > 8) f.trailPts.shift();
        }

        ctx.restore();
    }

    function computePose(f, dir) {
        var PI = Math.PI;
        var HALF = PI / 2;
        /* default relaxed pose */
        var pose = {
            fUpperArm: HALF + dir * 0.3,
            fLowerArm: HALF + dir * 0.5,
            bUpperArm: HALF - dir * 0.3,
            bLowerArm: HALF - dir * 0.1,
            fUpperLeg: HALF + dir * 0.15,
            fLowerLeg: HALF - 0.1,
            bUpperLeg: HALF - dir * 0.15,
            bLowerLeg: HALF + 0.1
        };

        if (f.stunTimer > 0) {
            /* stun: lean back, arms flailing */
            var sway = Math.sin(f.stunTimer * 30) * 0.3;
            pose.fUpperArm = -HALF - dir * 0.6 + sway;
            pose.fLowerArm = -HALF + sway * 0.5;
            pose.bUpperArm = -HALF + dir * 0.4 - sway;
            pose.bLowerArm = -HALF - sway * 0.5;
            /* stagger legs */
            pose.fUpperLeg = HALF + dir * 0.4;
            pose.fLowerLeg = HALF + 0.3;
            pose.bUpperLeg = HALF - dir * 0.4;
            pose.bLowerLeg = HALF - 0.2;

        } else if (f.atkState !== 'idle') {
            var atk = ATTACKS[f.atkType];
            var progress = 0;
            if (f.atkState === 'startup') {
                progress = 1 - (f.atkTimer / atk.startup);
                progress *= 0.3; /* wind up is 0-30% */
            } else if (f.atkState === 'active') {
                progress = 0.3 + (1 - f.atkTimer / atk.active) * 0.5; /* 30-80% */
            } else {
                progress = 0.8 + (1 - f.atkTimer / atk.recovery) * 0.2; /* 80-100% */
            }

            if (f.atkType === 'punch' || f.atkType === 'jumpPunch') {
                /* punch: extend front arm forward */
                var windUp = Math.min(progress / 0.3, 1);
                var extend = Math.max(0, (progress - 0.3) / 0.5);
                var retract = Math.max(0, (progress - 0.8) / 0.2);

                if (progress < 0.3) {
                    /* wind up: pull arm back */
                    pose.fUpperArm = HALF - dir * 0.8 * windUp;
                    pose.fLowerArm = HALF - dir * 0.3 * windUp - 0.5 * windUp;
                } else if (progress < 0.8) {
                    /* extend forward */
                    pose.fUpperArm = lerp(HALF - dir * 0.8, dir * 0.1, Math.min(extend / 0.4, 1));
                    pose.fLowerArm = lerp(HALF - dir * 0.3 - 0.5, dir * 0.15, Math.min(extend / 0.4, 1));
                } else {
                    /* retract */
                    pose.fUpperArm = lerp(dir * 0.1, HALF + dir * 0.3, retract);
                    pose.fLowerArm = lerp(dir * 0.15, HALF + dir * 0.5, retract);
                }
            } else {
                /* kick: extend front leg */
                var windUp2 = Math.min(progress / 0.3, 1);
                var extend2 = Math.max(0, (progress - 0.3) / 0.5);
                var retract2 = Math.max(0, (progress - 0.8) / 0.2);

                if (progress < 0.3) {
                    pose.fUpperLeg = HALF - 0.5 * windUp2;
                    pose.fLowerLeg = HALF + 0.8 * windUp2;
                } else if (progress < 0.8) {
                    var k = Math.min(extend2 / 0.4, 1);
                    pose.fUpperLeg = lerp(HALF - 0.5, dir * 0.3, k);
                    pose.fLowerLeg = lerp(HALF + 0.8, dir * 0.2, k);
                } else {
                    pose.fUpperLeg = lerp(dir * 0.3, HALF + dir * 0.15, retract2);
                    pose.fLowerLeg = lerp(dir * 0.2, HALF - 0.1, retract2);
                }
                /* keep arms in guard during kick */
                pose.fUpperArm = HALF + dir * 0.1;
                pose.fLowerArm = HALF - 0.6;
                pose.bUpperArm = HALF - dir * 0.1;
                pose.bLowerArm = HALF + 0.2;
            }

        } else if (f.blocking) {
            /* block: arms crossed in front, crouched */
            pose.fUpperArm = HALF + dir * 0.2;
            pose.fLowerArm = -HALF + dir * 0.8;
            pose.bUpperArm = HALF - dir * 0.1;
            pose.bLowerArm = -HALF - dir * 0.4;
            /* crouch legs */
            pose.fUpperLeg = HALF + dir * 0.35;
            pose.fLowerLeg = HALF - 0.5;
            pose.bUpperLeg = HALF - dir * 0.35;
            pose.bLowerLeg = HALF + 0.5;

        } else if (!f.grounded) {
            /* airborne */
            pose.fUpperArm = -HALF + dir * 0.4;
            pose.fLowerArm = -HALF + 0.3;
            pose.bUpperArm = -HALF - dir * 0.4;
            pose.bLowerArm = -HALF - 0.3;
            pose.fUpperLeg = HALF - 0.3;
            pose.fLowerLeg = HALF + 0.4;
            pose.bUpperLeg = HALF + 0.3;
            pose.bLowerLeg = HALF - 0.2;

        } else if (Math.abs(f.vx) > 20) {
            /* walk cycle */
            var t = Math.sin(f.walkCycle);
            var t2 = Math.cos(f.walkCycle);
            pose.fUpperLeg = HALF + t * 0.4;
            pose.fLowerLeg = HALF - Math.abs(t) * 0.3;
            pose.bUpperLeg = HALF - t * 0.4;
            pose.bLowerLeg = HALF - Math.abs(t2) * 0.3;
            /* arms swing opposite */
            pose.fUpperArm = HALF - t * 0.3;
            pose.fLowerArm = HALF - 0.2;
            pose.bUpperArm = HALF + t * 0.3;
            pose.bLowerArm = HALF + 0.1;
        }

        return pose;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /* ========== SCREEN SHAKE ========== */
    function updateShake(dt) {
        if (shake.intensity > 0.5) {
            shake.x = (Math.random() - 0.5) * shake.intensity * 2;
            shake.y = (Math.random() - 0.5) * shake.intensity * 2;
            shake.intensity *= Math.pow(SHAKE_DECAY, dt * 60);
        } else {
            shake.x = 0;
            shake.y = 0;
            shake.intensity = 0;
        }
    }

    /* ========== HEALTH BARS ========== */
    function updateHealthBars() {
        if (p1HealthEl) p1HealthEl.style.width = fighters[0].health + '%';
        if (p2HealthEl) p2HealthEl.style.width = fighters[1].health + '%';
    }

    /* ========== GAME LOOP ========== */
    function update(dt) {
        /* hit stop */
        if (hitStop > 0) {
            hitStop--;
            updateShake(dt);
            return;
        }

        for (var i = 0; i < 2; i++) {
            handleInput(fighters[i]);
            updateFighter(fighters[i], dt);
        }

        /* push apart if overlapping */
        var overlap = 30 - Math.abs(fighters[0].x - fighters[1].x);
        if (overlap > 0) {
            var sign = fighters[0].x < fighters[1].x ? -1 : 1;
            fighters[0].x += sign * overlap * 0.5;
            fighters[1].x -= sign * overlap * 0.5;
        }

        /* hit detection both ways */
        checkHit(fighters[0], fighters[1]);
        checkHit(fighters[1], fighters[0]);

        updateParticles(dt);
        updateShake(dt);

        /* check round end */
        for (var j = 0; j < 2; j++) {
            if (fighters[j].health <= 0 && roundWinnerIdx < 0) {
                roundWinnerIdx = 1 - j;
                roundOverTimer = 1.8;
                spawnKOBurst(fighters[j].x, fighters[j].y - BODY_LEN * 0.5);
                CGameAudio.play('score');
                shake.intensity = 18;

                roundResultEl.textContent = 'Player ' + (roundWinnerIdx + 1) + ' wins the round!';
                roundResultEl.style.color = getCSSVar(roundWinnerIdx === 0 ? '--p1-color' : '--p2-color');
                roundOverlay.classList.remove('hidden');
            }
        }

        /* round over countdown */
        if (roundWinnerIdx >= 0) {
            roundOverTimer -= dt;
            if (roundOverTimer <= 0) {
                endRound();
            }
        }
    }

    function draw() {
        ctx.save();
        ctx.translate(shake.x, shake.y);

        drawArena();
        drawStickman(fighters[0]);
        drawStickman(fighters[1]);
        drawParticles();

        ctx.restore();
    }

    function gameLoop(timestamp) {
        if (!gameRunning) return;
        var dt = Math.min((timestamp - lastTime) / 1000, DT_CAP);
        lastTime = timestamp;

        if (!paused && roundWinnerIdx < 0) {
            /* store prev keys for justPressed */
            update(dt);
        } else if (roundWinnerIdx >= 0) {
            /* still update during round end for particles / timer */
            roundOverTimer -= dt;
            updateParticles(dt);
            updateShake(dt);
            if (roundOverTimer <= 0) {
                endRound();
            }
        }

        draw();

        /* update prevKeys */
        for (var k in keys) { prevKeys[k] = keys[k]; }

        animId = requestAnimationFrame(gameLoop);
    }

    /* ========== ROUND MANAGEMENT ========== */
    function setupRound() {
        currentRound++;
        roundInfoEl.textContent = 'Round ' + currentRound;

        fighters = [
            createFighter(0, W * 0.3),
            createFighter(1, W * 0.7)
        ];
        fighters[0].facingRight = true;
        fighters[1].facingRight = false;

        particles = [];
        shake = { x: 0, y: 0, intensity: 0 };
        hitStop = 0;
        roundWinnerIdx = -1;
        roundOverTimer = 0;

        updateHealthBars();
        roundOverlay.classList.add('hidden');
    }

    function startCountdown(cb) {
        countdownOverlay.classList.remove('hidden');
        var count = COUNTDOWN_SECS;
        countdownNumber.textContent = count;
        CGameAudio.play('countdown');

        /* draw initial state while counting */
        draw();

        var iv = setInterval(function () {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
                countdownNumber.style.animation = 'none';
                void countdownNumber.offsetWidth;
                countdownNumber.style.animation = 'countPulse 0.6s ease-out';
                CGameAudio.play('countdown');
            } else if (count === 0) {
                countdownNumber.textContent = 'FIGHT!';
                countdownNumber.style.animation = 'none';
                void countdownNumber.offsetWidth;
                countdownNumber.style.animation = 'countPulse 0.6s ease-out';
                CGameAudio.play('hit');
            } else {
                clearInterval(iv);
                countdownOverlay.classList.add('hidden');
                cb();
            }
        }, 800);
    }

    function startRound() {
        setupRound();

        /* draw the arena before countdown */
        draw();

        startCountdown(function () {
            gameRunning = true;
            paused = false;
            lastTime = performance.now();
            animId = requestAnimationFrame(gameLoop);
        });
    }

    function endRound() {
        gameRunning = false;
        if (animId) { cancelAnimationFrame(animId); animId = null; }
        roundOverlay.classList.add('hidden');

        if (roundWinnerIdx >= 0) {
            roundScores[roundWinnerIdx]++;
            scoreP1El.textContent = roundScores[0];
            scoreP2El.textContent = roundScores[1];
        }

        /* check match over */
        if (roundScores[0] >= ROUNDS_TO_WIN || roundScores[1] >= ROUNDS_TO_WIN) {
            finishMatch();
        } else {
            /* next round */
            startRound();
        }
    }

    function finishMatch() {
        var winner = roundScores[0] >= ROUNDS_TO_WIN ? 0 : 1;
        var winColor = getCSSVar(winner === 0 ? '--p1-color' : '--p2-color');

        document.getElementById('gameover-title').textContent = 'Player ' + (winner + 1) + ' Wins!';
        document.getElementById('gameover-title').style.color = winColor;
        document.getElementById('gameover-sub').textContent = roundScores[0] + ' - ' + roundScores[1];
        document.getElementById('gameover-icon').textContent = '\u{1F3C6}';

        CGameAudio.play('win');
        GameShell.showScreen('gameover-screen');
    }

    function startMatch() {
        roundScores = [0, 0];
        currentRound = 0;
        scoreP1El.textContent = '0';
        scoreP2El.textContent = '0';

        GameShell.showScreen('game-screen');
        resizeCanvas();
        startRound();
    }

    /* ========== CANVAS RESIZE ========== */
    function resizeCanvas() {
        if (!canvasContainer || !canvas) return;
        var rect = canvasContainer.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        W = rect.width;
        H = rect.height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        groundY = H * GROUND_Y_RATIO;
    }

    /* ========== INIT ========== */
    function init() {
        GameShell.init({ backUrl: '../' });

        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        canvasContainer = document.getElementById('canvas-container');
        p1HealthEl = document.getElementById('p1-health');
        p2HealthEl = document.getElementById('p2-health');
        scoreP1El = document.getElementById('score-p1');
        scoreP2El = document.getElementById('score-p2');
        roundInfoEl = document.getElementById('round-info');
        countdownOverlay = document.getElementById('countdown-overlay');
        countdownNumber = document.getElementById('countdown-number');
        pauseOverlay = document.getElementById('pause-overlay');
        roundOverlay = document.getElementById('round-overlay');
        roundResultEl = document.getElementById('round-result');

        /* keyboard */
        document.addEventListener('keydown', function (e) {
            var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            keys[key] = true;

            /* prevent scrolling on arrow keys and game keys */
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) !== -1) {
                e.preventDefault();
            }

            /* ESC = pause */
            if (e.key === 'Escape' && gameRunning) {
                togglePause();
            }
        });
        document.addEventListener('keyup', function (e) {
            var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            keys[key] = false;
        });

        /* buttons */
        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('select');
            startMatch();
        });

        document.getElementById('btn-back-game').addEventListener('click', function () {
            if (gameRunning) togglePause();
        });

        document.getElementById('btn-pause').addEventListener('click', function () {
            if (gameRunning) togglePause();
        });

        document.getElementById('btn-resume').addEventListener('click', function () {
            togglePause();
        });

        document.getElementById('btn-quit').addEventListener('click', function () {
            gameRunning = false;
            paused = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
            pauseOverlay.classList.add('hidden');
            GameShell.showScreen('title-screen');
        });

        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('select');
            startMatch();
        });

        document.getElementById('btn-go-menu').addEventListener('click', function () {
            CGameAudio.play('click');
            GameShell.showScreen('title-screen');
        });

        window.addEventListener('resize', function () {
            resizeCanvas();
            if (fighters.length) {
                groundY = H * GROUND_Y_RATIO;
                for (var i = 0; i < fighters.length; i++) {
                    if (fighters[i].y > groundY) fighters[i].y = groundY;
                }
            }
        });

        /* Register custom sounds */
        if (typeof CGameAudio !== 'undefined' && CGameAudio.register) {
            CGameAudio.register('whoosh', function (actx, now) {
                var o = actx.createOscillator();
                var g = actx.createGain();
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(800, now);
                o.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                g.gain.setValueAtTime(0.08, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                o.connect(g);
                g.connect(actx.destination);
                o.start(now);
                o.stop(now + 0.12);
            });
        }
    }

    function togglePause() {
        paused = !paused;
        if (paused) {
            pauseOverlay.classList.remove('hidden');
        } else {
            pauseOverlay.classList.add('hidden');
            lastTime = performance.now();
        }
    }

    /* ========== BOOT ========== */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
