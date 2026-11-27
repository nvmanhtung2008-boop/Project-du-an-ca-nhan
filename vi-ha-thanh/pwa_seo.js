/* ==========================================================================
   HÀ NỘI PHỐ VỊ — PWA & DYNAMIC SEO MODULE (ES5 IIFE)
   - window.HNSeo: Dynamic Title, Meta, OG Tags, Schema.org JSON-LD, Deep Links
   - window.HNPwa: Service Worker Registration, Install Prompt, Install Guide Modal
   ========================================================================== */
(function () {
  'use strict';

  var HOME_TITLE = 'Hà Nội Phố Vị - Cẩm Nang Ẩm Thực & Quán Ngon Cổ Điển';
  var HOME_DESC = 'Trang web gợi ý 2400 quán ăn, nhà hàng đặc sản Hà Nội với định vị Google Maps, bộ lọc đa chiều theo giá, số người, địa điểm, sự kiện và máy Gashapon chọn món ngẫu nhiên độc đáo.';
  var HOME_OG_TITLE = 'Hà Nội Phố Vị - Cẩm Nang Ẩm Thực & Quán Ngon Hà Nội';
  var HOME_OG_DESC = 'Khám phá 2400 quán ăn chuẩn vị Hà Nội, đặt món/đặt bàn real-time, tìm kiếm ngôn ngữ tự nhiên, bình chọn nhóm và gợi ý cá nhân hóa.';

  var FALLBACK_DISTRICTS = [
    'Hà Đông', 'Hoàn Kiếm', 'Ba Đình', 'Cầu Giấy', 'Đống Đa',
    'Hai Bà Trưng', 'Tây Hồ', 'Thanh Xuân', 'Nam Từ Liêm',
    'Bắc Từ Liêm', 'Long Biên', 'Hoàng Mai'
  ];

  var currentJsonLd = null;

  /* ---- Helpers ---- */
  function $(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
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

  function isFileProtocol() {
    return typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
  }

  function getBasePageUrl() {
    if (typeof window === 'undefined' || !window.location) return 'index.html';
    var href = String(window.location.href || '');
    return href.split('#')[0].split('?')[0] || 'index.html';
  }

  function parseQueryParams() {
    var out = {};
    if (typeof window === 'undefined' || !window.location || !window.location.search) return out;
    var search = window.location.search;
    if (search.charAt(0) === '?') search = search.slice(1);
    if (!search) return out;
    var parts = search.split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var key = '';
      var val = '';
      try { key = decodeURIComponent(kv[0].replace(/\+/g, ' ')); } catch (e1) { key = kv[0]; }
      try { val = kv.length > 1 ? decodeURIComponent(kv.slice(1).join('=').replace(/\+/g, ' ')) : ''; } catch (e2) { val = kv.slice(1).join('='); }
      if (key) out[key] = val;
    }
    return out;
  }

  function getAllDistrictNames() {
    var list = [];
    if (typeof FILTER_METADATA !== 'undefined' && FILTER_METADATA && FILTER_METADATA.districts) {
      for (var i = 0; i < FILTER_METADATA.districts.length; i++) {
        var d = FILTER_METADATA.districts[i];
        if (d && d.key && d.key !== 'all') {
          list.push(d.key);
        }
      }
    }
    if (list.length === 0) return FALLBACK_DISTRICTS.slice();
    return list;
  }

  function getAllRestaurantsSafe() {
    if (typeof window !== 'undefined' && window.HNAppBridge && typeof window.HNAppBridge.getAllRestaurants === 'function') {
      return window.HNAppBridge.getAllRestaurants() || [];
    }
    if (typeof RESTAURANTS_DATA !== 'undefined' && RESTAURANTS_DATA) {
      return RESTAURANTS_DATA;
    }
    return [];
  }

  /* ---- Meta & JSON-LD DOM Updaters ---- */
  function setMetaContent(selector, attrName, attrVal, content) {
    if (typeof document === 'undefined') return;
    var el = document.querySelector(selector);
    if (!el && document.head) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    if (el) {
      el.setAttribute('content', content);
    }
  }

  function setSeoTags(title, desc, ogTitle, ogDesc) {
    if (typeof document === 'undefined') return;
    document.title = title;
    setMetaContent('meta[name="description"]', 'name', 'description', desc);
    setMetaContent('meta[property="og:title"]', 'property', 'og:title', ogTitle || title);
    setMetaContent('meta[property="og:description"]', 'property', 'og:description', ogDesc || desc);
  }

  function setJsonLd(obj) {
    currentJsonLd = obj;
    if (typeof document === 'undefined') return;
    var script = $('seoJsonLd');
    if (!script && document.head) {
      script = document.createElement('script');
      script.id = 'seoJsonLd';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    if (script) {
      try {
        script.textContent = JSON.stringify(obj);
      } catch (e) {}
    }
  }

  function buildShareableDistrictUrl(slug) {
    var base = getBasePageUrl();
    if (isFileProtocol()) {
      return base + '#quan-' + slug;
    }
    return base + '?district=' + encodeURIComponent(slug);
  }

  function buildShareablePlaceUrl(id) {
    var base = getBasePageUrl();
    if (isFileProtocol()) {
      return base + '#quan-' + encodeURIComponent(String(id));
    }
    return base + '?place=' + encodeURIComponent(String(id));
  }

  function safeUpdateUrl(mode, paramVal) {
    if (typeof window === 'undefined' || !window.location) return;
    if (isFileProtocol()) {
      var targetHash = '';
      if (mode === 'district' && paramVal) targetHash = '#quan-' + paramVal;
      else if (mode === 'place' && paramVal) targetHash = '#quan-' + paramVal;
      if (targetHash && window.location.hash !== targetHash) {
        try {
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState(null, '', targetHash);
          } else {
            window.location.hash = targetHash;
          }
        } catch (e1) {}
      } else if (mode === 'home' && window.location.hash && window.location.hash.indexOf('#quan-') === 0) {
        try {
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState(null, '', getBasePageUrl());
          }
        } catch (e2) {}
      }
      return;
    }

    if (!window.history || typeof window.history.replaceState !== 'function') return;
    try {
      var params = parseQueryParams();
      var nextSearch = '';
      var keys = [];
      for (var k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k)) {
          if (k === 'district' || k === 'place') continue;
          keys.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
        }
      }
      if (mode === 'district' && paramVal) {
        keys.push('district=' + encodeURIComponent(paramVal));
      } else if (mode === 'place' && paramVal) {
        keys.push('place=' + encodeURIComponent(String(paramVal)));
      }
      if (keys.length > 0) {
        nextSearch = '?' + keys.join('&');
      }
      var nextUrl = window.location.pathname + nextSearch + (window.location.hash || '');
      window.history.replaceState(null, '', nextUrl);
    } catch (e3) {}
  }

  /* ---- window.HNSeo API ---- */
  function slugifyDistrict(name) {
    if (!name) return '';
    var str = String(name);
    if (str === 'all') return '';
    str = str.replace(/đ/g, 'd').replace(/Đ/g, 'D');
    if (typeof str.normalize === 'function') {
      str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    str = str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return str;
  }

  function getDistrictFromSlug(slug) {
    if (!slug) return null;
    var target = slugifyDistrict(String(slug).replace(/^quan-/i, ''));
    if (!target) return null;
    var districts = getAllDistrictNames();
    for (var i = 0; i < districts.length; i++) {
      if (slugifyDistrict(districts[i]) === target) {
        return districts[i];
      }
    }
    return null;
  }

  function resetToHome(skipUrlUpdate) {
    var title = HOME_TITLE;
    var desc = HOME_DESC;
    var ogTitle = HOME_OG_TITLE;
    var ogDesc = HOME_OG_DESC;

    if (typeof window !== 'undefined' && window.HNi18n && typeof window.HNi18n.getLang === 'function' && window.HNi18n.getLang() === 'en') {
      title = 'Hanoi Pho Vi — Classic Hanoi Culinary & Restaurant Guide';
      desc = 'Discover 2,400 authentic Hanoi eateries and restaurants with Google Maps navigation, smart filters, live delivery & table booking.';
      ogTitle = title;
      ogDesc = desc;
    }

    setSeoTags(title, desc, ogTitle, ogDesc);

    var base = getBasePageUrl();
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Hà Nội Phố Vị',
      alternateName: 'Vị Hà Thành',
      url: base,
      inLanguage: 'vi',
      description: desc,
      potentialAction: {
        '@type': 'SearchAction',
        target: base + '?q={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    });

    if (!skipUrlUpdate) {
      safeUpdateUrl('home', '');
    }
  }

  function updateForDistrict(districtName, count, skipUrlUpdate) {
    if (!districtName || districtName === 'all') {
      resetToHome(skipUrlUpdate);
      return;
    }

    var all = getAllRestaurantsSafe();
    var matching = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].district === districtName) {
        matching.push(all[i]);
      }
    }

    var totalCount = (typeof count === 'number' && !isNaN(count)) ? count : matching.length;
    var slug = slugifyDistrict(districtName);
    var districtUrl = buildShareableDistrictUrl(slug);

    var title = 'Top ' + totalCount + ' Quán Ngon Quận ' + districtName + ' — Hà Nội Phố Vị';
    var desc = 'Khám phá ' + totalCount + ' quán ăn, nhà hàng ngon nổi bật tại Quận ' + districtName + ', Hà Nội. Xem giờ mở cửa, mức giá, đánh giá Google Maps và đặt bàn nhanh.';

    if (typeof window !== 'undefined' && window.HNi18n && typeof window.HNi18n.getLang === 'function' && window.HNi18n.getLang() === 'en') {
      title = 'Top ' + totalCount + ' Best Places in ' + districtName + ' District — Hanoi Pho Vi';
      desc = 'Explore ' + totalCount + ' curated restaurants and street food spots in ' + districtName + ', Hanoi with ratings, hours, and instant booking.';
    }

    setSeoTags(title, desc, title, desc);

    var itemList = [];
    var limit = Math.min(10, matching.length);
    for (var j = 0; j < limit; j++) {
      var item = matching[j];
      itemList.push({
        '@type': 'ListItem',
        position: j + 1,
        name: item.name,
        url: buildShareablePlaceUrl(item.id)
      });
    }

    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description: desc,
      url: districtUrl,
      inLanguage: 'vi',
      mainEntity: {
        '@type': 'ItemList',
        name: 'Quán ngon Quận ' + districtName,
        numberOfItems: totalCount,
        itemListElement: itemList
      }
    });

    if (!skipUrlUpdate) {
      safeUpdateUrl('district', slug);
    }
  }

  function updateForPlace(restaurant, skipUrlUpdate) {
    if (!restaurant || !restaurant.name) return;

    var placeUrl = buildShareablePlaceUrl(restaurant.id);
    var title = restaurant.name + ' (' + (restaurant.district || 'Hà Nội') + ') — Hà Nội Phố Vị';
    var baseSummary = restaurant.subname || restaurant.description || '';
    if (baseSummary.length > 130) {
      baseSummary = baseSummary.slice(0, 127) + '...';
    }
    var desc = restaurant.name + ' • ' + (restaurant.category || 'Ẩm thực Hà Nội') +
      ' tại ' + (restaurant.address || restaurant.district || 'Hà Nội') +
      '. Giá ' + (restaurant.priceRange || 'Hợp lý') +
      ', ⭐ ' + (restaurant.rating || 4.5) + '/5. ' + baseSummary;

    setSeoTags(title, desc, title, desc);

    var schemaObj = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: restaurant.name,
      servesCuisine: restaurant.category || 'Ẩm thực Việt Nam',
      priceRange: restaurant.priceRange || '',
      address: {
        '@type': 'PostalAddress',
        streetAddress: restaurant.address || '',
        addressLocality: restaurant.district || 'Hà Nội',
        addressRegion: 'Hà Nội',
        addressCountry: 'VN'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(restaurant.rating) || 4.5,
        reviewCount: Math.max(1, Number(restaurant.reviews) || 1),
        bestRating: 5,
        worstRating: 1
      },
      openingHours: restaurant.openingHours || '',
      url: placeUrl
    };

    if (restaurant.image) {
      schemaObj.image = restaurant.image;
    }

    setJsonLd(schemaObj);

    if (!skipUrlUpdate) {
      safeUpdateUrl('place', restaurant.id);
    }
  }

  function getCurrentJsonLd() {
    return currentJsonLd;
  }

  /* ---- window.HNPwa API ---- */
  var deferredPrompt = null;
  var swRegistered = false;

  function isInstalled() {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator && window.navigator.standalone === true) return true;
      if (typeof document !== 'undefined' && document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
    } catch (e) {}
    return false;
  }

  function canPromptNative() {
    return !!deferredPrompt;
  }

  function isSwSupportedOrigin() {
    if (typeof window === 'undefined' || !window.location || typeof navigator === 'undefined') return false;
    if (!('serviceWorker' in navigator)) return false;
    var proto = window.location.protocol;
    var host = window.location.hostname;
    return proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
  }

  function registerServiceWorker() {
    if (swRegistered || !isSwSupportedOrigin()) return;
    swRegistered = true;
    try {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        // Ignore SW registration failure quietly (e.g., restricted context)
      });
    } catch (e) {}
  }

  function updateInstallButtonUI() {
    var btn = $('btnInstallPwa');
    if (!btn) return;
    var span = btn.querySelector('[data-i18n="install_app"]') || btn.querySelector('span:last-child');
    var langEn = typeof window !== 'undefined' && window.HNi18n && typeof window.HNi18n.getLang === 'function' && window.HNi18n.getLang() === 'en';

    if (isInstalled()) {
      btn.classList.add('is-installed');
      btn.setAttribute('title', langEn ? 'Installed as App' : 'Đã cài đặt ứng dụng');
      if (span) span.textContent = langEn ? 'Installed' : 'Đã Cài App';
    } else if (canPromptNative()) {
      btn.classList.remove('is-installed');
      btn.classList.add('is-ready');
      btn.setAttribute('title', langEn ? 'Install Hanoi Pho Vi App now' : 'Cài ngay ứng dụng Hà Nội Phố Vị');
      if (span) span.textContent = langEn ? 'Install App' : 'Cài App';
    } else {
      btn.classList.remove('is-installed');
      btn.classList.remove('is-ready');
      if (span) span.textContent = langEn ? 'Install App' : 'Cài App';
    }
  }

  function showToastSafe(msg) {
    if (typeof window !== 'undefined' && window.HNAppBridge && typeof window.HNAppBridge.showToast === 'function') {
      window.HNAppBridge.showToast(msg);
    }
  }

  function closeInstallGuide() {
    var modal = $('pwaInstallModal');
    if (modal) modal.classList.remove('open');
  }

  function openInstallGuide() {
    var modal = $('pwaInstallModal');
    var body = $('pwaInstallBody');
    if (!modal || !body) return;

    var langEn = typeof window !== 'undefined' && window.HNi18n && typeof window.HNi18n.getLang === 'function' && window.HNi18n.getLang() === 'en';
    var installed = isInstalled();
    var nativeReady = canPromptNative();
    var fileMode = isFileProtocol();

    var statusBanner = '';
    if (installed) {
      statusBanner = '<div style="padding:10px 14px;border-radius:10px;background:rgba(46,75,62,0.12);border:1px solid rgba(46,75,62,0.3);margin-bottom:14px;font-weight:600;">' +
        (langEn ? '✅ Hanoi Pho Vi is currently running in standalone app mode.' : '✅ Ứng dụng Hà Nội Phố Vị đã được cài đặt trên thiết bị của bạn.') +
        '</div>';
    } else if (fileMode) {
      statusBanner = '<div style="padding:10px 14px;border-radius:10px;background:rgba(194,135,37,0.14);border:1px solid rgba(194,135,37,0.4);margin-bottom:14px;font-size:0.92rem;">' +
        (langEn ? 'ℹ️ You are opening via <code>file://</code>. Serve over <code>localhost</code> or <code>HTTPS</code> to enable offline Service Worker and 1-click PWA installation.' : 'ℹ️ Bạn đang mở trực tiếp qua <code>file://</code>. Để cài đặt ứng dụng PWA & dùng offline Service Worker, hãy chạy qua <code>localhost</code> hoặc tên miền <code>HTTPS</code>.') +
        '</div>';
    } else if (nativeReady) {
      statusBanner = '<div style="margin-bottom:14px;">' +
        '<button type="button" id="btnPwaTriggerNative" class="auth-submit-btn" style="width:100%;">' +
        (langEn ? '📲 Install Hanoi Pho Vi App Now' : '📲 Cài Đặt Ứng Dụng Ngay') +
        '</button></div>';
    }

    var html = '' +
      '<div style="text-align:center;margin-bottom:14px;">' +
      '  <img src="icon.svg" alt="Hà Nội Phố Vị" width="68" height="68" style="border-radius:16px;box-shadow:0 4px 12px rgba(139,30,30,0.22);margin-bottom:8px;" />' +
      '  <h2 style="font-family:var(--font-serif);color:var(--color-lacquer);margin-bottom:4px;">' + (langEn ? '📲 INSTALL HANOI PHO VI PWA' : '📲 CÀI ỨNG DỤNG HÀ NỘI PHỐ VỊ') + '</h2>' +
      '  <p style="font-size:0.92rem;color:var(--text-muted);">' + (langEn ? 'Quick access from your Home Screen or Desktop with offline guide support.' : 'Mở nhanh từ màn hình chính điện thoại hoặc máy tính, hỗ trợ tra cứu 2400 quán ngay cả khi mạng yếu.') + '</p>' +
      '</div>' +
      statusBanner +
      '<div style="display:grid;gap:10px;text-align:left;font-size:0.92rem;">' +
      '  <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border-vintage);background:var(--bg-parchment);">' +
      '    <strong>💻 Chrome / Microsoft Edge (Máy tính)</strong>' +
      '    <p style="margin:4px 0 0;color:var(--text-muted);">' + (langEn ? 'Click the Install icon (⊕ / 🖥️) on the right side of the address bar, or open Menu ⋮ → Install Hanoi Pho Vi.' : 'Bấm biểu tượng Cài đặt (⊕ / 🖥️) ở góc phải thanh địa chỉ, hoặc mở Menu <strong>⋮</strong> → <strong>Cài đặt Hà Nội Phố Vị</strong>.') + '</p>' +
      '  </div>' +
      '  <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border-vintage);background:var(--bg-parchment);">' +
      '    <strong>🤖 Chrome (Android)</strong>' +
      '    <p style="margin:4px 0 0;color:var(--text-muted);">' + (langEn ? 'Tap Menu ⋮ (top right) → Add to Home screen → Install.' : 'Chạm nút Menu <strong>⋮</strong> (góc trên bên phải) → chọn <strong>Thêm vào màn hình chính / Cài đặt ứng dụng</strong>.') + '</p>' +
      '  </div>' +
      '  <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border-vintage);background:var(--bg-parchment);">' +
      '    <strong>🍎 Safari (iPhone / iPad)</strong>' +
      '    <p style="margin:4px 0 0;color:var(--text-muted);">' + (langEn ? 'Tap the Share button (⬆️) at the bottom bar → scroll down and select Add to Home Screen.' : 'Chạm nút <strong>Chia sẻ (⬆️)</strong> ở thanh công cụ dưới cùng → cuộn xuống chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.') + '</p>' +
      '  </div>' +
      '</div>';

    body.innerHTML = html;
    modal.classList.add('open');

    var nativeBtn = $('btnPwaTriggerNative');
    if (nativeBtn) {
      nativeBtn.addEventListener('click', function () {
        closeInstallGuide();
        promptInstall();
      });
    }
  }

  function promptInstall() {
    if (deferredPrompt) {
      var promptEvt = deferredPrompt;
      deferredPrompt = null;
      try {
        promptEvt.prompt();
        if (promptEvt.userChoice && typeof promptEvt.userChoice.then === 'function') {
          return promptEvt.userChoice.then(function (choice) {
            updateInstallButtonUI();
            if (choice && choice.outcome === 'accepted') {
              showToastSafe('📲 Đang cài đặt Hà Nội Phố Vị...');
            }
            return choice;
          });
        }
      } catch (e) {
        openInstallGuide();
      }
      updateInstallButtonUI();
      return null;
    }
    openInstallGuide();
    return null;
  }

  /* ---- Deep Links & Event Wiring ---- */
  function applyInitialRouteFromLocation() {
    var params = parseQueryParams();
    var hash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash : '';

    // 1. ?district=<slug> or #quan-<slug>
    var districtParam = params.district || '';
    if (!districtParam && hash.indexOf('#quan-') === 0) {
      var hashRest = hash.slice(6);
      if (/^\d+$/.test(hashRest)) {
        // Place ID in hash on file://
        if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
          window.HNAppBridge.openDetail(Number(hashRest));
        }
      } else {
        districtParam = hashRest;
      }
    }

    if (districtParam) {
      var matchedDistrict = getDistrictFromSlug(districtParam);
      if (matchedDistrict) {
        if (window.HNAppBridge && typeof window.HNAppBridge.applyFiltersPatch === 'function') {
          window.HNAppBridge.applyFiltersPatch({ district: matchedDistrict });
        } else {
          updateForDistrict(matchedDistrict, undefined, true);
        }
      }
    }

    // 2. ?q=<search>
    if (params.q && window.HNAppBridge && typeof window.HNAppBridge.applyFiltersPatch === 'function') {
      window.HNAppBridge.applyFiltersPatch({ search: params.q });
    }

    // 3. Shortcut: ?lucky=1 -> open "Hôm Nay Ăn Gì?"
    if (params.lucky === '1') {
      setTimeout(function () {
        if (window.HNWhatToEat && typeof window.HNWhatToEat.open === 'function') {
          window.HNWhatToEat.open();
        } else {
          var luckyBtn = $('btnOpenClawHero') || $('btnLuckyFast');
          if (luckyBtn) luckyBtn.click();
        }
      }, 120);
    }

    // 4. Shortcut: ?hub=orders -> open Orders & Booking Hub
    if (params.hub === 'orders') {
      setTimeout(function () {
        if (window.HNOrderBooking && typeof window.HNOrderBooking.openOrdersHub === 'function') {
          window.HNOrderBooking.openOrdersHub('delivery');
        } else {
          var hubBtn = $('btnOpenOrdersHubHero');
          if (hubBtn) hubBtn.click();
        }
      }, 120);
    }
  }

  function initPwaAndSeo() {
    if (!currentJsonLd) {
      resetToHome(true);
    }
    registerServiceWorker();
    updateInstallButtonUI();

    var btnInstall = $('btnInstallPwa');
    if (btnInstall) {
      btnInstall.addEventListener('click', function () {
        promptInstall();
      });
    }

    var btnClose = $('btnClosePwaModal');
    if (btnClose) {
      btnClose.addEventListener('click', closeInstallGuide);
    }

    var pwaModal = $('pwaInstallModal');
    if (pwaModal) {
      pwaModal.addEventListener('click', function (e) {
        if (e.target === pwaModal) closeInstallGuide();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pwaModal && pwaModal.classList.contains('open')) {
        closeInstallGuide();
      }
    });

    applyInitialRouteFromLocation();
  }

  /* Attach cross-module & PWA listeners immediately so early DOMContentLoaded events are never missed */
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      updateInstallButtonUI();
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      updateInstallButtonUI();
      showToastSafe('✅ Đã cài đặt Hà Nội Phố Vị thành công!');
    });

    window.addEventListener('hn-detail-opened', function (e) {
      var detail = e && e.detail ? e.detail : null;
      if (detail && detail.restaurant) {
        updateForPlace(detail.restaurant);
      }
    });

    window.addEventListener('hn-filters-changed', function (e) {
      var detail = e && e.detail ? e.detail : null;
      var st = detail && detail.state ? detail.state : null;
      if (st && st.district && st.district !== 'all') {
        updateForDistrict(st.district, detail.count);
      } else {
        resetToHome();
      }
    });

    window.addEventListener('hn-lang-changed', function () {
      updateInstallButtonUI();
      if (typeof window !== 'undefined' && window.HNFilterState && typeof window.HNFilterState.getState === 'function') {
        var st = window.HNFilterState.getState();
        if (st && st.district && st.district !== 'all') {
          updateForDistrict(st.district, undefined, true);
          return;
        }
      }
      resetToHome(true);
    });
  }

  /* ---- Exports ---- */
  window.HNSeo = {
    slugifyDistrict: slugifyDistrict,
    getDistrictFromSlug: getDistrictFromSlug,
    updateForDistrict: updateForDistrict,
    updateForPlace: updateForPlace,
    resetToHome: resetToHome,
    getCurrentJsonLd: getCurrentJsonLd
  };

  window.HNPwa = {
    isInstalled: isInstalled,
    canPromptNative: canPromptNative,
    promptInstall: promptInstall,
    openInstallGuide: openInstallGuide
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPwaAndSeo);
    } else {
      initPwaAndSeo();
    }
  }
})();
