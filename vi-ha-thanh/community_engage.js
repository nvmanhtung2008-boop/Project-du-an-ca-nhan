/**
 * HANOI PHO VI - COMMUNITY ENGAGEMENT MODULE
 * Custom Lists (HNCustomLists), Link Sharing (HNShare),
 * Group Dining Polls (HNGroupPoll), and Reviewer Points & Badges (HNRewards)
 * Pure ES5 IIFE style for maximum browser & unit-test engine compatibility.
 */
(function () {
  'use strict';

  var LISTS_KEY = 'hanoi_phovi_custom_lists_v1';
  var POLLS_KEY = 'hanoi_phovi_group_polls_v1';
  var REVIEWS_KEY = 'hanoi_phovi_user_reviews_v1';
  var REWARDS_KEY = 'hanoi_phovi_rewards_v1';
  var SYNC_CHANNEL_NAME = 'hanoi_phovi_engage_sync';

  var BADGE_TIERS = [
    { id: 'newcomer', minPoints: 0, icon: '🌱', nameVi: 'Thực khách mới', nameEn: 'New Diner', label: '🌱 Thực khách mới' },
    { id: 'old_quarter', minPoints: 50, icon: '🥢', nameVi: 'Sành ăn Phố Cổ', nameEn: 'Old Quarter Foodie', label: '🥢 Sành ăn Phố Cổ' },
    { id: 'hanoi_local', minPoints: 150, icon: '🧭', nameVi: 'Thổ địa Hà Thành', nameEn: 'Hanoi Local Guide', label: '🧭 Thổ địa Hà Thành' },
    { id: 'critic', minPoints: 300, icon: '🏆', nameVi: 'Nhà phê bình ẩm thực', nameEn: 'Culinary Critic', label: '🏆 Nhà phê bình ẩm thực' },
    { id: 'ambassador', minPoints: 600, icon: '👑', nameVi: 'Đại sứ Phố Vị', nameEn: 'Pho Vi Ambassador', label: '👑 Đại sứ Phố Vị' }
  ];

  var REVIEW_QUICK_TAGS = [
    { vi: 'Đậm vị truyền thống', en: 'Authentic taste' },
    { vi: 'Phục vụ nhanh', en: 'Fast service' },
    { vi: 'Không gian yên tĩnh', en: 'Quiet space' },
    { vi: 'Đáng đồng tiền', en: 'Great value' },
    { vi: 'Hợp gia đình', en: 'Family-friendly' },
    { vi: 'Sạch sẽ', en: 'Clean & tidy' }
  ];

  var syncChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    }
  } catch (e) {
    syncChannel = null;
  }

  var activeEngageTab = 'lists';
  var pendingSharedList = null;
  var highlightedPollId = null;
  var pollDraftSelectedIds = [];
  var pollDraftSource = 'filtered';
  var pollDraftSearch = '';
  var pollDraftTitle = '';
  var activeDetailListPickerOpen = false;
  var selectedReviewRating = 5;
  var selectedReviewTags = [];

  /* ------------------------------------------------------------------
   * ES5 HELPERS & STORAGE UTILITIES
   * ------------------------------------------------------------------ */

  function isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function hasInArray(arr, val) {
    if (!isArray(arr)) return false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === val) return true;
    }
    return false;
  }

  function trimStr(s) {
    return String(s === null || typeof s === 'undefined' ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  function cloneSimple(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return obj;
    }
  }

  function escapeHtml(str) {
    return String(str === null || typeof str === 'undefined' ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normText(str) {
    var s = String(str || '').toLowerCase();
    try {
      if (typeof s.normalize === 'function') {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
    } catch (e) {}
    return s.replace(/đ/g, 'd');
  }

  function isEn() {
    return !!(window.HNi18n && typeof window.HNi18n.getLang === 'function' && window.HNi18n.getLang() === 'en');
  }

  function tr(viText, enText) {
    return isEn() ? enText : viText;
  }

  function getRestaurants() {
    if (window.HNAppBridge && typeof window.HNAppBridge.getAllRestaurants === 'function') {
      var fromBridge = window.HNAppBridge.getAllRestaurants();
      if (isArray(fromBridge)) return fromBridge;
    }
    if (typeof RESTAURANTS_DATA !== 'undefined' && isArray(RESTAURANTS_DATA)) {
      return RESTAURANTS_DATA;
    }
    return [];
  }

  function findRestaurantById(id) {
    var numId = Number(id);
    if (isNaN(numId)) return null;
    var list = getRestaurants();
    for (var i = 0; i < list.length; i++) {
      if (Number(list[i].id) === numId) return list[i];
    }
    return null;
  }

  function getCurrentUser() {
    try {
      if (window.HNAuth && typeof window.HNAuth.getCurrentUser === 'function') {
        return window.HNAuth.getCurrentUser();
      }
    } catch (e) {}
    return null;
  }

  function getAccountKey() {
    var u = getCurrentUser();
    var raw = u && (u.email || u.username);
    return raw ? trimStr(raw).toLowerCase() : 'guest';
  }

  function getUserDisplayName() {
    var u = getCurrentUser();
    if (u) {
      return trimStr(u.fullName || u.name || u.username || u.email) || tr('Thực khách', 'Diner');
    }
    return tr('Thực khách ẩn danh', 'Guest Diner');
  }

  var memoryFallbackStore = {};

  function getStorageSafe() {
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
        return window.localStorage;
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        return localStorage;
      }
    } catch (e2) {}
    return null;
  }

  function readJson(key, fallback) {
    var raw = null;
    try {
      var ls = getStorageSafe();
      if (ls) {
        raw = ls.getItem(key);
      } else if (Object.prototype.hasOwnProperty.call(memoryFallbackStore, key)) {
        raw = memoryFallbackStore[key];
      }
    } catch (e) {
      if (Object.prototype.hasOwnProperty.call(memoryFallbackStore, key)) {
        raw = memoryFallbackStore[key];
      }
    }
    try {
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed !== null && typeof parsed !== 'undefined' ? parsed : fallback;
    } catch (e2) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    var serialized = '';
    try {
      serialized = JSON.stringify(val);
    } catch (e) {
      return false;
    }
    try {
      var ls = getStorageSafe();
      if (ls) {
        ls.setItem(key, serialized);
        return true;
      }
    } catch (e2) {}
    memoryFallbackStore[key] = serialized;
    return true;
  }

  function showToastMsg(msg) {
    if (window.HNAppBridge && typeof window.HNAppBridge.showToast === 'function') {
      window.HNAppBridge.showToast(msg);
      return;
    }
    var toast = typeof document !== 'undefined' ? document.getElementById('toastNotice') : null;
    if (toast) {
      toast.innerHTML = '<span>✨</span> <span>' + escapeHtml(msg) + '</span>';
      toast.classList.add('show');
      setTimeout(function () {
        toast.classList.remove('show');
      }, 2800);
    }
  }

  function broadcastEngageSync(kind) {
    try {
      if (syncChannel) {
        syncChannel.postMessage({ kind: kind || 'all', ts: Date.now(), account: getAccountKey() });
      }
    } catch (e) {}
  }

  function formatDateTime(ts) {
    try {
      var d = new Date(ts || Date.now());
      var dd = d.getDate();
      var mm = d.getMonth() + 1;
      var hh = d.getHours();
      var mi = d.getMinutes();
      return (dd < 10 ? '0' : '') + dd + '/' + (mm < 10 ? '0' : '') + mm + '/' + d.getFullYear() +
        ' ' + (hh < 10 ? '0' : '') + hh + ':' + (mi < 10 ? '0' : '') + mi;
    } catch (e) {
      return '';
    }
  }

  /* ------------------------------------------------------------------
   * 1. CUSTOM LISTS (window.HNCustomLists)
   * ------------------------------------------------------------------ */

  function pickStarterIdsForCafeWork() {
    var all = getRestaurants();
    var primary = [];
    var secondary = [];
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (!r || !r.id) continue;
      var cat = normText(r.category || '');
      var blob = normText((r.name || '') + ' ' + (r.subname || '') + ' ' + (r.description || '') + ' ' + (r.tips || '') + ' ' + ((r.specialBadges || []).join(' ')));
      var isCafe = cat.indexOf('ca phe') !== -1 || cat.indexOf('tra') !== -1 || blob.indexOf('ca phe') !== -1;
      if (!isCafe) continue;
      if (blob.indexOf('yen tinh') !== -1 || blob.indexOf('doc sach') !== -1 || blob.indexOf('lam viec') !== -1 || blob.indexOf('wifi') !== -1 || blob.indexOf('o cam') !== -1) {
        primary.push(Number(r.id));
      } else {
        secondary.push(Number(r.id));
      }
      if (primary.length >= 5) break;
    }
    var picked = primary.slice(0, 5);
    for (var j = 0; j < secondary.length && picked.length < 5; j++) {
      if (!hasInArray(picked, secondary[j])) picked.push(secondary[j]);
    }
    return picked;
  }

  function pickStarterIdsForFamily() {
    var all = getRestaurants();
    var primary = [];
    var secondary = [];
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (!r || !r.id) continue;
      var occs = isArray(r.occasions) ? r.occasions : [];
      var ppl = isArray(r.peopleCategory) ? r.peopleCategory : [];
      var blob = normText((r.subname || '') + ' ' + (r.description || '') + ' ' + ((r.specialBadges || []).join(' ')));
      if (hasInArray(occs, 'family')) {
        if (hasInArray(ppl, 'party') || hasInArray(ppl, 'group') || blob.indexOf('gia dinh') !== -1 || blob.indexOf('rong rai') !== -1) {
          primary.push(Number(r.id));
        } else {
          secondary.push(Number(r.id));
        }
      }
      if (primary.length >= 5) break;
    }
    var picked = primary.slice(0, 5);
    for (var j = 0; j < secondary.length && picked.length < 5; j++) {
      if (!hasInArray(picked, secondary[j])) picked.push(secondary[j]);
    }
    return picked;
  }

  function buildSeedLists() {
    var now = Date.now();
    return [
      {
        id: 'list_cafe_work',
        name: 'Quán cà phê làm việc',
        emoji: '☕',
        desc: 'Không gian yên tĩnh, ổ cắm & wifi ổn định',
        placeIds: pickStarterIdsForCafeWork(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'list_family',
        name: 'Quán đi với gia đình',
        emoji: '👨‍👩‍👧',
        desc: 'Rộng rãi, phù hợp nhiều thế hệ',
        placeIds: pickStarterIdsForFamily(),
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  function loadAllListsMap() {
    var raw = readJson(LISTS_KEY, {});
    if (!raw || typeof raw !== 'object' || isArray(raw)) {
      return {};
    }
    return raw;
  }

  function ensureAccountLists(acctKey) {
    var map = loadAllListsMap();
    if (!isArray(map[acctKey])) {
      map[acctKey] = buildSeedLists();
      writeJson(LISTS_KEY, map);
    }
    return { map: map, lists: map[acctKey] };
  }

  function sanitizePlaceIds(arr) {
    var out = [];
    if (!isArray(arr)) return out;
    for (var i = 0; i < arr.length; i++) {
      var n = Number(arr[i]);
      if (!isNaN(n) && n > 0 && !hasInArray(out, n)) {
        out.push(n);
      }
    }
    return out;
  }

  function getLists() {
    var acct = getAccountKey();
    var res = ensureAccountLists(acct);
    return cloneSimple(res.lists);
  }

  function createList(name, emoji, desc) {
    var cleanName = trimStr(name);
    if (!cleanName) return null;
    var cleanEmoji = trimStr(emoji) || '📂';
    var cleanDesc = trimStr(desc);
    var acct = getAccountKey();
    var res = ensureAccountLists(acct);
    var now = Date.now();
    var item = {
      id: 'list_' + now + '_' + Math.floor(Math.random() * 10000),
      name: cleanName,
      emoji: cleanEmoji,
      desc: cleanDesc,
      placeIds: [],
      createdAt: now,
      updatedAt: now
    };
    res.lists.unshift(item);
    res.map[acct] = res.lists;
    writeJson(LISTS_KEY, res.map);
    broadcastEngageSync('lists');
    if (window.HNRewards && typeof window.HNRewards.addPoints === 'function') {
      window.HNRewards.addPoints(10, 'Tạo danh sách "' + cleanName + '"', 'list');
    }
    return cloneSimple(item);
  }

  function deleteList(listId) {
    var targetId = String(listId || '');
    if (!targetId) return false;
    var acct = getAccountKey();
    var res = ensureAccountLists(acct);
    var next = [];
    var removed = false;
    for (var i = 0; i < res.lists.length; i++) {
      if (String(res.lists[i].id) === targetId) {
        removed = true;
      } else {
        next.push(res.lists[i]);
      }
    }
    if (!removed) return false;
    res.map[acct] = next;
    writeJson(LISTS_KEY, res.map);
    broadcastEngageSync('lists');
    return true;
  }

  function togglePlaceInList(listId, placeId) {
    var targetId = String(listId || '');
    var numPlace = Number(placeId);
    if (!targetId || isNaN(numPlace)) return null;
    var acct = getAccountKey();
    var res = ensureAccountLists(acct);
    var found = null;
    var added = false;
    for (var i = 0; i < res.lists.length; i++) {
      if (String(res.lists[i].id) === targetId) {
        found = res.lists[i];
        var ids = sanitizePlaceIds(found.placeIds);
        var idx = -1;
        for (var j = 0; j < ids.length; j++) {
          if (ids[j] === numPlace) {
            idx = j;
            break;
          }
        }
        if (idx !== -1) {
          ids.splice(idx, 1);
          added = false;
        } else {
          ids.push(numPlace);
          added = true;
        }
        found.placeIds = ids;
        found.updatedAt = Date.now();
        break;
      }
    }
    if (!found) return null;
    res.map[acct] = res.lists;
    writeJson(LISTS_KEY, res.map);
    broadcastEngageSync('lists');
    return { list: cloneSimple(found), added: added };
  }

  function getListsForPlace(placeId) {
    var numPlace = Number(placeId);
    if (isNaN(numPlace)) return [];
    var lists = getLists();
    var matched = [];
    for (var i = 0; i < lists.length; i++) {
      if (hasInArray(lists[i].placeIds || [], numPlace)) {
        matched.push(lists[i]);
      }
    }
    return matched;
  }

  function importSharedList(listObj) {
    if (!listObj || !trimStr(listObj.name)) return null;
    var acct = getAccountKey();
    var res = ensureAccountLists(acct);
    var now = Date.now();
    var item = {
      id: 'list_' + now + '_' + Math.floor(Math.random() * 10000),
      name: trimStr(listObj.name),
      emoji: trimStr(listObj.emoji) || '📂',
      desc: trimStr(listObj.desc),
      placeIds: sanitizePlaceIds(listObj.placeIds || []),
      createdAt: now,
      updatedAt: now
    };
    res.lists.unshift(item);
    res.map[acct] = res.lists;
    writeJson(LISTS_KEY, res.map);
    broadcastEngageSync('lists');
    return cloneSimple(item);
  }

  window.HNCustomLists = {
    getLists: getLists,
    createList: createList,
    deleteList: deleteList,
    togglePlaceInList: togglePlaceInList,
    getListsForPlace: getListsForPlace
  };

  /* ------------------------------------------------------------------
   * 2. LINK SHARING (window.HNShare)
   * ------------------------------------------------------------------ */

  function getBaseShareUrl() {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.href) {
        return window.location.href.split('?')[0].split('#')[0];
      }
    } catch (e) {}
    return './index.html';
  }

  function utf8ToBase64Url(str) {
    try {
      var encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      });
      return btoa(encoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
      return '';
    }
  }

  function base64UrlToUtf8(b64) {
    var s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) {
      s += '=';
    }
    var bin = atob(s);
    var pct = '';
    for (var i = 0; i < bin.length; i++) {
      var hex = bin.charCodeAt(i).toString(16).toUpperCase();
      pct += '%' + (hex.length < 2 ? '0' : '') + hex;
    }
    return decodeURIComponent(pct);
  }

  function encodeSharedPayload(obj) {
    try {
      return utf8ToBase64Url(JSON.stringify(obj));
    } catch (e) {
      return '';
    }
  }

  function decodeSharedPayload(paramVal) {
    if (!paramVal || typeof paramVal !== 'string') return null;
    try {
      var raw = trimStr(paramVal);
      if (!raw) return null;
      var jsonStr = base64UrlToUtf8(raw);
      var parsed = JSON.parse(jsonStr);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function buildPlaceShareUrl(placeId) {
    return getBaseShareUrl() + '?place=' + encodeURIComponent(String(placeId));
  }

  function buildListShareUrl(listObj) {
    if (!listObj) return getBaseShareUrl();
    var compact = {
      v: 1,
      id: listObj.id || ('list_' + Date.now()),
      name: trimStr(listObj.name) || 'Danh sách quán ngon',
      emoji: trimStr(listObj.emoji) || '📂',
      desc: trimStr(listObj.desc),
      placeIds: sanitizePlaceIds(listObj.placeIds || [])
    };
    return getBaseShareUrl() + '?list=' + encodeURIComponent(encodeSharedPayload(compact));
  }

  function buildPollShareUrl(pollObj) {
    if (!pollObj) return getBaseShareUrl();
    var compact = {
      v: 1,
      id: pollObj.id || ('poll_' + Date.now()),
      title: trimStr(pollObj.title) || 'Bình chọn quán ăn nhóm',
      creatorName: trimStr(pollObj.creatorName) || 'Thực khách',
      candidateIds: sanitizePlaceIds(pollObj.candidateIds || []),
      votes: pollObj.votes && typeof pollObj.votes === 'object' ? pollObj.votes : {},
      voterChoices: pollObj.voterChoices && typeof pollObj.voterChoices === 'object' ? pollObj.voterChoices : {},
      createdAt: pollObj.createdAt || Date.now()
    };
    return getBaseShareUrl() + '?poll=' + encodeURIComponent(encodeSharedPayload(compact));
  }

  function copyFallbackText(text) {
    try {
      if (typeof document === 'undefined' || !document.body) return false;
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function copyAndToast(url) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url).then(function () {
        showToastMsg(tr('🔗 Đã sao chép link chia sẻ!', '🔗 Share link copied!'));
      }, function () {
        if (copyFallbackText(url)) {
          showToastMsg(tr('🔗 Đã sao chép link chia sẻ!', '🔗 Share link copied!'));
        } else {
          showToastMsg(tr('Link chia sẻ: ', 'Share link: ') + url);
        }
      });
      return;
    }
    if (copyFallbackText(url)) {
      showToastMsg(tr('🔗 Đã sao chép link chia sẻ!', '🔗 Share link copied!'));
    } else {
      showToastMsg(tr('Link chia sẻ: ', 'Share link: ') + url);
    }
  }

  function shareUrl(title, text, url) {
    var shareTargetUrl = String(url || getBaseShareUrl());
    var shareTitle = String(title || 'Hà Nội Phố Vị');
    var shareText = String(text || '');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareTargetUrl
        }).then(function () {
          showToastMsg(tr('✅ Đã chia sẻ thành công!', '✅ Shared successfully!'));
        }, function (err) {
          if (err && err.name === 'AbortError') return;
          copyAndToast(shareTargetUrl);
        });
        return;
      } catch (e) {}
    }
    copyAndToast(shareTargetUrl);
  }

  function parseSearchQuery(searchStr) {
    var res = {};
    var q = String(searchStr || '');
    if (q.charAt(0) === '?') q = q.slice(1);
    if (!q) return res;
    var parts = q.split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (!kv[0]) continue;
      try {
        var k = decodeURIComponent(kv[0].replace(/\+/g, ' '));
        var v = kv.length > 1 ? decodeURIComponent(kv.slice(1).join('=').replace(/\+/g, ' ')) : '';
        res[k] = v;
      } catch (e) {}
    }
    return res;
  }

  function handleIncomingShareParams() {
    if (typeof window === 'undefined' || !window.location) return;
    var params = parseSearchQuery(window.location.search || '');
    if (params.place) {
      var pid = parseInt(params.place, 10);
      if (!isNaN(pid)) {
        var openFn = function () {
          if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
            window.HNAppBridge.openDetail(pid);
          } else if (typeof window.openRestaurantDetail === 'function') {
            window.openRestaurantDetail(pid);
          }
        };
        if (window.HNAppBridge) {
          setTimeout(openFn, 80);
        } else {
          setTimeout(openFn, 250);
        }
      }
      return;
    }
    if (params.list) {
      var decodedList = decodeSharedPayload(params.list);
      if (decodedList && trimStr(decodedList.name)) {
        pendingSharedList = {
          id: decodedList.id || ('shared_' + Date.now()),
          name: trimStr(decodedList.name),
          emoji: trimStr(decodedList.emoji) || '📂',
          desc: trimStr(decodedList.desc),
          placeIds: sanitizePlaceIds(decodedList.placeIds || [])
        };
        setTimeout(function () {
          openEngageHub('lists');
        }, 100);
      }
      return;
    }
    if (params.poll) {
      var decodedPoll = decodeSharedPayload(params.poll);
      if (decodedPoll && trimStr(decodedPoll.title) && isArray(decodedPoll.candidateIds) && decodedPoll.candidateIds.length >= 2) {
        var merged = upsertSharedPoll(decodedPoll);
        highlightedPollId = merged ? merged.id : null;
        setTimeout(function () {
          openEngageHub('polls');
        }, 100);
      }
    }
  }

  window.HNShare = {
    buildPlaceShareUrl: buildPlaceShareUrl,
    buildListShareUrl: buildListShareUrl,
    buildPollShareUrl: buildPollShareUrl,
    decodeSharedPayload: decodeSharedPayload,
    shareUrl: shareUrl
  };

  /* ------------------------------------------------------------------
   * 3. GROUP DINING POLL (window.HNGroupPoll)
   * ------------------------------------------------------------------ */

  function loadPollsRaw() {
    var list = readJson(POLLS_KEY, []);
    return isArray(list) ? list : [];
  }

  function savePollsRaw(polls) {
    writeJson(POLLS_KEY, polls);
    broadcastEngageSync('polls');
  }

  function normalizePoll(p) {
    var candidateIds = sanitizePlaceIds(p && p.candidateIds);
    var votes = {};
    for (var i = 0; i < candidateIds.length; i++) {
      var key = String(candidateIds[i]);
      var rawArr = (p.votes && isArray(p.votes[key])) ? p.votes[key] : [];
      votes[key] = rawArr.slice();
    }
    return {
      id: String((p && p.id) || ('poll_' + Date.now())),
      title: trimStr(p && p.title) || tr('Đi ăn ở đâu hôm nay?', 'Where should we eat?'),
      creatorName: trimStr(p && p.creatorName) || tr('Thực khách', 'Diner'),
      createdAt: (p && p.createdAt) || Date.now(),
      candidateIds: candidateIds,
      votes: votes,
      voterChoices: (p && p.voterChoices && typeof p.voterChoices === 'object') ? cloneSimple(p.voterChoices) : {}
    };
  }

  function getPolls() {
    var raw = loadPollsRaw();
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      if (raw[i] && isArray(raw[i].candidateIds) && raw[i].candidateIds.length > 0) {
        out.push(normalizePoll(raw[i]));
      }
    }
    return out;
  }

  function createPoll(title, candidateIds, creatorName) {
    var cleanTitle = trimStr(title);
    var cleanIds = sanitizePlaceIds(candidateIds);
    if (!cleanTitle || cleanIds.length < 2) return null;
    var creator = trimStr(creatorName) || getUserDisplayName();
    var votes = {};
    for (var i = 0; i < cleanIds.length; i++) {
      votes[String(cleanIds[i])] = [];
    }
    var poll = {
      id: 'poll_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      title: cleanTitle,
      creatorName: creator,
      createdAt: Date.now(),
      candidateIds: cleanIds,
      votes: votes,
      voterChoices: {}
    };
    var polls = getPolls();
    polls.unshift(poll);
    savePollsRaw(polls);
    if (window.HNRewards && typeof window.HNRewards.addPoints === 'function') {
      window.HNRewards.addPoints(15, 'Tạo bình chọn nhóm "' + cleanTitle + '"', 'poll');
    }
    return cloneSimple(poll);
  }

  function upsertSharedPoll(sharedObj) {
    var polls = getPolls();
    var sid = String(sharedObj.id || '');
    for (var i = 0; i < polls.length; i++) {
      if (polls[i].id === sid) {
        return polls[i];
      }
    }
    var normalized = normalizePoll(sharedObj);
    polls.unshift(normalized);
    savePollsRaw(polls);
    return normalized;
  }

  function vote(pollId, placeId, voterName) {
    var targetPollId = String(pollId || '');
    var numPlace = Number(placeId);
    if (!targetPollId || isNaN(numPlace)) return null;
    var voter = trimStr(voterName) || getUserDisplayName();
    var voterKey = normText(voter) || 'guest';
    var polls = getPolls();
    var updated = null;

    for (var i = 0; i < polls.length; i++) {
      var p = polls[i];
      if (p.id !== targetPollId) continue;
      if (!hasInArray(p.candidateIds, numPlace)) return null;

      var prevChoice = p.voterChoices[voterKey];
      var placeKey = String(numPlace);

      // Remove voter from all candidate vote arrays first to prevent duplicate votes
      for (var c = 0; c < p.candidateIds.length; c++) {
        var ck = String(p.candidateIds[c]);
        var arr = isArray(p.votes[ck]) ? p.votes[ck] : [];
        var filtered = [];
        for (var v = 0; v < arr.length; v++) {
          if (normText(arr[v]) !== voterKey) {
            filtered.push(arr[v]);
          }
        }
        p.votes[ck] = filtered;
      }

      if (Number(prevChoice) === numPlace) {
        // Toggle off if clicking the same choice again
        delete p.voterChoices[voterKey];
      } else {
        if (!isArray(p.votes[placeKey])) p.votes[placeKey] = [];
        p.votes[placeKey].push(voter);
        p.voterChoices[voterKey] = numPlace;
      }

      updated = p;
      break;
    }

    if (!updated) return null;
    savePollsRaw(polls);
    return cloneSimple(updated);
  }

  function deletePoll(pollId) {
    var targetPollId = String(pollId || '');
    if (!targetPollId) return false;
    var polls = getPolls();
    var next = [];
    var removed = false;
    for (var i = 0; i < polls.length; i++) {
      if (polls[i].id === targetPollId) {
        removed = true;
      } else {
        next.push(polls[i]);
      }
    }
    if (!removed) return false;
    savePollsRaw(next);
    return true;
  }

  window.HNGroupPoll = {
    getPolls: getPolls,
    createPoll: createPoll,
    vote: vote,
    deletePoll: deletePoll
  };

  /* ------------------------------------------------------------------
   * 4. REWARDS, BADGES & USER REVIEWS (window.HNRewards)
   * ------------------------------------------------------------------ */

  function createEmptyRewardProfile() {
    return {
      points: 0,
      reviewCount: 0,
      reportCount: 0,
      listCount: 0,
      pollCount: 0,
      history: []
    };
  }

  function loadAllRewardsMap() {
    var raw = readJson(REWARDS_KEY, {});
    if (!raw || typeof raw !== 'object' || isArray(raw)) {
      return {};
    }
    return raw;
  }

  function getBadges(profile) {
    var prof = profile || getProfile();
    var pts = Number(prof && prof.points) || 0;
    var out = [];
    for (var i = 0; i < BADGE_TIERS.length; i++) {
      var b = BADGE_TIERS[i];
      out.push({
        id: b.id,
        minPoints: b.minPoints,
        icon: b.icon,
        name: isEn() ? b.nameEn : b.nameVi,
        nameVi: b.nameVi,
        nameEn: b.nameEn,
        label: b.label,
        unlocked: pts >= b.minPoints
      });
    }
    return out;
  }

  function enrichProfile(rawProf) {
    var base = createEmptyRewardProfile();
    if (rawProf && typeof rawProf === 'object') {
      base.points = Math.max(0, Number(rawProf.points) || 0);
      base.reviewCount = Math.max(0, Number(rawProf.reviewCount) || 0);
      base.reportCount = Math.max(0, Number(rawProf.reportCount) || 0);
      base.listCount = Math.max(0, Number(rawProf.listCount) || 0);
      base.pollCount = Math.max(0, Number(rawProf.pollCount) || 0);
      base.history = isArray(rawProf.history) ? rawProf.history.slice(0, 50) : [];
    }
    var badges = getBadges(base);
    var currentBadge = badges[0];
    var nextBadge = null;
    for (var i = 0; i < badges.length; i++) {
      if (badges[i].unlocked) {
        currentBadge = badges[i];
      } else if (!nextBadge) {
        nextBadge = badges[i];
      }
    }
    base.currentBadge = currentBadge;
    base.nextBadge = nextBadge;
    return base;
  }

  function getProfile() {
    var acct = getAccountKey();
    var map = loadAllRewardsMap();
    return enrichProfile(map[acct]);
  }

  function addPoints(points, reason, type) {
    var delta = Number(points) || 0;
    var acct = getAccountKey();
    var map = loadAllRewardsMap();
    var prof = enrichProfile(map[acct]);
    prof.points = Math.max(0, prof.points + delta);
    if (type === 'review') prof.reviewCount += 1;
    else if (type === 'report') prof.reportCount += 1;
    else if (type === 'list') prof.listCount += 1;
    else if (type === 'poll') prof.pollCount += 1;

    var entry = {
      id: 'pt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      points: delta,
      reason: trimStr(reason) || tr('Hoạt động cộng đồng', 'Community activity'),
      type: type || 'other',
      createdAt: Date.now()
    };
    prof.history.unshift(entry);
    if (prof.history.length > 50) {
      prof.history = prof.history.slice(0, 50);
    }

    map[acct] = {
      points: prof.points,
      reviewCount: prof.reviewCount,
      reportCount: prof.reportCount,
      listCount: prof.listCount,
      pollCount: prof.pollCount,
      history: prof.history
    };
    writeJson(REWARDS_KEY, map);
    broadcastEngageSync('rewards');
    return enrichProfile(map[acct]);
  }

  function loadAllReviewsMap() {
    var raw = readJson(REVIEWS_KEY, {});
    if (!raw || typeof raw !== 'object' || isArray(raw)) {
      return {};
    }
    return raw;
  }

  function getReviews(placeId) {
    var key = String(placeId || '');
    if (!key) return [];
    var map = loadAllReviewsMap();
    var arr = map[key];
    return isArray(arr) ? cloneSimple(arr) : [];
  }

  function addReview(placeId, rating, text, tags) {
    var numPlace = Number(placeId);
    var cleanText = trimStr(text);
    if (isNaN(numPlace) || numPlace <= 0 || !cleanText) return null;
    var numRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    var cleanTags = [];
    if (isArray(tags)) {
      for (var i = 0; i < tags.length; i++) {
        var t = trimStr(tags[i]);
        if (t && !hasInArray(cleanTags, t)) cleanTags.push(t);
      }
    }
    var review = {
      id: 'rev_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      placeId: numPlace,
      author: getUserDisplayName(),
      authorKey: getAccountKey(),
      rating: numRating,
      text: cleanText,
      tags: cleanTags,
      createdAt: Date.now()
    };
    var map = loadAllReviewsMap();
    var key = String(numPlace);
    if (!isArray(map[key])) map[key] = [];
    map[key].unshift(review);
    writeJson(REVIEWS_KEY, map);

    var rObj = findRestaurantById(numPlace);
    var placeName = rObj ? rObj.name : ('Quán #' + numPlace);
    var updatedProfile = addPoints(25, tr('Đánh giá ', 'Reviewed ') + placeName, 'review');
    broadcastEngageSync('reviews');
    return {
      review: cloneSimple(review),
      profile: updatedProfile
    };
  }

  window.HNRewards = {
    getProfile: getProfile,
    addPoints: addPoints,
    getBadges: getBadges,
    addReview: addReview,
    getReviews: getReviews
  };

  /* ------------------------------------------------------------------
   * 5. ENGAGE HUB MODAL RENDERING (LISTS / POLLS / REWARDS)
   * ------------------------------------------------------------------ */

  function getEngageModalEl() {
    return typeof document !== 'undefined' ? document.getElementById('engageHubModal') : null;
  }

  function openEngageHub(tabName) {
    var modal = getEngageModalEl();
    if (!modal) return;
    if (tabName === 'lists' || tabName === 'polls' || tabName === 'rewards') {
      activeEngageTab = tabName;
    }
    syncEngageTabButtons();
    modal.classList.add('open');
    renderEngageHubContent();
  }

  function closeEngageHub() {
    var modal = getEngageModalEl();
    if (modal) modal.classList.remove('open');
  }

  function syncEngageTabButtons() {
    if (typeof document === 'undefined') return;
    var tabs = document.querySelectorAll('#engageHubTabs .engage-tab');
    for (var i = 0; i < tabs.length; i++) {
      var btn = tabs[i];
      var tab = btn.getAttribute('data-engage-tab');
      var isActive = tab === activeEngageTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (tab === 'lists') {
        btn.innerHTML = '📂 ' + tr('Danh sách riêng', 'Custom Lists');
      } else if (tab === 'polls') {
        btn.innerHTML = '🗳️ ' + tr('Bình chọn nhóm', 'Group Polls');
      } else if (tab === 'rewards') {
        btn.innerHTML = '🏆 ' + tr('Điểm & Huy hiệu', 'Points & Badges');
      }
    }
  }

  function renderEngageHubContent() {
    if (typeof document === 'undefined') return;
    var container = document.getElementById('engageHubContent');
    if (!container) return;
    syncEngageTabButtons();
    if (activeEngageTab === 'lists') {
      renderListsTab(container);
    } else if (activeEngageTab === 'polls') {
      renderPollsTab(container);
    } else {
      renderRewardsTab(container);
    }
  }

  /* ---- LISTS TAB ---- */

  function renderListsTab(container) {
    var lists = getLists();
    var html = '';

    if (pendingSharedList) {
      html += '<div class="custom-list-card" style="border:2px solid var(--color-gold);">';
      html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">';
      html += '<div>';
      html += '<div style="font-size:0.76rem; font-weight:800; color:var(--color-gold); margin-bottom:3px;">✨ ' + tr('DANH SÁCH ĐƯỢC CHIA SẺ', 'SHARED LIST') + '</div>';
      html += '<h3 style="margin:0; font-size:1.08rem;">' + escapeHtml(pendingSharedList.emoji) + ' ' + escapeHtml(pendingSharedList.name) + '</h3>';
      if (pendingSharedList.desc) {
        html += '<p style="margin:4px 0 0; font-size:0.84rem; color:var(--text-muted);">' + escapeHtml(pendingSharedList.desc) + '</p>';
      }
      html += '</div>';
      html += '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
      html += '<button type="button" class="btn-engage-mini" id="ceImportSharedListBtn">💾 ' + tr('Lưu danh sách này', 'Import List') + '</button>';
      html += '<button type="button" class="btn-engage-mini" id="ceDismissSharedListBtn">✕</button>';
      html += '</div></div>';
      html += renderListPlaceItemsHtml(pendingSharedList.placeIds, null);
      html += '</div>';
    }

    html += '<div class="custom-list-card">';
    html += '<h3 style="margin:0 0 10px; font-size:1rem;">➕ ' + tr('Tạo danh sách quán mới (+10 điểm)', 'Create New List (+10 pts)') + '</h3>';
    html += '<form id="ceCreateListForm" class="owner-form" style="gap:8px;">';
    html += '<div style="display:flex; gap:8px; flex-wrap:wrap;">';
    html += '<input type="text" id="ceNewListEmoji" value="🍜" maxlength="4" style="width:56px; text-align:center; padding:8px; border-radius:8px; border:1px solid var(--border-ornate);" aria-label="Emoji" />';
    html += '<input type="text" id="ceNewListName" placeholder="' + escapeHtml(tr('Tên danh sách (VD: Quán ăn khuya Cầu Giấy)', 'List name (e.g. Late Night Spots)')) + '" style="flex:1; min-width:180px; padding:8px 10px; border-radius:8px; border:1px solid var(--border-ornate);" required />';
    html += '</div>';
    html += '<div style="display:flex; gap:8px; flex-wrap:wrap;">';
    html += '<input type="text" id="ceNewListDesc" placeholder="' + escapeHtml(tr('Mô tả ngắn (tùy chọn)...', 'Short description (optional)...')) + '" style="flex:1; min-width:180px; padding:8px 10px; border-radius:8px; border:1px solid var(--border-ornate);" />';
    html += '<button type="submit" class="btn-nlp-search">✨ ' + tr('Tạo danh sách', 'Create List') + '</button>';
    html += '</div></form></div>';

    if (!lists.length) {
      html += '<p style="text-align:center; color:var(--text-muted); padding:16px;">' + tr('Chưa có danh sách nào.', 'No lists yet.') + '</p>';
    } else {
      for (var i = 0; i < lists.length; i++) {
        var lst = lists[i];
        var placeIds = sanitizePlaceIds(lst.placeIds || []);
        html += '<div class="custom-list-card" data-list-id="' + escapeHtml(lst.id) + '">';
        html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">';
        html += '<div>';
        html += '<h3 style="margin:0; font-size:1.05rem;">' + escapeHtml(lst.emoji || '📂') + ' ' + escapeHtml(lst.name) + ' <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">(' + placeIds.length + ' ' + tr('quán', 'places') + ')</span></h3>';
        if (lst.desc) {
          html += '<p style="margin:3px 0 0; font-size:0.83rem; color:var(--text-muted);">' + escapeHtml(lst.desc) + '</p>';
        }
        html += '</div>';
        html += '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
        html += '<button type="button" class="btn-engage-mini" data-ce-share-list="' + escapeHtml(lst.id) + '">🔗 ' + tr('Chia sẻ link', 'Share Link') + '</button>';
        if (placeIds.length >= 2) {
          html += '<button type="button" class="btn-engage-mini" data-ce-poll-from-list="' + escapeHtml(lst.id) + '">🗳️ ' + tr('Tạo poll từ danh sách', 'Poll from List') + '</button>';
        }
        html += '<button type="button" class="btn-engage-mini" data-ce-delete-list="' + escapeHtml(lst.id) + '" style="color:#b91c1c;">🗑 ' + tr('Xóa', 'Delete') + '</button>';
        html += '</div></div>';
        html += renderListPlaceItemsHtml(placeIds, lst.id);
        html += '</div>';
      }
    }

    container.innerHTML = html;
    bindListsTabEvents(container);
  }

  function renderListPlaceItemsHtml(placeIds, removableListId) {
    if (!placeIds || !placeIds.length) {
      return '<div style="margin-top:8px; font-size:0.82rem; color:var(--text-muted);">' +
        tr('Chưa có quán nào trong danh sách. Hãy mở chi tiết quán và bấm "📂 Lưu danh sách" để thêm.', 'No places yet. Open any restaurant detail and click "📂 Save to List".') +
        '</div>';
    }
    var html = '<div class="custom-list-items">';
    for (var i = 0; i < placeIds.length; i++) {
      var r = findRestaurantById(placeIds[i]);
      if (!r) continue;
      html += '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; background:var(--bg-parchment); border:1px solid var(--border-vintage); flex-wrap:wrap;">';
      html += '<div style="min-width:160px; flex:1;">';
      html += '<strong style="font-size:0.88rem;">' + escapeHtml(r.name) + '</strong>';
      html += '<div style="font-size:0.76rem; color:var(--text-muted);">★ ' + escapeHtml(r.rating) + ' • ' + escapeHtml(r.district) + ' • ' + escapeHtml(r.priceRange) + '</div>';
      html += '</div>';
      html += '<div style="display:flex; gap:6px;">';
      html += '<button type="button" class="btn-engage-mini" data-ce-open-place="' + r.id + '">👁️ ' + tr('Xem quán', 'View') + '</button>';
      if (removableListId) {
        html += '<button type="button" class="btn-engage-mini" data-ce-remove-place="' + r.id + '" data-ce-from-list="' + escapeHtml(removableListId) + '" title="' + escapeHtml(tr('Bỏ khỏi danh sách', 'Remove')) + '">✕</button>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function bindListsTabEvents(container) {
    var importBtn = document.getElementById('ceImportSharedListBtn');
    if (importBtn && pendingSharedList) {
      importBtn.addEventListener('click', function () {
        var imported = importSharedList(pendingSharedList);
        pendingSharedList = null;
        if (imported) {
          showToastMsg(tr('💾 Đã lưu danh sách "', '💾 Saved list "') + imported.name + '"!');
        }
        renderEngageHubContent();
      });
    }
    var dismissBtn = document.getElementById('ceDismissSharedListBtn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        pendingSharedList = null;
        renderEngageHubContent();
      });
    }

    var form = document.getElementById('ceCreateListForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var emojiEl = document.getElementById('ceNewListEmoji');
        var nameEl = document.getElementById('ceNewListName');
        var descEl = document.getElementById('ceNewListDesc');
        var created = createList(nameEl ? nameEl.value : '', emojiEl ? emojiEl.value : '📂', descEl ? descEl.value : '');
        if (!created) {
          showToastMsg(tr('Vui lòng nhập tên danh sách!', 'Please enter a list name!'));
          return;
        }
        showToastMsg(tr('✨ Đã tạo danh sách mới (+10 điểm thưởng)!', '✨ Created new list (+10 pts)!'));
        renderEngageHubContent();
      });
    }

    var shareBtns = container.querySelectorAll('[data-ce-share-list]');
    for (var i = 0; i < shareBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var lid = btn.getAttribute('data-ce-share-list');
          var lists = getLists();
          for (var k = 0; k < lists.length; k++) {
            if (String(lists[k].id) === String(lid)) {
              var url = buildListShareUrl(lists[k]);
              shareUrl(lists[k].emoji + ' ' + lists[k].name, lists[k].desc || lists[k].name, url);
              break;
            }
          }
        });
      })(shareBtns[i]);
    }

    var pollFromListBtns = container.querySelectorAll('[data-ce-poll-from-list]');
    for (var p = 0; p < pollFromListBtns.length; p++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var lid = btn.getAttribute('data-ce-poll-from-list');
          var lists = getLists();
          for (var k = 0; k < lists.length; k++) {
            if (String(lists[k].id) === String(lid)) {
              pollDraftTitle = tr('Đi quán nào trong "', 'Which spot from "') + lists[k].name + '"?';
              pollDraftSelectedIds = sanitizePlaceIds(lists[k].placeIds).slice(0, 8);
              activeEngageTab = 'polls';
              renderEngageHubContent();
              break;
            }
          }
        });
      })(pollFromListBtns[p]);
    }

    var delBtns = container.querySelectorAll('[data-ce-delete-list]');
    for (var j = 0; j < delBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var lid = btn.getAttribute('data-ce-delete-list');
          if (deleteList(lid)) {
            showToastMsg(tr('🗑 Đã xóa danh sách.', '🗑 List deleted.'));
            renderEngageHubContent();
          }
        });
      })(delBtns[j]);
    }

    var remBtns = container.querySelectorAll('[data-ce-remove-place]');
    for (var r = 0; r < remBtns.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var pid = parseInt(btn.getAttribute('data-ce-remove-place'), 10);
          var lid = btn.getAttribute('data-ce-from-list');
          if (!isNaN(pid) && lid) {
            togglePlaceInList(lid, pid);
            renderEngageHubContent();
          }
        });
      })(remBtns[r]);
    }

    var openBtns = container.querySelectorAll('[data-ce-open-place]');
    for (var o = 0; o < openBtns.length; o++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var pid = parseInt(btn.getAttribute('data-ce-open-place'), 10);
          if (!isNaN(pid)) {
            closeEngageHub();
            if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
              window.HNAppBridge.openDetail(pid);
            }
          }
        });
      })(openBtns[o]);
    }
  }

  /* ---- POLLS TAB ---- */

  function getPollCandidatePool() {
    var pool = [];
    if (pollDraftSource === 'favorites') {
      var favIds = (window.HNAppBridge && typeof window.HNAppBridge.getFavorites === 'function')
        ? window.HNAppBridge.getFavorites() : [];
      for (var i = 0; i < favIds.length; i++) {
        var rFav = findRestaurantById(favIds[i]);
        if (rFav) pool.push(rFav);
      }
    } else if (pollDraftSource === 'filtered') {
      var filtered = (window.HNAppBridge && typeof window.HNAppBridge.getFilteredRestaurants === 'function')
        ? window.HNAppBridge.getFilteredRestaurants() : getRestaurants();
      pool = isArray(filtered) ? filtered.slice(0, 40) : [];
    } else {
      pool = getRestaurants();
    }

    var q = normText(trimStr(pollDraftSearch));
    if (q) {
      var matched = [];
      var searchSource = pollDraftSource === 'all' || pollDraftSearch ? getRestaurants() : pool;
      for (var j = 0; j < searchSource.length; j++) {
        var item = searchSource[j];
        var hay = normText((item.name || '') + ' ' + (item.category || '') + ' ' + (item.district || '') + ' ' + ((item.signatureDishes || []).join(' ')));
        if (hay.indexOf(q) !== -1) {
          matched.push(item);
          if (matched.length >= 24) break;
        }
      }
      return matched;
    }
    return pool.slice(0, 18);
  }

  function renderPollsTab(container) {
    var polls = getPolls();
    var candidatePool = getPollCandidatePool();
    var html = '';

    // Poll creator card
    html += '<div class="poll-card">';
    html += '<h3 style="margin:0 0 10px; font-size:1rem;">🗳️ ' + tr('Tạo bình chọn đi ăn nhóm (+15 điểm)', 'Create Group Dining Poll (+15 pts)') + '</h3>';
    html += '<div class="owner-form" style="gap:9px;">';
    html += '<input type="text" id="cePollTitleInput" value="' + escapeHtml(pollDraftTitle) + '" placeholder="' + escapeHtml(tr('Tiêu đề (VD: Trưa nay team ăn gì?)', 'Poll title (e.g. Where to eat lunch?)')) + '" style="padding:8px 10px; border-radius:8px; border:1px solid var(--border-ornate);" />';

    html += '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">';
    html += '<span style="font-size:0.8rem; font-weight:700;">' + tr('Chọn từ:', 'Pick from:') + '</span>';
    html += '<button type="button" class="btn-engage-mini' + (pollDraftSource === 'filtered' ? ' active' : '') + '" data-ce-poll-src="filtered" style="' + (pollDraftSource === 'filtered' ? 'border-color:var(--color-lacquer); background:var(--color-gold-light);' : '') + '">🎯 ' + tr('Đang lọc', 'Filtered') + '</button>';
    html += '<button type="button" class="btn-engage-mini' + (pollDraftSource === 'favorites' ? ' active' : '') + '" data-ce-poll-src="favorites" style="' + (pollDraftSource === 'favorites' ? 'border-color:var(--color-lacquer); background:var(--color-gold-light);' : '') + '">❤️ ' + tr('Quán quen', 'Favorites') + '</button>';
    html += '<input type="text" id="cePollSearchInput" value="' + escapeHtml(pollDraftSearch) + '" placeholder="' + escapeHtml(tr('🔍 Tìm thêm quán để đưa vào poll...', '🔍 Search restaurants to add...')) + '" style="flex:1; min-width:170px; padding:6px 10px; border-radius:999px; border:1px solid var(--border-ornate); font-size:0.82rem;" />';
    html += '</div>';

    // Selected candidates summary
    html += '<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">';
    html += '<strong style="font-size:0.8rem;">' + tr('Đã chọn', 'Selected') + ' (' + pollDraftSelectedIds.length + '/8):</strong>';
    if (!pollDraftSelectedIds.length) {
      html += '<span style="font-size:0.78rem; color:var(--text-muted);">' + tr('Chọn ít nhất 2 quán bên dưới', 'Pick at least 2 restaurants below') + '</span>';
    } else {
      for (var s = 0; s < pollDraftSelectedIds.length; s++) {
        var sr = findRestaurantById(pollDraftSelectedIds[s]);
        if (!sr) continue;
        html += '<button type="button" class="nlp-chip" data-ce-toggle-cand="' + sr.id + '" style="cursor:pointer;">' + escapeHtml(sr.name) + ' ✕</button>';
      }
    }
    html += '</div>';

    // Candidate picker chips
    html += '<div style="display:flex; flex-wrap:wrap; gap:6px; max-height:140px; overflow-y:auto; padding:6px; border-radius:8px; background:var(--bg-parchment); border:1px solid var(--border-vintage);">';
    if (!candidatePool.length) {
      html += '<span style="font-size:0.8rem; color:var(--text-muted); padding:4px;">' + tr('Không có quán phù hợp.', 'No matching restaurants.') + '</span>';
    } else {
      for (var c = 0; c < candidatePool.length; c++) {
        var cr = candidatePool[c];
        var isPicked = hasInArray(pollDraftSelectedIds, Number(cr.id));
        html += '<button type="button" class="btn-engage-mini" data-ce-toggle-cand="' + cr.id + '" style="' +
          (isPicked ? 'background:var(--color-lacquer); color:#fff; border-color:var(--color-lacquer);' : '') + '">' +
          (isPicked ? '✓ ' : '+ ') + escapeHtml(cr.name) + ' (' + escapeHtml(cr.district) + ')</button>';
      }
    }
    html += '</div>';

    html += '<div style="display:flex; justify-content:flex-end;">';
    html += '<button type="button" id="ceCreatePollBtn" class="btn-nlp-search">🗳️ ' + tr('Tạo bình chọn ngay (+15đ)', 'Create Poll (+15 pts)') + '</button>';
    html += '</div></div></div>';

    // Existing polls
    if (!polls.length) {
      html += '<div class="poll-card" style="text-align:center; color:var(--text-muted);">' +
        tr('Chưa có cuộc bình chọn nào. Hãy chọn từ 2 quán trở lên để rủ bạn bè cùng vote!', 'No polls yet. Pick 2+ restaurants above to start a group poll!') +
        '</div>';
    } else {
      for (var i = 0; i < polls.length; i++) {
        html += renderSinglePollCardHtml(polls[i]);
      }
    }

    container.innerHTML = html;
    bindPollsTabEvents(container);
  }

  function renderSinglePollCardHtml(poll) {
    var totalVotes = 0;
    var maxVotes = 0;
    for (var i = 0; i < poll.candidateIds.length; i++) {
      var ck = String(poll.candidateIds[i]);
      var cnt = (poll.votes && isArray(poll.votes[ck])) ? poll.votes[ck].length : 0;
      totalVotes += cnt;
      if (cnt > maxVotes) maxVotes = cnt;
    }

    var curVoter = getUserDisplayName();
    var isHi = highlightedPollId && highlightedPollId === poll.id;
    var html = '<div class="poll-card" data-poll-id="' + escapeHtml(poll.id) + '" style="' + (isHi ? 'border:2px solid var(--color-gold);' : '') + '">';
    html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">';
    html += '<div>';
    if (isHi) {
      html += '<div style="font-size:0.74rem; font-weight:800; color:var(--color-gold);">🔗 ' + tr('BÌNH CHỌN ĐƯỢC CHIA SẺ', 'SHARED GROUP POLL') + '</div>';
    }
    html += '<h3 style="margin:0; font-size:1.05rem;">🗳️ ' + escapeHtml(poll.title) + '</h3>';
    html += '<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">' +
      tr('Tạo bởi', 'By') + ' <strong>' + escapeHtml(poll.creatorName) + '</strong> • ' +
      totalVotes + ' ' + tr('phiếu bầu', 'votes') + ' • ' + escapeHtml(formatDateTime(poll.createdAt)) +
      '</div>';
    html += '</div>';
    html += '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
    html += '<button type="button" class="btn-engage-mini" data-ce-share-poll="' + escapeHtml(poll.id) + '">🔗 ' + tr('Chia sẻ link bình chọn', 'Share Poll Link') + '</button>';
    html += '<button type="button" class="btn-engage-mini" data-ce-delete-poll="' + escapeHtml(poll.id) + '" style="color:#b91c1c;">🗑</button>';
    html += '</div></div>';

    html += '<div style="margin:9px 0 4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">';
    html += '<label style="font-size:0.78rem; font-weight:700;">' + tr('Tên người bầu:', 'Voter name:') + '</label>';
    html += '<input type="text" class="ce-poll-voter-input" data-ce-voter-for="' + escapeHtml(poll.id) + '" value="' + escapeHtml(curVoter) + '" style="padding:4px 9px; border-radius:999px; border:1px solid var(--border-ornate); font-size:0.8rem; max-width:200px;" />';
    html += '</div>';

    for (var j = 0; j < poll.candidateIds.length; j++) {
      var pid = poll.candidateIds[j];
      var r = findRestaurantById(pid);
      var key = String(pid);
      var voters = (poll.votes && isArray(poll.votes[key])) ? poll.votes[key] : [];
      var count = voters.length;
      var pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      var isWinner = maxVotes > 0 && count === maxVotes;
      var canRes = (r && window.HNOrderBooking && typeof window.HNOrderBooking.canReserve === 'function')
        ? window.HNOrderBooking.canReserve(r) : false;

      html += '<div class="poll-option-row">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">';
      html += '<div>';
      html += '<strong>' + escapeHtml(r ? r.name : ('Quán #' + pid)) + '</strong>';
      if (isWinner) {
        html += ' <span class="poll-winner-badge">🏆 ' + tr('Dẫn đầu', 'Leading') + '</span>';
      }
      if (r) {
        html += '<div style="font-size:0.76rem; color:var(--text-muted);">★ ' + escapeHtml(r.rating) + ' • ' + escapeHtml(r.district) + ' • ' + escapeHtml(r.priceRange) + '</div>';
      }
      html += '</div>';
      html += '<div style="font-size:0.82rem; font-weight:700;">' + count + ' ' + tr('phiếu', 'votes') + ' (' + pct + '%)</div>';
      html += '</div>';

      html += '<div class="poll-bar-track"><div class="poll-bar-fill" style="width:' + pct + '%;"></div></div>';

      if (voters.length > 0) {
        html += '<div style="font-size:0.74rem; color:var(--text-muted);">👥 ' + escapeHtml(voters.join(', ')) + '</div>';
      }

      html += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">';
      html += '<button type="button" class="btn-engage-mini" data-ce-vote-poll="' + escapeHtml(poll.id) + '" data-ce-vote-place="' + pid + '">👍 ' + tr('Bình chọn', 'Vote') + '</button>';
      html += '<button type="button" class="btn-engage-mini" data-ce-open-place="' + pid + '">👁️ ' + tr('Xem quán', 'View') + '</button>';
      if (canRes) {
        html += '<button type="button" class="btn-engage-mini" data-ce-reserve-place="' + pid + '">🪑 ' + tr('Đặt bàn', 'Reserve') + '</button>';
      } else {
        html += '<button type="button" class="btn-engage-mini" data-ce-delivery-place="' + pid + '">🛵 ' + tr('Đặt món', 'Order') + '</button>';
      }
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function bindPollsTabEvents(container) {
    var titleInput = document.getElementById('cePollTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', function () {
        pollDraftTitle = titleInput.value;
      });
    }
    var searchInput = document.getElementById('cePollSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        pollDraftSearch = searchInput.value;
        var pos = searchInput.selectionStart || pollDraftSearch.length;
        renderPollsTab(container);
        var nextInput = document.getElementById('cePollSearchInput');
        if (nextInput) {
          nextInput.focus();
          try { nextInput.setSelectionRange(pos, pos); } catch (e) {}
        }
      });
    }

    var srcBtns = container.querySelectorAll('[data-ce-poll-src]');
    for (var s = 0; s < srcBtns.length; s++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          pollDraftSource = btn.getAttribute('data-ce-poll-src') || 'filtered';
          renderPollsTab(container);
        });
      })(srcBtns[s]);
    }

    var candBtns = container.querySelectorAll('[data-ce-toggle-cand]');
    for (var c = 0; c < candBtns.length; c++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var cid = parseInt(btn.getAttribute('data-ce-toggle-cand'), 10);
          if (isNaN(cid)) return;
          var idx = -1;
          for (var k = 0; k < pollDraftSelectedIds.length; k++) {
            if (pollDraftSelectedIds[k] === cid) {
              idx = k;
              break;
            }
          }
          if (idx !== -1) {
            pollDraftSelectedIds.splice(idx, 1);
          } else {
            if (pollDraftSelectedIds.length >= 8) {
              showToastMsg(tr('Tối đa 8 quán trong một bình chọn!', 'Maximum 8 restaurants per poll!'));
              return;
            }
            pollDraftSelectedIds.push(cid);
          }
          renderPollsTab(container);
        });
      })(candBtns[c]);
    }

    var createBtn = document.getElementById('ceCreatePollBtn');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var titleVal = titleInput ? trimStr(titleInput.value) : trimStr(pollDraftTitle);
        if (!titleVal) {
          titleVal = tr('Hôm nay nhóm mình đi ăn ở đâu?', 'Where should our group eat?');
        }
        if (pollDraftSelectedIds.length < 2) {
          showToastMsg(tr('Hãy chọn ít nhất 2 quán để tạo bình chọn!', 'Please select at least 2 restaurants!'));
          return;
        }
        var created = createPoll(titleVal, pollDraftSelectedIds, getUserDisplayName());
        if (created) {
          pollDraftTitle = '';
          pollDraftSelectedIds = [];
          pollDraftSearch = '';
          highlightedPollId = created.id;
          showToastMsg(tr('🗳️ Đã tạo bình chọn nhóm (+15 điểm thưởng)!', '🗳️ Group poll created (+15 pts)!'));
          renderPollsTab(container);
        }
      });
    }

    var voteBtns = container.querySelectorAll('[data-ce-vote-poll]');
    for (var v = 0; v < voteBtns.length; v++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var pid = btn.getAttribute('data-ce-vote-poll');
          var placeId = parseInt(btn.getAttribute('data-ce-vote-place'), 10);
          var voterInput = container.querySelector('[data-ce-voter-for="' + pid + '"]');
          var voterName = voterInput ? trimStr(voterInput.value) : getUserDisplayName();
          if (vote(pid, placeId, voterName)) {
            showToastMsg(tr('👍 Đã ghi nhận phiếu bầu của ', '👍 Vote recorded for ') + (voterName || getUserDisplayName()) + '!');
            renderPollsTab(container);
          }
        });
      })(voteBtns[v]);
    }

    var shareBtns = container.querySelectorAll('[data-ce-share-poll]');
    for (var sh = 0; sh < shareBtns.length; sh++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var pid = btn.getAttribute('data-ce-share-poll');
          var polls = getPolls();
          for (var k = 0; k < polls.length; k++) {
            if (polls[k].id === pid) {
              var url = buildPollShareUrl(polls[k]);
              shareUrl('🗳️ ' + polls[k].title, tr('Mời bạn bình chọn quán ăn cùng nhóm!', 'Vote on where we should eat!'), url);
              break;
            }
          }
        });
      })(shareBtns[sh]);
    }

    var delBtns = container.querySelectorAll('[data-ce-delete-poll]');
    for (var d = 0; d < delBtns.length; d++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var pid = btn.getAttribute('data-ce-delete-poll');
          if (deletePoll(pid)) {
            showToastMsg(tr('🗑 Đã xóa bình chọn.', '🗑 Poll deleted.'));
            renderPollsTab(container);
          }
        });
      })(delBtns[d]);
    }

    var openBtns = container.querySelectorAll('[data-ce-open-place]');
    for (var o = 0; o < openBtns.length; o++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var placeId = parseInt(btn.getAttribute('data-ce-open-place'), 10);
          if (!isNaN(placeId)) {
            closeEngageHub();
            if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
              window.HNAppBridge.openDetail(placeId);
            }
          }
        });
      })(openBtns[o]);
    }

    var resBtns = container.querySelectorAll('[data-ce-reserve-place]');
    for (var rb = 0; rb < resBtns.length; rb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var placeId = parseInt(btn.getAttribute('data-ce-reserve-place'), 10);
          if (!isNaN(placeId)) {
            closeEngageHub();
            if (window.HNOrderBooking && typeof window.HNOrderBooking.openReservation === 'function') {
              window.HNOrderBooking.openReservation(placeId);
            }
          }
        });
      })(resBtns[rb]);
    }

    var delivBtns = container.querySelectorAll('[data-ce-delivery-place]');
    for (var db = 0; db < delivBtns.length; db++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var placeId = parseInt(btn.getAttribute('data-ce-delivery-place'), 10);
          if (!isNaN(placeId)) {
            closeEngageHub();
            if (window.HNOrderBooking && typeof window.HNOrderBooking.openDelivery === 'function') {
              window.HNOrderBooking.openDelivery(placeId);
            }
          }
        });
      })(delivBtns[db]);
    }
  }

  /* ---- REWARDS TAB ---- */

  function renderRewardsTab(container) {
    var prof = getProfile();
    var badges = getBadges(prof);
    var nextMin = prof.nextBadge ? prof.nextBadge.minPoints : prof.currentBadge.minPoints;
    var prevMin = prof.currentBadge ? prof.currentBadge.minPoints : 0;
    var progressPct = prof.nextBadge
      ? Math.min(100, Math.max(0, Math.round(((prof.points - prevMin) / Math.max(1, nextMin - prevMin)) * 100)))
      : 100;

    var html = '';
    html += '<div class="rewards-summary-card">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">';
    html += '<div>';
    html += '<div style="font-size:0.8rem; font-weight:700;">' + tr('Tài khoản:', 'Account:') + ' ' + escapeHtml(getUserDisplayName()) + '</div>';
    html += '<div style="font-size:1.35rem; font-weight:800; margin-top:2px;">' + escapeHtml(prof.currentBadge.icon + ' ' + prof.currentBadge.name) + '</div>';
    html += '</div>';
    html += '<div style="text-align:right;">';
    html += '<div style="font-size:1.6rem; font-weight:900;">' + prof.points + ' <span style="font-size:0.85rem;">' + tr('điểm', 'pts') + '</span></div>';
    html += '<div style="font-size:0.76rem;">' + (prof.nextBadge
      ? (tr('Còn ', 'Need ') + (prof.nextBadge.minPoints - prof.points) + tr(' điểm lên ', ' pts for ') + escapeHtml(prof.nextBadge.name))
      : tr('Đã đạt cấp tối đa!', 'Max tier unlocked!')) + '</div>';
    html += '</div></div>';

    html += '<div class="poll-bar-track" style="margin-top:10px;"><div class="poll-bar-fill" style="width:' + progressPct + '%;"></div></div>';
    html += '<div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px; font-size:0.8rem; font-weight:700;">';
    html += '<span>⭐ ' + tr('Đánh giá:', 'Reviews:') + ' ' + prof.reviewCount + ' (+25đ)</span>';
    html += '<span>📂 ' + tr('Danh sách:', 'Lists:') + ' ' + prof.listCount + ' (+10đ)</span>';
    html += '<span>🗳️ ' + tr('Bình chọn:', 'Polls:') + ' ' + prof.pollCount + ' (+15đ)</span>';
    html += '<span>🚩 ' + tr('Báo lỗi:', 'Reports:') + ' ' + prof.reportCount + ' (+15đ)</span>';
    html += '</div></div>';

    html += '<h3 style="margin:0 0 10px; font-size:1rem;">🏅 ' + tr('Hệ thống 5 huy hiệu Phố Vị', '5 Pho Vi Tiered Badges') + '</h3>';
    html += '<div class="badge-grid">';
    for (var i = 0; i < badges.length; i++) {
      var b = badges[i];
      html += '<div class="badge-card' + (b.unlocked ? '' : ' locked') + '">';
      html += '<div style="font-size:1.7rem;">' + escapeHtml(b.icon) + '</div>';
      html += '<div style="font-weight:800; margin-top:4px;">' + escapeHtml(b.name) + '</div>';
      html += '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">' + b.minPoints + '+ ' + tr('điểm', 'pts') + (b.unlocked ? (' • ✓ ' + tr('Đã mở', 'Unlocked')) : (' • 🔒 ' + tr('Chưa mở', 'Locked'))) + '</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="custom-list-card">';
    html += '<h3 style="margin:0 0 8px; font-size:0.96rem;">📜 ' + tr('Lịch sử tích điểm gần đây', 'Recent Points History') + '</h3>';
    if (!prof.history.length) {
      html += '<p style="font-size:0.82rem; color:var(--text-muted); margin:0;">' +
        tr('Hãy viết đánh giá quán (+25đ), tạo danh sách (+10đ), hoặc tạo bình chọn nhóm (+15đ) để tích điểm nhé!', 'Write a review (+25 pts), create a list (+10 pts), or start a poll (+15 pts) to earn points!') +
        '</p>';
    } else {
      var maxRows = Math.min(12, prof.history.length);
      for (var h = 0; h < maxRows; h++) {
        var entry = prof.history[h];
        html += '<div style="display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px dashed var(--border-vintage); font-size:0.82rem;">';
        html += '<span>' + escapeHtml(entry.reason) + '</span>';
        html += '<strong style="color:var(--color-lacquer); white-space:nowrap;">+' + entry.points + 'đ • ' + escapeHtml(formatDateTime(entry.createdAt)) + '</strong>';
        html += '</div>';
      }
    }
    html += '</div>';

    container.innerHTML = html;
  }

  /* ------------------------------------------------------------------
   * 6. RESTAURANT DETAIL INTEGRATIONS (hn-detail-opened)
   * ------------------------------------------------------------------ */

  function renderDetailEngageActions(restaurant) {
    if (typeof document === 'undefined' || !restaurant) return;
    var mount = document.getElementById('detailEngageActionsMount');
    if (!mount) return;

    // Remove only elements owned by community_engage.js so we preserve sibling buttons (e.g. HNReports)
    var oldNodes = mount.querySelectorAll('.ce-engage-node');
    for (var i = 0; i < oldNodes.length; i++) {
      if (oldNodes[i].parentNode) oldNodes[i].parentNode.removeChild(oldNodes[i]);
    }

    var inLists = getListsForPlace(restaurant.id);
    var wrap = document.createElement('div');
    wrap.className = 'ce-engage-node';
    wrap.style.display = 'contents';

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-engage-mini ce-btn-save-list';
    saveBtn.innerHTML = '📂 ' + tr('Lưu danh sách', 'Save to List') + (inLists.length ? ' (' + inLists.length + ')' : '');

    var shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'btn-engage-mini ce-btn-share-place';
    shareBtn.innerHTML = '🔗 ' + tr('Chia sẻ quán', 'Share Place');

    wrap.appendChild(saveBtn);
    wrap.appendChild(shareBtn);
    mount.insertBefore(wrap, mount.firstChild);

    var pickerBox = document.createElement('div');
    pickerBox.className = 'ce-engage-node ce-inline-list-picker';
    pickerBox.style.width = '100%';
    pickerBox.style.marginTop = '6px';
    pickerBox.hidden = !activeDetailListPickerOpen;
    mount.appendChild(pickerBox);

    function populatePicker() {
      var lists = getLists();
      var html = '<div class="custom-list-card" style="margin-bottom:0; padding:10px 12px;">';
      html += '<div style="font-size:0.82rem; font-weight:800; margin-bottom:7px;">📂 ' + tr('Chọn danh sách lưu "', 'Save "') + escapeHtml(restaurant.name) + '":</div>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">';
      for (var k = 0; k < lists.length; k++) {
        var lst = lists[k];
        var checked = hasInArray(lst.placeIds || [], Number(restaurant.id));
        html += '<button type="button" class="btn-engage-mini" data-ce-pick-list="' + escapeHtml(lst.id) + '" style="' +
          (checked ? 'background:var(--color-lacquer); color:#fff; border-color:var(--color-lacquer);' : '') + '">' +
          (checked ? '✓ ' : '+ ') + escapeHtml(lst.emoji || '📂') + ' ' + escapeHtml(lst.name) + ' (' + (lst.placeIds ? lst.placeIds.length : 0) + ')</button>';
      }
      html += '</div>';
      html += '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
      html += '<input type="text" class="ce-inline-new-list-input" placeholder="' + escapeHtml(tr('Tạo danh sách mới & lưu ngay...', 'New list name...')) + '" style="flex:1; min-width:160px; padding:5px 9px; border-radius:999px; border:1px solid var(--border-ornate); font-size:0.8rem;" />';
      html += '<button type="button" class="btn-engage-mini ce-inline-create-btn">➕ ' + tr('Tạo & Lưu', 'Create & Save') + '</button>';
      html += '</div></div>';
      pickerBox.innerHTML = html;

      var pickBtns = pickerBox.querySelectorAll('[data-ce-pick-list]');
      for (var p = 0; p < pickBtns.length; p++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var lid = btn.getAttribute('data-ce-pick-list');
            var res = togglePlaceInList(lid, restaurant.id);
            if (res) {
              showToastMsg(res.added
                ? (tr('📂 Đã thêm vào "', '📂 Added to "') + res.list.name + '"!')
                : (tr('Đã bỏ khỏi "', 'Removed from "') + res.list.name + '"'));
              var updatedCount = getListsForPlace(restaurant.id).length;
              saveBtn.innerHTML = '📂 ' + tr('Lưu danh sách', 'Save to List') + (updatedCount ? ' (' + updatedCount + ')' : '');
              populatePicker();
            }
          });
        })(pickBtns[p]);
      }

      var createInlineBtn = pickerBox.querySelector('.ce-inline-create-btn');
      var createInlineInput = pickerBox.querySelector('.ce-inline-new-list-input');
      if (createInlineBtn && createInlineInput) {
        createInlineBtn.addEventListener('click', function () {
          var nm = trimStr(createInlineInput.value);
          if (!nm) {
            showToastMsg(tr('Nhập tên danh sách mới!', 'Enter a list name!'));
            return;
          }
          var created = createList(nm, '📌', '');
          if (created) {
            togglePlaceInList(created.id, restaurant.id);
            var updatedCount = getListsForPlace(restaurant.id).length;
            saveBtn.innerHTML = '📂 ' + tr('Lưu danh sách', 'Save to List') + (updatedCount ? ' (' + updatedCount + ')' : '');
            showToastMsg(tr('✨ Đã tạo & lưu vào "', '✨ Created & saved to "') + created.name + '" (+10đ)!');
            populatePicker();
          }
        });
      }
    }

    if (activeDetailListPickerOpen) {
      populatePicker();
    }

    saveBtn.addEventListener('click', function () {
      activeDetailListPickerOpen = !activeDetailListPickerOpen;
      pickerBox.hidden = !activeDetailListPickerOpen;
      if (activeDetailListPickerOpen) {
        populatePicker();
      }
    });

    shareBtn.addEventListener('click', function () {
      var url = buildPlaceShareUrl(restaurant.id);
      shareUrl(restaurant.name, restaurant.subname || restaurant.address || restaurant.name, url);
    });
  }

  function renderDetailReviewsSection(restaurant) {
    if (typeof document === 'undefined' || !restaurant) return;
    var mount = document.getElementById('detailReviewsMount');
    if (!mount) return;

    // Preserve any prepended warning banner (e.g. .report-flag-banner from HNReports)
    var oldReviewSecs = mount.querySelectorAll('.ce-review-wrap');
    for (var i = 0; i < oldReviewSecs.length; i++) {
      if (oldReviewSecs[i].parentNode) oldReviewSecs[i].parentNode.removeChild(oldReviewSecs[i]);
    }

    var reviews = getReviews(restaurant.id);
    var sumUser = 0;
    for (var j = 0; j < reviews.length; j++) {
      sumUser += Number(reviews[j].rating) || 5;
    }
    var avgUser = reviews.length ? (sumUser / reviews.length).toFixed(1) : null;

    var wrap = document.createElement('div');
    wrap.className = 'ce-review-wrap';

    var html = '<section class="review-section" aria-label="' + escapeHtml(tr('Đánh giá từ cộng đồng', 'Community Reviews')) + '">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">';
    html += '<h3 class="detail-section-title" style="margin:0;"><span>✍️</span> ' + tr('Đánh Giá Thực Khách Phố Vị', 'Community Reviews') + '</h3>';
    html += '<span style="font-size:0.82rem; font-weight:700; color:var(--color-lacquer);">' +
      (avgUser
        ? ('★ ' + avgUser + '/5 (' + reviews.length + ' ' + tr('đánh giá mới', 'user reviews') + ')')
        : (tr('Chưa có đánh giá cộng đồng • Google: ★ ', 'No community reviews yet • Google: ★ ') + escapeHtml(restaurant.rating))) +
      '</span></div>';

    html += '<form class="review-form" id="ceReviewForm">';
    html += '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">';
    html += '<span style="font-size:0.82rem; font-weight:700;">' + tr('Chấm điểm:', 'Rating:') + '</span>';
    for (var st = 1; st <= 5; st++) {
      var activeStar = st <= selectedReviewRating;
      html += '<button type="button" class="btn-engage-mini" data-ce-rate="' + st + '" style="' +
        (activeStar ? 'background:var(--color-gold); color:#fff; border-color:var(--color-gold);' : '') + '">' + st + ' ★</button>';
    }
    html += '</div>';

    html += '<div style="display:flex; flex-wrap:wrap; gap:5px;">';
    for (var tg = 0; tg < REVIEW_QUICK_TAGS.length; tg++) {
      var tagLabel = isEn() ? REVIEW_QUICK_TAGS[tg].en : REVIEW_QUICK_TAGS[tg].vi;
      var tagSelected = hasInArray(selectedReviewTags, tagLabel);
      html += '<button type="button" class="btn-engage-mini" data-ce-rev-tag="' + escapeHtml(tagLabel) + '" style="font-size:0.74rem; padding:4px 9px;' +
        (tagSelected ? 'background:var(--color-lacquer); color:#fff; border-color:var(--color-lacquer);' : '') + '">' + escapeHtml(tagLabel) + '</button>';
    }
    html += '</div>';

    html += '<textarea id="ceReviewTextInput" rows="2" maxlength="400" placeholder="' +
      escapeHtml(tr('Chia sẻ trải nghiệm món ăn, không gian hoặc phục vụ để nhận +25 điểm thưởng...', 'Share your experience to earn +25 reward pts...')) +
      '" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border-ornate); font-family:inherit; font-size:0.85rem;"></textarea>';
    html += '<div style="display:flex; justify-content:flex-end;">';
    html += '<button type="submit" class="btn-nlp-search">⭐ ' + tr('Gửi đánh giá (+25 điểm)', 'Submit Review (+25 pts)') + '</button>';
    html += '</div></form>';

    if (!reviews.length) {
      html += '<div style="font-size:0.82rem; color:var(--text-muted);">' +
        tr('Hãy là người đầu tiên viết cảm nhận thực tế cho quán này!', 'Be the first to share a review for this restaurant!') +
        '</div>';
    } else {
      for (var rIdx = 0; rIdx < reviews.length; rIdx++) {
        var rv = reviews[rIdx];
        var starsStr = '';
        for (var k = 0; k < 5; k++) {
          starsStr += k < rv.rating ? '★' : '☆';
        }
        html += '<div class="review-item">';
        html += '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">';
        html += '<strong>' + escapeHtml(rv.author) + '</strong>';
        html += '<span style="color:var(--color-gold); font-weight:800;">' + starsStr + ' <span style="color:var(--text-muted); font-weight:500; font-size:0.75rem;">• ' + escapeHtml(formatDateTime(rv.createdAt)) + '</span></span>';
        html += '</div>';
        if (isArray(rv.tags) && rv.tags.length) {
          html += '<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;">';
          for (var tIdx = 0; tIdx < rv.tags.length; tIdx++) {
            html += '<span class="similar-open-tag">' + escapeHtml(rv.tags[tIdx]) + '</span>';
          }
          html += '</div>';
        }
        html += '<p style="margin:6px 0 0; line-height:1.45;">' + escapeHtml(rv.text) + '</p>';
        html += '</div>';
      }
    }

    html += '</section>';
    wrap.innerHTML = html;
    mount.appendChild(wrap);

    var rateBtns = wrap.querySelectorAll('[data-ce-rate]');
    for (var rb = 0; rb < rateBtns.length; rb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          selectedReviewRating = parseInt(btn.getAttribute('data-ce-rate'), 10) || 5;
          renderDetailReviewsSection(restaurant);
        });
      })(rateBtns[rb]);
    }

    var tagBtns = wrap.querySelectorAll('[data-ce-rev-tag]');
    for (var tb = 0; tb < tagBtns.length; tb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var tVal = btn.getAttribute('data-ce-rev-tag');
          var idx = -1;
          for (var x = 0; x < selectedReviewTags.length; x++) {
            if (selectedReviewTags[x] === tVal) { idx = x; break; }
          }
          if (idx !== -1) selectedReviewTags.splice(idx, 1);
          else selectedReviewTags.push(tVal);
          renderDetailReviewsSection(restaurant);
        });
      })(tagBtns[tb]);
    }

    var revForm = wrap.querySelector('#ceReviewForm');
    if (revForm) {
      revForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var txtEl = wrap.querySelector('#ceReviewTextInput');
        var txtVal = txtEl ? trimStr(txtEl.value) : '';
        if (!txtVal) {
          showToastMsg(tr('Vui lòng viết đôi dòng nhận xét trước khi gửi!', 'Please write a short review first!'));
          return;
        }
        var res = addReview(restaurant.id, selectedReviewRating, txtVal, selectedReviewTags);
        if (res) {
          selectedReviewRating = 5;
          selectedReviewTags = [];
          showToastMsg(tr('🎉 Đã đăng đánh giá! Bạn nhận +25 điểm thưởng!', '🎉 Review posted! You earned +25 reward pts!'));
          renderDetailReviewsSection(restaurant);
          var hubModal = getEngageModalEl();
          if (hubModal && hubModal.classList.contains('open')) {
            renderEngageHubContent();
          }
        }
      });
    }
  }

  /* ------------------------------------------------------------------
   * 7. INITIALIZATION & EVENT LISTENERS
   * ------------------------------------------------------------------ */

  var lastOpenedDetailRestaurant = null;

  function initEngageModule() {
    if (typeof document === 'undefined') return;

    var btnOpen = document.getElementById('btnOpenEngageHub');
    var mobOpen = document.getElementById('mobNavEngage');
    var btnClose = document.getElementById('btnCloseEngageHub');
    var modal = getEngageModalEl();

    if (btnOpen) {
      btnOpen.addEventListener('click', function () {
        openEngageHub(activeEngageTab);
      });
    }
    if (mobOpen) {
      mobOpen.addEventListener('click', function () {
        openEngageHub(activeEngageTab);
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', closeEngageHub);
    }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeEngageHub();
      });
    }

    var tabBtns = document.querySelectorAll('#engageHubTabs .engage-tab');
    for (var i = 0; i < tabBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var t = btn.getAttribute('data-engage-tab');
          if (t) {
            activeEngageTab = t;
            renderEngageHubContent();
          }
        });
      })(tabBtns[i]);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        closeEngageHub();
      }
    });

    window.addEventListener('hn-detail-opened', function (e) {
      var r = e && e.detail && e.detail.restaurant ? e.detail.restaurant : null;
      if (!r) return;
      if (!lastOpenedDetailRestaurant || lastOpenedDetailRestaurant.id !== r.id) {
        activeDetailListPickerOpen = false;
        selectedReviewRating = 5;
        selectedReviewTags = [];
      }
      lastOpenedDetailRestaurant = r;
      renderDetailEngageActions(r);
      renderDetailReviewsSection(r);
    });

    window.addEventListener('hn-auth-changed', function () {
      var hubModal = getEngageModalEl();
      if (hubModal && hubModal.classList.contains('open')) {
        renderEngageHubContent();
      }
      var detailModal = document.getElementById('detailModal');
      if (detailModal && detailModal.classList.contains('open') && lastOpenedDetailRestaurant) {
        renderDetailEngageActions(lastOpenedDetailRestaurant);
        renderDetailReviewsSection(lastOpenedDetailRestaurant);
      }
    });

    window.addEventListener('hn-lang-changed', function () {
      var hubModal = getEngageModalEl();
      if (hubModal && hubModal.classList.contains('open')) {
        renderEngageHubContent();
      }
      var detailModal = document.getElementById('detailModal');
      if (detailModal && detailModal.classList.contains('open') && lastOpenedDetailRestaurant) {
        renderDetailEngageActions(lastOpenedDetailRestaurant);
        renderDetailReviewsSection(lastOpenedDetailRestaurant);
      }
    });

    window.addEventListener('storage', function (e) {
      if (!e || (e.key !== LISTS_KEY && e.key !== POLLS_KEY && e.key !== REVIEWS_KEY && e.key !== REWARDS_KEY)) {
        return;
      }
      var hubModal = getEngageModalEl();
      if (hubModal && hubModal.classList.contains('open')) {
        renderEngageHubContent();
      }
      var detailModal = document.getElementById('detailModal');
      if (detailModal && detailModal.classList.contains('open') && lastOpenedDetailRestaurant) {
        renderDetailEngageActions(lastOpenedDetailRestaurant);
        renderDetailReviewsSection(lastOpenedDetailRestaurant);
      }
    });

    if (syncChannel) {
      syncChannel.onmessage = function () {
        var hubModal = getEngageModalEl();
        if (hubModal && hubModal.classList.contains('open')) {
          renderEngageHubContent();
        }
        var detailModal = document.getElementById('detailModal');
        if (detailModal && detailModal.classList.contains('open') && lastOpenedDetailRestaurant) {
          renderDetailEngageActions(lastOpenedDetailRestaurant);
          renderDetailReviewsSection(lastOpenedDetailRestaurant);
        }
      };
    }

    handleIncomingShareParams();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initEngageModule);
    } else {
      initEngageModule();
    }
  }
})();
