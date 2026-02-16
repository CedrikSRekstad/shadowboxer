// ============================================================
// SHADOW FIGHTER - Street Fighter Style 2P Fighting Game
// ============================================================

// ===== CONSTANTS =====
const CANVAS_BG = '#0d0d1a';
const MAX_HP = 100;
const MOVE_SPEED = 3;
const ARENA_TOP_MARGIN = 0.1;
const ARENA_BOTTOM_MARGIN = 0.9;
const CLOSE_RANGE = 95;          // grapple range
const DOUBLE_TAP_MS = 300;
const HOLD_MS = 350;

// Combat ranges - how far away you can hit
const RANGE = {
    punch: 120,
    kick: 150,
    grapple: 95,
};

// Damage values
const DMG = {
    punch: 8,
    kick: 14,
    counter: 12,
    grapple: 10,
    grapplePunch: 8,
    grappleKick: 14,
};

// Cooldowns (ms)
const COOLDOWN = {
    punch: 500,
    kick: 900,
    counter: 600,
    dodge: 500,
    block: 100,
    grapple: 1000,
};

// Animation durations (ms)
const ANIM_DURATION = {
    punch: 300,
    kick: 450,
    counter: 400,
    dodge: 350,
    block: 0,
    grapple: 500,
    hit: 300,
    groundRace: 2000,
};

// ===== VISUAL EFFECTS STATE =====
const vfx = {
    particles: [],
    impactLines: [],
    screenShakeTimer: 0,
    hitFreezeTimer: 0,     // hit-stop / freeze frame
    slowMoTimer: 0,
    slowMoFactor: 1,
};

// ===== GAME STATE =====
const game = {
    screen: 'title',
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    players: [],
    announcement: { text: '', timer: 0 },
    groundRace: null,
    buttonCooldowns: {},
    time: 0,
};

// ===== PLAYER FACTORY =====
function createPlayer(id) {
    return {
        id,
        hp: MAX_HP,
        x: 0,
        y: 0,
        facing: id === 1 ? -1 : 1,
        state: 'idle',
        prevState: 'idle',
        stateTimer: 0,
        stateMaxTimer: 0,
        cooldowns: {},
        lastTapTime: { attack: 0, dodge: 0 },
        lastTapAction: { attack: null, dodge: null },
        holdStart: { dodge: 0 },
        isHolding: { dodge: false },
        isBlocking: false,
        counterWindow: false,
        hitStun: false,
        hitStunTimer: 0,
        animFrame: 0,
        animTimer: 0,
        flashTimer: 0,
        // Idle animation
        breathePhase: Math.random() * Math.PI * 2,
        swayPhase: Math.random() * Math.PI * 2,
        bobPhase: Math.random() * Math.PI * 2,
        // Smooth animation interpolation
        blendTimer: 0,
        blendDuration: 120,
        prevPose: null,
        currentPose: null,
    };
}

// ===== INITIALIZATION =====
function init() {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');

    document.querySelectorAll('.attack-btn, .dodge-btn, .grapple-btn').forEach(btn => {
        const fill = document.createElement('div');
        fill.classList.add('cooldown-fill');
        btn.appendChild(fill);
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    document.getElementById('start-btn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); });
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('rematch-btn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); });
    document.getElementById('rematch-btn').addEventListener('click', startGame);
    document.getElementById('menu-btn').addEventListener('touchstart', (e) => { e.preventDefault(); showTitle(); });
    document.getElementById('menu-btn').addEventListener('click', showTitle);

    setupControls();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const canvas = game.canvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    game.width = canvas.width;
    game.height = canvas.height;
    // Regenerate crowd positions for new size
    if (game.width > 0 && game.height > 0) {
        generateCrowd(game.width, game.height);
    }
}

function startGame() {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    requestAnimationFrame(() => {
        resizeCanvas();
        resetPlayers();
        game.screen = 'playing';
        game.groundRace = null;
        vfx.particles = [];
        vfx.impactLines = [];
        showAnnouncement('FIGHT!', 1000);
    });
}

function showTitle() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    game.screen = 'title';
}

function resetPlayers() {
    const p1 = createPlayer(1);
    const p2 = createPlayer(2);
    const centerX = game.width / 2;
    p1.x = centerX;
    p1.y = game.height * 0.75;
    p2.x = centerX;
    p2.y = game.height * 0.25;
    game.players = [p1, p2];
    updateHealthBars();
    clearAllCooldownVisuals();
}

// ===== VFX FUNCTIONS =====
function screenShake(intensity) {
    vfx.screenShakeTimer = 150;
    const gs = document.getElementById('game-screen');
    gs.classList.remove('shake');
    void gs.offsetWidth; // reflow
    gs.classList.add('shake');
    setTimeout(() => gs.classList.remove('shake'), 200);
}

function hitFlash(type) {
    const el = document.getElementById('hit-flash');
    el.className = type === 'big' ? 'flash-white' : 'flash-red';
    setTimeout(() => { el.className = ''; }, 80);
}

function hitFreeze(ms) {
    vfx.hitFreezeTimer = ms;
}

function spawnImpactParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        vfx.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 300 + Math.random() * 300,
            maxLife: 300 + Math.random() * 300,
            size: 2 + Math.random() * 4,
            color,
            type: 'spark',
        });
    }
}

function spawnImpactLines(x, y, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const len = 15 + Math.random() * 30;
        vfx.impactLines.push({
            x, y, angle, len,
            life: 200 + Math.random() * 100,
            maxLife: 200 + Math.random() * 100,
        });
    }
}

function spawnComicText(x, y, text) {
    vfx.particles.push({
        x, y: y - 15,
        vx: (Math.random() - 0.5) * 2,
        vy: -2,
        life: 600,
        maxLife: 600,
        text,
        type: 'comicText',
        size: 16 + Math.random() * 8,
        rotation: (Math.random() - 0.5) * 0.4,
    });
}

// ===== COOLDOWN VISUALS =====
function startCooldownVisual(playerNum, actionType, durationMs) {
    let selector;
    if (actionType === 'punch' || actionType === 'kick') selector = '.attack-btn';
    else if (actionType === 'dodge' || actionType === 'counter' || actionType === 'block') selector = '.dodge-btn';
    else if (actionType === 'grapple') selector = '.grapple-btn';
    else return;

    const controls = document.getElementById(`p${playerNum}-controls`);
    const btn = controls.querySelector(selector);
    if (!btn) return;

    btn.classList.add('on-cooldown');
    const fill = btn.querySelector('.cooldown-fill');
    const startTime = Date.now();
    const key = `p${playerNum}-${actionType}`;

    if (game.buttonCooldowns[key]) clearInterval(game.buttonCooldowns[key]);

    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, (elapsed / durationMs) * 100);
        if (fill) fill.style.height = pct + '%';
        if (elapsed >= durationMs) {
            clearInterval(interval);
            btn.classList.remove('on-cooldown');
            if (fill) fill.style.height = '0%';
        }
    }, 30);

    game.buttonCooldowns[key] = interval;
}

function clearAllCooldownVisuals() {
    Object.values(game.buttonCooldowns).forEach(interval => clearInterval(interval));
    game.buttonCooldowns = {};
    document.querySelectorAll('.ctrl-btn').forEach(btn => {
        btn.classList.remove('on-cooldown');
        const fill = btn.querySelector('.cooldown-fill');
        if (fill) fill.style.height = '0%';
    });
}

// ===== INPUT SYSTEM =====
function setupControls() {
    const buttons = document.querySelectorAll('.ctrl-btn');
    buttons.forEach(btn => {
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleButtonDown(btn); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); handleButtonUp(btn); });
        btn.addEventListener('touchcancel', (e) => { e.preventDefault(); handleButtonUp(btn); });
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); handleButtonDown(btn); });
        btn.addEventListener('mouseup', (e) => { e.preventDefault(); handleButtonUp(btn); });
        btn.addEventListener('mouseleave', () => { handleButtonUp(btn); });
    });
}

