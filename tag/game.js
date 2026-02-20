// ===== TAG! - 2 Player Chase Game =====
// Features: 8 worlds, 7 power-ups, wall jump, dash, double jump, AI, sound

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ===== SOUND SYSTEM (Web Audio API) =====
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;

        switch(type) {
            case 'jump':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
                osc.start(t); osc.stop(t + 0.15);
                break;
            case 'dash':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.12);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
                osc.start(t); osc.stop(t + 0.15);
                break;
            case 'tag':
                osc.type = 'square';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
                osc.start(t); osc.stop(t + 0.35);
                break;
            case 'powerup':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, t);
                osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.25);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                osc.start(t); osc.stop(t + 0.3);
                break;
            case 'walljump':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
                osc.start(t); osc.stop(t + 0.12);
                break;
            case 'bounce':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(250, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'portal':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);
                osc.frequency.exponentialRampToValueAtTime(1000, t + 0.35);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'roundend':
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.setValueAtTime(500, t + 0.15);
                osc.frequency.setValueAtTime(650, t + 0.3);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
                osc.start(t); osc.stop(t + 0.5);
                break;
            case 'select':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                osc.start(t); osc.stop(t + 0.1);
                break;
            case 'freeze':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, t);
                osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
                osc.start(t); osc.stop(t + 0.35);
                break;
            case 'swap':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.setValueAtTime(600, t + 0.1);
                osc.frequency.setValueAtTime(300, t + 0.2);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                osc.start(t); osc.stop(t + 0.3);
                break;
            case 'shrink':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
                osc.start(t); osc.stop(t + 0.25);
                break;
        }
    } catch(e) {}
}

// Background music
let musicOsc1 = null, musicOsc2 = null, musicGain = null;
function startMusic() {
    if (!soundEnabled || !audioCtx) return;
    stopMusic();
    try {
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.03;
        musicGain.connect(audioCtx.destination);

        musicOsc1 = audioCtx.createOscillator();
        musicOsc1.type = 'sine';
        musicOsc1.frequency.value = 130;
        musicOsc1.connect(musicGain);
        musicOsc1.start();

        musicOsc2 = audioCtx.createOscillator();
        musicOsc2.type = 'triangle';
        musicOsc2.frequency.value = 195;
        musicOsc2.connect(musicGain);
        musicOsc2.start();
    } catch(e) {}
}
function stopMusic() {
    try { if (musicOsc1) { musicOsc1.stop(); musicOsc1 = null; } } catch(e) {}
    try { if (musicOsc2) { musicOsc2.stop(); musicOsc2 = null; } } catch(e) {}
}

// Sound toggle
const soundToggle = document.getElementById('sound-toggle');
soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) { initAudio(); } else { stopMusic(); }
});

// ===== GAME STATE =====
let gameState = 'title';
let roundTime = 60;
let roundTimer = roundTime;
let lastTime = 0;
let currentRound = 1;
let totalRounds = 3;
let itPlayer = 1;
let tagCooldown = 0;
const TAG_COOLDOWN = 1.0;
let tagFlash = 0;
let screenShake = 0;
let screenShakeX = 0;
let screenShakeY = 0;

let scores = { 1: 0, 2: 0 };
let currentWorld = 0;
let isVsAI = false;
let aiDifficulty = 'medium';
let gameMode = 'tag'; // 'tag' or 'race'
let randomWorlds = false;
let worldAnnounceTimer = 0; // timer to show world name at round start

// Race mode state
let cameraX = 0;
let raceScrollSpeed = 0;
let raceTotalWidth = 0;
let raceFinished = false;
let raceTimer = 0;
const RACE_DURATION = 600; // 10 minutes for 16 worlds
let raceSectionWidth = 0;
let currentWorldSection = 0;

// ===== SCREEN MANAGEMENT =====
const screens = {
    title: document.getElementById('title-screen'),
    how: document.getElementById('how-screen'),
    difficulty: document.getElementById('difficulty-screen'),
    world: document.getElementById('world-screen'),
    game: document.getElementById('game-screen'),
    roundOver: document.getElementById('round-over-screen'),
    gameOver: document.getElementById('gameover-screen')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    gameState = name === 'game' ? 'playing' : name;
}

// ===== CANVAS SIZING =====
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    if (gameMode === 'race' && gameState === 'playing') {
        buildRaceLevel();
    } else {
        buildLevel();
    }
}
window.addEventListener('resize', resizeCanvas);

// ===== LEVEL DATA =====
let platforms = [];
let walls = [];
let powerUps = [];
let particles = [];
let portals = [];
let specialObjects = [];

// ===== WORLD DEFINITIONS =====
const WORLDS = [
    {
        name: 'Forest', emoji: '🌲',
        skyTop: '#4a90d9', skyMid: '#87CEEB', skyBot: '#b8e4f0',
        hillColor: '#5a9e4b', groundColor: '#2d5a27', groundTop: '#4a8c3f',
        platColor: '#8B4513', platTop: '#A0522D',
        bgColor: 'linear-gradient(135deg, #4a90d9, #2d5a27)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H - 35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.02, y: H-130, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.40, y: H-110, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.80, y: H-130, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.18, y: H-220, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: W*0.60, y: H-220, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: 0, y: H-300, w: W*0.14, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.35, y: H-310, w: W*0.30, h: 14, color: pc, topColor: pt },
                { x: W*0.86, y: H-300, w: W*0.14, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.10, y: H-400, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.70, y: H-400, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-480, w: W*0.40, h: 14, color: pc, topColor: pt, passThrough: true },
            ],
            walls: [
                { x: 0, y: H-300, w: 12, h: 265 },
                { x: W-12, y: H-300, w: 12, h: 265 },
            ],
            portals: [
                { x: W*0.04, y: H-80, pair: 1, color1: '#e74c3c', color2: '#f39c12' },
                { x: W*0.90, y: H-450, pair: 1, color1: '#e74c3c', color2: '#f39c12' },
            ],
            specials: [
                { type: 'mushroom', x: W*0.25, y: H-50, w: 30, h: 20, bounce: -800 },
                { type: 'mushroom', x: W*0.50, y: H-50, w: 30, h: 20, bounce: -800 },
                { type: 'mushroom', x: W*0.75, y: H-50, w: 30, h: 20, bounce: -800 },
            ]
        })
    },
    {
        name: 'Lava', emoji: '🌋',
        skyTop: '#1a0a0a', skyMid: '#3d1008', skyBot: '#8b2500',
        hillColor: '#4a1a0a', groundColor: '#2c0d06', groundTop: '#e74c3c',
        platColor: '#4a4a4a', platTop: '#ff6347',
        bgColor: 'linear-gradient(135deg, #3d1008, #e74c3c)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.05, y: H-120, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: W*0.22, y: H-150, w: W*0.12, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.44, y: H-120, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: W*0.66, y: H-150, w: W*0.12, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.83, y: H-120, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: 0, y: H-250, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-270, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.55, y: H-270, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.80, y: H-250, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.12, y: H-370, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: W*0.66, y: H-370, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: W*0.38, y: H-430, w: W*0.24, h: 14, color: pc, topColor: pt, passThrough: true },
            ],
            walls: [
                { x: W*0.48, y: H-250, w: 10, h: 100 },
            ],
            portals: [
                { x: W*0.02, y: H-80, pair: 1, color1: '#e74c3c', color2: '#ff6347' },
                { x: W*0.92, y: H-80, pair: 1, color1: '#e74c3c', color2: '#ff6347' },
            ],
            specials: [
                { type: 'lava', x: W*0.15, y: H-40, w: W*0.12, h: 10 },
                { type: 'lava', x: W*0.45, y: H-40, w: W*0.10, h: 10 },
                { type: 'lava', x: W*0.72, y: H-40, w: W*0.12, h: 10 },
            ]
        })
    },
    {
        name: 'Snow Mountain', emoji: '🏔️',
        skyTop: '#0b1a3b', skyMid: '#1e3a5f', skyBot: '#a8d8ea',
        hillColor: '#c8e6f0', groundColor: '#e8f4f8', groundTop: '#ffffff',
        platColor: '#b0d4e8', platTop: '#dff0f7', icy: true,
        bgColor: 'linear-gradient(135deg, #1e3a5f, #a8d8ea)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.0, y: H-140, w: W*0.25, h: 14, color: pc, topColor: pt },
                { x: W*0.75, y: H-140, w: W*0.25, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-190, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.55, y: H-190, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.10, y: H-290, w: W*0.28, h: 14, color: pc, topColor: pt },
                { x: W*0.62, y: H-290, w: W*0.28, h: 14, color: pc, topColor: pt },
                { x: W*0.40, y: H-350, w: W*0.20, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: 0, y: H-430, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.82, y: H-430, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.32, y: H-480, w: W*0.36, h: 14, color: pc, topColor: pt },
            ],
            walls: [
                { x: 0, y: H-430, w: 12, h: 395 },
                { x: W-12, y: H-430, w: 12, h: 395 },
            ],
            portals: [
                { x: W*0.05, y: H-190, pair: 1, color1: '#74b9ff', color2: '#a29bfe' },
                { x: W*0.88, y: H-490, pair: 1, color1: '#74b9ff', color2: '#a29bfe' },
            ],
            specials: []
        })
    },
    {
        name: 'Candy', emoji: '🍬',
        skyTop: '#ff9ff3', skyMid: '#feca57', skyBot: '#ff6b6b',
        hillColor: '#55efc4', groundColor: '#e056a0', groundTop: '#fd79a8',
        platColor: '#a29bfe', platTop: '#dfe6e9',
        bgColor: 'linear-gradient(135deg, #ff9ff3, #feca57)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.08, y: H-120, w: W*0.15, h: 14, color: '#fd79a8', topColor: '#fff' },
                { x: W*0.30, y: H-160, w: W*0.15, h: 14, color: '#a29bfe', topColor: '#fff' },
                { x: W*0.52, y: H-120, w: W*0.15, h: 14, color: '#55efc4', topColor: '#fff' },
                { x: W*0.77, y: H-160, w: W*0.15, h: 14, color: '#ffeaa7', topColor: '#fff' },
                { x: 0, y: H-260, w: W*0.20, h: 14, color: '#74b9ff', topColor: '#fff' },
                { x: W*0.28, y: H-280, w: W*0.20, h: 14, color: '#fd79a8', topColor: '#fff' },
                { x: W*0.54, y: H-260, w: W*0.20, h: 14, color: '#55efc4', topColor: '#fff' },
                { x: W*0.80, y: H-280, w: W*0.20, h: 14, color: '#ffeaa7', topColor: '#fff' },
                { x: W*0.15, y: H-380, w: W*0.25, h: 14, color: '#a29bfe', topColor: '#fff' },
                { x: W*0.60, y: H-380, w: W*0.25, h: 14, color: '#fd79a8', topColor: '#fff' },
                { x: W*0.30, y: H-470, w: W*0.40, h: 14, color: '#ffeaa7', topColor: '#fff' },
            ],
            walls: [],
            portals: [
                { x: W*0.02, y: H-80, pair: 1, color1: '#fd79a8', color2: '#a29bfe' },
                { x: W*0.92, y: H-480, pair: 1, color1: '#fd79a8', color2: '#a29bfe' },
            ],
            specials: [
                { type: 'trampoline', x: W*0.12, y: H-50, w: 40, h: 12, bounce: -900 },
                { type: 'trampoline', x: W*0.48, y: H-50, w: 40, h: 12, bounce: -900 },
                { type: 'trampoline', x: W*0.82, y: H-50, w: 40, h: 12, bounce: -900 },
            ]
        })
    },
    {
        name: 'Space', emoji: '🚀',
        skyTop: '#000011', skyMid: '#0a0a2e', skyBot: '#1a1a4e',
        hillColor: '#2d2d6b', groundColor: '#1a1a3e', groundTop: '#6c5ce7',
        platColor: '#2d2d6b', platTop: '#a29bfe',
        bgColor: 'linear-gradient(135deg, #000022, #6c5ce7)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.05, y: H-140, w: W*0.14, h: 14, color: pc, topColor: pt },
                { x: W*0.25, y: H-110, w: W*0.10, h: 14, color: pc, topColor: pt },
                { x: W*0.45, y: H-155, w: W*0.10, h: 14, color: pc, topColor: pt },
                { x: W*0.65, y: H-110, w: W*0.10, h: 14, color: pc, topColor: pt },
                { x: W*0.81, y: H-140, w: W*0.14, h: 14, color: pc, topColor: pt },
                { x: 0, y: H-250, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: W*0.20, y: H-280, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.62, y: H-280, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.88, y: H-250, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: W*0.42, y: H-330, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.08, y: H-420, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.72, y: H-420, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.38, y: H-500, w: W*0.24, h: 14, color: pc, topColor: pt },
            ],
            walls: [],
            portals: [
                { x: W*0.03, y: H-80, pair: 1, color1: '#6c5ce7', color2: '#a29bfe' },
                { x: W*0.45, y: H-550, pair: 1, color1: '#6c5ce7', color2: '#a29bfe' },
            ],
            specials: [
                { type: 'lowgrav', x: W*0.15, y: H-350, w: W*0.20, h: 120 },
                { type: 'lowgrav', x: W*0.65, y: H-350, w: W*0.20, h: 120 },
                { type: 'lowgrav', x: W*0.35, y: H-500, w: W*0.30, h: 100 },
            ]
        })
    },
    {
        name: 'Ocean', emoji: '🌊',
        skyTop: '#0077b6', skyMid: '#00b4d8', skyBot: '#90e0ef',
        hillColor: '#48cae4', groundColor: '#caf0f8', groundTop: '#f0e68c',
        platColor: '#0096c7', platTop: '#48cae4',
        bgColor: 'linear-gradient(135deg, #0077b6, #90e0ef)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.05, y: H-130, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.75, y: H-130, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.35, y: H-170, w: W*0.30, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: 0, y: H-260, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.22, y: H-280, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.60, y: H-280, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.84, y: H-260, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.10, y: H-380, w: W*0.25, h: 14, color: pc, topColor: pt },
                { x: W*0.65, y: H-380, w: W*0.25, h: 14, color: pc, topColor: pt },
                { x: W*0.35, y: H-450, w: W*0.30, h: 14, color: pc, topColor: pt, passThrough: true },
            ],
            walls: [
                { x: W*0.49, y: H-280, w: 10, h: 110 },
            ],
            portals: [
                { x: W*0.05, y: H-310, pair: 1, color1: '#00b4d8', color2: '#0077b6' },
                { x: W*0.90, y: H-310, pair: 1, color1: '#00b4d8', color2: '#0077b6' },
            ],
            specials: [
                { type: 'current', x: W*0.0, y: H-170, w: W*0.35, h: 60, dir: 1 },
                { type: 'current', x: W*0.65, y: H-170, w: W*0.35, h: 60, dir: -1 },
                { type: 'bubble', x: W*0.20, y: H-50, w: 30, h: 30, bounce: -750 },
                { type: 'bubble', x: W*0.50, y: H-50, w: 30, h: 30, bounce: -750 },
                { type: 'bubble', x: W*0.80, y: H-50, w: 30, h: 30, bounce: -750 },
            ]
        })
    },
    {
        name: 'Castle', emoji: '🏰',
        skyTop: '#2c3e50', skyMid: '#34495e', skyBot: '#7f8c8d',
        hillColor: '#5d6d7e', groundColor: '#566573', groundTop: '#808b96',
        platColor: '#7f8c8d', platTop: '#bdc3c7',
        bgColor: 'linear-gradient(135deg, #2c3e50, #7f8c8d)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.0, y: H-150, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: W*0.78, y: H-150, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-130, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.55, y: H-130, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.10, y: H-270, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.36, y: H-250, w: W*0.28, h: 14, color: pc, topColor: pt },
                { x: W*0.72, y: H-270, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: 0, y: H-380, w: W*0.14, h: 14, color: pc, topColor: pt },
                { x: W*0.20, y: H-400, w: W*0.22, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.58, y: H-400, w: W*0.22, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.86, y: H-380, w: W*0.14, h: 14, color: pc, topColor: pt },
                { x: W*0.35, y: H-500, w: W*0.30, h: 14, color: pc, topColor: pt },
            ],
            walls: [
                { x: 0, y: H-380, w: 12, h: 345 },
                { x: W-12, y: H-380, w: 12, h: 345 },
                { x: W*0.49, y: H-250, w: 10, h: 120 },
            ],
            portals: [
                { x: W*0.03, y: H-430, pair: 1, color1: '#bdc3c7', color2: '#7f8c8d' },
                { x: W*0.95, y: H-430, pair: 1, color1: '#bdc3c7', color2: '#7f8c8d' },
            ],
            specials: [
                { type: 'spikes', x: W*0.42, y: H-40, w: W*0.16, h: 10 },
            ]
        })
    },
    {
        name: 'Sky', emoji: '☁️',
        skyTop: '#74b9ff', skyMid: '#a8d8ea', skyBot: '#dfe6e9',
        hillColor: '#ffffff', groundColor: '#dfe6e9', groundTop: '#ffffff',
        platColor: '#b2bec3', platTop: '#ffffff',
        bgColor: 'linear-gradient(135deg, #74b9ff, #dfe6e9)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt },
                { x: W*0.05, y: H-130, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.25, y: H-170, w: W*0.12, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.42, y: H-120, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.63, y: H-170, w: W*0.12, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.80, y: H-130, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.0, y: H-270, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-300, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.55, y: H-300, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.82, y: H-270, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.15, y: H-400, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.65, y: H-400, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.35, y: H-480, w: W*0.30, h: 14, color: pc, topColor: pt, passThrough: true },
            ],
            walls: [],
            portals: [
                { x: W*0.05, y: H-80, pair: 1, color1: '#74b9ff', color2: '#fff' },
                { x: W*0.50, y: H-530, pair: 1, color1: '#74b9ff', color2: '#fff' },
            ],
            specials: [
                { type: 'wind', x: W*0.20, y: H-300, w: W*0.15, h: 130, dir: -1 },
                { type: 'wind', x: W*0.65, y: H-300, w: W*0.15, h: 130, dir: 1 },
                { type: 'cloud', x: W*0.10, y: H-200, w: 50, h: 15, bounce: -650 },
                { type: 'cloud', x: W*0.50, y: H-250, w: 50, h: 15, bounce: -650 },
                { type: 'cloud', x: W*0.85, y: H-200, w: 50, h: 15, bounce: -650 },
            ]
        })
    },
    // ===== NEW WORLDS =====
    {
        name: 'Desert', emoji: '🏜️',
        skyTop: '#f39c12', skyMid: '#f5b041', skyBot: '#fad7a0',
        hillColor: '#d4a037',
        groundColor: '#c19a3e', groundTop: '#e8c568',
        platColor: '#a0522d', platTop: '#cd853f',
        bgColor: 'linear-gradient(135deg, #f39c12, #e8c568)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.05, y: H-120, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.80, y: H-120, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.25, y: H-190, w: W*0.20, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.55, y: H-190, w: W*0.20, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.10, y: H-280, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.72, y: H-280, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.35, y: H-340, w: W*0.30, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.05, y: H-420, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.80, y: H-420, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-480, w: W*0.40, h: 14, color: pc, topColor: pt },
            ],
            walls: [],
            portals: [
                { x: W*0.02, y: H-80, pair: 1, color1: '#f39c12', color2: '#e67e22' },
                { x: W*0.90, y: H-470, pair: 1, color1: '#f39c12', color2: '#e67e22' },
            ],
            specials: [
                { type: 'quicksand', x: W*0.20, y: H-40, w: W*0.15, h: 10 },
                { type: 'quicksand', x: W*0.60, y: H-40, w: W*0.15, h: 10 },
                { type: 'cactus', x: W*0.40, y: H-50, w: 20, h: 25, bounce: -500 },
                { type: 'cactus', x: W*0.75, y: H-50, w: 20, h: 25, bounce: -500 },
            ]
        })
    },
    {
        name: 'Cave', emoji: '🦇',
        skyTop: '#1a1a2e', skyMid: '#16213e', skyBot: '#0f3460',
        hillColor: '#2c2c3a',
        groundColor: '#3a3a4a', groundTop: '#5a5a6a',
        platColor: '#4a4a5a', platTop: '#6a6a7a',
        bgColor: 'linear-gradient(135deg, #1a1a2e, #3a3a4a)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.02, y: H-110, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.78, y: H-110, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-170, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.55, y: H-170, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.10, y: H-250, w: W*0.22, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.68, y: H-250, w: W*0.22, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.35, y: H-330, w: W*0.30, h: 14, color: pc, topColor: pt },
                { x: W*0.05, y: H-400, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.80, y: H-400, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.25, y: H-470, w: W*0.50, h: 14, color: pc, topColor: pt, passThrough: true },
            ],
            walls: [
                { x: W*0.48, y: H-250, w: 12, h: 215 },
                { x: 0, y: H-400, w: 12, h: 365 },
                { x: W-12, y: H-400, w: 12, h: 365 },
            ],
            portals: [
                { x: W*0.05, y: H-460, pair: 1, color1: '#e17055', color2: '#fab1a0' },
                { x: W*0.90, y: H-80, pair: 1, color1: '#e17055', color2: '#fab1a0' },
            ],
            specials: [
                { type: 'stalactite', x: W*0.25, y: 0, w: 15, h: 80, bounce: -600 },
                { type: 'stalactite', x: W*0.50, y: 0, w: 15, h: 60, bounce: -600 },
                { type: 'stalactite', x: W*0.75, y: 0, w: 15, h: 70, bounce: -600 },
                { type: 'crystal', x: W*0.35, y: H-50, w: 25, h: 20, bounce: -850 },
            ]
        })
    },
    {
        name: 'Farm', emoji: '🌾',
        skyTop: '#87CEEB', skyMid: '#b8e4f0', skyBot: '#f0f8ff',
        hillColor: '#7cb342',
        groundColor: '#5d4037', groundTop: '#6d4c41',
        platColor: '#8d6e63', platTop: '#a1887f',
        bgColor: 'linear-gradient(135deg, #87CEEB, #7cb342)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.05, y: H-110, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: W*0.83, y: H-110, w: W*0.12, h: 14, color: pc, topColor: pt },
                { x: W*0.22, y: H-170, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.60, y: H-170, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.40, y: H-250, w: W*0.20, h: 14, color: '#b71c1c', topColor: '#e53935' },
                { x: W*0.08, y: H-320, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.77, y: H-320, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-400, w: W*0.40, h: 14, color: '#b71c1c', topColor: '#e53935', passThrough: true },
                { x: W*0.10, y: H-470, w: W*0.22, h: 14, color: pc, topColor: pt },
                { x: W*0.68, y: H-470, w: W*0.22, h: 14, color: pc, topColor: pt },
            ],
            walls: [],
            portals: [
                { x: W*0.08, y: H-80, pair: 1, color1: '#8bc34a', color2: '#cddc39' },
                { x: W*0.85, y: H-380, pair: 1, color1: '#8bc34a', color2: '#cddc39' },
            ],
            specials: [
                { type: 'haybale', x: W*0.15, y: H-55, w: 35, h: 22, bounce: -700 },
                { type: 'haybale', x: W*0.50, y: H-55, w: 35, h: 22, bounce: -700 },
                { type: 'haybale', x: W*0.80, y: H-55, w: 35, h: 22, bounce: -700 },
                { type: 'mud', x: W*0.35, y: H-40, w: W*0.12, h: 10 },
            ]
        })
    },
    {
        name: 'Jungle', emoji: '🌴',
        skyTop: '#1b5e20', skyMid: '#388e3c', skyBot: '#81c784',
        hillColor: '#2e7d32',
        groundColor: '#33691e', groundTop: '#558b2f',
        platColor: '#5d4037', platTop: '#4e342e',
        bgColor: 'linear-gradient(135deg, #1b5e20, #81c784)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.05, y: H-100, w: W*0.14, h: 14, color: pc, topColor: pt },
                { x: W*0.81, y: H-100, w: W*0.14, h: 14, color: pc, topColor: pt },
                { x: W*0.25, y: H-160, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.60, y: H-160, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.08, y: H-240, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.74, y: H-240, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.38, y: H-300, w: W*0.24, h: 14, color: pc, topColor: pt },
                { x: W*0.15, y: H-380, w: W*0.12, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.73, y: H-380, w: W*0.12, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.30, y: H-450, w: W*0.40, h: 14, color: pc, topColor: pt },
                { x: W*0.45, y: H-530, w: W*0.10, h: 14, color: '#2e7d32', topColor: '#43a047' },
            ],
            walls: [
                { x: 0, y: H-350, w: 12, h: 315 },
                { x: W-12, y: H-350, w: 12, h: 315 },
            ],
            portals: [
                { x: W*0.05, y: H-80, pair: 1, color1: '#66bb6a', color2: '#aed581' },
                { x: W*0.50, y: H-580, pair: 1, color1: '#66bb6a', color2: '#aed581' },
            ],
            specials: [
                { type: 'vine', x: W*0.20, y: H-300, w: 80, h: 130, dir: 1 },
                { type: 'vine', x: W*0.65, y: H-300, w: 80, h: 130, dir: -1 },
                { type: 'mushroom', x: W*0.35, y: H-50, w: 30, h: 20, bounce: -800 },
                { type: 'mushroom', x: W*0.70, y: H-50, w: 30, h: 20, bounce: -800 },
            ]
        })
    },
    {
        name: 'Volcano', emoji: '🌋',
        skyTop: '#2c0b0b', skyMid: '#5c1a1a', skyBot: '#8b3a3a',
        hillColor: '#3d1c1c',
        groundColor: '#2d1a0e', groundTop: '#4a2a15',
        platColor: '#555555', platTop: '#777777',
        bgColor: 'linear-gradient(135deg, #5c1a1a, #ff4500)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.05, y: H-120, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.77, y: H-120, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-190, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.55, y: H-190, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.10, y: H-270, w: W*0.20, h: 14, color: pc, topColor: '#ff6347' },
                { x: W*0.70, y: H-270, w: W*0.20, h: 14, color: pc, topColor: '#ff6347' },
                { x: W*0.35, y: H-350, w: W*0.30, h: 14, color: pc, topColor: pt },
                { x: W*0.15, y: H-430, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.67, y: H-430, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.30, y: H-500, w: W*0.40, h: 14, color: pc, topColor: '#ff6347' },
            ],
            walls: [
                { x: W*0.48, y: H-190, w: 12, h: 155 },
            ],
            portals: [
                { x: W*0.05, y: H-80, pair: 1, color1: '#ff4500', color2: '#ff6347' },
                { x: W*0.90, y: H-490, pair: 1, color1: '#ff4500', color2: '#ff6347' },
            ],
            specials: [
                { type: 'lava', x: W*0.10, y: H-40, w: W*0.15, h: 10 },
                { type: 'lava', x: W*0.45, y: H-40, w: W*0.10, h: 10 },
                { type: 'lava', x: W*0.75, y: H-40, w: W*0.12, h: 10 },
                { type: 'eruption', x: W*0.50, y: H-50, w: 40, h: 20 },
            ]
        })
    },
    {
        name: 'Underwater', emoji: '🐠',
        skyTop: '#003366', skyMid: '#005588', skyBot: '#0077aa',
        hillColor: '#006699',
        groundColor: '#f0e68c', groundTop: '#fafad2',
        platColor: '#20b2aa', platTop: '#48d1cc',
        bgColor: 'linear-gradient(135deg, #003366, #0077aa)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.08, y: H-130, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.76, y: H-130, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-200, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.52, y: H-200, w: W*0.18, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.12, y: H-290, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.68, y: H-290, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.35, y: H-370, w: W*0.30, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.05, y: H-440, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.77, y: H-440, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.25, y: H-510, w: W*0.50, h: 14, color: pc, topColor: pt },
            ],
            walls: [],
            portals: [
                { x: W*0.05, y: H-80, pair: 1, color1: '#00bcd4', color2: '#80deea' },
                { x: W*0.85, y: H-500, pair: 1, color1: '#00bcd4', color2: '#80deea' },
            ],
            specials: [
                { type: 'current', x: W*0.0, y: H-200, w: W*0.30, h: 60, dir: 1 },
                { type: 'current', x: W*0.70, y: H-200, w: W*0.30, h: 60, dir: -1 },
                { type: 'bubble', x: W*0.25, y: H-50, w: 30, h: 30, bounce: -750 },
                { type: 'bubble', x: W*0.55, y: H-50, w: 30, h: 30, bounce: -750 },
                { type: 'bubble', x: W*0.80, y: H-50, w: 30, h: 30, bounce: -750 },
                { type: 'seaweed', x: W*0.40, y: H-50, w: 20, h: 40 },
            ]
        })
    },
    {
        name: 'Graveyard', emoji: '💀',
        skyTop: '#0d0d0d', skyMid: '#1a0a20', skyBot: '#2d1b3d',
        hillColor: '#1a1a2e',
        groundColor: '#2d2d2d', groundTop: '#3d3d3d',
        platColor: '#4a4a4a', platTop: '#5c5c5c',
        bgColor: 'linear-gradient(135deg, #0d0d0d, #2d1b3d)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.03, y: H-120, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.81, y: H-120, w: W*0.16, h: 14, color: pc, topColor: pt },
                { x: W*0.25, y: H-180, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.60, y: H-180, w: W*0.15, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.40, y: H-260, w: W*0.20, h: 14, color: pc, topColor: pt },
                { x: W*0.08, y: H-330, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.74, y: H-330, w: W*0.18, h: 14, color: pc, topColor: pt },
                { x: W*0.30, y: H-400, w: W*0.40, h: 14, color: pc, topColor: pt, passThrough: true },
                { x: W*0.15, y: H-470, w: W*0.15, h: 14, color: pc, topColor: pt },
                { x: W*0.70, y: H-470, w: W*0.15, h: 14, color: pc, topColor: pt },
            ],
            walls: [
                { x: W*0.48, y: H-180, w: 12, h: 145 },
                { x: 0, y: H-300, w: 12, h: 265 },
                { x: W-12, y: H-300, w: 12, h: 265 },
            ],
            portals: [
                { x: W*0.08, y: H-80, pair: 1, color1: '#9b59b6', color2: '#8e44ad' },
                { x: W*0.88, y: H-460, pair: 1, color1: '#9b59b6', color2: '#8e44ad' },
            ],
            specials: [
                { type: 'spikes', x: W*0.18, y: H-40, w: W*0.12, h: 10 },
                { type: 'spikes', x: W*0.65, y: H-40, w: W*0.12, h: 10 },
                { type: 'ghost', x: W*0.30, y: H-250, w: 100, h: 100 },
                { type: 'ghost', x: W*0.60, y: H-350, w: 100, h: 100 },
            ]
        })
    },
    {
        name: 'Neon', emoji: '🌃',
        skyTop: '#0a0015', skyMid: '#150025', skyBot: '#200040',
        hillColor: '#1a0030',
        groundColor: '#1a1a2e', groundTop: '#ff00ff',
        platColor: '#2d2d4e', platTop: '#00ffff',
        bgColor: 'linear-gradient(135deg, #0a0015, #ff00ff)',
        build: (W, H, gc, gt, pc, pt) => ({
            platforms: [
                { x: 0, y: H-35, w: W, h: 35, color: gc, topColor: gt, isGround: true },
                { x: W*0.02, y: H-110, w: W*0.18, h: 14, color: pc, topColor: '#ff00ff' },
                { x: W*0.80, y: H-110, w: W*0.18, h: 14, color: pc, topColor: '#00ffff' },
                { x: W*0.28, y: H-180, w: W*0.18, h: 14, color: pc, topColor: '#ffff00', passThrough: true },
                { x: W*0.54, y: H-180, w: W*0.18, h: 14, color: pc, topColor: '#ff00ff', passThrough: true },
                { x: W*0.10, y: H-260, w: W*0.20, h: 14, color: pc, topColor: '#00ffff' },
                { x: W*0.70, y: H-260, w: W*0.20, h: 14, color: pc, topColor: '#ffff00' },
                { x: W*0.35, y: H-340, w: W*0.30, h: 14, color: pc, topColor: '#ff00ff' },
                { x: W*0.05, y: H-420, w: W*0.15, h: 14, color: pc, topColor: '#00ffff', passThrough: true },
                { x: W*0.80, y: H-420, w: W*0.15, h: 14, color: pc, topColor: '#ffff00', passThrough: true },
                { x: W*0.25, y: H-490, w: W*0.50, h: 14, color: pc, topColor: '#ff00ff' },
            ],
            walls: [],
            portals: [
                { x: W*0.05, y: H-80, pair: 1, color1: '#ff00ff', color2: '#00ffff' },
                { x: W*0.50, y: H-540, pair: 1, color1: '#00ffff', color2: '#ff00ff' },
            ],
            specials: [
                { type: 'boostpad', x: W*0.15, y: H-40, w: 50, h: 8, bounce: -950, dir: 1 },
                { type: 'boostpad', x: W*0.55, y: H-40, w: 50, h: 8, bounce: -950, dir: -1 },
                { type: 'boostpad', x: W*0.85, y: H-40, w: 50, h: 8, bounce: -950, dir: 1 },
            ]
        })
    },
];

