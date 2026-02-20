/* === 2048 Game Logic === */
(function () {
    'use strict';

    // =====================================================================
    // Seeded RNG (Lehmer / Park-Miller) for fair 2P play
    // =====================================================================
    function SeededRNG(seed) {
        this.seed = seed & 0x7fffffff;
        if (this.seed === 0) this.seed = 1;
    }
    SeededRNG.prototype.next = function () {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    };

    // =====================================================================
    // Tile object
    // =====================================================================
    var tileUID = 0;
    function Tile(r, c, value) {
        this.id = ++tileUID;
        this.r = r;
        this.c = c;
        this.value = value;
        this.prevR = r;
        this.prevC = c;
        this.mergedFrom = null; // array of two tiles that merged into this
        this.isNew = true;
    }

    // =====================================================================
    // Board class - one 4x4 grid
    // =====================================================================
    function Board(rng) {
        this.size = 4;
        this.tiles = [];   // flat list of active Tile objects
        this.score = 0;
        this.bestTile = 0;
        this.won = false;
        this.over = false;
        this.rng = rng || null;
    }

    Board.prototype.eachCell = function (fn) {
        for (var r = 0; r < 4; r++) {
            for (var c = 0; c < 4; c++) {
                fn(r, c, this.cellAt(r, c));
            }
        }
    };

    Board.prototype.cellAt = function (r, c) {
        for (var i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i].r === r && this.tiles[i].c === c) return this.tiles[i];
        }
        return null;
    };

    Board.prototype.availableCells = function () {
        var avail = [];
        for (var r = 0; r < 4; r++) {
            for (var c = 0; c < 4; c++) {
                if (!this.cellAt(r, c)) avail.push({ r: r, c: c });
            }
        }
        return avail;
    };

    Board.prototype.addRandomTile = function () {
        var avail = this.availableCells();
        if (avail.length === 0) return null;
        var rand1 = this.rng ? this.rng.next() : Math.random();
        var idx = Math.floor(rand1 * avail.length);
        var cell = avail[idx];
        var rand2 = this.rng ? this.rng.next() : Math.random();
        var value = rand2 < 0.9 ? 2 : 4;
        var tile = new Tile(cell.r, cell.c, value);
        this.tiles.push(tile);
        if (value > this.bestTile) this.bestTile = value;
        return tile;
    };

    Board.prototype.prepareTiles = function () {
        // Before a move, mark all tiles as not-new, store previous positions
        for (var i = 0; i < this.tiles.length; i++) {
            var t = this.tiles[i];
            t.isNew = false;
            t.mergedFrom = null;
            t.prevR = t.r;
            t.prevC = t.c;
        }
    };

    Board.prototype.canMove = function () {
        if (this.availableCells().length > 0) return true;
        for (var r = 0; r < 4; r++) {
            for (var c = 0; c < 4; c++) {
                var t = this.cellAt(r, c);
                if (!t) continue;
                // Check right and down neighbors
                if (c < 3) {
                    var right = this.cellAt(r, c + 1);
                    if (right && right.value === t.value) return true;
                }
                if (r < 3) {
                    var down = this.cellAt(r + 1, c);
                    if (down && down.value === t.value) return true;
                }
            }
        }
        return false;
    };

    // direction: 0=up, 1=right, 2=down, 3=left
    Board.prototype.move = function (direction) {
        var self = this;
        var moved = false;
        var mergeScore = 0;

        var vectors = [
            { dr: -1, dc: 0 },  // up
            { dr: 0, dc: 1 },   // right
            { dr: 1, dc: 0 },   // down
            { dr: 0, dc: -1 }   // left
        ];
        var vec = vectors[direction];

        // Build traversal order
        var rows = [0, 1, 2, 3];
        var cols = [0, 1, 2, 3];
        if (direction === 2) rows = [3, 2, 1, 0];
        if (direction === 1) cols = [3, 2, 1, 0];

        this.prepareTiles();

        var mergedFlags = {}; // "r,c" -> true if cell already received a merge

        for (var ri = 0; ri < 4; ri++) {
            for (var ci = 0; ci < 4; ci++) {
                var r = rows[ri];
                var c = cols[ci];
                var tile = this.cellAt(r, c);
                if (!tile) continue;

                // Find farthest available position
                var destR = r, destC = c;
                var nextR = r + vec.dr, nextC = c + vec.dc;
                while (nextR >= 0 && nextR < 4 && nextC >= 0 && nextC < 4) {
                    var nextTile = this.cellAt(nextR, nextC);
                    if (!nextTile) {
                        destR = nextR;
                        destC = nextC;
                        nextR += vec.dr;
                        nextC += vec.dc;
                    } else if (nextTile.value === tile.value && !mergedFlags[nextR + ',' + nextC]) {
                        // Can merge
                        destR = nextR;
                        destC = nextC;
                        break;
                    } else {
                        break;
                    }
                }

                if (destR === r && destC === c) continue; // Didn't move

                var target = this.cellAt(destR, destC);
                if (target && target.value === tile.value && !mergedFlags[destR + ',' + destC]) {
                    // Merge
                    var newValue = tile.value * 2;
                    var merged = new Tile(destR, destC, newValue);
                    merged.isNew = false;
                    merged.mergedFrom = [tile, target];
                    merged.prevR = tile.r; // animate from tile's original position
                    merged.prevC = tile.c;

                    // Remove old tiles
                    this.tiles = this.tiles.filter(function (t) {
                        return t.id !== tile.id && t.id !== target.id;
                    });
                    this.tiles.push(merged);

                    mergedFlags[destR + ',' + destC] = true;
                    mergeScore += newValue;
                    if (newValue > this.bestTile) this.bestTile = newValue;
                    moved = true;
                } else {
                    // Just slide
                    tile.r = destR;
                    tile.c = destC;
                    moved = true;
                }
            }
        }

        if (moved) {
            this.score += mergeScore;
        }

        return { moved: moved, mergeScore: mergeScore };
    };

    // =====================================================================
    // Renderer - manages tile DOM elements with animations
    // =====================================================================
    function Renderer(tileLayerId, containerEl) {
        this.layer = document.getElementById(tileLayerId);
        this.container = containerEl;
        this.elements = {}; // tileId -> DOM element
    }

    Renderer.prototype.getMetrics = function () {
        var rect = this.container.getBoundingClientRect();
        var w = rect.width;
        var gap = w <= 300 ? 5 : (w <= 420 ? 7 : 10);
        var cellSize = (w - gap * 5) / 4;
        return { gap: gap, cellSize: cellSize };
    };

    Renderer.prototype.posForCell = function (r, c) {
        var m = this.getMetrics();
        return {
            left: m.gap + c * (m.cellSize + m.gap),
            top: m.gap + r * (m.cellSize + m.gap),
            size: m.cellSize
        };
    };

    Renderer.prototype.render = function (board) {
        var self = this;
        var m = this.getMetrics();
        var usedIds = {};

        board.tiles.forEach(function (tile) {
            usedIds[tile.id] = true;
            var el = self.elements[tile.id];

            if (!el) {
                // New element
                el = document.createElement('div');
                el.className = 'tile';
                self.layer.appendChild(el);
                self.elements[tile.id] = el;

                if (tile.mergedFrom) {
                    // Merged tile: place at destination immediately, hidden until ghosts arrive
                    var destPos = self.posForCell(tile.r, tile.c);
                    el.style.width = m.cellSize + 'px';
                    el.style.height = m.cellSize + 'px';
                    el.style.lineHeight = m.cellSize + 'px';
                    el.style.left = destPos.left + 'px';
                    el.style.top = destPos.top + 'px';
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0)';
                    // Reveal with merge pop after slide completes
                    setTimeout(function () {
                        el.style.transition = 'none';
                        el.style.opacity = '1';
                        el.style.transform = 'scale(1)';
                        el.classList.add('tile-merged');
                        // Re-enable transitions after a frame
                        requestAnimationFrame(function () {
                            el.style.transition = '';
                        });
                    }, 120);
                } else if (tile.isNew) {
                    // Brand new spawned tile: pop animation
                    var newPos = self.posForCell(tile.r, tile.c);
                    el.style.width = m.cellSize + 'px';
                    el.style.height = m.cellSize + 'px';
                    el.style.lineHeight = m.cellSize + 'px';
                    el.style.left = newPos.left + 'px';
                    el.style.top = newPos.top + 'px';
                    el.classList.add('tile-new');
                } else {
                    // Sliding tile: start at previous position
                    var fromPos = self.posForCell(tile.prevR, tile.prevC);
                    el.style.width = m.cellSize + 'px';
                    el.style.height = m.cellSize + 'px';
                    el.style.lineHeight = m.cellSize + 'px';
                    el.style.left = fromPos.left + 'px';
                    el.style.top = fromPos.top + 'px';
                }
            }

            // Update value display
            el.textContent = tile.value;
            el.setAttribute('data-value', tile.value);
            var len = String(tile.value).length;
            el.className = 'tile tile-len-' + Math.min(len, 5);
            if (tile.value > 8192) el.classList.add('tile-super');
            if (tile.isNew) el.classList.add('tile-new');
            // Merged class is applied in the timeout above for new merged tiles

            // Update size
            el.style.width = m.cellSize + 'px';
            el.style.height = m.cellSize + 'px';
            el.style.lineHeight = m.cellSize + 'px';

            // Animate to target position (for sliding tiles)
            if (!tile.mergedFrom) {
                var toPos = self.posForCell(tile.r, tile.c);
                requestAnimationFrame(function () {
                    el.style.left = toPos.left + 'px';
                    el.style.top = toPos.top + 'px';
                });
            }
        });

        // Create ghost tiles for merge animations (slide source tiles into merge point)
        board.tiles.forEach(function (tile) {
            if (!tile.mergedFrom) return;
            tile.mergedFrom.forEach(function (source) {
                var ghost = document.createElement('div');
                var slen = String(source.value).length;
                ghost.className = 'tile tile-len-' + Math.min(slen, 5);
                ghost.setAttribute('data-value', source.value);
                ghost.textContent = source.value;
                ghost.style.width = m.cellSize + 'px';
                ghost.style.height = m.cellSize + 'px';
                ghost.style.lineHeight = m.cellSize + 'px';
                var fromPos = self.posForCell(source.prevR, source.prevC);
                ghost.style.left = fromPos.left + 'px';
                ghost.style.top = fromPos.top + 'px';
                ghost.style.zIndex = '0';
                self.layer.appendChild(ghost);

                var toPos = self.posForCell(tile.r, tile.c);
                requestAnimationFrame(function () {
                    ghost.style.left = toPos.left + 'px';
                    ghost.style.top = toPos.top + 'px';
                });

                setTimeout(function () {
                    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
                }, 150);
            });
        });

        // Remove DOM elements for tiles no longer present
        Object.keys(self.elements).forEach(function (id) {
            if (!usedIds[id]) {
                var el = self.elements[id];
                if (el.parentNode) el.parentNode.removeChild(el);
                delete self.elements[id];
            }
        });
    };

    Renderer.prototype.clear = function () {
        this.layer.innerHTML = '';
        this.elements = {};
    };

    // Full re-render (e.g. after resize) - no animations
    Renderer.prototype.renderStatic = function (board) {
        var self = this;
        this.clear();
        var m = this.getMetrics();

        board.tiles.forEach(function (tile) {
            var el = document.createElement('div');
            var len = String(tile.value).length;
            el.className = 'tile tile-len-' + Math.min(len, 5);
            if (tile.value > 8192) el.classList.add('tile-super');
            el.setAttribute('data-value', tile.value);
            el.textContent = tile.value;
            el.style.width = m.cellSize + 'px';
            el.style.height = m.cellSize + 'px';
            el.style.lineHeight = m.cellSize + 'px';
            var pos = self.posForCell(tile.r, tile.c);
            el.style.left = pos.left + 'px';
            el.style.top = pos.top + 'px';
            self.layer.appendChild(el);
            self.elements[tile.id] = el;
        });
    };

    // =====================================================================
    // Game state
    // =====================================================================
    var mode = '1p';
    var board1p = null;
    var boardP1 = null;
    var boardP2 = null;
    var render1p = null;
    var renderP1 = null;
    var renderP2 = null;
    var bestScore = parseInt(localStorage.getItem('2048-best') || '0', 10);
    var inputLocked = false;
    var winShown = false;
    var gameActive = false;
    var p1Locked = false;
    var p2Locked = false;

    // Touch tracking
    var touchStartX = 0, touchStartY = 0;
    var touchPlayerId = 0;

    // =====================================================================
    // Initialization
    // =====================================================================
    function initGame() {
        GameShell.init({ backUrl: '../' });
        updateBestDisplay();
        bindButtons();
        bindInput();
        GameShell.showScreen('title-screen');
    }

    function bindButtons() {
        on('btn-1p', function () {
            CGameAudio.play('select');
            startGame('1p');
        });

        on('btn-2p', function () {
            CGameAudio.play('select');
            startGame('2p');
        });

        on('btn-back-game', function () {
            CGameAudio.play('back');
            gameActive = false;
            GameShell.showScreen('title-screen');
        });

        on('btn-back-game-2p', function () {
            CGameAudio.play('back');
            gameActive = false;
            GameShell.showScreen('title-screen');
        });

        on('btn-restart', function () {
            CGameAudio.play('click');
            startGame('1p');
        });

        on('btn-restart-2p', function () {
            CGameAudio.play('click');
            startGame('2p');
        });

        on('btn-continue', function () {
            CGameAudio.play('click');
            document.getElementById('win-overlay').classList.add('hidden');
            winShown = true;
            inputLocked = false;
        });

        on('btn-win-menu', function () {
            CGameAudio.play('back');
            gameActive = false;
            GameShell.showScreen('title-screen');
        });

        on('btn-play-again', function () {
            CGameAudio.play('select');
            startGame(mode);
        });

        on('btn-go-menu', function () {
            CGameAudio.play('back');
            GameShell.showScreen('title-screen');
        });
    }

    function on(id, fn) {
        document.getElementById(id).addEventListener('click', fn);
    }

    // =====================================================================
    // Start game
    // =====================================================================
    function startGame(m) {
        mode = m;
        gameActive = true;
        inputLocked = false;
        winShown = false;
        p1Locked = false;
        p2Locked = false;

        if (mode === '1p') {
            board1p = new Board(null);
            render1p = new Renderer('tiles-1p', document.getElementById('grid-1p'));
            render1p.clear();

            board1p.addRandomTile();
            board1p.addRandomTile();
            // Mark initial tiles as new for pop animation
            board1p.tiles.forEach(function (t) { t.isNew = true; });
            render1p.render(board1p);

            updateScore1P();
            document.getElementById('win-overlay').classList.add('hidden');
            GameShell.showScreen('game-screen');
        } else {
            var seed = Math.floor(Math.random() * 2147483646) + 1;
            var rng1 = new SeededRNG(seed);
            var rng2 = new SeededRNG(seed);

            boardP1 = new Board(rng1);
            boardP2 = new Board(rng2);
            renderP1 = new Renderer('tiles-p1', document.getElementById('grid-p1'));
            renderP2 = new Renderer('tiles-p2', document.getElementById('grid-p2'));
            renderP1.clear();
            renderP2.clear();

            boardP1.addRandomTile();
            boardP1.addRandomTile();
            boardP2.addRandomTile();
            boardP2.addRandomTile();
            boardP1.tiles.forEach(function (t) { t.isNew = true; });
            boardP2.tiles.forEach(function (t) { t.isNew = true; });
            renderP1.render(boardP1);
            renderP2.render(boardP2);

            updateScore2P();
            GameShell.showScreen('game-screen-2p');
        }
    }

    // =====================================================================
    // Score display
    // =====================================================================
    function updateScore1P() {
        document.getElementById('hud-score').textContent = board1p.score;
        if (board1p.score > bestScore) {
            bestScore = board1p.score;
            localStorage.setItem('2048-best', String(bestScore));
        }
        updateBestDisplay();
    }

    function updateBestDisplay() {
        var el = document.getElementById('hud-best');
        if (el) el.textContent = bestScore;
    }

    function updateScore2P() {
        document.getElementById('hud-score-p1').textContent = boardP1.score;
        document.getElementById('hud-score-p2').textContent = boardP2.score;
    }

    // Floating score popup
    function showScorePop(container, mergeScore) {
        if (mergeScore <= 0) return;
        var rect = container.getBoundingClientRect();
        var pop = document.createElement('div');
        pop.className = 'score-pop';
        pop.textContent = '+' + mergeScore;
        pop.style.left = (rect.width / 2 - 20) + 'px';
        pop.style.top = (rect.height / 2 - 20) + 'px';
        container.appendChild(pop);
        setTimeout(function () {
            if (pop.parentNode) pop.parentNode.removeChild(pop);
        }, 650);
    }

    // =====================================================================
    // Move handling - 1 Player
    // =====================================================================
    function handleMove1P(direction) {
        if (!gameActive || inputLocked || board1p.over) return;

        inputLocked = true;
        var result = board1p.move(direction);

        if (!result.moved) {
            inputLocked = false;
            return;
        }

        // Sound
        if (result.mergeScore > 0) {
            CGameAudio.play('score');
            showScorePop(document.getElementById('grid-1p'), result.mergeScore);
        } else {
            CGameAudio.play('pop');
        }

        // Render the slide/merge animations
        render1p.render(board1p);

        // After slide animation, spawn new tile
        setTimeout(function () {
            // Clear merge state so ghosts aren't re-created
            board1p.tiles.forEach(function (t) { t.mergedFrom = null; });

            var newTile = board1p.addRandomTile();
            if (newTile) {
                render1p.render(board1p);
            }

            updateScore1P();

            // Check win
            if (board1p.bestTile >= 2048 && !winShown && !board1p.won) {
                board1p.won = true;
                CGameAudio.play('win');
                document.getElementById('win-overlay').classList.remove('hidden');
                return; // inputLocked stays true
            }

            // Check game over
            if (!board1p.canMove()) {
                board1p.over = true;
                CGameAudio.play('lose');
                setTimeout(function () { showGameOver1P(); }, 400);
                return;
            }

            inputLocked = false;
        }, 150);
    }

    // =====================================================================
    // Move handling - 2 Player
    // =====================================================================
    function handleMove2P(player, direction) {
        if (!gameActive) return;

        var board, renderer, container;
        if (player === 1) {
            if (p1Locked || boardP1.over) return;
            board = boardP1;
            renderer = renderP1;
            container = document.getElementById('grid-p1');
            p1Locked = true;
        } else {
            if (p2Locked || boardP2.over) return;
            board = boardP2;
            renderer = renderP2;
            container = document.getElementById('grid-p2');
            p2Locked = true;
        }

        var result = board.move(direction);
        if (!result.moved) {
            if (player === 1) p1Locked = false; else p2Locked = false;
            return;
        }

        if (result.mergeScore > 0) {
            CGameAudio.play('score');
            showScorePop(container, result.mergeScore);
        } else {
            CGameAudio.play('pop');
        }

        renderer.render(board);

        setTimeout(function () {
            // Clear merge state so ghosts aren't re-created
            board.tiles.forEach(function (t) { t.mergedFrom = null; });

            var newTile = board.addRandomTile();
            if (newTile) {
                renderer.render(board);
            }
            updateScore2P();

            // Check win
            if (board.bestTile >= 2048 && !board.won) {
                board.won = true;
                CGameAudio.play('win');
                gameActive = false;
                setTimeout(function () {
                    showGameOver2P(player === 1 ? 'P1' : 'P2');
                }, 300);
                return;
            }

            // Check if stuck
            if (!board.canMove()) {
                board.over = true;
                var otherBoard = player === 1 ? boardP2 : boardP1;
                if (otherBoard.over) {
                    CGameAudio.play('lose');
                    gameActive = false;
                    setTimeout(function () {
                        if (boardP1.score > boardP2.score) showGameOver2P('P1');
                        else if (boardP2.score > boardP1.score) showGameOver2P('P2');
                        else showGameOver2P('Tie');
                    }, 300);
                } else {
                    GameShell.showToast((player === 1 ? 'P1' : 'P2') + ' has no moves left!');
                }
            }

            if (player === 1) p1Locked = false; else p2Locked = false;
        }, 150);
    }

    // =====================================================================
    // Game over
    // =====================================================================
    function showGameOver1P() {
        gameActive = false;
        document.getElementById('gameover-title').textContent =
            board1p.bestTile >= 2048 ? 'You Win!' : 'Game Over';
        document.getElementById('go-score').textContent = board1p.score;
        document.getElementById('go-best-tile').textContent = board1p.bestTile;
        document.getElementById('go-2p-stats').classList.add('hidden');

        var statsEl = document.querySelectorAll('#gameover-screen .gameover-stats')[0];
        if (statsEl) statsEl.classList.remove('hidden');

        GameShell.addScore({ game: '2048', score: board1p.score, mode: '1p' });
        GameShell.showScreen('gameover-screen');
    }

    function showGameOver2P(winner) {
        gameActive = false;

        if (winner === 'Tie') {
            document.getElementById('gameover-title').textContent = "It's a Tie!";
        } else {
            document.getElementById('gameover-title').textContent = winner + ' Wins!';
        }

        var statsEls = document.querySelectorAll('#gameover-screen .gameover-stats');
        if (statsEls[0]) statsEls[0].classList.add('hidden');
        var twoP = document.getElementById('go-2p-stats');
        twoP.classList.remove('hidden');
        document.getElementById('go-p1-score').textContent = boardP1.score;
        document.getElementById('go-p2-score').textContent = boardP2.score;

        GameShell.showScreen('gameover-screen');
    }

    // =====================================================================
    // Input handling
    // =====================================================================
    function bindInput() {
        // Keyboard
        document.addEventListener('keydown', function (e) {
            var dir = -1;
            var player = 0;

            switch (e.key) {
                case 'ArrowUp':    dir = 0; player = mode === '2p' ? 2 : 1; break;
                case 'ArrowRight': dir = 1; player = mode === '2p' ? 2 : 1; break;
                case 'ArrowDown':  dir = 2; player = mode === '2p' ? 2 : 1; break;
                case 'ArrowLeft':  dir = 3; player = mode === '2p' ? 2 : 1; break;
                case 'w': case 'W': dir = 0; player = 1; break;
                case 'd': case 'D': dir = 1; player = 1; break;
                case 's': case 'S': dir = 2; player = 1; break;
                case 'a': case 'A': dir = 3; player = 1; break;
            }

            if (dir === -1) return;
            e.preventDefault();

            if (mode === '1p') {
                handleMove1P(dir);
            } else {
                handleMove2P(player, dir);
            }
        });

        // Touch swipe detection
        document.addEventListener('touchstart', function (e) {
            if (!gameActive) return;
            var touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            if (mode === '2p') {
                touchPlayerId = touch.clientX < window.innerWidth / 2 ? 1 : 2;
            } else {
                touchPlayerId = 1;
            }
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
            if (!gameActive) return;
            var touch = e.changedTouches[0];
            var dx = touch.clientX - touchStartX;
            var dy = touch.clientY - touchStartY;
            var absDx = Math.abs(dx);
            var absDy = Math.abs(dy);

            if (Math.max(absDx, absDy) < 30) return;

            var dir;
            if (absDx > absDy) {
                dir = dx > 0 ? 1 : 3;
            } else {
                dir = dy > 0 ? 2 : 0;
            }

            if (mode === '1p') {
                handleMove1P(dir);
            } else {
                handleMove2P(touchPlayerId, dir);
            }
        }, { passive: true });

        // Prevent scroll during game
        document.addEventListener('touchmove', function (e) {
            if (gameActive) e.preventDefault();
        }, { passive: false });
    }

    // =====================================================================
    // Resize handler
    // =====================================================================
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (mode === '1p' && board1p && render1p) {
                render1p.renderStatic(board1p);
            } else if (mode === '2p' && boardP1 && boardP2) {
                renderP1.renderStatic(boardP1);
                renderP2.renderStatic(boardP2);
            }
        }, 100);
    });

    // =====================================================================
    // Boot
    // =====================================================================
    initGame();

})();