function handleButtonDown(btn) {
    const playerNum = parseInt(btn.dataset.player);
    const action = btn.dataset.action;
    const player = game.players[playerNum - 1];
    if (!player) return;
    const now = Date.now();

    if (action === 'up' || action === 'down') {
        handleMovement(player, action);
        btn._moveInterval = setInterval(() => handleMovement(player, action), 50);
        return;
    }

    if (action === 'dodge') {
        player.holdStart.dodge = now;
        player.isHolding.dodge = false;
        btn._holdTimeout = setTimeout(() => {
            player.isHolding.dodge = true;
            executeAction(player, 'block');
        }, HOLD_MS);
    }

    if (action === 'attack' || action === 'dodge') {
        const timeSinceLast = now - player.lastTapTime[action];
        if (timeSinceLast < DOUBLE_TAP_MS && player.lastTapAction[action] === action) {
            player.lastTapAction[action] = null;
            if (btn._holdTimeout) { clearTimeout(btn._holdTimeout); btn._holdTimeout = null; }
            if (btn._singleTapTimeout) { clearTimeout(btn._singleTapTimeout); btn._singleTapTimeout = null; }
            if (action === 'attack') {
                executeAction(player, 'kick');
            } else if (action === 'dodge') {
                player.isHolding.dodge = false;
                executeAction(player, 'counter');
            }
        } else {
            player.lastTapTime[action] = now;
            player.lastTapAction[action] = action;
            btn._singleTapTimeout = setTimeout(() => {
                if (player.lastTapAction[action] === action) {
                    player.lastTapAction[action] = null;
                    if (action === 'attack') {
                        executeAction(player, 'punch');
                    } else if (action === 'dodge' && !player.isHolding.dodge) {
                        if (btn._holdTimeout) { clearTimeout(btn._holdTimeout); btn._holdTimeout = null; }
                        executeAction(player, 'dodge');
                    }
                }
            }, DOUBLE_TAP_MS);
        }
    }

    if (action === 'grapple') {
        executeAction(player, 'grapple');
    }
}

function handleButtonUp(btn) {
    const playerNum = parseInt(btn.dataset.player);
    const action = btn.dataset.action;
    const player = game.players[playerNum - 1];
    if (!player) return;

    if (action === 'up' || action === 'down') {
        if (btn._moveInterval) { clearInterval(btn._moveInterval); btn._moveInterval = null; }
        return;
    }
    if (action === 'dodge') {
        if (btn._holdTimeout) { clearTimeout(btn._holdTimeout); btn._holdTimeout = null; }
        if (player.isHolding.dodge) {
            player.isHolding.dodge = false;
            player.isBlocking = false;
            if (player.state === 'blocking') player.state = 'idle';
        }
    }
}

function handleMovement(player, direction) {
    if (game.screen !== 'playing') return;
    if (player.state === 'hit' || player.state === 'grounded' || player.state === 'grappling') return;
    const moveDir = direction === 'up' ? -1 : 1;
    player.y += moveDir * MOVE_SPEED;
    const minY = game.height * ARENA_TOP_MARGIN;
    const maxY = game.height * ARENA_BOTTOM_MARGIN;
    player.y = Math.max(minY, Math.min(maxY, player.y));
}

// ===== ACTION EXECUTION =====
function executeAction(player, action) {
    if (game.screen === 'groundRace') {
        handleGroundRaceInput(player, action);
        return;
    }
    if (game.screen !== 'playing') return;
    if (player.state === 'hit' || player.state === 'grounded' || player.state === 'grappling') return;
    if (player.hitStun && (action === 'punch' || action === 'kick')) return;
    if (player.cooldowns[action] && Date.now() < player.cooldowns[action]) return;
    if (player.state !== 'idle' && player.state !== 'blocking') {
        if (player.hitStun && (action === 'counter' || action === 'dodge' || action === 'block')) {
            // allow defensive actions during hitstun
        } else {
            return;
        }
    }

    const opponent = getOpponent(player);

    switch (action) {
        case 'punch':
            setPlayerState(player, 'punching', ANIM_DURATION.punch);
            player.cooldowns.punch = Date.now() + COOLDOWN.punch;
            startCooldownVisual(player.id, 'punch', COOLDOWN.punch);
            setTimeout(() => resolveMeleeHit(player, opponent, 'punch'), 100);
            break;
        case 'kick':
            setPlayerState(player, 'kicking', ANIM_DURATION.kick);
            player.cooldowns.kick = Date.now() + COOLDOWN.kick;
            startCooldownVisual(player.id, 'kick', COOLDOWN.kick);
            setTimeout(() => resolveMeleeHit(player, opponent, 'kick'), 200);
            break;
        case 'counter':
            setPlayerState(player, 'countering', ANIM_DURATION.counter);
            player.counterWindow = true;
            player.cooldowns.counter = Date.now() + COOLDOWN.counter;
            startCooldownVisual(player.id, 'counter', COOLDOWN.counter);
            setTimeout(() => { player.counterWindow = false; }, ANIM_DURATION.counter);
            break;
        case 'dodge':
            setPlayerState(player, 'dodging', ANIM_DURATION.dodge);
            player.cooldowns.dodge = Date.now() + COOLDOWN.dodge;
            startCooldownVisual(player.id, 'dodge', COOLDOWN.dodge);
            const awayDir = player.id === 1 ? 1 : -1;
            player.y += awayDir * 40;
            const minY = game.height * ARENA_TOP_MARGIN;
            const maxY = game.height * ARENA_BOTTOM_MARGIN;
            player.y = Math.max(minY, Math.min(maxY, player.y));
            break;
        case 'block':
            setPlayerState(player, 'blocking');
            player.isBlocking = true;
            break;
        case 'grapple': {
            const dist = Math.abs(player.y - opponent.y);
            if (dist > RANGE.grapple) {
                showAnnouncement('Too far!', 500);
                return;
            }
            setPlayerState(player, 'grappling', ANIM_DURATION.grapple);
            player.cooldowns.grapple = Date.now() + COOLDOWN.grapple;
            startCooldownVisual(player.id, 'grapple', COOLDOWN.grapple);
            setTimeout(() => resolveGrapple(player, opponent), 250);
            break;
        }
    }
}

// ===== COMBAT RESOLUTION =====
function resolveMeleeHit(attacker, defender, type) {
    if (attacker.state !== (type === 'punch' ? 'punching' : 'kicking')) return;
    const dist = Math.abs(attacker.y - defender.y);
    if (dist > RANGE[type]) return;

    const midX = (attacker.x + defender.x) / 2;
    const midY = (attacker.y + defender.y) / 2;

    if (defender.state === 'dodging') return;

    if (defender.counterWindow) {
        const counterDmg = DMG[type] + DMG.counter;
        applyDamage(attacker, counterDmg);
        attacker.state = 'hit';
        attacker.stateTimer = ANIM_DURATION.hit;
        attacker.hitStun = true;
        attacker.hitStunTimer = ANIM_DURATION.hit + 200;
        defender.counterWindow = false;
        defender.state = 'idle';
        // Big counter VFX
        screenShake(6);
        hitFlash('big');
        hitFreeze(100);
        spawnImpactParticles(midX, midY, '#ffff00', 15);
        spawnImpactLines(midX, midY, 8);
        spawnComicText(midX, midY, 'COUNTER!');
        showAnnouncement('COUNTER!', 600);
        return;
    }

    if (defender.isBlocking) {
        const reduced = Math.floor(DMG[type] * 0.3);
        applyDamage(defender, reduced);
        attacker.hitStun = true;
        attacker.hitStunTimer = 300;
        spawnImpactParticles(midX, midY, '#00aaff', 6);
        spawnComicText(midX, midY, 'BLOCK!');
        showAnnouncement('BLOCKED!', 400);
        return;
    }

    // Clean hit!
    applyDamage(defender, DMG[type]);
    defender.state = 'hit';
    defender.stateTimer = ANIM_DURATION.hit;
    defender.hitStun = true;
    defender.hitStunTimer = ANIM_DURATION.hit + 200;

    // Hit VFX
    screenShake(3);
    hitFlash(type === 'kick' ? 'big' : 'small');
    hitFreeze(type === 'kick' ? 80 : 50);
    const hitColor = type === 'punch' ? '#ffaa00' : '#ff4444';
    spawnImpactParticles(midX, midY, hitColor, type === 'kick' ? 12 : 8);
    spawnImpactLines(midX, midY, type === 'kick' ? 6 : 4);
    spawnComicText(midX, midY, type === 'punch' ? 'POW!' : 'WHAM!');
    showAnnouncement(type === 'punch' ? 'PUNCH!' : 'KICK!', 400);
}

function resolveGrapple(attacker, defender) {
    if (attacker.state !== 'grappling') return;
    const dist = Math.abs(attacker.y - defender.y);
    if (dist > RANGE.grapple + 15) return;

    const midX = (attacker.x + defender.x) / 2;
    const midY = (attacker.y + defender.y) / 2;

    applyDamage(defender, DMG.grapple);
    defender.state = 'grounded';
    attacker.state = 'idle';

    screenShake(5);
    hitFlash('big');
    hitFreeze(80);
    spawnImpactParticles(midX, midY, '#ffa500', 12);
    spawnImpactLines(midX, midY, 6);
    spawnComicText(midX, midY, 'GRAB!');
    showAnnouncement('GRAPPLE!', 600);

    setTimeout(() => startGroundRace(attacker, defender), 400);
}

