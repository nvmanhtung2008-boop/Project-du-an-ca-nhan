/**
 * HÀ NỘI PHỐ VỊ - ĐẶT GIAO HÀNG TẬN NƠI & ĐẶT BÀN TRƯỚC (REAL-TIME + NIELSEN H1-H10)
 * Tích hợp đầy đủ cho 2400 nhà hàng/quán ăn trong RESTAURANTS_DATA
 * Hỗ trợ: Sổ địa chỉ theo tài khoản, Đồng bộ đa tab BroadcastChannel, Đếm ngược thời gian thực
 */
(function () {
  'use strict';

  var ORDERS_KEY = 'hanoi_phovi_delivery_orders_v1';
  var RESERVES_KEY = 'hanoi_phovi_reservations_v1';
  var PROFILE_KEY = 'hanoi_phovi_delivery_profile_v1';
  var PROFILE_SCOPED_KEY = 'hanoi_phovi_delivery_profiles_v2';
  var SAVED_ADDRESSES_KEY = 'hanoi_phovi_saved_addresses_v2';
  var SAVED_ADDR_MIGRATED_KEY = 'hanoi_phovi_addr_migrated_v2';
  var DRAFT_CART_KEY = 'hanoi_phovi_order_drafts_v1';
  var SYNC_CHANNEL_NAME = 'hanoi_phovi_order_booking_sync';

  var VOUCHERS = [
    {
      code: 'FREESHIP',
      title: 'Miễn phí vận chuyển (tối đa 20k)',
      minSubtotal: 0,
      type: 'ship',
      value: 20000
    },
    {
      code: 'PHOVI20',
      title: 'Giảm 20.000đ cho đơn từ 100k',
      minSubtotal: 100000,
      type: 'flat',
      value: 20000
    },
    {
      code: 'HANOI15',
      title: 'Giảm 15% (tối đa 40k) đơn từ 150k',
      minSubtotal: 150000,
      type: 'percent',
      value: 15,
      maxDiscount: 40000
    }
  ];

  var PAYMENT_METHODS = [
    { id: 'cod', label: '💵 Tiền mặt khi nhận hàng (COD)' },
    { id: 'vietqr', label: '📱 Chuyển khoản VietQR' },
    { id: 'ewallet', label: '🟣 Ví MoMo / ZaloPay' },
    { id: 'card', label: '💳 Thẻ ATM / Visa / Mastercard' }
  ];

  var LUNCH_SLOTS = ['11:00', '11:30', '12:00', '12:30'];
  var DINNER_SLOTS = ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
  var TIME_SLOTS = LUNCH_SLOTS.concat(DINNER_SLOTS);
  var PEAK_SLOTS = ['12:00', '12:30', '18:30', '19:00', '19:30'];

  var SEATING_AREAS = [
    { id: 'standard', label: '🪑 Bàn tiêu chuẩn' },
    { id: 'window', label: '🪟 Gần cửa sổ / Ban công' },
    { id: 'vip', label: '🏮 Phòng riêng (VIP)' },
    { id: 'outdoor', label: '🌿 Ngoài trời / Sân vườn' }
  ];

  var ORDER_STEPS = [
    { key: 0, label: 'Quán đã nhận đơn', icon: '🧾' },
    { key: 1, label: 'Đang chế biến món', icon: '🍳' },
    { key: 2, label: 'Tài xế đang giao', icon: '🛵' },
    { key: 3, label: 'Giao thành công', icon: '✅' }
  ];

  var DEFAULT_STAGE_SCHEDULE = [0, 15, 45, 90];

  var DRIVERS = [
    { name: 'Nguyễn Văn Hùng', plate: '29B1-482.19', rating: '4.9', phone: '0912 345 678' },
    { name: 'Trần Minh Tuấn', plate: '29D2-719.05', rating: '4.9', phone: '0983 221 409' },
    { name: 'Phạm Quang Huy', plate: '29H1-305.88', rating: '4.8', phone: '0904 778 912' },
    { name: 'Lê Đức Anh', plate: '29C1-654.32', rating: '5.0', phone: '0976 112 530' }
  ];

  var QUICK_DRIVER_NOTES = [
    'Gọi khi đến cổng',
    'Để ở sảnh / bảo vệ',
    'Lấy thêm đũa thìa',
    'Không hành / ít cay'
  ];

  var HANOI_DISTRICTS = [
    'Hai Bà Trưng',
    'Nam Từ Liêm',
    'Bắc Từ Liêm',
    'Hoàn Kiếm',
    'Thanh Xuân',
    'Hoàng Mai',
    'Cầu Giấy',
    'Long Biên',
    'Ba Đình',
    'Đống Đa',
    'Tây Hồ',
    'Hà Đông',
    'Gia Lâm',
    'Đông Anh',
    'Thanh Trì',
    'Hoài Đức',
    'Thường Tín',
    'Thạch Thất',
    'Đan Phượng',
    'Chương Mỹ',
    'Thanh Oai',
    'Quốc Oai',
    'Sóc Sơn',
    'Mê Linh',
    'Phú Xuyên',
    'Phúc Thọ',
    'Ứng Hòa',
    'Mỹ Đức',
    'Ba Vì',
    'Sơn Tây'
  ];

  var STREET_DISTRICT_HINTS = [
    { district: 'Hoàn Kiếm', keys: ['bat dan', 'ly quoc su', 'hang bac', 'hang dao', 'hang buom', 'hang ma', 'hang gai', 'hang bong', 'trang tien', 'dinh tien hoang', 'pho co', 'cua dong', 'cua nam', 'ly thuong kiet', 'tran hung dao', 'hang bai', 'ta hien', 'luong ngoc quyen'] },
    { district: 'Hai Bà Trưng', keys: ['lo duc', 'bach mai', 'minh khai', 'pho hue', 'ba trieu', 'dai co viet', 'tran khat chan', 'times city', 'vinh tuy', 'thanh nhan', 'le thanh nghi', 'ta quang buu', 'nguyen du'] },
    { district: 'Ba Đình', keys: ['kim ma', 'doi can', 'lieu giai', 'giang vo', 'hoang hoa tham', 'ngoc ha', 'quan thanh', 'phan dinh phung', 'dien bien phu', 'nguyen thai hoc', 'van cao', 'phan ke binh'] },
    { district: 'Đống Đa', keys: ['xa dan', 'thai ha', 'chua boc', 'ton duc thang', 'kham thien', 'o cho dua', 'nguyen luong bang', 'tay son', 'chua lang', 'huynh thuc khang', 'cat linh', 'lang ha', 'nguyen chi thanh', 'hoang cau'] },
    { district: 'Cầu Giấy', keys: ['xuan thuy', 'tran thai tong', 'dich vong', 'trung hoa', 'duy tan', 'hoang quoc viet', 'nghia tan', 'tran duy hung', 'nguyen khang', 'to hieu', 'nguyen phong sac'] },
    { district: 'Thanh Xuân', keys: ['nguyen trai', 'le van luong', 'khuat duy tien', 'vu trong phung', 'nguyen xien', 'hoang dao thuy', 'royal city', 'khuong trung', 'khuong dinh', 'nhan chinh', 'vuong thua vu'] },
    { district: 'Hà Đông', keys: ['mo lao', 'van quan', 'to huu', 'duong noi', 'yen nghia', 'van phu', 'kien hung', 'la khe', 'ha tri', 'ao sen', 'phung khoang', 'tran phu ha dong', 'quang trung ha dong'] },
    { district: 'Tây Hồ', keys: ['lac long quan', 'xuan dieu', 'au co', 'thuy khue', 'trich sai', 'nhat chieu', 'quang an', 'yen phu', 'to ngoc van'] },
    { district: 'Nam Từ Liêm', keys: ['my dinh', 'me tri', 'ham nghi', 'le duc tho', 'le quang dao', 'trung van', 'cau dien', 'dai mo', 'tay mo', 'keangnam', 'the manor'] },
    { district: 'Bắc Từ Liêm', keys: ['co nhue', 'xuan dinh', 'duc thang', 'phu dien', 'pham van dong', 'ngoai giao doan'] },
    { district: 'Long Biên', keys: ['nguyen van cu', 'ngoc lam', 'bo de', 'viet hung', 'sai dong', 'aeon long bien', 'co linh', 'thach ban', 'ngoc thuy'] },
    { district: 'Hoàng Mai', keys: ['giai phong', 'linh dam', 'tan mai', 'dinh cong', 'truong dinh', 'hoang liet', 'yen so', 'tam trinh', 'kim dong'] }
  ];

  var ADDR_LABELS = {
    home: { icon: '🏠', text: 'Nhà riêng' },
    work: { icon: '🏢', text: 'Cơ quan' },
    other: { icon: '📍', text: 'Khác' }
  };

  var activeDeliveryState = {
    restaurant: null,
    menu: [],
    cart: {},
    voucherCode: 'FREESHIP',
    paymentMethod: 'cod',
    trackingOrderId: null,
    menuSearch: '',
    selectedAddressId: '',
    saveAddressToBook: true,
    saveAddressLabel: 'home',
    saveAddressCustomLabel: '',
    restoredDraft: false,
    helpOpen: false,
    confirmClearOpen: false,
    form: { name: '', phone: '', address: '', driverNote: '' }
  };

  var activeReserveState = {
    restaurant: null,
    date: '',
    timeSlot: '19:00',
    guests: 4,
    seating: 'standard',
    preOrderDishes: [],
    reschedulingCode: null,
    helpOpen: false,
    lastSlotRenderMinute: '',
    form: { name: '', phone: '', notes: '' }
  };

  var addrManagerState = {
    editingId: '',
    label: 'home',
    customLabel: '',
    name: '',
    phone: '',
    address: '',
    driverNote: '',
    isDefault: false
  };

  var activeHubTab = 'delivery';
  var realtimeTicker = null;
  var undoTimer = null;
  var activeUndoState = null;
  var syncChannel = null;
  var lastRenderedTrackStep = -1;

  // --- ES5 UTILITIES ---
  function $(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  function strTrim(s) {
    return String(s === undefined || s === null ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  function pad2(n) {
    var v = parseInt(n, 10) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function arrFind(arr, pred) {
    if (!arr || !arr.length) return null;
    for (var i = 0; i < arr.length; i++) {
      if (pred(arr[i], i)) return arr[i];
    }
    return null;
  }

  function arrFindIndex(arr, pred) {
    if (!arr || !arr.length) return -1;
    for (var i = 0; i < arr.length; i++) {
      if (pred(arr[i], i)) return i;
    }
    return -1;
  }

  function arrSome(arr, pred) {
    return arrFindIndex(arr, pred) !== -1;
  }

  function cloneShallow(obj) {
    var copy = {};
    if (!obj) return copy;
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      copy[keys[i]] = obj[keys[i]];
    }
    return copy;
  }

  function escHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtVnd(n) {
    var num = Math.max(0, Math.round(Number(n) || 0));
    return num.toLocaleString('vi-VN') + 'đ';
  }

  function normalizeVi(str) {
    if (!str) return '';
    var s = String(str);
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } else {
      // Fallback diacritic map for older ES5 engines
      s = s
        .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
        .replace(/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/g, 'a')
        .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
        .replace(/[ÈÉẸẺẼÊỀẾỆỂỄ]/g, 'e')
        .replace(/[ìíịỉĩ]/g, 'i')
        .replace(/[ÌÍỊỈĨ]/g, 'i')
        .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
        .replace(/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/g, 'o')
        .replace(/[ùúụủũưừứựửữ]/g, 'u')
        .replace(/[ÙÚỤỦŨƯỪỨỰỬỮ]/g, 'u')
        .replace(/[ỳýỵỷỹ]/g, 'y')
        .replace(/[ỲÝỴỶỸ]/g, 'y');
    }
    return s
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  function simpleHash(str) {
    var s = String(str || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  function showToast(msg, icon) {
    var toast = $('toastNotice');
    if (!toast) return;
    toast.innerHTML = '<span>' + (icon || '🛵') + '</span> <span>' + escHtml(msg) + '</span>';
    toast.classList.add('show');
    clearTimeout(toast._obTimer);
    toast._obTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3200);
  }

  function formatDateYMD(d) {
    var dt = d instanceof Date ? d : new Date();
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
  }

  function getTodayStr() {
    return formatDateYMD(new Date());
  }

  function getTomorrowStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateYMD(d);
  }

  function getWeekendStr() {
    var d = new Date();
    var day = d.getDay(); // 0 Sun .. 6 Sat
    var add = day === 6 ? 7 : (6 - day);
    if (day === 0) add = 6;
    d.setDate(d.getDate() + add);
    return formatDateYMD(d);
  }

  function formatTimeHHMM(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function formatTimeHMS(d) {
    var dt = d instanceof Date ? d : new Date();
    return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds());
  }

  function formatDurationShort(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSec / 86400);
    var hours = Math.floor((totalSec % 86400) / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var secs = totalSec % 60;
    if (days > 0) return days + ' ngày ' + hours + ' giờ';
    if (hours > 0) return hours + 'g ' + pad2(mins) + 'p';
    if (mins > 0) return mins + 'p ' + pad2(secs) + 's';
    return secs + 's';
  }

  function parseSlotToMins(slotStr) {
    var parts = String(slotStr || '').split(':');
    if (parts.length !== 2) return -1;
    var hh = parseInt(parts[0], 10);
    var mm = parseInt(parts[1], 10);
    if (isNaN(hh) || isNaN(mm)) return -1;
    return hh * 60 + mm;
  }

  function parseLocalDateTimeMs(dateStr, slotStr) {
    var dParts = String(dateStr || '').split('-');
    var tParts = String(slotStr || '').split(':');
    if (dParts.length !== 3 || tParts.length !== 2) return NaN;
    var y = parseInt(dParts[0], 10);
    var m = parseInt(dParts[1], 10) - 1;
    var d = parseInt(dParts[2], 10);
    var hh = parseInt(tParts[0], 10);
    var mm = parseInt(tParts[1], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(hh) || isNaN(mm)) return NaN;
    return new Date(y, m, d, hh, mm, 0, 0).getTime();
  }

  function isTimeSlotPast(dateStr, slotStr, nowDate) {
    var av = computeSlotAvailability(1, dateStr, slotStr, [], nowDate);
    return av.status === 'past';
  }

  // --- STORAGE & BROADCAST SYNC ---
  function readStorage(key, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStorage(key, val) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      // ignore quota error
    }
  }

  function broadcastSync(type, payload) {
    updateLiveSyncUI('Vừa đồng bộ ' + formatTimeHMS(new Date()));
    if (syncChannel && typeof syncChannel.postMessage === 'function') {
      try {
        syncChannel.postMessage({
          type: type,
          payload: payload || null,
          accountKey: getCurrentAccountKey(),
          ts: Date.now()
        });
      } catch (e) {
        // ignore channel error
      }
    }
  }

  function updateLiveSyncUI(labelText) {
    var pill = $('obLiveSyncPill');
    var txt = $('obLiveSyncText');
    if (txt && labelText) {
      txt.textContent = labelText;
    }
    if (pill) {
      pill.classList.add('synced');
      clearTimeout(pill._syncFlashTimer);
      pill._syncFlashTimer = setTimeout(function () {
        pill.classList.remove('synced');
      }, 1500);
    }
  }

  // --- ACCOUNT SCOPING & SAVED ADDRESS BOOK ---
  function getCurrentUserObj() {
    if (typeof window !== 'undefined' && window.HNAuth && typeof window.HNAuth.getCurrentUser === 'function') {
      return window.HNAuth.getCurrentUser();
    }
    return null;
  }

  function getCurrentAccountKey(explicitAccountKey) {
    if (explicitAccountKey && typeof explicitAccountKey === 'string') {
      var trimmed = strTrim(explicitAccountKey).toLowerCase();
      return trimmed || 'guest';
    }
    var cur = getCurrentUserObj();
    if (cur && cur.email) {
      return strTrim(cur.email).toLowerCase() || 'guest';
    }
    return 'guest';
  }

  function detectDistrictFromAddress(address) {
    var norm = normalizeVi(address);
    if (!norm) return '';

    var i;
    for (i = 0; i < HANOI_DISTRICTS.length; i++) {
      var dist = HANOI_DISTRICTS[i];
      var distNorm = normalizeVi(dist);
      if (norm.indexOf(distNorm) !== -1) {
        return dist;
      }
    }

    for (i = 0; i < STREET_DISTRICT_HINTS.length; i++) {
      var entry = STREET_DISTRICT_HINTS[i];
      for (var j = 0; j < entry.keys.length; j++) {
        if (norm.indexOf(entry.keys[j]) !== -1) {
          return entry.district;
        }
      }
    }

    return '';
  }

  function normalizeAddressKey(addr) {
    return normalizeVi(addr)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  function sortSavedAddresses(list) {
    return list.slice().sort(function (a, b) {
      var defA = a.isDefault ? 1 : 0;
      var defB = b.isDefault ? 1 : 0;
      if (defB !== defA) return defB - defA;

      var tA = a.lastUsedAt ? (Date.parse(a.lastUsedAt) || 0) : 0;
      var tB = b.lastUsedAt ? (Date.parse(b.lastUsedAt) || 0) : 0;
      if (tB !== tA) return tB - tA;

      return (Number(b.useCount) || 0) - (Number(a.useCount) || 0);
    });
  }

  function readAddressStoreMap() {
    var store = readStorage(SAVED_ADDRESSES_KEY, {});
    if (!store || typeof store !== 'object' || Array.isArray(store)) {
      return {};
    }
    return store;
  }

  function ensureAddressMigration(acct) {
    var store = readAddressStoreMap();
    var migratedMap = readStorage(SAVED_ADDR_MIGRATED_KEY, {});
    if (!migratedMap || typeof migratedMap !== 'object' || Array.isArray(migratedMap)) {
      migratedMap = {};
    }

    var currentList = Array.isArray(store[acct]) ? store[acct] : [];
    if (!migratedMap.__legacyV1Done && currentList.length === 0) {
      var prof = readStorage(PROFILE_KEY, null);
      if (prof && prof.address && strTrim(prof.address).length >= 5) {
        var nowIso = new Date().toISOString();
        var addrText = strTrim(prof.address);
        var migratedItem = {
          id: 'addr_mig_' + Date.now(),
          label: 'home',
          customLabel: '',
          recipientName: strTrim(prof.name || ''),
          phone: strTrim(prof.phone || ''),
          address: addrText,
          district: detectDistrictFromAddress(addrText),
          driverNote: strTrim(prof.driverNote || prof.note || ''),
          isDefault: true,
          useCount: 1,
          lastUsedAt: nowIso,
          createdAt: nowIso
        };
        store[acct] = [migratedItem];
        writeStorage(SAVED_ADDRESSES_KEY, store);
        migratedMap.__legacyV1Done = true;
        migratedMap[acct] = true;
        writeStorage(SAVED_ADDR_MIGRATED_KEY, migratedMap);
      }
    }
    return readAddressStoreMap();
  }

  function getSavedAddresses(accountKey) {
    var acct = getCurrentAccountKey(accountKey);
    var store = ensureAddressMigration(acct);
    var list = Array.isArray(store[acct]) ? store[acct] : [];
    return sortSavedAddresses(list);
  }

  function writeAccountAddresses(acct, list) {
    var store = readAddressStoreMap();
    var sorted = sortSavedAddresses(list);
    // Cap at 20, dropping lowest-priority non-default entries
    while (sorted.length > 20) {
      var dropIdx = -1;
      for (var i = sorted.length - 1; i >= 0; i--) {
        if (!sorted[i].isDefault) {
          dropIdx = i;
          break;
        }
      }
      if (dropIdx === -1) dropIdx = sorted.length - 1;
      sorted.splice(dropIdx, 1);
    }
    if (sorted.length > 0 && !arrSome(sorted, function (x) { return Boolean(x.isDefault); })) {
      sorted[0].isDefault = true;
    }
    sorted = sortSavedAddresses(sorted);
    store[acct] = sorted;
    writeStorage(SAVED_ADDRESSES_KEY, store);
    var migratedMap = readStorage(SAVED_ADDR_MIGRATED_KEY, {});
    if (migratedMap && typeof migratedMap === 'object') {
      migratedMap[acct] = true;
      writeStorage(SAVED_ADDR_MIGRATED_KEY, migratedMap);
    }
    updateHubBadges();
    return sorted;
  }

  function saveAddress(addrInput, accountKey) {
    if (!addrInput || typeof addrInput !== 'object') return null;
    var rawAddr = strTrim(addrInput.address);
    if (!rawAddr) return null;

    var acct = getCurrentAccountKey(accountKey);
    var list = getSavedAddresses(acct);
    var normKey = normalizeAddressKey(rawAddr);
    var nowIso = new Date().toISOString();

    var label = (addrInput.label === 'work' || addrInput.label === 'other') ? addrInput.label : 'home';
    var customLabel = label === 'other' ? strTrim(addrInput.customLabel || '') : '';
    var detectedDistrict = strTrim(addrInput.district || '') || detectDistrictFromAddress(rawAddr);

    var byIdIdx = addrInput.id ? arrFindIndex(list, function (x) { return x.id === addrInput.id; }) : -1;
    var byNormIdx = arrFindIndex(list, function (x) { return normalizeAddressKey(x.address) === normKey; });

    var targetIdx = byIdIdx !== -1 ? byIdIdx : byNormIdx;
    var savedItem;

    if (targetIdx !== -1) {
      var existing = cloneShallow(list[targetIdx]);
      // If editing by ID and normalized address collides with another entry, merge & remove duplicate
      if (byIdIdx !== -1 && byNormIdx !== -1 && byNormIdx !== byIdIdx) {
        var dup = list[byNormIdx];
        existing.useCount = (Number(existing.useCount) || 0) + (Number(dup.useCount) || 0);
        existing.isDefault = Boolean(existing.isDefault || dup.isDefault);
        list.splice(byNormIdx, 1);
        targetIdx = arrFindIndex(list, function (x) { return x.id === existing.id; });
      }
      existing.label = label;
      existing.customLabel = customLabel;
      existing.recipientName = addrInput.recipientName !== undefined ? strTrim(addrInput.recipientName) : (existing.recipientName || '');
      existing.phone = addrInput.phone !== undefined ? strTrim(addrInput.phone) : (existing.phone || '');
      existing.address = rawAddr;
      existing.district = detectedDistrict || existing.district || '';
      existing.driverNote = addrInput.driverNote !== undefined ? strTrim(addrInput.driverNote) : (existing.driverNote || '');
      if (addrInput.incrementUse !== false) {
        existing.useCount = (Number(existing.useCount) || 0) + 1;
      }
      if (addrInput.isDefault !== undefined) {
        existing.isDefault = Boolean(addrInput.isDefault);
      }
      existing.lastUsedAt = addrInput.lastUsedAt || nowIso;
      list[targetIdx] = existing;
      savedItem = existing;
    } else {
      savedItem = {
        id: addrInput.id || ('addr_' + Date.now() + '_' + Math.floor(Math.random() * 10000)),
        label: label,
        customLabel: customLabel,
        recipientName: strTrim(addrInput.recipientName || ''),
        phone: strTrim(addrInput.phone || ''),
        address: rawAddr,
        district: detectedDistrict,
        driverNote: strTrim(addrInput.driverNote || ''),
        isDefault: list.length === 0 ? true : Boolean(addrInput.isDefault),
        useCount: typeof addrInput.useCount === 'number' ? Math.max(1, addrInput.useCount) : 1,
        lastUsedAt: addrInput.lastUsedAt || nowIso,
        createdAt: addrInput.createdAt || nowIso
      };
      list.unshift(savedItem);
    }

    if (savedItem.isDefault) {
      for (var i = 0; i < list.length; i++) {
        list[i].isDefault = (list[i].id === savedItem.id);
      }
    }

    var finalSorted = writeAccountAddresses(acct, list);
    broadcastSync('addresses_updated', { accountKey: acct, id: savedItem.id });
    return arrFind(finalSorted, function (x) { return x.id === savedItem.id; }) || savedItem;
  }

  function deleteSavedAddress(id, accountKey) {
    if (!id) return false;
    var acct = getCurrentAccountKey(accountKey);
    var list = getSavedAddresses(acct);
    var idx = arrFindIndex(list, function (x) { return x.id === id; });
    if (idx === -1) return false;
    list.splice(idx, 1);
    writeAccountAddresses(acct, list);
    broadcastSync('addresses_updated', { accountKey: acct, deletedId: id });
    return true;
  }

  function setDefaultSavedAddress(id, accountKey) {
    if (!id) return null;
    var acct = getCurrentAccountKey(accountKey);
    var list = getSavedAddresses(acct);
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].isDefault = true;
        found = list[i];
      } else {
        list[i].isDefault = false;
      }
    }
    if (!found) return null;
    var sorted = writeAccountAddresses(acct, list);
    broadcastSync('addresses_updated', { accountKey: acct, defaultId: id });
    return arrFind(sorted, function (x) { return x.id === id; }) || found;
  }

  function restoreAddressSnapshot(snapshotItem, accountKey) {
    if (!snapshotItem) return null;
    var acct = getCurrentAccountKey(accountKey);
    var list = getSavedAddresses(acct);
    if (snapshotItem.isDefault) {
      for (var i = 0; i < list.length; i++) {
        list[i].isDefault = false;
      }
    }
    list.push(cloneShallow(snapshotItem));
    writeAccountAddresses(acct, list);
    broadcastSync('addresses_updated', { accountKey: acct, restoredId: snapshotItem.id });
    return snapshotItem;
  }

  function getOrders() {
    var list = readStorage(ORDERS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveOrders(list, silentBroadcast) {
    writeStorage(ORDERS_KEY, list);
    updateHubBadges();
    if (!silentBroadcast) {
      broadcastSync('orders_updated');
    }
  }

  function getReservations() {
    var list = readStorage(RESERVES_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveReservations(list, silentBroadcast) {
    writeStorage(RESERVES_KEY, list);
    updateHubBadges();
    if (!silentBroadcast) {
      broadcastSync('reservations_updated');
    }
  }

  function readScopedProfilesMap() {
    var map = readStorage(PROFILE_SCOPED_KEY, {});
    return (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
  }

  function getSavedProfile(accountKey) {
    var acct = getCurrentAccountKey(accountKey);
    var addrs = getSavedAddresses(acct);
    var defAddr = arrFind(addrs, function (a) { return a.isDefault; }) || addrs[0] || null;
    var map = readScopedProfilesMap();
    var prof = map[acct] || {};
    var curUser = getCurrentUserObj();
    var userFallbackName = (!accountKey && curUser && curUser.fullName) ? curUser.fullName : '';

    return {
      name: (defAddr && defAddr.recipientName) || (prof && prof.name) || userFallbackName || '',
      phone: (defAddr && defAddr.phone) || (prof && prof.phone) || '',
      address: (defAddr && defAddr.address) || (prof && prof.address) || '',
      driverNote: (defAddr && defAddr.driverNote) || '',
      addressId: defAddr ? defAddr.id : ''
    };
  }

  function saveProfile(name, phone, address, accountKey) {
    var acct = getCurrentAccountKey(accountKey);
    var map = readScopedProfilesMap();
    map[acct] = {
      name: name || '',
      phone: phone || '',
      address: address || ''
    };
    writeStorage(PROFILE_SCOPED_KEY, map);
  }

  // --- DRAFT CART PERSISTENCE ---
  function readAllDrafts() {
    var d = readStorage(DRAFT_CART_KEY, {});
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  }

  function getDraftKeyForRestaurant(restaurantId) {
    return getCurrentAccountKey() + '::' + String(restaurantId);
  }

  function loadRestaurantDraft(restaurantId) {
    var all = readAllDrafts();
    var key = getDraftKeyForRestaurant(restaurantId);
    return all[key] || all[String(restaurantId)] || null;
  }

  function saveRestaurantDraft(restaurantId) {
    if (!restaurantId) return;
    var all = readAllDrafts();
    var key = getDraftKeyForRestaurant(restaurantId);
    var hasItems = Object.keys(activeDeliveryState.cart).length > 0;
    if (!hasItems && !strTrim(activeDeliveryState.form.driverNote)) {
      delete all[key];
      delete all[String(restaurantId)];
    } else {
      all[key] = {
        restaurantId: restaurantId,
        cart: cloneShallow(activeDeliveryState.cart),
        voucherCode: activeDeliveryState.voucherCode,
        paymentMethod: activeDeliveryState.paymentMethod,
        form: cloneShallow(activeDeliveryState.form),
        updatedAt: Date.now()
      };
    }
    writeStorage(DRAFT_CART_KEY, all);
    updateDraftBadgeUI();
  }

  function clearRestaurantDraft(restaurantId) {
    var all = readAllDrafts();
    delete all[getDraftKeyForRestaurant(restaurantId)];
    delete all[String(restaurantId)];
    writeStorage(DRAFT_CART_KEY, all);
  }

  // --- PURE REAL-TIME COMPUTATIONS ---
  function computeOrderLiveState(order, nowMs) {
    var now = (typeof nowMs === 'number' && !isNaN(nowMs)) ? nowMs : Date.now();
    var schedule = (order && Array.isArray(order.stageSchedule) && order.stageSchedule.length === 4)
      ? order.stageSchedule
      : DEFAULT_STAGE_SCHEDULE;

    var createdMs = NaN;
    if (order && typeof order.createdAtMs === 'number' && !isNaN(order.createdAtMs)) {
      createdMs = order.createdAtMs;
    } else if (order && order.createdAt) {
      createdMs = Date.parse(order.createdAt);
    }
    if (isNaN(createdMs)) createdMs = now;

    var stageTimes = [];
    for (var s = 0; s < 4; s++) {
      var offsetSec = Number(schedule[s]) || 0;
      stageTimes.push(formatTimeHHMM(createdMs + offsetSec * 1000));
    }

    if (!order || order.cancelled) {
      return {
        statusIndex: -1,
        statusStep: -1,
        statusLabel: 'Đã hủy đơn',
        statusIcon: '❌',
        cancelled: true,
        progressPct: 0,
        remainingSec: 0,
        etaText: 'Đã hủy',
        stageTimes: stageTimes,
        canEditOrCancel: false,
        isCompleted: false
      };
    }

    var elapsedSec = Math.max(0, (now - createdMs) / 1000);
    var statusIndex = 0;
    for (var i = 1; i < 4; i++) {
      if (elapsedSec >= (Number(schedule[i]) || 0)) {
        statusIndex = i;
      }
    }
    // Preserve legacy statusStep if order had no stageSchedule
    if (!order.stageSchedule && typeof order.statusStep === 'number' && order.statusStep > statusIndex) {
      statusIndex = Math.min(3, Math.max(0, order.statusStep));
    }

    var totalDurSec = Math.max(1, Number(schedule[3]) || 90);
    var remainingSec = Math.max(0, Math.ceil(totalDurSec - elapsedSec));
    var progressPct = statusIndex >= 3
      ? 100
      : Math.min(98, Math.max(6, Math.round((elapsedSec / totalDurSec) * 100)));

    var etaText;
    if (statusIndex >= 3 || remainingSec <= 0) {
      etaText = 'Đã giao thành công';
      remainingSec = 0;
    } else if (remainingSec >= 60) {
      etaText = 'Còn ' + Math.floor(remainingSec / 60) + 'p ' + pad2(remainingSec % 60) + 's';
    } else {
      etaText = 'Còn ' + remainingSec + 's';
    }

    var stepObj = ORDER_STEPS[statusIndex] || ORDER_STEPS[0];

    return {
      statusIndex: statusIndex,
      statusStep: statusIndex,
      statusLabel: stepObj.label,
      statusIcon: stepObj.icon,
      cancelled: false,
      progressPct: progressPct,
      remainingSec: remainingSec,
      etaText: etaText,
      stageTimes: stageTimes,
      canEditOrCancel: statusIndex <= 1,
      isCompleted: statusIndex >= 3
    };
  }

  function computeSlotAvailability(restaurantId, dateStr, slotStr, activeReservations, nowDate) {
    var now = (nowDate instanceof Date) ? nowDate : (nowDate ? new Date(nowDate) : new Date());
    var todayStr = formatDateYMD(now);
    var rid = Math.abs(parseInt(restaurantId, 10) || 1);
    var totalTables = 4 + (rid % 7); // 4..10
    var isPeak = PEAK_SLOTS.indexOf(slotStr) !== -1;

    var slotMins = parseSlotToMins(slotStr);
    var isPast = false;
    if (!dateStr || dateStr < todayStr || slotMins < 0) {
      isPast = true;
    } else if (dateStr === todayStr) {
      var nowMins = now.getHours() * 60 + now.getMinutes();
      if (slotMins <= nowMins + 20) {
        isPast = true;
      }
    }

    if (isPast) {
      return {
        status: 'past',
        remainingTables: 0,
        totalTables: totalTables,
        label: 'Đã qua / Sát giờ',
        isPeak: isPeak
      };
    }

    var hoursApi = getHoursApi();
    var restObj = findRestaurantById(restaurantId);
    if (!restObj && activeReserveState.restaurant && String(activeReserveState.restaurant.id) === String(restaurantId)) {
      restObj = activeReserveState.restaurant;
    }
    if (hoursApi && typeof hoursApi.isOpenAtTimeString === 'function' && restObj && restObj.openingHours) {
      var slotMs = parseLocalDateTimeMs(dateStr, slotStr);
      var slotDateObj = !isNaN(slotMs) ? new Date(slotMs) : now;
      if (!hoursApi.isOpenAtTimeString(restObj, slotStr, slotDateObj)) {
        return {
          status: 'closed_hours',
          remainingTables: 0,
          totalTables: totalTables,
          label: 'Quán đóng cửa',
          isPeak: isPeak
        };
      }
    }

    var resList = Array.isArray(activeReservations) ? activeReservations : [];
    var bookedCount = 0;
    for (var i = 0; i < resList.length; i++) {
      var r = resList[i];
      if (!r) continue;
      if (String(r.restaurantId) === String(restaurantId) &&
          r.date === dateStr &&
          r.timeSlot === slotStr &&
          r.status !== 'cancelled' &&
          r.status !== 'completed') {
        bookedCount += 1;
      }
    }

    var hash = simpleHash(rid + '|' + dateStr + '|' + slotStr);
    var simPeakUsed = isPeak ? Math.min(Math.max(0, totalTables - 2), 1 + (hash % 2)) : 0;
    var remainingTables = Math.max(0, totalTables - simPeakUsed - bookedCount);

    var status;
    var label;
    if (remainingTables <= 0) {
      status = 'full';
      label = 'Hết bàn';
    } else if (remainingTables <= 2) {
      status = 'low';
      label = 'Sắp hết (' + remainingTables + ' bàn)';
    } else {
      status = 'available';
      label = 'Còn ' + remainingTables + ' bàn';
    }

    return {
      status: status,
      remainingTables: remainingTables,
      totalTables: totalTables,
      label: label,
      isPeak: isPeak
    };
  }

  function computeReservationLiveState(res, nowMs) {
    var now = (typeof nowMs === 'number' && !isNaN(nowMs)) ? nowMs : Date.now();
    if (!res) {
      return {
        status: 'cancelled',
        label: 'Đã hủy',
        countdownText: '—',
        diffMs: 0,
        canCheckIn: false,
        canReschedule: false,
        canCancel: false
      };
    }

    if (res.status === 'cancelled') {
      return {
        status: 'cancelled',
        label: 'Đã hủy',
        countdownText: 'Đã hủy lịch',
        diffMs: 0,
        canCheckIn: false,
        canReschedule: false,
        canCancel: false
      };
    }

    if (res.status === 'checked_in') {
      return {
        status: 'checked_in',
        label: 'Đã check-in',
        countdownText: 'Đang phục vụ tại bàn',
        diffMs: 0,
        canCheckIn: false,
        canReschedule: false,
        canCancel: false
      };
    }

    if (res.status === 'completed') {
      return {
        status: 'completed',
        label: 'Đã hoàn thành',
        countdownText: 'Đã hoàn thành',
        diffMs: 0,
        canCheckIn: false,
        canReschedule: false,
        canCancel: false
      };
    }

    var targetMs = parseLocalDateTimeMs(res.date, res.timeSlot);
    if (isNaN(targetMs)) targetMs = now;
    var diffMs = targetMs - now;
    var diffMins = diffMs / 60000;

    if (diffMins < -120) {
      return {
        status: 'completed',
        label: 'Đã hoàn thành',
        countdownText: 'Đã qua giờ hẹn',
        diffMs: diffMs,
        canCheckIn: false,
        canReschedule: false,
        canCancel: false
      };
    }

    if (diffMins <= 45) {
      return {
        status: 'arriving_soon',
        label: diffMs >= 0 ? 'Sắp đến giờ' : 'Đang giữ bàn',
        countdownText: diffMs >= 0 ? ('Còn ' + formatDurationShort(diffMs)) : ('Quá giờ ' + formatDurationShort(-diffMs)),
        diffMs: diffMs,
        canCheckIn: true,
        canReschedule: diffMs > 0,
        canCancel: true
      };
    }

    return {
      status: 'upcoming',
      label: 'Sắp tới',
      countdownText: 'Còn ' + formatDurationShort(diffMs),
      diffMs: diffMs,
      canCheckIn: true,
      canReschedule: true,
      canCancel: true
    };
  }

  // --- CAPABILITY RULES (PRESERVED) ---
  function canReserve(restaurant) {
    if (!restaurant) return false;
    var tier = restaurant.priceTier || 'moderate';
    var cat = restaurant.category || '';
    var occasions = restaurant.occasions || [];
    var people = restaurant.peopleCategory || [];
    var text = ((restaurant.specialBadges || []).join(' ') + ' ' + (restaurant.description || '') + ' ' + (restaurant.tips || '')).toLowerCase();

    if (tier === 'luxury' || tier === 'upscale') return true;

    var sitDownCategories = [
      'Cao cấp & Fine Dining',
      'Lẩu & Nướng',
      'Ẩm Thực Hàn Quốc',
      'Ẩm Thực Trung Hoa',
      'Ẩm Thực Quốc Tế',
      'Chả cá',
      'Cơm & Món Bắc'
    ];
    if (sitDownCategories.indexOf(cat) !== -1) return true;

    var isStreetOnly = (cat === 'Ăn vặt & Đường phố' || cat === 'Quà Vặt & Chè') && tier === 'budget';
    if (isStreetOnly) return false;

    if (occasions.indexOf('business') !== -1 || occasions.indexOf('date') !== -1) return true;
    if ((people.indexOf('group') !== -1 || people.indexOf('party') !== -1 || people.indexOf('family') !== -1) && tier !== 'budget') {
      return true;
    }
    if (/đặt bàn|phòng riêng|máy lạnh|nhà hàng|sang trọng/.test(text)) return true;

    return false;
  }

  function canDeliver(restaurant) {
    return Boolean(restaurant);
  }

  function getDeliveryMeta(restaurant) {
    if (!restaurant) return { etaMin: 20, etaMax: 30, fee: 18000, distanceKm: '2.4' };
    var id = Number(restaurant.id) || 1;
    var dist = (1.2 + (id % 38) * 0.15).toFixed(1);
    var etaMin = 16 + (id % 12);
    var etaMax = etaMin + 10;
    var feeBase = restaurant.priceTier === 'luxury' ? 25000 : (restaurant.priceTier === 'upscale' ? 22000 : 15000);
    var fee = feeBase + ((id % 3) * 3000);
    return {
      etaMin: etaMin,
      etaMax: etaMax,
      fee: fee,
      distanceKm: dist
    };
  }

  // --- MENU BUILDER ---
  function roundPrice(val) {
    if (val <= 15000) return Math.max(5000, Math.round(val / 1000) * 1000);
    return Math.max(15000, Math.round(val / 5000) * 5000);
  }

  function buildMenuForRestaurant(restaurant) {
    var basePrice = Number(restaurant.priceAvg) || 60000;
    var dishes = Array.isArray(restaurant.signatureDishes) && restaurant.signatureDishes.length
      ? restaurant.signatureDishes
      : [restaurant.name + ' (Phần đặc biệt)'];

    var multipliers = [1.0, 0.9, 1.15, 0.8, 1.25];
    var menu = dishes.map(function (dishName, idx) {
      var mult = multipliers[idx % multipliers.length];
      var price = roundPrice(basePrice * mult);
      return {
        id: 'dish_' + idx,
        name: dishName,
        price: price,
        tag: idx === 0 ? '🔥 Bán chạy nhất' : '⭐ Món đặc trưng',
        group: 'main'
      };
    });

    var cat = restaurant.category || '';
    if (cat === 'Cà Phê & Quà Chiều' || cat === 'Tráng miệng & Cà phê') {
      menu.push(
        { id: 'side_1', name: 'Bánh sừng bò bơ Pháp / Bánh ngọt kèm', price: 35000, tag: '🥐 Ăn kèm', group: 'side' },
        { id: 'side_2', name: 'Thêm topping kem tươi / trân châu', price: 12000, tag: '✨ Thêm', group: 'side' },
        { id: 'side_3', name: 'Nước suối đóng chai lạnh', price: 10000, tag: '🥤 Đồ uống', group: 'side' }
      );
    } else if (cat === 'Lẩu & Nướng' || cat === 'Ẩm Thực Hàn Quốc' || cat === 'Ẩm Thực Trung Hoa') {
      menu.push(
        { id: 'side_1', name: 'Đĩa rau nấm tổng hợp ăn kèm', price: 45000, tag: '🥬 Ăn kèm', group: 'side' },
        { id: 'side_2', name: 'Trà đá / Nước sấu Hà Nội', price: 15000, tag: '🥤 Đồ uống', group: 'side' },
        { id: 'side_3', name: 'Coca-Cola / Bia lon lạnh', price: 22000, tag: '🍺 Giải khát', group: 'side' }
      );
    } else {
      menu.push(
        { id: 'side_1', name: 'Trà đá Hà Nội', price: 5000, tag: '🧊 Giải khát', group: 'side' },
        { id: 'side_2', name: 'Trà chanh / Nước sấu ngâm', price: 18000, tag: '🍋 Đồ uống', group: 'side' },
        { id: 'side_3', name: 'Quẩy giòn / Khăn lạnh & gia vị', price: 10000, tag: '🥢 Gọi thêm', group: 'side' }
      );
    }

    return menu;
  }

  function getHoursApi() {
    if (typeof window !== 'undefined' && window.HNRestaurantHours) {
      return window.HNRestaurantHours;
    }
    return null;
  }

  function getSelectedHoursContext() {
    var api = getHoursApi();
    if (api && typeof api.getSelectedTimeContext === 'function') {
      return api.getSelectedTimeContext();
    }
    var now = new Date();
    return {
      mode: 'now',
      minutes: now.getHours() * 60 + now.getMinutes(),
      timeLabel: formatTimeHHMM(now.getTime()),
      dayOfWeek: now.getDay(),
      rawValue: 'now'
    };
  }

  function buildClosedAlternativesHtml(restaurant, opts) {
    var api = getHoursApi();
    var targetMinutes = opts.targetMinutes;
    var targetDayOfWeek = opts.targetDayOfWeek;
    var timeLabel = opts.timeLabel;
    var requireReservable = Boolean(opts.requireReservable);
    var simRes = (api && typeof api.findSimilarOpenRestaurants === 'function')
      ? api.findSimilarOpenRestaurants(restaurant, {
          targetMinutes: targetMinutes,
          targetDayOfWeek: targetDayOfWeek,
          timeLabel: timeLabel,
          limit: 4,
          requireReservable: requireReservable
        })
      : null;
    var items = (simRes && Array.isArray(simRes.items)) ? simRes.items : [];
    var filterNote = '';
    if (simRes && simRes.activeFilterSummary) {
      filterNote = simRes.matchedActiveFilters !== false
        ? 'Đang lọc theo tiêu chí: ' + simRes.activeFilterSummary + '.'
        : (simRes.relaxedReason || 'Đã mở rộng nhẹ bộ lọc để gợi ý quán đang mở gần nhất.');
    }

    var listHtml = '';
    if (items.length > 0) {
      listHtml =
        '<div class="ob-similar-open-wrap">' +
          '<div style="font-size:0.84rem; font-weight:700; margin-bottom:6px;">' +
            (requireReservable ? '🪑 Gợi ý quán tương tự ĐANG MỞ &amp; nhận đặt bàn lúc ' : '🛵 Gợi ý quán tương tự ĐANG MỞ lúc ') +
            escHtml(timeLabel) + ':' +
          '</div>' +
          '<div class="ob-similar-open-list">' +
            items.map(function (entry) {
              var alt = entry && entry.restaurant ? entry.restaurant : entry;
              if (!alt) return '';
              var reasonsText = (entry && Array.isArray(entry.reasons) && entry.reasons.length)
                ? entry.reasons.slice(0, 2).join(' • ')
                : (alt.category || '');
              var actionBtn = requireReservable
                ? '<button type="button" class="ob-btn-primary" data-ob-alt-reserve="' + escHtml(alt.id) + '">🪑 Chuyển đặt bàn</button>'
                : '<button type="button" class="ob-btn-primary" data-ob-alt-deliver="' + escHtml(alt.id) + '">🛵 Chuyển đặt quán này</button>';
              return (
                '<div class="ob-similar-open-item">' +
                  '<div class="ob-similar-open-info">' +
                    '<strong>' + escHtml(alt.name) + '</strong>' +
                    '<span>⭐ ' + escHtml(alt.rating) + ' • 📍 ' + escHtml(alt.district) + ' • ⏰ ' + escHtml(alt.openingHours || '') + ' • ' + escHtml(alt.priceRange || '') + '</span>' +
                    (reasonsText ? '<span>✨ ' + escHtml(reasonsText) + '</span>' : '') +
                  '</div>' +
                  '<div class="ob-similar-open-btns">' +
                    actionBtn +
                    '<button type="button" class="ob-btn-secondary" data-ob-alt-view="' + escHtml(alt.id) + '">📖 Xem quán</button>' +
                  '</div>' +
                '</div>'
              );
            }).join('') +
          '</div>' +
        '</div>';
    }

    return (
      '<div class="ob-closed-banner" role="alert">' +
        '<div class="ob-closed-banner-title">' + escHtml(opts.titleText) + '</div>' +
        '<div class="ob-closed-banner-sub">' + escHtml(opts.subText) + (filterNote ? ' ' + escHtml(filterNote) : '') + '</div>' +
        listHtml +
      '</div>'
    );
  }

  function bindClosedAlternativesListeners(rootEl, modalId, checkMins, activeSlot) {
    if (!rootEl) return;
    var delBtns = rootEl.querySelectorAll('[data-ob-alt-deliver]');
    for (var i = 0; i < delBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var altId = parseInt(btn.getAttribute('data-ob-alt-deliver'), 10);
          if (!isNaN(altId)) openDelivery(altId);
        });
      })(delBtns[i]);
    }
    var resBtns = rootEl.querySelectorAll('[data-ob-alt-reserve]');
    for (var j = 0; j < resBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var altId = parseInt(btn.getAttribute('data-ob-alt-reserve'), 10);
          if (!isNaN(altId)) openReservation(altId, null, activeSlot || null);
        });
      })(resBtns[j]);
    }
    var viewBtns = rootEl.querySelectorAll('[data-ob-alt-view]');
    for (var k = 0; k < viewBtns.length; k++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var altId = parseInt(btn.getAttribute('data-ob-alt-view'), 10);
          if (modalId && $(modalId)) $(modalId).classList.remove('open');
          if (!isNaN(altId) && typeof window.openRestaurantDetail === 'function') {
            window.openRestaurantDetail(altId, checkMins);
          }
        });
      })(viewBtns[k]);
    }
  }

  function findRestaurantById(id) {
    if (typeof RESTAURANTS_DATA === 'undefined') return null;
    return arrFind(RESTAURANTS_DATA, function (r) { return r.id === id; });
  }

  // --- UNDO BAR (H3 - 6s RESTORE) ---
  function hideUndoBar() {
    clearTimeout(undoTimer);
    activeUndoState = null;
    var bar = $('obUndoBar');
    if (bar) {
      bar.classList.remove('show');
      bar.setAttribute('aria-hidden', 'true');
    }
  }

  function triggerUndo(text, undoFn) {
    var bar = $('obUndoBar');
    var txt = $('obUndoText');
    if (!bar || !txt) return;
    clearTimeout(undoTimer);
    activeUndoState = undoFn;
    txt.textContent = text;
    bar.classList.add('show');
    bar.setAttribute('aria-hidden', 'false');
    undoTimer = setTimeout(function () {
      hideUndoBar();
    }, 6000);
  }

  // --- INLINE FIELD VALIDATION (H5 & H9) ---
  function validatePhoneStr(phone) {
    var digits = String(phone || '').replace(/\D+/g, '');
    if (digits.length < 9 || digits.length > 11) {
      return { ok: false, msg: 'Số điện thoại gồm 9–11 chữ số (VD: 0912345678).' };
    }
    if (digits.charAt(0) !== '0' && digits.indexOf('84') !== 0) {
      return { ok: false, msg: 'Số điện thoại nên bắt đầu bằng 0 hoặc 84.' };
    }
    return { ok: true, msg: '' };
  }

  function setFieldValidationUI(inputId, ok, msg, forceShow) {
    var inp = $(inputId);
    if (!inp) return ok;
    var grp = inp.closest ? inp.closest('.ob-field-group') : null;
    if (!grp) return ok;
    var errEl = grp.querySelector('.ob-field-error');
    var touched = inp.getAttribute('data-touched') === '1' || forceShow;
    grp.classList.remove('ob-field-valid', 'ob-field-invalid');
    if (!touched && !strTrim(inp.value)) {
      if (errEl) errEl.textContent = '';
      return ok;
    }
    if (ok) {
      grp.classList.add('ob-field-valid');
      if (errEl) errEl.textContent = '';
    } else {
      grp.classList.add('ob-field-invalid');
      if (errEl) errEl.textContent = msg || '';
    }
    return ok;
  }

  function validateDeliveryForm(forceShow) {
    var name = strTrim($('obDelivName') ? $('obDelivName').value : activeDeliveryState.form.name);
    var phone = strTrim($('obDelivPhone') ? $('obDelivPhone').value : activeDeliveryState.form.phone);
    var addr = strTrim($('obDelivAddress') ? $('obDelivAddress').value : activeDeliveryState.form.address);

    var okName = name.length >= 2;
    var phoneRes = validatePhoneStr(phone);
    var okAddr = addr.length >= 5;

    setFieldValidationUI('obDelivName', okName, 'Vui lòng nhập họ tên người nhận (tối thiểu 2 ký tự).', forceShow);
    setFieldValidationUI('obDelivPhone', phoneRes.ok, phoneRes.msg, forceShow);
    setFieldValidationUI('obDelivAddress', okAddr, 'Vui lòng nhập địa chỉ giao cụ thể (tối thiểu 5 ký tự).', forceShow);

    var totals = computeDeliveryTotals();
    var hintEl = $('obDelivSubmitHint');
    if (hintEl) {
      var missing = [];
      if (totals.itemCount === 0) missing.push('chọn ít nhất 1 món');
      if (!okName) missing.push('tên người nhận');
      if (!phoneRes.ok) missing.push('SĐT hợp lệ');
      if (!okAddr) missing.push('địa chỉ giao');

      if (missing.length > 0) {
        hintEl.textContent = 'Cần bổ sung: ' + missing.join(', ') + '.';
        hintEl.className = 'ob-submit-hint is-warn';
      } else {
        hintEl.textContent = '✓ Thông tin đầy đủ • Nhấn Ctrl+Enter để đặt giao ngay.';
        hintEl.className = 'ob-submit-hint is-ready';
      }
    }

    return {
      ok: totals.itemCount > 0 && okName && phoneRes.ok && okAddr,
      okName: okName,
      okPhone: phoneRes.ok,
      okAddr: okAddr,
      totals: totals
    };
  }

  function validateReserveForm(forceShow) {
    var date = ($('obResDate') && $('obResDate').value) || activeReserveState.date || '';
    var name = strTrim($('obResName') ? $('obResName').value : activeReserveState.form.name);
    var phone = strTrim($('obResPhone') ? $('obResPhone').value : activeReserveState.form.phone);

    var okDate = Boolean(date) && date >= getTodayStr();
    var okName = name.length >= 2;
    var phoneRes = validatePhoneStr(phone);

    setFieldValidationUI('obResDate', okDate, 'Không thể chọn ngày đã qua.', forceShow);
    setFieldValidationUI('obResName', okName, 'Vui lòng nhập họ tên người đặt (tối thiểu 2 ký tự).', forceShow);
    setFieldValidationUI('obResPhone', phoneRes.ok, phoneRes.msg, forceShow);

    var slotAv = activeReserveState.restaurant && activeReserveState.timeSlot
      ? computeSlotAvailability(activeReserveState.restaurant.id, date, activeReserveState.timeSlot, getReservations(), new Date())
      : { status: 'past' };
    var okSlot = Boolean(activeReserveState.timeSlot) && slotAv.status !== 'past' && slotAv.status !== 'full' && slotAv.status !== 'closed_hours';

    var hintEl = $('obResSubmitHint');
    if (hintEl) {
      var missing = [];
      if (!okDate) missing.push('ngày hợp lệ');
      if (!okSlot) missing.push(slotAv.status === 'closed_hours' ? 'khung giờ quán mở cửa' : 'khung giờ còn bàn');
      if (!okName) missing.push('họ tên');
      if (!phoneRes.ok) missing.push('SĐT hợp lệ');
      if (missing.length > 0) {
        hintEl.textContent = 'Cần bổ sung: ' + missing.join(', ') + '.';
        hintEl.className = 'ob-submit-hint is-warn';
      } else {
        hintEl.textContent = '✓ Bàn sẵn sàng giữ chỗ • Nhấn Ctrl+Enter để xác nhận nhanh.';
        hintEl.className = 'ob-submit-hint is-ready';
      }
    }

    return {
      ok: okDate && okSlot && okName && phoneRes.ok,
      okDate: okDate,
      okSlot: okSlot,
      okName: okName,
      okPhone: phoneRes.ok
    };
  }

  // --- DELIVERY CALCULATION & VOUCHER COACH ---
  function computeDeliveryTotals() {
    var subtotal = 0;
    var itemCount = 0;
    var items = [];

    for (var i = 0; i < activeDeliveryState.menu.length; i++) {
      var m = activeDeliveryState.menu[i];
      var entry = activeDeliveryState.cart[m.id];
      if (entry && entry.qty > 0) {
        var lineTotal = m.price * entry.qty;
        subtotal += lineTotal;
        itemCount += entry.qty;
        items.push({
          id: m.id,
          name: m.name,
          price: m.price,
          qty: entry.qty,
          note: entry.note || '',
          lineTotal: lineTotal
        });
      }
    }

    var meta = getDeliveryMeta(activeDeliveryState.restaurant);
    var shipFee = itemCount > 0 ? meta.fee : 0;
    var discount = 0;
    var voucher = arrFind(VOUCHERS, function (v) { return v.code === activeDeliveryState.voucherCode; });

    if (voucher && itemCount > 0 && subtotal >= voucher.minSubtotal) {
      if (voucher.type === 'ship') {
        discount = Math.min(shipFee, voucher.value);
      } else if (voucher.type === 'flat') {
        discount = Math.min(subtotal, voucher.value);
      } else if (voucher.type === 'percent') {
        discount = Math.min(voucher.maxDiscount || 999999, Math.round((subtotal * voucher.value) / 100));
      }
    }

    var total = Math.max(0, subtotal + shipFee - discount);
    return {
      items: items,
      itemCount: itemCount,
      subtotal: subtotal,
      shipFee: shipFee,
      discount: discount,
      total: total,
      voucher: voucher,
      meta: meta
    };
  }

  function buildVoucherCoachHtml(totals) {
    var sub = totals.subtotal;
    var msg = '';
    var pct = 0;
    if (totals.itemCount === 0) {
      msg = 'Chọn món để mở khóa mã <strong>FREESHIP</strong> ngay!';
      pct = 0;
    } else if (sub < 100000) {
      msg = 'Thêm <strong>' + fmtVnd(100000 - sub) + '</strong> nữa để mở khóa mã <strong>PHOVI20</strong> (giảm 20k)!';
      pct = Math.min(99, Math.round((sub / 100000) * 100));
    } else if (sub < 150000) {
      msg = '🎉 Đã đủ <strong>PHOVI20</strong>! Thêm <strong>' + fmtVnd(150000 - sub) + '</strong> để mở khóa <strong>HANOI15</strong> (giảm đến 40k)!';
      pct = Math.min(99, Math.round((sub / 150000) * 100));
    } else {
      msg = '🏆 Tuyệt vời! Đơn đã đủ điều kiện dùng tất cả mã ưu đãi (tiết kiệm tốt nhất với <strong>HANOI15</strong>).';
      pct = 100;
    }
    return (
      '<div class="ob-voucher-coach">' +
        '<div class="ob-voucher-coach-text">' + msg + '</div>' +
        '<div class="ob-voucher-progress-track">' +
          '<div class="ob-voucher-progress-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildMenuListHtml() {
    var q = normalizeVi(activeDeliveryState.menuSearch);
    var filtered = [];
    for (var i = 0; i < activeDeliveryState.menu.length; i++) {
      var item = activeDeliveryState.menu[i];
      if (!q || normalizeVi(item.name).indexOf(q) !== -1 || normalizeVi(item.tag).indexOf(q) !== -1) {
        filtered.push(item);
      }
    }

    if (filtered.length === 0) {
      return (
        '<div class="ob-empty-hub" style="padding:20px 14px;">' +
          '<p style="margin:0 0 10px;">Không tìm thấy món phù hợp với "<strong>' + escHtml(activeDeliveryState.menuSearch) + '</strong>".</p>' +
          '<button type="button" id="btnClearMenuSearch" class="ob-btn-secondary">↺ Hiện tất cả món</button>' +
        '</div>'
      );
    }

    return filtered.map(function (item) {
      var cartItem = activeDeliveryState.cart[item.id];
      var qty = cartItem ? cartItem.qty : 0;
      var note = cartItem ? cartItem.note : '';

      return (
        '<div class="ob-menu-item ' + (qty > 0 ? 'in-cart' : '') + '" data-menu-item-id="' + escHtml(item.id) + '">' +
          '<div class="ob-menu-info">' +
            '<span class="ob-menu-tag">' + escHtml(item.tag) + '</span>' +
            '<div class="ob-menu-name">' + escHtml(item.name) + '</div>' +
            '<div class="ob-menu-price">' + fmtVnd(item.price) + '</div>' +
            (qty > 0
              ? '<input type="text" class="ob-item-note" data-note-id="' + escHtml(item.id) + '" value="' + escHtml(note) + '" placeholder="Ghi chú món (VD: không hành, ít cay...)" maxlength="80" />'
              : '') +
          '</div>' +
          '<div class="ob-menu-ctrl">' +
            (qty > 0
              ? '<div class="ob-qty-stepper">' +
                  '<button type="button" class="ob-qty-btn" data-cart-dec="' + escHtml(item.id) + '" aria-label="Giảm số lượng">−</button>' +
                  '<span class="ob-qty-val">' + qty + '</span>' +
                  '<button type="button" class="ob-qty-btn plus" data-cart-inc="' + escHtml(item.id) + '" aria-label="Tăng số lượng">+</button>' +
                '</div>'
              : '<button type="button" class="ob-add-btn" data-cart-inc="' + escHtml(item.id) + '">+ Thêm</button>') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function buildVouchersHtml(totals) {
    return VOUCHERS.map(function (v) {
      var eligible = totals.subtotal >= v.minSubtotal && totals.itemCount > 0;
      var selected = eligible && activeDeliveryState.voucherCode === v.code;
      return (
        '<button type="button" class="ob-voucher-chip ' + (selected ? 'active' : '') + (!eligible ? ' disabled' : '') + '" data-voucher="' + v.code + '">' +
          '<strong>🎟️ ' + v.code + '</strong>' +
          '<span>' + escHtml(v.title) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function buildSummaryCardHtml(totals) {
    return (
      '<div class="ob-sum-row"><span>Tạm tính (' + totals.itemCount + ' món)</span><strong>' + fmtVnd(totals.subtotal) + '</strong></div>' +
      '<div class="ob-sum-row"><span>Phí giao hàng (~' + totals.meta.distanceKm + ' km)</span><strong>' + fmtVnd(totals.shipFee) + '</strong></div>' +
      '<div class="ob-sum-row discount"><span>Giảm giá (' + (totals.discount > 0 && totals.voucher ? totals.voucher.code : 'Chưa áp dụng') + ')</span><strong>−' + fmtVnd(totals.discount) + '</strong></div>' +
      '<div class="ob-sum-total"><span>Tổng thanh toán</span><strong>' + fmtVnd(totals.total) + '</strong></div>' +
      '<div id="obDelivSubmitHint" class="ob-submit-hint"></div>' +
      '<button type="button" id="btnPlaceDeliveryOrder" class="ob-submit-delivery-btn" ' + (totals.itemCount === 0 ? 'disabled' : '') + '>' +
        '🛵 Đặt Giao Ngay • ' + fmtVnd(totals.total) +
      '</button>'
    );
  }

  function updateDraftBadgeUI() {
    var badge = $('obDraftBadge');
    if (!badge) return;
    var count = 0;
    var keys = Object.keys(activeDeliveryState.cart);
    for (var i = 0; i < keys.length; i++) {
      count += activeDeliveryState.cart[keys[i]].qty || 0;
    }
    if (count > 0) {
      badge.textContent = '📝 Nháp: ' + count + ' món';
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Targeted DOM updates (no focus loss, no scroll jump)
  function refreshDeliveryDynamicSections() {
    var totals = computeDeliveryTotals();
    var vList = $('obVoucherListContainer');
    if (vList) {
      vList.innerHTML = buildVouchersHtml(totals);
      bindVoucherListeners(vList);
    }
    var vCoach = $('obVoucherCoachContainer');
    if (vCoach) {
      vCoach.innerHTML = buildVoucherCoachHtml(totals);
    }
    var sumCard = $('obSummarySection');
    if (sumCard) {
      sumCard.innerHTML = buildSummaryCardHtml(totals);
      var placeBtn = $('btnPlaceDeliveryOrder');
      if (placeBtn) placeBtn.addEventListener('click', submitDeliveryOrder);
    }
    updateDraftBadgeUI();
    validateDeliveryForm(false);
  }

  function refreshMenuContainerOnly() {
    var listEl = $('obMenuListContainer');
    if (!listEl) return;
    listEl.innerHTML = buildMenuListHtml();
    bindMenuItemListeners(listEl);
    var clrSearch = $('btnClearMenuSearch');
    if (clrSearch) {
      clrSearch.addEventListener('click', function () {
        activeDeliveryState.menuSearch = '';
        if ($('obMenuSearch')) $('obMenuSearch').value = '';
        refreshMenuContainerOnly();
        if ($('obMenuSearch')) $('obMenuSearch').focus();
      });
    }
  }

  function updateSingleMenuRow(itemId, prevQty, newQty) {
    var row = document.querySelector('#obMenuListContainer [data-menu-item-id="' + itemId + '"]');
    if (!row) {
      refreshMenuContainerOnly();
      return;
    }
    var item = arrFind(activeDeliveryState.menu, function (m) { return m.id === itemId; });
    if (!item) return;

    if (newQty > 0) {
      row.classList.add('in-cart');
    } else {
      row.classList.remove('in-cart');
    }

    var ctrl = row.querySelector('.ob-menu-ctrl');
    var info = row.querySelector('.ob-menu-info');
    var existingNote = info ? info.querySelector('.ob-item-note') : null;

    if (prevQty > 0 && newQty > 0) {
      // Only update qty text so note input focus is 100% preserved!
      var valSpan = row.querySelector('.ob-qty-val');
      if (valSpan) valSpan.textContent = String(newQty);
      return;
    }

    if (newQty > 0 && prevQty === 0) {
      if (info && !existingNote) {
        var noteInp = document.createElement('input');
        noteInp.type = 'text';
        noteInp.className = 'ob-item-note';
        noteInp.setAttribute('data-note-id', itemId);
        noteInp.maxLength = 80;
        noteInp.placeholder = 'Ghi chú món (VD: không hành, ít cay...)';
        noteInp.value = (activeDeliveryState.cart[itemId] && activeDeliveryState.cart[itemId].note) || '';
        noteInp.addEventListener('input', function () {
          if (activeDeliveryState.cart[itemId]) {
            activeDeliveryState.cart[itemId].note = noteInp.value;
            if (activeDeliveryState.restaurant) saveRestaurantDraft(activeDeliveryState.restaurant.id);
          }
        });
        info.appendChild(noteInp);
      }
      if (ctrl) {
        ctrl.innerHTML =
          '<div class="ob-qty-stepper">' +
            '<button type="button" class="ob-qty-btn" data-cart-dec="' + escHtml(itemId) + '" aria-label="Giảm số lượng">−</button>' +
            '<span class="ob-qty-val">' + newQty + '</span>' +
            '<button type="button" class="ob-qty-btn plus" data-cart-inc="' + escHtml(itemId) + '" aria-label="Tăng số lượng">+</button>' +
          '</div>';
        bindMenuItemListeners(ctrl);
      }
    } else if (newQty === 0) {
      if (existingNote && existingNote.parentNode) {
        existingNote.parentNode.removeChild(existingNote);
      }
      if (ctrl) {
        ctrl.innerHTML = '<button type="button" class="ob-add-btn" data-cart-inc="' + escHtml(itemId) + '">+ Thêm</button>';
        bindMenuItemListeners(ctrl);
      }
    }
  }

  function handleCartIncrement(itemId) {
    var prevEntry = activeDeliveryState.cart[itemId];
    var prevQty = prevEntry ? prevEntry.qty : 0;
    if (!activeDeliveryState.cart[itemId]) {
      activeDeliveryState.cart[itemId] = { qty: 0, note: '' };
    }
    activeDeliveryState.cart[itemId].qty += 1;
    var newQty = activeDeliveryState.cart[itemId].qty;
    if (activeDeliveryState.restaurant) saveRestaurantDraft(activeDeliveryState.restaurant.id);
    updateSingleMenuRow(itemId, prevQty, newQty);
    refreshDeliveryDynamicSections();
  }

  function handleCartDecrement(itemId) {
    var prevEntry = activeDeliveryState.cart[itemId];
    if (!prevEntry) return;
    var prevQty = prevEntry.qty;
    var snapshotEntry = cloneShallow(prevEntry);
    var itemObj = arrFind(activeDeliveryState.menu, function (m) { return m.id === itemId; });
    var newQty = prevQty - 1;

    if (newQty <= 0) {
      delete activeDeliveryState.cart[itemId];
      newQty = 0;
      triggerUndo('Đã bỏ "' + (itemObj ? itemObj.name : 'món') + '" khỏi giỏ', function () {
        activeDeliveryState.cart[itemId] = snapshotEntry;
        if (activeDeliveryState.restaurant) saveRestaurantDraft(activeDeliveryState.restaurant.id);
        updateSingleMenuRow(itemId, 0, snapshotEntry.qty);
        refreshDeliveryDynamicSections();
      });
    } else {
      activeDeliveryState.cart[itemId].qty = newQty;
    }
    if (activeDeliveryState.restaurant) saveRestaurantDraft(activeDeliveryState.restaurant.id);
    updateSingleMenuRow(itemId, prevQty, newQty);
    refreshDeliveryDynamicSections();
  }

  function bindMenuItemListeners(root) {
    if (!root) return;
    var incs = root.querySelectorAll('[data-cart-inc]');
    for (var i = 0; i < incs.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          handleCartIncrement(btn.getAttribute('data-cart-inc'));
        });
      })(incs[i]);
    }
    var decs = root.querySelectorAll('[data-cart-dec]');
    for (var j = 0; j < decs.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          handleCartDecrement(btn.getAttribute('data-cart-dec'));
        });
      })(decs[j]);
    }
    var notes = root.querySelectorAll('[data-note-id]');
    for (var k = 0; k < notes.length; k++) {
      (function (inp) {
        inp.addEventListener('input', function () {
          var id = inp.getAttribute('data-note-id');
          if (activeDeliveryState.cart[id]) {
            activeDeliveryState.cart[id].note = inp.value;
            if (activeDeliveryState.restaurant) saveRestaurantDraft(activeDeliveryState.restaurant.id);
          }
        });
      })(notes[k]);
    }
  }

  function bindVoucherListeners(root) {
    if (!root) return;
    var btns = root.querySelectorAll('[data-voucher]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-voucher');
          var vObj = arrFind(VOUCHERS, function (v) { return v.code === code; });
          var curTotals = computeDeliveryTotals();
          if (vObj && (curTotals.itemCount === 0 || curTotals.subtotal < vObj.minSubtotal)) {
            showToast('Đơn từ ' + fmtVnd(vObj.minSubtotal) + ' mới áp dụng được mã ' + vObj.code + '!', '⚠️');
            return;
          }
          activeDeliveryState.voucherCode = (activeDeliveryState.voucherCode === code) ? '' : code;
          if (activeDeliveryState.restaurant) saveRestaurantDraft(activeDeliveryState.restaurant.id);
          refreshDeliveryDynamicSections();
        });
      })(btns[i]);
    }
  }

  // --- OPEN DELIVERY MODAL ---
  function captureDeliveryForm() {
    if ($('obDelivName')) activeDeliveryState.form.name = $('obDelivName').value;
    if ($('obDelivPhone')) activeDeliveryState.form.phone = $('obDelivPhone').value;
    if ($('obDelivAddress')) activeDeliveryState.form.address = $('obDelivAddress').value;
    if ($('obDelivDriverNote')) activeDeliveryState.form.driverNote = $('obDelivDriverNote').value;
  }

  function openDelivery(restaurantId, presetItems, presetCustomer) {
    var restaurant = findRestaurantById(restaurantId);
    if (!restaurant) return;

    var prof = getSavedProfile();
    var draft = (!presetItems || !presetItems.length) ? loadRestaurantDraft(restaurant.id) : null;

    activeDeliveryState.restaurant = restaurant;
    activeDeliveryState.menu = buildMenuForRestaurant(restaurant);
    activeDeliveryState.cart = {};
    activeDeliveryState.menuSearch = '';
    activeDeliveryState.helpOpen = false;
    activeDeliveryState.confirmClearOpen = false;
    activeDeliveryState.restoredDraft = false;
    activeDeliveryState.trackingOrderId = null;
    activeDeliveryState.selectedAddressId = prof.addressId || '';
    activeDeliveryState.saveAddressToBook = true;
    activeDeliveryState.saveAddressLabel = 'home';
    activeDeliveryState.saveAddressCustomLabel = '';

    if (Array.isArray(presetItems) && presetItems.length) {
      for (var i = 0; i < presetItems.length; i++) {
        var it = presetItems[i];
        if (arrSome(activeDeliveryState.menu, function (m) { return m.id === it.id; })) {
          activeDeliveryState.cart[it.id] = { qty: Math.max(1, it.qty || 1), note: it.note || '' };
        }
      }
      activeDeliveryState.voucherCode = 'FREESHIP';
      activeDeliveryState.paymentMethod = 'cod';
      activeDeliveryState.form = {
        name: (presetCustomer && presetCustomer.name) || prof.name || '',
        phone: (presetCustomer && presetCustomer.phone) || prof.phone || '',
        address: (presetCustomer && presetCustomer.address) || prof.address || '',
        driverNote: (presetCustomer && presetCustomer.driverNote) || prof.driverNote || ''
      };
    } else if (draft && draft.cart && Object.keys(draft.cart).length > 0) {
      activeDeliveryState.cart = cloneShallow(draft.cart);
      activeDeliveryState.voucherCode = draft.voucherCode !== undefined ? draft.voucherCode : 'FREESHIP';
      activeDeliveryState.paymentMethod = draft.paymentMethod || 'cod';
      activeDeliveryState.restoredDraft = true;
      activeDeliveryState.form = {
        name: (draft.form && draft.form.name) || prof.name || '',
        phone: (draft.form && draft.form.phone) || prof.phone || '',
        address: (draft.form && draft.form.address) || prof.address || '',
        driverNote: (draft.form && draft.form.driverNote) || prof.driverNote || ''
      };
    } else {
      if (activeDeliveryState.menu.length > 0) {
        activeDeliveryState.cart[activeDeliveryState.menu[0].id] = { qty: 1, note: '' };
      }
      activeDeliveryState.voucherCode = 'FREESHIP';
      activeDeliveryState.paymentMethod = 'cod';
      activeDeliveryState.form = {
        name: prof.name || '',
        phone: prof.phone || '',
        address: prof.address || '',
        driverNote: prof.driverNote || ''
      };
    }

    renderDeliveryModal();
    var modal = $('deliveryModal');
    if (modal) modal.classList.add('open');
  }

  function formatAddressLabelBadge(addr) {
    var meta = ADDR_LABELS[addr.label] || ADDR_LABELS.other;
    if (addr.label === 'other' && addr.customLabel) {
      return meta.icon + ' ' + addr.customLabel;
    }
    return meta.icon + ' ' + meta.text;
  }

  function buildAddressBookBarHtml() {
    var addrs = getSavedAddresses();
    var curUser = getCurrentUserObj();
    var scopeNote = curUser && curUser.email
      ? 'Sổ địa chỉ (' + escHtml(curUser.fullName || curUser.email) + ')'
      : 'Địa chỉ đã lưu trên thiết bị';

    var chipsHtml = '';
    if (addrs.length > 0) {
      chipsHtml = '<div class="ob-addr-chips">' +
        addrs.slice(0, 6).map(function (a) {
          var isSelected = activeDeliveryState.selectedAddressId === a.id ||
            (normalizeAddressKey(a.address) === normalizeAddressKey(activeDeliveryState.form.address) && normalizeAddressKey(a.address) !== '');
          return (
            '<button type="button" class="ob-addr-chip ' + (isSelected ? 'active' : '') + '" data-pick-addr="' + escHtml(a.id) + '">' +
              '<span class="ob-addr-chip-tag">' + escHtml(formatAddressLabelBadge(a)) + (a.isDefault ? ' ⭐' : '') + '</span>' +
              '<span class="ob-addr-chip-text">' + escHtml(a.address) + '</span>' +
              '<span class="ob-addr-chip-meta">' +
                escHtml((a.district ? a.district + ' • ' : '') + (a.recipientName || '') + (a.phone ? ' (' + a.phone + ')' : '')) +
              '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>';
    } else {
      chipsHtml = '<div class="ob-addr-chip-meta" style="font-size:0.8rem;">Chưa có địa chỉ đã lưu. Đơn hàng đầu tiên sẽ tự động lưu lại để lần sau đặt 1 chạm!</div>';
    }

    return (
      '<div class="ob-addr-book-bar">' +
        '<div class="ob-addr-book-head">' +
          '<span>📚 ' + scopeNote + ' (' + addrs.length + ')</span>' +
          '<button type="button" id="btnManageSavedAddresses" class="ob-btn-ghost">⚙️ Quản lý sổ địa chỉ</button>' +
        '</div>' +
        chipsHtml +
      '</div>'
    );
  }

  function renderDeliveryModal() {
    var container = $('deliveryModalContent');
    var restaurant = activeDeliveryState.restaurant;
    if (!container || !restaurant) return;

    if (activeDeliveryState.trackingOrderId) {
      renderTrackingView(container, activeDeliveryState.trackingOrderId);
      return;
    }

    captureDeliveryForm();
    var totals = computeDeliveryTotals();
    var form = activeDeliveryState.form;
    var detectedDist = detectDistrictFromAddress(form.address);

    var paymentHtml = PAYMENT_METHODS.map(function (pm) {
      return '<option value="' + pm.id + '"' + (activeDeliveryState.paymentMethod === pm.id ? ' selected' : '') + '>' + escHtml(pm.label) + '</option>';
    }).join('');

    var quickNoteChipsHtml = QUICK_DRIVER_NOTES.map(function (noteText) {
      var isAct = form.driverNote && form.driverNote.indexOf(noteText) !== -1;
      return '<button type="button" class="ob-quick-chip ' + (isAct ? 'active' : '') + '" data-quick-note="' + escHtml(noteText) + '">+ ' + escHtml(noteText) + '</button>';
    }).join('');

    var labelPillsHtml = ['home', 'work', 'other'].map(function (lbl) {
      var meta = ADDR_LABELS[lbl];
      return '<button type="button" class="ob-addr-label-pill ' + (activeDeliveryState.saveAddressLabel === lbl ? 'active' : '') + '" data-save-addr-label="' + lbl + '">' + meta.icon + ' ' + meta.text + '</button>';
    }).join('');

    var hoursApi = getHoursApi();
    var hoursCtx = getSelectedHoursContext();
    var isClosedNow = Boolean(hoursApi && typeof hoursApi.isOpenAtMinutes === 'function' && !hoursApi.isOpenAtMinutes(restaurant, hoursCtx.minutes, hoursCtx.dayOfWeek));
    var closedBannerHtml = isClosedNow
      ? buildClosedAlternativesHtml(restaurant, {
          targetMinutes: hoursCtx.minutes,
          targetDayOfWeek: hoursCtx.dayOfWeek,
          timeLabel: hoursCtx.timeLabel,
          requireReservable: false,
          titleText: '🔴 Quán đang đóng cửa lúc ' + hoursCtx.timeLabel,
          subText: 'Giờ mở cửa của ' + restaurant.name + ': ' + (restaurant.openingHours || 'Chưa cập nhật') + '.'
        })
      : '';

    container.innerHTML =
      '<div class="ob-deliv-header">' +
        '<div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">' +
          '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">' +
            '<span class="ob-deliv-brand-pill" style="margin-bottom:0;">🛵 PHỐ VỊ DELIVERY • GIAO NHANH</span>' +
            '<span class="ob-live-sync-pill"><span class="ob-live-dot"></span><span class="ob-live-clock" data-rt-clock>' + formatTimeHMS(new Date()) + '</span></span>' +
            '<span id="obDraftBadge" class="ob-draft-badge" style="display:' + (totals.itemCount > 0 ? 'inline-flex' : 'none') + ';">📝 Nháp: ' + totals.itemCount + ' món</span>' +
          '</div>' +
          '<button type="button" id="btnToggleDelivHelp" class="ob-help-toggle" aria-expanded="' + (activeDeliveryState.helpOpen ? 'true' : 'false') + '">❓ Hướng dẫn &amp; Phím tắt</button>' +
        '</div>' +
        '<div id="obDelivHelpDrawer" class="ob-help-drawer ' + (activeDeliveryState.helpOpen ? 'open' : '') + '">' +
          '<ul class="ob-help-list">' +
            '<li><strong>Lưu nháp tự động:</strong> Giỏ hàng được lưu nháp theo quán để không mất món khi lỡ đóng hộp thoại.</li>' +
            '<li><strong>Hủy đơn an toàn:</strong> Miễn phí hủy khi quán đang nhận hoặc chế biến món (2 bước đầu); nhấn nút Hủy có xác nhận tại chỗ &amp; hoàn tác trong 6 giây.</li>' +
            '<li><strong>Sổ địa chỉ theo tài khoản:</strong> Tích chọn lưu địa chỉ để lần sau chọn 1 chạm; hỗ trợ tối đa 20 địa chỉ.</li>' +
            '<li><strong>Phím tắt nhanh:</strong> Nhấn <code>Ctrl + Enter</code> để đặt đơn nhanh, <code>Esc</code> để đóng cửa sổ.</li>' +
          '</ul>' +
        '</div>' +
        '<h2 id="deliveryModalTitle">' + escHtml(restaurant.name) + '</h2>' +
        '<div class="ob-deliv-meta">' +
          '<span>⭐ ' + restaurant.rating + ' (' + (restaurant.reviews ? restaurant.reviews.toLocaleString() : '0') + ')</span>' +
          '<span>•</span>' +
          '<span>📍 ' + escHtml(restaurant.district) + ' (~' + totals.meta.distanceKm + ' km)</span>' +
          '<span>•</span>' +
          '<span>⏱️ Giao dự kiến ' + totals.meta.etaMin + ' - ' + totals.meta.etaMax + ' phút</span>' +
        '</div>' +
      '</div>' +

      closedBannerHtml +

      '<div class="ob-deliv-grid">' +
        '<div class="ob-menu-col">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">' +
            '<h3 class="ob-sec-title" style="margin:0;">🍽️ Thực đơn giao tận nơi</h3>' +
            '<div id="obClearCartWrap">' +
              (activeDeliveryState.confirmClearOpen
                ? '<div class="ob-confirm-inline"><span>Xóa hết giỏ?</span><button type="button" id="btnConfirmClearCart" class="ob-btn-danger">Xóa</button><button type="button" id="btnCancelClearCart" class="ob-btn-ghost">Không</button></div>'
                : '<button type="button" id="btnClearCart" class="ob-btn-ghost">🗑️ Xóa giỏ</button>') +
            '</div>' +
          '</div>' +
          '<div class="ob-menu-search-wrap">' +
            '<input type="search" id="obMenuSearch" class="ob-menu-search-input" value="' + escHtml(activeDeliveryState.menuSearch) + '" placeholder="🔍 Tìm nhanh món trong thực đơn..." autocomplete="off" />' +
          '</div>' +
          '<div id="obMenuListContainer" class="ob-menu-list">' + buildMenuListHtml() + '</div>' +
        '</div>' +

        '<div class="ob-checkout-col">' +
          '<div class="ob-card">' +
            '<h3 class="ob-sec-title">📍 Thông tin nhận hàng</h3>' +
            buildAddressBookBarHtml() +
            '<div class="ob-form-grid">' +
              '<label class="ob-field ob-field-group">' +
                '<span>Người nhận *</span>' +
                '<input type="text" id="obDelivName" value="' + escHtml(form.name) + '" placeholder="Họ tên người nhận" required />' +
                '<span class="ob-field-error"></span>' +
              '</label>' +
              '<label class="ob-field ob-field-group">' +
                '<span>Số điện thoại *</span>' +
                '<input type="tel" id="obDelivPhone" value="' + escHtml(form.phone) + '" placeholder="09xx xxx xxx" required />' +
                '<span class="ob-field-error"></span>' +
              '</label>' +
            '</div>' +
            '<label class="ob-field ob-field-group">' +
              '<span>Địa chỉ giao tận nơi (Hà Nội) * <em id="obDelivDistrictHint" style="font-weight:500; opacity:0.85;">' + (detectedDist ? '• Quận ' + escHtml(detectedDist) : '') + '</em></span>' +
              '<input type="text" id="obDelivAddress" value="' + escHtml(form.address) + '" placeholder="Số nhà, ngõ/phố, phường, quận..." required />' +
              '<span class="ob-field-error"></span>' +
            '</label>' +
            '<div class="ob-addr-save-row">' +
              '<label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.83rem; font-weight:600;">' +
                '<input type="checkbox" id="obSaveAddressCheck" ' + (activeDeliveryState.saveAddressToBook ? 'checked' : '') + ' />' +
                '<span>💾 Lưu địa chỉ này vào Sổ địa chỉ</span>' +
              '</label>' +
              '<div class="ob-addr-label-pills" id="obSaveAddrLabelPills" style="display:' + (activeDeliveryState.saveAddressToBook ? 'flex' : 'none') + ';">' +
                labelPillsHtml +
              '</div>' +
              '<input type="text" id="obDelivCustomLabel" value="' + escHtml(activeDeliveryState.saveAddressCustomLabel) + '" placeholder="Tên nhãn (VD: Nhà bạn, Ký túc xá...)" maxlength="30" style="display:' + (activeDeliveryState.saveAddressToBook && activeDeliveryState.saveAddressLabel === 'other' ? 'block' : 'none') + '; margin-top:6px; padding:6px 9px; font-size:0.82rem; border-radius:6px; border:1px solid #d7c4a5; width:100%;" />' +
            '</div>' +
            '<label class="ob-field">' +
              '<span>Ghi chú cho tài xế</span>' +
              '<input type="text" id="obDelivDriverNote" value="' + escHtml(form.driverNote) + '" placeholder="VD: Gọi khi đến cổng, lấy thêm đũa thìa..." />' +
            '</label>' +
            '<div class="ob-quick-chips" id="obDelivQuickNotes">' + quickNoteChipsHtml + '</div>' +
          '</div>' +

          '<div class="ob-card">' +
            '<h3 class="ob-sec-title">🎟️ Mã ưu đãi &amp; Thanh toán</h3>' +
            '<div id="obVoucherCoachContainer">' + buildVoucherCoachHtml(totals) + '</div>' +
            '<div id="obVoucherListContainer" class="ob-voucher-list">' + buildVouchersHtml(totals) + '</div>' +
            '<label class="ob-field" style="margin-top:10px;">' +
              '<span>Phương thức thanh toán</span>' +
              '<select id="obDelivPayment">' + paymentHtml + '</select>' +
            '</label>' +
          '</div>' +

          '<div id="obSummarySection" class="ob-card ob-summary-card">' +
            buildSummaryCardHtml(totals) +
          '</div>' +
        '</div>' +
      '</div>';

    // Bind Help Drawer
    if (isClosedNow) {
      bindClosedAlternativesListeners(container, 'deliveryModal', hoursCtx.minutes, null);
    }
    var helpBtn = $('btnToggleDelivHelp');
    if (helpBtn) {
      helpBtn.addEventListener('click', function () {
        activeDeliveryState.helpOpen = !activeDeliveryState.helpOpen;
        var drawer = $('obDelivHelpDrawer');
        if (drawer) drawer.classList.toggle('open', activeDeliveryState.helpOpen);
        helpBtn.setAttribute('aria-expanded', activeDeliveryState.helpOpen ? 'true' : 'false');
      });
    }

    // Bind Clear Cart with Inline Confirm & Undo
    function bindClearCartHandlers() {
      var clrBtn = $('btnClearCart');
      if (clrBtn) {
        clrBtn.addEventListener('click', function () {
          if (Object.keys(activeDeliveryState.cart).length === 0) {
            showToast('Giỏ hàng hiện đang trống.', 'ℹ️');
            return;
          }
          activeDeliveryState.confirmClearOpen = true;
          var wrap = $('obClearCartWrap');
          if (wrap) {
            wrap.innerHTML = '<div class="ob-confirm-inline"><span>Xóa hết giỏ?</span><button type="button" id="btnConfirmClearCart" class="ob-btn-danger">Xóa</button><button type="button" id="btnCancelClearCart" class="ob-btn-ghost">Không</button></div>';
            bindClearCartHandlers();
          }
        });
      }
      var confClr = $('btnConfirmClearCart');
      if (confClr) {
        confClr.addEventListener('click', function () {
          var prevCart = cloneShallow(activeDeliveryState.cart);
          activeDeliveryState.cart = {};
          activeDeliveryState.confirmClearOpen = false;
          saveRestaurantDraft(restaurant.id);
          refreshMenuContainerOnly();
          refreshDeliveryDynamicSections();
          var wrap = $('obClearCartWrap');
          if (wrap) {
            wrap.innerHTML = '<button type="button" id="btnClearCart" class="ob-btn-ghost">🗑️ Xóa giỏ</button>';
            bindClearCartHandlers();
          }
          triggerUndo('Đã xóa toàn bộ giỏ hàng', function () {
            activeDeliveryState.cart = prevCart;
            saveRestaurantDraft(restaurant.id);
            refreshMenuContainerOnly();
            refreshDeliveryDynamicSections();
          });
        });
      }
      var cancelClr = $('btnCancelClearCart');
      if (cancelClr) {
        cancelClr.addEventListener('click', function () {
          activeDeliveryState.confirmClearOpen = false;
          var wrap = $('obClearCartWrap');
          if (wrap) {
            wrap.innerHTML = '<button type="button" id="btnClearCart" class="ob-btn-ghost">🗑️ Xóa giỏ</button>';
            bindClearCartHandlers();
          }
        });
      }
    }
    bindClearCartHandlers();

    // Bind Menu Search (no focus loss)
    var menuSearchInp = $('obMenuSearch');
    if (menuSearchInp) {
      menuSearchInp.addEventListener('input', function () {
        activeDeliveryState.menuSearch = menuSearchInp.value;
        refreshMenuContainerOnly();
      });
    }

    // Bind menu items & vouchers
    bindMenuItemListeners($('obMenuListContainer'));
    bindVoucherListeners($('obVoucherListContainer'));

    // Bind Saved Address chips
    var addrChips = container.querySelectorAll('[data-pick-addr]');
    for (var ac = 0; ac < addrChips.length; ac++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          var aid = chip.getAttribute('data-pick-addr');
          var addrObj = arrFind(getSavedAddresses(), function (x) { return x.id === aid; });
          if (!addrObj) return;
          activeDeliveryState.selectedAddressId = aid;
          activeDeliveryState.form.name = addrObj.recipientName || activeDeliveryState.form.name;
          activeDeliveryState.form.phone = addrObj.phone || activeDeliveryState.form.phone;
          activeDeliveryState.form.address = addrObj.address || '';
          if (addrObj.driverNote) activeDeliveryState.form.driverNote = addrObj.driverNote;

          if ($('obDelivName')) $('obDelivName').value = activeDeliveryState.form.name;
          if ($('obDelivPhone')) $('obDelivPhone').value = activeDeliveryState.form.phone;
          if ($('obDelivAddress')) $('obDelivAddress').value = activeDeliveryState.form.address;
          if ($('obDelivDriverNote')) $('obDelivDriverNote').value = activeDeliveryState.form.driverNote;

          var allChips = container.querySelectorAll('[data-pick-addr]');
          for (var c2 = 0; c2 < allChips.length; c2++) {
            allChips[c2].classList.toggle('active', allChips[c2] === chip);
          }
          var distHint = $('obDelivDistrictHint');
          if (distHint) {
            var d = addrObj.district || detectDistrictFromAddress(addrObj.address);
            distHint.textContent = d ? '• Quận ' + d : '';
          }
          saveRestaurantDraft(restaurant.id);
          validateDeliveryForm(false);
          showToast('Đã điền địa chỉ: ' + formatAddressLabelBadge(addrObj), '📍');
        });
      })(addrChips[ac]);
    }

    var manageAddrBtn = $('btnManageSavedAddresses');
    if (manageAddrBtn) {
      manageAddrBtn.addEventListener('click', function () {
        $('deliveryModal').classList.remove('open');
        openOrdersHub('addresses');
      });
    }

    // Bind Save-Address checkbox & label pills
    var saveAddrChk = $('obSaveAddressCheck');
    if (saveAddrChk) {
      saveAddrChk.addEventListener('change', function () {
        activeDeliveryState.saveAddressToBook = saveAddrChk.checked;
        var pillsWrap = $('obSaveAddrLabelPills');
        if (pillsWrap) pillsWrap.style.display = saveAddrChk.checked ? 'flex' : 'none';
        var customInp = $('obDelivCustomLabel');
        if (customInp) customInp.style.display = (saveAddrChk.checked && activeDeliveryState.saveAddressLabel === 'other') ? 'block' : 'none';
      });
    }

    var labelPills = container.querySelectorAll('[data-save-addr-label]');
    for (var lp = 0; lp < labelPills.length; lp++) {
      (function (pill) {
        pill.addEventListener('click', function () {
          var lbl = pill.getAttribute('data-save-addr-label');
          activeDeliveryState.saveAddressLabel = lbl;
          var allPills = container.querySelectorAll('[data-save-addr-label]');
          for (var x = 0; x < allPills.length; x++) {
            allPills[x].classList.toggle('active', allPills[x] === pill);
          }
          var customInp = $('obDelivCustomLabel');
          if (customInp) customInp.style.display = (lbl === 'other' && activeDeliveryState.saveAddressToBook) ? 'block' : 'none';
        });
      })(labelPills[lp]);
    }

    if ($('obDelivCustomLabel')) {
      $('obDelivCustomLabel').addEventListener('input', function (e) {
        activeDeliveryState.saveAddressCustomLabel = e.target.value;
      });
    }

    // Bind quick driver notes
    var qNotes = container.querySelectorAll('[data-quick-note]');
    for (var qn = 0; qn < qNotes.length; qn++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var phrase = btn.getAttribute('data-quick-note');
          var noteInp = $('obDelivDriverNote');
          var cur = strTrim(noteInp ? noteInp.value : activeDeliveryState.form.driverNote);
          if (cur.indexOf(phrase) !== -1) {
            cur = strTrim(cur.replace(phrase, '').replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, ''));
            btn.classList.remove('active');
          } else {
            cur = cur ? (cur + ', ' + phrase) : phrase;
            btn.classList.add('active');
          }
          activeDeliveryState.form.driverNote = cur;
          if (noteInp) noteInp.value = cur;
          saveRestaurantDraft(restaurant.id);
        });
      })(qNotes[qn]);
    }

    // Bind form inputs with inline validation
    function bindFormInput(id, key, onExtra) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function () {
        el.setAttribute('data-touched', '1');
        activeDeliveryState.form[key] = el.value;
        if (onExtra) onExtra(el.value);
        saveRestaurantDraft(restaurant.id);
        validateDeliveryForm(false);
      });
      el.addEventListener('blur', function () {
        el.setAttribute('data-touched', '1');
        validateDeliveryForm(false);
      });
    }
    bindFormInput('obDelivName', 'name');
    bindFormInput('obDelivPhone', 'phone');
    bindFormInput('obDelivAddress', 'address', function (val) {
      var distHint = $('obDelivDistrictHint');
      if (distHint) {
        var d = detectDistrictFromAddress(val);
        distHint.textContent = d ? '• Quận ' + d : '';
      }
      var allChips = container.querySelectorAll('[data-pick-addr]');
      var norm = normalizeAddressKey(val);
      for (var c = 0; c < allChips.length; c++) {
        var aid = allChips[c].getAttribute('data-pick-addr');
        var aObj = arrFind(getSavedAddresses(), function (x) { return x.id === aid; });
        allChips[c].classList.toggle('active', Boolean(aObj && norm && normalizeAddressKey(aObj.address) === norm));
      }
    });
    if ($('obDelivDriverNote')) {
      $('obDelivDriverNote').addEventListener('input', function (e) {
        activeDeliveryState.form.driverNote = e.target.value;
        saveRestaurantDraft(restaurant.id);
      });
    }

    var paySel = $('obDelivPayment');
    if (paySel) {
      paySel.addEventListener('change', function () {
        activeDeliveryState.paymentMethod = paySel.value;
        saveRestaurantDraft(restaurant.id);
      });
    }

    var placeBtn = $('btnPlaceDeliveryOrder');
    if (placeBtn) {
      placeBtn.addEventListener('click', submitDeliveryOrder);
    }

    validateDeliveryForm(false);
  }

  function submitDeliveryOrder() {
    var check = validateDeliveryForm(true);
    var totals = check.totals;

    if (totals.itemCount === 0) {
      showToast('Vui lòng chọn ít nhất 1 món ăn!', '⚠️');
      return;
    }
    if (!check.okName) {
      showToast('Vui lòng nhập họ tên người nhận!', '⚠️');
      if ($('obDelivName')) $('obDelivName').focus();
      return;
    }
    if (!check.okPhone) {
      showToast('Số điện thoại chưa hợp lệ (9–11 số)!', '⚠️');
      if ($('obDelivPhone')) $('obDelivPhone').focus();
      return;
    }
    if (!check.okAddr) {
      showToast('Vui lòng nhập địa chỉ giao hàng cụ thể!', '⚠️');
      if ($('obDelivAddress')) $('obDelivAddress').focus();
      return;
    }

    var name = strTrim($('obDelivName') ? $('obDelivName').value : activeDeliveryState.form.name);
    var phone = strTrim($('obDelivPhone') ? $('obDelivPhone').value : activeDeliveryState.form.phone);
    var address = strTrim($('obDelivAddress') ? $('obDelivAddress').value : activeDeliveryState.form.address);
    var driverNote = strTrim($('obDelivDriverNote') ? $('obDelivDriverNote').value : activeDeliveryState.form.driverNote);

    saveProfile(name, phone, address);

    // Save or update usage in per-account Saved Address Book
    var shouldSave = $('obSaveAddressCheck') ? $('obSaveAddressCheck').checked : activeDeliveryState.saveAddressToBook;
    if (shouldSave) {
      saveAddress({
        label: activeDeliveryState.saveAddressLabel || 'home',
        customLabel: activeDeliveryState.saveAddressCustomLabel || '',
        recipientName: name,
        phone: phone,
        address: address,
        district: detectDistrictFromAddress(address),
        driverNote: driverNote,
        incrementUse: true
      });
    }

    var restaurant = activeDeliveryState.restaurant;
    var driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
    var payObj = arrFind(PAYMENT_METHODS, function (p) { return p.id === activeDeliveryState.paymentMethod; }) || PAYMENT_METHODS[0];
    var orderId = 'SF-' + String(Math.floor(100000 + Math.random() * 900000));
    var nowMs = Date.now();

    var order = {
      id: orderId,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      district: restaurant.district,
      deliveryDistrict: detectDistrictFromAddress(address) || restaurant.district,
      items: totals.items,
      subtotal: totals.subtotal,
      shipFee: totals.shipFee,
      discount: totals.discount,
      voucherCode: totals.discount > 0 ? activeDeliveryState.voucherCode : '',
      total: totals.total,
      paymentLabel: payObj.label,
      customerName: name,
      customerPhone: phone,
      deliveryAddress: address,
      driverNote: driverNote,
      driver: driver,
      etaMin: totals.meta.etaMin,
      etaMax: totals.meta.etaMax,
      statusStep: 0,
      stageSchedule: DEFAULT_STAGE_SCHEDULE.slice(),
      createdAtMs: nowMs,
      createdAt: new Date(nowMs).toISOString(),
      cancelled: false
    };

    var orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);
    clearRestaurantDraft(restaurant.id);

    activeDeliveryState.trackingOrderId = orderId;
    lastRenderedTrackStep = 0;
    showToast('Đặt đơn ' + orderId + ' thành công! Tài xế đang nhận đơn.', '🛵');
    renderDeliveryModal();
  }

  function advanceOrderStep(orderId) {
    var list = getOrders();
    var idx = arrFindIndex(list, function (o) { return o.id === orderId; });
    if (idx === -1 || list[idx].cancelled) return;

    var order = list[idx];
    var nowMs = Date.now();
    var live = computeOrderLiveState(order, nowMs);
    if (live.statusIndex >= 3) return;

    var nextStep = live.statusIndex + 1;
    var createdMs = order.createdAtMs || (order.createdAt ? Date.parse(order.createdAt) : nowMs);
    if (isNaN(createdMs)) createdMs = nowMs;
    var elapsedSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));

    var baseSched = (Array.isArray(order.stageSchedule) && order.stageSchedule.length === 4)
      ? order.stageSchedule.slice()
      : DEFAULT_STAGE_SCHEDULE.slice();

    // Shift schedule so nextStep is active immediately while keeping remaining countdown realistic
    var prevStageAtNext = Number(baseSched[nextStep]) || 0;
    var delta = Math.max(0, prevStageAtNext - elapsedSec);
    for (var i = nextStep; i < 4; i++) {
      baseSched[i] = Math.max(0, Math.round((Number(baseSched[i]) || 0) - delta));
    }
    baseSched[nextStep] = Math.min(baseSched[nextStep], elapsedSec);

    order.stageSchedule = baseSched;
    order.statusStep = nextStep;
    saveOrders(list);
    if (activeDeliveryState.trackingOrderId === orderId && $('deliveryModal') && $('deliveryModal').classList.contains('open')) {
      renderDeliveryModal();
    }
  }

  function renderTrackingView(container, orderId) {
    var orders = getOrders();
    var order = arrFind(orders, function (o) { return o.id === orderId; });
    if (!order) {
      activeDeliveryState.trackingOrderId = null;
      renderDeliveryModal();
      return;
    }

    var live = computeOrderLiveState(order, Date.now());
    lastRenderedTrackStep = live.statusIndex;

    var stepsHtml = ORDER_STEPS.map(function (st, idx) {
      var done = !live.cancelled && live.statusIndex >= st.key;
      var current = !live.cancelled && live.statusIndex === st.key;
      return (
        '<div class="ob-track-step ' + (done ? 'done' : '') + (current ? ' current' : '') + '" data-step-idx="' + idx + '">' +
          '<div class="ob-track-dot">' + st.icon + '</div>' +
          '<div class="ob-track-label">' + escHtml(st.label) + '</div>' +
          '<div class="ob-rt-step-time">' + escHtml(live.stageTimes[idx] || '') + '</div>' +
        '</div>'
      );
    }).join('');

    var itemsHtml = (order.items || []).map(function (it) {
      return (
        '<div class="ob-track-item">' +
          '<span><strong>' + it.qty + 'x</strong> ' + escHtml(it.name) + (it.note ? ' <em>(' + escHtml(it.note) + ')</em>' : '') + '</span>' +
          '<span>' + fmtVnd(it.lineTotal) + '</span>' +
        '</div>'
      );
    }).join('');

    container.innerHTML =
      '<div class="ob-track-box" data-rt-order-id="' + escHtml(order.id) + '">' +
        '<div style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; margin-bottom:8px;">' +
          '<div class="ob-track-badge" style="margin-bottom:0;">' + (live.cancelled ? '❌ ĐÃ HỦY ĐƠN' : '🛵 THEO DÕI ĐƠN HÀNG TRỰC TIẾP') + '</div>' +
          '<span class="ob-rt-eta-pill">' + escHtml(live.etaText) + '</span>' +
          '<span class="ob-live-clock" data-rt-clock>' + formatTimeHMS(new Date()) + '</span>' +
        '</div>' +
        '<h2>Đơn hàng ' + escHtml(order.id) + '</h2>' +
        '<p class="ob-track-sub">' + escHtml(order.restaurantName) + ' → ' + escHtml(order.deliveryAddress) + '</p>' +
        (!live.cancelled
          ? '<div class="ob-rt-progress-wrap">' +
              '<div class="ob-rt-progress-track"><div class="ob-rt-progress-fill" style="width:' + live.progressPct + '%"></div></div>' +
            '</div>' +
            '<div class="ob-track-stepper">' + stepsHtml + '</div>' +
            '<div class="ob-driver-card">' +
              '<div class="ob-driver-avatar">🛵</div>' +
              '<div class="ob-driver-info">' +
                '<strong>Tài xế: ' + escHtml(order.driver.name) + ' • ⭐ ' + escHtml(order.driver.rating) + '</strong>' +
                '<span>Biển số: ' + escHtml(order.driver.plate) + ' • SĐT: ' + escHtml(order.driver.phone) + '</span>' +
                '<span>⏱️ Dự kiến chuẩn: ' + order.etaMin + ' - ' + order.etaMax + ' phút</span>' +
              '</div>' +
            '</div>'
          : '') +
        '<div class="ob-card" style="text-align:left; margin-top:14px;">' +
          '<h3 class="ob-sec-title">🧾 Chi tiết món đã đặt</h3>' +
          itemsHtml +
          '<div class="ob-sum-total" style="margin-top:10px; padding-top:10px; border-top:1px dashed #d6c5ab;">' +
            '<span>Tổng thanh toán (' + escHtml(order.paymentLabel) + ')</span>' +
            '<strong>' + fmtVnd(order.total) + '</strong>' +
          '</div>' +
        '</div>' +
        '<div class="ob-track-actions" id="obTrackActions">' +
          (!live.cancelled && !live.isCompleted
            ? '<button type="button" class="ob-btn-secondary" id="btnSimNextStep">⏩ Mô phỏng bước tiếp</button>'
            : '') +
          (live.canEditOrCancel
            ? '<span id="obTrackCancelWrap"><button type="button" class="ob-btn-danger" id="btnCancelActiveOrder">✕ Hủy đơn</button></span>'
            : '') +
          (!live.cancelled && typeof window.openBillSplitterForPlace === 'function'
            ? '<button type="button" class="ob-btn-secondary" id="btnBillActiveOrder">🧾 Chia bill</button>'
            : '') +
          '<button type="button" class="ob-btn-primary" id="btnViewAllOrdersFromTrack">📋 Xem tất cả đơn</button>' +
        '</div>' +
      '</div>';

    if ($('btnSimNextStep')) {
      $('btnSimNextStep').addEventListener('click', function () {
        advanceOrderStep(orderId);
      });
    }

    function bindTrackCancelGuard() {
      var cancelBtn = $('btnCancelActiveOrder');
      if (!cancelBtn) return;
      cancelBtn.addEventListener('click', function () {
        var wrap = $('obTrackCancelWrap');
        if (!wrap) return;
        wrap.innerHTML =
          '<span class="ob-confirm-inline"><span>Xác nhận hủy đơn?</span>' +
          '<button type="button" id="btnConfirmTrackCancel" class="ob-btn-danger">Xác nhận</button>' +
          '<button type="button" id="btnAbortTrackCancel" class="ob-btn-ghost">Không</button></span>';
        $('btnConfirmTrackCancel').addEventListener('click', function () {
          var list = getOrders();
          var idx = arrFindIndex(list, function (o) { return o.id === orderId; });
          if (idx !== -1) {
            list[idx].cancelled = true;
            saveOrders(list);
            showToast('Đã hủy đơn hàng ' + orderId, 'ℹ️');
            renderDeliveryModal();
            triggerUndo('Đã hủy đơn ' + orderId, function () {
              var l2 = getOrders();
              var i2 = arrFindIndex(l2, function (o) { return o.id === orderId; });
              if (i2 !== -1) {
                l2[i2].cancelled = false;
                saveOrders(l2);
                if (activeDeliveryState.trackingOrderId === orderId && $('deliveryModal') && $('deliveryModal').classList.contains('open')) {
                  renderDeliveryModal();
                }
                if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open')) {
                  renderOrdersHubContent();
                }
              }
            });
          }
        });
        $('btnAbortTrackCancel').addEventListener('click', function () {
          wrap.innerHTML = '<button type="button" class="ob-btn-danger" id="btnCancelActiveOrder">✕ Hủy đơn</button>';
          bindTrackCancelGuard();
        });
      });
    }
    bindTrackCancelGuard();

    if ($('btnBillActiveOrder')) {
      $('btnBillActiveOrder').addEventListener('click', function () {
        if ($('deliveryModal')) $('deliveryModal').classList.remove('open');
        openBillForOrder(order);
      });
    }

    if ($('btnViewAllOrdersFromTrack')) {
      $('btnViewAllOrdersFromTrack').addEventListener('click', function () {
        if ($('deliveryModal')) $('deliveryModal').classList.remove('open');
        openOrdersHub('delivery');
      });
    }
  }

  // --- TABLE RESERVATION MODAL ---
  function captureReserveForm() {
    if ($('obResName')) activeReserveState.form.name = $('obResName').value;
    if ($('obResPhone')) activeReserveState.form.phone = $('obResPhone').value;
    if ($('obResNotes')) activeReserveState.form.notes = $('obResNotes').value;
  }

  function pickBestAvailableSlotForDate(restaurantId, dateStr, activeResList) {
    var preferred = ['19:00', '18:30', '19:30', '12:00', '18:00', '12:30', '20:00'];
    var i;
    for (i = 0; i < preferred.length; i++) {
      var av = computeSlotAvailability(restaurantId, dateStr, preferred[i], activeResList, new Date());
      if (av.status === 'available' || av.status === 'low') return preferred[i];
    }
    for (i = 0; i < TIME_SLOTS.length; i++) {
      var av2 = computeSlotAvailability(restaurantId, dateStr, TIME_SLOTS[i], activeResList, new Date());
      if (av2.status === 'available' || av2.status === 'low') return TIME_SLOTS[i];
    }
    return '';
  }

  function findOverlapReservation(dateStr, slotStr, excludeCode) {
    var slotMins = parseSlotToMins(slotStr);
    if (!dateStr || slotMins < 0) return null;
    var list = getReservations();
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r || r.status === 'cancelled' || r.status === 'completed' || r.status === 'checked_in') continue;
      if (excludeCode && r.code === excludeCode) continue;
      if (r.date === dateStr) {
        var rMins = parseSlotToMins(r.timeSlot);
        if (rMins >= 0 && Math.abs(rMins - slotMins) <= 90) {
          return r;
        }
      }
    }
    return null;
  }

  function openReservation(restaurantId, editingId, prefillSlot) {
    var rescheduleBooking = null;
    if (editingId && typeof editingId === 'object') {
      rescheduleBooking = editingId;
    } else if (typeof editingId === 'string' && editingId) {
      rescheduleBooking = arrFind(getReservations(), function (x) { return x.code === editingId; });
    }

    var restaurant = findRestaurantById(restaurantId);
    if (!restaurant && rescheduleBooking) {
      restaurant = {
        id: rescheduleBooking.restaurantId,
        name: rescheduleBooking.restaurantName,
        address: rescheduleBooking.restaurantAddress || '',
        district: rescheduleBooking.district || '',
        openingHours: '10:00 - 22:00',
        peopleRange: '1 - 10 người',
        priceTier: 'moderate',
        signatureDishes: []
      };
    }
    if (!restaurant) return;

    var prof = getSavedProfile();
    var allRes = getReservations();
    activeReserveState.restaurant = restaurant;
    activeReserveState.helpOpen = false;
    activeReserveState.lastSlotRenderMinute = formatTimeHHMM(new Date());

    if (rescheduleBooking) {
      activeReserveState.reschedulingCode = rescheduleBooking.code;
      activeReserveState.date = rescheduleBooking.date || getTodayStr();
      activeReserveState.timeSlot = rescheduleBooking.timeSlot || pickBestAvailableSlotForDate(restaurant.id, activeReserveState.date, allRes);
      activeReserveState.guests = rescheduleBooking.guests || 4;
      activeReserveState.seating = rescheduleBooking.seating || 'standard';
      activeReserveState.preOrderDishes = Array.isArray(rescheduleBooking.preOrderDishes) ? rescheduleBooking.preOrderDishes.slice() : [];
      activeReserveState.form = {
        name: rescheduleBooking.customerName || prof.name || '',
        phone: rescheduleBooking.customerPhone || prof.phone || '',
        notes: rescheduleBooking.notes || ''
      };
    } else {
      activeReserveState.reschedulingCode = null;
      var initDate = getTodayStr();
      var initSlot = '';
      if (prefillSlot && TIME_SLOTS.indexOf(prefillSlot) !== -1) {
        var preTodayAv = computeSlotAvailability(restaurant.id, initDate, prefillSlot, allRes, new Date());
        if (preTodayAv.status === 'available' || preTodayAv.status === 'low') {
          initSlot = prefillSlot;
        } else {
          var tomDate = getTomorrowStr();
          var preTomAv = computeSlotAvailability(restaurant.id, tomDate, prefillSlot, allRes, new Date());
          if (preTomAv.status === 'available' || preTomAv.status === 'low') {
            initDate = tomDate;
            initSlot = prefillSlot;
          } else {
            initSlot = prefillSlot;
          }
        }
      }
      if (!initSlot) {
        initSlot = pickBestAvailableSlotForDate(restaurant.id, initDate, allRes);
        if (!initSlot) {
          var tomAlt = getTomorrowStr();
          var tomBest = pickBestAvailableSlotForDate(restaurant.id, tomAlt, allRes);
          if (tomBest) {
            initDate = tomAlt;
            initSlot = tomBest;
          } else {
            initSlot = '19:00';
          }
        }
      }
      activeReserveState.date = initDate;
      activeReserveState.timeSlot = initSlot;
      activeReserveState.guests = 4;
      activeReserveState.seating = 'standard';
      activeReserveState.preOrderDishes = [];
      activeReserveState.form = {
        name: prof.name || '',
        phone: prof.phone || '',
        notes: ''
      };
    }

    renderReservationModal();
    var modal = $('reservationModal');
    if (modal) modal.classList.add('open');
  }

  function buildSlotsSectionHtml(restaurant, dateStr, allRes) {
    var now = new Date();
    var hasAnyFree = false;
    var hasAnyOpenHours = false;

    function renderGroup(slots) {
      return slots.map(function (t) {
        var av = computeSlotAvailability(restaurant.id, dateStr, t, allRes, now);
        var isBookable = av.status === 'available' || av.status === 'low';
        var isClosedHours = av.status === 'closed_hours';
        if (isBookable) hasAnyFree = true;
        if (!isClosedHours && av.status !== 'past') hasAnyOpenHours = true;
        if (av.status === 'full') hasAnyOpenHours = true;
        var isActive = (isBookable || isClosedHours) && activeReserveState.timeSlot === t;
        var isDisabled = (av.status === 'past' || av.status === 'full');
        var statusCls = av.status === 'past'
          ? 'slot-past'
          : (isClosedHours ? 'slot-closed-hours' : (av.status === 'full' ? 'slot-full' : (av.status === 'low' ? 'slot-low' : '')));
        return (
          '<button type="button" class="ob-slot-pill ob-slot-btn ' + statusCls + (isActive ? ' active' : '') + '" data-slot="' + t + '" data-slot-status="' + escHtml(av.status) + '"' + (isDisabled ? ' disabled' : '') + (isClosedHours ? ' aria-disabled="true"' : '') + ' title="' + escHtml(av.label) + '">' +
            '<span>' + t + (av.isPeak ? ' 🔥' : '') + '</span>' +
            '<span class="ob-slot-cap">' + escHtml(av.label) + '</span>' +
          '</button>'
        );
      }).join('');
    }

    var lunchHtml = renderGroup(LUNCH_SLOTS);
    var dinnerHtml = renderGroup(DINNER_SLOTS);

    // Check if selected slot is unavailable -> recovery bar (H9)
    var selAv = activeReserveState.timeSlot
      ? computeSlotAvailability(restaurant.id, dateStr, activeReserveState.timeSlot, allRes, now)
      : { status: 'past' };
    var needRecovery = !hasAnyFree || selAv.status === 'past' || selAv.status === 'full' || selAv.status === 'closed_hours';
    var recoveryHtml = '';
    if (needRecovery) {
      var nextFreeToday = pickBestAvailableSlotForDate(restaurant.id, dateStr, allRes);
      if (nextFreeToday) {
        recoveryHtml =
          '<div class="ob-slot-recovery-bar">' +
            '<span>⚠️ Khung giờ vừa chọn ' + (selAv.status === 'closed_hours' ? 'nằm ngoài giờ mở cửa của quán.' : 'đã qua hoặc hết bàn (cần đặt trước ít nhất 20 phút).') + '</span>' +
            '<button type="button" id="btnRecoverNextSlot" class="ob-btn-secondary" data-recover-date="' + escHtml(dateStr) + '" data-recover-slot="' + escHtml(nextFreeToday) + '">⚡ Chọn nhanh ' + escHtml(nextFreeToday) + ' hôm nay</button>' +
          '</div>';
      } else {
        var tom = getTomorrowStr();
        var tomSlot = pickBestAvailableSlotForDate(restaurant.id, tom, allRes) || '19:00';
        recoveryHtml =
          '<div class="ob-slot-recovery-bar">' +
            '<span>ℹ️ Ngày ' + escHtml(dateStr) + ' không còn khung giờ nhận bàn phù hợp.</span>' +
            '<button type="button" id="btnRecoverNextSlot" class="ob-btn-secondary" data-recover-date="' + escHtml(tom) + '" data-recover-slot="' + escHtml(tomSlot) + '">📅 Chuyển sang ngày mai (' + escHtml(tomSlot) + ')</button>' +
          '</div>';
      }
    }

    var overlap = findOverlapReservation(dateStr, activeReserveState.timeSlot, activeReserveState.reschedulingCode);
    var overlapHtml = overlap
      ? '<div class="ob-overlap-warn">⚠️ Cảnh báo trùng giờ (±90 phút): Bạn đã có lịch <strong>' + escHtml(overlap.code) + '</strong> tại <strong>' + escHtml(overlap.restaurantName) + '</strong> lúc <strong>' + escHtml(overlap.timeSlot) + '</strong> ngày ' + escHtml(overlap.date) + '.</div>'
      : '';

    var hoursApi = getHoursApi();
    var hoursCtx = getSelectedHoursContext();
    var dateObjMs = parseLocalDateTimeMs(dateStr, activeReserveState.timeSlot || '19:00');
    var dateDay = !isNaN(dateObjMs) ? new Date(dateObjMs).getDay() : hoursCtx.dayOfWeek;
    var closedBannerHtml = '';
    var bannerCheckMins = hoursCtx.minutes;
    var bannerActiveSlot = activeReserveState.timeSlot || hoursCtx.timeLabel;

    if (selAv.status === 'closed_hours') {
      bannerCheckMins = parseSlotToMins(activeReserveState.timeSlot);
      if (bannerCheckMins < 0) bannerCheckMins = hoursCtx.minutes;
      closedBannerHtml = buildClosedAlternativesHtml(restaurant, {
        targetMinutes: bannerCheckMins,
        targetDayOfWeek: dateDay,
        timeLabel: activeReserveState.timeSlot,
        requireReservable: true,
        titleText: '🔴 Quán đóng cửa lúc ' + activeReserveState.timeSlot + ' (' + dateStr + ')',
        subText: 'Giờ mở cửa của ' + restaurant.name + ': ' + (restaurant.openingHours || 'Chưa cập nhật') + '.'
      });
    } else if (!hasAnyOpenHours && hoursApi) {
      bannerCheckMins = parseSlotToMins(bannerActiveSlot);
      if (bannerCheckMins < 0) bannerCheckMins = hoursCtx.minutes;
      closedBannerHtml = buildClosedAlternativesHtml(restaurant, {
        targetMinutes: bannerCheckMins,
        targetDayOfWeek: dateDay,
        timeLabel: bannerActiveSlot,
        requireReservable: true,
        titleText: '🔴 Quán không mở cửa các khung đặt bàn ngày ' + dateStr,
        subText: 'Giờ mở cửa của ' + restaurant.name + ': ' + (restaurant.openingHours || 'Chưa cập nhật') + '.'
      });
    } else if (hoursApi && typeof hoursApi.isOpenAtMinutes === 'function' && !hoursApi.isOpenAtMinutes(restaurant, hoursCtx.minutes, hoursCtx.dayOfWeek)) {
      bannerCheckMins = hoursCtx.minutes;
      closedBannerHtml = buildClosedAlternativesHtml(restaurant, {
        targetMinutes: hoursCtx.minutes,
        targetDayOfWeek: hoursCtx.dayOfWeek,
        timeLabel: hoursCtx.timeLabel,
        requireReservable: true,
        titleText: '🔴 Quán đóng cửa lúc ' + hoursCtx.timeLabel,
        subText: 'Bạn vẫn có thể đặt bàn cho khung giờ quán mở bên trên hoặc chuyển sang quán đang mở lúc ' + hoursCtx.timeLabel + '.'
      });
    }

    return (
      '<div class="ob-slot-group-title">☀️ Bữa Trưa (11:00 – 12:30)</div>' +
      '<div class="ob-slots-grid">' + lunchHtml + '</div>' +
      '<div class="ob-slot-group-title" style="margin-top:8px;">🌙 Bữa Tối (17:30 – 20:30)</div>' +
      '<div class="ob-slots-grid">' + dinnerHtml + '</div>' +
      recoveryHtml +
      overlapHtml +
      closedBannerHtml
    );
  }

  function renderReservationModal(confirmedBooking) {
    var container = $('reservationModalContent');
    var restaurant = activeReserveState.restaurant;
    if (!container || !restaurant) return;

    if (confirmedBooking) {
      var areaObj = arrFind(SEATING_AREAS, function (a) { return a.id === confirmedBooking.seating; }) || SEATING_AREAS[0];
      var liveRes = computeReservationLiveState(confirmedBooking, Date.now());
      container.innerHTML =
        '<div class="ob-reserve-confirm">' +
          '<div class="ob-confirm-icon">🏮</div>' +
          '<div class="ob-reserve-badge">✓ ' + (activeReserveState.reschedulingCode ? 'ĐỔI GIỜ THÀNH CÔNG' : 'ĐẶT BÀN THÀNH CÔNG') + '</div>' +
          '<h2>Mã đặt bàn: ' + escHtml(confirmedBooking.code) + '</h2>' +
          '<p>Bàn của quý khách tại <strong>' + escHtml(confirmedBooking.restaurantName) + '</strong> đã được giữ chỗ (<span class="ob-res-countdown">' + escHtml(liveRes.countdownText) + '</span>).</p>' +
          '<div class="ob-ticket-card">' +
            '<div><span>📅 Ngày &amp; Giờ:</span><strong>' + escHtml(confirmedBooking.date) + ' lúc ' + escHtml(confirmedBooking.timeSlot) + '</strong></div>' +
            '<div><span>👥 Số lượng khách:</span><strong>' + confirmedBooking.guests + ' người</strong></div>' +
            '<div><span>🪑 Khu vực ngồi:</span><strong>' + escHtml(areaObj.label) + '</strong></div>' +
            '<div><span>👤 Người đặt:</span><strong>' + escHtml(confirmedBooking.customerName) + ' (' + escHtml(confirmedBooking.customerPhone) + ')</strong></div>' +
            (confirmedBooking.preOrderDishes && confirmedBooking.preOrderDishes.length
              ? '<div><span>🍽️ Món đặt trước:</span><strong>' + escHtml(confirmedBooking.preOrderDishes.join(', ')) + '</strong></div>'
              : '') +
            (confirmedBooking.notes
              ? '<div><span>📝 Ghi chú:</span><strong>' + escHtml(confirmedBooking.notes) + '</strong></div>'
              : '') +
          '</div>' +
          '<div class="ob-track-actions">' +
            '<button type="button" class="ob-btn-secondary" id="btnCopyBookingCode">📋 Sao chép mã đặt bàn</button>' +
            '<button type="button" class="ob-btn-primary" id="btnViewAllBookings">📅 Xem lịch đặt bàn</button>' +
          '</div>' +
        '</div>';

      activeReserveState.reschedulingCode = null;

      if ($('btnCopyBookingCode')) {
        $('btnCopyBookingCode').addEventListener('click', function () {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(confirmedBooking.code).catch(function () {});
          }
          showToast('Đã sao chép mã đặt bàn ' + confirmedBooking.code, '📋');
        });
      }

      if ($('btnViewAllBookings')) {
        $('btnViewAllBookings').addEventListener('click', function () {
          if ($('reservationModal')) $('reservationModal').classList.remove('open');
          openOrdersHub('reservations');
        });
      }
      return;
    }

    if (!activeReserveState.reschedulingCode && !canReserve(restaurant)) {
      container.innerHTML =
        '<div class="ob-reserve-confirm">' +
          '<div class="ob-confirm-icon">🥢</div>' +
          '<h2>Quán Phục Vụ Tại Chỗ (Không Nhận Đặt Bàn Trước)</h2>' +
          '<p><strong>' + escHtml(restaurant.name) + '</strong> thuộc mô hình quán ăn bình dân / phố cổ phục vụ nhanh theo lượt khách đến trực tiếp.</p>' +
          '<div class="ob-track-actions">' +
            '<button type="button" class="ob-btn-primary" id="btnSwitchToDelivery">🛵 Đặt Giao Tận Nơi Thay Thế</button>' +
          '</div>' +
        '</div>';
      if ($('btnSwitchToDelivery')) {
        $('btnSwitchToDelivery').addEventListener('click', function () {
          if ($('reservationModal')) $('reservationModal').classList.remove('open');
          openDelivery(restaurant.id);
        });
      }
      return;
    }

    captureReserveForm();
    var allRes = getReservations();
    var curAv = activeReserveState.timeSlot
      ? computeSlotAvailability(restaurant.id, activeReserveState.date, activeReserveState.timeSlot, allRes, new Date())
      : { status: 'past' };
    if (curAv.status === 'past' || curAv.status === 'full') {
      var fallbackSlot = pickBestAvailableSlotForDate(restaurant.id, activeReserveState.date, allRes);
      if (fallbackSlot) activeReserveState.timeSlot = fallbackSlot;
    }

    var form = activeReserveState.form;
    var todayStr = getTodayStr();
    var tomStr = getTomorrowStr();
    var wkndStr = getWeekendStr();

    var datePresetsHtml =
      '<div class="ob-preset-row">' +
        '<button type="button" class="ob-preset-btn ' + (activeReserveState.date === todayStr ? 'active' : '') + '" data-preset-date="' + todayStr + '">Hôm nay</button>' +
        '<button type="button" class="ob-preset-btn ' + (activeReserveState.date === tomStr ? 'active' : '') + '" data-preset-date="' + tomStr + '">Ngày mai</button>' +
        '<button type="button" class="ob-preset-btn ' + (activeReserveState.date === wkndStr ? 'active' : '') + '" data-preset-date="' + wkndStr + '">Cuối tuần</button>' +
      '</div>';

    var guestPresetsHtml = [2, 4, 6, 8].map(function (g) {
      return '<button type="button" class="ob-preset-btn ' + (activeReserveState.guests === g ? 'active' : '') + '" data-preset-guests="' + g + '">' + g + ' khách</button>';
    }).join('');

    var seatingHtml = SEATING_AREAS.map(function (s) {
      return '<button type="button" class="ob-seat-pill ' + (activeReserveState.seating === s.id ? 'active' : '') + '" data-seat="' + s.id + '">' + escHtml(s.label) + '</button>';
    }).join('');

    var preOrderHtml = (restaurant.signatureDishes || []).map(function (d, i) {
      var checked = activeReserveState.preOrderDishes.indexOf(d) !== -1;
      return (
        '<label class="ob-preorder-chip">' +
          '<input type="checkbox" data-preorder-idx="' + i + '" value="' + escHtml(d) + '"' + (checked ? ' checked' : '') + ' />' +
          '<span>🥢 ' + escHtml(d) + '</span>' +
        '</label>'
      );
    }).join('');

    container.innerHTML =
      '<div class="ob-reserve-header">' +
        '<div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">' +
          '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">' +
            '<span class="ob-reserve-badge" style="margin-bottom:0;">' + (activeReserveState.reschedulingCode ? '🕒 ĐỔI GIỜ LỊCH ' + escHtml(activeReserveState.reschedulingCode) : '🪑 HỖ TRỢ ĐẶT BÀN TRƯỚC') + '</span>' +
            '<span class="ob-live-sync-pill"><span class="ob-live-dot"></span><span class="ob-live-clock" data-rt-clock>' + formatTimeHMS(new Date()) + '</span></span>' +
          '</div>' +
          '<button type="button" id="btnToggleResHelp" class="ob-help-toggle" aria-expanded="' + (activeReserveState.helpOpen ? 'true' : 'false') + '">❓ Hướng dẫn &amp; Chính sách</button>' +
        '</div>' +
        '<div id="obResHelpDrawer" class="ob-help-drawer ' + (activeReserveState.helpOpen ? 'open' : '') + '">' +
          '<ul class="ob-help-list">' +
            '<li><strong>Buffer 20 phút:</strong> Chỉ nhận đặt trước giờ đến ít nhất 20 phút để quán kịp chuẩn bị bàn.</li>' +
            '<li><strong>Số bàn thực tế:</strong> Hiển thị số bàn trống theo thời gian thực; khung giờ 🔥 là giờ cao điểm.</li>' +
            '<li><strong>Chống trùng lịch:</strong> Cảnh báo nếu bạn đã có lịch khác trong ±90 phút cùng ngày.</li>' +
            '<li><strong>Đổi giờ &amp; Check-in:</strong> Dễ dàng đổi giờ hoặc Check-in ngay tại mục <em>Lịch đặt bàn</em>; nhấn <code>Ctrl + Enter</code> để xác nhận nhanh.</li>' +
          '</ul>' +
        '</div>' +
        '<h2 id="reservationModalTitle">' + escHtml(restaurant.name) + '</h2>' +
        '<p>📍 ' + escHtml(restaurant.address) + ' • ⏰ ' + escHtml(restaurant.openingHours) + ' • 👥 ' + escHtml(restaurant.peopleRange) + '</p>' +
      '</div>' +

      '<div class="ob-reserve-body">' +
        '<div class="ob-form-grid">' +
          '<div class="ob-field ob-field-group">' +
            '<span>📅 Ngày đến *</span>' +
            datePresetsHtml +
            '<input type="date" id="obResDate" min="' + todayStr + '" value="' + escHtml(activeReserveState.date) + '" />' +
            '<span class="ob-field-error"></span>' +
          '</div>' +
          '<div class="ob-field">' +
            '<span>👥 Số lượng khách *</span>' +
            '<div class="ob-preset-row">' + guestPresetsHtml + '</div>' +
            '<div class="ob-guest-stepper">' +
              '<button type="button" id="btnResGuestDec" aria-label="Giảm số khách">−</button>' +
              '<strong id="obResGuestVal">' + activeReserveState.guests + ' người</strong>' +
              '<button type="button" id="btnResGuestInc" aria-label="Tăng số khách">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="ob-field">' +
          '<span>⏰ Chọn khung giờ đến * (số bàn trống thời gian thực)</span>' +
          '<div id="obResSlotsSection">' + buildSlotsSectionHtml(restaurant, activeReserveState.date, allRes) + '</div>' +
        '</div>' +

        '<div class="ob-field">' +
          '<span>🪑 Chọn khu vực chỗ ngồi</span>' +
          '<div class="ob-seats-grid">' + seatingHtml + '</div>' +
        '</div>' +

        (preOrderHtml
          ? '<div class="ob-field">' +
              '<span>🍲 Đặt món trước để quán chuẩn bị sẵn (tùy chọn)</span>' +
              '<div class="ob-preorder-grid">' + preOrderHtml + '</div>' +
            '</div>'
          : '') +

        '<div class="ob-form-grid">' +
          '<label class="ob-field ob-field-group">' +
            '<span>👤 Họ tên người đặt *</span>' +
            '<input type="text" id="obResName" value="' + escHtml(form.name) + '" placeholder="Họ tên của bạn" required />' +
            '<span class="ob-field-error"></span>' +
          '</label>' +
          '<label class="ob-field ob-field-group">' +
            '<span>📞 Số điện thoại *</span>' +
            '<input type="tel" id="obResPhone" value="' + escHtml(form.phone) + '" placeholder="09xx xxx xxx" required />' +
            '<span class="ob-field-error"></span>' +
          '</label>' +
        '</div>' +

        '<label class="ob-field">' +
          '<span>📝 Yêu cầu đặc biệt (tùy chọn)</span>' +
          '<input type="text" id="obResNotes" value="' + escHtml(form.notes) + '" placeholder="VD: Bàn sinh nhật, có ghế trẻ em, tránh gió..." />' +
        '</label>' +

        '<div id="obResSubmitHint" class="ob-submit-hint"></div>' +
        '<button type="button" id="btnConfirmReservation" class="ob-submit-reserve-btn">' +
          (activeReserveState.reschedulingCode ? '🕒 Lưu Thay Đổi Giờ Đặt Bàn' : '🪑 Xác Nhận Đặt Bàn') +
          ' (' + activeReserveState.guests + ' khách • ' + (activeReserveState.timeSlot || 'Chưa chọn giờ') + ')' +
        '</button>' +
      '</div>';

    // Bind Help Drawer
    var resHelpBtn = $('btnToggleResHelp');
    if (resHelpBtn) {
      resHelpBtn.addEventListener('click', function () {
        activeReserveState.helpOpen = !activeReserveState.helpOpen;
        var drawer = $('obResHelpDrawer');
        if (drawer) drawer.classList.toggle('open', activeReserveState.helpOpen);
        resHelpBtn.setAttribute('aria-expanded', activeReserveState.helpOpen ? 'true' : 'false');
      });
    }

    function updateReserveSubmitLabel() {
      var btn = $('btnConfirmReservation');
      if (btn) {
        btn.textContent =
          (activeReserveState.reschedulingCode ? '🕒 Lưu Thay Đổi Giờ Đặt Bàn' : '🪑 Xác Nhận Đặt Bàn') +
          ' (' + activeReserveState.guests + ' khách • ' + (activeReserveState.timeSlot || 'Chưa chọn giờ') + ')';
      }
    }

    function refreshSlotsOnly() {
      var sec = $('obResSlotsSection');
      if (!sec) return;
      var list = getReservations();
      sec.innerHTML = buildSlotsSectionHtml(restaurant, activeReserveState.date, list);
      bindSlotListeners();
      updateReserveSubmitLabel();
      validateReserveForm(false);
    }

    function bindSlotListeners() {
      var sec = $('obResSlotsSection');
      var slotBtns = container.querySelectorAll('[data-slot]');
      for (var s = 0; s < slotBtns.length; s++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            if (btn.disabled) return;
            activeReserveState.timeSlot = btn.getAttribute('data-slot');
            refreshSlotsOnly();
          });
        })(slotBtns[s]);
      }
      var checkMins = parseSlotToMins(activeReserveState.timeSlot || '');
      if (checkMins < 0) checkMins = getSelectedHoursContext().minutes;
      bindClosedAlternativesListeners(sec, 'reservationModal', checkMins, activeReserveState.timeSlot);
      var recBtn = $('btnRecoverNextSlot');
      if (recBtn) {
        recBtn.addEventListener('click', function () {
          var d = recBtn.getAttribute('data-recover-date');
          var sl = recBtn.getAttribute('data-recover-slot');
          if (d) {
            activeReserveState.date = d;
            if ($('obResDate')) $('obResDate').value = d;
            var dPresets = container.querySelectorAll('[data-preset-date]');
            for (var dp = 0; dp < dPresets.length; dp++) {
              dPresets[dp].classList.toggle('active', dPresets[dp].getAttribute('data-preset-date') === d);
            }
          }
          if (sl) activeReserveState.timeSlot = sl;
          refreshSlotsOnly();
          showToast('Đã chọn khung giờ còn bàn: ' + sl + ' (' + d + ')', '⚡');
        });
      }
    }
    bindSlotListeners();

    if ($('obResDate')) {
      $('obResDate').addEventListener('change', function (e) {
        activeReserveState.date = e.target.value || getTodayStr();
        var dPresets = container.querySelectorAll('[data-preset-date]');
        for (var dp = 0; dp < dPresets.length; dp++) {
          dPresets[dp].classList.toggle('active', dPresets[dp].getAttribute('data-preset-date') === activeReserveState.date);
        }
        var nextAvail = pickBestAvailableSlotForDate(restaurant.id, activeReserveState.date, getReservations());
        if (nextAvail && isTimeSlotPast(activeReserveState.date, activeReserveState.timeSlot)) {
          activeReserveState.timeSlot = nextAvail;
        }
        refreshSlotsOnly();
      });
    }

    var datePresetBtns = container.querySelectorAll('[data-preset-date]');
    for (var dp = 0; dp < datePresetBtns.length; dp++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var d = btn.getAttribute('data-preset-date');
          activeReserveState.date = d;
          if ($('obResDate')) $('obResDate').value = d;
          for (var x = 0; x < datePresetBtns.length; x++) {
            datePresetBtns[x].classList.toggle('active', datePresetBtns[x] === btn);
          }
          var nextAvail = pickBestAvailableSlotForDate(restaurant.id, d, getReservations());
          if (nextAvail && isTimeSlotPast(d, activeReserveState.timeSlot)) {
            activeReserveState.timeSlot = nextAvail;
          }
          refreshSlotsOnly();
        });
      })(datePresetBtns[dp]);
    }

    var guestPresetBtns = container.querySelectorAll('[data-preset-guests]');
    function updateGuestsUI() {
      if ($('obResGuestVal')) $('obResGuestVal').textContent = activeReserveState.guests + ' người';
      for (var gp = 0; gp < guestPresetBtns.length; gp++) {
        guestPresetBtns[gp].classList.toggle('active', parseInt(guestPresetBtns[gp].getAttribute('data-preset-guests'), 10) === activeReserveState.guests);
      }
      updateReserveSubmitLabel();
    }
    for (var gp = 0; gp < guestPresetBtns.length; gp++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          activeReserveState.guests = parseInt(btn.getAttribute('data-preset-guests'), 10) || 4;
          updateGuestsUI();
        });
      })(guestPresetBtns[gp]);
    }
    if ($('btnResGuestDec')) {
      $('btnResGuestDec').addEventListener('click', function () {
        activeReserveState.guests = Math.max(1, activeReserveState.guests - 1);
        updateGuestsUI();
      });
    }
    if ($('btnResGuestInc')) {
      $('btnResGuestInc').addEventListener('click', function () {
        activeReserveState.guests = Math.min(30, activeReserveState.guests + 1);
        updateGuestsUI();
      });
    }

    var seatBtns = container.querySelectorAll('[data-seat]');
    for (var sb = 0; sb < seatBtns.length; sb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          activeReserveState.seating = btn.getAttribute('data-seat');
          for (var x = 0; x < seatBtns.length; x++) {
            seatBtns[x].classList.toggle('active', seatBtns[x] === btn);
          }
        });
      })(seatBtns[sb]);
    }

    var preChks = container.querySelectorAll('[data-preorder-idx]');
    for (var pc = 0; pc < preChks.length; pc++) {
      (function (chk) {
        chk.addEventListener('change', function () {
          var val = chk.value;
          var list = activeReserveState.preOrderDishes;
          if (chk.checked) {
            if (list.indexOf(val) === -1) list.push(val);
          } else {
            activeReserveState.preOrderDishes = list.filter(function (x) { return x !== val; });
          }
        });
      })(preChks[pc]);
    }

    function bindResField(id, key) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function () {
        el.setAttribute('data-touched', '1');
        activeReserveState.form[key] = el.value;
        validateReserveForm(false);
      });
      el.addEventListener('blur', function () {
        el.setAttribute('data-touched', '1');
        validateReserveForm(false);
      });
    }
    bindResField('obResName', 'name');
    bindResField('obResPhone', 'phone');
    if ($('obResNotes')) {
      $('obResNotes').addEventListener('input', function (e) {
        activeReserveState.form.notes = e.target.value;
      });
    }

    if ($('btnConfirmReservation')) {
      $('btnConfirmReservation').addEventListener('click', submitReservation);
    }

    validateReserveForm(false);
  }

  function submitReservation() {
    var check = validateReserveForm(true);
    var date = ($('obResDate') && $('obResDate').value) || activeReserveState.date || getTodayStr();
    var name = strTrim($('obResName') ? $('obResName').value : activeReserveState.form.name);
    var phone = strTrim($('obResPhone') ? $('obResPhone').value : activeReserveState.form.phone);
    var notes = strTrim($('obResNotes') ? $('obResNotes').value : activeReserveState.form.notes);

    if (!check.okDate) {
      showToast('Không thể đặt bàn cho ngày đã qua!', '⚠️');
      if ($('obResDate')) $('obResDate').focus();
      return;
    }
    if (!check.okSlot) {
      showToast('Khung giờ không hợp lệ, hết bàn hoặc quán đóng cửa!', '⚠️');
      return;
    }
    if (!check.okName) {
      showToast('Vui lòng nhập họ tên người đặt bàn!', '⚠️');
      if ($('obResName')) $('obResName').focus();
      return;
    }
    if (!check.okPhone) {
      showToast('Số điện thoại chưa hợp lệ (9–11 số)!', '⚠️');
      if ($('obResPhone')) $('obResPhone').focus();
      return;
    }

    var prof = getSavedProfile();
    saveProfile(name, phone, prof.address);

    var restaurant = activeReserveState.restaurant;
    var list = getReservations();
    var booking;

    if (activeReserveState.reschedulingCode) {
      var idx = arrFindIndex(list, function (x) { return x.code === activeReserveState.reschedulingCode; });
      if (idx !== -1) {
        booking = cloneShallow(list[idx]);
        booking.date = date;
        booking.timeSlot = activeReserveState.timeSlot;
        booking.guests = activeReserveState.guests;
        booking.seating = activeReserveState.seating;
        booking.preOrderDishes = activeReserveState.preOrderDishes.slice();
        booking.customerName = name;
        booking.customerPhone = phone;
        booking.notes = notes;
        booking.status = 'confirmed';
        booking.updatedAt = new Date().toISOString();
        list[idx] = booking;
        saveReservations(list);
        showToast('Đã đổi giờ lịch ' + booking.code + ' sang ' + booking.timeSlot + ' (' + booking.date + ')', '🕒');
        renderReservationModal(booking);
        return;
      }
    }

    var code = 'PV-' + String(Math.floor(100000 + Math.random() * 900000));
    booking = {
      code: code,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      district: restaurant.district,
      date: date,
      timeSlot: activeReserveState.timeSlot,
      guests: activeReserveState.guests,
      seating: activeReserveState.seating,
      preOrderDishes: activeReserveState.preOrderDishes.slice(),
      customerName: name,
      customerPhone: phone,
      notes: notes,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    list.unshift(booking);
    saveReservations(list);

    showToast('Đặt bàn thành công! Mã ' + code, '🪑');
    renderReservationModal(booking);
  }

  function openBillForOrder(order) {
    if (!order || typeof window.openBillSplitterForPlace !== 'function') return;
    var billItems = (Array.isArray(order.items) ? order.items : []).filter(Boolean).map(function (it) {
      var itemName = (it.name && strTrim(it.name)) ? strTrim(it.name) : 'Món ăn';
      var itemNote = (it.note && strTrim(it.note)) ? ' (' + strTrim(it.note) + ')' : '';
      return {
        name: itemName + itemNote,
        qty: Math.max(1, parseInt(it.qty, 10) || 1),
        price: Math.max(0, Number(it.price) || 0),
        split: 'all'
      };
    });
    if (Number(order.shipFee) > 0) {
      billItems.push({
        name: 'Phí giao hàng',
        qty: 1,
        price: Number(order.shipFee),
        split: 'all'
      });
    }
    if (billItems.length === 0 && Number(order.total) > 0) {
      window.openBillSplitterForPlace({
        placeName: order.restaurantName || 'Đơn giao hàng',
        items: [],
        directTotal: Number(order.total),
        discount: 0,
        vat: 0,
        tip: 0
      });
      return;
    }
    window.openBillSplitterForPlace({
      placeName: order.restaurantName || 'Đơn giao hàng',
      items: billItems,
      directTotal: 0,
      discount: Number(order.discount) || 0,
      vat: 0,
      tip: 0
    });
  }

  // --- ORDERS, RESERVATIONS & SAVED ADDRESSES HUB ---
  function setHubTabUI(tab) {
    activeHubTab = (tab === 'reservations' || tab === 'addresses') ? tab : 'delivery';
    if (typeof document === 'undefined') return;
    var tabs = document.querySelectorAll('[data-ob-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var isAct = tabs[i].getAttribute('data-ob-tab') === activeHubTab;
      tabs[i].classList.toggle('active', isAct);
      tabs[i].setAttribute('aria-selected', isAct ? 'true' : 'false');
    }
  }

  function openOrdersHub(tab) {
    setHubTabUI(tab);
    renderOrdersHubContent();
    var modal = $('ordersHubModal');
    if (modal) modal.classList.add('open');
  }

  function renderAddressBookManager(content) {
    var addrs = getSavedAddresses();
    var curUser = getCurrentUserObj();
    var acctDisplay = (curUser && curUser.email)
      ? '👤 Tài khoản: <strong>' + escHtml(curUser.fullName || curUser.email) + '</strong> (' + escHtml(curUser.email) + ')'
      : '👤 Chế độ khách (guest) — Đăng nhập để đồng bộ địa chỉ theo tài khoản';

    var st = addrManagerState;
    var detectedDist = detectDistrictFromAddress(st.address);
    var labelPillsHtml = ['home', 'work', 'other'].map(function (lbl) {
      var meta = ADDR_LABELS[lbl];
      return '<button type="button" class="ob-addr-label-pill ' + (st.label === lbl ? 'active' : '') + '" data-mgr-label="' + lbl + '">' + meta.icon + ' ' + meta.text + '</button>';
    }).join('');

    var cardsHtml = addrs.length
      ? '<div class="ob-addr-list">' + addrs.map(function (a) {
          var lastUsedStr = a.lastUsedAt ? formatTimeHHMM(Date.parse(a.lastUsedAt) || Date.now()) : '';
          return (
            '<div class="ob-addr-card ' + (a.isDefault ? 'is-default' : '') + '" data-addr-id="' + escHtml(a.id) + '">' +
              '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">' +
                '<div>' +
                  '<span class="ob-addr-chip-tag">' + escHtml(formatAddressLabelBadge(a)) + '</span> ' +
                  (a.isDefault ? '<span class="ob-addr-badge-default">⭐ Mặc định</span> ' : '') +
                  (a.district ? '<span class="ob-hub-code">📍 ' + escHtml(a.district) + '</span>' : '') +
                  '<div style="margin-top:6px; font-weight:700;">' + escHtml(a.address) + '</div>' +
                  '<div class="ob-addr-chip-meta" style="margin-top:4px;">' +
                    '👤 ' + escHtml(a.recipientName || 'Chưa có tên') + ' • 📞 ' + escHtml(a.phone || 'Chưa có SĐT') +
                    (a.driverNote ? ' • 📝 ' + escHtml(a.driverNote) : '') +
                  '</div>' +
                  '<div class="ob-addr-chip-meta" style="margin-top:3px;">Đã dùng ' + (Number(a.useCount) || 1) + ' lần' + (lastUsedStr ? ' • Lần cuối ' + lastUsedStr : '') + '</div>' +
                '</div>' +
                '<div class="ob-addr-card-actions">' +
                  (!a.isDefault
                    ? '<button type="button" class="ob-btn-secondary" data-addr-default="' + escHtml(a.id) + '">⭐ Mặc định</button>'
                    : '') +
                  '<button type="button" class="ob-btn-secondary" data-addr-edit="' + escHtml(a.id) + '">✏️ Sửa</button>' +
                  '<button type="button" class="ob-btn-danger" data-addr-del="' + escHtml(a.id) + '">🗑️ Xóa</button>' +
                '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('') + '</div>'
      : '<div class="ob-empty-hub" style="padding:24px 14px;">' +
          '<div style="font-size:2.2rem;">📍</div>' +
          '<h3>Sổ địa chỉ đang trống</h3>' +
          '<p>Thêm địa chỉ nhà riêng hoặc cơ quan bên trên để đặt món chỉ với 1 chạm!</p>' +
        '</div>';

    content.innerHTML =
      '<div class="ob-addr-manager">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; font-size:0.86rem;">' +
          '<span>' + acctDisplay + '</span>' +
          '<span>Tối đa 20 địa chỉ • Tự động chống trùng</span>' +
        '</div>' +
        '<div class="ob-addr-form-card">' +
          '<h3 class="ob-sec-title">' + (st.editingId ? '✏️ Chỉnh sửa địa chỉ đã lưu' : '➕ Thêm địa chỉ giao hàng mới') + '</h3>' +
          '<div class="ob-addr-label-pills" style="margin-bottom:10px;">' + labelPillsHtml + '</div>' +
          '<input type="text" id="obMgrCustomLabel" value="' + escHtml(st.customLabel) + '" placeholder="Tên nhãn tùy chỉnh (VD: Nhà bạn thân...)" maxlength="30" style="display:' + (st.label === 'other' ? 'block' : 'none') + '; margin-bottom:10px; width:100%; padding:8px 10px; border-radius:7px; border:1px solid #d7c4a5;" />' +
          '<div class="ob-form-grid">' +
            '<label class="ob-field ob-field-group">' +
              '<span>Người nhận *</span>' +
              '<input type="text" id="obMgrName" value="' + escHtml(st.name) + '" placeholder="Họ tên người nhận" />' +
              '<span class="ob-field-error"></span>' +
            '</label>' +
            '<label class="ob-field ob-field-group">' +
              '<span>Số điện thoại *</span>' +
              '<input type="tel" id="obMgrPhone" value="' + escHtml(st.phone) + '" placeholder="09xx xxx xxx" />' +
              '<span class="ob-field-error"></span>' +
            '</label>' +
          '</div>' +
          '<label class="ob-field ob-field-group">' +
            '<span>Địa chỉ chi tiết (Hà Nội) * <em id="obMgrDistrictHint" style="font-weight:500;">' + (detectedDist ? '• Quận ' + escHtml(detectedDist) : '') + '</em></span>' +
            '<input type="text" id="obMgrAddress" value="' + escHtml(st.address) + '" placeholder="Số nhà, ngõ/phố, phường, quận..." />' +
            '<span class="ob-field-error"></span>' +
          '</label>' +
          '<label class="ob-field">' +
            '<span>Ghi chú mặc định cho tài xế</span>' +
            '<input type="text" id="obMgrNote" value="' + escHtml(st.driverNote) + '" placeholder="VD: Gọi trước khi tới cổng..." />' +
          '</label>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:10px;">' +
            '<label style="display:inline-flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;">' +
              '<input type="checkbox" id="obMgrDefault" ' + (st.isDefault ? 'checked' : '') + ' />' +
              '<span>Đặt làm địa chỉ mặc định</span>' +
            '</label>' +
            '<div style="display:flex; gap:8px;">' +
              (st.editingId ? '<button type="button" id="btnCancelMgrAddr" class="ob-btn-ghost">Hủy sửa</button>' : '') +
              '<button type="button" id="btnSaveMgrAddr" class="ob-btn-primary">' + (st.editingId ? '💾 Cập nhật địa chỉ' : '➕ Lưu vào sổ địa chỉ') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        cardsHtml +
      '</div>';

    var mgrLabels = content.querySelectorAll('[data-mgr-label]');
    for (var i = 0; i < mgrLabels.length; i++) {
      (function (pill) {
        pill.addEventListener('click', function () {
          addrManagerState.label = pill.getAttribute('data-mgr-label');
          for (var x = 0; x < mgrLabels.length; x++) {
            mgrLabels[x].classList.toggle('active', mgrLabels[x] === pill);
          }
          if ($('obMgrCustomLabel')) {
            $('obMgrCustomLabel').style.display = addrManagerState.label === 'other' ? 'block' : 'none';
          }
        });
      })(mgrLabels[i]);
    }

    if ($('obMgrCustomLabel')) $('obMgrCustomLabel').addEventListener('input', function (e) { addrManagerState.customLabel = e.target.value; });
    if ($('obMgrName')) $('obMgrName').addEventListener('input', function (e) { addrManagerState.name = e.target.value; });
    if ($('obMgrPhone')) $('obMgrPhone').addEventListener('input', function (e) { addrManagerState.phone = e.target.value; });
    if ($('obMgrAddress')) {
      $('obMgrAddress').addEventListener('input', function (e) {
        addrManagerState.address = e.target.value;
        var dh = $('obMgrDistrictHint');
        if (dh) {
          var d = detectDistrictFromAddress(e.target.value);
          dh.textContent = d ? '• Quận ' + d : '';
        }
      });
    }
    if ($('obMgrNote')) $('obMgrNote').addEventListener('input', function (e) { addrManagerState.driverNote = e.target.value; });
    if ($('obMgrDefault')) $('obMgrDefault').addEventListener('change', function (e) { addrManagerState.isDefault = e.target.checked; });

    if ($('btnCancelMgrAddr')) {
      $('btnCancelMgrAddr').addEventListener('click', function () {
        addrManagerState = { editingId: '', label: 'home', customLabel: '', name: '', phone: '', address: '', driverNote: '', isDefault: false };
        renderOrdersHubContent();
      });
    }

    if ($('btnSaveMgrAddr')) {
      $('btnSaveMgrAddr').addEventListener('click', function () {
        var name = strTrim($('obMgrName') ? $('obMgrName').value : '');
        var phone = strTrim($('obMgrPhone') ? $('obMgrPhone').value : '');
        var address = strTrim($('obMgrAddress') ? $('obMgrAddress').value : '');
        var okName = name.length >= 2;
        var phoneRes = validatePhoneStr(phone);
        var okAddr = address.length >= 5;

        setFieldValidationUI('obMgrName', okName, 'Nhập họ tên người nhận (tối thiểu 2 ký tự).', true);
        setFieldValidationUI('obMgrPhone', phoneRes.ok, phoneRes.msg, true);
        setFieldValidationUI('obMgrAddress', okAddr, 'Nhập địa chỉ cụ thể (tối thiểu 5 ký tự).', true);

        if (!okName || !phoneRes.ok || !okAddr) {
          showToast('Vui lòng kiểm tra lại thông tin địa chỉ!', '⚠️');
          return;
        }

        var isEditing = Boolean(addrManagerState.editingId);
        saveAddress({
          id: addrManagerState.editingId || undefined,
          label: addrManagerState.label,
          customLabel: addrManagerState.customLabel,
          recipientName: name,
          phone: phone,
          address: address,
          district: detectDistrictFromAddress(address),
          driverNote: strTrim($('obMgrNote') ? $('obMgrNote').value : ''),
          isDefault: $('obMgrDefault') ? $('obMgrDefault').checked : false,
          incrementUse: !isEditing
        });

        addrManagerState = { editingId: '', label: 'home', customLabel: '', name: '', phone: '', address: '', driverNote: '', isDefault: false };
        showToast(isEditing ? 'Đã cập nhật địa chỉ!' : 'Đã thêm địa chỉ mới vào sổ!', '📍');
        renderOrdersHubContent();
      });
    }

    var defBtns = content.querySelectorAll('[data-addr-default]');
    for (var d = 0; d < defBtns.length; d++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          setDefaultSavedAddress(btn.getAttribute('data-addr-default'));
          showToast('Đã đặt làm địa chỉ mặc định!', '⭐');
          renderOrdersHubContent();
        });
      })(defBtns[d]);
    }

    var editBtns = content.querySelectorAll('[data-addr-edit]');
    for (var eb = 0; eb < editBtns.length; eb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-addr-edit');
          var obj = arrFind(getSavedAddresses(), function (x) { return x.id === id; });
          if (!obj) return;
          addrManagerState = {
            editingId: obj.id,
            label: obj.label || 'home',
            customLabel: obj.customLabel || '',
            name: obj.recipientName || '',
            phone: obj.phone || '',
            address: obj.address || '',
            driverNote: obj.driverNote || '',
            isDefault: Boolean(obj.isDefault)
          };
          renderOrdersHubContent();
        });
      })(editBtns[eb]);
    }

    var delBtns = content.querySelectorAll('[data-addr-del]');
    for (var db = 0; db < delBtns.length; db++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-addr-del');
          var acct = getCurrentAccountKey();
          var snapshot = arrFind(getSavedAddresses(acct), function (x) { return x.id === id; });
          if (!snapshot) return;
          if (deleteSavedAddress(id, acct)) {
            if (addrManagerState.editingId === id) {
              addrManagerState.editingId = '';
            }
            renderOrdersHubContent();
            triggerUndo('Đã xóa địa chỉ "' + snapshot.address + '"', function () {
              restoreAddressSnapshot(snapshot, acct);
              if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open') && activeHubTab === 'addresses') {
                renderOrdersHubContent();
              }
            });
          }
        });
      })(delBtns[db]);
    }
  }

  function renderOrdersHubContent() {
    var content = $('ordersHubContent');
    if (!content) return;

    var orders = getOrders();
    var reserves = getReservations();
    updateHubBadges();

    if (activeHubTab === 'addresses') {
      renderAddressBookManager(content);
      return;
    }

    if (activeHubTab === 'delivery') {
      if (!orders.length) {
        content.innerHTML =
          '<div class="ob-empty-hub">' +
            '<div style="font-size:2.6rem;">🛵</div>' +
            '<h3>Chưa có đơn giao hàng nào</h3>' +
            '<p>Hãy chọn một quán ăn trên danh sách và bấm <strong>🛵 Đặt giao</strong> để trải nghiệm giao món tận nơi!</p>' +
          '</div>';
        return;
      }

      var nowMs = Date.now();
      content.innerHTML = orders.map(function (o) {
        var live = computeOrderLiveState(o, nowMs);
        var statusLabel = live.cancelled ? '❌ Đã hủy' : (live.statusIcon + ' ' + live.statusLabel);
        var itemsSummary = (o.items || []).map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');

        return (
          '<div class="ob-hub-card ' + (live.cancelled ? 'cancelled' : '') + '" data-rt-order-id="' + escHtml(o.id) + '">' +
            '<div class="ob-hub-card-top">' +
              '<div>' +
                '<span class="ob-hub-code">' + escHtml(o.id) + '</span>' +
                '<strong>' + escHtml(o.restaurantName) + '</strong>' +
              '</div>' +
              '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
                (!live.cancelled ? '<span class="ob-rt-eta-pill">' + escHtml(live.etaText) + '</span>' : '') +
                '<span class="ob-hub-status ' + (live.cancelled ? 'cancel' : (live.isCompleted ? 'done' : 'active')) + '">' + escHtml(statusLabel) + '</span>' +
              '</div>' +
            '</div>' +
            (!live.cancelled
              ? '<div class="ob-rt-progress-wrap" style="margin:6px 0 8px;">' +
                  '<div class="ob-rt-progress-track"><div class="ob-rt-progress-fill" style="width:' + live.progressPct + '%"></div></div>' +
                '</div>'
              : '') +
            '<p class="ob-hub-items">🥢 ' + escHtml(itemsSummary) + '</p>' +
            '<div class="ob-hub-meta">' +
              '<span>📍 ' + escHtml(o.deliveryAddress) + '</span>' +
              '<span>💰 <strong>' + fmtVnd(o.total) + '</strong></span>' +
            '</div>' +
            '<div class="ob-hub-actions">' +
              (!live.cancelled && !live.isCompleted
                ? '<button type="button" class="ob-btn-secondary" data-hub-track="' + escHtml(o.id) + '">📍 Theo dõi trực tiếp</button>'
                : '') +
              '<button type="button" class="ob-btn-secondary" data-hub-reorder="' + o.restaurantId + '" data-hub-reorder-id="' + escHtml(o.id) + '">🔄 Đặt lại</button>' +
              (!live.cancelled && typeof window.openBillSplitterForPlace === 'function'
                ? '<button type="button" class="ob-btn-secondary" data-hub-bill="' + escHtml(o.restaurantName) + '" data-hub-bill-id="' + escHtml(o.id) + '">🧾 Chia bill</button>'
                : '') +
              (live.canEditOrCancel
                ? '<span class="ob-hub-cancel-wrap" data-cancel-order-wrap="' + escHtml(o.id) + '"><button type="button" class="ob-btn-danger" data-hub-cancel-order="' + escHtml(o.id) + '">✕ Hủy đơn</button></span>'
                : '') +
            '</div>' +
          '</div>'
        );
      }).join('');

      var trackBtns = content.querySelectorAll('[data-hub-track]');
      for (var tb = 0; tb < trackBtns.length; tb++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var oid = btn.getAttribute('data-hub-track');
            var order = arrFind(getOrders(), function (x) { return x.id === oid; });
            if (!order) return;
            var rest = findRestaurantById(order.restaurantId);
            activeDeliveryState.restaurant = rest || { id: order.restaurantId, name: order.restaurantName, district: order.district };
            activeDeliveryState.trackingOrderId = oid;
            if ($('ordersHubModal')) $('ordersHubModal').classList.remove('open');
            renderDeliveryModal();
            if ($('deliveryModal')) $('deliveryModal').classList.add('open');
          });
        })(trackBtns[tb]);
      }

      var reorderBtns = content.querySelectorAll('[data-hub-reorder]');
      for (var rb = 0; rb < reorderBtns.length; rb++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var rid = parseInt(btn.getAttribute('data-hub-reorder'), 10);
            var oid = btn.getAttribute('data-hub-reorder-id');
            var prevOrder = oid ? arrFind(getOrders(), function (x) { return x.id === oid; }) : null;
            if ($('ordersHubModal')) $('ordersHubModal').classList.remove('open');
            openDelivery(rid, prevOrder ? prevOrder.items : null, prevOrder ? {
              name: prevOrder.customerName,
              phone: prevOrder.customerPhone,
              address: prevOrder.deliveryAddress,
              driverNote: prevOrder.driverNote
            } : null);
          });
        })(reorderBtns[rb]);
      }

      var billBtns = content.querySelectorAll('[data-hub-bill]');
      for (var bb = 0; bb < billBtns.length; bb++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var oid = btn.getAttribute('data-hub-bill-id');
            var place = btn.getAttribute('data-hub-bill');
            var order = oid ? arrFind(getOrders(), function (x) { return x.id === oid; }) : null;
            if ($('ordersHubModal')) $('ordersHubModal').classList.remove('open');
            if (order) {
              openBillForOrder(order);
            } else if (typeof window.openBillSplitterForPlace === 'function') {
              window.openBillSplitterForPlace(place);
            }
          });
        })(billBtns[bb]);
      }

      function bindHubOrderCancel(btn) {
        btn.addEventListener('click', function () {
          var oid = btn.getAttribute('data-hub-cancel-order');
          var wrap = content.querySelector('[data-cancel-order-wrap="' + oid + '"]');
          if (!wrap) return;
          wrap.innerHTML =
            '<span class="ob-confirm-inline"><span>Hủy đơn này?</span>' +
            '<button type="button" class="ob-btn-danger" data-confirm-co="' + escHtml(oid) + '">Xác nhận</button>' +
            '<button type="button" class="ob-btn-ghost" data-abort-co="' + escHtml(oid) + '">Không</button></span>';

          wrap.querySelector('[data-confirm-co]').addEventListener('click', function () {
            var list = getOrders();
            var idx = arrFindIndex(list, function (x) { return x.id === oid; });
            if (idx !== -1) {
              list[idx].cancelled = true;
              saveOrders(list);
              showToast('Đã hủy đơn hàng ' + oid, 'ℹ️');
              renderOrdersHubContent();
              triggerUndo('Đã hủy đơn hàng ' + oid, function () {
                var l2 = getOrders();
                var i2 = arrFindIndex(l2, function (x) { return x.id === oid; });
                if (i2 !== -1) {
                  l2[i2].cancelled = false;
                  saveOrders(l2);
                  if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open')) {
                    renderOrdersHubContent();
                  }
                }
              });
            }
          });
          wrap.querySelector('[data-abort-co]').addEventListener('click', function () {
            wrap.innerHTML = '<button type="button" class="ob-btn-danger" data-hub-cancel-order="' + escHtml(oid) + '">✕ Hủy đơn</button>';
            bindHubOrderCancel(wrap.querySelector('[data-hub-cancel-order]'));
          });
        });
      }

      var cancelBtns = content.querySelectorAll('[data-hub-cancel-order]');
      for (var cb = 0; cb < cancelBtns.length; cb++) {
        bindHubOrderCancel(cancelBtns[cb]);
      }
      return;
    }

    // Reservations Tab
    if (!reserves.length) {
      content.innerHTML =
        '<div class="ob-empty-hub">' +
          '<div style="font-size:2.6rem;">🪑</div>' +
          '<h3>Chưa có lịch đặt bàn nào</h3>' +
          '<p>Các nhà hàng có nhãn <strong>🪑 Đặt bàn</strong> cho phép giữ chỗ trước. Hãy chọn nhà hàng bạn thích để đặt bàn nhé!</p>' +
        '</div>';
      return;
    }

    var nowMsRes = Date.now();
    content.innerHTML = reserves.map(function (b) {
      var areaObj = arrFind(SEATING_AREAS, function (a) { return a.id === b.seating; }) || SEATING_AREAS[0];
      var liveRes = computeReservationLiveState(b, nowMsRes);
      var isCancelled = liveRes.status === 'cancelled';

      return (
        '<div class="ob-hub-card ' + (isCancelled ? 'cancelled' : '') + '" data-rt-res-id="' + escHtml(b.code) + '">' +
          '<div class="ob-hub-card-top">' +
            '<div>' +
              '<span class="ob-hub-code">' + escHtml(b.code) + '</span>' +
              '<strong>' + escHtml(b.restaurantName) + '</strong>' +
            '</div>' +
            '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
              '<span class="ob-res-countdown">' + escHtml(liveRes.countdownText) + '</span>' +
              '<span class="ob-res-status-badge ' + escHtml(liveRes.status) + '">' + escHtml(liveRes.label) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="ob-hub-meta">' +
            '<span>📅 ' + escHtml(b.date) + ' lúc <strong>' + escHtml(b.timeSlot) + '</strong></span>' +
            '<span>👥 ' + b.guests + ' khách • ' + escHtml(areaObj.label) + '</span>' +
          '</div>' +
          (b.preOrderDishes && b.preOrderDishes.length
            ? '<p class="ob-hub-items">🍲 Đặt trước: ' + escHtml(b.preOrderDishes.join(', ')) + '</p>'
            : '') +
          '<div class="ob-hub-actions">' +
            (liveRes.canCheckIn
              ? '<button type="button" class="ob-btn-primary" data-hub-checkin="' + escHtml(b.code) + '">✓ Check-in</button>'
              : '') +
            (liveRes.canReschedule
              ? '<button type="button" class="ob-btn-secondary" data-hub-reschedule="' + escHtml(b.code) + '">🕒 Đổi giờ</button>'
              : '') +
            '<button type="button" class="ob-btn-secondary" data-hub-copy-code="' + escHtml(b.code) + '">📋 Copy mã</button>' +
            (liveRes.canCancel
              ? '<span class="ob-hub-cancel-wrap" data-cancel-res-wrap="' + escHtml(b.code) + '"><button type="button" class="ob-btn-danger" data-hub-cancel-res="' + escHtml(b.code) + '">✕ Hủy đặt bàn</button></span>'
              : '') +
          '</div>' +
        '</div>'
      );
    }).join('');

    var checkInBtns = content.querySelectorAll('[data-hub-checkin]');
    for (var ci = 0; ci < checkInBtns.length; ci++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-hub-checkin');
          var list = getReservations();
          var idx = arrFindIndex(list, function (x) { return x.code === code; });
          if (idx !== -1) {
            list[idx].status = 'checked_in';
            list[idx].checkedInAt = new Date().toISOString();
            saveReservations(list);
            showToast('Check-in thành công cho bàn ' + code + '!', '🏮');
            renderOrdersHubContent();
          }
        });
      })(checkInBtns[ci]);
    }

    var reschedBtns = content.querySelectorAll('[data-hub-reschedule]');
    for (var rs = 0; rs < reschedBtns.length; rs++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-hub-reschedule');
          var booking = arrFind(getReservations(), function (x) { return x.code === code; });
          if (!booking) return;
          if ($('ordersHubModal')) $('ordersHubModal').classList.remove('open');
          openReservation(booking.restaurantId, booking);
        });
      })(reschedBtns[rs]);
    }

    var copyBtns = content.querySelectorAll('[data-hub-copy-code]');
    for (var cp = 0; cp < copyBtns.length; cp++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-hub-copy-code');
          if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
          showToast('Đã sao chép mã ' + code, '📋');
        });
      })(copyBtns[cp]);
    }

    function bindHubResCancel(btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-hub-cancel-res');
        var wrap = content.querySelector('[data-cancel-res-wrap="' + code + '"]');
        if (!wrap) return;
        wrap.innerHTML =
          '<span class="ob-confirm-inline"><span>Hủy lịch đặt bàn?</span>' +
          '<button type="button" class="ob-btn-danger" data-confirm-cr="' + escHtml(code) + '">Xác nhận</button>' +
          '<button type="button" class="ob-btn-ghost" data-abort-cr="' + escHtml(code) + '">Không</button></span>';

        wrap.querySelector('[data-confirm-cr]').addEventListener('click', function () {
          var list = getReservations();
          var idx = arrFindIndex(list, function (x) { return x.code === code; });
          if (idx !== -1) {
            var prevStatus = list[idx].status || 'confirmed';
            list[idx].status = 'cancelled';
            saveReservations(list);
            showToast('Đã hủy lịch đặt bàn ' + code, 'ℹ️');
            renderOrdersHubContent();
            triggerUndo('Đã hủy lịch đặt bàn ' + code, function () {
              var l2 = getReservations();
              var i2 = arrFindIndex(l2, function (x) { return x.code === code; });
              if (i2 !== -1) {
                l2[i2].status = prevStatus;
                saveReservations(l2);
                if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open')) {
                  renderOrdersHubContent();
                }
              }
            });
          }
        });
        wrap.querySelector('[data-abort-cr]').addEventListener('click', function () {
          wrap.innerHTML = '<button type="button" class="ob-btn-danger" data-hub-cancel-res="' + escHtml(code) + '">✕ Hủy đặt bàn</button>';
          bindHubResCancel(wrap.querySelector('[data-hub-cancel-res]'));
        });
      });
    }

    var cancelResBtns = content.querySelectorAll('[data-hub-cancel-res]');
    for (var cr = 0; cr < cancelResBtns.length; cr++) {
      bindHubResCancel(cancelResBtns[cr]);
    }
  }

  function updateHubBadges() {
    if (typeof document === 'undefined') return;
    var orders = getOrders();
    var reserves = getReservations();
    var addresses = getSavedAddresses();
    var nowMs = Date.now();

    var activeOrders = 0;
    for (var i = 0; i < orders.length; i++) {
      if (!orders[i].cancelled && !computeOrderLiveState(orders[i], nowMs).isCompleted) {
        activeOrders++;
      }
    }
    var activeReserves = 0;
    for (var j = 0; j < reserves.length; j++) {
      var st = computeReservationLiveState(reserves[j], nowMs).status;
      if (st === 'upcoming' || st === 'arriving_soon') {
        activeReserves++;
      }
    }

    var totalText = String(activeOrders + activeReserves);
    if ($('ordersHubCountBadge')) $('ordersHubCountBadge').textContent = totalText;
    if ($('navOrdersBadge')) $('navOrdersBadge').textContent = totalText;
    if ($('obTabDeliveryCount')) $('obTabDeliveryCount').textContent = String(orders.length);
    if ($('obTabReserveCount')) $('obTabReserveCount').textContent = String(reserves.length);
    if ($('obTabAddressCount')) $('obTabAddressCount').textContent = String(addresses.length);
  }

  // --- SINGLE 1-SECOND REAL-TIME TICKER ---
  function onRealtimeTick() {
    if (typeof document === 'undefined') return;
    var nowDate = new Date();
    var nowMs = nowDate.getTime();
    var hms = formatTimeHMS(nowDate);

    // Update all live clocks
    var clocks = document.querySelectorAll('[data-rt-clock]');
    for (var c = 0; c < clocks.length; c++) {
      clocks[c].textContent = hms;
    }

    // Update Delivery Tracking View if open (targeted updates only!)
    var delivModal = $('deliveryModal');
    if (delivModal && delivModal.classList.contains('open') && activeDeliveryState.trackingOrderId) {
      var trackEl = delivModal.querySelector('[data-rt-order-id="' + activeDeliveryState.trackingOrderId + '"]');
      var order = arrFind(getOrders(), function (o) { return o.id === activeDeliveryState.trackingOrderId; });
      if (trackEl && order) {
        var live = computeOrderLiveState(order, nowMs);
        var fill = trackEl.querySelector('.ob-rt-progress-fill');
        if (fill) fill.style.width = live.progressPct + '%';
        var etaPill = trackEl.querySelector('.ob-rt-eta-pill');
        if (etaPill) etaPill.textContent = live.etaText;

        var steps = trackEl.querySelectorAll('.ob-track-step');
        for (var s = 0; s < steps.length; s++) {
          var idx = parseInt(steps[s].getAttribute('data-step-idx'), 10);
          steps[s].classList.toggle('done', !live.cancelled && live.statusIndex >= idx);
          steps[s].classList.toggle('current', !live.cancelled && live.statusIndex === idx);
          var tEl = steps[s].querySelector('.ob-rt-step-time');
          if (tEl && live.stageTimes[idx]) tEl.textContent = live.stageTimes[idx];
        }

        if (live.statusIndex !== lastRenderedTrackStep) {
          lastRenderedTrackStep = live.statusIndex;
          if (!live.canEditOrCancel && $('obTrackCancelWrap')) {
            $('obTrackCancelWrap').style.display = 'none';
          }
          if (live.isCompleted && $('btnSimNextStep')) {
            $('btnSimNextStep').style.display = 'none';
          }
          updateHubBadges();
        }
      }
    }

    // Update Orders Hub live cards without wiping DOM or interrupting user
    var hubModal = $('ordersHubModal');
    if (hubModal && hubModal.classList.contains('open')) {
      if (activeHubTab === 'delivery') {
        var orders = getOrders();
        var orderCards = hubModal.querySelectorAll('[data-rt-order-id]');
        for (var oc = 0; oc < orderCards.length; oc++) {
          var oid = orderCards[oc].getAttribute('data-rt-order-id');
          var ord = arrFind(orders, function (x) { return x.id === oid; });
          if (!ord) continue;
          var oLive = computeOrderLiveState(ord, nowMs);
          var oFill = orderCards[oc].querySelector('.ob-rt-progress-fill');
          if (oFill) oFill.style.width = oLive.progressPct + '%';
          var oEta = orderCards[oc].querySelector('.ob-rt-eta-pill');
          if (oEta) oEta.textContent = oLive.etaText;
          var oBadge = orderCards[oc].querySelector('.ob-hub-status');
          if (oBadge && !oLive.cancelled) {
            oBadge.textContent = oLive.statusIcon + ' ' + oLive.statusLabel;
            oBadge.className = 'ob-hub-status ' + (oLive.isCompleted ? 'done' : 'active');
          }
          if (!oLive.canEditOrCancel) {
            var cWrap = orderCards[oc].querySelector('.ob-hub-cancel-wrap');
            if (cWrap) cWrap.style.display = 'none';
          }
        }
      } else if (activeHubTab === 'reservations') {
        var reserves = getReservations();
        var resCards = hubModal.querySelectorAll('[data-rt-res-id]');
        for (var rc = 0; rc < resCards.length; rc++) {
          var code = resCards[rc].getAttribute('data-rt-res-id');
          var resObj = arrFind(reserves, function (x) { return x.code === code; });
          if (!resObj) continue;
          var rLive = computeReservationLiveState(resObj, nowMs);
          var cdEl = resCards[rc].querySelector('.ob-res-countdown');
          if (cdEl) cdEl.textContent = rLive.countdownText;
          var rBadge = resCards[rc].querySelector('.ob-res-status-badge');
          if (rBadge) {
            rBadge.textContent = rLive.label;
            rBadge.className = 'ob-res-status-badge ' + rLive.status;
          }
        }
      }
    }

    // Update Reservation Modal slot buffers only when minute rolls over
    var resModal = $('reservationModal');
    if (resModal && resModal.classList.contains('open') && activeReserveState.restaurant && $('obResSlotsSection')) {
      var curMin = formatTimeHHMM(nowMs);
      if (curMin !== activeReserveState.lastSlotRenderMinute) {
        activeReserveState.lastSlotRenderMinute = curMin;
        var slotBtns = $('obResSlotsSection').querySelectorAll('[data-slot]');
        var curResList = getReservations();
        for (var sb = 0; sb < slotBtns.length; sb++) {
          var sVal = slotBtns[sb].getAttribute('data-slot');
          var av = computeSlotAvailability(activeReserveState.restaurant.id, activeReserveState.date, sVal, curResList, nowDate);
          var isDisabled = (av.status === 'past' || av.status === 'full');
          slotBtns[sb].disabled = isDisabled;
          slotBtns[sb].classList.toggle('slot-past', av.status === 'past');
          slotBtns[sb].classList.toggle('slot-closed-hours', av.status === 'closed_hours');
          slotBtns[sb].classList.toggle('slot-full', av.status === 'full');
          slotBtns[sb].classList.toggle('slot-low', av.status === 'low');
          if (av.status === 'closed_hours') {
            slotBtns[sb].setAttribute('aria-disabled', 'true');
          } else {
            slotBtns[sb].removeAttribute('aria-disabled');
          }
          var capEl = slotBtns[sb].querySelector('.ob-slot-cap');
          if (capEl) capEl.textContent = av.label;
        }
      }
    }
  }

  function startRealtimeTicker() {
    if (realtimeTicker) clearInterval(realtimeTicker);
    realtimeTicker = setInterval(onRealtimeTick, 1000);
  }

  // --- INITIALIZATION & EVENT WIRING ---
  function handleExternalSync() {
    updateHubBadges();
    updateLiveSyncUI('Đồng bộ tức thì ' + formatTimeHMS(new Date()));

    if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open')) {
      renderOrdersHubContent();
    }
    if ($('deliveryModal') && $('deliveryModal').classList.contains('open') && activeDeliveryState.trackingOrderId) {
      renderDeliveryModal();
    }
  }

  function initOrderBooking() {
    if (typeof document === 'undefined') return;
    updateHubBadges();
    startRealtimeTicker();

    // BroadcastChannel multi-tab sync
    if (typeof BroadcastChannel === 'function') {
      try {
        syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        syncChannel.onmessage = function () {
          handleExternalSync();
        };
      } catch (e) {
        syncChannel = null;
      }
    }

    // Storage fallback sync across tabs
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', function (e) {
        if (!e || !e.key ||
            e.key === ORDERS_KEY ||
            e.key === RESERVES_KEY ||
            e.key === SAVED_ADDRESSES_KEY ||
            e.key === DRAFT_CART_KEY) {
          handleExternalSync();
        }
      });

      window.addEventListener('hn-auth-changed', function () {
        updateHubBadges();
        if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open') && activeHubTab === 'addresses') {
          addrManagerState = { editingId: '', label: 'home', customLabel: '', name: '', phone: '', address: '', driverNote: '', isDefault: false };
          renderOrdersHubContent();
        }
        if ($('deliveryModal') && $('deliveryModal').classList.contains('open') && !activeDeliveryState.trackingOrderId) {
          var prof = getSavedProfile();
          activeDeliveryState.selectedAddressId = prof.addressId || '';
          if (!strTrim(activeDeliveryState.form.address) && prof.address) {
            activeDeliveryState.form.name = prof.name;
            activeDeliveryState.form.phone = prof.phone;
            activeDeliveryState.form.address = prof.address;
            activeDeliveryState.form.driverNote = prof.driverNote;
          }
          renderDeliveryModal();
        }
      });
    }

    if ($('btnOpenOrdersHubHero')) {
      $('btnOpenOrdersHubHero').addEventListener('click', function () {
        openOrdersHub('delivery');
      });
    }

    if ($('btnCloseDeliveryModal')) {
      $('btnCloseDeliveryModal').addEventListener('click', function () {
        if ($('deliveryModal')) $('deliveryModal').classList.remove('open');
      });
    }
    if ($('deliveryModal')) {
      $('deliveryModal').addEventListener('click', function (e) {
        if (e.target === $('deliveryModal')) {
          $('deliveryModal').classList.remove('open');
        }
      });
    }

    if ($('btnCloseReservationModal')) {
      $('btnCloseReservationModal').addEventListener('click', function () {
        if ($('reservationModal')) $('reservationModal').classList.remove('open');
      });
    }
    if ($('reservationModal')) {
      $('reservationModal').addEventListener('click', function (e) {
        if (e.target === $('reservationModal')) {
          $('reservationModal').classList.remove('open');
        }
      });
    }

    if ($('btnCloseOrdersHubModal')) {
      $('btnCloseOrdersHubModal').addEventListener('click', function () {
        if ($('ordersHubModal')) $('ordersHubModal').classList.remove('open');
      });
    }
    if ($('ordersHubModal')) {
      $('ordersHubModal').addEventListener('click', function (e) {
        if (e.target === $('ordersHubModal')) {
          $('ordersHubModal').classList.remove('open');
        }
      });
    }

    var hubTabs = document.querySelectorAll('[data-ob-tab]');
    for (var ht = 0; ht < hubTabs.length; ht++) {
      (function (tabBtn) {
        tabBtn.addEventListener('click', function () {
          setHubTabUI(tabBtn.getAttribute('data-ob-tab') || 'delivery');
          renderOrdersHubContent();
        });
      })(hubTabs[ht]);
    }

    if ($('obUndoBtn')) {
      $('obUndoBtn').addEventListener('click', function () {
        var fn = activeUndoState;
        hideUndoBar();
        if (typeof fn === 'function') {
          fn();
          showToast('Đã hoàn tác thao tác vừa rồi!', '↩️');
        }
      });
    }
    if ($('obUndoClose')) {
      $('obUndoClose').addEventListener('click', hideUndoBar);
    }

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if ($('deliveryModal') && $('deliveryModal').classList.contains('open') && !activeDeliveryState.trackingOrderId) {
          e.preventDefault();
          submitDeliveryOrder();
          return;
        }
        if ($('reservationModal') && $('reservationModal').classList.contains('open') && $('btnConfirmReservation')) {
          e.preventDefault();
          submitReservation();
          return;
        }
      }

      if (e.key === 'Escape') {
        if ($('deliveryModal') && $('deliveryModal').classList.contains('open')) {
          $('deliveryModal').classList.remove('open');
          return;
        }
        if ($('reservationModal') && $('reservationModal').classList.contains('open')) {
          $('reservationModal').classList.remove('open');
          return;
        }
        if ($('ordersHubModal') && $('ordersHubModal').classList.contains('open')) {
          $('ordersHubModal').classList.remove('open');
          return;
        }
        if ($('obUndoBar') && $('obUndoBar').classList.contains('show')) {
          hideUndoBar();
        }
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.HNOrderBooking = {
      canReserve: canReserve,
      canDeliver: canDeliver,
      getDeliveryMeta: getDeliveryMeta,
      openDelivery: openDelivery,
      openReservation: openReservation,
      openOrdersHub: openOrdersHub,
      computeOrderLiveState: computeOrderLiveState,
      computeSlotAvailability: computeSlotAvailability,
      computeReservationLiveState: computeReservationLiveState,
      getSavedAddresses: getSavedAddresses,
      saveAddress: saveAddress,
      deleteSavedAddress: deleteSavedAddress,
      setDefaultSavedAddress: setDefaultSavedAddress,
      detectDistrictFromAddress: detectDistrictFromAddress
    };
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', initOrderBooking);
  }
})();
