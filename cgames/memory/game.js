/* === Memory Card Game === */
(function () {
    'use strict';

    // --- Constants ---
    var EMOJIS = [
        '\uD83D\uDC36', '\uD83D\uDC31', '\uD83D\uDC38', '\uD83E\uDD8A', '\uD83D\uDC3B',
        '\uD83D\uDC3C', '\uD83D\uDC28', '\uD83E\uDD81', '\uD83D\uDC2E', '\uD83D\uDC37',
        '\uD83D\uDC35', '\uD83D\uDC14', '\uD83D\uDC27', '\uD83D\uDC19', '\uD83E\uDD8B',
        '\uD83D\uDC22', '\uD83D\uDC1D', '\uD83D\uDC1E', '\uD83E\uDD84', '\uD83D\uDC33'
    ];

    var FLIP_DELAY = 1000;

    // --- Game State ---
    var state = {
        mode: 1,            // 1 or 2 players
        cols: 4,
        rows: 3,
        cards: [],          // { emoji, flipped, matched }
        flippedIndices: [], // currently flipped (max 2)
        locked: false,      // prevent clicks during flip-back
        currentPlayer: 1,   // 1 or 2
        scores: [0, 0],     // p1, p2
        moves: 0,           // total flips (pairs of flips in 1P)
        pairsFound: 0,
        totalPairs: 0,
        timerInterval: null,
        startTime: 0,
        elapsed: 0
    };

    // --- DOM References ---
    var grid = document.getElementById('card-grid');
    var turnIndicator = document.getElementById('turn-indicator');
    var playerScores = document.getElementById('player-scores');
    var soloStats = document.getElementById('solo-stats');
    var statMoves = document.getElementById('stat-moves');
    var statPairs = document.getElementById('stat-pairs');
    var statTime = document.getElementById('stat-time');
    var p1Score = document.getElementById('p1-score');
    var p2Score = document.getElementById('p2-score');
    var p1Panel = document.getElementById('p1-panel');
    var p2Panel = document.getElementById('p2-panel');
    var gameInfo = document.getElementById('game-info');
    var gameoverTitle = document.getElementById('gameover-title');
    var gameoverStats = document.getElementById('gameover-stats');

    // --- Initialization ---
    GameShell.init({ backUrl: '../' });

    // Title screen buttons
    document.getElementById('btn-1p').addEventListener('click', function () {
        CGameAudio.play('click');
        state.mode = 1;
        startGame();
    });

    document.getElementById('btn-2p').addEventListener('click', function () {
        CGameAudio.play('click');
        state.mode = 2;
        startGame();
    });

    // Difficulty selection
    var diffBtns = document.querySelectorAll('.diff-btn');
    diffBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            CGameAudio.play('click');
            diffBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.cols = parseInt(btn.getAttribute('data-cols'));
            state.rows = parseInt(btn.getAttribute('data-rows'));
        });
    });

    // Menu button
    document.getElementById('btn-menu').addEventListener('click', function () {
        CGameAudio.play('back');
        stopTimer();
        GameShell.showScreen('title-screen');
    });

    // Game over buttons
    document.getElementById('btn-play-again').addEventListener('click', function () {
        CGameAudio.play('click');
        startGame();
    });

    document.getElementById('btn-back-menu').addEventListener('click', function () {
        CGameAudio.play('back');
        GameShell.showScreen('title-screen');
    });

    // --- Game Logic ---

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function startGame() {
        // Reset state
        state.cards = [];
        state.flippedIndices = [];
        state.locked = false;
        state.currentPlayer = 1;
        state.scores = [0, 0];
        state.moves = 0;
        state.pairsFound = 0;
        state.totalPairs = (state.cols * state.rows) / 2;
        state.elapsed = 0;

        // Generate card pairs
        var numPairs = state.totalPairs;
        var selectedEmojis = shuffle(EMOJIS.slice()).slice(0, numPairs);
        var cardValues = [];
        for (var i = 0; i < numPairs; i++) {
            cardValues.push(selectedEmojis[i]);
            cardValues.push(selectedEmojis[i]);
        }
        shuffle(cardValues);

        for (var j = 0; j < cardValues.length; j++) {
            state.cards.push({
                emoji: cardValues[j],
                flipped: false,
                matched: false
            });
        }

        // Build grid
        buildGrid();

        // Setup UI
        if (state.mode === 2) {
            playerScores.classList.remove('hidden');
            soloStats.classList.add('hidden');
            turnIndicator.classList.remove('hidden');
            updateTurnIndicator();
            updatePlayerScores();
        } else {
            playerScores.classList.add('hidden');
            soloStats.classList.remove('hidden');
            turnIndicator.classList.add('hidden');
            updateSoloStats();
            startTimer();
        }

        // Header info
        var diffLabel = state.cols + 'x' + state.rows;
        var modeLabel = state.mode === 1 ? '1P' : '2P';
        gameInfo.textContent = modeLabel + ' \u2022 ' + diffLabel;

        GameShell.showScreen('game-screen');
    }

    function buildGrid() {
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = 'repeat(' + state.cols + ', 1fr)';

        for (var i = 0; i < state.cards.length; i++) {
            var card = createCardElement(i);
            grid.appendChild(card);
        }
    }

    function createCardElement(index) {
        var card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);

        var inner = document.createElement('div');
        inner.className = 'card-inner';

        var back = document.createElement('div');
        back.className = 'card-face card-back';

        var front = document.createElement('div');
        front.className = 'card-face card-front';

        var emoji = document.createElement('span');
        emoji.className = 'card-emoji';
        emoji.textContent = state.cards[index].emoji;
        front.appendChild(emoji);

        inner.appendChild(back);
        inner.appendChild(front);
        card.appendChild(inner);

        card.addEventListener('click', function () {
            onCardClick(index);
        });

        return card;
    }

    function onCardClick(index) {
        // Guard: locked, already flipped, already matched, already 2 flipped
        if (state.locked) return;
        if (state.cards[index].flipped) return;
        if (state.cards[index].matched) return;
        if (state.flippedIndices.length >= 2) return;

        // Flip the card
        state.cards[index].flipped = true;
        state.flippedIndices.push(index);
        flipCardDOM(index, true);
        CGameAudio.play('click');

        if (state.flippedIndices.length === 2) {
            state.moves++;
            checkMatch();
        }
    }

    function flipCardDOM(index, show) {
        var cardEl = grid.children[index];
        if (!cardEl) return;
        if (show) {
            cardEl.classList.add('flipped');
        } else {
            cardEl.classList.remove('flipped');
        }
    }

    function checkMatch() {
        var idx1 = state.flippedIndices[0];
        var idx2 = state.flippedIndices[1];

        if (state.cards[idx1].emoji === state.cards[idx2].emoji) {
            // Match found
            state.locked = true;
            setTimeout(function () {
                state.cards[idx1].matched = true;
                state.cards[idx2].matched = true;
                markMatchedDOM(idx1);
                markMatchedDOM(idx2);
                state.pairsFound++;

                // Score
                if (state.mode === 2) {
                    state.scores[state.currentPlayer - 1]++;
                    updatePlayerScores();
                } else {
                    updateSoloStats();
                }

                CGameAudio.play('score');
                state.flippedIndices = [];
                state.locked = false;

                // Check game over
                if (state.pairsFound === state.totalPairs) {
                    onGameComplete();
                }
                // In match: current player gets another turn (no turn switch)
            }, 300);
        } else {
            // No match
            state.locked = true;
            var el1 = grid.children[idx1];
            var el2 = grid.children[idx2];
            if (el1) el1.classList.add('no-match');
            if (el2) el2.classList.add('no-match');

            setTimeout(function () {
                CGameAudio.play('error');
            }, 200);

            setTimeout(function () {
                state.cards[idx1].flipped = false;
                state.cards[idx2].flipped = false;
                flipCardDOM(idx1, false);
                flipCardDOM(idx2, false);
                if (el1) el1.classList.remove('no-match');
                if (el2) el2.classList.remove('no-match');
                state.flippedIndices = [];
                state.locked = false;

                // Switch turn in 2P
                if (state.mode === 2) {
                    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
                    updateTurnIndicator();
                    updatePlayerScores();
                } else {
                    updateSoloStats();
                }
            }, FLIP_DELAY);
        }
    }

    function markMatchedDOM(index) {
        var cardEl = grid.children[index];
        if (!cardEl) return;
        cardEl.classList.add('matched');
        cardEl.classList.add('match-anim');
        cardEl.addEventListener('animationend', function () {
            cardEl.classList.remove('match-anim');
        }, { once: true });
    }

    // --- Turn & Score Display ---

    function updateTurnIndicator() {
        turnIndicator.className = 'turn-indicator';
        if (state.currentPlayer === 1) {
            turnIndicator.classList.add('p1-turn');
            turnIndicator.textContent = 'Player 1\'s Turn';
        } else {
            turnIndicator.classList.add('p2-turn');
            turnIndicator.textContent = 'Player 2\'s Turn';
        }
    }

    function updatePlayerScores() {
        p1Score.textContent = state.scores[0];
        p2Score.textContent = state.scores[1];

        p1Panel.classList.toggle('active-turn', state.currentPlayer === 1);
        p2Panel.classList.toggle('active-turn', state.currentPlayer === 2);
    }

    function updateSoloStats() {
        statMoves.textContent = 'Moves: ' + state.moves;
        statPairs.textContent = 'Pairs: ' + state.pairsFound + '/' + state.totalPairs;
    }

    // --- Timer (1P mode) ---

    function startTimer() {
        stopTimer();
        state.startTime = Date.now();
        state.elapsed = 0;
        updateTimerDisplay();
        state.timerInterval = setInterval(function () {
            state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        var mins = Math.floor(state.elapsed / 60);
        var secs = state.elapsed % 60;
        statTime.textContent = 'Time: ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    function formatTime(seconds) {
        var mins = Math.floor(seconds / 60);
        var secs = seconds % 60;
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // --- Game Complete ---

    function onGameComplete() {
        stopTimer();
        grid.classList.add('complete');

        setTimeout(function () {
            CGameAudio.play('win');
        }, 300);

        setTimeout(function () {
            showGameOver();
        }, 1000);
    }

    function showGameOver() {
        grid.classList.remove('complete');

        if (state.mode === 1) {
            // Solo mode
            gameoverTitle.textContent = 'Well Done!';

            var html = '';
            html += '<div class="stat-row"><span class="stat-label">Moves</span><span class="stat-value">' + state.moves + '</span></div>';
            html += '<div class="stat-row"><span class="stat-label">Time</span><span class="stat-value">' + formatTime(state.elapsed) + '</span></div>';
            html += '<div class="stat-row"><span class="stat-label">Pairs</span><span class="stat-value">' + state.totalPairs + '</span></div>';

            // Calculate a simple star rating
            var perfectMoves = state.totalPairs;
            var ratio = state.moves / perfectMoves;
            var stars = '';
            if (ratio <= 1.5) {
                stars = '\u2B50\u2B50\u2B50';
            } else if (ratio <= 2.5) {
                stars = '\u2B50\u2B50';
            } else {
                stars = '\u2B50';
            }
            html += '<div class="stat-row"><span class="stat-label">Rating</span><span class="stat-value">' + stars + '</span></div>';
            gameoverStats.innerHTML = html;

            // Save score
            GameShell.addScore({
                game: 'memory',
                score: state.totalPairs * 1000 - state.moves * 50 - state.elapsed * 10,
                detail: state.moves + ' moves, ' + formatTime(state.elapsed)
            });
        } else {
            // 2P mode
            var p1 = state.scores[0];
            var p2 = state.scores[1];

            var html = '';

            if (p1 > p2) {
                html += '<div class="winner-text p1-win">Player 1 Wins!</div>';
                gameoverTitle.textContent = 'Player 1 Wins!';
            } else if (p2 > p1) {
                html += '<div class="winner-text p2-win">Player 2 Wins!</div>';
                gameoverTitle.textContent = 'Player 2 Wins!';
            } else {
                html += '<div class="winner-text draw">It\'s a Draw!</div>';
                gameoverTitle.textContent = 'It\'s a Draw!';
            }

            html += '<div class="stat-row"><span class="stat-label p1-label">Player 1</span><span class="stat-value">' + p1 + ' pairs</span></div>';
            html += '<div class="stat-row"><span class="stat-label p2-label">Player 2</span><span class="stat-value">' + p2 + ' pairs</span></div>';
            html += '<div class="stat-row"><span class="stat-label">Total Moves</span><span class="stat-value">' + state.moves + '</span></div>';
            gameoverStats.innerHTML = html;
        }

        GameShell.showScreen('gameover-screen');
    }

})();
