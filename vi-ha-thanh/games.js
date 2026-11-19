/* ==========================================================================
   2D MINI-GAMES ARCADE MODULE (HỘI CHỢ TRÒ CHƠI 2D PHỐ CỔ)
   Gồm 3 trò chơi 2D: 1. Hứng Đặc Sản | 2. Lật Thẻ Món Ngon | 3. Rắn Săn Món Ngon
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var section = $('gamesSection');
  var btnOpen = $('btnOpenGamesHero');
  if (!section) return;

  var activeTab = 'catch';
  // Standalone sound toggle support on games.html
  var sBtn = $('soundToggleBtn');
  function syncSoundBtn() {
    if (!sBtn) return;
    var on = localStorage.getItem('hanoi_phovi_sound') !== 'false';
    sBtn.innerHTML = on ? '<span>🔔</span> <span>Âm thanh: Bật</span>' : '<span>🔕</span> <span>Âm thanh: Tắt</span>';
  }
  syncSoundBtn();
  if (sBtn) {
    sBtn.addEventListener('click', function () {
      var on = localStorage.getItem('hanoi_phovi_sound') !== 'false';
      localStorage.setItem('hanoi_phovi_sound', on ? 'false' : 'true');
      syncSoundBtn();
    });
  }

  /* ---- Nhẹ nhàng phát âm thanh mini-game bằng Web Audio ---- */
  function beep(freq, dur, type) {
    try {
      if (localStorage.getItem('hanoi_phovi_sound') === 'false') return;
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!window._gameAudioCtx) window._gameAudioCtx = new Ctx();
      var ctx = window._gameAudioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.12));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (dur || 0.12));
    } catch (e) {}
  }

  /* ---- Section Scroll & Tab Switching ---- */
  function pauseAllGames() {
    catchStop();
    snakeStop();
    skStop();
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', function () {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  document.querySelectorAll('.games-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-game');
      if (!target || target === activeTab) return;
      pauseAllGames();
      activeTab = target;

      document.querySelectorAll('.games-tab').forEach(function (t) {
        var isSel = t.getAttribute('data-game') === target;
        t.classList.toggle('active', isSel);
        t.setAttribute('aria-selected', isSel ? 'true' : 'false');
      });

      if ($('gamePanelCatch')) $('gamePanelCatch').hidden = target !== 'catch';
      if ($('gamePanelMemory')) $('gamePanelMemory').hidden = target !== 'memory';
      if ($('gamePanelSnake')) $('gamePanelSnake').hidden = target !== 'snake';
      if ($('gamePanelDungeon')) $('gamePanelDungeon').hidden = target !== 'dungeon';
      if ($('gamePanelBlockBlast')) $('gamePanelBlockBlast').hidden = target !== 'blockblast';
      if ($('gamePanelChess')) $('gamePanelChess').hidden = target !== 'chess';
      if ($('gamePanelXiangqi')) $('gamePanelXiangqi').hidden = target !== 'xiangqi';

      if (target === 'memory' && $('memoryGrid') && !$('memoryGrid').children.length) {
        initMemoryGame();
      } else if (target === 'snake') {
        drawSnakeIdle();
      } else if (target === 'catch') {
        drawCatchIdle();
      } else if (target === 'dungeon') {
        drawSkIdle();
      } else if (target === 'blockblast' && !$('bbBoard')?.children.length) {
        initBlockBlast();
      } else if (target === 'chess' && typeof window.initChessIfNeeded === 'function') {
        window.initChessIfNeeded();
      } else if (target === 'xiangqi' && typeof window.initXiangqiIfNeeded === 'function') {
        window.initXiangqiIfNeeded();
      }
      renderLeaderboard(target);
    });
  });

  /* ========================================================================
     GAME 1: HỨNG ĐẶC SẢN PHỐ CỔ (2D Canvas Catcher)
     ======================================================================== */
  var catchCanvas = $('catchCanvas');
  var cCtx = catchCanvas ? catchCanvas.getContext('2d') : null;
  var catchRaf = null;
  var catchRunning = false;
  var catchBestKey = 'hanoi_phovi_catch_best';
  var catchState = {
    score: 0, combo: 1, lives: 3, best: parseInt(localStorage.getItem(catchBestKey) || '0', 10),
    trayX: 260, trayW: 94, trayH: 24, items: [], pops: [], sparks: [], shake: 0, spawnTick: 0, keys: { left: false, right: false }
  };
  if ($('catchBest')) $('catchBest').textContent = catchState.best;

  var CATCH_GOOD = [
    { icon: '🍜', pts: 10 }, { icon: '🥖', pts: 10 }, { icon: '🥟', pts: 15 },
    { icon: '🍧', pts: 15 }, { icon: '🍗', pts: 15 }, { icon: '🏮', pts: 30 }, { icon: '⭐', pts: 50 }
  ];
  var CATCH_BAD = [{ icon: '🌶️' }, { icon: '🦴' }];

  function drawCatchBackground() {
    if (!cCtx) return;
    var w = catchCanvas.width, h = catchCanvas.height;
    var grad = cCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFF8EA');
    grad.addColorStop(1, '#F3E4C8');
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, w, h);

    // Subtle vintage tile silhouettes at bottom
    cCtx.fillStyle = 'rgba(154, 38, 38, 0.08)';
    cCtx.fillRect(0, h - 42, w, 42);
    cCtx.strokeStyle = 'rgba(194, 135, 37, 0.35)';
    cCtx.beginPath();
    cCtx.moveTo(0, h - 42);
    cCtx.lineTo(w, h - 42);
    cCtx.stroke();
  }

  function drawCatchTray() {
    if (!cCtx) return;
    var x = catchState.trayX - catchState.trayW / 2;
    var y = catchCanvas.height - 34;
    var w = catchState.trayW, h = catchState.trayH;
    cCtx.fillStyle = 'rgba(45, 33, 24, 0.18)';
    cCtx.beginPath();
    cCtx.roundRect(x + 2, y + 4, w, h, 10);
    cCtx.fill();

    cCtx.fillStyle = '#B45309';
    cCtx.beginPath();
    cCtx.roundRect(x, y, w, h, 10);
    cCtx.fill();
    cCtx.strokeStyle = '#FDE68A';
    cCtx.lineWidth = 2.5;
    cCtx.stroke();
    cCtx.fillStyle = '#FEF3C7';
    cCtx.font = 'bold 11px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.fillText('MẸT PHỐ CỔ', catchState.trayX, y + 16);
  }

  function drawCatchIdle() {
    drawCatchBackground();
    drawCatchTray();
  }
  drawCatchIdle();

  function catchStop() {
    catchRunning = false;
    if (catchRaf) { cancelAnimationFrame(catchRaf); catchRaf = null; }
  }

  function updateCatchHUD() {
    if ($('catchScore')) $('catchScore').textContent = catchState.score;
    if ($('catchCombo')) $('catchCombo').textContent = 'x' + catchState.combo;
    if ($('catchLives')) $('catchLives').textContent = catchState.lives > 0 ? '❤️'.repeat(catchState.lives) : '💔';
    if ($('catchBest')) $('catchBest').textContent = catchState.best;
  }

  function startCatchGame() {
    if (!catchCanvas) return;
    catchStop();
    catchState.score = 0;
    catchState.combo = 1;
    catchState.lives = 3;
    catchState.items = [];
    catchState.pops = [];
    catchState.sparks = [];
    catchState.shake = 0;
    catchState.spawnTick = 0;
    catchState.trayX = catchCanvas.width / 2;
    updateCatchHUD();
    if ($('catchOverlay')) $('catchOverlay').hidden = true;
    catchRunning = true;
    catchLoop();
  }

  function endCatchGame() {
    catchStop();
    beep(200, 0.3, 'sawtooth');
    if (catchState.score > catchState.best) {
      catchState.best = catchState.score;
      try { localStorage.setItem(catchBestKey, String(catchState.best)); } catch (e) {}
    }
    updateCatchHUD();
    submitGameScore('catch', catchState.score);
    if ($('catchOverlayTitle')) $('catchOverlayTitle').textContent = 'Kết Thúc! Điểm: ' + catchState.score;
    if ($('catchOverlayDesc')) $('catchOverlayDesc').textContent = 'Kỷ lục hiện tại: ' + catchState.best + ' điểm. Bạn muốn chơi lại để phá kỷ lục không?';
    if ($('btnStartCatch')) $('btnStartCatch').textContent = '🔄 Chơi Lại';
    if ($('catchOverlay')) $('catchOverlay').hidden = false;
  }

  function catchLoop() {
    if (!catchRunning || !cCtx) return;
    var w = catchCanvas.width, h = catchCanvas.height;

    if (catchState.keys.left) catchState.trayX -= 7.5;
    if (catchState.keys.right) catchState.trayX += 7.5;
    catchState.trayX = Math.max(catchState.trayW / 2 + 4, Math.min(w - catchState.trayW / 2 - 4, catchState.trayX));

    catchState.spawnTick++;
    var spawnRate = Math.max(18, 35 - Math.floor(catchState.score / 120));
    if (catchState.spawnTick >= spawnRate) {
      catchState.spawnTick = 0;
      var isBad = Math.random() < 0.24;
      var pick = isBad
        ? CATCH_BAD[Math.floor(Math.random() * CATCH_BAD.length)]
        : CATCH_GOOD[Math.floor(Math.random() * CATCH_GOOD.length)];
      catchState.items.push({
        x: 28 + Math.random() * (w - 56),
        y: -22,
        vy: 2.4 + Math.random() * 1.6 + Math.min(2.8, catchState.score / 250),
        age: Math.random() * 10,
        icon: pick.icon,
        pts: pick.pts || 0,
        bad: isBad
      });
    }

    cCtx.save();
    if (catchState.shake > 0) {
      catchState.shake--;
      cCtx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
    }

    drawCatchBackground();

    var trayY = h - 34;
    var left = catchState.trayX - catchState.trayW / 2;
    var right = catchState.trayX + catchState.trayW / 2;

    for (var i = catchState.items.length - 1; i >= 0; i--) {
      var it = catchState.items[i];
      it.y += it.vy;
      it.age += 0.14;

      // Landing shadow indicator on floor
      var prox = Math.max(0.15, Math.min(1, it.y / trayY));
      cCtx.fillStyle = it.bad ? 'rgba(220, 38, 38, ' + (prox * 0.35) + ')' : 'rgba(180, 83, 9, ' + (prox * 0.28) + ')';
      cCtx.beginPath();
      cCtx.ellipse(it.x, h - 10, 12 * prox, 3.5 * prox, 0, 0, Math.PI * 2);
      cCtx.fill();

      // Speed motion trail lines above item
      cCtx.strokeStyle = it.bad ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)';
      cCtx.lineWidth = 2;
      cCtx.beginPath();
      cCtx.moveTo(it.x - 7, it.y - 22);
      cCtx.lineTo(it.x - 7, it.y - 36 - it.vy * 2);
      cCtx.moveTo(it.x + 7, it.y - 20);
      cCtx.lineTo(it.x + 7, it.y - 32 - it.vy * 2);
      cCtx.stroke();

      // Glowing circular aura badge behind falling item
      cCtx.save();
      cCtx.translate(it.x, it.y);
      cCtx.rotate(Math.sin(it.age) * 0.18);
      cCtx.fillStyle = it.bad ? 'rgba(254, 226, 226, 0.92)' : 'rgba(255, 251, 235, 0.92)';
      cCtx.beginPath();
      cCtx.arc(0, -4, 18, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.strokeStyle = it.bad ? '#EF4444' : (it.pts >= 30 ? '#F59E0B' : '#10B981');
      cCtx.lineWidth = 2.2;
      cCtx.stroke();

      cCtx.font = '24px sans-serif';
      cCtx.textAlign = 'center';
      cCtx.textBaseline = 'middle';
      cCtx.fillText(it.icon, 0, -3);
      cCtx.restore();

      // Collision with tray
      if (it.y >= trayY - 8 && it.y <= trayY + 24 && it.x >= left - 12 && it.x <= right + 12) {
        if (it.bad) {
          catchState.lives -= 1;
          catchState.combo = 1;
          catchState.shake = 10;
          catchState.pops.push({ x: it.x, y: trayY - 16, txt: '-1 ❤️', color: '#DC2626', life: 32 });
          for (var sp = 0; sp < 8; sp++) {
            catchState.sparks.push({ x: it.x, y: trayY, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, color: '#EF4444', life: 18 });
          }
          beep(180, 0.16, 'square');
        } else {
          var gained = it.pts * catchState.combo;
          catchState.score += gained;
          catchState.combo = Math.min(5, catchState.combo + 1);
          catchState.pops.push({ x: it.x, y: trayY - 16, txt: '+' + gained, color: '#059669', life: 32 });
          for (var sp2 = 0; sp2 < 8; sp2++) {
            catchState.sparks.push({ x: it.x, y: trayY, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, color: '#F59E0B', life: 18 });
          }
          beep(660 + catchState.combo * 70, 0.09, 'sine');
        }
        catchState.items.splice(i, 1);
        updateCatchHUD();
        if (catchState.lives <= 0) {
          cCtx.restore();
          endCatchGame();
          return;
        }
        continue;
      }

      if (it.y > h + 26) {
        if (!it.bad) {
          catchState.combo = 1;
          updateCatchHUD();
        }
        catchState.items.splice(i, 1);
      }
    }

    drawCatchTray();

    // Catch burst sparkles
    for (var si = catchState.sparks.length - 1; si >= 0; si--) {
      var skp = catchState.sparks[si];
      skp.x += skp.vx; skp.y += skp.vy; skp.vy += 0.18; skp.life--;
      cCtx.fillStyle = skp.color;
      cCtx.beginPath();
      cCtx.arc(skp.x, skp.y, 3, 0, Math.PI * 2);
      cCtx.fill();
      if (skp.life <= 0) catchState.sparks.splice(si, 1);
    }

    // Floating score pops
    for (var p = catchState.pops.length - 1; p >= 0; p--) {
      var pop = catchState.pops[p];
      pop.y -= 1.3;
      pop.life--;
      cCtx.fillStyle = pop.color;
      cCtx.font = 'bold 15px sans-serif';
      cCtx.textAlign = 'center';
      cCtx.fillText(pop.txt, pop.x, pop.y);
      if (pop.life <= 0) catchState.pops.splice(p, 1);
    }

    cCtx.restore();
    catchRaf = requestAnimationFrame(catchLoop);
  }

  if (catchCanvas) {
    catchCanvas.addEventListener('pointermove', function (e) {
      if (!catchRunning) return;
      var rect = catchCanvas.getBoundingClientRect();
      var scaleX = catchCanvas.width / rect.width;
      catchState.trayX = Math.max(catchState.trayW / 2 + 4, Math.min(catchCanvas.width - catchState.trayW / 2 - 4, (e.clientX - rect.left) * scaleX));
    });
  }
  $('btnStartCatch')?.addEventListener('click', startCatchGame);

  /* ========================================================================
     GAME 2: LẬT THẺ MÓN NGON (2D Memory Match 4x4)
     ======================================================================== */
  var MEM_PAIRS = [
    { id: 'pho', icon: '🍜', label: 'Phở Bò' },
    { id: 'buncha', icon: '🍢', label: 'Bún Chả' },
    { id: 'che', icon: '🍧', label: 'Chè Bốn Mùa' },
    { id: 'banhmi', icon: '🥖', label: 'Bánh Mì' },
    { id: 'dimsum', icon: '🥟', label: 'Dimsum' },
    { id: 'chicken', icon: '🍗', label: 'Gà Rán Hàn' },
    { id: 'cafe', icon: '☕', label: 'Cà Phê Trứng' },
    { id: 'hotpot', icon: '🍲', label: 'Lẩu Riêu Cua' }
  ];
  var memBestKey = 'hanoi_phovi_mem_best';
  var memState = { flipped: [], matched: 0, moves: 0, lock: false, secs: 0, timer: null };

  function updateMemHUD() {
    if ($('memMoves')) $('memMoves').textContent = memState.moves;
    if ($('memMatches')) $('memMatches').textContent = memState.matched + '/8';
    if ($('memTime')) $('memTime').textContent = memState.secs + 's';
    var best = localStorage.getItem(memBestKey);
    if ($('memBest')) $('memBest').textContent = best ? best + ' lượt' : '--';
  }

  function initMemoryGame() {
    var grid = $('memoryGrid');
    if (!grid) return;
    if (memState.timer) { clearInterval(memState.timer); memState.timer = null; }
    memState.flipped = [];
    memState.matched = 0;
    memState.moves = 0;
    memState.lock = false;
    memState.secs = 0;
    updateMemHUD();

    var deck = MEM_PAIRS.concat(MEM_PAIRS).slice().sort(function () { return Math.random() - 0.5; });
    grid.innerHTML = deck.map(function (card, idx) {
      return '<button type="button" class="mem-card" data-id="' + card.id + '" data-idx="' + idx + '" aria-label="Thẻ món ngon">' +
        '<div class="mem-face mem-front">🏮</div>' +
        '<div class="mem-face mem-back"><span class="mem-emoji">' + card.icon + '</span><span class="mem-label">' + card.label + '</span></div>' +
        '</button>';
    }).join('');

    grid.querySelectorAll('.mem-card').forEach(function (el) {
      el.addEventListener('click', function () {
        if (memState.lock || el.classList.contains('flipped') || el.classList.contains('matched')) return;
        if (!memState.timer) {
          memState.timer = setInterval(function () {
            memState.secs++;
            if ($('memTime')) $('memTime').textContent = memState.secs + 's';
          }, 1000);
        }
        el.classList.add('flipped');
        beep(520, 0.06, 'sine');
        memState.flipped.push(el);

        if (memState.flipped.length === 2) {
          memState.moves++;
          memState.lock = true;
          var c1 = memState.flipped[0], c2 = memState.flipped[1];
          if (c1.getAttribute('data-id') === c2.getAttribute('data-id')) {
            c1.classList.add('matched');
            c2.classList.add('matched');
            memState.matched++;
            memState.flipped = [];
            memState.lock = false;
            beep(880, 0.14, 'triangle');
            updateMemHUD();

            if (memState.matched === 8) {
              clearInterval(memState.timer);
              memState.timer = null;
              var prevBest = parseInt(localStorage.getItem(memBestKey) || '999', 10);
              if (memState.moves < prevBest) {
                try { localStorage.setItem(memBestKey, String(memState.moves)); } catch (e) {}
              }
              updateMemHUD();
              submitGameScore('memory', memState.moves);
              setTimeout(function () {
                beep(1046, 0.25, 'sine');
                window.alert('🎉 Tuyệt vời! Bạn đã ghép đủ 8 cặp món ngon Hà Nội trong ' + memState.moves + ' lượt (' + memState.secs + ' giây)!');
              }, 350);
            }
          } else {
            updateMemHUD();
            setTimeout(function () {
              c1.classList.remove('flipped');
              c2.classList.remove('flipped');
              memState.flipped = [];
              memState.lock = false;
            }, 680);
          }
        }
      });
    });
  }
  $('btnRestartMemory')?.addEventListener('click', initMemoryGame);

  /* ========================================================================
     GAME 3: RẮN SĂN MÓN NGON (Smooth 60fps Interpolated 2D Snake)
     ======================================================================== */
  var snakeCanvas = $('snakeCanvas');
  var sCtx = snakeCanvas ? snakeCanvas.getContext('2d') : null;
  var snakeRaf = null;
  var snakeRunning = false;
  var snakeLastStep = 0;
  var snakeStepMs = 125;
  var snakeBestKey = 'hanoi_phovi_snake_best';
  var CELL = 20;
  var COLS = 20, ROWS = 18;
  var SNAKE_FOODS = ['🍜', '🥟', '🍧', '🍗', '🥖', '🍢'];
  var snakeState = {
    body: [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }],
    prevBody: [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }],
    dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, dirQueue: [],
    food: { x: 14, y: 9, icon: '🍜' }, score: 0,
    particles: [], popups: [],
    best: parseInt(localStorage.getItem(snakeBestKey) || '0', 10)
  };
  if ($('snakeBest')) $('snakeBest').textContent = snakeState.best;

  function updateSnakeHUD() {
    if ($('snakeScore')) $('snakeScore').textContent = snakeState.score;
    if ($('snakeLength')) $('snakeLength').textContent = snakeState.body.length;
    if ($('snakeBest')) $('snakeBest').textContent = snakeState.best;
  }

  function spawnSnakeFood() {
    var pt;
    do {
      pt = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snakeState.body.some(function (b) { return b.x === pt.x && b.y === pt.y; }));
    snakeState.food = { x: pt.x, y: pt.y, icon: SNAKE_FOODS[Math.floor(Math.random() * SNAKE_FOODS.length)] };
  }

  function drawSnakeBoard(lerpT, nowMs) {
    if (!sCtx) return;
    var t = typeof lerpT === 'number' ? Math.max(0, Math.min(1, lerpT)) : 1;
    var ms = nowMs || 0;
    var pulse = Math.sin(ms * 0.006) * 0.8;
    var w = snakeCanvas.width, h = snakeCanvas.height;

    // Google Snake bright green grass checkerboard
    for (var gx = 0; gx < COLS; gx++) {
      for (var gy = 0; gy < ROWS; gy++) {
        sCtx.fillStyle = (gx + gy) % 2 === 0 ? '#AAD751' : '#A2D149';
        sCtx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
      }
    }

    // Classic dark green outer grass border
    sCtx.strokeStyle = '#578A34';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(2, 2, w - 4, h - 4);

    // Google Snake crisp red apple with stem, green leaf & shadow
    var fx = snakeState.food.x * CELL + CELL / 2;
    var fy = snakeState.food.y * CELL + CELL / 2;
    var appleR = 7.6 + pulse * 0.45;

    // Soft shadow under apple
    sCtx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    sCtx.beginPath();
    sCtx.ellipse(fx, fy + 6.5, appleR * 0.85, 3, 0, 0, Math.PI * 2);
    sCtx.fill();

    // Red apple body
    var appleGrad = sCtx.createRadialGradient(fx - 2.5, fy - 2, 1.5, fx, fy + 1, appleR);
    appleGrad.addColorStop(0, '#FF6B57');
    appleGrad.addColorStop(0.65, '#E7471D');
    appleGrad.addColorStop(1, '#B92B0C');
    sCtx.fillStyle = appleGrad;
    sCtx.beginPath();
    sCtx.arc(fx, fy + 1, appleR, 0, Math.PI * 2);
    sCtx.fill();

    // Stem & green leaf
    sCtx.strokeStyle = '#6D4C2F';
    sCtx.lineWidth = 2;
    sCtx.lineCap = 'round';
    sCtx.beginPath();
    sCtx.moveTo(fx, fy - appleR + 2);
    sCtx.quadraticCurveTo(fx + 1, fy - appleR - 2.5, fx + 2.5, fy - appleR - 3);
    sCtx.stroke();

    sCtx.fillStyle = '#4CA626';
    sCtx.beginPath();
    sCtx.ellipse(fx + 3.8, fy - appleR - 0.8, 3.6, 2, -0.45, 0, Math.PI * 2);
    sCtx.fill();

    // Build smoothly interpolated segment centers
    var pts = [];
    for (var i = 0; i < snakeState.body.length; i++) {
      var cur = snakeState.body[i];
      var prv = snakeState.prevBody[i] || cur;
      var ix = prv.x + (cur.x - prv.x) * t;
      var iy = prv.y + (cur.y - prv.y) * t;
      pts.push({ x: ix * CELL + CELL / 2, y: iy * CELL + CELL / 2 });
    }

    // Soft drop shadow beneath blue snake body
    if (pts.length > 1) {
      sCtx.save();
      sCtx.lineCap = 'round';
      sCtx.lineJoin = 'round';
      sCtx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
      sCtx.lineWidth = 15;
      sCtx.beginPath();
      sCtx.moveTo(pts[0].x, pts[0].y + 2.5);
      for (var sh = 1; sh < pts.length; sh++) sCtx.lineTo(pts[sh].x, pts[sh].y + 2.5);
      sCtx.stroke();
      sCtx.restore();
    }

    // Smooth continuous Google Snake blue body (#4E7CF6)
    if (pts.length > 1) {
      sCtx.lineCap = 'round';
      sCtx.lineJoin = 'round';
      sCtx.strokeStyle = '#3B64D8';
      sCtx.lineWidth = 15;
      sCtx.beginPath();
      sCtx.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length; j++) sCtx.lineTo(pts[j].x, pts[j].y);
      sCtx.stroke();

      sCtx.strokeStyle = '#4E7CF6';
      sCtx.lineWidth = 12.5;
      sCtx.beginPath();
      sCtx.moveTo(pts[0].x, pts[0].y);
      for (var k = 1; k < pts.length; k++) sCtx.lineTo(pts[k].x, pts[k].y);
      sCtx.stroke();
    }

    // Google Snake Head (blue rounded head + big white eyes looking toward the apple)
    if (pts.length > 0) {
      var hd = pts[0];
      var dx = snakeState.dir.x, dy = snakeState.dir.y;
      var distFood = Math.hypot(fx - hd.x, fy - hd.y);

      // Subtle red tongue flick when moving
      if (distFood < 48 || Math.floor(ms / 240) % 3 === 0) {
        sCtx.strokeStyle = '#EF4444';
        sCtx.lineWidth = 1.8;
        sCtx.lineCap = 'round';
        sCtx.beginPath();
        sCtx.moveTo(hd.x + dx * 8, hd.y + dy * 8);
        sCtx.lineTo(hd.x + dx * 13, hd.y + dy * 13);
        sCtx.stroke();
      }

      // Rounded blue head slightly wider than body
      sCtx.fillStyle = '#4E7CF6';
      sCtx.beginPath();
      sCtx.arc(hd.x, hd.y, 9.2, 0, Math.PI * 2);
      sCtx.fill();

      // Cute cheek bumps for eyes
      var epx = -dy * 4.5, epy = dx * 4.5;
      var ex = hd.x + dx * 2.2, ey = hd.y + dy * 2.2;
      sCtx.fillStyle = '#4E7CF6';
      sCtx.beginPath();
      sCtx.arc(ex + epx, ey + epy, 4.6, 0, Math.PI * 2);
      sCtx.arc(ex - epx, ey - epy, 4.6, 0, Math.PI * 2);
      sCtx.fill();

      // Big white eyes
      sCtx.fillStyle = '#FFFFFF';
      sCtx.beginPath();
      sCtx.arc(ex + epx, ey + epy, 3.3, 0, Math.PI * 2);
      sCtx.arc(ex - epx, ey - epy, 3.3, 0, Math.PI * 2);
      sCtx.fill();

      // Pupils track toward the apple!
      var angFood = Math.atan2(fy - hd.y, fx - hd.x);
      var lx = Math.cos(angFood) * 1.1;
      var ly = Math.sin(angFood) * 1.1;
      sCtx.fillStyle = '#111827';
      sCtx.beginPath();
      sCtx.arc(ex + epx + lx, ey + epy + ly, 1.7, 0, Math.PI * 2);
      sCtx.arc(ex - epx + lx, ey - epy + ly, 1.7, 0, Math.PI * 2);
      sCtx.fill();
    }

    // Sparkle particles when eating apple
    for (var pi = snakeState.particles.length - 1; pi >= 0; pi--) {
      var pt = snakeState.particles[pi];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      sCtx.globalAlpha = Math.max(0, pt.life / 18);
      sCtx.fillStyle = pt.color;
      sCtx.beginPath();
      sCtx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.globalAlpha = 1;
      if (pt.life <= 0) snakeState.particles.splice(pi, 1);
    }

    // Floating +10 score popups
    for (var ppi = snakeState.popups.length - 1; ppi >= 0; ppi--) {
      var pp = snakeState.popups[ppi];
      pp.y -= 0.7;
      pp.life--;
      sCtx.save();
      sCtx.globalAlpha = Math.max(0, pp.life / 24);
      sCtx.fillStyle = '#FFFFFF';
      sCtx.strokeStyle = '#3B64D8';
      sCtx.lineWidth = 2.5;
      sCtx.font = 'bold 13px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.strokeText(pp.text, pp.x, pp.y);
      sCtx.fillText(pp.text, pp.x, pp.y);
      sCtx.restore();
      if (pp.life <= 0) snakeState.popups.splice(ppi, 1);
    }
  }

  function drawSnakeIdle() { drawSnakeBoard(1, 0); }

  function snakeStop() {
    snakeRunning = false;
    if (snakeRaf) { cancelAnimationFrame(snakeRaf); snakeRaf = null; }
  }

  function startSnakeGame() {
    snakeStop();
    snakeState.body = [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }];
    snakeState.prevBody = [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }];
    snakeState.dir = { x: 1, y: 0 };
    snakeState.nextDir = { x: 1, y: 0 };
    snakeState.dirQueue = [];
    snakeState.score = 0;
    snakeState.particles = [];
    snakeState.popups = [];
    snakeStepMs = 125;
    spawnSnakeFood();
    updateSnakeHUD();
    if ($('snakeOverlay')) $('snakeOverlay').hidden = true;
    snakeRunning = true;
    snakeLastStep = performance.now();
    snakeRaf = requestAnimationFrame(snakeLoop);
  }

  function endSnakeGame() {
    snakeStop();
    beep(170, 0.28, 'sawtooth');
    if (snakeState.score > snakeState.best) {
      snakeState.best = snakeState.score;
      try { localStorage.setItem(snakeBestKey, String(snakeState.best)); } catch (e) {}
    }
    updateSnakeHUD();
    submitGameScore('snake', snakeState.score);
    if ($('snakeOverlayTitle')) $('snakeOverlayTitle').textContent = 'Hết Lượt! Điểm: ' + snakeState.score;
    if ($('snakeOverlayDesc')) $('snakeOverlayDesc').textContent = 'Độ dài chú Rồng: ' + snakeState.body.length + ' • Kỷ lục: ' + snakeState.best + ' điểm.';
    if ($('btnStartSnake')) $('btnStartSnake').textContent = '🔄 Chơi Lại';
    if ($('snakeOverlay')) $('snakeOverlay').hidden = false;
  }

  function snakeStep() {
    snakeState.prevBody = snakeState.body.map(function (b) { return { x: b.x, y: b.y }; });
    if (snakeState.dirQueue.length) {
      snakeState.nextDir = snakeState.dirQueue.shift();
    }
    snakeState.dir = snakeState.nextDir;
    var head = { x: snakeState.body[0].x + snakeState.dir.x, y: snakeState.body[0].y + snakeState.dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        snakeState.body.some(function (b) { return b.x === head.x && b.y === head.y; })) {
      endSnakeGame();
      return false;
    }

    snakeState.body.unshift(head);
    if (head.x === snakeState.food.x && head.y === snakeState.food.y) {
      snakeState.score += 10;
      snakeStepMs = Math.max(82, 125 - Math.floor(snakeState.score / 25));
      var eatX = head.x * CELL + CELL / 2;
      var eatY = head.y * CELL + CELL / 2;
      for (var ep = 0; ep < 10; ep++) {
        var ea = (Math.PI * 2 * ep) / 10;
        var es = 1.2 + Math.random() * 1.8;
        snakeState.particles.push({
          x: eatX, y: eatY,
          vx: Math.cos(ea) * es, vy: Math.sin(ea) * es,
          color: ep % 2 === 0 ? '#FDE047' : '#34D399', life: 18
        });
      }
      snakeState.popups.push({ x: eatX, y: eatY - 6, text: '+10', life: 24 });
      beep(740, 0.08, 'sine');
      spawnSnakeFood();
      updateSnakeHUD();
    } else {
      snakeState.body.pop();
    }
    return true;
  }

  function snakeLoop(now) {
    if (!snakeRunning) return;
    while (now - snakeLastStep >= snakeStepMs) {
      snakeLastStep += snakeStepMs;
      if (!snakeStep()) return;
    }
    var progress = (now - snakeLastStep) / snakeStepMs;
    drawSnakeBoard(progress, now);
    snakeRaf = requestAnimationFrame(snakeLoop);
  }

  function setSnakeDir(dirName) {
    if (!snakeRunning) return;
    var last = snakeState.dirQueue.length ? snakeState.dirQueue[snakeState.dirQueue.length - 1] : snakeState.dir;
    var cand = null;
    if (dirName === 'up' && last.y === 0) cand = { x: 0, y: -1 };
    else if (dirName === 'down' && last.y === 0) cand = { x: 0, y: 1 };
    else if (dirName === 'left' && last.x === 0) cand = { x: -1, y: 0 };
    else if (dirName === 'right' && last.x === 0) cand = { x: 1, y: 0 };
    if (cand && snakeState.dirQueue.length < 2) snakeState.dirQueue.push(cand);
  }

  $('btnStartSnake')?.addEventListener('click', startSnakeGame);
  document.querySelectorAll('.dpad-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setSnakeDir(btn.getAttribute('data-dir')); });
  });

  /* ========================================================================
     GAME 4: HIỆP SĨ LINH HỒN (SOUL KNIGHT - CHILLYROOM OFFICIAL ART)
     ======================================================================== */
  var skCanvas = $('skCanvas');
  var skCtx = skCanvas ? skCanvas.getContext('2d') : null;
  var skRaf = null;
  var skRunning = false;
  var skBestKey = 'hanoi_phovi_sk_best';

  var SK_IMG_URLS = {
    floorBg:  'https://soulknight.chillyroom.com/_next/static/media/bg.4f7e0b8a.jpg',
    basin:    'https://soulknight.chillyroom.com/_next/static/media/basin.d21b26ae.png',
    fire:     'https://soulknight.chillyroom.com/_next/static/media/fire.c5963cb1.gif',
    fence:    'https://soulknight.chillyroom.com/_next/static/media/fence.a2a07bde.png',
    boss:     'https://soulknight.chillyroom.com/_next/static/media/boss.9e2fc2a1.gif',
    cat:      'https://soulknight.chillyroom.com/_next/static/media/cat.0e4e459f.gif',
    knight:   'https://soulknight.chillyroom.com/_next/static/media/npc.c9c45064.gif',
    assassin: 'https://soulknight.chillyroom.com/_next/static/media/npc_left_1.ec8c58a6.png',
    engineer: 'https://soulknight.chillyroom.com/_next/static/media/npc_right_1.77f1de5b.png',
    paladin:  'https://soulknight.chillyroom.com/_next/static/media/npc_2.7989b52c.gif'
  };
  var SK_IMG = {};
  Object.keys(SK_IMG_URLS).forEach(function (k) {
    var img = new Image();
    img.src = SK_IMG_URLS[k];
    SK_IMG[k] = img;
  });

  function skImgReady(key) {
    var im = SK_IMG[key];
    return !!(im && im.complete && im.naturalWidth > 0);
  }

  var skWeapons = [
    { name: 'Laser', cost: 1, cd: 10, color: '#38BDF8', speed: 8.5, dmg: 2, spread: 1 },
    { name: 'Gậy Lửa', cost: 3, cd: 22, color: '#FB923C', speed: 6.2, dmg: 2, spread: 3 },
    { name: 'Kiếm', cost: 0, cd: 16, color: '#FDE047', speed: 0, dmg: 4, melee: true }
  ];

  var sk = {
    px: 280, py: 280, hp: 6, maxHp: 6, shield: 5, maxShield: 5, energy: 180, maxEnergy: 200,
    heroId: 'knight', ultCd: 0, ultActive: 0, pet: { x: 250, y: 300, cd: 60 },
    exp: 0, level: 1, nextExp: 40, pausedForLevel: false,
    shieldRegenTick: 0, invuln: 0, dashTick: 0, dashCd: 0, dashDx: 0, dashDy: 0,
    wpnIdx: 0, fireCd: 0, slashTick: 0, slashAngle: 0,
    wave: 1, score: 0, best: parseInt(localStorage.getItem(skBestKey) || '0', 10),
    aimX: 280, aimY: 120, mouseDown: false, autoFire: false,
    keys: { w: false, a: false, s: false, d: false },
    buffs: {},
    portal: null, biomeBannerTick: 0, turret: null, thunderTick: 0, heroStats: null,
    bullets: [], eBullets: [], enemies: [], crates: [], drops: [], expGems: [], gemDrops: [], zones: [], zaps: [], spikes: [], particles: [], ghosts: []
  };
  if ($('skBest')) $('skBest').textContent = sk.best;

  var SK_BIOMES = [
    { name: 'VÙNG 1: HẦM NGỤC ĐÁ CỔ', shortName: '🏰 Đá Cổ', floor1: '#232030', floor2: '#2B273B', floor3: '#262235', wall: '#524C6E', pillar: '#3F3A56', pillarTop: '#6B638E' },
    { name: 'VÙNG 2: LÒ DUNG NHAM RỰC LỬA', shortName: '🌋 Dung Nham', floor1: '#281410', floor2: '#381B14', floor3: '#2E1610', wall: '#9A3412', pillar: '#572415', pillarTop: '#EA580C' },
    { name: 'VÙNG 3: ĐỈNH BĂNG GIÁ VĨNH CỬU', shortName: '❄️ Băng Giá', floor1: '#0F2438', floor2: '#16324D', floor3: '#122A40', wall: '#0284C7', pillar: '#1E4976', pillarTop: '#7DD3FC' },
    { name: 'VÙNG 4: ĐỀN THỜ HƯ KHÔNG', shortName: '🌌 Hư Không', floor1: '#1A102B', floor2: '#271842', floor3: '#201436', wall: '#7C3AED', pillar: '#3B2063', pillarTop: '#C084FC' }
  ];

  function getCurrentBiome() {
    return SK_BIOMES[Math.floor((sk.wave - 1) / 10) % SK_BIOMES.length];
  }

  var SK_SKILLS = [
    { id: 'exp_boost',    icon: '💎', name: 'Hiền Triết (+35% EXP)', desc: 'Nhận thêm 35% kinh nghiệm từ mọi ngọc EXP và qua tầng.' },
    { id: 'fire_elem',    icon: '🔥', name: 'Đạn Nguyên Tố Lửa', desc: 'Đạn thiêu đốt mục tiêu, gây sát thương cháy liên tục.' },
    { id: 'ice_elem',     icon: '❄️', name: 'Đạn Nguyên Tố Băng', desc: 'Đạn làm chậm 45% tốc độ chạy & tốc độ bắn của quái.' },
    { id: 'bolt_elem',    icon: '⚡', name: 'Đạn Nguyên Tố Sét', desc: 'Khi trúng quái phóng tia sét giật lan sang quái gần bên.' },
    { id: 'poison_elem',  icon: '☠️', name: 'Đạn Độc Hoàng Tuyền', desc: 'Đạn nhiễm độc rút máu quái liên tục mỗi giây.' },
    { id: 'elem_zone',    icon: '🌋', name: 'Tạo Vùng Nguyên Tố', desc: 'Tạo vòng vùng nguyên tố dưới chân quái gây sát thương & làm chậm.' },
    { id: 'fire_rate',    icon: '🔫', name: 'Tăng Tốc Độ Bắn', desc: 'Tăng +22% tốc độ bắn cho mọi loại vũ khí.' },
    { id: 'multi_shot',   icon: '✨', name: 'Bắn Nhiều Tia Hơn', desc: 'Cộng thêm +2 tia đạn mỗi lần bắn (Kiếm bắn thêm kiếm khí).' },
    { id: 'ricochet',     icon: '🔄', name: 'Đạn Nảy Tường', desc: 'Đạn tự động bật nảy khi chạm tường hoặc cột đá (tối đa +4 lần).' },
    { id: 'thunder_nova', icon: '🌩️', name: 'Lôi Đình Giáng Thế', desc: 'Mỗi 3.5 giây tự động giáng sét từ trời xuống quái gần nhất.' },
    { id: 'clone_turret', icon: '🤖', name: 'Pháo Đài Phố Cổ', desc: 'Triệu hồi ụ súng tự động hỗ trợ bắn quái mỗi khi vào tầng.' },
    { id: 'vitality',     icon: '🛡️', name: 'Giáp & Sinh Lực', desc: 'Tăng +2 ❤️ Máu tối đa, +2 🛡️ Giáp tối đa và hồi đầy.' },
    { id: 'dash_nova',    icon: '💨', name: 'Lướt Xung Kích', desc: 'Giảm 30% hồi chiêu Lướt và tạo vùng nguyên tố khi lướt.' },
    { id: 'vampirism',    icon: '🩸', name: 'Hút Máu Huyết Tế', desc: '20% cơ hội hồi +1 ❤️ Máu mỗi khi hạ gục quái vật.' },
    { id: 'orbit_shield', icon: '🌀', name: 'Vệ Tinh Hộ Mệnh', desc: 'Tạo quả cầu năng lượng xoay quanh chắn đạn & gây sát thương quái.' },
    { id: 'explosive',    icon: '💥', name: 'Đạn Nổ Lan', desc: 'Đạn khi trúng quái phát nổ gây sát thương diện rộng xung quanh.' },
    { id: 'crit_pierce',  icon: '🎯', name: 'Chí Mạng & Xuyên Thấu', desc: '+25% tỉ lệ bạo kích x2 sát thương và đạn xuyên thêm 1 mục tiêu.' },
    { id: 'energy_regen', icon: '🔋', name: 'Hồi Năng Lượng Siêu Tốc', desc: 'Tự động hồi +3 ⚡ mỗi giây và tăng +40 năng lượng tối đa.' }
  ];

  function calcNextExp(lvl) {
    return Math.round(40 * Math.pow(1.42, lvl - 1));
  }

  function getBuffLvl(id) {
    return sk.buffs[id] || 0;
  }

  function renderActiveBuffs() {
    var box = $('skActiveBuffs');
    if (!box) return;
    var keys = Object.keys(sk.buffs).filter(function (k) { return sk.buffs[k] > 0; });
    if (!keys.length) {
      box.innerHTML = '<span class="sk-buff-empty">💎 Nhặt ngọc EXP từ quái để lên cấp &amp; mở khóa kỹ năng nguyên tố!</span>';
      return;
    }
    box.innerHTML = keys.map(function (k) {
      var meta = SK_SKILLS.find(function (s) { return s.id === k; });
      if (!meta) return '';
      return '<span class="sk-buff-pill">' + meta.icon + ' ' + meta.name.split(' (')[0] + ' Lv.' + sk.buffs[k] + '</span>';
    }).join('');
  }

  // Stone dungeon pillars (cover blocks like Soul Knight)
  var SK_PILLARS = [
    { x: 110, y: 90, w: 44, h: 44 },
    { x: 406, y: 90, w: 44, h: 44 },
    { x: 110, y: 226, w: 44, h: 44 },
    { x: 406, y: 226, w: 44, h: 44 }
  ];

  function skStop() {
    skRunning = false;
    sk.pausedForLevel = false;
    sk.mouseDown = false;
    sk.autoFire = false;
    if (skRaf) { cancelAnimationFrame(skRaf); skRaf = null; }
  }

  function updateSkHUD() {
    if ($('skHp')) $('skHp').textContent = sk.hp + '/' + sk.maxHp;
    if ($('skShield')) $('skShield').textContent = sk.shield + '/' + sk.maxShield;
    if ($('skEnergy')) $('skEnergy').textContent = sk.energy;
    var biome = getCurrentBiome();
    if ($('skBiome')) $('skBiome').textContent = biome.shortName;
    if ($('skWave')) $('skWave').textContent = sk.wave;
    if ($('skScore')) $('skScore').textContent = sk.score;
    if ($('skBest')) $('skBest').textContent = sk.best;
    if ($('skLevel')) $('skLevel').textContent = sk.level;
    var pct = Math.min(100, Math.round((sk.exp / sk.nextExp) * 100));
    if ($('skExpFill')) $('skExpFill').style.width = pct + '%';
    if ($('skExpText')) $('skExpText').textContent = sk.exp + ' / ' + sk.nextExp + ' EXP';
  }

  function grantSkExp(baseAmt) {
    var mult = 1 + getBuffLvl('exp_boost') * 0.35;
    sk.exp += Math.max(1, Math.round(baseAmt * mult));
    if (sk.exp >= sk.nextExp) {
      triggerSkLevelUp();
    } else {
      updateSkHUD();
    }
  }

  function triggerSkLevelUp() {
    sk.exp -= sk.nextExp;
    sk.level++;
    sk.nextExp = calcNextExp(sk.level);
    sk.pausedForLevel = true;
    sk.mouseDown = false;
    sk.autoFire = false;
    updateSkHUD();
    beep(1046, 0.14, 'triangle');
    setTimeout(function () { beep(1318, 0.18, 'triangle'); }, 110);

    if ($('skNewLevelNum')) $('skNewLevelNum').textContent = sk.level;
    var pool = SK_SKILLS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    var container = $('skSkillCards');
    if (container) {
      container.innerHTML = pool.map(function (s) {
        var curLv = getBuffLvl(s.id);
        return '<button type="button" class="sk-skill-card" data-skill="' + s.id + '">' +
          '<span class="sk-skill-icon">' + s.icon + '</span>' +
          '<span class="sk-skill-name">' + s.name + '</span>' +
          '<span class="sk-skill-desc">' + s.desc + '</span>' +
          '<span class="sk-skill-lvl">' + (curLv > 0 ? 'Cấp ' + curLv + ' → ' + (curLv + 1) : 'Mới • Cấp 1') + '</span>' +
        '</button>';
      }).join('');

      container.querySelectorAll('.sk-skill-card').forEach(function (btn) {
        btn.addEventListener('click', function () {
          applySkSkill(btn.getAttribute('data-skill'));
        });
      });
    }
    if ($('skLevelUpOverlay')) $('skLevelUpOverlay').hidden = false;
  }

  function applySkSkill(skillId) {
    if (!skillId) return;
    sk.buffs[skillId] = (sk.buffs[skillId] || 0) + 1;
    if (skillId === 'vitality') {
      sk.maxHp += 2;
      sk.maxShield += 2;
      sk.hp = Math.min(sk.maxHp, sk.hp + 2);
      sk.shield = sk.maxShield;
    } else if (skillId === 'energy_regen') {
      sk.maxEnergy += 40;
      sk.energy = Math.min(sk.maxEnergy, sk.energy + 40);
    }
    renderActiveBuffs();
    updateSkHUD();
    if ($('skLevelUpOverlay')) $('skLevelUpOverlay').hidden = true;
    sk.pausedForLevel = false;
    beep(880, 0.1, 'sine');

    // If leftover EXP still exceeds next level, trigger next level cleanly
    if (sk.exp >= sk.nextExp) {
      triggerSkLevelUp();
    } else if (skRunning) {
      skRaf = requestAnimationFrame(skLoop);
    }
  }

  function selectSkWeapon(idx) {
    if (window.SKHub && window.SKHub.getChallenge() === 'melee_only') idx = 2;
    sk.wpnIdx = idx;
    document.querySelectorAll('.sk-wpn-btn').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.getAttribute('data-wpn'), 10) === idx);
    });
  }

  function hitsPillar(x, y, r) {
    for (var i = 0; i < SK_PILLARS.length; i++) {
      var p = SK_PILLARS[i];
      if (x + r > p.x && x - r < p.x + p.w && y + r > p.y && y - r < p.y + p.h) return true;
    }
    return false;
  }

  var SK_BOSSES = [
    { kind: 'fire_boss',  name: '🔥 VUA SLIME DUNG NHAM',    baseHp: 48, speed: 0.95, r: 22 },
    { kind: 'ice_boss',   name: '💎 CUA PHA LÊ',             baseHp: 56, speed: 0.85, r: 23 },
    { kind: 'storm_boss', name: '⚡ MA PHÁP SƯ SẤM SÉT',     baseHp: 64, speed: 1.05, r: 20 },
    { kind: 'void_boss',  name: '👾 CHÚA TỂ HƯ KHÔNG',      baseHp: 74, speed: 1.08, r: 24 }
  ];

  function spawnSkWave(waveNum) {
    sk.enemies = [];
    sk.eBullets = [];
    sk.spikes = [];
    sk.portal = null;
    if (getBuffLvl('clone_turret') > 0) {
      sk.turret = { x: 280, y: 215, cd: 20, life: 1500 };
    } else {
      sk.turret = null;
    }

    var diff = window.SKHub ? window.SKHub.getDifficulty() : 'normal';
    var chal = window.SKHub ? window.SKHub.getChallenge() : 'none';
    if (window.SKHub) window.SKHub.recordProgress('wave', waveNum);
    var isZoneBoss = waveNum % 10 === 0;
    var isBoss = isZoneBoss || waveNum % 3 === 0;
    var hpScale = (1 + (waveNum - 1) * 0.34 + Math.pow(waveNum, 1.32) * 0.32) * (diff === 'badass' ? 1.5 : 1);
    var speedScale = Math.min(2.1, (1 + (waveNum - 1) * 0.05) * (diff === 'badass' ? 1.12 : 1) * (chal === 'fast_foes' ? 1.3 : 1));
    var biomeIdx = Math.floor((waveNum - 1) / 10) % SK_BIOMES.length;

    if (isBoss) {
      var bIdx = isZoneBoss ? biomeIdx : ((Math.floor(waveNum / 3) - 1) % SK_BOSSES.length);
      var meta = SK_BOSSES[bIdx];
      var bossHp = Math.round(meta.baseHp * hpScale * (isZoneBoss ? 1.35 : 1.15));
      sk.enemies.push({
        x: 280, y: 80, r: meta.r, hp: bossHp, maxHp: bossHp,
        type: meta.kind, bossName: (isZoneBoss ? '👑 TRÙM VÙNG: ' : '') + meta.name, isBoss: true,
        speed: meta.speed * speedScale, cd: 40, phase: 0, specialCd: 100
      });
    } else {
      var count = Math.min(13, 3 + waveNum);
      for (var i = 0; i < count; i++) {
        var ex, ey;
        do {
          ex = 48 + Math.random() * 464;
          ey = 40 + Math.random() * 140;
        } while (hitsPillar(ex, ey, 16) || Math.hypot(ex - sk.px, ey - sk.py) < 110);
        var roll = Math.random();
        var kind = roll < 0.42 ? 'slime' : (roll < 0.74 ? 'skeleton' : (waveNum >= 4 && roll < 0.88 ? 'mage' : (waveNum >= 6 ? 'bomber' : 'skeleton')));
        var isElite = waveNum >= 3 && Math.random() < Math.min(0.45, 0.12 + waveNum * 0.04);
        var baseHp = kind === 'slime' ? 4 : (kind === 'mage' ? 5 : (kind === 'bomber' ? 3 : 6));
        var eHp = Math.round(baseHp * hpScale * (isElite ? 2.1 : 1));
        sk.enemies.push({
          x: ex, y: ey, r: isElite ? 14 : 12,
          hp: eHp, maxHp: eHp, elite: isElite,
          type: kind,
          speed: (kind === 'bomber' ? 1.55 : (kind === 'slime' ? 1.15 : 0.85)) * speedScale * (isElite ? 1.12 : 1),
          cd: 28 + Math.floor(Math.random() * 42)
        });
      }
    }

    if (waveNum === 1 || waveNum % 2 === 1) {
      sk.crates = [
        { x: 266, y: 166, w: 28, h: 28, hp: 2 },
        { x: 54, y: 166, w: 28, h: 28, hp: 2 },
        { x: 478, y: 166, w: 28, h: 28, hp: 2 }
      ];
    }
  }

  var skLobbyActive = false;
  var skLobbyRaf = null;
  var skLobbyToast = '';
  var skLobbyToastTick = 0;
  var skWitchClaimed = false;

  function showLobbyMsg(msg) {
    skLobbyToast = msg;
    skLobbyToastTick = 120;
  }

  function startDungeonGame() {
    if (!skCanvas) return;
    skLobbyActive = false;
    if (skLobbyRaf) { cancelAnimationFrame(skLobbyRaf); skLobbyRaf = null; }
    skStop();
    sk.heroId = window.SKHub ? window.SKHub.getSelectedHero() : (sk.heroId || 'knight');
    sk.heroStats = window.SKHub ? window.SKHub.getHeroStats(sk.heroId) : null;
    sk.px = 280; sk.py = 300;
    sk.maxHp = sk.heroStats ? sk.heroStats.maxHp : 6; sk.hp = sk.maxHp;
    sk.maxShield = sk.heroStats ? sk.heroStats.maxShield : 5; sk.shield = sk.maxShield;
    sk.maxEnergy = sk.heroStats ? sk.heroStats.maxEnergy : 200;
    sk.energy = sk.maxEnergy;
    sk.ultCd = 0; sk.ultActive = 0;
    sk.pet = { x: 248, y: 304, cd: 50 };
    sk.exp = 0; sk.level = 1; sk.nextExp = calcNextExp(1);
    sk.pausedForLevel = false;
    sk.buffs = {};
    sk.wave = 1; sk.score = 0;
    sk.portal = null; sk.biomeBannerTick = 120; sk.turret = null; sk.thunderTick = 0;
    sk.invuln = 0; sk.dashTick = 0; sk.dashCd = 0;
    sk.bullets = []; sk.eBullets = []; sk.drops = []; sk.expGems = []; sk.gemDrops = []; sk.zones = []; sk.zaps = []; sk.spikes = []; sk.particles = []; sk.ghosts = [];
    var chal = window.SKHub ? window.SKHub.getChallenge() : 'none';
    selectSkWeapon(chal === 'melee_only' ? 2 : 0);
    spawnSkWave(1);
    renderActiveBuffs();
    updateSkHUD();
    if ($('skLobbyBar')) $('skLobbyBar').hidden = true;
    if ($('skLevelUpOverlay')) $('skLevelUpOverlay').hidden = true;
    if ($('skHeroUpgradeCard')) $('skHeroUpgradeCard').hidden = true;
    if ($('skTaskPanel')) $('skTaskPanel').hidden = true;
    if ($('skOverlay')) $('skOverlay').hidden = true;
    skRunning = true;
    skLoop();
  }

  function endDungeonGame() {
    skStop();
    beep(150, 0.35, 'sawtooth');
    if (sk.score > sk.best) {
      sk.best = sk.score;
      try { localStorage.setItem(skBestKey, String(sk.best)); } catch (e) {}
    }
    updateSkHUD();
    submitGameScore('dungeon', sk.score);
    window.SKHub?.renderHub?.();
    if ($('skLobbyBar')) $('skLobbyBar').hidden = false;
    showLobbyMsg('Đạt Tầng ' + sk.wave + ' • Điểm: ' + sk.score + '!');
    startSkLobby();
  }

  function spawnSkZone(x, y, kind) {
    var zType = kind || (getBuffLvl('ice_elem') > 0 && Math.random() < 0.5 ? 'ice' : (getBuffLvl('fire_elem') > 0 ? 'fire' : 'poison'));
    sk.zones.push({ x: x, y: y, r: 34 + getBuffLvl('elem_zone') * 6, kind: zType, life: 210, tick: 0 });
  }

  function triggerSkDash() {
    if (!skRunning || sk.pausedForLevel || sk.dashCd > 0 || sk.dashTick > 0) return;
    var dx = (sk.keys.d ? 1 : 0) - (sk.keys.a ? 1 : 0);
    var dy = (sk.keys.s ? 1 : 0) - (sk.keys.w ? 1 : 0);
    if (dx === 0 && dy === 0) {
      var ang = Math.atan2(sk.aimY - sk.py, sk.aimX - sk.px);
      dx = Math.cos(ang); dy = Math.sin(ang);
    } else {
      var len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
    }
    sk.dashDx = dx; sk.dashDy = dy;
    sk.dashTick = 10;
    var asnLv5 = sk.heroId === 'assassin' && sk.heroStats && sk.heroStats.hasLv5Buff ? 0.7 : 1;
    sk.dashCd = Math.max(14, Math.round(55 * Math.pow(0.7, getBuffLvl('dash_nova')) * asnLv5));
    sk.invuln = Math.max(sk.invuln, 14);
    if (getBuffLvl('dash_nova') > 0) spawnSkZone(sk.px, sk.py);
    beep(420, 0.08, 'triangle');
  }

  function triggerSkUlt() {
    if (!skRunning || sk.pausedForLevel || sk.ultCd > 0) return;
    sk.ultCd = 360; // 6s cooldown
    beep(880, 0.14, 'triangle');
    if (sk.heroId === 'knight') {
      sk.ultActive = 240; // Dual-wield x2 shots for 4s
    } else if (sk.heroId === 'assassin') {
      triggerSkDash();
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8;
        sk.bullets.push({
          x: sk.px, y: sk.py, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8,
          color: '#C084FC', elem: 'bolt', dmg: 4, r: 6, pierce: 2, bounce: 1, hitIds: []
        });
      }
    } else if (sk.heroId === 'engineer') {
      sk.turret = { x: sk.px, y: sk.py, cd: 10, life: 900, shots: 0 };
    } else if (sk.heroId === 'paladin') {
      sk.shield = Math.min(sk.maxShield, sk.shield + 4);
      sk.invuln = 180; // 3s holy shield
      sk.ultActive = 180;
      if (sk.heroStats && sk.heroStats.hasLv5Buff) {
        sk.eBullets = []; // Holy shockwave clears all enemy bullets!
        for (var sp = 0; sp < 14; sp++) {
          var sa = (Math.PI * 2 * sp) / 14;
          sk.particles.push({ x: sk.px, y: sk.py, vx: Math.cos(sa) * 5, vy: Math.sin(sa) * 5, color: '#38BDF8', life: 18 });
        }
      }
      updateSkHUD();
    }
  }

  function pickBulletElement(defaultColor) {
    var opts = [];
    if (getBuffLvl('fire_elem') > 0) opts.push('fire');
    if (getBuffLvl('ice_elem') > 0) opts.push('ice');
    if (getBuffLvl('bolt_elem') > 0) opts.push('bolt');
    if (getBuffLvl('poison_elem') > 0) opts.push('poison');
    if (!opts.length) return { elem: null, color: defaultColor };
    var chosen = opts[Math.floor(Math.random() * opts.length)];
    var col = chosen === 'fire' ? '#F97316' : (chosen === 'ice' ? '#67E8F9' : (chosen === 'poison' ? '#4ADE80' : '#FACC15'));
    return { elem: chosen, color: col };
  }

  function fireSkWeapon() {
    if (!skRunning || sk.pausedForLevel || sk.fireCd > 0) return;
    var wpn = skWeapons[sk.wpnIdx];
    if (sk.energy < wpn.cost) {
      selectSkWeapon(2);
      wpn = skWeapons[2];
    }

    var tx = sk.aimX, ty = sk.aimY;
    if (sk.autoFire && sk.enemies.length) {
      var bestE = sk.enemies[0], bestD = 9999;
      sk.enemies.forEach(function (e) {
        var dist = Math.hypot(e.x - sk.px, e.y - sk.py);
        if (dist < bestD) { bestD = dist; bestE = e; }
      });
      tx = bestE.x; ty = bestE.y;
    }

    var baseAng = Math.atan2(ty - sk.py, tx - sk.px);
    sk.energy = Math.max(0, sk.energy - wpn.cost);
    var rateMult = Math.pow(0.78, getBuffLvl('fire_rate'));
    sk.fireCd = Math.max(4, Math.round(wpn.cd * rateMult));

    var knightLv5 = sk.heroId === 'knight' && sk.heroStats && sk.heroStats.hasLv5Buff && sk.ultActive > 0 ? 2 : 0;
    var extraTia = getBuffLvl('multi_shot') * 2 + (sk.heroId === 'knight' && sk.ultActive > 0 ? 2 : 0) + knightLv5;

    if (wpn.melee) {
      sk.slashTick = 9;
      sk.slashAngle = baseAng;
      beep(340, 0.07, 'triangle');
      for (var b = sk.eBullets.length - 1; b >= 0; b--) {
        var eb = sk.eBullets[b];
        if (Math.hypot(eb.x - sk.px, eb.y - sk.py) < 48) {
          sk.particles.push({ x: eb.x, y: eb.y, vx: 0, vy: -0.6, color: '#FDE047', life: 10 });
          sk.eBullets.splice(b, 1);
        }
      }
      for (var ei = sk.enemies.length - 1; ei >= 0; ei--) {
        var en = sk.enemies[ei];
        if (Math.hypot(en.x - sk.px, en.y - sk.py) < 50 + en.r) {
          var elInfo = pickBulletElement('#FDE047');
          damageSkEnemy(ei, wpn.dmg, elInfo.elem);
        }
      }
      if (extraTia > 0) {
        for (var sw = 0; sw < Math.min(5, 1 + getBuffLvl('multi_shot')); sw++) {
          var swOff = (sw - Math.floor(Math.min(5, 1 + getBuffLvl('multi_shot')) / 2)) * 0.22;
          var elW = pickBulletElement('#FDE047');
          sk.bullets.push({
            x: sk.px + Math.cos(baseAng + swOff) * 16, y: sk.py + Math.sin(baseAng + swOff) * 16,
            vx: Math.cos(baseAng + swOff) * 7, vy: Math.sin(baseAng + swOff) * 7,
            color: elW.color, elem: elW.elem, dmg: 2, r: 5, pierce: getBuffLvl('crit_pierce'),
            bounce: getBuffLvl('ricochet') > 0 ? Math.min(4, 1 + getBuffLvl('ricochet')) : 0, hitIds: []
          });
        }
      }
    } else {
      beep(wpn.spread > 1 ? 520 : 780, 0.06, 'square');
      var count = wpn.spread + extraTia;
      var stepAng = count > 3 ? 0.14 : 0.2;
      for (var i = 0; i < count; i++) {
        var offset = (i - (count - 1) / 2) * stepAng;
        var a = baseAng + offset;
        var elB = pickBulletElement(wpn.color);
        sk.bullets.push({
          x: sk.px + Math.cos(a) * 14, y: sk.py + Math.sin(a) * 14,
          vx: Math.cos(a) * wpn.speed, vy: Math.sin(a) * wpn.speed,
          color: elB.color, elem: elB.elem, dmg: wpn.dmg, r: count > 1 ? 5 : 4,
          pierce: getBuffLvl('crit_pierce'),
          bounce: getBuffLvl('ricochet') > 0 ? Math.min(4, 1 + getBuffLvl('ricochet')) : 0, hitIds: []
        });
      }
    }
    updateSkHUD();
  }

  function damageSkEnemy(idx, dmg, elem) {
    var e = sk.enemies[idx];
    if (!e) return;

    // Chúa Tể Hư Không: miễn nhiễm toàn bộ sát thương khi đang tàng hình!
    if (e.type === 'void_boss' && e.invisActive && e.invisActive > 0) {
      for (var ivp = 0; ivp < 3; ivp++) {
        sk.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, color: '#C084FC', life: 10 });
      }
      return;
    }

    // Crit strike from hero crit + crit_pierce buff
    var baseCrit = sk.heroStats ? (sk.heroStats.crit / 100) : 0.05;
    var isCrit = Math.random() < Math.min(0.85, baseCrit + getBuffLvl('crit_pierce') * 0.25);
    var finalDmg = isCrit ? dmg * 2 : dmg;
    // Cua Pha Lê (Crystal Crab): 5% chance on hit (only after previous spikes disappeared + 2s cooldown)
    if (e.type === 'ice_boss' && sk.spikes.length === 0 && (!e.spikeCooldown || e.spikeCooldown <= 0) && Math.random() < 0.05) {
      var healAmt = Math.max(1, Math.round(finalDmg * 0.5));
      e.hp = Math.min(e.maxHp, e.hp + healAmt);
      e.crystalRage = 180; // 3 seconds red rage state
      e.spikeCooldown = 120; // 2 seconds cooldown AFTER spikes disappear
      for (var sp = 0; sp < 6; sp++) {
        var spa = (Math.PI * 2 * sp) / 6;
        sk.spikes.push({
          x: Math.max(28, Math.min(532, e.x + Math.cos(spa) * 44)),
          y: Math.max(32, Math.min(330, e.y + Math.sin(spa) * 44)),
          r: 12, life: 180, color: '#EF4444'
        });
      }
      beep(620, 0.1, 'triangle');
    } else {
      e.hp -= finalDmg;
    }

    if (elem === 'fire') e.burn = Math.max(e.burn || 0, 120 + getBuffLvl('fire_elem') * 40);
    if (elem === 'ice') e.chill = Math.max(e.chill || 0, 120 + getBuffLvl('ice_elem') * 40);
    if (elem === 'poison') e.poison = Math.max(e.poison || 0, 150 + getBuffLvl('poison_elem') * 45);
    if (elem === 'bolt') {
      var chains = 0;
      for (var j = sk.enemies.length - 1; j >= 0 && chains < 2; j--) {
        if (j === idx) continue;
        var other = sk.enemies[j];
        if (other && Math.hypot(other.x - e.x, other.y - e.y) < 110) {
          sk.zaps.push({ x1: e.x, y1: e.y, x2: other.x, y2: other.y, life: 10 });
          other.hp -= Math.max(1, getBuffLvl('bolt_elem'));
          chains++;
        }
      }
    }
    if (getBuffLvl('explosive') > 0 && elem !== 'aoe') {
      var blastR = 45 + getBuffLvl('explosive') * 12;
      for (var exi = sk.enemies.length - 1; exi >= 0; exi--) {
        if (exi === idx) continue;
        var o2 = sk.enemies[exi];
        if (o2 && Math.hypot(o2.x - e.x, o2.y - e.y) <= blastR) {
          o2.hp -= Math.max(1, getBuffLvl('explosive'));
        }
      }
      for (var ep = 0; ep < 6; ep++) {
        sk.particles.push({
          x: e.x, y: e.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
          color: '#FB923C', life: 12
        });
      }
    }
    if (getBuffLvl('elem_zone') > 0 && Math.random() < 0.25) {
      spawnSkZone(e.x, e.y, elem);
    }

    for (var k = 0; k < (isCrit ? 7 : 4); k++) {
      sk.particles.push({
        x: e.x, y: e.y, vx: (Math.random() - 0.5) * 3.5, vy: (Math.random() - 0.5) * 3.5,
        color: isCrit ? '#FDE047' : (elem === 'ice' ? '#67E8F9' : (elem === 'bolt' ? '#FACC15' : (e.isBoss ? '#F59E0B' : '#F87171'))),
        life: 14
      });
    }
    if (e.hp <= 0) {
      var ex = e.x, ey = e.y, isBoss = !!e.isBoss;
      sk.score += isBoss ? 150 + sk.wave * 20 : (e.elite ? 45 : 20);
      if (getBuffLvl('elem_zone') > 0) spawnSkZone(ex, ey, elem);

      // Vampirism life steal
      if (getBuffLvl('vampirism') > 0 && Math.random() < Math.min(0.6, getBuffLvl('vampirism') * 0.2)) {
        sk.hp = Math.min(sk.maxHp, sk.hp + 1);
      }

      var gemCount = isBoss ? 6 : (e.elite ? 2 : 1);
      for (var g = 0; g < gemCount; g++) {
        sk.expGems.push({
          x: ex + (Math.random() - 0.5) * 18,
          y: ey + (Math.random() - 0.5) * 18,
          val: isBoss ? 28 + sk.wave * 2 : (12 + Math.floor(sk.wave * 1.6)) * (e.elite ? 2 : 1),
          life: 900
        });
      }

      // Drop Blue Soul Knight Gems (more Gems on higher floors!)
      var diff = window.SKHub ? window.SKHub.getDifficulty() : 'normal';
      var chal = window.SKHub ? window.SKHub.getChallenge() : 'none';
      var gemMult = (diff === 'badass' ? 1.5 : 1) * (chal === 'no_shield' ? 1.5 : (chal === 'fast_foes' ? 1.4 : (chal === 'melee_only' ? 1.6 : 1)));
      var baseBlueGems = isBoss ? (25 + sk.wave * 8) : ((2 + Math.floor(sk.wave * 1.4)) * (e.elite ? 2 : 1));
      sk.gemDrops.push({
        x: ex + (Math.random() - 0.5) * 12,
        y: ey + (Math.random() - 0.5) * 12,
        val: Math.max(1, Math.round(baseBlueGems * gemMult)),
        life: 900
      });
      if (window.SKHub) window.SKHub.recordProgress(isBoss ? 'boss' : 'kill');

      if (Math.random() < 0.35) {
        var dropType = Math.random() < 0.35 ? 'hp' : 'energy';
        sk.drops.push({ x: ex, y: ey, type: dropType, life: 450 });
      }
      if (e.type === 'bomber') {
        for (var bm = 0; bm < 6; bm++) {
          var bma = (Math.PI * 2 * bm) / 6;
          sk.eBullets.push({ x: ex, y: ey, vx: Math.cos(bma) * 2.5, vy: Math.sin(bma) * 2.5, r: 4, col: '#F97316' });
        }
      } else if (e.type === 'fire_boss') {
        // Vua Slime Dung Nham bị hạ: bắn 18 viên đạn hình tròn + sinh Slime Con!
        for (var fb18 = 0; fb18 < 18; fb18++) {
          var fa18 = (Math.PI * 2 * fb18) / 18;
          sk.eBullets.push({ x: ex, y: ey, vx: Math.cos(fa18) * 2.7, vy: Math.sin(fa18) * 2.7, r: 5, col: '#EF4444' });
        }
        for (var ms = 0; ms < 3; ms++) {
          var msa = (Math.PI * 2 * ms) / 3;
          sk.enemies.push({
            x: Math.max(36, Math.min(524, ex + Math.cos(msa) * 28)),
            y: Math.max(40, Math.min(320, ey + Math.sin(msa) * 28)),
            r: 10, hp: Math.max(3, Math.round(4 + sk.wave * 0.6)), maxHp: Math.max(3, Math.round(4 + sk.wave * 0.6)),
            type: 'mini_slime', speed: 1.25, cd: 60, life: 240
          });
        }
      } else if (e.type === 'mini_slime') {
        // Slime Con bị hạ: bắn 3 viên đạn!
        for (var m3 = 0; m3 < 3; m3++) {
          var ma3 = (Math.PI * 2 * m3) / 3 + Math.random() * 0.4;
          sk.eBullets.push({ x: ex, y: ey, vx: Math.cos(ma3) * 2.6, vy: Math.sin(ma3) * 2.6, r: 4, col: '#FB7185' });
        }
      }
      sk.enemies.splice(idx, 1);
      beep(920, 0.08, 'sine');
      updateSkHUD();
    }
  }

  function drawSkDungeonFloor() {
    if (!skCtx) return;
    var w = skCanvas.width, h = skCanvas.height;
    var biome = getCurrentBiome();
    skCtx.fillStyle = biome.floor1;
    skCtx.fillRect(0, 0, w, h);

    // Official Soul Knight stone floor texture if loaded, tinted by biome
    if (skImgReady('floorBg')) {
      skCtx.save();
      skCtx.globalAlpha = 0.55;
      skCtx.drawImage(SK_IMG.floorBg, 16, 16, w - 32, h - 32);
      skCtx.restore();
      if (sk.wave > 10) {
        skCtx.save();
        skCtx.globalAlpha = 0.38;
        skCtx.fillStyle = biome.floor2;
        skCtx.fillRect(16, 16, w - 32, h - 32);
        skCtx.restore();
      }
    } else {
      for (var tx = 16; tx < w - 16; tx += 28) {
        for (var ty = 16; ty < h - 16; ty += 28) {
          skCtx.fillStyle = ((tx + ty) / 28) % 2 === 0 ? biome.floor2 : biome.floor3;
          skCtx.fillRect(tx, ty, 26, 26);
        }
      }
    }

    // Outer dungeon brick wall border
    skCtx.strokeStyle = biome.wall;
    skCtx.lineWidth = 16;
    skCtx.strokeRect(8, 8, w - 16, h - 16);

    // Official Soul Knight wooden barricades & burning braziers in corners
    if (skImgReady('fence')) {
      skCtx.drawImage(SK_IMG.fence, 180, 14, 60, 18);
      skCtx.drawImage(SK_IMG.fence, 320, 14, 60, 18);
    }
    var braziers = [[26, 26], [w - 48, 26], [26, h - 48], [w - 48, h - 48]];
    braziers.forEach(function (b) {
      if (skImgReady('basin')) skCtx.drawImage(SK_IMG.basin, b[0], b[1], 22, 22);
      if (skImgReady('fire')) skCtx.drawImage(SK_IMG.fire, b[0] + 2, b[1] - 10, 18, 20);
    });

    // Pillars
    SK_PILLARS.forEach(function (p) {
      skCtx.fillStyle = biome.pillar;
      skCtx.fillRect(p.x, p.y, p.w, p.h);
      skCtx.fillStyle = biome.pillarTop;
      skCtx.fillRect(p.x + 4, p.y + 4, p.w - 8, 12);
      skCtx.strokeStyle = '#181524';
      skCtx.lineWidth = 2;
      skCtx.strokeRect(p.x, p.y, p.w, p.h);
    });
  }

  function drawPixelHero(x, y, ang) {
    if (!skCtx) return;
    // Dash afterimages
    sk.ghosts.forEach(function (g) {
      skCtx.fillStyle = 'rgba(56, 189, 248, ' + (g.life / 14) + ')';
      skCtx.fillRect(g.x - 8, g.y - 10, 16, 20);
    });

    if (sk.invuln > 0 && Math.floor(sk.invuln / 3) % 2 === 0 && !(sk.heroId === 'paladin' && sk.ultActive > 0)) return;

    var rx = Math.round(x), ry = Math.round(y);
    // Ultimate aura (Knight dual-wield or Paladin holy shield)
    if (sk.ultActive > 0) {
      skCtx.save();
      skCtx.strokeStyle = sk.heroId === 'paladin' ? '#38BDF8' : '#FACC15';
      skCtx.lineWidth = 2.5;
      skCtx.beginPath();
      skCtx.arc(rx, ry, 19, 0, Math.PI * 2);
      skCtx.stroke();
      skCtx.restore();
    }

    // Shadow
    skCtx.fillStyle = 'rgba(0,0,0,0.38)';
    skCtx.beginPath();
    skCtx.ellipse(rx, ry + 11, 10, 4, 0, 0, Math.PI * 2);
    skCtx.fill();

    var heroKey = sk.heroId || 'knight';
    if (skImgReady(heroKey)) {
      var facingLeft = Math.cos(ang) < 0;
      skCtx.save();
      skCtx.translate(rx, ry);
      if (facingLeft) skCtx.scale(-1, 1);
      skCtx.drawImage(SK_IMG[heroKey], -16, -18, 32, 32);
      skCtx.restore();
    } else {
      // Fallback pixel knight
      skCtx.fillStyle = '#94A3B8';
      skCtx.fillRect(rx - 8, ry - 4, 16, 14);
      skCtx.fillStyle = '#DC2626';
      skCtx.fillRect(rx - 9, ry - 2, 18, 4);
      skCtx.fillStyle = '#CBD5E1';
      skCtx.fillRect(rx - 8, ry - 12, 16, 10);
      skCtx.fillStyle = '#EF4444';
      skCtx.fillRect(rx - 3, ry - 16, 6, 4);
      skCtx.fillStyle = '#0F172A';
      skCtx.fillRect(rx - 6, ry - 9, 12, 5);
      skCtx.fillStyle = '#38BDF8';
      skCtx.fillRect(rx - 4, ry - 7, 3, 2);
      skCtx.fillRect(rx + 2, ry - 7, 3, 2);
    }

    // Weapon pointing toward cursor (custom pixel weapon sprites!)
    skCtx.save();
    skCtx.translate(rx, ry + 2);
    skCtx.rotate(ang);
    if (window.SKHub && typeof window.SKHub.drawPixelWeapon === 'function') {
      window.SKHub.drawPixelWeapon(skCtx, sk.wpnIdx);
    } else {
      skCtx.fillStyle = skWeapons[sk.wpnIdx].color;
      skCtx.fillRect(6, -2, 12, 4);
    }
    skCtx.restore();

    // Melee sword slash arc
    if (sk.slashTick > 0) {
      skCtx.strokeStyle = '#FEF08A';
      skCtx.lineWidth = 4;
      skCtx.beginPath();
      skCtx.arc(rx, ry, 34, sk.slashAngle - 0.85, sk.slashAngle + 0.85);
      skCtx.stroke();
    }
  }

  function drawPixelEnemy(e) {
    if (!skCtx) return;
    var rx = Math.round(e.x), ry = Math.round(e.y);
    skCtx.save();
    if (e.type === 'void_boss' && e.invisActive && e.invisActive > 0) {
      skCtx.globalAlpha = 0.28;
    }
    if (e.type === 'storm_boss' && e.empowered && e.empowered > 0) {
      skCtx.strokeStyle = '#FACC15';
      skCtx.lineWidth = 3;
      skCtx.beginPath();
      skCtx.arc(rx, ry, e.r + 9, 0, Math.PI * 2);
      skCtx.stroke();
    }
    if (e.elite) {
      skCtx.strokeStyle = '#C084FC';
      skCtx.lineWidth = 2;
      skCtx.strokeRect(rx - e.r - 2, ry - e.r - 2, e.r * 2 + 4, e.r * 2 + 4);
    }
    if (e.type === 'slime') {
      skCtx.fillStyle = e.elite ? '#A855F7' : '#EF4444';
      skCtx.fillRect(rx - 10, ry - 6, 20, 14);
      skCtx.fillRect(rx - 7, ry - 10, 14, 4);
      skCtx.fillStyle = '#FEF08A';
      skCtx.fillRect(rx - 5, ry - 3, 3, 3);
      skCtx.fillRect(rx + 2, ry - 3, 3, 3);
    } else if (e.type === 'skeleton') {
      skCtx.fillStyle = e.elite ? '#DDD6FE' : '#E2E8F0';
      skCtx.fillRect(rx - 7, ry - 11, 14, 10);
      skCtx.fillStyle = e.elite ? '#7E22CE' : '#64748B';
      skCtx.fillRect(rx - 6, ry - 1, 12, 11);
      skCtx.fillStyle = '#DC2626';
      skCtx.fillRect(rx - 4, ry - 7, 3, 3);
      skCtx.fillRect(rx + 2, ry - 7, 3, 3);
    } else if (e.type === 'mage') {
      skCtx.fillStyle = '#4C1D95';
      skCtx.fillRect(rx - 8, ry - 6, 16, 15);
      skCtx.fillStyle = '#7C3AED';
      skCtx.fillRect(rx - 9, ry - 14, 18, 8);
      skCtx.fillStyle = '#FDE047';
      skCtx.fillRect(rx - 4, ry - 4, 3, 3);
      skCtx.fillRect(rx + 2, ry - 4, 3, 3);
    } else if (e.type === 'bomber') {
      skCtx.fillStyle = '#9A3412';
      skCtx.fillRect(rx - 9, ry - 9, 18, 18);
      skCtx.fillStyle = '#FACC15';
      skCtx.fillRect(rx - 3, ry - 13, 6, 4);
      skCtx.fillStyle = '#FEF08A';
      skCtx.fillRect(rx - 5, ry - 3, 4, 3);
      skCtx.fillRect(rx + 2, ry - 3, 4, 3);
    } else if (e.type === 'fire_boss') {
      // Vua Slime Dung Nham (Image 1: Grand Slime - crimson body, orange highlight, fierce yellow eyes, jagged black mouth)
      skCtx.fillStyle = '#0F172A';
      skCtx.beginPath();
      skCtx.arc(rx, ry + 2, 23, 0, Math.PI * 2);
      skCtx.fill();
      skCtx.fillStyle = '#DC143C';
      skCtx.beginPath();
      skCtx.arc(rx, ry + 2, 21, 0, Math.PI * 2);
      skCtx.fill();
      // Top-right glossy red-orange highlight + white dot
      skCtx.fillStyle = '#EF4444';
      skCtx.beginPath();
      skCtx.arc(rx + 6, ry - 6, 10, 0, Math.PI * 2);
      skCtx.fill();
      skCtx.fillStyle = '#FFFFFF';
      skCtx.fillRect(rx + 6, ry - 14, 5, 4);
      // Fierce angled yellow eyes
      skCtx.fillStyle = '#FACC15';
      skCtx.beginPath();
      skCtx.moveTo(rx - 12, ry - 8); skCtx.lineTo(rx - 3, ry - 2); skCtx.lineTo(rx - 10, ry + 2); skCtx.closePath(); skCtx.fill();
      skCtx.beginPath();
      skCtx.moveTo(rx + 12, ry - 8); skCtx.lineTo(rx + 3, ry - 2); skCtx.lineTo(rx + 10, ry + 2); skCtx.closePath(); skCtx.fill();
      // Jagged black toothed mouth
      skCtx.fillStyle = '#090D16';
      skCtx.fillRect(rx - 14, ry + 6, 28, 9);
      skCtx.fillStyle = '#DC143C';
      for (var jt = -11; jt <= 9; jt += 5) {
        skCtx.fillRect(rx + jt, ry + 6, 2, 4);
      }
    } else if (e.type === 'ice_boss') {
      // Cua Pha Lê (Image 2: Crystal Crab - dark slate body/claws, white outline, cyan crystals turning RED on rage!)
      var isRage = e.crystalRage && e.crystalRage > 0;
      var cMain = isRage ? '#EF4444' : '#06B6D4';
      var cLight = isRage ? '#FCA5A5' : '#67E8F9';
      // Back crystal spikes
      skCtx.strokeStyle = '#FFFFFF';
      skCtx.lineWidth = 2;
      var spikes = [[-14, -10, 8, 16], [-5, -18, 10, 22], [6, -14, 9, 18], [13, -8, 8, 14]];
      spikes.forEach(function (sp) {
        skCtx.fillStyle = cMain;
        skCtx.fillRect(rx + sp[0], ry + sp[1], sp[2], sp[3]);
        skCtx.strokeRect(rx + sp[0], ry + sp[1], sp[2], sp[3]);
        skCtx.fillStyle = cLight;
        skCtx.fillRect(rx + sp[0] + 2, ry + sp[1] + 2, 3, sp[3] - 6);
      });
      // Dark slate crab shell & front claws
      skCtx.fillStyle = '#334155';
      skCtx.strokeStyle = '#FFFFFF';
      skCtx.lineWidth = 1.5;
      skCtx.fillRect(rx - 18, ry - 2, 36, 18);
      skCtx.strokeRect(rx - 18, ry - 2, 36, 18);
      // Claws
      skCtx.fillStyle = '#475569';
      skCtx.fillRect(rx - 25, ry + 2, 9, 12);
      skCtx.fillRect(rx + 16, ry + 2, 9, 12);
      // Fierce amber eyes
      skCtx.fillStyle = '#FACC15';
      skCtx.fillRect(rx - 7, ry + 6, 4, 4);
      skCtx.fillRect(rx + 3, ry + 6, 4, 4);
    } else if (e.type === 'mini_slime') {
      skCtx.fillStyle = '#DC143C';
      skCtx.beginPath();
      skCtx.arc(rx, ry + 1, 9, 0, Math.PI * 2);
      skCtx.fill();
      skCtx.fillStyle = '#FACC15';
      skCtx.fillRect(rx - 4, ry - 2, 2, 2);
      skCtx.fillRect(rx + 2, ry - 2, 2, 2);
    } else if (e.type === 'storm_boss') {
      // Ma Pháp Sư / Phantom King (Uploaded image: grey-gold hooded specter, red cross face, red tentacles, floating ringed hands)
      // Flowing red tentacles
      skCtx.strokeStyle = '#DC2626';
      skCtx.lineWidth = 3;
      skCtx.beginPath();
      skCtx.moveTo(rx - 10, ry); skCtx.quadraticCurveTo(rx - 24, ry - 4, rx - 30, ry - 10);
      skCtx.moveTo(rx + 10, ry); skCtx.quadraticCurveTo(rx + 24, ry - 4, rx + 30, ry - 10);
      skCtx.moveTo(rx - 8, ry + 6); skCtx.quadraticCurveTo(rx - 20, ry + 18, rx - 14, ry + 26);
      skCtx.moveTo(rx + 8, ry + 6); skCtx.quadraticCurveTo(rx + 20, ry + 18, rx + 14, ry + 26);
      skCtx.stroke();
      // Tapered grey cloak body with gold trim
      skCtx.fillStyle = '#475569';
      skCtx.strokeStyle = '#0F172A';
      skCtx.lineWidth = 1.5;
      skCtx.beginPath();
      skCtx.moveTo(rx - 12, ry - 2);
      skCtx.lineTo(rx + 12, ry - 2);
      skCtx.lineTo(rx, ry + 24);
      skCtx.closePath();
      skCtx.fill();
      skCtx.stroke();
      skCtx.strokeStyle = '#FACC15';
      skCtx.lineWidth = 1.5;
      skCtx.beginPath();
      skCtx.moveTo(rx - 11, ry); skCtx.lineTo(rx, ry - 5); skCtx.lineTo(rx + 11, ry);
      skCtx.stroke();
      // Hood & gold crown
      skCtx.fillStyle = '#64748B';
      skCtx.fillRect(rx - 11, ry - 22, 22, 18);
      skCtx.fillStyle = '#FACC15';
      skCtx.fillRect(rx - 9, ry - 25, 18, 4);
      // Dark void face + glowing red cross
      skCtx.fillStyle = '#1E293B';
      skCtx.fillRect(rx - 7, ry - 18, 14, 12);
      skCtx.fillStyle = '#EF4444';
      skCtx.fillRect(rx - 1, ry - 17, 2, 10);
      skCtx.fillRect(rx - 5, ry - 13, 10, 2);
      // Floating hands with red rings
      skCtx.fillStyle = '#94A3B8';
      skCtx.fillRect(rx - 26, ry + 8, 7, 10);
      skCtx.fillRect(rx + 19, ry + 8, 7, 10);
      skCtx.strokeStyle = '#EF4444';
      skCtx.lineWidth = 2;
      skCtx.beginPath();
      skCtx.ellipse(rx - 22, ry + 13, 6, 3, 0, 0, Math.PI * 2);
      skCtx.ellipse(rx + 22, ry + 13, 6, 3, 0, 0, Math.PI * 2);
      skCtx.stroke();
    } else if (e.isBoss && skImgReady('boss')) {
      var auraCol = e.type === 'storm_boss' ? '#FACC15' : '#C084FC';
      skCtx.save();
      skCtx.strokeStyle = auraCol;
      skCtx.lineWidth = 3;
      skCtx.beginPath();
      skCtx.arc(rx, ry, e.r + 5, 0, Math.PI * 2);
      skCtx.stroke();
      skCtx.drawImage(SK_IMG.boss, rx - 26, ry - 26, 52, 52);
      skCtx.restore();
    } else if (e.type === 'void_boss') {
      skCtx.fillStyle = '#3B0764';
      skCtx.fillRect(rx - 22, ry - 20, 44, 40);
      skCtx.fillStyle = '#C084FC';
      skCtx.fillRect(rx - 14, ry - 28, 28, 8);
      skCtx.fillStyle = '#F43F5E';
      skCtx.fillRect(rx - 12, ry - 8, 7, 6);
      skCtx.fillRect(rx + 5, ry - 8, 7, 6);
    } else {
      // Storm Boss
      skCtx.fillStyle = '#6D28D9';
      skCtx.fillRect(rx - 18, ry - 18, 36, 36);
      skCtx.fillStyle = '#FDE047';
      skCtx.fillRect(rx - 10, ry - 26, 20, 8);
      skCtx.fillStyle = '#38BDF8';
      skCtx.fillRect(rx - 10, ry - 8, 6, 6);
      skCtx.fillRect(rx + 4, ry - 8, 6, 6);
    }

    if (e.isBoss) {
      // Prominent top-of-canvas Boss Name & Health Bar
      skCtx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      skCtx.fillRect(110, 18, 340, 24);
      skCtx.strokeStyle = '#F59E0B';
      skCtx.lineWidth = 2;
      skCtx.strokeRect(110, 18, 340, 24);
      skCtx.fillStyle = '#EF4444';
      skCtx.fillRect(114, 32, Math.max(0, 332 * (e.hp / e.maxHp)), 7);
      skCtx.fillStyle = '#FEF3C7';
      skCtx.font = 'bold 11px sans-serif';
      skCtx.textAlign = 'center';
      skCtx.fillText((e.bossName || 'BOSS') + ' (' + Math.max(0, Math.ceil(e.hp)) + '/' + e.maxHp + ')', 280, 29);
    }
    skCtx.restore();
  }

  var SK_LOBBY_ITEMS = [
    { id: 'gate',       x: 280, y: 42,  r: 34, label: '⚔️ VÀO HẦM NGỤC' },
    { id: 'taskboard',  x: 470, y: 48,  r: 28, label: '📜 Bảng Nhiệm Vụ & Thử Thách' },
    { id: 'badass_npc', x: 494, y: 148, r: 30, label: '🔥 Đổi Độ Khó (Thường / Badass)' },
    { id: 'gacha',      x: 52,  y: 54,  r: 28, label: '🎰 Máy Gacha (50 Gem)' },
    { id: 'witch_npc',  x: 52,  y: 266, r: 28, label: '🧙‍♀️ Nhận Quà Phù Thủy (!)' },
    { id: 'hero_knight',   x: 356, y: 68,  r: 24, hero: 'knight',   label: '🛡️ Knight (Nâng cấp)' },
    { id: 'hero_assassin', x: 406, y: 222, r: 24, hero: 'assassin', label: '🗡️ Assassin (Nâng cấp)' },
    { id: 'hero_engineer', x: 205, y: 272, r: 24, hero: 'engineer', label: '⚙️ Engineer (Nâng cấp)' },
    { id: 'hero_paladin',  x: 152, y: 268, r: 24, hero: 'paladin',  label: '👑 Paladin (Nâng cấp)' }
  ];

  function getNearestLobbyItem() {
    var best = null, bestD = 999;
    for (var i = 0; i < SK_LOBBY_ITEMS.length; i++) {
      var it = SK_LOBBY_ITEMS[i];
      var d = Math.hypot(sk.px - it.x, sk.py - it.y);
      if (d < it.r + 12 && d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  function interactSkLobby(item) {
    if (!item) return;
    beep(740, 0.08, 'triangle');
    if (item.id === 'gate') {
      startDungeonGame();
    } else if (item.id === 'taskboard') {
      window.SKHub?.openTaskPanel?.();
    } else if (item.id === 'badass_npc') {
      var nd = window.SKHub ? window.SKHub.toggleDifficulty() : 'normal';
      showLobbyMsg(nd === 'badass' ? '🔥 Đã bật chế độ BADASS (Quái mạnh, +50% Gem)!' : '🛡️ Đã chuyển về độ khó THƯỜNG!');
    } else if (item.id === 'gacha') {
      if (!window.SKHub) return;
      if (window.SKHub.getGems() < 50) {
        showLobbyMsg('💎 Cần 50 Gem để quay Máy Gacha!');
      } else {
        window.SKHub.addGems(-50);
        var win = [20, 35, 60, 90, 140][Math.floor(Math.random() * 5)];
        window.SKHub.addGems(win);
        showLobbyMsg('🎰 Quay Gacha (-50 Gem) → Trúng +' + win + ' Gem!');
      }
    } else if (item.id === 'witch_npc') {
      if (skWitchClaimed) {
        showLobbyMsg('🧙‍♀️ Chúc Hiệp sĩ chinh phục Hầm Ngục thành công!');
      } else {
        skWitchClaimed = true;
        window.SKHub?.addGems(30);
        showLobbyMsg('🧙‍♀️ Phù Thủy tặng bạn +30 Gem may mắn!');
      }
    } else if (item.hero) {
      window.SKHub?.openUpgradePanel?.(item.hero);
    }
  }

  function drawSkLivingRoom(nowMs) {
    if (!skCtx) return;
    var w = skCanvas.width, h = skCanvas.height;
    var ms = nowMs || 0;

    // 1. Warm Brown-Red Tiled Floor (Image 1 Living Room)
    for (var gx = 0; gx < w; gx += 28) {
      for (var gy = 0; gy < h; gy += 28) {
        skCtx.fillStyle = ((gx / 28 + gy / 28) % 2 === 0) ? '#462418' : '#3C1E14';
        skCtx.fillRect(gx, gy, 28, 28);
      }
    }

    // 2. Dark Upper Wall
    skCtx.fillStyle = '#1D1722';
    skCtx.fillRect(0, 0, w, 58);
    skCtx.fillStyle = '#2D2434';
    skCtx.fillRect(0, 54, w, 6);

    // 3. Decorative Props (Top-left: Gacha, Fridge, Safe, Plant)
    // Gacha Machine
    skCtx.fillStyle = '#0EA5E9';
    skCtx.fillRect(36, 22, 32, 42);
    skCtx.fillStyle = '#E0F2FE';
    skCtx.fillRect(41, 27, 22, 18);
    skCtx.fillStyle = '#FACC15';
    skCtx.fillRect(44, 34, 6, 6);
    skCtx.fillStyle = '#F43F5E';
    skCtx.fillRect(53, 32, 6, 6);
    // Fridge
    skCtx.fillStyle = '#38BDF8';
    skCtx.fillRect(96, 18, 28, 44);
    skCtx.fillStyle = '#BAE6FD';
    skCtx.fillRect(99, 21, 22, 16);
    // Safe
    skCtx.fillStyle = '#15803D';
    skCtx.fillRect(142, 34, 24, 26);
    skCtx.fillStyle = '#FACC15';
    skCtx.fillRect(156, 44, 5, 5);
    // Glowing plant
    skCtx.fillStyle = '#22C55E';
    skCtx.fillRect(16, 120, 12, 22);
    skCtx.fillStyle = '#FDE047';
    skCtx.beginPath();
    skCtx.arc(22, 118, 4, 0, Math.PI * 2);
    skCtx.fill();

    // 4. Top-Center Dungeon Entrance Gate (Glowing Cyan Portal)
    var gatePulse = 0.7 + Math.sin(ms * 0.005) * 0.25;
    skCtx.fillStyle = '#0F172A';
    skCtx.fillRect(246, 8, 68, 52);
    skCtx.strokeStyle = 'rgba(56, 189, 248, ' + gatePulse + ')';
    skCtx.lineWidth = 3;
    skCtx.strokeRect(246, 8, 68, 52);
    skCtx.fillStyle = 'rgba(14, 165, 233, 0.28)';
    skCtx.fillRect(250, 12, 60, 46);
    skCtx.fillStyle = '#38BDF8';
    skCtx.font = 'bold 16px sans-serif';
    skCtx.textAlign = 'center';
    skCtx.fillText('⚔️', 280, 34);
    skCtx.fillStyle = '#E0F2FE';
    skCtx.font = 'bold 9px sans-serif';
    skCtx.fillText('VÀO HẦM NGỤC', 280, 50);

    // 5. Top-Right Couch, Chilly Cat & Task Board
    skCtx.fillStyle = '#92400E';
    skCtx.fillRect(334, 28, 64, 30);
    skCtx.fillStyle = '#B91C1C';
    skCtx.fillRect(338, 32, 56, 18);
    if (skImgReady('cat')) skCtx.drawImage(SK_IMG.cat, 410, 34, 22, 22);

    // Task / Challenge Board
    skCtx.fillStyle = '#78350F';
    skCtx.fillRect(444, 18, 52, 36);
    skCtx.fillStyle = '#FDE68A';
    skCtx.fillRect(450, 24, 18, 14);
    skCtx.fillStyle = '#BAE6FD';
    skCtx.fillRect(472, 26, 18, 12);
    skCtx.fillStyle = '#FEF3C7';
    skCtx.font = 'bold 9px sans-serif';
    skCtx.fillText('NHIỆM VỤ', 470, 62);

    // 6. Central Blue Dining Table with snacks/potions
    skCtx.fillStyle = 'rgba(0,0,0,0.35)';
    skCtx.fillRect(246, 190, 74, 8);
    skCtx.fillStyle = '#1E3A8A';
    skCtx.fillRect(244, 144, 72, 46);
    skCtx.fillStyle = '#3B82F6';
    skCtx.fillRect(247, 147, 66, 36);
    skCtx.fillStyle = '#EF4444';
    skCtx.fillRect(256, 156, 8, 10);
    skCtx.fillStyle = '#F59E0B';
    skCtx.fillRect(274, 160, 14, 7);
    skCtx.fillStyle = '#FFFFFF';
    skCtx.fillRect(294, 154, 10, 8);

    // 7. Bottom-Left Trash Bin, Books & Witch NPC (!)
    skCtx.fillStyle = '#16A34A';
    skCtx.fillRect(88, 306, 22, 26);
    skCtx.fillStyle = '#22C55E';
    skCtx.fillRect(86, 302, 26, 5);
    // Books
    skCtx.fillStyle = '#A855F7';
    skCtx.fillRect(118, 268, 14, 10);
    skCtx.fillStyle = '#F59E0B';
    skCtx.fillRect(120, 260, 12, 8);
    // Witch NPC with '!'
    skCtx.fillStyle = '#6B21A8';
    skCtx.fillRect(44, 256, 16, 18);
    skCtx.fillStyle = '#9333EA';
    skCtx.fillRect(40, 248, 24, 8);
    if (!skWitchClaimed) {
      skCtx.fillStyle = '#FFFFFF';
      skCtx.fillRect(47, 228, 10, 14);
      skCtx.fillStyle = '#DC2626';
      skCtx.font = 'bold 11px sans-serif';
      skCtx.fillText('!', 52, 239);
    }

    // 8. Right Reception Desk: Badass Lady (Difficulty NPC)
    var isBadass = window.SKHub && window.SKHub.getDifficulty() === 'badass';
    skCtx.fillStyle = '#BE185D';
    skCtx.fillRect(470, 138, 48, 24);
    skCtx.fillStyle = '#F472B6';
    skCtx.fillRect(472, 134, 44, 6);
    // NPC Lady behind desk
    skCtx.fillStyle = isBadass ? '#EF4444' : '#FBBF24';
    skCtx.fillRect(486, 118, 16, 16);
    skCtx.fillStyle = '#FEF3C7';
    skCtx.font = 'bold 9px sans-serif';
    skCtx.fillText(isBadass ? '🔥 BADASS' : 'ĐỘ KHÓ', 494, 174);

    // 9. Bottom-Right Blue TV
    skCtx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    skCtx.beginPath();
    skCtx.moveTo(492, 298);
    skCtx.lineTo(432, 255);
    skCtx.lineTo(432, 335);
    skCtx.closePath();
    skCtx.fill();
    skCtx.fillStyle = '#1E293B';
    skCtx.fillRect(488, 286, 26, 30);

    // 10. Hero NPCs standing in the Living Room (except the currently controlled hero if desired, or show all 4!)
    var activeHero = window.SKHub ? window.SKHub.getSelectedHero() : 'knight';
    SK_LOBBY_ITEMS.forEach(function (it) {
      if (!it.hero) return;
      if (it.hero === activeHero) return; // Player controls this hero!
      var lv = window.SKHub ? window.SKHub.getHeroLevel(it.hero) : 1;
      skCtx.fillStyle = 'rgba(0,0,0,0.35)';
      skCtx.beginPath();
      skCtx.ellipse(it.x, it.y + 10, 10, 4, 0, 0, Math.PI * 2);
      skCtx.fill();
      if (skImgReady(it.hero)) {
        skCtx.drawImage(SK_IMG[it.hero], it.x - 15, it.y - 17, 30, 30);
      } else {
        skCtx.fillStyle = '#94A3B8';
        skCtx.fillRect(it.x - 7, it.y - 10, 14, 18);
      }
      skCtx.fillStyle = '#FDE047';
      skCtx.font = 'bold 9px sans-serif';
      skCtx.fillText(it.hero.toUpperCase() + ' Lv.' + lv, it.x, it.y + 20);
    });

    // 11. Draw Player's Controlled Hero + Chilly Companion
    sk.heroId = activeHero;
    drawPixelHero(sk.px, sk.py, Math.atan2(sk.aimY - sk.py, sk.aimX - sk.px));

    // 12. Top-Right Gem Pill inside Canvas (like Image 1)
    if (window.SKHub) {
      skCtx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      skCtx.fillRect(w - 94, 8, 84, 20);
      window.SKHub.drawPixelGem(skCtx, w - 82, 18, 6);
      skCtx.fillStyle = '#FFFFFF';
      skCtx.font = 'bold 11px sans-serif';
      skCtx.textAlign = 'left';
      skCtx.fillText(String(window.SKHub.getGems()), w - 71, 22);
      skCtx.textAlign = 'center';
    }

    // 13. Interaction Prompt above nearest NPC / Gate / Board
    var near = getNearestLobbyItem();
    if (near) {
      skCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      skCtx.fillRect(near.x - 76, near.y - 42, 152, 20);
      skCtx.strokeStyle = '#38BDF8';
      skCtx.lineWidth = 1.5;
      skCtx.strokeRect(near.x - 76, near.y - 42, 152, 20);
      skCtx.fillStyle = '#FEF08A';
      skCtx.font = 'bold 10px sans-serif';
      skCtx.fillText('[F] ' + near.label, near.x, near.y - 29);
    }

    // 14. Lobby Toast Message
    if (skLobbyToastTick > 0) {
      skLobbyToastTick--;
      skCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      skCtx.fillRect(110, 322, 340, 24);
      skCtx.strokeStyle = '#FACC15';
      skCtx.lineWidth = 1.5;
      skCtx.strokeRect(110, 322, 340, 24);
      skCtx.fillStyle = '#FEF08A';
      skCtx.font = 'bold 11px sans-serif';
      skCtx.fillText(skLobbyToast, 280, 338);
    }
  }

  function skLobbyLoop(now) {
    if (!skLobbyActive || skRunning) return;
    if (!window.SKHub || !window.SKHub.isModalOpen()) {
      var mx = (sk.keys.d ? 1 : 0) - (sk.keys.a ? 1 : 0);
      var my = (sk.keys.s ? 1 : 0) - (sk.keys.w ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        var len = Math.hypot(mx, my);
        sk.px = Math.max(22, Math.min(538, sk.px + (mx / len) * 2.8));
        sk.py = Math.max(38, Math.min(340, sk.py + (my / len) * 2.8));
        // Walk directly into Dungeon Gate to start!
        if (sk.py < 54 && Math.abs(sk.px - 280) < 34) {
          startDungeonGame();
          return;
        }
      }
    }
    drawSkLivingRoom(now);
    skLobbyRaf = requestAnimationFrame(skLobbyLoop);
  }

  function startSkLobby() {
    if (!skCanvas) return;
    skLobbyActive = true;
    sk.px = 280; sk.py = 235;
    if ($('skOverlay')) $('skOverlay').hidden = true;
    if ($('skLobbyBar')) $('skLobbyBar').hidden = false;
    window.SKHub?.renderHub?.();
    if (skLobbyRaf) cancelAnimationFrame(skLobbyRaf);
    skLobbyRaf = requestAnimationFrame(skLobbyLoop);
  }

  function drawSkIdle() {
    startSkLobby();
  }

  function skLoop() {
    if (!skRunning || !skCtx || sk.pausedForLevel) return;
    var w = skCanvas.width, h = skCanvas.height;

    if (sk.invuln > 0) sk.invuln--;
    if (sk.fireCd > 0) sk.fireCd--;
    if (sk.slashTick > 0) sk.slashTick--;
    if (sk.dashCd > 0) sk.dashCd--;
    if (sk.ultCd > 0) sk.ultCd--;
    if (sk.ultActive > 0) sk.ultActive--;
    if ($('btnSkUlt')) {
      $('btnSkUlt').textContent = sk.ultCd > 0 ? ('⏳ ' + Math.ceil(sk.ultCd / 60) + 's') : '🔥 Chiêu (R)';
      $('btnSkUlt').disabled = sk.ultCd > 0;
    }

    // Shield auto-regeneration (Soul Knight mechanic, disabled in no_shield challenge)
    var noShieldChal = window.SKHub && window.SKHub.getChallenge() === 'no_shield';
    sk.shieldRegenTick++;
    if (!noShieldChal && sk.shield < sk.maxShield && sk.shieldRegenTick > 180) {
      sk.shield++;
      sk.shieldRegenTick = 120;
      updateSkHUD();
    }

    // Hero movement
    var vx = 0, vy = 0;
    if (sk.dashTick > 0) {
      vx = sk.dashDx * 7.5;
      vy = sk.dashDy * 7.5;
      sk.dashTick--;
      sk.ghosts.push({ x: sk.px, y: sk.py, life: 12 });
    } else {
      var mx = (sk.keys.d ? 1 : 0) - (sk.keys.a ? 1 : 0);
      var my = (sk.keys.s ? 1 : 0) - (sk.keys.w ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        var mLen = Math.hypot(mx, my);
        vx = (mx / mLen) * 3.1;
        vy = (my / mLen) * 3.1;
      }
    }

    var nx = Math.max(26, Math.min(w - 26, sk.px + vx));
    if (!hitsPillar(nx, sk.py, 10)) sk.px = nx;
    var ny = Math.max(28, Math.min(h - 26, sk.py + vy));
    if (!hitsPillar(sk.px, ny, 10)) sk.py = ny;

    if (sk.mouseDown || sk.autoFire) fireSkWeapon();

    for (var g = sk.ghosts.length - 1; g >= 0; g--) {
      sk.ghosts[g].life--;
      if (sk.ghosts[g].life <= 0) sk.ghosts.splice(g, 1);
    }

    drawSkDungeonFloor();

    // Update & draw Elemental Zones
    for (var zi = sk.zones.length - 1; zi >= 0; zi--) {
      var z = sk.zones[zi];
      z.life--;
      z.tick++;
      skCtx.save();
      skCtx.globalAlpha = Math.min(0.42, z.life / 120);
      skCtx.fillStyle = z.kind === 'ice' ? '#38BDF8' : (z.kind === 'fire' ? '#F97316' : '#4ADE80');
      skCtx.beginPath();
      skCtx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      skCtx.fill();
      skCtx.strokeStyle = z.kind === 'ice' ? '#BAE6FD' : (z.kind === 'fire' ? '#FDE047' : '#86EFAC');
      skCtx.lineWidth = 2;
      skCtx.stroke();
      skCtx.restore();

      if (z.tick % 24 === 0) {
        for (var zei = sk.enemies.length - 1; zei >= 0; zei--) {
          var zen = sk.enemies[zei];
          if (Math.hypot(zen.x - z.x, zen.y - z.y) <= z.r + zen.r) {
            if (z.kind === 'ice') zen.chill = Math.max(zen.chill || 0, 50);
            damageSkEnemy(zei, Math.max(1, getBuffLvl('elem_zone')), null);
          }
        }
      }
      if (z.life <= 0) sk.zones.splice(zi, 1);
    }

    // Draw & check crates
    sk.crates.forEach(function (c) {
      skCtx.fillStyle = '#92400E';
      skCtx.fillRect(c.x, c.y, c.w, c.h);
      skCtx.strokeStyle = '#F59E0B';
      skCtx.lineWidth = 2;
      skCtx.strokeRect(c.x, c.y, c.w, c.h);
    });

    // Update & draw EXP Gems (magnetized to hero!)
    for (var gi = sk.expGems.length - 1; gi >= 0; gi--) {
      var gem = sk.expGems[gi];
      gem.life--;
      var gd = Math.hypot(sk.px - gem.x, sk.py - gem.y);
      if (gd < 95) {
        var pull = (100 - gd) / 22 + 1.8;
        gem.x += ((sk.px - gem.x) / Math.max(1, gd)) * pull;
        gem.y += ((sk.py - gem.y) / Math.max(1, gd)) * pull;
      }
      if (gd < 18) {
        var val = gem.val;
        sk.expGems.splice(gi, 1);
        beep(1180, 0.05, 'sine');
        grantSkExp(val);
        if (sk.pausedForLevel) return;
        continue;
      }
      // Draw cyan diamond pixel gem
      skCtx.fillStyle = '#38BDF8';
      skCtx.fillRect(Math.round(gem.x - 4), Math.round(gem.y - 4), 8, 8);
      skCtx.fillStyle = '#E0F2FE';
      skCtx.fillRect(Math.round(gem.x - 2), Math.round(gem.y - 2), 4, 4);
      if (gem.life <= 0) sk.expGems.splice(gi, 1);
    }

    // Update & draw Blue Soul Knight Currency Gems (Image 3 style)
    for (var bg = sk.gemDrops.length - 1; bg >= 0; bg--) {
      var bgem = sk.gemDrops[bg];
      bgem.life--;
      var bgd = Math.hypot(sk.px - bgem.x, sk.py - bgem.y);
      if (bgd < 105) {
        var bpull = (110 - bgd) / 20 + 2.0;
        bgem.x += ((sk.px - bgem.x) / Math.max(1, bgd)) * bpull;
        bgem.y += ((sk.py - bgem.y) / Math.max(1, bgd)) * bpull;
      }
      if (bgd < 18) {
        if (window.SKHub) window.SKHub.addGems(bgem.val);
        sk.gemDrops.splice(bg, 1);
        beep(1320, 0.06, 'sine');
        continue;
      }
      if (window.SKHub && typeof window.SKHub.drawPixelGem === 'function') {
        window.SKHub.drawPixelGem(skCtx, bgem.x, bgem.y, 5.5);
      } else {
        skCtx.fillStyle = '#38BDF8';
        skCtx.beginPath();
        skCtx.arc(bgem.x, bgem.y, 5, 0, Math.PI * 2);
        skCtx.fill();
      }
      if (bgem.life <= 0) sk.gemDrops.splice(bg, 1);
    }

    // Update & draw pickups
    for (var d = sk.drops.length - 1; d >= 0; d--) {
      var dr = sk.drops[d];
      dr.life--;
      skCtx.font = '15px sans-serif';
      skCtx.textAlign = 'center';
      skCtx.fillText(dr.type === 'hp' ? '🧪' : '⚡', dr.x, dr.y + 4);
      if (Math.hypot(dr.x - sk.px, dr.y - sk.py) < 20) {
        if (dr.type === 'hp') sk.hp = Math.min(sk.maxHp, sk.hp + 1);
        else sk.energy = Math.min(sk.maxEnergy, sk.energy + 30);
        beep(1040, 0.08, 'sine');
        updateSkHUD();
        sk.drops.splice(d, 1);
        continue;
      }
      if (dr.life <= 0) sk.drops.splice(d, 1);
    }

    // Update player bullets
    for (var bi = sk.bullets.length - 1; bi >= 0; bi--) {
      var bl = sk.bullets[bi];
      var hitWallX = bl.x + bl.vx < 16 || bl.x + bl.vx > w - 16 || hitsPillar(bl.x + bl.vx, bl.y, 2);
      var hitWallY = bl.y + bl.vy < 16 || bl.y + bl.vy > h - 16 || hitsPillar(bl.x, bl.y + bl.vy, 2);
      if (hitWallX || hitWallY) {
        if (bl.bounce && bl.bounce > 0) {
          bl.bounce--;
          if (hitWallX) bl.vx = -bl.vx;
          if (hitWallY) bl.vy = -bl.vy;
        } else {
          sk.bullets.splice(bi, 1);
          continue;
        }
      }
      bl.x += bl.vx; bl.y += bl.vy;
      var hitCrate = false;
      for (var ci = sk.crates.length - 1; ci >= 0; ci--) {
        var cr = sk.crates[ci];
        if (bl.x > cr.x && bl.x < cr.x + cr.w && bl.y > cr.y && bl.y < cr.y + cr.h) {
          cr.hp--;
          if (cr.hp <= 0) {
            sk.drops.push({ x: cr.x + 14, y: cr.y + 14, type: Math.random() < 0.4 ? 'hp' : 'energy', life: 500 });
            sk.crates.splice(ci, 1);
          }
          hitCrate = true;
          break;
        }
      }
      if (hitCrate) { sk.bullets.splice(bi, 1); continue; }

      var hitEn = false;
      for (var ei = sk.enemies.length - 1; ei >= 0; ei--) {
        var en = sk.enemies[ei];
        if (bl.hitIds && bl.hitIds.indexOf(en) !== -1) continue;
        if (Math.hypot(bl.x - en.x, bl.y - en.y) < en.r + bl.r) {
          if (bl.hitIds) bl.hitIds.push(en);
          damageSkEnemy(ei, bl.dmg, bl.elem);
          if (bl.pierce && bl.pierce > 0) {
            bl.pierce--;
          } else {
            hitEn = true;
          }
          break;
        }
      }
      if (hitEn) { sk.bullets.splice(bi, 1); continue; }

      skCtx.fillStyle = bl.color;
      skCtx.fillRect(Math.round(bl.x - bl.r), Math.round(bl.y - bl.r), bl.r * 2, bl.r * 2);
    }

    // Energy regeneration buff
    if (getBuffLvl('energy_regen') > 0 && sk.shieldRegenTick % 20 === 0) {
      sk.energy = Math.min(sk.maxEnergy, sk.energy + getBuffLvl('energy_regen'));
      if ($('skEnergy')) $('skEnergy').textContent = sk.energy;
    }

    // Update & draw Crystal Crab Spike Pillars (3s lifetime)
    for (var spi = sk.spikes.length - 1; spi >= 0; spi--) {
      var sp = sk.spikes[spi];
      sp.life--;
      skCtx.save();
      skCtx.globalAlpha = Math.min(1, sp.life / 25);
      skCtx.fillStyle = sp.color || '#EF4444';
      skCtx.strokeStyle = '#FFFFFF';
      skCtx.lineWidth = 1.5;
      skCtx.beginPath();
      skCtx.moveTo(sp.x, sp.y - 16);
      skCtx.lineTo(sp.x + 8, sp.y + 6);
      skCtx.lineTo(sp.x - 8, sp.y + 6);
      skCtx.closePath();
      skCtx.fill();
      skCtx.stroke();
      skCtx.restore();
      if (sk.invuln === 0 && Math.hypot(sk.px - sp.x, sk.py - sp.y) < sp.r + 8) {
        sk.invuln = 36;
        sk.shieldRegenTick = 0;
        if (sk.shield > 0) sk.shield--;
        else sk.hp--;
        beep(210, 0.14, 'sawtooth');
        updateSkHUD();
        if (sk.hp <= 0) { endDungeonGame(); return; }
      }
      if (sp.life <= 0) sk.spikes.splice(spi, 1);
    }

    // Update enemies, elemental statuses, Boss special skills & firing
    for (var i = sk.enemies.length - 1; i >= 0; i--) {
      var e = sk.enemies[i];
      if (e.crystalRage && e.crystalRage > 0) e.crystalRage--;
      if (e.type === 'mini_slime' && typeof e.life === 'number') {
        e.life--;
        if (e.life <= 0) {
          for (var m3 = 0; m3 < 3; m3++) {
            var ma3 = (Math.PI * 2 * m3) / 3 + Math.random() * 0.4;
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(ma3) * 2.6, vy: Math.sin(ma3) * 2.6, r: 4, col: '#FB7185' });
          }
          sk.enemies.splice(i, 1);
          continue;
        }
      }
      if (e.burn && e.burn > 0) {
        e.burn--;
        if (e.burn % 30 === 0) {
          sk.particles.push({ x: e.x, y: e.y - 6, vx: 0, vy: -0.8, color: '#F97316', life: 12 });
          damageSkEnemy(i, 1, null);
          if (!sk.enemies[i]) continue;
        }
      }
      if (e.poison && e.poison > 0) {
        e.poison--;
        if (e.poison % 35 === 0) {
          sk.particles.push({ x: e.x, y: e.y - 6, vx: 0, vy: -0.6, color: '#4ADE80', life: 12 });
          damageSkEnemy(i, 1, null);
          if (!sk.enemies[i]) continue;
        }
      }
      var chilled = e.chill && e.chill > 0;
      if (chilled) e.chill--;

      if (e.empowered && e.empowered > 0) e.empowered--;
      var spd = e.speed * (chilled ? 0.55 : 1) * (e.empowered && e.empowered > 0 ? 1.5 : 1);
      var angToHero = Math.atan2(sk.py - e.y, sk.px - e.x);
      var distHero = Math.hypot(sk.px - e.x, sk.py - e.y);
      var stopDist = e.type === 'bomber' ? 14 : (e.isBoss ? 90 : 75);
      if (distHero > stopDist) {
        var ex = e.x + Math.cos(angToHero) * spd;
        var ey = e.y + Math.sin(angToHero) * spd;
        if (!hitsPillar(ex, e.y, e.r)) e.x = ex;
        if (!hitsPillar(e.x, ey, e.r)) e.y = ey;
      }
      if (e.type === 'bomber' && distHero < 26) {
        damageSkEnemy(i, e.hp + 10, null);
        continue;
      }

      if (e.type === 'ice_boss') {
        if (sk.spikes.length === 0 && e.spikeCooldown > 0) e.spikeCooldown--;
        // Cua Pha Lê: Làn sóng đạn mỗi 2 giây (120 frames)
        if (typeof e.crabWaveCd !== 'number') e.crabWaveCd = 120;
        e.crabWaveCd -= (chilled ? 0.55 : 1);
        if (e.crabWaveCd <= 0) {
          e.crabWaveCd = 120;
          for (var cw = -4; cw <= 4; cw++) {
            var cwa = angToHero + cw * 0.16;
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(cwa) * 2.8, vy: Math.sin(cwa) * 2.8, r: 5, col: '#38BDF8' });
          }
        }
      }

      if (e.type === 'fire_boss') {
        // Slime Vương: Sóng xung kích khi ở gần + 12 viên đạn 360° mỗi 2 giây (120 frames)
        if (typeof e.ringCd !== 'number') e.ringCd = 120;
        if (typeof e.shockCd !== 'number') e.shockCd = 0;
        if (e.shockCd > 0) e.shockCd--;
        e.ringCd -= (chilled ? 0.55 : 1);
        if (e.ringCd <= 0) {
          e.ringCd = 120;
          for (var fb360 = 0; fb360 < 12; fb360++) {
            var fa360 = (Math.PI * 2 * fb360) / 12;
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(fa360) * 2.8, vy: Math.sin(fa360) * 2.8, r: 5, col: '#F97316' });
          }
        }
        if (distHero < 72 && e.shockCd <= 0) {
          e.shockCd = 120;
          skCtx.save();
          skCtx.strokeStyle = '#F97316';
          skCtx.lineWidth = 4;
          skCtx.beginPath();
          skCtx.arc(e.x, e.y, 72, 0, Math.PI * 2);
          skCtx.stroke();
          skCtx.restore();
          if (sk.invuln === 0) {
            sk.invuln = 30;
            sk.shieldRegenTick = 0;
            if (sk.shield > 0) sk.shield--;
            else sk.hp--;
            beep(210, 0.14, 'sawtooth');
            updateSkHUD();
            if (sk.hp <= 0) { endDungeonGame(); return; }
          }
        }
      }

      if (e.type === 'void_boss') {
        // Chúa Tể Hư Không: Tàng hình 5s (300f) miễn nhiễm, sau khi hết mới hồi 10s (600f)
        if (typeof e.invisActive !== 'number') e.invisActive = 0;
        if (typeof e.invisCd !== 'number') e.invisCd = 300;
        if (e.invisActive > 0) {
          e.invisActive--;
          if (e.invisActive === 0) {
            e.invisCd = 600; // 10s cooldown starts AFTER invisibility ends!
          }
        } else {
          e.invisCd--;
          if (e.invisCd <= 0) {
            e.invisActive = 300; // 5s invisibility
            beep(520, 0.12, 'sine');
          }
        }
      }

      if (e.type === 'storm_boss') {
        if (typeof e.tpCd !== 'number') e.tpCd = 300;
        if (typeof e.waveCd !== 'number') e.waveCd = 240;
        if (typeof e.lightningPassiveCd !== 'number') e.lightningPassiveCd = 180;
        var empMult = (e.empowered && e.empowered > 0) ? 1.5 : 1;
        e.tpCd -= (chilled ? 0.55 : 1);
        e.waveCd -= (chilled ? 0.55 : 1) * empMult;
        e.lightningPassiveCd--;

        // Nội tại 3s (180 frames): 50% giáng sét trúng người chơi (-3 giáp, -2 máu), 50% trúng Boss (cường hóa 5s)
        if (e.lightningPassiveCd <= 0) {
          e.lightningPassiveCd = 180;
          if (Math.random() < 0.5) {
            sk.zaps.push({ x1: sk.px, y1: 16, x2: sk.px, y2: sk.py, life: 16 });
            sk.shieldRegenTick = 0;
            if (sk.shield > 0) sk.shield = Math.max(0, sk.shield - 3);
            sk.hp -= 2;
            beep(180, 0.2, 'sawtooth');
            updateSkHUD();
            if (sk.hp <= 0) { endDungeonGame(); return; }
          } else {
            sk.zaps.push({ x1: e.x, y1: 16, x2: e.x, y2: e.y, life: 16 });
            e.empowered = 300; // 5 seconds empowered!
            beep(880, 0.14, 'triangle');
          }
        }

        // Teleport cooldown: strictly 5 seconds (300 frames) between teleports
        if (e.tpCd <= 0) {
          e.tpCd = 300;
          for (var tp = 0; tp < 6; tp++) {
            sk.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, color: '#EF4444', life: 16 });
          }
          var txp, typ;
          do {
            txp = 60 + Math.random() * (w - 120);
            typ = 56 + Math.random() * 140;
          } while (hitsPillar(txp, typ, e.r));
          e.x = txp; e.y = typ;
        }

        // Bullet Wave skill (10s cooldown): fires even more bullets!
        if (e.waveCd <= 0) {
          e.waveCd = 600;
          var bSpd = e.empowered > 0 ? 3.5 : 3.0;
          for (var wv = -8; wv <= 8; wv++) {
            var wa = angToHero + wv * 0.12;
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(wa) * bSpd, vy: Math.sin(wa) * bSpd, r: 5.5, col: '#EF4444' });
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(wa + 0.06) * (bSpd * 0.76), vy: Math.sin(wa + 0.06) * (bSpd * 0.76), r: 4.5, col: '#FACC15' });
          }
          beep(320, 0.14, 'sawtooth');
        }
      } else if (e.isBoss) {
        e.specialCd = (e.specialCd || 100) - (chilled ? 0.55 : 1);
        if (e.specialCd <= 0) {
          e.specialCd = Math.max(70, 125 - sk.wave * 3);
          if (e.type === 'fire_boss') {
            // Fire Boss leaps closer and drops a lava hazard ring
            var lx = Math.max(40, Math.min(w - 40, e.x + Math.cos(angToHero) * 52));
            var ly = Math.max(40, Math.min(h - 40, e.y + Math.sin(angToHero) * 52));
            if (!hitsPillar(lx, ly, e.r)) { e.x = lx; e.y = ly; }
            for (var fb = 0; fb < 12; fb++) {
              var fa = (Math.PI * 2 * fb) / 12;
              sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(fa) * 2.8, vy: Math.sin(fa) * 2.8, r: 5, col: '#F97316' });
            }
          } else if (e.type === 'ice_boss') {
            // Ice Boss summons 2 mini skeletons (if room < 6 enemies)
            if (sk.enemies.length < 6) {
              for (var m = 0; m < 2; m++) {
                sk.enemies.push({
                  x: Math.max(40, Math.min(w - 40, e.x + (m === 0 ? -36 : 36))),
                  y: Math.min(h - 40, e.y + 24), r: 10, hp: 5 + sk.wave, maxHp: 5 + sk.wave,
                  type: 'skeleton', speed: 1.0, cd: 45
                });
              }
            }
          } else if (e.type === 'void_boss') {
            // Void Boss teleports & fires spiral orbs!
            for (var tp2 = 0; tp2 < 6; tp2++) {
              sk.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, color: '#C084FC', life: 16 });
            }
            var txp2, typ2;
            do {
              txp2 = 60 + Math.random() * (w - 120);
              typ2 = 56 + Math.random() * 140;
            } while (hitsPillar(txp2, typ2, e.r));
            e.x = txp2; e.y = typ2;
            for (var vb = 0; vb < 14; vb++) {
              var va = (Math.PI * 2 * vb) / 14 + e.phase * 0.2;
              sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(va) * 2.9, vy: Math.sin(va) * 2.9, r: 5, col: '#C084FC' });
            }
          }
        }
      }

      e.cd -= (chilled ? 0.55 : 1) * (e.empowered && e.empowered > 0 ? 1.8 : 1);
      if (e.cd <= 0) {
        if (e.isBoss) {
          e.cd = Math.max(26, 44 - Math.floor(sk.wave / 2));
          e.phase = (e.phase + 1) % 4;
          var ringCount = e.type === 'ice_boss' ? 8 : (e.type === 'storm_boss' ? 6 : (e.type === 'void_boss' ? 12 : 10));
          for (var r = 0; r < ringCount; r++) {
            var ba = (e.type === 'storm_boss')
              ? angToHero + (r - 2.5) * 0.22
              : (Math.PI * 2 * r) / ringCount + e.phase * 0.3;
            var bCol = e.type === 'ice_boss' ? '#38BDF8' : (e.type === 'storm_boss' ? '#FACC15' : (e.type === 'void_boss' ? '#A855F7' : '#FB7185'));
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(ba) * 2.7, vy: Math.sin(ba) * 2.7, r: 5, col: bCol });
          }
        } else if (e.type === 'mage') {
          e.cd = Math.max(55, 110 - sk.wave * 2);
          for (var mf = -1; mf <= 1; mf++) {
            var ma = angToHero + mf * 0.24;
            sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(ma) * 2.7, vy: Math.sin(ma) * 2.7, r: 4, col: '#C084FC' });
          }
        } else if (e.type !== 'bomber') {
          e.cd = Math.max(45, (e.type === 'slime' ? 85 : 105) - sk.wave * 2);
          sk.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(angToHero) * (2.5 + Math.min(1.2, sk.wave * 0.08)), vy: Math.sin(angToHero) * (2.5 + Math.min(1.2, sk.wave * 0.08)), r: 4 });
        }
      }
      drawPixelEnemy(e);
      if (chilled) {
        skCtx.strokeStyle = '#67E8F9';
        skCtx.lineWidth = 2;
        skCtx.strokeRect(Math.round(e.x - e.r - 2), Math.round(e.y - e.r - 2), e.r * 2 + 4, e.r * 2 + 4);
      }
    }

    // Orbital Satellite Spheres (orbit_shield buff)
    var orbitLvl = getBuffLvl('orbit_shield');
    if (orbitLvl > 0) {
      var orbCount = Math.min(6, 1 + orbitLvl);
      var orbT = performance.now() * 0.004;
      for (var oi = 0; oi < orbCount; oi++) {
        var oa = orbT + (Math.PI * 2 * oi) / orbCount;
        var ox = sk.px + Math.cos(oa) * 32;
        var oy = sk.py + Math.sin(oa) * 32;
        skCtx.fillStyle = '#38BDF8';
        skCtx.beginPath();
        skCtx.arc(ox, oy, 5.5, 0, Math.PI * 2);
        skCtx.fill();
        skCtx.strokeStyle = '#E0F2FE';
        skCtx.lineWidth = 1.5;
        skCtx.stroke();

        // Block enemy bullets & damage close enemies
        for (var ob = sk.eBullets.length - 1; ob >= 0; ob--) {
          if (Math.hypot(sk.eBullets[ob].x - ox, sk.eBullets[ob].y - oy) < 12) {
            sk.eBullets.splice(ob, 1);
          }
        }
        if (sk.shieldRegenTick % 16 === 0) {
          for (var oe = sk.enemies.length - 1; oe >= 0; oe--) {
            if (Math.hypot(sk.enemies[oe].x - ox, sk.enemies[oe].y - oy) < sk.enemies[oe].r + 8) {
              damageSkEnemy(oe, 1, 'ice');
            }
          }
        }
      }
    }

    // Draw lightning chain zaps
    for (var zi2 = sk.zaps.length - 1; zi2 >= 0; zi2--) {
      var zp = sk.zaps[zi2];
      zp.life--;
      skCtx.strokeStyle = '#FDE047';
      skCtx.lineWidth = 2.5;
      skCtx.beginPath();
      skCtx.moveTo(zp.x1, zp.y1);
      skCtx.lineTo((zp.x1 + zp.x2) / 2 + (Math.random() - 0.5) * 14, (zp.y1 + zp.y2) / 2 + (Math.random() - 0.5) * 14);
      skCtx.lineTo(zp.x2, zp.y2);
      skCtx.stroke();
      if (zp.life <= 0) sk.zaps.splice(zi2, 1);
    }

    // Update enemy bullets
    for (var ebi = sk.eBullets.length - 1; ebi >= 0; ebi--) {
      var eb = sk.eBullets[ebi];
      eb.x += eb.vx; eb.y += eb.vy;
      if (eb.x < 16 || eb.x > w - 16 || eb.y < 16 || eb.y > h - 16 || hitsPillar(eb.x, eb.y, 2)) {
        sk.eBullets.splice(ebi, 1);
        continue;
      }
      if (sk.invuln === 0 && Math.hypot(eb.x - sk.px, eb.y - sk.py) < 10 + eb.r) {
        sk.eBullets.splice(ebi, 1);
        sk.invuln = 36;
        sk.shieldRegenTick = 0;
        if (sk.shield > 0) sk.shield--;
        else sk.hp--;
        beep(210, 0.14, 'sawtooth');
        updateSkHUD();
        if (sk.hp <= 0) { endDungeonGame(); return; }
        continue;
      }
      skCtx.fillStyle = eb.col || '#FB7185';
      skCtx.fillRect(Math.round(eb.x - eb.r), Math.round(eb.y - eb.r), eb.r * 2, eb.r * 2);
      skCtx.fillStyle = '#FFF1F2';
      skCtx.fillRect(Math.round(eb.x - 1), Math.round(eb.y - 1), 2, 2);
    }

    // Thunder Nova skill (Lôi Đình Giáng Thế)
    var thunderLv = getBuffLvl('thunder_nova');
    if (thunderLv > 0 && sk.enemies.length > 0) {
      sk.thunderTick++;
      if (sk.thunderTick >= Math.max(95, 210 - thunderLv * 30)) {
        sk.thunderTick = 0;
        var nearestIdx = 0, nearD = 9999;
        for (var ti = 0; ti < sk.enemies.length; ti++) {
          var td = Math.hypot(sk.enemies[ti].x - sk.px, sk.enemies[ti].y - sk.py);
          if (td < nearD) { nearD = td; nearestIdx = ti; }
        }
        var tEnemy = sk.enemies[nearestIdx];
        if (tEnemy) {
          sk.zaps.push({ x1: tEnemy.x, y1: 16, x2: tEnemy.x, y2: tEnemy.y, life: 14 });
          damageSkEnemy(nearestIdx, 3 + thunderLv * 2, 'bolt');
          beep(680, 0.08, 'sawtooth');
        }
      }
    }

    // Clone Turret skill (Pháo Đài Phố Cổ)
    if (sk.turret && sk.turret.life > 0) {
      sk.turret.life--;
      sk.turret.cd--;
      skCtx.fillStyle = '#0F172A';
      skCtx.fillRect(sk.turret.x - 10, sk.turret.y - 10, 20, 20);
      skCtx.strokeStyle = '#38BDF8';
      skCtx.lineWidth = 2;
      skCtx.strokeRect(sk.turret.x - 10, sk.turret.y - 10, 20, 20);
      skCtx.fillStyle = '#38BDF8';
      skCtx.fillRect(sk.turret.x - 3, sk.turret.y - 3, 6, 6);
      if (sk.turret.cd <= 0 && sk.enemies.length > 0) {
        sk.turret.cd = Math.max(16, 38 - getBuffLvl('clone_turret') * 6);
        sk.turret.shots = (sk.turret.shots || 0) + 1;
        var te = sk.enemies[0];
        var ta = Math.atan2(te.y - sk.turret.y, te.x - sk.turret.x);
        var isMissile = sk.heroId === 'engineer' && sk.heroStats && sk.heroStats.hasLv5Buff && (sk.turret.shots % 3 === 0);
        sk.bullets.push({
          x: sk.turret.x, y: sk.turret.y,
          vx: Math.cos(ta) * (isMissile ? 6.2 : 7.5), vy: Math.sin(ta) * (isMissile ? 6.2 : 7.5),
          color: isMissile ? '#F97316' : '#38BDF8', elem: isMissile ? 'fire' : 'bolt',
          dmg: (1 + getBuffLvl('clone_turret')) * (isMissile ? 3 : 1), r: isMissile ? 6.5 : 4, pierce: 0, bounce: 0, hitIds: []
        });
      }
    }

    // Companion Pet: Chilly the Black Cat
    if (sk.pet) {
      var targetPetX = sk.px - 24;
      var targetPetY = sk.py + 10;
      sk.pet.x += (targetPetX - sk.pet.x) * 0.08;
      sk.pet.y += (targetPetY - sk.pet.y) * 0.08;
      if (skImgReady('cat')) {
        skCtx.drawImage(SK_IMG.cat, Math.round(sk.pet.x - 10), Math.round(sk.pet.y - 10), 20, 20);
      } else {
        skCtx.fillStyle = '#0F172A';
        skCtx.fillRect(Math.round(sk.pet.x - 5), Math.round(sk.pet.y - 5), 10, 10);
      }
      sk.pet.cd--;
      if (sk.pet.cd <= 0 && sk.enemies.length > 0) {
        sk.pet.cd = 75;
        var pe = sk.enemies[0];
        var pa = Math.atan2(pe.y - sk.pet.y, pe.x - sk.pet.x);
        sk.bullets.push({
          x: sk.pet.x, y: sk.pet.y, vx: Math.cos(pa) * 6.5, vy: Math.sin(pa) * 6.5,
          color: '#38BDF8', elem: 'ice', dmg: 1, r: 3.5, pierce: 0, bounce: 0, hitIds: []
        });
      }
    }

    drawPixelHero(sk.px, sk.py, Math.atan2(sk.aimY - sk.py, sk.aimX - sk.px));

    // Particles
    for (var pi = sk.particles.length - 1; pi >= 0; pi--) {
      var pt = sk.particles[pi];
      pt.x += pt.vx; pt.y += pt.vy; pt.life--;
      skCtx.fillStyle = pt.color;
      skCtx.fillRect(Math.round(pt.x), Math.round(pt.y), 4, 4);
      if (pt.life <= 0) sk.particles.splice(pi, 1);
    }

    // Biome Entry Banner
    if (sk.biomeBannerTick > 0) {
      sk.biomeBannerTick--;
      skCtx.save();
      skCtx.globalAlpha = Math.min(1, sk.biomeBannerTick / 30);
      skCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      skCtx.fillRect(100, 48, 360, 34);
      skCtx.strokeStyle = '#FACC15';
      skCtx.lineWidth = 2;
      skCtx.strokeRect(100, 48, 360, 34);
      skCtx.fillStyle = '#FEF08A';
      skCtx.font = 'bold 13px sans-serif';
      skCtx.textAlign = 'center';
      skCtx.fillText(getCurrentBiome().name, 280, 69);
      skCtx.restore();
    }

    // Portal or Next wave when room cleared!
    if (sk.enemies.length === 0) {
      if (sk.wave % 10 === 0) {
        if (!sk.portal) {
          sk.portal = { x: 280, y: 110, r: 26, tick: 0 };
          sk.hp = Math.min(sk.maxHp, sk.hp + 2);
          sk.shield = sk.maxShield;
          beep(1046, 0.2, 'sine');
          updateSkHUD();
        }
        sk.portal.tick++;
        var pr = sk.portal.r + Math.sin(sk.portal.tick * 0.12) * 3;
        skCtx.save();
        skCtx.fillStyle = 'rgba(139, 92, 246, 0.35)';
        skCtx.beginPath();
        skCtx.arc(sk.portal.x, sk.portal.y, pr + 8, 0, Math.PI * 2);
        skCtx.fill();
        skCtx.strokeStyle = '#C084FC';
        skCtx.lineWidth = 4;
        skCtx.beginPath();
        skCtx.arc(sk.portal.x, sk.portal.y, pr, 0, Math.PI * 2);
        skCtx.stroke();
        skCtx.fillStyle = '#38BDF8';
        skCtx.beginPath();
        skCtx.arc(sk.portal.x, sk.portal.y, pr * 0.55, 0, Math.PI * 2);
        skCtx.fill();
        skCtx.fillStyle = '#FEF08A';
        skCtx.font = 'bold 12px sans-serif';
        skCtx.textAlign = 'center';
        skCtx.fillText('🌀 Bước vào Cánh Cổng để sang Vùng Mới!', 280, 68);
        skCtx.restore();

        if (Math.hypot(sk.px - sk.portal.x, sk.py - sk.portal.y) < sk.portal.r + 10) {
          sk.wave++;
          sk.portal = null;
          sk.biomeBannerTick = 140;
          sk.energy = Math.min(sk.maxEnergy, sk.energy + 60);
          beep(1318, 0.22, 'triangle');
          spawnSkWave(sk.wave);
          grantSkExp(35 + sk.wave * 2);
          if (sk.pausedForLevel) return;
        }
      } else {
        sk.wave++;
        sk.hp = Math.min(sk.maxHp, sk.hp + 1);
        sk.energy = Math.min(sk.maxEnergy, sk.energy + 40);
        beep(980, 0.16, 'triangle');
        spawnSkWave(sk.wave);
        grantSkExp(15 + sk.wave * 2);
        if (sk.pausedForLevel) return;
      }
    }

    skRaf = requestAnimationFrame(skLoop);
  }

  if (skCanvas) {
    skCanvas.addEventListener('pointermove', function (e) {
      var rect = skCanvas.getBoundingClientRect();
      sk.aimX = (e.clientX - rect.left) * (skCanvas.width / rect.width);
      sk.aimY = (e.clientY - rect.top) * (skCanvas.height / rect.height);
    });
    skCanvas.addEventListener('pointerdown', function (e) {
      var rect = skCanvas.getBoundingClientRect();
      var cx = (e.clientX - rect.left) * (skCanvas.width / rect.width);
      var cy = (e.clientY - rect.top) * (skCanvas.height / rect.height);
      sk.aimX = cx;
      sk.aimY = cy;
      if (skLobbyActive && !skRunning) {
        if (window.SKHub && window.SKHub.isModalOpen()) return;
        for (var li = 0; li < SK_LOBBY_ITEMS.length; li++) {
          var item = SK_LOBBY_ITEMS[li];
          if (Math.hypot(cx - item.x, cy - item.y) <= item.r + 6) {
            interactSkLobby(item);
            return;
          }
        }
        return;
      }
      if (!skRunning) return;
      sk.mouseDown = true;
    });
    window.addEventListener('pointerup', function () { sk.mouseDown = false; });
  }

  document.querySelectorAll('.sk-hero-choice').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var hId = btn.getAttribute('data-hero') || 'knight';
      sk.heroId = hId;
      document.querySelectorAll('.sk-hero-choice').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  $('btnStartDungeon')?.addEventListener('click', startDungeonGame);
  $('btnSkUlt')?.addEventListener('click', triggerSkUlt);
  $('btnSkDash')?.addEventListener('click', triggerSkDash);
  $('btnSkFire')?.addEventListener('pointerdown', function () { sk.autoFire = true; });
  $('btnSkFire')?.addEventListener('pointerup', function () { sk.autoFire = false; });
  $('btnSkFire')?.addEventListener('pointerleave', function () { sk.autoFire = false; });

  document.querySelectorAll('.sk-wpn-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectSkWeapon(parseInt(btn.getAttribute('data-wpn'), 10));
    });
  });

  /* ---- Global Keyboard Controls when any 2D Game is Running ---- */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (activeTab === 'catch' && catchRunning) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); catchState.keys.left = true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); catchState.keys.right = true; }
    } else if (activeTab === 'snake' && snakeRunning) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); setSnakeDir('up'); }
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); setSnakeDir('down'); }
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); setSnakeDir('left'); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); setSnakeDir('right'); }
    } else if (activeTab === 'dungeon' && skLobbyActive && !skRunning) {
      var kl = e.key.toLowerCase();
      if (kl === 'w' || e.key === 'ArrowUp') { e.preventDefault(); sk.keys.w = true; }
      if (kl === 's' || e.key === 'ArrowDown') { e.preventDefault(); sk.keys.s = true; }
      if (kl === 'a' || e.key === 'ArrowLeft') { e.preventDefault(); sk.keys.a = true; }
      if (kl === 'd' || e.key === 'ArrowRight') { e.preventDefault(); sk.keys.d = true; }
      if (kl === 'f' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        var near = getNearestLobbyItem();
        if (near) interactSkLobby(near);
      }
    } else if (activeTab === 'dungeon' && skRunning) {
      var k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') { e.preventDefault(); sk.keys.w = true; }
      if (k === 's' || e.key === 'ArrowDown') { e.preventDefault(); sk.keys.s = true; }
      if (k === 'a' || e.key === 'ArrowLeft') { e.preventDefault(); sk.keys.a = true; }
      if (k === 'd' || e.key === 'ArrowRight') { e.preventDefault(); sk.keys.d = true; }
      if (e.key === ' ') { e.preventDefault(); sk.autoFire = true; }
      if (e.key === 'Shift' || k === 'e') { e.preventDefault(); triggerSkDash(); }
      if (k === 'r') { e.preventDefault(); triggerSkUlt(); }
      if (k === 'q') { e.preventDefault(); selectSkWeapon((sk.wpnIdx + 1) % skWeapons.length); }
      if (e.key === '1') selectSkWeapon(0);
      if (e.key === '2') selectSkWeapon(1);
      if (e.key === '3') selectSkWeapon(2);
    }
  });

  document.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (e.key === 'ArrowLeft' || k === 'a') { catchState.keys.left = false; sk.keys.a = false; }
    if (e.key === 'ArrowRight' || k === 'd') { catchState.keys.right = false; sk.keys.d = false; }
    if (e.key === 'ArrowUp' || k === 'w') sk.keys.w = false;
    if (e.key === 'ArrowDown' || k === 's') sk.keys.s = false;
    if (e.key === ' ') sk.autoFire = false;
  });

  /* ========================================================================
     GAME 5: XẾP KHỐI BLOCK BLAST (8x8 PUZZLE)
     ======================================================================== */
  var BB_SIZE = 8;
  var BB_COLORS = ['#9A2626', '#D97706', '#2E6B4E', '#2563EB', '#9333EA', '#E11D48'];
  var BB_SHAPES = [
    [[1]],
    [[1, 1]], [[1], [1]],
    [[1, 1, 1]], [[1], [1], [1]],
    [[1, 1, 1, 1]], [[1], [1], [1], [1]],
    [[1, 1], [1, 1]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    [[1, 0], [1, 0], [1, 1]], [[0, 1], [0, 1], [1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 0], [0, 1, 1]],
    [[1, 1], [1, 0]]
  ];
  var bbBestKey = 'hanoi_phovi_bb_best';
  var bbState = {
    grid: [], tray: [], selectedIdx: -1,
    score: 0, combo: 0, lines: 0,
    best: parseInt(localStorage.getItem(bbBestKey) || '0', 10),
    over: false
  };

  function makeEmptyBBGrid() {
    var g = [];
    for (var r = 0; r < BB_SIZE; r++) {
      var row = [];
      for (var c = 0; c < BB_SIZE; c++) row.push(null);
      g.push(row);
    }
    return g;
  }

  function updateBBHUD() {
    if ($('bbScore')) $('bbScore').textContent = bbState.score;
    if ($('bbCombo')) $('bbCombo').textContent = 'x' + bbState.combo;
    if ($('bbLines')) $('bbLines').textContent = bbState.lines;
    if ($('bbBest')) $('bbBest').textContent = bbState.best;
  }

  function dealBBTray() {
    bbState.tray = [];
    for (var i = 0; i < 3; i++) {
      var shape = BB_SHAPES[Math.floor(Math.random() * BB_SHAPES.length)];
      var color = BB_COLORS[Math.floor(Math.random() * BB_COLORS.length)];
      bbState.tray.push({ shape: shape, color: color, used: false });
    }
    bbState.selectedIdx = 0;
  }

  function canPlaceBB(shape, sr, sc) {
    for (var r = 0; r < shape.length; r++) {
      for (var c = 0; c < shape[0].length; c++) {
        if (!shape[r][c]) continue;
        var nr = sr + r, nc = sc + c;
        if (nr < 0 || nr >= BB_SIZE || nc < 0 || nc >= BB_SIZE) return false;
        if (bbState.grid[nr][nc]) return false;
      }
    }
    return true;
  }

  function hasAnyBBMove() {
    for (var i = 0; i < bbState.tray.length; i++) {
      var p = bbState.tray[i];
      if (p.used) continue;
      for (var r = 0; r < BB_SIZE; r++) {
        for (var c = 0; c < BB_SIZE; c++) {
          if (canPlaceBB(p.shape, r, c)) return true;
        }
      }
    }
    return false;
  }

  function clearBBPreview() {
    var board = $('bbBoard');
    if (!board) return;
    board.querySelectorAll('.bb-cell').forEach(function (el) {
      el.classList.remove('preview-ok', 'preview-bad');
    });
  }

  function showBBPreview(sr, sc) {
    clearBBPreview();
    if (bbState.selectedIdx < 0 || bbState.over) return;
    var p = bbState.tray[bbState.selectedIdx];
    if (!p || p.used) return;
    var ok = canPlaceBB(p.shape, sr, sc);
    var board = $('bbBoard');
    for (var r = 0; r < p.shape.length; r++) {
      for (var c = 0; c < p.shape[0].length; c++) {
        if (!p.shape[r][c]) continue;
        var nr = sr + r, nc = sc + c;
        if (nr >= 0 && nr < BB_SIZE && nc >= 0 && nc < BB_SIZE) {
          var cell = board.querySelector('[data-r="' + nr + '"][data-c="' + nc + '"]');
          if (cell) cell.classList.add(ok ? 'preview-ok' : 'preview-bad');
        }
      }
    }
  }

  function placeBBPiece(sr, sc) {
    if (bbState.selectedIdx < 0 || bbState.over) return;
    var p = bbState.tray[bbState.selectedIdx];
    if (!p || p.used || !canPlaceBB(p.shape, sr, sc)) return;

    var blocksPlaced = 0;
    for (var r = 0; r < p.shape.length; r++) {
      for (var c = 0; c < p.shape[0].length; c++) {
        if (p.shape[r][c]) {
          bbState.grid[sr + r][sc + c] = p.color;
          blocksPlaced++;
        }
      }
    }
    p.used = true;
    bbState.score += blocksPlaced * 5;
    beep(580, 0.06, 'sine');

    // Check full rows and full columns
    var fullRows = [], fullCols = [];
    for (var rr = 0; rr < BB_SIZE; rr++) {
      if (bbState.grid[rr].every(function (v) { return !!v; })) fullRows.push(rr);
    }
    for (var cc = 0; cc < BB_SIZE; cc++) {
      var colOk = true;
      for (var r2 = 0; r2 < BB_SIZE; r2++) {
        if (!bbState.grid[r2][cc]) { colOk = false; break; }
      }
      if (colOk) fullCols.push(cc);
    }

    var cleared = fullRows.length + fullCols.length;
    if (cleared > 0) {
      bbState.combo += 1;
      bbState.lines += cleared;
      bbState.score += cleared * 80 * bbState.combo;
      fullRows.forEach(function (rIdx) {
        for (var cIdx = 0; cIdx < BB_SIZE; cIdx++) bbState.grid[rIdx][cIdx] = null;
      });
      fullCols.forEach(function (cIdx) {
        for (var rIdx = 0; rIdx < BB_SIZE; rIdx++) bbState.grid[rIdx][cIdx] = null;
      });
      beep(880 + bbState.combo * 80, 0.14, 'triangle');
    } else {
      bbState.combo = 0;
    }

    // Select next unused piece or deal 3 new pieces
    var nextIdx = bbState.tray.findIndex(function (x) { return !x.used; });
    if (nextIdx === -1) {
      dealBBTray();
    } else {
      bbState.selectedIdx = nextIdx;
    }

    if (bbState.score > bbState.best) {
      bbState.best = bbState.score;
      try { localStorage.setItem(bbBestKey, String(bbState.best)); } catch (e) {}
    }

    renderBBBoard();
    renderBBTray();
    updateBBHUD();

    if (!hasAnyBBMove()) {
      bbState.over = true;
      beep(180, 0.3, 'sawtooth');
      submitGameScore('blockblast', bbState.score);
      if ($('bbOverlayTitle')) $('bbOverlayTitle').textContent = 'Hết Nước Đi!';
      if ($('bbOverlayDesc')) $('bbOverlayDesc').textContent = 'Điểm: ' + bbState.score + ' • Dòng đã xóa: ' + bbState.lines + ' • Kỷ lục: ' + bbState.best;
      if ($('bbOverlay')) $('bbOverlay').hidden = false;
    }
  }

  function renderBBBoard() {
    var board = $('bbBoard');
    if (!board) return;
    var html = '';
    for (var r = 0; r < BB_SIZE; r++) {
      for (var c = 0; c < BB_SIZE; c++) {
        var col = bbState.grid[r][c];
        html += '<div class="bb-cell' + (col ? ' filled' : '') + '" data-r="' + r + '" data-c="' + c + '"' +
          (col ? ' style="background:' + col + ';"' : '') + '></div>';
      }
    }
    board.innerHTML = html;

    board.querySelectorAll('.bb-cell').forEach(function (cell) {
      var r = parseInt(cell.getAttribute('data-r'), 10);
      var c = parseInt(cell.getAttribute('data-c'), 10);
      cell.addEventListener('pointerenter', function () { showBBPreview(r, c); });
      cell.addEventListener('click', function () { placeBBPiece(r, c); });
    });
    board.addEventListener('pointerleave', clearBBPreview);
  }

  function renderBBTray() {
    var tray = $('bbTray');
    if (!tray) return;
    tray.innerHTML = bbState.tray.map(function (p, idx) {
      var rows = p.shape.length, cols = p.shape[0].length;
      var mini = '<div class="bb-mini-grid" style="grid-template-columns:repeat(' + cols + ',16px);">';
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var on = p.shape[r][c];
          mini += '<div class="bb-mini-cell' + (on ? ' on' : '') + '"' + (on ? ' style="background:' + p.color + ';"' : '') + '></div>';
        }
      }
      mini += '</div>';
      return '<div class="bb-piece-slot' + (p.used ? ' used' : '') + (bbState.selectedIdx === idx && !p.used ? ' selected' : '') + '" data-bb-idx="' + idx + '">' + mini + '</div>';
    }).join('');

    tray.querySelectorAll('.bb-piece-slot').forEach(function (slot) {
      slot.addEventListener('click', function () {
        var idx = parseInt(slot.getAttribute('data-bb-idx'), 10);
        if (!bbState.tray[idx] || bbState.tray[idx].used) return;
        bbState.selectedIdx = idx;
        renderBBTray();
      });
    });
  }

  function initBlockBlast() {
    bbState.grid = makeEmptyBBGrid();
    bbState.score = 0;
    bbState.combo = 0;
    bbState.lines = 0;
    bbState.over = false;
    if ($('bbOverlay')) $('bbOverlay').hidden = true;
    dealBBTray();
    renderBBBoard();
    renderBBTray();
    updateBBHUD();
  }

  $('btnRestartBB')?.addEventListener('click', initBlockBlast);
  $('btnNewGameBB')?.addEventListener('click', initBlockBlast);

  /* ========================================================================
     BẢNG XẾP HẠNG ĐUA TOP RIÊNG BIỆT CHO TỪNG TRÒ CHƠI (5 LEADERBOARDS)
     ======================================================================== */
  var LB_META = {
    catch:      { title: '🏆 ĐUA TOP — HỨNG ĐẶC SẢN PHỐ CỔ', unit: 'điểm', asc: false, seed: [{ name: 'Nguyễn Minh Thảo', score: 680 }, { name: 'Trần Huy Hoàng', score: 520 }, { name: 'Lê Khánh Linh', score: 390 }, { name: 'Phạm Anh Tuấn', score: 260 }] },
    memory:     { title: '🏆 ĐUA TOP — LẬT THẺ MÓN NGON (ÍT LƯỢT NHẤT)', unit: 'lượt', asc: true, seed: [{ name: 'Nguyễn Minh Thảo', score: 11 }, { name: 'Lê Khánh Linh', score: 13 }, { name: 'Trần Huy Hoàng', score: 15 }, { name: 'Phạm Anh Tuấn', score: 18 }] },
    snake:      { title: '🏆 ĐUA TOP — RẮN SĂN MÓN NGON', unit: 'điểm', asc: false, seed: [{ name: 'Trần Huy Hoàng', score: 260 }, { name: 'Phạm Anh Tuấn', score: 210 }, { name: 'Nguyễn Minh Thảo', score: 160 }, { name: 'Lê Khánh Linh', score: 120 }] },
    dungeon:    { title: '🏆 ĐUA TOP — HIỆP SĨ PIXEL (SOUL KNIGHT)', unit: 'điểm', asc: false, seed: [{ name: 'Trần Huy Hoàng', score: 1250 }, { name: 'Phạm Anh Tuấn', score: 880 }, { name: 'Nguyễn Minh Thảo', score: 620 }, { name: 'Lê Khánh Linh', score: 410 }] },
    blockblast: { title: '🏆 ĐUA TOP — XẾP KHỐI BLOCK BLAST', unit: 'điểm', asc: false, seed: [{ name: 'Lê Khánh Linh', score: 1840 }, { name: 'Nguyễn Minh Thảo', score: 1320 }, { name: 'Trần Huy Hoàng', score: 960 }, { name: 'Phạm Anh Tuấn', score: 540 }] },
    chess:      { title: '🏆 ĐUA TOP — CỜ VUA HOÀNG GIA', unit: 'điểm', asc: false, seed: [{ name: 'Trần Huy Hoàng', score: 1450 }, { name: 'Nguyễn Minh Thảo', score: 1320 }, { name: 'Phạm Anh Tuấn', score: 1180 }, { name: 'Lê Khánh Linh', score: 1050 }] },
    xiangqi:    { title: '🏆 ĐUA TOP — CỜ TƯỚNG KỲ ĐÀI', unit: 'điểm', asc: false, seed: [{ name: 'Phạm Anh Tuấn', score: 1500 }, { name: 'Trần Huy Hoàng', score: 1360 }, { name: 'Nguyễn Minh Thảo', score: 1210 }, { name: 'Lê Khánh Linh', score: 1080 }] }
  };

  function getActivePlayerName() {
    try {
      var raw = localStorage.getItem('hanoi_phovi_session_v1') || sessionStorage.getItem('hanoi_phovi_session_v1');
      if (raw) {
        var u = JSON.parse(raw);
        if (u && u.fullName) return u.fullName;
      }
    } catch (e) {}
    return 'Bạn (Thực Khách)';
  }

  function loadLeaderboard(gameId) {
    var key = 'hanoi_phovi_lb_' + gameId;
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    var seed = (LB_META[gameId] ? LB_META[gameId].seed : []).slice();
    try { localStorage.setItem(key, JSON.stringify(seed)); } catch (e) {}
    return seed;
  }

  function submitGameScore(gameId, scoreVal) {
    var meta = LB_META[gameId];
    if (!meta || typeof scoreVal !== 'number' || scoreVal <= 0) return;
    var playerName = getActivePlayerName();
    var list = loadLeaderboard(gameId);
    var existing = list.find(function (r) { return r.name === playerName; });
    if (existing) {
      if (meta.asc ? (scoreVal < existing.score) : (scoreVal > existing.score)) {
        existing.score = scoreVal;
      }
    } else {
      list.push({ name: playerName, score: scoreVal, isMe: true });
    }
    list.sort(function (a, b) { return meta.asc ? (a.score - b.score) : (b.score - a.score); });
    list = list.slice(0, 8);
    try { localStorage.setItem('hanoi_phovi_lb_' + gameId, JSON.stringify(list)); } catch (e) {}
    if (activeTab === gameId) renderLeaderboard(gameId);
  }

  function renderLeaderboard(gameId) {
    var meta = LB_META[gameId] || LB_META.catch;
    var playerName = getActivePlayerName();
    if ($('lbTitle')) $('lbTitle').textContent = meta.title;
    if ($('lbCurrentPlayer')) $('lbCurrentPlayer').textContent = '👤 ' + playerName;

    var listEl = $('lbList');
    if (!listEl) return;
    var list = loadLeaderboard(gameId);
    listEl.innerHTML = list.map(function (row, idx) {
      var medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
      var isMe = row.name === playerName || row.isMe;
      return '<div class="lb-row' + (isMe ? ' me' : '') + '">' +
        '<div class="lb-row-left"><span class="lb-rank">' + medal + '</span><span>' + row.name + (isMe ? ' (Bạn)' : '') + '</span></div>' +
        '<span class="lb-score">' + row.score.toLocaleString('vi-VN') + ' ' + meta.unit + '</span>' +
      '</div>';
    }).join('');
  }

  window.HNGamesLB = {
    submit: submitGameScore,
    render: renderLeaderboard,
    beep: beep
  };

  renderLeaderboard(activeTab);
})();
