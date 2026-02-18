// ============================================================
// SHADOW FIGHTER - Street Fighter Style 2P Fighting Game
// Full 2D movement, joystick controls, round system, sound FX
// ============================================================

// ===== CONSTANTS =====
const CANVAS_BG = '#0d0d1a';
const MAX_HP = 100;
const MOVE_SPEED = 3;
const CLOSE_RANGE = 95;
const DOUBLE_TAP_MS = 300;
const HOLD_MS = 350;

// Arena
const ARENA_DIAMETER = 3000; // logical arena size

// Combat ranges
const RANGE = { punch: 120, kick: 150, grapple: 95 };

// Damage values
const DMG = { punch: 8, kick: 14, counter: 12, grapple: 10, grapplePunch: 8, grappleKick: 14 };

// Cooldowns (ms) - now GLOBAL: any action puts ALL buttons on cooldown
const COOLDOWN = { punch: 900, kick: 1400, counter: 1000, dodge: 900, block: 100, grapple: 1600 };

// Round timer (seconds)
const ROUND_TIME = 60;

// Animation durations (ms)
const ANIM_DURATION = { punch: 300, kick: 450, counter: 400, dodge: 350, block: 0, grapple: 500, hit: 300, hitByPunch: 350, hitByKick: 500, groundRace: 2000 };

// ===== DEVICE DETECTION =====
const IS_TOUCH_DEVICE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ===== KEYBOARD MAPPING =====
// P1: WASD movement, C=attack, V=dodge, B=grapple
// P2: Arrow keys movement, .=attack, ,=dodge, M=grapple
const KEY_MAP = {
    // Player 1 movement
    'w': { player: 1, type: 'move', dir: 'up' },
    'a': { player: 1, type: 'move', dir: 'left' },
    's': { player: 1, type: 'move', dir: 'down' },
    'd': { player: 1, type: 'move', dir: 'right' },
    // Player 1 actions
    'c': { player: 1, type: 'action', action: 'attack' },
    'v': { player: 1, type: 'action', action: 'dodge' },
    'b': { player: 1, type: 'action', action: 'grapple' },
    // Player 2 movement
    'ArrowUp': { player: 2, type: 'move', dir: 'up' },
    'ArrowLeft': { player: 2, type: 'move', dir: 'left' },
    'ArrowDown': { player: 2, type: 'move', dir: 'down' },
    'ArrowRight': { player: 2, type: 'move', dir: 'right' },
    // Player 2 actions
    '.': { player: 2, type: 'action', action: 'attack' },
    ',': { player: 2, type: 'action', action: 'dodge' },
    'm': { player: 2, type: 'action', action: 'grapple' },
};

// Track which keys are currently held down (for movement)
const keysDown = {};

// Track keyboard action state for tap/double-tap/hold logic
const kbAction = {
    1: { lastTapTime: { attack: 0, dodge: 0 }, lastTapAction: { attack: null, dodge: null },
         singleTapTimeout: { attack: null, dodge: null }, holdTimeout: { dodge: null }, isHolding: { dodge: false } },
    2: { lastTapTime: { attack: 0, dodge: 0 }, lastTapAction: { attack: null, dodge: null },
         singleTapTimeout: { attack: null, dodge: null }, holdTimeout: { dodge: null }, isHolding: { dodge: false } },
};

// ===== OUTFIT SYSTEM =====
const OUTFITS = [
    // 0: Street
    {
        name: 'Street', topType: 'hoodie', pantsType: 'jeans', headwearType: 'bandana',
        shoeType: 'sneakers', handType: 'wraps', showHair: true, faceType: 'determined',
        p1: {
            top: '#1565c0', topLt: '#42a5f5', topDk: '#0d47a1',
            pants: '#263238', pantsLt: '#37474f',
            skin: '#d4a574', skinLt: '#e8c4a0', skinDk: '#b8865a',
            hair: '#1a1a2e', headwear: '#ff6f00', headwearLt: '#ffa040',
            shoes: '#f5f5f5', shoeAccent: '#1565c0',
            hands: '#e0e0e0', outline: '#0a0a15',
        },
        p2: {
            top: '#b71c1c', topLt: '#ef5350', topDk: '#7f0000',
            pants: '#1a1a1a', pantsLt: '#2e2e2e',
            skin: '#c68642', skinLt: '#daa06d', skinDk: '#a0652e',
            hair: '#0d0d0d', headwear: '#7c4dff', headwearLt: '#b388ff',
            shoes: '#1b1b1b', shoeAccent: '#b71c1c',
            hands: '#bdbdbd', outline: '#0a0a15',
        },
    },
    // 1: Casual / Home
    {
        name: 'Casual', topType: 'tshirt', pantsType: 'sweatpants', headwearType: 'beanie',
        shoeType: 'slides', handType: 'bare', showHair: false, faceType: 'relaxed',
        p1: {
            top: '#546e7a', topLt: '#78909c', topDk: '#37474f',
            pants: '#1a237e', pantsLt: '#283593',
            skin: '#d4a574', skinLt: '#e8c4a0', skinDk: '#b8865a',
            hair: '#1a1a2e', headwear: '#1565c0', headwearLt: '#42a5f5',
            shoes: '#1565c0', shoeAccent: '#42a5f5',
            hands: '#d4a574', outline: '#0a0a15',
        },
        p2: {
            top: '#880e4f', topLt: '#ad1457', topDk: '#6a0033',
            pants: '#212121', pantsLt: '#424242',
            skin: '#c68642', skinLt: '#daa06d', skinDk: '#a0652e',
            hair: '#0d0d0d', headwear: '#c62828', headwearLt: '#e53935',
            shoes: '#c62828', shoeAccent: '#e53935',
            hands: '#c68642', outline: '#0a0a15',
        },
    },
    // 2: Ski
    {
        name: 'Ski', topType: 'skiJacket', pantsType: 'skiPants', headwearType: 'skiHelmet',
        shoeType: 'snowBoots', handType: 'thickGloves', showHair: false, faceType: 'determined',
        p1: {
            top: '#0277bd', topLt: '#039be5', topDk: '#01579b',
            pants: '#1a1a1a', pantsLt: '#333333',
            skin: '#d4a574', skinLt: '#e8c4a0', skinDk: '#b8865a',
            hair: '#1a1a2e', headwear: '#e0e0e0', headwearLt: '#ffffff',
            shoes: '#37474f', shoeAccent: '#0277bd',
            hands: '#0277bd', outline: '#0a0a15',
        },
        p2: {
            top: '#d32f2f', topLt: '#ef5350', topDk: '#b71c1c',
            pants: '#263238', pantsLt: '#37474f',
            skin: '#c68642', skinLt: '#daa06d', skinDk: '#a0652e',
            hair: '#0d0d0d', headwear: '#fafafa', headwearLt: '#ffffff',
            shoes: '#37474f', shoeAccent: '#d32f2f',
            hands: '#d32f2f', outline: '#0a0a15',
        },
    },
    // 3: Ninja
    {
        name: 'Ninja', topType: 'ninjaGi', pantsType: 'ninjaPants', headwearType: 'ninjaMask',
        shoeType: 'tabi', handType: 'fingerlessGloves', showHair: false, faceType: 'masked',
        p1: {
            top: '#1a237e', topLt: '#283593', topDk: '#0d1642',
            pants: '#1a237e', pantsLt: '#283593',
            skin: '#d4a574', skinLt: '#e8c4a0', skinDk: '#b8865a',
            hair: '#1a1a2e', headwear: '#1a237e', headwearLt: '#283593',
            shoes: '#212121', shoeAccent: '#1a237e',
            hands: '#212121', outline: '#0a0a15',
        },
        p2: {
            top: '#4a0000', topLt: '#6d0000', topDk: '#2c0000',
            pants: '#4a0000', pantsLt: '#6d0000',
            skin: '#c68642', skinLt: '#daa06d', skinDk: '#a0652e',
            hair: '#0d0d0d', headwear: '#4a0000', headwearLt: '#6d0000',
            shoes: '#1a1a1a', shoeAccent: '#4a0000',
            hands: '#1a1a1a', outline: '#0a0a15',
        },
    },
];

// Color variants for customization (3 per player)
const COLOR_VARIANTS = {
    p1: [
        { label: 'Blue', hueShift: 0 },
        { label: 'Green', hueShift: 1 },
        { label: 'Teal', hueShift: 2 },
    ],
    p2: [
        { label: 'Red', hueShift: 0 },
        { label: 'Purple', hueShift: 1 },
        { label: 'Orange', hueShift: 2 },
    ],
};

function getOutfitForPlayer(playerId) {
    const outfitIndex = playerId === 1
        ? game.settings.p1Outfits[game.currentRound - 1]
        : game.settings.p2Outfits[game.currentRound - 1];
    const outfit = OUTFITS[outfitIndex];
    const palette = playerId === 1 ? outfit.p1 : outfit.p2;
    return { outfit, palette };
}

// ===== AUDIO SYSTEM =====
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    switch (type) {
        case 'punch': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.1);
            break;
        }
        case 'kick': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.15);
            break;
        }
        case 'block': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.08);
            break;
        }
        case 'counter': {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc1.type = 'square';
            osc1.frequency.setValueAtTime(600, now);
            osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(400, now);
            osc2.frequency.exponentialRampToValueAtTime(200, now + 0.12);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
            osc1.start(now); osc1.stop(now + 0.06);
            osc2.start(now); osc2.stop(now + 0.12);
            break;
        }
        case 'grapple': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.2);
            break;
        }
        case 'dodge': {
            // Whoosh - filtered noise
            const bufferSize = audioCtx.sampleRate * 0.15;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.frequency.exponentialRampToValueAtTime(500, now + 0.15);
            filter.Q.value = 2;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            noise.connect(filter).connect(gain).connect(audioCtx.destination);
            noise.start(now); noise.stop(now + 0.15);
            break;
        }
        case 'ko': {
            // Dramatic boom + sting
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            const gain2 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(80, now);
            osc1.frequency.exponentialRampToValueAtTime(30, now + 0.4);
            gain1.gain.setValueAtTime(0.5, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(1000, now + 0.05);
            osc2.frequency.exponentialRampToValueAtTime(600, now + 0.2);
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.2, now + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc1.connect(gain1).connect(audioCtx.destination);
            osc2.connect(gain2).connect(audioCtx.destination);
            osc1.start(now); osc1.stop(now + 0.4);
            osc2.start(now); osc2.stop(now + 0.2);
            break;
        }
    }
}

// ===== VISUAL EFFECTS STATE =====
const vfx = {
    particles: [],
    impactLines: [],
    screenShakeTimer: 0,
    hitFreezeTimer: 0,
    slowMoTimer: 0,
    slowMoFactor: 1,
};

// ===== GAME STATE =====
const game = {
    screen: 'title',
    canvas: null, ctx: null,
    width: 0, height: 0,
    players: [],
    announcement: { text: '', timer: 0 },
    groundRace: null,
    buttonCooldowns: {},
    time: 0,
    // Arena (set on resize)
    arenaCenterX: 0,
    arenaCenterY: 0,
    arenaRadius: 0,
    // Round system
    roundWins: [0, 0],
    currentRound: 1,
    matchOver: false,
    roundTimer: ROUND_TIME * 1000,
    // Cutscene
    cutscene: null,
    confetti: [],
    // Settings (customization)
    settings: {
        p1Outfits: [0, 1, 3],  // Street, Casual, Ninja
        p2Outfits: [0, 1, 3],
        p1Color: 0,
        p2Color: 0,
        selectedWorld: 0,
    },
};