function startGroundRace(attacker, defender) {
    game.screen = 'groundRace';
    game.groundRace = {
        attacker: attacker.id,
        defender: defender.id,
        attackerInput: null,
        defenderInput: null,
        timer: ANIM_DURATION.groundRace,
        resolved: false,
    };
    showAnnouncement('GROUND FIGHT!', 800);
}

function handleGroundRaceInput(player, action) {
    if (!game.groundRace || game.groundRace.resolved) return;
    const gr = game.groundRace;
    if (player.id === gr.attacker && (action === 'punch' || action === 'kick')) {
        gr.attackerInput = action;
    } else if (player.id === gr.defender && (action === 'dodge' || action === 'counter')) {
        gr.defenderInput = action;
    }
    if (gr.attackerInput && gr.defenderInput) resolveGroundRace();
}

function resolveGroundRace() {
    const gr = game.groundRace;
    if (gr.resolved) return;
    gr.resolved = true;

    const attacker = game.players[gr.attacker - 1];
    const defender = game.players[gr.defender - 1];
    const midX = (attacker.x + defender.x) / 2;
    const midY = (attacker.y + defender.y) / 2;

    if (gr.attackerInput && !gr.defenderInput) {
        const bonusDmg = gr.attackerInput === 'punch' ? DMG.grapplePunch : DMG.grappleKick;
        applyDamage(defender, bonusDmg);
        screenShake(4);
        hitFlash('big');
        spawnImpactParticles(midX, midY, '#ff4444', 10);
        spawnComicText(midX, midY, 'SMASH!');
        showAnnouncement('FOLLOW-UP HIT!', 800);
    } else if (gr.defenderInput && !gr.attackerInput) {
        spawnComicText(midX, midY, 'ESCAPE!');
        showAnnouncement('ESCAPED!', 800);
    } else if (gr.attackerInput && gr.defenderInput) {
        if (gr.defenderInput === 'counter') {
            applyDamage(attacker, DMG.counter);
            screenShake(5);
            hitFlash('big');
            spawnImpactParticles(midX, midY, '#ffff00', 12);
            spawnComicText(midX, midY, 'REVERSAL!');
            showAnnouncement('GROUND COUNTER!', 800);
        } else {
            spawnComicText(midX, midY, 'MISS!');
            showAnnouncement('DODGED!', 800);
        }
    } else {
        showAnnouncement('BREAK!', 800);
    }

    setTimeout(() => {
        defender.state = 'idle';
        defender.hitStun = false;
        attacker.state = 'idle';
        game.groundRace = null;
        game.screen = 'playing';
        const centerY = (attacker.y + defender.y) / 2;
        attacker.y = centerY + (attacker.id === 1 ? 40 : -40);
        defender.y = centerY + (defender.id === 1 ? 40 : -40);
    }, 600);
}

function applyDamage(player, amount) {
    player.hp = Math.max(0, player.hp - amount);
    player.flashTimer = 150;
    updateHealthBars();
    if (player.hp <= 0) endGame(getOpponent(player));
}

function endGame(winner) {
    game.screen = 'gameover';
    screenShake(8);
    hitFlash('big');
    setTimeout(() => {
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.remove('hidden');
        document.getElementById('winner-text').textContent = `PLAYER ${winner.id} WINS!`;
    }, 500);
}

// ===== HELPERS =====
function setPlayerState(player, newState, duration) {
    if (player.state !== newState) {
        player.prevState = player.state;
        player.prevPose = player.currentPose ? { ...player.currentPose } : null;
        player.blendTimer = player.blendDuration;
    }
    player.state = newState;
    if (duration !== undefined) {
        player.stateTimer = duration;
        player.stateMaxTimer = duration;
    }
}

function getOpponent(player) {
    return game.players[player.id === 1 ? 1 : 0];
}

function showAnnouncement(text, duration) {
    game.announcement.text = text;
    game.announcement.timer = duration;
    const el = document.getElementById('announcement');
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
}

function updateHealthBars() {
    if (game.players.length < 2) return;
    document.getElementById('p1-health-bar').style.width = (game.players[0].hp / MAX_HP * 100) + '%';
    document.getElementById('p2-health-bar').style.width = (game.players[1].hp / MAX_HP * 100) + '%';
}

// ===== GAME LOOP =====
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (game.screen === 'playing' || game.screen === 'groundRace') {
        // Hit freeze: skip update but still render
        if (vfx.hitFreezeTimer > 0) {
            vfx.hitFreezeTimer -= dt;
            render();
        } else {
            update(dt);
            render();
        }
    }

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    game.time += dt;

    if (game.announcement.timer > 0) {
        game.announcement.timer -= dt;
        if (game.announcement.timer <= 0) {
            document.getElementById('announcement').classList.add('hidden');
        }
    }

    if (game.screen === 'groundRace' && game.groundRace && !game.groundRace.resolved) {
        game.groundRace.timer -= dt;
        if (game.groundRace.timer <= 0) resolveGroundRace();
    }

    // Update players
    for (const player of game.players) {
        const oldState = player.state;
        if (player.stateTimer > 0) {
            player.stateTimer -= dt;
            if (player.stateTimer <= 0 && player.state !== 'blocking' && player.state !== 'grounded') {
                player.state = 'idle';
            }
        }
        // Track state changes for smooth blending
        if (player.state !== oldState) {
            player.prevState = oldState;
            player.prevPose = player.currentPose ? { ...player.currentPose } : null;
            player.blendTimer = player.blendDuration;
        }
        if (player.blendTimer > 0) player.blendTimer -= dt;
        if (player.hitStun && player.hitStunTimer > 0) {
            player.hitStunTimer -= dt;
            if (player.hitStunTimer <= 0) player.hitStun = false;
        }
        if (player.flashTimer > 0) player.flashTimer -= dt;

        player.animTimer += dt;
        if (player.animTimer > 80) {
            player.animTimer = 0;
            player.animFrame++;
        }

        // Idle animation phases advance continuously
        player.breathePhase += dt * 0.003;
        player.swayPhase += dt * 0.002;
        player.bobPhase += dt * 0.004;
    }

    // Update particles
    vfx.particles = vfx.particles.filter(p => {
        p.life -= dt;
        if (p.type === 'spark') {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // gravity
        }
        if (p.type === 'comicText') {
            p.x += p.vx;
            p.y += p.vy;
        }
        return p.life > 0;
    });

    // Update impact lines
    vfx.impactLines = vfx.impactLines.filter(l => {
        l.life -= dt;
        return l.life > 0;
    });
}