function buildLevel() {
    const W = canvas.width;
    const H = canvas.height;
    if (W === 0 || H === 0) return;
    const world = WORLDS[currentWorld];
    const data = world.build(W, H, world.groundColor, world.groundTop, world.platColor, world.platTop);
    platforms = data.platforms;
    walls = data.walls || [];
    portals = data.portals || [];
    specialObjects = data.specials || [];
    specialObjects.forEach(s => { s.squashAnim = 0; });
}

// ===== RACE LEVEL GENERATION =====
function buildRaceLevel() {
    const W = canvas.width;
    const H = canvas.height;
    if (W === 0 || H === 0) return;

    raceSectionWidth = W * 3;
    raceTotalWidth = raceSectionWidth * WORLDS.length;
    raceScrollSpeed = raceTotalWidth / RACE_DURATION;

    platforms = [];
    walls = [];
    specialObjects = [];
    portals = [];

    for (let wi = 0; wi < WORLDS.length; wi++) {
        const world = WORLDS[wi];
        const sx = wi * raceSectionWidth;

        // Ground segment per world
        platforms.push({
            x: sx, y: H - 35, w: raceSectionWidth, h: 35,
            color: world.groundColor, topColor: world.groundTop,
            isGround: true, worldIndex: wi
        });

        // Generate platforms
        generateRacePlatforms(wi, sx, raceSectionWidth, H, world);

        // Generate specials
        generateRaceSpecials(wi, sx, raceSectionWidth, H, world);

        // Generate walls for wall-jumping
        generateRaceWalls(wi, sx, raceSectionWidth, H, world);
    }

    specialObjects.forEach(s => { s.squashAnim = 0; });
}

function generateRacePlatforms(wi, startX, secW, H, world) {
    const pc = world.platColor;
    const pt = world.platTop;
    const numPlats = 18 + Math.floor(Math.random() * 5);
    const tiers = [H-120, H-180, H-250, H-330, H-410, H-480];

    // Use seeded randomness based on world index for consistency on resize
    let seed = wi * 1000 + 42;
    function seededRand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    for (let i = 0; i < numPlats; i++) {
        const progress = (i + 0.5) / numPlats;
        const x = startX + progress * secW + (seededRand() - 0.5) * 80;
        const tierIdx = Math.floor(seededRand() * tiers.length);
        const tier = tiers[tierIdx] + (seededRand() - 0.5) * 25;
        const w = 80 + seededRand() * 120;
        const passThrough = seededRand() < 0.35;

        // Use world-specific colors for candy world
        let color = pc, topColor = pt;
        if (world.name === 'Candy') {
            const candyColors = ['#fd79a8', '#a29bfe', '#55efc4', '#ffeaa7', '#74b9ff'];
            color = candyColors[Math.floor(seededRand() * candyColors.length)];
            topColor = '#fff';
        }

        platforms.push({
            x, y: tier, w, h: 14,
            color, topColor,
            passThrough,
            worldIndex: wi
        });
    }

    // Add some elevated platform clusters (roofs / floating floors)
    const numClusters = 2 + Math.floor(seededRand() * 2);
    for (let c = 0; c < numClusters; c++) {
        const clusterX = startX + secW * (0.2 + c * 0.3) + (seededRand() - 0.5) * 100;
        const clusterY = H - 350 - seededRand() * 150;
        const numInCluster = 2 + Math.floor(seededRand() * 3);
        for (let j = 0; j < numInCluster; j++) {
            platforms.push({
                x: clusterX + j * (60 + seededRand() * 40),
                y: clusterY + (seededRand() - 0.5) * 30,
                w: 60 + seededRand() * 60,
                h: 14,
                color: pc, topColor: pt,
                passThrough: true,
                worldIndex: wi
            });
        }
    }
}

function generateRaceSpecials(wi, startX, secW, H, world) {
    let seed = wi * 2000 + 99;
    function seededRand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    const numSpecials = 4 + Math.floor(seededRand() * 4);

    for (let i = 0; i < numSpecials; i++) {
        const x = startX + secW * ((i + 0.5) / numSpecials) + (seededRand() - 0.5) * 60;
        let s = null;

        switch (world.name) {
            case 'Forest':
                s = { type: 'mushroom', x, y: H-50, w: 30, h: 20, bounce: -800 };
                break;
            case 'Lava':
                s = { type: 'lava', x, y: H-40, w: 60 + seededRand()*60, h: 10 };
                break;
            case 'Candy':
                s = { type: 'trampoline', x, y: H-50, w: 40, h: 12, bounce: -900 };
                break;
            case 'Space':
                s = { type: 'lowgrav', x: x-60, y: H-350-seededRand()*80, w: 130, h: 120 };
                break;
            case 'Ocean':
                s = i % 2 === 0
                    ? { type: 'bubble', x, y: H-50, w: 30, h: 30, bounce: -750 }
                    : { type: 'current', x: x-60, y: H-200-seededRand()*80, w: 150, h: 60, dir: seededRand()<0.5?1:-1 };
                break;
            case 'Castle':
                s = { type: 'spikes', x, y: H-40, w: 60+seededRand()*50, h: 10 };
                break;
            case 'Sky':
                s = i % 2 === 0
                    ? { type: 'wind', x: x-40, y: H-300-seededRand()*80, w: 90, h: 130, dir: seededRand()<0.5?1:-1 }
                    : { type: 'cloud', x, y: H-180-seededRand()*100, w: 50, h: 15, bounce: -650 };
                break;
            case 'Snow Mountain':
                // Snow Mountain = slippery, no special objects but add some elevated ice platforms
                break;
            case 'Desert':
                s = i % 2 === 0
                    ? { type: 'quicksand', x, y: H-40, w: 60+seededRand()*60, h: 10 }
                    : { type: 'cactus', x, y: H-50, w: 20, h: 25, bounce: -500 };
                break;
            case 'Cave':
                s = i % 2 === 0
                    ? { type: 'stalactite', x, y: 0, w: 15, h: 50+seededRand()*40, bounce: -600 }
                    : { type: 'crystal', x, y: H-50, w: 25, h: 20, bounce: -850 };
                break;
            case 'Farm':
                s = i % 3 === 0
                    ? { type: 'mud', x, y: H-40, w: 50+seededRand()*40, h: 10 }
                    : { type: 'haybale', x, y: H-55, w: 35, h: 22, bounce: -700 };
                break;
            case 'Jungle':
                s = i % 2 === 0
                    ? { type: 'vine', x: x-40, y: H-300-seededRand()*80, w: 80, h: 130, dir: seededRand()<0.5?1:-1 }
                    : { type: 'mushroom', x, y: H-50, w: 30, h: 20, bounce: -800 };
                break;
            case 'Volcano':
                s = i % 3 === 0
                    ? { type: 'eruption', x, y: H-50, w: 40, h: 20 }
                    : { type: 'lava', x, y: H-40, w: 60+seededRand()*60, h: 10 };
                break;
            case 'Underwater':
                s = i % 2 === 0
                    ? { type: 'bubble', x, y: H-50, w: 30, h: 30, bounce: -750 }
                    : { type: 'current', x: x-60, y: H-200-seededRand()*80, w: 150, h: 60, dir: seededRand()<0.5?1:-1 };
                break;
            case 'Graveyard':
                s = i % 2 === 0
                    ? { type: 'spikes', x, y: H-40, w: 60+seededRand()*50, h: 10 }
                    : { type: 'ghost', x: x-50, y: H-250-seededRand()*80, w: 100, h: 100 };
                break;
            case 'Neon':
                s = { type: 'boostpad', x, y: H-40, w: 50, h: 8, bounce: -950, dir: seededRand()<0.5?1:-1 };
                break;
        }

        if (s) {
            s.squashAnim = 0;
            s.worldIndex = wi;
            specialObjects.push(s);
        }
    }
}

function generateRaceWalls(wi, startX, secW, H, world) {
    let seed = wi * 3000 + 77;
    function seededRand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    // 1-2 walls per section
    const numWalls = 1 + Math.floor(seededRand() * 2);
    for (let i = 0; i < numWalls; i++) {
        const x = startX + secW * (0.3 + i * 0.35) + (seededRand()-0.5) * 80;
        walls.push({
            x, y: H - 280 - seededRand()*80, w: 12, h: 200 + seededRand()*80,
            worldIndex: wi
        });
    }
}

// Viewport culling helper for race mode
function isInView(objX, objW) {
    if (gameMode !== 'race') return true;
    const margin = 150;
    return (objX + objW > cameraX - margin) && (objX < cameraX + canvas.width + margin);
}

// ===== POWER-UP SYSTEM =====
const POWERUP_TYPES = [
    { type: 'speed', emoji: '⚡', color: '#f1c40f', duration: 4 },
    { type: 'freeze', emoji: '❄️', color: '#74b9ff', duration: 2 },
    { type: 'shield', emoji: '🛡️', color: '#a29bfe', duration: 3 },
    { type: 'magnet', emoji: '🧲', color: '#e17055', duration: 5 },
    { type: 'swap', emoji: '🔀', color: '#00cec9', duration: 0 },
    { type: 'teleport', emoji: '🔮', color: '#6c5ce7', duration: 0 },
    { type: 'shrink', emoji: '🍄', color: '#fdcb6e', duration: 4 },
];

let powerUpSpawnTimer = 5;

function spawnPowerUp() {
    if (powerUps.length >= 3) return;
    const W = canvas.width;
    const H = canvas.height;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

    let spawnX, spawnY;
    if (gameMode === 'race') {
        // Spawn ahead of camera
        spawnX = cameraX + W * 0.5 + Math.random() * W;
        if (spawnX > raceTotalWidth - 200) return;
        spawnY = 80 + Math.random() * (H - 250);
    } else {
        spawnX = 80 + Math.random() * (W - 160);
        spawnY = 100 + Math.random() * (H - 300);
    }

    powerUps.push({
        x: spawnX, y: spawnY,
        w: 30, h: 30,
        ...type,
        bobOffset: Math.random() * Math.PI * 2,
        age: 0
    });
}