// ===== PLAYER FACTORY =====
function createPlayer(id) {
    return {
        id,
        hp: MAX_HP,
        x: 0, y: 0,
        facing: id === 1 ? -1 : 1,
        state: 'idle',
        prevState: 'idle',
        stateTimer: 0,
        stateMaxTimer: 0,
        // Global cooldown
        globalCooldownUntil: 0,
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
        // Joystick
        joystick: { active: false, dx: 0, dy: 0 },
        isMoving: false,
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

// ===== UTILITIES =====
function dist2D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function clampToArena(player) {
    const dx = player.x - game.arenaCenterX;
    const dy = player.y - game.arenaCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > game.arenaRadius) {
        player.x = game.arenaCenterX + (dx / dist) * game.arenaRadius;
        player.y = game.arenaCenterY + (dy / dist) * game.arenaRadius;
    }
}

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

// ===== INITIALIZATION =====
function init() {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');

    // Add cooldown fill divs to action buttons
    document.querySelectorAll('.attack-btn, .dodge-btn, .grapple-btn').forEach(btn => {
        const fill = document.createElement('div');
        fill.classList.add('cooldown-fill');
        btn.appendChild(fill);
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    document.getElementById('start-btn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); });
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('customize-btn').addEventListener('touchstart', (e) => { e.preventDefault(); showCustomize(); });
    document.getElementById('customize-btn').addEventListener('click', showCustomize);
    document.getElementById('custom-fight-btn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); });
    document.getElementById('custom-fight-btn').addEventListener('click', startGame);
    document.getElementById('custom-back-btn').addEventListener('touchstart', (e) => { e.preventDefault(); showTitle(); });
    document.getElementById('custom-back-btn').addEventListener('click', showTitle);
    document.getElementById('rematch-btn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); });
    document.getElementById('rematch-btn').addEventListener('click', startGame);
    document.getElementById('menu-btn').addEventListener('touchstart', (e) => { e.preventDefault(); showTitle(); });
    document.getElementById('menu-btn').addEventListener('click', showTitle);
    document.getElementById('exit-fight-btn').addEventListener('touchstart', (e) => { e.preventDefault(); showTitle(); });
    document.getElementById('exit-fight-btn').addEventListener('click', showTitle);

    setupCustomizeScreen();

    setupControls();
    setupJoysticks();
    setupKeyboard();

    // PC mode: hide touch controls, show key hints
    if (!IS_TOUCH_DEVICE) {
        document.body.classList.add('pc-mode');
        // Add key hints overlay to game screen
        const hints = document.createElement('div');
        hints.className = 'key-hints';
        hints.innerHTML = '<span>P1: WASD move | C atk | V dodge | B grab</span><span>P2: Arrows move | . atk | , dodge | M grab</span>';
        document.getElementById('game-screen').appendChild(hints);
    }

    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const canvas = game.canvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    game.width = canvas.width;
    game.height = canvas.height;
    // Arena circle fits in canvas with margin
    game.arenaCenterX = game.width / 2;
    game.arenaCenterY = game.height / 2;
    game.arenaRadius = Math.min(game.width, game.height) * 0.42;
    // Regenerate crowd
    if (game.width > 0 && game.height > 0) {
        generateCrowd(game.width, game.height);
    }
}

function startGame() {
    initAudio();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('customize-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    requestAnimationFrame(() => {
        resizeCanvas();
        game.roundWins = [0, 0];
        game.currentRound = 1;
        game.matchOver = false;
        game.roundTimer = ROUND_TIME * 1000;
        resetPlayers();
        game.screen = 'playing';
        game.groundRace = null;
        vfx.particles = [];
        vfx.impactLines = [];
        updateRoundIndicators();
        showAnnouncement('ROUND 1 — FIGHT!', 1200);
    });
}

function showTitle() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('customize-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    game.screen = 'title';
}

function showCustomize() {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('customize-screen').classList.remove('hidden');
    game.screen = 'customize';
    refreshCustomizeUI();
}

// ===== CUSTOMIZE SCREEN LOGIC =====
const WORLD_COLORS = [
    { name: 'Street', bg: '#2a2a30', accent: '#c84b31' },
    { name: 'Rainforest', bg: '#1a3a15', accent: '#2d8a2e' },
    { name: 'Desert', bg: '#c4982a', accent: '#e8a020' },
    { name: 'Wild West', bg: '#6b4a14', accent: '#a07828' },
    { name: 'Snowy Mtn', bg: '#8aa8c8', accent: '#d0e0f0' },
    { name: 'Grass Plains', bg: '#3a7c2a', accent: '#5cb840' },
    { name: 'City', bg: '#1a1a2a', accent: '#4040a0' },
];

function setupCustomizeScreen() {
    // Build world thumbnails
    const worldRow = document.getElementById('world-row');
    WORLD_COLORS.forEach((w, i) => {
        const div = document.createElement('div');
        div.className = 'world-thumb' + (i === game.settings.selectedWorld ? ' selected' : '');
        div.style.background = `linear-gradient(135deg, ${w.bg}, ${w.accent})`;
        div.textContent = w.name;
        div.dataset.index = i;
        div.addEventListener('touchstart', (e) => { e.preventDefault(); selectWorld(i); });
        div.addEventListener('click', () => selectWorld(i));
        worldRow.appendChild(div);
    });

    // Outfit slot cycling
    document.querySelectorAll('.outfit-slot').forEach(slot => {
        slot.addEventListener('touchstart', (e) => { e.preventDefault(); cycleOutfit(slot); });
        slot.addEventListener('click', () => cycleOutfit(slot));
    });
}

function selectWorld(index) {
    game.settings.selectedWorld = index;
    document.querySelectorAll('.world-thumb').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
}

function cycleOutfit(slot) {
    const pNum = parseInt(slot.dataset.player);
    const round = parseInt(slot.dataset.round);
    const outfits = pNum === 1 ? game.settings.p1Outfits : game.settings.p2Outfits;
    outfits[round] = (outfits[round] + 1) % OUTFITS.length;
    refreshCustomizeUI();
}

function refreshCustomizeUI() {
    for (let p = 1; p <= 2; p++) {
        const outfits = p === 1 ? game.settings.p1Outfits : game.settings.p2Outfits;
        for (let r = 0; r < 3; r++) {
            const el = document.getElementById(`p${p}-outfit-${r}`);
            if (el) el.textContent = OUTFITS[outfits[r]].name;
        }
    }
}

function resetPlayers() {
    const p1 = createPlayer(1);
    const p2 = createPlayer(2);
    // Start on opposite sides of arena circle
    p1.x = game.arenaCenterX;
    p1.y = game.arenaCenterY + game.arenaRadius * 0.6;
    p2.x = game.arenaCenterX;
    p2.y = game.arenaCenterY - game.arenaRadius * 0.6;
    game.players = [p1, p2];
    updateHealthBars();
    clearAllCooldownVisuals();
}

function resetPlayersForRound() {
    const savedWins = [...game.roundWins];
    const savedRound = game.currentRound;
    resetPlayers();
    game.roundWins = savedWins;
    game.currentRound = savedRound;
    updateRoundIndicators();
}

// ===== ROUND SYSTEM =====
function updateRoundIndicators() {
    [1, 2].forEach(pNum => {
        const dots = document.querySelectorAll(`#p${pNum}-rounds .round-dot`);
        dots.forEach((dot, i) => {
            if (i < game.roundWins[pNum - 1]) {
                dot.classList.add('won');
            } else {
                dot.classList.remove('won');
            }
        });
    });
}

function endRound(winner) {
    game.screen = 'roundOver';
    game.roundWins[winner.id - 1]++;

    // Victory pose for winner
    setPlayerState(winner, 'victory');
    playSound('ko');
    screenShake(8);
    hitFlash('big');
    updateRoundIndicators();

    if (game.roundWins[winner.id - 1] >= 2) {
        // Match over — start 3D victory cutscene after brief pause
        showAnnouncement(`PLAYER ${winner.id} WINS THE MATCH!`, 1500);
        setTimeout(() => {
            startVictoryCutscene(winner);
        }, 1600);
    } else {
        showAnnouncement(`PLAYER ${winner.id} WINS ROUND ${game.currentRound}!`, 1500);
        setTimeout(() => {
            game.currentRound++;
            game.roundTimer = ROUND_TIME * 1000;
            resetPlayersForRound();
            game.screen = 'playing';
            game.groundRace = null;
            showAnnouncement(`ROUND ${game.currentRound} — FIGHT!`, 1200);
        }, 2200);
    }
}

// ===== VFX FUNCTIONS =====
function screenShake(intensity) {
    vfx.screenShakeTimer = 150;
    const gs = document.getElementById('game-screen');
    gs.classList.remove('shake');
    void gs.offsetWidth;
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
        vfx.impactLines.push({ x, y, angle, len, life: 200 + Math.random() * 100, maxLife: 200 + Math.random() * 100 });
    }
}

function spawnComicText(x, y, text) {
    vfx.particles.push({
        x, y: y - 15,
        vx: (Math.random() - 0.5) * 2,
        vy: -2,
        life: 600, maxLife: 600,
        text, type: 'comicText',
        size: 16 + Math.random() * 8,
        rotation: (Math.random() - 0.5) * 0.4,
    });
}

// ===== GLOBAL COOLDOWN VISUALS =====
function startGlobalCooldownVisual(playerNum, durationMs) {
    const controls = document.getElementById(`p${playerNum}-controls`);
    const btns = controls.querySelectorAll('.attack-btn, .grapple-btn, .dodge-btn');

    // Clear any existing cooldown intervals for this player
    ['attack', 'grapple', 'dodge'].forEach(key => {
        const k = `p${playerNum}-${key}`;
        if (game.buttonCooldowns[k]) clearInterval(game.buttonCooldowns[k]);
    });

    const startTime = Date.now();
    btns.forEach(btn => {
        btn.classList.add('on-cooldown');
        const fill = btn.querySelector('.cooldown-fill');

        const actionKey = btn.classList.contains('attack-btn') ? 'attack' :
                          btn.classList.contains('grapple-btn') ? 'grapple' : 'dodge';
        const key = `p${playerNum}-${actionKey}`;

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
    });
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

// ===== JOYSTICK SYSTEM =====
function setupJoysticks() {
    [1, 2].forEach(playerNum => {
        const area = document.getElementById(`p${playerNum}-joystick-area`);
        const base = document.getElementById(`p${playerNum}-joystick-base`);
        const knob = document.getElementById(`p${playerNum}-joystick-knob`);
        const isP2 = playerNum === 2;

        let activeTouchId = null;

        area.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (activeTouchId !== null) return;
            const touch = e.changedTouches[0];
            activeTouchId = touch.identifier;
            updateJoystickFromTouch(touch, playerNum, base, knob, isP2);
        });

        area.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === activeTouchId) {
                    updateJoystickFromTouch(touch, playerNum, base, knob, isP2);
                }
            }
        });

        const endTouch = (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === activeTouchId) {
                    activeTouchId = null;
                    resetJoystick(playerNum, knob);
                }
            }
        };
        area.addEventListener('touchend', endTouch);
        area.addEventListener('touchcancel', endTouch);

        // Mouse fallback for desktop testing
        let mouseDown = false;
        area.addEventListener('mousedown', (e) => {
            e.preventDefault();
            mouseDown = true;
            updateJoystickFromMouse(e, playerNum, base, knob, isP2);
        });
        window.addEventListener('mousemove', (e) => {
            if (mouseDown) updateJoystickFromMouse(e, playerNum, base, knob, isP2);
        });
        window.addEventListener('mouseup', () => {
            if (mouseDown) {
                mouseDown = false;
                resetJoystick(playerNum, knob);
            }
        });
    });
}

function updateJoystickFromTouch(touch, playerNum, base, knob, isP2) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    processJoystick(touch.clientX - centerX, touch.clientY - centerY, playerNum, knob, isP2, rect.width / 2);
}

function updateJoystickFromMouse(e, playerNum, base, knob, isP2) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    processJoystick(e.clientX - centerX, e.clientY - centerY, playerNum, knob, isP2, rect.width / 2);
}

function processJoystick(rawDx, rawDy, playerNum, knob, isP2, maxPx) {
    // P2 controls are CSS-rotated 180deg, getBoundingClientRect already accounts for that
    // but the visual knob offset needs to match the touch direction in screen space
    let dx = rawDx;
    let dy = rawDy;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampDist = Math.min(dist, maxPx - 18); // knob stays inside base
    if (dist > 0) {
        dx = (dx / dist) * clampDist;
        dy = (dy / dist) * clampDist;
    }

    // Move knob visually
    knob.style.left = `calc(50% + ${dx}px)`;
    knob.style.top = `calc(50% + ${dy}px)`;

    // Normalize to -1..1 for gameplay
    const normDist = Math.min(dist, maxPx) / maxPx;
    let normDx = dist > 0 ? (rawDx / dist) * normDist : 0;
    let normDy = dist > 0 ? (rawDy / dist) * normDist : 0;

    // For P2, the CSS rotation means screen-space touch is already in the right direction
    // because getBoundingClientRect gives us the rotated coordinates
    // But the game world is not rotated, so P2's joystick input is fine as-is

    const player = game.players[playerNum - 1];
    if (player) {
        player.joystick.active = true;
        player.joystick.dx = normDx;
        player.joystick.dy = normDy;
    }
}

function resetJoystick(playerNum, knob) {
    knob.style.left = '50%';
    knob.style.top = '50%';
    const player = game.players[playerNum - 1];
    if (player) {
        player.joystick.active = false;
        player.joystick.dx = 0;
        player.joystick.dy = 0;
    }
}

// ===== INPUT SYSTEM (action buttons only) =====
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

    if (action === 'dodge') {
        if (btn._holdTimeout) { clearTimeout(btn._holdTimeout); btn._holdTimeout = null; }
        if (player.isHolding.dodge) {
            player.isHolding.dodge = false;
            player.isBlocking = false;
            if (player.state === 'blocking') player.state = 'idle';
        }
    }
}

// ===== KEYBOARD INPUT SYSTEM =====
function normalizeKey(key) {
    // Arrow keys stay as-is, letters become lowercase, symbols stay as-is
    if (key.startsWith('Arrow')) return key;
    return key.toLowerCase();
}

function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
        const nk = normalizeKey(e.key);
        const mapping = KEY_MAP[nk];
        if (!mapping) return;
        e.preventDefault();

        if (mapping.type === 'move') {
            keysDown[nk] = true;
            updateKeyboardMovement(mapping.player);
        } else if (mapping.type === 'action') {
            // Prevent key repeat from re-triggering
            if (keysDown[nk]) return;
            keysDown[nk] = true;
            handleKeyboardActionDown(mapping.player, mapping.action);
        }
    });

    window.addEventListener('keyup', (e) => {
        const nk = normalizeKey(e.key);
        const mapping = KEY_MAP[nk];
        if (!mapping) return;
        e.preventDefault();

        keysDown[nk] = false;

        if (mapping.type === 'move') {
            updateKeyboardMovement(mapping.player);
        } else if (mapping.type === 'action') {
            handleKeyboardActionUp(mapping.player, mapping.action);
        }
    });
}

function updateKeyboardMovement(playerNum) {
    const player = game.players[playerNum - 1];
    if (!player) return;

    // Compute direction from currently held keys
    let dx = 0, dy = 0;

    if (playerNum === 1) {
        if (keysDown['w']) dy -= 1;
        if (keysDown['s']) dy += 1;
        if (keysDown['a']) dx -= 1;
        if (keysDown['d']) dx += 1;
    } else {
        if (keysDown['ArrowUp']) dy -= 1;
        if (keysDown['ArrowDown']) dy += 1;
        if (keysDown['ArrowLeft']) dx -= 1;
        if (keysDown['ArrowRight']) dx += 1;
    }

    // Normalize diagonal
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0) {
        dx /= mag;
        dy /= mag;
        player.joystick.active = true;
        player.joystick.dx = dx;
        player.joystick.dy = dy;
    } else {
        player.joystick.active = false;
        player.joystick.dx = 0;
        player.joystick.dy = 0;
    }
}