// ===== RENDERING =====
function render() {
    const ctx = game.ctx;
    const w = game.width;
    const h = game.height;

    // Draw full street background
    drawStreetBackground(ctx, w, h);

    // Close range indicator
    if (game.players.length === 2) {
        const dist = Math.abs(game.players[0].y - game.players[1].y);
        if (dist <= CLOSE_RANGE + 20) {
            const midY = (game.players[0].y + game.players[1].y) / 2;
            const intensity = 1 - (dist / (CLOSE_RANGE + 20));
            ctx.save();
            ctx.strokeStyle = `rgba(255, 165, 0, ${intensity * 0.3})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(w * 0.15, midY);
            ctx.lineTo(w * 0.85, midY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    // Draw impact lines (behind players)
    drawImpactLines(ctx);

    // Draw crowd behind players
    drawCrowd(ctx, w, h, 'back');

    // Draw players
    for (const player of game.players) {
        drawComicFighter(ctx, player);
    }

    // Draw crowd in front of players (foreground layer)
    drawCrowd(ctx, w, h, 'front');

    // Draw particles (in front of everything)
    drawParticles(ctx);

    // Ground race UI
    if (game.screen === 'groundRace' && game.groundRace && !game.groundRace.resolved) {
        drawGroundRaceUI(ctx, w, h);
    }
}

// ===== STREET BACKGROUND =====
function drawStreetBackground(ctx, w, h) {
    // --- SUNSET SKY ---
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    skyGrad.addColorStop(0, '#1a0533');    // deep purple top
    skyGrad.addColorStop(0.3, '#4a1942');  // purple
    skyGrad.addColorStop(0.55, '#c84b31'); // burnt orange
    skyGrad.addColorStop(0.8, '#ecab5e');  // golden
    skyGrad.addColorStop(1, '#f5d5a0');    // pale yellow horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Sun glow on horizon
    const sunY = h * 0.3;
    const sunGrad = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, w * 0.4);
    sunGrad.addColorStop(0, 'rgba(255, 200, 80, 0.4)');
    sunGrad.addColorStop(0.5, 'rgba(255, 140, 50, 0.15)');
    sunGrad.addColorStop(1, 'rgba(255, 100, 50, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h * 0.5);

    // --- BUILDINGS (left side) ---
    drawBuilding(ctx, -5, h * 0.05, w * 0.22, h * 0.95, '#1a1225', '#251a30', w, h, 'left');

    // --- BUILDINGS (right side) ---
    drawBuilding(ctx, w * 0.78, h * 0.1, w * 0.27, h * 0.9, '#1a1225', '#251a30', w, h, 'right');

    // --- ASPHALT STREET (fills middle) ---
    const streetLeft = w * 0.18;
    const streetRight = w * 0.82;
    const streetW = streetRight - streetLeft;

    // Asphalt base
    const asphaltGrad = ctx.createLinearGradient(0, 0, 0, h);
    asphaltGrad.addColorStop(0, '#2a2a30');
    asphaltGrad.addColorStop(0.5, '#333338');
    asphaltGrad.addColorStop(1, '#2a2a30');
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(streetLeft, 0, streetW, h);

    // Asphalt texture - small speckles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 80; i++) {
        const sx = streetLeft + Math.random() * streetW;
        const sy = Math.random() * h;
        ctx.fillRect(sx, sy, 2, 2);
    }

    // Center line (dashed yellow)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 18]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Cracks in asphalt
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    drawCrack(ctx, streetLeft + streetW * 0.3, h * 0.2, 30, 0.5);
    drawCrack(ctx, streetLeft + streetW * 0.7, h * 0.6, 25, -0.3);
    drawCrack(ctx, streetLeft + streetW * 0.5, h * 0.8, 20, 0.8);

    // Manhole cover
    const manholeY = h * 0.45;
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 80, 90, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, manholeY, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, manholeY);
    ctx.lineTo(w / 2 + 8, manholeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, manholeY - 8);
    ctx.lineTo(w / 2, manholeY + 8);
    ctx.stroke();
    ctx.restore();

    // Curb / sidewalk edges
    ctx.fillStyle = 'rgba(100, 95, 85, 0.3)';
    ctx.fillRect(streetLeft - 3, 0, 3, h);
    ctx.fillRect(streetRight, 0, 3, h);

    // Sunset light reflection on street
    const reflectGrad = ctx.createLinearGradient(0, 0, 0, h);
    reflectGrad.addColorStop(0, 'rgba(255, 150, 50, 0.06)');
    reflectGrad.addColorStop(0.5, 'rgba(255, 100, 30, 0.03)');
    reflectGrad.addColorStop(1, 'rgba(200, 80, 30, 0.06)');
    ctx.fillStyle = reflectGrad;
    ctx.fillRect(streetLeft, 0, streetW, h);
}

function drawBuilding(ctx, x, y, w, h, darkColor, lightColor, canvasW, canvasH, side) {
    const outlineW = 2;

    // Main building shape
    ctx.fillStyle = darkColor;
    ctx.strokeStyle = '#0d0a15';
    ctx.lineWidth = outlineW;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Building highlight edge (sunset light)
    if (side === 'left') {
        ctx.fillStyle = 'rgba(255, 140, 60, 0.08)';
        ctx.fillRect(x + w - 8, y, 8, h);
    } else {
        ctx.fillStyle = 'rgba(255, 140, 60, 0.08)';
        ctx.fillRect(x, y, 8, h);
    }

    // Windows
    const winW = 10;
    const winH = 14;
    const winGapX = 16;
    const winGapY = 22;
    const winStartX = side === 'left' ? x + 6 : x + 5;
    const winStartY = y + 10;
    const cols = Math.floor((w - 10) / winGapX);
    const rows = Math.floor((h - 20) / winGapY);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const wx = winStartX + col * winGapX;
            const wy = winStartY + row * winGapY;

            // Some windows are lit (warm yellow/orange), some are dark
            const lit = Math.sin(wx * 13 + wy * 7) > 0.1; // deterministic random

            if (lit) {
                const warmth = (Math.sin(wx * 3 + wy * 5) + 1) / 2;
                const r = 255;
                const g = Math.floor(180 + warmth * 60);
                const b = Math.floor(80 + warmth * 40);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
                ctx.fillRect(wx, wy, winW, winH);
                // Window glow
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
                ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);
            } else {
                ctx.fillStyle = 'rgba(20, 18, 30, 0.8)';
                ctx.fillRect(wx, wy, winW, winH);
            }

            // Window frame
            ctx.strokeStyle = 'rgba(60, 55, 70, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, winW, winH);
        }
    }

    // Some windows have people silhouettes
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const wx = winStartX + col * winGapX;
            const wy = winStartY + row * winGapY;
            const hasPerson = Math.sin(wx * 7 + wy * 11) > 0.6;
            const lit = Math.sin(wx * 13 + wy * 7) > 0.1;

            if (hasPerson && lit) {
                // Tiny person silhouette in window
                ctx.fillStyle = 'rgba(30, 20, 40, 0.6)';
                const px = wx + winW / 2;
                const py = wy + winH - 3;
                // Head
                ctx.beginPath();
                ctx.arc(px, py - 6, 2, 0, Math.PI * 2);
                ctx.fill();
                // Body
                ctx.fillRect(px - 2, py - 4, 4, 5);
            }
        }
    }

    // Roof edge
    ctx.fillStyle = '#15101f';
    ctx.fillRect(x - 2, y - 3, w + 4, 5);

    // Fire escape on one side (if left building)
    if (side === 'left' && w > 30) {
        ctx.strokeStyle = 'rgba(80, 75, 90, 0.3)';
        ctx.lineWidth = 1;
        for (let fy = y + 30; fy < y + h; fy += 45) {
            // Platform
            ctx.beginPath();
            ctx.moveTo(x + w - 2, fy);
            ctx.lineTo(x + w + 8, fy);
            ctx.stroke();
            // Railing
            ctx.beginPath();
            ctx.moveTo(x + w + 8, fy);
            ctx.lineTo(x + w + 8, fy - 12);
            ctx.stroke();
            // Ladder
            ctx.beginPath();
            ctx.moveTo(x + w + 3, fy);
            ctx.lineTo(x + w + 3, fy + 45);
            ctx.stroke();
        }
    }
}

function drawCrack(ctx, startX, startY, length, angle) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let cx = startX;
    let cy = startY;
    for (let i = 0; i < length; i += 4) {
        cx += Math.cos(angle) * 4 + (Math.sin(i * 2) * 2);
        cy += Math.sin(angle) * 4 + (Math.cos(i * 3) * 1.5);
        ctx.lineTo(cx, cy);
    }
    ctx.stroke();
}

// ===== CROWD / SPECTATORS =====
// Pre-generate crowd positions so they don't change each frame
const crowdPeople = [];
function generateCrowd(w, h) {
    crowdPeople.length = 0;
    const streetLeft = w * 0.18;
    const streetRight = w * 0.82;

    // Left side crowd (on sidewalk)
    for (let i = 0; i < 8; i++) {
        crowdPeople.push({
            x: streetLeft - 12 + Math.sin(i * 4) * 8,
            y: h * 0.15 + i * (h * 0.09),
            side: 'left',
            layer: i % 2 === 0 ? 'back' : 'front',
            color: ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#d62828', '#6a4c93'][i],
            height: 16 + Math.sin(i * 3) * 4,
            headR: 4 + Math.sin(i * 5) * 1,
            cheering: Math.sin(i * 7) > 0,
            bobPhase: i * 1.3,
        });
    }

    // Right side crowd
    for (let i = 0; i < 8; i++) {
        crowdPeople.push({
            x: streetRight + 12 + Math.sin(i * 5) * 8,
            y: h * 0.12 + i * (h * 0.09),
            side: 'right',
            layer: i % 2 === 0 ? 'back' : 'front',
            color: ['#6a4c93', '#d62828', '#f4a261', '#264653', '#e9c46a', '#2a9d8f', '#457b9d', '#e63946'][i],
            height: 16 + Math.cos(i * 2) * 4,
            headR: 4 + Math.cos(i * 3) * 1,
            cheering: Math.cos(i * 7) > 0,
            bobPhase: i * 1.7,
        });
    }
}

function drawCrowd(ctx, w, h, layer) {
    // Generate crowd if empty or canvas resized
    if (crowdPeople.length === 0) generateCrowd(w, h);

    const t = game.time * 0.003; // for animation

    for (const p of crowdPeople) {
        if (p.layer !== layer) continue;

        const bob = p.cheering ? Math.sin(t + p.bobPhase) * 3 : Math.sin(t * 0.5 + p.bobPhase) * 1;
        const armWave = p.cheering ? Math.sin(t * 3 + p.bobPhase) * 8 : 0;

        ctx.save();

        // Body
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;

        const bx = p.x;
        const by = p.y + bob;
        const bodyH = p.height;

        // Torso
        ctx.beginPath();
        ctx.moveTo(bx - 5, by);
        ctx.lineTo(bx + 5, by);
        ctx.lineTo(bx + 6, by + bodyH);
        ctx.lineTo(bx - 6, by + bodyH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Head
        ctx.fillStyle = '#e8c4a0';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by - p.headR - 1, p.headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes (tiny dots)
        ctx.fillStyle = '#111';
        ctx.fillRect(bx - 2, by - p.headR - 2, 1.5, 1.5);
        ctx.fillRect(bx + 1, by - p.headR - 2, 1.5, 1.5);

        // Mouth
        if (p.cheering) {
            // Open mouth (cheering)
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(bx, by - p.headR + 2, 1.5, 0, Math.PI);
            ctx.fill();
        }

        // Arms
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        if (p.cheering) {
            // One arm up waving
            ctx.beginPath();
            ctx.moveTo(bx - 5, by + 4);
            ctx.lineTo(bx - 10, by - 6 + armWave);
            ctx.stroke();
            // Other arm to the side
            ctx.beginPath();
            ctx.moveTo(bx + 5, by + 4);
            ctx.lineTo(bx + 10, by + 8);
            ctx.stroke();
        } else {
            // Arms at sides
            ctx.beginPath();
            ctx.moveTo(bx - 5, by + 4);
            ctx.lineTo(bx - 8, by + bodyH - 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx + 5, by + 4);
            ctx.lineTo(bx + 8, by + bodyH - 2);
            ctx.stroke();
        }

        // Arm outlines
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        if (p.cheering) {
            ctx.beginPath();
            ctx.moveTo(bx - 5, by + 4);
            ctx.lineTo(bx - 10, by - 6 + armWave);
            ctx.stroke();
        }

        // Fist at end of waving arm
        if (p.cheering) {
            ctx.fillStyle = '#e8c4a0';
            ctx.beginPath();
            ctx.arc(bx - 10, by - 6 + armWave, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }
}

function drawImpactLines(ctx) {
    for (const line of vfx.impactLines) {
        const alpha = line.life / line.maxLife;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.translate(line.x, line.y);
        ctx.rotate(line.angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(10 + line.len, 0);
        ctx.stroke();
        ctx.restore();
    }
}

function drawParticles(ctx) {
    for (const p of vfx.particles) {
        const alpha = p.life / p.maxLife;
        if (p.type === 'spark') {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            // Draw as small diamond shapes for comic feel
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }
        if (p.type === 'comicText') {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            const fontSize = p.size;
            ctx.font = `bold ${fontSize}px 'Bangers', Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Black outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText(p.text, 0, 0);

            // Yellow fill
            ctx.fillStyle = '#ffdd00';
            ctx.fillText(p.text, 0, 0);

            ctx.restore();
        }
    }
}