// ===== PLAYER CLASS =====
class Player {
    constructor(id, x, y, color, accentColor) {
        this.id = id;
        this.x = x; this.y = y;
        this.baseW = 26; this.baseH = 26;
        this.w = 26; this.h = 26;
        this.vx = 0; this.vy = 0;
        this.color = color;
        this.accentColor = accentColor;
        this.speed = 300;
        this.jumpForce = -620;
        this.onGround = false;
        this.facing = id === 1 ? 1 : -1;
        this.moveInput = { x: 0, jump: false, jumpPressed: false, dash: false };
        this.animTime = 0;
        this.squash = 1; this.stretch = 1;

        // Power-up state
        this.speedBoost = 0;
        this.frozen = 0;
        this.shield = 0;
        this.magnet = 0;
        this.shrunk = 0;

        // Trail
        this.trail = [];

        // Portal cooldown
        this.portalCooldown = 0;

        // Double jump
        this.jumpsLeft = 2;
        this.maxJumps = 2;

        // Wall jump
        this.onWall = 0; // -1 left wall, 1 right wall, 0 none
        this.wallSlideTimer = 0;

        // Dash
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.dashDir = 0;
        this.DASH_DURATION = 0.15;
        this.DASH_COOLDOWN = 1.5;
        this.DASH_SPEED = 800;
    }

    update(dt) {
        this.animTime += dt;

        // Decrease power-up timers
        if (this.speedBoost > 0) this.speedBoost -= dt;
        if (this.frozen > 0) this.frozen -= dt;
        if (this.shield > 0) this.shield -= dt;
        if (this.magnet > 0) this.magnet -= dt;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;

        // Shrink effect
        if (this.shrunk > 0) {
            this.shrunk -= dt;
            this.w = this.baseW * 0.6;
            this.h = this.baseH * 0.6;
        } else {
            this.w = this.baseW;
            this.h = this.baseH;
        }

        // Check if in low gravity zone
        let inLowGrav = false;
        const pcx = this.x + this.w / 2;
        const pcy = this.y + this.h / 2;
        for (const s of specialObjects) {
            if (s.type === 'lowgrav' && pcx > s.x && pcx < s.x + s.w && pcy > s.y && pcy < s.y + s.h) {
                inLowGrav = true; break;
            }
        }
        const gravityMult = inLowGrav ? 0.3 : 1.0;
        let isIcy = false;
        if (gameMode === 'race') {
            const playerSection = Math.floor(this.x / raceSectionWidth);
            if (playerSection >= 0 && playerSection < WORLDS.length) {
                isIcy = WORLDS[playerSection].icy && this.onGround;
            }
        } else {
            isIcy = WORLDS[currentWorld].icy && this.onGround;
        }

        // Frozen = can't move
        if (this.frozen > 0) {
            this.vx *= 0.85;
            this.vy += 1400 * gravityMult * dt;
        } else if (this.dashTimer > 0) {
            // Dashing
            this.dashTimer -= dt;
            this.vx = this.dashDir * this.DASH_SPEED;
            this.vy = 0;
            // Dash trail particles
            if (Math.random() < 0.5) {
                spawnParticles(this.x + this.w/2, this.y + this.h/2, '#6c5ce7', 1);
            }
        } else {
            // Horizontal movement
            const spd = this.speedBoost > 0 ? this.speed * 1.6 : this.speed;

            if (isIcy) {
                const targetVx = this.moveInput.x * spd;
                this.vx += (targetVx - this.vx) * 2.5 * dt;
                if (this.moveInput.x === 0) this.vx *= (1 - 1.2 * dt);
            } else {
                this.vx = this.moveInput.x * spd;
            }

            if (this.moveInput.x !== 0) this.facing = this.moveInput.x > 0 ? 1 : -1;

            // Wall slide detection
            this.onWall = 0;
            if (!this.onGround && this.vy > 0) {
                for (const w of walls) {
                    // Touching left side of wall while moving right
                    if (this.moveInput.x > 0 && this.x + this.w >= w.x && this.x + this.w <= w.x + 8 &&
                        this.y + this.h > w.y && this.y < w.y + w.h) {
                        this.onWall = 1; break;
                    }
                    // Touching right side of wall while moving left
                    if (this.moveInput.x < 0 && this.x <= w.x + w.w && this.x >= w.x + w.w - 8 &&
                        this.y + this.h > w.y && this.y < w.y + w.h) {
                        this.onWall = -1; break;
                    }
                }
            }

            // Wall slide (slow fall)
            if (this.onWall !== 0) {
                this.vy = Math.min(this.vy, 80);
                this.wallSlideTimer += dt;
                this.jumpsLeft = 1; // Allow wall jump
                if (Math.random() < 0.3) {
                    spawnParticles(
                        this.onWall === 1 ? this.x + this.w : this.x,
                        this.y + this.h * 0.5, '#fff', 1
                    );
                }
            } else {
                this.wallSlideTimer = 0;
            }

            // Jump (supports double jump & wall jump)
            if (this.moveInput.jumpPressed) {
                if (this.onWall !== 0) {
                    // Wall jump
                    this.vy = this.jumpForce * 0.85;
                    this.vx = -this.onWall * 350;
                    this.facing = -this.onWall;
                    this.onWall = 0;
                    this.jumpsLeft = 1;
                    this.squash = 0.6; this.stretch = 1.4;
                    spawnParticles(this.x + this.w/2, this.y + this.h/2, '#a29bfe', 6);
                    playSound('walljump');
                } else if (this.jumpsLeft > 0) {
                    this.vy = this.jumpForce * (inLowGrav ? 0.7 : 1) * (this.jumpsLeft < this.maxJumps ? 0.85 : 1);
                    this.onGround = false;
                    this.jumpsLeft--;
                    this.squash = 0.6; this.stretch = 1.4;
                    const isDouble = this.jumpsLeft < this.maxJumps - 1;
                    spawnParticles(this.x + this.w/2, this.y + this.h,
                        isDouble ? '#a29bfe' : (inLowGrav ? '#a29bfe' : '#fff'), isDouble ? 8 : 5);
                    playSound('jump');
                }
                this.moveInput.jumpPressed = false;
            }

            // Dash
            if (this.moveInput.dash && this.dashCooldown <= 0) {
                this.dashTimer = this.DASH_DURATION;
                this.dashCooldown = this.DASH_COOLDOWN;
                this.dashDir = this.facing;
                this.vy = 0;
                spawnParticles(this.x + this.w/2, this.y + this.h/2, '#6c5ce7', 8);
                playSound('dash');
                screenShake = 0.1;
                this.moveInput.dash = false;
            }

            // Gravity
            this.vy += 1400 * gravityMult * dt;

            if (inLowGrav && !this.onGround) {
                this.vy *= 0.98;
            }
        }

        // Squash & stretch recovery
        this.squash += (1 - this.squash) * 8 * dt;
        this.stretch += (1 - this.stretch) * 8 * dt;

        // Cap fall speed
        if (this.vy > 800) this.vy = 800;

        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Platform collision
        this.onGround = false;
        for (const p of platforms) {
            if (gameMode === 'race' && !isInView(p.x, p.w)) continue;
            const isGround = p.isGround || (p.w >= canvas.width * 0.9);
            const isSolid = isGround || !p.passThrough;

            if (this.x + this.w > p.x && this.x < p.x + p.w) {
                // Landing on top (falling down)
                if (this.vy >= 0 && this.y + this.h > p.y && this.y + this.h < p.y + p.h + this.vy * dt + 5) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                    this.onGround = true;
                    this.jumpsLeft = this.maxJumps;
                    if (this.squash < 0.85) spawnParticles(this.x + this.w/2, this.y + this.h, '#fff', 3);
                    this.squash = 1.1; this.stretch = 0.9;
                }
                // Solid platforms block from below (head bump)
                if (isSolid && this.vy < 0 && this.y < p.y + p.h && this.y + this.h > p.y + p.h) {
                    this.y = p.y + p.h;
                    this.vy = 0;
                }
            }
            // Solid platforms block from sides
            if (isSolid && !isGround && this.y + this.h > p.y + 4 && this.y < p.y + p.h - 2) {
                // From left
                if (this.vx > 0 && this.x + this.w > p.x && this.x + this.w < p.x + 10 && this.x < p.x) {
                    this.x = p.x - this.w;
                }
                // From right
                if (this.vx < 0 && this.x < p.x + p.w && this.x > p.x + p.w - 10 && this.x + this.w > p.x + p.w) {
                    this.x = p.x + p.w;
                }
            }
        }

        // Wall collision (solid walls block movement)
        for (const w of walls) {
            if (this.y + this.h > w.y && this.y < w.y + w.h) {
                // From left
                if (this.vx > 0 && this.x + this.w > w.x && this.x < w.x) {
                    this.x = w.x - this.w;
                    if (this.dashTimer > 0) { this.dashTimer = 0; this.vx = 0; }
                }
                // From right
                if (this.vx < 0 && this.x < w.x + w.w && this.x + this.w > w.x + w.w) {
                    this.x = w.x + w.w;
                    if (this.dashTimer > 0) { this.dashTimer = 0; this.vx = 0; }
                }
            }
        }

        // Special objects collision
        const cx2 = this.x + this.w / 2;
        const cy2 = this.y + this.h / 2;
        for (const s of specialObjects) {
            if (s.type === 'mushroom' || s.type === 'trampoline' || s.type === 'bubble' || s.type === 'cloud' || s.type === 'cactus' || s.type === 'crystal' || s.type === 'haybale') {
                if (this.vy >= 0 && cx2 > s.x && cx2 < s.x + s.w &&
                    this.y + this.h > s.y && this.y + this.h < s.y + s.h + 15) {
                    this.vy = s.bounce;
                    this.squash = 0.5; this.stretch = 1.5;
                    s.squashAnim = 0.3;
                    const colors = { mushroom: '#e74c3c', trampoline: '#fd79a8', bubble: '#74b9ff', cloud: '#dfe6e9', cactus: '#2e7d32', crystal: '#64c8ff', haybale: '#d4a03a' };
                    spawnParticles(cx2, s.y, colors[s.type] || '#fff', 6);
                    playSound('bounce');
                }
            }
            if (s.type === 'boostpad') {
                if (this.vy >= 0 && cx2 > s.x && cx2 < s.x + s.w &&
                    this.y + this.h > s.y && this.y + this.h < s.y + s.h + 15) {
                    this.vy = s.bounce;
                    this.vx += (s.dir || 1) * 400;
                    this.squash = 0.4; this.stretch = 1.6;
                    spawnParticles(cx2, s.y, '#ff00ff', 8);
                    playSound('bounce');
                }
            }
            if (s.type === 'stalactite') {
                // Head bump from below
                if (this.vy < 0 && cx2 > s.x && cx2 < s.x + s.w &&
                    this.y < s.y + s.h && this.y > s.y + s.h - 15) {
                    this.vy = s.bounce || 200;
                    this.squash = 1.3; this.stretch = 0.7;
                    spawnParticles(cx2, s.y + s.h, '#6a6a7a', 5);
                }
            }
            if (s.type === 'lava' || s.type === 'spikes' || s.type === 'eruption') {
                if (this.x + this.w > s.x && this.x < s.x + s.w &&
                    this.y + this.h > s.y && this.y + this.h < s.y + s.h + 10 && this.onGround) {
                    this.vy = -600;
                    this.onGround = false;
                    this.squash = 0.6; this.stretch = 1.4;
                    spawnParticles(cx2, s.y, s.type === 'eruption' ? '#ff4500' : s.type === 'lava' ? '#ff6347' : '#bdc3c7', 8);
                }
            }
            if (s.type === 'quicksand' || s.type === 'mud') {
                if (this.x + this.w > s.x && this.x < s.x + s.w &&
                    this.y + this.h > s.y && this.y + this.h < s.y + s.h + 10 && this.onGround) {
                    this.vx *= 0.7; // Heavy slowdown each frame
                }
            }
            if (s.type === 'current') {
                if (cx2 > s.x && cx2 < s.x + s.w && cy2 > s.y && cy2 < s.y + s.h) {
                    this.vx += s.dir * 400 * dt;
                }
            }
            if (s.type === 'wind' || s.type === 'vine') {
                if (cx2 > s.x && cx2 < s.x + s.w && cy2 > s.y && cy2 < s.y + s.h) {
                    this.vy -= 600 * dt;
                    this.vx += (s.dir || 0) * 150 * dt;
                }
            }
            if (s.type === 'ghost') {
                if (cx2 > s.x && cx2 < s.x + s.w && cy2 > s.y && cy2 < s.y + s.h) {
                    // Reverse controls (swap vx direction)
                    this.vx *= -0.5;
                }
            }
        }

        // Magnet effect - pull nearby power-ups toward player
        if (this.magnet > 0) {
            for (const pu of powerUps) {
                const dx = (this.x + this.w/2) - (pu.x + pu.w/2);
                const dy = (this.y + this.h/2) - (pu.y + pu.h/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 150 && dist > 5) {
                    pu.x += (dx / dist) * 200 * dt;
                    pu.y += (dy / dist) * 200 * dt;
                }
            }
        }

        // Portal collision
        if (!this.portalCooldown || this.portalCooldown <= 0) {
            for (const portal of portals) {
                const dx = cx2 - portal.x;
                const dy = cy2 - portal.y;
                if (dx*dx + dy*dy < 25*25) {
                    const dest = portals.find(p => p.pair === portal.pair && p !== portal);
                    if (dest) {
                        this.x = dest.x - this.w/2;
                        this.y = dest.y - this.h/2;
                        this.portalCooldown = 0.8;
                        spawnParticles(portal.x, portal.y, portal.color1, 10);
                        spawnParticles(dest.x, dest.y, dest.color1, 10);
                        playSound('portal');
                    }
                    break;
                }
            }
        }
        if (this.portalCooldown > 0) this.portalCooldown -= dt;

        // Screen wrapping / camera bounding
        if (gameMode === 'race') {
            // Can't fall behind camera (pushed by moving wall)
            if (this.x < cameraX) {
                this.x = cameraX;
                this.vx = Math.max(this.vx, 0);
            }
            // Can't go more than 1 screen ahead of camera
            if (this.x + this.w > cameraX + canvas.width) {
                this.x = cameraX + canvas.width - this.w;
                this.vx = Math.min(this.vx, 0);
            }
        } else {
            // Side barriers - can't go through edges
            if (this.x < 0) { this.x = 0; this.vx = Math.max(this.vx, 0); }
            if (this.x + this.w > canvas.width) { this.x = canvas.width - this.w; this.vx = Math.min(this.vx, 0); }
        }

        // Ceiling
        if (this.y < 0) { this.y = 0; if (this.vy < 0) this.vy = 0; }

