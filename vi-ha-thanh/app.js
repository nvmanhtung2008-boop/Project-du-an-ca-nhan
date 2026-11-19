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
    quickFilter: 'all', // 'all' | 'michelin' | 'hadong' | 'favorites'
    sortBy: 'rating_desc',
    currentPage: 1,
    pageSize: 9, // 9 quán mỗi trang (chia nhỏ trang, chống cuộn sâu)
    favorites: new Set(),
    soundEnabled: true,
    isClawing: false
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
      showToast('Đã bỏ quán khỏi Sổ tay quán quen');
    } else {
      state.favorites.add(id);
      showToast('❤️ Đã lưu vào Sổ tay quán quen!');
    }
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

  // --- FILTER & SEARCH ---
  function getFilteredRestaurants() {
    const query = state.search.trim().toLowerCase();

    return RESTAURANTS_DATA.filter((item) => {
      // Search query
      if (query) {
        const matchName = item.name.toLowerCase().includes(query);
        const matchSub = item.subname.toLowerCase().includes(query);
        const matchDistrict = item.district.toLowerCase().includes(query);
        const matchAddress = item.address.toLowerCase().includes(query);
        const matchDish = item.signatureDishes.some(d => d.toLowerCase().includes(query));
        const matchBadge = item.specialBadges.some(b => b.toLowerCase().includes(query));
        if (!matchName && !matchSub && !matchDistrict && !matchAddress && !matchDish && !matchBadge) {
          return false;
        }
      }

      // Price Tier
      if (state.priceTier !== 'all' && item.priceTier !== state.priceTier) {
        return false;
      }

      // People category
      if (state.peopleCategory !== 'all') {
        if (!item.peopleCategory.includes(state.peopleCategory)) {
          return false;
        }
      }

      // District
      if (state.district !== 'all' && item.district !== state.district) {
        return false;
      }

      // Occasion
      if (state.occasion !== 'all') {
        if (!item.occasions.includes(state.occasion)) {
          return false;
        }
      }

      // Quick filter
      if (state.quickFilter === 'michelin') {
        const isMichelin = item.specialBadges.some(b => b.toLowerCase().includes('michelin'));
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
      switch (state.sortBy) {
        case 'rating_desc':
          return b.rating - a.rating || b.reviews - a.reviews;
        case 'reviews_desc':
          return b.reviews - a.reviews;
        case 'price_asc':
          return a.priceAvg - b.priceAvg;
        case 'price_desc':
          return b.priceAvg - a.priceAvg;
        case 'name_asc':
          return a.name.localeCompare(b.name, 'vi');
        default:
          return 0;
      }
    });
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
        counterEl.innerHTML = `Không tìm thấy quán ăn phù hợp`;
      }
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🥢</div>
          <h3>Không tìm thấy quán ăn phù hợp</h3>
          <p>Hãy thử giảm bớt các điều kiện lọc hoặc xóa từ khóa tìm kiếm để khám phá thêm nhiều quán ngon khác bạn nhé.</p>
          <button class="btn-spin-wheel" id="btnResetFiltersEmpty">
            <span>↺</span> Xóa tất cả bộ lọc
          </button>
        </div>
      `;
      if (paginationContainer) paginationContainer.innerHTML = '';
      document.getElementById('btnResetFiltersEmpty')?.addEventListener('click', resetAllFilters);
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

    // Render cards cho trang hiện tại
    container.innerHTML = pageItems.map((item) => {
      const isFav = state.favorites.has(item.id);
      const isMichelin = item.specialBadges.some(b => b.toLowerCase().includes('michelin'));
      const isReservable = window.HNOrderBooking ? window.HNOrderBooking.canReserve(item) : false;
      
      const dishesHtml = item.signatureDishes
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
              <span class="badge-tag rating">★ ${item.rating} (${item.reviews.toLocaleString()} đánh giá)</span>
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
              <span>${escapeHtml(item.category)}</span>
              <span>👥 ${escapeHtml(item.peopleRange)}</span>
            </div>

            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <p class="card-subname clamped" id="subname-${item.id}">${escapeHtml(item.subname)}</p>

            <!-- Khối mô tả mở rộng đầy đủ không giới hạn ngay trên thẻ -->
            <div class="card-desc-full" id="desc-${item.id}">
              <p style="margin-bottom: 6px;">${escapeHtml(item.description)}</p>
              <div style="font-size: 0.8rem; color: #7A4B16; background: rgba(194, 135, 37, 0.12); padding: 6px 10px; border-radius: 4px;">
                <strong>💡 Mẹo sành ăn:</strong> ${escapeHtml(item.tips)}
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
                <span>${escapeHtml(item.openingHours)}</span>
              </div>
            </div>

            <div class="card-actions">
              <button class="btn-card-details" data-action="detail" data-id="${item.id}">
                <span>📖</span> Chi tiết & Mẹo
              </button>
              <a 
                href="${item.mapsUrl}" 
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
                <span>🛵</span> Đặt giao tận nơi
              </button>
              ${isReservable ? `
              <button class="btn-card-reserve" data-action="reserve" data-id="${item.id}" title="Đặt bàn trước tại nhà hàng">
                <span>🪑</span> Đặt bàn trước
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
              <option value="all" selected>Tất cả</option>
            </select>
          </div>
        </div>
      `;
      document.getElementById('pageSizeSelect')?.addEventListener('change', onPageSizeChange);
      return;
    }

    // Tạo danh sách các nút số trang thông minh
    const current = state.currentPage;
    let pageNumbers = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      if (current <= 4) {
        pageNumbers = [1, 2, 3, 4, 5, '...', totalPages];
      } else if (current >= totalPages - 3) {
        pageNumbers = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      } else {
        pageNumbers = [1, '...', current - 1, current, current + 1, '...', totalPages];
      }
    }

    const pageButtonsHtml = pageNumbers.map((p) => {
      if (p === '...') {
        return `<span class="page-ellipsis">...</span>`;
      }
      return `
        <button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">
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
            <option value="all" ${state.pageSize === 'all' ? 'selected' : ''}>Xem tất cả</option>
          </select>
        </div>
      </div>

      <div class="pagination-controls">
        <button class="page-btn" id="btnPageFirst" data-page="1" ${current === 1 ? 'disabled' : ''} title="Trang đầu">
          « Đầu
        </button>
        <button class="page-btn" id="btnPagePrev" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} title="Trang trước">
          ‹ Trước
        </button>

        ${pageButtonsHtml}

        <button class="page-btn" id="btnPageNext" data-page="${current + 1}" ${current === totalPages ? 'disabled' : ''} title="Trang sau">
          Sau ›
        </button>
        <button class="page-btn" id="btnPageLast" data-page="${totalPages}" ${current === totalPages ? 'disabled' : ''} title="Trang cuối">
          Cuối »
        </button>
      </div>

      <div class="pagination-jump-row">
        <span>Chuyển nhanh đến trang:</span>
        <input type="number" id="pageJumpInput" class="page-jump-input" min="1" max="${totalPages}" value="${current}" />
        <button id="btnJumpPage" class="btn-jump-page">Đi tới</button>
      </div>
    `;

    // Attach listeners
    container.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (!isNaN(p) && p !== state.currentPage) {
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
  function openDetailModal(id) {
    const restaurant = RESTAURANTS_DATA.find(r => r.id === id);
    if (!restaurant) return;

    const modal = document.getElementById('detailModal');
    if (!modal) return;

    const isFav = state.favorites.has(restaurant.id);
    const isReservable = window.HNOrderBooking ? window.HNOrderBooking.canReserve(restaurant) : false;
    const badgesHtml = restaurant.specialBadges
      .map(b => `<span class="badge-tag ${b.toLowerCase().includes('michelin') ? 'michelin' : ''}">✦ ${escapeHtml(b)}</span>`)
      .join('');

    const dishesListHtml = restaurant.signatureDishes
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

    const occasionsHtml = restaurant.occasions
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
            <span class="badge-tag rating">★ ${restaurant.rating} (${restaurant.reviews.toLocaleString()} đánh giá trên Google Maps)</span>
            ${badgesHtml}
          </div>
          <h2 class="detail-title">${escapeHtml(restaurant.name)}</h2>
          <p class="detail-subtitle">${escapeHtml(restaurant.subname)}</p>
        </div>
      </div>

      <div class="detail-content-body">
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
              <span>${escapeHtml(restaurant.peopleRange)}</span>
            </div>
          </div>
          <div class="detail-meta-item">
            <span style="font-size: 1.3rem;">⏰</span>
            <div>
              <strong>Giờ mở cửa phục vụ</strong>
              <span>${escapeHtml(restaurant.openingHours)}</span>
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

        <h3 class="detail-section-title">
          <span>🥢</span> Món Đinh Chuẩn Vị Phải Thử
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
          ${dishesListHtml}
        </div>

        <h3 class="detail-section-title">
          <span>📜</span> Giới Thiệu & Không Gian
        </h3>
        <p class="detail-description">${escapeHtml(restaurant.description)}</p>

        <h3 class="detail-section-title">
          <span>💡</span> Mẹo Cho Thực Khách (Tips từ người sành ăn)
        </h3>
        <div class="detail-tips-box">
          ${escapeHtml(restaurant.tips)}
        </div>

        <h3 class="detail-section-title">
          <span>🎉</span> Phù Hợp Với Dịp
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 22px;">
          ${occasionsHtml}
        </div>

        <div class="detail-address-box">
          <div>
            <strong style="display:block; margin-bottom: 2px;">📍 Vị trí trên Google Maps:</strong>
            <span style="color: var(--text-muted); font-size: 0.9rem;" id="modalAddressText">${escapeHtml(restaurant.address)}</span>
          </div>
          <button class="btn-copy-address" id="btnCopyAddress">
            📋 Sao chép địa chỉ
          </button>
        </div>

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
            href="${restaurant.mapsUrl}" 
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
    document.getElementById('btnCopyAddress')?.addEventListener('click', () => {
      navigator.clipboard.writeText(restaurant.address).then(() => {
        showToast('Đã sao chép địa chỉ quán vào khay nhớ tạm!');
      }).catch(() => {
        showToast('Địa chỉ: ' + restaurant.address);
      });
    });

    document.getElementById('btnModalToggleFav')?.addEventListener('click', () => {
      toggleFavorite(restaurant.id);
      openDetailModal(restaurant.id); // re-render modal fav state
    });

    document.getElementById('btnModalDelivery')?.addEventListener('click', () => {
      closeDetailModal();
      if (window.HNOrderBooking) window.HNOrderBooking.openDelivery(restaurant.id);
    });

    document.getElementById('btnModalReserve')?.addEventListener('click', () => {
      closeDetailModal();
      if (window.HNOrderBooking) window.HNOrderBooking.openReservation(restaurant.id);
    });
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
    $g('btnLuckyFast')?.addEventListener('click', pickInstantRandom);

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

    winnerCard.innerHTML = `
      <span class="winner-badge">🎉 BÓNG GASHAPON CỦA BẠN LÀ...</span>
      <h3 class="winner-name">${escapeHtml(restaurant.name)}</h3>
      <p class="winner-sub">
        ${escapeHtml(restaurant.subname)} • <strong>${escapeHtml(restaurant.priceRange)}</strong> • Quận ${escapeHtml(restaurant.district)}
      </p>

      <div style="display:flex; justify-content:center; gap:8px; margin: 8px 0 12px; flex-wrap:wrap;">
        <span class="badge-tag rating">★ ${restaurant.rating} (${restaurant.reviews.toLocaleString()} đánh giá Google Maps)</span>
        <span class="badge-tag">👥 ${escapeHtml(restaurant.peopleRange)}</span>
      </div>

      <div style="margin-bottom: 12px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;">
        ${signatureDishesHtml}
      </div>

      <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 14px;">
        📍 ${escapeHtml(restaurant.address)}
      </div>

      <div class="winner-actions">
        <a href="${restaurant.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-maps" style="padding: 10px 18px;">
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

  // --- INIT APPLICATION ---
  function init() {
    loadStoredFavorites();
    populateSelectDropdowns();
    initFilterListeners();
    initBackToTop();
    initClawModal();
    renderRestaurants();
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
   Intent detection + Restaurant filter + Vietnamese responses
   ========================================================================== */
(function () {
  'use strict';

  var $ = function(id) { return document.getElementById(id); };
  var btnOpen = $('aiBtnOpen'), panel = $('aiChatPanel'),
      btnClose = $('aiBtnClose'), btnClear = $('aiBtnClear'),
      btnInfo = $('aiBtnSettings'), messagesEl = $('aiMessages'),
      textarea = $('aiTextInput'), btnSend = $('aiBtnSend'),
      chips = document.querySelectorAll('.ai-chip'),
      unreadBadge = $('aiUnreadBadge'), statusDot = $('aiStatusDot');

  if (!btnOpen || !panel || !messagesEl) return;

  var isOpen = false, isBusy = false;

  /* ---- INTENT RULES ---- */
  var INTENTS = [
    {id:'greet',   kw:['xin chao','hello','chao ban','chao em','chao co','chao co lan','hi','hey','alo']},
    {id:'thanks',  kw:['cam on','cam on','thank','tuyet','ok roi','duoc roi']},
    {id:'random',  kw:['hom nay an gi','khong biet an gi','chon giup','ngau nhien','random','goi y cho toi','bat ky']},
    {id:'top',     kw:['ngon nhat','noi tieng nhat','best','top ','noi tieng','michelin','danh gia cao','hay nhat']},
    {id:'cheap',   kw:['re','gia re','tiet kiem','binh dan','duoi 100','it tien','cheap','khong dat']},
    {id:'luxury',  kw:['sang trong','cao cap','vip','fine dining','dat','premium','luxury','5 sao']},
    {id:'mid',     kw:['tam trung','khoang 100','khoang 200','vua tui']},
    {id:'breakfast',kw:['an sang','bua sang','sang som','buoi sang','diem tam']},
    {id:'lunch',   kw:['an trua','bua trua','buoi trua','com trua']},
    {id:'quick',   kw:['an nhanh','nhanh','fast','gon nhe']},
    {id:'dinner',  kw:['an toi','bua toi','buoi toi','toi nay','dinner']},
    {id:'late',    kw:['an khuya','khuya','dem khuya','late night','11 gio','12 gio','nua dem']},
    {id:'date',    kw:['hen ho','lang man','tinh cam','romantic','date','nguoi yeu']},
    {id:'family',  kw:['gia dinh','ca nha','hop mat','bo me','ba me','dong nguoi']},
    {id:'friends', kw:['ban be','tu tap','hoi ban','nhom ban','ca nhom']},
    {id:'party',   kw:['tiec','party','sinh nhat','ky niem','celebration']},
    {id:'drinks',  kw:['nhau','bia','uong','bar','cocktail','ruou']},
    {id:'solo',    kw:['1 nguoi','mot minh','di mot minh','solo']},
    {id:'d_hk',   kw:['hoan kiem','pho co','old quarter']},
    {id:'d_th',   kw:['tay ho','ho tay','xuan dieu']},
    {id:'d_dd',   kw:['dong da','kim lien','thai thinh','lang ha']},
    {id:'d_hbt',  kw:['hai ba trung','ba trieu']},
    {id:'d_bd',   kw:['ba dinh','kim ma']},
    {id:'d_cg',   kw:['cau giay','dich vong','tran thai tong']},
    {id:'d_hd',   kw:['ha dong','mo lao','yen nghia']},
    {id:'d_tx',   kw:['thanh xuan','nguyen trai']},
    {id:'d_lb',   kw:['long bien']},
    {id:'d_hm',   kw:['hoang mai','giap bat']},
    {id:'d_uni',  kw:['dai hoc','gần trường','truong dai','sinh vien','university']},
    {id:'f_pho',  kw:['pho ','bun bo','bun rieu']},
    {id:'f_bun',  kw:['bun cha','bun dau','bun oc','bun']},
    {id:'f_banh', kw:['banh mi','banh cuon','banh xeo']},
    {id:'f_xoi',  kw:['xoi','chao']},
    {id:'f_com',  kw:['com ']},
    {id:'f_lau',  kw:['lau ']},
    {id:'f_nuong',kw:['nuong','bbq']},
    {id:'f_sea',  kw:['hai san','tom','cua','muc','seafood','oc ']},
    {id:'f_jp',   kw:['sushi','nhat','japanese','ramen']},
    {id:'f_kr',   kw:['han quoc','do han','mon han','korean','kimchi','tokbokki','kimbap','jokbal','chimaek']},
    {id:'f_cn',   kw:['trung quoc','trung hoa','mon hoa','do trung','tau','chinese','dimsum','tieu long bao','ha cao','trung khanh','tu xuyen','quang dong','vit quay']},
    {id:'f_veg',  kw:['chay','vegetarian','vegan']},
    {id:'f_cafe', kw:['ca phe','cafe','coffee','tra sua']},
    {id:'f_sweet',kw:['kem','trang mieng','dessert','che','an vat','qua vat','nem chua ran','banh goi','banh trang','quay nong','hoa qua dam','tao pho']},
    {id:'f_pizza',kw:['pizza','pasta']},
    {id:'off',    kw:['thoi tiet','chung khoan','bitcoin','bong da','phim','am nhac','suc khoe','thuoc','benh','hoc tap','lap trinh','code']},
  ];

  /* Bỏ dấu tiếng Việt: "Phở Hoàn Kiếm" -> "pho hoan kiem" */
  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /* So khớp theo ranh giới từ để tránh "gon" khớp nhầm trong "ngon" */
  function detectIntents(msg) {
    var n = ' ' + norm(msg) + ' ';
    var found = [];
    INTENTS.forEach(function(rule) {
      if (rule.kw.some(function(k) {
        var key = norm(k);
        return key && n.indexOf(' ' + key + ' ') !== -1;
      })) found.push(rule.id);
    });
    return found.length ? found : ['unknown'];
  }

  /* ---- DATA ---- */
  function db() {
    return (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) ? RESTAURANTS_DATA : [];
  }

  var DMAP = {d_hk:'Hoàn Kiếm',d_th:'Tây Hồ',d_dd:'Đống Đa',d_hbt:'Hai Bà Trưng',
    d_bd:'Ba Đình',d_cg:'Cầu Giấy',d_hd:'Hà Đông',d_tx:'Thanh Xuân',d_lb:'Long Biên',d_hm:'Hoàng Mai'};
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
    else if(intents.indexOf('luxury')!==-1)priceFilter=['expensive','luxury'];
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
  function fmtOne(r){
    var d=(r.signatureDishes||[]).slice(0,2).join(', ');
    var b=(r.specialBadges||[]).slice(0,1).map(function(x){return '✦ '+x;}).join('');
    return '🍽️ **'+r.name+'**\n📍 '+r.address+'\n⭐ '+r.rating+' ('+r.reviews.toLocaleString('vi-VN')+' đánh giá)  ·  '+r.priceRange+'\n🥢 '+d+(b?'\n'+b:'')+'\n🗺 [Xem Google Maps]('+r.mapsUrl+')';
  }
  function fmtShort(r,i){
    var d=(r.signatureDishes||[]).slice(0,1).join('');
    return (i+1)+'. **'+r.name+'** — '+r.district+'  ·  '+r.priceRange+'\n   📌 '+d+'  ·  ⭐'+r.rating;
  }

  /* ---- RESPONSE TEMPLATES ---- */
  var GREET=['🏮 Chào chị/anh! Em là **Cô Lan**, trợ lý ẩm thực Hà Nội.\nEm thuộc lòng **233 quán ngon** khắp 12 quận Hà Nội (mỗi quận ít nhất 10 quán tuyển chọn, đầy đủ Chè, Ăn vặt, Món Hàn, Món Trung). Hỏi em về quán ăn, khu vực, giá tiền, dịp ăn — em gợi ý ngay! 😊','🌸 Ôi chào ạ! Em Cô Lan đây~ Hôm nay thèm món gì?\nCứ nói bừa ra là em biết ngay nên đi đâu! 🍜','🏮 Dạ chào ạ! Em là Cô Lan — cẩm nang ẩm thực 36 phố phường!\nChị/anh muốn **ăn vặt, chè**, **đồ Hàn, đồ Trung**, hay **hẹn hò**? Em sẵn sàng! ✨'];
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

  function respond(msg, intents){
    var data=db(); if(!data.length) return 'Dữ liệu chưa tải, thử tải lại trang ạ.';
    if(intents.indexOf('greet')!==-1) return rand(GREET);
    if(intents.indexOf('thanks')!==-1) return rand(THANKS);
    if(intents[0]==='off') return rand(OFF);
    if(intents.indexOf('random')!==-1){
      var r=pick(data,1)[0];
      return rand(['🎲 Thôi để em chọn giúp! Hôm nay thử:','✨ Nhắm mắt bắt ngẫu nhiên, em chọn:','🏮 Cô Lan mách nhỏ một quán cực ngon:'])+'\n\n'+fmtOne(r);
    }
    if(intents.indexOf('top')!==-1){
      var pool=applyFilters(intents); if(!pool.length)pool=data;
      var top=pool.slice().sort(function(a,b){return(b.rating-a.rating)||(b.reviews-a.reviews);}).slice(0,4);
      return '⭐ Những quán được đánh giá cao nhất:\n\n'+top.map(fmtShort).join('\n\n')+'\n\n💡 _Hỏi thêm về quán nào em kể chi tiết ạ!_';
    }
    var pool=applyFilters(intents);
    var noMatch=(pool===data||!pool.length)&&intents[0]!=='unknown';
    if(!pool.length)pool=data;
    var intro=buildIntro(intents);
    if(noMatch) intro='🤔 Không tìm được 100%, nhưng mấy quán này cũng khá gần ý chị/anh:\n';
    if(pool.length===1) return intro+'\n\n'+fmtOne(pool[0]);
    var picks=pick(pool,pool.length<=2?1:4);
    if(picks.length===1) return intro+'\n\n'+fmtOne(picks[0]);
    return intro+'\n\n'+picks.map(fmtShort).join('\n\n')+'\n\n💡 _Hỏi thêm về quán nào em kể chi tiết, có Google Maps luôn ạ!_';
  }

  /* ---- RENDER ---- */
  function getTime(){ return new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}); }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function renderText(raw){
    var s=esc(raw);
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/_([^_]+)_/g,'<em>$1</em>');
    s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" class="ai-link">$1 ↗</a>');
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
      appendMsg('ai','🏮 Xin chào! Em là **Cô Lan**, trợ lý ẩm thực Hà Nội.\n\nEm thuộc lòng **233 quán ngon** trên Google Maps khắp 12 quận Hà Nội — từ Phở Bát Đàn, Chè Bốn Mùa, ăn vặt phố cổ đến BBQ Hàn Quốc và Dimsum Trung Hoa. Chị/anh muốn ăn gì hôm nay? 🍜');
  }
  function closePanel(){
    isOpen=false; panel.classList.remove('ai-panel-open');
    btnOpen.setAttribute('aria-expanded','false');
  }

  /* ---- EVENTS ---- */
  btnOpen.addEventListener('click',function(){if(isOpen)closePanel();else openPanel();});
  if(btnClose) btnClose.addEventListener('click',closePanel);
  if(btnClear) btnClear.addEventListener('click',function(){
    if(!window.confirm('Xóa toàn bộ lịch sử trò chuyện?'))return;
    messagesEl.innerHTML='';
    var c=document.getElementById('aiChips'); if(c) c.style.display='';
    appendMsg('ai','🏮 Xin chào! Em là **Cô Lan**. Chị/anh muốn ăn gì hôm nay? 🍜');
  });
  if(btnInfo) btnInfo.addEventListener('click',function(){
    window.alert('🏮 Cô Lan — Trợ Lý Ẩm Thực Hà Nội\n\n✅ Offline Engine — không cần API key\n📊 Dữ liệu: 233 quán ăn Hà Nội xác thực trên Google Maps (10+ quán/quận)\n🧠 Hiểu: khu vực, bữa ăn, chè & ăn vặt, đồ Hàn, đồ Trung, giá tiền, dịp ăn');
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

  /* ---- Helpers: Storage ---- */
  function loadUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch (e) {}
    // Seed default sample account
    var demoUser = {
      id: 'demo_1',
      fullName: 'Thực Khách Hà Thành',
      username: 'thuckhach@hanoiphovi.vn',
      password: '123456',
      district: 'Hoàn Kiếm',
      joinedAt: '18/11/2026',
      favorites: [1, 2, 5, 8]
    };
    saveUsers([demoUser]);
    return [demoUser];
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {}
  }

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setCurrentUser(user, remember) {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      if (user) {
        var data = JSON.stringify(user);
        if (remember !== false) localStorage.setItem(SESSION_KEY, data);
        else sessionStorage.setItem(SESSION_KEY, data);
      }
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
    setCurrentUser(cur, true);
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
      if (subEl) subEl.textContent = 'Cập nhật ảnh đại diện, sở thích ăn uống & link Facebook cá nhân';

      var favs = getActiveFavorites();
      renderAvatarContent($('profileAvatarLarge'), user, user.avatarData);
      if ($('btnRemoveAvatar')) $('btnRemoveAvatar').hidden = !user.avatarData;
      if ($('profileDisplayName')) $('profileDisplayName').textContent = user.fullName;
      if ($('profileUsername')) $('profileUsername').textContent = user.username;
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

    if (titleEl) titleEl.textContent = isLogin ? 'ĐĂNG NHẬP THỰC KHÁCH' : 'TẠO TÀI KHOẢN MỚI';
    if (subEl) {
      subEl.textContent = isLogin
        ? 'Đăng nhập để mở Sổ Tay Quán Quen và lưu hành trình ẩm thực Hà Nội'
        : 'Chỉ mất 15 giây để sở hữu Thẻ Thực Khách Kinh Kỳ của riêng bạn';
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

  /* ---- Login & Register Handlers ---- */
  function completeLoginSession(user, remember, isNewAccount) {
    // Merge current guest favorites with user's stored favorites
    var guestFavs = getActiveFavorites();
    var userFavs = Array.isArray(user.favorites) ? user.favorites : [];
    var merged = Array.from(new Set(userFavs.concat(guestFavs)));
    user.favorites = merged;

    // Persist to users list & localStorage favorites
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
        ? '🎉 Tạo tài khoản thành công! Chào mừng ' + user.fullName + ' đến với Hà Nội Phố Vị.'
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

      if (!identifier || !password) {
        showAlert('⚠️ Vui lòng nhập đầy đủ Tên đăng nhập/Email và Mật khẩu.', 'error');
        return;
      }

      var users = loadUsers();
      var found = null;
      var idLower = identifier.toLowerCase();
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (u.username.toLowerCase() === idLower || u.fullName.toLowerCase() === idLower) {
          found = u;
          break;
        }
      }

      if (!found) {
        showAlert('❌ Tài khoản "' + identifier + '" chưa tồn tại. Bạn hãy chuyển sang tab Tạo Tài Khoản nhé!', 'error');
        return;
      }
      if (found.password !== password) {
        showAlert('❌ Mật khẩu chưa chính xác. Vui lòng kiểm tra lại!', 'error');
        return;
      }

      completeLoginSession(found, remember, false);
    });
  }

  // 1-Click Demo Login
  var btnDemo = $('btnDemoLogin');
  if (btnDemo) {
    btnDemo.addEventListener('click', function () {
      var users = loadUsers();
      var demo = users[0];
      completeLoginSession(demo, true, false);
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAlert();
      var fullName = ($('regFullName').value || '').trim();
      var username = ($('regUsername').value || '').trim();
      var district = $('regDistrict') ? $('regDistrict').value : 'Hoàn Kiếm';
      var password = $('regPassword').value || '';
      var confirmPass = $('regPasswordConfirm').value || '';

      if (fullName.length < 2) {
        showAlert('⚠️ Vui lòng nhập Họ và tên hiển thị (tối thiểu 2 ký tự).', 'error');
        return;
      }
      if (username.length < 3) {
        showAlert('⚠️ Vui lòng nhập Email hoặc Tên đăng nhập (tối thiểu 3 ký tự).', 'error');
        return;
      }
      if (password.length < 6) {
        showAlert('⚠️ Mật khẩu cần có ít nhất 6 ký tự để bảo mật.', 'error');
        return;
      }
      if (password !== confirmPass) {
        showAlert('⚠️ Mật khẩu xác nhận không khớp. Vui lòng nhập lại.', 'error');
        return;
      }

      var users = loadUsers();
      var uLower = username.toLowerCase();
      for (var i = 0; i < users.length; i++) {
        if (users[i].username.toLowerCase() === uLower) {
          showAlert('❌ Tên đăng nhập / Email này đã được đăng ký. Vui lòng chọn tên khác hoặc Đăng nhập!', 'error');
          return;
        }
      }

      var now = new Date();
      var joinedStr = now.toLocaleDateString('vi-VN');
      var newUser = {
        id: 'u_' + Date.now(),
        fullName: fullName,
        username: username,
        password: password,
        district: district,
        joinedAt: joinedStr,
        favorites: getActiveFavorites()
      };

      users.push(newUser);
      saveUsers(users);
      formRegister.reset();
      completeLoginSession(newUser, true, true);
    });
  }

  /* ---- Password Strength Meter ---- */
  var regPassInput = $('regPassword');
  if (regPassInput) {
    regPassInput.addEventListener('input', function () {
      var val = regPassInput.value || '';
      var fill = $('regStrengthFill');
      var txt = $('regStrengthText');
      if (!fill || !txt) return;

      if (!val.length) {
        fill.style.width = '0%';
        txt.textContent = 'Nhập mật khẩu ít nhất 6 ký tự';
        return;
      }
      var score = 0;
      if (val.length >= 6) score += 40;
      if (val.length >= 9) score += 25;
      if (/[A-Z]/.test(val) || /[0-9]/.test(val)) score += 20;
      if (/[^A-Za-z0-9]/.test(val)) score += 15;

      fill.style.width = Math.min(100, Math.max(20, score)) + '%';
      if (val.length < 6) {
        fill.style.background = '#DC2626';
        txt.textContent = 'Quá ngắn (cần thêm ' + (6 - val.length) + ' ký tự)';
      } else if (score < 65) {
        fill.style.background = '#D97706';
        txt.textContent = 'Độ mạnh: Trung bình';
      } else {
        fill.style.background = '#16A34A';
        txt.textContent = 'Độ mạnh: Rất tốt ✓';
      }
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
    setCurrentUser(cur, true);
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

  window.HNAuth = {
    getCurrentUser: getCurrentUser,
    openAuthModal: openAuthModal,
    loadUsers: loadUsers
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
      if (fr) activeThread.id = getDmThreadId(fr);
      if (peerAv) {
        peerAv.innerHTML = fr.avatarData ? '<img src="' + fr.avatarData + '" alt="av" />' : escHtml(fr.fullName.charAt(0).toUpperCase());
      }
      if (peerName) peerName.textContent = fr.fullName;
      if (peerMeta) peerMeta.textContent = '📍 ' + fr.district + ' • ' + (fr.hobbies || 'Bạn bè');
      if (joinBtn) joinBtn.hidden = true;
      if (viewPeerBtn) {
        viewPeerBtn.hidden = false;
        viewPeerBtn.onclick = function () { openFriendProfile(fr); };
      }
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
        // Trigger existing card detail click if available
        var cardBtn = document.querySelector('.btn-card-details[data-id="' + sid + '"]');
        if (cardBtn) cardBtn.click();
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
  var reelFilter = 'all';
  var activeCommentReelId = null;
  var pendingMedia = null; // { type: 'image'|'video', src: string }

  var SEED_REELS = [
    {
      id: 'reel_1',
      authorName: 'Nguyễn Minh Thảo',
      authorUser: 'minhthao@hanoiphovi.vn',
      district: 'Hoàn Kiếm',
      spotId: 1,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
      caption: '6h30 sáng xếp hàng làm bát Phở Bát Đàn tái lăn nóng hổi giữa tiết trời se lạnh Hà Nội, thêm đĩa quẩy giòn đúng chuẩn vị xưa! 🍜🔥',
      likes: 248,
      likedByMe: false,
      comments: [
        { author: 'Trần Huy Hoàng', time: '10 phút trước', text: 'Nhìn bát phở ngập hành thơm nức mũi luôn bạn ơi!' },
        { author: 'Lê Khánh Linh', time: '4 phút trước', text: 'Cuối tuần rủ nhau lên phố cổ ăn sáng nha!' }
      ]
    },
    {
      id: 'reel_2',
      authorName: 'Lê Khánh Linh',
      authorUser: 'khanhlinh@hanoiphovi.vn',
      district: 'Hoàn Kiếm',
      spotId: 104,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
      caption: 'Tối đi dạo Hàng Bạc nhất định phải làm cốc Kem Bơ Sầu Riêng & Xôi Xoài ở Chè Hương Hải, béo ngậy mát lịm! 🍧✨',
      likes: 192,
      likedByMe: false,
      comments: [
        { author: 'Nguyễn Minh Thảo', time: '25 phút trước', text: 'Quán này mở tới tận 12h đêm, ăn khuya siêu hợp!' }
      ]
    },
    {
      id: 'reel_3',
      authorName: 'Trần Huy Hoàng',
      authorUser: 'huyhoang@hanoiphovi.vn',
      district: 'Cầu Giấy',
      spotId: 155,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
      caption: 'Xửng Tiểu Long Bao & Há Cảo tôm tươi nóng hổi vừa ra lò ở Cầu Giấy — cắn một miếng nước súp ngọt lịm tan ngay trong miệng! 🥟',
      likes: 315,
      likedByMe: false,
      comments: []
    },
    {
      id: 'reel_4',
      authorName: 'Phạm Anh Tuấn',
      authorUser: 'anhtuan@hanoiphovi.vn',
      district: 'Tây Hồ',
      spotId: 211,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
      caption: 'Đạp xe quanh Hồ Tây xong ghé Chops Quảng An làm chiếc Burger bò Wagyu phô mai chảy, hết nước chấm! 🍔🌊',
      likes: 164,
      likedByMe: false,
      comments: []
    },
    {
      id: 'reel_5',
      authorName: 'Hà Thành Foodie',
      authorUser: 'thuckhach@hanoiphovi.vn',
      district: 'Đống Đa',
      spotId: 129,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
      caption: 'Tụ tập hội bạn làm chầu thịt nướng Hàn Quốc xèo xèo bên bếp than hồng ở Jinro BBQ Nguyễn Chí Thanh 🔥🇰🇷',
      likes: 279,
      likedByMe: false,
      comments: []
    },
    {
      id: 'reel_6',
      authorName: 'Minh Anh Phố Cổ',
      authorUser: 'minhanh@hanoiphovi.vn',
      district: 'Hà Đông',
      spotId: 197,
      mediaType: 'image',
      mediaSrc: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      caption: 'Dân Hà Đông tối nay ghé phố Nguyễn Văn Lộc ăn buffet nướng Nhật Yakimono không giới hạn, khói thơm nức cả góc phố! 🥩',
      likes: 204,
      likedByMe: false,
      comments: []
    }
  ];

  function loadReels() {
    try {
      var raw = localStorage.getItem(REELS_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {}
    saveReels(SEED_REELS);
    return SEED_REELS.slice();
  }

  function saveReels(list) {
    try {
      // Avoid saving giant temporary blob URLs or oversized video base64
      var safeList = list.map(function (r) {
        if (r.mediaType === 'video' && r.mediaSrc && r.mediaSrc.indexOf('blob:') === 0) {
          return Object.assign({}, r, { mediaSrc: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', mediaType: 'image' });
        }
        return r;
      });
      localStorage.setItem(REELS_KEY, JSON.stringify(safeList));
    } catch (e) {}
  }

  var reelsData = loadReels();

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function populateSpotSelect() {
    var sel = $('reelSpotSelect');
    if (!sel || sel.options.length > 1) return;
    if (typeof RESTAURANTS_DATA === 'undefined') return;
    RESTAURANTS_DATA.forEach(function (r) {
      var opt = document.createElement('option');
      opt.value = String(r.id);
      opt.textContent = r.name + ' (' + r.district + ')';
      sel.appendChild(opt);
    });
  }

  function getFilteredReels() {
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    if (reelFilter === 'hot') {
      return reelsData.slice().sort(function (a, b) { return b.likes - a.likes; });
    }
    if (reelFilter === 'mine') {
      if (!cur) return [];
      return reelsData.filter(function (r) {
        return r.authorUser && r.authorUser.toLowerCase() === cur.username.toLowerCase();
      });
    }
    return reelsData;
  }

  function renderReelsFeed() {
    var list = getFilteredReels();
    if (!list.length) {
      feedEl.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#E2E8F0;padding:24px;text-align:center;">' +
        '<div style="font-size:2.4rem;margin-bottom:8px;">🎬</div>' +
        '<p style="font-size:0.95rem;margin-bottom:12px;">Chưa có Reel nào trong mục này. Hãy là người đầu tiên đăng bài chia sẻ món ngon nhé!</p>' +
        '<button type="button" class="reels-create-btn" id="btnEmptyCreateReel">➕ Đăng Reel Ngay</button>' +
      '</div>';
      $('btnEmptyCreateReel')?.addEventListener('click', openReelUpload);
      return;
    }

    feedEl.innerHTML = list.map(function (r) {
      var mediaHtml = r.mediaType === 'video'
        ? '<video class="reel-media" src="' + r.mediaSrc + '" autoplay loop muted playsinline controls></video>'
        : '<img class="reel-media kenburns" src="' + r.mediaSrc + '" alt="' + esc(r.caption) + '" />';

      var avHtml = r.avatarData
        ? '<img src="' + r.avatarData + '" alt="av" />'
        : esc((r.authorName || 'T').charAt(0).toUpperCase());

      var spotHtml = '';
      if (r.spotId && typeof RESTAURANTS_DATA !== 'undefined') {
        var spot = RESTAURANTS_DATA.find(function (x) { return x.id === Number(r.spotId); });
        if (spot) {
          spotHtml = '<button type="button" class="reel-spot-pill" data-reel-spot="' + spot.id + '">🍽️ ' + esc(spot.name) + ' • ⭐ ' + spot.rating + ' (Xem quán ↗)</button>';
        }
      }

      return '<article class="reel-slide" data-reel-id="' + r.id + '">' +
        mediaHtml +
        '<div class="reel-scrim"></div>' +
        '<div class="reel-actions-col">' +
          '<div class="reel-author-av" title="' + esc(r.authorName) + '">' + avHtml + '</div>' +
          '<button type="button" class="reel-act-btn' + (r.likedByMe ? ' liked' : '') + '" data-reel-like="' + r.id + '" title="Thả tim">' +
            '<span class="reel-act-icon">' + (r.likedByMe ? '❤️' : '🤍') + '</span>' +
            '<span class="reel-act-count">' + r.likes + '</span>' +
          '</button>' +
          '<button type="button" class="reel-act-btn" data-reel-comments="' + r.id + '" title="Bình luận">' +
            '<span class="reel-act-icon">💬</span>' +
            '<span class="reel-act-count">' + (r.comments ? r.comments.length : 0) + '</span>' +
          '</button>' +
          '<button type="button" class="reel-act-btn" data-reel-share="' + r.id + '" title="Chia sẻ">' +
            '<span class="reel-act-icon">↗️</span>' +
            '<span class="reel-act-count">Chia sẻ</span>' +
          '</button>' +
        '</div>' +
        '<div class="reel-info-bottom">' +
          '<div class="reel-author-row">' +
            '<span class="reel-author-name">@' + esc(r.authorName) + '</span>' +
            '<span class="reel-dist-pill">📍 ' + esc(r.district || 'Hà Nội') + '</span>' +
          '</div>' +
          '<p class="reel-caption">' + esc(r.caption) + '</p>' +
          spotHtml +
        '</div>' +
      '</article>';
    }).join('');

    // Wire actions inside slides
    feedEl.querySelectorAll('[data-reel-like]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rid = btn.getAttribute('data-reel-like');
        var item = reelsData.find(function (x) { return x.id === rid; });
        if (!item) return;
        item.likedByMe = !item.likedByMe;
        item.likes += item.likedByMe ? 1 : -1;
        saveReels(reelsData);
        btn.classList.toggle('liked', item.likedByMe);
        btn.querySelector('.reel-act-icon').textContent = item.likedByMe ? '❤️' : '🤍';
        btn.querySelector('.reel-act-count').textContent = item.likes;
      });
    });

    feedEl.querySelectorAll('[data-reel-comments]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openReelComments(btn.getAttribute('data-reel-comments'));
      });
    });

    feedEl.querySelectorAll('[data-reel-share]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rid = btn.getAttribute('data-reel-share');
        var item = reelsData.find(function (x) { return x.id === rid; });
        if (item && navigator.clipboard) {
          navigator.clipboard.writeText(item.caption + ' — Hà Nội Phố Vị Reels').catch(function () {});
        }
        window.alert('🔗 Đã sao chép nội dung Reel để chia sẻ với bạn bè!');
      });
    });

    feedEl.querySelectorAll('[data-reel-spot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = parseInt(btn.getAttribute('data-reel-spot'), 10);
        modal.classList.remove('open');
        var cardBtn = document.querySelector('.btn-card-details[data-id="' + sid + '"]');
        if (cardBtn) cardBtn.click();
      });
    });
  }

  /* ---- Comments Drawer ---- */
  function openReelComments(reelId) {
    activeCommentReelId = reelId;
    var item = reelsData.find(function (x) { return x.id === reelId; });
    if (!item) return;
    if ($('reelCommentsTitle')) $('reelCommentsTitle').textContent = '💬 Bình luận (' + (item.comments ? item.comments.length : 0) + ')';
    var listEl = $('reelCommentsList');
    if (listEl) {
      var cmts = item.comments || [];
      listEl.innerHTML = cmts.length
        ? cmts.map(function (c) {
            return '<div class="reel-comment-item"><strong>' + esc(c.author) + '</strong><span>' + esc(c.time) + '</span><p>' + esc(c.text) + '</p></div>';
          }).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.84rem;">Chưa có bình luận nào. Hãy để lại bình luận đầu tiên nhé!</div>';
    }
    if ($('reelCommentsDrawer')) $('reelCommentsDrawer').hidden = false;
  }

  function postReelComment() {
    var inp = $('reelCommentInput');
    var txt = (inp && inp.value || '').trim();
    if (!txt || !activeCommentReelId) return;
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    var author = cur ? cur.fullName : 'Thực Khách Hà Thành';
    var item = reelsData.find(function (x) { return x.id === activeCommentReelId; });
    if (!item) return;
    if (!item.comments) item.comments = [];
    item.comments.push({ author: author, time: 'Vừa xong', text: txt });
    saveReels(reelsData);
    inp.value = '';
    openReelComments(activeCommentReelId);
    // Update comment count badge on slide
    var countEl = feedEl.querySelector('[data-reel-comments="' + activeCommentReelId + '"] .reel-act-count');
    if (countEl) countEl.textContent = item.comments.length;
  }

  $('btnCloseReelComments')?.addEventListener('click', function () {
    if ($('reelCommentsDrawer')) $('reelCommentsDrawer').hidden = true;
  });
  $('btnPostReelComment')?.addEventListener('click', postReelComment);
  $('reelCommentInput')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); postReelComment(); }
  });

  /* ---- Upload / Create Reel ---- */
  function openReelUpload() {
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
      var objUrl = URL.createObjectURL(file);
      pendingMedia = { type: 'video', src: objUrl };
      if (prev) {
        prev.innerHTML = '<video src="' + objUrl + '" autoplay loop muted playsinline controls></video>';
        prev.hidden = false;
      }
      if ($('reelDropzoneText')) $('reelDropzoneText').textContent = '🎥 Đã chọn video: ' + file.name;
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
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    var dist = $('reelDistrictSelect') ? $('reelDistrictSelect').value : 'Hoàn Kiếm';
    var spotId = $('reelSpotSelect') && $('reelSpotSelect').value ? parseInt($('reelSpotSelect').value, 10) : null;

    var fallbackImg = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
    if (spotId && typeof RESTAURANTS_DATA !== 'undefined') {
      var spot = RESTAURANTS_DATA.find(function (r) { return r.id === spotId; });
      if (spot && spot.image) fallbackImg = spot.image;
    }

    var newReel = {
      id: 'reel_' + Date.now(),
      authorName: cur ? cur.fullName : 'Thực Khách Hà Thành',
      authorUser: cur ? cur.username : 'thuckhach@hanoiphovi.vn',
      avatarData: cur && cur.avatarData ? cur.avatarData : '',
      district: dist,
      spotId: spotId,
      mediaType: pendingMedia ? pendingMedia.type : 'image',
      mediaSrc: pendingMedia ? pendingMedia.src : fallbackImg,
      caption: cap,
      likes: 1,
      likedByMe: true,
      comments: []
    };

    reelsData.unshift(newReel);
    saveReels(reelsData);
    $('formCreateReel').reset();
    pendingMedia = null;
    if ($('reelUploadOverlay')) $('reelUploadOverlay').hidden = true;
    reelFilter = 'all';
    document.querySelectorAll('.reels-filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-reel-filter') === 'all');
    });
    renderReelsFeed();
    feedEl.scrollTo({ top: 0, behavior: 'smooth' });
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
      renderReelsFeed();
      feedEl.scrollTo({ top: 0 });
    });
  });

  btnOpen.addEventListener('click', function () {
    modal.classList.add('open');
    renderReelsFeed();
    feedEl.focus();
  });
  btnClose?.addEventListener('click', function () { modal.classList.remove('open'); });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('open')) return;
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); stepReel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); stepReel(-1); }
  });
})();