// ===== STREET FIGHTER STYLE CHARACTER DRAWING =====

// Pose definitions - each pose is a set of offsets relative to body center
// This makes interpolation between poses smooth
function getPose(state, player, faceDir) {
    const t = player.stateTimer;
    const maxT = player.stateMaxTimer || 1;
    const progress = maxT > 0 ? 1 - (t / maxT) : 1; // 0 = start, 1 = end

    // Idle breathing animation
    const bb = Math.sin(player.bobPhase) * 2.5;
    const as = Math.sin(player.swayPhase) * 3;
    const ht = Math.sin(player.breathePhase) * 1.5;
    const ls = Math.sin(player.bobPhase + 1) * 1.5;
    const guardBob = Math.sin(player.bobPhase * 1.3) * 1.5;

    switch (state) {
        case 'idle':
            return {
                bodyBob: bb,
                bodyLean: 0,
                headOff: { x: 0, y: ht },
                lArm: { x: -20 + as * 0.4, y: 16 + as * 0.3 + bb },
                rArm: { x: 20 - as * 0.4, y: 16 - as * 0.3 + bb },
                lElbow: { x: -16, y: 8 + bb },
                rElbow: { x: 16, y: 8 + bb },
                lLeg: { x: -12 - ls, y: 28 },
                rLeg: { x: 12 + ls, y: 28 },
                lKnee: { x: -10, y: 15 },
                rKnee: { x: 10, y: 15 },
                torsoTwist: 0,
            };
        case 'punching': {
            // Wind up -> extend punch with smooth easing
            const ease = progress < 0.3 ? 0 : Math.min(1, (progress - 0.3) / 0.4);
            const windUp = progress < 0.3 ? progress / 0.3 : Math.max(0, 1 - (progress - 0.3) / 0.2);
            return {
                bodyBob: 0,
                bodyLean: ease * 3 * faceDir,
                headOff: { x: 0, y: ease * 2 },
                lArm: { x: -18 - windUp * 6, y: 10 - windUp * 4 },
                rArm: { x: 6 + ease * 4, y: 8 + ease * 30 },
                lElbow: { x: -16 - windUp * 4, y: 4 },
                rElbow: { x: 6, y: 8 + ease * 14 },
                lLeg: { x: -12, y: 28 },
                rLeg: { x: 14, y: 28 },
                lKnee: { x: -10, y: 15 },
                rKnee: { x: 12, y: 14 },
                torsoTwist: ease * 4,
            };
        }
        case 'kicking': {
            const ease = progress < 0.25 ? 0 : Math.min(1, (progress - 0.25) / 0.35);
            const windup = progress < 0.25 ? progress / 0.25 : 0;
            return {
                bodyBob: -windup * 3,
                bodyLean: -ease * 2,
                headOff: { x: 0, y: 0 },
                lArm: { x: -20, y: 14 },
                rArm: { x: 20, y: 14 },
                lElbow: { x: -16, y: 7 },
                rElbow: { x: 16, y: 7 },
                lLeg: { x: -10, y: 28 },
                rLeg: { x: 8, y: 14 + ease * 28 },
                lKnee: { x: -8, y: 15 },
                rKnee: { x: 8, y: 10 + ease * 10 },
                torsoTwist: -ease * 3,
            };
        }
        case 'blocking':
            return {
                bodyBob: guardBob,
                bodyLean: 0,
                headOff: { x: 0, y: 2 },
                lArm: { x: 6, y: 10 },
                rArm: { x: -6, y: 10 },
                lElbow: { x: 2, y: 5 },
                rElbow: { x: -2, y: 5 },
                lLeg: { x: -14, y: 26 },
                rLeg: { x: 14, y: 26 },
                lKnee: { x: -12, y: 14 },
                rKnee: { x: 12, y: 14 },
                torsoTwist: 0,
            };
        case 'countering': {
            const ease = Math.min(1, progress / 0.5);
            return {
                bodyBob: 0,
                bodyLean: -ease * 3,
                headOff: { x: -ease * 2, y: 0 },
                lArm: { x: -26, y: 4 + ease * 4 },
                rArm: { x: 14, y: 8 + ease * 14 },
                lElbow: { x: -20, y: 0 },
                rElbow: { x: 8, y: 6 + ease * 6 },
                lLeg: { x: -16, y: 28 },
                rLeg: { x: 18, y: 24 },
                lKnee: { x: -14, y: 14 },
                rKnee: { x: 14, y: 12 },
                torsoTwist: -ease * 5,
            };
        }
        case 'dodging': {
            const ease = Math.min(1, progress / 0.4);
            return {
                bodyBob: 0,
                bodyLean: -ease * 16,
                headOff: { x: -ease * 8, y: -ease * 4 },
                lArm: { x: -14 - ease * 8, y: 12 },
                rArm: { x: 14 - ease * 8, y: 12 },
                lElbow: { x: -10 - ease * 4, y: 6 },
                rElbow: { x: 10 - ease * 4, y: 6 },
                lLeg: { x: -6, y: 28 },
                rLeg: { x: 20, y: 28 },
                lKnee: { x: -4, y: 14 },
                rKnee: { x: 14, y: 14 },
                torsoTwist: -ease * 6,
            };
        }
        case 'grappling': {
            const ease = Math.min(1, progress / 0.5);
            return {
                bodyBob: 0,
                bodyLean: ease * 5 * faceDir,
                headOff: { x: 0, y: ease * 3 },
                lArm: { x: -16, y: 6 + ease * 28 },
                rArm: { x: 16, y: 6 + ease * 28 },
                lElbow: { x: -12, y: 6 + ease * 14 },
                rElbow: { x: 12, y: 6 + ease * 14 },
                lLeg: { x: -14, y: 28 },
                rLeg: { x: 14, y: 28 },
                lKnee: { x: -10, y: 14 },
                rKnee: { x: 10, y: 14 },
                torsoTwist: 0,
            };
        }
        case 'hit': {
            const ease = Math.min(1, progress / 0.3);
            return {
                bodyBob: 0,
                bodyLean: -ease * 6 * faceDir,
                headOff: { x: ease * 4, y: -ease * 6 },
                lArm: { x: -24, y: -4 - ease * 6 },
                rArm: { x: 24, y: -4 - ease * 6 },
                lElbow: { x: -18, y: -2 },
                rElbow: { x: 18, y: -2 },
                lLeg: { x: -10, y: 22 },
                rLeg: { x: 10, y: 22 },
                lKnee: { x: -8, y: 12 },
                rKnee: { x: 8, y: 12 },
                torsoTwist: ease * 4,
            };
        }
        default:
            return getPose('idle', player, faceDir);
    }
}

