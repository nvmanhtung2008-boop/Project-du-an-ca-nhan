/* ==========================================================================
   SOUL KNIGHT LIVING ROOM HUB, HERO UPGRADE (LV 1-10), GEMS, TASKS & WEAPON ART
   ========================================================================== */
(function () {
  var GEM_KEY = 'hanoi_phovi_sk_gems';
  var HERO_LV_KEY = 'hanoi_phovi_sk_hero_lvs';
  var BOUNTY_KEY = 'hanoi_phovi_sk_bounties';

  function $(id) {
    return document.getElementById(id);
  }

  var UPGRADE_COSTS = [0, 100, 200, 350, 550, 800, 1100, 1500, 2000, 2600];

  var HEROES = {
    knight: {
      name: 'KNIGHT',
      img: 'https://soulknight.chillyroom.com/_next/static/media/npc.c9c45064.gif',
      baseHp: 6, baseSh: 5, baseEn: 180, baseCr: 5,
      skillName: 'SONG TRÌ VŨ KHÍ',
      skillDesc: 'Kích hoạt bắn gấp đôi tia đạn trong 4 giây.',
      lv5Buff: 'Lv.5 Buff: Giáp Xanh + Song Trì bắn thêm +2 tia đạn!'
    },
    assassin: {
      name: 'ASSASSIN',
      img: 'https://soulknight.chillyroom.com/_next/static/media/npc_left_1.ec8c58a6.png',
      baseHp: 5, baseSh: 5, baseEn: 180, baseCr: 15,
      skillName: 'ẢNH PHÂN THÂN',
      skillDesc: 'Lướt nhanh và phóng 8 phi đao năng lượng tỏa tròn.',
      lv5Buff: 'Lv.5 Buff: +25% Tỉ lệ Chí Mạng & giảm 30% hồi chiêu Lướt!'
    },
    engineer: {
      name: 'ENGINEER',
      img: 'https://soulknight.chillyroom.com/_next/static/media/npc_right_1.77f1de5b.png',
      baseHp: 6, baseSh: 6, baseEn: 200, baseCr: 5,
      skillName: 'PHÁO ĐÀI SÚNG MÁY',
      skillDesc: 'Triệu hồi ụ pháo đài tự động hỗ trợ hỏa lực.',
      lv5Buff: 'Lv.5 Buff: Pháo Đài bắn thêm TÊN LỬA nổ diện rộng!'
    },
    paladin: {
      name: 'PALADIN',
      img: 'https://soulknight.chillyroom.com/_next/static/media/npc_2.7989b52c.gif',
      baseHp: 4, baseSh: 8, baseEn: 160, baseCr: 5,
      skillName: 'KHIÊN THÁNH QUANG',
      skillDesc: 'Hồi +4 Giáp và bất tử hoàn toàn trong 3 giây.',
      lv5Buff: 'Lv.5 Buff: Khiên phát Sóng Xung Kích xóa sạch đạn địch!'
    }
  };

  var BOUNTY_DEFS = [
    { id: 'kill20',  label: 'Hạ gục 20 quái vật',     stat: 'kills',     target: 20, reward: 150 },
    { id: 'wave5',   label: 'Chinh phục Tầng 5+',     stat: 'maxWave',   target: 5,  reward: 220 },
    { id: 'boss1',   label: 'Tiêu diệt 1 Boss',       stat: 'bossKills', target: 1,  reward: 300 },
    { id: 'wave10',  label: 'Mở Cổng Tầng 10',        stat: 'maxWave',   target: 10, reward: 500 }
  ];

  var hubState = {
    gems: 500,
    heroLevels: { knight: 1, assassin: 1, engineer: 1, paladin: 1 },
    selectedHero: 'knight',
    inspectingHero: 'knight',
    difficulty: 'normal',
    challenge: 'none',
    bountyProgress: { kills: 0, maxWave: 1, bossKills: 0, claimed: {} }
  };

  function loadHub() {
    try {
      var g = localStorage.getItem(GEM_KEY);
      if (g !== null && !isNaN(parseInt(g, 10))) hubState.gems = Math.max(0, parseInt(g, 10));
      var lvs = JSON.parse(localStorage.getItem(HERO_LV_KEY) || '{}');
      Object.keys(HEROES).forEach(function (k) {
        if (lvs[k]) hubState.heroLevels[k] = Math.max(1, Math.min(10, parseInt(lvs[k], 10)));
      });
      var bp = JSON.parse(localStorage.getItem(BOUNTY_KEY) || '{}');
      if (bp && typeof bp === 'object') {
        hubState.bountyProgress.kills = bp.kills || 0;
        hubState.bountyProgress.maxWave = bp.maxWave || 1;
        hubState.bountyProgress.bossKills = bp.bossKills || 0;
        hubState.bountyProgress.claimed = bp.claimed || {};
      }
    } catch (e) {}
  }

  function saveHub() {
    try {
      localStorage.setItem(GEM_KEY, String(hubState.gems));
      localStorage.setItem(HERO_LV_KEY, JSON.stringify(hubState.heroLevels));
      localStorage.setItem(BOUNTY_KEY, JSON.stringify(hubState.bountyProgress));
    } catch (e) {}
  }

  function getHeroStats(heroId) {
    var h = HEROES[heroId] || HEROES.knight;
    var lv = hubState.heroLevels[heroId] || 1;
    return {
      id: heroId,
      name: h.name,
      level: lv,
      maxHp: h.baseHp + Math.floor(lv / 3),
      maxShield: h.baseSh + Math.floor((lv - 1) / 3),
      maxEnergy: h.baseEn + (lv - 1) * 15,
      crit: h.baseCr + (lv - 1) * 2 + (heroId === 'assassin' && lv >= 5 ? 25 : 0),
      hasLv5Buff: lv >= 5
    };
  }

  function renderGemCounts() {
    if ($('skHubGemCount')) $('skHubGemCount').textContent = hubState.gems.toLocaleString('vi-VN');
    if ($('skHudGem')) $('skHudGem').textContent = hubState.gems.toLocaleString('vi-VN');
    if ($('skUpGemCount')) $('skUpGemCount').textContent = hubState.gems.toLocaleString('vi-VN');
  }

  function renderLivingRoom() {
    renderGemCounts();
    Object.keys(HEROES).forEach(function (id) {
      var cap = id.charAt(0).toUpperCase() + id.slice(1);
      var tag = $('skTag' + cap);
      if (tag) tag.textContent = 'Lv.' + (hubState.heroLevels[id] || 1);
    });
    document.querySelectorAll('.sk-lr-hero').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-hero') === hubState.selectedHero);
    });
    var sh = HEROES[hubState.selectedHero] || HEROES.knight;
    var slv = hubState.heroLevels[hubState.selectedHero] || 1;
    if ($('skLobbyHeroBadge')) $('skLobbyHeroBadge').textContent = 'Tướng: ' + sh.name + ' (Lv.' + slv + ')';
    if ($('skLobbyDiffBadge')) $('skLobbyDiffBadge').textContent = 'Độ khó: ' + (hubState.difficulty === 'badass' ? '🔥 Badass' : 'Thường');
  }

  function openUpgradePanel(heroId) {
    hubState.inspectingHero = heroId;
    var h = HEROES[heroId] || HEROES.knight;
    var lv = hubState.heroLevels[heroId] || 1;
    var st = getHeroStats(heroId);

    if ($('skUpHeroName')) $('skUpHeroName').textContent = h.name;
    if ($('skUpHeroImg')) $('skUpHeroImg').src = h.img;
    if ($('skUpValHp')) $('skUpValHp').textContent = st.maxHp;
    if ($('skUpValSh')) $('skUpValSh').textContent = st.maxShield;
    if ($('skUpValEn')) $('skUpValEn').textContent = st.maxEnergy;
    if ($('skUpValCr')) $('skUpValCr').textContent = st.crit;

    if ($('skUpBarHp')) $('skUpBarHp').style.width = Math.min(100, st.maxHp * 9) + '%';
    if ($('skUpBarSh')) $('skUpBarSh').style.width = Math.min(100, st.maxShield * 9) + '%';
    if ($('skUpBarEn')) $('skUpBarEn').style.width = Math.min(100, (st.maxEnergy / 350) * 100) + '%';
    if ($('skUpBarCr')) $('skUpBarCr').style.width = Math.min(100, st.crit * 2) + '%';

    var stars = '';
    for (var i = 1; i <= 10; i++) stars += (i <= lv ? '★' : '☆');
    if ($('skUpStars')) $('skUpStars').textContent = stars;
    if ($('skUpLvlText')) $('skUpLvlText').textContent = 'Lv. ' + lv + ' / 10';
    if ($('skUpSkillName')) $('skUpSkillName').textContent = h.skillName;
    if ($('skUpSkillDesc')) $('skUpSkillDesc').textContent = h.skillDesc;

    var lv5El = $('skUpLv5Buff');
    if (lv5El) {
      lv5El.textContent = (lv >= 5 ? '✅ ĐÃ MỞ KHÓA • ' : '🔒 Đạt Lv.5 để mở • ') + h.lv5Buff;
      lv5El.classList.toggle('locked', lv < 5);
    }

    var upBtn = $('btnSkUpgradeHero');
    if (upBtn) {
      if (lv >= 10) {
        upBtn.textContent = '✨ ĐÃ ĐẠT CẤP TỐI ĐA (Lv.10)';
        upBtn.disabled = true;
      } else {
        var cost = UPGRADE_COSTS[lv] || 2600;
        upBtn.innerHTML = '⬆️ Nâng Cấp (<span id="skUpCost">' + cost + '</span> Gem)';
        upBtn.disabled = hubState.gems < cost;
      }
    }
    renderGemCounts();
    if ($('skHeroUpgradeCard')) $('skHeroUpgradeCard').hidden = false;
  }

  function renderBounties() {
    var list = $('skBountiesList');
    if (!list) return;
    list.innerHTML = BOUNTY_DEFS.map(function (b) {
      var cur = hubState.bountyProgress[b.stat] || 0;
      var done = cur >= b.target;
      var claimed = !!hubState.bountyProgress.claimed[b.id];
      return '<div class="sk-bounty-row">' +
        '<span>' + b.label + ' (' + Math.min(cur, b.target) + '/' + b.target + ')</span>' +
        '<button type="button" class="sk-bounty-claim" data-bounty="' + b.id + '" ' + ((!done || claimed) ? 'disabled' : '') + '>' +
          (claimed ? 'Đã nhận' : ('+' + b.reward + ' Gem')) +
        '</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.sk-bounty-claim').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-bounty');
        var def = BOUNTY_DEFS.find(function (d) { return d.id === id; });
        if (!def || hubState.bountyProgress.claimed[id]) return;
        if ((hubState.bountyProgress[def.stat] || 0) < def.target) return;
        hubState.bountyProgress.claimed[id] = true;
        hubState.gems += def.reward;
        saveHub();
        renderGemCounts();
        renderBounties();
      });
    });
  }

  // Draw Pixel Blue Gem (Image 3 style)
  function drawPixelGem(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#0C4A6E';
    ctx.beginPath();
    ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(Math.round(x - r * 0.45), Math.round(y - r * 0.55), 2, 2);
    ctx.restore();
  }

  // Draw Pixel Weapon in hero's hand (Images 4, 5, 6)
  function drawPixelWeapon(ctx, wpnIdx) {
    if (wpnIdx === 0) {
      // Image 4: Pixel Machine Gun (grey-orange-black assault rifle with scope)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(5, -2, 5, 4);
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(8, -3, 10, 4);
      ctx.fillStyle = '#334155';
      ctx.fillRect(10, -5, 5, 2);
      ctx.fillStyle = '#475569';
      ctx.fillRect(18, -2, 5, 2);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(12, 1, 2, 4);
    } else if (wpnIdx === 1) {
      // Image 5: Pixel Magic Staff (wooden/gold staff with glowing cyan orb)
      ctx.fillStyle = '#92400E';
      ctx.fillRect(4, -1.5, 13, 3);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(15, -3, 3, 6);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(20, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(18, -2, 2, 2);
    } else {
      // Image 6: Pixel Red & Black Serrated Chainsaw Sword
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, -1.5, 4, 3);
      ctx.fillStyle = '#475569';
      ctx.fillRect(8, -4.5, 2, 9);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(10, -3.5, 13, 7);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(11, -1.5, 9, 3);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(23, -2, 2, 4);
    }
  }

  function initHubUI() {
    loadHub();
    renderLivingRoom();
    renderBounties();

    document.querySelectorAll('.sk-lr-hero').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hId = btn.getAttribute('data-hero') || 'knight';
        hubState.selectedHero = hId;
        renderLivingRoom();
        openUpgradePanel(hId);
      });
    });

    $('btnSkUpBack')?.addEventListener('click', function () {
      if ($('skHeroUpgradeCard')) $('skHeroUpgradeCard').hidden = true;
    });

    $('btnSkSelectHero')?.addEventListener('click', function () {
      hubState.selectedHero = hubState.inspectingHero;
      renderLivingRoom();
      if ($('skHeroUpgradeCard')) $('skHeroUpgradeCard').hidden = true;
    });

    $('btnSkUpgradeHero')?.addEventListener('click', function () {
      var id = hubState.inspectingHero;
      var lv = hubState.heroLevels[id] || 1;
      if (lv >= 10) return;
      var cost = UPGRADE_COSTS[lv] || 2600;
      if (hubState.gems < cost) return;
      hubState.gems -= cost;
      hubState.heroLevels[id] = lv + 1;
      saveHub();
      renderLivingRoom();
      openUpgradePanel(id);
    });

    $('skDiffSelect')?.addEventListener('change', function (e) {
      hubState.difficulty = e.target.value || 'normal';
    });

    $('btnOpenSkTasks')?.addEventListener('click', function () {
      renderBounties();
      if ($('skTaskPanel')) $('skTaskPanel').hidden = false;
    });

    $('btnSkTaskBack')?.addEventListener('click', function () {
      if ($('skTaskPanel')) $('skTaskPanel').hidden = true;
    });

    document.querySelectorAll('input[name="skChal"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (r.checked) hubState.challenge = r.value;
      });
    });
  }

  window.SKHub = {
    getGems: function () { return hubState.gems; },
    addGems: function (n) {
      hubState.gems = Math.max(0, hubState.gems + Math.round(n));
      saveHub();
      renderGemCounts();
    },
    recordProgress: function (type, val) {
      if (type === 'kill') hubState.bountyProgress.kills++;
      else if (type === 'boss') hubState.bountyProgress.bossKills++;
      else if (type === 'wave' && val > hubState.bountyProgress.maxWave) hubState.bountyProgress.maxWave = val;
      saveHub();
    },
    getSelectedHero: function () { return hubState.selectedHero; },
    getHeroStats: getHeroStats,
    getHeroLevel: function (id) { return hubState.heroLevels[id] || 1; },
    getDifficulty: function () { return hubState.difficulty; },
    toggleDifficulty: function () {
      hubState.difficulty = hubState.difficulty === 'badass' ? 'normal' : 'badass';
      if ($('skDiffSelect')) $('skDiffSelect').value = hubState.difficulty;
      renderLivingRoom();
      return hubState.difficulty;
    },
    getChallenge: function () { return hubState.challenge; },
    openUpgradePanel: openUpgradePanel,
    openTaskPanel: function () {
      renderBounties();
      if ($('skTaskPanel')) $('skTaskPanel').hidden = false;
    },
    isModalOpen: function () {
      return !!($('skHeroUpgradeCard') && !$('skHeroUpgradeCard').hidden) ||
             !!($('skTaskPanel') && !$('skTaskPanel').hidden);
    },
    renderHub: renderLivingRoom,
    drawPixelGem: drawPixelGem,
    drawPixelWeapon: drawPixelWeapon
  };

  document.addEventListener('DOMContentLoaded', initHubUI);
})();
