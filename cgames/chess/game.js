/* === Chess Game === */
(function () {
    'use strict';

    // --- Constants ---
    var PIECE_SYMBOLS = {
        wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
        bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F'
    };

    var PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

    // Piece-square tables (from white's perspective; flip for black)
    var PST = {
        P: [
             0,  0,  0,  0,  0,  0,  0,  0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
             5,  5, 10, 25, 25, 10,  5,  5,
             0,  0,  0, 20, 20,  0,  0,  0,
             5, -5,-10,  0,  0,-10, -5,  5,
             5, 10, 10,-20,-20, 10, 10,  5,
             0,  0,  0,  0,  0,  0,  0,  0
        ],
        N: [
            -50,-40,-30,-30,-30,-30,-40,-50,
            -40,-20,  0,  0,  0,  0,-20,-40,
            -30,  0, 10, 15, 15, 10,  0,-30,
            -30,  5, 15, 20, 20, 15,  5,-30,
            -30,  0, 15, 20, 20, 15,  0,-30,
            -30,  5, 10, 15, 15, 10,  5,-30,
            -40,-20,  0,  5,  5,  0,-20,-40,
            -50,-40,-30,-30,-30,-30,-40,-50
        ],
        B: [
            -20,-10,-10,-10,-10,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10,  5,  5, 10, 10,  5,  5,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10, 10, 10, 10, 10, 10, 10,-10,
            -10,  5,  0,  0,  0,  0,  5,-10,
            -20,-10,-10,-10,-10,-10,-10,-20
        ],
        R: [
             0,  0,  0,  0,  0,  0,  0,  0,
             5, 10, 10, 10, 10, 10, 10,  5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
             0,  0,  0,  5,  5,  0,  0,  0
        ],
        Q: [
            -20,-10,-10, -5, -5,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5,  5,  5,  5,  0,-10,
             -5,  0,  5,  5,  5,  5,  0, -5,
              0,  0,  5,  5,  5,  5,  0, -5,
            -10,  5,  5,  5,  5,  5,  0,-10,
            -10,  0,  5,  0,  0,  0,  0,-10,
            -20,-10,-10, -5, -5,-10,-10,-20
        ],
        K: [
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -20,-30,-30,-40,-40,-30,-30,-20,
            -10,-20,-20,-20,-20,-20,-20,-10,
             20, 20,  0,  0,  0,  0, 20, 20,
             20, 30, 10,  0,  0, 10, 30, 20
        ]
    };

    // --- Game state ---
    var board = [];         // 8x8 array, each cell: null or { color:'w'|'b', type:'K'|'Q'|'R'|'B'|'N'|'P' }
    var turn = 'w';         // 'w' or 'b'
    var selected = null;    // { row, col } or null
    var legalMoves = [];    // [{ row, col, special }] for the selected piece
    var moveLog = [];       // [ { from, to, piece, captured, special, notation } ]
    var lastMove = null;    // { from: {row,col}, to: {row,col} }
    var gameMode = '2p';    // '1p' or '2p'
    var aiDifficulty = 'easy';
    var gameOver = false;
    var capturedWhite = []; // white pieces captured (by black)
    var capturedBlack = []; // black pieces captured (by white)
    var promotionPending = null; // { from, to } while waiting for player choice
    var aiThinking = false;

    // Castling rights
    var castling = { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true };
    // En passant target square (null or { row, col })
    var enPassantTarget = null;
    // Half-move clock for 50-move rule (optional)
    var halfMoveClock = 0;
    var fullMoveNumber = 1;

    // DOM refs
    var boardEl, turnEl, historyEl, capturedBlackListEl, capturedWhiteListEl;
    var boardSize = 0;

    // Board flip for 2P (PC only)
    function isMobileDevice() {
        return ('ontouchstart' in window && window.innerWidth < 1024) || window.innerWidth < 768;
    }

    function updateBoardFlip() {
        var container = document.querySelector('.board-container');
        if (!container) return;
        // Only flip in 2P mode on PC, when it's black's turn
        if (gameMode === '2p' && !isMobileDevice() && turn === 'b' && !gameOver) {
            container.classList.add('board-flipped');
        } else {
            container.classList.remove('board-flipped');
        }
    }

    // --- Initialization ---
    function initBoard() {
        board = [];
        for (var r = 0; r < 8; r++) {
            board[r] = [];
            for (var c = 0; c < 8; c++) {
                board[r][c] = null;
            }
        }
        // Black pieces (row 0-1)
        var backRow = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        for (var c = 0; c < 8; c++) {
            board[0][c] = { color: 'b', type: backRow[c] };
            board[1][c] = { color: 'b', type: 'P' };
            board[6][c] = { color: 'w', type: 'P' };
            board[7][c] = { color: 'w', type: backRow[c] };
        }
        turn = 'w';
        selected = null;
        legalMoves = [];
        moveLog = [];
        lastMove = null;
        gameOver = false;
        capturedWhite = [];
        capturedBlack = [];
        promotionPending = null;
        aiThinking = false;
        castling = { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true };
        enPassantTarget = null;
        halfMoveClock = 0;
        fullMoveNumber = 1;
    }

    // --- Board rendering ---
    function calcBoardSize() {
        var area = document.querySelector('.game-area');
        if (!area) return 320;
        var h = area.clientHeight - 16;
        var w = area.clientWidth;
        // On small screens with no side panels, use most of width
        var maxW = w < 900 ? (w - 40) : (w - 380);
        var sz = Math.min(h, maxW);
        sz = Math.max(sz, 200);
        sz = Math.min(sz, 640);
        return Math.floor(sz / 8) * 8; // Make divisible by 8
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        boardSize = calcBoardSize();
        boardEl.style.width = boardSize + 'px';
        boardEl.style.height = boardSize + 'px';

        var sqSize = boardSize / 8;

        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var sq = document.createElement('div');
                sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
                sq.dataset.row = r;
                sq.dataset.col = c;
                sq.style.width = sqSize + 'px';
                sq.style.height = sqSize + 'px';

                // Last move highlight
                if (lastMove) {
                    if ((lastMove.from.row === r && lastMove.from.col === c) ||
                        (lastMove.to.row === r && lastMove.to.col === c)) {
                        sq.classList.add('last-move');
                    }
                }

                // Selected highlight
                if (selected && selected.row === r && selected.col === c) {
                    sq.classList.add('selected');
                }

                // Check highlight
                var piece = board[r][c];
                if (piece && piece.type === 'K' && piece.color === turn && isInCheck(turn)) {
                    sq.classList.add('in-check');
                }

                // Legal move dots
                var isLegal = false;
                var isCapture = false;
                for (var m = 0; m < legalMoves.length; m++) {
                    if (legalMoves[m].row === r && legalMoves[m].col === c) {
                        isLegal = true;
                        if (board[r][c] !== null || legalMoves[m].special === 'enpassant') {
                            isCapture = true;
                        }
                        break;
                    }
                }

                if (isLegal && isCapture) {
                    var ring = document.createElement('div');
                    ring.className = 'capture-ring';
                    sq.appendChild(ring);
                } else if (isLegal) {
                    var dot = document.createElement('div');
                    dot.className = 'move-dot';
                    sq.appendChild(dot);
                }

                // Piece
                if (piece) {
                    var pEl = document.createElement('span');
                    pEl.className = 'piece ' + (piece.color === 'w' ? 'white-piece' : 'black-piece');
                    pEl.textContent = PIECE_SYMBOLS[piece.color + piece.type];
                    sq.appendChild(pEl);
                }

                sq.addEventListener('click', onSquareClick);
                boardEl.appendChild(sq);
            }
        }

        // Rank labels
        var rankEl = document.getElementById('rank-labels');
        rankEl.innerHTML = '';
        rankEl.style.height = boardSize + 'px';
        for (var r = 0; r < 8; r++) {
            var lbl = document.createElement('div');
            lbl.className = 'rank-label';
            lbl.textContent = 8 - r;
            rankEl.appendChild(lbl);
        }

        // File labels
        var fileEl = document.getElementById('file-labels');
        fileEl.innerHTML = '';
        fileEl.style.width = boardSize + 'px';
        var files = 'abcdefgh';
        for (var c = 0; c < 8; c++) {
            var lbl = document.createElement('div');
            lbl.className = 'file-label';
            lbl.textContent = files[c];
            fileEl.appendChild(lbl);
        }

        updateTurnIndicator();
        renderCaptured();
        renderHistory();
        updateBoardFlip();
    }

    function updateTurnIndicator() {
        if (gameOver) return;
        if (turn === 'w') {
            turnEl.textContent = "White's Turn";
            turnEl.className = 'turn-indicator white-turn';
        } else {
            turnEl.textContent = "Black's Turn";
            turnEl.className = 'turn-indicator black-turn';
        }
    }

    function renderCaptured() {
        capturedBlackListEl.innerHTML = '';
        capturedWhiteListEl.innerHTML = '';
        // Sort captured by value for display
        var sortOrder = { Q: 0, R: 1, B: 2, N: 3, P: 4 };
        var sortFn = function (a, b) { return (sortOrder[a.type] || 5) - (sortOrder[b.type] || 5); };

        capturedBlack.slice().sort(sortFn).forEach(function (p) {
            var el = document.createElement('span');
            el.className = 'captured-piece';
            el.textContent = PIECE_SYMBOLS[p.color + p.type];
            capturedBlackListEl.appendChild(el);
        });

        capturedWhite.slice().sort(sortFn).forEach(function (p) {
            var el = document.createElement('span');
            el.className = 'captured-piece';
            el.textContent = PIECE_SYMBOLS[p.color + p.type];
            capturedWhiteListEl.appendChild(el);
        });
    }

    function renderHistory() {
        historyEl.innerHTML = '';
        for (var i = 0; i < moveLog.length; i += 2) {
            var row = document.createElement('div');
            row.className = 'history-row';

            var num = document.createElement('span');
            num.className = 'history-num';
            num.textContent = (Math.floor(i / 2) + 1) + '.';
            row.appendChild(num);

            var wm = document.createElement('span');
            wm.className = 'history-white';
            wm.textContent = moveLog[i].notation;
            row.appendChild(wm);

            if (i + 1 < moveLog.length) {
                var bm = document.createElement('span');
                bm.className = 'history-black';
                bm.textContent = moveLog[i + 1].notation;
                row.appendChild(bm);
            }

            historyEl.appendChild(row);
        }
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    // --- Move generation ---
    function inBounds(r, c) {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    function cloneBoard(b) {
        var nb = [];
        for (var r = 0; r < 8; r++) {
            nb[r] = [];
            for (var c = 0; c < 8; c++) {
                nb[r][c] = b[r][c] ? { color: b[r][c].color, type: b[r][c].type } : null;
            }
        }
        return nb;
    }

    function findKing(color, b) {
        b = b || board;
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                if (b[r][c] && b[r][c].color === color && b[r][c].type === 'K') {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    // Is the given color's king in check on the given board?
    function isInCheckOnBoard(color, b) {
        var kp = findKing(color, b);
        if (!kp) return true;
        var enemy = color === 'w' ? 'b' : 'w';
        return isSquareAttacked(kp.row, kp.col, enemy, b);
    }

    function isInCheck(color) {
        return isInCheckOnBoard(color, board);
    }

    // Is square (r,c) attacked by 'attackerColor' on board b?
    function isSquareAttacked(r, c, attackerColor, b) {
        b = b || board;
        // Knight attacks
        var knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (var i = 0; i < knightMoves.length; i++) {
            var nr = r + knightMoves[i][0], nc = c + knightMoves[i][1];
            if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].color === attackerColor && b[nr][nc].type === 'N') {
                return true;
            }
        }

        // Pawn attacks
        var pawnDir = attackerColor === 'w' ? 1 : -1; // pawn attacks upward for white
        var pawnAttacks = [[pawnDir, -1], [pawnDir, 1]];
        for (var i = 0; i < pawnAttacks.length; i++) {
            var nr = r + pawnAttacks[i][0], nc = c + pawnAttacks[i][1];
            if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].color === attackerColor && b[nr][nc].type === 'P') {
                return true;
            }
        }

        // King attacks (for adjacency)
        var kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (var i = 0; i < kingMoves.length; i++) {
            var nr = r + kingMoves[i][0], nc = c + kingMoves[i][1];
            if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].color === attackerColor && b[nr][nc].type === 'K') {
                return true;
            }
        }

        // Sliding pieces: rook/queen on straight lines
        var straight = [[-1,0],[1,0],[0,-1],[0,1]];
        for (var d = 0; d < straight.length; d++) {
            for (var dist = 1; dist < 8; dist++) {
                var nr = r + straight[d][0] * dist, nc = c + straight[d][1] * dist;
                if (!inBounds(nr, nc)) break;
                if (b[nr][nc]) {
                    if (b[nr][nc].color === attackerColor && (b[nr][nc].type === 'R' || b[nr][nc].type === 'Q')) {
                        return true;
                    }
                    break;
                }
            }
        }

        // Sliding pieces: bishop/queen on diagonals
        var diag = [[-1,-1],[-1,1],[1,-1],[1,1]];
        for (var d = 0; d < diag.length; d++) {
            for (var dist = 1; dist < 8; dist++) {
                var nr = r + diag[d][0] * dist, nc = c + diag[d][1] * dist;
                if (!inBounds(nr, nc)) break;
                if (b[nr][nc]) {
                    if (b[nr][nc].color === attackerColor && (b[nr][nc].type === 'B' || b[nr][nc].type === 'Q')) {
                        return true;
                    }
                    break;
                }
            }
        }

        return false;
    }

    // Generate pseudo-legal moves for a piece (not yet checking for own king in check)
    function pseudoLegalMoves(r, c, b, ep, cast) {
        b = b || board;
        ep = ep !== undefined ? ep : enPassantTarget;
        cast = cast || castling;
        var piece = b[r][c];
        if (!piece) return [];
        var moves = [];
        var color = piece.color;
        var enemy = color === 'w' ? 'b' : 'w';

        function addIfValid(nr, nc, special) {
            if (!inBounds(nr, nc)) return false;
            var target = b[nr][nc];
            if (target && target.color === color) return false;
            moves.push({ row: nr, col: nc, special: special || null });
            return !target; // return true if square was empty (for sliding)
        }

        switch (piece.type) {
            case 'P':
                var dir = color === 'w' ? -1 : 1;
                var startRow = color === 'w' ? 6 : 1;
                var promoRow = color === 'w' ? 0 : 7;

                // Forward one
                if (inBounds(r + dir, c) && !b[r + dir][c]) {
                    if (r + dir === promoRow) {
                        moves.push({ row: r + dir, col: c, special: 'promotion' });
                    } else {
                        moves.push({ row: r + dir, col: c, special: null });
                    }
                    // Forward two from start
                    if (r === startRow && !b[r + 2 * dir][c]) {
                        moves.push({ row: r + 2 * dir, col: c, special: 'double' });
                    }
                }

                // Captures
                var caps = [c - 1, c + 1];
                for (var i = 0; i < caps.length; i++) {
                    var nc = caps[i];
                    if (!inBounds(r + dir, nc)) continue;
                    if (b[r + dir][nc] && b[r + dir][nc].color === enemy) {
                        if (r + dir === promoRow) {
                            moves.push({ row: r + dir, col: nc, special: 'promotion' });
                        } else {
                            moves.push({ row: r + dir, col: nc, special: null });
                        }
                    }
                    // En passant
                    if (ep && ep.row === r + dir && ep.col === nc) {
                        moves.push({ row: r + dir, col: nc, special: 'enpassant' });
                    }
                }
                break;

            case 'N':
                var nm = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (var i = 0; i < nm.length; i++) {
                    addIfValid(r + nm[i][0], c + nm[i][1]);
                }
                break;

            case 'B':
                var bd = [[-1,-1],[-1,1],[1,-1],[1,1]];
                for (var d = 0; d < bd.length; d++) {
                    for (var dist = 1; dist < 8; dist++) {
                        if (!addIfValid(r + bd[d][0] * dist, c + bd[d][1] * dist)) break;
                    }
                }
                break;

            case 'R':
                var rd = [[-1,0],[1,0],[0,-1],[0,1]];
                for (var d = 0; d < rd.length; d++) {
                    for (var dist = 1; dist < 8; dist++) {
                        if (!addIfValid(r + rd[d][0] * dist, c + rd[d][1] * dist)) break;
                    }
                }
                break;

            case 'Q':
                var qd = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
                for (var d = 0; d < qd.length; d++) {
                    for (var dist = 1; dist < 8; dist++) {
                        if (!addIfValid(r + qd[d][0] * dist, c + qd[d][1] * dist)) break;
                    }
                }
                break;

            case 'K':
                var km = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
                for (var i = 0; i < km.length; i++) {
                    addIfValid(r + km[i][0], c + km[i][1]);
                }
                // Castling
                var row = color === 'w' ? 7 : 0;
                if (r === row && c === 4) {
                    // King-side
                    var ksKey = color + 'KR';
                    var kKey = color + 'K';
                    if (cast[kKey] && cast[ksKey] &&
                        !b[row][5] && !b[row][6] &&
                        b[row][7] && b[row][7].type === 'R' && b[row][7].color === color &&
                        !isSquareAttacked(row, 4, enemy, b) &&
                        !isSquareAttacked(row, 5, enemy, b) &&
                        !isSquareAttacked(row, 6, enemy, b)) {
                        moves.push({ row: row, col: 6, special: 'castle-king' });
                    }
                    // Queen-side
                    var qsKey = color + 'QR';
                    if (cast[kKey] && cast[qsKey] &&
                        !b[row][3] && !b[row][2] && !b[row][1] &&
                        b[row][0] && b[row][0].type === 'R' && b[row][0].color === color &&
                        !isSquareAttacked(row, 4, enemy, b) &&
                        !isSquareAttacked(row, 3, enemy, b) &&
                        !isSquareAttacked(row, 2, enemy, b)) {
                        moves.push({ row: row, col: 2, special: 'castle-queen' });
                    }
                }
                break;
        }

        return moves;
    }

    // Generate all legal moves for a color (filtering out moves leaving king in check)
    function allLegalMoves(color, b, ep, cast) {
        b = b || board;
        ep = ep !== undefined ? ep : enPassantTarget;
        cast = cast || castling;
        var moves = [];
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                if (b[r][c] && b[r][c].color === color) {
                    var pMoves = pseudoLegalMoves(r, c, b, ep, cast);
                    for (var m = 0; m < pMoves.length; m++) {
                        var move = pMoves[m];
                        // Test if this move leaves our king in check
                        var testBoard = cloneBoard(b);
                        applyMoveOnBoard(testBoard, r, c, move.row, move.col, move.special);
                        if (!isInCheckOnBoard(color, testBoard)) {
                            moves.push({ from: { row: r, col: c }, to: move });
                        }
                    }
                }
            }
        }
        return moves;
    }

    // Get legal moves for specific piece at (r,c)
    function getLegalMovesForPiece(r, c) {
        var piece = board[r][c];
        if (!piece || piece.color !== turn) return [];
        var pMoves = pseudoLegalMoves(r, c);
        var legal = [];
        for (var m = 0; m < pMoves.length; m++) {
            var move = pMoves[m];
            var testBoard = cloneBoard(board);
            applyMoveOnBoard(testBoard, r, c, move.row, move.col, move.special);
            if (!isInCheckOnBoard(piece.color, testBoard)) {
                legal.push(move);
            }
        }
        return legal;
    }

    // Apply a move on a board (mutates it). For testing purposes.
    function applyMoveOnBoard(b, fromR, fromC, toR, toC, special) {
        var piece = b[fromR][fromC];
        b[toR][toC] = piece;
        b[fromR][fromC] = null;

        // En passant capture
        if (special === 'enpassant') {
            var capturedRow = piece.color === 'w' ? toR + 1 : toR - 1;
            b[capturedRow][toC] = null;
        }

        // Castling: move the rook
        if (special === 'castle-king') {
            var row = toR;
            b[row][5] = b[row][7];
            b[row][7] = null;
        }
        if (special === 'castle-queen') {
            var row = toR;
            b[row][3] = b[row][0];
            b[row][0] = null;
        }

        // Promotion default to queen for board testing
        if (special === 'promotion') {
            b[toR][toC] = { color: piece.color, type: 'Q' };
        }
    }

    // --- Execute move on the real game state ---
    function executeMove(fromR, fromC, toR, toC, special, promoType) {
        var piece = board[fromR][fromC];
        var captured = board[toR][toC];
        var notation = '';

        // En passant capture
        if (special === 'enpassant') {
            var capturedRow = piece.color === 'w' ? toR + 1 : toR - 1;
            captured = board[capturedRow][toC];
            board[capturedRow][toC] = null;
        }

        // Track captured pieces
        if (captured) {
            if (captured.color === 'w') {
                capturedWhite.push(captured);
            } else {
                capturedBlack.push(captured);
            }
        }

        // Build algebraic notation
        notation = buildNotation(piece, fromR, fromC, toR, toC, captured, special, promoType);

        // Move the piece
        board[toR][toC] = piece;
        board[fromR][fromC] = null;

        // Castling rook movement
        if (special === 'castle-king') {
            board[toR][5] = board[toR][7];
            board[toR][7] = null;
        }
        if (special === 'castle-queen') {
            board[toR][3] = board[toR][0];
            board[toR][0] = null;
        }

        // Promotion
        if (special === 'promotion') {
            var pt = promoType || 'Q';
            board[toR][toC] = { color: piece.color, type: pt };
        }

        // Update castling rights
        if (piece.type === 'K') {
            castling[piece.color + 'K'] = false;
            castling[piece.color + 'KR'] = false;
            castling[piece.color + 'QR'] = false;
        }
        if (piece.type === 'R') {
            if (fromR === 7 && fromC === 0) castling.wQR = false;
            if (fromR === 7 && fromC === 7) castling.wKR = false;
            if (fromR === 0 && fromC === 0) castling.bQR = false;
            if (fromR === 0 && fromC === 7) castling.bKR = false;
        }
        // If a rook is captured, remove its castling right
        if (toR === 7 && toC === 0) castling.wQR = false;
        if (toR === 7 && toC === 7) castling.wKR = false;
        if (toR === 0 && toC === 0) castling.bQR = false;
        if (toR === 0 && toC === 7) castling.bKR = false;

        // Update en passant target
        if (special === 'double') {
            enPassantTarget = { row: (fromR + toR) / 2, col: fromC };
        } else {
            enPassantTarget = null;
        }

        // Update last move
        lastMove = { from: { row: fromR, col: fromC }, to: { row: toR, col: toC } };

        // Switch turn
        var prevTurn = turn;
        turn = turn === 'w' ? 'b' : 'w';
        if (prevTurn === 'b') fullMoveNumber++;

        // Update half-move clock
        if (piece.type === 'P' || captured) {
            halfMoveClock = 0;
        } else {
            halfMoveClock++;
        }

        // Check/checkmate/stalemate annotation
        var enemyMoves = allLegalMoves(turn);
        if (isInCheck(turn)) {
            if (enemyMoves.length === 0) {
                notation += '#';
            } else {
                notation += '+';
            }
        }

        // Log the move
        moveLog.push({
            from: { row: fromR, col: fromC },
            to: { row: toR, col: toC },
            piece: piece,
            captured: captured,
            special: special,
            notation: notation
        });

        // Clear selection
        selected = null;
        legalMoves = [];

        // Play sound
        if (captured) {
            CGameAudio.play('hit');
        } else if (special === 'castle-king' || special === 'castle-queen') {
            CGameAudio.play('score');
        } else {
            CGameAudio.play('click');
        }

        // Re-render
        renderBoard();

        // Check game end
        if (enemyMoves.length === 0) {
            if (isInCheck(turn)) {
                endGame(prevTurn === 'w' ? 'white' : 'black', 'checkmate');
            } else {
                endGame('draw', 'stalemate');
            }
            return;
        }

        // 50-move rule
        if (halfMoveClock >= 100) {
            endGame('draw', '50-move rule');
            return;
        }

        // Insufficient material
        if (isInsufficientMaterial()) {
            endGame('draw', 'insufficient material');
            return;
        }

        // AI move
        if (gameMode === '1p' && turn === 'b' && !gameOver) {
            aiThinking = true;
            turnEl.textContent = "AI thinking...";
            setTimeout(function () {
                makeAIMove();
                aiThinking = false;
            }, 200);
        }
    }

    function isInsufficientMaterial() {
        var pieces = { w: [], b: [] };
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                if (board[r][c]) {
                    pieces[board[r][c].color].push(board[r][c].type);
                }
            }
        }
        // K vs K
        if (pieces.w.length === 1 && pieces.b.length === 1) return true;
        // K+B vs K or K+N vs K
        if (pieces.w.length === 1 && pieces.b.length === 2) {
            if (pieces.b.indexOf('B') !== -1 || pieces.b.indexOf('N') !== -1) return true;
        }
        if (pieces.b.length === 1 && pieces.w.length === 2) {
            if (pieces.w.indexOf('B') !== -1 || pieces.w.indexOf('N') !== -1) return true;
        }
        // K+B vs K+B (same color bishops)
        if (pieces.w.length === 2 && pieces.b.length === 2) {
            if (pieces.w.indexOf('B') !== -1 && pieces.b.indexOf('B') !== -1) {
                // Find bishop squares
                var wbSq = null, bbSq = null;
                for (var r = 0; r < 8; r++) {
                    for (var c = 0; c < 8; c++) {
                        if (board[r][c] && board[r][c].type === 'B') {
                            if (board[r][c].color === 'w') wbSq = (r + c) % 2;
                            else bbSq = (r + c) % 2;
                        }
                    }
                }
                if (wbSq === bbSq) return true;
            }
        }
        return false;
    }

    // Build algebraic notation
    function buildNotation(piece, fromR, fromC, toR, toC, captured, special, promoType) {
        var files = 'abcdefgh';
        var ranks = '87654321';

        if (special === 'castle-king') return 'O-O';
        if (special === 'castle-queen') return 'O-O-O';

        var n = '';

        if (piece.type === 'P') {
            if (captured || special === 'enpassant') {
                n += files[fromC] + 'x';
            }
            n += files[toC] + ranks[toR];
            if (special === 'promotion') {
                n += '=' + (promoType || 'Q');
            }
        } else {
            n += piece.type;

            // Disambiguation: check if another piece of same type can move to same square
            var disambig = '';
            for (var r = 0; r < 8; r++) {
                for (var c = 0; c < 8; c++) {
                    if (r === fromR && c === fromC) continue;
                    if (board[r][c] && board[r][c].color === piece.color && board[r][c].type === piece.type) {
                        var theirMoves = pseudoLegalMoves(r, c);
                        for (var m = 0; m < theirMoves.length; m++) {
                            if (theirMoves[m].row === toR && theirMoves[m].col === toC) {
                                // Need disambiguation
                                if (c !== fromC) {
                                    disambig = files[fromC];
                                } else if (r !== fromR) {
                                    disambig = ranks[fromR];
                                } else {
                                    disambig = files[fromC] + ranks[fromR];
                                }
                                break;
                            }
                        }
                    }
                }
            }
            n += disambig;

            if (captured) n += 'x';
            n += files[toC] + ranks[toR];
        }

        return n;
    }

    // --- Click handler ---
    function onSquareClick(e) {
        if (gameOver || promotionPending || aiThinking) return;

        var sq = e.currentTarget;
        var r = parseInt(sq.dataset.row);
        var c = parseInt(sq.dataset.col);
        var piece = board[r][c];

        // If a piece is selected, check if this is a legal destination
        if (selected) {
            var moveTarget = null;
            for (var m = 0; m < legalMoves.length; m++) {
                if (legalMoves[m].row === r && legalMoves[m].col === c) {
                    moveTarget = legalMoves[m];
                    break;
                }
            }

            if (moveTarget) {
                // Check promotion
                if (moveTarget.special === 'promotion') {
                    showPromotionModal(selected.row, selected.col, r, c);
                    return;
                }
                executeMove(selected.row, selected.col, r, c, moveTarget.special);
                return;
            }

            // If clicking own piece, reselect
            if (piece && piece.color === turn) {
                // In 1P mode, player is always white
                if (gameMode === '1p' && piece.color !== 'w') return;
                selected = { row: r, col: c };
                legalMoves = getLegalMovesForPiece(r, c);
                CGameAudio.play('click');
                renderBoard();
                return;
            }

            // Deselect
            selected = null;
            legalMoves = [];
            renderBoard();
            return;
        }

        // No piece selected: select a piece
        if (piece && piece.color === turn) {
            // In 1P mode, player is always white
            if (gameMode === '1p' && piece.color !== 'w') return;
            selected = { row: r, col: c };
            legalMoves = getLegalMovesForPiece(r, c);
            CGameAudio.play('click');
            renderBoard();
        }
    }

    // --- Promotion modal ---
    function showPromotionModal(fromR, fromC, toR, toC) {
        promotionPending = { fromR: fromR, fromC: fromC, toR: toR, toC: toC };
        var modal = document.getElementById('promotion-modal');
        var piecesEl = document.getElementById('promotion-pieces');
        piecesEl.innerHTML = '';
        var color = board[fromR][fromC].color;
        var promoOptions = ['Q', 'R', 'B', 'N'];
        promoOptions.forEach(function (type) {
            var opt = document.createElement('div');
            opt.className = 'promotion-option';
            opt.textContent = PIECE_SYMBOLS[color + type];
            opt.addEventListener('click', function () {
                hidePromotionModal();
                executeMove(promotionPending.fromR, promotionPending.fromC,
                    promotionPending.toR, promotionPending.toC, 'promotion', type);
                promotionPending = null;
            });
            piecesEl.appendChild(opt);
        });
        modal.classList.remove('hidden');
    }

    function hidePromotionModal() {
        document.getElementById('promotion-modal').classList.add('hidden');
    }

    // --- Game end ---
    function endGame(winner, reason) {
        gameOver = true;
        var title = '';
        var sub = '';
        var icon = '';

        if (winner === 'draw') {
            title = 'Draw!';
            sub = reason === 'stalemate' ? 'Stalemate' :
                reason === '50-move rule' ? '50-move rule' :
                    'Insufficient material';
            icon = '\u00BD';
            CGameAudio.play('lose');
        } else if (winner === 'white') {
            title = 'Checkmate!';
            sub = 'White wins';
            icon = '\u2654';
            if (gameMode === '1p') {
                CGameAudio.play('win');
            } else {
                CGameAudio.play('win');
            }
        } else {
            title = 'Checkmate!';
            sub = 'Black wins';
            icon = '\u265A';
            if (gameMode === '1p') {
                CGameAudio.play('lose');
            } else {
                CGameAudio.play('win');
            }
        }

        turnEl.textContent = sub;

        // Show game over screen after a short delay
        setTimeout(function () {
            document.getElementById('gameover-icon').textContent = icon;
            document.getElementById('gameover-title').textContent = title;
            document.getElementById('gameover-sub').textContent = sub;
            GameShell.showScreen('gameover-screen');
        }, 1200);
    }

    // --- AI ---
    function makeAIMove() {
        if (gameOver) return;
        var moves = allLegalMoves('b');
        if (moves.length === 0) return;

        var chosenMove;

        switch (aiDifficulty) {
            case 'easy':
                chosenMove = moves[Math.floor(Math.random() * moves.length)];
                break;
            case 'medium':
                chosenMove = minimaxRoot(2, false);
                break;
            case 'hard':
                chosenMove = minimaxRoot(3, true);
                break;
            default:
                chosenMove = moves[Math.floor(Math.random() * moves.length)];
        }

        if (chosenMove) {
            if (chosenMove.to.special === 'promotion') {
                // AI always promotes to queen (or best choice)
                var promoType = aiChoosePromotion(chosenMove);
                executeMove(chosenMove.from.row, chosenMove.from.col,
                    chosenMove.to.row, chosenMove.to.col, 'promotion', promoType);
            } else {
                executeMove(chosenMove.from.row, chosenMove.from.col,
                    chosenMove.to.row, chosenMove.to.col, chosenMove.to.special);
            }
        }
    }

    function aiChoosePromotion(move) {
        // Almost always queen, but check for stalemate
        return 'Q';
    }

    function minimaxRoot(depth, useAlphaBeta) {
        var moves = allLegalMoves('b');
        var bestScore = -Infinity;
        var bestMove = null;

        // Shuffle moves for variety
        shuffleArray(moves);

        for (var i = 0; i < moves.length; i++) {
            var m = moves[i];
            // Save state
            var savedBoard = cloneBoard(board);
            var savedCastling = Object.assign({}, castling);
            var savedEP = enPassantTarget ? { row: enPassantTarget.row, col: enPassantTarget.col } : null;

            // Apply move
            applyMoveOnBoard(board, m.from.row, m.from.col, m.to.row, m.to.col, m.to.special);

            // Update castling/EP for child search
            var piece = savedBoard[m.from.row][m.from.col];
            var tempCastling = Object.assign({}, savedCastling);
            var tempEP = null;

            if (piece.type === 'K') {
                tempCastling[piece.color + 'K'] = false;
                tempCastling[piece.color + 'KR'] = false;
                tempCastling[piece.color + 'QR'] = false;
            }
            if (piece.type === 'R') {
                if (m.from.row === 7 && m.from.col === 0) tempCastling.wQR = false;
                if (m.from.row === 7 && m.from.col === 7) tempCastling.wKR = false;
                if (m.from.row === 0 && m.from.col === 0) tempCastling.bQR = false;
                if (m.from.row === 0 && m.from.col === 7) tempCastling.bKR = false;
            }
            if (m.to.special === 'double') {
                tempEP = { row: (m.from.row + m.to.row) / 2, col: m.from.col };
            }

            var oldCastling = castling;
            var oldEP = enPassantTarget;
            castling = tempCastling;
            enPassantTarget = tempEP;

            var score;
            if (useAlphaBeta) {
                score = minimax(depth - 1, -Infinity, Infinity, false);
            } else {
                score = minimax(depth - 1, -Infinity, Infinity, false);
            }

            // Restore state
            board = savedBoard;
            castling = oldCastling;
            enPassantTarget = oldEP;

            if (score > bestScore) {
                bestScore = score;
                bestMove = m;
            }
        }

        return bestMove;
    }

    // Minimax with alpha-beta pruning
    // Maximizing = black (AI), minimizing = white (player)
    function minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return evaluateBoard();
        }

        var color = isMaximizing ? 'b' : 'w';
        var moves = allLegalMoves(color);

        if (moves.length === 0) {
            if (isInCheckOnBoard(color, board)) {
                // Checkmate
                return isMaximizing ? -100000 + (3 - depth) : 100000 - (3 - depth);
            }
            // Stalemate
            return 0;
        }

        if (isMaximizing) {
            var maxEval = -Infinity;
            for (var i = 0; i < moves.length; i++) {
                var m = moves[i];
                var savedBoard = cloneBoard(board);
                var savedCastling = Object.assign({}, castling);
                var savedEP = enPassantTarget ? { row: enPassantTarget.row, col: enPassantTarget.col } : null;

                applyMoveOnBoard(board, m.from.row, m.from.col, m.to.row, m.to.col, m.to.special);

                var piece = savedBoard[m.from.row][m.from.col];
                var tempCastling = Object.assign({}, savedCastling);
                var tempEP = null;
                if (piece.type === 'K') {
                    tempCastling[piece.color + 'K'] = false;
                    tempCastling[piece.color + 'KR'] = false;
                    tempCastling[piece.color + 'QR'] = false;
                }
                if (piece.type === 'R') {
                    if (m.from.row === 7 && m.from.col === 0) tempCastling.wQR = false;
                    if (m.from.row === 7 && m.from.col === 7) tempCastling.wKR = false;
                    if (m.from.row === 0 && m.from.col === 0) tempCastling.bQR = false;
                    if (m.from.row === 0 && m.from.col === 7) tempCastling.bKR = false;
                }
                if (m.to.special === 'double') {
                    tempEP = { row: (m.from.row + m.to.row) / 2, col: m.from.col };
                }

                var oldCastling = castling;
                var oldEP = enPassantTarget;
                castling = tempCastling;
                enPassantTarget = tempEP;

                var evalScore = minimax(depth - 1, alpha, beta, false);

                board = savedBoard;
                castling = oldCastling;
                enPassantTarget = oldEP;

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            var minEval = Infinity;
            for (var i = 0; i < moves.length; i++) {
                var m = moves[i];
                var savedBoard = cloneBoard(board);
                var savedCastling = Object.assign({}, castling);
                var savedEP = enPassantTarget ? { row: enPassantTarget.row, col: enPassantTarget.col } : null;

                applyMoveOnBoard(board, m.from.row, m.from.col, m.to.row, m.to.col, m.to.special);

                var piece = savedBoard[m.from.row][m.from.col];
                var tempCastling = Object.assign({}, savedCastling);
                var tempEP = null;
                if (piece.type === 'K') {
                    tempCastling[piece.color + 'K'] = false;
                    tempCastling[piece.color + 'KR'] = false;
                    tempCastling[piece.color + 'QR'] = false;
                }
                if (piece.type === 'R') {
                    if (m.from.row === 7 && m.from.col === 0) tempCastling.wQR = false;
                    if (m.from.row === 7 && m.from.col === 7) tempCastling.wKR = false;
                    if (m.from.row === 0 && m.from.col === 0) tempCastling.bQR = false;
                    if (m.from.row === 0 && m.from.col === 7) tempCastling.bKR = false;
                }
                if (m.to.special === 'double') {
                    tempEP = { row: (m.from.row + m.to.row) / 2, col: m.from.col };
                }

                var oldCastling = castling;
                var oldEP = enPassantTarget;
                castling = tempCastling;
                enPassantTarget = tempEP;

                var evalScore = minimax(depth - 1, alpha, beta, true);

                board = savedBoard;
                castling = oldCastling;
                enPassantTarget = oldEP;

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    // Evaluate board from black's perspective (positive = good for black)
    function evaluateBoard() {
        var score = 0;
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var piece = board[r][c];
                if (!piece) continue;
                var value = PIECE_VALUES[piece.type] || 0;
                // Piece-square table bonus
                var pst = PST[piece.type];
                var pstIdx;
                if (piece.color === 'w') {
                    pstIdx = r * 8 + c;
                    score -= value + pst[pstIdx];
                } else {
                    // Flip for black
                    pstIdx = (7 - r) * 8 + c;
                    score += value + pst[pstIdx];
                }
            }
        }
        return score;
    }

    function shuffleArray(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    }

    // --- Screen management ---
    function showTitleScreen() {
        document.getElementById('difficulty-select').classList.add('hidden');
        GameShell.showScreen('title-screen');
    }

    function startGame(mode, difficulty) {
        gameMode = mode;
        aiDifficulty = difficulty || 'easy';
        initBoard();
        renderBoard();
        GameShell.showScreen('game-screen');
    }

    // --- Event wiring ---
    function wireEvents() {
        // Title screen buttons
        document.getElementById('btn-1p').addEventListener('click', function () {
            CGameAudio.play('click');
            document.getElementById('difficulty-select').classList.remove('hidden');
        });

        document.getElementById('btn-2p').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame('2p');
        });

        // Difficulty buttons
        var diffBtns = document.querySelectorAll('.btn-diff');
        diffBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                CGameAudio.play('select');
                startGame('1p', btn.dataset.diff);
            });
        });

        // In-game buttons
        document.getElementById('btn-back-game').addEventListener('click', function () {
            CGameAudio.play('back');
            showTitleScreen();
        });

        document.getElementById('btn-restart').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame(gameMode, aiDifficulty);
        });

        // Game over buttons
        document.getElementById('btn-play-again').addEventListener('click', function () {
            CGameAudio.play('click');
            startGame(gameMode, aiDifficulty);
        });

        document.getElementById('btn-go-menu').addEventListener('click', function () {
            CGameAudio.play('back');
            showTitleScreen();
        });

        // Resize handler
        window.addEventListener('resize', function () {
            if (!gameOver && document.getElementById('game-screen').classList.contains('active')) {
                renderBoard();
            }
        });
    }

    // --- Boot ---
    function boot() {
        GameShell.init({ backUrl: '../' });
        boardEl = document.getElementById('chess-board');
        turnEl = document.getElementById('turn-indicator');
        historyEl = document.getElementById('move-history');
        capturedBlackListEl = document.getElementById('captured-black-list');
        capturedWhiteListEl = document.getElementById('captured-white-list');
        wireEvents();

        // Register custom chess sounds
        CGameAudio.register('move', function (ctx, now) {
            CGameAudio.osc('sine', 440, now, 0.05, 0.06);
        });
        CGameAudio.register('capture', function (ctx, now) {
            CGameAudio.osc('sawtooth', 300, now, 0.08, 0.1);
            CGameAudio.noise(now, 0.04, 0.06);
        });
        CGameAudio.register('check', function (ctx, now) {
            CGameAudio.osc('sine', 880, now, 0.1, 0.12);
            CGameAudio.osc('sine', 660, now + 0.08, 0.1, 0.1);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
