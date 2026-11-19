/* ==========================================================================
   BOARD GAMES: CỜ VUA (CHESS) & CỜ TƯỚNG (XIANGQI)
   Hỗ trợ: Người vs Bot (IQ 70 / 100 / 130 / 160), Người vs Người, Undo, Đua Top
   ========================================================================== */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function playBeep(freq, dur, type, vol) {
    if (window.HNGamesLB && typeof window.HNGamesLB.beep === 'function') {
      window.HNGamesLB.beep(freq, dur, type, vol);
    }
  }

  function addBoardPoints(gameId, storageKey, delta) {
    var cur = 1000;
    try {
      var saved = parseInt(localStorage.getItem(storageKey) || '1000', 10);
      if (!isNaN(saved) && saved >= 1000) cur = saved;
    } catch (e) {}
    var next = cur + delta;
    try {
      localStorage.setItem(storageKey, String(next));
    } catch (e) {}
    if (window.HNGamesLB && typeof window.HNGamesLB.submit === 'function') {
      window.HNGamesLB.submit(gameId, next);
    }
  }

  /* ========================================================================
     1. CỜ VUA (CHESS 8x8)
     ======================================================================== */
  function getChessPieceSvg(piece) {
    if (!piece) return '';
    var isW = piece[0] === 'w';
    var type = piece[1];
    var fill = isW ? '#fffaf0' : '#2a211c';
    var stroke = isW ? '#2c1d11' : '#110c09';
    var detail = isW ? '#2c1d11' : '#e8d4b4';
    var body = '';

    if (type === 'P') {
      body = '<path d="M22.5 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-4.5 9.5c0 2.5 1.5 4.2 1.5 6.5 0 2.8-2.5 5-5.5 6.5V35h17v-3.5c-3-1.5-5.5-3.7-5.5-6.5 0-2.3 1.5-4 1.5-6.5h-9z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
             '<rect x="11" y="35" width="23" height="4" rx="1.5" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8"/>';
    } else if (type === 'R') {
      body = '<path d="M11 9h5v4h4V9h5v4h4V9h5v7l-3 3v12l3 3v3H11v-3l3-3V19l-3-3V9z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
             '<path d="M14 19h17M14 31h17" stroke="' + detail + '" stroke-width="1.4" stroke-linecap="round"/>' +
             '<rect x="9" y="36" width="27" height="3.5" rx="1.2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8"/>';
    } else if (type === 'N') {
      body = '<path d="M22 10c10.5 1 16.5 8 16 25H14c0-9 9-6.5 7-16-2 1-5.5 2.5-7 1-1.5-1.5 1-5.5 3-7-1-1-2-2.5-1-3.5 1.5 0 3.5.5 6 .5z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
             '<circle cx="19.5" cy="15.5" r="1.3" fill="' + detail + '"/>' +
             '<path d="M12 35h21v4H12z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>';
    } else if (type === 'B') {
      body = '<circle cx="22.5" cy="8" r="2.5" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.6"/>' +
             '<path d="M22.5 11c-6 3.5-8.5 9.5-5.5 15.5l-2 4.5h15l-2-4.5c3-6 .5-12-5.5-15.5z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
             '<path d="M19.5 18l6 6M22.5 15.5v7M15 31h15" stroke="' + detail + '" stroke-width="1.5" stroke-linecap="round"/>' +
             '<path d="M11 35.5c4-2 19-2 23 0v3.5H11v-3.5z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>';
    } else if (type === 'Q') {
      body = '<circle cx="8" cy="14" r="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
             '<circle cx="15" cy="10" r="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
             '<circle cx="22.5" cy="8.5" r="2.2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
             '<circle cx="30" cy="10" r="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
             '<circle cx="37" cy="14" r="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>' +
             '<path d="M9 16l5 15h17l5-15-7.5 7L22.5 11l-6 12L9 16z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
             '<path d="M13 31h19v4H13zM10.5 35h24v4h-24z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>';
    } else if (type === 'K') {
      body = '<path d="M22.5 6v6M19.5 9h6" stroke="' + stroke + '" stroke-width="2.4" stroke-linecap="round"/>' +
             '<path d="M22.5 12c-5 0-9.5 4-9.5 9.5 0 4.5 2.5 8 4 10.5h11c1.5-2.5 4-6 4-10.5 0-5.5-4.5-9.5-9.5-9.5z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
             '<path d="M14 27.5c4.5-1.5 12.5-1.5 17 0M12 32h21v3.5H12zM10 35.5h25v3.5H10z" fill="' + fill + '" stroke="' + detail + '" stroke-width="1.6" stroke-linejoin="round"/>';
    }

    return '<svg class="chess-piece-svg" viewBox="0 0 45 45" aria-hidden="true">' + body + '</svg>';
  }

  var CHESS_VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

  var CHESS_PST_P = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ];

  var CHESS_PST_N = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];

  var CHESS_PST_B = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  var chessState = {
    board: [],
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    selected: null,
    legalForSel: [],
    history: [],
    lastMove: null,
    over: false,
    botThinking: false,
    initialized: false
  };

  function createInitialChessBoard() {
    return [
      ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
      ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
      ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
    ];
  }

  function cloneChessBoard(b) {
    return b.map(function (row) { return row.slice(); });
  }

  function inBounds8(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function isSquareAttackedChess(board, tr, tc, byColor) {
    var pawnDir = byColor === 'w' ? 1 : -1;
    var pr = tr + pawnDir;
    if (inBounds8(pr, tc - 1) && board[pr][tc - 1] === byColor + 'P') return true;
    if (inBounds8(pr, tc + 1) && board[pr][tc + 1] === byColor + 'P') return true;

    var kMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (var i = 0; i < kMoves.length; i++) {
      var nr = tr + kMoves[i][0], nc = tc + kMoves[i][1];
      if (inBounds8(nr, nc) && board[nr][nc] === byColor + 'N') return true;
    }

    var kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var j = 0; j < kingMoves.length; j++) {
      var kr = tr + kingMoves[j][0], kc = tc + kingMoves[j][1];
      if (inBounds8(kr, kc) && board[kr][kc] === byColor + 'K') return true;
    }

    var ortho = [[-1,0],[1,0],[0,-1],[0,1]];
    for (var d = 0; d < 4; d++) {
      var sr = tr + ortho[d][0], sc = tc + ortho[d][1];
      while (inBounds8(sr, sc)) {
        var p = board[sr][sc];
        if (p) {
          if (p[0] === byColor && (p[1] === 'R' || p[1] === 'Q')) return true;
          break;
        }
        sr += ortho[d][0];
        sc += ortho[d][1];
      }
    }

    var diag = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (var d2 = 0; d2 < 4; d2++) {
      var dr = tr + diag[d2][0], dc = tc + diag[d2][1];
      while (inBounds8(dr, dc)) {
        var p2 = board[dr][dc];
        if (p2) {
          if (p2[0] === byColor && (p2[1] === 'B' || p2[1] === 'Q')) return true;
          break;
        }
        dr += diag[d2][0];
        dc += diag[d2][1];
      }
    }
    return false;
  }

  function findChessKing(board, color) {
    var target = color + 'K';
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (board[r][c] === target) return [r, c];
      }
    }
    return null;
  }

  function isInCheckChess(board, color) {
    var kp = findChessKing(board, color);
    if (!kp) return false;
    return isSquareAttackedChess(board, kp[0], kp[1], color === 'w' ? 'b' : 'w');
  }

  function getPseudoMovesChess(board, r, c, castling, enPassant) {
    var piece = board[r][c];
    if (!piece) return [];
    var color = piece[0];
    var type = piece[1];
    var enemy = color === 'w' ? 'b' : 'w';
    var moves = [];

    if (type === 'P') {
      var dir = color === 'w' ? -1 : 1;
      var startRow = color === 'w' ? 6 : 1;
      if (inBounds8(r + dir, c) && !board[r + dir][c]) {
        moves.push({ fr: r, fc: c, tr: r + dir, tc: c });
        if (r === startRow && !board[r + dir * 2][c]) {
          moves.push({ fr: r, fc: c, tr: r + dir * 2, tc: c, doublePush: true });
        }
      }
      var caps = [-1, 1];
      for (var i = 0; i < 2; i++) {
        var nc = c + caps[i];
        var nr = r + dir;
        if (!inBounds8(nr, nc)) continue;
        if (board[nr][nc] && board[nr][nc][0] === enemy) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        } else if (enPassant && enPassant[0] === nr && enPassant[1] === nc) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc, enPassantCap: true });
        }
      }
    } else if (type === 'N') {
      var jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (var j = 0; j < jumps.length; j++) {
        var jr = r + jumps[j][0], jc = c + jumps[j][1];
        if (inBounds8(jr, jc) && (!board[jr][jc] || board[jr][jc][0] === enemy)) {
          moves.push({ fr: r, fc: c, tr: jr, tc: jc });
        }
      }
    } else if (type === 'B' || type === 'R' || type === 'Q') {
      var dirs = [];
      if (type === 'B' || type === 'Q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      if (type === 'R' || type === 'Q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      for (var d = 0; d < dirs.length; d++) {
        var sr = r + dirs[d][0], sc = c + dirs[d][1];
        while (inBounds8(sr, sc)) {
          if (!board[sr][sc]) {
            moves.push({ fr: r, fc: c, tr: sr, tc: sc });
          } else {
            if (board[sr][sc][0] === enemy) moves.push({ fr: r, fc: c, tr: sr, tc: sc });
            break;
          }
          sr += dirs[d][0];
          sc += dirs[d][1];
        }
      }
    } else if (type === 'K') {
      var steps = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (var s = 0; s < steps.length; s++) {
        var kr = r + steps[s][0], kc = c + steps[s][1];
        if (inBounds8(kr, kc) && (!board[kr][kc] || board[kr][kc][0] === enemy)) {
          moves.push({ fr: r, fc: c, tr: kr, tc: kc });
        }
      }
      var homeRow = color === 'w' ? 7 : 0;
      if (r === homeRow && c === 4 && castling && !isSquareAttackedChess(board, homeRow, 4, enemy)) {
        if (castling[color + 'K'] && !board[homeRow][5] && !board[homeRow][6] &&
            board[homeRow][7] === color + 'R' &&
            !isSquareAttackedChess(board, homeRow, 5, enemy) &&
            !isSquareAttackedChess(board, homeRow, 6, enemy)) {
          moves.push({ fr: homeRow, fc: 4, tr: homeRow, tc: 6, castle: 'K' });
        }
        if (castling[color + 'Q'] && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1] &&
            board[homeRow][0] === color + 'R' &&
            !isSquareAttackedChess(board, homeRow, 3, enemy) &&
            !isSquareAttackedChess(board, homeRow, 2, enemy)) {
          moves.push({ fr: homeRow, fc: 4, tr: homeRow, tc: 2, castle: 'Q' });
        }
      }
    }
    return moves;
  }

  function applyChessMove(board, castling, move) {
    var nb = cloneChessBoard(board);
    var nc = { wK: castling.wK, wQ: castling.wQ, bK: castling.bK, bQ: castling.bQ };
    var piece = nb[move.fr][move.fc];
    var color = piece[0];
    var type = piece[1];

    nb[move.tr][move.tc] = piece;
    nb[move.fr][move.fc] = null;

    if (move.enPassantCap) {
      nb[move.fr][move.tc] = null;
    }
    if (move.castle === 'K') {
      nb[move.fr][5] = nb[move.fr][7];
      nb[move.fr][7] = null;
    } else if (move.castle === 'Q') {
      nb[move.fr][3] = nb[move.fr][0];
      nb[move.fr][0] = null;
    }
    if (type === 'P' && (move.tr === 0 || move.tr === 7)) {
      nb[move.tr][move.tc] = color + 'Q';
    }

    if (piece === 'wK') { nc.wK = false; nc.wQ = false; }
    if (piece === 'bK') { nc.bK = false; nc.bQ = false; }
    if (move.fr === 7 && move.fc === 0) nc.wQ = false;
    if (move.fr === 7 && move.fc === 7) nc.wK = false;
    if (move.fr === 0 && move.fc === 0) nc.bQ = false;
    if (move.fr === 0 && move.fc === 7) nc.bK = false;
    if (move.tr === 7 && move.tc === 0) nc.wQ = false;
    if (move.tr === 7 && move.tc === 7) nc.wK = false;
    if (move.tr === 0 && move.tc === 0) nc.bQ = false;
    if (move.tr === 0 && move.tc === 7) nc.bK = false;

    var nextEP = null;
    if (move.doublePush) {
      nextEP = [(move.fr + move.tr) / 2, move.fc];
    }

    return { board: nb, castling: nc, enPassant: nextEP };
  }

  function getLegalMovesChess(board, color, castling, enPassant) {
    var legal = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (board[r][c] && board[r][c][0] === color) {
          var pm = getPseudoMovesChess(board, r, c, castling, enPassant);
          for (var i = 0; i < pm.length; i++) {
            var res = applyChessMove(board, castling, pm[i]);
            if (!isInCheckChess(res.board, color)) {
              legal.push(pm[i]);
            }
          }
        }
      }
    }
    return legal;
  }

  function evaluateChess(board) {
    var score = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p) continue;
        var color = p[0];
        var type = p[1];
        var val = CHESS_VAL[type] || 0;
        var pst = 0;
        var pr = color === 'w' ? r : 7 - r;
        if (type === 'P') pst = CHESS_PST_P[pr][c];
        else if (type === 'N') pst = CHESS_PST_N[pr][c];
        else if (type === 'B') pst = CHESS_PST_B[pr][c];
        if (color === 'b') score += (val + pst);
        else score -= (val + pst);
      }
    }
    return score;
  }

  function orderChessMoves(board, moves) {
    return moves.sort(function (a, b) {
      var va = board[a.tr][a.tc] ? CHESS_VAL[board[a.tr][a.tc][1]] : 0;
      var vb = board[b.tr][b.tc] ? CHESS_VAL[board[b.tr][b.tc][1]] : 0;
      return vb - va;
    });
  }

  function minimaxChess(board, depth, alpha, beta, maximizing, castling, enPassant) {
    var color = maximizing ? 'b' : 'w';
    var moves = getLegalMovesChess(board, color, castling, enPassant);
    if (moves.length === 0) {
      if (isInCheckChess(board, color)) {
        return maximizing ? (-99000 - depth * 10) : (99000 + depth * 10);
      }
      return 0;
    }
    if (depth === 0) {
      return evaluateChess(board);
    }
    orderChessMoves(board, moves);

    if (maximizing) {
      var maxEval = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var res = applyChessMove(board, castling, moves[i]);
        var ev = minimaxChess(res.board, depth - 1, alpha, beta, false, res.castling, res.enPassant);
        if (ev > maxEval) maxEval = ev;
        if (ev > alpha) alpha = ev;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      var minEval = Infinity;
      for (var j = 0; j < moves.length; j++) {
        var res2 = applyChessMove(board, castling, moves[j]);
        var ev2 = minimaxChess(res2.board, depth - 1, alpha, beta, true, res2.castling, res2.enPassant);
        if (ev2 < minEval) minEval = ev2;
        if (ev2 < beta) beta = ev2;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function chooseChessBotMove(iq) {
    var moves = getLegalMovesChess(chessState.board, 'b', chessState.castling, chessState.enPassant);
    if (!moves.length) return null;
    orderChessMoves(chessState.board, moves);

    var depth = 2;
    var noise = 0;
    if (iq <= 70) { depth = 1; noise = 180; }
    else if (iq <= 100) { depth = 2; noise = 65; }
    else if (iq <= 130) { depth = 2; noise = 15; }
    else { depth = 3; noise = 0; }

    var bestMove = moves[0];
    var bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var res = applyChessMove(chessState.board, chessState.castling, moves[i]);
      var sc = minimaxChess(res.board, depth - 1, -Infinity, Infinity, false, res.castling, res.enPassant);
      if (noise > 0) sc += (Math.random() - 0.5) * noise;
      if (sc > bestScore) {
        bestScore = sc;
        bestMove = moves[i];
      }
    }
    return bestMove;
  }

  function setChessStatus(text, kind) {
    var el = $('chessStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'board-status-banner' + (kind ? ' ' + kind : '');
  }

  function renderChessBoard() {
    var container = $('chessBoard');
    if (!container) return;
    container.innerHTML = '';

    var wCheck = isInCheckChess(chessState.board, 'w');
    var bCheck = isInCheckChess(chessState.board, 'b');

    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = document.createElement('div');
        sq.className = 'chess-sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.r = String(r);
        sq.dataset.c = String(c);

        if (chessState.lastMove &&
            ((chessState.lastMove.fr === r && chessState.lastMove.fc === c) ||
             (chessState.lastMove.tr === r && chessState.lastMove.tc === c))) {
          sq.classList.add('last-move');
        }
        if (chessState.selected && chessState.selected[0] === r && chessState.selected[1] === c) {
          sq.classList.add('selected');
        }

        var isLegalTarget = chessState.legalForSel.some(function (m) { return m.tr === r && m.tc === c; });
        if (isLegalTarget) {
          sq.classList.add(chessState.board[r][c] ? 'capture-ring' : 'legal-dot');
        }

        var piece = chessState.board[r][c];
        if (piece === 'wK' && wCheck) sq.classList.add('in-check');
        if (piece === 'bK' && bCheck) sq.classList.add('in-check');

        if (piece) {
          sq.innerHTML = getChessPieceSvg(piece);
        }

        sq.addEventListener('click', onChessSquareClick);
        container.appendChild(sq);
      }
    }
  }

  function executeChessMove(move) {
    chessState.history.push({
      board: cloneChessBoard(chessState.board),
      turn: chessState.turn,
      castling: {
        wK: chessState.castling.wK,
        wQ: chessState.castling.wQ,
        bK: chessState.castling.bK,
        bQ: chessState.castling.bQ
      },
      enPassant: chessState.enPassant ? chessState.enPassant.slice() : null,
      lastMove: chessState.lastMove
    });

    var captured = chessState.board[move.tr][move.tc] || move.enPassantCap;
    var res = applyChessMove(chessState.board, chessState.castling, move);
    chessState.board = res.board;
    chessState.castling = res.castling;
    chessState.enPassant = res.enPassant;
    chessState.lastMove = move;
    chessState.selected = null;
    chessState.legalForSel = [];
    chessState.turn = chessState.turn === 'w' ? 'b' : 'w';

    playBeep(captured ? 320 : 480, 0.06, 'triangle', 0.08);

    var nextLegal = getLegalMovesChess(chessState.board, chessState.turn, chessState.castling, chessState.enPassant);
    var inChk = isInCheckChess(chessState.board, chessState.turn);
    var mode = $('chessModeSelect') ? $('chessModeSelect').value : 'bot';
    var iq = parseInt($('chessIqSelect') ? $('chessIqSelect').value : '100', 10);

    if (nextLegal.length === 0) {
      chessState.over = true;
      renderChessBoard();
      if (inChk) {
        var winner = chessState.turn === 'w' ? 'Quân Đen' : 'Quân Trắng';
        setChessStatus('🏆 Chiếu hết! ' + winner + ' chiến thắng!', 'win');
        playBeep(660, 0.18, 'sine', 0.12);
        if (mode === 'bot' && chessState.turn === 'b') {
          addBoardPoints('chess', 'hanoi_phovi_chess_pts', iq);
        } else if (mode === 'pvp') {
          addBoardPoints('chess', 'hanoi_phovi_chess_pts', 60);
        }
      } else {
        setChessStatus('🤝 Hòa cờ (Hết nước đi hợp lệ)!', '');
      }
      return;
    }

    renderChessBoard();
    var turnName = chessState.turn === 'w' ? 'Quân Trắng' : (mode === 'bot' ? 'Bot (IQ ' + iq + ')' : 'Quân Đen');
    if (inChk) {
      setChessStatus('⚠️ Chiếu tướng! Lượt ' + turnName, 'check');
      playBeep(240, 0.1, 'sawtooth', 0.08);
    } else {
      setChessStatus('Lượt: ' + turnName, '');
    }

    if (mode === 'bot' && chessState.turn === 'b' && !chessState.over) {
      chessState.botThinking = true;
      setTimeout(function () {
        chessState.botThinking = false;
        if (chessState.over || chessState.turn !== 'b') return;
        var botMove = chooseChessBotMove(iq);
        if (botMove) executeChessMove(botMove);
      }, 220);
    }
  }

  function onChessSquareClick(e) {
    if (chessState.over || chessState.botThinking) return;
    var mode = $('chessModeSelect') ? $('chessModeSelect').value : 'bot';
    if (mode === 'bot' && chessState.turn === 'b') return;

    var sq = e.currentTarget;
    var r = parseInt(sq.dataset.r, 10);
    var c = parseInt(sq.dataset.c, 10);

    var chosenMove = chessState.legalForSel.find(function (m) { return m.tr === r && m.tc === c; });
    if (chosenMove) {
      executeChessMove(chosenMove);
      return;
    }

    var piece = chessState.board[r][c];
    if (piece && piece[0] === chessState.turn) {
      chessState.selected = [r, c];
      var allLegal = getLegalMovesChess(chessState.board, chessState.turn, chessState.castling, chessState.enPassant);
      chessState.legalForSel = allLegal.filter(function (m) { return m.fr === r && m.fc === c; });
      renderChessBoard();
    } else {
      chessState.selected = null;
      chessState.legalForSel = [];
      renderChessBoard();
    }
  }

  function initChessGame() {
    chessState.board = createInitialChessBoard();
    chessState.turn = 'w';
    chessState.castling = { wK: true, wQ: true, bK: true, bQ: true };
    chessState.enPassant = null;
    chessState.selected = null;
    chessState.legalForSel = [];
    chessState.history = [];
    chessState.lastMove = null;
    chessState.over = false;
    chessState.botThinking = false;
    chessState.initialized = true;
    setChessStatus('Lượt: Quân Trắng đi trước', '');
    renderChessBoard();
  }

  function undoChess() {
    if (chessState.botThinking || !chessState.history.length) return;
    var mode = $('chessModeSelect') ? $('chessModeSelect').value : 'bot';
    var steps = (mode === 'bot' && chessState.turn === 'w' && chessState.history.length >= 2) ? 2 : 1;
    var snap = null;
    for (var i = 0; i < steps && chessState.history.length; i++) {
      snap = chessState.history.pop();
    }
    if (!snap) return;
    chessState.board = snap.board;
    chessState.turn = snap.turn;
    chessState.castling = snap.castling;
    chessState.enPassant = snap.enPassant;
    chessState.lastMove = snap.lastMove;
    chessState.selected = null;
    chessState.legalForSel = [];
    chessState.over = false;
    setChessStatus('Đã đi lại. Lượt: ' + (chessState.turn === 'w' ? 'Quân Trắng' : 'Quân Đen'), '');
    renderChessBoard();
  }

  $('chessModeSelect')?.addEventListener('change', function () {
    if ($('chessIqWrap')) $('chessIqWrap').hidden = $('chessModeSelect').value !== 'bot';
    initChessGame();
  });
  $('chessIqSelect')?.addEventListener('change', initChessGame);
  $('btnChessNew')?.addEventListener('click', initChessGame);
  $('btnChessUndo')?.addEventListener('click', undoChess);

  window.initChessIfNeeded = function () {
    if (!chessState.initialized) initChessGame();
  };

  /* ========================================================================
     2. CỜ TƯỚNG (XIANGQI 9x10 CANVAS)
     ======================================================================== */
  var XQ_LABELS = {
    rK: '帥', rA: '仕', rE: '相', rR: '俥', rH: '傌', rC: '炮', rP: '兵',
    bK: '將', bA: '士', bE: '象', bR: '車', bH: '馬', bC: '砲', bP: '卒'
  };

  var XQ_VAL = { K: 10000, R: 900, C: 450, H: 400, E: 200, A: 200, P: 100 };

  var xqState = {
    board: [],
    turn: 'r',
    selected: null,
    legalForSel: [],
    history: [],
    lastMove: null,
    over: false,
    botThinking: false,
    initialized: false
  };

  function createInitialXqBoard() {
    return [
      ['bR', 'bH', 'bE', 'bA', 'bK', 'bA', 'bE', 'bH', 'bR'],
      [null, null, null, null, null, null, null, null, null],
      [null, 'bC', null, null, null, null, null, 'bC', null],
      ['bP', null, 'bP', null, 'bP', null, 'bP', null, 'bP'],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      ['rP', null, 'rP', null, 'rP', null, 'rP', null, 'rP'],
      [null, 'rC', null, null, null, null, null, 'rC', null],
      [null, null, null, null, null, null, null, null, null],
      ['rR', 'rH', 'rE', 'rA', 'rK', 'rA', 'rE', 'rH', 'rR']
    ];
  }

  function cloneXqBoard(b) {
    return b.map(function (row) { return row.slice(); });
  }

  function inBoundsXq(r, c) {
    return r >= 0 && r < 10 && c >= 0 && c < 9;
  }

  function inPalaceXq(r, c, color) {
    if (c < 3 || c > 5) return false;
    return color === 'r' ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }

  function getPseudoMovesXq(board, r, c) {
    var piece = board[r][c];
    if (!piece) return [];
    var color = piece[0];
    var type = piece[1];
    var moves = [];

    function canLand(tr, tc) {
      if (!inBoundsXq(tr, tc)) return false;
      var t = board[tr][tc];
      return !t || t[0] !== color;
    }

    if (type === 'K') {
      var kDirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (var i = 0; i < 4; i++) {
        var nr = r + kDirs[i][0], nc = c + kDirs[i][1];
        if (inPalaceXq(nr, nc, color) && canLand(nr, nc)) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
    } else if (type === 'A') {
      var aDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      for (var j = 0; j < 4; j++) {
        var ar = r + aDirs[j][0], ac = c + aDirs[j][1];
        if (inPalaceXq(ar, ac, color) && canLand(ar, ac)) {
          moves.push({ fr: r, fc: c, tr: ar, tc: ac });
        }
      }
    } else if (type === 'E') {
      var eDirs = [[-2,-2],[-2,2],[2,-2],[2,2]];
      for (var e = 0; e < 4; e++) {
        var er = r + eDirs[e][0], ec = c + eDirs[e][1];
        var eyeR = r + eDirs[e][0] / 2, eyeC = c + eDirs[e][1] / 2;
        if (!inBoundsXq(er, ec)) continue;
        if (color === 'r' && er < 5) continue;
        if (color === 'b' && er > 4) continue;
        if (!board[eyeR][eyeC] && canLand(er, ec)) {
          moves.push({ fr: r, fc: c, tr: er, tc: ec });
        }
      }
    } else if (type === 'H') {
      var hSteps = [
        [-2,-1,-1,0], [-2,1,-1,0],
        [2,-1,1,0],   [2,1,1,0],
        [-1,-2,0,-1], [1,-2,0,-1],
        [-1,2,0,1],   [1,2,0,1]
      ];
      for (var h = 0; h < hSteps.length; h++) {
        var hr = r + hSteps[h][0], hc = c + hSteps[h][1];
        var legR = r + hSteps[h][2], legC = c + hSteps[h][3];
        if (inBoundsXq(hr, hc) && !board[legR][legC] && canLand(hr, hc)) {
          moves.push({ fr: r, fc: c, tr: hr, tc: hc });
        }
      }
    } else if (type === 'R') {
      var rDirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (var d = 0; d < 4; d++) {
        var sr = r + rDirs[d][0], sc = c + rDirs[d][1];
        while (inBoundsXq(sr, sc)) {
          if (!board[sr][sc]) {
            moves.push({ fr: r, fc: c, tr: sr, tc: sc });
          } else {
            if (board[sr][sc][0] !== color) moves.push({ fr: r, fc: c, tr: sr, tc: sc });
            break;
          }
          sr += rDirs[d][0];
          sc += rDirs[d][1];
        }
      }
    } else if (type === 'C') {
      var cDirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (var cd = 0; cd < 4; cd++) {
        var cr = r + cDirs[cd][0], cc = c + cDirs[cd][1];
        var jumped = false;
        while (inBoundsXq(cr, cc)) {
          if (!jumped) {
            if (!board[cr][cc]) {
              moves.push({ fr: r, fc: c, tr: cr, tc: cc });
            } else {
              jumped = true;
            }
          } else {
            if (board[cr][cc]) {
              if (board[cr][cc][0] !== color) moves.push({ fr: r, fc: c, tr: cr, tc: cc });
              break;
            }
          }
          cr += cDirs[cd][0];
          cc += cDirs[cd][1];
        }
      }
    } else if (type === 'P') {
      var fwd = color === 'r' ? -1 : 1;
      if (canLand(r + fwd, c)) moves.push({ fr: r, fc: c, tr: r + fwd, tc: c });
      var crossed = color === 'r' ? (r <= 4) : (r >= 5);
      if (crossed) {
        if (canLand(r, c - 1)) moves.push({ fr: r, fc: c, tr: r, tc: c - 1 });
        if (canLand(r, c + 1)) moves.push({ fr: r, fc: c, tr: r, tc: c + 1 });
      }
    }
    return moves;
  }

  function findXqGenerals(board) {
    var rK = null, bK = null;
    for (var r = 0; r < 10; r++) {
      for (var c = 3; c <= 5; c++) {
        if (board[r][c] === 'rK') rK = [r, c];
        else if (board[r][c] === 'bK') bK = [r, c];
      }
    }
    return { r: rK, b: bK };
  }

  function generalsFacingXq(board) {
    var g = findXqGenerals(board);
    if (!g.r || !g.b || g.r[1] !== g.b[1]) return false;
    var col = g.r[1];
    for (var r = g.b[0] + 1; r < g.r[0]; r++) {
      if (board[r][col]) return false;
    }
    return true;
  }

  function isInCheckXq(board, color) {
    if (generalsFacingXq(board)) return true;
    var g = findXqGenerals(board);
    var kp = color === 'r' ? g.r : g.b;
    if (!kp) return true;
    var enemy = color === 'r' ? 'b' : 'r';
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 9; c++) {
        if (board[r][c] && board[r][c][0] === enemy) {
          var pm = getPseudoMovesXq(board, r, c);
          for (var i = 0; i < pm.length; i++) {
            if (pm[i].tr === kp[0] && pm[i].tc === kp[1]) return true;
          }
        }
      }
    }
    return false;
  }

  function applyXqMove(board, move) {
    var nb = cloneXqBoard(board);
    nb[move.tr][move.tc] = nb[move.fr][move.fc];
    nb[move.fr][move.fc] = null;
    return nb;
  }

  function getLegalMovesXq(board, color) {
    var legal = [];
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 9; c++) {
        if (board[r][c] && board[r][c][0] === color) {
          var pm = getPseudoMovesXq(board, r, c);
          for (var i = 0; i < pm.length; i++) {
            var nb = applyXqMove(board, pm[i]);
            if (!isInCheckXq(nb, color)) {
              legal.push(pm[i]);
            }
          }
        }
      }
    }
    return legal;
  }

  function evaluateXq(board) {
    var score = 0;
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 9; c++) {
        var p = board[r][c];
        if (!p) continue;
        var color = p[0];
        var type = p[1];
        var val = XQ_VAL[type] || 0;
        if (type === 'P') {
          var crossed = color === 'r' ? (r <= 4) : (r >= 5);
          if (crossed) val += 75;
          if (c >= 3 && c <= 5) val += 20;
        } else if (type === 'H' || type === 'C') {
          if (c >= 2 && c <= 6) val += 15;
        } else if (type === 'R') {
          if (r >= 3 && r <= 6) val += 20;
        }
        if (color === 'b') score += val;
        else score -= val;
      }
    }
    return score;
  }

  function orderXqMoves(board, moves) {
    return moves.sort(function (a, b) {
      var va = board[a.tr][a.tc] ? XQ_VAL[board[a.tr][a.tc][1]] : 0;
      var vb = board[b.tr][b.tc] ? XQ_VAL[board[b.tr][b.tc][1]] : 0;
      return vb - va;
    });
  }

  function minimaxXq(board, depth, alpha, beta, maximizing) {
    var color = maximizing ? 'b' : 'r';
    var moves = getLegalMovesXq(board, color);
    if (moves.length === 0) {
      return maximizing ? (-99000 - depth * 10) : (99000 + depth * 10);
    }
    if (depth === 0) {
      return evaluateXq(board);
    }
    orderXqMoves(board, moves);

    if (maximizing) {
      var maxEval = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var nb = applyXqMove(board, moves[i]);
        var ev = minimaxXq(nb, depth - 1, alpha, beta, false);
        if (ev > maxEval) maxEval = ev;
        if (ev > alpha) alpha = ev;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      var minEval = Infinity;
      for (var j = 0; j < moves.length; j++) {
        var nb2 = applyXqMove(board, moves[j]);
        var ev2 = minimaxXq(nb2, depth - 1, alpha, beta, true);
        if (ev2 < minEval) minEval = ev2;
        if (ev2 < beta) beta = ev2;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function chooseXqBotMove(iq) {
    var moves = getLegalMovesXq(xqState.board, 'b');
    if (!moves.length) return null;
    orderXqMoves(xqState.board, moves);

    var depth = 2;
    var noise = 0;
    if (iq <= 70) { depth = 1; noise = 190; }
    else if (iq <= 100) { depth = 2; noise = 70; }
    else if (iq <= 130) { depth = 2; noise = 15; }
    else { depth = 3; noise = 0; }

    var bestMove = moves[0];
    var bestScore = -Infinity;
    var limit = iq >= 160 ? Math.min(moves.length, 32) : moves.length;
    for (var i = 0; i < limit; i++) {
      var nb = applyXqMove(xqState.board, moves[i]);
      var sc = minimaxXq(nb, depth - 1, -Infinity, Infinity, false);
      if (noise > 0) sc += (Math.random() - 0.5) * noise;
      if (sc > bestScore) {
        bestScore = sc;
        bestMove = moves[i];
      }
    }
    return bestMove;
  }

  function setXqStatus(text, kind) {
    var el = $('xqStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'board-status-banner' + (kind ? ' ' + kind : '');
  }

  function drawXqBoard() {
    var canvas = $('xqCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var padX = 34;
    var padY = 30;
    var cellW = (W - padX * 2) / 8;
    var cellH = (H - padY * 2) / 9;

    // Wood background
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#f4d9a6');
    grad.addColorStop(1, '#e2ba78');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Outer double border
    ctx.strokeStyle = '#5a3214';
    ctx.lineWidth = 3;
    ctx.strokeRect(padX - 8, padY - 8, cellW * 8 + 16, cellH * 9 + 16);

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#6c3e1b';

    // Horizontal lines
    for (var r = 0; r < 10; r++) {
      var y = padY + r * cellH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(padX + cellW * 8, y);
      ctx.stroke();
    }

    // Vertical lines (split by river)
    for (var c = 0; c < 9; c++) {
      var x = padX + c * cellW;
      if (c === 0 || c === 8) {
        ctx.beginPath();
        ctx.moveTo(x, padY);
        ctx.lineTo(x, padY + cellH * 9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, padY);
        ctx.lineTo(x, padY + cellH * 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, padY + cellH * 5);
        ctx.lineTo(x, padY + cellH * 9);
        ctx.stroke();
      }
    }

    // Palace diagonals
    ctx.beginPath();
    ctx.moveTo(padX + 3 * cellW, padY);
    ctx.lineTo(padX + 5 * cellW, padY + 2 * cellH);
    ctx.moveTo(padX + 5 * cellW, padY);
    ctx.lineTo(padX + 3 * cellW, padY + 2 * cellH);
    ctx.moveTo(padX + 3 * cellW, padY + 7 * cellH);
    ctx.lineTo(padX + 5 * cellW, padY + 9 * cellH);
    ctx.moveTo(padX + 5 * cellW, padY + 7 * cellH);
    ctx.lineTo(padX + 3 * cellW, padY + 9 * cellH);
    ctx.stroke();

    // River labels
    ctx.fillStyle = '#6b3e1b';
    ctx.font = 'bold 21px "Noto Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚  河', padX + cellW * 2, padY + cellH * 4.5);
    ctx.fillText('漢  界', padX + cellW * 6, padY + cellH * 4.5);

    // Last move highlight
    if (xqState.lastMove) {
      var lm = xqState.lastMove;
      ctx.strokeStyle = 'rgba(211, 84, 0, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(padX + lm.fc * cellW - 14, padY + lm.fr * cellH - 14, 28, 28);
      ctx.strokeRect(padX + lm.tc * cellW - 16, padY + lm.tr * cellH - 16, 32, 32);
    }

    // Legal move indicators
    for (var m = 0; m < xqState.legalForSel.length; m++) {
      var mv = xqState.legalForSel[m];
      var mx = padX + mv.tc * cellW;
      var my = padY + mv.tr * cellH;
      if (xqState.board[mv.tr][mv.tc]) {
        ctx.strokeStyle = 'rgba(192, 57, 43, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(mx, my, 21, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(39, 174, 96, 0.75)';
        ctx.beginPath();
        ctx.arc(mx, my, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pieces
    var pieceR = Math.min(cellW, cellH) * 0.43;
    for (var pr = 0; pr < 10; pr++) {
      for (var pc = 0; pc < 9; pc++) {
        var piece = xqState.board[pr][pc];
        if (!piece) continue;
        var px = padX + pc * cellW;
        var py = padY + pr * cellH;
        var isSel = xqState.selected && xqState.selected[0] === pr && xqState.selected[1] === pc;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.arc(px + 1.5, py + 2.5, pieceR, 0, Math.PI * 2);
        ctx.fill();

        // Disc
        ctx.fillStyle = isSel ? '#fff3b0' : '#fdf2db';
        ctx.beginPath();
        ctx.arc(px, py, pieceR, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.strokeStyle = isSel ? '#27ae60' : (piece[0] === 'r' ? '#b8291d' : '#2d2622');
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.stroke();

        ctx.strokeStyle = piece[0] === 'r' ? 'rgba(184, 41, 29, 0.35)' : 'rgba(45, 38, 34, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, pieceR - 3.5, 0, Math.PI * 2);
        ctx.stroke();

        // Character
        ctx.fillStyle = piece[0] === 'r' ? '#b8291d' : '#1e1916';
        ctx.font = 'bold ' + Math.round(pieceR * 1.15) + 'px "Noto Serif", KaiTi, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(XQ_LABELS[piece] || piece, px, py + 1);
      }
    }
  }

  function executeXqMove(move) {
    xqState.history.push({
      board: cloneXqBoard(xqState.board),
      turn: xqState.turn,
      lastMove: xqState.lastMove
    });

    var captured = xqState.board[move.tr][move.tc];
    xqState.board = applyXqMove(xqState.board, move);
    xqState.lastMove = move;
    xqState.selected = null;
    xqState.legalForSel = [];
    xqState.turn = xqState.turn === 'r' ? 'b' : 'r';

    playBeep(captured ? 320 : 480, 0.06, 'triangle', 0.08);

    var nextLegal = getLegalMovesXq(xqState.board, xqState.turn);
    var inChk = isInCheckXq(xqState.board, xqState.turn);
    var mode = $('xqModeSelect') ? $('xqModeSelect').value : 'bot';
    var iq = parseInt($('xqIqSelect') ? $('xqIqSelect').value : '100', 10);

    drawXqBoard();

    if (nextLegal.length === 0) {
      xqState.over = true;
      var winner = xqState.turn === 'r' ? 'Quân Đen' : 'Quân Đỏ';
      setXqStatus('🏆 Tuyệt sát! ' + winner + ' chiến thắng!', 'win');
      playBeep(660, 0.18, 'sine', 0.12);
      if (mode === 'bot' && xqState.turn === 'b') {
        addBoardPoints('xiangqi', 'hanoi_phovi_xq_pts', iq);
      } else if (mode === 'pvp') {
        addBoardPoints('xiangqi', 'hanoi_phovi_xq_pts', 60);
      }
      return;
    }

    var turnName = xqState.turn === 'r' ? 'Quân Đỏ' : (mode === 'bot' ? 'Bot (IQ ' + iq + ')' : 'Quân Đen');
    if (inChk) {
      setXqStatus('⚠️ Chiếu tướng! Lượt ' + turnName, 'check');
      playBeep(240, 0.1, 'sawtooth', 0.08);
    } else {
      setXqStatus('Lượt: ' + turnName, '');
    }

    if (mode === 'bot' && xqState.turn === 'b' && !xqState.over) {
      xqState.botThinking = true;
      setTimeout(function () {
        xqState.botThinking = false;
        if (xqState.over || xqState.turn !== 'b') return;
        var botMove = chooseXqBotMove(iq);
        if (botMove) executeXqMove(botMove);
      }, 220);
    }
  }

  $('xqCanvas')?.addEventListener('click', function (e) {
    if (xqState.over || xqState.botThinking) return;
    var mode = $('xqModeSelect') ? $('xqModeSelect').value : 'bot';
    if (mode === 'bot' && xqState.turn === 'b') return;

    var canvas = $('xqCanvas');
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (e.clientX - rect.left) * scaleX;
    var y = (e.clientY - rect.top) * scaleY;

    var padX = 34;
    var padY = 30;
    var cellW = (canvas.width - padX * 2) / 8;
    var cellH = (canvas.height - padY * 2) / 9;

    var c = Math.round((x - padX) / cellW);
    var r = Math.round((y - padY) / cellH);
    if (!inBoundsXq(r, c)) return;

    var chosenMove = xqState.legalForSel.find(function (m) { return m.tr === r && m.tc === c; });
    if (chosenMove) {
      executeXqMove(chosenMove);
      return;
    }

    var piece = xqState.board[r][c];
    if (piece && piece[0] === xqState.turn) {
      xqState.selected = [r, c];
      var allLegal = getLegalMovesXq(xqState.board, xqState.turn);
      xqState.legalForSel = allLegal.filter(function (m) { return m.fr === r && m.fc === c; });
      drawXqBoard();
    } else {
      xqState.selected = null;
      xqState.legalForSel = [];
      drawXqBoard();
    }
  });

  function initXiangqiGame() {
    xqState.board = createInitialXqBoard();
    xqState.turn = 'r';
    xqState.selected = null;
    xqState.legalForSel = [];
    xqState.history = [];
    xqState.lastMove = null;
    xqState.over = false;
    xqState.botThinking = false;
    xqState.initialized = true;
    setXqStatus('Lượt: Quân Đỏ đi trước', '');
    drawXqBoard();
  }

  function undoXiangqi() {
    if (xqState.botThinking || !xqState.history.length) return;
    var mode = $('xqModeSelect') ? $('xqModeSelect').value : 'bot';
    var steps = (mode === 'bot' && xqState.turn === 'r' && xqState.history.length >= 2) ? 2 : 1;
    var snap = null;
    for (var i = 0; i < steps && xqState.history.length; i++) {
      snap = xqState.history.pop();
    }
    if (!snap) return;
    xqState.board = snap.board;
    xqState.turn = snap.turn;
    xqState.lastMove = snap.lastMove;
    xqState.selected = null;
    xqState.legalForSel = [];
    xqState.over = false;
    setXqStatus('Đã đi lại. Lượt: ' + (xqState.turn === 'r' ? 'Quân Đỏ' : 'Quân Đen'), '');
    drawXqBoard();
  }

  $('xqModeSelect')?.addEventListener('change', function () {
    if ($('xqIqWrap')) $('xqIqWrap').hidden = $('xqModeSelect').value !== 'bot';
    initXiangqiGame();
  });
  $('xqIqSelect')?.addEventListener('change', initXiangqiGame);
  $('btnXqNew')?.addEventListener('click', initXiangqiGame);
  $('btnXqUndo')?.addEventListener('click', undoXiangqi);

  window.initXiangqiIfNeeded = function () {
    if (!xqState.initialized) initXiangqiGame();
  };
})();