function handleKeyboardActionDown(playerNum, action) {
    const player = game.players[playerNum - 1];
    if (!player) return;
    const now = Date.now();
    const kb = kbAction[playerNum];

    if (action === 'dodge') {
        kb.isHolding.dodge = false;
        kb.holdTimeout.dodge = setTimeout(() => {
            kb.isHolding.dodge = true;
            executeAction(player, 'block');
        }, HOLD_MS);
    }

    if (action === 'attack' || action === 'dodge') {
        const timeSinceLast = now - kb.lastTapTime[action];
        if (timeSinceLast < DOUBLE_TAP_MS && kb.lastTapAction[action] === action) {
            // Double tap
            kb.lastTapAction[action] = null;
            if (kb.holdTimeout.dodge) { clearTimeout(kb.holdTimeout.dodge); kb.holdTimeout.dodge = null; }
            if (kb.singleTapTimeout[action]) { clearTimeout(kb.singleTapTimeout[action]); kb.singleTapTimeout[action] = null; }
            if (action === 'attack') {
                executeAction(player, 'kick');
            } else if (action === 'dodge') {
                kb.isHolding.dodge = false;
                executeAction(player, 'counter');
            }
        } else {
            // First tap — wait to see if double tap follows
            kb.lastTapTime[action] = now;
            kb.lastTapAction[action] = action;
            kb.singleTapTimeout[action] = setTimeout(() => {
                if (kb.lastTapAction[action] === action) {
                    kb.lastTapAction[action] = null;
                    if (action === 'attack') {
                        executeAction(player, 'punch');
                    } else if (action === 'dodge' && !kb.isHolding.dodge) {
                        if (kb.holdTimeout.dodge) { clearTimeout(kb.holdTimeout.dodge); kb.holdTimeout.dodge = null; }
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

function handleKeyboardActionUp(playerNum, action) {
    const player = game.players[playerNum - 1];
    if (!player) return;
    const kb = kbAction[playerNum];

    if (action === 'dodge') {
        if (kb.holdTimeout.dodge) { clearTimeout(kb.holdTimeout.dodge); kb.holdTimeout.dodge = null; }
        if (kb.isHolding.dodge) {
            kb.isHolding.dodge = false;
            player.isBlocking = false;
            if (player.state === 'blocking') player.state = 'idle';
        }
    }
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

    // Global cooldown check (block is exempt since it's hold-based)
    if (action !== 'block' && player.globalCooldownUntil && Date.now() < player.globalCooldownUntil) return;

    if (player.state !== 'idle' && player.state !== 'blocking' && player.state !== 'walking') {
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
            player.globalCooldownUntil = Date.now() + COOLDOWN.punch;
            startGlobalCooldownVisual(player.id, COOLDOWN.punch);
            setTimeout(() => resolveMeleeHit(player, opponent, 'punch'), 100);
            break;
        case 'kick':
            setPlayerState(player, 'kicking', ANIM_DURATION.kick);
            player.globalCooldownUntil = Date.now() + COOLDOWN.kick;
            startGlobalCooldownVisual(player.id, COOLDOWN.kick);
            setTimeout(() => resolveMeleeHit(player, opponent, 'kick'), 200);
            break;
        case 'counter':
            setPlayerState(player, 'countering', ANIM_DURATION.counter);
            player.counterWindow = true;
            player.globalCooldownUntil = Date.now() + COOLDOWN.counter;
            startGlobalCooldownVisual(player.id, COOLDOWN.counter);
            setTimeout(() => { player.counterWindow = false; }, ANIM_DURATION.counter);
            break;
        case 'dodge':
            setPlayerState(player, 'dodging', ANIM_DURATION.dodge);
            player.globalCooldownUntil = Date.now() + COOLDOWN.dodge;
            startGlobalCooldownVisual(player.id, COOLDOWN.dodge);
            playSound('dodge');
            // Move away from opponent in 2D
            {
                const dx = player.x - opponent.x;
                const dy = player.y - opponent.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                player.x += (dx / d) * 40;
                player.y += (dy / d) * 40;
                clampToArena(player);
            }
            break;
        case 'block':
            setPlayerState(player, 'blocking');
            player.isBlocking = true;
            // Block does NOT trigger global cooldown
            break;
        case 'grapple': {
            const gDist = dist2D(player, opponent);
            if (gDist > RANGE.grapple) {
                showAnnouncement('Too far!', 500);
                return;
            }
            setPlayerState(player, 'grappling', ANIM_DURATION.grapple);
            player.globalCooldownUntil = Date.now() + COOLDOWN.grapple;
            startGlobalCooldownVisual(player.id, COOLDOWN.grapple);
            setTimeout(() => resolveGrapple(player, opponent), 250);
            break;
        }
    }
}

// ===== COMBAT RESOLUTION =====
function resolveMeleeHit(attacker, defender, type) {
    if (attacker.state !== (type === 'punch' ? 'punching' : 'kicking')) return;
    const dist = dist2D(attacker, defender);
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
        screenShake(6); hitFlash('big'); hitFreeze(100);
        spawnImpactParticles(midX, midY, '#ffff00', 15);
        spawnImpactLines(midX, midY, 8);
        spawnComicText(midX, midY, 'COUNTER!');
        playSound('counter');
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
        playSound('block');
        showAnnouncement('BLOCKED!', 400);
        return;
    }

    // Clean hit!
    applyDamage(defender, DMG[type]);
    defender.state = 'hit';
    const hitDur = type === 'punch' ? ANIM_DURATION.hitByPunch : ANIM_DURATION.hitByKick;
    defender.stateTimer = hitDur;
    defender.stateMaxTimer = hitDur;
    defender.hitStun = true;
    defender.hitStunTimer = hitDur + 150;

    screenShake(3);
    hitFlash(type === 'kick' ? 'big' : 'small');
    hitFreeze(type === 'kick' ? 80 : 50);
    const hitColor = type === 'punch' ? '#ffaa00' : '#ff4444';
    spawnImpactParticles(midX, midY, hitColor, type === 'kick' ? 12 : 8);
    spawnImpactLines(midX, midY, type === 'kick' ? 6 : 4);
    spawnComicText(midX, midY, type === 'punch' ? 'POW!' : 'WHAM!');
    playSound(type);
    showAnnouncement(type === 'punch' ? 'PUNCH!' : 'KICK!', 400);
}

function resolveGrapple(attacker, defender) {
    if (attacker.state !== 'grappling') return;
    const gDist = dist2D(attacker, defender);
    if (gDist > RANGE.grapple + 15) return;

    const midX = (attacker.x + defender.x) / 2;
    const midY = (attacker.y + defender.y) / 2;

    applyDamage(defender, DMG.grapple);
    defender.state = 'grounded';
    attacker.state = 'idle';

    screenShake(5); hitFlash('big'); hitFreeze(80);
    spawnImpactParticles(midX, midY, '#ffa500', 12);
    spawnImpactLines(midX, midY, 6);
    spawnComicText(midX, midY, 'GRAB!');
    playSound('grapple');
    showAnnouncement('GRAPPLE!', 600);

    setTimeout(() => startGroundRace(attacker, defender), 400);
}

function startGroundRace(attacker, defender) {
    game.screen = 'groundRace';
    game.groundRace = {
        attacker: attacker.id,
        defender: defender.id,
        timer: 5000, // 5 seconds on the ground
        resolved: false,
        atkCooldown: 0, // attacker punch cooldown
        escapePresses: 0, // defender mash count
        escapeNeeded: 4, // taps needed to escape
        hits: 0, // track punches landed
    };
    showAnnouncement('GROUND & POUND!', 800);
}

function handleGroundRaceInput(player, action) {
    if (!game.groundRace || game.groundRace.resolved) return;
    const gr = game.groundRace;
    const attacker = game.players[gr.attacker - 1];
    const defender = game.players[gr.defender - 1];
    const midX = (attacker.x + defender.x) / 2;
    const midY = (attacker.y + defender.y) / 2;

    // Attacker: punch with cooldown
    if (player.id === gr.attacker && (action === 'punch' || action === 'kick')) {
        if (gr.atkCooldown <= 0) {
            applyDamage(defender, DMG.grapplePunch);
            gr.atkCooldown = 900; // 900ms between ground punches
            gr.hits++;
            screenShake(3); hitFlash('small');
            spawnImpactParticles(midX, midY, '#ff4444', 6);
            spawnComicText(midX, midY, gr.hits === 1 ? 'POW!' : gr.hits === 2 ? 'BAM!' : 'SMASH!');
            playSound('punch');
        }
    }

    // Defender: mash dodge/counter to escape
    if (player.id === gr.defender && (action === 'dodge' || action === 'counter')) {
        gr.escapePresses++;
        if (gr.escapePresses >= gr.escapeNeeded) {
            // Escaped!
            gr.resolved = true;
            spawnComicText(midX, midY, 'ESCAPE!');
            playSound('dodge');
            showAnnouncement('ESCAPED!', 800);
            endGroundFight();
        }
    }
}

function resolveGroundRace() {
    // Timer ran out — ground fight ends automatically
    const gr = game.groundRace;
    if (gr.resolved) return;
    gr.resolved = true;
    showAnnouncement('BREAK!', 800);
    endGroundFight();
}

function endGroundFight() {
    const gr = game.groundRace;
    const attacker = game.players[gr.attacker - 1];
    const defender = game.players[gr.defender - 1];
    setTimeout(() => {
        defender.state = 'idle';
        defender.hitStun = false;
        attacker.state = 'idle';
        game.groundRace = null;
        game.screen = 'playing';
        // Separate players in 2D
        const dx = attacker.x - defender.x;
        const dy = attacker.y - defender.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const midPx = (attacker.x + defender.x) / 2;
        const midPy = (attacker.y + defender.y) / 2;
        attacker.x = midPx + (dx / d) * 40;
        attacker.y = midPy + (dy / d) * 40;
        defender.x = midPx - (dx / d) * 40;
        defender.y = midPy - (dy / d) * 40;
        clampToArena(attacker);
        clampToArena(defender);
    }, 600);
}

function applyDamage(player, amount) {
    player.hp = Math.max(0, player.hp - amount);
    player.flashTimer = 150;
    updateHealthBars();
    if (player.hp <= 0) endRound(getOpponent(player));
}

// ===== HELPERS =====
function showAnnouncement(text, duration) {
    game.announcement.text = text;
    game.announcement.timer = duration;
    const el = document.getElementById('announcement');
    const textEl = el.querySelector('.announce-text');
    if (textEl) textEl.textContent = text;
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

// ===== VICTORY CUTSCENE SYSTEM =====
const CUTSCENE_DURATION = 6500; // ms total
const CUTSCENE_PHASE = { zoomIn: 1500, orbit: 3500, fadeOut: 1500 }; // durations per phase
const CONFETTI_COLORS = ['#ffdd00', '#ff4466', '#00d4ff', '#44ff44', '#ff8800', '#ff66ff', '#ffffff'];

function startVictoryCutscene(winner) {
    const loser = game.players.find(p => p.id !== winner.id);
    // Move winner to arena center, loser off to the side
    winner.x = game.arenaCenterX;
    winner.y = game.arenaCenterY;
    setPlayerState(winner, 'victory');
    // Loser slumps nearby, marked as defeated (X eyes)
    loser.x = game.arenaCenterX + game.arenaRadius * 0.35;
    loser.y = game.arenaCenterY + game.arenaRadius * 0.2;
    loser.defeated = true;
    setPlayerState(loser, 'idle');

    game.cutscene = {
        winnerId: winner.id,
        timer: 0,
        duration: CUTSCENE_DURATION,
    };
    game.confetti = [];
    game.screen = 'cutscene';

    // Hide the announcement so cutscene has clean view
    document.getElementById('announcement').classList.add('hidden');
}

function updateCutscene(dt) {
    if (!game.cutscene) return;
    game.time += dt;
    game.cutscene.timer += dt;

    const cs = game.cutscene;
    const progress = cs.timer / cs.duration;

    // Update winner's animation phases (bob, sway, etc.)
    for (const player of game.players) {
        player.bobPhase += dt * 0.005;
        player.swayPhase += dt * 0.003;
        player.breathePhase += dt * 0.004;
        if (player.blendTimer > 0) player.blendTimer -= dt;
    }

    // Spawn confetti during zoom-in and orbit phases
    if (cs.timer < CUTSCENE_PHASE.zoomIn + CUTSCENE_PHASE.orbit) {
        const spawnRate = cs.timer < CUTSCENE_PHASE.zoomIn ? 3 : 6;
        for (let i = 0; i < spawnRate; i++) {
            game.confetti.push({
                x: game.arenaCenterX + (Math.random() - 0.5) * game.width * 1.5,
                y: game.arenaCenterY - game.height * 0.8 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 1.5 + 0.5,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                w: Math.random() * 6 + 3,
                h: Math.random() * 4 + 2,
                color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                life: 1,
            });
        }
    }

    // Update confetti
    for (let i = game.confetti.length - 1; i >= 0; i--) {
        const c = game.confetti[i];
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.03; // gravity
        c.vx += (Math.random() - 0.5) * 0.1; // wind wobble
        c.rot += c.rotSpeed;
        c.life -= 0.001;
        if (c.life <= 0 || c.y > game.arenaCenterY + game.height) {
            game.confetti.splice(i, 1);
        }
    }

    // End cutscene
    if (cs.timer >= cs.duration) {
        endCutscene();
    }
}

function endCutscene() {
    const winnerId = game.cutscene ? game.cutscene.winnerId : 1;
    game.cutscene = null;
    game.confetti = [];
    game.screen = 'gameover';
    game.matchOver = true;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('winner-text').textContent = `PLAYER ${winnerId} WINS!`;
}

function renderCutscene() {
    const ctx = game.ctx;
    const w = game.width;
    const h = game.height;
    const cs = game.cutscene;
    if (!cs) return;

    const t = cs.timer;
    const winner = game.players[cs.winnerId - 1];
    const loser = game.players.find(p => p.id !== cs.winnerId);

    // Easing helpers
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    // Phase calculations
    const inZoom = t < CUTSCENE_PHASE.zoomIn;
    const inOrbit = t >= CUTSCENE_PHASE.zoomIn && t < CUTSCENE_PHASE.zoomIn + CUTSCENE_PHASE.orbit;
    const inFade = t >= CUTSCENE_PHASE.zoomIn + CUTSCENE_PHASE.orbit;

    let zoomProgress = inZoom ? easeOut(t / CUTSCENE_PHASE.zoomIn) : 1;
    let orbitProgress = inOrbit ? (t - CUTSCENE_PHASE.zoomIn) / CUTSCENE_PHASE.orbit : (inFade ? 1 : 0);
    let fadeProgress = inFade ? easeInOut((t - CUTSCENE_PHASE.zoomIn - CUTSCENE_PHASE.orbit) / CUTSCENE_PHASE.fadeOut) : 0;

    // === DRAW BACKGROUND ===
    const worldDrawFns = [drawStreetBackground, drawRainforestBackground, drawDesertBackground, drawWildWestBackground, drawSnowyBackground, drawGrassBackground, drawCityBackground];
    const worldFn = worldDrawFns[game.settings.selectedWorld] || drawStreetBackground;
    worldFn(ctx, w, h);

    // Darken background
    const bgDim = 0.3 + 0.4 * zoomProgress;
    ctx.fillStyle = `rgba(0, 0, 0, ${bgDim})`;
    ctx.fillRect(0, 0, w, h);

    // === 3D CAMERA TRANSFORM ===
    const camZoom = 1.0 + zoomProgress * 1.2; // zoom from 1x to 2.2x
    const orbitAngle = orbitProgress * Math.PI * 2 * 0.6; // partial orbit (not full 360)
    const orbitSwayX = inOrbit ? Math.sin(orbitAngle) * 80 : 0;
    const orbitSwayY = inOrbit ? Math.cos(orbitAngle) * 20 : 0;
    const skewAmount = inOrbit ? Math.sin(orbitAngle) * 0.04 : 0;

    // Zoom oscillation during orbit
    const zoomOsc = inOrbit ? Math.sin(orbitProgress * Math.PI * 4) * 0.15 : 0;
    const finalZoom = camZoom + zoomOsc;

    ctx.save();

    // Center on winner with camera offset
    ctx.translate(w / 2 + orbitSwayX, h / 2 + orbitSwayY);
    ctx.scale(finalZoom, finalZoom);
    // Subtle perspective skew
    ctx.transform(1, skewAmount, -skewAmount * 0.5, 1, 0, 0);
    ctx.translate(-winner.x, -winner.y);

    // === DRAW ARENA FLOOR (under characters) ===
    const worldGroundColors = ['#333338', '#2d4a1e', '#d4a843', '#8b6914', '#c8d8e8', '#4a8c2a', '#3a3a42'];
    const groundColor = worldGroundColors[game.settings.selectedWorld] || '#333338';
    ctx.save();
    ctx.fillStyle = groundColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(game.arenaCenterX, game.arenaCenterY, game.arenaRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // === SPOTLIGHT ON WINNER ===
    const spotPulse = 0.7 + Math.sin(game.time * 0.004) * 0.15;
    const spotGrad = ctx.createRadialGradient(
        winner.x, winner.y - 40, 10,
        winner.x, winner.y - 20, 180
    );
    spotGrad.addColorStop(0, `rgba(255, 230, 150, ${0.25 * spotPulse})`);
    spotGrad.addColorStop(0.5, `rgba(255, 200, 100, ${0.1 * spotPulse})`);
    spotGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(winner.x - 200, winner.y - 200, 400, 400);

    // === DRAW LOSER (in background, dimmed) ===
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawComicFighter(ctx, loser);
    ctx.restore();

    // === DRAW WINNER (full brightness) ===
    drawComicFighter(ctx, winner);

    // === DRAW CONFETTI (in world space) ===
    for (const c of game.confetti) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        // 3D spin effect: width oscillates
        const spinW = c.w * Math.abs(Math.cos(c.rot * 2));
        ctx.fillStyle = c.color;
        ctx.globalAlpha = Math.min(1, c.life * 3);
        ctx.fillRect(-spinW / 2, -c.h / 2, Math.max(1, spinW), c.h);
        // Shiny highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(-spinW / 2, -c.h / 2, Math.max(1, spinW) * 0.4, c.h * 0.5);
        ctx.restore();
    }

    ctx.restore(); // End camera transform

    // === CONFETTI IN SCREEN SPACE (top layer, not affected by camera) ===
    // Additional screen-space sparkles
    if (inOrbit || inZoom) {
        const sparkleCount = 3;
        for (let i = 0; i < sparkleCount; i++) {
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            const sr = Math.random() * 3 + 1;
            const sa = Math.random() * 0.6;
            ctx.save();
            ctx.fillStyle = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            ctx.globalAlpha = sa;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // === GOLD LIGHT RAYS FROM BOTTOM ===
    if (inOrbit) {
        ctx.save();
        const rayAlpha = 0.06 + Math.sin(game.time * 0.003) * 0.03;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI - Math.PI * 0.5 + Math.sin(game.time * 0.001 + i) * 0.1;
            const rayX = w / 2;
            const rayY = h;
            ctx.save();
            ctx.translate(rayX, rayY);
            ctx.rotate(angle);
            const rayGrad = ctx.createLinearGradient(0, 0, 0, -h);
            rayGrad.addColorStop(0, `rgba(255, 220, 100, ${rayAlpha})`);
            rayGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
            ctx.fillStyle = rayGrad;
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(-5, -h);
            ctx.lineTo(5, -h);
            ctx.lineTo(15, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // === "PLAYER X WINS!" TEXT BANNER ===
    if (t > 800) {
        const textProgress = easeOut(Math.min(1, (t - 800) / 600));
        const textScale = 0.3 + textProgress * 0.7;
        const textAlpha = Math.min(1, textProgress) * (1 - fadeProgress);
        const textY = h * 0.18;

        ctx.save();
        ctx.translate(w / 2, textY);
        ctx.scale(textScale, textScale);

        // Subtle tilt for drama
        const tiltAngle = (1 - textProgress) * 0.15;
        ctx.rotate(tiltAngle);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = textAlpha;

        // Glow
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 30;

        // Large outlined text
        ctx.font = "bold 48px 'Bangers', Impact, sans-serif";
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 8;
        ctx.strokeText(`PLAYER ${cs.winnerId} WINS!`, 0, 0);
        ctx.fillStyle = '#ffdd00';
        ctx.fillText(`PLAYER ${cs.winnerId} WINS!`, 0, 0);

        // Sub text
        ctx.shadowBlur = 0;
        ctx.font = "bold 20px 'Bangers', Impact, sans-serif";
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText('CHAMPION', 0, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText('CHAMPION', 0, 40);

        ctx.restore();
    }

    // === VIGNETTE ===
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, `rgba(0, 0, 0, ${0.4 + fadeProgress * 0.6})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);

    // === FADE TO BLACK ===
    if (inFade) {
        ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress})`;
        ctx.fillRect(0, 0, w, h);
    }
}

// ===== GAME LOOP =====
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (game.screen === 'playing' || game.screen === 'groundRace' || game.screen === 'roundOver') {
        if (vfx.hitFreezeTimer > 0) {
            vfx.hitFreezeTimer -= dt;
            render();
        } else {
            update(dt);
            render();
        }
    } else if (game.screen === 'cutscene') {
        updateCutscene(dt);
        renderCutscene();
    }

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    game.time += dt;

    // Round timer countdown
    if (game.screen === 'playing' && game.roundTimer > 0) {
        game.roundTimer -= dt;
        if (game.roundTimer <= 0) {
            game.roundTimer = 0;
            // Time's up! Player with more HP wins, draw = both lose a round
            const p1 = game.players[0];
            const p2 = game.players[1];
            if (p1.hp > p2.hp) {
                showAnnouncement('TIME UP!', 800);
                setTimeout(() => endRound(p1), 900);
            } else if (p2.hp > p1.hp) {
                showAnnouncement('TIME UP!', 800);
                setTimeout(() => endRound(p2), 900);
            } else {
                // Draw — both take damage, give win to neither, just restart round
                showAnnouncement('TIME UP — DRAW!', 1200);
                setTimeout(() => {
                    game.roundTimer = ROUND_TIME * 1000;
                    resetPlayersForRound();
                    game.screen = 'playing';
                    game.groundRace = null;
                    showAnnouncement(`ROUND ${game.currentRound} — FIGHT!`, 1200);
                }, 1800);
            }
            game.screen = 'roundOver';
        }
    }

    if (game.announcement.timer > 0) {
        game.announcement.timer -= dt;
        if (game.announcement.timer <= 0) {
            document.getElementById('announcement').classList.add('hidden');
        }
    }

    if (game.screen === 'groundRace' && game.groundRace && !game.groundRace.resolved) {
        game.groundRace.timer -= dt;
        if (game.groundRace.atkCooldown > 0) game.groundRace.atkCooldown -= dt;
        if (game.groundRace.timer <= 0) resolveGroundRace();
    }

    // Update players
    for (const player of game.players) {
        const oldState = player.state;

        // Joystick movement (only during active play)
        if (game.screen === 'playing' && player.joystick.active &&
            player.state !== 'hit' && player.state !== 'grounded' && player.state !== 'grappling') {
            const mag = Math.sqrt(player.joystick.dx * player.joystick.dx + player.joystick.dy * player.joystick.dy);
            if (mag > 0.15) {
                player.x += player.joystick.dx * MOVE_SPEED;
                player.y += player.joystick.dy * MOVE_SPEED;
                clampToArena(player);
                player.isMoving = true;
            } else {
                player.isMoving = false;
            }
        } else {
            player.isMoving = false;
        }

        // Walking state management
        if (player.isMoving && (player.state === 'idle' || player.state === 'walking')) {
            if (player.state !== 'walking') setPlayerState(player, 'walking');
        } else if (!player.isMoving && player.state === 'walking') {
            setPlayerState(player, 'idle');
        }

        if (player.stateTimer > 0) {
            player.stateTimer -= dt;
            if (player.stateTimer <= 0 && player.state !== 'blocking' && player.state !== 'grounded' && player.state !== 'victory') {
                player.state = 'idle';
            }
        }

        // Track state changes for blend
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
        if (player.animTimer > 80) { player.animTimer = 0; player.animFrame++; }

        player.breathePhase += dt * 0.003;
        player.swayPhase += dt * 0.002;
        player.bobPhase += dt * 0.004;
    }

    // Update particles
    vfx.particles = vfx.particles.filter(p => {
        p.life -= dt;
        if (p.type === 'spark') { p.x += p.vx; p.y += p.vy; p.vy += 0.1; }
        if (p.type === 'comicText') { p.x += p.vx; p.y += p.vy; }
        return p.life > 0;
    });

    vfx.impactLines = vfx.impactLines.filter(l => { l.life -= dt; return l.life > 0; });
}

// ===== RENDERING =====
function render() {
    const ctx = game.ctx;
    const w = game.width;
    const h = game.height;

    // Draw selected world background
    const worldDrawFns = [drawStreetBackground, drawRainforestBackground, drawDesertBackground, drawWildWestBackground, drawSnowyBackground, drawGrassBackground, drawCityBackground];
    const worldFn = worldDrawFns[game.settings.selectedWorld] || drawStreetBackground;
    worldFn(ctx, w, h);

    // Arena circle boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(game.arenaCenterX, game.arenaCenterY, game.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Close range indicator
    if (game.players.length === 2) {
        const d = dist2D(game.players[0], game.players[1]);
        if (d <= CLOSE_RANGE + 20) {
            const midX = (game.players[0].x + game.players[1].x) / 2;
            const midY = (game.players[0].y + game.players[1].y) / 2;
            const intensity = 1 - (d / (CLOSE_RANGE + 20));
            ctx.save();
            ctx.strokeStyle = `rgba(255, 165, 0, ${intensity * 0.3})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(midX, midY, d / 2 + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    // Arena ground tint per world
    const worldGroundColors = ['#333338', '#2d4a1e', '#d4a843', '#8b6914', '#c8d8e8', '#4a8c2a', '#3a3a42'];
    const groundColor = worldGroundColors[game.settings.selectedWorld] || '#333338';
    ctx.save();
    ctx.fillStyle = groundColor;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(game.arenaCenterX, game.arenaCenterY, game.arenaRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Directional light from left — bright side left, shadow side right
    ctx.save();
    ctx.beginPath();
    ctx.arc(game.arenaCenterX, game.arenaCenterY, game.arenaRadius, 0, Math.PI * 2);
    ctx.clip();
    // Light highlight on left side
    const lightGrad = ctx.createLinearGradient(
        game.arenaCenterX - game.arenaRadius, game.arenaCenterY,
        game.arenaCenterX + game.arenaRadius, game.arenaCenterY
    );
    lightGrad.addColorStop(0, 'rgba(255, 255, 230, 0.12)');
    lightGrad.addColorStop(0.35, 'rgba(255, 255, 230, 0.04)');
    lightGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
    lightGrad.addColorStop(1, 'rgba(0, 0, 20, 0.1)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(game.arenaCenterX - game.arenaRadius, game.arenaCenterY - game.arenaRadius,
                 game.arenaRadius * 2, game.arenaRadius * 2);
    // Soft light spot from upper-left
    const spotGrad = ctx.createRadialGradient(
        game.arenaCenterX - game.arenaRadius * 0.5, game.arenaCenterY - game.arenaRadius * 0.3, 0,
        game.arenaCenterX - game.arenaRadius * 0.5, game.arenaCenterY - game.arenaRadius * 0.3, game.arenaRadius * 0.8
    );
    spotGrad.addColorStop(0, 'rgba(255, 255, 220, 0.08)');
    spotGrad.addColorStop(1, 'rgba(255, 255, 220, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(game.arenaCenterX - game.arenaRadius, game.arenaCenterY - game.arenaRadius,
                 game.arenaRadius * 2, game.arenaRadius * 2);
    ctx.restore();

    drawImpactLines(ctx);

    // Crowd only on Street (0) and City (6)
    const hasCrowd = game.settings.selectedWorld === 0 || game.settings.selectedWorld === 6;
    if (hasCrowd) drawCrowd(ctx, w, h, 'back');

    // Draw players sorted by Y (depth ordering)
    const sorted = [...game.players].sort((a, b) => a.y - b.y);
    for (const player of sorted) {
        drawComicFighter(ctx, player);
    }

    if (hasCrowd) drawCrowd(ctx, w, h, 'front');
    drawParticles(ctx);

    if (game.screen === 'groundRace' && game.groundRace && !game.groundRace.resolved) {
        drawGroundRaceUI(ctx, w, h);
    }

    // Round timer display
    const secs = Math.ceil(game.roundTimer / 1000);
    const timerText = secs < 0 ? '0' : String(secs);
    const isLow = secs <= 10;
    ctx.save();
    // Background pill
    const tw = ctx.measureText ? 40 : 40;
    ctx.fillStyle = isLow ? 'rgba(180, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isLow ? 'rgba(255, 80, 80, 0.7)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Timer text
    ctx.font = "bold 18px 'Bangers', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLow ? '#ff4444' : '#ffdd00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(timerText, w / 2, h / 2);
    ctx.fillText(timerText, w / 2, h / 2);
    // Pulse effect when low
    if (isLow && secs > 0) {
        const pulse = Math.sin(game.time * 0.01) * 0.3 + 0.3;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 26, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

// ===== STREET BACKGROUND =====
function drawStreetBackground(ctx, w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    skyGrad.addColorStop(0, '#1a0533');
    skyGrad.addColorStop(0.3, '#4a1942');
    skyGrad.addColorStop(0.55, '#c84b31');
    skyGrad.addColorStop(0.8, '#ecab5e');
    skyGrad.addColorStop(1, '#f5d5a0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    const sunY = h * 0.3;
    const sunGrad = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, w * 0.4);
    sunGrad.addColorStop(0, 'rgba(255, 200, 80, 0.4)');
    sunGrad.addColorStop(0.5, 'rgba(255, 140, 50, 0.15)');
    sunGrad.addColorStop(1, 'rgba(255, 100, 50, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h * 0.5);

    drawBuilding(ctx, -5, h * 0.05, w * 0.22, h * 0.95, '#1a1225', '#251a30', w, h, 'left');
    drawBuilding(ctx, w * 0.78, h * 0.1, w * 0.27, h * 0.9, '#1a1225', '#251a30', w, h, 'right');

    const streetLeft = w * 0.18;
    const streetRight = w * 0.82;
    const streetW = streetRight - streetLeft;

    const asphaltGrad = ctx.createLinearGradient(0, 0, 0, h);
    asphaltGrad.addColorStop(0, '#2a2a30');
    asphaltGrad.addColorStop(0.5, '#333338');
    asphaltGrad.addColorStop(1, '#2a2a30');
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(streetLeft, 0, streetW, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 80; i++) {
        const sx = streetLeft + Math.random() * streetW;
        const sy = Math.random() * h;
        ctx.fillRect(sx, sy, 2, 2);
    }

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

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    drawCrack(ctx, streetLeft + streetW * 0.3, h * 0.2, 30, 0.5);
    drawCrack(ctx, streetLeft + streetW * 0.7, h * 0.6, 25, -0.3);
    drawCrack(ctx, streetLeft + streetW * 0.5, h * 0.8, 20, 0.8);

    const manholeY = h * 0.45;
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 80, 90, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, manholeY, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 8, manholeY); ctx.lineTo(w / 2 + 8, manholeY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, manholeY - 8); ctx.lineTo(w / 2, manholeY + 8); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(100, 95, 85, 0.3)';
    ctx.fillRect(streetLeft - 3, 0, 3, h);
    ctx.fillRect(streetRight, 0, 3, h);

    const reflectGrad = ctx.createLinearGradient(0, 0, 0, h);
    reflectGrad.addColorStop(0, 'rgba(255, 150, 50, 0.06)');
    reflectGrad.addColorStop(0.5, 'rgba(255, 100, 30, 0.03)');
    reflectGrad.addColorStop(1, 'rgba(200, 80, 30, 0.06)');
    ctx.fillStyle = reflectGrad;
    ctx.fillRect(streetLeft, 0, streetW, h);
}

function drawBuilding(ctx, x, y, w, h, darkColor, lightColor, canvasW, canvasH, side) {
    ctx.fillStyle = darkColor;
    ctx.strokeStyle = '#0d0a15';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    if (side === 'left') {
        ctx.fillStyle = 'rgba(255, 140, 60, 0.08)';
        ctx.fillRect(x + w - 8, y, 8, h);
    } else {
        ctx.fillStyle = 'rgba(255, 140, 60, 0.08)';
        ctx.fillRect(x, y, 8, h);
    }

    const winW = 10, winH = 14, winGapX = 16, winGapY = 22;
    const winStartX = side === 'left' ? x + 6 : x + 5;
    const winStartY = y + 10;
    const cols = Math.floor((w - 10) / winGapX);
    const rows = Math.floor((h - 20) / winGapY);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const wx = winStartX + col * winGapX;
            const wy = winStartY + row * winGapY;
            const lit = Math.sin(wx * 13 + wy * 7) > 0.1;
            if (lit) {
                const warmth = (Math.sin(wx * 3 + wy * 5) + 1) / 2;
                ctx.fillStyle = `rgba(255, ${Math.floor(180 + warmth * 60)}, ${Math.floor(80 + warmth * 40)}, 0.7)`;
                ctx.fillRect(wx, wy, winW, winH);
                ctx.fillStyle = `rgba(255, ${Math.floor(180 + warmth * 60)}, ${Math.floor(80 + warmth * 40)}, 0.1)`;
                ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);
            } else {
                ctx.fillStyle = 'rgba(20, 18, 30, 0.8)';
                ctx.fillRect(wx, wy, winW, winH);
            }
            ctx.strokeStyle = 'rgba(60, 55, 70, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, winW, winH);
        }
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const wx = winStartX + col * winGapX;
            const wy = winStartY + row * winGapY;
            const hasPerson = Math.sin(wx * 7 + wy * 11) > 0.6;
            const lit = Math.sin(wx * 13 + wy * 7) > 0.1;
            if (hasPerson && lit) {
                ctx.fillStyle = 'rgba(30, 20, 40, 0.6)';
                const px = wx + winW / 2;
                const py = wy + winH - 3;
                ctx.beginPath(); ctx.arc(px, py - 6, 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(px - 2, py - 4, 4, 5);
            }
        }
    }

    ctx.fillStyle = '#15101f';
    ctx.fillRect(x - 2, y - 3, w + 4, 5);

    if (side === 'left' && w > 30) {
        ctx.strokeStyle = 'rgba(80, 75, 90, 0.3)';
        ctx.lineWidth = 1;
        for (let fy = y + 30; fy < y + h; fy += 45) {
            ctx.beginPath(); ctx.moveTo(x + w - 2, fy); ctx.lineTo(x + w + 8, fy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + w + 8, fy); ctx.lineTo(x + w + 8, fy - 12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + w + 3, fy); ctx.lineTo(x + w + 3, fy + 45); ctx.stroke();
        }
    }
}

function drawCrack(ctx, startX, startY, length, angle) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let cx = startX, cy = startY;
    for (let i = 0; i < length; i += 4) {
        cx += Math.cos(angle) * 4 + (Math.sin(i * 2) * 2);
        cy += Math.sin(angle) * 4 + (Math.cos(i * 3) * 1.5);
        ctx.lineTo(cx, cy);
    }
    ctx.stroke();
}

// ===== RAINFOREST BACKGROUND =====
function drawRainforestBackground(ctx, w, h) {
    // Misty green sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0a1f0a');
    skyGrad.addColorStop(0.3, '#1a3a1a');
    skyGrad.addColorStop(0.6, '#2a4a25');
    skyGrad.addColorStop(1, '#1a2a15');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // Mist layers
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(150, 200, 150, ${0.03 + i * 0.01})`;
        ctx.fillRect(0, h * (0.2 + i * 0.15), w, h * 0.1);
    }
    // Tree trunks on left
    for (let i = 0; i < 3; i++) {
        const tx = w * 0.02 + i * w * 0.06;
        ctx.fillStyle = '#3d2b1f';
        ctx.fillRect(tx, h * 0.05, w * 0.04, h * 0.95);
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1;
        ctx.strokeRect(tx, h * 0.05, w * 0.04, h * 0.95);
        // Canopy
        ctx.fillStyle = '#1a5c1a';
        ctx.beginPath(); ctx.arc(tx + w * 0.02, h * 0.08, w * 0.06 + i * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a7a2a';
        ctx.beginPath(); ctx.arc(tx + w * 0.015, h * 0.06, w * 0.04, 0, Math.PI * 2); ctx.fill();
    }
    // Tree trunks on right
    for (let i = 0; i < 3; i++) {
        const tx = w * 0.82 + i * w * 0.06;
        ctx.fillStyle = '#3d2b1f';
        ctx.fillRect(tx, h * 0.08, w * 0.04, h * 0.92);
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1;
        ctx.strokeRect(tx, h * 0.08, w * 0.04, h * 0.92);
        ctx.fillStyle = '#1a5c1a';
        ctx.beginPath(); ctx.arc(tx + w * 0.02, h * 0.1, w * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    // Hanging vines
    ctx.strokeStyle = '#2a6a2a'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const vx = w * 0.05 + i * w * 0.03;
        const vLen = h * (0.15 + Math.sin(i * 2.3) * 0.1);
        ctx.beginPath(); ctx.moveTo(vx, 0);
        ctx.quadraticCurveTo(vx + Math.sin(game.time * 0.002 + i) * 5, vLen * 0.5, vx + Math.sin(game.time * 0.002 + i) * 8, vLen);
        ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
        const vx = w * 0.82 + i * w * 0.035;
        const vLen = h * (0.12 + Math.sin(i * 3.1) * 0.08);
        ctx.beginPath(); ctx.moveTo(vx, 0);
        ctx.quadraticCurveTo(vx - Math.sin(game.time * 0.002 + i) * 5, vLen * 0.5, vx - Math.sin(game.time * 0.002 + i) * 8, vLen);
        ctx.stroke();
    }
    // Ground moss
    ctx.fillStyle = '#2d4a1e';
    ctx.fillRect(w * 0.18, 0, w * 0.64, h);
    // Flowers on edges
    const flowerColors = ['#ff4466', '#ffcc00', '#ff66aa', '#ffaa44'];
    for (let i = 0; i < 12; i++) {
        const fx = Math.sin(i * 3.7 + 1) > 0 ? w * 0.04 + Math.sin(i * 2.1) * w * 0.1 : w * 0.86 + Math.sin(i * 1.9) * w * 0.1;
        const fy = h * 0.1 + (i / 12) * h * 0.8;
        ctx.fillStyle = flowerColors[i % 4];
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Fireflies (animated)
    ctx.fillStyle = 'rgba(255, 255, 100, 0.6)';
    for (let i = 0; i < 8; i++) {
        const fx = w * 0.2 + Math.sin(game.time * 0.001 + i * 1.7) * w * 0.25;
        const fy = h * 0.2 + Math.sin(game.time * 0.0015 + i * 2.3) * h * 0.3;
        const glow = 2 + Math.sin(game.time * 0.005 + i) * 1;
        ctx.beginPath(); ctx.arc(fx, fy, glow, 0, Math.PI * 2); ctx.fill();
    }
}

// ===== DESERT BACKGROUND =====
function drawDesertBackground(ctx, w, h) {
    // Hot sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#ff8800');
    skyGrad.addColorStop(0.3, '#ffaa33');
    skyGrad.addColorStop(0.7, '#ffe088');
    skyGrad.addColorStop(1, '#d4a843');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // Sun
    ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.12, w * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 200, 0.15)';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.12, w * 0.2, 0, Math.PI * 2); ctx.fill();
    // Sand ground
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(0, h * 0.35, w, h * 0.65);
    // Sand dunes on left
    ctx.fillStyle = '#c89830';
    ctx.beginPath(); ctx.moveTo(0, h * 0.3);
    ctx.quadraticCurveTo(w * 0.1, h * 0.15, w * 0.2, h * 0.35);
    ctx.lineTo(0, h * 0.4); ctx.closePath(); ctx.fill();
    // Dune shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.moveTo(w * 0.05, h * 0.3);
    ctx.quadraticCurveTo(w * 0.12, h * 0.22, w * 0.2, h * 0.35);
    ctx.lineTo(w * 0.2, h * 0.4); ctx.lineTo(0, h * 0.4); ctx.closePath(); ctx.fill();
    // Dunes on right
    ctx.fillStyle = '#c89830';
    ctx.beginPath(); ctx.moveTo(w, h * 0.25);
    ctx.quadraticCurveTo(w * 0.88, h * 0.12, w * 0.78, h * 0.3);
    ctx.lineTo(w, h * 0.4); ctx.closePath(); ctx.fill();
    // Cacti on borders
    const drawCactus = (cx, cy, size) => {
        ctx.fillStyle = '#2a7a2a'; ctx.strokeStyle = '#1a5a1a'; ctx.lineWidth = 2;
        ctx.fillRect(cx - size * 0.15, cy - size, size * 0.3, size);
        ctx.strokeRect(cx - size * 0.15, cy - size, size * 0.3, size);
        // Arms
        ctx.fillRect(cx - size * 0.45, cy - size * 0.7, size * 0.3, size * 0.15);
        ctx.fillRect(cx - size * 0.45, cy - size * 0.7, size * 0.15, size * 0.4);
        ctx.fillRect(cx + size * 0.15, cy - size * 0.5, size * 0.3, size * 0.15);
        ctx.fillRect(cx + size * 0.3, cy - size * 0.5, size * 0.15, size * 0.35);
    };
    drawCactus(w * 0.08, h * 0.55, 40);
    drawCactus(w * 0.92, h * 0.48, 35);
    drawCactus(w * 0.05, h * 0.8, 25);
    // Skull
    ctx.fillStyle = '#e8dcc8'; ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(w * 0.88, h * 0.75, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(w * 0.86, h * 0.74, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.90, h * 0.74, 2, 0, Math.PI * 2); ctx.fill();
    // Sand ripples in arena
    ctx.strokeStyle = 'rgba(180, 140, 50, 0.15)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const ry = h * 0.4 + i * h * 0.07;
        ctx.beginPath(); ctx.moveTo(w * 0.2, ry);
        ctx.quadraticCurveTo(w * 0.5, ry + 4, w * 0.8, ry);
        ctx.stroke();
    }
}

// ===== WILD WEST BACKGROUND =====
function drawWildWestBackground(ctx, w, h) {
    // Dusty sunset
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#6b3a0a');
    skyGrad.addColorStop(0.4, '#c87830');
    skyGrad.addColorStop(0.8, '#e8a050');
    skyGrad.addColorStop(1, '#8b6914');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // Dirt ground
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(0, h * 0.35, w, h * 0.65);
    // Saloon building LEFT
    ctx.fillStyle = '#5a3a1a'; ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 2;
    ctx.fillRect(0, h * 0.05, w * 0.2, h * 0.95);
    ctx.strokeRect(0, h * 0.05, w * 0.2, h * 0.95);
    // Wooden planks
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) ctx.beginPath(), ctx.moveTo(0, h * 0.05 + i * h * 0.048), ctx.lineTo(w * 0.2, h * 0.05 + i * h * 0.048), ctx.stroke();
    // SALOON sign
    ctx.fillStyle = '#2a1a08'; ctx.fillRect(w * 0.02, h * 0.08, w * 0.16, h * 0.05);
    ctx.fillStyle = '#ffcc44'; ctx.font = "bold 10px 'Bangers', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('SALOON', w * 0.1, h * 0.115);
    // Swinging doors
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(w * 0.06, h * 0.4, w * 0.04, h * 0.12);
    ctx.fillRect(w * 0.11, h * 0.4, w * 0.04, h * 0.12);
    // Saloon building RIGHT
    ctx.fillStyle = '#5a3a1a'; ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 2;
    ctx.fillRect(w * 0.8, h * 0.08, w * 0.2, h * 0.92);
    ctx.strokeRect(w * 0.8, h * 0.08, w * 0.2, h * 0.92);
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) ctx.beginPath(), ctx.moveTo(w * 0.8, h * 0.08 + i * h * 0.048), ctx.lineTo(w, h * 0.08 + i * h * 0.048), ctx.stroke();
    // Barrels
    ctx.fillStyle = '#6a4a20'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(w * 0.22, h * 0.58, 8, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w * 0.78, h * 0.52, 7, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Barrel bands
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w * 0.22 - 7, h * 0.55); ctx.lineTo(w * 0.22 + 7, h * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.22 - 7, h * 0.61); ctx.lineTo(w * 0.22 + 7, h * 0.61); ctx.stroke();
    // Hitching post
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(w * 0.75, h * 0.42, 3, h * 0.15);
    ctx.fillRect(w * 0.72, h * 0.42, 10, 3);
    // Tumbleweed
    ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 1;
    const twX = w * 0.25 + Math.sin(game.time * 0.001) * 10;
    ctx.beginPath(); ctx.arc(twX, h * 0.85, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(twX, h * 0.85, 3, 0, Math.PI * 2); ctx.stroke();
}

// ===== SNOWY MOUNTAINS BACKGROUND =====
function drawSnowyBackground(ctx, w, h) {
    // Cold blue sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#1a2a4a');
    skyGrad.addColorStop(0.4, '#4a6a8a');
    skyGrad.addColorStop(0.8, '#8ab0d0');
    skyGrad.addColorStop(1, '#c8d8e8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // Distant mountains
    ctx.fillStyle = '#8898a8';
    ctx.beginPath(); ctx.moveTo(0, h * 0.35); ctx.lineTo(w * 0.15, h * 0.1); ctx.lineTo(w * 0.3, h * 0.3);
    ctx.lineTo(w * 0.5, h * 0.08); ctx.lineTo(w * 0.7, h * 0.28);
    ctx.lineTo(w * 0.85, h * 0.12); ctx.lineTo(w, h * 0.3);
    ctx.lineTo(w, h * 0.4); ctx.lineTo(0, h * 0.4); ctx.closePath(); ctx.fill();
    // Snow caps
    ctx.fillStyle = '#e8f0f8';
    ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.15); ctx.lineTo(w * 0.15, h * 0.1); ctx.lineTo(w * 0.18, h * 0.15); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.13); ctx.lineTo(w * 0.5, h * 0.08); ctx.lineTo(w * 0.54, h * 0.13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.82, h * 0.16); ctx.lineTo(w * 0.85, h * 0.12); ctx.lineTo(w * 0.88, h * 0.16); ctx.closePath(); ctx.fill();
    // Snow ground
    ctx.fillStyle = '#c8d8e8';
    ctx.fillRect(0, h * 0.35, w, h * 0.65);
    // Pine trees left
    for (let i = 0; i < 4; i++) {
        const tx = w * 0.02 + i * w * 0.05;
        const th = 40 + Math.sin(i * 2) * 15;
        const tby = h * 0.2 + i * h * 0.18;
        ctx.fillStyle = '#2a4a2a';
        ctx.beginPath(); ctx.moveTo(tx, tby); ctx.lineTo(tx + 12, tby + th); ctx.lineTo(tx - 12, tby + th); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx, tby - th * 0.3); ctx.lineTo(tx + 10, tby + th * 0.3); ctx.lineTo(tx - 10, tby + th * 0.3); ctx.closePath(); ctx.fill();
        // Snow on tree
        ctx.fillStyle = '#e8f0f8';
        ctx.beginPath(); ctx.moveTo(tx - 6, tby + 3); ctx.lineTo(tx + 6, tby + 3); ctx.lineTo(tx, tby - 4); ctx.closePath(); ctx.fill();
        // Trunk
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(tx - 2, tby + th - 2, 4, 8);
    }
    // Pine trees right
    for (let i = 0; i < 4; i++) {
        const tx = w * 0.88 + i * w * 0.04;
        const th = 35 + Math.sin(i * 3) * 10;
        const tby = h * 0.15 + i * h * 0.2;
        ctx.fillStyle = '#2a4a2a';
        ctx.beginPath(); ctx.moveTo(tx, tby); ctx.lineTo(tx + 10, tby + th); ctx.lineTo(tx - 10, tby + th); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8f0f8';
        ctx.beginPath(); ctx.moveTo(tx - 5, tby + 3); ctx.lineTo(tx + 5, tby + 3); ctx.lineTo(tx, tby - 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(tx - 2, tby + th - 2, 4, 8);
    }
    // Snowflakes (animated)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 30; i++) {
        const sx = (w * 0.1 + i * w * 0.03 + game.time * 0.02 * (0.5 + Math.sin(i) * 0.3)) % w;
        const sy = (h * 0.05 + i * h * 0.035 + game.time * 0.03 * (0.3 + Math.cos(i * 1.5) * 0.2)) % h;
        const sr = 1 + Math.sin(i * 2.7) * 0.5;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    // Sparkle dots on ground
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 15; i++) {
        const sx = w * 0.2 + Math.sin(i * 4.3) * w * 0.3;
        const sy = h * 0.4 + Math.sin(i * 3.1) * h * 0.25;
        if (Math.sin(game.time * 0.003 + i * 2) > 0.5) {
            ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// ===== GRASS PLAINS BACKGROUND =====
function drawGrassBackground(ctx, w, h) {
    // Bright blue sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    skyGrad.addColorStop(0, '#3a8aff');
    skyGrad.addColorStop(0.5, '#6ab0ff');
    skyGrad.addColorStop(1, '#a0d0ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const cloudX = (game.time * 0.005) % (w + 100) - 50;
    ctx.beginPath(); ctx.arc(cloudX, h * 0.1, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cloudX + 15, h * 0.09, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cloudX - 12, h * 0.11, 12, 0, Math.PI * 2); ctx.fill();
    const cloudX2 = (game.time * 0.003 + w * 0.5) % (w + 100) - 50;
    ctx.beginPath(); ctx.arc(cloudX2, h * 0.18, 15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cloudX2 + 12, h * 0.17, 11, 0, Math.PI * 2); ctx.fill();
    // Rolling hills
    ctx.fillStyle = '#5ca838';
    ctx.beginPath(); ctx.moveTo(0, h * 0.35);
    ctx.quadraticCurveTo(w * 0.25, h * 0.25, w * 0.5, h * 0.33);
    ctx.quadraticCurveTo(w * 0.75, h * 0.28, w, h * 0.35);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a8c2a';
    ctx.fillRect(0, h * 0.38, w, h * 0.62);
    // Grass stripes
    ctx.fillStyle = 'rgba(70, 160, 40, 0.2)';
    for (let i = 0; i < 10; i++) {
        ctx.fillRect(0, h * 0.38 + i * h * 0.06, w, h * 0.02);
    }
    // Lone tree on left
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(w * 0.08 - 3, h * 0.2, 6, h * 0.25);
    ctx.fillStyle = '#3a8a2a';
    ctx.beginPath(); ctx.arc(w * 0.08, h * 0.18, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4aaa3a';
    ctx.beginPath(); ctx.arc(w * 0.075, h * 0.16, 12, 0, Math.PI * 2); ctx.fill();
    // Tall grass on edges (animated sway)
    ctx.strokeStyle = '#5aaa38'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 15; i++) {
        const gx = w * 0.02 + i * w * 0.012;
        const gy = h * 0.3 + Math.sin(i * 1.3) * h * 0.2;
        const sway = Math.sin(game.time * 0.003 + i * 0.7) * 4;
        ctx.beginPath(); ctx.moveTo(gx, gy + 15); ctx.quadraticCurveTo(gx + sway, gy + 5, gx + sway * 1.5, gy); ctx.stroke();
    }
    for (let i = 0; i < 15; i++) {
        const gx = w * 0.84 + i * w * 0.012;
        const gy = h * 0.25 + Math.sin(i * 1.7) * h * 0.2;
        const sway = Math.sin(game.time * 0.003 + i * 0.9) * 4;
        ctx.beginPath(); ctx.moveTo(gx, gy + 15); ctx.quadraticCurveTo(gx + sway, gy + 5, gx + sway * 1.5, gy); ctx.stroke();
    }
    // Wildflowers
    const fColors = ['#ff4466', '#ffcc00', '#aa44ff', '#ff8833'];
    for (let i = 0; i < 20; i++) {
        const fx = w * 0.22 + Math.sin(i * 3.7) * w * 0.28;
        const fy = h * 0.42 + Math.sin(i * 2.3) * h * 0.25;
        ctx.fillStyle = fColors[i % 4];
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Butterflies (animated figure-8)
    ctx.fillStyle = 'rgba(255, 200, 50, 0.7)';
    for (let i = 0; i < 3; i++) {
        const bx = w * 0.3 + Math.sin(game.time * 0.002 + i * 2) * w * 0.15;
        const by = h * 0.3 + Math.sin(game.time * 0.004 + i * 2) * h * 0.1;
        ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + 3, by - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    }
}

// ===== CITY BACKGROUND =====
function drawCityBackground(ctx, w, h) {
    // Night sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    skyGrad.addColorStop(0, '#05051a');
    skyGrad.addColorStop(0.5, '#0a0a2a');
    skyGrad.addColorStop(1, '#15152a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 30; i++) {
        const sx = Math.sin(i * 7.3 + 2) * w * 0.5 + w * 0.5;
        const sy = Math.sin(i * 4.1 + 1) * h * 0.15 + h * 0.08;
        const twinkle = Math.sin(game.time * 0.004 + i * 2) > 0.3 ? 1 : 0.4;
        ctx.globalAlpha = twinkle;
        ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Moon
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.08, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 200, 0.1)';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.08, 30, 0, Math.PI * 2); ctx.fill();
    // Ground
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(0, h * 0.3, w, h * 0.7);
    // Skyscrapers LEFT
    const bldgColors = ['#12122a', '#15152e', '#0e0e20', '#181835'];
    for (let i = 0; i < 4; i++) {
        const bx = i * w * 0.055;
        const bh = h * (0.5 + Math.sin(i * 2.3) * 0.2);
        const by = h * 0.95 - bh;
        ctx.fillStyle = bldgColors[i % 4];
        ctx.fillRect(bx, by, w * 0.05, bh);
        ctx.strokeStyle = '#0a0a15'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, w * 0.05, bh);
        // Windows
        for (let wy = by + 5; wy < by + bh - 5; wy += 10) {
            for (let wx = bx + 3; wx < bx + w * 0.05 - 3; wx += 7) {
                const lit = Math.sin(wx * 11 + wy * 7) > 0;
                ctx.fillStyle = lit ? 'rgba(255, 220, 120, 0.6)' : 'rgba(20, 20, 40, 0.5)';
                ctx.fillRect(wx, wy, 4, 6);
            }
        }
    }
    // Skyscrapers RIGHT
    for (let i = 0; i < 4; i++) {
        const bx = w * 0.78 + i * w * 0.055;
        const bh = h * (0.45 + Math.sin(i * 3.1) * 0.2);
        const by = h * 0.95 - bh;
        ctx.fillStyle = bldgColors[(i + 2) % 4];
        ctx.fillRect(bx, by, w * 0.05, bh);
        ctx.strokeStyle = '#0a0a15'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, w * 0.05, bh);
        for (let wy = by + 5; wy < by + bh - 5; wy += 10) {
            for (let wx = bx + 3; wx < bx + w * 0.05 - 3; wx += 7) {
                const lit = Math.sin(wx * 13 + wy * 5) > 0.1;
                ctx.fillStyle = lit ? 'rgba(255, 200, 100, 0.5)' : 'rgba(20, 20, 40, 0.5)';
                ctx.fillRect(wx, wy, 4, 6);
            }
        }
    }
    // Neon signs
    const neonPulse = Math.sin(game.time * 0.004) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 50, 100, ${neonPulse * 0.5})`;
    ctx.fillRect(w * 0.04, h * 0.3, w * 0.08, h * 0.02);
    ctx.fillStyle = `rgba(50, 100, 255, ${neonPulse * 0.4})`;
    ctx.fillRect(w * 0.87, h * 0.35, w * 0.06, h * 0.015);
    // Street lamps
    ctx.fillStyle = '#333'; ctx.fillRect(w * 0.22 - 1, h * 0.2, 3, h * 0.35);
    ctx.fillStyle = '#555'; ctx.fillRect(w * 0.22 - 4, h * 0.2, 9, 3);
    // Lamp glow
    const lampGrad = ctx.createRadialGradient(w * 0.22, h * 0.22, 0, w * 0.22, h * 0.22, 30);
    lampGrad.addColorStop(0, 'rgba(255, 220, 120, 0.3)');
    lampGrad.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = lampGrad;
    ctx.fillRect(w * 0.22 - 30, h * 0.22 - 30, 60, 60);
    // Right lamp
    ctx.fillStyle = '#333'; ctx.fillRect(w * 0.78 - 1, h * 0.25, 3, h * 0.3);
    ctx.fillStyle = '#555'; ctx.fillRect(w * 0.78 - 4, h * 0.25, 9, 3);
    const lampGrad2 = ctx.createRadialGradient(w * 0.78, h * 0.27, 0, w * 0.78, h * 0.27, 30);
    lampGrad2.addColorStop(0, 'rgba(255, 220, 120, 0.3)');
    lampGrad2.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = lampGrad2;
    ctx.fillRect(w * 0.78 - 30, h * 0.27 - 30, 60, 60);
    // Steam vents
    ctx.fillStyle = 'rgba(200, 200, 220, 0.06)';
    for (let i = 0; i < 5; i++) {
        const sx = w * 0.25 + Math.sin(i * 2.7) * w * 0.03;
        const sy = h * 0.5 - Math.sin(game.time * 0.002 + i) * 15 - i * 8;
        ctx.beginPath(); ctx.arc(sx, sy, 6 + i * 2, 0, Math.PI * 2); ctx.fill();
    }
    // Concrete grid on ground
    ctx.strokeStyle = 'rgba(80, 80, 90, 0.15)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.35 + i * h * 0.08); ctx.lineTo(w * 0.8, h * 0.35 + i * h * 0.08); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(w * 0.2 + i * w * 0.12, h * 0.35); ctx.lineTo(w * 0.2 + i * w * 0.12, h); ctx.stroke();
    }
}

// ===== CROWD =====
const crowdPeople = [];
function generateCrowd(w, h) {
    crowdPeople.length = 0;
    const streetLeft = w * 0.18;
    const streetRight = w * 0.82;

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
    if (crowdPeople.length === 0) generateCrowd(w, h);
    const t = game.time * 0.003;

    for (const p of crowdPeople) {
        if (p.layer !== layer) continue;
        const bob = p.cheering ? Math.sin(t + p.bobPhase) * 3 : Math.sin(t * 0.5 + p.bobPhase) * 1;
        const armWave = p.cheering ? Math.sin(t * 3 + p.bobPhase) * 8 : 0;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        const bx = p.x;
        const by = p.y + bob;
        const bodyH = p.height;

        ctx.beginPath();
        ctx.moveTo(bx - 5, by); ctx.lineTo(bx + 5, by);
        ctx.lineTo(bx + 6, by + bodyH); ctx.lineTo(bx - 6, by + bodyH);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#e8c4a0';
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, by - p.headR - 1, p.headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#111';
        ctx.fillRect(bx - 2, by - p.headR - 2, 1.5, 1.5);
        ctx.fillRect(bx + 1, by - p.headR - 2, 1.5, 1.5);

        if (p.cheering) {
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(bx, by - p.headR + 2, 1.5, 0, Math.PI); ctx.fill();
        }

        ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        if (p.cheering) {
            ctx.beginPath(); ctx.moveTo(bx - 5, by + 4); ctx.lineTo(bx - 10, by - 6 + armWave); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + 5, by + 4); ctx.lineTo(bx + 10, by + 8); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.moveTo(bx - 5, by + 4); ctx.lineTo(bx - 8, by + bodyH - 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + 5, by + 4); ctx.lineTo(bx + 8, by + bodyH - 2); ctx.stroke();
        }

        ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
        if (p.cheering) {
            ctx.beginPath(); ctx.moveTo(bx - 5, by + 4); ctx.lineTo(bx - 10, by - 6 + armWave); ctx.stroke();
            ctx.fillStyle = '#e8c4a0';
            ctx.beginPath(); ctx.arc(bx - 10, by - 6 + armWave, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
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
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10 + line.len, 0); ctx.stroke();
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
            ctx.font = `bold ${p.size}px 'Bangers', Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
            ctx.strokeText(p.text, 0, 0);
            ctx.fillStyle = '#ffdd00';
            ctx.fillText(p.text, 0, 0);
            ctx.restore();
        }
    }
}

// ===== STREET FIGHTER STYLE CHARACTER DRAWING =====

function getPose(state, player, faceDir) {
    const t = player.stateTimer;
    const maxT = player.stateMaxTimer || 1;
    const progress = maxT > 0 ? 1 - (t / maxT) : 1;

    const bb = Math.sin(player.bobPhase) * 2.5;
    const as = Math.sin(player.swayPhase) * 3;
    const ht = Math.sin(player.breathePhase) * 1.5;
    const ls = Math.sin(player.bobPhase + 1) * 1.5;
    const guardBob = Math.sin(player.bobPhase * 1.3) * 1.5;

    switch (state) {
        case 'idle': {
            // Weight shift + guard stance
            const weightShift = Math.sin(player.swayPhase * 0.7) * 1.5;
            return {
                bodyBob: bb, bodyLean: 0, headOff: { x: 0, y: ht },
                lArm: { x: -18 + as * 0.4, y: 12 + as * 0.3 + bb }, rArm: { x: 16 - as * 0.4, y: 10 - as * 0.3 + bb },
                lElbow: { x: -14, y: 6 + bb }, rElbow: { x: 14, y: 5 + bb },
                lLeg: { x: -12 - ls + weightShift, y: 28 }, rLeg: { x: 12 + ls + weightShift, y: 28 },
                lKnee: { x: -10 + weightShift * 0.5, y: 15 }, rKnee: { x: 10 + weightShift * 0.5, y: 15 },
                torsoTwist: weightShift * 0.4,
            };
        }
        case 'walking': {
            const legSwing = Math.sin(game.time * 0.012) * 14;
            const armSwing = Math.sin(game.time * 0.012) * 10;
            // Foot plant bounce — dip when leg at extreme, rise at center
            const plantBounce = Math.abs(Math.sin(game.time * 0.012)) * 2 - 1;
            const headLag = Math.sin(game.time * 0.012 + 0.3) * 0.8;
            return {
                bodyBob: plantBounce, bodyLean: 0,
                headOff: { x: 0, y: headLag },
                lArm: { x: -16 + armSwing, y: 14 - armSwing * 0.4 }, rArm: { x: 16 - armSwing, y: 14 + armSwing * 0.4 },
                lElbow: { x: -12 + armSwing * 0.6, y: 7 }, rElbow: { x: 12 - armSwing * 0.6, y: 7 },
                lLeg: { x: -10 + legSwing, y: 28 }, rLeg: { x: 10 - legSwing, y: 28 },
                lKnee: { x: -8 + legSwing * 0.5, y: 13 - Math.abs(legSwing) * 0.15 }, rKnee: { x: 8 - legSwing * 0.5, y: 13 - Math.abs(legSwing) * 0.15 },
                torsoTwist: armSwing * 0.6,
            };
        }
        case 'victory': {
            // Alternating arm pumps
            const pump = Math.sin(game.time * 0.006) * 4;
            const altPump = Math.sin(game.time * 0.006 + Math.PI) * 3;
            const hop = Math.abs(Math.sin(game.time * 0.008)) * 3;
            return {
                bodyBob: hop, bodyLean: 0,
                headOff: { x: 0, y: -4 + hop },
                lArm: { x: -22, y: -12 + pump }, rArm: { x: 22, y: -8 + altPump },
                lElbow: { x: -18, y: -6 + pump * 0.5 }, rElbow: { x: 18, y: -2 + altPump * 0.5 },
                lLeg: { x: -14, y: 28 }, rLeg: { x: 14, y: 28 },
                lKnee: { x: -12, y: 14 }, rKnee: { x: 12, y: 14 },
                torsoTwist: pump * 0.3,
            };
        }
        case 'punching': {
            // Windup → explosive extension → recovery
            const windPhase = progress < 0.3 ? progress / 0.3 : 0;
            const hitPhase = progress < 0.3 ? 0 : Math.min(1, (progress - 0.3) / 0.35);
            const recovery = progress > 0.65 ? (progress - 0.65) / 0.35 : 0;
            const twistWind = windPhase * (-4); // twist AWAY first
            const twistHit = hitPhase * 8; // explosive INTO punch
            const twistRecover = recovery * (-4); // settle back
            return {
                bodyBob: 0, bodyLean: hitPhase * 4 - recovery * 2,
                headOff: { x: 0, y: hitPhase * 2 },
                lArm: { x: -16 - windPhase * 6, y: 8 - windPhase * 4 + recovery * 6 },
                rArm: { x: 6 + hitPhase * 6, y: 8 + hitPhase * 30 - recovery * 10 },
                lElbow: { x: -14 - windPhase * 4, y: 3 }, rElbow: { x: 6, y: 8 + hitPhase * 14 },
                lLeg: { x: -12, y: 28 }, rLeg: { x: 14 + hitPhase * 4 - recovery * 4, y: 28 },
                lKnee: { x: -10, y: 15 }, rKnee: { x: 12, y: 14 },
                torsoTwist: twistWind + twistHit + twistRecover,
            };
        }
        case 'kicking': {
            // Chamber → snap → retract
            const chamber = progress < 0.25 ? progress / 0.25 : 1;
            const snap = progress < 0.25 ? 0 : Math.min(1, (progress - 0.25) / 0.35);
            const retract = progress > 0.6 ? (progress - 0.6) / 0.4 : 0;
            const legOut = snap * (1 - retract);
            return {
                bodyBob: -chamber * 3 + retract * 2, bodyLean: -legOut * 3,
                headOff: { x: 0, y: 0 },
                lArm: { x: -22, y: 12 + legOut * 4 }, rArm: { x: 22, y: 12 + legOut * 4 },
                lElbow: { x: -18, y: 6 }, rElbow: { x: 18, y: 6 },
                lLeg: { x: -10, y: 28 }, rLeg: { x: 6 + legOut * 4, y: 8 + chamber * 4 + legOut * 20 - retract * 16 },
                lKnee: { x: -8, y: 15 + legOut * 2 }, rKnee: { x: 6, y: 6 + chamber * 2 + legOut * 8 },
                torsoTwist: -legOut * 4,
            };
        }
        case 'blocking': {
            // Dynamic guard with breathing pulse
            const guardPulse = Math.sin(player.bobPhase * 1.3) * 1.5;
            return {
                bodyBob: guardPulse - 2, bodyLean: 0, headOff: { x: 0, y: 2 },
                lArm: { x: 6 + guardPulse * 0.5, y: 8 + guardPulse }, rArm: { x: -6 - guardPulse * 0.5, y: 8 + guardPulse },
                lElbow: { x: 2, y: 4 }, rElbow: { x: -2, y: 4 },
                lLeg: { x: -14, y: 24 }, rLeg: { x: 14, y: 24 },
                lKnee: { x: -12, y: 12 }, rKnee: { x: 12, y: 12 },
                torsoTwist: 0,
            };
        }
        case 'countering': {
            const ease = Math.min(1, progress / 0.5);
            return {
                bodyBob: 0, bodyLean: -ease * 3, headOff: { x: -ease * 2, y: 0 },
                lArm: { x: -26, y: 4 + ease * 4 }, rArm: { x: 14, y: 8 + ease * 14 },
                lElbow: { x: -20, y: 0 }, rElbow: { x: 8, y: 6 + ease * 6 },
                lLeg: { x: -16, y: 28 }, rLeg: { x: 18, y: 24 },
                lKnee: { x: -14, y: 14 }, rKnee: { x: 14, y: 12 },
                torsoTwist: -ease * 5,
            };
        }
        case 'dodging': {
            const ease = Math.min(1, progress / 0.4);
            return {
                bodyBob: 0, bodyLean: -ease * 16, headOff: { x: -ease * 8, y: -ease * 4 },
                lArm: { x: -14 - ease * 8, y: 12 }, rArm: { x: 14 - ease * 8, y: 12 },
                lElbow: { x: -10 - ease * 4, y: 6 }, rElbow: { x: 10 - ease * 4, y: 6 },
                lLeg: { x: -6, y: 28 }, rLeg: { x: 20, y: 28 },
                lKnee: { x: -4, y: 14 }, rKnee: { x: 14, y: 14 },
                torsoTwist: -ease * 6,
            };
        }
        case 'grappling': {
            const ease = Math.min(1, progress / 0.5);
            return {
                bodyBob: 0, bodyLean: ease * 5, headOff: { x: 0, y: ease * 3 },
                lArm: { x: -16, y: 6 + ease * 28 }, rArm: { x: 16, y: 6 + ease * 28 },
                lElbow: { x: -12, y: 6 + ease * 14 }, rElbow: { x: 12, y: 6 + ease * 14 },
                lLeg: { x: -14, y: 28 }, rLeg: { x: 14, y: 28 },
                lKnee: { x: -10, y: 14 }, rKnee: { x: 10, y: 14 },
                torsoTwist: 0,
            };
        }
        case 'hit': {
            // In-place body flinch — torso crunch, head snap, no flying
            const snap = progress < 0.3 ? progress / 0.3 : 1;
            const recover = progress > 0.5 ? (progress - 0.5) / 0.5 : 0;
            const flinch = snap * (1 - recover * 0.7);
            return {
                bodyBob: flinch * 3, bodyLean: -flinch * 2,
                headOff: { x: flinch * 3, y: -flinch * 4 },
                lArm: { x: -16 - flinch * 4, y: 10 + flinch * 6 }, rArm: { x: 16 + flinch * 3, y: 10 + flinch * 4 },
                lElbow: { x: -14 - flinch * 2, y: 5 + flinch * 3 }, rElbow: { x: 14 + flinch * 2, y: 5 + flinch * 2 },
                lLeg: { x: -12 + flinch * 2, y: 26 }, rLeg: { x: 12 - flinch * 1, y: 26 },
                lKnee: { x: -10 + flinch * 1, y: 13 + flinch * 1 }, rKnee: { x: 10, y: 13 + flinch * 2 },
                torsoTwist: flinch * 4,
            };
        }
        default:
            return getPose('idle', player, faceDir);
    }
}

function lerpPose(poseA, poseB, t) {
    if (!poseA || !poseB) return poseB || poseA;
    t = Math.max(0, Math.min(1, t));
    const s = t * t * (3 - 2 * t);
    const lv = (a, b) => a + (b - a) * s;
    const lp = (a, b) => ({ x: lv(a.x, b.x), y: lv(a.y, b.y) });
    return {
        bodyBob: lv(poseA.bodyBob, poseB.bodyBob),
        bodyLean: lv(poseA.bodyLean, poseB.bodyLean),
        headOff: lp(poseA.headOff, poseB.headOff),
        lArm: lp(poseA.lArm, poseB.lArm), rArm: lp(poseA.rArm, poseB.rArm),
        lElbow: lp(poseA.lElbow, poseB.lElbow), rElbow: lp(poseA.rElbow, poseB.rElbow),
        lLeg: lp(poseA.lLeg, poseB.lLeg), rLeg: lp(poseA.rLeg, poseB.rLeg),
        lKnee: lp(poseA.lKnee, poseB.lKnee), rKnee: lp(poseA.rKnee, poseB.rKnee),
        torsoTwist: lv(poseA.torsoTwist, poseB.torsoTwist),
    };
}

function drawComicFighter(ctx, player) {
    const isP1 = player.id === 1;

    // Dynamic facing: calculate angle to opponent
    const opponent = getOpponent(player);
    const faceDx = opponent.x - player.x;
    const faceDy = opponent.y - player.y;
    const faceAngle = Math.atan2(faceDy, faceDx);

    // Outfit-aware palette
    const { outfit, palette } = getOutfitForPlayer(player.id);

    const flashing = player.flashTimer > 0 && Math.floor(player.flashTimer / 40) % 2 === 0;

    ctx.save();
    if (flashing) ctx.globalAlpha = 0.35;

    // Translate to player position and rotate to face opponent
    ctx.translate(player.x, player.y);
    ctx.rotate(faceAngle - Math.PI / 2); // "forward" is up in local space

    const faceDir = -1; // always "up" in local rotated space

    // Grounded
    if (player.state === 'grounded') {
        drawGroundedFighter(ctx, 0, 0, faceDir, palette, outfit);
        ctx.restore();
        return;
    }

    // Get pose
    const targetPose = getPose(player.state, player, faceDir);
    let pose;
    if (player.blendTimer > 0 && player.prevPose) {
        pose = lerpPose(player.prevPose, targetPose, 1 - (player.blendTimer / player.blendDuration));
    } else {
        pose = targetPose;
    }
    player.currentPose = { ...targetPose };

    // All coordinates relative to (0, 0) in rotated local space
    const x = 0, y = 0;
    const headR = 11;
    const shoulderW = 30, chestW = 28, waistW = 18, bodyH = 32, neckH = 2;

    const bodyBob = pose.bodyBob;
    const headX = x + pose.headOff.x;
    const headY = y + faceDir * (headR + neckH + 2) + bodyBob + pose.headOff.y * faceDir;
    const neckY = headY + faceDir * (headR - 2);
    const shoulderBaseY = neckY + faceDir * neckH;
    const waistY = shoulderBaseY + faceDir * bodyH;
    const tw = pose.torsoTwist;

    // Dynamic shadow — offset right (light from left), shifts with lean
    ctx.save();
    const shadowOffX = 8; // light from left pushes shadow right
    const shadowX = x + shadowOffX + (pose.bodyLean || 0) * 0.6;
    const shadowY = y + faceDir * 56;
    const shadowRx = 22;
    const shadowRy = 6;
    const shadowGrad = ctx.createRadialGradient(shadowX - 4, shadowY, 1, shadowX, shadowY, shadowRx);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, shadowRx, shadowRy, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // LEGS
    const lLegStart = { x: x - 6, y: waistY };
    const rLegStart = { x: x + 6, y: waistY };
    const lKnee = { x: x + pose.lKnee.x, y: waistY + faceDir * pose.lKnee.y };
    const rKnee = { x: x + pose.rKnee.x, y: waistY + faceDir * pose.rKnee.y };
    const lFoot = { x: x + pose.lLeg.x, y: waistY + faceDir * pose.lLeg.y };
    const rFoot = { x: x + pose.rLeg.x, y: waistY + faceDir * pose.rLeg.y };

    drawMuscularLimb(ctx, lLegStart.x, lLegStart.y, lKnee.x, lKnee.y, 11, 9, palette.pants, palette.pantsLt, palette.outline);
    drawMuscularLimb(ctx, rLegStart.x, rLegStart.y, rKnee.x, rKnee.y, 11, 9, palette.pants, palette.pantsLt, palette.outline);
    // Sweatpants are slightly wider
    const calfW1 = outfit.pantsType === 'sweatpants' ? 10 : 9;
    const calfW2 = outfit.pantsType === 'sweatpants' ? 8 : 7;
    drawMuscularLimb(ctx, lKnee.x, lKnee.y, lFoot.x, lFoot.y, calfW1, calfW2, palette.pants, palette.pantsLt, palette.outline);
    drawMuscularLimb(ctx, rKnee.x, rKnee.y, rFoot.x, rFoot.y, calfW1, calfW2, palette.pants, palette.pantsLt, palette.outline);

    // Pants variant details
    if (outfit.pantsType === 'sweatpants') {
        // Drawstring detail at waist and cuff at ankle
        ctx.save();
        ctx.strokeStyle = palette.pantsLt; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(lFoot.x - 5, lFoot.y - faceDir * 2); ctx.lineTo(lFoot.x + 5, lFoot.y - faceDir * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rFoot.x - 5, rFoot.y - faceDir * 2); ctx.lineTo(rFoot.x + 5, rFoot.y - faceDir * 2); ctx.stroke();
        ctx.restore();
    } else if (outfit.pantsType === 'skiPants') {
        // Side stripe on each leg
        ctx.save();
        ctx.strokeStyle = palette.pantsLt; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(lLegStart.x + 5, lLegStart.y); ctx.lineTo(lFoot.x + 4, lFoot.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rLegStart.x - 5, rLegStart.y); ctx.lineTo(rFoot.x - 4, rFoot.y); ctx.stroke();
        ctx.restore();
    } else if (outfit.pantsType === 'ninjaPants') {
        // Shin wraps — diagonal lines on lower leg
        ctx.save();
        ctx.strokeStyle = palette.pantsLt; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
        for (let t = 0.2; t < 0.9; t += 0.2) {
            const lx = lKnee.x + (lFoot.x - lKnee.x) * t, ly = lKnee.y + (lFoot.y - lKnee.y) * t;
            const rx = rKnee.x + (rFoot.x - rKnee.x) * t, ry = rKnee.y + (rFoot.y - rKnee.y) * t;
            ctx.beginPath(); ctx.moveTo(lx - 4, ly - 2); ctx.lineTo(lx + 4, ly + 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx - 4, ry - 2); ctx.lineTo(rx + 4, ry + 2); ctx.stroke();
        }
        ctx.restore();
    }

    drawFootwear(ctx, lFoot.x, lFoot.y, faceDir, outfit, palette);
    drawFootwear(ctx, rFoot.x, rFoot.y, faceDir, outfit, palette);

    // TORSO
    drawMuscularTorso(ctx, x, shoulderBaseY, waistY, shoulderW, chestW, waistW, bodyH, faceDir, bodyBob, tw, palette, outfit);

    // ARMS
    const lShoulderX = x - shoulderW / 2 + 2;
    const rShoulderX = x + shoulderW / 2 - 2;
    const shoulderY = shoulderBaseY + faceDir * 3 + bodyBob;
    const lElbow = { x: x + pose.lElbow.x, y: shoulderY + faceDir * pose.lElbow.y };
    const rElbow = { x: x + pose.rElbow.x, y: shoulderY + faceDir * pose.rElbow.y };
    const lHand = { x: x + pose.lArm.x, y: shoulderY + faceDir * pose.lArm.y };
    const rHand = { x: x + pose.rArm.x, y: shoulderY + faceDir * pose.rArm.y };

    // Upper arms — t-shirt has shorter sleeves (lower part skin-colored)
    if (outfit.topType === 'tshirt') {
        const lMidArmX = (lShoulderX + lElbow.x) / 2, lMidArmY = (shoulderY + lElbow.y) / 2;
        const rMidArmX = (rShoulderX + rElbow.x) / 2, rMidArmY = (shoulderY + rElbow.y) / 2;
        drawMuscularLimb(ctx, lShoulderX, shoulderY, lMidArmX, lMidArmY, 10, 9, palette.top, palette.topLt, palette.outline);
        drawMuscularLimb(ctx, rShoulderX, shoulderY, rMidArmX, rMidArmY, 10, 9, palette.top, palette.topLt, palette.outline);
        drawMuscularLimb(ctx, lMidArmX, lMidArmY, lElbow.x, lElbow.y, 9, 8, palette.skin, palette.skinLt, palette.outline);
        drawMuscularLimb(ctx, rMidArmX, rMidArmY, rElbow.x, rElbow.y, 9, 8, palette.skin, palette.skinLt, palette.outline);
    } else {
        drawMuscularLimb(ctx, lShoulderX, shoulderY, lElbow.x, lElbow.y, 10, 8, palette.top, palette.topLt, palette.outline);
        drawMuscularLimb(ctx, rShoulderX, shoulderY, rElbow.x, rElbow.y, 10, 8, palette.top, palette.topLt, palette.outline);
    }
    // Forearms
    const forearmFill = outfit.topType === 'skiJacket' ? palette.hands : palette.skin;
    const forearmLt = outfit.topType === 'skiJacket' ? palette.hands : palette.skinLt;
    drawMuscularLimb(ctx, lElbow.x, lElbow.y, lHand.x, lHand.y, 8, 6, forearmFill, forearmLt, palette.outline);
    drawMuscularLimb(ctx, rElbow.x, rElbow.y, rHand.x, rHand.y, 8, 6, forearmFill, forearmLt, palette.outline);
    // Hand gear
    drawHandGear(ctx, lElbow.x, lElbow.y, lHand.x, lHand.y, outfit, palette);
    drawHandGear(ctx, rElbow.x, rElbow.y, rHand.x, rHand.y, outfit, palette);
    const fistR = outfit.handType === 'thickGloves' ? 7 : 6;
    const fistColor = outfit.handType === 'bare' ? palette.skin : palette.hands;
    drawFist(ctx, lHand.x, lHand.y, fistR, fistColor, palette.outline);
    drawFist(ctx, rHand.x, rHand.y, fistR, fistColor, palette.outline);

    // HEAD
    drawFighterHead(ctx, headX, headY, headR, faceDir, bodyBob, palette, outfit, player.defeated);

    // STATE EFFECTS (in local space)
    drawStateEffects(ctx, player, x, y, shoulderY, faceDir, bodyBob, rHand, rFoot, palette, outfit);

    ctx.restore();
}

function drawMuscularLimb(ctx, x1, y1, x2, y2, widthStart, widthEnd, fillColor, lightColor, outlineColor) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return;
    const nx = -dy / len;
    const ny = dx / len;

    ctx.save();
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const bulge = (widthStart + widthEnd) / 2 * 1.05;

    ctx.beginPath();
    ctx.moveTo(x1 + nx * widthStart / 2, y1 + ny * widthStart / 2);
    ctx.quadraticCurveTo(mx + nx * bulge / 2, my + ny * bulge / 2, x2 + nx * widthEnd / 2, y2 + ny * widthEnd / 2);
    ctx.lineTo(x2 - nx * widthEnd / 2, y2 - ny * widthEnd / 2);
    ctx.quadraticCurveTo(mx - nx * bulge / 2, my - ny * bulge / 2, x1 - nx * widthStart / 2, y1 - ny * widthStart / 2);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

function drawMuscularTorso(ctx, cx, topY, botY, shoulderW, chestW, waistW, bodyH, faceDir, bodyBob, twist, palette, outfit) {
    ctx.save();
    const ty = Math.min(topY, botY) + bodyBob;
    const by = Math.max(topY, botY) + bodyBob;
    const h = Math.abs(bodyH);
    const midY = ty + h * 0.45;

    // Main torso shape — clean fill + strong outline
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW / 2 + twist, ty);
    ctx.lineTo(cx + shoulderW / 2 + twist, ty);
    ctx.quadraticCurveTo(cx + chestW / 2 + twist * 0.5, midY, cx + waistW / 2, by);
    ctx.lineTo(cx - waistW / 2, by);
    ctx.quadraticCurveTo(cx - chestW / 2 + twist * 0.5, midY, cx - shoulderW / 2 + twist, ty);
    ctx.closePath();
    ctx.fillStyle = palette.top;
    ctx.fill();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Simple center line
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(cx + twist * 0.7, ty + 3);
    ctx.lineTo(cx, by - 3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Outfit-specific details (kept simple)
    const topType = outfit ? outfit.topType : 'hoodie';
    if (topType === 'hoodie') {
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 7 + twist, ty);
        ctx.quadraticCurveTo(cx + twist, ty - 3, cx + 7 + twist, ty);
        ctx.stroke();
    } else if (topType === 'tshirt') {
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 5 + twist, ty);
        ctx.quadraticCurveTo(cx + twist, ty + 2, cx + 5 + twist, ty);
        ctx.stroke();
    } else if (topType === 'skiJacket') {
        // Zipper line
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + twist * 0.5, ty + 2);
        ctx.lineTo(cx, by - 5);
        ctx.stroke();
        // Quilted lines
        ctx.globalAlpha = 0.25;
        for (let i = 1; i < 4; i++) {
            const yy = ty + h * (i / 4);
            const lx = cx - (shoulderW / 2 - (shoulderW - waistW) / 2 * (i / 4));
            const rx = cx + (shoulderW / 2 - (shoulderW - waistW) / 2 * (i / 4));
            ctx.beginPath();
            ctx.moveTo(lx + twist * (1 - i / 4), yy);
            ctx.lineTo(rx + twist * (1 - i / 4), yy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // High collar
        ctx.fillStyle = palette.topDk;
        ctx.fillRect(cx - 5 + twist, ty - 3, 10, 4);
        ctx.strokeStyle = palette.outline; ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 5 + twist, ty - 3, 10, 4);
    } else if (topType === 'ninjaGi') {
        // Diagonal wrap
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - shoulderW / 3 + twist, ty + 2);
        ctx.lineTo(cx + waistW / 4, by - 6);
        ctx.stroke();
        // Belt/sash
        ctx.fillStyle = palette.headwear;
        ctx.fillRect(cx - waistW / 2 - 1, by - 5, waistW + 2, 5);
        ctx.strokeStyle = palette.outline; ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - waistW / 2 - 1, by - 5, waistW + 2, 5);
    }

    // Belt (non-ninja)
    if (topType !== 'ninjaGi') {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(cx - waistW / 2 - 1, by - 4, waistW + 2, 4);
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - waistW / 2 - 1, by - 4, waistW + 2, 4);
    }
    ctx.restore();
}

function drawFighterHead(ctx, hx, hy, headR, faceDir, bodyBob, palette, outfit, defeated) {
    const headwearType = outfit ? outfit.headwearType : 'bandana';
    const faceType = outfit ? outfit.faceType : 'determined';
    const showHair = outfit ? outfit.showHair : true;

    ctx.save();

    // Minimal neck (reduced visibility)
    ctx.fillStyle = palette.skin;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    const neckTop = hy + faceDir * (headR - 3);
    const neckBot = hy + faceDir * (headR + 2);
    const nTop = Math.min(neckTop, neckBot);
    const nH = Math.abs(neckBot - neckTop);
    ctx.fillRect(hx - 4, nTop, 8, nH);

    // HEAD SHAPE (clean jawline)
    const jawY = hy + faceDir * 4;
    ctx.beginPath();
    ctx.moveTo(hx - headR, hy - faceDir * 2);
    ctx.quadraticCurveTo(hx - headR, hy - faceDir * headR, hx, hy - faceDir * headR);
    ctx.quadraticCurveTo(hx + headR, hy - faceDir * headR, hx + headR, hy - faceDir * 2);
    ctx.quadraticCurveTo(hx + headR, jawY, hx + 5, jawY + faceDir * 2);
    ctx.lineTo(hx - 5, jawY + faceDir * 2);
    ctx.quadraticCurveTo(hx - headR, jawY, hx - headR, hy - faceDir * 2);
    ctx.closePath();

    if (faceType === 'masked') {
        ctx.fillStyle = palette.headwear;
    } else {
        ctx.fillStyle = palette.skin;
    }
    ctx.fill();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // HAIR (only if outfit shows it) — cleaner, smoother arcs
    if (showHair) {
        ctx.fillStyle = palette.hair;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2.5;
        const hairDir = -faceDir;
        ctx.beginPath();
        ctx.moveTo(hx - headR - 1, hy + hairDir * 1);
        ctx.quadraticCurveTo(hx - headR * 0.6, hy + hairDir * (headR + 4), hx, hy + hairDir * (headR + 3));
        ctx.quadraticCurveTo(hx + headR * 0.6, hy + hairDir * (headR + 5), hx + headR + 1, hy + hairDir * 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // HEADWEAR
    if (headwearType === 'bandana') {
        drawBandana(ctx, hx, hy, headR, faceDir, palette);
    } else if (headwearType === 'beanie') {
        drawBeanie(ctx, hx, hy, headR, faceDir, palette);
    } else if (headwearType === 'skiHelmet') {
        drawSkiHelmet(ctx, hx, hy, headR, faceDir, palette);
    } else if (headwearType === 'ninjaMask') {
        drawNinjaMask(ctx, hx, hy, headR, faceDir, palette);
    }

    // FACE
    drawFace(ctx, hx, hy, headR, faceDir, palette, faceType, defeated);

    ctx.restore();
}

function drawBandana(ctx, hx, hy, headR, faceDir, palette) {
    ctx.fillStyle = palette.headwear;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    const bandY = hy - faceDir * (headR * 0.35);
    ctx.beginPath();
    ctx.moveTo(hx - headR - 1, bandY);
    ctx.lineTo(hx + headR + 1, bandY);
    ctx.lineTo(hx + headR + 1, bandY + faceDir * 5);
    ctx.lineTo(hx - headR - 1, bandY + faceDir * 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Highlight strip
    ctx.fillStyle = palette.headwearLt;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(hx - headR, bandY + faceDir * 1, headR * 2, faceDir * 2);
    ctx.globalAlpha = 1;
    // Tail
    ctx.fillStyle = palette.headwear;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1;
    const tailWave = Math.sin(game.time * 0.005) * 4;
    ctx.beginPath();
    ctx.moveTo(hx + headR, bandY + faceDir * 1);
    ctx.quadraticCurveTo(hx + headR + 10 + tailWave, bandY + faceDir * 3, hx + headR + 16 + tailWave * 1.5, bandY - faceDir * 2);
    ctx.lineTo(hx + headR + 14 + tailWave * 1.5, bandY + faceDir * 4);
    ctx.quadraticCurveTo(hx + headR + 8 + tailWave, bandY + faceDir * 6, hx + headR, bandY + faceDir * 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
}

function drawBeanie(ctx, hx, hy, headR, faceDir, palette) {
    // Rounded dome covering top of head
    const topY = hy - faceDir * headR;
    ctx.fillStyle = palette.headwear;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - headR - 2, hy - faceDir * (headR * 0.2));
    ctx.quadraticCurveTo(hx - headR - 2, topY - faceDir * 4, hx, topY - faceDir * 5);
    ctx.quadraticCurveTo(hx + headR + 2, topY - faceDir * 4, hx + headR + 2, hy - faceDir * (headR * 0.2));
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Ribbed texture lines
    ctx.strokeStyle = palette.headwearLt;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 4; i++) {
        const yy = hy - faceDir * (headR * 0.2 + (headR * 0.8 + 5) * ((i + 1) / 5));
        ctx.beginPath();
        ctx.moveTo(hx - headR + i, yy); ctx.lineTo(hx + headR - i, yy);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Brim fold
    ctx.fillStyle = palette.headwearLt;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    const brimY = hy - faceDir * (headR * 0.2);
    ctx.beginPath();
    ctx.moveTo(hx - headR - 2, brimY);
    ctx.lineTo(hx + headR + 2, brimY);
    ctx.lineTo(hx + headR + 1, brimY + faceDir * 4);
    ctx.lineTo(hx - headR - 1, brimY + faceDir * 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
}

function drawSkiHelmet(ctx, hx, hy, headR, faceDir, palette) {
    // Full helmet dome
    const topY = hy - faceDir * headR;
    ctx.fillStyle = palette.headwear;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - headR - 3, hy + faceDir * 1);
    ctx.quadraticCurveTo(hx - headR - 3, topY - faceDir * 5, hx, topY - faceDir * 6);
    ctx.quadraticCurveTo(hx + headR + 3, topY - faceDir * 5, hx + headR + 3, hy + faceDir * 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Goggles on forehead
    const gogY = hy - faceDir * (headR * 0.45);
    ctx.fillStyle = '#222';
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    // Left lens
    ctx.beginPath();
    ctx.ellipse(hx - 5, gogY, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Right lens
    ctx.beginPath();
    ctx.ellipse(hx + 5, gogY, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Bridge
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx - 1, gogY); ctx.lineTo(hx + 1, gogY); ctx.stroke();
    // Lens reflection
    ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.beginPath(); ctx.ellipse(hx - 6, gogY - 1, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 4, gogY - 1, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();
    // Strap
    ctx.strokeStyle = palette.headwearLt;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - headR - 2, gogY);
    ctx.lineTo(hx - 6 - 5, gogY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + headR + 2, gogY);
    ctx.lineTo(hx + 6 + 5, gogY);
    ctx.stroke();
}

function drawNinjaMask(ctx, hx, hy, headR, faceDir, palette) {
    // Full head coverage - the head is already drawn in headwear color
    // Add fabric wrinkle line across nose area
    ctx.strokeStyle = palette.headwearLt;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    const wrinkleY = hy + faceDir * 2;
    ctx.beginPath();
    ctx.moveTo(hx - headR + 2, wrinkleY);
    ctx.quadraticCurveTo(hx, wrinkleY + faceDir * 1.5, hx + headR - 2, wrinkleY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Forehead crease
    const topCrease = hy - faceDir * (headR * 0.5);
    ctx.strokeStyle = palette.headwearLt;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(hx - 6, topCrease);
    ctx.lineTo(hx + 6, topCrease);
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawFace(ctx, hx, hy, headR, faceDir, palette, faceType, defeated) {
    const eyeBaseY = hy + faceDir * 1;

    // DEFEATED: X eyes + open mouth
    if (defeated) {
        const xSize = 4;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        // Left X eye
        ctx.beginPath();
        ctx.moveTo(hx - 5 - xSize, eyeBaseY - xSize);
        ctx.lineTo(hx - 5 + xSize, eyeBaseY + xSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hx - 5 + xSize, eyeBaseY - xSize);
        ctx.lineTo(hx - 5 - xSize, eyeBaseY + xSize);
        ctx.stroke();
        // Right X eye
        ctx.beginPath();
        ctx.moveTo(hx + 5 - xSize, eyeBaseY - xSize);
        ctx.lineTo(hx + 5 + xSize, eyeBaseY + xSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hx + 5 + xSize, eyeBaseY - xSize);
        ctx.lineTo(hx + 5 - xSize, eyeBaseY + xSize);
        ctx.stroke();
        // Open mouth (little O)
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(hx, eyeBaseY + faceDir * 8, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#1a0a0a';
        ctx.fill();
        return;
    }

    if (faceType === 'masked') {
        // Only eyes visible through slit
        // Eye slit opening
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(hx - headR + 3, eyeBaseY - faceDir * 2);
        ctx.lineTo(hx + headR - 3, eyeBaseY - faceDir * 2);
        ctx.lineTo(hx + headR - 3, eyeBaseY + faceDir * 3);
        ctx.lineTo(hx - headR + 3, eyeBaseY + faceDir * 3);
        ctx.closePath();
        ctx.fill();
        // Intense glowing eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(hx - 5, eyeBaseY, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx + 5, eyeBaseY, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = palette.headwearLt;
        ctx.beginPath(); ctx.arc(hx - 5, eyeBaseY, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + 5, eyeBaseY, 1.5, 0, Math.PI * 2); ctx.fill();
        // Subtle eye glow
        ctx.fillStyle = palette.headwearLt;
        ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.arc(hx - 5, eyeBaseY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + 5, eyeBaseY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        return;
    }

    // EYES (bigger, more angular)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(hx - 5, eyeBaseY, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 5, eyeBaseY, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(hx - 5, eyeBaseY + faceDir * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 5, eyeBaseY + faceDir * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    // Eye outlines
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(hx - 5, eyeBaseY, 5, 3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + 5, eyeBaseY, 5, 3, 0, 0, Math.PI * 2); ctx.stroke();

    // EYEBROWS (thicker, more angled)
    ctx.strokeStyle = palette.hair;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    if (faceType === 'relaxed') {
        // Softer angle
        ctx.beginPath(); ctx.moveTo(hx - 9, eyeBaseY - faceDir * 5); ctx.lineTo(hx - 2, eyeBaseY - faceDir * 5.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + 9, eyeBaseY - faceDir * 5); ctx.lineTo(hx + 2, eyeBaseY - faceDir * 5.5); ctx.stroke();
    } else {
        // Intense downward angle
        ctx.beginPath(); ctx.moveTo(hx - 10, eyeBaseY - faceDir * 4); ctx.lineTo(hx - 2, eyeBaseY - faceDir * 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + 10, eyeBaseY - faceDir * 4); ctx.lineTo(hx + 2, eyeBaseY - faceDir * 6); ctx.stroke();
    }

    // NOSE (extended with shadow)
    ctx.strokeStyle = palette.skinDk;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hx, eyeBaseY + faceDir * 3); ctx.lineTo(hx - 1.5, eyeBaseY + faceDir * 6); ctx.stroke();
    // Nose shadow triangle
    ctx.fillStyle = palette.skinDk;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(hx - 1.5, eyeBaseY + faceDir * 6);
    ctx.lineTo(hx + 1.5, eyeBaseY + faceDir * 6);
    ctx.lineTo(hx, eyeBaseY + faceDir * 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // MOUTH
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.5;
    if (faceType === 'relaxed') {
        // Slight smile
        ctx.beginPath();
        ctx.moveTo(hx - 3, eyeBaseY + faceDir * 8);
        ctx.quadraticCurveTo(hx, eyeBaseY + faceDir * 9, hx + 3, eyeBaseY + faceDir * 8);
        ctx.stroke();
    } else {
        // Firm line
        ctx.beginPath();
        ctx.moveTo(hx - 4, eyeBaseY + faceDir * 8);
        ctx.lineTo(hx + 4, eyeBaseY + faceDir * 8);
        ctx.stroke();
    }

    // CHIN SHADOW
    ctx.strokeStyle = palette.skinDk;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(hx - 3, eyeBaseY + faceDir * 10);
    ctx.lineTo(hx + 3, eyeBaseY + faceDir * 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawHandGear(ctx, ex, ey, hx, hy, outfit, palette) {
    const dx = hx - ex, dy = hy - ey;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;
    const handType = outfit ? outfit.handType : 'wraps';

    if (handType === 'wraps') {
        ctx.save();
        ctx.strokeStyle = palette.hands;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        for (let t = 0.3; t < 0.9; t += 0.15) {
            const px = ex + dx * t, py = ey + dy * t;
            const nx = -dy / len * 5, ny = dx / len * 5;
            ctx.beginPath(); ctx.moveTo(px + nx, py + ny); ctx.lineTo(px - nx, py - ny); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    } else if (handType === 'fingerlessGloves') {
        // Armguard wrap lines + glove base
        ctx.save();
        ctx.strokeStyle = palette.hands;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.7;
        for (let t = 0.4; t < 0.85; t += 0.2) {
            const px = ex + dx * t, py = ey + dy * t;
            const nx = -dy / len * 6, ny = dx / len * 6;
            ctx.beginPath(); ctx.moveTo(px + nx, py + ny); ctx.lineTo(px - nx, py - ny); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    } else if (handType === 'thickGloves') {
        // Solid glove fill over forearm lower half
        ctx.save();
        ctx.fillStyle = palette.hands;
        ctx.globalAlpha = 0.5;
        for (let t = 0.5; t < 0.95; t += 0.12) {
            const px = ex + dx * t, py = ey + dy * t;
            ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    // 'bare' = no hand gear drawn
}

function drawFist(ctx, x, y, r, fillColor, outlineColor) {
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawFootwear(ctx, x, y, faceDir, outfit, palette) {
    const shoeType = outfit ? outfit.shoeType : 'sneakers';
    ctx.save();
    ctx.fillStyle = palette.shoes;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.5;

    if (shoeType === 'sneakers') {
        ctx.beginPath(); ctx.ellipse(x, y + faceDir * 2, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Accent stripe
        ctx.strokeStyle = palette.shoeAccent;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 5, y + faceDir * 2); ctx.lineTo(x + 5, y + faceDir * 2); ctx.stroke();
        // Sole
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 7, y + faceDir * 4); ctx.lineTo(x + 7, y + faceDir * 4); ctx.stroke();
    } else if (shoeType === 'slides') {
        // Flat wide sandal
        ctx.beginPath(); ctx.ellipse(x, y + faceDir * 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Strap
        ctx.strokeStyle = palette.shoeAccent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 6, y + faceDir * 1); ctx.lineTo(x + 6, y + faceDir * 1); ctx.stroke();
    } else if (shoeType === 'snowBoots') {
        // Tall boot
        ctx.fillRect(x - 6, y - 3, 12, 10);
        ctx.strokeRect(x - 6, y - 3, 12, 10);
        // Thick sole
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 7, y + faceDir * 4, 14, 4);
        ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
        ctx.strokeRect(x - 7, y + faceDir * 4, 14, 4);
        // Boot accent
        ctx.strokeStyle = palette.shoeAccent; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
    } else if (shoeType === 'tabi') {
        // Angular split-toe
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 2);
        ctx.lineTo(x - 6, y + faceDir * 4);
        ctx.lineTo(x - 1, y + faceDir * 6);
        ctx.lineTo(x, y + faceDir * 3);
        ctx.lineTo(x + 1, y + faceDir * 6);
        ctx.lineTo(x + 6, y + faceDir * 4);
        ctx.lineTo(x + 5, y - 2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

function drawStateEffects(ctx, player, x, y, shoulderY, faceDir, bodyBob, rHand, rFoot, palette, outfit) {
    if (player.state === 'countering' && player.counterWindow) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.arc(x, y + bodyBob, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.08)';
        ctx.beginPath(); ctx.arc(x, y + bodyBob, 40, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    if (player.state === 'blocking') {
        ctx.save();
        const shieldY = y + faceDir * 20;
        const grad = ctx.createRadialGradient(x, shieldY, 5, x, shieldY, 25);
        grad.addColorStop(0, 'rgba(0, 200, 255, 0.15)');
        grad.addColorStop(0.7, 'rgba(0, 200, 255, 0.08)');
        grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, shieldY, 25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
    }
    if (player.state === 'dodging') {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = palette.top;
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath(); ctx.arc(x + i * 8, y - faceDir * i * 4, 16, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const offX = 18 + i * 6;
            const offY = -15 + i * 6;
            ctx.beginPath(); ctx.moveTo(x + offX, y + offY); ctx.lineTo(x + offX + 12, y + offY); ctx.stroke();
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
        ctx.beginPath(); ctx.arc(rFoot.x, rFoot.y, 14, 0, Math.PI * 1.5); ctx.stroke();
        ctx.restore();
    }
    if (player.hitStun) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function drawGroundedFighter(ctx, x, y, faceDir, palette, outfit) {
    ctx.save();
    // Torso — slimmer
    ctx.fillStyle = palette.top;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 3;
    roundRect(ctx, x - 18, y - 10, 28, 20, 5);
    ctx.fill();
    ctx.stroke();

    // Head
    const isMasked = outfit && outfit.faceType === 'masked';
    ctx.fillStyle = isMasked ? palette.headwear : palette.skin;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x - 28, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!isMasked) {
        ctx.fillStyle = palette.headwear;
        ctx.fillRect(x - 37, y - 2, 18, 4);
        ctx.strokeStyle = palette.outline; ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 37, y - 2, 18, 4);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(x - 34, y - 1.5, 10, 3);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 32, y, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x - 27, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    if (!isMasked) {
        ctx.strokeStyle = palette.outline; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 31, y - 1); ctx.lineTo(x - 28, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 27, y - 1); ctx.lineTo(x - 24, y); ctx.stroke();
    }

    // Arms — slimmer
    const fistColor = outfit && outfit.handType === 'bare' ? palette.skin : palette.hands;
    drawMuscularLimb(ctx, x - 10, y - 6, x - 16, y - 16, 7, 5, palette.top, palette.topLt, palette.outline);
    drawMuscularLimb(ctx, x - 4, y - 6, x + 2, y - 16, 7, 5, palette.top, palette.topLt, palette.outline);
    drawFist(ctx, x - 16, y - 16, 5, fistColor, palette.outline);
    drawFist(ctx, x + 2, y - 16, 5, fistColor, palette.outline);

    // Legs — slimmer
    drawMuscularLimb(ctx, x + 10, y - 3, x + 24, y + 6, 9, 7, palette.pants, palette.pantsLt, palette.outline);
    drawMuscularLimb(ctx, x + 10, y + 3, x + 24, y - 6, 9, 7, palette.pants, palette.pantsLt, palette.outline);
    drawFootwear(ctx, x + 24, y + 6, 1, outfit, palette);
    drawFootwear(ctx, x + 24, y - 6, 1, outfit, palette);
    ctx.restore();
}

function drawCircle(ctx, x, y, r, fillColor, strokeColor, strokeW) {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeW;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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

    // Timer bar
    const timerPct = Math.max(0, gr.timer / 5000);
    const barX = w * 0.1, barY = h * 0.48, barW = w * 0.8, barH = 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = timerPct < 0.3 ? '#ff4444' : '#ffa500';
    ctx.fillRect(barX, barY, barW * timerPct, barH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.font = "bold 14px 'Bangers', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;

    const attacker = game.players[gr.attacker - 1];
    const defender = game.players[gr.defender - 1];

    // Attacker: show punch prompt + cooldown indicator
    const atkReady = gr.atkCooldown <= 0;
    const atkTy = attacker.id === 1 ? h * 0.65 : h * 0.35;
    ctx.fillStyle = atkReady ? '#ffdd00' : 'rgba(255,255,255,0.4)';
    const atkText = atkReady ? 'TAP TO PUNCH!' : 'WAIT...';
    ctx.strokeText(atkText, w / 2, atkTy); ctx.fillText(atkText, w / 2, atkTy);

    // Defender: show escape progress
    const defTy = defender.id === 1 ? h * 0.65 : h * 0.35;
    const escapePct = gr.escapePresses / gr.escapeNeeded;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const dots = '●'.repeat(gr.escapePresses) + '○'.repeat(gr.escapeNeeded - gr.escapePresses);
    ctx.strokeText('MASH TO ESCAPE! ' + dots, w / 2, defTy);
    ctx.fillText('MASH TO ESCAPE! ' + dots, w / 2, defTy);
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', init);
