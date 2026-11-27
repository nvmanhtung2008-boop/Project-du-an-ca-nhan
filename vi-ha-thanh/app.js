/**
 * HÀ NỘI PHỐ VỊ - VỊ HÀ THÀNH (CẨM NANG ẨM THỰC CỔ ĐIỂN HÀ NỘI)
 * Core Application Logic, Filters, Lucky Wheel, Web Audio & Map Link Integrations
 */

(function () {
  'use strict';

  // --- STATE ---
  const state = {
    search: '',
    priceTier: 'all',
    peopleCategory: 'all',
    district: 'all',
    occasion: 'all',
    quickFilter: 'all', // 'all' | 'open_now' | 'michelin' | 'hadong' | 'reservable' | 'favorites'
    timeSlot: 'now',    // 'now' | 'HH:MM' | 'custom'
    customTime: '19:00',
    sortBy: 'rating_desc',
    currentPage: 1,
    pageSize: 9, // 9 quán mỗi trang (chia nhỏ trang, chống cuộn sâu)
    favorites: new Set(),
    soundEnabled: true,
    isClawing: false
  };

  // --- OPENING HOURS ENGINE & FILTER STATE API ---
  const hoursParseCache = {};
  const HOURS_PARSE_CACHE = hoursParseCache;
  let dataVersion = 1;
  const filterCache = {};
  const filterCacheOrder = [];
  const FILTER_CACHE_MAX = 40;

  function invalidateFilterCache() {
    Object.keys(filterCache).forEach((k) => { delete filterCache[k]; });
    filterCacheOrder.length = 0;
  }

  function i18nText(key, fallback) {
    if (window.HNi18n && typeof window.HNi18n.t === 'function') {
      return window.HNi18n.t(key, fallback);
    }
    return fallback;
  }

  function i18nCategory(cat) {
    if (window.HNi18n && typeof window.HNi18n.translateCategory === 'function') {
      return window.HNi18n.translateCategory(cat);
    }
    return cat;
  }
  const PRICE_TIER_ORDER = ['budget', 'moderate', 'upscale', 'luxury'];
  const DISH_STOP_WORDS = {
    mon: 1, an: 1, cua: 1, va: 1, voi: 1, cho: 1, tai: 1, cac: 1, nhung: 1,
    dac: 1, biet: 1, truyen: 1, thong: 1, ha: 1, noi: 1, quan: 1, nha: 1,
    hang: 1, nuoc: 1, dung: 1, gion: 1, ngon: 1, thom: 1, nong: 1, sot: 1,
    cham: 1, kem: 1, bo: 1, ga: 1, thit: 1, rau: 1, song: 1, tuoi: 1
  };

  function parseTimeStringToMinutes(hhmm) {
    if (typeof hhmm !== 'string') return null;
    const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function formatMinutesToHHMM(mins) {
    if (typeof mins !== 'number' || isNaN(mins)) return '00:00';
    const normMins = ((Math.floor(mins) % 1440) + 1440) % 1440;
    const hh = Math.floor(normMins / 60);
    const mm = normMins % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function extractClosedDaysFromHours(rawStr) {
    const closed = [];
    const addDay = (d) => {
      if (closed.indexOf(d) === -1) closed.push(d);
    };
    const normStr = normalizeVi(rawStr);
    const clauses = [];
    const parenRx = /\(([^)]+)\)/g;
    let pm;
    while ((pm = parenRx.exec(normStr)) !== null) {
      if (/\b(nghi|dong cua|off)\b/.test(pm[1])) clauses.push(pm[1]);
    }
    if (!clauses.length && /\b(nghi|dong cua)\b/.test(normStr)) {
      clauses.push(normStr);
    }
    clauses.forEach((cl) => {
      if (/\b(chu nhat|cn)\b/.test(cl)) addDay(0);
      if (/\b(thu\s*2|t2)\b/.test(cl)) addDay(1);
      if (/\b(thu\s*3|t3)\b/.test(cl)) addDay(2);
      if (/\b(thu\s*4|t4)\b/.test(cl)) addDay(3);
      if (/\b(thu\s*5|t5)\b/.test(cl)) addDay(4);
      if (/\b(thu\s*6|t6)\b/.test(cl)) addDay(5);
      if (/\b(thu\s*7|t7)\b/.test(cl)) addDay(6);
    });
    closed.sort((a, b) => a - b);
    return closed;
  }

  function parseOpeningHours(hoursStr) {
    const raw = String(hoursStr || '').trim() || '07:00 - 22:00';
    if (HOURS_PARSE_CACHE[raw]) {
      const cached = HOURS_PARSE_CACHE[raw];
      return {
        is24h: cached.is24h,
        closedDays: cached.closedDays.slice(),
        ranges: cached.ranges.map((r) => ({ startMin: r.startMin, endMin: r.endMin }))
      };
    }

    const closedDays = extractClosedDaysFromHours(raw);
    const normRaw = normalizeVi(raw);

    if (/24\s*\/\s*24|24\s*\/\s*7|24\s*gio/.test(normRaw)) {
      const res24 = { is24h: true, closedDays, ranges: [{ startMin: 0, endMin: 1440 }] };
      HOURS_PARSE_CACHE[raw] = res24;
      return {
        is24h: true,
        closedDays: closedDays.slice(),
        ranges: [{ startMin: 0, endMin: 1440 }]
      };
    }

    const cleaned = raw.replace(/\([^)]*\)/g, ' ');
    const segments = cleaned.split(/[&,;]+/);
    const ranges = [];

    segments.forEach((seg) => {
      const m = seg.match(/(\d{1,2}:\d{2})\s*[-–—~]+\s*(\d{1,2}:\d{2})/);
      if (!m) return;
      const startToken = m[1].trim();
      const endToken = m[2].trim();
      const startMin = startToken === '24:00' ? 0 : parseTimeStringToMinutes(startToken);
      let endMin = (endToken === '24:00' || endToken === '00:00') ? 1440 : parseTimeStringToMinutes(endToken);
      if (startMin === null || endMin === null) return;
      if (endMin === startMin) {
        endMin = startMin + 1440;
      } else if (endMin < startMin) {
        endMin += 1440;
      }
      ranges.push({ startMin, endMin });
    });

    if (ranges.length === 0) {
      ranges.push({ startMin: 7 * 60, endMin: 22 * 60 });
    }

    const is24h = ranges.some((r) => r.startMin === 0 && r.endMin >= 1440);
    const result = { is24h, closedDays, ranges };
    HOURS_PARSE_CACHE[raw] = result;

    return {
      is24h: result.is24h,
      closedDays: result.closedDays.slice(),
      ranges: result.ranges.map((r) => ({ startMin: r.startMin, endMin: r.endMin }))
    };
  }

  function isOpenAtMinutes(restaurant, targetMinutes, targetDayOfWeek) {
    if (!restaurant) return false;
    const now = new Date();
    const mins = (typeof targetMinutes === 'number' && !isNaN(targetMinutes))
      ? ((Math.floor(targetMinutes) % 1440) + 1440) % 1440
      : (now.getHours() * 60 + now.getMinutes());
    const day = (typeof targetDayOfWeek === 'number' && !isNaN(targetDayOfWeek) && targetDayOfWeek >= 0 && targetDayOfWeek <= 6)
      ? Math.floor(targetDayOfWeek)
      : now.getDay();

    const parsed = parseOpeningHours(restaurant.openingHours || restaurant.openHours || '07:00 - 22:00');
    const todayClosed = parsed.closedDays.indexOf(day) !== -1;

    if (!todayClosed) {
      if (parsed.is24h) return true;
      for (let i = 0; i < parsed.ranges.length; i++) {
        const r = parsed.ranges[i];
        if (mins >= r.startMin && mins < r.endMin) return true;
      }
    }

    const prevDay = (day + 6) % 7;
    const prevClosed = parsed.closedDays.indexOf(prevDay) !== -1;
    if (!prevClosed) {
      const shiftedMins = mins + 1440;
      for (let j = 0; j < parsed.ranges.length; j++) {
        const rPrev = parsed.ranges[j];
        if (rPrev.endMin > 1440 && shiftedMins >= rPrev.startMin && shiftedMins < rPrev.endMin) {
          return true;
        }
      }
    }

    return false;
  }

  function isOpenAtTimeString(restaurant, hhmm, dateObj) {
    const mins = parseTimeStringToMinutes(hhmm);
    if (mins === null) return false;
    const dt = (dateObj instanceof Date && !isNaN(dateObj.getTime())) ? dateObj : new Date();
    return isOpenAtMinutes(restaurant, mins, dt.getDay());
  }

  function getSelectedTimeContext() {
    const selectEl = document.getElementById('timeSlotSelect');
    const customEl = document.getElementById('customTimeInput');
    const rawValue = (selectEl && selectEl.value) ? selectEl.value : (state.timeSlot || 'now');
    const now = new Date();

    if (rawValue === 'now') {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      return {
        mode: 'now',
        minutes: nowMins,
        timeLabel: formatMinutesToHHMM(nowMins),
        dayOfWeek: now.getDay(),
        rawValue: 'now'
      };
    }

    if (rawValue === 'custom') {
      const customRaw = (customEl && customEl.value) ? customEl.value : (state.customTime || '19:00');
      let customMins = parseTimeStringToMinutes(customRaw);
      if (customMins === null) customMins = 19 * 60;
      const formatted = formatMinutesToHHMM(customMins);
      return {
        mode: 'slot',
        minutes: customMins,
        timeLabel: formatted,
        dayOfWeek: now.getDay(),
        rawValue: formatted
      };
    }

    const slotMins = parseTimeStringToMinutes(rawValue);
    if (slotMins === null) {
      const fallbackMins = now.getHours() * 60 + now.getMinutes();
      return {
        mode: 'now',
        minutes: fallbackMins,
        timeLabel: formatMinutesToHHMM(fallbackMins),
        dayOfWeek: now.getDay(),
        rawValue: 'now'
      };
    }

    return {
      mode: 'slot',
      minutes: slotMins,
      timeLabel: formatMinutesToHHMM(slotMins),
      dayOfWeek: now.getDay(),
      rawValue: rawValue
    };
  }

  function getFilterStateSnapshot() {
    return {
      search: state.search || '',
      priceTier: state.priceTier || 'all',
      peopleCategory: state.peopleCategory || 'all',
      district: state.district || 'all',
      occasion: state.occasion || 'all',
      quickFilter: state.quickFilter || 'all',
      timeSlot: state.timeSlot || 'now',
      customTime: state.customTime || '19:00',
      sortBy: state.sortBy || 'rating_desc'
    };
  }

  function hasActiveFilters(filterState) {
    const fs = filterState || getFilterStateSnapshot();
    return Boolean(
      (fs.search && String(fs.search).trim()) ||
      (fs.priceTier && fs.priceTier !== 'all') ||
      (fs.peopleCategory && fs.peopleCategory !== 'all') ||
      (fs.district && fs.district !== 'all') ||
      (fs.occasion && fs.occasion !== 'all') ||
      (fs.quickFilter && fs.quickFilter !== 'all')
    );
  }

  function getActiveFilterSummary(filterState) {
    const fs = filterState || getFilterStateSnapshot();
    const parts = [];
    if (fs.district && fs.district !== 'all') parts.push('Quận ' + fs.district);
    if (fs.priceTier && fs.priceTier !== 'all') {
      const tierMap = {
        budget: 'Bình dân (< 50k)',
        moderate: 'Phổ thông (50k - 150k)',
        upscale: 'Tầm trung (150k - 350k)',
        luxury: 'Sang trọng (> 350k)'
      };
      parts.push(tierMap[fs.priceTier] || fs.priceTier);
    }
    if (fs.peopleCategory && fs.peopleCategory !== 'all') {
      const pplMap = {
        solo: '1 người',
        couple: '2 người',
        group: '3 - 5 người',
        party: '6 - 10+ người'
      };
      parts.push(pplMap[fs.peopleCategory] || fs.peopleCategory);
    }
    if (fs.occasion && fs.occasion !== 'all') {
      const occMap = {
        breakfast: 'Ăn sáng',
        quick_lunch: 'Bữa trưa',
        date: 'Hẹn hò',
        friends: 'Bạn bè / Nhậu',
        family: 'Gia đình',
        business: 'Tiếp khách',
        night_snack: 'Ăn đêm'
      };
      parts.push(occMap[fs.occasion] || fs.occasion);
    }
    if (fs.quickFilter && fs.quickFilter !== 'all') {
      const qfMap = {
        open_now: 'Chỉ quán đang mở',
        hadong: 'Quán ngon Hà Đông',
        michelin: 'Đạt giải Michelin',
        reservable: 'Có đặt bàn trước',
        favorites: 'Quán đã lưu'
      };
      parts.push(qfMap[fs.quickFilter] || fs.quickFilter);
    }
    if (fs.search && String(fs.search).trim()) {
      parts.push('Từ khóa "' + String(fs.search).trim() + '"');
    }
    return parts.join(' • ');
  }

  function itemMatchesSearch(item, rawSearch) {
    const rawQuery = String(rawSearch || '').trim().toLowerCase();
    if (!rawQuery) return true;
    const normQuery = normalizeVi(rawQuery);
    const badges = Array.isArray(item.specialBadges) ? item.specialBadges : [];
    const dishes = Array.isArray(item.signatureDishes) ? item.signatureDishes : [];
    const matchField = (val) => {
      const s = String(val || '');
      return s.toLowerCase().includes(rawQuery) || (normQuery && normalizeVi(s).includes(normQuery));
    };
    return (
      matchField(item.name) ||
      matchField(item.subname) ||
      matchField(item.category) ||
      matchField(item.district) ||
      matchField(item.address) ||
      dishes.some(matchField) ||
      badges.some(matchField)
    );
  }

  function itemMatchesFilterFacets(item, fs, opts) {
    const cfg = opts || {};
    const badges = Array.isArray(item.specialBadges) ? item.specialBadges : [];
    const peopleCats = Array.isArray(item.peopleCategory) ? item.peopleCategory : [];
    const occasions = Array.isArray(item.occasions) ? item.occasions : [];

    if (!cfg.ignoreSearch && fs.search && String(fs.search).trim()) {
      if (!itemMatchesSearch(item, fs.search)) return false;
    }
    if (!cfg.ignorePrice && fs.priceTier && fs.priceTier !== 'all' && item.priceTier !== fs.priceTier) {
      return false;
    }
    if (!cfg.ignorePeople && fs.peopleCategory && fs.peopleCategory !== 'all') {
      if (!peopleCats.includes(fs.peopleCategory)) return false;
    }
    if (!cfg.ignoreDistrict && fs.district && fs.district !== 'all' && item.district !== fs.district) {
      return false;
    }
    if (!cfg.ignoreOccasion && fs.occasion && fs.occasion !== 'all') {
      if (!occasions.includes(fs.occasion)) return false;
    }
    if (!cfg.ignoreQuick && fs.quickFilter && fs.quickFilter !== 'all') {
      if (fs.quickFilter === 'michelin') {
        if (!badges.some((b) => String(b).toLowerCase().includes('michelin'))) return false;
      } else if (fs.quickFilter === 'hadong') {
        if (item.district !== 'Hà Đông') return false;
      } else if (fs.quickFilter === 'reservable') {
        if (!window.HNOrderBooking || !window.HNOrderBooking.canReserve(item)) return false;
      } else if (fs.quickFilter === 'favorites') {
        if (!state.favorites.has(item.id)) return false;
      }
    }
    return true;
  }

  function extractDishTokens(restaurant) {
    const tokens = [];
    const sources = []
      .concat(Array.isArray(restaurant.signatureDishes) ? restaurant.signatureDishes : [])
      .concat(restaurant.category ? [restaurant.category] : []);
    sources.forEach((text) => {
      normalizeVi(text).split(/[^a-z0-9]+/).forEach((tok) => {
        if (tok.length >= 2 && !DISH_STOP_WORDS[tok] && tokens.indexOf(tok) === -1) {
          tokens.push(tok);
        }
      });
    });
    return tokens;
  }

  function computeSimilarityEntry(target, candidate) {
    let score = 0;
    const reasons = [];

    if (target.category && candidate.category === target.category) {
      score += 40;
      reasons.push('Cùng loại: ' + candidate.category);
    }

    const tTokens = extractDishTokens(target);
    const cTokens = extractDishTokens(candidate);
    let sharedDishCount = 0;
    tTokens.forEach((tok) => {
      if (cTokens.indexOf(tok) !== -1) sharedDishCount++;
    });
    if (sharedDishCount > 0) {
      score += Math.min(24, sharedDishCount * 8);
      if (reasons.length < 3) reasons.push('Món tương đồng');
    }

    if (target.district && candidate.district === target.district) {
      score += 20;
      reasons.push('Cùng quận ' + candidate.district);
    }

    const tPriceIdx = PRICE_TIER_ORDER.indexOf(target.priceTier);
    const cPriceIdx = PRICE_TIER_ORDER.indexOf(candidate.priceTier);
    if (tPriceIdx !== -1 && cPriceIdx !== -1) {
      const diff = Math.abs(tPriceIdx - cPriceIdx);
      if (diff === 0) {
        score += 16;
        reasons.push('Cùng tầm giá');
      } else if (diff === 1) {
        score += 8;
      }
    }

    const tOcc = Array.isArray(target.occasions) ? target.occasions : [];
    const cOcc = Array.isArray(candidate.occasions) ? candidate.occasions : [];
    let sharedOcc = 0;
    tOcc.forEach((o) => {
      if (cOcc.indexOf(o) !== -1) sharedOcc++;
    });
    if (sharedOcc > 0) {
      score += Math.min(18, sharedOcc * 6);
    }

    const tPpl = Array.isArray(target.peopleCategory) ? target.peopleCategory : [];
    const cPpl = Array.isArray(candidate.peopleCategory) ? candidate.peopleCategory : [];
    let sharedPpl = 0;
    tPpl.forEach((p) => {
      if (cPpl.indexOf(p) !== -1) sharedPpl++;
    });
    if (sharedPpl > 0) {
      score += Math.min(8, sharedPpl * 4);
    }

    const rating = Number(candidate.rating) || 0;
    const reviews = Number(candidate.reviews) || 0;
    score += rating * 3 + Math.min(5, Math.log10(reviews + 1) * 1.5);

    if (reasons.length === 0 && candidate.district) {
      reasons.push('Quận ' + candidate.district);
    }

    return {
      restaurant: candidate,
      score: Math.round(score),
      reasons: reasons.slice(0, 3)
    };
  }

  function findSimilarOpenRestaurants(targetRestaurant, options) {
    const opts = options || {};
    const allData = (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) ? RESTAURANTS_DATA : [];
    const target = (typeof targetRestaurant === 'number' || typeof targetRestaurant === 'string')
      ? allData.find((r) => r.id === Number(targetRestaurant))
      : targetRestaurant;

    const ctx = getSelectedTimeContext();
    const targetMinutes = (typeof opts.targetMinutes === 'number' && !isNaN(opts.targetMinutes))
      ? ((Math.floor(opts.targetMinutes) % 1440) + 1440) % 1440
      : ctx.minutes;
    const targetDayOfWeek = (typeof opts.targetDayOfWeek === 'number' && !isNaN(opts.targetDayOfWeek))
      ? Math.floor(opts.targetDayOfWeek)
      : ctx.dayOfWeek;
    const checkedTimeLabel = opts.timeLabel || formatMinutesToHHMM(targetMinutes);
    const limit = (typeof opts.limit === 'number' && opts.limit > 0) ? Math.floor(opts.limit) : 6;
    const requireReservable = Boolean(opts.requireReservable);
    const fs = opts.filterState ? Object.assign({}, getFilterStateSnapshot(), opts.filterState) : getFilterStateSnapshot();
    const filtersActive = hasActiveFilters(fs);
    const activeFilterSummary = getActiveFilterSummary(fs);

    if (!target) {
      return {
        items: [],
        matchedActiveFilters: !filtersActive,
        hasActiveFilters: filtersActive,
        activeFilterSummary,
        checkedTimeLabel,
        relaxedReason: ''
      };
    }

    // Hard invariant pool: never target itself, MUST be open at targetMinutes/day, and reservable if requested
    const baseOpenPool = allData.filter((item) => {
      if (!item || item.id === target.id) return false;
      if (!isOpenAtMinutes(item, targetMinutes, targetDayOfWeek)) return false;
      if (requireReservable && (!window.HNOrderBooking || !window.HNOrderBooking.canReserve(item))) return false;
      return true;
    });

    let candidatePool = [];
    let matchedActiveFilters = true;
    let relaxedReason = '';

    if (!filtersActive) {
      candidatePool = baseOpenPool;
    } else {
      candidatePool = baseOpenPool.filter((item) => itemMatchesFilterFacets(item, fs, {}));

      // Smart-ignore target-name search if user searched specifically for the closed restaurant
      if (candidatePool.length === 0 && fs.search && String(fs.search).trim()) {
        const normSearch = normalizeVi(fs.search);
        const normTargetName = normalizeVi(target.name);
        const normTargetSub = normalizeVi(target.subname);
        const searchTokens = normSearch.split(/\s+/).filter(Boolean);
        const targetMatchesTokens = searchTokens.length > 0 && searchTokens.every((t) => normTargetName.includes(t) || normTargetSub.includes(t));
        if (itemMatchesSearch(target, fs.search) || targetMatchesTokens) {
          const withoutTargetSearch = baseOpenPool.filter((item) => itemMatchesFilterFacets(item, fs, { ignoreSearch: true }));
          if (withoutTargetSearch.length > 0) {
            candidatePool = withoutTargetSearch;
            const otherActive = hasActiveFilters(Object.assign({}, fs, { search: '' }));
            if (otherActive) {
              matchedActiveFilters = true;
            }
          }
        }
      }

      if (candidatePool.length === 0) {
        matchedActiveFilters = false;
        const stages = [
          { opts: { ignoreSearch: true, ignoreOccasion: true, ignorePeople: true }, note: 'dịp ăn & số người' },
          { opts: { ignoreSearch: true, ignoreOccasion: true, ignorePeople: true, ignorePrice: true }, note: 'mức giá, dịp ăn & số người' },
          { opts: { ignoreSearch: true, ignoreOccasion: true, ignorePeople: true, ignorePrice: true, ignoreDistrict: true }, note: 'quận & tiêu chí phụ' },
          { opts: { ignoreSearch: true, ignoreOccasion: true, ignorePeople: true, ignorePrice: true, ignoreDistrict: true, ignoreQuick: true }, note: 'toàn bộ bộ lọc để giữ quán đang mở' }
        ];
        for (let sIdx = 0; sIdx < stages.length; sIdx++) {
          const fallbackPool = baseOpenPool.filter((item) => itemMatchesFilterFacets(item, fs, stages[sIdx].opts));
          if (fallbackPool.length > 0) {
            candidatePool = fallbackPool;
            relaxedReason = 'Không có quán đang mở lúc ' + checkedTimeLabel + ' khớp toàn bộ (' + activeFilterSummary + '), đã nới lỏng ' + stages[sIdx].note + '.';
            break;
          }
        }
      }
    }

    const ranked = candidatePool
      .map((item) => computeSimilarityEntry(target, item))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const rDiff = (Number(b.restaurant.rating) || 0) - (Number(a.restaurant.rating) || 0);
        if (rDiff !== 0) return rDiff;
        return (Number(b.restaurant.reviews) || 0) - (Number(a.restaurant.reviews) || 0);
      })
      .slice(0, limit);

    return {
      items: ranked,
      matchedActiveFilters,
      hasActiveFilters: filtersActive,
      activeFilterSummary,
      checkedTimeLabel,
      relaxedReason
    };
  }

  window.HNRestaurantHours = {
    parseOpeningHours: parseOpeningHours,
    parseTimeStringToMinutes: parseTimeStringToMinutes,
    formatMinutesToHHMM: formatMinutesToHHMM,
    isOpenAtMinutes: isOpenAtMinutes,
    isOpenAtTimeString: isOpenAtTimeString,
    getSelectedTimeContext: getSelectedTimeContext,
    findSimilarOpenRestaurants: findSimilarOpenRestaurants
  };

  window.HNFilterState = {
    getState: getFilterStateSnapshot,
    hasActiveFilters: hasActiveFilters,
    getActiveFilterSummary: getActiveFilterSummary
  };

  // --- SOUND SYNTHESIZER (Web Audio API) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTickSound(frequency = 580) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      // Audio fallback silent
    }
  }

  function playWinSound() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.1;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.45);
      });
    } catch (e) {
      // Silent
    }
  }

  // --- LOCAL STORAGE ---
  function loadStoredFavorites() {
    try {
      const stored = localStorage.getItem('hanoi_phovi_favorites');
      if (stored) {
        const arr = JSON.parse(stored);
        state.favorites = new Set(arr);
      }
      const soundPref = localStorage.getItem('hanoi_phovi_sound');
      if (soundPref !== null) {
        state.soundEnabled = soundPref === 'true';
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    dataVersion++;
    invalidateFilterCache();
    updateFavoritesBadge();
    updateSoundButtonUI();
  }
  window.reloadFavoritesFromStorage = function () { loadStoredFavorites(); renderRestaurants(); };

  function saveFavorites() {
    try {
      localStorage.setItem('hanoi_phovi_favorites', JSON.stringify([...state.favorites]));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    updateFavoritesBadge();
  }

  function toggleFavorite(id) {
    const isFav = state.favorites.has(id);
    if (isFav) {
      state.favorites.delete(id);
      showToast(i18nText('toast_fav_removed', 'Đã bỏ quán khỏi Sổ tay quán quen'));
    } else {
      state.favorites.add(id);
      showToast(i18nText('toast_fav_added', '❤️ Đã lưu vào Sổ tay quán quen!'));
    }
    dataVersion++;
    invalidateFilterCache();
    saveFavorites();
    renderRestaurants();
  }

  function updateFavoritesBadge() {
    const countEl = document.getElementById('favCountBadge');
    if (countEl) {
      countEl.textContent = state.favorites.size;
    }
  }

  function updateSoundButtonUI() {
    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
      btn.innerHTML = state.soundEnabled 
        ? '<span>🔔</span> <span>Âm thanh: Bật</span>'
        : '<span>🔕</span> <span>Âm thanh: Tắt</span>';
    }
  }

  // --- TOAST NOTIFICATION ---
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toastNotice');
    if (!toast) return;
    toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // --- NORMALIZE VIETNAMESE SEARCH ---
  function normalizeVi(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .trim();
  }

  // --- FILTER & SEARCH ---
  function getFilteredRestaurants() {
    const rawQuery = state.search.trim().toLowerCase();
    const normQuery = normalizeVi(state.search);
    const timeCtx = getSelectedTimeContext();
    const cacheKey = JSON.stringify({
      search: rawQuery,
      priceTier: state.priceTier,
      peopleCategory: state.peopleCategory,
      district: state.district,
      occasion: state.occasion,
      quickFilter: state.quickFilter,
      sortBy: state.sortBy,
      dataVersion: dataVersion,
      targetMin: timeCtx.minutes,
      targetDay: timeCtx.dayOfWeek
    });

    if (filterCache[cacheKey]) {
      return filterCache[cacheKey].slice();
    }

    const result = RESTAURANTS_DATA.filter((item) => {
      const badges = Array.isArray(item.specialBadges) ? item.specialBadges : [];
      const dishes = Array.isArray(item.signatureDishes) ? item.signatureDishes : [];
      const peopleCats = Array.isArray(item.peopleCategory) ? item.peopleCategory : [];
      const occasions = Array.isArray(item.occasions) ? item.occasions : [];

      // Search query (accent-insensitive Vietnamese + raw match + category)
      if (rawQuery) {
        const matchField = (val) => {
          const s = String(val || '');
          return s.toLowerCase().includes(rawQuery) || (normQuery && normalizeVi(s).includes(normQuery));
        };
        const matchName = matchField(item.name);
        const matchSub = matchField(item.subname);
        const matchCat = matchField(item.category);
        const matchDistrict = matchField(item.district);
        const matchAddress = matchField(item.address);
        const matchDish = dishes.some(matchField);
        const matchBadge = badges.some(matchField);
        if (!matchName && !matchSub && !matchCat && !matchDistrict && !matchAddress && !matchDish && !matchBadge) {
          return false;
        }
      }

      // Price Tier
      if (state.priceTier !== 'all' && item.priceTier !== state.priceTier) {
        return false;
      }

      // People category
      if (state.peopleCategory !== 'all') {
        if (!peopleCats.includes(state.peopleCategory)) {
          return false;
        }
      }

      // District
      if (state.district !== 'all' && item.district !== state.district) {
        return false;
      }

      // Occasion
      if (state.occasion !== 'all') {
        if (!occasions.includes(state.occasion)) {
          return false;
        }
      }

      // Quick filter
      if (state.quickFilter === 'open_now' && timeCtx) {
        if (!isOpenAtMinutes(item, timeCtx.minutes, timeCtx.dayOfWeek)) return false;
      } else if (state.quickFilter === 'michelin') {
        const isMichelin = badges.some(b => String(b).toLowerCase().includes('michelin'));
        if (!isMichelin) return false;
      } else if (state.quickFilter === 'hadong') {
        if (item.district !== 'Hà Đông') return false;
      } else if (state.quickFilter === 'reservable') {
        if (!window.HNOrderBooking || !window.HNOrderBooking.canReserve(item)) return false;
      } else if (state.quickFilter === 'favorites') {
        if (!state.favorites.has(item.id)) return false;
      }

      return true;
    }).sort((a, b) => {
      const rA = Number(a.rating) || 0;
      const rB = Number(b.rating) || 0;
      const revA = Number(a.reviews) || 0;
      const revB = Number(b.reviews) || 0;
      const pA = Number(a.priceAvg) || 0;
      const pB = Number(b.priceAvg) || 0;

      switch (state.sortBy) {
        case 'rating_desc':
          return (rB - rA) || (revB - revA);
        case 'reviews_desc':
          return (revB - revA) || (rB - rA);
        case 'price_asc':
          return pA - pB;
        case 'price_desc':
          return pB - pA;
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '', 'vi');
        default:
          return 0;
      }
    });

    if (filterCacheOrder.length >= FILTER_CACHE_MAX) {
      const oldestKey = filterCacheOrder.shift();
      if (oldestKey !== undefined) delete filterCache[oldestKey];
    }
    filterCacheOrder.push(cacheKey);
    filterCache[cacheKey] = result;
    return result.slice();
  }

  // --- RENDER RESTAURANTS WITH PAGINATION ---
  function renderRestaurants() {
    const container = document.getElementById('restaurantsGrid');
    const counterEl = document.getElementById('resultsCount');
    const paginationContainer = document.getElementById('paginationContainer');
    if (!container) return;

    // Luôn cập nhật thanh tab quận phân tầng
    renderDistrictTabs();

    const filtered = getFilteredRestaurants();
    const totalItems = filtered.length;

    if (totalItems === 0) {
      if (counterEl) {
        counterEl.innerHTML = i18nText('results_empty', 'Không tìm thấy quán ăn phù hợp');
      }
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🥢</div>
          <h3>${escapeHtml(i18nText('results_empty', 'Không tìm thấy quán ăn phù hợp'))}</h3>
          <p>${escapeHtml(i18nText('results_empty_sub', 'Hãy thử giảm bớt các điều kiện lọc hoặc xóa từ khóa tìm kiếm để khám phá thêm nhiều quán ngon khác bạn nhé.'))}</p>
          <button class="btn-spin-wheel" id="btnResetFiltersEmpty">
            <span>↺</span> ${escapeHtml(i18nText('reset_filters', 'Xóa tất cả bộ lọc'))}
          </button>
        </div>
      `;
      if (paginationContainer) paginationContainer.innerHTML = '';
      document.getElementById('btnResetFiltersEmpty')?.addEventListener('click', resetAllFilters);
      updateClawPool();
      window.dispatchEvent(new CustomEvent('hn-filters-changed', { detail: { state: getFilterStateSnapshot(), count: 0 } }));
      return;
    }

    // Tính toán phân trang
    const isAll = state.pageSize === 'all';
    const itemsPerPage = isAll ? totalItems : parseInt(state.pageSize, 10);
    const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / itemsPerPage));

    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }
    if (state.currentPage < 1) {
      state.currentPage = 1;
    }

    const startIndex = isAll ? 0 : (state.currentPage - 1) * itemsPerPage;
    const endIndex = isAll ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);
    const pageItems = filtered.slice(startIndex, endIndex);

    if (counterEl) {
      if (isAll) {
        counterEl.innerHTML = `Hiển thị tất cả <span>${totalItems}</span> quán ăn chuẩn vị`;
      } else {
        counterEl.innerHTML = `Hiển thị <span>${startIndex + 1} - ${endIndex}</span> / ${totalItems} quán (Trang ${state.currentPage} / ${totalPages})`;
      }
    }

    const timeCtx = getSelectedTimeContext();

    // Render cards cho trang hiện tại
    container.innerHTML = pageItems.map((item) => {
      const isFav = state.favorites.has(item.id);
      const badges = Array.isArray(item.specialBadges) ? item.specialBadges : [];
      const dishes = Array.isArray(item.signatureDishes) ? item.signatureDishes : [];
      const isMichelin = badges.some(b => String(b).toLowerCase().includes('michelin'));
      const isReservable = window.HNOrderBooking ? window.HNOrderBooking.canReserve(item) : false;
      const reviewsCount = Number(item.reviews) || 120;
      const peopleRange = item.peopleRange || '1 - 6 người';
      const openingHours = item.openingHours || item.openHours || '07:00 - 22:00';
      const isOpenNow = isOpenAtMinutes(item, timeCtx.minutes, timeCtx.dayOfWeek);
      const openBadgeHtml = `<div class="card-open-status ${isOpenNow ? 'is-open' : 'is-closed'}">${isOpenNow ? i18nText('status_open_at', '🟢 Đang mở lúc ') : i18nText('status_closed_at', '🔴 Đóng cửa lúc ')}${escapeHtml(timeCtx.timeLabel)}</div>`;
      const description = item.description || item.subname || '';
      const tips = item.tips || ('Mở cửa khung giờ ' + openingHours + '.');
      const mapsUrl = item.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((item.name || '') + ' ' + (item.address || '')));
      
      const dishesHtml = dishes
        .slice(0, 3)
        .map(dish => `<span class="dish-chip">🥢 ${escapeHtml(dish)}</span>`)
        .join('');

      return `
        <article class="restaurant-card" data-id="${item.id}">
          <div class="card-media">
            <img 
              src="${item.image}" 
              alt="${escapeHtml(item.name)}" 
              class="card-image" 
              loading="lazy"
              onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'"
            />
            
            <div class="card-badges-top">
              <span class="badge-tag rating">★ ${item.rating} (${reviewsCount.toLocaleString()} đánh giá)</span>
              ${isMichelin ? '<span class="badge-tag michelin">🎖️ Michelin</span>' : ''}
              ${isReservable ? '<span class="badge-tag reservable">🪑 Đặt bàn</span>' : ''}
              <span class="badge-tag">🏮 ${escapeHtml(item.district)}</span>
            </div>

            <button 
              class="btn-card-fav ${isFav ? 'favorited' : ''}" 
              data-id="${item.id}"
              title="${isFav ? 'Bỏ lưu' : 'Lưu vào sổ tay'}"
              aria-label="Yêu thích quán"
            >
              ${isFav ? '❤️' : '🤍'}
            </button>
          </div>

          <div class="card-body">
            <div class="card-header-meta">
              <span>${escapeHtml(i18nCategory(item.category || 'Ẩm thực Hà Nội'))}</span>
              <span>👥 ${escapeHtml(peopleRange)}</span>
            </div>

            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <p class="card-subname clamped" id="subname-${item.id}">${escapeHtml(item.subname)}</p>

            <!-- Khối mô tả mở rộng đầy đủ không giới hạn ngay trên thẻ -->
            <div class="card-desc-full" id="desc-${item.id}">
              <p style="margin-bottom: 6px;">${escapeHtml(description)}</p>
              <div class="card-desc-tips">
                <strong>💡 Mẹo sành ăn:</strong> ${escapeHtml(tips)}
              </div>
            </div>

            <button class="btn-toggle-desc" data-action="toggle-desc" data-id="${item.id}" title="Đọc toàn bộ mô tả quán">
              <span>📖 Đọc thêm mô tả quán</span> <span>▾</span>
            </button>

            <div class="dishes-preview">
              ${dishesHtml}
            </div>

            <div class="card-info-rows">
              <div class="info-row">
                <span class="row-icon">💰</span>
                <span>Giá: <strong class="price-text">${escapeHtml(item.priceRange)}</strong></span>
              </div>
              <div class="info-row">
                <span class="row-icon">📍</span>
                <span title="${escapeHtml(item.address)}">${escapeHtml(item.address)}</span>
              </div>
              <div class="info-row">
                <span class="row-icon">⏰</span>
                <span>${escapeHtml(openingHours)}</span>
              </div>
              ${openBadgeHtml}
            </div>

            <div class="card-actions">
              <button class="btn-card-details" data-action="detail" data-id="${item.id}">
                <span>📖</span> ${escapeHtml(i18nText('card_details_btn', 'Chi tiết & Mẹo'))}
              </button>
              <a 
                href="${mapsUrl}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="btn-card-maps"
                data-action="maps"
                title="Mở Google Maps chỉ đường"
              >
                <span>🧭</span> Google Maps
              </a>
            </div>
            <div class="card-actions-order ${isReservable ? 'two-cols' : 'one-col'}">
              <button class="btn-card-delivery" data-action="delivery" data-id="${item.id}" title="Đặt món giao tận nơi như ShopeeFood">
                <span>🛵</span> ${escapeHtml(i18nText('card_delivery_btn', 'Đặt giao tận nơi'))}
              </button>
              ${isReservable ? `
              <button class="btn-card-reserve" data-action="reserve" data-id="${item.id}" title="Đặt bàn trước tại nhà hàng">
                <span>🪑</span> ${escapeHtml(i18nText('card_reserve_btn', 'Đặt bàn trước'))}
              </button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach card event listeners
    attachCardListeners();

    // Render pagination controls
    renderPagination(totalItems, totalPages, startIndex, endIndex);
    updateClawPool();
    window.dispatchEvent(new CustomEvent('hn-filters-changed', { detail: { state: getFilterStateSnapshot(), count: totalItems } }));
  }

  // --- RENDER PAGINATION UI ---
  function renderPagination(totalItems, totalPages, startIndex, endIndex) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;

    if (totalPages <= 1 && state.pageSize === 'all') {
      container.innerHTML = `
        <div class="pagination-top-row">
          <div class="pagination-status">
            Đang hiển thị toàn bộ <strong>${totalItems}</strong> quán ăn
          </div>
          <div class="page-size-selector">
            <label for="pageSizeSelect">Chia nhỏ trang:</label>
            <select id="pageSizeSelect" class="page-size-select">
              <option value="9">9 quán / trang (Gọn nhẹ 3x3)</option>
              <option value="12">12 quán / trang</option>
              <option value="18">18 quán / trang</option>
              <option value="24">24 quán / trang</option>
              <option value="all" selected>Tất cả</option>
            </select>
          </div>
        </div>
      `;
      document.getElementById('pageSizeSelect')?.addEventListener('change', onPageSizeChange);
      return;
    }

    // Tạo danh sách các nút số trang thông minh (hỗ trợ cả nhảy trang nhanh khi bấm '...')
    const current = state.currentPage;
    let pageItemsSpec = [];

    if (totalPages <= 9) {
      for (let i = 1; i <= totalPages; i++) {
        pageItemsSpec.push({ type: 'page', page: i });
      }
    } else {
      if (current <= 5) {
        for (let i = 1; i <= 6; i++) pageItemsSpec.push({ type: 'page', page: i });
        pageItemsSpec.push({ type: 'ellipsis', target: Math.min(totalPages, 10), label: '...', title: 'Nhảy tới trang ' + Math.min(totalPages, 10) });
        pageItemsSpec.push({ type: 'page', page: totalPages });
      } else if (current >= totalPages - 4) {
        pageItemsSpec.push({ type: 'page', page: 1 });
        pageItemsSpec.push({ type: 'ellipsis', target: Math.max(1, totalPages - 9), label: '...', title: 'Lùi về trang ' + Math.max(1, totalPages - 9) });
        for (let i = totalPages - 5; i <= totalPages; i++) pageItemsSpec.push({ type: 'page', page: i });
      } else {
        pageItemsSpec.push({ type: 'page', page: 1 });
        pageItemsSpec.push({ type: 'ellipsis', target: Math.max(1, current - 5), label: '...', title: 'Lùi 5 trang (Trang ' + Math.max(1, current - 5) + ')' });
        for (let i = current - 2; i <= current + 2; i++) {
          pageItemsSpec.push({ type: 'page', page: i });
        }
        pageItemsSpec.push({ type: 'ellipsis', target: Math.min(totalPages, current + 5), label: '...', title: 'Tiến 5 trang (Trang ' + Math.min(totalPages, current + 5) + ')' });
        pageItemsSpec.push({ type: 'page', page: totalPages });
      }
    }

    const pageButtonsHtml = pageItemsSpec.map((entry) => {
      if (entry.type === 'ellipsis') {
        return `
          <button type="button" class="page-btn page-ellipsis-btn" data-page="${entry.target}" title="${entry.title}">
            ${entry.label}
          </button>
        `;
      }
      const p = entry.page;
      return `
        <button type="button" class="page-btn ${p === current ? 'active' : ''}" data-page="${p}" title="Trang ${p}">
          ${p}
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="pagination-top-row">
        <div class="pagination-status">
          Đang xem quán <strong>${startIndex + 1} - ${endIndex}</strong> / <strong>${totalItems}</strong> quán 
          (Trang <strong>${current}</strong> / <strong>${totalPages}</strong>)
        </div>
        <div class="page-size-selector">
          <label for="pageSizeSelect">Số quán hiển thị:</label>
          <select id="pageSizeSelect" class="page-size-select">
            <option value="9" ${state.pageSize == 9 ? 'selected' : ''}>9 quán / trang (Gọn nhẹ 3x3)</option>
            <option value="12" ${state.pageSize == 12 ? 'selected' : ''}>12 quán / trang</option>
            <option value="18" ${state.pageSize == 18 ? 'selected' : ''}>18 quán / trang</option>
            <option value="24" ${state.pageSize == 24 ? 'selected' : ''}>24 quán / trang</option>
            <option value="all" ${state.pageSize === 'all' ? 'selected' : ''}>Xem tất cả</option>
          </select>
        </div>
      </div>

      <div class="pagination-controls">
        <button type="button" class="page-btn" id="btnPageFirst" data-page="1" ${current === 1 ? 'disabled' : ''} title="Trang đầu">
          « Đầu
        </button>
        <button type="button" class="page-btn" id="btnPagePrev" data-page="${Math.max(1, current - 1)}" ${current === 1 ? 'disabled' : ''} title="Trang trước">
          ‹ Trước
        </button>

        ${pageButtonsHtml}

        <button type="button" class="page-btn" id="btnPageNext" data-page="${Math.min(totalPages, current + 1)}" ${current === totalPages ? 'disabled' : ''} title="Trang sau">
          Sau ›
        </button>
        <button type="button" class="page-btn" id="btnPageLast" data-page="${totalPages}" ${current === totalPages ? 'disabled' : ''} title="Trang cuối">
          Cuối »
        </button>
      </div>

      <div class="pagination-jump-row">
        <span>Chuyển nhanh đến trang:</span>
        <input type="number" id="pageJumpInput" class="page-jump-input" min="1" max="${totalPages}" value="${current}" />
        <button type="button" id="btnJumpPage" class="btn-jump-page">Đi tới</button>
      </div>
    `;

    // Attach listeners
    container.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const p = parseInt(btn.dataset.page, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages && p !== state.currentPage) {
          goToPage(p);
        }
      });
    });

    document.getElementById('pageSizeSelect')?.addEventListener('change', onPageSizeChange);

    document.getElementById('btnJumpPage')?.addEventListener('click', () => {
      const input = document.getElementById('pageJumpInput');
      if (input) {
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 1 && val <= totalPages) {
          goToPage(val);
        } else {
          showToast(`Vui lòng nhập từ trang 1 đến ${totalPages}`);
        }
      }
    });

    document.getElementById('pageJumpInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnJumpPage')?.click();
      }
    });
  }

  function goToPage(page) {
    state.currentPage = page;
    renderRestaurants();
    playTickSound(520);
    // Cuộn mượt về đầu danh sách quán để khách không phải lướt sâu
    document.getElementById('resultsHeader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onPageSizeChange(e) {
    state.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderRestaurants();
    playTickSound(500);
    showToast(`Đã đổi chế độ hiển thị: ${e.target.value === 'all' ? 'Xem tất cả' : e.target.value + ' quán/trang'}`);
  }

  // --- RENDER DISTRICT TABS ---
  function renderDistrictTabs() {
    const tabsContainer = document.getElementById('districtTabs');
    if (!tabsContainer) return;

    // Tính số lượng quán thực tế theo từng quận
    const counts = {};
    RESTAURANTS_DATA.forEach((r) => {
      counts[r.district] = (counts[r.district] || 0) + 1;
    });

    const districtList = [
      { key: 'all', label: 'Tất cả', icon: '🏮', count: RESTAURANTS_DATA.length },
      { key: 'Hà Đông', label: 'Hà Đông', icon: '🏘️', count: counts['Hà Đông'] || 0 },
      { key: 'Hoàn Kiếm', label: 'Hoàn Kiếm', icon: '🏮', count: counts['Hoàn Kiếm'] || 0 },
      { key: 'Ba Đình', label: 'Ba Đình', icon: '🏛️', count: counts['Ba Đình'] || 0 },
      { key: 'Cầu Giấy', label: 'Cầu Giấy', icon: '🏢', count: counts['Cầu Giấy'] || 0 },
      { key: 'Đống Đa', label: 'Đống Đa', icon: '📜', count: counts['Đống Đa'] || 0 },
      { key: 'Thanh Xuân', label: 'Thanh Xuân', icon: '🛣️', count: counts['Thanh Xuân'] || 0 },
      { key: 'Hai Bà Trưng', label: 'Hai Bà Trưng', icon: '🌳', count: counts['Hai Bà Trưng'] || 0 },
      { key: 'Tây Hồ', label: 'Tây Hồ', icon: '🌅', count: counts['Tây Hồ'] || 0 },
      { key: 'Nam Từ Liêm', label: 'Nam Từ Liêm', icon: '🏟️', count: counts['Nam Từ Liêm'] || 0 },
      { key: 'Bắc Từ Liêm', label: 'Bắc Từ Liêm', icon: '🌲', count: counts['Bắc Từ Liêm'] || 0 },
      { key: 'Long Biên', label: 'Long Biên', icon: '🌉', count: counts['Long Biên'] || 0 },
      { key: 'Hoàng Mai', label: 'Hoàng Mai', icon: '🏡', count: counts['Hoàng Mai'] || 0 }
    ];

    tabsContainer.innerHTML = districtList.map((d) => {
      const isActive = state.district === d.key;
      return `
        <button class="district-tab-btn ${isActive ? 'active' : ''}" data-district="${d.key}">
          <span>${d.icon}</span>
          <span>${d.label}</span>
          <span class="district-count-pill">${d.count}</span>
        </button>
      `;
    }).join('');

    // Attach listeners
    tabsContainer.querySelectorAll('.district-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const districtKey = btn.dataset.district;
        state.district = districtKey;
        state.currentPage = 1;

        // Đồng bộ với dropdown select
        const districtSelect = document.getElementById('districtSelect');
        if (districtSelect) districtSelect.value = districtKey;

        playTickSound(550);
        renderRestaurants();
        document.getElementById('resultsHeader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function attachCardListeners() {
    // Toggle full description on card
    document.querySelectorAll('.btn-toggle-desc').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const descEl = document.getElementById(`desc-${id}`);
        const subnameEl = document.getElementById(`subname-${id}`);
        if (descEl) {
          const isShowing = descEl.classList.toggle('show');
          if (subnameEl) subnameEl.classList.toggle('clamped', !isShowing);
          btn.innerHTML = isShowing 
            ? '<span>▴ Thu gọn mô tả</span>' 
            : '<span>📖 Đọc thêm mô tả quán</span> <span>▾</span>';
          playTickSound(550);
        }
      });
    });

    // Favorites button
    document.querySelectorAll('.btn-card-fav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        toggleFavorite(id);
      });
    });

    // Details button
    document.querySelectorAll('.btn-card-details').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        openDetailModal(id);
      });
    });

    // Delivery button
    document.querySelectorAll('.btn-card-delivery').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        if (window.HNOrderBooking) window.HNOrderBooking.openDelivery(id);
      });
    });

    // Reserve table button
    document.querySelectorAll('.btn-card-reserve').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        if (window.HNOrderBooking) window.HNOrderBooking.openReservation(id);
      });
    });

    // Clicking anywhere on card (except links/buttons) opens details
    document.querySelectorAll('.restaurant-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('.btn-card-fav') || e.target.closest('.btn-card-details') || e.target.closest('.btn-toggle-desc') || e.target.closest('.btn-card-delivery') || e.target.closest('.btn-card-reserve')) {
          return;
        }
        const id = parseInt(card.dataset.id, 10);
        openDetailModal(id);
      });
    });
  }

  // --- DETAIL MODAL ---
  function openDetailModal(id, overrideMinutes) {
    const restaurant = RESTAURANTS_DATA.find(r => r.id === id);
    if (!restaurant) return;

    const modal = document.getElementById('detailModal');
    if (!modal) return;

    const baseCtx = getSelectedTimeContext();
    const hasOverride = typeof overrideMinutes === 'number' && !isNaN(overrideMinutes);
    const targetMinutes = hasOverride
      ? ((Math.floor(overrideMinutes) % 1440) + 1440) % 1440
      : baseCtx.minutes;
    const targetDayOfWeek = baseCtx.dayOfWeek;
    const timeLabel = formatMinutesToHHMM(targetMinutes);
    const isOpenAtTarget = isOpenAtMinutes(restaurant, targetMinutes, targetDayOfWeek);

    const isFav = state.favorites.has(restaurant.id);
    const isReservable = window.HNOrderBooking ? window.HNOrderBooking.canReserve(restaurant) : false;
    const badges = Array.isArray(restaurant.specialBadges) ? restaurant.specialBadges : [];
    const dishes = Array.isArray(restaurant.signatureDishes) ? restaurant.signatureDishes : [];
    const occasions = Array.isArray(restaurant.occasions) ? restaurant.occasions : [];
    const reviewsCount = Number(restaurant.reviews) || 120;
    const peopleRange = restaurant.peopleRange || '1 - 6 người';
    const openingHours = restaurant.openingHours || restaurant.openHours || '07:00 - 22:00';
    const description = restaurant.description || restaurant.subname || '';
    const tips = restaurant.tips || ('Mở cửa khung giờ ' + openingHours + '.');
    const mapsUrl = restaurant.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((restaurant.name || '') + ' ' + (restaurant.address || '')));

    const timeCheckPresets = [
      { value: String(baseCtx.minutes), label: (baseCtx.mode === 'now' ? '🕒 Giờ hiện tại (' + baseCtx.timeLabel + ')' : '🕒 Giờ đang lọc (' + baseCtx.timeLabel + ')') },
      { value: '390', label: '06:30 (Sáng sớm)' },
      { value: '480', label: '08:00 (Ăn sáng)' },
      { value: '690', label: '11:30 (Ăn trưa)' },
      { value: '750', label: '12:30 (Giờ trưa)' },
      { value: '870', label: '14:30 (Buổi chiều)' },
      { value: '960', label: '16:00 (Quà chiều)' },
      { value: '1050', label: '17:30 (Đầu tối)' },
      { value: '1140', label: '19:00 (Bữa tối)' },
      { value: '1230', label: '20:30 (Buổi tối)' },
      { value: '1320', label: '22:00 (Tối muộn)' },
      { value: '1380', label: '23:00 (Ăn khuya)' },
      { value: '30', label: '00:30 (Đêm khuya)' },
      { value: '120', label: '02:00 (Rạng sáng)' }
    ];
    if (!timeCheckPresets.some(p => Number(p.value) === targetMinutes)) {
      timeCheckPresets.splice(1, 0, { value: String(targetMinutes), label: '⏰ ' + timeLabel + ' (Đang kiểm tra)' });
    }
    const timeOptionsHtml = timeCheckPresets.map(p => {
      const selected = Number(p.value) === targetMinutes ? 'selected' : '';
      return `<option value="${p.value}" ${selected}>${escapeHtml(p.label)}</option>`;
    }).join('');

    let closedAndSimilarHtml = '';
    if (!isOpenAtTarget) {
      const similarRes = findSimilarOpenRestaurants(restaurant, {
        targetMinutes,
        targetDayOfWeek,
        timeLabel,
        limit: 6
      });
      const filterNoteText = similarRes.hasActiveFilters
        ? (similarRes.matchedActiveFilters
            ? ('✓ Đang giữ đúng bộ lọc: ' + similarRes.activeFilterSummary)
            : (similarRes.relaxedReason || 'Đã mở rộng bộ lọc để tìm quán đang mở'))
        : ('Tất cả quán gợi ý dưới đây đều đang mở lúc ' + timeLabel);

      const similarCardsHtml = similarRes.items.length
        ? similarRes.items.map((entry) => {
            const s = entry.restaurant;
            const sReservable = window.HNOrderBooking ? window.HNOrderBooking.canReserve(s) : false;
            const sHours = s.openingHours || s.openHours || '07:00 - 22:00';
            const tagsHtml = entry.reasons
              .map(reason => `<span class="similar-open-tag">${escapeHtml(reason)}</span>`)
              .join('');
            return `
              <article class="similar-open-card" data-similar-id="${s.id}">
                <img
                  src="${s.image}"
                  alt="${escapeHtml(s.name)}"
                  class="similar-open-thumb"
                  loading="lazy"
                  onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'"
                />
                <div class="similar-open-body">
                  <div class="similar-open-title">${escapeHtml(s.name)}</div>
                  <div class="similar-open-meta">
                    <span>★ ${s.rating}</span>
                    <span>• ${escapeHtml(s.district)}</span>
                    <span>• ${escapeHtml(s.priceRange)}</span>
                    <span>• ⏰ ${escapeHtml(sHours)}</span>
                  </div>
                  <div class="similar-open-tags">
                    <span class="similar-open-tag">🟢 Đang mở lúc ${escapeHtml(timeLabel)}</span>
                    ${tagsHtml}
                  </div>
                  <div class="similar-open-actions">
                    <button type="button" class="btn-similar-view" data-similar-view="${s.id}">👁️ Xem quán</button>
                    <button type="button" class="btn-similar-order" data-similar-delivery="${s.id}">🛵 Đặt món</button>
                    ${sReservable ? `<button type="button" class="btn-similar-order" data-similar-reserve="${s.id}">🪑 Đặt bàn</button>` : ''}
                  </div>
                </div>
              </article>
            `;
          }).join('')
        : `<p style="font-size:0.86rem; color:var(--text-muted); margin:0;">Hiện chưa tìm thấy quán tương tự đang mở lúc ${escapeHtml(timeLabel)}. Hãy thử đổi sang khung giờ khác nhé.</p>`;

      closedAndSimilarHtml = `
        <div class="closed-alert-box" role="status">
          <div class="closed-alert-header">
            <span>🔴 Quán đang đóng cửa lúc ${escapeHtml(timeLabel)}</span>
          </div>
          <div class="closed-alert-sub">
            Khung giờ phục vụ của <strong>${escapeHtml(restaurant.name)}</strong> là <strong>${escapeHtml(openingHours)}</strong>.
            Gợi ý các quán tương tự đang mở cửa lúc ${escapeHtml(timeLabel)} bên dưới để bạn chọn nhanh:
          </div>
        </div>
        <section class="similar-open-section" aria-label="Quán tương tự đang mở cửa">
          <div class="similar-open-head">
            <h4>🟢 Quán Tương Tự Đang Mở Lúc ${escapeHtml(timeLabel)}</h4>
            <span class="similar-filter-note">${escapeHtml(filterNoteText)}</span>
          </div>
          <div class="similar-open-grid">
            ${similarCardsHtml}
          </div>
        </section>
      `;
    }

    const badgesHtml = badges
      .map(b => `<span class="badge-tag ${String(b).toLowerCase().includes('michelin') ? 'michelin' : ''}">✦ ${escapeHtml(b)}</span>`)
      .join('');

    const dishesListHtml = dishes
      .map(d => `<span class="dish-chip" style="font-size:0.85rem; padding: 5px 12px;">🥢 ${escapeHtml(d)}</span>`)
      .join('');

    const occasionsLabels = {
      breakfast: "Ăn sáng đầu ngày",
      quick_lunch: "Bữa trưa công sở",
      date: "Hẹn hò lãng mạn",
      friends: "Họp mặt bạn bè / Nhậu",
      family: "Sum họp gia đình",
      business: "Tiếp khách / Đối tác",
      night_snack: "Ăn đêm / Quà vặt phố"
    };

    const occasionsHtml = occasions
      .map(o => `<span class="pill-btn active" style="font-size:0.78rem;">✨ ${occasionsLabels[o] || o}</span>`)
      .join(' ');

    const container = modal.querySelector('.modal-container');
    container.innerHTML = `
      <button class="modal-close-btn" id="btnCloseDetailModal" aria-label="Đóng">&times;</button>
      
      <div class="detail-hero-media">
        <img 
          src="${restaurant.image}" 
          alt="${escapeHtml(restaurant.name)}" 
          onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'"
        />
        <div class="detail-hero-overlay">
          <div class="detail-hero-badges">
            <span class="badge-tag rating">★ ${restaurant.rating} (${reviewsCount.toLocaleString()} đánh giá trên Google Maps)</span>
            ${badgesHtml}
          </div>
          <h2 class="detail-title">${escapeHtml(restaurant.name)}</h2>
          <p class="detail-subtitle">${escapeHtml(restaurant.subname)}</p>
        </div>
      </div>

      <div class="detail-content-body">
        <div class="detail-time-check-bar">
          <span class="detail-open-status ${isOpenAtTarget ? 'is-open' : 'is-closed'}">
            ${isOpenAtTarget ? '🟢 Đang mở lúc ' : '🔴 Đóng cửa lúc '}${escapeHtml(timeLabel)}
          </span>
          <label for="detailCheckTimeSelect" style="display:flex; align-items:center; gap:8px; font-weight:600;">
            <span>🕒 Kiểm tra giờ khác:</span>
            <select id="detailCheckTimeSelect" class="detail-time-select">
              ${timeOptionsHtml}
            </select>
          </label>
        </div>

        ${closedAndSimilarHtml}

        <div class="detail-meta-grid">
          <div class="detail-meta-item">
            <span style="font-size: 1.3rem;">💰</span>
            <div>
              <strong>Mức giá tham khảo</strong>
              <span class="price-text" style="font-size: 1rem;">${escapeHtml(restaurant.priceRange)}</span>
            </div>
          </div>
          <div class="detail-meta-item">
            <span style="font-size: 1.3rem;">👥</span>
            <div>
              <strong>Quy mô khách phù hợp</strong>
              <span>${escapeHtml(peopleRange)}</span>
            </div>
          </div>
          <div class="detail-meta-item">
            <span style="font-size: 1.3rem;">⏰</span>
            <div>
              <strong>Giờ mở cửa phục vụ</strong>
              <span>${escapeHtml(openingHours)}</span>
            </div>
          </div>
          <div class="detail-meta-item">
            <span style="font-size: 1.3rem;">🏮</span>
            <div>
              <strong>Khu vực địa chỉ</strong>
              <span>Quận ${escapeHtml(restaurant.district)}</span>
            </div>
          </div>
        </div>
        <div id="detailBusyHoursMount" data-place-id="${restaurant.id}"></div>

        <h3 class="detail-section-title">
          <span>🥢</span> Món Đinh Chuẩn Vị Phải Thử
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
          ${dishesListHtml}
        </div>

        <h3 class="detail-section-title">
          <span>📜</span> Giới Thiệu & Không Gian
        </h3>
        <p class="detail-description">${escapeHtml(description)}</p>

        <h3 class="detail-section-title">
          <span>💡</span> Mẹo Cho Thực Khách (Tips từ người sành ăn)
        </h3>
        <div class="detail-tips-box">
          ${escapeHtml(tips)}
        </div>

        <h3 class="detail-section-title">
          <span>🎉</span> Phù Hợp Với Dịp
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 22px;">
          ${occasionsHtml}
        </div>

        <div id="detailReviewsMount" data-place-id="${restaurant.id}"></div>
        <div class="detail-address-box">
          <div>
            <strong style="display:block; margin-bottom: 2px;">📍 Vị trí trên Google Maps:</strong>
            <span style="color: var(--text-muted); font-size: 0.9rem;" id="modalAddressText">${escapeHtml(restaurant.address)}</span>
          </div>
          <button class="btn-copy-address" id="btnCopyAddress">
            📋 Sao chép địa chỉ
          </button>
        </div>

        <div id="detailEngageActionsMount" class="detail-engage-actions" data-place-id="${restaurant.id}"></div>
        <div class="detail-footer-actions">
          <button class="btn-favorites" id="btnModalToggleFav">
            ${isFav ? '❤️ Đã lưu vào sổ tay' : '🤍 Lưu vào sổ tay'}
          </button>
          <button class="btn-card-delivery detail-order-btn" id="btnModalDelivery">
            🛵 Đặt giao tận nơi
          </button>
          ${isReservable ? `
          <button class="btn-card-reserve detail-order-btn" id="btnModalReserve">
            🪑 Đặt bàn trước
          </button>` : ''}
          <a 
            href="${mapsUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn-spin-wheel"
            style="padding: 12px 24px; font-size: 0.95rem;"
          >
            🧭 Dẫn đường qua Google Maps
          </a>
        </div>
      </div>
    `;

    modal.classList.add('open');
    playTickSound(650);

    // Modal Events
    document.getElementById('btnCloseDetailModal')?.addEventListener('click', closeDetailModal);
    document.getElementById('detailCheckTimeSelect')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        playTickSound(540);
        openDetailModal(restaurant.id, val);
      }
    });

    container.querySelectorAll('[data-similar-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = parseInt(btn.getAttribute('data-similar-view'), 10);
        if (!isNaN(sid)) openDetailModal(sid, targetMinutes);
      });
    });

    container.querySelectorAll('[data-similar-delivery]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = parseInt(btn.getAttribute('data-similar-delivery'), 10);
        if (!isNaN(sid)) {
          closeDetailModal();
          if (window.HNOrderBooking) window.HNOrderBooking.openDelivery(sid);
        }
      });
    });

    container.querySelectorAll('[data-similar-reserve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = parseInt(btn.getAttribute('data-similar-reserve'), 10);
        if (!isNaN(sid)) {
          closeDetailModal();
          if (window.HNOrderBooking) window.HNOrderBooking.openReservation(sid);
        }
      });
    });

    document.getElementById('btnCopyAddress')?.addEventListener('click', () => {
      navigator.clipboard.writeText(restaurant.address).then(() => {
        showToast('Đã sao chép địa chỉ quán vào khay nhớ tạm!');
      }).catch(() => {
        showToast('Địa chỉ: ' + restaurant.address);
      });
    });

    document.getElementById('btnModalToggleFav')?.addEventListener('click', () => {
      toggleFavorite(restaurant.id);
      openDetailModal(restaurant.id, hasOverride ? targetMinutes : undefined); // re-render modal fav state
    });

    document.getElementById('btnModalDelivery')?.addEventListener('click', () => {
      closeDetailModal();
      if (window.HNOrderBooking) window.HNOrderBooking.openDelivery(restaurant.id);
    });

    document.getElementById('btnModalReserve')?.addEventListener('click', () => {
      closeDetailModal();
      if (window.HNOrderBooking) window.HNOrderBooking.openReservation(restaurant.id);
    });

    window.dispatchEvent(new CustomEvent('hn-detail-opened', {
      detail: {
        restaurant: restaurant,
        targetMinutes: targetMinutes,
        isOpen: isOpenAtTarget
      }
    }));
  }

  function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('open');
  }

  // --- GASHAPON MACHINE (MÁY GASHAPON ẨM THỰC: ĐÚT XU → XOAY TAY CẦM → RA BÓNG → MỞ BÓNG) ---
  const GACHA_COLORS = ['#F28C28', '#F6B26B', '#FF8FB1', '#9BE15D', '#5EC8F2', '#FFD54A', '#C792EA', '#FF6B6B', '#E9C46A'];
  const GACHA_PRIZES = ['🍜', '🍲', '🥢', '🍱', '🥟', '🍢', '🧋', '🥖', '🍡', '🍤'];
  // phase: idle (chờ xu) → inserting → ready (chờ xoay) → cranking → dropping → dropped (bóng ở cửa) → opened
  const gacha = { phase: 'idle', angle: 0, lastTick: 0, dragging: false, coinDX: 0, coinDY: 0, winner: null };

  const $g = (id) => document.getElementById(id);

  function initClawModal() {
    $g('btnOpenClawHero')?.addEventListener('click', openClawModal);
    $g('btnCloseClawModal')?.addEventListener('click', closeClawModal);
    $g('btnLuckyFast')?.addEventListener('click', () => {
      if (window.HNWhatToEat && typeof window.HNWhatToEat.open === 'function') {
        window.HNWhatToEat.open();
      } else {
        pickInstantRandom();
      }
    });

    document.querySelectorAll('input[name="clawSource"]').forEach((radio) => {
      radio.addEventListener('change', updateClawPool);
    });

    initGachaCoin();
    initGachaKnob();
    $g('gachaOutBall')?.addEventListener('click', openGachaBall);
  }

  function openClawModal() {
    const modal = $g('clawModal');
    if (!modal) return;
    modal.classList.add('open');
    resetGacha();
  }

  function closeClawModal() {
    const modal = $g('clawModal');
    if (!modal) return;
    modal.classList.remove('open');
    state.isClawing = false;
  }

  function getGachaSource() {
    const mode = document.querySelector('input[name="clawSource"]:checked')?.value || 'filtered';
    if (mode === 'all') return RESTAURANTS_DATA;
    const list = getFilteredRestaurants();
    return list.length ? list : RESTAURANTS_DATA;
  }

  function updateClawPool() {
    const countEl = $g('clawPoolCount');
    if (countEl) countEl.textContent = getGachaSource().length;
  }

  function setGachaStatus(text) {
    const el = $g('gachaStatus');
    if (el) el.textContent = text;
  }

  function setGachaStep(step) {
    document.querySelectorAll('.gacha-step').forEach((el) => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.toggle('active', s === step);
      el.classList.toggle('done', s < step);
    });
  }

  // Render a jumbled pile of two-tone balls inside the dome
  function renderGachaGlobe() {
    const globe = $g('gachaGlobe');
    if (!globe) return;
    const rows = [7, 6, 7, 6, 5];
    let html = '';
    rows.forEach((count, row) => {
      for (let i = 0; i < count; i++) {
        const left = 7 + (i + (7 - count) / 2) * 14.3 + (Math.random() * 3 - 1.5);
        const bottom = row * 29 + Math.random() * 5 - Math.abs(i - (count - 1) / 2) * (row > 2 ? 3 : 0);
        const color = GACHA_COLORS[Math.floor(Math.random() * GACHA_COLORS.length)];
        const tilt = Math.floor(Math.random() * 360);
        const isDrop = row === 0 && i === 3;
        html += `<span class="gacha-ball"${isDrop ? ' id="gachaDropBall"' : ''} style="left:${left.toFixed(1)}%;bottom:${bottom.toFixed(0)}px;z-index:${row + 1};--c:${color};--r:${tilt}deg;--d:${(Math.random() * 0.3).toFixed(2)}s;--jx:${(Math.random() * 10 - 5).toFixed(0)}px;--jy:${(-Math.random() * 12).toFixed(0)}px;--jr:${(Math.random() * 60 - 30).toFixed(0)}deg"></span>`;
      }
    });
    globe.innerHTML = html;
  }

  function resetGacha() {
    gacha.phase = 'idle';
    gacha.angle = 0;
    gacha.lastTick = 0;
    gacha.dragging = false;
    gacha.coinDX = 0;
    gacha.coinDY = 0;
    gacha.winner = null;
    state.isClawing = false;

    const coin = $g('gachaCoin');
    if (coin) {
      coin.className = 'gacha-coin';
      coin.style.transition = '';
      coin.style.transform = '';
    }
    const knob = $g('gachaKnob');
    if (knob) {
      knob.classList.remove('ready');
      knob.setAttribute('aria-disabled', 'true');
      knob.style.transform = 'rotate(0deg)';
    }
    const ball = $g('gachaOutBall');
    if (ball) ball.className = 'gacha-out-ball';
    $g('gachaExit')?.classList.remove('flap-open');
    $g('gachaCoinSlot')?.classList.remove('hover', 'accept');
    $g('gachaGlobe')?.classList.remove('churn');
    $g('clawWinnerCard')?.classList.remove('show');

    renderGachaGlobe();
    updateClawPool();
    setGachaStep(1);
    setGachaStatus('🪙 Kéo đồng xu vào khe (hoặc bấm vào xu) để bắt đầu');
  }

  // ---- Step 1: insert coin (drag onto slot, or simply click) ----
  function initGachaCoin() {
    const coin = $g('gachaCoin');
    const slot = $g('gachaCoinSlot');
    if (!coin || !slot) return;
    let startX = 0, startY = 0, moved = false;

    const overSlot = (x, y) => {
      const r = slot.getBoundingClientRect();
      const pad = 28;
      return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
    };

    coin.addEventListener('pointerdown', (e) => {
      if (gacha.phase !== 'idle') return;
      e.preventDefault();
      coin.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      coin.classList.add('dragging');
    });

    coin.addEventListener('pointermove', (e) => {
      if (!coin.classList.contains('dragging')) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 6) moved = true;
      gacha.coinDX = dx;
      gacha.coinDY = dy;
      coin.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
      slot.classList.toggle('hover', overSlot(e.clientX, e.clientY));
    });

    const release = (e) => {
      if (!coin.classList.contains('dragging')) return;
      coin.classList.remove('dragging');
      slot.classList.remove('hover');
      if (!moved || overSlot(e.clientX, e.clientY)) {
        insertCoin();
      } else {
        coin.style.transition = 'transform 0.3s ease';
        coin.style.transform = '';
        gacha.coinDX = 0;
        gacha.coinDY = 0;
        setTimeout(() => { coin.style.transition = ''; }, 300);
      }
    };
    coin.addEventListener('pointerup', release);
    coin.addEventListener('pointercancel', release);

    coin.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && gacha.phase === 'idle') {
        e.preventDefault();
        insertCoin();
      }
    });
  }

  function insertCoin() {
    const coin = $g('gachaCoin');
    const slot = $g('gachaCoinSlot');
    if (!coin || !slot || gacha.phase !== 'idle') return;
    gacha.phase = 'inserting';

    const c = coin.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    const tx = gacha.coinDX + (s.left + s.width / 2) - (c.left + c.width / 2);
    const ty = gacha.coinDY + (s.top + s.height / 2) - (c.top + c.height / 2);

    coin.classList.add('inserting');
    coin.style.transition = 'transform 0.55s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.2s ease 0.45s';
    coin.style.transform = `translate(${tx}px, ${ty}px) rotateY(80deg) scale(0.55)`;

    setTimeout(() => {
      coin.classList.add('spent');
      slot.classList.add('accept');
      playTickSound(1500);
      setTimeout(() => playTickSound(1100), 110);
      setTimeout(() => playTickSound(820), 230);
    }, 520);

    setTimeout(() => {
      slot.classList.remove('accept');
      gacha.phase = 'ready';
      const knob = $g('gachaKnob');
      knob?.classList.add('ready');
      knob?.setAttribute('aria-disabled', 'false');
      setGachaStep(2);
      setGachaStatus('↻ Xu đã vào! Kéo xoay tay cầm theo chiều kim đồng hồ (hoặc bấm vào tay cầm)');
    }, 900);
  }

  // ---- Step 2: turn the crank (drag clockwise, or click to auto-turn) ----
  function initGachaKnob() {
    const knob = $g('gachaKnob');
    if (!knob) return;
    let lastA = 0, moved = false;

    const angleAt = (e) => {
      const r = knob.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };

    knob.addEventListener('pointerdown', (e) => {
      if (gacha.phase === 'idle') {
        setGachaStatus('🪙 Phải đút xu trước thì tay cầm mới xoay được nhé!');
        const coin = $g('gachaCoin');
        coin?.classList.remove('shake');
        void coin?.offsetWidth;
        coin?.classList.add('shake');
        return;
      }
      if (gacha.phase !== 'ready' && gacha.phase !== 'cranking') return;
      e.preventDefault();
      knob.setPointerCapture(e.pointerId);
      gacha.dragging = true;
      gacha.phase = 'cranking';
      lastA = angleAt(e);
      moved = false;
      knob.classList.remove('ready');
      $g('gachaGlobe')?.classList.add('churn');
    });

    knob.addEventListener('pointermove', (e) => {
      if (!gacha.dragging) return;
      const a = angleAt(e);
      let d = a - lastA;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastA = a;
      if (d > 0) {
        moved = true;
        advanceCrank(d);
      }
    });

    const end = () => {
      if (!gacha.dragging) return;
      gacha.dragging = false;
      if (gacha.phase !== 'cranking') return;
      if (!moved) {
        autoCrank();
      } else if (gacha.angle < 360) {
        setGachaStatus(`↻ Xoay tiếp cho đủ 1 vòng nhé... (${Math.round(gacha.angle / 3.6)}%)`);
      }
    };
    knob.addEventListener('pointerup', end);
    knob.addEventListener('pointercancel', end);

    knob.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (gacha.phase === 'ready' || gacha.phase === 'cranking')) {
        e.preventDefault();
        gacha.phase = 'cranking';
        knob.classList.remove('ready');
        autoCrank();
      }
    });
  }

  function advanceCrank(delta) {
    if (gacha.phase !== 'cranking') return;
    gacha.angle = Math.min(360, gacha.angle + delta);
    const knob = $g('gachaKnob');
    if (knob) knob.style.transform = `rotate(${gacha.angle}deg)`;

    // Ratchet clicks every 45°
    while (gacha.angle >= gacha.lastTick + 45) {
      gacha.lastTick += 45;
      playTickSound(380 + gacha.lastTick);
    }
    if (gacha.angle >= 360) completeCrank();
  }

  function autoCrank() {
    $g('gachaGlobe')?.classList.add('churn');
    setGachaStatus('↻ Rắc... rắc... rắc...');
    const startAngle = gacha.angle;
    const duration = 1300 * ((360 - startAngle) / 360) + 200;
    const t0 = performance.now();
    const step = (now) => {
      if (gacha.phase !== 'cranking') return;
      const t = Math.min(1, (now - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const target = startAngle + (360 - startAngle) * eased;
      advanceCrank(target - gacha.angle);
      if (t < 1 && gacha.phase === 'cranking') requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function completeCrank() {
    if (gacha.phase !== 'cranking') return;
    gacha.phase = 'dropping';
    state.isClawing = true;

    const knob = $g('gachaKnob');
    knob?.setAttribute('aria-disabled', 'true');

    const source = getGachaSource();
    gacha.winner = source[Math.floor(Math.random() * source.length)];
    const color = GACHA_COLORS[Math.floor(Math.random() * GACHA_COLORS.length)];
    const outBall = $g('gachaOutBall');
    if (outBall) {
      outBall.style.setProperty('--c', color);
      const prize = outBall.querySelector('.ball-prize');
      if (prize) prize.textContent = GACHA_PRIZES[Math.floor(Math.random() * GACHA_PRIZES.length)];
    }

    setGachaStatus('🎶 Lộc cộc... bóng đang lăn xuống!');

    setTimeout(() => {
      $g('gachaGlobe')?.classList.remove('churn');
      $g('gachaDropBall')?.classList.add('falling');
      playTickSound(320);
    }, 250);

    setTimeout(() => {
      $g('gachaExit')?.classList.add('flap-open');
      outBall?.classList.add('show');
      playTickSound(200);
      setTimeout(() => playTickSound(150), 140);
      setTimeout(() => playTickSound(240), 330);
    }, 850);

    setTimeout(() => {
      gacha.phase = 'dropped';
      setGachaStep(3);
      setGachaStatus('🎁 Bóng đã ra! Bấm vào quả bóng ở cửa nhận để mở');
    }, 1500);
  }

  // ---- Step 3: open the ball ----
  function openGachaBall() {
    if (gacha.phase !== 'dropped' || !gacha.winner) return;
    gacha.phase = 'opened';
    const ball = $g('gachaOutBall');
    ball?.classList.add('open');
    playTickSound(900);
    setGachaStatus('✨ Bụp! Mở bóng thành công!');

    setTimeout(() => {
      state.isClawing = false;
      setGachaStep(4);
      celebrateClawWinner(gacha.winner);
    }, 600);
  }

  function celebrateClawWinner(restaurant) {
    playWinSound();
    launchConfetti();

    const winnerCard = $g('clawWinnerCard');
    if (!winnerCard) return;

    const signatureDishesHtml = (restaurant.signatureDishes || [])
      .slice(0, 3)
      .map(d => `<span class="dish-chip" style="font-size:0.8rem; padding: 3px 8px;">🥢 ${escapeHtml(d)}</span>`)
      .join(' ');

    const reviewsCount = Number(restaurant.reviews) || 120;
    const peopleRange = restaurant.peopleRange || '1 - 6 người';
    const mapsUrl = restaurant.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((restaurant.name || '') + ' ' + (restaurant.address || '')));

    winnerCard.innerHTML = `
      <span class="winner-badge">🎉 BÓNG GASHAPON CỦA BẠN LÀ...</span>
      <h3 class="winner-name">${escapeHtml(restaurant.name)}</h3>
      <p class="winner-sub">
        ${escapeHtml(restaurant.subname)} • <strong>${escapeHtml(restaurant.priceRange)}</strong> • Quận ${escapeHtml(restaurant.district)}
      </p>

      <div style="display:flex; justify-content:center; gap:8px; margin: 8px 0 12px; flex-wrap:wrap;">
        <span class="badge-tag rating">★ ${restaurant.rating} (${reviewsCount.toLocaleString()} đánh giá Google Maps)</span>
        <span class="badge-tag">👥 ${escapeHtml(peopleRange)}</span>
      </div>

      <div style="margin-bottom: 12px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;">
        ${signatureDishesHtml}
      </div>

      <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 14px;">
        📍 ${escapeHtml(restaurant.address)}
      </div>

      <div class="winner-actions">
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-maps" style="padding: 10px 18px;">
          🧭 Chỉ đường Google Maps
        </a>
        <button class="btn-card-details" id="btnClawViewDetails" style="padding: 10px 18px;">
          📖 Xem thực đơn &amp; mẹo ăn
        </button>
        <button class="btn-drop-claw" id="btnClawAgain" style="padding: 10px 20px; font-size: 0.95rem; max-width: none; width: auto;">
          🪙 Đút xu quay tiếp
        </button>
      </div>
    `;

    winnerCard.classList.add('show');
    winnerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    $g('btnClawViewDetails')?.addEventListener('click', () => {
      closeClawModal();
      openDetailModal(restaurant.id);
    });

    $g('btnClawAgain')?.addEventListener('click', () => {
      resetGacha();
      $g('gachaMachine')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // --- 1-CLICK INSTANT RANDOM PICK ---
  function pickInstantRandom() {
    const list = getFilteredRestaurants();
    const source = list.length > 0 ? list : RESTAURANTS_DATA;
    const randomItem = source[Math.floor(Math.random() * source.length)];
    if (!randomItem) return;

    playWinSound();
    launchConfetti();
    showToast(`🎲 Đã chọn ngẫu nhiên: ${randomItem.name}`);
    openDetailModal(randomItem.id);
  }

  // --- CONFETTI SYSTEM ---
  function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#9A2626', '#C28725', '#2E4B3E', '#F7E7C4', '#25394B', '#FF4D4D', '#FFD700'];
    const particles = [];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 14 - 4,
        gravity: 0.35,
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 15,
        opacity: 1
      });
    }

    let confettiFrames = 0;
    function renderConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiFrames++;

      let hasActive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.vr;
        if (confettiFrames > 40) {
          p.opacity -= 0.015;
        }

        if (p.opacity > 0 && p.y < canvas.height + 50) {
          hasActive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (hasActive && confettiFrames < 180) {
        requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestAnimationFrame(renderConfetti);
  }

  // --- FILTERS & INPUT EVENT HANDLERS ---
  function initFilterListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.search = e.target.value;
          state.currentPage = 1;
          renderRestaurants();
        }, 220);
      });
    }

    // Select Dropdowns
    document.getElementById('priceTierSelect')?.addEventListener('change', (e) => {
      state.priceTier = e.target.value;
      state.currentPage = 1;
      playTickSound(500);
      renderRestaurants();
    });

    document.getElementById('peopleCategorySelect')?.addEventListener('change', (e) => {
      state.peopleCategory = e.target.value;
      state.currentPage = 1;
      playTickSound(500);
      renderRestaurants();
    });

    document.getElementById('districtSelect')?.addEventListener('change', (e) => {
      state.district = e.target.value;
      state.currentPage = 1;
      playTickSound(500);
      renderRestaurants();
    });

    document.getElementById('occasionSelect')?.addEventListener('change', (e) => {
      state.occasion = e.target.value;
      state.currentPage = 1;
      playTickSound(500);
      renderRestaurants();
    });

    // Time slot & custom time input
    const timeSlotSelect = document.getElementById('timeSlotSelect');
    const customTimeInput = document.getElementById('customTimeInput');
    if (timeSlotSelect) {
      timeSlotSelect.addEventListener('change', (e) => {
        state.timeSlot = e.target.value || 'now';
        if (customTimeInput) {
          customTimeInput.hidden = (state.timeSlot !== 'custom');
        }
        state.currentPage = 1;
        playTickSound(500);
        renderRestaurants();
      });
    }
    if (customTimeInput) {
      const onCustomTimeUpdate = (e) => {
        state.customTime = e.target.value || '19:00';
        if (state.timeSlot === 'custom') {
          state.currentPage = 1;
          renderRestaurants();
        }
      };
      customTimeInput.addEventListener('input', onCustomTimeUpdate);
      customTimeInput.addEventListener('change', onCustomTimeUpdate);
    }

    // Sort Select
    document.getElementById('sortBySelect')?.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      state.currentPage = 1;
      playTickSound(480);
      renderRestaurants();
    });

    // Quick filter pills
    document.querySelectorAll('.pill-btn[data-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        const filterType = pill.dataset.filter;
        document.querySelectorAll('.pill-btn[data-filter]').forEach(p => p.classList.remove('active'));
        
        if (state.quickFilter === filterType) {
          state.quickFilter = 'all';
          document.querySelector('.pill-btn[data-filter="all"]')?.classList.add('active');
        } else {
          state.quickFilter = filterType;
          pill.classList.add('active');
        }
        state.currentPage = 1;
        playTickSound(550);
        renderRestaurants();
      });
    });

    // Reset Filters button
    document.getElementById('btnResetFilters')?.addEventListener('click', resetAllFilters);

    // Hero Favorites button
    document.getElementById('btnOpenFavoritesHero')?.addEventListener('click', () => {
      state.quickFilter = 'favorites';
      state.currentPage = 1;
      document.querySelectorAll('.pill-btn[data-filter]').forEach(p => p.classList.remove('active'));
      document.querySelector('.pill-btn[data-filter="favorites"]')?.classList.add('active');
      renderRestaurants();
      showToast('Đang hiển thị các quán trong Sổ tay quán quen');
    });

    // Sound toggle button
    document.getElementById('soundToggleBtn')?.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('hanoi_phovi_sound', state.soundEnabled ? 'true' : 'false');
      updateSoundButtonUI();
      if (state.soundEnabled) playTickSound(700);
    });

    // Modal background click to close
    document.querySelectorAll('.modal-overlay').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });

    // ESC key to close modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  }

  function resetAllFilters() {
    state.search = '';
    state.priceTier = 'all';
    state.peopleCategory = 'all';
    state.district = 'all';
    state.occasion = 'all';
    state.quickFilter = 'all';
    state.timeSlot = 'now';
    state.customTime = '19:00';
    state.sortBy = 'rating_desc';
    state.currentPage = 1;

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const priceSelect = document.getElementById('priceTierSelect');
    if (priceSelect) priceSelect.value = 'all';

    const peopleSelect = document.getElementById('peopleCategorySelect');
    if (peopleSelect) peopleSelect.value = 'all';

    const districtSelect = document.getElementById('districtSelect');
    if (districtSelect) districtSelect.value = 'all';

    const occasionSelect = document.getElementById('occasionSelect');
    if (occasionSelect) occasionSelect.value = 'all';

    const timeSlotSelect = document.getElementById('timeSlotSelect');
    if (timeSlotSelect) timeSlotSelect.value = 'now';

    const customTimeInput = document.getElementById('customTimeInput');
    if (customTimeInput) {
      customTimeInput.value = '19:00';
      customTimeInput.hidden = true;
    }

    const sortSelect = document.getElementById('sortBySelect');
    if (sortSelect) sortSelect.value = 'rating_desc';

    document.querySelectorAll('.pill-btn[data-filter]').forEach(p => p.classList.remove('active'));
    document.querySelector('.pill-btn[data-filter="all"]')?.classList.add('active');

    playTickSound(400);
    renderRestaurants();
    showToast('Đã xóa tất cả bộ lọc về mặc định');
  }

  // --- FLOATING BACK TO TOP BUTTON ---
  function initBackToTop() {
    const btn = document.getElementById('btnBackToTop');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 380) {
        btn.classList.add('show');
      } else {
        btn.classList.remove('show');
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      playTickSound(520);
    });
  }

  // --- POPULATE SELECT DROPDOWNS ---
  function populateSelectDropdowns() {
    const priceSelect = document.getElementById('priceTierSelect');
    if (priceSelect && FILTER_METADATA.priceTiers) {
      priceSelect.innerHTML = FILTER_METADATA.priceTiers.map(p => `
        <option value="${p.key}">${p.icon} ${p.label}</option>
      `).join('');
    }

    const peopleSelect = document.getElementById('peopleCategorySelect');
    if (peopleSelect && FILTER_METADATA.peopleCategories) {
      peopleSelect.innerHTML = FILTER_METADATA.peopleCategories.map(p => `
        <option value="${p.key}">${p.icon} ${p.label}</option>
      `).join('');
    }

    const districtSelect = document.getElementById('districtSelect');
    if (districtSelect && FILTER_METADATA.districts) {
      districtSelect.innerHTML = FILTER_METADATA.districts.map(d => `
        <option value="${d.key}">${d.icon} ${d.label}</option>
      `).join('');
    }

    const occasionSelect = document.getElementById('occasionSelect');
    if (occasionSelect && FILTER_METADATA.occasions) {
      occasionSelect.innerHTML = FILTER_METADATA.occasions.map(o => `
        <option value="${o.key}">${o.icon} ${o.label}</option>
      `).join('');
    }
  }

  // Utility escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function applyFiltersPatch(patch) {
    if (!patch || typeof patch !== 'object') return;

    if (Object.prototype.hasOwnProperty.call(patch, 'search')) {
      state.search = patch.search ? String(patch.search) : '';
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = state.search;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'priceTier')) {
      state.priceTier = patch.priceTier || 'all';
      const priceSelect = document.getElementById('priceTierSelect');
      if (priceSelect) priceSelect.value = state.priceTier;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'peopleCategory')) {
      state.peopleCategory = patch.peopleCategory || 'all';
      const peopleSelect = document.getElementById('peopleCategorySelect');
      if (peopleSelect) peopleSelect.value = state.peopleCategory;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'district')) {
      state.district = patch.district || 'all';
      const districtSelect = document.getElementById('districtSelect');
      if (districtSelect) districtSelect.value = state.district;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'occasion')) {
      state.occasion = patch.occasion || 'all';
      const occasionSelect = document.getElementById('occasionSelect');
      if (occasionSelect) occasionSelect.value = state.occasion;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'quickFilter')) {
      state.quickFilter = patch.quickFilter || 'all';
      document.querySelectorAll('.pill-btn[data-filter]').forEach((p) => {
        p.classList.toggle('active', p.dataset.filter === state.quickFilter);
      });
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'timeSlot')) {
      state.timeSlot = patch.timeSlot || 'now';
      const timeSlotSelect = document.getElementById('timeSlotSelect');
      if (timeSlotSelect) timeSlotSelect.value = state.timeSlot;
      const customTimeInput = document.getElementById('customTimeInput');
      if (customTimeInput) customTimeInput.hidden = (state.timeSlot !== 'custom');
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'customTime')) {
      state.customTime = patch.customTime || '19:00';
      const customTimeInput = document.getElementById('customTimeInput');
      if (customTimeInput) customTimeInput.value = state.customTime;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'sortBy')) {
      state.sortBy = patch.sortBy || 'rating_desc';
      const sortSelect = document.getElementById('sortBySelect');
      if (sortSelect) sortSelect.value = state.sortBy;
    }

    state.currentPage = 1;
    invalidateFilterCache();
    renderRestaurants();
  }

  function invalidateCacheAndRender() {
    dataVersion++;
    invalidateFilterCache();
    renderRestaurants();
  }

  window.openRestaurantDetail = openDetailModal;
  window.HNAppBridge = {
    getFilteredRestaurants: getFilteredRestaurants,
    getAllRestaurants: function () {
      return (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) ? RESTAURANTS_DATA : [];
    },
    getFavorites: function () {
      return [...state.favorites];
    },
    toggleFavorite: toggleFavorite,
    applyFiltersPatch: applyFiltersPatch,
    resetAllFilters: resetAllFilters,
    invalidateCacheAndRender: invalidateCacheAndRender,
    openDetail: openDetailModal,
    showToast: showToast
  };

  window.addEventListener('hn-lang-changed', () => {
    renderRestaurants();
  });

  // --- INIT APPLICATION ---
  function init() {
    window.openRestaurantDetail = openDetailModal;
    loadStoredFavorites();
    populateSelectDropdowns();
    initFilterListeners();
    initBackToTop();
    initClawModal();
    renderRestaurants();
    updateClawPool();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* ==========================================================================
   CO LAN — OFFLINE AI ENGINE (no API key, runs fully in-browser)
   Strict Domain Guard + Opening Hours & Active Filter Aware + Restaurant Lookup
   ========================================================================== */
(function () {
  'use strict';

  var OFF_TOPIC_REPLY = 'Câu hỏi này nằm ngoài hiểu biết của tôi.';

  var $ = function (id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; };
  var btnOpen = $('aiBtnOpen'), panel = $('aiChatPanel'),
      btnClose = $('aiBtnClose'), btnClear = $('aiBtnClear'),
      btnInfo = $('aiBtnSettings'), messagesEl = $('aiMessages'),
      textarea = $('aiTextInput'), btnSend = $('aiBtnSend'),
      chips = typeof document !== 'undefined' ? document.querySelectorAll('.ai-chip') : [],
      unreadBadge = $('aiUnreadBadge'), statusDot = $('aiStatusDot');

  var isOpen = false, isBusy = false;

  /* ---- INTENT RULES ---- */
  var INTENTS = [
    {id:'greet',   kw:['xin chao','hello','chao ban','chao em','chao co','chao co lan','hi','hey','alo']},
    {id:'thanks',  kw:['cam on','thank','thanks','tuyet voi','ok roi','duoc roi']},
    {id:'random',  kw:['hom nay an gi','khong biet an gi','chon giup','ngau nhien','random','goi y cho toi','bat ky','an gi bay gio','an gi gio']},
    {id:'top',     kw:['ngon nhat','noi tieng nhat','best','top','noi tieng','michelin','danh gia cao','hay nhat']},
    {id:'cheap',   kw:['re','gia re','tiet kiem','binh dan','duoi 100','duoi 50','it tien','cheap','khong dat']},
    {id:'luxury',  kw:['sang trong','cao cap','vip','fine dining','dat tien','premium','luxury','5 sao']},
    {id:'mid',     kw:['tam trung','khoang 100','khoang 200','vua tui']},
    {id:'breakfast',kw:['an sang','bua sang','sang som','buoi sang','diem tam']},
    {id:'lunch',   kw:['an trua','bua trua','buoi trua','com trua']},
    {id:'quick',   kw:['an nhanh','nhanh gon','fast','gon nhe']},
    {id:'dinner',  kw:['an toi','bua toi','buoi toi','toi nay','dinner']},
    {id:'late',    kw:['an khuya','an dem','khuya','dem khuya','dem muon','late night','nua dem']},
    {id:'date',    kw:['hen ho','lang man','tinh cam','romantic','date','nguoi yeu']},
    {id:'family',  kw:['gia dinh','ca nha','hop mat','bo me','ba me','dong nguoi']},
    {id:'friends', kw:['ban be','tu tap','hoi ban','nhom ban','ca nhom']},
    {id:'party',   kw:['tiec','party','sinh nhat','ky niem','celebration']},
    {id:'drinks',  kw:['nhau','bia','uong bia','bar','cocktail','ruou']},
    {id:'solo',    kw:['1 nguoi','mot minh','di mot minh','solo']},
    {id:'d_hk',    kw:['hoan kiem','pho co','old quarter']},
    {id:'d_th',    kw:['tay ho','ho tay','xuan dieu']},
    {id:'d_dd',    kw:['dong da','kim lien','thai thinh','lang ha']},
    {id:'d_hbt',   kw:['hai ba trung','ba trieu']},
    {id:'d_bd',    kw:['ba dinh','kim ma']},
    {id:'d_cg',    kw:['cau giay','dich vong','tran thai tong']},
    {id:'d_hd',    kw:['ha dong','mo lao','yen nghia']},
    {id:'d_tx',    kw:['thanh xuan','nguyen trai']},
    {id:'d_lb',    kw:['long bien']},
    {id:'d_hm',    kw:['hoang mai','giap bat']},
    {id:'d_ntl',   kw:['nam tu liem','my dinh','me tri','le quang dao','phu do']},
    {id:'d_btl',   kw:['bac tu liem','co nhue','phu dien','xuan dinh','hoang quoc viet']},
    {id:'d_uni',   kw:['dai hoc','gan truong','truong dai','sinh vien','university']},
    {id:'f_pho',   kw:['pho','bun bo','bun rieu']},
    {id:'f_bun',   kw:['bun cha','bun dau','bun oc','bun thang','bun ca','bun']},
    {id:'f_banh',  kw:['banh mi','banh cuon','banh xeo','banh tom','banh duc']},
    {id:'f_xoi',   kw:['xoi','chao']},
    {id:'f_com',   kw:['com','com tam','com nieu','com binh dan']},
    {id:'f_lau',   kw:['lau','lau thai','lau rieu','lau ech']},
    {id:'f_nuong', kw:['nuong','bbq','thit nuong','bo nuong']},
    {id:'f_sea',   kw:['hai san','tom','cua','muc','seafood','oc','hau']},
    {id:'f_jp',    kw:['sushi','do nhat','mon nhat','quan nhat','nha hang nhat','japanese','ramen','udon','sashimi']},
    {id:'f_kr',    kw:['do han','mon han','quan han','nha hang han','korean','kimchi','tokbokki','kimbap','jokbal','chimaek','han quoc']},
    {id:'f_cn',    kw:['do trung','mon trung','mon hoa','trung hoa','nha hang trung','dimsum','tieu long bao','ha cao','trung khanh','tu xuyen','quang dong','vit quay','chinese']},
    {id:'f_veg',   kw:['do chay','mon chay','quan chay','an chay','vegetarian','vegan']},
    {id:'f_cafe',  kw:['ca phe','cafe','coffee','tra sua','tra chanh']},
    {id:'f_sweet', kw:['kem','trang mieng','dessert','che','an vat','qua vat','nem chua ran','banh goi','banh trang','quay nong','hoa qua dam','tao pho']},
    {id:'f_pizza', kw:['pizza','pasta','steak']}
  ];

  var FOOD_DOMAIN_KEYWORDS = [
    'quan an','quan ngon','nha hang','tiem an','hang an','am thuc','mon an','do an',
    'thuc don','menu','dat ban','dat mon','giao hang','giao tan noi','dat giao','ship do an',
    'mo cua','dong cua','gio mo','may gio mo','khung gio','con mo','dang mo',
    'an gi','an sang','an trua','an toi','an khuya','an dem','an vat','qua vat','an nhanh',
    'bua sang','bua trua','bua toi','diem tam','an chay','mon ngon','dac san','michelin',
    'quan quen','so tay quan','tuong tu','thay the','goi y quan','chon quan',
    'pho','bun','bun cha','bun dau','bun oc','bun rieu','bun bo','banh mi','banh cuon',
    'banh xeo','banh goi','xoi','chao','com','com nieu','lau','nuong','bbq','cha ca',
    'hai san','oc','sushi','ramen','udon','sashimi','dimsum','ha cao','tieu long bao',
    'kimchi','tokbokki','kimbap','vit quay','ca phe','cafe','coffee','tra sua','tra chanh',
    'che','kem','trang mieng','tao pho','hoa qua dam','nem chua ran','pizza','pasta','steak',
    'do han','mon han','do trung','mon trung','mon hoa','do nhat','mon nhat','do chay','mon chay',
    'hen ho','nhau','tiec','binh dan','cao cap','sang trong','ngon','duong pho'
  ];

  var OFF_TOPIC_KEYWORDS = [
    'thoi tiet','du bao thoi tiet','mua khong','nang khong','nhiet do','bao so','ap thap',
    'chung khoan','co phieu','vnindex','bitcoin','crypto','tien ao','ty gia','gia vang','ngoai te','ngan hang','lai suat',
    'bong da','da bong','world cup','ngoai hang anh','champions league','the thao','ty so','tennis','nba',
    'xem phim','rap chieu phim','dien vien','bo phim','am nhac','bai hat','ca si','nghe nhac','mv ca nhac',
    'suc khoe','thuoc tay','benh vien','bac si','trieu chung','dau dau','cam cum','covid','ung thu','chua benh',
    'lap trinh','viet code','code','python','javascript','html','css','java','sql','thuat toan','chatgpt','openai','react',
    'toan hoc','phuong trinh','tich phan','dao ham','giai toan','vat ly','hoa hoc','sinh hoc',
    'lich su','chien tranh','the chien','chinh tri','chinh phu','quoc hoi','thu do','dan so','dien tich','hanh tinh','mat trang','mat troi',
    'dien thoai','iphone','samsung','laptop','macbook','o to','xe may','xe hoi',
    'khach san','ve may bay','dat phong','tour du lich','resort','homestay',
    'ke chuyen cuoi','chuyen cuoi','lam tho','bai tho','cau do','dich sang','translate',
    'chung cu','bat dong san','xo so','lo de','ca cuoc'
  ];

  /* Bỏ dấu tiếng Việt: "Phở Hoàn Kiếm" -> "pho hoan kiem" */
  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function hasBoundaryPhrase(paddedNormMsg, phrase) {
    var key = norm(phrase);
    return Boolean(key && paddedNormMsg.indexOf(' ' + key + ' ') !== -1);
  }

  function hoursApi() {
    return (typeof window !== 'undefined' && window.HNRestaurantHours) ? window.HNRestaurantHours : null;
  }

  function filterStateApi() {
    return (typeof window !== 'undefined' && window.HNFilterState) ? window.HNFilterState : null;
  }

  var _restIndexCache = null;
  var _restIndexLen = -1;
  var GENERIC_NAME_WORDS = {
    nha: 1, hang: 1, quan: 1, tiem: 1, cua: 1, an: 1, uong: 1,
    ha: 1, noi: 1, thanh: 1, pho: 1, bun: 1, com: 1, lau: 1,
    nuong: 1, che: 1, ca: 1, phe: 1, tra: 1, sua: 1, banh: 1,
    gia: 1, truyen: 1, dac: 1, san: 1, ngon: 1, so: 1
  };

  var NON_BRAND_TOKENS = {
    nha:1,hang:1,quan:1,tiem:1,cua:1,an:1,uong:1,ha:1,noi:1,thanh:1,pho:1,bun:1,com:1,lau:1,
    nuong:1,che:1,ca:1,phe:1,tra:1,sua:1,banh:1,gia:1,truyen:1,dac:1,san:1,ngon:1,so:1,
    hoan:1,kiem:1,dong:1,da:1,tay:1,ho:1,ba:1,dinh:1,cau:1,giay:1,hai:1,trung:1,xuan:1,
    nam:1,bac:1,tu:1,liem:1,long:1,bien:1,hoang:1,mai:1,viet:1,phap:1,nhat:1,han:1,quoc:1,
    hoa:1,my:1,anh:1,duc:1,thoi:1,tiet:1,lich:1,su:1,phim:1,nhac:1,bong:1,thu:1,do:1,
    tinh:1,toan:1,code:1,game:1,iphone:1,samsung:1,laptop:1,bitcoin:1,crypto:1,hom:1,nay:1,
    ngay:1,thang:1,gio:1,luc:1,may:1,nhieu:1,bao:1,nhau:1,muon:1,thich:1,choi:1,chay:1,
    mua:1,ban:1,nang:1,dau:1,the:1,nao:1,khong:1,mo:1,xin:1,chao:1,cam:1,hello:1,tai:1,
    gan:1,khu:1,vuc:1,duong:1,ngo:1,phuong:1,vincom:1,times:1,royal:1,aeon:1,center:1,
    plaza:1,house:1,food:1,kitchen:1,garden:1,coffee:1,cafe:1,tea:1,milk:1,king:1,queen:1,
    hot:1,pot:1,bbq:1,buffet:1,mini:1,plus:1,vip:1,pro:1,top:1,best:1,new:1,old:1,
    benh:1,thuoc:1,hoc:1,tap:1,chuyen:1,cuoi:1,tho:1,dich:1,tien:1,vang:1,xem:1
  };

  function getRestaurantIndex() {
    var list = db();
    if (_restIndexCache && _restIndexLen === list.length) return _restIndexCache;
    _restIndexLen = list.length;
    _restIndexCache = list.map(function (r) {
      var noParen = String(r.name || '').replace(/\([^)]*\)/g, ' ');
      var normFull = norm(r.name);
      var normNoParen = norm(noParen);
      var normCore = normNoParen.replace(/^(nha hang|cua hang an uong|cua hang|quan an|quan|tiem an|tiem)\s+/, '').trim();
      var tokens = normNoParen ? normNoParen.split(' ') : [];
      var distinctTokens = tokens.filter(function (t) { return t.length >= 2 && !GENERIC_NAME_WORDS[t]; });
      var firstTok = tokens[0] || '';
      var brandToken = (firstTok.length >= 4 && !NON_BRAND_TOKENS[firstTok] && !/^\d+$/.test(firstTok)) ? firstTok : '';
      return {
        restaurant: r,
        normFull: normFull,
        normNoParen: normNoParen,
        normCore: normCore,
        tokens: tokens,
        distinctTokens: distinctTokens,
        brandToken: brandToken
      };
    });
    return _restIndexCache;
  }

  function findBrandRestaurants(msg) {
    var nMsg = norm(msg);
    if (!nMsg || nMsg.length < 4) return [];
    var msgTokens = nMsg.split(' ');
    var index = getRestaurantIndex();
    var matches = [];
    for (var i = 0; i < index.length; i++) {
      var bt = index[i].brandToken;
      if (bt && msgTokens.indexOf(bt) !== -1) {
        matches.push(index[i].restaurant);
      }
    }
    return matches;
  }

  function findMentionedRestaurant(msg) {
    var nMsg = norm(msg);
    if (!nMsg || nMsg.length < 3) return null;
    var padded = ' ' + nMsg + ' ';
    var msgTokens = nMsg.split(' ');
    var index = getRestaurantIndex();
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var score = 0;
      if (entry.normFull && padded.indexOf(' ' + entry.normFull + ' ') !== -1) {
        score = 1000 + entry.normFull.length;
      } else if (entry.normNoParen && entry.normNoParen.length >= 6 && padded.indexOf(' ' + entry.normNoParen + ' ') !== -1) {
        score = 900 + entry.normNoParen.length;
      } else if (entry.normCore && entry.normCore.length >= 6 && entry.normCore.split(' ').length >= 2 && padded.indexOf(' ' + entry.normCore + ' ') !== -1) {
        score = 800 + entry.normCore.length;
      } else if (entry.distinctTokens.length >= 2 && entry.tokens.length >= 2) {
        var matchedDistinct = 0;
        for (var d = 0; d < entry.distinctTokens.length; d++) {
          if (msgTokens.indexOf(entry.distinctTokens[d]) !== -1) matchedDistinct++;
        }
        var hasFirst = msgTokens.indexOf(entry.tokens[0]) !== -1;
        if (matchedDistinct === entry.distinctTokens.length && (hasFirst || matchedDistinct >= 2)) {
          score = 600 + matchedDistinct * 20;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry.restaurant;
      }
    }
    return best;
  }

  function hasDishMatchInData(msg) {
    var nMsg = norm(msg);
    if (!nMsg || nMsg.length < 4) return false;
    var padded = ' ' + nMsg + ' ';
    var list = db();
    for (var i = 0; i < list.length; i++) {
      var dishes = list[i].signatureDishes;
      if (!Array.isArray(dishes)) continue;
      for (var j = 0; j < dishes.length; j++) {
        var nd = norm(dishes[j]);
        if (nd && nd.split(' ').length >= 2 && padded.indexOf(' ' + nd + ' ') !== -1) {
          return true;
        }
      }
    }
    return false;
  }

  function detectIntents(msg) {
    var n = ' ' + norm(msg) + ' ';
    var found = [];
    INTENTS.forEach(function (rule) {
      if (rule.kw.some(function (k) {
        return hasBoundaryPhrase(n, k);
      })) found.push(rule.id);
    });
    return found.length ? found : ['unknown'];
  }

  function hasFoodOrRestaurantSignal(msg, intents) {
    var n = ' ' + norm(msg) + ' ';
    if (!n.trim()) return false;
    for (var i = 0; i < FOOD_DOMAIN_KEYWORDS.length; i++) {
      if (hasBoundaryPhrase(n, FOOD_DOMAIN_KEYWORDS[i])) return true;
    }
    var foodIntents = [
      'random','top','cheap','luxury','mid','breakfast','lunch','quick','dinner','late',
      'date','family','friends','party','drinks','solo',
      'f_pho','f_bun','f_banh','f_xoi','f_com','f_lau','f_nuong','f_sea',
      'f_jp','f_kr','f_cn','f_veg','f_cafe','f_sweet','f_pizza'
    ];
    for (var j = 0; j < foodIntents.length; j++) {
      if (intents.indexOf(foodIntents[j]) !== -1) return true;
    }
    if (findMentionedRestaurant(msg)) return true;
    if (findBrandRestaurants(msg).length > 0) return true;
    if (hasDishMatchInData(msg)) return true;
    return false;
  }

  function hasOffTopicSignal(msg) {
    var n = ' ' + norm(msg) + ' ';
    for (var i = 0; i < OFF_TOPIC_KEYWORDS.length; i++) {
      if (hasBoundaryPhrase(n, OFF_TOPIC_KEYWORDS[i])) return true;
    }
    if (/\b(la gi|o dau|bao nhieu tuoi|ai la|nam nao)\b/.test(n) && !/\b(quan|nha hang|mon|an|pho|bun|com|lau|che|banh)\b/.test(n)) {
      return true;
    }
    return false;
  }

  function isRestaurantRelated(msg, intentsOpt) {
    var trimmed = String(msg || '').trim();
    if (!trimmed) return false;
    var intents = Array.isArray(intentsOpt) ? intentsOpt : detectIntents(trimmed);
    var explicitFood = hasFoodOrRestaurantSignal(trimmed, intents);
    var offTopic = hasOffTopicSignal(trimmed);
    if (offTopic && !explicitFood) return false;
    if (explicitFood) return true;
    var isPureSocial = (intents.indexOf('greet') !== -1 || intents.indexOf('thanks') !== -1) && !offTopic;
    if (isPureSocial) {
      var words = norm(trimmed).split(' ').filter(Boolean);
      if (words.length <= 8) return true;
    }
    return false;
  }

  function extractTimeFromQuery(msg) {
    var hApi = hoursApi();
    var fallbackCtx = hApi
      ? hApi.getSelectedTimeContext()
      : (function () {
          var d = new Date();
          var m = d.getHours() * 60 + d.getMinutes();
          return { mode: 'now', minutes: m, timeLabel: (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(), dayOfWeek: d.getDay() };
        })();

    var raw = String(msg || '');
    var n = norm(raw);
    var formatFn = hApi ? hApi.formatMinutesToHHMM : function (m) {
      var nm = ((Math.floor(m) % 1440) + 1440) % 1440;
      var hh = Math.floor(nm / 60), mm = nm % 60;
      return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    };

    var rawNorm = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    var rawClock = rawNorm.match(/\b(\d{1,2})\s*(?::|h|gio)\s*(\d{1,2})?\s*(sang|trua|chieu|toi|dem|khuya|am|pm)?\b/);
    if (rawClock) {
      var hh = parseInt(rawClock[1], 10);
      var mm = rawClock[2] ? parseInt(rawClock[2], 10) : 0;
      var period = rawClock[3] || '';
      if (!isNaN(hh) && hh >= 0 && hh <= 23 && !isNaN(mm) && mm >= 0 && mm <= 59) {
        if ((period === 'chieu' || period === 'toi' || period === 'pm') && hh >= 1 && hh <= 11) {
          hh += 12;
        } else if (period === 'dem' || period === 'khuya') {
          if (hh === 12) hh = 0;
          else if (hh >= 6 && hh <= 11) hh += 12;
        } else if ((period === 'sang' || period === 'am') && hh === 12) {
          hh = 0;
        }
        var mins = hh * 60 + mm;
        return {
          explicit: true,
          minutes: mins,
          timeLabel: formatFn(mins),
          dayOfWeek: fallbackCtx.dayOfWeek
        };
      }
    }

    var namedMins = null;
    if (/\b(sang som)\b/.test(n)) namedMins = 6 * 60 + 30;
    else if (/\b(sang nay|buoi sang|an sang)\b/.test(n)) namedMins = 8 * 60;
    else if (/\b(trua nay|buoi trua|an trua)\b/.test(n)) namedMins = 12 * 60;
    else if (/\b(chieu nay|buoi chieu)\b/.test(n)) namedMins = 15 * 60 + 30;
    else if (/\b(toi nay|buoi toi|an toi)\b/.test(n)) namedMins = 19 * 60 + 30;
    else if (/\b(dem nay|nua dem|khuya|an khuya|an dem)\b/.test(n)) namedMins = 23 * 60;

    if (namedMins !== null) {
      return {
        explicit: true,
        minutes: namedMins,
        timeLabel: formatFn(namedMins),
        dayOfWeek: fallbackCtx.dayOfWeek
      };
    }

    return {
      explicit: false,
      minutes: fallbackCtx.minutes,
      timeLabel: fallbackCtx.timeLabel,
      dayOfWeek: fallbackCtx.dayOfWeek
    };
  }

  /* ---- DATA ---- */
  function db() {
    return (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) ? RESTAURANTS_DATA : [];
  }

  var DMAP = {d_hk:'Hoàn Kiếm',d_th:'Tây Hồ',d_dd:'Đống Đa',d_hbt:'Hai Bà Trưng',
    d_bd:'Ba Đình',d_cg:'Cầu Giấy',d_hd:'Hà Đông',d_tx:'Thanh Xuân',d_lb:'Long Biên',d_hm:'Hoàng Mai',
    d_ntl:'Nam Từ Liêm',d_btl:'Bắc Từ Liêm'};
  var OMAP = {breakfast:'breakfast',lunch:'quick_lunch',quick:'quick_lunch',dinner:'dinner',
    late:'night_snack',date:'date',family:'family',friends:'party',party:'party',drinks:'drinks'};
  var CMAP = {f_pho:['phở','pho'],f_bun:['bún','bun'],f_banh:['bánh','banh'],f_xoi:['xôi','cháo'],
    f_com:['cơm','com'],f_lau:['lẩu','lau'],f_nuong:['nướng','nuong','bbq'],
    f_sea:['hải sản','ốc','seafood'],f_jp:['nhật','sushi','japanese','ramen'],
    f_kr:['hàn quốc','hàn','korean','tokbokki','kimbap'],f_cn:['trung hoa','trung','tàu','chinese','dimsum','tứ xuyên','trùng khánh','quảng đông'],
    f_veg:['chay','vegetarian'],f_cafe:['cà phê','cafe','coffee','trà'],
    f_sweet:['quà vặt','chè','kem','tráng miệng','nem chua rán','bánh gối','hoa quả dầm','tào phớ'],f_pizza:['pizza','pasta']};

  function shuffle(a){ var b=a.slice(); for(var i=b.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;} return b; }
  function pick(a,n){ return shuffle(a).slice(0,n); }
  function rand(a){ return a[Math.floor(Math.random()*a.length)]; }

  function applyFilters(intents) {
    var pool = db(); if(!pool.length) return [];
    var distKey=null,occKey=null,catKey=null,priceFilter=null,sizeFilter=null;
    var univMode = intents.indexOf('d_uni')!==-1;
    Object.keys(DMAP).forEach(function(k){if(intents.indexOf(k)!==-1)distKey=k;});
    Object.keys(OMAP).forEach(function(k){if(intents.indexOf(k)!==-1&&!occKey)occKey=k;});
    Object.keys(CMAP).forEach(function(k){if(intents.indexOf(k)!==-1&&!catKey)catKey=k;});
    if(intents.indexOf('cheap')!==-1)priceFilter=['budget','moderate'];
    else if(intents.indexOf('luxury')!==-1)priceFilter=['upscale','luxury'];
    else if(intents.indexOf('mid')!==-1)priceFilter=['moderate'];
    if(intents.indexOf('solo')!==-1)sizeFilter='solo';
    else if(intents.indexOf('date')!==-1)sizeFilter='couple';
    else if(intents.indexOf('family')!==-1||intents.indexOf('friends')!==-1||intents.indexOf('party')!==-1)sizeFilter='group';

    if(univMode){pool=pool.filter(function(r){return r.district==='Cầu Giấy'||r.district==='Đống Đa'||r.district==='Thanh Xuân';});}
    else if(distKey){var dn=DMAP[distKey];pool=pool.filter(function(r){return r.district===dn;});}
    if(occKey){var occ=OMAP[occKey];var f=pool.filter(function(r){return(r.occasions||[]).indexOf(occ)!==-1;});if(f.length)pool=f;}
    if(catKey){var kws=CMAP[catKey];var f2=pool.filter(function(r){var c=(r.category||'').toLowerCase();var d=(r.signatureDishes||[]).join(' ').toLowerCase();return kws.some(function(k){return c.indexOf(k)!==-1||d.indexOf(k)!==-1;});});if(f2.length)pool=f2;}
    if(priceFilter){var f3=pool.filter(function(r){return priceFilter.indexOf(r.priceTier)!==-1;});if(f3.length)pool=f3;}
    if(sizeFilter){var f4=pool.filter(function(r){return(r.peopleCategory||[]).indexOf(sizeFilter)!==-1;});if(f4.length)pool=f4;}
    return pool;
  }

  /* ---- FORMAT ---- */
  function statusMarker(r, timeCtx) {
    var hApi = hoursApi();
    if (!hApi) return '';
    var open = hApi.isOpenAtMinutes(r, timeCtx.minutes, timeCtx.dayOfWeek);
    return open
      ? '[[ai-open:🟢 Đang mở lúc ' + timeCtx.timeLabel + ']]'
      : '[[ai-closed:🔴 Đóng cửa lúc ' + timeCtx.timeLabel + ']]';
  }

  function detailBtnMarker(r, timeCtx, label) {
    var mins = timeCtx ? timeCtx.minutes : '';
    return '[[ai-detail:' + r.id + '|' + mins + '|' + (label || '📖 Xem quán') + ']]';
  }

  function fmtOne(r, timeCtx){
    var d=(r.signatureDishes||[]).slice(0,2).join(', ');
    var b=(r.specialBadges||[]).slice(0,1).map(function(x){return '✦ '+x;}).join('');
    var hours=r.openingHours||r.openHours||'07:00 - 22:00';
    var status=timeCtx?statusMarker(r,timeCtx)+' ':'';
    return '🍽️ **'+r.name+'**\n'+status+'⏰ '+hours+'\n📍 '+r.address+'\n⭐ '+r.rating+' ('+(Number(r.reviews)||0).toLocaleString('vi-VN')+' đánh giá)  ·  '+r.priceRange+'\n🥢 '+d+(b?'\n'+b:'')+'\n🗺 [Xem Google Maps]('+r.mapsUrl+')  '+detailBtnMarker(r,timeCtx,'📖 Xem chi tiết');
  }
  function fmtShort(r,i,timeCtx){
    var d=(r.signatureDishes||[]).slice(0,1).join('');
    var hours=r.openingHours||r.openHours||'07:00 - 22:00';
    var status=timeCtx?statusMarker(r,timeCtx)+' ':'';
    return (i+1)+'. **'+r.name+'** — '+r.district+'  ·  '+r.priceRange+'\n   '+status+'⏰ '+hours+'\n   📌 '+d+'  ·  ⭐'+r.rating+'  '+detailBtnMarker(r,timeCtx,'📖 Xem quán');
  }

  /* ---- RESPONSE TEMPLATES ---- */
  var TOTAL_SPOTS_COUNT = (typeof RESTAURANTS_DATA !== 'undefined' && RESTAURANTS_DATA.length) ? RESTAURANTS_DATA.length : 2400;
  var GREET=['🏮 Chào chị/anh! Em là **Cô Lan**, trợ lý ẩm thực Hà Nội.\nEm thuộc lòng **' + TOTAL_SPOTS_COUNT + ' quán ngon** khắp 12 quận Hà Nội (mỗi quận 200 quán tuyển chọn, đầy đủ Phở, Bún, Chè, Ăn vặt, Món Hàn, Món Trung). Hỏi em về quán ăn, khu vực, giá tiền, dịp ăn — em gợi ý ngay! 😊','🌸 Ôi chào ạ! Em Cô Lan đây~ Hôm nay thèm món gì?\nCứ nói bừa ra là em biết ngay nên đi đâu! 🍜','🏮 Dạ chào ạ! Em là Cô Lan — cẩm nang ẩm thực 36 phố phường!\nChị/anh muốn **ăn vặt, chè**, **đồ Hàn, đồ Trung**, hay **hẹn hò**? Em sẵn sàng! ✨'];
  var THANKS=['🙏 Dạ không có gì! Chúc chị/anh bữa ăn thật ngon miệng~ 🌸','💫 Vâng! Chúc ăn ngon! Cần gợi ý cứ nhắn em nha 🏮','😊 Hehe dạ! Hẹn gặp lại ở những bữa ăn thú vị~ 🍜'];
  var OFF=['😅 Cái này ngoài vùng phủ sóng của em rồi! Em chỉ chuyên về ẩm thực Hà Nội thôi 🍜\nThử hỏi em về quán ăn đi!','🏮 Em chịu ạ! Em chỉ giỏi chuyện "hôm nay ăn gì" 😄\nMuốn em gợi ý quán không?'];
  var HELP=['🤔 Chị/anh hỏi thêm nhé! Ví dụ:\n• **"Phở ngon ở Hoàn Kiếm"**\n• **"Ăn sáng ở đâu?"**\n• **"Hẹn hò buổi tối đi đâu?"**\n• **"Quán rẻ mà ngon?"**\nEm gợi ý ngay ạ! 😊'];

  var DINTRO={
    d_hk:['🏮 Phố cổ Hoàn Kiếm — đây là những "must-try":','🧧 Hoàn Kiếm mà ghé mấy quán này thì cả ngày vui:'],
    d_th:['🌊 Tây Hồ gió thổi, ghé mấy quán này chill lắm:','🍃 Hồ Tây mùa này đẹp, tranh thủ ăn thử:'],
    d_dd:['🏙️ Đống Đa có mấy quán ngon lâu năm:','🥢 Khu Đống Đa em gợi ý mấy chỗ ưng bụng:'],
    d_hbt:['📍 Hai Bà Trưng có mấy quán em hay nghe khen:','🌺 Khu Hai Bà Trưng thử mấy chỗ này nha:'],
    d_bd:['🏛️ Ba Đình yên tĩnh mà cũng nhiều quán ngon:','🌿 Khu Ba Đình em gợi ý:'],
    d_cg:['🎓 Cầu Giấy khu sinh viên, ngon mà hợp túi tiền:','📚 Dân Cầu Giấy khoái mấy chỗ này lắm:'],
    d_hd:['🌆 Hà Đông phát triển lắm, mấy quán này cực xịn:','🏘️ Chị/anh ở Hà Đông thì mấy quán này gần lắm:'],
    d_tx:['🛣️ Thanh Xuân em biết mấy chỗ chị/anh thích:','🌸 Khu Thanh Xuân thử mấy chỗ này nha:'],
    d_lb:['🌉 Long Biên bên kia cầu có mấy quán không tệ:','🏞️ Khu Long Biên em gợi ý:'],
    d_hm:['🌳 Hoàng Mai em hay nghe khen mấy chỗ này:','📌 Khu Hoàng Mai thử mấy quán này nha:'],
    d_ntl:['🏟️ Nam Từ Liêm khu Mỹ Đình - Mễ Trì nhiều quán ngon hiện đại:','🏙️ Khu Nam Từ Liêm thử mấy quán này nha:'],
    d_btl:['🌲 Bắc Từ Liêm rộng rãi, nhiều quán ngon đậm đà:','📌 Khu Bắc Từ Liêm em gợi ý mấy chỗ này:'],
    d_uni:['🎓 Khu trường ĐH (Cầu Giấy, Đống Đa) — sinh viên khoái mấy chỗ này:','📖 Dân sinh viên hay rủ nhau đến mấy quán này:'],
  };
  var OINTRO={
    breakfast:['🌅 Sáng Hà Nội mà ghé mấy quán này thì cả ngày vui:','☀️ Ăn sáng chuẩn Hà Nội, em gợi ý:'],
    lunch:['🕐 Bữa trưa gọn ngon, chị/anh thử mấy chỗ này:','⚡ Trưa ăn nhanh mà ngon:'],
    quick:['⚡ Ăn nhanh mà vẫn ngon, đây nha:'],
    dinner:['🌙 Bữa tối ấm cúng, em gợi ý:','✨ Tối nay thưởng thức ở đây nha:'],
    late:['🌃 Khuya rồi mà còn thèm? Mấy chỗ này cứu đói cực ngon:','🌙 Mấy quán này khuya vẫn mở, ngon lắm:'],
    date:['💑 Hẹn hò cần chỗ có không khí đúng không! Em gợi ý:','🌹 Lãng mạn, ấm áp — mấy quán này cực hợp:'],
    family:['👨‍👩‍👧 Đi cả gia đình cần chỗ rộng, em gợi ý:','🏮 Họp mặt cả nhà, mấy chỗ này không thiếu gì:'],
    friends:['🥂 Tụ tập bạn bè thì mấy chỗ này cực vui:','🎉 Hội bạn thì ghé mấy quán này:'],
    party:['🎊 Tiệc tùng sinh nhật — mấy quán này không thiếu gì:','🥳 Chúc mừng! Mấy chỗ này tiệc tùng cực xịn:'],
    drinks:['🍺 Nhậu cuối tuần, mấy chỗ này vừa ngon vừa có không khí:','🍻 Muốn nhậu? Em mách mấy chỗ chill lắm:'],
  };
  var PINTRO={cheap:['💰 Giá bình dân mà chất, em gợi ý:','🤑 Tiết kiệm mà vẫn ngon — đây nha:'],luxury:['👑 Sang trọng đẳng cấp — xứng đáng "flex" một bữa:','✨ Fine dining Hà Nội? Đây ạ:'],mid:['🍽️ Tầm trung, không rẻ không đắt mà ngon là chính:']};
  var CATINTRO={f_pho:['🍜 Phở Hà Nội — linh hồn ẩm thực kinh kỳ! Mấy chỗ này chuẩn:'],f_bun:['🍝 Bún Hà Nội đa dạng lắm! Em gợi ý:'],f_lau:['🫕 Lẩu Hà Nội đủ kiểu, nước dùng cực ngọt:'],f_sea:['🦐 Hải sản tươi ngon giữa lòng Hà Nội:'],f_cafe:['☕ Cà phê Hà Nội có hồn lắm! Mấy quán này chị/anh phải thử:'],f_sweet:['🍧 Quán chè & ăn vặt Hà Nội ngon nức tiếng trên Google Maps đây ạ:'],f_kr:['🇰🇷 Quán ăn & thịt nướng Hàn Quốc chuẩn vị Seoul tại Hà Nội:'],f_cn:['🥟 Nhà hàng Trung Hoa, Dimsum & Lẩu Trùng Khánh cực đỉnh tại Hà Nội:']};

  function buildIntro(intents){
    var dk=null;
    Object.keys(DINTRO).forEach(function(k){if(intents.indexOf(k)!==-1)dk=k;});
    if(dk&&DINTRO[dk])return rand(DINTRO[dk]);
    var ck=null;
    Object.keys(CATINTRO).forEach(function(k){if(intents.indexOf(k)!==-1&&!ck)ck=k;});
    if(ck&&CATINTRO[ck])return rand(CATINTRO[ck]);
    if(intents.indexOf('cheap')!==-1)return rand(PINTRO.cheap);
    if(intents.indexOf('luxury')!==-1)return rand(PINTRO.luxury);
    if(intents.indexOf('mid')!==-1)return rand(PINTRO.mid);
    var oks=['breakfast','lunch','quick','dinner','late','date','family','friends','party','drinks'];
    var ok=null;
    oks.forEach(function(k){if(intents.indexOf(k)!==-1&&!ok)ok=k;});
    if(ok&&OINTRO[ok])return rand(OINTRO[ok]);
    return rand(['🗺 Em tìm thấy mấy quán này phù hợp:','🍽️ Đây là mấy quán em gợi ý:','✨ Chị/anh thử mấy chỗ này nha:']);
  }

  function respond(msg, intentsOpt) {
    var intents = Array.isArray(intentsOpt) ? intentsOpt : detectIntents(msg);

    // 1. Strict domain guard: any non-restaurant / unknown / off-topic question MUST return exact OFF_TOPIC_REPLY
    if (!isRestaurantRelated(msg, intents)) {
      return OFF_TOPIC_REPLY;
    }

    var data = db();
    if (!data.length) return 'Dữ liệu chưa tải, thử tải lại trang ạ.';

    if (intents.indexOf('greet') !== -1 && !hasFoodOrRestaurantSignal(msg, intents)) return rand(GREET);
    if (intents.indexOf('thanks') !== -1 && !hasFoodOrRestaurantSignal(msg, intents)) return rand(THANKS);

    var hApi = hoursApi();
    var timeCtx = extractTimeFromQuery(msg);

    // 2. Specific restaurant lookup (open vs closed + up to 3 similar open alternatives)
    var mentioned = findMentionedRestaurant(msg);
    if (mentioned && hApi) {
      var isOpenAtTime = hApi.isOpenAtMinutes(mentioned, timeCtx.minutes, timeCtx.dayOfWeek);
      if (isOpenAtTime) {
        return '✅ **' + mentioned.name + '** hiện đang mở cửa vào lúc **' + timeCtx.timeLabel + '**!\n\n' + fmtOne(mentioned, timeCtx);
      }

      var simRes = hApi.findSimilarOpenRestaurants(mentioned, {
        targetMinutes: timeCtx.minutes,
        targetDayOfWeek: timeCtx.dayOfWeek,
        timeLabel: timeCtx.timeLabel,
        limit: 3
      });
      var hoursText = mentioned.openingHours || mentioned.openHours || '07:00 - 22:00';
      var closedHeader = '⏰ **' + mentioned.name + '** [[ai-closed:🔴 Đóng cửa lúc ' + timeCtx.timeLabel + ']] (giờ phục vụ: **' + hoursText + '**)  ' + detailBtnMarker(mentioned, timeCtx, '📖 Xem quán');
      var filterNote = '';
      if (simRes.hasActiveFilters) {
        filterNote = simRes.matchedActiveFilters
          ? '\n🔎 _Đang giữ đúng bộ lọc của bạn: ' + simRes.activeFilterSummary + '_'
          : '\n🔎 _' + simRes.relaxedReason + '_';
      }
      if (simRes.items.length) {
        var altLines = simRes.items.map(function (entry, idx) {
          var reasonStr = entry.reasons && entry.reasons.length ? ' (' + entry.reasons.join(', ') + ')' : '';
          return fmtShort(entry.restaurant, idx, timeCtx) + (reasonStr ? '\n   ✨ _' + reasonStr.trim() + '_' : '');
        }).join('\n\n');
        return closedHeader + '\n\n🟢 **Gợi ý ' + simRes.items.length + ' quán tương tự đang mở cửa lúc ' + timeCtx.timeLabel + ':**' + filterNote + '\n\n' + altLines;
      }
      return closedHeader + '\n\nHiện tại chưa tìm thấy quán tương tự đang mở lúc ' + timeCtx.timeLabel + '. Chị/anh thử chọn khung giờ khác nhé!';
    }

    var brandMatches = (!mentioned) ? findBrandRestaurants(msg) : [];
    if (brandMatches.length > 0 && hApi) {
      var brandOpen = brandMatches.filter(function (r) { return hApi.isOpenAtMinutes(r, timeCtx.minutes, timeCtx.dayOfWeek); });
      if (brandOpen.length > 0) {
        var topBrands = brandOpen.slice().sort(function (a, b) { return (b.rating - a.rating) || (b.reviews - a.reviews); }).slice(0, 4);
        if (topBrands.length === 1) {
          return '📍 Em tìm thấy quán phù hợp đang mở lúc **' + timeCtx.timeLabel + '**:\n\n' + fmtOne(topBrands[0], timeCtx);
        }
        return '📍 Em tìm thấy **' + brandOpen.length + ' cơ sở** đang mở lúc **' + timeCtx.timeLabel + '**:\n\n' + topBrands.map(function (item, idx) { return fmtShort(item, idx, timeCtx); }).join('\n\n') + '\n\n💡 _Bấm "Xem quán" để xem địa chỉ chi tiết & đặt món ạ!_';
      }
      var firstClosed = brandMatches[0];
      var brandSim = hApi.findSimilarOpenRestaurants(firstClosed, {
        targetMinutes: timeCtx.minutes,
        targetDayOfWeek: timeCtx.dayOfWeek,
        timeLabel: timeCtx.timeLabel,
        limit: 3
      });
      var brandClosedMsg = '⏰ **' + firstClosed.name + '** [[ai-closed:🔴 Đóng cửa lúc ' + timeCtx.timeLabel + ']] (giờ phục vụ: **' + (firstClosed.openingHours || '07:00 - 22:00') + '**)  ' + detailBtnMarker(firstClosed, timeCtx, '📖 Xem quán');
      if (brandSim.items.length) {
        return brandClosedMsg + '\n\n🟢 **Gợi ý quán tương tự đang mở lúc ' + timeCtx.timeLabel + ':**\n\n' + brandSim.items.map(function (entry, idx) { return fmtShort(entry.restaurant, idx, timeCtx); }).join('\n\n');
      }
      return brandClosedMsg;
    }

    // 3. Random pick (prioritize restaurants OPEN at target time)
    if (intents.indexOf('random') !== -1) {
      var openData = hApi ? data.filter(function (r) { return hApi.isOpenAtMinutes(r, timeCtx.minutes, timeCtx.dayOfWeek); }) : data;
      var randPool = openData.length ? openData : data;
      var r = pick(randPool, 1)[0];
      return rand(['🎲 Thôi để em chọn giúp! Lúc **' + timeCtx.timeLabel + '** thử quán đang mở này nhé:','✨ Nhắm mắt bắt ngẫu nhiên quán đang mở lúc **' + timeCtx.timeLabel + '**:','🏮 Cô Lan mách nhỏ một quán đang mở cực ngon:']) + '\n\n' + fmtOne(r, timeCtx);
    }

    // 4. Filter pool by query intents + active page filters (when compatible) + OPEN at timeCtx
    var pool = applyFilters(intents);
    var fApi = filterStateApi();
    if (fApi && fApi.hasActiveFilters()) {
      var fs = fApi.getState();
      var activeFiltered = pool.filter(function (item) {
        if (fs.district && fs.district !== 'all' && item.district !== fs.district) return false;
        if (fs.priceTier && fs.priceTier !== 'all' && item.priceTier !== fs.priceTier) return false;
        if (fs.peopleCategory && fs.peopleCategory !== 'all' && (item.peopleCategory || []).indexOf(fs.peopleCategory) === -1) return false;
        if (fs.occasion && fs.occasion !== 'all' && (item.occasions || []).indexOf(fs.occasion) === -1) return false;
        return true;
      });
      if (activeFiltered.length) pool = activeFiltered;
    }

    if (intents.indexOf('top') !== -1) {
      if (!pool.length) pool = data;
      var openTopPool = hApi ? pool.filter(function (r) { return hApi.isOpenAtMinutes(r, timeCtx.minutes, timeCtx.dayOfWeek); }) : pool;
      var topSource = openTopPool.length ? openTopPool : pool;
      var top = topSource.slice().sort(function (a, b) { return (b.rating - a.rating) || (b.reviews - a.reviews); }).slice(0, 4);
      var topPrefix = openTopPool.length
        ? '⭐ Những quán đánh giá cao nhất đang mở lúc **' + timeCtx.timeLabel + '**:'
        : '⭐ Những quán đánh giá cao nhất (lưu ý giờ phục vụ lúc **' + timeCtx.timeLabel + '**):';
      return topPrefix + '\n\n' + top.map(function (item, idx) { return fmtShort(item, idx, timeCtx); }).join('\n\n') + '\n\n💡 _Bấm "Xem quán" để mở thực đơn & đặt món ngay ạ!_';
    }

    var noMatch = (pool === data || !pool.length) && intents[0] !== 'unknown';
    if (!pool.length) pool = data;

    var openFiltered = hApi ? pool.filter(function (r) { return hApi.isOpenAtMinutes(r, timeCtx.minutes, timeCtx.dayOfWeek); }) : pool;
    var finalPool = openFiltered.length ? openFiltered : (hApi ? data.filter(function (r) { return hApi.isOpenAtMinutes(r, timeCtx.minutes, timeCtx.dayOfWeek); }) : pool);
    if (!finalPool.length) finalPool = pool;

    var intro = buildIntro(intents);
    if (!openFiltered.length && hApi) {
      intro = '⏰ Lúc **' + timeCtx.timeLabel + '** các quán đúng tiêu chí đang đóng cửa, em gợi ý các quán **đang mở** gần nhất lúc ' + timeCtx.timeLabel + ':';
    } else if (noMatch) {
      intro = '🤔 Không tìm được 100%, nhưng mấy quán đang mở lúc **' + timeCtx.timeLabel + '** này cũng rất hợp ý chị/anh:';
    } else {
      intro += ' _(Lọc theo giờ **' + timeCtx.timeLabel + '**)_';
    }

    if (finalPool.length === 1) return intro + '\n\n' + fmtOne(finalPool[0], timeCtx);
    var picks = pick(finalPool, finalPool.length <= 2 ? 1 : 4);
    if (picks.length === 1) return intro + '\n\n' + fmtOne(picks[0], timeCtx);
    return intro + '\n\n' + picks.map(function (item, idx) { return fmtShort(item, idx, timeCtx); }).join('\n\n') + '\n\n💡 _Bấm "Xem quán" hoặc hỏi tên quán bất kỳ để kiểm tra giờ mở cửa ạ!_';
  }

  window.HNCoLanAI = {
    OFF_TOPIC_REPLY: OFF_TOPIC_REPLY,
    detectIntents: detectIntents,
    isRestaurantRelated: isRestaurantRelated,
    respond: respond
  };

  if (!btnOpen || !panel || !messagesEl) return;

  /* ---- RENDER ---- */
  function getTime(){ return new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}); }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function renderText(raw){
    var s=esc(raw);
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/_([^_]+)_/g,'<em>$1</em>');
    s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" class="ai-link">$1 ↗</a>');
    s=s.replace(/\[\[ai-open:([^\]]+)\]\]/g,'<span class="ai-status-open">$1</span>');
    s=s.replace(/\[\[ai-closed:([^\]]+)\]\]/g,'<span class="ai-status-closed">$1</span>');
    s=s.replace(/\[\[ai-detail:(\d+)\|([^|]*)\|([^\]]+)\]\]/g,'<button type="button" class="ai-open-detail-btn" data-ai-open-id="$1" data-ai-open-mins="$2">$3</button>');
    s=s.replace(/\n/g,'<br>');
    return s;
  }
  function appendMsg(role,text,error){
    var isAI=role==='ai';
    var wrap=document.createElement('div'); wrap.className='ai-msg ai-msg-'+(isAI?'ai':'user');
    var av=document.createElement('div'); av.className='ai-msg-avatar'; av.textContent=isAI?'🏮':'😊';
    var bub=document.createElement('div'); bub.className='ai-bubble'+(error?' ai-bubble-error':'');
    bub.innerHTML=renderText(text);
    wrap.appendChild(av); wrap.appendChild(bub); messagesEl.appendChild(wrap);
    var ts=document.createElement('div'); ts.className='ai-msg-time'; ts.textContent=getTime(); messagesEl.appendChild(ts);
    requestAnimationFrame(function(){messagesEl.scrollTop=messagesEl.scrollHeight;});
  }
  var typingEl=null;
  function showTyping(){
    typingEl=document.createElement('div'); typingEl.className='ai-msg ai-msg-ai ai-typing';
    typingEl.innerHTML='<div class="ai-msg-avatar">🏮</div><div class="ai-typing-dots"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';
    messagesEl.appendChild(typingEl); messagesEl.scrollTop=messagesEl.scrollHeight;
  }
  function hideTyping(){if(typingEl){typingEl.remove();typingEl=null;}}
  function autoResize(){textarea.style.height='auto';textarea.style.height=Math.min(textarea.scrollHeight,100)+'px';}

  /* ---- SEND ---- */
  function send(text){
    text=(text||'').trim(); if(!text||isBusy) return;
    var c=document.getElementById('aiChips'); if(c) c.style.display='none';
    appendMsg('user',text); textarea.value=''; autoResize();
    isBusy=true; btnSend.disabled=true;
    if(statusDot) statusDot.textContent='● Đang soạn...';
    showTyping();
    setTimeout(function(){
      try{
        var intents=detectIntents(text);
        var reply=respond(text,intents);
        hideTyping(); appendMsg('ai',reply);
      }catch(e){ hideTyping(); appendMsg('ai','⚠️ Có lỗi nhỏ, chị/anh thử hỏi lại nhé!',true); }
      finally{
        isBusy=false; btnSend.disabled=false;
        if(statusDot) statusDot.textContent='● Trực tuyến · Trợ lý thông minh';
      }
    }, 300+Math.random()*400);
  }

  /* ---- PANEL ---- */
  function openPanel(){
    isOpen=true; panel.classList.add('ai-panel-open');
    btnOpen.setAttribute('aria-expanded','true');
    if(unreadBadge) unreadBadge.hidden=true;
    setTimeout(function(){textarea.focus();},300);
    if(!messagesEl.children.length)
      appendMsg('ai','🏮 Xin chào! Em là **Cô Lan**, trợ lý ẩm thực Hà Nội.\n\nEm thuộc lòng **' + (db().length || 2400) + ' quán ngon** trên Google Maps khắp 12 quận Hà Nội — từ Phở Bát Đàn, Chè Bốn Mùa, ăn vặt phố cổ đến BBQ Hàn Quốc và Dimsum Trung Hoa. Chị/anh muốn ăn gì hôm nay? 🍜');
  }
  function closePanel(){
    isOpen=false; panel.classList.remove('ai-panel-open');
    btnOpen.setAttribute('aria-expanded','false');
  }

  /* ---- EVENTS ---- */
  messagesEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-ai-open-id]');
    if (!btn) return;
    var id = parseInt(btn.getAttribute('data-ai-open-id'), 10);
    var minsAttr = btn.getAttribute('data-ai-open-mins');
    var mins = (minsAttr !== null && minsAttr !== '') ? parseInt(minsAttr, 10) : undefined;
    if (!isNaN(id) && typeof window.openRestaurantDetail === 'function') {
      window.openRestaurantDetail(id, isNaN(mins) ? undefined : mins);
    }
  });

  btnOpen.addEventListener('click',function(){if(isOpen)closePanel();else openPanel();});
  if(btnClose) btnClose.addEventListener('click',closePanel);
  if(btnClear) btnClear.addEventListener('click',function(){
    if(!window.confirm('Xóa toàn bộ lịch sử trò chuyện?'))return;
    messagesEl.innerHTML='';
    var c=document.getElementById('aiChips'); if(c) c.style.display='';
    appendMsg('ai','🏮 Xin chào! Em là **Cô Lan**. Chị/anh muốn ăn gì hôm nay? 🍜');
  });
  if(btnInfo) btnInfo.addEventListener('click',function(){
    window.alert('🏮 Cô Lan — Trợ Lý Ẩm Thực Hà Nội\n\n✅ Offline Engine — không cần API key\n📊 Dữ liệu: ' + (db().length || 2400) + ' quán ăn Hà Nội xác thực trên Google Maps (200 quán/quận)\n🧠 Hiểu: khu vực, bữa ăn, chè & ăn vặt, đồ Hàn, đồ Trung, giá tiền, dịp ăn');
  });
  btnSend.addEventListener('click',function(){send(textarea.value);});
  textarea.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(textarea.value);}});
  textarea.addEventListener('input',autoResize);
  chips.forEach(function(chip){
    chip.addEventListener('click',function(){if(!isOpen)openPanel();send(chip.dataset.msg||chip.textContent);});
  });
  document.addEventListener('click',function(e){
    if(isOpen&&!panel.contains(e.target)&&e.target!==btnOpen&&!btnOpen.contains(e.target))closePanel();
  },true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen)closePanel();});
  setTimeout(function(){if(!isOpen&&unreadBadge)unreadBadge.hidden=false;},4000);

})(); /* end Co Lan Offline AI Engine */


/* ==========================================================================
   USER AUTHENTICATION & ACCOUNT MODULE (ĐĂNG NHẬP & TẠO TÀI KHOẢN THỰC KHÁCH)
   Lưu trữ tài khoản trên trình duyệt, đồng bộ Sổ Tay Quán Quen theo từng tài khoản
   ========================================================================== */
(function () {
  'use strict';

  var USERS_KEY = 'hanoi_phovi_users_v1';
  var SESSION_KEY = 'hanoi_phovi_session_v1';
  var FAV_KEY = 'hanoi_phovi_favorites';

  var $ = function (id) { return document.getElementById(id); };

  var modal = $('authModal');
  var guestActions = $('authGuestActions');
  var userChip = $('authUserChip');
  var userNameEl = $('authUserName');
  var avatarBadge = $('authAvatarBadge');

  var tabsBar = $('authTabsBar');
  var tabBtnLogin = $('tabBtnLogin');
  var tabBtnRegister = $('tabBtnRegister');
  var alertBox = $('authAlertBox');

  var formLogin = $('formLogin');
  var formRegister = $('formRegister');
  var viewProfile = $('viewProfile');

  if (!modal) return;

  /* ---- Helpers: Standards-Compliant SHA-256 (WebCrypto + Pure JS Fallback) ---- */
  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function toUtf8Bytes(str) {
    var s = String(str || '');
    if (typeof window !== 'undefined' && typeof window.TextEncoder === 'function') {
      var enc = new window.TextEncoder().encode(s);
      var res = [];
      for (var k = 0; k < enc.length; k++) res.push(enc[k]);
      return res;
    }
    var utf8 = unescape(encodeURIComponent(s));
    var out = [];
    for (var i = 0; i < utf8.length; i++) out.push(utf8.charCodeAt(i));
    return out;
  }

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256Sync(str) {
    var bytes = toUtf8Bytes(str);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    var w = new Array(64);
    for (var offset = 0; offset < bytes.length; offset += 64) {
      for (var i = 0; i < 16; i++) {
        var idx = offset + i * 4;
        w[i] = ((bytes[idx] << 24) | (bytes[idx + 1] << 16) | (bytes[idx + 2] << 8) | bytes[idx + 3]) | 0;
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ ((~e) & g);
        var temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hexOut = '';
    for (var m = 0; m < 8; m++) {
      hexOut += ('00000000' + (H[m] >>> 0).toString(16)).slice(-8);
    }
    return hexOut;
  }

  function sha256(str) {
    try {
      if (window.crypto && window.crypto.subtle && typeof window.TextEncoder === 'function') {
        var data = new window.TextEncoder().encode(String(str || ''));
        return window.crypto.subtle.digest('SHA-256', data).then(function (buf) {
          var arr = new Uint8Array(buf);
          var hex = '';
          for (var i = 0; i < arr.length; i++) hex += ('00' + arr[i].toString(16)).slice(-2);
          return hex;
        }).catch(function () {
          return sha256Sync(str);
        });
      }
    } catch (e) {}
    return Promise.resolve(sha256Sync(str));
  }

  /* ---- Helpers: Standards-Compliant Gmail & Password Validation ---- */
  var FAKE_LOCAL_BLOCKLIST = {
    test: 1, tester: 1, testing: 1, testuser: 1, test123: 1, test1234: 1,
    fake: 1, fakemail: 1, fakeuser: 1, dummy: 1, example: 1, sample: 1,
    admin: 1, administrator: 1, root: 1, user: 1, username: 1, guest: 1,
    nobody: 1, noname: 1, noone: 1, 'null': 1, 'undefined': 1, unknown: 1,
    invalid: 1, qwerty: 1, qwertyui: 1, asdfgh: 1, zxcvbn: 1, abcdef: 1,
    abcdefg: 1, abcdefgh: 1, abc123: 1, '123456': 1, '1234567': 1,
    '12345678': 1, '123456789': 1, '1234567890': 1, '000000': 1, '111111': 1,
    aaaaaa: 1, password: 1, pass123: 1, demo123: 1, email: 1, gmail: 1,
    thuckhach: 1
  };

  function validateGmail(rawEmail) {
    var email = String(rawEmail || '').trim().toLowerCase();
    if (!email) {
      return { valid: false, normalized: '', canonical: '', error: 'Vui lòng nhập địa chỉ Gmail (@gmail.com).' };
    }
    if (/[^\x20-\x7E]/.test(email) || /\s/.test(email)) {
      return { valid: false, normalized: email, canonical: '', error: 'Gmail chỉ được chứa ký tự ASCII, không khoảng trắng hay dấu tiếng Việt.' };
    }
    var parts = email.split('@');
    if (parts.length !== 2 || parts[1] !== 'gmail.com') {
      return { valid: false, normalized: email, canonical: '', error: 'Chỉ chấp nhận địa chỉ Gmail thật có đuôi @gmail.com.' };
    }
    var local = parts[0];
    if (local.length < 6 || local.length > 30) {
      return { valid: false, normalized: email, canonical: '', error: 'Tên tài khoản Gmail (trước @gmail.com) phải dài từ 6 đến 30 ký tự.' };
    }
    if (!/^[a-z0-9.]+$/.test(local) || local.charAt(0) === '.' || local.charAt(local.length - 1) === '.' || local.indexOf('..') !== -1) {
      return { valid: false, normalized: email, canonical: '', error: 'Gmail chỉ gồm chữ thường a-z, số 0-9, dấu chấm (.) và không đặt dấu chấm liên tiếp hay ở đầu/cuối.' };
    }
    var canonicalLocal = local.replace(/\./g, '');
    if (canonicalLocal.length < 6) {
      return { valid: false, normalized: email, canonical: '', error: 'Tên Gmail (không tính dấu chấm) phải có ít nhất 6 ký tự thực.' };
    }
    if (!/[a-z]/.test(canonicalLocal)) {
      return { valid: false, normalized: email, canonical: '', error: 'Gmail hợp lệ cần có ít nhất một chữ cái (không thể toàn chữ số).' };
    }
    if (/^(.)\1+$/.test(canonicalLocal) || FAKE_LOCAL_BLOCKLIST[local] || FAKE_LOCAL_BLOCKLIST[canonicalLocal]) {
      return { valid: false, normalized: email, canonical: '', error: 'Vui lòng nhập Gmail cá nhân thật, không dùng tài khoản mẫu/ảo (test, fake, admin...).' };
    }
    return {
      valid: true,
      normalized: email,
      canonical: canonicalLocal + '@gmail.com'
    };
  }

  function checkGmailExistence(rawEmail) {
    var v = validateGmail(rawEmail);
    if (!v.valid) {
      return Promise.resolve({ ok: false, status: 'invalid_format', message: v.error, validation: v });
    }
    if (typeof fetch !== 'function') {
      return Promise.resolve({ ok: true, status: 'offline_fallback', message: '✓ Định dạng Gmail hợp lệ (môi trường cục bộ)', validation: v });
    }
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { try { controller.abort(); } catch (e) {} }, 2500) : null;
    return fetch('https://dns.google/resolve?name=gmail.com&type=MX', {
      method: 'GET',
      signal: controller ? controller.signal : undefined
    }).then(function (resp) {
      if (timer) clearTimeout(timer);
      if (!resp || !resp.ok) throw new Error('DNS HTTP ' + (resp ? resp.status : 'error'));
      return resp.json();
    }).then(function (json) {
      var hasGoogleMx = json && json.Status === 0 && Array.isArray(json.Answer) && json.Answer.some(function (a) {
        return String(a.data || '').toLowerCase().indexOf('gmail-smtp-in.l.google.com') !== -1;
      });
      if (hasGoogleMx) {
        return { ok: true, status: 'mx_verified', message: '✓ Gmail hợp lệ & máy chủ MX Google đang hoạt động', validation: v };
      }
      return { ok: true, status: 'offline_fallback', message: '✓ Gmail đúng chuẩn Google (MX kiểm tra cục bộ)', validation: v };
    }).catch(function () {
      if (timer) clearTimeout(timer);
      return { ok: true, status: 'offline_fallback', message: '✓ Gmail đạt chuẩn @gmail.com (offline fallback — dùng xác thực OTP)', validation: v };
    });
  }

  function validatePassword(pw) {
    var s = typeof pw === 'string' ? pw : '';
    var hasLen = s.length >= 8;
    var hasUpper = /[A-Z]/.test(s);
    var hasSpecial = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(s);
    var valid = hasLen && hasUpper && hasSpecial;

    var score = 0;
    if (hasLen) score += 35;
    if (s.length >= 11) score += 15;
    if (hasUpper) score += 25;
    if (hasSpecial) score += 20;
    if (/[0-9]/.test(s) && /[a-z]/.test(s)) score += 5;

    var error = '';
    if (!hasLen) error = 'Mật khẩu phải dài ít nhất 8 ký tự.';
    else if (!hasUpper) error = 'Mật khẩu phải có ít nhất 1 chữ cái viết HOA (A-Z).';
    else if (!hasSpecial) error = 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...).';

    var label = 'Chưa đạt yêu cầu bảo mật';
    if (valid && score >= 90) label = 'Độ mạnh: Rất mạnh ✓';
    else if (valid) label = 'Độ mạnh: Đạt chuẩn ✓';
    else if (s.length > 0) label = error;

    return {
      valid: valid,
      hasLen: hasLen,
      hasUpper: hasUpper,
      hasSpecial: hasSpecial,
      score: Math.min(100, score),
      label: label,
      error: error
    };
  }

  /* ---- Helpers: Seed Accounts & Storage ---- */
  var DEFAULT_DEMO_PASS = 'Hanoi@2026';
  var DEFAULT_DEMO_HASH = sha256Sync(DEFAULT_DEMO_PASS);

  function buildSeedUsers() {
    return [
      {
        id: 'demo_minhanh',
        fullName: 'Nguyễn Minh Anh',
        username: 'minhanh.hanoi@gmail.com',
        canonicalEmail: 'minhanhhanoi@gmail.com',
        passwordHash: DEFAULT_DEMO_HASH,
        district: 'Hoàn Kiếm',
        hobbies: 'Phở bò, Bún chả, Cafe Vintage',
        bio: 'Mê lượn phố cổ tìm quán phở gia truyền và cafe trứng sáng cuối tuần.',
        joinedAt: '18/11/2026',
        emailVerified: true,
        favorites: [1, 2, 5, 8]
      },
      {
        id: 'demo_tuanhung',
        fullName: 'Trần Tuấn Hưng',
        username: 'tuanhung.phoco@gmail.com',
        canonicalEmail: 'tuanhungphoco@gmail.com',
        passwordHash: DEFAULT_DEMO_HASH,
        district: 'Cầu Giấy',
        hobbies: 'Lẩu & Nướng, Đồ Hàn Quốc, Chả cá',
        bio: 'Thổ địa Cầu Giấy chuyên săn lẩu nướng ngon bổ rẻ cho hội bạn.',
        joinedAt: '19/11/2026',
        emailVerified: true,
        favorites: [10, 15, 22, 40]
      },
      {
        id: 'demo_thuckhach',
        fullName: 'Thực Khách Hà Thành',
        username: 'thuckhach.hanoi@gmail.com',
        canonicalEmail: 'thuckhachhanoi@gmail.com',
        passwordHash: DEFAULT_DEMO_HASH,
        district: 'Đống Đa',
        hobbies: 'Chè & Ăn vặt, Dimsum Trung Hoa, Bún ốc',
        bio: 'Tín đồ khám phá 2400 quán ngon khắp 12 quận Hà Nội.',
        joinedAt: '20/11/2026',
        emailVerified: true,
        favorites: [3, 12, 27, 66]
      }
    ];
  }

  function sanitizeSessionUser(u) {
    if (!u) return null;
    var copy = Object.assign({}, u);
    delete copy.password;
    delete copy.passwordHash;
    return copy;
  }

  function loadUsers() {
    var seeds = buildSeedUsers();
    try {
      var raw = localStorage.getItem(USERS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) {
        var changed = false;
        // Migrate old legacy demo_1 (@hanoiphovi.vn -> @gmail.com + SHA-256)
        list = list.map(function (u) {
          if (u && (u.id === 'demo_1' || String(u.username || '').toLowerCase() === 'thuckhach@hanoiphovi.vn')) {
            changed = true;
            return Object.assign({}, seeds[2], {
              fullName: u.fullName || seeds[2].fullName,
              avatarData: u.avatarData || '',
              favorites: Array.isArray(u.favorites) ? u.favorites : seeds[2].favorites,
              district: u.district || seeds[2].district,
              hobbies: u.hobbies || seeds[2].hobbies,
              facebook: u.facebook || '',
              bio: u.bio || seeds[2].bio
            });
          }
          if (u && u.password && !u.passwordHash) {
            changed = true;
            var migrated = Object.assign({}, u, {
              passwordHash: sha256Sync(u.password)
            });
            delete migrated.password;
            return migrated;
          }
          return u;
        });

        // Ensure all 3 seed demo accounts exist cleanly so quick switcher always works
        seeds.forEach(function (seed) {
          var exists = list.some(function (u) {
            return u && String(u.username || '').toLowerCase() === seed.username;
          });
          if (!exists) {
            list.push(seed);
            changed = true;
          }
        });

        if (changed) saveUsers(list);
        return list;
      }
    } catch (e) {}
    saveUsers(seeds);
    return seeds;
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {}
  }

  function getCurrentUser() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && String(parsed.username || '').toLowerCase() === 'thuckhach@hanoiphovi.vn') {
        parsed = Object.assign({}, parsed, {
          id: 'demo_thuckhach',
          username: 'thuckhach.hanoi@gmail.com',
          canonicalEmail: 'thuckhachhanoi@gmail.com'
        });
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function dispatchAuthChanged(user) {
    try {
      window.dispatchEvent(new CustomEvent('hn-auth-changed', { detail: { user: user || null } }));
    } catch (e) {}
  }

  function setCurrentUser(user, remember) {
    try {
      var safeUser = sanitizeSessionUser(user);
      if (!safeUser) {
        var tabRaw = sessionStorage.getItem(SESSION_KEY);
        var localRaw = localStorage.getItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        if (!tabRaw || !localRaw) {
          localStorage.removeItem(SESSION_KEY);
        } else {
          try {
            var tabU = JSON.parse(tabRaw);
            var locU = JSON.parse(localRaw);
            if (tabU && locU && String(tabU.username).toLowerCase() === String(locU.username).toLowerCase()) {
              localStorage.removeItem(SESSION_KEY);
            }
          } catch (err) {
            localStorage.removeItem(SESSION_KEY);
          }
        }
        dispatchAuthChanged(null);
        return;
      }

      var data = JSON.stringify(safeUser);
      if (remember === false) {
        // Lưu riêng trên tab hiện tại để mở 2 tab đăng nhập 2 Gmail khác nhau
        sessionStorage.setItem(SESSION_KEY, data);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.setItem(SESSION_KEY, data);
      }
      dispatchAuthChanged(safeUser);
    } catch (e) {}
  }

  function getActiveFavorites() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function syncFavoritesToUserAccount() {
    var cur = getCurrentUser();
    if (!cur) return;
    var favs = getActiveFavorites();
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === cur.username.toLowerCase()) {
        users[i].favorites = favs;
        cur.favorites = favs;
        break;
      }
    }
    saveUsers(users);
    var isTabOnly = !!sessionStorage.getItem(SESSION_KEY);
    setCurrentUser(cur, !isTabOnly);
  }

  /* ---- UI State & Alerts ---- */
  function showAlert(msg, type) {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = 'auth-alert ' + (type === 'success' ? 'success' : 'error');
    alertBox.hidden = false;
  }

  function clearAlert() {
    if (!alertBox) return;
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  function getInitial(name) {
    var clean = String(name || '').trim();
    if (!clean) return '🏮';
    var parts = clean.split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  function renderAvatarContent(el, userOrName, avatarData) {
    if (!el) return;
    if (avatarData) {
      el.innerHTML = '<img src="' + avatarData + '" alt="Avatar" />';
    } else {
      var nameStr = typeof userOrName === 'string' ? userOrName : (userOrName && userOrName.fullName);
      el.textContent = getInitial(nameStr);
    }
  }

  function updateHeaderAuthUI() {
    var user = getCurrentUser();
    if (user) {
      if (guestActions) guestActions.hidden = true;
      if (userChip) userChip.hidden = false;
      if (userNameEl) userNameEl.textContent = user.fullName;
      renderAvatarContent(avatarBadge, user, user.avatarData);
    } else {
      if (guestActions) guestActions.hidden = false;
      if (userChip) userChip.hidden = true;
    }
  }

  function escAuthHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderProfileQuickSwitch(curUser) {
    var listEl = $('profileQuickSwitchList');
    if (!listEl) return;
    var users = loadUsers();
    listEl.innerHTML = users.slice(0, 5).map(function (u) {
      var isActive = curUser && u.username.toLowerCase() === curUser.username.toLowerCase();
      var safeEmail = escAuthHtml(u.username);
      var safeName = escAuthHtml(u.fullName);
      return '<button type="button" class="quick-switch-btn' + (isActive ? ' active' : '') + '" data-switch-email="' + safeEmail + '" title="' + safeEmail + '">' +
        '<span>' + escAuthHtml(getInitial(u.fullName)) + '</span> ' +
        '<span>' + safeName + (isActive ? ' (đang dùng)' : '') + '</span>' +
      '</button>';
    }).join('');

    listEl.querySelectorAll('[data-switch-email]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetEmail = btn.getAttribute('data-switch-email');
        var target = loadUsers().find(function (u) { return u.username.toLowerCase() === targetEmail.toLowerCase(); });
        if (!target) return;
        // Nếu tab hiện tại đang cô lập bằng sessionStorage, giữ nguyên chế độ per-tab để không ghi đè tab khác
        var isAlreadyTabScoped = !!sessionStorage.getItem(SESSION_KEY);
        var remember = isAlreadyTabScoped ? false : (!$('loginRemember') ? false : $('loginRemember').checked);
        completeLoginSession(target, remember, false);
      });
    });
  }

  function switchAuthView(mode) {
    clearAlert();
    var titleEl = $('authModalTitle');
    var subEl = $('authModalSub');

    if (mode === 'profile') {
      var user = getCurrentUser();
      if (!user) { switchAuthView('login'); return; }
      if (tabsBar) tabsBar.hidden = true;
      if (formLogin) formLogin.hidden = true;
      if (formRegister) formRegister.hidden = true;
      if (viewProfile) viewProfile.hidden = false;
      if (titleEl) titleEl.textContent = 'THẺ THÀNH VIÊN THỰC KHÁCH';
      if (subEl) subEl.textContent = 'Quản lý Gmail đã xác thực, hồ sơ & đổi mật khẩu bảo mật';

      var favs = getActiveFavorites();
      renderAvatarContent($('profileAvatarLarge'), user, user.avatarData);
      if ($('btnRemoveAvatar')) $('btnRemoveAvatar').hidden = !user.avatarData;
      if ($('profileDisplayName')) $('profileDisplayName').textContent = user.fullName;
      if ($('profileUsername')) $('profileUsername').textContent = user.username + (user.emailVerified ? ' ✓ Đã xác thực' : '');
      if ($('profileFavCount')) $('profileFavCount').textContent = favs.length + ' quán';
      if ($('profileDistrict')) $('profileDistrict').textContent = user.district || 'Hoàn Kiếm';
      if ($('profileJoinedDate')) $('profileJoinedDate').textContent = user.joinedAt || 'Hôm nay';

      var fbLink = $('profileFbPreview');
      if (fbLink) {
        if (user.facebook) {
          fbLink.href = user.facebook.indexOf('http') === 0 ? user.facebook : 'https://' + user.facebook;
          fbLink.hidden = false;
        } else {
          fbLink.hidden = true;
        }
      }

      if ($('editFullName')) $('editFullName').value = user.fullName || '';
      if ($('editDistrict')) $('editDistrict').value = user.district || 'Hoàn Kiếm';
      if ($('editHobbies')) $('editHobbies').value = user.hobbies || '';
      if ($('editFacebook')) $('editFacebook').value = user.facebook || '';
      if ($('editBio')) $('editBio').value = user.bio || '';

      renderProfileQuickSwitch(user);
      return;
    }

    if (tabsBar) tabsBar.hidden = false;
    if (viewProfile) viewProfile.hidden = true;

    var isLogin = mode === 'login';
    if (tabBtnLogin) {
      tabBtnLogin.classList.toggle('active', isLogin);
      tabBtnLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    }
    if (tabBtnRegister) {
      tabBtnRegister.classList.toggle('active', !isLogin);
      tabBtnRegister.setAttribute('aria-selected', !isLogin ? 'true' : 'false');
    }
    if (formLogin) formLogin.hidden = !isLogin;
    if (formRegister) formRegister.hidden = isLogin;

    if (titleEl) titleEl.textContent = isLogin ? 'ĐĂNG NHẬP BẰNG GMAIL' : 'ĐĂNG KÝ TÀI KHOẢN GMAIL';
    if (subEl) {
      subEl.textContent = isLogin
        ? 'Nhập đúng Gmail tồn tại & mật khẩu chuẩn bảo mật (≥ 8 ký tự, chữ HOA, ký tự đặc biệt)'
        : 'Xác thực Gmail 6 số & tạo mật khẩu bảo mật để dùng trọn tính năng Phố Vị';
    }
  }

  function openAuthModal(defaultMode) {
    modal.classList.add('open');
    var user = getCurrentUser();
    if (defaultMode) {
      switchAuthView(defaultMode);
    } else {
      switchAuthView(user ? 'profile' : 'login');
    }
  }

  function closeAuthModal() {
    modal.classList.remove('open');
    clearAlert();
  }

  /* ---- Live Email & Password Checklist Feedback ---- */
  function updateChecklistUI(pw, ids) {
    var res = validatePassword(pw);
    var map = [
      { id: ids[0], ok: res.hasLen, text: 'Tối thiểu 8 ký tự' },
      { id: ids[1], ok: res.hasUpper, text: 'Ít nhất 1 chữ cái viết HOA (A-Z)' },
      { id: ids[2], ok: res.hasSpecial, text: 'Ít nhất 1 ký tự đặc biệt (!@#$%^&*...)' }
    ];
    map.forEach(function (item) {
      var el = $(item.id);
      if (!el) return;
      el.classList.toggle('pass', item.ok);
      el.textContent = (item.ok ? '✓ ' : '✕ ') + item.text;
    });
    return res;
  }

  function setFieldHint(elId, msg, stateClass) {
    var el = $(elId);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('is-ok', 'is-err');
    if (stateClass === 'ok') el.classList.add('is-ok');
    else if (stateClass === 'err') el.classList.add('is-err');
  }

  var loginEmailEl = $('loginIdentifier');
  if (loginEmailEl) {
    loginEmailEl.addEventListener('input', function () {
      var val = (loginEmailEl.value || '').trim();
      if (!val) { setFieldHint('loginEmailStatus', '', ''); return; }
      var v = validateGmail(val);
      setFieldHint('loginEmailStatus', v.valid ? '✓ Định dạng Gmail hợp lệ' : ('⚠ ' + v.error), v.valid ? 'ok' : 'err');
    });
  }

  var regEmailEl = $('regUsername');
  if (regEmailEl) {
    var mxTimer = null;
    regEmailEl.addEventListener('input', function () {
      var val = (regEmailEl.value || '').trim();
      var vPreview = validateGmail(val);
      if (pendingOtp && (!vPreview.valid || pendingOtp.emailCanonical !== vPreview.canonical)) {
        pendingOtp = null;
        if ($('regOtpInput')) $('regOtpInput').value = '';
        if ($('regOtpSection')) $('regOtpSection').hidden = true;
        if ($('regSimulatedInbox')) $('regSimulatedInbox').hidden = true;
        setFieldHint('regOtpStatus', '', '');
      }
      if (!val) {
        setFieldHint('regEmailStatus', 'Chỉ chấp nhận Gmail thật (@gmail.com), kiểm tra cú pháp & MX Google.', '');
        return;
      }
      if (!vPreview.valid) {
        setFieldHint('regEmailStatus', '⚠ ' + vPreview.error, 'err');
        return;
      }
      setFieldHint('regEmailStatus', '⏳ Đang kiểm tra máy chủ MX của Gmail...', '');
      if (mxTimer) clearTimeout(mxTimer);
      mxTimer = setTimeout(function () {
        var currentVal = (regEmailEl.value || '').trim();
        if (currentVal !== val) return;
        checkGmailExistence(currentVal).then(function (mxRes) {
          if ((regEmailEl.value || '').trim() !== currentVal) return;
          setFieldHint('regEmailStatus', mxRes.message, mxRes.ok ? 'ok' : 'err');
        });
      }, 320);
    });
  }

  /* ---- Password Strength Meter & Checklist ---- */
  var regPassInput = $('regPassword');
  if (regPassInput) {
    regPassInput.addEventListener('input', function () {
      var val = regPassInput.value || '';
      var fill = $('regStrengthFill');
      var txt = $('regStrengthText');
      var res = updateChecklistUI(val, ['ruleLen', 'ruleUpper', 'ruleSpecial']);
      if (!fill || !txt) return;

      if (!val.length) {
        fill.style.width = '0%';
        txt.textContent = 'Mật khẩu cần ≥ 8 ký tự, chữ HOA và ký tự đặc biệt';
        return;
      }
      fill.style.width = Math.max(18, res.score) + '%';
      if (!res.valid) {
        fill.style.background = '#DC2626';
        txt.textContent = res.error;
      } else if (res.score < 90) {
        fill.style.background = '#D97706';
        txt.textContent = res.label;
      } else {
        fill.style.background = '#16A34A';
        txt.textContent = res.label;
      }
    });
  }

  var cpNewInput = $('cpNewPassword');
  if (cpNewInput) {
    cpNewInput.addEventListener('input', function () {
      updateChecklistUI(cpNewInput.value || '', ['cpRuleLen', 'cpRuleUpper', 'cpRuleSpecial']);
    });
  }

  /* ---- Registration 6-Digit Gmail OTP Verification ---- */
  var pendingOtp = null; // { emailCanonical, emailNormalized, code, expiresAt, verified }

  function issueRegOtp(rawEmail) {
    return checkGmailExistence(rawEmail).then(function (mxRes) {
      if (!mxRes.ok) {
        showAlert('❌ ' + mxRes.message, 'error');
        setFieldHint('regEmailStatus', '⚠ ' + mxRes.message, 'err');
        return null;
      }
      var v = mxRes.validation;
      var users = loadUsers();
      var exists = users.some(function (u) {
        var uCanon = u.canonicalEmail || (validateGmail(u.username).canonical || String(u.username || '').toLowerCase());
        return uCanon === v.canonical || String(u.username || '').toLowerCase() === v.normalized;
      });
      if (exists) {
        showAlert('❌ Gmail "' + v.normalized + '" đã được đăng ký trước đó. Vui lòng chuyển sang Đăng Nhập!', 'error');
        return null;
      }

      var code = String(Math.floor(100000 + Math.random() * 900000));
      pendingOtp = {
        emailNormalized: v.normalized,
        emailCanonical: v.canonical,
        code: code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: false
      };

      if ($('regOtpSection')) $('regOtpSection').hidden = false;
      if ($('regSimulatedInbox')) $('regSimulatedInbox').hidden = false;
      if ($('regOtpInboxTarget')) $('regOtpInboxTarget').textContent = 'Tới: ' + v.normalized;
      if ($('regOtpDemoCode')) $('regOtpDemoCode').textContent = code;
      setFieldHint('regOtpStatus', '📩 Mã 6 số đã gửi (hiệu lực 10 phút). Nhập mã từ hộp thư mô phỏng bên dưới.', 'ok');
      setFieldHint('regEmailStatus', mxRes.message, 'ok');
      return pendingOtp;
    });
  }

  $('btnSendRegOtp')?.addEventListener('click', function () {
    clearAlert();
    var raw = ($('regUsername')?.value || '').trim();
    issueRegOtp(raw);
  });

  $('btnFillDemoOtp')?.addEventListener('click', function () {
    if (!pendingOtp || !$('regOtpInput')) return;
    $('regOtpInput').value = pendingOtp.code;
    pendingOtp.verified = true;
    setFieldHint('regOtpStatus', '✓ Đã điền & xác nhận mã OTP hợp lệ!', 'ok');
  });

  $('regOtpInput')?.addEventListener('input', function () {
    if (!pendingOtp) return;
    var curCode = ($('regOtpInput').value || '').trim();
    pendingOtp.verified = (curCode === pendingOtp.code && Date.now() <= pendingOtp.expiresAt);
    if (!curCode) {
      setFieldHint('regOtpStatus', '📩 Nhập mã 6 số từ hộp thư mô phỏng bên dưới.', '');
    } else if (!pendingOtp.verified) {
      setFieldHint('regOtpStatus', '', '');
    }
  });

  $('btnVerifyRegOtp')?.addEventListener('click', function () {
    clearAlert();
    var entered = ($('regOtpInput')?.value || '').trim();
    if (!pendingOtp) {
      showAlert('⚠️ Vui lòng bấm "Gửi mã xác nhận" trước.', 'error');
      return;
    }
    if (Date.now() > pendingOtp.expiresAt) {
      showAlert('⚠️ Mã OTP đã hết hạn. Vui lòng bấm gửi lại mã mới!', 'error');
      return;
    }
    if (entered !== pendingOtp.code) {
      pendingOtp.verified = false;
      setFieldHint('regOtpStatus', '❌ Mã OTP chưa khớp. Vui lòng kiểm tra hộp thư mô phỏng.', 'err');
      showAlert('❌ Mã xác thực Gmail 6 số không đúng!', 'error');
      return;
    }
    pendingOtp.verified = true;
    setFieldHint('regOtpStatus', '✓ Xác thực Gmail thành công! Bấm "XÁC THỰC & TẠO TÀI KHOẢN" để hoàn tất.', 'ok');
    showAlert('✓ Đã xác thực Gmail ' + pendingOtp.emailNormalized + ' thành công!', 'success');
  });

  /* ---- Login & Register Handlers ---- */
  function completeLoginSession(user, remember, isNewAccount) {
    var guestFavs = getActiveFavorites();
    var userFavs = Array.isArray(user.favorites) ? user.favorites : [];
    var merged = Array.from(new Set(userFavs.concat(guestFavs)));
    user.favorites = merged;

    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === user.username.toLowerCase()) {
        users[i].favorites = merged;
        break;
      }
    }
    saveUsers(users);
    setCurrentUser(user, remember);

    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(merged));
    } catch (e) {}

    if (typeof window.reloadFavoritesFromStorage === 'function') {
      window.reloadFavoritesFromStorage();
    }

    updateHeaderAuthUI();
    switchAuthView('profile');
    showAlert(
      isNewAccount
        ? '🎉 Xác thực Gmail & tạo tài khoản thành công! Chào mừng ' + user.fullName + '.'
        : '🏮 Đăng nhập thành công! Xin chào ' + user.fullName + '.',
      'success'
    );
  }

  if (formLogin) {
    formLogin.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAlert();
      var identifier = ($('loginIdentifier').value || '').trim();
      var password = $('loginPassword').value || '';
      var remember = $('loginRemember') ? $('loginRemember').checked : true;

      var vMail = validateGmail(identifier);
      if (!vMail.valid) {
        setFieldHint('loginEmailStatus', '⚠ ' + vMail.error, 'err');
        showAlert('⚠️ ' + vMail.error, 'error');
        return;
      }

      var vPass = validatePassword(password);
      if (!vPass.valid) {
        showAlert('⚠️ Mật khẩu chưa đạt chuẩn: ' + vPass.error, 'error');
        return;
      }

      checkGmailExistence(vMail.normalized).then(function (mxRes) {
        if (!mxRes.ok) {
          showAlert('❌ ' + mxRes.message, 'error');
          return;
        }
        setFieldHint('loginEmailStatus', mxRes.message, 'ok');

        var users = loadUsers();
        var found = null;
        for (var i = 0; i < users.length; i++) {
          var u = users[i];
          var uCanon = u.canonicalEmail || (validateGmail(u.username).canonical || String(u.username || '').toLowerCase());
          if (u.username.toLowerCase() === vMail.normalized || uCanon === vMail.canonical) {
            found = u;
            break;
          }
        }

        if (!found) {
          showAlert('❌ Gmail "' + vMail.normalized + '" chưa được đăng ký trên hệ thống. Vui lòng chuyển sang tab Đăng ký!', 'error');
          return;
        }

        sha256(password).then(function (hash) {
          var storedHash = found.passwordHash || (found.password ? sha256Sync(found.password) : '');
          if (storedHash !== hash) {
            showAlert('❌ Mật khẩu chưa chính xác. Vui lòng kiểm tra lại!', 'error');
            return;
          }
          if ($('loginPassword')) $('loginPassword').value = '';
          completeLoginSession(found, remember, false);
        });
      });
    });
  }

  // Quick Demo Account Buttons (all valid @gmail.com + Hanoi@2026)
  document.querySelectorAll('.auth-demo-user-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var email = btn.getAttribute('data-demo-email') || 'minhanh.hanoi@gmail.com';
      var remember = $('loginRemember') ? $('loginRemember').checked : true;
      var users = loadUsers();
      var demo = users.find(function (u) {
        return u.username.toLowerCase() === email.toLowerCase();
      }) || users[0];
      if (!demo) return;
      if ($('loginIdentifier')) $('loginIdentifier').value = demo.username;
      setFieldHint('loginEmailStatus', '✓ Đã chọn tài khoản Gmail mẫu hợp lệ', 'ok');
      completeLoginSession(demo, remember, false);
    });
  });

  if (formRegister) {
    formRegister.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAlert();
      var fullName = ($('regFullName').value || '').trim();
      var usernameRaw = ($('regUsername').value || '').trim();
      var district = $('regDistrict') ? $('regDistrict').value : 'Hoàn Kiếm';
      var password = $('regPassword').value || '';
      var confirmPass = $('regPasswordConfirm').value || '';

      if (fullName.length < 2) {
        showAlert('⚠️ Vui lòng nhập Họ và tên hiển thị (tối thiểu 2 ký tự).', 'error');
        return;
      }

      var vMail = validateGmail(usernameRaw);
      if (!vMail.valid) {
        setFieldHint('regEmailStatus', '⚠ ' + vMail.error, 'err');
        showAlert('❌ ' + vMail.error, 'error');
        return;
      }

      var vPass = validatePassword(password);
      if (!vPass.valid) {
        showAlert('❌ ' + vPass.error + ' (Cần ≥ 8 ký tự, ≥ 1 chữ HOA, ≥ 1 ký tự đặc biệt).', 'error');
        return;
      }
      if (password !== confirmPass) {
        showAlert('⚠️ Mật khẩu xác nhận không khớp. Vui lòng nhập lại.', 'error');
        return;
      }

      var users = loadUsers();
      for (var i = 0; i < users.length; i++) {
        var uCanon = users[i].canonicalEmail || (validateGmail(users[i].username).canonical || '');
        if (users[i].username.toLowerCase() === vMail.normalized || (uCanon && uCanon === vMail.canonical)) {
          showAlert('❌ Địa chỉ Gmail này đã có người đăng ký. Vui lòng dùng Gmail khác hoặc Đăng nhập!', 'error');
          return;
        }
      }

      // Check 6-digit OTP verification
      var otpInputVal = ($('regOtpInput')?.value || '').trim();
      if (!pendingOtp || pendingOtp.emailCanonical !== vMail.canonical) {
        issueRegOtp(vMail.normalized).then(function (issued) {
          if (issued) {
            showAlert('📧 Đã gửi mã OTP 6 số đến ' + vMail.normalized + '. Hãy nhập mã từ Hộp thư mô phỏng để hoàn tất đăng ký!', 'success');
          }
        });
        return;
      }
      if (Date.now() > pendingOtp.expiresAt) {
        issueRegOtp(vMail.normalized);
        showAlert('⚠️ Mã OTP cũ đã hết hạn. Đã gửi mã mới tới hộp thư mô phỏng!', 'error');
        return;
      }
      if (!pendingOtp.verified || otpInputVal !== pendingOtp.code) {
        if (otpInputVal === pendingOtp.code) {
          pendingOtp.verified = true;
        } else {
          if ($('regOtpSection')) $('regOtpSection').hidden = false;
          showAlert('❌ Vui lòng nhập đúng mã xác thực Gmail 6 số trước khi tạo tài khoản!', 'error');
          return;
        }
      }

      checkGmailExistence(vMail.normalized).then(function (mxRes) {
        if (!mxRes.ok) {
          showAlert('❌ ' + mxRes.message, 'error');
          return;
        }
        sha256(password).then(function (hash) {
          var now = new Date();
          var newUser = {
            id: 'u_' + Date.now(),
            fullName: fullName,
            username: vMail.normalized,
            canonicalEmail: vMail.canonical,
            passwordHash: hash,
            district: district,
            joinedAt: now.toLocaleDateString('vi-VN'),
            emailVerified: true,
            favorites: getActiveFavorites()
          };
          var latestUsers = loadUsers();
          latestUsers.push(newUser);
          saveUsers(latestUsers);
          pendingOtp = null;
          formRegister.reset();
          if ($('regOtpSection')) $('regOtpSection').hidden = true;
          if ($('regSimulatedInbox')) $('regSimulatedInbox').hidden = true;
          if ($('regStrengthFill')) $('regStrengthFill').style.width = '0%';
          if ($('regStrengthText')) $('regStrengthText').textContent = 'Mật khẩu cần ≥ 8 ký tự, chữ HOA và ký tự đặc biệt';
          setFieldHint('regEmailStatus', 'Chỉ chấp nhận Gmail thật (@gmail.com), kiểm tra cú pháp & MX Google.', '');
          setFieldHint('regOtpStatus', '', '');
          updateChecklistUI('', ['ruleLen', 'ruleUpper', 'ruleSpecial']);
          completeLoginSession(newUser, true, true);
        });
      });
    });
  }

  /* ---- Show/Hide Password Eye Buttons ---- */
  document.querySelectorAll('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-toggle-pass');
      var input = $(targetId);
      if (!input) return;
      var isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁';
    });
  });

  /* ---- Logout ---- */
  function performLogout() {
    syncFavoritesToUserAccount();
    setCurrentUser(null);
    try {
      localStorage.setItem(FAV_KEY, '[]');
      if (typeof window.reloadFavoritesFromStorage === 'function') {
        window.reloadFavoritesFromStorage();
      }
    } catch (e) {}
    updateHeaderAuthUI();
    closeAuthModal();
  }

  /* ---- Event Wiring ---- */
  $('btnOpenLogin')?.addEventListener('click', function () { openAuthModal('login'); });
  $('btnOpenRegister')?.addEventListener('click', function () { openAuthModal('register'); });
  $('btnOpenProfile')?.addEventListener('click', function () { openAuthModal('profile'); });
  $('btnQuickLogout')?.addEventListener('click', performLogout);
  $('btnProfileLogout')?.addEventListener('click', performLogout);
  $('btnCloseAuthModal')?.addEventListener('click', closeAuthModal);

  tabBtnLogin?.addEventListener('click', function () { switchAuthView('login'); });
  tabBtnRegister?.addEventListener('click', function () { switchAuthView('register'); });
  $('btnSwitchToRegister')?.addEventListener('click', function () { switchAuthView('register'); });
  $('btnSwitchToLogin')?.addEventListener('click', function () { switchAuthView('login'); });

  $('btnProfileViewFavs')?.addEventListener('click', function () {
    closeAuthModal();
    var favBtn = $('btnOpenFavoritesHero');
    if (favBtn) favBtn.click();
  });

  $('btnProfileOpenChat')?.addEventListener('click', function () {
    closeAuthModal();
    $('btnOpenCommunityHero')?.click();
  });

  /* ---- Profile Avatar Upload & Info Editing ---- */
  function resizeImageToDataUrl(file, maxSize, callback) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateCurrentUserRecord(mutator) {
    var cur = getCurrentUser();
    if (!cur) return null;
    mutator(cur);
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === cur.username.toLowerCase()) {
        mutator(users[i]);
        break;
      }
    }
    saveUsers(users);
    var isTabOnly = !!sessionStorage.getItem(SESSION_KEY);
    setCurrentUser(cur, !isTabOnly);
    updateHeaderAuthUI();
    return cur;
  }

  $('profileAvatarInput')?.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageToDataUrl(file, 180, function (dataUrl) {
      updateCurrentUserRecord(function (u) { u.avatarData = dataUrl; });
      switchAuthView('profile');
      showAlert('📷 Đã cập nhật ảnh đại diện thành công!', 'success');
    });
  });

  $('btnRemoveAvatar')?.addEventListener('click', function () {
    updateCurrentUserRecord(function (u) { delete u.avatarData; });
    switchAuthView('profile');
    showAlert('Đã gỡ ảnh đại diện về mặc định.', 'success');
  });

  document.querySelectorAll('.hobby-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var inp = $('editHobbies');
      if (!inp) return;
      var h = chip.getAttribute('data-hobby');
      var cur = (inp.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (cur.indexOf(h) === -1) cur.push(h);
      inp.value = cur.join(', ');
    });
  });

  $('formEditProfile')?.addEventListener('submit', function (e) {
    e.preventDefault();
    var newName = ($('editFullName').value || '').trim();
    if (newName.length < 2) {
      showAlert('⚠️ Họ và tên hiển thị cần ít nhất 2 ký tự.', 'error');
      return;
    }
    var newDist = $('editDistrict') ? $('editDistrict').value : 'Hoàn Kiếm';
    var newHobbies = ($('editHobbies').value || '').trim();
    var newFb = ($('editFacebook').value || '').trim();
    var newBio = ($('editBio').value || '').trim();

    updateCurrentUserRecord(function (u) {
      u.fullName = newName;
      u.district = newDist;
      u.hobbies = newHobbies;
      u.facebook = newFb;
      u.bio = newBio;
    });
    switchAuthView('profile');
    showAlert('💾 Đã lưu thông tin hồ sơ (sở thích, Facebook, khu vực) thành công!', 'success');
  });

  $('formChangePassword')?.addEventListener('submit', function (e) {
    e.preventDefault();
    clearAlert();
    var cur = getCurrentUser();
    if (!cur) return;
    var oldPw = $('cpOldPassword')?.value || '';
    var newPw = $('cpNewPassword')?.value || '';
    var confirmPw = $('cpConfirmPassword')?.value || '';

    var vNew = validatePassword(newPw);
    if (!vNew.valid) {
      showAlert('❌ Mật khẩu mới chưa đạt chuẩn: ' + vNew.error, 'error');
      return;
    }
    if (newPw !== confirmPw) {
      showAlert('⚠️ Mật khẩu mới nhập lại không khớp.', 'error');
      return;
    }

    var users = loadUsers();
    var target = users.find(function (u) { return u.username.toLowerCase() === cur.username.toLowerCase(); });
    if (!target) return;

    Promise.all([sha256(oldPw), sha256(newPw)]).then(function (hashes) {
      var oldHash = hashes[0];
      var newHash = hashes[1];
      var curHash = target.passwordHash || (target.password ? sha256Sync(target.password) : '');
      if (oldHash !== curHash) {
        showAlert('❌ Mật khẩu hiện tại chưa đúng!', 'error');
        return;
      }
      target.passwordHash = newHash;
      delete target.password;
      saveUsers(users);
      $('formChangePassword').reset();
      updateChecklistUI('', ['cpRuleLen', 'cpRuleUpper', 'cpRuleSpecial']);
      showAlert('🛡️ Đã cập nhật mật khẩu mới an toàn (SHA-256)!', 'success');
    });
  });

  window.addEventListener('storage', function (e) {
    if (e.key === SESSION_KEY || e.key === USERS_KEY) {
      updateHeaderAuthUI();
      dispatchAuthChanged(getCurrentUser());
    }
  });

  window.HNAuth = {
    getCurrentUser: getCurrentUser,
    openAuthModal: openAuthModal,
    loadUsers: loadUsers,
    validateGmail: validateGmail,
    checkGmailExistence: checkGmailExistence,
    validatePassword: validatePassword,
    sha256: sha256,
    sha256Sync: sha256Sync
  };

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeAuthModal();
  });

  // Sync favorites whenever user clicks any favorite button on page
  document.addEventListener('click', function (e) {
    if (e.target.closest('.btn-card-fav') || e.target.closest('#btnModalFav')) {
      setTimeout(syncFavoritesToUserAccount, 60);
    }
  });

  // Initialize header on page load
  updateHeaderAuthUI();
})();

/* ==========================================================================
   COMMUNITY GROUPS & FRIENDS CHAT MODULE (NHÓM CHAT KHU VỰC & CHAT BẠN BÈ)
   Tham gia 12 nhóm quận Hà Nội, kết bạn, xem Profile bạn bè, gửi ảnh & chia sẻ quán
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var modal = $('communityModal');
  var btnOpen = $('btnOpenCommunityHero');
  var btnClose = $('btnCloseCommModal');
  if (!modal || !btnOpen) return;

  var ROOMS_KEY = 'hanoi_phovi_comm_msgs_v1';
  var JOINED_KEY = 'hanoi_phovi_comm_joined_v1';
  var FRIENDS_KEY = 'hanoi_phovi_friends_v1';
  var CHAT_BG_KEY = 'hanoi_phovi_chat_bg_v1';

  var CHAT_BG_PRESETS = {
    sunset: 'linear-gradient(135deg, #fde68a 0%, #fca5a5 55%, #f97316 100%)',
    lotus: 'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 50%, #059669 100%)',
    night: 'linear-gradient(135deg, #1e293b 0%, #312e81 55%, #0f172a 100%)',
    peach: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #fda4af 100%)'
  };

  var DISTRICT_GROUPS = [
    { id: 'grp_hk', icon: '🏮', district: 'Hoàn Kiếm', name: 'Hội Sành Ăn Hoàn Kiếm', members: 1420, meta: 'Phố cổ • Phở, Bún chả, Chè & Ăn vặt' },
    { id: 'grp_hd', icon: '🏘️', district: 'Hà Đông', name: 'Hội Ẩm Thực Hà Đông', members: 980, meta: 'Văn Quán, Mộ Lao, Nguyễn Văn Lộc' },
    { id: 'grp_cg', icon: '🏢', district: 'Cầu Giấy', name: 'Cộng Đồng Ăn Ngon Cầu Giấy', members: 1150, meta: 'Trung Hòa, Tô Hiệu, Khu Đại Học' },
    { id: 'grp_th', icon: '🌊', district: 'Tây Hồ', name: 'Team Hồ Tây - Tây Hồ', members: 760, meta: 'Quảng An, Trích Sài, Brunch & Cafe' },
    { id: 'grp_dd', icon: '📜', district: 'Đống Đa', name: 'Hội Quán Ngon Đống Đa', members: 890, meta: 'Thái Hà, Hoàng Cầu, Chùa Láng' },
    { id: 'grp_bd', icon: '🏛️', district: 'Ba Đình', name: 'Thực Khách Ba Đình', members: 640, meta: 'Giảng Võ, Cửa Bắc, Ngọc Khánh' },
    { id: 'grp_hbt', icon: '🌳', district: 'Hai Bà Trưng', name: 'Team Hai Bà Trưng', members: 710, meta: 'Lò Đúc, Bạch Mai, Tăng Bạt Hổ' },
    { id: 'grp_tx', icon: '🛣️', district: 'Thanh Xuân', name: 'Hội Ăn Uống Thanh Xuân', members: 580, meta: 'Nguyễn Trãi, Royal City, Nguyễn Tuân' },
    { id: 'grp_ntl', icon: '🏟️', district: 'Nam Từ Liêm', name: 'Cộng Đồng Mỹ Đình - Nam Từ Liêm', members: 630, meta: 'Phố Hàn Mễ Trì, Hàm Nghi, Smart City' },
    { id: 'grp_btl', icon: '🌲', district: 'Bắc Từ Liêm', name: 'Hội Sinh Viên Bắc Từ Liêm', members: 490, meta: 'Cổ Nhuế, Ngoại Giao Đoàn, Đức Thắng' },
    { id: 'grp_lb', icon: '🌉', district: 'Long Biên', name: 'Team Bên Kia Cầu Long Biên', members: 510, meta: 'Ngọc Lâm, Cổ Linh, Aeon Mall' },
    { id: 'grp_hm', icon: '🏡', district: 'Hoàng Mai', name: 'Hội Ẩm Thực Hoàng Mai', members: 460, meta: 'Linh Đàm, Đền Lừ, Trương Định' }
  ];

  var SEED_FRIENDS = [
    {
      id: 'fr_thao', fullName: 'Nguyễn Minh Thảo', username: 'minhthao@hanoiphovi.vn',
      district: 'Hoàn Kiếm', hobbies: 'Phở Bát Đàn, Chè Khúc Bạch, Cafe Phố Cổ',
      facebook: 'https://facebook.com/minhthao.hanoi', bio: 'Cuối tuần hay lượn phố cổ tìm quán ngon lâu đời!',
      online: true
    },
    {
      id: 'fr_hoang', fullName: 'Trần Huy Hoàng', username: 'huyhoang@hanoiphovi.vn',
      district: 'Cầu Giấy', hobbies: 'Thịt nướng Hàn Quốc, Dimsum, Bún chả',
      facebook: 'https://facebook.com/huyhoang.foodie', bio: 'Dân Cầu Giấy chính hiệu, chuyên săn quán lẩu nướng ngon bổ rẻ.',
      online: true
    },
    {
      id: 'fr_linh', fullName: 'Lê Khánh Linh', username: 'khanhlinh@hanoiphovi.vn',
      district: 'Hà Đông', hobbies: 'Chè sầu riêng, Bánh tráng Phú Cường, Tokbokki',
      facebook: 'https://facebook.com/khanhlinh.hadong', bio: 'Thích khám phá đồ ăn vặt và quán chè quanh khu Hà Đông!',
      online: true
    },
    {
      id: 'fr_tuan', fullName: 'Phạm Anh Tuấn', username: 'anhtuan@hanoiphovi.vn',
      district: 'Tây Hồ', hobbies: 'Bánh tôm Hồ Tây, Izakaya, Brunch cuối tuần',
      facebook: 'https://facebook.com/anhtuan.tayho', bio: 'Mỗi chiều thứ 7 đều đạp xe quanh Hồ Tây tìm quán mới.',
      online: false
    }
  ];

  var commTab = 'groups'; // 'groups' | 'friends'
  var activeThread = { kind: 'group', id: 'grp_hk' };
  var viewingProfileObj = null;

  function loadStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveStore(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function getCurrentUserKey() {
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    return (cur && cur.username) ? cur.username.trim().toLowerCase() : 'guest';
  }

  function getDmThreadId(friendObj) {
    if (!friendObj) return 'dm_unknown';
    var isSeed = SEED_FRIENDS.some(function (s) { return s.id === friendObj.id; });
    if (isSeed) return 'dm_' + friendObj.id;
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    var myUser = (cur && cur.username) ? cur.username.trim().toLowerCase() : '';
    var peerUser = (friendObj.username || '').trim().toLowerCase();
    if (myUser && peerUser && myUser !== peerUser) {
      var pair = [myUser, peerUser].sort();
      return 'dm_pair_' + pair[0].replace(/[^a-z0-9]/g, '_') + '__' + pair[1].replace(/[^a-z0-9]/g, '_');
    }
    return 'dm_' + friendObj.id;
  }

  function getMsgPreview(m) {
    if (!m) return '';
    if (m.text) return m.text;
    if (m.photo) return '[📷 Hình ảnh]';
    if (m.video) return '[🎬 Video]';
    if (m.audio) return '[🎤 Tin nhắn thoại]';
    if (m.spotId) return '[🍜 Gợi ý quán]';
    return '';
  }

  function getChatWallpaper(threadId) {
    var map = loadStore(CHAT_BG_KEY, {});
    return map[getCurrentUserKey() + '|' + threadId] || null;
  }

  function setChatWallpaper(threadId, bgObj) {
    var map = loadStore(CHAT_BG_KEY, {});
    var key = getCurrentUserKey() + '|' + threadId;
    if (!bgObj) delete map[key];
    else map[key] = bgObj;
    saveStore(CHAT_BG_KEY, map);
  }

  function applyChatWallpaper(msgBox, threadId) {
    if (!msgBox) return;
    var bg = getChatWallpaper(threadId);
    msgBox.style.backgroundImage = '';
    msgBox.style.backgroundSize = '';
    msgBox.style.backgroundPosition = '';
    msgBox.classList.remove('has-custom-bg', 'has-dark-bg');
    if (!bg) return;
    if (bg.type === 'image' && bg.value) {
      msgBox.style.backgroundImage = 'linear-gradient(rgba(15,23,42,0.18), rgba(15,23,42,0.18)), url("' + bg.value + '")';
      msgBox.style.backgroundSize = 'cover';
      msgBox.style.backgroundPosition = 'center';
      msgBox.classList.add('has-custom-bg');
    } else if (bg.type === 'preset' && CHAT_BG_PRESETS[bg.value]) {
      msgBox.style.backgroundImage = CHAT_BG_PRESETS[bg.value];
      msgBox.classList.add('has-custom-bg');
      if (bg.value === 'night') msgBox.classList.add('has-dark-bg');
    }
  }

  function getJoinedGroups() {
    return loadStore(JOINED_KEY, ['grp_hk', 'grp_hd']);
  }

  function getAllFriends() {
    var saved = loadStore(FRIENDS_KEY, null);
    if (!saved) {
      saved = SEED_FRIENDS.slice();
      saveStore(FRIENDS_KEY, saved);
    }
    // Also include other registered accounts from HNAuth (except current user)
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    var users = (window.HNAuth && window.HNAuth.loadUsers()) || [];
    users.forEach(function (u) {
      if (cur && u.username.toLowerCase() === cur.username.toLowerCase()) return;
      var exists = saved.some(function (f) { return f.username.toLowerCase() === u.username.toLowerCase(); });
      if (!exists) {
        saved.push({
          id: 'fr_' + u.username.replace(/[^a-z0-9]/gi, '_'),
          fullName: u.fullName,
          username: u.username,
          district: u.district || 'Hoàn Kiếm',
          hobbies: u.hobbies || 'Khám phá ẩm thực Hà Nội',
          facebook: u.facebook || '',
          bio: u.bio || 'Thành viên cộng đồng Hà Nội Phố Vị',
          avatarData: u.avatarData || '',
          online: true
        });
      }
    });
    return saved;
  }

  function getMessagesMap() {
    var map = loadStore(ROOMS_KEY, null);
    if (map) return map;
    map = {
      grp_hk: [
        { senderName: 'Nguyễn Minh Thảo', senderUser: 'minhthao@hanoiphovi.vn', text: 'Chào cả nhà! Tối nay có ai đi ăn Chè Hương Hải 93 Hàng Bạc rồi lượn phố đi bộ không ạ? 🍧', time: '19:40' },
        { senderName: 'Trần Huy Hoàng', senderUser: 'huyhoang@hanoiphovi.vn', text: 'Gợi ý mọi người ghé Bún Chả Ngon số 4 Nguyễn Siêu nữa nhé, điểm 4.9 sao ăn cực ưng!', time: '19:45' }
      ],
      grp_hd: [
        { senderName: 'Lê Khánh Linh', senderUser: 'khanhlinh@hanoiphovi.vn', text: 'Khu Nguyễn Văn Lộc Hà Đông tối nay đông vui lắm, có FungHa Dimsum với Yakimono nướng Nhật siêu ngon 🔥', time: '20:05' }
      ],
      dm_fr_thao: [
        { senderName: 'Nguyễn Minh Thảo', senderUser: 'minhthao@hanoiphovi.vn', text: 'Chào bạn! Kết bạn đi ăn chung quanh Hà Nội nhé. Mình hay ăn sáng ở Phở Bát Đàn lắm 😊', time: '18:30' }
      ]
    };
    saveStore(ROOMS_KEY, map);
    return map;
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getTimeNow() {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  function findMemberProfile(usernameOrName) {
    var q = String(usernameOrName || '').toLowerCase();
    var friends = getAllFriends();
    for (var i = 0; i < friends.length; i++) {
      if (friends[i].username.toLowerCase() === q || friends[i].fullName.toLowerCase() === q) return friends[i];
    }
    return {
      id: 'fr_guest_' + Date.now(),
      fullName: usernameOrName || 'Thực khách Hà Nội',
      username: usernameOrName || 'thuckhach',
      district: 'Hoàn Kiếm',
      hobbies: 'Ẩm thực 36 phố phường',
      facebook: '',
      bio: 'Thành viên cộng đồng Hà Nội Phố Vị'
    };
  }

  function renderSidebar() {
    var query = ($('commSearchInput')?.value || '').toLowerCase().trim();
    var joined = getJoinedGroups();
    var msgMap = getMessagesMap();

    var grpList = $('commGroupList');
    if (grpList) {
      grpList.innerHTML = DISTRICT_GROUPS.filter(function (g) {
        return !query || g.name.toLowerCase().indexOf(query) !== -1 || g.district.toLowerCase().indexOf(query) !== -1;
      }).map(function (g) {
        var isAct = activeThread.kind === 'group' && activeThread.id === g.id;
        var isJoined = joined.indexOf(g.id) !== -1;
        var lastMsgs = msgMap[g.id] || [];
        var sub = lastMsgs.length ? getMsgPreview(lastMsgs[lastMsgs.length - 1]) : g.meta;
        return '<button type="button" class="comm-item' + (isAct ? ' active' : '') + '" data-thread-kind="group" data-thread-id="' + g.id + '">' +
          '<div class="comm-item-avatar">' + g.icon + '</div>' +
          '<div class="comm-item-body">' +
            '<div class="comm-item-top"><span class="comm-item-name">' + escHtml(g.name) + '</span>' +
            (isJoined ? '<span class="comm-joined-dot">Đã vào</span>' : '') + '</div>' +
            '<div class="comm-item-sub">' + escHtml(sub) + '</div>' +
          '</div>' +
        '</button>';
      }).join('');
    }

    var frList = $('commFriendList');
    if (frList) {
      var friends = getAllFriends();
      frList.innerHTML = friends.filter(function (f) {
        return !query || f.fullName.toLowerCase().indexOf(query) !== -1 || (f.district || '').toLowerCase().indexOf(query) !== -1;
      }).map(function (f) {
        var tid = getDmThreadId(f);
        var isAct = activeThread.kind === 'dm' && activeThread.id === tid;
        var lastMsgs = msgMap[tid] || [];
        var sub = lastMsgs.length ? getMsgPreview(lastMsgs[lastMsgs.length - 1]) : ('📍 ' + f.district + ' • ' + (f.hobbies || ''));
        var avHtml = f.avatarData ? '<img src="' + f.avatarData + '" alt="av" />' : escHtml(f.fullName.charAt(0).toUpperCase());
        return '<button type="button" class="comm-item' + (isAct ? ' active' : '') + '" data-thread-kind="dm" data-thread-id="' + tid + '" data-friend-id="' + f.id + '">' +
          '<div class="comm-item-avatar">' + avHtml + '</div>' +
          '<div class="comm-item-body">' +
            '<div class="comm-item-top"><span class="comm-item-name">' + escHtml(f.fullName) + '</span>' +
            '<span class="comm-joined-dot">' + (f.online ? '● Online' : 'Offline') + '</span></div>' +
            '<div class="comm-item-sub">' + escHtml(sub) + '</div>' +
          '</div>' +
        '</button>';
      }).join('');
    }

    document.querySelectorAll('.comm-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeThread = {
          kind: btn.getAttribute('data-thread-kind'),
          id: btn.getAttribute('data-thread-id'),
          friendId: btn.getAttribute('data-friend-id')
        };
        renderSidebar();
        renderActiveChat();
      });
    });
  }

  function renderActiveChat() {
    var joinBtn = $('btnCommJoinToggle');
    var viewPeerBtn = $('btnCommViewPeer');
    var peerAv = $('commPeerAvatar');
    var peerName = $('commPeerName');
    var peerMeta = $('commPeerMeta');

    if (activeThread.kind === 'group') {
      var grp = DISTRICT_GROUPS.find(function (g) { return g.id === activeThread.id; }) || DISTRICT_GROUPS[0];
      var joined = getJoinedGroups();
      var isJoined = joined.indexOf(grp.id) !== -1;
      if (peerAv) peerAv.textContent = grp.icon;
      if (peerName) peerName.textContent = grp.name;
      if (peerMeta) peerMeta.textContent = grp.members + ' thành viên • ' + grp.meta;
      if (joinBtn) {
        joinBtn.hidden = false;
        joinBtn.textContent = isJoined ? '✓ Đã tham gia' : '+ Tham gia nhóm';
        joinBtn.classList.toggle('joined', isJoined);
      }
      if (viewPeerBtn) viewPeerBtn.hidden = true;
    } else {
      var friends = getAllFriends();
      var fr = friends.find(function (f) {
        return getDmThreadId(f) === activeThread.id || (activeThread.friendId && f.id === activeThread.friendId);
      }) || friends[0];
      if (fr) {
        activeThread.id = getDmThreadId(fr);
        if (peerAv) {
          peerAv.innerHTML = fr.avatarData ? '<img src="' + fr.avatarData + '" alt="av" />' : escHtml(fr.fullName.charAt(0).toUpperCase());
        }
        if (peerName) peerName.textContent = fr.fullName;
        if (peerMeta) peerMeta.textContent = '📍 ' + fr.district + ' • ' + (fr.hobbies || 'Bạn bè');
        if (viewPeerBtn) {
          viewPeerBtn.hidden = false;
          viewPeerBtn.onclick = function () { openFriendProfile(fr); };
        }
      } else {
        if (peerAv) peerAv.textContent = '👤';
        if (peerName) peerName.textContent = 'Chưa có bạn bè';
        if (peerMeta) peerMeta.textContent = 'Hãy thêm bạn bè để bắt đầu trò chuyện';
        if (viewPeerBtn) viewPeerBtn.hidden = true;
      }
      if (joinBtn) joinBtn.hidden = true;
    }

    var msgBox = $('commMessages');
    if (!msgBox) return;
    applyChatWallpaper(msgBox, activeThread.id);
    var msgMap = getMessagesMap();
    var msgs = msgMap[activeThread.id] || [];
    var curUser = window.HNAuth && window.HNAuth.getCurrentUser();

    if (!msgs.length) {
      msgBox.innerHTML = '<div class="comm-empty-hint">🏮 Chưa có tin nhắn nào ở đây. Hãy gửi lời chào hoặc rủ mọi người đi ăn nhé!</div>';
      return;
    }

    msgBox.innerHTML = msgs.map(function (m) {
      var isMe = curUser && m.senderUser && m.senderUser.toLowerCase() === curUser.username.toLowerCase();
      var avHtml = m.avatarData
        ? '<img src="' + m.avatarData + '" alt="av" />'
        : escHtml((m.senderName || 'T').charAt(0).toUpperCase());
      var photoHtml = m.photo ? '<img class="comm-msg-photo" src="' + m.photo + '" alt="Ảnh chia sẻ" />' : '';
      var videoHtml = m.video ? '<video class="comm-msg-video" controls playsinline preload="metadata" src="' + m.video + '"></video>' : '';
      var audioHtml = '';
      if (m.audio) {
        var durStr = m.audioDuration ? (' (' + Math.floor(m.audioDuration / 60) + ':' + String(m.audioDuration % 60).padStart(2, '0') + ')') : '';
        audioHtml = '<div class="comm-voice-msg">' +
          '<span class="comm-voice-label">🎤 Tin nhắn thoại' + durStr + '</span>' +
          '<audio class="comm-msg-audio" controls src="' + m.audio + '"></audio>' +
        '</div>';
      }
      var spotHtml = '';
      if (m.spotId && typeof RESTAURANTS_DATA !== 'undefined') {
        var spot = RESTAURANTS_DATA.find(function (r) { return r.id === m.spotId; });
        if (spot) {
          spotHtml = '<div class="comm-spot-share">' +
            '<strong>🍽️ ' + escHtml(spot.name) + '</strong>' +
            '<span>📍 ' + escHtml(spot.address) + ' • ⭐ ' + spot.rating + '</span><br>' +
            '<button type="button" class="comm-spot-btn" data-open-spot="' + spot.id + '">Xem chi tiết quán</button>' +
          '</div>';
        }
      }
      var textHtml = m.text ? '<div class="comm-msg-text">' + escHtml(m.text) + '</div>' : '';
      return '<div class="comm-msg' + (isMe ? ' me' : '') + '">' +
        '<div class="comm-msg-avatar" data-sender-user="' + escHtml(m.senderUser || m.senderName) + '" title="Xem hồ sơ">' + avHtml + '</div>' +
        '<div class="comm-msg-content">' +
          '<span class="comm-msg-sender" data-sender-user="' + escHtml(m.senderUser || m.senderName) + '">' + escHtml(m.senderName) + '</span>' +
          '<div class="comm-msg-bubble">' + textHtml + photoHtml + videoHtml + audioHtml + spotHtml + '</div>' +
          '<span class="comm-msg-time">' + escHtml(m.time || '') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    msgBox.querySelectorAll('[data-sender-user]').forEach(function (el) {
      el.addEventListener('click', function () {
        var uKey = el.getAttribute('data-sender-user');
        if (curUser && uKey.toLowerCase() === curUser.username.toLowerCase()) {
          window.HNAuth && window.HNAuth.openAuthModal('profile');
        } else {
          openFriendProfile(findMemberProfile(uKey));
        }
      });
    });

    msgBox.querySelectorAll('[data-open-spot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = parseInt(btn.getAttribute('data-open-spot'), 10);
        modal.classList.remove('open');
        if (typeof window.openRestaurantDetail === 'function') {
          window.openRestaurantDetail(sid);
        } else {
          var cardBtn = document.querySelector('.btn-card-details[data-id="' + sid + '"]');
          if (cardBtn) cardBtn.click();
        }
      });
    });

    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function ensureLoggedInForChat() {
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    if (!cur) {
      if (window.confirm('🔑 Bạn cần Đăng nhập (hoặc dùng 1-chạm Thực Khách Mẫu) để nhắn tin và tham gia nhóm chat.\n\nMở hộp thoại Đăng nhập ngay?')) {
        window.HNAuth && window.HNAuth.openAuthModal('login');
      }
      return null;
    }
    return cur;
  }

  function postCommunityMessage(text, extra) {
    var user = ensureLoggedInForChat();
    if (!user) return;
    var trimmed = String(text || '').trim();
    if (!trimmed && !extra) return;

    var msgMap = getMessagesMap();
    if (!msgMap[activeThread.id]) msgMap[activeThread.id] = [];
    var msgObj = {
      senderName: user.fullName,
      senderUser: user.username,
      avatarData: user.avatarData || '',
      text: trimmed,
      time: getTimeNow()
    };
    if (extra && extra.photo) msgObj.photo = extra.photo;
    if (extra && extra.video) msgObj.video = extra.video;
    if (extra && extra.videoName) msgObj.videoName = extra.videoName;
    if (extra && extra.audio) msgObj.audio = extra.audio;
    if (extra && extra.audioDuration) msgObj.audioDuration = extra.audioDuration;
    if (extra && extra.spotId) msgObj.spotId = extra.spotId;

    msgMap[activeThread.id].push(msgObj);
    saveStore(ROOMS_KEY, msgMap);

    if ($('commTextInput')) $('commTextInput').value = '';
    renderSidebar();
    renderActiveChat();
  }

  /* ---- Public Friend Profile Modal ---- */
  function openFriendProfile(member) {
    var fpModal = $('friendProfileModal');
    if (!fpModal || !member) return;
    viewingProfileObj = member;

    var av = $('fpAvatar');
    if (av) av.innerHTML = member.avatarData ? '<img src="' + member.avatarData + '" alt="av" />' : escHtml((member.fullName || 'T').charAt(0).toUpperCase());
    if ($('fpName')) $('fpName').textContent = member.fullName;
    if ($('fpUsername')) $('fpUsername').textContent = member.username;
    if ($('fpBio')) $('fpBio').textContent = member.bio || 'Thành viên cộng đồng Hà Nội Phố Vị';
    if ($('fpDistrict')) $('fpDistrict').textContent = member.district || 'Hoàn Kiếm';
    if ($('fpHobbies')) $('fpHobbies').textContent = member.hobbies || 'Đang cập nhật sở thích';

    var fbRow = $('fpFbRow');
    var fbLink = $('fpFbLink');
    if (fbRow && fbLink) {
      if (member.facebook) {
        fbLink.href = member.facebook.indexOf('http') === 0 ? member.facebook : 'https://' + member.facebook;
        fbRow.hidden = false;
      } else {
        fbRow.hidden = true;
      }
    }

    var friends = getAllFriends();
    var isFriend = friends.some(function (f) { return f.username.toLowerCase() === (member.username || '').toLowerCase(); });
    if ($('btnFpToggleFriend')) $('btnFpToggleFriend').textContent = isFriend ? '✓ Đã Là Bạn Bè' : '➕ Kết Bạn';

    fpModal.classList.add('open');
  }

  $('btnCloseFpModal')?.addEventListener('click', function () { $('friendProfileModal')?.classList.remove('open'); });
  $('friendProfileModal')?.addEventListener('click', function (e) {
    if (e.target === $('friendProfileModal')) $('friendProfileModal').classList.remove('open');
  });

  $('btnFpMessage')?.addEventListener('click', function () {
    if (!viewingProfileObj) return;
    var friends = getAllFriends();
    var match = friends.find(function (f) { return f.username.toLowerCase() === viewingProfileObj.username.toLowerCase(); });
    if (!match) {
      match = viewingProfileObj;
      friends.unshift(match);
      saveStore(FRIENDS_KEY, friends);
    }
    $('friendProfileModal')?.classList.remove('open');
    commTab = 'friends';
    document.querySelectorAll('.comm-subtab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-comm-tab') === 'friends');
    });
    if ($('commGroupList')) $('commGroupList').hidden = true;
    if ($('commFriendPane')) $('commFriendPane').hidden = false;
    activeThread = { kind: 'dm', id: getDmThreadId(match), friendId: match.id };
    modal.classList.add('open');
    renderSidebar();
    renderActiveChat();
  });

  $('btnFpToggleFriend')?.addEventListener('click', function () {
    if (!viewingProfileObj) return;
    var friends = getAllFriends();
    var idx = friends.findIndex(function (f) { return f.username.toLowerCase() === viewingProfileObj.username.toLowerCase(); });
    if (idx === -1) {
      friends.unshift(viewingProfileObj);
      saveStore(FRIENDS_KEY, friends);
      $('btnFpToggleFriend').textContent = '✓ Đã Là Bạn Bè';
    } else {
      friends.splice(idx, 1);
      saveStore(FRIENDS_KEY, friends);
      $('btnFpToggleFriend').textContent = '➕ Kết Bạn';
    }
    renderSidebar();
  });

  /* ---- Community Modal Events ---- */
  btnOpen.addEventListener('click', function () {
    modal.classList.add('open');
    renderSidebar();
    renderActiveChat();
  });
  btnClose?.addEventListener('click', function () { modal.classList.remove('open'); });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.querySelectorAll('.comm-subtab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      commTab = tab.getAttribute('data-comm-tab');
      document.querySelectorAll('.comm-subtab').forEach(function (t) {
        var sel = t.getAttribute('data-comm-tab') === commTab;
        t.classList.toggle('active', sel);
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
      });
      if ($('commGroupList')) $('commGroupList').hidden = commTab !== 'groups';
      if ($('commFriendPane')) $('commFriendPane').hidden = commTab !== 'friends';
    });
  });

  $('commSearchInput')?.addEventListener('input', renderSidebar);

  $('btnCommJoinToggle')?.addEventListener('click', function () {
    if (activeThread.kind !== 'group') return;
    var joined = getJoinedGroups();
    var idx = joined.indexOf(activeThread.id);
    if (idx === -1) joined.push(activeThread.id);
    else joined.splice(idx, 1);
    saveStore(JOINED_KEY, joined);
    renderSidebar();
    renderActiveChat();
  });

  $('btnAddFriend')?.addEventListener('click', function () {
    var inp = $('commAddFriendInput');
    var name = (inp && inp.value || '').trim();
    if (name.length < 2) return;
    var qLower = name.toLowerCase();
    var friends = getAllFriends();
    var existing = friends.find(function (f) {
      return f.username.toLowerCase() === qLower || f.fullName.toLowerCase() === qLower;
    });
    if (existing) {
      inp.value = '';
      activeThread = { kind: 'dm', id: getDmThreadId(existing), friendId: existing.id };
      renderSidebar();
      renderActiveChat();
      return;
    }

    // Check registered HNAuth accounts first so two real users connect cleanly
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    var users = (window.HNAuth && window.HNAuth.loadUsers()) || [];
    var regMatch = users.find(function (u) {
      if (cur && u.username.toLowerCase() === cur.username.toLowerCase()) return false;
      return u.username.toLowerCase() === qLower || (u.fullName || '').toLowerCase() === qLower;
    });

    var newFr = regMatch ? {
      id: 'fr_' + regMatch.username.replace(/[^a-z0-9]/gi, '_'),
      fullName: regMatch.fullName,
      username: regMatch.username,
      district: regMatch.district || 'Hoàn Kiếm',
      hobbies: regMatch.hobbies || 'Khám phá quán ngon Hà Nội',
      facebook: regMatch.facebook || '',
      bio: regMatch.bio || 'Thành viên cộng đồng Hà Nội Phố Vị',
      avatarData: regMatch.avatarData || '',
      online: true
    } : {
      id: 'fr_' + Date.now(),
      fullName: name,
      username: name.indexOf('@') !== -1 ? qLower : (qLower.replace(/\s+/g, '') + '@hanoiphovi.vn'),
      district: 'Hoàn Kiếm',
      hobbies: 'Khám phá quán ngon Hà Nội',
      facebook: '',
      bio: 'Bạn mới kết nối trên Hà Nội Phố Vị',
      online: true
    };
    friends.unshift(newFr);
    saveStore(FRIENDS_KEY, friends);
    inp.value = '';
    activeThread = { kind: 'dm', id: getDmThreadId(newFr), friendId: newFr.id };
    renderSidebar();
    renderActiveChat();
  });

  $('btnCommSend')?.addEventListener('click', function () {
    postCommunityMessage($('commTextInput')?.value || '');
  });
  $('commTextInput')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postCommunityMessage($('commTextInput').value);
    }
  });

  $('commPhotoInput')?.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.type.indexOf('video/') === 0) {
      if (file.size > 3.2 * 1024 * 1024) {
        alert('Video quá lớn! Vui lòng chọn video dưới 3.2MB để gửi nhanh và lưu mượt trên trình duyệt.');
        return;
      }
      var vReader = new FileReader();
      vReader.onload = function (ev) {
        postCommunityMessage($('commTextInput')?.value || '', { video: ev.target.result, videoName: file.name });
      };
      vReader.readAsDataURL(file);
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var ratio = Math.min(640 / img.width, 640 / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        postCommunityMessage($('commTextInput')?.value || '', { photo: canvas.toDataURL('image/jpeg', 0.82) });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---- Per-User Conversation Wallpaper ---- */
  var bgBtn = $('btnCommBg');
  var bgMenu = $('commBgMenu');
  bgBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    if (bgMenu) bgMenu.hidden = !bgMenu.hidden;
  });
  document.addEventListener('click', function (e) {
    if (bgMenu && !bgMenu.hidden && !bgMenu.contains(e.target) && e.target !== bgBtn) {
      bgMenu.hidden = true;
    }
  });
  bgMenu?.querySelectorAll('[data-bg-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var preset = btn.getAttribute('data-bg-preset');
      setChatWallpaper(activeThread.id, preset === 'default' ? null : { type: 'preset', value: preset });
      applyChatWallpaper($('commMessages'), activeThread.id);
      bgMenu.hidden = true;
    });
  });
  $('commBgInput')?.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var ratio = Math.min(960 / img.width, 960 / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setChatWallpaper(activeThread.id, { type: 'image', value: canvas.toDataURL('image/jpeg', 0.78) });
        applyChatWallpaper($('commMessages'), activeThread.id);
        if (bgMenu) bgMenu.hidden = true;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---- Voice Chat / Voice Message Recording ---- */
  var voiceRec = null;
  var voiceChunks = [];
  var voiceStream = null;
  var voiceInterval = null;
  var voiceSeconds = 0;
  var voiceAction = 'send';

  function cleanupVoiceRecorder() {
    if (voiceInterval) { clearInterval(voiceInterval); voiceInterval = null; }
    if (voiceStream) {
      voiceStream.getTracks().forEach(function (t) { t.stop(); });
      voiceStream = null;
    }
    voiceRec = null;
    if ($('commVoiceBar')) $('commVoiceBar').hidden = true;
    if ($('btnCommVoice')) $('btnCommVoice').classList.remove('recording');
  }

  function formatVoiceTimer(sec) {
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  $('btnCommVoice')?.addEventListener('click', function () {
    if (!ensureLoggedInForChat()) return;
    if (voiceRec && voiceRec.state === 'recording') {
      voiceAction = 'send';
      voiceRec.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Trình duyệt hiện tại không hỗ trợ ghi âm Voice Chat.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      voiceStream = stream;
      voiceChunks = [];
      voiceSeconds = 0;
      voiceAction = 'send';
      voiceRec = new MediaRecorder(stream);
      voiceRec.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) voiceChunks.push(ev.data);
      };
      voiceRec.onstop = function () {
        var dur = voiceSeconds;
        var act = voiceAction;
        var chunks = voiceChunks.slice();
        var mime = (voiceRec && voiceRec.mimeType) || 'audio/webm';
        cleanupVoiceRecorder();
        if (act !== 'send' || !chunks.length) return;
        var blob = new Blob(chunks, { type: mime });
        var reader = new FileReader();
        reader.onload = function (rEv) {
          postCommunityMessage('', { audio: rEv.target.result, audioDuration: Math.max(1, dur) });
        };
        reader.readAsDataURL(blob);
      };
      voiceRec.start();
      if ($('commVoiceBar')) $('commVoiceBar').hidden = false;
      if ($('btnCommVoice')) $('btnCommVoice').classList.add('recording');
      if ($('commVoiceTimer')) $('commVoiceTimer').textContent = 'Đang ghi âm... 00:00';
      voiceInterval = setInterval(function () {
        voiceSeconds++;
        if ($('commVoiceTimer')) $('commVoiceTimer').textContent = 'Đang ghi âm... ' + formatVoiceTimer(voiceSeconds);
        if (voiceSeconds >= 60 && voiceRec && voiceRec.state === 'recording') {
          voiceAction = 'send';
          voiceRec.stop();
        }
      }, 1000);
    }).catch(function () {
      alert('Không thể truy cập micro. Vui lòng cấp quyền micro cho trình duyệt để gửi Voice Chat.');
    });
  });

  $('btnVoiceSend')?.addEventListener('click', function () {
    if (voiceRec && voiceRec.state === 'recording') {
      voiceAction = 'send';
      voiceRec.stop();
    }
  });

  $('btnVoiceCancel')?.addEventListener('click', function () {
    if (voiceRec && voiceRec.state === 'recording') {
      voiceAction = 'cancel';
      voiceRec.stop();
    } else {
      cleanupVoiceRecorder();
    }
  });

  /* ---- Cross-tab real-time Messenger/Zalo sync ---- */
  window.addEventListener('storage', function (e) {
    if (e.key === ROOMS_KEY || e.key === FRIENDS_KEY || e.key === CHAT_BG_KEY) {
      if (modal.classList.contains('open')) {
        renderSidebar();
        renderActiveChat();
      }
    }
  });

  $('btnCommShareSpot')?.addEventListener('click', function () {
    if (typeof RESTAURANTS_DATA === 'undefined' || !RESTAURANTS_DATA.length) return;
    var grp = DISTRICT_GROUPS.find(function (g) { return activeThread.kind === 'group' && g.id === activeThread.id; });
    var pool = grp ? RESTAURANTS_DATA.filter(function (r) { return r.district === grp.district; }) : RESTAURANTS_DATA;
    if (!pool.length) pool = RESTAURANTS_DATA;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    postCommunityMessage('Mọi người thử ghé quán này xem sao nhé!', { spotId: pick.id });
  });
})();


/* ==========================================================================
   SOCIAL REELS FEED & CREATOR MODULE (LƯỚT REELS & UP BÀI CHIA SẺ)
   Lướt dọc kiểu TikTok/Reels, thả tim, bình luận, gắn thẻ quán và đăng ảnh/video
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var modal = $('reelsModal');
  var btnOpen = $('btnOpenReelsHero');
  var btnClose = $('btnCloseReelsModal');
  var feedEl = $('reelsFeed');
  if (!modal || !btnOpen || !feedEl) return;

  var REELS_KEY = 'hanoi_phovi_reels_v1';
  var GUEST_ID_KEY = 'hanoi_phovi_guest_id_v1';
  var SYNC_CHANNEL_NAME = 'hanoi_phovi_reels_sync';
  var reelFilter = 'all';
  var activeCommentReelId = null;
  var activeLikersReelId = null;
  var pendingMedia = null; // { type: 'image'|'video', src: string }

  var syncChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    }
  } catch (e) {}

  var runtimeMediaMap = {};

  function getOrCreateGuestKey() {
    // Dùng sessionStorage theo từng tab để 2 tab chưa đăng nhập vẫn là 2 khách độc lập và tim được bài nhau
    try {
      var existing = sessionStorage.getItem(GUEST_ID_KEY);
      if (existing) return existing;
      var generated = 'guest_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(GUEST_ID_KEY, generated);
      return generated;
    } catch (e) {
      try {
        var lsExisting = localStorage.getItem(GUEST_ID_KEY);
        if (lsExisting) return lsExisting;
        var lsGen = 'guest_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(GUEST_ID_KEY, lsGen);
        return lsGen;
      } catch (e2) {
        return 'guest_local';
      }
    }
  }

  function getReelActor() {
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    if (cur && cur.username) {
      return {
        key: String(cur.username).trim().toLowerCase(),
        name: cur.fullName || cur.username,
        avatar: cur.avatarData || '',
        isGuest: false
      };
    }
    var gKey = getOrCreateGuestKey();
    return {
      key: gKey,
      name: 'Khách ghé thăm (' + gKey.slice(-4).toUpperCase() + ')',
      avatar: '',
      isGuest: true
    };
  }

  var SEED_REELS = [
    {
      id: 'reel_1',
      authorName: 'Nguyễn Minh Thảo',
      authorUser: 'minhthao.hanoi@gmail.com',
      district: 'Hoàn Kiếm',
      spotId: 1,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
      caption: '6h30 sáng xếp hàng làm bát Phở Bát Đàn tái lăn nóng hổi giữa tiết trời se lạnh Hà Nội, thêm đĩa quẩy giòn đúng chuẩn vị xưa! 🍜🔥',
      baseLikes: 245,
      likedBy: [
        { user: 'khanhlinh.hanoi@gmail.com', name: 'Lê Khánh Linh', avatar: '', time: '14 phút trước' },
        { user: 'huyhoang.hanoi@gmail.com', name: 'Trần Huy Hoàng', avatar: '', time: '9 phút trước' },
        { user: 'tuanhung.phoco@gmail.com', name: 'Trần Tuấn Hưng', avatar: '', time: '3 phút trước' }
      ],
      savedBy: [],
      comments: [
        { id: 'c_1', author: 'Trần Huy Hoàng', authorEmail: 'huyhoang.hanoi@gmail.com', time: '10 phút trước', text: 'Nhìn bát phở ngập hành thơm nức mũi luôn bạn ơi!', likedBy: ['minhthao.hanoi@gmail.com'] },
        { id: 'c_2', author: 'Lê Khánh Linh', authorEmail: 'khanhlinh.hanoi@gmail.com', time: '4 phút trước', text: 'Cuối tuần rủ nhau lên phố cổ ăn sáng nha!', likedBy: [] }
      ]
    },
    {
      id: 'reel_2',
      authorName: 'Lê Khánh Linh',
      authorUser: 'khanhlinh.hanoi@gmail.com',
      district: 'Hoàn Kiếm',
      spotId: 104,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
      caption: 'Tối đi dạo Hàng Bạc nhất định phải làm cốc Kem Bơ Sầu Riêng & Xôi Xoài ở Chè Hương Hải, béo ngậy mát lịm! 🍧✨',
      baseLikes: 190,
      likedBy: [
        { user: 'minhthao.hanoi@gmail.com', name: 'Nguyễn Minh Thảo', avatar: '', time: '22 phút trước' },
        { user: 'minhanh.hanoi@gmail.com', name: 'Nguyễn Minh Anh', avatar: '', time: '7 phút trước' }
      ],
      savedBy: [],
      comments: [
        { id: 'c_3', author: 'Nguyễn Minh Thảo', authorEmail: 'minhthao.hanoi@gmail.com', time: '25 phút trước', text: 'Quán này mở tới tận 12h đêm, ăn khuya siêu hợp!', likedBy: [] }
      ]
    },
    {
      id: 'reel_3',
      authorName: 'Trần Huy Hoàng',
      authorUser: 'huyhoang.hanoi@gmail.com',
      district: 'Cầu Giấy',
      spotId: 155,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
      caption: 'Xửng Tiểu Long Bao & Há Cảo tôm tươi nóng hổi vừa ra lò ở Cầu Giấy — cắn một miếng nước súp ngọt lịm tan ngay trong miệng! 🥟',
      baseLikes: 313,
      likedBy: [
        { user: 'anhtuan.hanoi@gmail.com', name: 'Phạm Anh Tuấn', avatar: '', time: '1 giờ trước' },
        { user: 'tuanhung.phoco@gmail.com', name: 'Trần Tuấn Hưng', avatar: '', time: '18 phút trước' }
      ],
      savedBy: [],
      comments: []
    },
    {
      id: 'reel_4',
      authorName: 'Phạm Anh Tuấn',
      authorUser: 'anhtuan.hanoi@gmail.com',
      district: 'Tây Hồ',
      spotId: 211,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
      caption: 'Đạp xe quanh Hồ Tây xong ghé Chops Quảng An làm chiếc Burger bò Wagyu phô mai chảy, hết nước chấm! 🍔🌊',
      baseLikes: 163,
      likedBy: [
        { user: 'huyhoang.hanoi@gmail.com', name: 'Trần Huy Hoàng', avatar: '', time: '40 phút trước' }
      ],
      savedBy: [],
      comments: []
    },
    {
      id: 'reel_5',
      authorName: 'Thực Khách Hà Thành',
      authorUser: 'thuckhach.hanoi@gmail.com',
      district: 'Đống Đa',
      spotId: 129,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
      caption: 'Tụ tập hội bạn làm chầu thịt nướng Hàn Quốc xèo xèo bên bếp than hồng ở Jinro BBQ Nguyễn Chí Thanh 🔥🇰🇷',
      baseLikes: 277,
      likedBy: [
        { user: 'minhanh.hanoi@gmail.com', name: 'Nguyễn Minh Anh', avatar: '', time: '32 phút trước' },
        { user: 'khanhlinh.hanoi@gmail.com', name: 'Lê Khánh Linh', avatar: '', time: '15 phút trước' }
      ],
      savedBy: [],
      comments: []
    },
    {
      id: 'reel_6',
      authorName: 'Nguyễn Minh Anh',
      authorUser: 'minhanh.hanoi@gmail.com',
      district: 'Hà Đông',
      spotId: 197,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      caption: 'Dân Hà Đông tối nay ghé phố Nguyễn Văn Lộc ăn buffet nướng Nhật Yakimono không giới hạn, khói thơm nức cả góc phố! 🥩',
      baseLikes: 202,
      likedBy: [
        { user: 'tuanhung.phoco@gmail.com', name: 'Trần Tuấn Hưng', avatar: '', time: '28 phút trước' },
        { user: 'thuckhach.hanoi@gmail.com', name: 'Thực Khách Hà Thành', avatar: '', time: '6 phút trước' }
      ],
      savedBy: [],
      comments: []
    }
  ];

  function migrateReelSchema(r) {
    if (!r || typeof r !== 'object') return r;
    var likedBy = Array.isArray(r.likedBy) ? r.likedBy.slice() : [];
    var baseLikes = typeof r.baseLikes === 'number' && !isNaN(r.baseLikes)
      ? Math.max(0, r.baseLikes)
      : Math.max(0, Number(r.likes || 0) - likedBy.length);

    // Chuyển dữ liệu likedByMe cũ sang likedBy đa tài khoản mà không mất số tim
    if (r.likedByMe === true && likedBy.length === 0) {
      var cur = window.HNAuth && window.HNAuth.getCurrentUser();
      var k = cur && cur.username ? cur.username.toLowerCase() : getOrCreateGuestKey();
      var nm = cur && cur.fullName ? cur.fullName : 'Bạn (đã thích trước đó)';
      likedBy.push({ user: k, name: nm, avatar: cur && cur.avatarData ? cur.avatarData : '', time: 'Trước đó' });
      baseLikes = Math.max(0, baseLikes - 1);
    }

    var savedBy = Array.isArray(r.savedBy) ? r.savedBy.slice() : [];
    var comments = Array.isArray(r.comments) ? r.comments.map(function (c, idx) {
      return Object.assign({}, c, {
        id: c.id || ('c_' + r.id + '_' + idx),
        likedBy: Array.isArray(c.likedBy) ? c.likedBy.slice() : []
      });
    }) : [];

    var migrated = Object.assign({}, r, {
      baseLikes: baseLikes,
      likedBy: likedBy,
      savedBy: savedBy,
      comments: comments
    });
    delete migrated.likes;
    delete migrated.likedByMe;
    return migrated;
  }

  function loadReels() {
    try {
      var raw = localStorage.getItem(REELS_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        var needsSave = false;
        var migratedList = parsed.map(function (r) {
          if (typeof r.baseLikes !== 'number' || !Array.isArray(r.likedBy) || !Array.isArray(r.savedBy)) {
            needsSave = true;
          }
          var m = migrateReelSchema(r);
          if (m && runtimeMediaMap[m.id]) {
            m.mediaType = runtimeMediaMap[m.id].type;
            m.mediaSrc = runtimeMediaMap[m.id].src;
          }
          return m;
        });
        if (needsSave) saveReels(migratedList, true);
        return migratedList;
      }
    } catch (e) {}
    var seeded = SEED_REELS.map(migrateReelSchema);
    saveReels(seeded, true);
    return seeded;
  }

  function saveReels(list, skipBroadcast) {
    try {
      var safeList = list.map(function (r) {
        if (r && r.mediaSrc && r.mediaSrc.indexOf('blob:') === 0) {
          runtimeMediaMap[r.id] = { type: r.mediaType || 'video', src: r.mediaSrc };
          var fallbackImg = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
          if (r.spotId && typeof RESTAURANTS_DATA !== 'undefined') {
            var sp = RESTAURANTS_DATA.find(function (x) { return x.id === Number(r.spotId); });
            if (sp && sp.image) fallbackImg = sp.image;
          }
          return Object.assign({}, r, {
            mediaSrc: fallbackImg,
            mediaType: 'image'
          });
        }
        return r;
      });
      try {
        localStorage.setItem(REELS_KEY, JSON.stringify(safeList));
      } catch (quotaErr) {
        // Nếu vượt hạn mức localStorage do video base64 lớn, giữ bản fallback nhẹ trong storage và phát từ runtimeMediaMap
        var liteList = safeList.map(function (r) {
          if (r && r.mediaSrc && r.mediaSrc.indexOf('data:video/') === 0) {
            runtimeMediaMap[r.id] = { type: 'video', src: r.mediaSrc };
            return Object.assign({}, r, {
              mediaType: 'image',
              mediaSrc: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'
            });
          }
          return r;
        });
        localStorage.setItem(REELS_KEY, JSON.stringify(liteList));
      }
      if (!skipBroadcast && syncChannel) {
        syncChannel.postMessage({ type: 'reels_updated', ts: Date.now() });
      }
    } catch (e) {}
  }

  function getTotalLikes(r) {
    return (Number(r && r.baseLikes) || 0) + (Array.isArray(r && r.likedBy) ? r.likedBy.length : 0);
  }

  function hasActorLiked(r, actorKey) {
    if (!r || !Array.isArray(r.likedBy) || !actorKey) return false;
    for (var i = 0; i < r.likedBy.length; i++) {
      if (r.likedBy[i] && r.likedBy[i].user === actorKey) return true;
    }
    return false;
  }

  function hasActorSaved(r, actorKey) {
    if (!r || !Array.isArray(r.savedBy) || !actorKey) return false;
    for (var i = 0; i < r.savedBy.length; i++) {
      if (r.savedBy[i] === actorKey) return true;
    }
    return false;
  }

  function isMyReel(r, actor) {
    if (!r || !actor) return false;
    var aUser = String(r.authorUser || '').toLowerCase();
    return aUser === actor.key || (r.authorKey && r.authorKey === actor.key);
  }

  var reelsData = loadReels();

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeViSimple(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase();
  }

  function populateSpotSelect() {
    var sel = $('reelSpotSelect');
    if (!sel || typeof RESTAURANTS_DATA === 'undefined') return;
    var distFilter = $('reelDistrictSelect') ? $('reelDistrictSelect').value : '';
    var searchRaw = $('reelSpotSearch') ? $('reelSpotSearch').value.trim() : '';
    var normSearch = normalizeViSimple(searchRaw);
    var prevVal = sel.value;

    var pool = RESTAURANTS_DATA.filter(function (r) {
      if (distFilter && r.district !== distFilter && !normSearch) return false;
      if (normSearch) {
        var text = normalizeViSimple((r.name || '') + ' ' + (r.address || '') + ' ' + (r.district || ''));
        if (text.indexOf(normSearch) === -1) return false;
      }
      return true;
    });

    // Hiển thị tối đa 250 quán khớp nhất để hiện trọn vẹn cả 200 quán mỗi quận mà select vẫn mượt
    var capped = pool.slice(0, 250);
    sel.innerHTML = '<option value="">🍽️ Gắn thẻ quán ăn (' + pool.length + ' quán phù hợp)</option>';
    var hasPrev = false;
    capped.forEach(function (r) {
      var opt = document.createElement('option');
      opt.value = String(r.id);
      opt.textContent = r.name + ' — ' + r.district;
      if (prevVal && opt.value === prevVal) hasPrev = true;
      sel.appendChild(opt);
    });
    sel.value = hasPrev ? prevVal : '';
  }

  $('reelDistrictSelect')?.addEventListener('change', populateSpotSelect);
  $('reelSpotSearch')?.addEventListener('input', populateSpotSelect);

  function getFilteredReels() {
    reelsData = loadReels();
    var actor = getReelActor();
    if (reelFilter === 'hot') {
      return reelsData.slice().sort(function (a, b) { return getTotalLikes(b) - getTotalLikes(a); });
    }
    if (reelFilter === 'saved') {
      return reelsData.filter(function (r) { return hasActorSaved(r, actor.key); });
    }
    if (reelFilter === 'mine') {
      return reelsData.filter(function (r) { return isMyReel(r, actor); });
    }
    return reelsData;
  }

  function mutateReelById(reelId, mutator) {
    // Luôn nạp mới từ localStorage trước khi ghi để tránh ghi đè chéo tab/tài khoản
    var fresh = loadReels();
    var item = fresh.find(function (x) { return x.id === reelId; });
    if (!item) return null;
    mutator(item, fresh);
    saveReels(fresh, false);
    reelsData = fresh;
    return item;
  }

  function spawnHeartBurst(slideEl, clientX, clientY) {
    if (!slideEl) return;
    var rect = slideEl.getBoundingClientRect();
    var x = (typeof clientX === 'number' && clientX > 0) ? (clientX - rect.left) : (rect.width / 2);
    var y = (typeof clientY === 'number' && clientY > 0) ? (clientY - rect.top) : (rect.height / 2);
    var burst = document.createElement('div');
    burst.className = 'reel-heart-burst';
    burst.textContent = '❤️';
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    slideEl.appendChild(burst);
    setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 820);
  }

  function isSafeMediaUrl(url) {
    var u = String(url || '').trim();
    return u.indexOf('https://') === 0 || u.indexOf('http://') === 0 || u.indexOf('data:image/') === 0 || u.indexOf('data:video/') === 0 || u.indexOf('blob:') === 0;
  }

  function buildShareLink(item) {
    var payload = {
      id: item.id,
      authorName: item.authorName,
      authorUser: item.authorUser || '',
      district: item.district,
      spotId: item.spotId,
      caption: item.caption,
      baseLikes: getTotalLikes(item),
      mediaType: item.mediaType,
      mediaSrc: (item.mediaSrc && item.mediaSrc.indexOf('http') === 0) ? item.mediaSrc : ''
    };
    var encoded = '';
    try {
      encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch (e) {}
    var base = window.location.href.split('#')[0];
    return base + '#reel=' + encodeURIComponent(item.id) + (encoded ? ('&reelshare=' + encodeURIComponent(encoded)) : '');
  }

  function toggleReelLike(rid, forceLikeOnly, burstTarget, bx, by) {
    var actor = getReelActor();
    var updated = mutateReelById(rid, function (item) {
      if (!Array.isArray(item.likedBy)) item.likedBy = [];
      var idx = -1;
      for (var i = 0; i < item.likedBy.length; i++) {
        if (item.likedBy[i] && item.likedBy[i].user === actor.key) { idx = i; break; }
      }
      if (idx !== -1) {
        if (!forceLikeOnly) {
          item.likedBy.splice(idx, 1);
        }
      } else {
        var nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        item.likedBy.unshift({
          user: actor.key,
          name: actor.name,
          avatar: actor.avatar || '',
          time: 'Lúc ' + nowStr
        });
      }
    });
    if (!updated) return;

    var isLikedNow = hasActorLiked(updated, actor.key);
    var total = getTotalLikes(updated);

    var findFeedEl = function (attr, val) {
      var els = feedEl.querySelectorAll('[' + attr + ']');
      for (var j = 0; j < els.length; j++) {
        if (els[j].getAttribute(attr) === val) return els[j];
      }
      return null;
    };

    var btn = findFeedEl('data-reel-like', rid);
    if (btn) {
      btn.classList.toggle('liked', isLikedNow);
      var iconEl = btn.querySelector('.reel-act-icon');
      if (iconEl) iconEl.textContent = isLikedNow ? '❤️' : '🤍';
    }
    var countBtn = findFeedEl('data-reel-likers', rid);
    if (countBtn) countBtn.textContent = total;
    var summaryBtn = findFeedEl('data-reel-likers-summary', rid);
    if (summaryBtn) summaryBtn.textContent = buildLikersSummaryText(updated);

    if (isLikedNow && burstTarget) {
      spawnHeartBurst(burstTarget, bx, by);
    }
    if (activeLikersReelId === rid && $('reelLikersDrawer') && !$('reelLikersDrawer').hidden) {
      openReelLikers(rid);
    }
  }

  function buildLikersSummaryText(r) {
    var list = Array.isArray(r.likedBy) ? r.likedBy : [];
    var total = getTotalLikes(r);
    if (!list.length) return '❤️ ' + total + ' lượt thích';
    var first = list[0].name;
    if (total === 1) return '❤️ ' + first + ' đã thích';
    return '❤️ ' + first + ' và ' + (total - 1) + ' người khác đã thích ›';
  }

  function openReelLikers(reelId) {
    activeLikersReelId = reelId;
    reelsData = loadReels();
    var item = reelsData.find(function (x) { return x.id === reelId; });
    if (!item) return;
    if ($('reelCommentsDrawer')) $('reelCommentsDrawer').hidden = true;
    var list = Array.isArray(item.likedBy) ? item.likedBy : [];
    var total = getTotalLikes(item);

    if ($('reelLikersTitle')) {
      $('reelLikersTitle').textContent = '❤️ Người đã thả tim (' + total + ')';
    }
    var bodyEl = $('reelLikersList');
    if (bodyEl) {
      var itemsHtml = list.map(function (l) {
        var av = l.avatar
          ? '<img src="' + esc(l.avatar) + '" alt="av" />'
          : esc((l.name || 'K').charAt(0).toUpperCase());
        return '<div class="reel-liker-row">' +
          '<div class="reel-liker-av">' + av + '</div>' +
          '<div class="reel-liker-meta">' +
            '<strong>' + esc(l.name) + '</strong>' +
            '<span>' + (l.user.indexOf('guest_') === 0 ? 'Khách tham quan' : esc(l.user)) + ' • ' + esc(l.time || 'Gần đây') + '</span>' +
          '</div>' +
          '<span class="reel-liker-heart">❤️</span>' +
        '</div>';
      }).join('');

      if (item.baseLikes > 0) {
        itemsHtml += '<div class="reel-liker-note">✨ Cùng <strong>' + item.baseLikes + '</strong> lượt thả tim từ cộng đồng thực khách Hà Thành khác.</div>';
      }
      if (!itemsHtml) {
        itemsHtml = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.84rem;">Chưa có ai thả tim bài này. Hãy là người đầu tiên nhé! ❤️</div>';
      }
      bodyEl.innerHTML = itemsHtml;
    }
    if ($('reelLikersDrawer')) $('reelLikersDrawer').hidden = false;
  }

  function renderReelsFeed(preserveScroll) {
    var prevScroll = preserveScroll ? feedEl.scrollTop : 0;
    var actor = getReelActor();
    var list = getFilteredReels();

    if (!list.length) {
      feedEl.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#E2E8F0;padding:24px;text-align:center;">' +
        '<div style="font-size:2.4rem;margin-bottom:8px;">🎬</div>' +
        '<p style="font-size:0.95rem;margin-bottom:12px;">Chưa có Reel nào trong mục này. Hãy là người đầu tiên đăng bài hoặc thả tim lưu lại nhé!</p>' +
        '<button type="button" class="reels-create-btn" id="btnEmptyCreateReel">➕ Đăng Reel Ngay</button>' +
      '</div>';
      $('btnEmptyCreateReel')?.addEventListener('click', openReelUpload);
      return;
    }

    feedEl.innerHTML = list.map(function (r) {
      var likedByMe = hasActorLiked(r, actor.key);
      var savedByMe = hasActorSaved(r, actor.key);
      var mine = isMyReel(r, actor);
      var totalLikes = getTotalLikes(r);

      var safeMedia = isSafeMediaUrl(r.mediaSrc)
        ? r.mediaSrc
        : 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
      var mediaHtml = r.mediaType === 'video'
        ? '<video class="reel-media" src="' + esc(safeMedia) + '" autoplay loop muted playsinline controls></video>'
        : '<img class="reel-media kenburns" src="' + esc(safeMedia) + '" alt="' + esc(r.caption) + '" />';

      var avHtml = (r.avatarData && isSafeMediaUrl(r.avatarData))
        ? '<img src="' + esc(r.avatarData) + '" alt="av" />'
        : esc((r.authorName || 'T').charAt(0).toUpperCase());

      var spotHtml = '';
      if (r.spotId && typeof RESTAURANTS_DATA !== 'undefined') {
        var spot = RESTAURANTS_DATA.find(function (x) { return x.id === Number(r.spotId); });
        if (spot) {
          spotHtml = '<button type="button" class="reel-spot-pill" data-reel-spot="' + spot.id + '">🍽️ ' + esc(spot.name) + ' • ⭐ ' + spot.rating + ' (Xem quán ↗)</button>';
        }
      }

      var safeId = esc(r.id);
      return '<article class="reel-slide" data-reel-id="' + safeId + '">' +
        mediaHtml +
        '<div class="reel-scrim"></div>' +
        '<div class="reel-actions-col">' +
          '<div class="reel-author-av" title="' + esc(r.authorName) + '">' + avHtml + '</div>' +
          '<div class="reel-like-stack">' +
            '<button type="button" class="reel-act-btn' + (likedByMe ? ' liked' : '') + '" data-reel-like="' + safeId + '" title="Thả tim bài đăng">' +
              '<span class="reel-act-icon">' + (likedByMe ? '❤️' : '🤍') + '</span>' +
            '</button>' +
            '<button type="button" class="reel-likers-count-btn" data-reel-likers="' + safeId + '" title="Xem danh sách người đã thả tim">' + totalLikes + '</button>' +
          '</div>' +
          '<button type="button" class="reel-act-btn" data-reel-comments="' + safeId + '" title="Bình luận">' +
            '<span class="reel-act-icon">💬</span>' +
            '<span class="reel-act-count">' + (r.comments ? r.comments.length : 0) + '</span>' +
          '</button>' +
          '<button type="button" class="reel-act-btn' + (savedByMe ? ' saved' : '') + '" data-reel-save="' + safeId + '" title="Lưu Reel này">' +
            '<span class="reel-act-icon">' + (savedByMe ? '🔖' : '📑') + '</span>' +
            '<span class="reel-act-count">' + (savedByMe ? 'Đã lưu' : 'Lưu') + '</span>' +
          '</button>' +
          '<button type="button" class="reel-act-btn" data-reel-share="' + safeId + '" title="Chia sẻ liên kết">' +
            '<span class="reel-act-icon">↗️</span>' +
            '<span class="reel-act-count">Chia sẻ</span>' +
          '</button>' +
          (mine ? (
            '<button type="button" class="reel-act-btn reel-del-btn" data-reel-delete="' + safeId + '" title="Xóa bài của bạn">' +
              '<span class="reel-act-icon">🗑️</span>' +
              '<span class="reel-act-count">Xóa</span>' +
            '</button>'
          ) : '') +
        '</div>' +
        '<div class="reel-info-bottom">' +
          '<div class="reel-author-row">' +
            '<span class="reel-author-name">@' + esc(r.authorName) + '</span>' +
            '<span class="reel-dist-pill">📍 ' + esc(r.district || 'Hà Nội') + '</span>' +
          '</div>' +
          '<p class="reel-caption">' + esc(r.caption) + '</p>' +
          '<div class="reel-meta-links">' +
            spotHtml +
            '<button type="button" class="reel-likers-summary-btn" data-reel-likers-summary="' + safeId + '">' + esc(buildLikersSummaryText(r)) + '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    if (preserveScroll && prevScroll > 0) {
      feedEl.scrollTop = prevScroll;
    }

    // Wire slide actions
    feedEl.querySelectorAll('.reel-slide').forEach(function (slide) {
      var rid = slide.getAttribute('data-reel-id');
      var lastTap = 0;
      slide.addEventListener('dblclick', function (e) {
        if (e.target.closest('button') || e.target.closest('video')) return;
        toggleReelLike(rid, true, slide, e.clientX, e.clientY);
      });
      slide.addEventListener('touchend', function (e) {
        if (e.target.closest('button') || e.target.closest('video')) return;
        var now = Date.now();
        if (now - lastTap < 300) {
          var t = e.changedTouches && e.changedTouches[0];
          toggleReelLike(rid, true, slide, t ? t.clientX : null, t ? t.clientY : null);
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }, { passive: true });
    });

    feedEl.querySelectorAll('[data-reel-like]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = btn.getAttribute('data-reel-like');
        var slide = btn.closest('.reel-slide');
        toggleReelLike(rid, false, slide);
      });
    });

    feedEl.querySelectorAll('[data-reel-likers], [data-reel-likers-summary]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = btn.getAttribute('data-reel-likers') || btn.getAttribute('data-reel-likers-summary');
        openReelLikers(rid);
      });
    });

    feedEl.querySelectorAll('[data-reel-save]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = btn.getAttribute('data-reel-save');
        var act = getReelActor();
        var updated = mutateReelById(rid, function (item) {
          if (!Array.isArray(item.savedBy)) item.savedBy = [];
          var idx = item.savedBy.indexOf(act.key);
          if (idx !== -1) item.savedBy.splice(idx, 1);
          else item.savedBy.push(act.key);
        });
        if (!updated) return;
        var savedNow = hasActorSaved(updated, act.key);
        btn.classList.toggle('saved', savedNow);
        btn.querySelector('.reel-act-icon').textContent = savedNow ? '🔖' : '📑';
        btn.querySelector('.reel-act-count').textContent = savedNow ? 'Đã lưu' : 'Lưu';
        if (reelFilter === 'saved' && !savedNow) renderReelsFeed(true);
      });
    });

    feedEl.querySelectorAll('[data-reel-comments]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openReelComments(btn.getAttribute('data-reel-comments'));
      });
    });

    feedEl.querySelectorAll('[data-reel-share]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = btn.getAttribute('data-reel-share');
        reelsData = loadReels();
        var item = reelsData.find(function (x) { return x.id === rid; });
        if (!item) return;
        var shareUrl = buildShareLink(item);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            window.alert('🔗 Đã sao chép đường link Reel! Gửi link này để bạn bè mở trực tiếp & thả tim bài viết:\n\n' + shareUrl);
          }).catch(function () {
            window.prompt('🔗 Sao chép đường link Reel để chia sẻ với bạn bè:', shareUrl);
          });
        } else {
          window.prompt('🔗 Sao chép đường link Reel để chia sẻ với bạn bè:', shareUrl);
        }
      });
    });

    feedEl.querySelectorAll('[data-reel-delete]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = btn.getAttribute('data-reel-delete');
        if (!window.confirm('Bạn có chắc muốn xóa bài Reel này?')) return;
        delete runtimeMediaMap[rid];
        if (activeCommentReelId === rid && $('reelCommentsDrawer')) {
          $('reelCommentsDrawer').hidden = true;
          activeCommentReelId = null;
        }
        if (activeLikersReelId === rid && $('reelLikersDrawer')) {
          $('reelLikersDrawer').hidden = true;
          activeLikersReelId = null;
        }
        var fresh = loadReels().filter(function (x) { return x.id !== rid; });
        saveReels(fresh, false);
        reelsData = fresh;
        renderReelsFeed(false);
      });
    });

    feedEl.querySelectorAll('[data-reel-spot]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var sid = parseInt(btn.getAttribute('data-reel-spot'), 10);
        modal.classList.remove('open');
        if (typeof window.openRestaurantDetail === 'function') {
          window.openRestaurantDetail(sid);
        } else {
          var cardBtn = document.querySelector('.btn-card-details[data-id="' + sid + '"]');
          if (cardBtn) cardBtn.click();
        }
      });
    });
  }

  /* ---- Comments Drawer ---- */
  function openReelComments(reelId) {
    activeCommentReelId = reelId;
    if ($('reelLikersDrawer')) $('reelLikersDrawer').hidden = true;
    reelsData = loadReels();
    var actor = getReelActor();
    var item = reelsData.find(function (x) { return x.id === reelId; });
    if (!item) return;
    if ($('reelCommentsTitle')) $('reelCommentsTitle').textContent = '💬 Bình luận (' + (item.comments ? item.comments.length : 0) + ')';
    var listEl = $('reelCommentsList');
    if (listEl) {
      var cmts = item.comments || [];
      listEl.innerHTML = cmts.length
        ? cmts.map(function (c) {
            var cLikes = Array.isArray(c.likedBy) ? c.likedBy : [];
            var likedByMe = cLikes.indexOf(actor.key) !== -1;
            return '<div class="reel-comment-item">' +
              '<div class="reel-comment-head">' +
                '<div><strong>' + esc(c.author) + '</strong><span>' + esc(c.time) + '</span></div>' +
                '<button type="button" class="reel-cmt-like-btn' + (likedByMe ? ' liked' : '') + '" data-cmt-like="' + esc(c.id) + '" title="Thích bình luận">' +
                  (likedByMe ? '❤️ ' : '🤍 ') + cLikes.length +
                '</button>' +
              '</div>' +
              '<p>' + esc(c.text) + '</p>' +
            '</div>';
          }).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.84rem;">Chưa có bình luận nào. Hãy để lại bình luận đầu tiên nhé!</div>';

      listEl.querySelectorAll('[data-cmt-like]').forEach(function (cBtn) {
        cBtn.addEventListener('click', function () {
          var cid = cBtn.getAttribute('data-cmt-like');
          mutateReelById(reelId, function (r) {
            var cObj = (r.comments || []).find(function (x) { return x.id === cid; });
            if (!cObj) return;
            if (!Array.isArray(cObj.likedBy)) cObj.likedBy = [];
            var idx = cObj.likedBy.indexOf(actor.key);
            if (idx !== -1) cObj.likedBy.splice(idx, 1);
            else cObj.likedBy.push(actor.key);
          });
          openReelComments(reelId);
        });
      });
    }
    if ($('reelCommentsDrawer')) $('reelCommentsDrawer').hidden = false;
  }

  function postReelComment() {
    var inp = $('reelCommentInput');
    var txt = (inp && inp.value || '').trim();
    if (!txt || !activeCommentReelId) return;
    var actor = getReelActor();
    var updated = mutateReelById(activeCommentReelId, function (item) {
      if (!item.comments) item.comments = [];
      item.comments.push({
        id: 'c_' + Date.now(),
        author: actor.name,
        authorEmail: actor.key,
        time: 'Vừa xong',
        text: txt,
        likedBy: []
      });
    });
    if (!updated) return;
    inp.value = '';
    openReelComments(activeCommentReelId);
    var cmtBtns = feedEl.querySelectorAll('[data-reel-comments]');
    for (var ci = 0; ci < cmtBtns.length; ci++) {
      if (cmtBtns[ci].getAttribute('data-reel-comments') === activeCommentReelId) {
        var countEl = cmtBtns[ci].querySelector('.reel-act-count');
        if (countEl) countEl.textContent = updated.comments.length;
        break;
      }
    }
  }

  $('btnCloseReelComments')?.addEventListener('click', function () {
    if ($('reelCommentsDrawer')) $('reelCommentsDrawer').hidden = true;
  });
  $('btnCloseReelLikers')?.addEventListener('click', function () {
    if ($('reelLikersDrawer')) $('reelLikersDrawer').hidden = true;
  });
  $('btnPostReelComment')?.addEventListener('click', postReelComment);
  $('reelCommentInput')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); postReelComment(); }
  });

  /* ---- Upload / Create Reel ---- */
  function openReelUpload() {
    if ($('reelSpotSearch')) $('reelSpotSearch').value = '';
    if ($('reelMediaInput')) $('reelMediaInput').value = '';
    populateSpotSelect();
    pendingMedia = null;
    if ($('reelMediaPreview')) { $('reelMediaPreview').innerHTML = ''; $('reelMediaPreview').hidden = true; }
    if ($('reelDropzoneText')) $('reelDropzoneText').textContent = '📷 / 🎥 Bấm để chọn Ảnh hoặc Video ngắn từ máy';
    if ($('reelUploadOverlay')) $('reelUploadOverlay').hidden = false;
  }

  $('btnOpenReelUpload')?.addEventListener('click', openReelUpload);
  $('btnCloseReelUpload')?.addEventListener('click', function () {
    if ($('reelUploadOverlay')) $('reelUploadOverlay').hidden = true;
  });

  $('reelMediaInput')?.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var prev = $('reelMediaPreview');
    if (file.type.indexOf('video/') === 0) {
      var showVideoPreview = function (srcUrl) {
        pendingMedia = { type: 'video', src: srcUrl };
        if (prev) {
          prev.innerHTML = '<video src="' + esc(srcUrl) + '" autoplay loop muted playsinline controls></video>';
          prev.hidden = false;
        }
        if ($('reelDropzoneText')) $('reelDropzoneText').textContent = '🎥 Đã chọn video: ' + file.name;
      };
      if (file.size <= 2.5 * 1024 * 1024) {
        var vReader = new FileReader();
        vReader.onload = function (ev) { showVideoPreview(ev.target.result); };
        vReader.onerror = function () { showVideoPreview(URL.createObjectURL(file)); };
        vReader.readAsDataURL(file);
      } else {
        showVideoPreview(URL.createObjectURL(file));
      }
    } else {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var ratio = Math.min(720 / img.width, 960 / img.height, 1);
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          pendingMedia = { type: 'image', src: dataUrl };
          if (prev) {
            prev.innerHTML = '<img src="' + dataUrl + '" alt="Preview" />';
            prev.hidden = false;
          }
          if ($('reelDropzoneText')) $('reelDropzoneText').textContent = '📷 Đã chọn ảnh: ' + file.name;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  $('formCreateReel')?.addEventListener('submit', function (e) {
    e.preventDefault();
    var cap = ($('reelCaptionInput')?.value || '').trim();
    if (!cap) {
      window.alert('✍️ Hãy nhập đôi dòng cảm nhận về món ăn hoặc quán trước khi đăng nhé!');
      return;
    }
    var actor = getReelActor();
    var dist = $('reelDistrictSelect') ? $('reelDistrictSelect').value : 'Hoàn Kiếm';
    var spotId = $('reelSpotSelect') && $('reelSpotSelect').value ? parseInt($('reelSpotSelect').value, 10) : null;

    var fallbackImg = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
    if (spotId && typeof RESTAURANTS_DATA !== 'undefined') {
      var spot = RESTAURANTS_DATA.find(function (r) { return r.id === spotId; });
      if (spot && spot.image) fallbackImg = spot.image;
    }

    var newReel = {
      id: 'reel_' + Date.now(),
      authorName: actor.name,
      authorUser: actor.key,
      authorKey: actor.key,
      avatarData: actor.avatar || '',
      district: dist,
      spotId: spotId,
      mediaType: pendingMedia ? pendingMedia.type : 'image',
      mediaSrc: pendingMedia ? pendingMedia.src : fallbackImg,
      caption: cap,
      baseLikes: 0,
      likedBy: [],
      savedBy: [],
      comments: []
    };

    var fresh = loadReels();
    fresh.unshift(newReel);
    saveReels(fresh, false);
    reelsData = fresh;

    $('formCreateReel').reset();
    pendingMedia = null;
    if ($('reelUploadOverlay')) $('reelUploadOverlay').hidden = true;
    reelFilter = 'all';
    document.querySelectorAll('.reels-filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-reel-filter') === 'all');
    });
    renderReelsFeed(false);
    feedEl.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---- Deep-Link Open (#reel=<id>&reelshare=...) ---- */
  function openSharedReelFromHash() {
    var h = window.location.hash || '';
    if (h.indexOf('reel=') === -1) return;
    var matchId = h.match(/reel=([^&]+)/);
    var matchSnap = h.match(/reelshare=([^&]+)/);
    var targetId = matchId ? decodeURIComponent(matchId[1]) : '';
    if (!targetId) return;

    var fresh = loadReels();
    var exists = fresh.some(function (r) { return r.id === targetId; });
    if (!exists && matchSnap) {
      try {
        var jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(matchSnap[1]))));
        var snap = JSON.parse(jsonStr);
        if (snap && snap.id) {
          var safeSrc = (snap.mediaSrc && (String(snap.mediaSrc).indexOf('https://') === 0 || String(snap.mediaSrc).indexOf('http://') === 0))
            ? snap.mediaSrc
            : '';
          if (!safeSrc && snap.spotId && typeof RESTAURANTS_DATA !== 'undefined') {
            var sp = RESTAURANTS_DATA.find(function (x) { return x.id === Number(snap.spotId); });
            if (sp && sp.image) safeSrc = sp.image;
          }
          if (!safeSrc) {
            safeSrc = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
          }
          fresh.unshift(migrateReelSchema({
            id: String(snap.id),
            authorName: snap.authorName || 'Thực Khách Hà Thành',
            authorUser: snap.authorUser || 'shared@gmail.com',
            district: snap.district || 'Hoàn Kiếm',
            spotId: snap.spotId ? Number(snap.spotId) : null,
            mediaType: (snap.mediaType === 'video' && snap.mediaSrc && safeSrc === snap.mediaSrc) ? 'video' : 'image',
            mediaSrc: safeSrc,
            caption: snap.caption || 'Bài viết chia sẻ từ Hà Nội Phố Vị',
            baseLikes: Math.max(0, Number(snap.baseLikes) || 0),
            likedBy: [],
            savedBy: [],
            comments: []
          }));
          saveReels(fresh, true);
        }
      } catch (e) {}
    }

    reelFilter = 'all';
    document.querySelectorAll('.reels-filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-reel-filter') === 'all');
    });
    modal.classList.add('open');
    renderReelsFeed(false);
    var targetEl = null;
    var slides = feedEl.querySelectorAll('.reel-slide');
    for (var si = 0; si < slides.length; si++) {
      if (slides[si].getAttribute('data-reel-id') === targetId) {
        targetEl = slides[si];
        break;
      }
    }
    if (targetEl) {
      requestAnimationFrame(function () {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  /* ---- Multi-Tab & Auth Sync Listeners ---- */
  function syncReelsView() {
    if (!modal.classList.contains('open')) return;
    renderReelsFeed(true);
    if (activeCommentReelId && $('reelCommentsDrawer') && !$('reelCommentsDrawer').hidden) {
      openReelComments(activeCommentReelId);
    }
    if (activeLikersReelId && $('reelLikersDrawer') && !$('reelLikersDrawer').hidden) {
      openReelLikers(activeLikersReelId);
    }
  }

  if (syncChannel) {
    syncChannel.onmessage = function () { syncReelsView(); };
  }
  window.addEventListener('storage', function (e) {
    if (e.key === REELS_KEY) syncReelsView();
  });
  window.addEventListener('hn-auth-changed', function () {
    syncReelsView();
  });

  /* ---- Navigation & Filter Events ---- */
  function stepReel(dir) {
    var h = feedEl.clientHeight || 500;
    feedEl.scrollBy({ top: dir * h, behavior: 'smooth' });
  }
  $('btnReelPrev')?.addEventListener('click', function () { stepReel(-1); });
  $('btnReelNext')?.addEventListener('click', function () { stepReel(1); });

  document.querySelectorAll('.reels-filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      reelFilter = btn.getAttribute('data-reel-filter');
      document.querySelectorAll('.reels-filter-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      renderReelsFeed(false);
      feedEl.scrollTo({ top: 0 });
    });
  });

  function closeReelsModal() {
    modal.classList.remove('open');
    modal.querySelectorAll('video').forEach(function (v) {
      try { v.pause(); } catch (e) {}
    });
  }

  btnOpen.addEventListener('click', function () {
    modal.classList.add('open');
    renderReelsFeed(false);
    feedEl.focus();
  });
  btnClose?.addEventListener('click', closeReelsModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeReelsModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      modal.querySelectorAll('video').forEach(function (v) {
        try { v.pause(); } catch (err) {}
      });
    }
    if (!modal.classList.contains('open')) return;
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); stepReel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); stepReel(-1); }
  });

  window.addEventListener('hashchange', openSharedReelFromHash);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openSharedReelFromHash);
  } else {
    openSharedReelFromHash();
  }
})();
