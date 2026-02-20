/* === Cgames Game Shell === */
var GameShell = (function () {
    var config = {};

    function init(opts) {
        config = opts || {};
        // Apply saved theme
        var saved = localStorage.getItem('cgames-theme') || 'dark';
        document.body.setAttribute('data-theme', saved);

        // Back button
        var backBtns = document.querySelectorAll('.shell-back');
        backBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                CGameAudio.play('back');
                window.location.href = config.backUrl || '../';
            });
        });

        // Theme toggle buttons
        var themeBtns = document.querySelectorAll('.shell-theme-toggle');
        themeBtns.forEach(function (btn) {
            updateThemeIcon(btn);
            btn.addEventListener('click', function () {
                toggleTheme();
                themeBtns.forEach(updateThemeIcon);
                CGameAudio.play('click');
            });
        });

        // Sound toggle buttons
        var soundBtns = document.querySelectorAll('.shell-sound-toggle');
        soundBtns.forEach(function (btn) {
            updateSoundIcon(btn);
            btn.addEventListener('click', function () {
                CGameAudio.setEnabled(!CGameAudio.isEnabled());
                soundBtns.forEach(updateSoundIcon);
                CGameAudio.play('click');
            });
        });

        // Detect input type
        detectInput();
    }

    function toggleTheme() {
        var current = document.body.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('cgames-theme', next);
    }

    function updateThemeIcon(btn) {
        var theme = document.body.getAttribute('data-theme');
        btn.textContent = theme === 'dark' ? '\u263D' : '\u2600';
    }

    function updateSoundIcon(btn) {
        btn.textContent = CGameAudio.isEnabled() ? '\u266A' : '\u2716';
    }

    function showScreen(id) {
        var screens = document.querySelectorAll('.screen');
        screens.forEach(function (s) { s.classList.remove('active'); });
        var target = document.getElementById(id);
        if (target) {
            target.classList.add('active');
            target.classList.add('fade-in');
            target.addEventListener('animationend', function () {
                target.classList.remove('fade-in');
            }, { once: true });
        }
    }

    function showToast(msg, duration) {
        var el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        el.classList.remove('hidden');
        clearTimeout(el._tid);
        el._tid = setTimeout(function () {
            el.classList.remove('show');
        }, duration || 1500);
    }

    var inputType = 'keyboard';
    function detectInput() {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            inputType = 'touch';
        }
        document.body.classList.toggle('touch-device', inputType === 'touch');
        document.body.classList.toggle('pc-mode', inputType === 'keyboard');
    }

    function getInputType() { return inputType; }

    // In-memory scores (persists via sessionStorage for page navigation)
    var scores = JSON.parse(sessionStorage.getItem('cgames-scores') || '[]');
    function addScore(entry) {
        scores.push(entry);
        scores.sort(function (a, b) { return b.score - a.score; });
        if (scores.length > 50) scores.length = 50;
        sessionStorage.setItem('cgames-scores', JSON.stringify(scores));
    }
    function getScores(filter) {
        if (!filter) return scores;
        return scores.filter(function (s) { return s.game === filter; });
    }

    return {
        init: init,
        showScreen: showScreen,
        showToast: showToast,
        toggleTheme: toggleTheme,
        getInputType: getInputType,
        addScore: addScore,
        getScores: getScores
    };
})();
