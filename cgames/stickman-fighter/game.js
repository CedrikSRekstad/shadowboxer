(function () {
    'use strict';

    /* ===================================================================
       STICKMAN FIGHTER — Side-scrolling fighter-platformer
       Story mode:  1P vs AI enemies, increasing difficulty, weapon drops
       Local mode:  2P (or vs AI), best-of-3, weapon drops
       =================================================================== */

    /* ========== CONSTANTS ========== */
    var GRAVITY = 1500;
    var MOVE_SPEED = 280;
    var JUMP_VEL = -620;
    var MAX_HP = 100;
    var ROUNDS_TO_WIN = 2;
    var DT_CAP = 0.05;
    var STUN_DUR = 0.25;
    var BLOCK_DMG_MULT = 0.25;
    var BLOCK_KB_MULT = 0.35;

    /* Scroll */
    var SCROLL_BASE = 55;
    var SCROLL_ACCEL = 2.5;
    var SCROLL_MAX = 200;

    /* World */
    var CHUNK_W = 400;
    var GROUND_THICK = 40;
    var PLAT_H = 12;
    var SPIKE_H = 20;

    /* Stickman */
    var HEAD_R = 12;
    var BODY_LEN = 34;
    var U_ARM = 18, L_ARM = 16, U_LEG = 20, L_LEG = 18;
    var LINE_W = 4;
    var GLOW = 6;

    /* Attacks */
    var ATTACKS = {
        punch:     { dmg: 8,  rng: 46, su: 0.04, ac: 0.10, rc: 0.16, kb: 260, up: 0.15 },
        kick:      { dmg: 14, rng: 56, su: 0.06, ac: 0.12, rc: 0.24, kb: 380, up: 0.25 },
        jumpPunch: { dmg: 10, rng: 46, su: 0.03, ac: 0.14, rc: 0.10, kb: 300, up: 0.30 },
        jumpKick:  { dmg: 18, rng: 56, su: 0.04, ac: 0.14, rc: 0.14, kb: 480, up: 0.40 },
        /* weapon attacks */
        sword:     { dmg: 22, rng: 68, su: 0.05, ac: 0.12, rc: 0.20, kb: 420, up: 0.20 },
        axe:       { dmg: 30, rng: 52, su: 0.08, ac: 0.14, rc: 0.30, kb: 550, up: 0.35 },
        spear:     { dmg: 18, rng: 80, su: 0.04, ac: 0.10, rc: 0.22, kb: 340, up: 0.15 }
    };

    /* Weapon defs */
    var WEAPON_TYPES = ['sword', 'axe', 'spear'];
    var WEAPON_USES = { sword: 6, axe: 4, spear: 8 };
    var WEAPON_EMOJI = { sword: '\u2694', axe: '\u{1FA93}', spear: '\u{1F531}' };
    var WEAPON_DROP_INTERVAL = 6; /* seconds between possible drops in story */

    /* FX */
    var SHAKE_DECAY = 0.88;
    var SPARK_COUNT = 8;
    var HIT_STOP = 3;

    /* AI */
    var AI_REACT_TIME = 0.3;  /* seconds delay before AI reacts */
    var AI_AGGRESSION = 0.6;

    /* ========== STATE ========== */
    var canvas, ctx, W, H;
    var gameRunning = false, paused = false;
    var gameMode = 'story'; /* 'story' | 'local2p' | 'localai' */
    var roundScores = [0, 0], currentRound = 0;
    var storyScore = 0, storyKills = 0;
    var fighters = [];    /* player(s) */
    var enemies = [];     /* AI enemies in story mode */
    var weapons = [];     /* dropped weapon items in world */
    var particles = [];
    var shake = { x: 0, y: 0, int: 0 };
    var hitStop = 0;
    var keys = {}, prevKeys = {};
    var lastTime = 0, animId = null;
    var roundOverTimer = 0, roundWinnerIdx = -1;

    /* Camera & World */
    var camX = 0, scrollSpeed = SCROLL_BASE, levelTime = 0;
    var chunks = [], nextChunkX = 0, chunkSeed = 0;
    var difficulty = 0;  /* 0-1 ramps over time in story */
    var enemySpawnTimer = 0;
    var weaponDropTimer = 0;

    /* DOM */
    var canvasContainer, p1HealthEl, p2HealthEl, healthVsEl;
    var scoreP1El, scoreP2El, roundInfoEl;
    var countdownOverlay, countdownNumber;
    var pauseOverlay, roundOverlay, roundResultEl;
    var localOptionsEl;

    /* ========== HELPERS ========== */
    function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
    function dark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function rand() { chunkSeed = (chunkSeed * 1103515245 + 12345) & 0x7fffffff; return (chunkSeed >> 16) / 32768; }
    function justPressed(k) { return keys[k] && !prevKeys[k]; }

    /* ========== WORLD GEN ========== */
    function genChunk(x, idx) {
        var c = { x: x, grounds: [], platforms: [], spikes: [] };
        var gy = H - GROUND_THICK;
        if (idx < 1) {
            c.grounds.push({ x: x, w: CHUNK_W, y: gy });
        } else {
            var gx = x, rem = CHUNK_W;
            while (rem > 0) {
                var sw = 70 + rand() * 170;
                if (sw > rem) sw = rem;
                c.grounds.push({ x: gx, w: sw, y: gy });
                gx += sw; rem -= sw;
                /* gap? more gaps at higher difficulty */
                if (rem > 50 && rand() < 0.3 + difficulty * 0.25) {
                    var gapW = 45 + rand() * (40 + difficulty * 30);
                    if (gapW > rem) gapW = rem;
                    var ns = Math.floor(gapW / 18);
                    for (var s = 0; s < ns; s++) {
                        c.spikes.push({ x: gx + s * 18 + 3, y: H - SPIKE_H, w: 14, h: SPIKE_H });
                    }
                    gx += gapW; rem -= gapW;
                }
            }
        }
        /* platforms — more at higher difficulty */
        var np = idx < 1 ? 1 : 1 + Math.floor(rand() * (2 + difficulty));
        for (var p = 0; p < np; p++) {
            var pw = 55 + rand() * 80;
            var px = x + 20 + rand() * (CHUNK_W - pw - 40);
            var py = clamp(gy - 65 - rand() * (H * 0.35), 45, gy - 55);
            c.platforms.push({ x: px, y: py, w: pw });
        }
        return c;
    }

    function ensureChunks() {
        while (nextChunkX < camX + W + CHUNK_W) {
            chunks.push(genChunk(nextChunkX, chunks.length));
            nextChunkX += CHUNK_W;
        }
        while (chunks.length > 0 && chunks[0].x + CHUNK_W < camX - 100) chunks.shift();
    }

    /* ========== FIGHTER FACTORY ========== */
    function createFighter(idx, x, y, isAI) {
        return {
            idx: idx, x: x, y: y, vx: 0, vy: 0,
            facingRight: idx === 0, hp: MAX_HP,
            grounded: false, blocking: false, alive: true, isAI: !!isAI,
            atkState: 'idle', atkType: null, atkTimer: 0, atkHit: false,
            stunTimer: 0,
            walkCycle: 0, idleBob: Math.random() * 6.28, hitFlash: 0,
            trailPts: [],
            /* weapon */
            weapon: null, weaponUses: 0,
            /* AI state */
            aiTimer: 0, aiAction: 'idle', aiTarget: null
        };
    }

    /* ========== ENEMY FACTORY (Story mode) ========== */
    function createEnemy(x, y) {
        var hp = 30 + difficulty * 50;
        var e = createFighter(2, x, y, true);
        e.hp = hp;
        e.maxHp = hp;
        e.isEnemy = true;
        e.idx = 2; /* enemies are idx 2+ */
        return e;
    }

    /* ========== WEAPON ITEMS ========== */
    function spawnWeaponItem(x, y) {
        var type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
        weapons.push({ x: x, y: y, type: type, vy: 0, grounded: false, age: 0 });
    }

    function updateWeapons(dt) {
        for (var i = weapons.length - 1; i >= 0; i--) {
            var w = weapons[i];
            w.age += dt;
            /* gravity */
            if (!w.grounded) {
                w.vy += GRAVITY * dt;
                w.y += w.vy * dt;
                /* land on surfaces */
                var landed = false;
                for (var ci = 0; ci < chunks.length && !landed; ci++) {
                    var c = chunks[ci];
                    for (var gi = 0; gi < c.grounds.length && !landed; gi++) {
                        var g = c.grounds[gi];
                        if (w.x >= g.x && w.x <= g.x + g.w && w.y >= g.y) {
                            w.y = g.y; w.vy = 0; w.grounded = true; landed = true;
                        }
                    }
                    for (var pi = 0; pi < c.platforms.length && !landed; pi++) {
                        var pl = c.platforms[pi];
                        if (w.x >= pl.x && w.x <= pl.x + pl.w && w.y >= pl.y && w.y <= pl.y + 20) {
                            w.y = pl.y; w.vy = 0; w.grounded = true; landed = true;
                        }
                    }
                }
            }
            /* scroll with world */
            /* remove if off screen left */
            if (w.x < camX - 50 || w.y > H + 50) { weapons.splice(i, 1); continue; }
            /* pickup check */
            var allF = fighters.concat(enemies);
            for (var fi = 0; fi < allF.length; fi++) {
                var f = allF[fi];
                if (!f.alive) continue;
                if (Math.abs(f.x - w.x) < 25 && Math.abs(f.y - w.y) < 30) {
                    f.weapon = w.type;
                    f.weaponUses = WEAPON_USES[w.type];
                    CGameAudio.play('score');
                    weapons.splice(i, 1);
                    break;
                }
            }
        }
    }

    /* ========== INPUT ========== */
    function handleInput(f) {
        if (!f.alive || f.isAI) return;
        if (f.stunTimer > 0) { f.blocking = false; return; }
        if (f.atkState !== 'idle') return;

        var mv = 0, jmp = false, blk = false, pch = false, kck = false;
        if (f.idx === 0) {
            if (keys['a']) mv -= 1; if (keys['d']) mv += 1;
            if (keys['w']) jmp = true; if (keys['s']) blk = true;
            if (justPressed('f')) pch = true; if (justPressed('g')) kck = true;
        } else if (f.idx === 1 && !f.isAI) {
            if (keys['arrowleft']) mv -= 1; if (keys['arrowright']) mv += 1;
            if (keys['arrowup']) jmp = true; if (keys['arrowdown']) blk = true;
            if (justPressed('k')) pch = true; if (justPressed('l')) kck = true;
        }

        f.vx = (blk && f.grounded) ? 0 : mv * MOVE_SPEED;

        /* auto-face nearest opponent */
        var nearest = findNearestOpponent(f);
        if (nearest && f.atkState === 'idle') f.facingRight = nearest.x > f.x;

        if (jmp && f.grounded && !blk) { f.vy = JUMP_VEL; f.grounded = false; CGameAudio.play('click'); }
        f.blocking = blk && f.grounded;

        if (pch) {
            if (f.weapon) startAttack(f, f.weapon);
            else startAttack(f, f.grounded ? 'punch' : 'jumpPunch');
        }
        if (kck) startAttack(f, f.grounded ? 'kick' : 'jumpKick');
    }

    function findNearestOpponent(f) {
        var best = null, bestD = Infinity;
        var targets = f.isEnemy ? fighters : (gameMode === 'story' ? enemies : fighters);
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (t === f || !t.alive) continue;
            var d = Math.abs(t.x - f.x);
            if (d < bestD) { bestD = d; best = t; }
        }
        /* in local modes, opponent is the other fighter */
        if (!f.isEnemy && fighters.length > 1) {
            var opp = fighters[1 - (f.idx === 0 ? 0 : 1)];
            if (opp && opp.alive && opp !== f) {
                var od = Math.abs(opp.x - f.x);
                if (od < bestD) best = opp;
            }
        }
        return best;
    }

    /* ========== AI ========== */
    function updateAI(f, dt) {
        if (!f.alive || !f.isAI) return;
        if (f.stunTimer > 0 || f.atkState !== 'idle') return;

        f.aiTimer -= dt;
        if (f.aiTimer > 0) return;
        f.aiTimer = AI_REACT_TIME * (0.8 + Math.random() * 0.4);

        var target = findNearestOpponent(f);
        if (!target || !target.alive) {
            /* just run right */
            f.vx = MOVE_SPEED * 0.5;
            return;
        }

        var dx = target.x - f.x;
        var dy = target.y - f.y;
        var dist = Math.abs(dx);
        f.facingRight = dx > 0;

        /* approach target */
        var atkRange = f.weapon ? ATTACKS[f.weapon].rng : 50;

        if (dist > atkRange + 20) {
            /* move toward */
            f.vx = (dx > 0 ? 1 : -1) * MOVE_SPEED * (0.6 + difficulty * 0.4);
            /* jump if target is above or gap ahead */
            if ((dy < -40 || rand() < 0.1) && f.grounded) {
                f.vy = JUMP_VEL; f.grounded = false;
            }
        } else if (dist < atkRange - 10 && rand() < 0.3) {
            /* too close, back off a bit */
            f.vx = (dx > 0 ? -1 : 1) * MOVE_SPEED * 0.3;
        } else {
            /* in range — attack! */
            f.vx = 0;
            if (rand() < AI_AGGRESSION + difficulty * 0.3) {
                if (f.weapon) startAttack(f, f.weapon);
                else if (rand() < 0.5) startAttack(f, f.grounded ? 'punch' : 'jumpPunch');
                else startAttack(f, f.grounded ? 'kick' : 'jumpKick');
            } else if (rand() < 0.3) {
                /* block */
                f.blocking = true;
            }
        }

        /* sometimes jump proactively */
        if (f.grounded && rand() < 0.05 + difficulty * 0.05) {
            f.vy = JUMP_VEL; f.grounded = false;
        }
    }

    /* ========== ATTACKS ========== */
    function startAttack(f, type) {
        if (f.atkState !== 'idle' || f.stunTimer > 0 || f.blocking) return;
        var atk = ATTACKS[type]; if (!atk) return;
        f.atkState = 'startup'; f.atkType = type; f.atkTimer = atk.su; f.atkHit = false; f.trailPts = [];
        f.blocking = false;
        /* use weapon charge */
        if (f.weapon && (type === f.weapon)) {
            f.weaponUses--;
            if (f.weaponUses <= 0) f.weapon = null;
        }
    }

    function updateAttack(f, dt) {
        if (f.atkState === 'idle') return;
        var atk = ATTACKS[f.atkType]; if (!atk) { f.atkState = 'idle'; return; }
        f.atkTimer -= dt;
        if (f.atkState === 'startup' && f.atkTimer <= 0) { f.atkState = 'active'; f.atkTimer = atk.ac; }
        else if (f.atkState === 'active' && f.atkTimer <= 0) { f.atkState = 'recovery'; f.atkTimer = atk.rc; }
        else if (f.atkState === 'recovery' && f.atkTimer <= 0) { f.atkState = 'idle'; f.atkType = null; f.trailPts = []; }
    }

    /* ========== HIT DETECTION ========== */
    function checkHit(a, d) {
        if (!a.alive || !d.alive) return;
        if (a.atkState !== 'active' || a.atkHit) return;
        if (a === d) return;
        var atk = ATTACKS[a.atkType]; if (!atk) return;
        var dir = a.facingRight ? 1 : -1;
        var hx = a.x + dir * atk.rng;
        var hy = (a.atkType === 'kick' || a.atkType === 'jumpKick') ? a.y - BODY_LEN * 0.3 : a.y - BODY_LEN * 0.75;
        var dx = hx - d.x, dy = hy - (d.y - BODY_LEN * 0.5);
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
            a.atkHit = true;
            var dmg = atk.dmg, kb = atk.kb;
            if (d.blocking) {
                dmg *= BLOCK_DMG_MULT; kb *= BLOCK_KB_MULT;
                CGameAudio.play('bounce');
                spawnSparks((a.x + d.x) / 2, hy, 0, '#88ccff', 5);
            } else {
                CGameAudio.play('hit');
                d.stunTimer = STUN_DUR;
                spawnSparks((a.x + d.x) / 2, hy, dir, null, SPARK_COUNT);
                shake.int = Math.min(dmg * 0.4, 12);
                hitStop = HIT_STOP;
            }
            d.hp = Math.max(0, d.hp - dmg);
            d.vx += dir * kb; d.vy -= kb * atk.up;
            d.hitFlash = 0.12; d.grounded = false;
            updateHealthBars();
        }
    }

    function checkAllHits() {
        var all = fighters.concat(enemies);
        for (var i = 0; i < all.length; i++) {
            for (var j = 0; j < all.length; j++) {
                if (i !== j) checkHit(all[i], all[j]);
            }
        }
    }

    /* ========== COLLISION ========== */
    function resolveCol(f) {
        if (!f.alive) return;
        f.grounded = false;
        for (var ci = 0; ci < chunks.length; ci++) {
            var c = chunks[ci];
            for (var gi = 0; gi < c.grounds.length; gi++) landOn(f, c.grounds[gi].x, c.grounds[gi].y, c.grounds[gi].w);
            for (var pi = 0; pi < c.platforms.length; pi++) landOn(f, c.platforms[pi].x, c.platforms[pi].y, c.platforms[pi].w);
            for (var si = 0; si < c.spikes.length; si++) {
                var sp = c.spikes[si];
                if (f.x > sp.x && f.x < sp.x + sp.w && f.y > sp.y && f.y < sp.y + sp.h) { killFighter(f); return; }
            }
        }
    }

    function landOn(f, sx, sy, sw) {
        if (f.vy < 0) return;
        if (f.x >= sx - 6 && f.x <= sx + sw + 6 && f.y >= sy - 4 && f.y <= sy + 8) {
            f.y = sy; f.vy = 0; f.grounded = true;
        }
    }

    /* ========== PHYSICS ========== */
    function updateFighter(f, dt) {
        if (!f.alive) return;
        if (f.stunTimer > 0) f.stunTimer -= dt;
        if (!f.grounded) f.vy += GRAVITY * dt;
        f.x += scrollSpeed * dt; /* move with scroll */
        f.x += f.vx * dt; f.y += f.vy * dt;
        resolveCol(f);
        /* friction */
        if (f.grounded && f.atkState === 'idle') f.vx *= Math.pow(0.80, dt * 60);
        if (!f.grounded) f.vx *= Math.pow(0.96, dt * 60);
        /* bounds */
        if (f.x < camX - 40) { killFighter(f); return; }
        if (f.x > camX + W + 80) { f.x = camX + W + 80; if (f.vx > 0) f.vx = 0; }
        if (f.y > H + 100) { killFighter(f); return; }
        /* decay */
        if (f.hitFlash > 0) f.hitFlash -= dt;
        if (f.grounded && Math.abs(f.vx) > 20 && f.atkState === 'idle') f.walkCycle += dt * 14;
        f.idleBob += dt * 2.5;
        updateAttack(f, dt);
    }

    function killFighter(f) {
        if (!f.alive) return;
        f.alive = false;
        spawnBurst(f.x, f.y - BODY_LEN * 0.5);
        CGameAudio.play('lose');
        shake.int = 12;
        /* in story, killed enemy = score + possible weapon drop */
        if (f.isEnemy && gameMode === 'story') {
            storyKills++;
            storyScore += 50 + Math.floor(difficulty * 50);
            if (Math.random() < 0.4) spawnWeaponItem(f.x, f.y - 20);
        }
    }

    /* ========== ENEMY SPAWNER (Story) ========== */
    function updateEnemySpawner(dt) {
        if (gameMode !== 'story') return;
        enemySpawnTimer -= dt;
        if (enemySpawnTimer <= 0) {
            /* spawn enemy ahead of camera */
            var ex = camX + W + 30 + Math.random() * 100;
            var ey = H - GROUND_THICK - 5;
            enemies.push(createEnemy(ex, ey));
            /* spawn rate increases with difficulty */
            enemySpawnTimer = Math.max(1.5, 4 - difficulty * 2.5) + Math.random() * 2;
        }
        /* remove dead/off-screen enemies */
        for (var i = enemies.length - 1; i >= 0; i--) {
            if (!enemies[i].alive && enemies[i].hitFlash <= 0) enemies.splice(i, 1);
            else if (enemies[i].x < camX - 100) enemies.splice(i, 1);
        }
    }

    /* ========== WEAPON DROP TIMER (both modes) ========== */
    function updateWeaponSpawner(dt) {
        weaponDropTimer -= dt;
        if (weaponDropTimer <= 0) {
            weaponDropTimer = WEAPON_DROP_INTERVAL * (0.7 + Math.random() * 0.6);
            /* drop a weapon on a random visible platform or ground */
            var wx = camX + W * 0.4 + Math.random() * W * 0.5;
            var wy = 30;
            spawnWeaponItem(wx, wy);
        }
    }

    /* ========== PARTICLES ========== */
    function spawnSparks(x, y, dir, col, n) {
        for (var i = 0; i < n; i++) {
            var a = dir !== 0 ? (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.2 : Math.random() * 6.28;
            var sp = 100 + Math.random() * 250;
            particles.push({
                x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
                life: 0.18 + Math.random() * 0.15, max: 0.18 + Math.random() * 0.15,
                sz: 2 + Math.random() * 3,
                col: col || (Math.random() < 0.4 ? '#fff' : Math.random() < 0.5 ? '#ffdd00' : '#ff6600')
            });
        }
    }

    function spawnBurst(x, y) {
        var cs = ['#ff4466', '#ffdd00', '#fff', '#ff6600', '#00b4ff'];
        for (var i = 0; i < 22; i++) {
            var a = Math.random() * 6.28, sp = 80 + Math.random() * 280;
            particles.push({
                x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.3 + Math.random() * 0.3, max: 0.3 + Math.random() * 0.3,
                sz: 3 + Math.random() * 5, col: cs[Math.floor(Math.random() * 5)]
            });
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 350 * dt; p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    /* ========== DRAWING ========== */
    function drawWorld() {
        var dk = dark();
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        if (dk) { bg.addColorStop(0, '#080818'); bg.addColorStop(0.5, '#0e0e28'); bg.addColorStop(1, '#161638'); }
        else { bg.addColorStop(0, '#a8c8e8'); bg.addColorStop(1, '#d0d8e4'); }
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

        /* parallax city */
        if (dk) {
            ctx.fillStyle = 'rgba(255,255,255,0.015)';
            var px = camX * 0.15;
            for (var bx = -200; bx < W + 200; bx += 35) {
                var wbx = bx + (px % 35);
                ctx.fillRect(bx, H - GROUND_THICK - 30 - Math.sin(wbx * 0.08) * 50 - 30, 28, 30 + Math.sin(wbx * 0.08) * 50 + 30);
            }
        }

        ctx.save(); ctx.translate(-camX, 0);
        for (var ci = 0; ci < chunks.length; ci++) {
            var c = chunks[ci];
            if (c.x + CHUNK_W < camX - 50 || c.x > camX + W + 50) continue;

            /* grounds */
            for (var gi = 0; gi < c.grounds.length; gi++) {
                var g = c.grounds[gi];
                var gg = ctx.createLinearGradient(0, g.y, 0, g.y + GROUND_THICK);
                gg.addColorStop(0, dk ? '#2a2a48' : '#8a8aa0'); gg.addColorStop(1, dk ? '#1a1a30' : '#7a7a90');
                ctx.fillStyle = gg; ctx.fillRect(g.x, g.y, g.w, GROUND_THICK + 20);
                ctx.strokeStyle = dk ? 'rgba(100,140,255,0.3)' : 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + g.w, g.y); ctx.stroke();
            }
            /* platforms */
            for (var pi = 0; pi < c.platforms.length; pi++) {
                var pl = c.platforms[pi];
                var pg = ctx.createLinearGradient(0, pl.y, 0, pl.y + PLAT_H);
                pg.addColorStop(0, dk ? '#3a3a5a' : '#9a9ab0'); pg.addColorStop(1, dk ? '#28284a' : '#8888a0');
                ctx.fillStyle = pg; ctx.fillRect(pl.x, pl.y, pl.w, PLAT_H);
                ctx.save(); ctx.strokeStyle = dk ? 'rgba(140,160,255,0.35)' : 'rgba(0,0,0,0.12)';
                ctx.shadowColor = dk ? 'rgba(140,160,255,0.3)' : 'transparent'; ctx.shadowBlur = 5;
                ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + pl.w, pl.y); ctx.stroke();
                ctx.restore();
            }
            /* spikes */
            ctx.shadowBlur = 0;
            for (var si = 0; si < c.spikes.length; si++) {
                var sp = c.spikes[si];
                ctx.fillStyle = dk ? '#cc2244' : '#cc3355';
                ctx.beginPath(); ctx.moveTo(sp.x, sp.y + sp.h); ctx.lineTo(sp.x + sp.w / 2, sp.y); ctx.lineTo(sp.x + sp.w, sp.y + sp.h); ctx.closePath(); ctx.fill();
            }
        }

        /* weapons on ground */
        for (var wi = 0; wi < weapons.length; wi++) {
            var w = weapons[wi];
            ctx.save();
            ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
            ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 8;
            /* float bob */
            var bob = Math.sin(w.age * 4) * 3;
            ctx.fillText(WEAPON_EMOJI[w.type] || '?', w.x, w.y - 8 + bob);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        ctx.restore();
    }

    function drawAllFighters() {
        ctx.save(); ctx.translate(-camX, 0);
        var all = fighters.concat(enemies);
        for (var i = 0; i < all.length; i++) if (all[i].alive) drawStickman(all[i]);
        ctx.restore();
    }

    function drawParticlesWorld() {
        ctx.save(); ctx.translate(-camX, 0);
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i]; var a = p.life / p.max;
            ctx.globalAlpha = a; ctx.fillStyle = p.col;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * a, 0, 6.28); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.restore();
    }

    function drawHUD() {
        /* distance / score */
        ctx.save();
        ctx.fillStyle = dark() ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'right';
        if (gameMode === 'story') {
            ctx.fillText('Score: ' + storyScore + '  Kills: ' + storyKills, W - 10, H - 10);
        } else {
            ctx.fillText(Math.floor(camX / 10) + 'm', W - 10, H - 10);
        }
        ctx.restore();

        /* weapon indicator for players */
        for (var i = 0; i < fighters.length; i++) {
            var f = fighters[i];
            if (!f.alive || !f.weapon) continue;
            var sx = f.x - camX;
            var sy = f.y - BODY_LEN - HEAD_R * 2 - 22;
            ctx.save();
            ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(WEAPON_EMOJI[f.weapon] + ' x' + f.weaponUses, sx, sy);
            ctx.restore();
        }

        /* off-screen indicators */
        for (var j = 0; j < fighters.length; j++) {
            var ff = fighters[j];
            if (!ff.alive) continue;
            var sx2 = ff.x - camX;
            if (sx2 < 5 || sx2 > W - 5) {
                var col = ff.idx === 0 ? css('--p1-color') : css('--p2-color');
                var ax = clamp(sx2, 18, W - 18);
                var ay = clamp(ff.y - 20, 18, H - 18);
                ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = 0.8;
                ctx.beginPath();
                if (sx2 < 5) { ctx.moveTo(ax, ay); ctx.lineTo(ax + 10, ay - 6); ctx.lineTo(ax + 10, ay + 6); }
                else { ctx.moveTo(ax, ay); ctx.lineTo(ax - 10, ay - 6); ctx.lineTo(ax - 10, ay + 6); }
                ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
            }
        }

        /* enemy health bars (small) */
        ctx.save(); ctx.translate(-camX, 0);
        for (var ei = 0; ei < enemies.length; ei++) {
            var en = enemies[ei];
            if (!en.alive || !en.maxHp) continue;
            var bw = 30, bh = 3;
            var bx = en.x - bw / 2;
            var by = en.y - BODY_LEN - HEAD_R * 2 - 14;
            ctx.fillStyle = 'rgba(255,0,0,0.3)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = '#ff4466';
            ctx.fillRect(bx, by, bw * (en.hp / en.maxHp), bh);
        }
        ctx.restore();
    }

    /* ========== STICKMAN DRAWING ========== */
    function drawLimb(x1, y1, a1, l1, a2, l2) {
        var mx = x1 + Math.cos(a1) * l1, my = y1 + Math.sin(a1) * l1;
        var ex = mx + Math.cos(a2) * l2, ey = my + Math.sin(a2) * l2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
        return { ex: ex, ey: ey };
    }

    function drawStickman(f) {
        var col, light;
        if (f.isEnemy) { col = '#ff4466'; light = '#ff7799'; }
        else if (f.idx === 0) { col = css('--p1-color'); light = css('--p1-light') || col; }
        else { col = css('--p2-color'); light = css('--p2-light') || col; }

        var dir = f.facingRight ? 1 : -1;
        var hX = f.x, hY = f.y, nY = hY - BODY_LEN;
        if (f.grounded && f.atkState === 'idle' && Math.abs(f.vx) < 20) {
            var bob = Math.sin(f.idleBob) * 1.2; nY += bob; hY += bob * 0.5;
        }
        var pose = computePose(f, dir);
        ctx.save();
        if (f.hitFlash > 0) { col = '#fff'; light = '#fff'; }
        ctx.strokeStyle = col; ctx.lineWidth = LINE_W; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = light; ctx.shadowBlur = GLOW;
        /* body */
        ctx.beginPath(); ctx.moveTo(hX, hY); ctx.lineTo(hX, nY); ctx.stroke();
        /* head */
        ctx.beginPath(); ctx.arc(hX, nY - HEAD_R, HEAD_R, 0, 6.28); ctx.stroke();
        /* arms/legs */
        var fA = drawLimb(hX, nY, pose.fUA, U_ARM, pose.fLA, L_ARM);
        ctx.globalAlpha = 0.55; drawLimb(hX, nY, pose.bUA, U_ARM, pose.bLA, L_ARM); ctx.globalAlpha = 1;
        var fL = drawLimb(hX, hY, pose.fUL, U_LEG, pose.fLL, L_LEG);
        ctx.globalAlpha = 0.55; drawLimb(hX, hY, pose.bUL, U_LEG, pose.bLL, L_LEG); ctx.globalAlpha = 1;

        /* attack trail */
        if (f.atkState === 'active' && f.trailPts.length > 1) {
            ctx.save(); ctx.strokeStyle = light; ctx.lineWidth = 2; ctx.shadowBlur = 10;
            for (var t = 1; t < f.trailPts.length; t++) {
                ctx.globalAlpha = t / f.trailPts.length * 0.4;
                ctx.beginPath(); ctx.moveTo(f.trailPts[t - 1].x, f.trailPts[t - 1].y);
                ctx.lineTo(f.trailPts[t].x, f.trailPts[t].y); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.restore();
        }
        if (f.atkState === 'active') {
            var isKick = f.atkType === 'kick' || f.atkType === 'jumpKick';
            var te = isKick ? fL : fA;
            f.trailPts.push({ x: te.ex, y: te.ey });
            if (f.trailPts.length > 7) f.trailPts.shift();
        }

        /* label */
        ctx.shadowBlur = 0; ctx.fillStyle = col; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
        if (f.isEnemy) ctx.fillText('E', hX, nY - HEAD_R * 2 - 6);
        else ctx.fillText('P' + (f.idx + 1), hX, nY - HEAD_R * 2 - 6);

        ctx.restore();
    }

    function computePose(f, dir) {
        var PI = Math.PI, H2 = PI / 2;
        var p = {
            fUA: H2 + dir * 0.3, fLA: H2 + dir * 0.5,
            bUA: H2 - dir * 0.3, bLA: H2 - dir * 0.1,
            fUL: H2 + dir * 0.15, fLL: H2 - 0.1,
            bUL: H2 - dir * 0.15, bLL: H2 + 0.1
        };
        if (f.stunTimer > 0) {
            var sw = Math.sin(f.stunTimer * 30) * 0.3;
            p.fUA = -H2 - dir * 0.6 + sw; p.fLA = -H2 + sw * 0.5;
            p.bUA = -H2 + dir * 0.4 - sw; p.bLA = -H2 - sw * 0.5;
            p.fUL = H2 + dir * 0.4; p.fLL = H2 + 0.3;
            p.bUL = H2 - dir * 0.4; p.bLL = H2 - 0.2;
        } else if (f.atkState !== 'idle') {
            var atk = ATTACKS[f.atkType]; if (!atk) return p;
            var prog = 0;
            if (f.atkState === 'startup') prog = (1 - f.atkTimer / atk.su) * 0.3;
            else if (f.atkState === 'active') prog = 0.3 + (1 - f.atkTimer / atk.ac) * 0.5;
            else prog = 0.8 + (1 - f.atkTimer / atk.rc) * 0.2;
            var isKick = f.atkType === 'kick' || f.atkType === 'jumpKick';
            var isWeapon = WEAPON_TYPES.indexOf(f.atkType) >= 0;
            if (!isKick) {
                /* punch / weapon swing — extend arm */
                if (prog < 0.3) { var w = prog / 0.3; p.fUA = H2 - dir * 0.8 * w; p.fLA = H2 - dir * 0.3 * w - 0.5 * w; }
                else if (prog < 0.8) { var e = Math.min((prog - 0.3) / 0.2, 1); p.fUA = lerp(H2 - dir * 0.8, dir * 0.1, e); p.fLA = lerp(H2 - dir * 0.3 - 0.5, dir * 0.15, e); }
                else { var r = (prog - 0.8) / 0.2; p.fUA = lerp(dir * 0.1, H2 + dir * 0.3, r); p.fLA = lerp(dir * 0.15, H2 + dir * 0.5, r); }
            } else {
                if (prog < 0.3) { var w2 = prog / 0.3; p.fUL = H2 - 0.5 * w2; p.fLL = H2 + 0.8 * w2; }
                else if (prog < 0.8) { var e2 = Math.min((prog - 0.3) / 0.2, 1); p.fUL = lerp(H2 - 0.5, dir * 0.3, e2); p.fLL = lerp(H2 + 0.8, dir * 0.2, e2); }
                else { var r2 = (prog - 0.8) / 0.2; p.fUL = lerp(dir * 0.3, H2 + dir * 0.15, r2); p.fLL = lerp(dir * 0.2, H2 - 0.1, r2); }
                p.fUA = H2 + dir * 0.1; p.fLA = H2 - 0.6;
            }
        } else if (f.blocking) {
            p.fUA = H2 + dir * 0.2; p.fLA = -H2 + dir * 0.8;
            p.bUA = H2 - dir * 0.1; p.bLA = -H2 - dir * 0.4;
            p.fUL = H2 + dir * 0.35; p.fLL = H2 - 0.5;
            p.bUL = H2 - dir * 0.35; p.bLL = H2 + 0.5;
        } else if (!f.grounded) {
            p.fUA = -H2 + dir * 0.4; p.fLA = -H2 + 0.3;
            p.bUA = -H2 - dir * 0.4; p.bLA = -H2 - 0.3;
            p.fUL = H2 - 0.3; p.fLL = H2 + 0.4;
            p.bUL = H2 + 0.3; p.bLL = H2 - 0.2;
        } else if (Math.abs(f.vx) > 20) {
            var t = Math.sin(f.walkCycle), t2 = Math.cos(f.walkCycle);
            p.fUL = H2 + t * 0.4; p.fLL = H2 - Math.abs(t) * 0.3;
            p.bUL = H2 - t * 0.4; p.bLL = H2 - Math.abs(t2) * 0.3;
            p.fUA = H2 - t * 0.3; p.fLA = H2 - 0.2;
            p.bUA = H2 + t * 0.3; p.bLA = H2 + 0.1;
        }
        return p;
    }

    /* ========== SCREEN SHAKE ========== */
    function updateShake(dt) {
        if (shake.int > 0.5) {
            shake.x = (Math.random() - 0.5) * shake.int * 2;
            shake.y = (Math.random() - 0.5) * shake.int * 2;
            shake.int *= Math.pow(SHAKE_DECAY, dt * 60);
        } else { shake.x = shake.y = shake.int = 0; }
    }

    /* ========== HEALTH BARS ========== */
    function updateHealthBars() {
        if (p1HealthEl && fighters[0]) p1HealthEl.style.width = fighters[0].hp + '%';
        if (p2HealthEl) {
            if (gameMode === 'story') {
                /* show health of nearest enemy or hide */
                var nearest = null, bd = Infinity;
                for (var i = 0; i < enemies.length; i++) {
                    if (enemies[i].alive) {
                        var d = Math.abs(enemies[i].x - fighters[0].x);
                        if (d < bd) { bd = d; nearest = enemies[i]; }
                    }
                }
                if (nearest) p2HealthEl.style.width = (nearest.hp / nearest.maxHp * 100) + '%';
                else p2HealthEl.style.width = '0%';
            } else if (fighters[1]) {
                p2HealthEl.style.width = fighters[1].hp + '%';
            }
        }
    }

    /* ========== MAIN UPDATE ========== */
    function update(dt) {
        if (hitStop > 0) { hitStop--; updateShake(dt); return; }

        levelTime += dt;
        difficulty = Math.min(levelTime / 120, 1); /* ramps to max over 2 minutes */
        scrollSpeed = Math.min(SCROLL_BASE + levelTime * SCROLL_ACCEL, SCROLL_MAX);

        camX += scrollSpeed * dt;
        ensureChunks();

        /* update fighters */
        for (var i = 0; i < fighters.length; i++) {
            handleInput(fighters[i]);
            if (fighters[i].isAI) updateAI(fighters[i], dt);
            updateFighter(fighters[i], dt);
        }

        /* update enemies */
        for (var ei = 0; ei < enemies.length; ei++) {
            updateAI(enemies[ei], dt);
            updateFighter(enemies[ei], dt);
        }

        /* push fighters apart */
        for (var a = 0; a < fighters.length; a++) {
            for (var b = a + 1; b < fighters.length; b++) {
                if (fighters[a].alive && fighters[b].alive) {
                    var ov = 24 - Math.abs(fighters[a].x - fighters[b].x);
                    if (ov > 0) {
                        var s = fighters[a].x < fighters[b].x ? -1 : 1;
                        fighters[a].x += s * ov * 0.5;
                        fighters[b].x -= s * ov * 0.5;
                    }
                }
            }
        }

        /* hits */
        checkAllHits();

        /* health deaths */
        var allF = fighters.concat(enemies);
        for (var k = 0; k < allF.length; k++) {
            if (allF[k].alive && allF[k].hp <= 0) killFighter(allF[k]);
        }

        /* spawners */
        updateEnemySpawner(dt);
        updateWeaponSpawner(dt);
        updateWeapons(dt);

        updateParticles(dt);
        updateShake(dt);

        /* check round end */
        if (roundWinnerIdx === -1) {
            if (gameMode === 'story') {
                /* story ends when player dies */
                if (!fighters[0].alive) {
                    roundWinnerIdx = -3; /* story over */
                    roundOverTimer = 2;
                    roundResultEl.textContent = 'You died!';
                    roundResultEl.style.color = '#ff4466';
                    roundOverlay.classList.remove('hidden');
                }
            } else {
                /* local mode: check if a fighter died */
                var p1d = !fighters[0].alive;
                var p2d = fighters.length > 1 && !fighters[1].alive;
                if (p1d || p2d) {
                    if (p1d && p2d) roundWinnerIdx = -2;
                    else roundWinnerIdx = p1d ? 1 : 0;
                    roundOverTimer = 1.6;
                    if (roundWinnerIdx >= 0) {
                        roundResultEl.textContent = 'Player ' + (roundWinnerIdx + 1) + ' wins!';
                        roundResultEl.style.color = css(roundWinnerIdx === 0 ? '--p1-color' : '--p2-color');
                    } else {
                        roundResultEl.textContent = 'Draw!';
                        roundResultEl.style.color = css('--accent');
                    }
                    roundOverlay.classList.remove('hidden');
                    CGameAudio.play('score');
                }
            }
        }

        if (roundWinnerIdx !== -1) {
            roundOverTimer -= dt;
            if (roundOverTimer <= 0) endRound();
        }

        /* story score from distance */
        if (gameMode === 'story' && fighters[0] && fighters[0].alive) {
            storyScore = Math.max(storyScore, Math.floor(camX / 5) + storyKills * 50);
        }
    }

    function draw() {
        ctx.save(); ctx.translate(shake.x, shake.y);
        drawWorld();
        drawAllFighters();
        drawParticlesWorld();
        ctx.restore();
        drawHUD();
    }

    function gameLoop(ts) {
        if (!gameRunning) return;
        var dt = Math.min((ts - lastTime) / 1000, DT_CAP);
        lastTime = ts;
        if (!paused) update(dt);
        draw();
        for (var k in keys) prevKeys[k] = keys[k];
        animId = requestAnimationFrame(gameLoop);
    }

    /* ========== ROUND/MATCH MANAGEMENT ========== */
    function setupRound() {
        currentRound++;
        if (gameMode === 'story') {
            roundInfoEl.textContent = 'Story';
        } else {
            roundInfoEl.textContent = 'Round ' + currentRound;
        }

        camX = 0; scrollSpeed = SCROLL_BASE; levelTime = 0;
        chunks = []; nextChunkX = 0; chunkSeed = currentRound * 7919 + Date.now();
        difficulty = 0; enemySpawnTimer = 2; weaponDropTimer = WEAPON_DROP_INTERVAL * 0.5;
        enemies = []; weapons = [];
        ensureChunks();

        var gy = H - GROUND_THICK;
        if (gameMode === 'story') {
            fighters = [createFighter(0, 120, gy, false)];
            storyScore = 0; storyKills = 0;
            /* hide P2 health label */
            if (healthVsEl) healthVsEl.textContent = 'E';
        } else {
            var p2isAI = gameMode === 'localai';
            fighters = [
                createFighter(0, 100, gy, false),
                createFighter(1, 220, gy, p2isAI)
            ];
            if (healthVsEl) healthVsEl.textContent = 'VS';
        }

        particles = [];
        shake = { x: 0, y: 0, int: 0 }; hitStop = 0;
        roundWinnerIdx = -1; roundOverTimer = 0;
        updateHealthBars();
        roundOverlay.classList.add('hidden');
    }

    function startCountdown(cb) {
        countdownOverlay.classList.remove('hidden');
        var count = 3;
        countdownNumber.textContent = count;
        CGameAudio.play('countdown');
        draw();
        var iv = setInterval(function () {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
                countdownNumber.style.animation = 'none'; void countdownNumber.offsetWidth;
                countdownNumber.style.animation = 'countPulse 0.6s ease-out';
                CGameAudio.play('countdown');
            } else if (count === 0) {
                countdownNumber.textContent = 'GO!';
                countdownNumber.style.animation = 'none'; void countdownNumber.offsetWidth;
                countdownNumber.style.animation = 'countPulse 0.6s ease-out';
                CGameAudio.play('hit');
            } else { clearInterval(iv); countdownOverlay.classList.add('hidden'); cb(); }
        }, 800);
    }

    function startRound() {
        setupRound(); draw();
        startCountdown(function () {
            gameRunning = true; paused = false;
            lastTime = performance.now();
            animId = requestAnimationFrame(gameLoop);
        });
    }

    function endRound() {
        gameRunning = false;
        if (animId) { cancelAnimationFrame(animId); animId = null; }
        roundOverlay.classList.add('hidden');

        if (gameMode === 'story') {
            /* story = game over */
            document.getElementById('gameover-title').textContent = 'Game Over';
            document.getElementById('gameover-title').style.color = css('--accent');
            document.getElementById('gameover-sub').textContent = 'Score: ' + storyScore + '  |  Kills: ' + storyKills;
            document.getElementById('gameover-icon').textContent = '\u{1F480}';
            CGameAudio.play('lose');
            GameShell.showScreen('gameover-screen');
        } else {
            /* local mode rounds */
            if (roundWinnerIdx >= 0) {
                roundScores[roundWinnerIdx]++;
                scoreP1El.textContent = roundScores[0];
                scoreP2El.textContent = roundScores[1];
            }
            if (roundScores[0] >= ROUNDS_TO_WIN || roundScores[1] >= ROUNDS_TO_WIN) {
                var w = roundScores[0] >= ROUNDS_TO_WIN ? 0 : 1;
                document.getElementById('gameover-title').textContent = 'Player ' + (w + 1) + ' Wins!';
                document.getElementById('gameover-title').style.color = css(w === 0 ? '--p1-color' : '--p2-color');
                document.getElementById('gameover-sub').textContent = roundScores[0] + ' - ' + roundScores[1];
                document.getElementById('gameover-icon').textContent = '\u{1F3C6}';
                CGameAudio.play('win');
                GameShell.showScreen('gameover-screen');
            } else {
                startRound();
            }
        }
    }

    function startMatch(mode) {
        gameMode = mode;
        roundScores = [0, 0]; currentRound = 0;
        scoreP1El.textContent = '0'; scoreP2El.textContent = '0';
        GameShell.showScreen('game-screen');
        resizeCanvas();
        startRound();
    }

    /* ========== CANVAS RESIZE ========== */
    function resizeCanvas() {
        if (!canvasContainer || !canvas) return;
        var rect = canvasContainer.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        W = rect.width; H = rect.height;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ========== INIT ========== */
    function init() {
        GameShell.init({ backUrl: '../' });
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        canvasContainer = document.getElementById('canvas-container');
        p1HealthEl = document.getElementById('p1-health');
        p2HealthEl = document.getElementById('p2-health');
        healthVsEl = document.getElementById('health-vs');
        scoreP1El = document.getElementById('score-p1');
        scoreP2El = document.getElementById('score-p2');
        roundInfoEl = document.getElementById('round-info');
        countdownOverlay = document.getElementById('countdown-overlay');
        countdownNumber = document.getElementById('countdown-number');
        pauseOverlay = document.getElementById('pause-overlay');
        roundOverlay = document.getElementById('round-overlay');
        roundResultEl = document.getElementById('round-result');
        localOptionsEl = document.getElementById('local-options');

        document.addEventListener('keydown', function (e) {
            var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            keys[key] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) !== -1) e.preventDefault();
            if (e.key === 'Escape' && gameRunning) togglePause();
        });
        document.addEventListener('keyup', function (e) {
            var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            keys[key] = false;
        });

        /* Title screen buttons */
        document.getElementById('btn-story').addEventListener('click', function () {
            CGameAudio.play('select');
            localOptionsEl.classList.add('hidden');
            startMatch('story');
        });
        document.getElementById('btn-local').addEventListener('click', function () {
            CGameAudio.play('click');
            localOptionsEl.classList.toggle('hidden');
        });
        document.getElementById('btn-local-2p').addEventListener('click', function () {
            CGameAudio.play('select'); startMatch('local2p');
        });
        document.getElementById('btn-local-ai').addEventListener('click', function () {
            CGameAudio.play('select'); startMatch('localai');
        });

        /* Game screen buttons */
        document.getElementById('btn-back-game').addEventListener('click', function () { if (gameRunning) togglePause(); });
        document.getElementById('btn-pause').addEventListener('click', function () { if (gameRunning) togglePause(); });
        document.getElementById('btn-resume').addEventListener('click', togglePause);
        document.getElementById('btn-quit').addEventListener('click', function () {
            gameRunning = false; paused = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
            pauseOverlay.classList.add('hidden');
            GameShell.showScreen('title-screen');
        });

        /* Game over buttons */
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('select'); startMatch(gameMode);
        });
        document.getElementById('btn-go-menu').addEventListener('click', function () {
            CGameAudio.play('click'); GameShell.showScreen('title-screen');
        });

        window.addEventListener('resize', resizeCanvas);
    }

    function togglePause() {
        paused = !paused;
        if (paused) pauseOverlay.classList.remove('hidden');
        else { pauseOverlay.classList.add('hidden'); lastTime = performance.now(); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