// Interpolate between two poses
function lerpPose(poseA, poseB, t) {
    if (!poseA || !poseB) return poseB || poseA;
    t = Math.max(0, Math.min(1, t));
    const smoothT = t * t * (3 - 2 * t); // smoothstep

    function lerpVal(a, b) { return a + (b - a) * smoothT; }
    function lerpPt(a, b) { return { x: lerpVal(a.x, b.x), y: lerpVal(a.y, b.y) }; }

    return {
        bodyBob: lerpVal(poseA.bodyBob, poseB.bodyBob),
        bodyLean: lerpVal(poseA.bodyLean, poseB.bodyLean),
        headOff: lerpPt(poseA.headOff, poseB.headOff),
        lArm: lerpPt(poseA.lArm, poseB.lArm),
        rArm: lerpPt(poseA.rArm, poseB.rArm),
        lElbow: lerpPt(poseA.lElbow, poseB.lElbow),
        rElbow: lerpPt(poseA.rElbow, poseB.rElbow),
        lLeg: lerpPt(poseA.lLeg, poseB.lLeg),
        rLeg: lerpPt(poseA.rLeg, poseB.rLeg),
        lKnee: lerpPt(poseA.lKnee, poseB.lKnee),
        rKnee: lerpPt(poseA.rKnee, poseB.rKnee),
        torsoTwist: lerpVal(poseA.torsoTwist, poseB.torsoTwist),
    };
}

function drawComicFighter(ctx, player) {
    const x = player.x;
    const y = player.y;
    const isP1 = player.id === 1;
    const faceDir = isP1 ? -1 : 1;

    // Color palette - P1 blue streetwear, P2 red streetwear
    const palette = isP1 ? {
        hoodie: '#1565c0',       // deep blue hoodie
        hoodieLt: '#42a5f5',     // highlight
        hoodieDk: '#0d47a1',     // shadow
        pants: '#263238',        // dark grey pants
        pantsLt: '#37474f',
        skin: '#d4a574',         // warm skin
        skinLt: '#e8c4a0',
        skinDk: '#b8865a',
        hair: '#1a1a2e',         // dark hair
        bandana: '#ff6f00',      // orange bandana
        bandanaLt: '#ffa040',
        shoes: '#212121',
        wraps: '#e0e0e0',       // hand wraps
        outline: '#0a0a15',
    } : {
        hoodie: '#b71c1c',       // deep red hoodie
        hoodieLt: '#ef5350',     // highlight
        hoodieDk: '#7f0000',     // shadow
        pants: '#1a1a1a',        // black pants
        pantsLt: '#2e2e2e',
        skin: '#c68642',         // warm skin
        skinLt: '#daa06d',
        skinDk: '#a0652e',
        hair: '#0d0d0d',         // black hair
        bandana: '#7c4dff',      // purple bandana
        bandanaLt: '#b388ff',
        shoes: '#1b1b1b',
        wraps: '#bdbdbd',
        outline: '#0a0a15',
    };

    const flashing = player.flashTimer > 0 && Math.floor(player.flashTimer / 40) % 2 === 0;

    ctx.save();
    if (flashing) ctx.globalAlpha = 0.35;

    // Grounded state - separate drawing
    if (player.state === 'grounded') {
        drawGroundedFighter(ctx, x, y, faceDir, palette);
        ctx.restore();
        return;
    }

    // Get current pose
    const targetPose = getPose(player.state, player, faceDir);

    // Smooth blend from previous pose
    let pose;
    if (player.blendTimer > 0 && player.prevPose) {
        const blendT = 1 - (player.blendTimer / player.blendDuration);
        pose = lerpPose(player.prevPose, targetPose, blendT);
    } else {
        pose = targetPose;
    }

    // Store current pose for future blending
    player.currentPose = { ...targetPose };

    // Dimensions for muscular build
    const headR = 12;
    const shoulderW = 32;    // broad shoulders
    const chestW = 30;
    const waistW = 22;
    const bodyH = 32;
    const neckH = 5;

    // Key body positions (all multiplied by faceDir for vertical orientation)
    const bodyBob = pose.bodyBob;
    const bodyLean = pose.bodyLean;
    const headX = x + pose.headOff.x;
    const headY = y + faceDir * (headR + neckH + 2) + bodyBob + pose.headOff.y * faceDir;
    const neckY = headY + faceDir * (headR - 2);
    const shoulderBaseY = neckY + faceDir * neckH;
    const waistY = shoulderBaseY + faceDir * bodyH;
    const tw = pose.torsoTwist;

    // -- SHADOW on ground --
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + faceDir * 56, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ===== LEGS =====
    const lLegStart = { x: x - 6, y: waistY };
    const rLegStart = { x: x + 6, y: waistY };
    const lKnee = { x: x + pose.lKnee.x, y: waistY + faceDir * pose.lKnee.y };
    const rKnee = { x: x + pose.rKnee.x, y: waistY + faceDir * pose.rKnee.y };
    const lFoot = { x: x + pose.lLeg.x, y: waistY + faceDir * pose.lLeg.y };
    const rFoot = { x: x + pose.rLeg.x, y: waistY + faceDir * pose.rLeg.y };

    // Upper legs (thighs) - thick muscular
    drawMuscularLimb(ctx, lLegStart.x, lLegStart.y, lKnee.x, lKnee.y, 12, 10, palette.pants, palette.pantsLt, palette.outline);
    drawMuscularLimb(ctx, rLegStart.x, rLegStart.y, rKnee.x, rKnee.y, 12, 10, palette.pants, palette.pantsLt, palette.outline);
    // Lower legs (calves)
    drawMuscularLimb(ctx, lKnee.x, lKnee.y, lFoot.x, lFoot.y, 10, 8, palette.pants, palette.pantsLt, palette.outline);
    drawMuscularLimb(ctx, rKnee.x, rKnee.y, rFoot.x, rFoot.y, 10, 8, palette.pants, palette.pantsLt, palette.outline);
    // Shoes
    drawShoe(ctx, lFoot.x, lFoot.y, faceDir, palette.shoes, palette.outline);
    drawShoe(ctx, rFoot.x, rFoot.y, faceDir, palette.shoes, palette.outline);

    // ===== TORSO =====
    drawMuscularTorso(ctx, x, shoulderBaseY, waistY, shoulderW, chestW, waistW, bodyH, faceDir, bodyBob, tw, palette);

    // ===== ARMS =====
    const lShoulderX = x - shoulderW / 2 + 2;
    const rShoulderX = x + shoulderW / 2 - 2;
    const shoulderY = shoulderBaseY + faceDir * 3 + bodyBob;

    const lElbow = { x: x + pose.lElbow.x, y: shoulderY + faceDir * pose.lElbow.y };
    const rElbow = { x: x + pose.rElbow.x, y: shoulderY + faceDir * pose.rElbow.y };
    const lHand = { x: x + pose.lArm.x, y: shoulderY + faceDir * pose.lArm.y };
    const rHand = { x: x + pose.rArm.x, y: shoulderY + faceDir * pose.rArm.y };

    // Upper arms (biceps) - muscular
    drawMuscularLimb(ctx, lShoulderX, shoulderY, lElbow.x, lElbow.y, 11, 9, palette.hoodie, palette.hoodieLt, palette.outline);
    drawMuscularLimb(ctx, rShoulderX, shoulderY, rElbow.x, rElbow.y, 11, 9, palette.hoodie, palette.hoodieLt, palette.outline);
    // Forearms (with hand wraps)
    drawMuscularLimb(ctx, lElbow.x, lElbow.y, lHand.x, lHand.y, 9, 7, palette.skin, palette.skinLt, palette.outline);
    drawMuscularLimb(ctx, rElbow.x, rElbow.y, rHand.x, rHand.y, 9, 7, palette.skin, palette.skinLt, palette.outline);

    // Hand wraps detail
    drawHandWraps(ctx, lElbow.x, lElbow.y, lHand.x, lHand.y, palette.wraps, palette.outline);
    drawHandWraps(ctx, rElbow.x, rElbow.y, rHand.x, rHand.y, palette.wraps, palette.outline);

    // Fists
    drawFist(ctx, lHand.x, lHand.y, 6, palette.wraps, palette.outline);
    drawFist(ctx, rHand.x, rHand.y, 6, palette.wraps, palette.outline);

    // ===== HEAD & NECK =====
    drawFighterHead(ctx, headX, headY, headR, faceDir, bodyBob, palette);

    // ===== STATE EFFECTS =====
    drawStateEffects(ctx, player, x, y, shoulderY, faceDir, bodyBob, rHand, rFoot, palette);

    ctx.restore();
}

