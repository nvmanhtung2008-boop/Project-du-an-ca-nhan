/**
 * HÀ NỘI PHỐ VỊ - SMART DISCOVERY MODULE
 * 1. window.HNPersonalization (Per-account view history, taste tags & personalized recommendations)
 * 2. window.HNWhatToEat (Filter-aware & opening-hours-aware randomizer modal)
 * 3. window.HNNlpSearch (Offline Vietnamese NLP + optional Claude API natural-language filter parser)
 * Strict ES5 IIFE style, UTF-8 without BOM
 */
(function () {
  'use strict';

  var VIEW_HISTORY_KEY = 'hanoi_phovi_view_history_v1';
  var TASTE_PREFS_KEY = 'hanoi_phovi_taste_prefs_v1';
  var CLAUDE_KEY_STORAGE = 'hanoi_phovi_claude_api_key_v1';
  var CLAUDE_MODEL_STORAGE = 'hanoi_phovi_claude_model_v1';
  var DEFAULT_CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

  var TASTE_TAGS = [
    'Phở & Bún',
    'Lẩu & Nướng',
    'Cà phê & Trà',
    'Chè & Ăn vặt',
    'Món Hàn/Trung',
    'Yên tĩnh',
    'Bình dân',
    'Hẹn hò'
  ];

  var TASTE_TAG_EN = {
    'Phở & Bún': 'Pho & Noodles',
    'Lẩu & Nướng': 'Hotpot & BBQ',
    'Cà phê & Trà': 'Coffee & Tea',
    'Chè & Ăn vặt': 'Desserts & Snacks',
    'Món Hàn/Trung': 'Korean / Chinese',
    'Yên tĩnh': 'Quiet & Cozy',
    'Bình dân': 'Budget-friendly',
    'Hẹn hò': 'Romantic Date'
  };

  var STOP_WORDS = {
    mon: 1, an: 1, cua: 1, va: 1, voi: 1, cho: 1, tai: 1, cac: 1, nhung: 1,
    dac: 1, biet: 1, truyen: 1, thong: 1, ha: 1, noi: 1, quan: 1, nha: 1,
    hang: 1, nuoc: 1, dung: 1, gion: 1, ngon: 1, thom: 1, nong: 1, sot: 1,
    cham: 1, kem: 1, bo: 1, ga: 1, thit: 1, rau: 1, song: 1, tuoi: 1
  };

  var VALID_DISTRICTS = [
    'Hoàn Kiếm', 'Ba Đình', 'Đống Đa', 'Hai Bà Trưng', 'Tây Hồ', 'Cầu Giấy',
    'Thanh Xuân', 'Hà Đông', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Long Biên', 'Hoàng Mai'
  ];

  var VALID_PRICE_TIERS = ['budget', 'moderate', 'upscale', 'luxury'];
  var VALID_PEOPLE_CATS = ['solo', 'couple', 'group', 'party'];
  var VALID_OCCASIONS = ['breakfast', 'quick_lunch', 'date', 'friends', 'family', 'business', 'night_snack'];
  var VALID_TIME_SLOTS = ['now', '07:00', '08:30', '11:30', '12:30', '14:30', '17:30', '19:00', '20:30', '22:30', '00:30', 'custom'];

  var DEFAULT_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80';

  function $(id) {
    return document.getElementById(id);
  }

  function norm(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var memoryFallbackStore = {};

  function storageGet(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {}
    return Object.prototype.hasOwnProperty.call(memoryFallbackStore, key) ? memoryFallbackStore[key] : null;
  }

  function storageSet(key, val) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(key, String(val));
        return;
      }
    } catch (e) {}
    memoryFallbackStore[key] = String(val);
  }

  function storageRemove(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.removeItem(key);
        return;
      }
    } catch (e) {}
    delete memoryFallbackStore[key];
  }

  function loadJson(key, fallback) {
    try {
      var raw = storageGet(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      storageSet(key, JSON.stringify(val));
    } catch (e) {}
  }

  function getCurrentAccountKey() {
    var u = null;
    try {
      if (window.HNAuth && typeof window.HNAuth.getCurrentUser === 'function') {
        u = window.HNAuth.getCurrentUser();
      }
    } catch (e) {
      u = null;
    }
    var raw = u ? (u.email || u.username || u.canonicalEmail || '') : '';
    var cleaned = String(raw || '').trim().toLowerCase();
    return cleaned || 'guest';
  }

  function getAllRestaurants() {
    if (window.HNAppBridge && typeof window.HNAppBridge.getAllRestaurants === 'function') {
      var list = window.HNAppBridge.getAllRestaurants();
      if (Array.isArray(list)) return list;
    }
    if (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) {
      return RESTAURANTS_DATA;
    }
    return [];
  }

  function getFilteredRestaurantsList() {
    if (window.HNAppBridge && typeof window.HNAppBridge.getFilteredRestaurants === 'function') {
      var list = window.HNAppBridge.getFilteredRestaurants();
      if (Array.isArray(list)) return list;
    }
    return getAllRestaurants();
  }

  function getFavoriteIds() {
    if (window.HNAppBridge && typeof window.HNAppBridge.getFavorites === 'function') {
      var favs = window.HNAppBridge.getFavorites();
      if (Array.isArray(favs)) return favs;
    }
    var raw = loadJson('hanoi_phovi_favorites', []);
    return Array.isArray(raw) ? raw : [];
  }

  function openRestaurantDetail(id) {
    var numId = Number(id);
    if (isNaN(numId)) return;
    if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
      window.HNAppBridge.openDetail(numId);
    } else if (typeof window.openRestaurantDetail === 'function') {
      window.openRestaurantDetail(numId);
    }
  }

  function notifyToast(msg) {
    if (window.HNAppBridge && typeof window.HNAppBridge.showToast === 'function') {
      window.HNAppBridge.showToast(msg);
    }
  }

  function getLang() {
    try {
      if (window.HNi18n && typeof window.HNi18n.getLang === 'function') {
        return window.HNi18n.getLang() === 'en' ? 'en' : 'vi';
      }
    } catch (e) {}
    return 'vi';
  }

  function tr(viText, enText, i18nKey) {
    try {
      if (i18nKey && window.HNi18n && typeof window.HNi18n.t === 'function') {
        var val = window.HNi18n.t(i18nKey, getLang() === 'en' ? enText : viText);
        if (val) return val;
      }
    } catch (e) {}
    return getLang() === 'en' ? enText : viText;
  }

  function trCat(cat) {
    try {
      if (window.HNi18n && typeof window.HNi18n.translateCategory === 'function') {
        return window.HNi18n.translateCategory(cat);
      }
    } catch (e) {}
    return cat || '';
  }

  function getTimeCtx() {
    try {
      if (window.HNRestaurantHours && typeof window.HNRestaurantHours.getSelectedTimeContext === 'function') {
        var ctx = window.HNRestaurantHours.getSelectedTimeContext();
        if (ctx && typeof ctx.minutes === 'number') return ctx;
      }
    } catch (e) {}
    var now = new Date();
    var mins = now.getHours() * 60 + now.getMinutes();
    var hh = Math.floor(mins / 60);
    var mm = mins % 60;
    return {
      mode: 'now',
      minutes: mins,
      timeLabel: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
      dayOfWeek: now.getDay(),
      rawValue: 'now'
    };
  }

  function isRestaurantOpen(restaurant, ctx) {
    if (!restaurant) return false;
    var c = ctx || getTimeCtx();
    try {
      if (window.HNRestaurantHours && typeof window.HNRestaurantHours.isOpenAtMinutes === 'function') {
        return window.HNRestaurantHours.isOpenAtMinutes(restaurant, c.minutes, c.dayOfWeek);
      }
    } catch (e) {}
    return true;
  }

  function formatReviews(n) {
    var num = Number(n) || 0;
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(num);
  }

  /* ==========================================================================
     1. PERSONALIZATION ENGINE (window.HNPersonalization)
     ========================================================================== */
  function readHistoryMap() {
    var data = loadJson(VIEW_HISTORY_KEY, {});
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data;
  }

  function getViewHistory() {
    var acct = getCurrentAccountKey();
    var map = readHistoryMap();
    var list = map[acct];
    return Array.isArray(list) ? list.slice() : [];
  }

  function recordView(id) {
    var numId = Number(id);
    if (isNaN(numId) || numId <= 0) return getViewHistory();
    var acct = getCurrentAccountKey();
    var map = readHistoryMap();
    var list = Array.isArray(map[acct]) ? map[acct].slice() : [];
    var now = Date.now();
    var existingCount = 0;
    var filtered = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (entry && Number(entry.id) === numId) {
        existingCount = Number(entry.count) || 1;
      } else if (entry && entry.id !== undefined) {
        filtered.push(entry);
      }
    }
    filtered.unshift({
      id: numId,
      ts: now,
      count: existingCount + 1
    });
    if (filtered.length > 50) filtered = filtered.slice(0, 50);
    map[acct] = filtered;
    saveJson(VIEW_HISTORY_KEY, map);
    return filtered;
  }

  function readPrefsMap() {
    var data = loadJson(TASTE_PREFS_KEY, {});
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data;
  }

  function normalizePrefsInput(prefs) {
    var tags = [];
    var rawTags = [];
    if (Array.isArray(prefs)) {
      rawTags = prefs;
    } else if (prefs && typeof prefs === 'object' && Array.isArray(prefs.tags)) {
      rawTags = prefs.tags;
    }
    for (var i = 0; i < rawTags.length; i++) {
      var t = String(rawTags[i] || '').trim();
      if (t && tags.indexOf(t) === -1) tags.push(t);
    }
    return {
      tags: tags,
      updatedAt: Date.now()
    };
  }

  function getPreferences() {
    var acct = getCurrentAccountKey();
    var map = readPrefsMap();
    var entry = map[acct];
    if (Array.isArray(entry)) {
      return { tags: entry.slice(), updatedAt: 0 };
    }
    if (entry && typeof entry === 'object' && Array.isArray(entry.tags)) {
      return { tags: entry.tags.slice(), updatedAt: entry.updatedAt || 0 };
    }
    return { tags: [], updatedAt: 0 };
  }

  function setPreferences(prefs) {
    var acct = getCurrentAccountKey();
    var map = readPrefsMap();
    var normalized = normalizePrefsInput(prefs);
    map[acct] = normalized;
    saveJson(TASTE_PREFS_KEY, map);
    renderPersonalizedSection();
    return normalized;
  }

  function tokenizeDishWords(dishes) {
    var tokens = [];
    if (!Array.isArray(dishes)) return tokens;
    for (var i = 0; i < dishes.length; i++) {
      var parts = norm(dishes[i]).split(/[^a-z0-9]+/);
      for (var j = 0; j < parts.length; j++) {
        var w = parts[j];
        if (w.length >= 2 && !STOP_WORDS[w] && tokens.indexOf(w) === -1) {
          tokens.push(w);
        }
      }
    }
    return tokens;
  }

  function matchesTasteTag(item, tag) {
    var cat = norm(item.category);
    var dishesNorm = norm((item.signatureDishes || []).join(' '));
    var textNorm = norm([
      item.name, item.subname, item.category, item.description,
      (item.specialBadges || []).join(' '), dishesNorm
    ].join(' '));

    if (tag === 'Phở & Bún') {
      return cat.indexOf('pho') !== -1 || cat.indexOf('bun') !== -1 || /\b(pho|bun|mien)\b/.test(dishesNorm);
    }
    if (tag === 'Lẩu & Nướng') {
      return cat.indexOf('lau') !== -1 || cat.indexOf('nuong') !== -1 || /\b(lau|nuong|bbq|thit nuong)\b/.test(dishesNorm);
    }
    if (tag === 'Cà phê & Trà') {
      return cat.indexOf('ca phe') !== -1 || /\b(ca phe|cafe|espresso|tra|matcha|tra sua)\b/.test(textNorm);
    }
    if (tag === 'Chè & Ăn vặt') {
      return cat.indexOf('che') !== -1 || cat.indexOf('an vat') !== -1 || /\b(che|oc|nem chua|banh trang|an vat)\b/.test(textNorm);
    }
    if (tag === 'Món Hàn/Trung') {
      return cat.indexOf('han quoc') !== -1 || cat.indexOf('trung hoa') !== -1 ||
        /\b(han quoc|trung hoa|dimsum|tokbokki|kim chi|kimbap|vit quay|mi van than)\b/.test(textNorm);
    }
    if (tag === 'Yên tĩnh') {
      return /\b(yen tinh|thanh binh|san vuon|lam viec|doc sach|am cung|thu gian|rieng tu)\b/.test(textNorm) ||
        cat.indexOf('ca phe') !== -1;
    }
    if (tag === 'Bình dân') {
      return item.priceTier === 'budget' || (item.priceAvg && Number(item.priceAvg) <= 60000);
    }
    if (tag === 'Hẹn hò') {
      var occs = Array.isArray(item.occasions) ? item.occasions : [];
      var ppl = Array.isArray(item.peopleCategory) ? item.peopleCategory : [];
      return occs.indexOf('date') !== -1 || ppl.indexOf('couple') !== -1 ||
        /\b(hen ho|lang man|view dep|am cung)\b/.test(textNorm);
    }
    return false;
  }

  function getPersonalizedRecommendations(limit) {
    var maxItems = (typeof limit === 'number' && limit > 0) ? Math.floor(limit) : 6;
    var all = getAllRestaurants();
    if (!all.length) return [];

    var byId = {};
    for (var i = 0; i < all.length; i++) {
      byId[all[i].id] = all[i];
    }

    var history = getViewHistory();
    var prefs = getPreferences();
    var favIds = getFavoriteIds();
    var timeCtx = getTimeCtx();
    var isEn = getLang() === 'en';

    var topSeenId = (history.length > 0 && history[0]) ? Number(history[0].id) : null;
    var catWeights = {};
    var distWeights = {};
    var tierWeights = {};
    var dishWeights = {};
    var favSet = {};

    for (var f = 0; f < favIds.length; f++) {
      var fid = Number(favIds[f]);
      favSet[fid] = true;
      var favItem = byId[fid];
      if (favItem) {
        if (favItem.category) catWeights[favItem.category] = (catWeights[favItem.category] || 0) + 4;
        if (favItem.district) distWeights[favItem.district] = (distWeights[favItem.district] || 0) + 3;
        if (favItem.priceTier) tierWeights[favItem.priceTier] = (tierWeights[favItem.priceTier] || 0) + 2;
        var fTokens = tokenizeDishWords(favItem.signatureDishes);
        for (var ft = 0; ft < fTokens.length; ft++) {
          dishWeights[fTokens[ft]] = (dishWeights[fTokens[ft]] || 0) + 1.5;
        }
      }
    }

    for (var h = 0; h < history.length; h++) {
      var histEntry = history[h];
      var hItem = histEntry ? byId[Number(histEntry.id)] : null;
      if (!hItem) continue;
      var recencyBoost = Math.max(1, 5 - Math.floor(h / 3)) + Math.min(3, (Number(histEntry.count) || 1) - 1);
      if (hItem.category) catWeights[hItem.category] = (catWeights[hItem.category] || 0) + recencyBoost * 1.4;
      if (hItem.district) distWeights[hItem.district] = (distWeights[hItem.district] || 0) + recencyBoost * 1.1;
      if (hItem.priceTier) tierWeights[hItem.priceTier] = (tierWeights[hItem.priceTier] || 0) + recencyBoost * 0.7;
      var hTokens = tokenizeDishWords(hItem.signatureDishes);
      for (var ht = 0; ht < hTokens.length; ht++) {
        dishWeights[hTokens[ht]] = (dishWeights[hTokens[ht]] || 0) + recencyBoost * 0.5;
      }
    }

    var selectedTags = Array.isArray(prefs.tags) ? prefs.tags : [];
    var hasSignals = history.length > 0 || favIds.length > 0 || selectedTags.length > 0;
    var scored = [];
    var seenIds = {};

    for (var idx = 0; idx < all.length; idx++) {
      var item = all[idx];
      if (!item || seenIds[item.id]) continue;
      if (topSeenId !== null && Number(item.id) === topSeenId) continue;
      seenIds[item.id] = true;

      var score = (Number(item.rating) || 4.0) * 6 + Math.min(8, (Math.log((Number(item.reviews) || 0) + 1) / Math.LN10) * 2.2);
      var reasons = [];
      var matchedTagScore = 0;

      for (var tIdx = 0; tIdx < selectedTags.length; tIdx++) {
        var tag = selectedTags[tIdx];
        if (matchesTasteTag(item, tag)) {
          matchedTagScore += 28;
          var tagLabel = isEn ? (TASTE_TAG_EN[tag] || tag) : tag;
          reasons.push(isEn ? ('Matches your taste: ' + tagLabel) : ('Hợp gu ' + tagLabel + ' bạn chọn'));
        }
      }
      score += matchedTagScore;

      if (item.category && catWeights[item.category]) {
        score += Math.min(26, catWeights[item.category] * 2.5);
        reasons.push(isEn ? ('Matches ' + trCat(item.category) + ' you viewed') : ('Hợp gu ' + item.category + ' bạn hay xem'));
      }

      if (item.district && distWeights[item.district]) {
        score += Math.min(18, distWeights[item.district] * 2.0);
        reasons.push(isEn ? ('In ' + item.district + ' area you like') : ('Cùng khu vực ' + item.district + ' bạn thích'));
      }

      if (item.priceTier && tierWeights[item.priceTier]) {
        score += Math.min(10, tierWeights[item.priceTier] * 1.4);
      }

      var itemTokens = tokenizeDishWords(item.signatureDishes);
      var dishMatchCount = 0;
      for (var dt = 0; dt < itemTokens.length; dt++) {
        if (dishWeights[itemTokens[dt]]) dishMatchCount += 1;
      }
      if (dishMatchCount > 0) {
        score += Math.min(14, dishMatchCount * 4);
        if (!reasons.length) {
          reasons.push(isEn ? 'Similar signature dishes you like' : 'Món tủ đúng vị bạn hay tìm');
        }
      }

      if (favSet[Number(item.id)]) {
        score += 6;
        if (!reasons.length) {
          reasons.push(isEn ? 'From your saved favorites' : 'Trong sổ tay quán quen của bạn');
        }
      }

      var openNow = isRestaurantOpen(item, timeCtx);
      if (openNow) {
        score += 18;
      }

      if (!reasons.length) {
        if (openNow) {
          reasons.push(isEn ? 'Top-rated & open right now' : 'Quán nổi bật đang mở cửa');
        } else if (Number(item.rating) >= 4.5) {
          reasons.push(isEn ? 'Highly rated in Hanoi' : 'Được thực khách đánh giá cao');
        } else {
          reasons.push(isEn ? 'Curated Hanoi classic' : 'Gợi ý tuyển chọn Hà Thành');
        }
      }

      // Slight variety boost for unseen places when user has history
      if (hasSignals && !favSet[Number(item.id)]) {
        var alreadyViewed = false;
        for (var hv = 0; hv < history.length; hv++) {
          if (Number(history[hv].id) === Number(item.id)) {
            alreadyViewed = true;
            break;
          }
        }
        if (!alreadyViewed) score += 4;
      }

      scored.push({
        restaurant: item,
        id: item.id,
        name: item.name,
        district: item.district,
        category: item.category,
        rating: item.rating,
        reviews: item.reviews,
        priceRange: item.priceRange,
        priceTier: item.priceTier,
        image: item.image,
        openingHours: item.openingHours,
        score: Math.round(score * 10) / 10,
        reason: reasons[0],
        reasons: reasons,
        isOpen: openNow
      });
    }

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    });

    return scored.slice(0, maxItems);
  }

  function renderPersonalizedSection() {
    var host = $('personalizedSection');
    if (!host) return;
    var recs = getPersonalizedRecommendations(6);
    var prefs = getPreferences();
    var selectedTags = prefs.tags || [];
    var isEn = getLang() === 'en';
    var timeCtx = getTimeCtx();

    var titleText = isEn ? '✨ Curated For Your Taste' : '✨ Gợi Ý Riêng Cho Khẩu Vị Của Bạn';
    var subText = selectedTags.length
      ? (isEn ? 'Personalized from your taste tags & browsing history' : 'Cá nhân hóa theo gu ẩm thực & lịch sử bạn đã xem')
      : (isEn ? 'Pick your favorite vibes below to tailor picks' : 'Chọn nhanh gu ăn uống bên dưới để hệ thống gợi ý chuẩn vị hơn');

    var tagsHtml = '';
    for (var i = 0; i < TASTE_TAGS.length; i++) {
      var tag = TASTE_TAGS[i];
      var isActive = selectedTags.indexOf(tag) !== -1;
      var label = isEn ? (TASTE_TAG_EN[tag] || tag) : tag;
      tagsHtml += '<button type="button" class="pref-tag-btn' + (isActive ? ' active' : '') +
        '" data-pref-tag="' + escapeHtml(tag) + '" aria-pressed="' + (isActive ? 'true' : 'false') + '">' +
        escapeHtml(label) + '</button>';
    }

    var cardsHtml = '';
    for (var j = 0; j < recs.length; j++) {
      var rec = recs[j];
      var r = rec.restaurant;
      var openBadge = rec.isOpen
        ? '<span class="card-open-status is-open">🟢 ' + (isEn ? 'Open ' : 'Đang mở ') + escapeHtml(timeCtx.timeLabel) + '</span>'
        : '<span class="card-open-status is-closed">🔴 ' + (isEn ? 'Closed' : 'Đóng cửa') + '</span>';

      cardsHtml += '<article class="personalized-card" data-pers-id="' + escapeHtml(r.id) + '">' +
        '<span class="personalized-reason">' + escapeHtml(rec.reason) + '</span>' +
        '<div style="font-weight:700;font-size:1rem;color:var(--text-main);line-height:1.3;">' + escapeHtml(r.name) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted);">' + escapeHtml(trCat(r.category)) + ' • 📍 ' + escapeHtml(r.district) + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:0.8rem;">' +
          '<span>⭐ <strong>' + escapeHtml(r.rating) + '</strong> (' + escapeHtml(formatReviews(r.reviews)) + ')</span>' +
          openBadge +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:6px;">' +
          '<span style="font-size:0.78rem;font-weight:600;color:var(--color-lacquer);">' + escapeHtml(r.priceRange || '') + '</span>' +
          '<button type="button" class="btn-similar-view" data-pers-open="' + escapeHtml(r.id) + '">' +
            (isEn ? '👁️ View' : '👁️ Xem quán') +
          '</button>' +
        '</div>' +
      '</article>';
    }

    host.innerHTML =
      '<div class="personalized-head">' +
        '<div>' +
          '<h3>' + escapeHtml(titleText) + '</h3>' +
          '<div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">' + escapeHtml(subText) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="personalized-prefs-bar" role="group" aria-label="' + (isEn ? 'Taste preferences' : 'Gu ẩm thực') + '">' +
        tagsHtml +
      '</div>' +
      '<div class="personalized-grid">' + cardsHtml + '</div>';
  }

  function bindPersonalizedEvents() {
    var host = $('personalizedSection');
    if (host && !host.getAttribute('data-pers-bound')) {
      host.setAttribute('data-pers-bound', '1');
      host.addEventListener('click', function (e) {
        var tagBtn = e.target.closest ? e.target.closest('.pref-tag-btn') : null;
        if (tagBtn) {
          var tag = tagBtn.getAttribute('data-pref-tag');
          if (!tag) return;
          var cur = getPreferences();
          var tags = cur.tags.slice();
          var pos = tags.indexOf(tag);
          if (pos === -1) {
            tags.push(tag);
          } else {
            tags.splice(pos, 1);
          }
          setPreferences({ tags: tags });
          return;
        }
        var openBtn = e.target.closest ? e.target.closest('[data-pers-open]') : null;
        if (openBtn) {
          openRestaurantDetail(openBtn.getAttribute('data-pers-open'));
        }
      });
    }
  }

  window.addEventListener('hn-detail-opened', function (e) {
    var rest = e && e.detail ? e.detail.restaurant : null;
    if (rest && rest.id !== undefined) {
      recordView(rest.id);
      renderPersonalizedSection();
    }
  });

  window.addEventListener('hn-auth-changed', function () {
    renderPersonalizedSection();
  });

  window.addEventListener('hn-lang-changed', function () {
    renderPersonalizedSection();
  });

  window.HNPersonalization = {
    recordView: recordView,
    getViewHistory: getViewHistory,
    getPreferences: getPreferences,
    setPreferences: setPreferences,
    getPersonalizedRecommendations: getPersonalizedRecommendations,
    renderSection: renderPersonalizedSection
  };

  /* ==========================================================================
     2. "HÔM NAY ĂN GÌ?" FILTER-AWARE RANDOMIZER (window.HNWhatToEat)
     ========================================================================== */
  var wteOnlyOpen = true;
  var wteSpinTimer = null;
  var wteFinishTimer = null;
  var wteLastWinnerId = null;
  var wteLastOpenTs = 0;

  function stopWteTimers() {
    if (wteSpinTimer) {
      clearInterval(wteSpinTimer);
      wteSpinTimer = null;
    }
    if (wteFinishTimer) {
      clearTimeout(wteFinishTimer);
      wteFinishTimer = null;
    }
  }

  function closeWhatToEatModal() {
    stopWteTimers();
    var modal = $('whatToEatModal');
    if (modal) modal.classList.remove('open');
  }

  function resolveWteCandidates(onlyOpen) {
    var filtered = getFilteredRestaurantsList();
    var all = getAllRestaurants();
    var timeCtx = getTimeCtx();
    var isEn = getLang() === 'en';
    var base = filtered.length ? filtered : all;
    var notice = '';
    var candidates = base;

    if (onlyOpen) {
      var openInFiltered = [];
      for (var i = 0; i < base.length; i++) {
        if (isRestaurantOpen(base[i], timeCtx)) {
          openInFiltered.push(base[i]);
        }
      }
      if (openInFiltered.length > 0) {
        candidates = openInFiltered;
      } else {
        var openInAll = [];
        for (var j = 0; j < all.length; j++) {
          if (isRestaurantOpen(all[j], timeCtx)) {
            openInAll.push(all[j]);
          }
        }
        if (openInAll.length > 0) {
          candidates = openInAll;
          notice = isEn
            ? ('No open restaurants in current filter at ' + timeCtx.timeLabel + ' — expanded to all open places.')
            : ('Không có quán nào đang mở lúc ' + timeCtx.timeLabel + ' trong bộ lọc hiện tại — đang quay từ tất cả quán đang mở.');
        } else {
          candidates = base;
          notice = isEn
            ? ('No places open at ' + timeCtx.timeLabel + ' — showing picks from your current filter.')
            : ('Chưa có quán mở lúc ' + timeCtx.timeLabel + ' — hiển thị quán trong bộ lọc hiện tại.');
        }
      }
    } else if (!filtered.length && all.length) {
      candidates = all;
      notice = isEn
        ? 'Current filter has 0 matches — expanded to full catalog.'
        : 'Bộ lọc hiện tại chưa có quán phù hợp — mở rộng ra toàn bộ danh sách.';
    }

    return {
      candidates: candidates,
      notice: notice,
      timeCtx: timeCtx,
      filteredCount: filtered.length
    };
  }

  function renderWteWinnerCard(winner, timeCtx) {
    var wrap = $('wteResultWrap');
    if (!wrap || !winner) return;
    var isEn = getLang() === 'en';
    var openNow = isRestaurantOpen(winner, timeCtx);
    var statusBadge = openNow
      ? '<span class="card-open-status is-open">🟢 ' + (isEn ? 'Open ' : 'Đang mở ') + escapeHtml(timeCtx.timeLabel) + '</span>'
      : '<span class="card-open-status is-closed">🔴 ' + (isEn ? 'Closed at ' : 'Đóng cửa lúc ') + escapeHtml(timeCtx.timeLabel) + '</span>';
    var imgSrc = winner.image || DEFAULT_IMG;

    wrap.innerHTML =
      '<div class="wte-result-card">' +
        '<div style="display:flex;gap:12px;align-items:flex-start;">' +
          '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(winner.name) + '" ' +
            'onerror="this.onerror=null;this.src=\'' + DEFAULT_IMG + '\';" ' +
            'style="width:88px;height:88px;object-fit:cover;border-radius:8px;flex-shrink:0;" />' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:1.08rem;color:var(--color-lacquer);margin-bottom:4px;">' + escapeHtml(winner.name) + '</div>' +
            '<div style="font-size:0.83rem;color:var(--text-muted);margin-bottom:4px;">' +
              escapeHtml(trCat(winner.category)) + ' • 📍 ' + escapeHtml(winner.district) +
            '</div>' +
            '<div style="font-size:0.83rem;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
              '<span>💰 <strong>' + escapeHtml(winner.priceRange || '') + '</strong></span>' +
              '<span>⭐ <strong>' + escapeHtml(winner.rating) + '</strong> (' + escapeHtml(formatReviews(winner.reviews)) + ')</span>' +
            '</div>' +
            '<div style="margin-top:6px;">' + statusBadge + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:center;">' +
          '<button type="button" id="wteBtnViewDetail" class="btn-similar-view">👁️ ' + (isEn ? 'View Details' : 'Xem chi tiết') + '</button>' +
          '<button type="button" id="wteBtnRespin" class="btn-claude-config">🎲 ' + (isEn ? 'Spin Again' : 'Quay lại') + '</button>' +
          '<button type="button" id="wteBtnDelivery" class="btn-similar-order">🛵 ' + (isEn ? 'Order Delivery' : 'Đặt giao') + '</button>' +
        '</div>' +
      '</div>';

    var btnView = $('wteBtnViewDetail');
    if (btnView) {
      btnView.addEventListener('click', function () {
        closeWhatToEatModal();
        openRestaurantDetail(winner.id);
      });
    }
    var btnRespin = $('wteBtnRespin');
    if (btnRespin) {
      btnRespin.addEventListener('click', function () {
        spinWhatToEat();
      });
    }
    var btnDelivery = $('wteBtnDelivery');
    if (btnDelivery) {
      btnDelivery.addEventListener('click', function () {
        closeWhatToEatModal();
        if (window.HNOrderBooking && typeof window.HNOrderBooking.openDelivery === 'function') {
          window.HNOrderBooking.openDelivery(winner.id);
        } else {
          openRestaurantDetail(winner.id);
        }
      });
    }
  }

  function spinWhatToEat() {
    stopWteTimers();
    var body = $('whatToEatBody');
    if (!body) return;
    var isEn = getLang() === 'en';
    var pool = resolveWteCandidates(wteOnlyOpen);
    var candidates = pool.candidates;

    var noticeEl = $('wteNoticeLine');
    if (noticeEl) {
      if (pool.notice) {
        noticeEl.textContent = pool.notice;
        noticeEl.hidden = false;
      } else {
        noticeEl.textContent = '';
        noticeEl.hidden = true;
      }
    }

    var countEl = $('wtePoolBadge');
    if (countEl) {
      countEl.textContent = isEn
        ? (candidates.length + ' places ready at ' + pool.timeCtx.timeLabel)
        : ('Đang quay trong ' + candidates.length + ' quán lúc ' + pool.timeCtx.timeLabel);
    }

    var reelEl = $('wteReel');
    var resultWrap = $('wteResultWrap');
    if (!candidates.length) {
      if (reelEl) reelEl.textContent = isEn ? 'No restaurants available' : 'Chưa có dữ liệu quán ăn';
      if (resultWrap) resultWrap.innerHTML = '';
      return;
    }

    var pickPool = candidates;
    if (candidates.length > 1 && wteLastWinnerId !== null) {
      var withoutLast = [];
      for (var i = 0; i < candidates.length; i++) {
        if (Number(candidates[i].id) !== Number(wteLastWinnerId)) {
          withoutLast.push(candidates[i]);
        }
      }
      if (withoutLast.length) pickPool = withoutLast;
    }
    var winner = pickPool[Math.floor(Math.random() * pickPool.length)];
    wteLastWinnerId = winner.id;

    if (resultWrap) {
      resultWrap.innerHTML = '<div style="padding:10px;font-size:0.86rem;color:var(--text-muted);">' +
        (isEn ? 'Spinning the Hanoi food wheel...' : 'Đang tung xúc xắc chọn quán ngon...') + '</div>';
    }

    var tick = 0;
    wteSpinTimer = setInterval(function () {
      tick += 1;
      var sample = candidates[Math.floor(Math.random() * candidates.length)];
      if (reelEl && sample) {
        reelEl.textContent = '🍽️ ' + sample.name;
      }
    }, 75);

    wteFinishTimer = setTimeout(function () {
      stopWteTimers();
      if (reelEl) {
        reelEl.textContent = '🎉 ' + winner.name;
      }
      renderWteWinnerCard(winner, pool.timeCtx);
    }, 1100);
  }

  function renderWhatToEatShell() {
    var body = $('whatToEatBody');
    if (!body) return;
    var isEn = getLang() === 'en';
    body.innerHTML =
      '<h2 style="font-family:var(--font-serif);color:var(--color-lacquer);margin:0 0 6px;">🎲 ' +
        (isEn ? 'What Should I Eat Today?' : 'Hôm Nay Ăn Gì?') + '</h2>' +
      '<p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 10px;">' +
        (isEn ? 'Smart randomizer based on your active filters & dining time' : 'Quay ngẫu nhiên thông minh theo bộ lọc & khung giờ đang chọn') +
      '</p>' +
      '<div class="wte-controls">' +
        '<label class="wte-toggle-open">' +
          '<input type="checkbox" id="wteOnlyOpenCheck"' + (wteOnlyOpen ? ' checked' : '') + ' />' +
          '<span>' + (isEn ? '🟢 Open places only' : '🟢 Chỉ quay quán đang mở') + '</span>' +
        '</label>' +
        '<span id="wtePoolBadge" style="font-size:0.8rem;color:var(--text-muted);font-weight:600;"></span>' +
      '</div>' +
      '<div id="wteNoticeLine" style="font-size:0.8rem;color:#b45309;background:#fef3c7;padding:6px 10px;border-radius:8px;margin-bottom:8px;" hidden></div>' +
      '<div id="wteReel" class="wte-reel">🍜 ...</div>' +
      '<div id="wteResultWrap"></div>';

    var chk = $('wteOnlyOpenCheck');
    if (chk) {
      chk.addEventListener('change', function () {
        wteOnlyOpen = !!chk.checked;
        spinWhatToEat();
      });
    }
  }

  function openWhatToEatModal() {
    var now = Date.now();
    var modal = $('whatToEatModal');
    if (!modal) return;
    if (now - wteLastOpenTs < 80 && modal.classList.contains('open')) return;
    wteLastOpenTs = now;
    renderWhatToEatShell();
    modal.classList.add('open');
    spinWhatToEat();
  }

  function bindWhatToEatEvents() {
    var btnLucky = $('btnLuckyFast');
    if (btnLucky && !btnLucky.getAttribute('data-wte-bound')) {
      btnLucky.setAttribute('data-wte-bound', '1');
      btnLucky.addEventListener('click', function () {
        openWhatToEatModal();
      });
    }
    var mobRandom = $('mobNavRandom');
    if (mobRandom && !mobRandom.getAttribute('data-wte-bound')) {
      mobRandom.setAttribute('data-wte-bound', '1');
      mobRandom.addEventListener('click', function () {
        openWhatToEatModal();
      });
    }
    var btnClose = $('btnCloseWhatToEat');
    if (btnClose && !btnClose.getAttribute('data-wte-bound')) {
      btnClose.setAttribute('data-wte-bound', '1');
      btnClose.addEventListener('click', closeWhatToEatModal);
    }
    var modal = $('whatToEatModal');
    if (modal && !modal.getAttribute('data-wte-bound')) {
      modal.setAttribute('data-wte-bound', '1');
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeWhatToEatModal();
      });
    }
  }

  window.HNWhatToEat = {
    open: openWhatToEatModal
  };

  /* ==========================================================================
     3. NATURAL LANGUAGE & CLAUDE API SEARCH (window.HNNlpSearch)
     ========================================================================== */
  var DISTRICT_PATTERNS = [
    { district: 'Tây Hồ', patterns: ['ho tay', 'xuan dieu', 'trich sai', 'quang an', 'au co', 'tay ho', 'phu tay ho'] },
    { district: 'Hoàn Kiếm', patterns: ['pho co', 'bo ho', 'hoan kiem', 'hang dao', 'hang bac', 'ta hien', 'nha tho lon', 'trang tien', 'ly quoc su'] },
    { district: 'Nam Từ Liêm', patterns: ['nam tu liem', 'my dinh', 'me tri', 'ham nghi', 'smart city'] },
    { district: 'Bắc Từ Liêm', patterns: ['bac tu liem', 'co nhue', 'ngoai giao doan', 'duc thang'] },
    { district: 'Đống Đa', patterns: ['lang ha', 'thai thinh', 'dong da', 'thai ha', 'chua lang', 'xa dan', 'hoang cau', 'van mieu'] },
    { district: 'Thanh Xuân', patterns: ['nguyen trai', 'thanh xuan', 'nhan chinh', 'le van luong', 'royal city', 'khuat duy tien'] },
    { district: 'Hà Đông', patterns: ['ha dong', 'mo lao', 'van quan', 'van phuc', 'to hieu ha dong', 'nguyen van loc'] },
    { district: 'Cầu Giấy', patterns: ['cau giay', 'dich vong', 'tran thai tong', 'trung hoa', 'nghia tan', 'hoang quoc viet'] },
    { district: 'Hai Bà Trưng', patterns: ['hai ba trung', 'pho hue', 'ba trieu', 'lo duc', 'bach mai', 'trieu viet vuong'] },
    { district: 'Ba Đình', patterns: ['ba dinh', 'kim ma', 'giang vo', 'truc bach', 'doi can', 'cua bac', 'ngoc khanh'] },
    { district: 'Long Biên', patterns: ['long bien', 'ngoc lam', 'co linh', 'nguyen van cu', 'aeon long bien'] },
    { district: 'Hoàng Mai', patterns: ['hoang mai', 'linh dam', 'truong dinh', 'den lu'] }
  ];

  var DISH_KEYWORDS = [
    { canonical: 'bún chả', aliases: ['bun cha'] },
    { canonical: 'bún bò', aliases: ['bun bo', 'bun bo hue'] },
    { canonical: 'bún đậu', aliases: ['bun dau', 'bun dau mam tom'] },
    { canonical: 'chả cá', aliases: ['cha ca'] },
    { canonical: 'bánh mì', aliases: ['banh mi'] },
    { canonical: 'bánh cuốn', aliases: ['banh cuon'] },
    { canonical: 'trà sữa', aliases: ['tra sua'] },
    { canonical: 'cà phê', aliases: ['ca phe', 'cafe', 'coffee'] },
    { canonical: 'hải sản', aliases: ['hai san'] },
    { canonical: 'dimsum', aliases: ['dimsum', 'dim sum'] },
    { canonical: 'sushi', aliases: ['sushi'] },
    { canonical: 'phở', aliases: ['pho'] },
    { canonical: 'cơm', aliases: ['com'] },
    { canonical: 'lẩu', aliases: ['lau'] },
    { canonical: 'nướng', aliases: ['nuong', 'bbq', 'thit nuong'] },
    { canonical: 'chè', aliases: ['che'] },
    { canonical: 'ốc', aliases: ['oc'] },
    { canonical: 'xôi', aliases: ['xoi'] }
  ];

  var PRICE_TIER_LABELS_VI = {
    budget: 'Bình dân (< 50k)',
    moderate: 'Phổ thông (50k - 150k)',
    upscale: 'Tầm trung (150k - 350k)',
    luxury: 'Sang trọng (> 350k)'
  };

  var PEOPLE_LABELS_VI = {
    solo: '1 người',
    couple: '2 người',
    group: 'Nhóm 3 - 5 người',
    party: 'Đoàn đông 6 - 10+'
  };

  var OCCASION_LABELS_VI = {
    breakfast: 'Ăn sáng',
    quick_lunch: 'Bữa trưa',
    date: 'Hẹn hò',
    friends: 'Bạn bè / Nhậu',
    family: 'Gia đình',
    business: 'Tiếp khách',
    night_snack: 'Ăn đêm'
  };

  function hasWordBoundary(textNorm, phraseNorm) {
    var escaped = phraseNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var rx = new RegExp('(?:^|\\s|[,.;!?/()-])' + escaped + '(?:$|\\s|[,.;!?/()-])');
    return rx.test(textNorm);
  }

  function mapMinutesToTimeSlot(mins) {
    var slotMins = [
      { val: '07:00', m: 7 * 60 },
      { val: '08:30', m: 8 * 60 + 30 },
      { val: '11:30', m: 11 * 60 + 30 },
      { val: '12:30', m: 12 * 60 + 30 },
      { val: '14:30', m: 14 * 60 + 30 },
      { val: '17:30', m: 17 * 60 + 30 },
      { val: '19:00', m: 19 * 60 },
      { val: '20:30', m: 20 * 60 + 30 },
      { val: '22:30', m: 22 * 60 + 30 },
      { val: '00:30', m: 30 }
    ];
    for (var i = 0; i < slotMins.length; i++) {
      if (Math.abs(slotMins[i].m - mins) <= 20) {
        return { timeSlot: slotMins[i].val, customTime: '' };
      }
    }
    var hh = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
    var mm = ((mins % 1440) + 1440) % 1440 % 60;
    return {
      timeSlot: 'custom',
      customTime: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm
    };
  }

  function buildSummaryChips(parsed) {
    var chips = [];
    if (parsed.search) {
      chips.push({ key: 'search', label: '🍽️ Món/Từ khóa: ' + parsed.search, value: parsed.search });
    }
    if (parsed.district && parsed.district !== 'all') {
      chips.push({ key: 'district', label: '📍 ' + parsed.district, value: parsed.district });
    }
    if (parsed.priceTier && parsed.priceTier !== 'all') {
      chips.push({ key: 'priceTier', label: '💰 ' + (PRICE_TIER_LABELS_VI[parsed.priceTier] || parsed.priceTier), value: parsed.priceTier });
    }
    if (parsed.peopleCategory && parsed.peopleCategory !== 'all') {
      chips.push({ key: 'peopleCategory', label: '👥 ' + (PEOPLE_LABELS_VI[parsed.peopleCategory] || parsed.peopleCategory), value: parsed.peopleCategory });
    }
    if (parsed.occasion && parsed.occasion !== 'all') {
      chips.push({ key: 'occasion', label: '✨ ' + (OCCASION_LABELS_VI[parsed.occasion] || parsed.occasion), value: parsed.occasion });
    }
    if (parsed.timeSlot && parsed.timeSlot !== 'now') {
      var tVal = parsed.timeSlot === 'custom' && parsed.customTime ? parsed.customTime : parsed.timeSlot;
      chips.push({ key: 'timeSlot', label: '🕒 Lúc ' + tVal, value: tVal });
    }
    if (parsed.quickFilter && parsed.quickFilter !== 'all') {
      var qLabel = parsed.quickFilter === 'open_now' ? '🟢 Đang mở' : parsed.quickFilter;
      chips.push({ key: 'quickFilter', label: qLabel, value: parsed.quickFilter });
    }
    if (Array.isArray(parsed.vibeTags) && parsed.vibeTags.length) {
      for (var i = 0; i < parsed.vibeTags.length; i++) {
        chips.push({ key: 'vibe', label: '🌿 ' + parsed.vibeTags[i], value: parsed.vibeTags[i] });
      }
    }
    return chips;
  }

  function parseNaturalQueryOffline(query) {
    var raw = String(query || '').trim();
    var qn = norm(raw);
    var res = {
      search: '',
      district: 'all',
      priceTier: 'all',
      peopleCategory: 'all',
      occasion: 'all',
      timeSlot: 'now',
      customTime: '',
      quickFilter: 'all',
      vibeTags: [],
      summaryChips: [],
      source: 'offline'
    };

    if (!qn) return res;

    // 1. District / Landmarks
    for (var d = 0; d < DISTRICT_PATTERNS.length; d++) {
      var dp = DISTRICT_PATTERNS[d];
      var foundDist = false;
      for (var p = 0; p < dp.patterns.length; p++) {
        if (hasWordBoundary(qn, dp.patterns[p])) {
          res.district = dp.district;
          foundDist = true;
          break;
        }
      }
      if (foundDist) break;
    }

    // 2. Dishes -> search
    var matchedDishes = [];
    for (var k = 0; k < DISH_KEYWORDS.length; k++) {
      var dk = DISH_KEYWORDS[k];
      for (var a = 0; a < dk.aliases.length; a++) {
        if (hasWordBoundary(qn, dk.aliases[a])) {
          if (matchedDishes.indexOf(dk.canonical) === -1) {
            matchedDishes.push(dk.canonical);
          }
          break;
        }
      }
    }
    if (matchedDishes.length > 0) {
      res.search = matchedDishes[0];
    }

    // 3. Price tier (check data.js keys: budget, moderate, upscale, luxury)
    if (/(duoi 50k|< ?50k|gia re|\bre\b|binh dan|sinh vien|tiet kiem|via he)/.test(qn)) {
      res.priceTier = 'budget';
    } else if (/(sang trong|cao cap|fine dining|dat tien|xa xi|tren 350k|> ?350k|500k|\bvip\b)/.test(qn)) {
      res.priceTier = 'luxury';
    } else if (/(tam trung|kha dat|150k|200k|250k|300k)/.test(qn)) {
      res.priceTier = 'upscale';
    } else if (/(pho thong|vua tien|tam 100k|duoi 100k|duoi 150k|50k|100k)/.test(qn)) {
      res.priceTier = 'moderate';
    }

    // 4. People category
    if (/(1 nguoi|mot minh|di le|\bsolo\b)/.test(qn)) {
      res.peopleCategory = 'solo';
    } else if (/(2 nguoi|hai nguoi|cap doi|hen ho|lang man|\bcouple\b)/.test(qn)) {
      res.peopleCategory = 'couple';
    } else if (/(gia dinh|lien hoan|doan dong|6 nguoi|8 nguoi|10 nguoi|dai gia dinh)/.test(qn)) {
      res.peopleCategory = 'party';
    } else if (/(nhom ban|\bnhom\b|ban be|dong nghiep|tap the|\bteam\b|3 nguoi|4 nguoi|5 nguoi)/.test(qn)) {
      res.peopleCategory = 'group';
    }

    // 5. Occasion
    if (/(an sang|bua sang|sang som|diem tam)/.test(qn)) {
      res.occasion = 'breakfast';
    } else if (/(an trua|bua trua|com trua|cong so|van phong)/.test(qn)) {
      res.occasion = 'quick_lunch';
    } else if (/(hen ho|lang man|nguoi yeu|valentine)/.test(qn)) {
      res.occasion = 'date';
    } else if (/(tiep khach|doi tac|gap khach)/.test(qn)) {
      res.occasion = 'business';
    } else if (/(gia dinh|sum hop|bo me)/.test(qn)) {
      res.occasion = 'family';
    } else if (/(an dem|an khuya|dem muon|nua dem|\bkhuya\b)/.test(qn)) {
      res.occasion = 'night_snack';
    } else if (/(nhau|tu tap|hop mat|ban be|lai rai)/.test(qn)) {
      res.occasion = 'friends';
    }

    // 6. Vibes
    var vibeCandidates = [
      { key: 'yên tĩnh', rx: /(yen tinh|thanh binh|khong on)/ },
      { key: 'làm việc', rx: /(lam viec|hoc bai|o cam|wifi|chay deadline)/ },
      { key: 'sân vườn', rx: /(san vuon|ngoai troi|thoang mat)/ },
      { key: 'view đẹp', rx: /(view dep|song hong|ho tay view|ban cong)/ },
      { key: 'máy lạnh', rx: /(may lanh|dieu hoa)/ }
    ];
    for (var v = 0; v < vibeCandidates.length; v++) {
      if (vibeCandidates[v].rx.test(qn)) {
        res.vibeTags.push(vibeCandidates[v].key);
      }
    }
    if (res.search === 'cà phê' && res.vibeTags.indexOf('cà phê') === -1 && /(ca phe|cafe)/.test(qn)) {
      res.vibeTags.push('cà phê');
    }

    // 7. Time & open_now
    if (/(dang mo|mo cua|bay gio|hien tai|luc nay)/.test(qn)) {
      res.quickFilter = 'open_now';
    }

    var clockMatch = qn.match(/(\d{1,2})\s*(?::|h|gio)\s*(\d{1,2})?\s*(sang|trua|chieu|toi|dem)?/);
    if (clockMatch) {
      var hh = parseInt(clockMatch[1], 10);
      var mm = clockMatch[2] ? parseInt(clockMatch[2], 10) : 0;
      var period = clockMatch[3] || '';
      if (!isNaN(hh) && hh >= 0 && hh <= 23 && !isNaN(mm) && mm >= 0 && mm <= 59) {
        if ((period === 'chieu' || period === 'toi' || period === 'dem') && hh < 12) {
          hh += 12;
        }
        var mapped = mapMinutesToTimeSlot(hh * 60 + mm);
        res.timeSlot = mapped.timeSlot;
        res.customTime = mapped.customTime;
      }
    } else if (/(toi nay|buoi toi|an toi)/.test(qn)) {
      res.timeSlot = '19:00';
    } else if (/(trua nay|buoi trua|an trua)/.test(qn)) {
      res.timeSlot = '11:30';
    } else if (/(sang nay|buoi sang|an sang)/.test(qn)) {
      res.timeSlot = '08:30';
    } else if (/(chieu nay|buoi chieu)/.test(qn)) {
      res.timeSlot = '14:30';
    } else if (/(dem nay|khuya)/.test(qn)) {
      res.timeSlot = '22:30';
    }

    // Fallback search hint if user entered something without dish match and without other structured filters
    if (!res.search && res.district === 'all' && res.priceTier === 'all' &&
        res.peopleCategory === 'all' && res.occasion === 'all' && res.quickFilter === 'all') {
      res.search = raw;
    }

    res.summaryChips = buildSummaryChips(res);
    return res;
  }

  function validateClaudeParsedJson(obj, originalQuery) {
    var fallback = parseNaturalQueryOffline(originalQuery);
    if (!obj || typeof obj !== 'object') return fallback;

    var price = obj.priceTier ? String(obj.priceTier).trim().toLowerCase() : 'all';
    if (price === 'expensive') price = 'upscale';
    if (VALID_PRICE_TIERS.indexOf(price) === -1) price = 'all';

    var dist = obj.district ? String(obj.district).trim() : 'all';
    if (VALID_DISTRICTS.indexOf(dist) === -1) dist = 'all';

    var ppl = obj.peopleCategory ? String(obj.peopleCategory).trim().toLowerCase() : 'all';
    if (VALID_PEOPLE_CATS.indexOf(ppl) === -1) ppl = 'all';

    var occ = obj.occasion ? String(obj.occasion).trim().toLowerCase() : 'all';
    if (VALID_OCCASIONS.indexOf(occ) === -1) occ = 'all';

    var slot = obj.timeSlot ? String(obj.timeSlot).trim() : 'now';
    var customTime = obj.customTime ? String(obj.customTime).trim() : '';
    if (VALID_TIME_SLOTS.indexOf(slot) === -1) {
      if (/^\d{2}:\d{2}$/.test(slot)) {
        customTime = slot;
        slot = 'custom';
      } else {
        slot = 'now';
      }
    }

    var qf = (obj.quickFilter === 'open_now' || obj.quickFilter === 'michelin' ||
              obj.quickFilter === 'hadong' || obj.quickFilter === 'reservable' ||
              obj.quickFilter === 'favorites') ? obj.quickFilter : 'all';

    var vibes = [];
    if (Array.isArray(obj.vibeTags)) {
      for (var i = 0; i < obj.vibeTags.length; i++) {
        var vt = String(obj.vibeTags[i] || '').trim();
        if (vt && vibes.indexOf(vt) === -1) vibes.push(vt);
      }
    }

    var validated = {
      search: obj.search ? String(obj.search).trim() : '',
      district: dist,
      priceTier: price,
      peopleCategory: ppl,
      occasion: occ,
      timeSlot: slot,
      customTime: customTime,
      quickFilter: qf,
      vibeTags: vibes,
      summaryChips: [],
      source: 'claude'
    };
    validated.summaryChips = buildSummaryChips(validated);
    return validated;
  }

  function parseNaturalQueryWithClaude(query) {
    var raw = String(query || '').trim();
    var offlineResult = parseNaturalQueryOffline(raw);
    if (!raw) return Promise.resolve(offlineResult);

    var apiKey = '';
    var model = DEFAULT_CLAUDE_MODEL;
    apiKey = String(storageGet(CLAUDE_KEY_STORAGE) || '').trim();
    model = String(storageGet(CLAUDE_MODEL_STORAGE) || DEFAULT_CLAUDE_MODEL).trim() || DEFAULT_CLAUDE_MODEL;

    if (!apiKey || typeof fetch !== 'function') {
      return Promise.resolve(offlineResult);
    }

    var prompt =
      'Convert this Vietnamese restaurant search query into ONLY valid JSON with keys: ' +
      'search (string dish/keyword or ""), ' +
      'district (one of: "all", ' + VALID_DISTRICTS.join(', ') + '), ' +
      'priceTier (one of: "all", "budget", "moderate", "upscale", "luxury"), ' +
      'peopleCategory (one of: "all", "solo", "couple", "group", "party"), ' +
      'occasion (one of: "all", "breakfast", "quick_lunch", "date", "friends", "family", "business", "night_snack"), ' +
      'timeSlot (one of: "now", "07:00", "08:30", "11:30", "12:30", "14:30", "17:30", "19:00", "20:30", "22:30", "00:30"), ' +
      'quickFilter ("all" or "open_now"), ' +
      'vibeTags (array of short strings).\nQuery: ' + JSON.stringify(raw);

    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 320,
        messages: [{ role: 'user', content: prompt }]
      })
    })
      .then(function (resp) {
        if (!resp || !resp.ok) throw new Error('HTTP ' + (resp ? resp.status : 'error'));
        return resp.json();
      })
      .then(function (data) {
        var text = (data && Array.isArray(data.content) && data.content[0] && data.content[0].text)
          ? String(data.content[0].text) : '';
        var match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON in Claude response');
        var parsed = JSON.parse(match[0]);
        return validateClaudeParsedJson(parsed, raw);
      })
      .catch(function () {
        return offlineResult;
      });
  }

  var lastParsedFilters = null;

  function applyFilterStateFromParsed(parsed) {
    lastParsedFilters = parsed;
    var patch = {
      search: parsed.search || '',
      district: parsed.district || 'all',
      priceTier: parsed.priceTier || 'all',
      peopleCategory: parsed.peopleCategory || 'all',
      occasion: parsed.occasion || 'all',
      timeSlot: parsed.timeSlot || 'now',
      quickFilter: parsed.quickFilter || 'all'
    };
    if (parsed.timeSlot === 'custom' && parsed.customTime) {
      patch.customTime = parsed.customTime;
    }
    if (window.HNAppBridge && typeof window.HNAppBridge.applyFiltersPatch === 'function') {
      window.HNAppBridge.applyFiltersPatch(patch);
    }
    renderNlpParsedChips(parsed);
  }

  function renderNlpParsedChips(parsed) {
    var box = $('nlpParsedChips');
    if (!box) return;
    var chips = (parsed && Array.isArray(parsed.summaryChips)) ? parsed.summaryChips : [];
    if (!chips.length) {
      box.innerHTML = '';
      box.hidden = true;
      return;
    }

    var isEn = getLang() === 'en';
    var srcLabel = parsed.source === 'claude' ? '🤖 Claude AI' : '⚡ NLP';
    var html = '<span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);">' + escapeHtml(srcLabel) + ':</span>';
    for (var i = 0; i < chips.length; i++) {
      var c = chips[i];
      html += '<button type="button" class="nlp-chip" data-nlp-remove-key="' + escapeHtml(c.key) +
        '" data-nlp-remove-val="' + escapeHtml(c.value) + '" title="' + (isEn ? 'Remove filter' : 'Bỏ điều kiện này') + '">' +
        '<span>' + escapeHtml(c.label) + '</span> <span aria-hidden="true">✕</span></button>';
    }
    html += '<button type="button" id="btnNlpChipsClear" class="nlp-chip-clear">' +
      (isEn ? '✕ Clear NLP' : '✕ Xóa bộ lọc NLP') + '</button>';

    box.innerHTML = html;
    box.hidden = false;

    var clearBtn = $('btnNlpChipsClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        lastParsedFilters = null;
        box.innerHTML = '';
        box.hidden = true;
        if (window.HNAppBridge && typeof window.HNAppBridge.resetAllFilters === 'function') {
          window.HNAppBridge.resetAllFilters();
        }
      });
    }

    var remBtns = box.querySelectorAll('[data-nlp-remove-key]');
    for (var r = 0; r < remBtns.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          if (!lastParsedFilters) return;
          var key = btn.getAttribute('data-nlp-remove-key');
          var val = btn.getAttribute('data-nlp-remove-val');
          if (key === 'search') lastParsedFilters.search = '';
          else if (key === 'district') lastParsedFilters.district = 'all';
          else if (key === 'priceTier') lastParsedFilters.priceTier = 'all';
          else if (key === 'peopleCategory') lastParsedFilters.peopleCategory = 'all';
          else if (key === 'occasion') lastParsedFilters.occasion = 'all';
          else if (key === 'timeSlot') {
            lastParsedFilters.timeSlot = 'now';
            lastParsedFilters.customTime = '';
          } else if (key === 'quickFilter') {
            lastParsedFilters.quickFilter = 'all';
          } else if (key === 'vibe' && Array.isArray(lastParsedFilters.vibeTags)) {
            var nextVibes = [];
            for (var vi = 0; vi < lastParsedFilters.vibeTags.length; vi++) {
              if (lastParsedFilters.vibeTags[vi] !== val) nextVibes.push(lastParsedFilters.vibeTags[vi]);
            }
            lastParsedFilters.vibeTags = nextVibes;
          }
          lastParsedFilters.summaryChips = buildSummaryChips(lastParsedFilters);
          applyFilterStateFromParsed(lastParsedFilters);
        });
      })(remBtns[r]);
    }
  }

  function applyNaturalQuery(query) {
    var raw = String(query || '').trim();
    if (!raw) {
      var emptyParsed = parseNaturalQueryOffline('');
      applyFilterStateFromParsed(emptyParsed);
      return Promise.resolve(emptyParsed);
    }

    var hasKey = Boolean(String(storageGet(CLAUDE_KEY_STORAGE) || '').trim());

    if (!hasKey) {
      var offlineParsed = parseNaturalQueryOffline(raw);
      applyFilterStateFromParsed(offlineParsed);
      return Promise.resolve(offlineParsed);
    }

    return parseNaturalQueryWithClaude(raw).then(function (parsed) {
      applyFilterStateFromParsed(parsed);
      return parsed;
    });
  }

  function closeClaudeModal() {
    var modal = $('claudeApiModal');
    if (modal) modal.classList.remove('open');
  }

  function openClaudeConfigModal() {
    var modal = $('claudeApiModal');
    var body = $('claudeApiBody');
    if (!modal || !body) return;
    var curKey = storageGet(CLAUDE_KEY_STORAGE) || '';
    var curModel = storageGet(CLAUDE_MODEL_STORAGE) || DEFAULT_CLAUDE_MODEL;

    var isEn = getLang() === 'en';
    body.innerHTML =
      '<h2 style="font-family:var(--font-serif);color:var(--color-lacquer);margin:0 0 8px;">⚙️ ' +
        (isEn ? 'Claude API Settings (Optional)' : 'Cấu Hình Claude API (Tùy Chọn)') + '</h2>' +
      '<p style="font-size:0.86rem;color:var(--text-muted);margin:0 0 14px;">' +
        (isEn
          ? 'Enter an Anthropic API key to enhance natural-language search. Without a key, offline Vietnamese NLP runs automatically.'
          : 'Nhập Anthropic API Key để nâng cấp tìm kiếm ngôn ngữ tự nhiên bằng Claude. Nếu để trống, hệ thống tự dùng bộ phân tích tiếng Việt offline.') +
      '</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<label style="font-size:0.84rem;font-weight:600;">Anthropic API Key' +
          '<input type="password" id="claudeApiKeyInput" class="search-input" style="margin-top:4px;padding-left:12px;" value="' +
            escapeHtml(curKey) + '" placeholder="sk-ant-..." autocomplete="off" />' +
        '</label>' +
        '<label style="font-size:0.84rem;font-weight:600;">Model' +
          '<input type="text" id="claudeModelInput" class="search-input" style="margin-top:4px;padding-left:12px;" value="' +
            escapeHtml(curModel) + '" placeholder="' + DEFAULT_CLAUDE_MODEL + '" />' +
        '</label>' +
        '<div id="claudeConfigStatus" style="font-size:0.82rem;min-height:18px;color:var(--text-muted);"></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">' +
          '<button type="button" id="btnSaveClaudeConfig" class="btn-nlp-search">💾 ' + (isEn ? 'Save Settings' : 'Lưu cấu hình') + '</button>' +
          '<button type="button" id="btnTestClaudeConfig" class="btn-claude-config">🧪 ' + (isEn ? 'Test Connection' : 'Kiểm tra kết nối') + '</button>' +
          '<button type="button" id="btnClearClaudeConfig" class="nlp-chip-clear" style="margin-left:0;">🗑️ ' + (isEn ? 'Clear Key' : 'Xóa Key') + '</button>' +
        '</div>' +
      '</div>';

    modal.classList.add('open');

    var statusEl = $('claudeConfigStatus');
    var keyInput = $('claudeApiKeyInput');
    var modelInput = $('claudeModelInput');

    var btnSave = $('btnSaveClaudeConfig');
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        var k = keyInput ? String(keyInput.value || '').trim() : '';
        var m = modelInput ? String(modelInput.value || '').trim() : DEFAULT_CLAUDE_MODEL;
        if (k) storageSet(CLAUDE_KEY_STORAGE, k);
        else storageRemove(CLAUDE_KEY_STORAGE);
        storageSet(CLAUDE_MODEL_STORAGE, m || DEFAULT_CLAUDE_MODEL);
        if (statusEl) {
          statusEl.style.color = '#15803d';
          statusEl.textContent = k
            ? (isEn ? 'Saved Claude API key.' : 'Đã lưu Claude API Key!')
            : (isEn ? 'Saved (offline NLP mode active).' : 'Đã lưu (đang dùng chế độ NLP offline).');
        }
        notifyToast(k ? 'Đã lưu cấu hình Claude API' : 'Đang dùng tìm kiếm NLP offline');
      });
    }

    var btnTest = $('btnTestClaudeConfig');
    if (btnTest) {
      btnTest.addEventListener('click', function () {
        var k = keyInput ? String(keyInput.value || '').trim() : '';
        var m = modelInput ? String(modelInput.value || '').trim() : DEFAULT_CLAUDE_MODEL;
        if (!k) {
          if (statusEl) {
            statusEl.style.color = '#b45309';
            statusEl.textContent = isEn ? 'No API key entered — offline NLP works immediately.' : 'Chưa nhập API Key — bộ NLP offline vẫn hoạt động sẵn sàng.';
          }
          return;
        }
        storageSet(CLAUDE_KEY_STORAGE, k);
        storageSet(CLAUDE_MODEL_STORAGE, m || DEFAULT_CLAUDE_MODEL);
        if (statusEl) {
          statusEl.style.color = 'var(--text-muted)';
          statusEl.textContent = isEn ? 'Testing Claude API...' : 'Đang thử kết nối Claude API...';
        }
        parseNaturalQueryWithClaude('phở bò ở Hoàn Kiếm sáng nay').then(function (r) {
          if (!statusEl) return;
          if (r && r.source === 'claude') {
            statusEl.style.color = '#15803d';
            statusEl.textContent = isEn ? 'Claude API connected successfully!' : 'Kết nối Claude API thành công!';
          } else {
            statusEl.style.color = '#b91c1c';
            statusEl.textContent = isEn ? 'Claude API request failed — fell back to offline NLP.' : 'Không gọi được Claude API (đã tự chuyển về NLP offline).';
          }
        });
      });
    }

    var btnClear = $('btnClearClaudeConfig');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        storageRemove(CLAUDE_KEY_STORAGE);
        storageRemove(CLAUDE_MODEL_STORAGE);
        if (keyInput) keyInput.value = '';
        if (modelInput) modelInput.value = DEFAULT_CLAUDE_MODEL;
        if (statusEl) {
          statusEl.style.color = '#15803d';
          statusEl.textContent = isEn ? 'Cleared API key.' : 'Đã xóa API Key, chuyển về NLP offline.';
        }
      });
    }
  }

  function looksLikeNaturalQuery(q) {
    var nq = norm(q);
    if (!nq) return false;
    return nq.split(' ').length >= 3;
  }

  function bindNlpEvents() {
    var btnNlp = $('btnNlpSearch');
    if (btnNlp && !btnNlp.getAttribute('data-nlp-bound')) {
      btnNlp.setAttribute('data-nlp-bound', '1');
      btnNlp.addEventListener('click', function () {
        var inp = $('searchInput');
        applyNaturalQuery(inp ? inp.value : '');
      });
    }

    var searchInput = $('searchInput');
    if (searchInput && !searchInput.getAttribute('data-nlp-bound')) {
      searchInput.setAttribute('data-nlp-bound', '1');
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.shiftKey || looksLikeNaturalQuery(searchInput.value))) {
          e.preventDefault();
          applyNaturalQuery(searchInput.value);
        }
      });
    }

    var exChips = document.querySelectorAll('.nlp-example-chip');
    for (var i = 0; i < exChips.length; i++) {
      (function (chip) {
        if (chip.getAttribute('data-nlp-bound')) return;
        chip.setAttribute('data-nlp-bound', '1');
        chip.addEventListener('click', function () {
          var q = chip.getAttribute('data-nlp') || chip.textContent || '';
          var inp = $('searchInput');
          if (inp) inp.value = q;
          applyNaturalQuery(q);
        });
      })(exChips[i]);
    }

    var btnCfg = $('btnClaudeConfig');
    if (btnCfg && !btnCfg.getAttribute('data-nlp-bound')) {
      btnCfg.setAttribute('data-nlp-bound', '1');
      btnCfg.addEventListener('click', openClaudeConfigModal);
    }

    var btnCloseCfg = $('btnCloseClaudeModal');
    if (btnCloseCfg && !btnCloseCfg.getAttribute('data-nlp-bound')) {
      btnCloseCfg.setAttribute('data-nlp-bound', '1');
      btnCloseCfg.addEventListener('click', closeClaudeModal);
    }

    var cfgModal = $('claudeApiModal');
    if (cfgModal && !cfgModal.getAttribute('data-nlp-bound')) {
      cfgModal.setAttribute('data-nlp-bound', '1');
      cfgModal.addEventListener('click', function (e) {
        if (e.target === cfgModal) closeClaudeModal();
      });
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeWhatToEatModal();
      closeClaudeModal();
    }
  });

  window.HNNlpSearch = {
    parseNaturalQueryOffline: parseNaturalQueryOffline,
    parseNaturalQueryWithClaude: parseNaturalQueryWithClaude,
    applyNaturalQuery: applyNaturalQuery
  };

  function initSmartDiscovery() {
    bindPersonalizedEvents();
    renderPersonalizedSection();
    bindWhatToEatEvents();
    bindNlpEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmartDiscovery);
  } else {
    initSmartDiscovery();
  }
})();
