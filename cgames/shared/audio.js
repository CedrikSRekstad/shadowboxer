/* === Cgames Shared Audio Engine === */
var CGameAudio = (function () {
    var ctx = null;
    var enabled = true;
    var customSounds = {};

    function init() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { }
    }

    function ensureCtx() {
        if (!ctx) init();
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    // Auto-init on first user interaction
    var initOnce = function () {
        ensureCtx();
        document.removeEventListener('click', initOnce);
        document.removeEventListener('keydown', initOnce);
        document.removeEventListener('touchstart', initOnce);
    };
    document.addEventListener('click', initOnce);
    document.addEventListener('keydown', initOnce);
    document.addEventListener('touchstart', initOnce);

    function osc(type, freq, start, dur, vol) {
        if (!ctx || !enabled) return;
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        o.connect(g).connect(ctx.destination);
        o.start(start);
        o.stop(start + dur);
    }

    function noise(start, dur, vol) {
        if (!ctx || !enabled) return;
        var len = ctx.sampleRate * dur;
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * vol;
        var src = ctx.createBufferSource();
        var g = ctx.createGain();
        src.buffer = buf;
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        src.connect(g).connect(ctx.destination);
        src.start(start);
        src.stop(start + dur);
    }

    function play(type) {
        ensureCtx();
        if (!ctx || !enabled) return;
        var now = ctx.currentTime;

        // Check custom sounds first
        if (customSounds[type]) {
            customSounds[type](ctx, now);
            return;
        }

        switch (type) {
            case 'click':
                osc('sine', 800, now, 0.04, 0.08);
                break;
            case 'back':
                osc('sine', 600, now, 0.05, 0.08);
                osc('sine', 400, now + 0.03, 0.05, 0.06);
                break;
            case 'select':
                osc('sine', 500, now, 0.06, 0.1);
                osc('sine', 700, now + 0.06, 0.08, 0.1);
                break;
            case 'win':
                osc('sine', 523, now, 0.2, 0.12);
                osc('sine', 659, now + 0.1, 0.2, 0.12);
                osc('sine', 784, now + 0.2, 0.2, 0.12);
                osc('sine', 1047, now + 0.3, 0.3, 0.15);
                break;
            case 'lose':
                osc('sine', 400, now, 0.2, 0.1);
                osc('sine', 350, now + 0.15, 0.2, 0.1);
                osc('sine', 300, now + 0.3, 0.3, 0.1);
                osc('triangle', 200, now + 0.4, 0.4, 0.08);
                break;
            case 'countdown':
                osc('sine', 880, now, 0.1, 0.15);
                break;
            case 'hit':
                osc('sawtooth', 200, now, 0.1, 0.15);
                noise(now, 0.05, 0.1);
                break;
            case 'bounce':
                osc('sine', 600, now, 0.06, 0.12);
                break;
            case 'score':
                osc('sine', 880, now, 0.08, 0.12);
                osc('sine', 1100, now + 0.06, 0.1, 0.12);
                break;
            case 'whoosh':
                noise(now, 0.12, 0.08);
                osc('sine', 300, now, 0.08, 0.04);
                break;
            case 'pop':
                osc('sine', 1000, now, 0.03, 0.1);
                break;
            case 'error':
                osc('square', 200, now, 0.15, 0.1);
                break;
        }
    }

    function register(name, fn) {
        customSounds[name] = fn;
    }

    function setEnabled(v) { enabled = v; }
    function isEnabled() { return enabled; }

    return {
        init: init,
        play: play,
        register: register,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        osc: osc,
        noise: noise,
        getCtx: function () { ensureCtx(); return ctx; }
    };
})();