// Draw a muscular limb segment (tapered thick line with highlight)
function drawMuscularLimb(ctx, x1, y1, x2, y2, widthStart, widthEnd, fillColor, lightColor, outlineColor) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return;
    const nx = -dy / len;
    const ny = dx / len;

    ctx.save();

    // Main limb shape (tapered)
    ctx.beginPath();
    ctx.moveTo(x1 + nx * widthStart / 2, y1 + ny * widthStart / 2);
    // Muscle bulge at 40% using bezier
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const bulge = (widthStart + widthEnd) / 2 * 1.15;
    ctx.quadraticCurveTo(mx + nx * bulge / 2, my + ny * bulge / 2, x2 + nx * widthEnd / 2, y2 + ny * widthEnd / 2);
    ctx.lineTo(x2 - nx * widthEnd / 2, y2 - ny * widthEnd / 2);
    ctx.quadraticCurveTo(mx - nx * bulge / 2, my - ny * bulge / 2, x1 - nx * widthStart / 2, y1 - ny * widthStart / 2);
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Highlight stripe (muscle definition)
    ctx.beginPath();
    const hlOff = widthStart * 0.15;
    ctx.moveTo(x1 + nx * (widthStart / 2 - hlOff), y1 + ny * (widthStart / 2 - hlOff));
    ctx.quadraticCurveTo(mx + nx * (bulge / 2 - hlOff), my + ny * (bulge / 2 - hlOff),
        x2 + nx * (widthEnd / 2 - hlOff), y2 + ny * (widthEnd / 2 - hlOff));
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
}

// Draw the torso with broad shoulders, chest, and tapered waist
function drawMuscularTorso(ctx, cx, topY, botY, shoulderW, chestW, waistW, bodyH, faceDir, bodyBob, twist, palette) {
    ctx.save();
    const ty = Math.min(topY, botY) + bodyBob;
    const by = Math.max(topY, botY) + bodyBob;
    const h = Math.abs(bodyH);
    const midY = ty + h * 0.45;

    // Main torso shape - trapezoid with muscular build
    ctx.beginPath();
    // Top (shoulders)
    ctx.moveTo(cx - shoulderW / 2 + twist, ty);
    ctx.lineTo(cx + shoulderW / 2 + twist, ty);
    // Right side - chest to waist taper
    ctx.quadraticCurveTo(cx + chestW / 2 + twist * 0.5, midY, cx + waistW / 2, by);
    // Bottom (waist)
    ctx.lineTo(cx - waistW / 2, by);
    // Left side - waist to chest
    ctx.quadraticCurveTo(cx - chestW / 2 + twist * 0.5, midY, cx - shoulderW / 2 + twist, ty);
    ctx.closePath();

    // Fill with hoodie color
    ctx.fillStyle = palette.hoodie;
    ctx.fill();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Hoodie chest highlight (left side light)
    ctx.save();
    ctx.clip();
    ctx.fillStyle = palette.hoodieLt;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW / 2 + twist, ty);
    ctx.lineTo(cx - 2 + twist, ty);
    ctx.quadraticCurveTo(cx - 4 + twist * 0.5, midY, cx - 2, by);
    ctx.lineTo(cx - waistW / 2, by);
    ctx.quadraticCurveTo(cx - chestW / 2 + twist * 0.5, midY, cx - shoulderW / 2 + twist, ty);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Hoodie shadow (right side darker)
    ctx.fillStyle = palette.hoodieDk;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(cx + 4 + twist, ty);
    ctx.lineTo(cx + shoulderW / 2 + twist, ty);
    ctx.quadraticCurveTo(cx + chestW / 2 + twist * 0.5, midY, cx + waistW / 2, by);
    ctx.lineTo(cx + 2, by);
    ctx.quadraticCurveTo(cx + 2 + twist * 0.5, midY, cx + 4 + twist, ty);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Hoodie center line (zipper)
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + twist * 0.7, ty + 2);
    ctx.lineTo(cx, by - 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Hood collar detail at top
    ctx.strokeStyle = palette.hoodieDk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8 + twist, ty);
    ctx.quadraticCurveTo(cx + twist, ty - 3, cx + 8 + twist, ty);
    ctx.stroke();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Chest muscle lines through hoodie
    ctx.strokeStyle = palette.hoodieDk;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    // Left pec
    ctx.beginPath();
    ctx.arc(cx - 7 + twist * 0.7, ty + h * 0.2, 8, Math.PI * 0.3, Math.PI * 1.1);
    ctx.stroke();
    // Right pec
    ctx.beginPath();
    ctx.arc(cx + 7 + twist * 0.7, ty + h * 0.2, 8, Math.PI * (-0.1), Math.PI * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Belt / waistband
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - waistW / 2 - 1, by - 4, waistW + 2, 5);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - waistW / 2 - 1, by - 4, waistW + 2, 5);

    ctx.restore();
}

