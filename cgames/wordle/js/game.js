/* === Wordle Game Engine === */
(function () {
    'use strict';

    // ── Word list registry ──
    var WORD_LISTS = {
        4: WORDS_4,
        5: WORDS_5,
        6: WORDS_6,
        7: WORDS_7,
        8: WORDS_8
    };

    // ── Scoring tables ──
    var GUESS_POINTS = [0, 1000, 800, 600, 400, 250, 100];
    var TIME_BONUS = [[30, 200], [60, 100], [120, 50]];
    var LENGTH_MULT = { 4: 0.8, 5: 1.0, 6: 1.2, 7: 1.5, 8: 2.0 };
    var MAX_GUESSES = 6;

    // ── Game state ──
    var state = {
        mode: null,         // 'normal','custom','race','shared','hints'
        wordLength: 5,
        answer: '',
        // Per-board state (board 0 = P1 / main, board 1 = P2 for race)
        boards: [],
        gameOver: false,
        startTime: 0,
        timerInterval: null,
        elapsed: 0,
        // Shared-guesses turn
        currentPlayer: 1,   // 1 or 2
        // Hints mode
        hintGiverActive: false,
        hints: [],
        // Race mode: track which board has rightShift
        raceP2Shift: false
    };

    // ── DOM references ──
    var $gridP1, $gridP2, $boardP2, $labelP1, $labelP2, $boards;
    var $turnIndicator, $hintArea, $hintGiverView, $hintDisplay;
    var $hintMessages, $hintSecretWord, $hintTextInput;
    var $timer, $modeLabel, $keyboard;

    // ── Initialization ──
    GameShell.init({ backUrl: '../' });

    document.addEventListener('DOMContentLoaded', function () {
        $gridP1 = document.getElementById('grid-p1');
        $gridP2 = document.getElementById('grid-p2');
        $boardP2 = document.getElementById('board-p2');
        $labelP1 = document.getElementById('label-p1');
        $labelP2 = document.getElementById('label-p2');
        $boards = document.getElementById('boards-container');
        $turnIndicator = document.getElementById('turn-indicator');
        $hintArea = document.getElementById('hint-area');
        $hintGiverView = document.getElementById('hint-giver-view');
        $hintDisplay = document.getElementById('hint-display');
        $hintMessages = document.getElementById('hint-messages');
        $hintSecretWord = document.getElementById('hint-secret-word');
        $hintTextInput = document.getElementById('hint-text-input');
        $timer = document.getElementById('game-timer');
        $modeLabel = document.getElementById('game-mode-label');
        $keyboard = document.getElementById('keyboard');

        bindMenuEvents();
        bindGameEvents();
    });

    // ── Menu navigation ──
    function bindMenuEvents() {
        // Mode buttons
        var modeButtons = document.querySelectorAll('[data-mode]');
        modeButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                CGameAudio.play('click');
                state.mode = btn.getAttribute('data-mode');
                if (state.mode === 'custom') {
                    GameShell.showScreen('custom-screen');
                } else {
                    GameShell.showScreen('length-screen');
                }
            });
        });

        // Length buttons
        var lengthButtons = document.querySelectorAll('.length-btn');
        lengthButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                CGameAudio.play('click');
                state.wordLength = parseInt(btn.getAttribute('data-length'));
                startGame();
            });
        });

        // Back buttons
        document.getElementById('btn-length-back').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('menu-screen');
        });

        document.getElementById('btn-custom-back').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('menu-screen');
        });

        document.getElementById('btn-help-back').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('menu-screen');
        });

        document.getElementById('btn-game-back').addEventListener('click', function () {
            CGameAudio.play('back');
            stopTimer();
            GameShell.showScreen('menu-screen');
        });

        document.getElementById('btn-how-to-play').addEventListener('click', function () {
            CGameAudio.play('click');
            GameShell.showScreen('help-screen');
        });

        // Custom word start
        document.getElementById('btn-custom-start').addEventListener('click', function () {
            var input = document.getElementById('custom-word-input');
            var word = input.value.toUpperCase().trim();
            if (word.length < 4 || word.length > 8) {
                GameShell.showToast('Word must be 4-8 letters');
                CGameAudio.play('error');
                return;
            }
            if (!/^[A-Z]+$/.test(word)) {
                GameShell.showToast('Letters only!');
                CGameAudio.play('error');
                return;
            }
            state.wordLength = word.length;
            state.answer = word;
            input.value = '';
            CGameAudio.play('click');
            // Show pass screen
            document.getElementById('pass-message').textContent = 'Pass the device to Player 2';
            GameShell.showScreen('pass-screen');
        });

        // Custom word input hint
        var customInput = document.getElementById('custom-word-input');
        customInput.addEventListener('input', function () {
            var hint = document.getElementById('custom-hint');
            var len = customInput.value.length;
            if (len === 0) {
                hint.textContent = '';
            } else if (len < 4) {
                hint.textContent = len + ' letters (min 4)';
            } else {
                hint.textContent = len + ' letters';
            }
        });

        // Pass device ready
        document.getElementById('btn-pass-ready').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame();
        });

        // Results buttons
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('click');
            if (state.mode === 'custom') {
                GameShell.showScreen('custom-screen');
            } else {
                startGame();
            }
        });

        document.getElementById('btn-back-menu').addEventListener('click', function () {
            CGameAudio.play('back');
            GameShell.showScreen('menu-screen');
        });

        // Hint mode buttons
        document.getElementById('btn-send-hint').addEventListener('click', sendHint);
        document.getElementById('btn-toggle-view').addEventListener('click', toggleHintView);

        $hintTextInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendHint();
            }
            e.stopPropagation();
        });
    }

    // ── Start a new game ──
    function startGame() {
        // Pick answer if not custom
        if (state.mode !== 'custom' || !state.answer) {
            var list = WORD_LISTS[state.wordLength];
            state.answer = list.answers[Math.floor(Math.random() * list.answers.length)];
        }

        // Reset state
        state.gameOver = false;
        state.elapsed = 0;
        state.currentPlayer = 1;
        state.hintGiverActive = false;
        state.hints = [];
        state.raceP2Shift = false;

        // Setup boards
        state.boards = [];
        var boardCount = (state.mode === 'race') ? 2 : 1;
        for (var b = 0; b < boardCount; b++) {
            state.boards.push({
                guesses: [],
                currentGuess: '',
                currentRow: 0,
                solved: false,
                failed: false,
                keyStates: {}  // letter -> 'correct'|'present'|'absent'
            });
        }

        // Setup mode label
        var modeNames = {
            normal: 'Wordle',
            custom: 'Custom',
            race: '2P Race',
            shared: '2P Shared',
            hints: '2P Hints'
        };
        $modeLabel.textContent = modeNames[state.mode] || 'Wordle';

        // Setup layout
        setupLayout();
        buildGrids();
        resetKeyboard();

        // Mode-specific setup
        setupModeUI();

        // Show game screen and start timer
        GameShell.showScreen('game-screen');
        startTimer();
    }

    function setupLayout() {
        var isRace = (state.mode === 'race');

        $boards.setAttribute('data-length', state.wordLength);
        $boards.classList.toggle('split-view', isRace);

        $boardP2.classList.toggle('hidden', !isRace);
        $labelP1.classList.toggle('hidden', !isRace);

        // Clear won/lost classes from previous games
        document.getElementById('board-p1').classList.remove('won', 'lost');
        document.getElementById('board-p2').classList.remove('won', 'lost');

        $turnIndicator.classList.add('hidden');
        $turnIndicator.classList.remove('p1-turn', 'p2-turn');

        $hintArea.classList.add('hidden');
        $hintGiverView.classList.add('hidden');
    }

    function setupModeUI() {
        if (state.mode === 'shared') {
            $turnIndicator.classList.remove('hidden');
            updateTurnIndicator();
        }

        if (state.mode === 'hints') {
            $hintArea.classList.remove('hidden');
            $hintMessages.innerHTML = '';
            $hintSecretWord.textContent = state.answer;
            // Start in guesser view by default
            state.hintGiverActive = false;
            $hintGiverView.classList.add('hidden');
            document.getElementById('btn-toggle-view').textContent = 'Switch to Giver View';
        }
    }

    function updateTurnIndicator() {
        $turnIndicator.classList.remove('p1-turn', 'p2-turn');
        if (state.currentPlayer === 1) {
            $turnIndicator.textContent = 'Player 1\'s Turn';
            $turnIndicator.classList.add('p1-turn');
        } else {
            $turnIndicator.textContent = 'Player 2\'s Turn';
            $turnIndicator.classList.add('p2-turn');
        }
    }

    // ── Grid building ──
    function buildGrids() {
        buildGrid($gridP1, 0);
        if (state.mode === 'race') {
            buildGrid($gridP2, 1);
        } else {
            $gridP2.innerHTML = '';
        }
    }

    function buildGrid(container, boardIndex) {
        container.innerHTML = '';
        for (var r = 0; r < MAX_GUESSES; r++) {
            var row = document.createElement('div');
            row.className = 'tile-row';
            row.setAttribute('data-row', r);
            for (var c = 0; c < state.wordLength; c++) {
                var tile = document.createElement('div');
                tile.className = 'tile';
                tile.setAttribute('data-col', c);
                row.appendChild(tile);
            }
            container.appendChild(row);
        }
    }

    // ── Keyboard ──
    function resetKeyboard() {
        var keys = $keyboard.querySelectorAll('.key');
        keys.forEach(function (k) {
            k.classList.remove('correct', 'present', 'absent');
        });
    }

    function updateKeyboard(boardIndex) {
        if (boardIndex === undefined) boardIndex = 0;
        // In race mode, update keyboard for P1 board only (the on-screen keyboard belongs to P1)
        var ks = state.boards[boardIndex].keyStates;
        var keys = $keyboard.querySelectorAll('.key');
        keys.forEach(function (k) {
            var letter = k.getAttribute('data-key');
            if (letter && letter.length === 1 && ks[letter]) {
                k.classList.remove('correct', 'present', 'absent');
                k.classList.add(ks[letter]);
            }
        });
    }

    // ── Input handling ──
    function bindGameEvents() {
        // Physical keyboard
        document.addEventListener('keydown', handleKeydown);

        // On-screen keyboard
        $keyboard.addEventListener('click', function (e) {
            var keyEl = e.target.closest('.key');
            if (!keyEl) return;
            var key = keyEl.getAttribute('data-key');
            if (key) {
                processInput(key, 0); // on-screen keyboard always controls board 0
            }
        });
    }

    function handleKeydown(e) {
        // Don't intercept if typing in hint input or custom word input
        if (e.target.tagName === 'INPUT') return;
        if (state.gameOver) return;

        var activeScreen = document.querySelector('.screen.active');
        if (!activeScreen || activeScreen.id !== 'game-screen') return;

        var key = e.key.toUpperCase();

        if (state.mode === 'race') {
            // In race mode: P1 types normally, P2 holds Right Shift
            // Ignore the shift key press itself
            if (e.key === 'Shift') return;

            // Determine target board based on right shift state
            var targetBoard = state.raceP2Shift ? 1 : 0;

            // Extract the letter from the key code when shift is held
            // (e.key with shift may give uppercase anyway, which is fine)
            var raceKey = key;
            if (state.raceP2Shift && e.code && e.code.startsWith('Key')) {
                raceKey = e.code.charAt(3); // KeyA -> A
            }

            if (raceKey === 'ENTER' || key === 'ENTER') {
                e.preventDefault();
                processInput('ENTER', targetBoard);
            } else if (raceKey === 'BACKSPACE' || key === 'BACKSPACE' || key === 'DELETE') {
                e.preventDefault();
                processInput('BACKSPACE', targetBoard);
            } else if (/^[A-Z]$/.test(raceKey)) {
                e.preventDefault();
                processInput(raceKey, targetBoard);
            }
            return;
        }

        // Normal keyboard handling for all other modes
        if (key === 'ENTER') {
            e.preventDefault();
            processInput('ENTER', 0);
        } else if (key === 'BACKSPACE' || key === 'DELETE') {
            e.preventDefault();
            processInput('BACKSPACE', 0);
        } else if (/^[A-Z]$/.test(key)) {
            e.preventDefault();
            processInput(key, 0);
        }
    }

    // Track right shift state for race mode
    document.addEventListener('keydown', function (e) {
        if (e.code === 'ShiftRight') {
            state.raceP2Shift = true;
        }
    });
    document.addEventListener('keyup', function (e) {
        if (e.code === 'ShiftRight') {
            state.raceP2Shift = false;
        }
    });

    function processInput(key, boardIndex) {
        if (state.gameOver) return;

        var board = state.boards[boardIndex];
        if (!board || board.solved || board.failed) return;

        // In hints mode and giver view is active, don't process board input
        if (state.mode === 'hints' && state.hintGiverActive) return;

        if (key === 'ENTER') {
            submitGuess(boardIndex);
        } else if (key === 'BACKSPACE') {
            deleteLetter(boardIndex);
        } else if (/^[A-Z]$/.test(key) && board.currentGuess.length < state.wordLength) {
            addLetter(key, boardIndex);
        }
    }

    function addLetter(letter, boardIndex) {
        var board = state.boards[boardIndex];
        if (board.currentGuess.length >= state.wordLength) return;

        board.currentGuess += letter;
        var grid = boardIndex === 0 ? $gridP1 : $gridP2;
        var row = grid.querySelectorAll('.tile-row')[board.currentRow];
        var col = board.currentGuess.length - 1;
        var tile = row.children[col];
        tile.textContent = letter;
        tile.classList.add('filled');

        CGameAudio.play('pop');
    }

    function deleteLetter(boardIndex) {
        var board = state.boards[boardIndex];
        if (board.currentGuess.length === 0) return;

        var grid = boardIndex === 0 ? $gridP1 : $gridP2;
        var row = grid.querySelectorAll('.tile-row')[board.currentRow];
        var col = board.currentGuess.length - 1;
        var tile = row.children[col];
        tile.textContent = '';
        tile.classList.remove('filled');

        board.currentGuess = board.currentGuess.slice(0, -1);
        CGameAudio.play('click');
    }

    // ── Guess submission ──
    function submitGuess(boardIndex) {
        var board = state.boards[boardIndex];
        var guess = board.currentGuess;

        if (guess.length !== state.wordLength) {
            shakeRow(boardIndex, board.currentRow);
            GameShell.showToast('Not enough letters');
            CGameAudio.play('error');
            return;
        }

        // Validate word (skip validation for custom mode)
        if (state.mode !== 'custom') {
            var list = WORD_LISTS[state.wordLength];
            if (!list.valid.has(guess)) {
                shakeRow(boardIndex, board.currentRow);
                GameShell.showToast('Not in word list');
                CGameAudio.play('error');
                return;
            }
        }

        // Evaluate guess
        var result = evaluateGuess(guess, state.answer);
        board.guesses.push({ word: guess, result: result });

        // Animate reveal
        revealRow(boardIndex, board.currentRow, result, function () {
            // Update key states
            for (var i = 0; i < guess.length; i++) {
                var letter = guess[i];
                var grade = result[i];
                var current = board.keyStates[letter];
                if (grade === 'correct') {
                    board.keyStates[letter] = 'correct';
                } else if (grade === 'present' && current !== 'correct') {
                    board.keyStates[letter] = 'present';
                } else if (!current) {
                    board.keyStates[letter] = 'absent';
                }
            }

            // Update on-screen keyboard (use board 0 for single-board modes)
            if (state.mode === 'race') {
                // In race mode, merge both boards' key states for the keyboard
                updateKeyboard(0);
            } else {
                updateKeyboard(0);
            }

            // Check win/loss
            var won = guess === state.answer;
            if (won) {
                board.solved = true;
                bounceRow(boardIndex, board.currentRow);
                CGameAudio.play('win');
            }

            board.currentRow++;
            board.currentGuess = '';

            if (board.currentRow >= MAX_GUESSES && !board.solved) {
                board.failed = true;
                CGameAudio.play('lose');
            }

            // Mode-specific post-guess logic
            handlePostGuess(boardIndex, won);
        });
    }

    function handlePostGuess(boardIndex, won) {
        switch (state.mode) {
            case 'normal':
            case 'custom':
                if (won || state.boards[0].failed) {
                    endGame();
                }
                break;

            case 'race':
                // Check if both boards are done or either won
                var b0 = state.boards[0];
                var b1 = state.boards[1];
                var bp1 = document.getElementById('board-p1');
                var bp2 = document.getElementById('board-p2');

                if (b0.solved) bp1.classList.add('won');
                if (b0.failed) bp1.classList.add('lost');
                if (b1.solved) bp2.classList.add('won');
                if (b1.failed) bp2.classList.add('lost');

                if ((b0.solved || b0.failed) && (b1.solved || b1.failed)) {
                    endGame();
                } else if (b0.solved && !b1.solved && !b1.failed) {
                    // P1 won first, let P2 continue or end
                    // Actually in race, first to solve wins
                    endGame();
                } else if (b1.solved && !b0.solved && !b0.failed) {
                    endGame();
                }
                break;

            case 'shared':
                if (won || state.boards[0].failed) {
                    endGame();
                } else {
                    // Alternate turns
                    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
                    updateTurnIndicator();
                }
                break;

            case 'hints':
                if (won || state.boards[0].failed) {
                    endGame();
                }
                break;
        }
    }

    // ── Two-pass guess evaluation ──
    function evaluateGuess(guess, answer) {
        var result = new Array(guess.length);
        var answerChars = answer.split('');
        var guessChars = guess.split('');

        // Pass 1: mark greens
        for (var i = 0; i < guessChars.length; i++) {
            if (guessChars[i] === answerChars[i]) {
                result[i] = 'correct';
                answerChars[i] = null;
                guessChars[i] = null;
            }
        }

        // Pass 2: mark yellows
        for (var j = 0; j < guessChars.length; j++) {
            if (guessChars[j] === null) continue;
            var idx = answerChars.indexOf(guessChars[j]);
            if (idx !== -1) {
                result[j] = 'present';
                answerChars[idx] = null;
            } else {
                result[j] = 'absent';
            }
        }

        return result;
    }

    // ── Tile animations ──
    function revealRow(boardIndex, rowIdx, result, callback) {
        var grid = boardIndex === 0 ? $gridP1 : $gridP2;
        var row = grid.querySelectorAll('.tile-row')[rowIdx];
        var tiles = row.children;
        var count = tiles.length;
        var done = 0;

        for (var i = 0; i < count; i++) {
            (function (idx) {
                setTimeout(function () {
                    var tile = tiles[idx];
                    tile.classList.add('flip');

                    setTimeout(function () {
                        tile.classList.remove('filled');
                        tile.classList.add(result[idx]);
                        CGameAudio.play('score');
                    }, 150);

                    tile.addEventListener('animationend', function onEnd() {
                        tile.removeEventListener('animationend', onEnd);
                        done++;
                        if (done === count && callback) {
                            callback();
                        }
                    });
                }, idx * 200);
            })(i);
        }
    }

    function shakeRow(boardIndex, rowIdx) {
        var grid = boardIndex === 0 ? $gridP1 : $gridP2;
        var row = grid.querySelectorAll('.tile-row')[rowIdx];
        row.classList.add('shake');
        row.addEventListener('animationend', function () {
            row.classList.remove('shake');
        }, { once: true });
    }

    function bounceRow(boardIndex, rowIdx) {
        var grid = boardIndex === 0 ? $gridP1 : $gridP2;
        var row = grid.querySelectorAll('.tile-row')[rowIdx];
        var tiles = row.children;
        for (var i = 0; i < tiles.length; i++) {
            (function (idx) {
                setTimeout(function () {
                    tiles[idx].classList.add('bounce');
                }, idx * 80);
            })(i);
        }
    }

    // ── Timer ──
    function startTimer() {
        state.startTime = Date.now();
        state.elapsed = 0;
        $timer.textContent = '0:00';
        stopTimer();
        state.timerInterval = setInterval(function () {
            state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            var min = Math.floor(state.elapsed / 60);
            var sec = state.elapsed % 60;
            $timer.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
        }, 250);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    // ── Hint mode functions ──
    function sendHint() {
        var text = $hintTextInput.value.trim();
        if (!text) return;

        state.hints.push(text);
        var msg = document.createElement('div');
        msg.className = 'hint-msg';
        msg.textContent = 'Hint: ' + text;
        $hintMessages.appendChild(msg);
        $hintMessages.scrollTop = $hintMessages.scrollHeight;
        $hintTextInput.value = '';
        CGameAudio.play('click');
    }

    function toggleHintView() {
        state.hintGiverActive = !state.hintGiverActive;
        var btn = document.getElementById('btn-toggle-view');
        if (state.hintGiverActive) {
            $hintGiverView.classList.remove('hidden');
            btn.textContent = 'Switch to Guesser View';
        } else {
            $hintGiverView.classList.add('hidden');
            btn.textContent = 'Switch to Giver View';
        }
        CGameAudio.play('click');
    }

    // ── End game & scoring ──
    function endGame() {
        state.gameOver = true;
        stopTimer();

        // Small delay before showing results
        setTimeout(function () {
            showResults();
        }, 800);
    }

    function calcScore(board) {
        if (!board.solved) return 0;
        var guessCount = board.guesses.length;
        var base = GUESS_POINTS[Math.min(guessCount, 6)];
        var timeBonus = 0;
        for (var i = 0; i < TIME_BONUS.length; i++) {
            if (state.elapsed < TIME_BONUS[i][0]) {
                timeBonus = TIME_BONUS[i][1];
                break;
            }
        }
        var mult = LENGTH_MULT[state.wordLength] || 1.0;
        return Math.round((base + timeBonus) * mult);
    }

    function showResults() {
        var $title = document.getElementById('results-title');
        var $word = document.getElementById('results-word');
        var $breakdown = document.getElementById('results-breakdown');
        var $twoP = document.getElementById('results-2p');

        $word.innerHTML = 'The word was: <strong>' + state.answer + '</strong>';
        $breakdown.innerHTML = '';
        $twoP.innerHTML = '';
        $twoP.classList.add('hidden');

        if (state.mode === 'race') {
            showRaceResults($title, $breakdown, $twoP);
        } else if (state.mode === 'shared') {
            showSharedResults($title, $breakdown);
        } else {
            showSoloResults($title, $breakdown);
        }

        GameShell.showScreen('results-screen');
    }

    function showSoloResults($title, $breakdown) {
        var board = state.boards[0];
        if (board.solved) {
            $title.textContent = 'You Won!';
            $title.style.color = 'var(--success)';
        } else {
            $title.textContent = 'Game Over';
            $title.style.color = 'var(--danger)';
        }

        var score = calcScore(board);
        var guessCount = board.solved ? board.guesses.length : '-';
        var base = board.solved ? GUESS_POINTS[Math.min(board.guesses.length, 6)] : 0;
        var timeBonus = 0;
        if (board.solved) {
            for (var i = 0; i < TIME_BONUS.length; i++) {
                if (state.elapsed < TIME_BONUS[i][0]) {
                    timeBonus = TIME_BONUS[i][1];
                    break;
                }
            }
        }
        var mult = LENGTH_MULT[state.wordLength] || 1.0;

        $breakdown.innerHTML =
            resultRow('Guesses', guessCount + '/6') +
            resultRow('Time', formatTime(state.elapsed)) +
            resultRow('Base Points', base) +
            resultRow('Time Bonus', '+' + timeBonus) +
            resultRow('Length Multiplier', 'x' + mult) +
            resultRow('Total Score', score, true);

        if (board.solved) {
            GameShell.addScore({ game: 'wordle', score: score, date: Date.now() });
        }
    }

    function showRaceResults($title, $breakdown, $twoP) {
        var b0 = state.boards[0];
        var b1 = state.boards[1];
        var s0 = calcScore(b0);
        var s1 = calcScore(b1);

        $twoP.classList.remove('hidden');

        var winner = '';
        if (b0.solved && !b1.solved) {
            winner = 'Player 1 Wins!';
            $title.style.color = 'var(--p1-color)';
        } else if (b1.solved && !b0.solved) {
            winner = 'Player 2 Wins!';
            $title.style.color = 'var(--p2-color)';
        } else if (b0.solved && b1.solved) {
            if (b0.guesses.length < b1.guesses.length) {
                winner = 'Player 1 Wins!';
                $title.style.color = 'var(--p1-color)';
            } else if (b1.guesses.length < b0.guesses.length) {
                winner = 'Player 2 Wins!';
                $title.style.color = 'var(--p2-color)';
            } else {
                winner = 'It\'s a Tie!';
                $title.style.color = 'var(--accent)';
            }
        } else {
            winner = 'Nobody Won!';
            $title.style.color = 'var(--danger)';
        }

        $title.textContent = winner;
        $breakdown.innerHTML = '';

        $twoP.innerHTML =
            '<div class="player-result"><h3 class="p1-label">Player 1</h3>' +
            resultRow('Guesses', (b0.solved ? b0.guesses.length : '-') + '/6') +
            resultRow('Score', s0) +
            '</div>' +
            '<div class="player-result"><h3 class="p2-label">Player 2</h3>' +
            resultRow('Guesses', (b1.solved ? b1.guesses.length : '-') + '/6') +
            resultRow('Score', s1) +
            '</div>';
    }

    function showSharedResults($title, $breakdown) {
        var board = state.boards[0];
        if (board.solved) {
            // Determine who made the winning guess
            var winningPlayer = board.guesses.length % 2 === 1 ? 1 : 2;
            $title.textContent = 'Player ' + winningPlayer + ' solved it!';
            $title.style.color = winningPlayer === 1 ? 'var(--p1-color)' : 'var(--p2-color)';
        } else {
            $title.textContent = 'Game Over';
            $title.style.color = 'var(--danger)';
        }

        var score = calcScore(board);
        var guessCount = board.solved ? board.guesses.length : '-';

        $breakdown.innerHTML =
            resultRow('Total Guesses', guessCount + '/6') +
            resultRow('Time', formatTime(state.elapsed)) +
            resultRow('Team Score', score, true);
    }

    function resultRow(label, value, isTotal) {
        var cls = isTotal ? 'result-row result-total' : 'result-row';
        return '<div class="' + cls + '">' +
            '<span class="result-label">' + label + '</span>' +
            '<span class="result-value">' + value + '</span>' +
            '</div>';
    }

    function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

})();