        // Trail (for "it" player)
        if (itPlayer === this.id) {
            this.trail.push({ x: this.x + this.w/2, y: this.y + this.h/2, life: 0.4 });
            if (this.trail.length > 15) this.trail.shift();
        } else {
            this.trail = [];
        }
        this.trail.forEach(t => t.life -= dt);
        this.trail = this.trail.filter(t => t.life > 0);
    }

    draw() {
        const cx = this.x + this.w / 2;
        const cy = this.y + this.h / 2;

        // Draw trail for "it" player
        if (itPlayer === this.id) {
            for (const t of this.trail) {
                const alpha = t.life / 0.4;
                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = '#e74c3c';
                const r = this.w / 2 * alpha;
                ctx.beginPath();
                ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.squash, this.stretch);

        const r = this.w / 2;

        // Frozen effect
        if (this.frozen > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(this.animTime * 15) * 0.2;
        }

        // Dash afterimage
        if (this.dashTimer > 0) {
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(-this.dashDir * 15, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Shield glow
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(162, 155, 254, ${0.3 + Math.sin(this.animTime * 5) * 0.15})`;
            ctx.fill();
            ctx.strokeStyle = '#a29bfe';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Magnet glow
        if (this.magnet > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 8 + Math.sin(this.animTime * 4) * 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(225, 112, 85, ${0.4 + Math.sin(this.animTime * 6) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Body (circle)
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0, 0, r);
        grad.addColorStop(0, this.accentColor);
        grad.addColorStop(1, this.color);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eyes
        const s = r / 18;
        const eyeOffsetX = this.facing * 3 * s;
        const eyeY = -2 * s;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-4*s + eyeOffsetX, eyeY, 4.5*s, 5*s, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(4*s + eyeOffsetX, eyeY, 4.5*s, 5*s, 0, 0, Math.PI*2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#2d3436';
        const pupilX = this.facing * 1.5 * s;
        ctx.beginPath();
        ctx.arc(-4*s + eyeOffsetX + pupilX, eyeY + 1*s, 2.2*s, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4*s + eyeOffsetX + pupilX, eyeY + 1*s, 2.2*s, 0, Math.PI*2);
        ctx.fill();
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-4*s + eyeOffsetX + pupilX - 0.8*s, eyeY - 0.8*s, 0.9*s, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4*s + eyeOffsetX + pupilX - 0.8*s, eyeY - 0.8*s, 0.9*s, 0, Math.PI*2);
        ctx.fill();

        // Mouth
        if (itPlayer === this.id) {
            ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1.5 * s;
            ctx.beginPath();
            ctx.moveTo(-3.5*s, 5.5*s); ctx.lineTo(0, 4*s); ctx.lineTo(3.5*s, 5.5*s);
            ctx.stroke();
            ctx.lineWidth = 2 * s;
            ctx.beginPath(); ctx.moveTo(-7*s+eyeOffsetX, eyeY-6*s); ctx.lineTo(-2*s+eyeOffsetX, eyeY-4.5*s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(7*s+eyeOffsetX, eyeY-6*s); ctx.lineTo(2*s+eyeOffsetX, eyeY-4.5*s); ctx.stroke();
        } else {
            ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1.5 * s;
            ctx.beginPath();
            ctx.arc(0, 3.5*s, 3.5*s, 0.1*Math.PI, 0.9*Math.PI);
            ctx.stroke();
        }

        // Speed boost sparkle
        if (this.speedBoost > 0) {
            for (let i = 0; i < 3; i++) {
                const angle = this.animTime * 3 + i * (Math.PI*2/3);
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(Math.cos(angle)*(r+6), Math.sin(angle)*(r+6), 3, 0, Math.PI*2);
                ctx.fill();
            }
        }

        // Frozen ice effect
        if (this.frozen > 0) {
            ctx.strokeStyle = 'rgba(116, 185, 255, 0.7)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, r+4, 0, Math.PI*2); ctx.stroke();
        }

        // Wall slide indicator
        if (this.onWall !== 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            const wx = this.onWall * (r + 3);
            for (let i = 0; i < 3; i++) {
                const wy = -r + i * r + Math.sin(this.animTime * 8 + i) * 2;
                ctx.beginPath(); ctx.arc(wx, wy, 2, 0, Math.PI*2); ctx.fill();
            }
        }

        ctx.restore();
        ctx.globalAlpha = 1;

        // "IT" label above head
        if (itPlayer === this.id) {
            ctx.save();
            ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = '#e74c3c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
            const labelY = this.y - 8 + Math.sin(this.animTime * 4) * 3;
            ctx.strokeText('IT!', cx, labelY);
            ctx.fillText('IT!', cx, labelY);
            ctx.restore();
        }

        // Player label
        ctx.save();
        ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        const labelText = (this.id === 2 && isVsAI) ? 'CPU' : 'P' + this.id;
        ctx.fillText(labelText, cx, this.y - 1 + (itPlayer === this.id ? -11 : 0));
        ctx.restore();
    }
}

// ===== AI SYSTEM =====
const AI_CONFIG = {
    easy:   { reactionDelay: 0.4, jumpAccuracy: 0.5, dashChance: 0.1, powerupAwareness: 0.4, predictionFrames: 0 },
    medium: { reactionDelay: 0.2, jumpAccuracy: 0.75, dashChance: 0.3, powerupAwareness: 0.7, predictionFrames: 5 },
    hard:   { reactionDelay: 0.05, jumpAccuracy: 0.95, dashChance: 0.6, powerupAwareness: 0.95, predictionFrames: 15 },
};

let aiReactionTimer = 0;
let aiDecision = { x: 0, jump: false, dash: false };

function updateAI(dt) {
    if (!isVsAI) return;
    const cfg = AI_CONFIG[aiDifficulty];
    const ai = player2;
    const target = player1;

    aiReactionTimer -= dt;
    if (aiReactionTimer > 0) {
        ai.moveInput.x = aiDecision.x;
        if (aiDecision.jump) { ai.moveInput.jumpPressed = true; aiDecision.jump = false; }
        if (aiDecision.dash) { ai.moveInput.dash = true; aiDecision.dash = false; }
        return;
    }
    aiReactionTimer = cfg.reactionDelay;

    const aiCx = ai.x + ai.w/2;
    const aiCy = ai.y + ai.h/2;
    const tCx = target.x + target.w/2 + target.vx * cfg.predictionFrames * 0.016;
    const tCy = target.y + target.h/2;
    const dx = tCx - aiCx;
    const dy = tCy - aiCy;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const amIt = itPlayer === 2;

    // Check for nearby power-ups
    let bestPU = null;
    let bestPUDist = 200;
    if (Math.random() < cfg.powerupAwareness) {
        for (const pu of powerUps) {
            const pdx = (pu.x + pu.w/2) - aiCx;
            const pdy = (pu.y + pu.h/2) - aiCy;
            const pDist = Math.sqrt(pdx*pdx + pdy*pdy);
            if (pDist < bestPUDist) { bestPUDist = pDist; bestPU = pu; }
        }
    }

    let moveX = 0;
    let shouldJump = false;
    let shouldDash = false;

    if (bestPU && (!amIt || dist > 150)) {
        // Go for power-up
        const pdx = (bestPU.x + bestPU.w/2) - aiCx;
        const pdy = (bestPU.y + bestPU.h/2) - aiCy;
        moveX = pdx > 10 ? 1 : pdx < -10 ? -1 : 0;
        if (pdy < -40 && ai.onGround && Math.random() < cfg.jumpAccuracy) shouldJump = true;
    } else if (amIt) {
        // Chase target
        moveX = dx > 15 ? 1 : dx < -15 ? -1 : 0;
        if (dy < -50 && Math.random() < cfg.jumpAccuracy) shouldJump = true;
        if (ai.onGround && Math.abs(dy) < 50 && Math.random() < cfg.jumpAccuracy * 0.3) shouldJump = true;
        if (dist < 200 && dist > 60 && ai.dashCooldown <= 0 && Math.random() < cfg.dashChance) shouldDash = true;
        // Wall jump when stuck
        if (ai.onWall !== 0 && Math.random() < cfg.jumpAccuracy) shouldJump = true;
    } else {
        // Run away from target
        moveX = dx > 0 ? -1 : 1;
        // Jump to escape
        if (dist < 100 && Math.random() < cfg.jumpAccuracy * 0.6) shouldJump = true;
        if (ai.onGround && Math.random() < 0.05) shouldJump = true;
        // Dash away when close
        if (dist < 80 && ai.dashCooldown <= 0 && Math.random() < cfg.dashChance) shouldDash = true;
        // Use platforms - jump to higher ground
        if (dy > 30 && ai.onGround && Math.random() < cfg.jumpAccuracy * 0.3) shouldJump = true;
        // Wall jump to escape
        if (ai.onWall !== 0 && Math.random() < cfg.jumpAccuracy) shouldJump = true;
    }

    // Random variation for easy mode
    if (aiDifficulty === 'easy' && Math.random() < 0.15) {
        moveX = 0;
        shouldJump = false;
    }

    // Race mode: always bias right, don't retreat near left edge
    if (gameMode === 'race') {
        if (moveX === 0) moveX = 1;
        if (moveX === -1 && ai.x < cameraX + canvas.width * 0.3) moveX = 1;
        // Jump more often to traverse platforms
        if (ai.onGround && Math.random() < 0.12) shouldJump = true;
        // More aggressive dashing forward
        if (ai.dashCooldown <= 0 && Math.random() < 0.08) { shouldDash = true; ai.facing = 1; }
    }

    aiDecision = { x: moveX, jump: shouldJump, dash: shouldDash };
    ai.moveInput.x = moveX;
    if (shouldJump) ai.moveInput.jumpPressed = true;
    if (shouldDash) ai.moveInput.dash = true;
}

// ===== PARTICLES =====
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 200,
            vy: -Math.random() * 200 - 50,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.5,
            color,
            r: 2 + Math.random() * 3
        });
    }
}

function spawnTagParticles(x, y) {
    for (let i = 0; i < 25; i++) {
        const angle = (i / 25) * Math.PI * 2;
        const speed = 150 + Math.random() * 200;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5 + Math.random() * 0.3,
            maxLife: 0.7,
            color: ['#e74c3c', '#f39c12', '#f1c40f', '#e67e22'][i % 4],
            r: 3 + Math.random() * 4
        });
    }
}

function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ===== CREATE PLAYERS =====
let player1, player2;

function resetPlayers() {
    const W = canvas.width;
    const H = canvas.height;
    player1 = new Player(1, W * 0.2, H - 100, '#0984e3', '#74b9ff');
    player2 = new Player(2, W * 0.75, H - 100, '#d63031', '#ff7675');
}

// ===== INPUT HANDLING =====
const keys = {};
let prevKeys = {};

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    e.preventDefault();
});

function processKeyboardInput() {
    // Player 1: WASD + E for dash
    player1.moveInput.x = 0;
    if (keys['KeyA']) player1.moveInput.x -= 1;
    if (keys['KeyD']) player1.moveInput.x += 1;
    // Jump on press (not hold)
    if (keys['KeyW'] && !prevKeys['KeyW']) player1.moveInput.jumpPressed = true;
    if ((keys['KeyE'] && !prevKeys['KeyE']) || (keys['ShiftLeft'] && !prevKeys['ShiftLeft']) || (keys['ShiftRight'] && !prevKeys['ShiftRight'])) player1.moveInput.dash = true;

    // Player 2: Arrow keys + M for dash (only if not AI)
    if (!isVsAI) {
        player2.moveInput.x = 0;
        if (keys['ArrowLeft']) player2.moveInput.x -= 1;
        if (keys['ArrowRight']) player2.moveInput.x += 1;
        if (keys['ArrowUp'] && !prevKeys['ArrowUp']) player2.moveInput.jumpPressed = true;
        if ((keys['KeyM'] && !prevKeys['KeyM']) || (keys['Slash'] && !prevKeys['Slash'])) player2.moveInput.dash = true;
    }

    prevKeys = { ...keys };
}

// ===== MOBILE JOYSTICK =====
const joysticks = {};

function setupJoystick(playerId, areaId, baseId, knobId) {
    const area = document.getElementById(areaId);
    const base = document.getElementById(baseId);
    const knob = document.getElementById(knobId);
    if (!area) return;

    const state = { active: false, startX: 0, startY: 0, touchId: null };
    joysticks[playerId] = state;

    area.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        state.active = true;
        state.touchId = touch.identifier;
        const rect = base.getBoundingClientRect();
        state.startX = rect.left + rect.width / 2;
        state.startY = rect.top + rect.height / 2;
    });

    window.addEventListener('touchmove', e => {
        if (!state.active) return;
        for (const touch of e.changedTouches) {
            if (touch.identifier === state.touchId) {
                const dx = touch.clientX - state.startX;
                const dy = touch.clientY - state.startY;
                const maxDist = 35;
                const dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
                const angle = Math.atan2(dy, dx);
                const clampX = Math.cos(angle) * dist;
                const clampY = Math.sin(angle) * dist;
                knob.style.transform = `translate(${clampX}px, ${clampY}px)`;
                const player = playerId === 1 ? player1 : player2;
                if (player) {
                    const nx = clampX / maxDist;
                    player.moveInput.x = Math.abs(nx) > 0.2 ? Math.sign(nx) : 0;
                }
            }
        }
    });

    const endTouch = e => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === state.touchId) {
                state.active = false;
                knob.style.transform = 'translate(0, 0)';
                const player = playerId === 1 ? player1 : player2;
                if (player) player.moveInput.x = 0;
            }
        }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
}

function setupJumpButton(playerId, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const player = playerId === 1 ? player1 : player2;
        if (player) player.moveInput.jumpPressed = true;
    });
}

function setupDashButton(playerId, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const player = playerId === 1 ? player1 : player2;
        if (player) player.moveInput.dash = true;
    });
}

// ===== TAG MECHANIC =====
function checkTag() {
    if (tagCooldown > 0) return;
    const a = itPlayer === 1 ? player1 : player2;
    const b = itPlayer === 1 ? player2 : player1;
    if (b.shield > 0) return;
    // Dash through shield
    if (a.dashTimer > 0 && b.shield > 0) return;

    const overlapX = a.x + a.w > b.x && a.x < b.x + b.w;
    const overlapY = a.y + a.h > b.y && a.y < b.y + b.h;

    if (overlapX && overlapY) {
        const midX = (a.x + a.w/2 + b.x + b.w/2) / 2;
        const midY = (a.y + a.h/2 + b.y + b.h/2) / 2;
        spawnTagParticles(midX, midY);
        playSound('tag');

        itPlayer = itPlayer === 1 ? 2 : 1;
        tagCooldown = TAG_COOLDOWN;
        tagFlash = 0.5;
        screenShake = 0.2;

        const pushDir = a.x < b.x ? -1 : 1;
        a.vx = pushDir * 300; a.vy = -200;
        b.vx = -pushDir * 300; b.vy = -200;

        updateItIndicator();
    }
}

function updateItIndicator() {
    const label = itPlayer === 2 && isVsAI ? 'CPU' : 'P' + itPlayer;
    document.getElementById('it-text').textContent = `${label} is IT!`;
}

// ===== POWER-UP COLLISION =====
function checkPowerUps() {
    const players = [player1, player2];
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        for (const p of players) {
            if (p.x + p.w > pu.x && p.x < pu.x + pu.w &&
                p.y + p.h > pu.y && p.y < pu.y + pu.h) {
                applyPowerUp(p, pu);
                spawnParticles(pu.x + pu.w/2, pu.y + pu.h/2, pu.color, 10);
                playSound('powerup');
                powerUps.splice(i, 1);
                break;
            }
        }
    }
}

function applyPowerUp(player, pu) {
    const other = player === player1 ? player2 : player1;
    switch (pu.type) {
        case 'speed':
            player.speedBoost = pu.duration;
            break;
        case 'freeze':
            other.frozen = pu.duration;
            spawnParticles(other.x + other.w/2, other.y + other.h/2, '#74b9ff', 12);
            playSound('freeze');
            break;
        case 'shield':
            player.shield = pu.duration;
            break;
        case 'magnet':
            player.magnet = pu.duration;
            break;
        case 'swap': {
            // Swap positions
            const tx = player.x, ty = player.y;
            player.x = other.x; player.y = other.y;
            other.x = tx; other.y = ty;
            spawnParticles(player.x + player.w/2, player.y + player.h/2, '#00cec9', 12);
            spawnParticles(other.x + other.w/2, other.y + other.h/2, '#00cec9', 12);
            playSound('swap');
            break;
        }
        case 'teleport': {
            // Teleport to random platform (in race mode: only nearby visible platforms)
            let eligiblePlats;
            if (gameMode === 'race') {
                eligiblePlats = platforms.filter(p => !p.isGround && isInView(p.x, p.w));
            } else {
                eligiblePlats = platforms.filter(p => !p.isGround);
            }
            if (eligiblePlats.length > 0) {
                const plat = eligiblePlats[Math.floor(Math.random() * eligiblePlats.length)];
                player.x = plat.x + plat.w/2 - player.w/2;
                player.y = plat.y - player.h - 5;
                player.vy = 0;
                spawnParticles(player.x + player.w/2, player.y + player.h/2, '#6c5ce7', 15);
                playSound('portal');
            }
            break;
        }
        case 'shrink':
            other.shrunk = pu.duration;
            spawnParticles(other.x + other.w/2, other.y + other.h/2, '#fdcb6e', 8);
            playSound('shrink');
            break;
    }
}

// ===== DRAWING =====
function drawBackground() {
    const W = canvas.width;
    const H = canvas.height;
    const world = WORLDS[currentWorld];
    const t = Date.now() / 1000;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, world.skyTop);
    skyGrad.addColorStop(0.6, world.skyMid);
    skyGrad.addColorStop(1, world.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ---- FOREST: layered trees, bushes, sunbeams ----
    if (world.name === 'Forest') {
        // Distant tree layer
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#1a5c2a';
        for (let i = 0; i < 12; i++) {
            const tx = i * (W / 10) - 20 + Math.sin(i * 7) * 30;
            const ty = H * 0.15 + Math.sin(i * 3) * 20;
            const th = 80 + Math.sin(i * 5) * 25;
            ctx.beginPath();
            ctx.moveTo(tx, ty + th); ctx.lineTo(tx + 18, ty); ctx.lineTo(tx + 36, ty + th);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Mid-layer trees
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#2d7a3f';
        for (let i = 0; i < 8; i++) {
            const tx = i * (W / 7) + Math.sin(i * 11) * 20;
            const ty = H * 0.25 + Math.sin(i * 4) * 15;
            const th = 100 + Math.sin(i * 6) * 30;
            // Trunk
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(tx + 14, ty + th - 20, 8, 20);
            // Canopy layers
            ctx.fillStyle = '#2d7a3f';
            ctx.beginPath();
            ctx.moveTo(tx, ty + th - 15); ctx.lineTo(tx + 18, ty); ctx.lineTo(tx + 36, ty + th - 15);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(tx - 5, ty + th - 5); ctx.lineTo(tx + 18, ty + 15); ctx.lineTo(tx + 41, ty + th - 5);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Sunbeams
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffffaa';
        for (let i = 0; i < 4; i++) {
            const bx = W * (0.15 + i * 0.25) + Math.sin(t * 0.3 + i) * 15;
            ctx.beginPath();
            ctx.moveTo(bx - 10, 0); ctx.lineTo(bx + 10, 0);
            ctx.lineTo(bx + 40, H); ctx.lineTo(bx - 40, H);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Foreground bushes
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#388e3c';
        for (let i = 0; i < 6; i++) {
            const bx = i * (W / 5) + Math.sin(i * 9) * 25;
            const by = H - 50 + Math.sin(i * 4) * 8;
            ctx.beginPath();
            ctx.ellipse(bx, by, 25 + i * 3, 15, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Falling leaves
        for (let i = 0; i < 8; i++) {
            const lx = (i * 127 + t * 25 + Math.sin(t * 0.8 + i * 2) * 40) % W;
            const ly = (i * 89 + t * 15 + Math.cos(t * 0.5 + i) * 20) % H;
            ctx.fillStyle = ['#e8a500', '#c0392b', '#e67e22', '#d35400'][i % 4];
            ctx.globalAlpha = 0.4;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(t + i * 2);
            ctx.fillRect(-3, -1, 6, 2);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    // ---- SPACE: stars, nebula, shooting stars ----
    if (world.name === 'Space') {
        // Nebula glow
        ctx.globalAlpha = 0.08;
        const nebGrad = ctx.createRadialGradient(W * 0.3, H * 0.3, 20, W * 0.3, H * 0.3, 200);
        nebGrad.addColorStop(0, '#9b59b6');
        nebGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = nebGrad;
        ctx.fillRect(0, 0, W, H);
        const nebGrad2 = ctx.createRadialGradient(W * 0.7, H * 0.5, 20, W * 0.7, H * 0.5, 150);
        nebGrad2.addColorStop(0, '#3498db');
        nebGrad2.addColorStop(1, 'transparent');
        ctx.fillStyle = nebGrad2;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        // Stars with twinkling
        for (let i = 0; i < 100; i++) {
            const sx = (i * 137.5 + Math.sin(i * 3.7) * 200) % W;
            const sy = (i * 97.3 + Math.cos(i * 2.3) * 150) % (H * 0.75);
            ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t + i));
            ctx.fillStyle = i % 7 === 0 ? '#ffcc00' : i % 11 === 0 ? '#74b9ff' : '#fff';
            const sz = i % 5 === 0 ? 3 : 2;
            ctx.fillRect(sx, sy, sz, sz);
        }
        ctx.globalAlpha = 1;
        // Shooting star
        const shootPhase = (t * 0.3) % 4;
        if (shootPhase < 0.5) {
            const sx = W * 0.8 - shootPhase * W * 0.8;
            const sy = H * 0.1 + shootPhase * H * 0.3;
            ctx.globalAlpha = 1 - shootPhase * 2;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 30, sy - 15); ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // ---- LAVA: volcanic glow, embers, flowing lava rivers ----
    if (world.name === 'Lava') {
        // Lava rivers at bottom
        const lavaGlow = ctx.createLinearGradient(0, H - 120, 0, H);
        lavaGlow.addColorStop(0, 'rgba(255, 69, 0, 0)');
        lavaGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)');
        lavaGlow.addColorStop(1, 'rgba(255, 69, 0, 0.4)');
        ctx.fillStyle = lavaGlow;
        ctx.fillRect(0, H - 120, W, 120);
        // Volcanic rocks in background
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#3d1f0a';
        for (let i = 0; i < 5; i++) {
            const rx = i * (W / 4) + Math.sin(i * 5) * 30;
            const ry = H * 0.4 + Math.sin(i * 3) * 30;
            ctx.beginPath();
            ctx.moveTo(rx, ry + 60); ctx.lineTo(rx + 15, ry); ctx.lineTo(rx + 40, ry + 10); ctx.lineTo(rx + 50, ry + 60);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Floating embers
        for (let i = 0; i < 15; i++) {
            const ex = (i * 113 + Math.sin(t + i * 3) * 40) % W;
            const ey = H - (i * 67 + t * 40) % (H * 0.8);
            ctx.globalAlpha = 0.5 - (ey / H) * 0.4;
            ctx.fillStyle = i % 3 === 0 ? '#ff6600' : '#ff9900';
            ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- ICE / SNOW MOUNTAIN: mountain peaks, snow, pine trees ----
    if (world.name === 'Snow Mountain') {
        // Distant mountain range
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#4a6a8a';
        ctx.beginPath(); ctx.moveTo(0, H * 0.5);
        ctx.lineTo(W * 0.1, H * 0.2); ctx.lineTo(W * 0.2, H * 0.35);
        ctx.lineTo(W * 0.35, H * 0.1); ctx.lineTo(W * 0.5, H * 0.3);
        ctx.lineTo(W * 0.65, H * 0.08); ctx.lineTo(W * 0.8, H * 0.25);
        ctx.lineTo(W * 0.9, H * 0.15); ctx.lineTo(W, H * 0.4);
        ctx.lineTo(W, H * 0.5); ctx.closePath(); ctx.fill();
        // Snow caps
        ctx.fillStyle = '#e8f0ff';
        ctx.beginPath(); ctx.moveTo(W * 0.32, H * 0.13); ctx.lineTo(W * 0.35, H * 0.1); ctx.lineTo(W * 0.38, H * 0.14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W * 0.62, H * 0.11); ctx.lineTo(W * 0.65, H * 0.08); ctx.lineTo(W * 0.68, H * 0.12); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W * 0.87, H * 0.18); ctx.lineTo(W * 0.9, H * 0.15); ctx.lineTo(W * 0.93, H * 0.19); ctx.fill();
        ctx.globalAlpha = 1;
        // Mid-layer snowy hills
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#6a8caa';
        ctx.beginPath(); ctx.moveTo(0, H * 0.55);
        for (let x = 0; x <= W; x += 30) {
            ctx.lineTo(x, H * 0.45 + Math.sin(x / 120) * 25 + Math.sin(x / 50) * 12);
        }
        ctx.lineTo(W, H * 0.55); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        // Small pine trees on hills
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 10; i++) {
            const px = i * (W / 9) + Math.sin(i * 7) * 15;
            const py = H * 0.42 + Math.sin(px / 120) * 25 + Math.sin(px / 50) * 12;
            ctx.fillStyle = '#1a4a3a';
            ctx.beginPath();
            ctx.moveTo(px, py); ctx.lineTo(px + 6, py - 18); ctx.lineTo(px + 12, py);
            ctx.fill();
            ctx.fillStyle = '#3e2723'; ctx.fillRect(px + 4, py, 4, 6);
        }
        ctx.globalAlpha = 1;
        // Snowflakes - more and varied
        for (let i = 0; i < 50; i++) {
            const sx = (i * 97 + t * 18 + Math.sin(t * 0.7 + i) * 50) % W;
            const sy = (i * 73 + t * 25 + Math.cos(t * 0.5 + i) * 30) % H;
            const sz = 1 + (i % 3) * 0.8;
            ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 4) * 0.1})`;
            ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ---- CANDY: candy canes, lollipops, candy clouds ----
    if (world.name === 'Candy') {
        // Giant lollipops in background
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 4; i++) {
            const lx = W * (0.1 + i * 0.25) + Math.sin(i * 5) * 20;
            const ly = H * 0.35 + Math.sin(i * 3) * 20;
            // Stick
            ctx.fillStyle = '#f5f5f5'; ctx.fillRect(lx - 2, ly, 4, 80);
            // Swirl candy
            const colors = ['#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb'];
            ctx.beginPath(); ctx.arc(lx, ly, 20, 0, Math.PI * 2);
            ctx.fillStyle = colors[i]; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(lx, ly, 12, t + i, t + i + Math.PI); ctx.stroke();
            ctx.beginPath(); ctx.arc(lx, ly, 6, t + i + 1, t + i + 1 + Math.PI); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Candy cane pillars
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 3; i++) {
            const cx = W * (0.2 + i * 0.3);
            for (let j = 0; j < 8; j++) {
                ctx.fillStyle = j % 2 === 0 ? '#ff6b6b' : '#fff';
                ctx.fillRect(cx - 5, H * 0.5 + j * 12, 10, 12);
            }
        }
        ctx.globalAlpha = 1;
        // Floating sprinkles
        for (let i = 0; i < 12; i++) {
            const sx = (i * 107 + t * 10 + Math.sin(t + i) * 30) % W;
            const sy = (i * 83 + t * 8) % (H * 0.7);
            ctx.fillStyle = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#55efc4'][i % 5];
            ctx.globalAlpha = 0.4;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(i * 1.2 + t * 0.5);
            ctx.fillRect(-4, -1, 8, 2);
            ctx.restore(); ctx.globalAlpha = 1;
        }
    }

    // ---- OCEAN: detailed waves, fish, coral silhouettes, light rays ----
    if (world.name === 'Ocean') {
        // Light rays from above
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#90e0ef';
        for (let i = 0; i < 5; i++) {
            const rx = W * (0.1 + i * 0.2) + Math.sin(t * 0.3 + i) * 20;
            ctx.beginPath();
            ctx.moveTo(rx - 15, 0); ctx.lineTo(rx + 15, 0);
            ctx.lineTo(rx + 50, H); ctx.lineTo(rx - 50, H);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Wave lines
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 8; i++) {
            const wy = H * 0.3 + i * 50 + Math.sin(t + i * 0.5) * 20;
            ctx.strokeStyle = '#48cae4'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x < W; x += 10) {
                const y = wy + Math.sin(x * 0.02 + t * 2 + i) * 10;
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Coral silhouettes at bottom
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#e056a0';
        for (let i = 0; i < 6; i++) {
            const cx = i * (W / 5) + Math.sin(i * 7) * 20;
            const cy = H - 50;
            ctx.beginPath();
            ctx.moveTo(cx, cy + 15);
            ctx.lineTo(cx + 5, cy - 10); ctx.lineTo(cx + 10, cy);
            ctx.lineTo(cx + 15, cy - 15); ctx.lineTo(cx + 20, cy - 5);
            ctx.lineTo(cx + 25, cy - 20); ctx.lineTo(cx + 30, cy);
            ctx.lineTo(cx + 30, cy + 15);
            ctx.fill();
        }
        ctx.fillStyle = '#2ecc71';
        for (let i = 0; i < 4; i++) {
            const sx = W * 0.15 + i * (W / 4);
            for (let j = 0; j < 3; j++) {
                const leafX = sx + Math.sin(t + j) * 5;
                ctx.beginPath();
                ctx.ellipse(leafX, H - 40 - j * 12, 3, 10, Math.sin(t + j) * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        // Fish
        for (let i = 0; i < 6; i++) {
            const fx = (i * 180 + t * (30 + i * 8)) % (W + 40) - 20;
            const fy = H * 0.35 + i * 55 + Math.sin(t + i * 2) * 15;
            ctx.fillStyle = ['#f39c12', '#e74c3c', '#2ecc71', '#3498db', '#e67e22', '#9b59b6'][i];
            ctx.globalAlpha = 0.35;
            ctx.beginPath(); ctx.ellipse(fx, fy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(fx - 8, fy); ctx.lineTo(fx - 14, fy - 5); ctx.lineTo(fx - 14, fy + 5); ctx.fill();
            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(fx + 3, fy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
        // Bubbles
        for (let i = 0; i < 10; i++) {
            const bx = (i * 97 + Math.sin(t * 0.5 + i * 3) * 20) % W;
            const by = H - ((i * 67 + t * 20) % (H * 0.7));
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#90e0ef'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 3), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // ---- CASTLE: stone walls, torches, banners, windows ----
    if (world.name === 'Castle') {
        // Stone wall pattern in background
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#2d2d2d';
        ctx.lineWidth = 1;
        for (let row = 0; row < 20; row++) {
            const y = row * 30;
            const offset = row % 2 === 0 ? 0 : 25;
            for (let col = 0; col < 12; col++) {
                ctx.strokeRect(col * 50 + offset, y, 50, 30);
            }
        }
        ctx.globalAlpha = 1;
        // Castle towers in background
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#4a4a5a';
        // Left tower
        ctx.fillRect(W * 0.05, H * 0.15, 40, H * 0.5);
        ctx.fillStyle = '#5a5a6a';
        ctx.beginPath();
        ctx.moveTo(W * 0.05 - 8, H * 0.15); ctx.lineTo(W * 0.05 + 20, H * 0.05); ctx.lineTo(W * 0.05 + 48, H * 0.15);
        ctx.fill();
        // Right tower
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(W * 0.85, H * 0.2, 40, H * 0.5);
        ctx.fillStyle = '#5a5a6a';
        ctx.beginPath();
        ctx.moveTo(W * 0.85 - 8, H * 0.2); ctx.lineTo(W * 0.85 + 20, H * 0.1); ctx.lineTo(W * 0.85 + 48, H * 0.2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Window glow
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 3; i++) {
            const wx = W * 0.05 + 12;
            const wy = H * 0.2 + i * 50;
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(wx, wy, 16, 20);
            ctx.fillStyle = '#feca57';
            ctx.fillRect(wx + 2, wy + 2, 12, 16);
        }
        ctx.globalAlpha = 1;
        // Banners
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 3; i++) {
            const bx = W * (0.3 + i * 0.2);
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.moveTo(bx - 8, H * 0.25); ctx.lineTo(bx + 8, H * 0.25);
            ctx.lineTo(bx + 8, H * 0.25 + 30); ctx.lineTo(bx, H * 0.25 + 40);
            ctx.lineTo(bx - 8, H * 0.25 + 30);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Torches with glow
        for (let i = 0; i < 4; i++) {
            const tx = W * (0.15 + i * 0.25);
            const ty = H * 0.3;
            ctx.fillStyle = '#5d4e37'; ctx.fillRect(tx - 3, ty, 6, 20);
            const flicker = Math.sin(t * 8 + i * 2) * 3;
            const glow = ctx.createRadialGradient(tx, ty - 5 + flicker, 2, tx, ty - 5 + flicker, 20);
            glow.addColorStop(0, 'rgba(255, 165, 0, 0.7)');
            glow.addColorStop(0.5, 'rgba(255, 69, 0, 0.2)');
            glow.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(tx, ty - 5 + flicker, 20, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f39c12';
            ctx.beginPath(); ctx.ellipse(tx, ty - 5 + flicker, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ---- SKY: layered clouds, birds, rainbow hint ----
    if (world.name === 'Sky') {
        // Rainbow arc
        ctx.globalAlpha = 0.08;
        const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
        for (let i = 0; i < colors.length; i++) {
            ctx.strokeStyle = colors[i]; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(W * 0.5, H * 0.8, 200 + i * 6, Math.PI, 0); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Distant clouds layer
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        const ct = Date.now() / 60000;
        for (let i = 0; i < 6; i++) {
            const cx = ((i * W / 5 + ct * W) % (W + 400)) - 200;
            const cy = 20 + i * 30 + Math.sin(i * 2) * 15;
            drawCloud(cx, cy, 60 + i * 10);
        }
        // Closer clouds
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 8; i++) {
            const cx = ((i * W / 6 + ct * W * 1.5) % (W + 300)) - 150;
            const cy = 40 + i * 45 + Math.sin(i) * 20;
            drawCloud(cx, cy, 50 + i * 8);
        }
        // Birds
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            const bx = (i * 150 + t * 20) % W;
            const by = 60 + i * 40 + Math.sin(t * 2 + i) * 10;
            const wing = Math.sin(t * 4 + i * 2) * 5;
            ctx.beginPath();
            ctx.moveTo(bx - 8, by + wing); ctx.lineTo(bx, by); ctx.lineTo(bx + 8, by + wing);
            ctx.stroke();
        }
    }

    // ---- DESERT: sand dunes, cacti silhouettes, heat shimmer, sun ----
    if (world.name === 'Desert') {
        // Big sun
        ctx.globalAlpha = 0.15;
        const sunGrad = ctx.createRadialGradient(W * 0.75, H * 0.12, 15, W * 0.75, H * 0.12, 60);
        sunGrad.addColorStop(0, '#ffeaa7');
        sunGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f9ca24';
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(W * 0.75, H * 0.12, 25, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Distant dunes
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#d4a854';
        ctx.beginPath(); ctx.moveTo(0, H * 0.5);
        for (let x = 0; x <= W; x += 5) {
            ctx.lineTo(x, H * 0.4 + Math.sin(x / 150) * 30 + Math.sin(x / 70) * 15);
        }
        ctx.lineTo(W, H * 0.6); ctx.lineTo(0, H * 0.6); ctx.fill();
        ctx.globalAlpha = 1;
        // Mid dunes
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#c49b47';
        ctx.beginPath(); ctx.moveTo(0, H * 0.55);
        for (let x = 0; x <= W; x += 5) {
            ctx.lineTo(x, H * 0.48 + Math.sin(x / 100 + 1) * 20 + Math.sin(x / 50 + 2) * 10);
        }
        ctx.lineTo(W, H * 0.65); ctx.lineTo(0, H * 0.65); ctx.fill();
        ctx.globalAlpha = 1;
        // Cacti silhouettes
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#5d4037';
        for (let i = 0; i < 4; i++) {
            const cx = W * (0.1 + i * 0.25) + Math.sin(i * 7) * 25;
            const cy = H * 0.42;
            ctx.fillRect(cx - 2, cy, 4, 25);
            ctx.fillRect(cx - 10, cy + 8, 8, 3);
            ctx.fillRect(cx - 10, cy + 8, 3, 10);
            ctx.fillRect(cx + 2, cy + 14, 8, 3);
            ctx.fillRect(cx + 7, cy + 6, 3, 11);
        }
        ctx.globalAlpha = 1;
        // Heat shimmer effect
        ctx.globalAlpha = 0.03;
        ctx.fillStyle = '#fff';
        for (let x = 0; x < W; x += 4) {
            const shimmer = Math.sin(x * 0.05 + t * 3) * 3;
            ctx.fillRect(x, H * 0.7 + shimmer, 2, 2);
        }
        ctx.globalAlpha = 1;
    }

    // ---- CAVE: stalactites, crystals, glow spots, bats ----
    if (world.name === 'Cave') {
        // Cave ceiling stalactites
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#3a3a4a';
        for (let i = 0; i < 15; i++) {
            const sx = i * (W / 13) + Math.sin(i * 5) * 15;
            const sh = 20 + Math.sin(i * 7) * 15;
            ctx.beginPath();
            ctx.moveTo(sx - 6, 0); ctx.lineTo(sx + 6, 0);
            ctx.lineTo(sx, sh);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Crystal glow spots
        for (let i = 0; i < 5; i++) {
            const gx = W * (0.1 + i * 0.2);
            const gy = H * (0.3 + Math.sin(i * 4) * 0.15);
            const pulse = 0.5 + Math.sin(t * 2 + i * 1.5) * 0.2;
            ctx.globalAlpha = 0.08 * pulse;
            const cGlow = ctx.createRadialGradient(gx, gy, 3, gx, gy, 40);
            cGlow.addColorStop(0, '#64c8ff');
            cGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = cGlow;
            ctx.beginPath(); ctx.arc(gx, gy, 40, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Small crystal formations on walls
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 6; i++) {
            const cx = i * (W / 5) + Math.sin(i * 8) * 15;
            const cy = H * 0.6 + Math.sin(i * 3) * 20;
            ctx.fillStyle = `rgba(100,200,255,${0.5 + Math.sin(t * 2 + i) * 0.2})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy); ctx.lineTo(cx + 4, cy - 12); ctx.lineTo(cx + 8, cy);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 6, cy - 8); ctx.lineTo(cx + 10, cy);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Bats
        for (let i = 0; i < 3; i++) {
            const bx = (i * 200 + t * 35 + Math.sin(t + i * 3) * 40) % (W + 30) - 15;
            const by = H * 0.15 + Math.sin(t * 3 + i * 2) * 20;
            ctx.fillStyle = 'rgba(30,30,40,0.3)';
            const wing = Math.sin(t * 6 + i * 2) * 6;
            ctx.beginPath();
            ctx.moveTo(bx - 8, by + wing); ctx.lineTo(bx - 3, by + wing * 0.5); ctx.lineTo(bx, by);
            ctx.lineTo(bx + 3, by + wing * 0.5); ctx.lineTo(bx + 8, by + wing);
            ctx.fill();
        }
    }

    // ---- FARM: barn, windmill, fences, crops ----
    if (world.name === 'Farm') {
        // Sun
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#f9ca24';
        ctx.beginPath(); ctx.arc(W * 0.8, H * 0.1, 30, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4 + t * 0.2;
            ctx.strokeStyle = 'rgba(249,202,36,0.15)'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(W * 0.8 + Math.cos(angle) * 35, H * 0.1 + Math.sin(angle) * 35);
            ctx.lineTo(W * 0.8 + Math.cos(angle) * 50, H * 0.1 + Math.sin(angle) * 50);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Barn silhouette
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#8b2500';
        ctx.fillRect(W * 0.08, H * 0.3, 60, 50);
        ctx.fillStyle = '#a03020';
        ctx.beginPath();
        ctx.moveTo(W * 0.08 - 5, H * 0.3); ctx.lineTo(W * 0.08 + 30, H * 0.18); ctx.lineTo(W * 0.08 + 65, H * 0.3);
        ctx.fill();
        // Barn door
        ctx.fillStyle = '#5d2000'; ctx.fillRect(W * 0.08 + 20, H * 0.3 + 25, 20, 25);
        ctx.globalAlpha = 1;
        // Windmill
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(W * 0.82, H * 0.25, 12, 60);
        // Blades
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3;
        const windAngle = t * 1.5;
        for (let i = 0; i < 4; i++) {
            const angle = windAngle + i * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(W * 0.82 + 6, H * 0.25);
            ctx.lineTo(W * 0.82 + 6 + Math.cos(angle) * 30, H * 0.25 + Math.sin(angle) * 30);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Fence
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#8d6e63';
        for (let i = 0; i < 10; i++) {
            const fx = W * 0.3 + i * 25;
            ctx.fillRect(fx, H * 0.6, 3, 20);
        }
        ctx.fillRect(W * 0.3, H * 0.62, 225, 2);
        ctx.fillRect(W * 0.3, H * 0.68, 225, 2);
        ctx.globalAlpha = 1;
        // Crop rows
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#8bc34a';
        for (let i = 0; i < 8; i++) {
            const cx = W * 0.35 + i * 28;
            for (let j = 0; j < 3; j++) {
                ctx.beginPath();
                ctx.ellipse(cx + Math.sin(t + j) * 1, H * 0.72 + j * 8, 4, 6, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    // ---- JUNGLE: dense canopy, vines, parrots, flowers ----
    if (world.name === 'Jungle') {
        // Canopy layers
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#0d5016';
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let x = 0; x <= W; x += 15) {
            ctx.lineTo(x, 30 + Math.sin(x / 40) * 20 + Math.sin(x / 100) * 15);
        }
        ctx.lineTo(W, 0); ctx.fill();
        ctx.fillStyle = '#1a7a2a';
        ctx.globalAlpha = 0.1;
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let x = 0; x <= W; x += 15) {
            ctx.lineTo(x, 45 + Math.sin(x / 35 + 1) * 18 + Math.sin(x / 80) * 12);
        }
        ctx.lineTo(W, 0); ctx.fill();
        ctx.globalAlpha = 1;
        // Hanging vines from top
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const vx = i * (W / 7) + Math.sin(i * 5) * 20;
            ctx.beginPath(); ctx.moveTo(vx, 0);
            for (let j = 0; j < 6; j++) {
                ctx.lineTo(vx + Math.sin(t * 0.8 + j + i) * 10, j * 20);
            }
            ctx.stroke();
            // Leaves on vines
            ctx.fillStyle = '#4caf50';
            ctx.beginPath();
            ctx.ellipse(vx + Math.sin(t * 0.8 + 5 + i) * 10, 95, 5, 3, Math.sin(t + i) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Tropical tree trunks
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 4; i++) {
            const tx = W * (0.05 + i * 0.28);
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(tx, H * 0.3, 10, H * 0.5);
            // Palm fronds
            ctx.fillStyle = '#1b5e20';
            for (let j = 0; j < 5; j++) {
                const angle = -Math.PI / 2 + (j - 2) * 0.4 + Math.sin(t * 0.5 + i) * 0.1;
                ctx.beginPath();
                ctx.ellipse(tx + 5, H * 0.3, 5, 35, angle, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        // Parrots
        for (let i = 0; i < 2; i++) {
            const px = (i * 300 + t * 25 + Math.sin(t + i * 5) * 50) % (W + 30) - 15;
            const py = H * 0.2 + Math.sin(t * 2 + i * 3) * 25;
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = i === 0 ? '#e74c3c' : '#2ecc71';
            ctx.beginPath(); ctx.ellipse(px, py, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
            const wing = Math.sin(t * 5 + i * 2) * 4;
            ctx.beginPath();
            ctx.moveTo(px - 5, py); ctx.lineTo(px - 10, py + wing); ctx.lineTo(px - 3, py);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        // Flowers at bottom
        ctx.globalAlpha = 0.25;
        const flowerColors = ['#e74c3c', '#f39c12', '#e91e63', '#ff6f00'];
        for (let i = 0; i < 6; i++) {
            const fx = i * (W / 5) + Math.sin(i * 9) * 15;
            const fy = H - 45 + Math.sin(i * 3) * 5;
            ctx.fillStyle = flowerColors[i % 4];
            for (let p = 0; p < 5; p++) {
                const pa = p * Math.PI * 2 / 5;
                ctx.beginPath();
                ctx.arc(fx + Math.cos(pa) * 4, fy + Math.sin(pa) * 4, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- VOLCANO: eruption, ash, lava flows, rocky landscape ----
    if (world.name === 'Volcano') {
        // Volcano in background
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#3e2723';
        ctx.beginPath();
        ctx.moveTo(W * 0.25, H * 0.6); ctx.lineTo(W * 0.4, H * 0.1);
        ctx.lineTo(W * 0.45, H * 0.08); ctx.lineTo(W * 0.5, H * 0.12);
        ctx.lineTo(W * 0.65, H * 0.6);
        ctx.fill();
        // Crater glow
        ctx.fillStyle = '#ff4500';
        ctx.globalAlpha = 0.15 + Math.sin(t * 2) * 0.05;
        ctx.beginPath();
        ctx.ellipse(W * 0.45, H * 0.08, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Lava glow at base
        const lavaG = ctx.createLinearGradient(0, H - 100, 0, H);
        lavaG.addColorStop(0, 'rgba(255,69,0,0)');
        lavaG.addColorStop(1, 'rgba(255,69,0,0.35)');
        ctx.fillStyle = lavaG;
        ctx.fillRect(0, H - 100, W, 100);
        // Lava streams
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(W * 0.43, H * 0.12);
        ctx.bezierCurveTo(W * 0.42, H * 0.3, W * 0.35, H * 0.45, W * 0.3, H * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(W * 0.47, H * 0.12);
        ctx.bezierCurveTo(W * 0.5, H * 0.3, W * 0.55, H * 0.45, W * 0.58, H * 0.6);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Ash and embers
        for (let i = 0; i < 20; i++) {
            const ax = (i * 107 + Math.sin(t + i * 2) * 40) % W;
            const ay = H - ((i * 53 + t * 35) % (H * 0.8));
            ctx.globalAlpha = 0.3 - (ay / H) * 0.2;
            ctx.fillStyle = i % 3 === 0 ? '#ff6600' : i % 3 === 1 ? '#ff9900' : '#888';
            ctx.beginPath(); ctx.arc(ax, ay, i % 3 === 2 ? 1 : 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Rocky silhouettes
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#2a1a0a';
        for (let i = 0; i < 5; i++) {
            const rx = i * (W / 4) + Math.sin(i * 7) * 20;
            const rh = 15 + Math.sin(i * 5) * 8;
            ctx.beginPath();
            ctx.moveTo(rx, H * 0.6); ctx.lineTo(rx + 10, H * 0.6 - rh);
            ctx.lineTo(rx + 20, H * 0.6 - rh + 5); ctx.lineTo(rx + 30, H * 0.6);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- UNDERWATER: deep ocean, jellyfish, seaweed, light beams ----
    if (world.name === 'Underwater') {
        // Light beams from surface
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#48cae4';
        for (let i = 0; i < 6; i++) {
            const rx = W * (0.05 + i * 0.18) + Math.sin(t * 0.2 + i) * 15;
            ctx.beginPath();
            ctx.moveTo(rx - 8, 0); ctx.lineTo(rx + 8, 0);
            ctx.lineTo(rx + 35, H); ctx.lineTo(rx - 35, H);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Water surface ripples at top
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#90e0ef'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x < W; x += 8) {
                const y = 15 + i * 8 + Math.sin(x * 0.03 + t * 2 + i) * 5;
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Jellyfish
        for (let i = 0; i < 3; i++) {
            const jx = W * (0.2 + i * 0.3) + Math.sin(t * 0.5 + i * 2) * 30;
            const jy = H * 0.25 + i * 60 + Math.sin(t * 0.7 + i) * 20;
            ctx.globalAlpha = 0.2;
            // Bell
            ctx.fillStyle = ['#e056a0', '#a29bfe', '#48dbfb'][i];
            ctx.beginPath(); ctx.arc(jx, jy, 12, Math.PI, 0); ctx.fill();
            // Tentacles
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
            for (let j = 0; j < 4; j++) {
                ctx.beginPath();
                ctx.moveTo(jx - 6 + j * 4, jy);
                ctx.bezierCurveTo(jx - 6 + j * 4 + Math.sin(t * 2 + j) * 5, jy + 10,
                    jx - 6 + j * 4 - Math.sin(t * 2.5 + j) * 5, jy + 20,
                    jx - 6 + j * 4, jy + 25);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        // Seaweed from bottom
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#2e7d32';
        for (let i = 0; i < 8; i++) {
            const sx = i * (W / 7) + Math.sin(i * 6) * 15;
            ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(sx, H - 35);
            for (let j = 0; j < 5; j++) {
                ctx.lineTo(sx + Math.sin(t + j + i) * 8, H - 35 - j * 15);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Bubbles rising
        for (let i = 0; i < 12; i++) {
            const bx = (i * 97 + Math.sin(t * 0.4 + i * 3) * 15) % W;
            const by = H - ((i * 57 + t * 18) % (H * 0.85));
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = '#90e0ef'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
        // Small fish
        for (let i = 0; i < 4; i++) {
            const fx = (i * 210 + t * (25 + i * 10)) % (W + 30) - 15;
            const fy = H * 0.4 + i * 50 + Math.sin(t + i * 3) * 12;
            ctx.fillStyle = ['#f39c12', '#e74c3c', '#2ecc71', '#9b59b6'][i];
            ctx.globalAlpha = 0.25;
            ctx.beginPath(); ctx.ellipse(fx, fy, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.lineTo(fx - 10, fy - 4); ctx.lineTo(fx - 10, fy + 4); ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ---- GRAVEYARD: tombstones, fog, dead trees, ghost wisps, moon ----
    if (world.name === 'Graveyard') {
        // Moon
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#f5f5dc';
        ctx.beginPath(); ctx.arc(W * 0.8, H * 0.1, 25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = WORLDS[currentWorld].skyTop;
        ctx.beginPath(); ctx.arc(W * 0.8 + 8, H * 0.1 - 3, 22, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Moon glow
        ctx.globalAlpha = 0.05;
        const moonGlow = ctx.createRadialGradient(W * 0.8, H * 0.1, 20, W * 0.8, H * 0.1, 100);
        moonGlow.addColorStop(0, '#f5f5dc');
        moonGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = moonGlow;
        ctx.beginPath(); ctx.arc(W * 0.8, H * 0.1, 100, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Dead trees
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#2d2d2d'; ctx.fillStyle = '#2d2d2d';
        for (let i = 0; i < 4; i++) {
            const tx = W * (0.05 + i * 0.28);
            const ty = H * 0.35;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(tx, H * 0.65); ctx.lineTo(tx, ty); ctx.stroke();
            // Branches
            ctx.lineWidth = 2;
            for (let j = 0; j < 3; j++) {
                const by = ty + j * 25;
                const dir = j % 2 === 0 ? 1 : -1;
                ctx.beginPath(); ctx.moveTo(tx, by);
                ctx.lineTo(tx + dir * 20, by - 15);
                ctx.lineTo(tx + dir * 30, by - 20);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        // Tombstones
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 6; i++) {
            const sx = i * (W / 5) + Math.sin(i * 7) * 20;
            const sy = H * 0.6 + Math.sin(i * 4) * 10;
            ctx.fillStyle = '#555';
            ctx.fillRect(sx - 6, sy, 12, 18);
            ctx.beginPath(); ctx.arc(sx, sy, 6, Math.PI, 0); ctx.fill();
            // Cross
            ctx.fillStyle = '#777';
            ctx.fillRect(sx - 1, sy + 3, 2, 8);
            ctx.fillRect(sx - 3, sy + 5, 6, 2);
        }
        ctx.globalAlpha = 1;
        // Ground fog
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#b0b0b0';
        for (let i = 0; i < 6; i++) {
            const fx = (i * 120 + t * 12 + Math.sin(t + i * 2) * 30) % (W + 100) - 50;
            const fy = H - 55 + Math.sin(i * 3) * 8;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 50 + i * 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Ghost wisps
        for (let i = 0; i < 3; i++) {
            const gx = W * (0.2 + i * 0.3) + Math.sin(t * 0.6 + i * 3) * 30;
            const gy = H * 0.4 + Math.sin(t * 0.8 + i * 2) * 25;
            ctx.globalAlpha = 0.06 + Math.sin(t + i * 2) * 0.03;
            ctx.fillStyle = '#ddd';
            ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(gx - 6, gy + 5); ctx.bezierCurveTo(gx - 8, gy + 15, gx - 2, gy + 20, gx, gy + 18);
            ctx.bezierCurveTo(gx + 2, gy + 20, gx + 8, gy + 15, gx + 6, gy + 5);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ---- NEON: glowing signs, grid lines, neon reflections ----
    if (world.name === 'Neon') {
        // Grid floor
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const x = i * (W / 18);
            ctx.beginPath(); ctx.moveTo(x, H * 0.5); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
            const y = H * 0.5 + i * 30;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Neon signs / buildings
        ctx.globalAlpha = 0.12;
        const neonColors = ['#ff00ff', '#00ffff', '#ff0066', '#00ff88', '#ffff00'];
        for (let i = 0; i < 5; i++) {
            const bx = i * (W / 4) + 10;
            const bh = 60 + Math.sin(i * 4) * 30;
            const by = H * 0.5 - bh;
            // Building
            ctx.fillStyle = '#111';
            ctx.fillRect(bx, by, 35, bh + 10);
            // Neon outline
            ctx.strokeStyle = neonColors[i]; ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, 35, bh + 10);
            // Windows
            ctx.fillStyle = neonColors[i];
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 2; k++) {
                    ctx.fillRect(bx + 5 + k * 18, by + 8 + j * 18, 8, 8);
                }
            }
        }
        ctx.globalAlpha = 1;
        // Neon glow circles
        for (let i = 0; i < 4; i++) {
            const gx = W * (0.15 + i * 0.25);
            const gy = H * 0.3;
            const pulse = 0.5 + Math.sin(t * 3 + i * 1.5) * 0.3;
            ctx.globalAlpha = 0.04 * pulse;
            const nGlow = ctx.createRadialGradient(gx, gy, 5, gx, gy, 50);
            nGlow.addColorStop(0, neonColors[i]);
            nGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = nGlow;
            ctx.beginPath(); ctx.arc(gx, gy, 50, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Floating neon particles
        for (let i = 0; i < 15; i++) {
            const px = (i * 89 + t * 15 + Math.sin(t * 0.5 + i * 2) * 25) % W;
            const py = (i * 67 + t * 10) % H;
            ctx.fillStyle = neonColors[i % 5];
            ctx.globalAlpha = 0.2 + Math.sin(t * 4 + i) * 0.1;
            ctx.fillRect(px, py, 2, 2);
        }
        ctx.globalAlpha = 1;
    }

    // Clouds (not for space, ocean, underwater, cave, neon)
    const noClouds = ['Space', 'Ocean', 'Underwater', 'Cave', 'Neon', 'Graveyard'];
    if (!noClouds.includes(world.name)) {
        ctx.fillStyle = world.name === 'Lava' || world.name === 'Volcano' ? 'rgba(100,50,30,0.4)' : 'rgba(255,255,255,0.6)';
        const cloudTime = Date.now() / 30000;
        for (let i = 0; i < 5; i++) {
            const cx = ((i * W / 4 + cloudTime * W) % (W + 200)) - 100;
            const cy = 50 + i * 40;
            drawCloud(cx, cy, 40 + i * 10);
        }
    }

    // Background hills
    ctx.fillStyle = world.hillColor;
    ctx.beginPath();
    ctx.moveTo(0, H - 35);
    for (let x = 0; x <= W; x += 20) {
        ctx.lineTo(x, H - 35 - Math.sin(x / 200) * 30 - Math.sin(x / 80) * 15);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.fill();
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlatforms() {
    for (const p of platforms) {
        if (!isInView(p.x, p.w)) continue;
        const isGround = p.isGround || (p.w >= canvas.width * 0.9);
        if (isGround) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = p.topColor;
            ctx.fillRect(p.x, p.y, p.w, 5);
        } else {
            ctx.globalAlpha = 0.65;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = p.topColor;
            ctx.fillRect(p.x, p.y, p.w, 5);
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = p.topColor; ctx.lineWidth = 1;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(p.x, p.y + p.h, p.w, 3);
    }
}

function drawWalls() {
    for (const w of walls) {
        if (!isInView(w.x, w.w)) continue;
        const world = WORLDS[currentWorld];
        ctx.fillStyle = world.platColor;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = world.platTop;
        ctx.fillRect(w.x, w.y, w.w, 4);
        // Brick pattern
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        for (let by = w.y; by < w.y + w.h; by += 8) {
            const offset = (Math.floor((by - w.y) / 8) % 2) * 5;
            ctx.beginPath(); ctx.moveTo(w.x, by); ctx.lineTo(w.x + w.w, by); ctx.stroke();
            for (let bx = w.x + offset; bx < w.x + w.w; bx += 10) {
                ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 8); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }
}

function drawPortals() {
    const t = Date.now() / 1000;
    for (const p of portals) {
        if (!isInView(p.x - 30, 60)) continue;
        const r = 20;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
        ctx.fillStyle = p.color1 + '30'; ctx.fill();

        for (let i = 0; i < 6; i++) {
            const angle = t * 3 + i * (Math.PI / 3);
            const sr = r * (0.5 + 0.5 * Math.sin(t * 2 + i));
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(angle) * sr * 0.4, p.y + Math.sin(angle) * sr * 0.4, 4, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? p.color1 : p.color2;
            ctx.globalAlpha = 0.6; ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = p.color1; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = p.color2; ctx.lineWidth = 2; ctx.stroke();

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 0.5);
        glow.addColorStop(0, p.color1 + '80');
        glow.addColorStop(1, p.color1 + '00');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }
}

function drawSpecialObjects() {
    const t = Date.now() / 1000;
    for (const s of specialObjects) {
        if (!isInView(s.x, s.w || 60)) continue;
        if (s.squashAnim > 0) s.squashAnim -= 0.016;

        if (s.type === 'mushroom') {
            const squash = s.squashAnim > 0 ? 0.6 : 1;
            const cx = s.x + s.w / 2;
            ctx.save(); ctx.translate(cx, s.y + s.h); ctx.scale(1 + (1-squash)*0.3, squash);
            ctx.fillStyle = '#f5e6ca'; ctx.fillRect(-4, -s.h*0.6, 8, s.h*0.6);
            ctx.fillStyle = '#e74c3c'; ctx.beginPath();
            ctx.ellipse(0, -s.h*0.6, s.w/2, s.h*0.6, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-5, -s.h*0.8, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, -s.h*0.7, 2.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        if (s.type === 'trampoline') {
            const squash = s.squashAnim > 0 ? 0.5 : 1;
            const cx = s.x + s.w / 2;
            ctx.fillStyle = '#636e72';
            ctx.fillRect(s.x + 4, s.y + s.h*0.5, s.w - 8, s.h*0.5);
            ctx.save(); ctx.translate(cx, s.y + s.h*0.5); ctx.scale(1, squash);
            const colors = ['#fd79a8', '#e84393', '#fd79a8'];
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = colors[i];
                ctx.fillRect(-s.w/2 + i*(s.w/3), -s.h*0.5, s.w/3, s.h*0.5);
            }
            ctx.restore();
        }

        if (s.type === 'lava') {
            ctx.fillStyle = '#ff4500'; ctx.fillRect(s.x, s.y, s.w, s.h);
            for (let i = 0; i < 4; i++) {
                const bx = s.x + (i+0.5) * (s.w/4);
                const by = s.y - Math.abs(Math.sin(t*3 + i*1.5)) * 8;
                ctx.fillStyle = '#ff6347'; ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.arc(bx, by, 3 + Math.sin(t*2+i)*1.5, 0, Math.PI*2); ctx.fill();
            }
            const lg = ctx.createLinearGradient(s.x, s.y-25, s.x, s.y);
            lg.addColorStop(0, 'rgba(255,69,0,0)'); lg.addColorStop(1, 'rgba(255,69,0,0.25)');
            ctx.fillStyle = lg; ctx.fillRect(s.x, s.y-25, s.w, 25);
            ctx.globalAlpha = 1;
        }

        if (s.type === 'spikes') {
            ctx.fillStyle = '#808b96';
            const spikeW = 8;
            for (let sx = s.x; sx < s.x + s.w; sx += spikeW) {
                ctx.beginPath();
                ctx.moveTo(sx, s.y + s.h); ctx.lineTo(sx + spikeW/2, s.y); ctx.lineTo(sx + spikeW, s.y + s.h);
                ctx.fill();
            }
        }

        if (s.type === 'lowgrav') {
            ctx.strokeStyle = `rgba(162,155,254,${0.3 + Math.sin(t*2)*0.1})`;
            ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
            ctx.strokeRect(s.x, s.y, s.w, s.h); ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(162,155,254,0.4)';
            for (let i = 0; i < 6; i++) {
                const fx = s.x + ((i*73 + t*15) % s.w);
                const fy = s.y + ((i*47 + t*-20) % s.h);
                if (fy > s.y && fy < s.y + s.h) {
                    ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI*2); ctx.fill();
                }
            }
            ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(162,155,254,${0.5 + Math.sin(t*2)*0.2})`;
            ctx.fillText('LOW GRAV', s.x + s.w/2, s.y + 12);
        }

        if (s.type === 'current') {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#48cae4';
            ctx.fillRect(s.x, s.y, s.w, s.h);
            // Arrow indicators
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#90e0ef';
            for (let i = 0; i < 5; i++) {
                const ax = s.x + ((i * s.w/4 + t * 60 * s.dir) % s.w + s.w) % s.w;
                const ay = s.y + s.h/2;
                ctx.beginPath();
                ctx.moveTo(ax, ay - 8); ctx.lineTo(ax + s.dir*12, ay); ctx.lineTo(ax, ay + 8);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (s.type === 'wind') {
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#dfe6e9';
            ctx.fillRect(s.x, s.y, s.w, s.h);
            // Upward arrows
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#74b9ff';
            for (let i = 0; i < 4; i++) {
                const ax = s.x + s.w * (0.2 + i * 0.2);
                const ay = s.y + ((i * 40 - t * 80) % s.h + s.h) % s.h;
                ctx.beginPath();
                ctx.moveTo(ax - 6, ay + 6); ctx.lineTo(ax, ay - 6); ctx.lineTo(ax + 6, ay + 6);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(116,185,255,0.5)';
            ctx.fillText('WIND', s.x + s.w/2, s.y + 12);
        }

        if (s.type === 'bubble') {
            const squash = s.squashAnim > 0 ? 0.6 : 1;
            const cx = s.x + s.w/2;
            const cy = s.y + s.h/2 + Math.sin(t * 2) * 3;
            ctx.save(); ctx.translate(cx, cy); ctx.scale(1, squash);
            ctx.beginPath(); ctx.arc(0, 0, s.w/2, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(116,185,255,0.3)'; ctx.fill();
            ctx.strokeStyle = 'rgba(116,185,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        if (s.type === 'cloud') {
            const squash = s.squashAnim > 0 ? 0.7 : 1;
            const cx = s.x + s.w/2;
            ctx.save(); ctx.translate(cx, s.y + s.h/2); ctx.scale(1, squash);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.ellipse(0, 0, s.w/2, s.h/2, 0, 0, Math.PI*2); ctx.fill();
            ctx.ellipse(-s.w*0.3, 2, s.w*0.3, s.h*0.4, 0, 0, Math.PI*2); ctx.fill();
            ctx.ellipse(s.w*0.3, 2, s.w*0.3, s.h*0.4, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        // === NEW WORLD SPECIALS ===
        if (s.type === 'quicksand') {
            const wobble = Math.sin(t * 2) * 2;
            ctx.fillStyle = '#c19a3e'; ctx.fillRect(s.x, s.y, s.w, s.h);
            ctx.fillStyle = '#a0842e';
            for (let i = 0; i < 5; i++) {
                const bx = s.x + ((i * s.w/4 + t * 20) % s.w);
                ctx.beginPath(); ctx.arc(bx, s.y + 3 + wobble, 4, 0, Math.PI*2); ctx.fill();
            }
            ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(139,69,19,0.6)';
            ctx.fillText('QUICKSAND', s.x + s.w/2, s.y - 4);
        }

        if (s.type === 'cactus') {
            const squash = s.squashAnim > 0 ? 0.7 : 1;
            const cx = s.x + s.w/2;
            ctx.save(); ctx.translate(cx, s.y + s.h); ctx.scale(1, squash);
            // Trunk
            ctx.fillStyle = '#2e7d32'; ctx.fillRect(-4, -s.h, 8, s.h);
            // Arms
            ctx.fillRect(-12, -s.h*0.7, 8, 4); ctx.fillRect(-12, -s.h*0.7, 4, 12);
            ctx.fillRect(4, -s.h*0.5, 8, 4); ctx.fillRect(8, -s.h*0.5, 4, 10);
            // Spines
            ctx.strokeStyle = '#a5d6a7'; ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const sy = -s.h + i * (s.h/4) + 4;
                ctx.beginPath(); ctx.moveTo(-4, sy); ctx.lineTo(-7, sy-3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(4, sy); ctx.lineTo(7, sy-3); ctx.stroke();
            }
            ctx.restore();
        }

        if (s.type === 'stalactite') {
            ctx.fillStyle = '#5a5a6a';
            ctx.beginPath();
            ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y);
            ctx.lineTo(s.x + s.w/2, s.y + s.h);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(150,150,180,0.5)';
            ctx.beginPath();
            ctx.moveTo(s.x + 2, s.y); ctx.lineTo(s.x + s.w/2 - 2, s.y);
            ctx.lineTo(s.x + s.w/2 - 1, s.y + s.h*0.6);
            ctx.closePath(); ctx.fill();
            // Drip
            const drip = (t * 2 + s.x) % 3;
            if (drip < 1) {
                ctx.fillStyle = '#74b9ff'; ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.arc(s.x + s.w/2, s.y + s.h + drip*20, 2, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        if (s.type === 'crystal') {
            const squash = s.squashAnim > 0 ? 0.6 : 1;
            const cx = s.x + s.w/2;
            const glow = 0.3 + Math.sin(t*3)*0.15;
            ctx.save(); ctx.translate(cx, s.y + s.h); ctx.scale(1, squash);
            // Crystal shape
            ctx.fillStyle = `rgba(100,200,255,${0.7+glow})`;
            ctx.beginPath();
            ctx.moveTo(-s.w/2, 0); ctx.lineTo(-s.w/4, -s.h); ctx.lineTo(s.w/4, -s.h); ctx.lineTo(s.w/2, 0);
            ctx.closePath(); ctx.fill();
            // Highlight
            ctx.fillStyle = `rgba(200,240,255,${0.5+glow})`;
            ctx.beginPath();
            ctx.moveTo(-s.w/4, 0); ctx.lineTo(-s.w/6, -s.h*0.8); ctx.lineTo(0, 0);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }

        if (s.type === 'haybale') {
            const squash = s.squashAnim > 0 ? 0.6 : 1;
            const cx = s.x + s.w/2;
            ctx.save(); ctx.translate(cx, s.y + s.h/2); ctx.scale(1, squash);
            // Bale body
            ctx.fillStyle = '#d4a03a';
            ctx.beginPath(); ctx.ellipse(0, 0, s.w/2, s.h/2, 0, 0, Math.PI*2); ctx.fill();
            // Straw lines
            ctx.strokeStyle = '#c19027'; ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                const angle = (i/5) * Math.PI;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle)*s.w*0.15, Math.sin(angle)*s.h*0.15);
                ctx.lineTo(Math.cos(angle)*s.w*0.45, Math.sin(angle)*s.h*0.45);
                ctx.stroke();
            }
            // Wrap band
            ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, 0, s.w*0.35, s.h*0.35, 0, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
        }

        if (s.type === 'mud') {
            ctx.fillStyle = '#5d4037'; ctx.fillRect(s.x, s.y, s.w, s.h);
            ctx.fillStyle = '#4e342e';
            for (let i = 0; i < 4; i++) {
                const bx = s.x + ((i * s.w/3 + t * 10) % s.w);
                const wobble = Math.sin(t*3 + i) * 1.5;
                ctx.beginPath(); ctx.arc(bx, s.y + 3 + wobble, 3, 0, Math.PI*2); ctx.fill();
            }
            ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(78,52,46,0.6)';
            ctx.fillText('MUD', s.x + s.w/2, s.y - 4);
        }

        if (s.type === 'vine') {
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(s.x, s.y, s.w, s.h);
            // Vine tendrils
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) {
                const vx = s.x + s.w * (0.2 + i * 0.2);
                ctx.beginPath();
                for (let j = 0; j < 8; j++) {
                    const vy = s.y + j * (s.h/7);
                    const wobble = Math.sin(t*2 + i + j*0.5) * 8;
                    j === 0 ? ctx.moveTo(vx + wobble, vy) : ctx.lineTo(vx + wobble, vy);
                }
                ctx.stroke();
            }
            // Arrow indicators
            ctx.fillStyle = '#66bb6a';
            for (let i = 0; i < 3; i++) {
                const ax = s.x + s.w * (0.3 + i * 0.2);
                const ay = s.y + ((i * 40 - t * 60) % s.h + s.h) % s.h;
                ctx.beginPath();
                ctx.moveTo(ax - 5, ay + 5); ctx.lineTo(ax, ay - 5); ctx.lineTo(ax + 5, ay + 5);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(76,175,80,0.5)';
            ctx.fillText('VINE', s.x + s.w/2, s.y + 12);
        }

        if (s.type === 'eruption') {
            // Volcanic vent shooting fire particles upward
            const cx = s.x + s.w/2;
            ctx.fillStyle = '#555'; ctx.fillRect(s.x, s.y, s.w, s.h);
            // Fire particles
            for (let i = 0; i < 6; i++) {
                const px = cx + Math.sin(t*5 + i*2) * 10;
                const py = s.y - ((t*80 + i*30) % 60);
                const size = 3 + Math.sin(t*3+i)*1.5;
                ctx.fillStyle = i%2===0 ? '#ff4500' : '#ff6347';
                ctx.globalAlpha = 0.6 - (s.y - py) / 100;
                ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (s.type === 'seaweed') {
            for (let i = 0; i < 3; i++) {
                const sx = s.x + i * 8;
                ctx.strokeStyle = i%2===0 ? '#2e7d32' : '#388e3c';
                ctx.lineWidth = 3;
                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const sy = s.y + s.h - j * (s.h/5);
                    const wobble = Math.sin(t*2 + i + j*0.8) * 5;
                    j === 0 ? ctx.moveTo(sx + wobble, sy) : ctx.lineTo(sx + wobble, sy);
                }
                ctx.stroke();
            }
        }

        if (s.type === 'ghost') {
            // Spooky zone that reverses controls
            ctx.globalAlpha = 0.08 + Math.sin(t*2)*0.04;
            ctx.fillStyle = '#9b59b6';
            ctx.fillRect(s.x, s.y, s.w, s.h);
            ctx.globalAlpha = 0.3 + Math.sin(t*2)*0.1;
            ctx.font = '20px Arial'; ctx.textAlign = 'center';
            ctx.fillText('👻', s.x + s.w/2 + Math.sin(t*1.5)*10, s.y + s.h/2 + Math.cos(t*1.2)*10);
            ctx.font = 'bold 9px Arial';
            ctx.fillStyle = 'rgba(155,89,182,0.5)';
            ctx.fillText('HAUNTED', s.x + s.w/2, s.y + 12);
            ctx.globalAlpha = 1;
        }

        if (s.type === 'boostpad') {
            const glow = 0.5 + Math.sin(t*4)*0.3;
            ctx.fillStyle = `rgba(255,0,255,${glow*0.3})`;
            ctx.fillRect(s.x - 3, s.y - 3, s.w + 6, s.h + 6);
            ctx.fillStyle = s.dir > 0 ? '#00ffff' : '#ff00ff';
            ctx.fillRect(s.x, s.y, s.w, s.h);
            // Direction arrows
            ctx.fillStyle = '#fff';
            const arrowDir = s.dir || 1;
            for (let i = 0; i < 3; i++) {
                const ax = s.x + s.w/2 + (i - 1) * 14;
                ctx.beginPath();
                ctx.moveTo(ax - 4*arrowDir, s.y + s.h/2 - 3);
                ctx.lineTo(ax + 4*arrowDir, s.y + s.h/2);
                ctx.lineTo(ax - 4*arrowDir, s.y + s.h/2 + 3);
                ctx.fill();
            }
        }
    }
}

function drawPowerUps() {
    for (const pu of powerUps) {
        if (!isInView(pu.x, pu.w)) continue;
        pu.age += 0.016;
        const bobY = Math.sin(pu.bobOffset + pu.age * 3) * 5;

        ctx.beginPath();
        ctx.arc(pu.x + pu.w/2, pu.y + pu.h/2 + bobY, 18, 0, Math.PI*2);
        ctx.fillStyle = pu.color + '40'; ctx.fill();

        const bx = pu.x + pu.w/2;
        const by = pu.y + pu.h/2 + bobY;
        ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI*2);
        ctx.fillStyle = pu.color; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

        ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pu.emoji, bx, by);
    }
}

function drawTagFlash() {
    if (tagFlash > 0) {
        ctx.fillStyle = `rgba(255, 100, 50, ${tagFlash * 0.3})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ===== RACE BACKGROUND =====
function drawRaceBackground() {
    const W = canvas.width;
    const H = canvas.height;
    const leftSection = Math.max(0, Math.floor(cameraX / raceSectionWidth));
    const rightSection = Math.min(WORLDS.length - 1, Math.floor((cameraX + W) / raceSectionWidth));

    for (let si = leftSection; si <= rightSection; si++) {
        const world = WORLDS[si];
        const sectionStart = si * raceSectionWidth;
        const screenLeft = sectionStart - cameraX;
        const screenRight = sectionStart + raceSectionWidth - cameraX;
        const visLeft = Math.max(0, screenLeft);
        const visRight = Math.min(W, screenRight);
        if (visRight <= visLeft) continue;

        ctx.save();
        ctx.beginPath();
        ctx.rect(visLeft, 0, visRight - visLeft, H);
        ctx.clip();

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, world.skyTop);
        skyGrad.addColorStop(0.6, world.skyMid);
        skyGrad.addColorStop(1, world.skyBot);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(visLeft, 0, visRight - visLeft, H);

        // World-specific background effects
        const t = Date.now() / 1000;
        const secW = visRight - visLeft;

        if (world.name === 'Forest') {
            // Trees
            ctx.globalAlpha = 0.2;
            for (let i = 0; i < 6; i++) {
                const tx = visLeft + i * (secW / 5) + Math.sin(i * 7) * 15;
                const ty = H * 0.3 + Math.sin(i * 4) * 15;
                ctx.fillStyle = '#5d4037'; ctx.fillRect(tx + 10, ty + 40, 6, 20);
                ctx.fillStyle = '#2d7a3f';
                ctx.beginPath();
                ctx.moveTo(tx, ty + 45); ctx.lineTo(tx + 13, ty); ctx.lineTo(tx + 26, ty + 45);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(tx - 3, ty + 35); ctx.lineTo(tx + 13, ty + 10); ctx.lineTo(tx + 29, ty + 35);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Sunbeams
            ctx.globalAlpha = 0.04;
            ctx.fillStyle = '#ffffaa';
            for (let i = 0; i < 3; i++) {
                const bx = visLeft + secW * (0.2 + i * 0.3);
                ctx.beginPath();
                ctx.moveTo(bx - 8, 0); ctx.lineTo(bx + 8, 0);
                ctx.lineTo(bx + 30, H); ctx.lineTo(bx - 30, H);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Space') {
            // Nebula hint
            ctx.globalAlpha = 0.06;
            const nGrad = ctx.createRadialGradient(visLeft + secW * 0.4, H * 0.3, 10, visLeft + secW * 0.4, H * 0.3, 120);
            nGrad.addColorStop(0, '#9b59b6');
            nGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = nGrad;
            ctx.fillRect(visLeft, 0, secW, H);
            ctx.globalAlpha = 1;
            // Stars
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 50; i++) {
                const sx = visLeft + ((i * 137.5 + Math.sin(i*3.7)*100) % secW);
                const sy = (i * 97.3 + Math.cos(i*2.3)*80) % (H * 0.7);
                ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t + i));
                ctx.fillStyle = i % 7 === 0 ? '#ffcc00' : '#fff';
                ctx.fillRect(sx, sy, 2, 2);
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Lava') {
            const lg = ctx.createLinearGradient(0, H-120, 0, H);
            lg.addColorStop(0, 'rgba(255,69,0,0)');
            lg.addColorStop(0.5, 'rgba(255,100,0,0.2)');
            lg.addColorStop(1, 'rgba(255,69,0,0.35)');
            ctx.fillStyle = lg;
            ctx.fillRect(visLeft, H-120, secW, 120);
            // Embers
            for (let i = 0; i < 8; i++) {
                const ex = visLeft + ((i * 80 + Math.sin(t + i * 3) * 20) % secW);
                const ey = H - ((i * 60 + t * 35) % (H * 0.6));
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = i % 2 === 0 ? '#ff6600' : '#ff9900';
                ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Snow Mountain') {
            // Mountain range
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#4a6a8a';
            ctx.beginPath(); ctx.moveTo(visLeft, H * 0.5);
            for (let i = 0; i < 6; i++) {
                const mx = visLeft + i * (secW / 5);
                ctx.lineTo(mx, H * (0.1 + Math.sin(i * 2.3) * 0.1));
            }
            ctx.lineTo(visRight, H * 0.5); ctx.fill();
            // Snow caps
            ctx.fillStyle = '#e8f0ff';
            for (let i = 0; i < 6; i++) {
                const mx = visLeft + i * (secW / 5);
                const my = H * (0.1 + Math.sin(i * 2.3) * 0.1);
                ctx.beginPath();
                ctx.moveTo(mx - 8, my + 5); ctx.lineTo(mx, my); ctx.lineTo(mx + 8, my + 5);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Snowflakes
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 25; i++) {
                const sx = visLeft + ((i*97 + t*18 + Math.sin(t+i)*40) % secW);
                const sy = (i*73 + t*25 + Math.cos(t*0.5+i)*25) % H;
                ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI*2); ctx.fill();
            }
        }

        if (world.name === 'Ocean') {
            ctx.globalAlpha = 0.1;
            for (let i = 0; i < 4; i++) {
                const wy = H*0.3 + i*60 + Math.sin(t + i*0.5)*15;
                ctx.strokeStyle = '#48cae4'; ctx.lineWidth = 2;
                ctx.beginPath();
                for (let x = visLeft; x < visRight; x += 10) {
                    const y = wy + Math.sin(x*0.02 + t*2 + i)*10;
                    x === visLeft ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // Coral
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#e056a0';
            for (let i = 0; i < 4; i++) {
                const cx = visLeft + i * (secW / 3);
                ctx.beginPath();
                ctx.moveTo(cx, H - 45); ctx.lineTo(cx + 5, H - 60);
                ctx.lineTo(cx + 12, H - 50); ctx.lineTo(cx + 18, H - 65);
                ctx.lineTo(cx + 24, H - 45);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Castle') {
            // Stone wall hint
            ctx.globalAlpha = 0.05;
            ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 1;
            for (let row = 0; row < 10; row++) {
                const y = row * 35;
                const offset = row % 2 === 0 ? 0 : 20;
                for (let x = visLeft + offset; x < visRight; x += 40) {
                    ctx.strokeRect(x, y, 40, 35);
                }
            }
            ctx.globalAlpha = 1;
            // Torches
            for (let i = 0; i < 3; i++) {
                const tx = visLeft + secW * (0.2 + i*0.3);
                const ty = H * 0.3;
                ctx.fillStyle = '#5d4e37'; ctx.fillRect(tx-3, ty, 6, 20);
                const flicker = Math.sin(t*8 + i*2)*3;
                const glow = ctx.createRadialGradient(tx, ty-5+flicker, 2, tx, ty-5+flicker, 15);
                glow.addColorStop(0, 'rgba(255,165,0,0.6)');
                glow.addColorStop(1, 'rgba(255,69,0,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(tx, ty-5+flicker, 15, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#f39c12';
                ctx.beginPath(); ctx.ellipse(tx, ty-5+flicker, 4, 7, 0, 0, Math.PI*2); ctx.fill();
            }
            // Banners
            ctx.globalAlpha = 0.15;
            for (let i = 0; i < 2; i++) {
                const bx = visLeft + secW * (0.35 + i * 0.3);
                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.moveTo(bx - 6, H * 0.2); ctx.lineTo(bx + 6, H * 0.2);
                ctx.lineTo(bx + 6, H * 0.2 + 22); ctx.lineTo(bx, H * 0.2 + 30);
                ctx.lineTo(bx - 6, H * 0.2 + 22);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Sky') {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            for (let i = 0; i < 5; i++) {
                const cx = visLeft + ((i*160 + t*15) % secW);
                const cy = 30 + i*45;
                drawCloud(cx, cy, 40 + i*8);
            }
            // Birds
            ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                const bx = visLeft + ((i * 120 + t * 18) % secW);
                const by = 50 + i * 40 + Math.sin(t * 2 + i) * 8;
                const wing = Math.sin(t * 4 + i * 2) * 4;
                ctx.beginPath();
                ctx.moveTo(bx - 6, by + wing); ctx.lineTo(bx, by); ctx.lineTo(bx + 6, by + wing);
                ctx.stroke();
            }
        }

        if (world.name === 'Candy') {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            for (let i = 0; i < 4; i++) {
                const cx = visLeft + ((i*180 + t*12) % secW);
                const cy = 40 + i*50;
                drawCloud(cx, cy, 35 + i*8);
            }
            // Lollipops
            ctx.globalAlpha = 0.2;
            const lolliColors = ['#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb'];
            for (let i = 0; i < 3; i++) {
                const lx = visLeft + secW * (0.2 + i * 0.3);
                const ly = H * 0.35;
                ctx.fillStyle = '#f5f5f5'; ctx.fillRect(lx - 2, ly, 3, 50);
                ctx.fillStyle = lolliColors[i];
                ctx.beginPath(); ctx.arc(lx, ly, 14, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(lx, ly, 8, t + i, t + i + Math.PI); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // ---- NEW WORLDS ----
        if (world.name === 'Desert') {
            // Sun
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#f9ca24';
            ctx.beginPath(); ctx.arc(visLeft + secW * 0.7, H * 0.1, 20, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // Dunes
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#d4a854';
            ctx.beginPath(); ctx.moveTo(visLeft, H * 0.5);
            for (let x = visLeft; x <= visRight; x += 5) {
                ctx.lineTo(x, H * 0.42 + Math.sin((x + cameraX) / 130) * 25 + Math.sin((x + cameraX) / 60) * 12);
            }
            ctx.lineTo(visRight, H * 0.6); ctx.lineTo(visLeft, H * 0.6); ctx.fill();
            ctx.globalAlpha = 1;
            // Cacti silhouettes
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#5d4037';
            for (let i = 0; i < 3; i++) {
                const cx = visLeft + secW * (0.15 + i * 0.3);
                const cy = H * 0.43;
                ctx.fillRect(cx - 2, cy, 4, 20);
                ctx.fillRect(cx - 8, cy + 6, 6, 3); ctx.fillRect(cx - 8, cy + 6, 3, 8);
                ctx.fillRect(cx + 2, cy + 10, 6, 3); ctx.fillRect(cx + 5, cy + 4, 3, 9);
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Cave') {
            // Stalactites from ceiling
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#3a3a4a';
            for (let i = 0; i < 8; i++) {
                const sx = visLeft + i * (secW / 7) + Math.sin(i * 5) * 10;
                const sh = 15 + Math.sin(i * 7) * 10;
                ctx.beginPath();
                ctx.moveTo(sx - 5, 0); ctx.lineTo(sx + 5, 0); ctx.lineTo(sx, sh);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Crystal glows
            for (let i = 0; i < 3; i++) {
                const gx = visLeft + secW * (0.2 + i * 0.3);
                const gy = H * 0.35 + Math.sin(i * 4) * 20;
                ctx.globalAlpha = 0.06;
                const cG = ctx.createRadialGradient(gx, gy, 3, gx, gy, 30);
                cG.addColorStop(0, '#64c8ff');
                cG.addColorStop(1, 'transparent');
                ctx.fillStyle = cG;
                ctx.beginPath(); ctx.arc(gx, gy, 30, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Bats
            for (let i = 0; i < 2; i++) {
                const bx = visLeft + ((i * 150 + t * 30) % secW);
                const by = H * 0.15 + Math.sin(t * 3 + i * 2) * 15;
                ctx.fillStyle = 'rgba(30,30,40,0.25)';
                const wing = Math.sin(t * 6 + i * 2) * 5;
                ctx.beginPath();
                ctx.moveTo(bx - 6, by + wing); ctx.lineTo(bx, by); ctx.lineTo(bx + 6, by + wing);
                ctx.fill();
            }
        }

        if (world.name === 'Farm') {
            // Sun
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#f9ca24';
            ctx.beginPath(); ctx.arc(visLeft + secW * 0.75, H * 0.1, 20, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // Barn
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#8b2500';
            ctx.fillRect(visLeft + secW * 0.1, H * 0.35, 40, 35);
            ctx.fillStyle = '#a03020';
            ctx.beginPath();
            ctx.moveTo(visLeft + secW * 0.1 - 3, H * 0.35);
            ctx.lineTo(visLeft + secW * 0.1 + 20, H * 0.25);
            ctx.lineTo(visLeft + secW * 0.1 + 43, H * 0.35);
            ctx.fill();
            ctx.globalAlpha = 1;
            // Fence
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#8d6e63';
            for (let i = 0; i < 6; i++) {
                ctx.fillRect(visLeft + secW * 0.4 + i * 20, H * 0.55, 2, 15);
            }
            ctx.fillRect(visLeft + secW * 0.4, H * 0.57, 100, 1.5);
            ctx.fillRect(visLeft + secW * 0.4, H * 0.62, 100, 1.5);
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Jungle') {
            // Canopy from top
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#0d5016';
            ctx.beginPath(); ctx.moveTo(visLeft, 0);
            for (let x = visLeft; x <= visRight; x += 12) {
                ctx.lineTo(x, 25 + Math.sin(x / 35) * 15 + Math.sin(x / 80) * 10);
            }
            ctx.lineTo(visRight, 0); ctx.fill();
            ctx.globalAlpha = 1;
            // Hanging vines
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                const vx = visLeft + i * (secW / 4) + Math.sin(i * 5) * 15;
                ctx.beginPath(); ctx.moveTo(vx, 0);
                for (let j = 0; j < 5; j++) {
                    ctx.lineTo(vx + Math.sin(t * 0.8 + j + i) * 8, j * 18);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // Parrots
            for (let i = 0; i < 2; i++) {
                const px = visLeft + ((i * 200 + t * 22) % secW);
                const py = H * 0.2 + Math.sin(t * 2 + i * 3) * 15;
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = i === 0 ? '#e74c3c' : '#2ecc71';
                ctx.beginPath(); ctx.ellipse(px, py, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        if (world.name === 'Volcano') {
            // Volcano silhouette
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#3e2723';
            ctx.beginPath();
            ctx.moveTo(visLeft + secW * 0.2, H * 0.6);
            ctx.lineTo(visLeft + secW * 0.4, H * 0.12);
            ctx.lineTo(visLeft + secW * 0.45, H * 0.1);
            ctx.lineTo(visLeft + secW * 0.5, H * 0.13);
            ctx.lineTo(visLeft + secW * 0.7, H * 0.6);
            ctx.fill();
            // Crater glow
            ctx.fillStyle = '#ff4500';
            ctx.globalAlpha = 0.12 + Math.sin(t * 2) * 0.04;
            ctx.beginPath();
            ctx.ellipse(visLeft + secW * 0.45, H * 0.1, 12, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            // Lava glow base
            const lvG = ctx.createLinearGradient(0, H - 80, 0, H);
            lvG.addColorStop(0, 'rgba(255,69,0,0)');
            lvG.addColorStop(1, 'rgba(255,69,0,0.3)');
            ctx.fillStyle = lvG;
            ctx.fillRect(visLeft, H - 80, secW, 80);
            // Embers
            for (let i = 0; i < 10; i++) {
                const ex = visLeft + ((i * 70 + Math.sin(t + i * 2) * 20) % secW);
                const ey = H - ((i * 50 + t * 30) % (H * 0.6));
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = i % 2 === 0 ? '#ff6600' : '#888';
                ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Underwater') {
            // Light beams
            ctx.globalAlpha = 0.04;
            ctx.fillStyle = '#48cae4';
            for (let i = 0; i < 4; i++) {
                const rx = visLeft + secW * (0.1 + i * 0.25);
                ctx.beginPath();
                ctx.moveTo(rx - 6, 0); ctx.lineTo(rx + 6, 0);
                ctx.lineTo(rx + 25, H); ctx.lineTo(rx - 25, H);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Ripples at top
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = '#90e0ef'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                for (let x = visLeft; x < visRight; x += 8) {
                    const y = 12 + i * 8 + Math.sin(x * 0.03 + t * 2 + i) * 4;
                    x === visLeft ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // Jellyfish
            const jx = visLeft + secW * 0.5 + Math.sin(t * 0.5) * 30;
            const jy = H * 0.3 + Math.sin(t * 0.7) * 20;
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#a29bfe';
            ctx.beginPath(); ctx.arc(jx, jy, 10, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = '#a29bfe'; ctx.lineWidth = 1;
            for (let j = 0; j < 3; j++) {
                ctx.beginPath();
                ctx.moveTo(jx - 4 + j * 4, jy);
                ctx.bezierCurveTo(jx - 4 + j * 4 + Math.sin(t * 2 + j) * 4, jy + 8,
                    jx - 4 + j * 4 - Math.sin(t * 2.5 + j) * 4, jy + 16,
                    jx - 4 + j * 4, jy + 20);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // Bubbles
            for (let i = 0; i < 6; i++) {
                const bx = visLeft + ((i * 80 + Math.sin(t * 0.4 + i * 3) * 10) % secW);
                const by = H - ((i * 50 + t * 16) % (H * 0.7));
                ctx.globalAlpha = 0.1;
                ctx.strokeStyle = '#90e0ef'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Graveyard') {
            // Moon
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#f5f5dc';
            ctx.beginPath(); ctx.arc(visLeft + secW * 0.75, H * 0.1, 18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = world.skyTop;
            ctx.beginPath(); ctx.arc(visLeft + secW * 0.75 + 6, H * 0.1 - 2, 16, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // Dead trees
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const tx = visLeft + secW * (0.1 + i * 0.35);
                ctx.beginPath(); ctx.moveTo(tx, H * 0.6); ctx.lineTo(tx, H * 0.35); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(tx, H * 0.4); ctx.lineTo(tx + 12, H * 0.3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(tx, H * 0.45); ctx.lineTo(tx - 10, H * 0.35); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // Tombstones
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#555';
            for (let i = 0; i < 4; i++) {
                const sx = visLeft + i * (secW / 3) + 10;
                const sy = H * 0.58;
                ctx.fillRect(sx - 5, sy, 10, 14);
                ctx.beginPath(); ctx.arc(sx, sy, 5, Math.PI, 0); ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Fog
            ctx.globalAlpha = 0.06;
            ctx.fillStyle = '#b0b0b0';
            for (let i = 0; i < 4; i++) {
                const fx = visLeft + ((i * 100 + t * 10) % secW);
                ctx.beginPath();
                ctx.ellipse(fx, H - 50, 40, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        if (world.name === 'Neon') {
            // Grid
            ctx.globalAlpha = 0.05;
            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1;
            for (let i = 0; i < 12; i++) {
                const x = visLeft + i * (secW / 10);
                ctx.beginPath(); ctx.moveTo(x, H * 0.5); ctx.lineTo(x, H); ctx.stroke();
            }
            for (let i = 0; i < 5; i++) {
                ctx.beginPath(); ctx.moveTo(visLeft, H * 0.5 + i * 30); ctx.lineTo(visRight, H * 0.5 + i * 30); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // Neon buildings
            ctx.globalAlpha = 0.1;
            const nCols = ['#ff00ff', '#00ffff', '#ff0066', '#00ff88'];
            for (let i = 0; i < 4; i++) {
                const bx = visLeft + i * (secW / 3) + 8;
                const bh = 45 + Math.sin(i * 4) * 20;
                ctx.fillStyle = '#111';
                ctx.fillRect(bx, H * 0.5 - bh, 25, bh);
                ctx.strokeStyle = nCols[i]; ctx.lineWidth = 1.5;
                ctx.strokeRect(bx, H * 0.5 - bh, 25, bh);
                // Windows
                ctx.fillStyle = nCols[i];
                for (let j = 0; j < 2; j++) {
                    ctx.fillRect(bx + 4 + j * 12, H * 0.5 - bh + 6, 6, 6);
                }
            }
            ctx.globalAlpha = 1;
            // Neon particles
            for (let i = 0; i < 8; i++) {
                const px = visLeft + ((i * 70 + t * 12) % secW);
                const py = (i * 60 + t * 8) % H;
                ctx.fillStyle = nCols[i % 4];
                ctx.globalAlpha = 0.15 + Math.sin(t * 4 + i) * 0.08;
                ctx.fillRect(px, py, 2, 2);
            }
            ctx.globalAlpha = 1;
        }

        // Hills
        ctx.fillStyle = world.hillColor;
        ctx.beginPath();
        ctx.moveTo(visLeft, H-35);
        for (let x = visLeft; x <= visRight; x += 15) {
            const wx = x + cameraX; // world-space x for consistent hills
            ctx.lineTo(x, H-35 - Math.sin(wx/200)*25 - Math.sin(wx/80)*12);
        }
        ctx.lineTo(visRight, H); ctx.lineTo(visLeft, H);
        ctx.fill();

        // World name indicator at the start of each section
        if (screenLeft > -100 && screenLeft < W) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - Math.abs(screenLeft) / 300);
            ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillText(world.emoji + ' ' + world.name.toUpperCase(), screenLeft + 200, H / 2);
            ctx.restore();
        }

        ctx.restore();
    }
}

// ===== FINISH LINE =====
function drawFinishLine() {
    const finishX = raceTotalWidth - 150;
    const H = canvas.height;
    if (!isInView(finishX, 80)) return;

    // Checkered pattern
    const sq = 18;
    for (let row = 0; row < Math.ceil(H / sq); row++) {
        for (let col = 0; col < 4; col++) {
            ctx.fillStyle = (row + col) % 2 === 0 ? '#222' : '#fff';
            ctx.fillRect(finishX + col*sq, row*sq, sq, sq);
        }
    }

    // "FINISH" banner
    ctx.save();
    ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    const tx = finishX + 36;
    ctx.strokeText('FINISH', tx, 55);
    ctx.fillText('FINISH', tx, 55);
    ctx.restore();

    // Glow effect
    const t = Date.now() / 1000;
    ctx.globalAlpha = 0.15 + Math.sin(t * 3) * 0.1;
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(finishX - 5, 0, 80, H);
    ctx.globalAlpha = 1;
}

// ===== RACE HUD (drawn in screen space) =====
function drawRaceHUD() {
    const W = canvas.width;
    const H = canvas.height;

    // Progress bar
    const barW = W * 0.6;
    const barH = 10;
    const barX = (W - barW) / 2;
    const barY = 82;
    const progress = Math.min(1, cameraX / (raceTotalWidth - W));

    // Bar background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const barR = barH / 2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barR);
    ctx.fill();

    // Bar fill
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fillGrad.addColorStop(0, '#e74c3c');
    fillGrad.addColorStop(1, '#f1c40f');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, barR);
    ctx.fill();

    // World section markers + emojis
    ctx.font = '12px Arial'; ctx.textAlign = 'center';
    for (let i = 0; i < WORLDS.length; i++) {
        const mx = barX + ((i + 0.5) / WORLDS.length) * barW;
        // Section divider
        if (i > 0) {
            const divX = barX + (i / WORLDS.length) * barW;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(divX - 0.5, barY - 1, 1, barH + 2);
        }
        // Emoji
        ctx.fillText(WORLDS[i].emoji, mx, barY - 4);
    }

    // Player position dots on progress bar
    if (player1 && player2) {
        const p1p = Math.min(1, player1.x / raceTotalWidth);
        const p2p = Math.min(1, player2.x / raceTotalWidth);

        // P1 dot
        ctx.fillStyle = '#74b9ff';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(barX + p1p * barW, barY + barH/2, 5, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        // P2 dot
        ctx.fillStyle = '#ff7675';
        ctx.beginPath(); ctx.arc(barX + p2p * barW, barY + barH/2, 5, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
    }

    // Current world label
    const curWorld = WORLDS[Math.min(currentWorldSection, WORLDS.length - 1)];
    ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(curWorld.emoji + ' ' + curWorld.name, W/2, barY + barH + 16);

    // Race timer
    const remaining = Math.max(0, RACE_DURATION - raceTimer);
    const min = Math.floor(remaining / 60);
    const sec = Math.floor(remaining % 60);
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = remaining < 30 ? '#e74c3c' : 'rgba(255,255,255,0.5)';
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, W/2, barY + barH + 30);
}

// ===== UPDATE HUD =====
function updateHUD() {
    if (gameMode === 'race') {
        // Race mode: show remaining race time in mm:ss format
        const remaining = Math.max(0, RACE_DURATION - raceTimer);
        const min = Math.floor(remaining / 60);
        const sec = Math.ceil(remaining % 60);
        document.getElementById('timer-val').textContent = `${min}:${sec.toString().padStart(2, '0')}`;

        // In race mode, hide scores (not relevant) and show world name
        document.getElementById('p1-score-val').textContent = '';
        document.getElementById('p2-score-val').textContent = '';
        document.getElementById('p1-score-val').parentElement.style.display = 'none';
        document.getElementById('p2-score-val').parentElement.style.display = 'none';

        // Timer warning in last 30 seconds of race
        const timerEl = document.getElementById('timer-val');
        if (remaining <= 30) {
            timerEl.style.color = '#e74c3c';
            timerEl.style.animation = 'itPulse 0.5s ease-in-out infinite';
        } else {
            timerEl.style.color = '#fff';
            timerEl.style.animation = 'none';
        }
    } else {
        // Tag mode: normal HUD
        document.getElementById('timer-val').textContent = Math.ceil(roundTimer);
        document.getElementById('p1-score-val').textContent = scores[1];
        document.getElementById('p2-score-val').textContent = scores[2];
        document.getElementById('p1-score-val').parentElement.style.display = '';
        document.getElementById('p2-score-val').parentElement.style.display = '';

        // Dash cooldown indicators
        const p1Dash = document.getElementById('p1-dash-cd');
        const p2Dash = document.getElementById('p2-dash-cd');
        if (player1) {
            if (player1.dashCooldown > 0) {
                p1Dash.textContent = `DASH ${Math.ceil(player1.dashCooldown)}`;
                p1Dash.classList.add('on-cooldown');
            } else {
                p1Dash.textContent = 'DASH ✓';
                p1Dash.classList.remove('on-cooldown');
            }
        }
        if (player2) {
            if (player2.dashCooldown > 0) {
                p2Dash.textContent = `DASH ${Math.ceil(player2.dashCooldown)}`;
                p2Dash.classList.add('on-cooldown');
            } else {
                p2Dash.textContent = 'DASH ✓';
                p2Dash.classList.remove('on-cooldown');
            }
        }

        // Timer color warning
        const timerEl = document.getElementById('timer-val');
        if (roundTimer <= 10) {
            timerEl.style.color = '#e74c3c';
            timerEl.style.animation = 'itPulse 0.5s ease-in-out infinite';
        } else {
            timerEl.style.color = '#fff';
            timerEl.style.animation = 'none';
        }
    }
}

// ===== SCREEN SHAKE =====
function applyScreenShake() {
    if (screenShake > 0) {
        screenShakeX = (Math.random() - 0.5) * screenShake * 20;
        screenShakeY = (Math.random() - 0.5) * screenShake * 20;
        screenShake *= 0.9;
        if (screenShake < 0.01) screenShake = 0;
    } else {
        screenShakeX = 0;
        screenShakeY = 0;
    }
}

// ===== GAME LOOP =====
function gameLoop(timestamp) {
    if (gameState !== 'playing') return;
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // Input
    processKeyboardInput();
    if (isVsAI) updateAI(dt);

    // Timer & cooldowns
    tagCooldown -= dt;
    if (tagCooldown < 0) tagCooldown = 0;
    tagFlash -= dt * 2;
    if (tagFlash < 0) tagFlash = 0;

    // Race camera update
    if (gameMode === 'race') {
        raceTimer += dt;
        cameraX += raceScrollSpeed * dt;

        // Check finish
        if (cameraX + canvas.width >= raceTotalWidth) {
            cameraX = raceTotalWidth - canvas.width;
            if (!raceFinished) {
                raceFinished = true;
                endRace();
                return;
            }
        }
        currentWorldSection = Math.min(WORLDS.length - 1, Math.floor(cameraX / raceSectionWidth));

        // Remove power-ups behind camera
        powerUps = powerUps.filter(pu => pu.x + pu.w > cameraX - 100);

        // Race timer ran out
        if (raceTimer >= RACE_DURATION && !raceFinished) {
            raceFinished = true;
            endRace();
            return;
        }
    } else {
        roundTimer -= dt;
    }

    // Power-up spawning
    powerUpSpawnTimer -= dt;
    if (powerUpSpawnTimer <= 0) {
        spawnPowerUp();
        powerUpSpawnTimer = 4 + Math.random() * 4;
    }

    // Update
    player1.update(dt);
    player2.update(dt);
    checkTag();
    checkPowerUps();
    updateParticles(dt);
    updateHUD();
    applyScreenShake();

    // World announce timer
    if (worldAnnounceTimer > 0) worldAnnounceTimer -= dt;

    // Round end (tag mode only)
    if (gameMode !== 'race' && roundTimer <= 0) {
        endRound();
        return;
    }

    // Draw
    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    if (gameMode === 'race') {
        // Race mode: draw with camera offset
        drawRaceBackground();

        ctx.save();
        ctx.translate(-cameraX, 0);

        drawSpecialObjects();
        drawPlatforms();
        drawWalls();
        drawPowerUps();
        player1.draw();
        player2.draw();
        drawParticles();
        drawFinishLine();

        ctx.restore(); // undo camera

        drawRaceHUD();
        drawTagFlash();
    } else {
        // Tag mode: normal fixed screen
        drawBackground();
        drawSpecialObjects();
        drawPlatforms();
        drawWalls();
        drawPortals();
        drawPowerUps();
        player1.draw();
        player2.draw();
        drawParticles();
        drawTagFlash();
    }

    // World announce overlay (shows world name when random)
    if (worldAnnounceTimer > 0) {
        const world = WORLDS[currentWorld];
        const alpha = worldAnnounceTimer > 1.5 ? 1 : worldAnnounceTimer / 1.5;
        const W = canvas.width;
        const H = canvas.height;
        // Dark overlay
        ctx.fillStyle = `rgba(0,0,0,${0.4 * alpha})`;
        ctx.fillRect(0, H * 0.3, W, H * 0.25);
        // World emoji
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.min(W * 0.12, 60)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(world.emoji, W / 2, H * 0.42);
        // World name
        ctx.font = `bold ${Math.min(W * 0.06, 32)}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(world.name.toUpperCase(), W / 2, H * 0.52);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// ===== ROUND / GAME MANAGEMENT =====
function startGame() {
    scores = { 1: 0, 2: 0 };
    currentRound = 1;
    itPlayer = Math.random() < 0.5 ? 1 : 2;
    initAudio();

    if (gameMode === 'race') {
        totalRounds = 1;
        roundTime = RACE_DURATION + 30; // buffer
    } else {
        totalRounds = 3;
        roundTime = 60;
    }

    startRound();
}

function startRound() {
    // Random world selection — pick a new world each round
    if (randomWorlds && gameMode === 'tag') {
        currentWorld = Math.floor(Math.random() * WORLDS.length);
        worldAnnounceTimer = 2.5; // show world name for 2.5 seconds
    }

    roundTimer = roundTime;
    tagCooldown = 2;
    powerUps = [];
    particles = [];
    powerUpSpawnTimer = 3;

    if (gameMode === 'race') {
        cameraX = 0;
        raceTimer = 0;
        raceFinished = false;
    }

    showScreen('game');

    // Update P2 label for AI mode
    document.getElementById('p2-label').textContent = isVsAI ? 'CPU' : 'P2';

    // Hide/show HUD elements based on mode
    document.getElementById('p1-dash-cd').style.display = gameMode === 'race' ? 'none' : '';
    document.getElementById('p2-dash-cd').style.display = gameMode === 'race' ? 'none' : '';

    requestAnimationFrame(() => {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;

        if (gameMode === 'race') {
            buildRaceLevel();
            resetPlayers();
            // Position players at start of race
            player1.x = 80;
            player1.y = canvas.height - 100;
            player2.x = 130;
            player2.y = canvas.height - 100;
        } else {
            buildLevel();
            resetPlayers();
        }

        updateItIndicator();
        updateHUD();
        lastTime = performance.now();
        startMusic();
        requestAnimationFrame(gameLoop);
    });
}

function endRound() {
    gameState = 'roundOver';
    stopMusic();
    playSound('roundend');

    const winner = itPlayer === 1 ? 2 : 1;
    scores[winner]++;

    if (currentRound >= totalRounds) {
        endGame();
        return;
    }

    const winLabel = (winner === 2 && isVsAI) ? 'CPU' : 'P' + winner;
    document.getElementById('round-result').textContent = `ROUND ${currentRound} - ${winLabel} WINS!`;
    document.getElementById('round-scores').textContent = `P1: ${scores[1]}  |  ${isVsAI ? 'CPU' : 'P2'}: ${scores[2]}`;
    showScreen('roundOver');
    currentRound++;
    itPlayer = itPlayer === 1 ? 2 : 1;
}

function endRace() {
    gameState = 'gameOver';
    stopMusic();
    playSound('roundend');

    // Whoever is IT at the finish loses
    const loser = itPlayer;
    const winner = itPlayer === 1 ? 2 : 1;

    let winText;
    if (winner === 1) {
        winText = isVsAI ? 'YOU WIN THE RACE!' : 'PLAYER 1 WINS!';
    } else {
        winText = isVsAI ? 'CPU WINS THE RACE!' : 'PLAYER 2 WINS!';
    }

    const loserLabel = (loser === 2 && isVsAI) ? 'CPU' : 'P' + loser;
    document.getElementById('winner-text').textContent = winText;
    document.getElementById('final-scores').textContent = `${loserLabel} was IT at the finish line!`;
    showScreen('gameOver');
    spawnConfetti();
}

function endGame() {
    gameState = 'gameOver';
    stopMusic();

    let winText;
    if (scores[1] > scores[2]) {
        winText = isVsAI ? 'YOU WIN!' : 'PLAYER 1 WINS!';
    } else if (scores[2] > scores[1]) {
        winText = isVsAI ? 'CPU WINS!' : 'PLAYER 2 WINS!';
    } else {
        winText = "IT'S A TIE!";
    }
    document.getElementById('winner-text').textContent = winText;
    document.getElementById('final-scores').textContent = `P1: ${scores[1]}  |  ${isVsAI ? 'CPU' : 'P2'}: ${scores[2]}`;
    showScreen('gameOver');

    // Confetti!
    spawnConfetti();
}

function spawnConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#fd79a8', '#00cec9'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (2 + Math.random() * 3) + 's';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.width = (6 + Math.random() * 8) + 'px';
        confetti.style.height = (6 + Math.random() * 8) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        container.appendChild(confetti);
    }
}

// ===== BUILD WORLD SELECT =====
function buildWorldSelect() {
    const grid = document.getElementById('world-grid');
    grid.innerHTML = '';

    // Random world card
    const randomCard = document.createElement('div');
    randomCard.className = 'world-card world-card-random';
    randomCard.innerHTML = `<span class="world-card-emoji">🎲</span><span class="world-card-name">Random</span>`;
    randomCard.addEventListener('click', () => {
        randomWorlds = true;
        document.querySelectorAll('.world-card').forEach(c => c.classList.remove('selected'));
        randomCard.classList.add('selected');
        playSound('select');
    });
    grid.appendChild(randomCard);

    WORLDS.forEach((w, i) => {
        const card = document.createElement('div');
        card.className = 'world-card' + (i === currentWorld ? ' selected' : '');
        card.style.background = w.bgColor;
        card.innerHTML = `<span class="world-card-emoji">${w.emoji}</span><span class="world-card-name">${w.name}</span>`;
        card.addEventListener('click', () => {
            randomWorlds = false;
            currentWorld = i;
            document.querySelectorAll('.world-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            playSound('select');
        });
        grid.appendChild(card);
    });

    // Mode selector buttons
    const tagBtn = document.getElementById('mode-tag-btn');
    const raceBtn = document.getElementById('mode-race-btn');
    const raceDesc = document.getElementById('race-description');
    const raceStartBtn = document.getElementById('race-start-btn');
    const title = document.getElementById('world-screen-title');

    // START button for tag mode (dynamically created)
    const startBtn = document.createElement('button');
    startBtn.className = 'menu-btn';
    startBtn.id = 'tag-start-btn';
    startBtn.textContent = 'START';
    startBtn.addEventListener('click', () => {
        playSound('select');
        startGame();
    });
    grid.parentElement.insertBefore(startBtn, document.getElementById('world-back-btn'));

    tagBtn.addEventListener('click', () => {
        gameMode = 'tag';
        tagBtn.classList.add('mode-btn-active');
        raceBtn.classList.remove('mode-btn-active');
        grid.classList.remove('hidden');
        startBtn.classList.remove('hidden');
        raceDesc.classList.add('hidden');
        raceStartBtn.classList.add('hidden');
        title.textContent = 'CHOOSE WORLD';
        playSound('select');
    });

    raceBtn.addEventListener('click', () => {
        gameMode = 'race';
        raceBtn.classList.add('mode-btn-active');
        tagBtn.classList.remove('mode-btn-active');
        grid.classList.add('hidden');
        startBtn.classList.add('hidden');
        raceDesc.classList.remove('hidden');
        raceStartBtn.classList.remove('hidden');
        title.textContent = 'RACE MODE';
        playSound('select');
    });

    // Race start button
    raceStartBtn.addEventListener('click', () => {
        playSound('select');
        startGame();
    });
}

function resetWorldScreenMode() {
    gameMode = 'tag';
    const tagBtn = document.getElementById('mode-tag-btn');
    const raceBtn = document.getElementById('mode-race-btn');
    const grid = document.getElementById('world-grid');
    const tagStartBtn = document.getElementById('tag-start-btn');
    const raceStartBtn = document.getElementById('race-start-btn');
    const raceDesc = document.getElementById('race-description');
    const title = document.getElementById('world-screen-title');
    tagBtn.classList.add('mode-btn-active');
    raceBtn.classList.remove('mode-btn-active');
    grid.classList.remove('hidden');
    if (tagStartBtn) tagStartBtn.classList.remove('hidden');
    raceDesc.classList.add('hidden');
    raceStartBtn.classList.add('hidden');
    title.textContent = 'CHOOSE WORLD';
}

// ===== BUTTON EVENTS =====
document.getElementById('start-btn').addEventListener('click', () => {
    initAudio();
    playSound('select');
    isVsAI = false;
    resetWorldScreenMode();
    showScreen('world');
});

document.getElementById('solo-btn').addEventListener('click', () => {
    initAudio();
    playSound('select');
    isVsAI = true;
    showScreen('difficulty');
});

document.getElementById('how-btn').addEventListener('click', () => {
    initAudio();
    playSound('select');
    showScreen('how');
});
document.getElementById('how-back-btn').addEventListener('click', () => {
    playSound('select');
    showScreen('title');
});

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        aiDifficulty = btn.dataset.diff;
        playSound('select');
        resetWorldScreenMode();
        showScreen('world');
    });
});
document.getElementById('diff-back-btn').addEventListener('click', () => {
    playSound('select');
    showScreen('title');
});

document.getElementById('world-back-btn').addEventListener('click', () => {
    playSound('select');
    isVsAI ? showScreen('difficulty') : showScreen('title');
});

document.getElementById('next-round-btn').addEventListener('click', () => {
    playSound('select');
    startRound();
});
document.getElementById('rematch-btn').addEventListener('click', () => {
    playSound('select');
    startGame();
});
document.getElementById('menu-btn').addEventListener('click', () => {
    playSound('select');
    showScreen('title');
});

document.getElementById('exit-btn').addEventListener('click', () => {
    gameState = 'title';
    stopMusic();
    showScreen('title');
});

// ===== INIT =====
function init() {
    buildWorldSelect();
    setupJoystick(1, 'p1-joystick-area', 'p1-joystick-base', 'p1-joystick-knob');
    setupJoystick(2, 'p2-joystick-area', 'p2-joystick-base', 'p2-joystick-knob');
    setupJumpButton(1, 'p1-jump-btn');
    setupJumpButton(2, 'p2-jump-btn');
    setupDashButton(1, 'p1-dash-btn');
    setupDashButton(2, 'p2-dash-btn');
}

init();