// Draw the fighter's head with bandana and facial features
function drawFighterHead(ctx, hx, hy, headR, faceDir, bodyBob, palette) {
    ctx.save();

    // Neck
    ctx.fillStyle = palette.skin;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    const neckTop = hy + faceDir * (headR - 3);
    const neckBot = hy + faceDir * (headR + 4);
    const nTop = Math.min(neckTop, neckBot);
    const nH = Math.abs(neckBot - neckTop);
    ctx.fillRect(hx - 5, nTop, 10, nH);
    ctx.strokeRect(hx - 5, nTop, 10, nH);

    // Neck muscle lines
    ctx.strokeStyle = palette.skinDk;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(hx - 3, nTop);
    ctx.lineTo(hx - 2, nTop + nH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + 3, nTop);
    ctx.lineTo(hx + 2, nTop + nH);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Head shape (slightly squared jaw for masculine look)
    ctx.beginPath();
    const jawY = hy + faceDir * 4;
    ctx.moveTo(hx - headR, hy - faceDir * 2);
    ctx.quadraticCurveTo(hx - headR, hy - faceDir * headR, hx, hy - faceDir * headR);
    ctx.quadraticCurveTo(hx + headR, hy - faceDir * headR, hx + headR, hy - faceDir * 2);
    // Jawline
    ctx.quadraticCurveTo(hx + headR - 1, jawY, hx + 5, jawY + faceDir * 2);
    ctx.lineTo(hx - 5, jawY + faceDir * 2);
    ctx.quadraticCurveTo(hx - headR + 1, jawY, hx - headR, hy - faceDir * 2);
    ctx.closePath();
    ctx.fillStyle = palette.skin;
    ctx.fill();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Skin highlight
    ctx.save();
    ctx.clip();
    ctx.fillStyle = palette.skinLt;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(hx - 3, hy - faceDir * 3, headR * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Hair (short, spiky)
    ctx.fillStyle = palette.hair;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    const hairDir = -faceDir;
    ctx.beginPath();
    ctx.moveTo(hx - headR - 1, hy + hairDir * 2);
    for (let i = 0; i <= 6; i++) {
        const ang = Math.PI * (0.15 + i * 0.12);
        const spx = hx + Math.cos(ang) * (headR + 3 + Math.sin(i * 2.3) * 3) * (i % 2 === 0 ? 1 : 0.85);
        const spy = hy + hairDir * (Math.sin(ang) * (headR + 2 + Math.sin(i * 1.7) * 3));
        ctx.lineTo(spx, spy);
    }
    ctx.lineTo(hx + headR + 1, hy + hairDir * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bandana/headband
    ctx.fillStyle = palette.bandana;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    const bandY = hy - faceDir * (headR * 0.35);
    ctx.beginPath();
    ctx.moveTo(hx - headR - 1, bandY);
    ctx.lineTo(hx + headR + 1, bandY);
    ctx.lineTo(hx + headR + 1, bandY + faceDir * 5);
    ctx.lineTo(hx - headR - 1, bandY + faceDir * 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bandana highlight
    ctx.fillStyle = palette.bandanaLt;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(hx - headR, bandY + faceDir * 1, headR * 2, faceDir * 2);
    ctx.globalAlpha = 1;

    // Bandana tail flowing behind
    ctx.fillStyle = palette.bandana;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1;
    const tailWave = Math.sin(game.time * 0.005) * 4;
    ctx.beginPath();
    ctx.moveTo(hx + headR, bandY + faceDir * 1);
    ctx.quadraticCurveTo(hx + headR + 10 + tailWave, bandY + faceDir * 3, hx + headR + 16 + tailWave * 1.5, bandY - faceDir * 2);
    ctx.lineTo(hx + headR + 14 + tailWave * 1.5, bandY + faceDir * 4);
    ctx.quadraticCurveTo(hx + headR + 8 + tailWave, bandY + faceDir * 6, hx + headR, bandY + faceDir * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eyes - expressive
    const eyeBaseY = hy + faceDir * 1;
    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(hx - 5, eyeBaseY, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx + 5, eyeBaseY, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(hx - 5, eyeBaseY + faceDir * 0.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + 5, eyeBaseY + faceDir * 0.5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Eye outlines
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(hx - 5, eyeBaseY, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(hx + 5, eyeBaseY, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Eyebrows (determined/angry)
    ctx.strokeStyle = palette.hair;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - 9, eyeBaseY - faceDir * 4);
    ctx.lineTo(hx - 2, eyeBaseY - faceDir * 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + 9, eyeBaseY - faceDir * 4);
    ctx.lineTo(hx + 2, eyeBaseY - faceDir * 5);
    ctx.stroke();

    // Nose (small)
    ctx.strokeStyle = palette.skinDk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx, eyeBaseY + faceDir * 3);
    ctx.lineTo(hx - 1.5, eyeBaseY + faceDir * 5);
    ctx.stroke();

    // Mouth (determined line)
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx - 4, eyeBaseY + faceDir * 7);
    ctx.lineTo(hx + 4, eyeBaseY + faceDir * 7);
    ctx.stroke();

    ctx.restore();
}

// Draw hand wraps on forearm
function drawHandWraps(ctx, ex, ey, hx, hy, wrapColor, outlineColor) {
    const dx = hx - ex;
    const dy = hy - ey;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;

    ctx.save();
    ctx.strokeStyle = wrapColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;

    // Wrap lines across the forearm
    for (let t = 0.3; t < 0.9; t += 0.15) {
        const px = ex + dx * t;
        const py = ey + dy * t;
        const nx = -dy / len * 5;
        const ny = dx / len * 5;
        ctx.beginPath();
        ctx.moveTo(px + nx, py + ny);
        ctx.lineTo(px - nx, py - ny);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Draw a fist (wrapped)
function drawFist(ctx, x, y, r, fillColor, outlineColor) {
    ctx.save();
    // Fist shape
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Knuckle detail
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Draw a shoe
function drawShoe(ctx, x, y, faceDir, shoeColor, outlineColor) {
    ctx.save();
    ctx.fillStyle = shoeColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + faceDir * 2, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Sole line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + faceDir * 4);
    ctx.lineTo(x + 6, y + faceDir * 4);
    ctx.stroke();
    ctx.restore();
}

function drawStateEffects(ctx, player, x, y, shoulderY, faceDir, bodyBob, rHand, rFoot, palette) {
    if (player.state === 'countering' && player.counterWindow) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(x, y + bodyBob, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Energy glow
        ctx.fillStyle = 'rgba(255, 255, 0, 0.08)';
        ctx.beginPath();
        ctx.arc(x, y + bodyBob, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (player.state === 'blocking') {
        ctx.save();
        const shieldY = y + faceDir * 20;
        // Translucent energy shield
        const grad = ctx.createRadialGradient(x, shieldY, 5, x, shieldY, 25);
        grad.addColorStop(0, 'rgba(0, 200, 255, 0.15)');
        grad.addColorStop(0.7, 'rgba(0, 200, 255, 0.08)');
        grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, shieldY, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
    }

    if (player.state === 'dodging') {
        ctx.save();
        // After-images
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = palette.hoodie;
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(x + i * 8, y - faceDir * i * 4, 16, 0, Math.PI * 2);
            ctx.fill();
        }
        // Speed lines
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const offX = 18 + i * 6;
            const offY = -15 + i * 6;
            ctx.beginPath();
            ctx.moveTo(x + offX, y + offY);
            ctx.lineTo(x + offX + 12, y + offY);
            ctx.stroke();
        }
        ctx.restore();
    }

    if (player.state === 'punching') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const sLen = 8 + i * 6;
            ctx.beginPath();
            ctx.moveTo(rHand.x - 4 + i * 3, rHand.y - faceDir * 4);
            ctx.lineTo(rHand.x - 4 + i * 3, rHand.y - faceDir * (4 + sLen));
            ctx.stroke();
        }
        ctx.restore();
    }

    if (player.state === 'kicking') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rFoot.x, rFoot.y, 14, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.restore();
    }

    if (player.hitStun) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawGroundedFighter(ctx, x, y, faceDir, palette) {
    ctx.save();

    // Lying on the ground horizontally
    // Body (lying flat)
    ctx.fillStyle = palette.hoodie;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.5;

    // Torso
    roundRect(ctx, x - 22, y - 12, 36, 24, 5);
    ctx.fill();
    ctx.stroke();

    // Hoodie highlight
    ctx.fillStyle = palette.hoodieLt;
    ctx.globalAlpha = 0.3;
    roundRect(ctx, x - 20, y - 10, 12, 20, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = palette.skin;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 32, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bandana on head
    ctx.fillStyle = palette.bandana;
    ctx.fillRect(x - 42, y - 3, 20, 5);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 42, y - 3, 20, 5);

    // Closed eyes (knocked down)
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 35, y - 1);
    ctx.lineTo(x - 31, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 1);
    ctx.lineTo(x - 26, y);
    ctx.stroke();

    // Arms spread
    drawMuscularLimb(ctx, x - 12, y - 8, x - 18, y - 20, 8, 6, palette.hoodie, palette.hoodieLt, palette.outline);
    drawMuscularLimb(ctx, x - 6, y - 8, x, y - 20, 8, 6, palette.hoodie, palette.hoodieLt, palette.outline);
    drawFist(ctx, x - 18, y - 20, 5, palette.wraps, palette.outline);
    drawFist(ctx, x, y - 20, 5, palette.wraps, palette.outline);

    // Legs
    drawMuscularLimb(ctx, x + 14, y - 4, x + 30, y + 8, 10, 8, palette.pants, palette.pantsLt, palette.outline);
    drawMuscularLimb(ctx, x + 14, y + 4, x + 30, y - 8, 10, 8, palette.pants, palette.pantsLt, palette.outline);
    drawShoe(ctx, x + 30, y + 8, 1, palette.shoes, palette.outline);
    drawShoe(ctx, x + 30, y - 8, 1, palette.shoes, palette.outline);

    ctx.restore();
}

function drawCircle(ctx, x, y, r, fillColor, strokeColor, strokeW) {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
    r = r || 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawGroundRaceUI(ctx, w, h) {
    const gr = game.groundRace;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, w, h);

    // Timer bar with comic border
    const timerPct = Math.max(0, gr.timer / ANIM_DURATION.groundRace);
    const barX = w * 0.1;
    const barY = h * 0.48;
    const barW = w * 0.8;
    const barH = 10;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#ffa500';
    ctx.fillRect(barX, barY, barW * timerPct, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.font = "bold 15px 'Bangers', Impact, sans-serif";
    ctx.textAlign = 'center';

    const attacker = game.players[gr.attacker - 1];
    const defender = game.players[gr.defender - 1];

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    if (gr.attackerInput) {
        ctx.fillStyle = '#ffdd00';
        const ty = attacker.id === 1 ? h * 0.65 : h * 0.35;
        ctx.strokeText('READY!', w / 2, ty);
        ctx.fillText('READY!', w / 2, ty);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const ty = attacker.id === 1 ? h * 0.65 : h * 0.35;
        ctx.strokeText('ATK: Tap or Double-tap!', w / 2, ty);
        ctx.fillText('ATK: Tap or Double-tap!', w / 2, ty);
    }

    if (gr.defenderInput) {
        ctx.fillStyle = '#ffdd00';
        const ty = defender.id === 1 ? h * 0.65 : h * 0.35;
        ctx.strokeText('READY!', w / 2, ty);
        ctx.fillText('READY!', w / 2, ty);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const ty = defender.id === 1 ? h * 0.65 : h * 0.35;
        ctx.strokeText('DEF: Dodge or Counter!', w / 2, ty);
        ctx.fillText('DEF: Dodge or Counter!', w / 2, ty);
    }
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', init);
