/**
 * HÀ NỘI PHỐ VỊ - ĐẶT GIAO HÀNG TẬN NƠI (SHOPEEFOOD-STYLE) & ĐẶT BÀN TRƯỚC
 * Tích hợp đầy đủ cho 744 nhà hàng/quán ăn trong RESTAURANTS_DATA
 */
(function () {
  'use strict';

  var ORDERS_KEY = 'hanoi_phovi_delivery_orders_v1';
  var RESERVES_KEY = 'hanoi_phovi_reservations_v1';
  var PROFILE_KEY = 'hanoi_phovi_delivery_profile_v1';

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

  var TIME_SLOTS = [
    '11:00', '11:30', '12:00', '12:30',
    '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
  ];

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

  var DRIVERS = [
    { name: 'Nguyễn Văn Hùng', plate: '29B1-482.19', rating: '4.9', phone: '0912 345 678' },
    { name: 'Trần Minh Tuấn', plate: '29D2-719.05', rating: '4.9', phone: '0983 221 409' },
    { name: 'Phạm Quang Huy', plate: '29H1-305.88', rating: '4.8', phone: '0904 778 912' },
    { name: 'Lê Đức Anh', plate: '29C1-654.32', rating: '5.0', phone: '0976 112 530' }
  ];

  var activeDeliveryState = {
    restaurant: null,
    menu: [],
    cart: {}, // itemId -> { qty, note }
    voucherCode: 'FREESHIP',
    paymentMethod: 'cod',
    trackingOrderId: null,
    form: { name: '', phone: '', address: '', driverNote: '' }
  };

  var activeReserveState = {
    restaurant: null,
    date: '',
    timeSlot: '19:00',
    guests: 4,
    seating: 'standard',
    preOrderDishes: [],
    form: { name: '', phone: '', notes: '' }
  };

  var activeHubTab = 'delivery';
  var trackingTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtVnd(n) {
    return Math.max(0, Math.round(Number(n) || 0)).toLocaleString('vi-VN') + 'đ';
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

  function getTodayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getTomorrowStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function isTimeSlotPast(dateStr, slotStr) {
    if (!dateStr || dateStr !== getTodayStr()) return false;
    var parts = String(slotStr || '').split(':');
    if (parts.length !== 2) return false;
    var now = new Date();
    var slotMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    var nowMins = now.getHours() * 60 + now.getMinutes();
    return slotMins <= nowMins;
  }

  function readStorage(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      // ignore quota error
    }
  }

  function getOrders() {
    var list = readStorage(ORDERS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveOrders(list) {
    writeStorage(ORDERS_KEY, list);
    updateHubBadges();
  }

  function getReservations() {
    var list = readStorage(RESERVES_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveReservations(list) {
    writeStorage(RESERVES_KEY, list);
    updateHubBadges();
  }

  function getSavedProfile() {
    var prof = readStorage(PROFILE_KEY, {});
    var curUser = (window.HNAuth && typeof window.HNAuth.getCurrentUser === 'function')
      ? window.HNAuth.getCurrentUser()
      : null;
    return {
      name: prof.name || (curUser && curUser.fullName) || '',
      phone: prof.phone || '',
      address: prof.address || ''
    };
  }

  function saveProfile(name, phone, address) {
    writeStorage(PROFILE_KEY, {
      name: name || '',
      phone: phone || '',
      address: address || ''
    });
  }

  // --- CAPABILITY RULES ---
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

  function findRestaurantById(id) {
    if (typeof RESTAURANTS_DATA === 'undefined') return null;
    return RESTAURANTS_DATA.find(function (r) { return r.id === id; }) || null;
  }

  // --- DELIVERY CALCULATION ---
  function computeDeliveryTotals() {
    var subtotal = 0;
    var itemCount = 0;
    var items = [];

    activeDeliveryState.menu.forEach(function (m) {
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
    });

    var meta = getDeliveryMeta(activeDeliveryState.restaurant);
    var shipFee = itemCount > 0 ? meta.fee : 0;
    var discount = 0;
    var voucher = VOUCHERS.find(function (v) { return v.code === activeDeliveryState.voucherCode; });

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

  // --- OPEN DELIVERY MODAL ---
  function captureDeliveryForm() {
    if ($('obDelivName')) activeDeliveryState.form.name = $('obDelivName').value;
    if ($('obDelivPhone')) activeDeliveryState.form.phone = $('obDelivPhone').value;
    if ($('obDelivAddress')) activeDeliveryState.form.address = $('obDelivAddress').value;
    if ($('obDelivDriverNote')) activeDeliveryState.form.driverNote = $('obDelivDriverNote').value;
  }

  function openDelivery(restaurantId, presetItems) {
    var restaurant = findRestaurantById(restaurantId);
    if (!restaurant) return;

    clearInterval(trackingTimer);
    var prof = getSavedProfile();
    activeDeliveryState.restaurant = restaurant;
    activeDeliveryState.menu = buildMenuForRestaurant(restaurant);
    activeDeliveryState.cart = {};
    if (Array.isArray(presetItems) && presetItems.length) {
      presetItems.forEach(function (it) {
        if (activeDeliveryState.menu.some(function (m) { return m.id === it.id; })) {
          activeDeliveryState.cart[it.id] = { qty: Math.max(1, it.qty || 1), note: it.note || '' };
        }
      });
    }
    if (Object.keys(activeDeliveryState.cart).length === 0 && activeDeliveryState.menu.length > 0) {
      // Pre-select 1 signature dish for instant ShopeeFood feel
      activeDeliveryState.cart[activeDeliveryState.menu[0].id] = { qty: 1, note: '' };
    }
    activeDeliveryState.voucherCode = 'FREESHIP';
    activeDeliveryState.paymentMethod = 'cod';
    activeDeliveryState.trackingOrderId = null;
    activeDeliveryState.form = {
      name: prof.name || '',
      phone: prof.phone || '',
      address: prof.address || '',
      driverNote: ''
    };

    renderDeliveryModal();
    var modal = $('deliveryModal');
    if (modal) modal.classList.add('open');
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

    var menuHtml = activeDeliveryState.menu.map(function (item) {
      var cartItem = activeDeliveryState.cart[item.id];
      var qty = cartItem ? cartItem.qty : 0;
      var note = cartItem ? cartItem.note : '';

      return (
        '<div class="ob-menu-item ' + (qty > 0 ? 'in-cart' : '') + '">' +
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
                  '<button type="button" class="ob-qty-btn" data-cart-dec="' + escHtml(item.id) + '">−</button>' +
                  '<span class="ob-qty-val">' + qty + '</span>' +
                  '<button type="button" class="ob-qty-btn plus" data-cart-inc="' + escHtml(item.id) + '">+</button>' +
                '</div>'
              : '<button type="button" class="ob-add-btn" data-cart-inc="' + escHtml(item.id) + '">+ Thêm</button>') +
          '</div>' +
        '</div>'
      );
    }).join('');

    var vouchersHtml = VOUCHERS.map(function (v) {
      var eligible = totals.subtotal >= v.minSubtotal && totals.itemCount > 0;
      var selected = eligible && activeDeliveryState.voucherCode === v.code;
      return (
        '<button type="button" class="ob-voucher-chip ' + (selected ? 'active' : '') + (!eligible ? ' disabled' : '') + '" data-voucher="' + v.code + '">' +
          '<strong>🎟️ ' + v.code + '</strong>' +
          '<span>' + escHtml(v.title) + '</span>' +
        '</button>'
      );
    }).join('');

    var paymentHtml = PAYMENT_METHODS.map(function (pm) {
      return '<option value="' + pm.id + '"' + (activeDeliveryState.paymentMethod === pm.id ? ' selected' : '') + '>' + escHtml(pm.label) + '</option>';
    }).join('');

    container.innerHTML =
      '<div class="ob-deliv-header">' +
        '<div class="ob-deliv-brand-pill">🛵 PHỐ VỊ DELIVERY • ĐỐI TÁC GIAO NHANH</div>' +
        '<h2 id="deliveryModalTitle">' + escHtml(restaurant.name) + '</h2>' +
        '<div class="ob-deliv-meta">' +
          '<span>⭐ ' + restaurant.rating + ' (' + restaurant.reviews.toLocaleString() + ')</span>' +
          '<span>•</span>' +
          '<span>📍 ' + escHtml(restaurant.district) + ' (~' + totals.meta.distanceKm + ' km)</span>' +
          '<span>•</span>' +
          '<span>⏱️ Giao dự kiến ' + totals.meta.etaMin + ' - ' + totals.meta.etaMax + ' phút</span>' +
        '</div>' +
      '</div>' +
      '<div class="ob-deliv-grid">' +
        '<div class="ob-menu-col">' +
          '<h3 class="ob-sec-title">🍽️ Thực đơn giao tận nơi</h3>' +
          '<div class="ob-menu-list">' + menuHtml + '</div>' +
        '</div>' +
        '<div class="ob-checkout-col">' +
          '<div class="ob-card">' +
            '<h3 class="ob-sec-title">📍 Thông tin nhận hàng</h3>' +
            '<div class="ob-form-grid">' +
              '<label class="ob-field">' +
                '<span>Người nhận *</span>' +
                '<input type="text" id="obDelivName" value="' + escHtml(form.name) + '" placeholder="Họ tên người nhận" required />' +
              '</label>' +
              '<label class="ob-field">' +
                '<span>Số điện thoại *</span>' +
                '<input type="tel" id="obDelivPhone" value="' + escHtml(form.phone) + '" placeholder="09xx xxx xxx" required />' +
              '</label>' +
            '</div>' +
            '<label class="ob-field">' +
              '<span>Địa chỉ giao tận nơi (Hà Nội) *</span>' +
              '<input type="text" id="obDelivAddress" value="' + escHtml(form.address) + '" placeholder="Số nhà, ngõ/phố, phường, quận..." required />' +
            '</label>' +
            '<label class="ob-field">' +
              '<span>Ghi chú cho tài xế</span>' +
              '<input type="text" id="obDelivDriverNote" value="' + escHtml(form.driverNote) + '" placeholder="VD: Gọi khi đến cổng, lấy thêm đũa thìa..." />' +
            '</label>' +
          '</div>' +

          '<div class="ob-card">' +
            '<h3 class="ob-sec-title">🎟️ Mã ưu đãi &amp; Thanh toán</h3>' +
            '<div class="ob-voucher-list">' + vouchersHtml + '</div>' +
            '<label class="ob-field" style="margin-top:10px;">' +
              '<span>Phương thức thanh toán</span>' +
              '<select id="obDelivPayment">' + paymentHtml + '</select>' +
            '</label>' +
          '</div>' +

          '<div class="ob-card ob-summary-card">' +
            '<div class="ob-sum-row"><span>Tạm tính (' + totals.itemCount + ' món)</span><strong>' + fmtVnd(totals.subtotal) + '</strong></div>' +
            '<div class="ob-sum-row"><span>Phí giao hàng (~' + totals.meta.distanceKm + ' km)</span><strong>' + fmtVnd(totals.shipFee) + '</strong></div>' +
            '<div class="ob-sum-row discount"><span>Giảm giá (' + (totals.discount > 0 ? totals.voucher.code : 'Chưa áp dụng') + ')</span><strong>−' + fmtVnd(totals.discount) + '</strong></div>' +
            '<div class="ob-sum-total"><span>Tổng thanh toán</span><strong>' + fmtVnd(totals.total) + '</strong></div>' +
            '<button type="button" id="btnPlaceDeliveryOrder" class="ob-submit-delivery-btn" ' + (totals.itemCount === 0 ? 'disabled' : '') + '>' +
              '🛵 Đặt Giao Ngay • ' + fmtVnd(totals.total) +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Bind cart quantity buttons
    container.querySelectorAll('[data-cart-inc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cart-inc');
        if (!activeDeliveryState.cart[id]) activeDeliveryState.cart[id] = { qty: 0, note: '' };
        activeDeliveryState.cart[id].qty += 1;
        renderDeliveryModal();
      });
    });

    container.querySelectorAll('[data-cart-dec]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cart-dec');
        if (!activeDeliveryState.cart[id]) return;
        activeDeliveryState.cart[id].qty -= 1;
        if (activeDeliveryState.cart[id].qty <= 0) {
          delete activeDeliveryState.cart[id];
        }
        renderDeliveryModal();
      });
    });

    container.querySelectorAll('[data-note-id]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-note-id');
        if (activeDeliveryState.cart[id]) {
          activeDeliveryState.cart[id].note = inp.value;
        }
      });
    });

    container.querySelectorAll('[data-voucher]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-voucher');
        var vObj = VOUCHERS.find(function (v) { return v.code === code; });
        var curTotals = computeDeliveryTotals();
        if (vObj && (curTotals.itemCount === 0 || curTotals.subtotal < vObj.minSubtotal)) {
          showToast('Đơn từ ' + fmtVnd(vObj.minSubtotal) + ' mới áp dụng được mã ' + vObj.code + '!', '⚠️');
          return;
        }
        activeDeliveryState.voucherCode = (activeDeliveryState.voucherCode === code) ? '' : code;
        renderDeliveryModal();
      });
    });

    $('obDelivName')?.addEventListener('input', function (e) { activeDeliveryState.form.name = e.target.value; });
    $('obDelivPhone')?.addEventListener('input', function (e) { activeDeliveryState.form.phone = e.target.value; });
    $('obDelivAddress')?.addEventListener('input', function (e) { activeDeliveryState.form.address = e.target.value; });
    $('obDelivDriverNote')?.addEventListener('input', function (e) { activeDeliveryState.form.driverNote = e.target.value; });

    var paySel = $('obDelivPayment');
    if (paySel) {
      paySel.addEventListener('change', function () {
        activeDeliveryState.paymentMethod = paySel.value;
      });
    }

    var placeBtn = $('btnPlaceDeliveryOrder');
    if (placeBtn) {
      placeBtn.addEventListener('click', submitDeliveryOrder);
    }
  }

  function submitDeliveryOrder() {
    var totals = computeDeliveryTotals();
    if (totals.itemCount === 0) {
      showToast('Vui lòng chọn ít nhất 1 món ăn!', '⚠️');
      return;
    }

    var name = ($('obDelivName') && $('obDelivName').value || '').trim();
    var phone = ($('obDelivPhone') && $('obDelivPhone').value || '').trim();
    var address = ($('obDelivAddress') && $('obDelivAddress').value || '').trim();
    var driverNote = ($('obDelivDriverNote') && $('obDelivDriverNote').value || '').trim();

    if (!name) {
      showToast('Vui lòng nhập tên người nhận!', '⚠️');
      $('obDelivName')?.focus();
      return;
    }
    var phoneDigits = phone.replace(/\D+/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      showToast('Số điện thoại chưa hợp lệ (9-11 số)!', '⚠️');
      $('obDelivPhone')?.focus();
      return;
    }
    if (address.length < 5) {
      showToast('Vui lòng nhập địa chỉ giao hàng cụ thể!', '⚠️');
      $('obDelivAddress')?.focus();
      return;
    }

    saveProfile(name, phone, address);

    var restaurant = activeDeliveryState.restaurant;
    var driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
    var payObj = PAYMENT_METHODS.find(function (p) { return p.id === activeDeliveryState.paymentMethod; }) || PAYMENT_METHODS[0];
    var orderId = 'SF-' + String(Math.floor(100000 + Math.random() * 900000));

    var order = {
      id: orderId,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      district: restaurant.district,
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
      cancelled: false,
      createdAt: new Date().toISOString()
    };

    var orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);

    activeDeliveryState.trackingOrderId = orderId;
    showToast('Đặt đơn ' + orderId + ' thành công! Tài xế đang nhận đơn.', '🛵');
    renderDeliveryModal();
    startTrackingSimulation(orderId);
  }

  function startTrackingSimulation(orderId) {
    clearInterval(trackingTimer);
    trackingTimer = setInterval(function () {
      var orders = getOrders();
      var idx = orders.findIndex(function (o) { return o.id === orderId; });
      if (idx === -1 || orders[idx].cancelled || orders[idx].statusStep >= 3) {
        clearInterval(trackingTimer);
        return;
      }
      orders[idx].statusStep += 1;
      saveOrders(orders);
      if (activeDeliveryState.trackingOrderId === orderId && $('deliveryModal')?.classList.contains('open')) {
        renderDeliveryModal();
      }
      if ($('ordersHubModal')?.classList.contains('open') && activeHubTab === 'delivery') {
        renderOrdersHubContent();
      }
    }, 5000);
  }

  function renderTrackingView(container, orderId) {
    var orders = getOrders();
    var order = orders.find(function (o) { return o.id === orderId; });
    if (!order) {
      activeDeliveryState.trackingOrderId = null;
      renderDeliveryModal();
      return;
    }

    var stepsHtml = ORDER_STEPS.map(function (st) {
      var done = !order.cancelled && order.statusStep >= st.key;
      var current = !order.cancelled && order.statusStep === st.key;
      return (
        '<div class="ob-track-step ' + (done ? 'done' : '') + (current ? ' current' : '') + '">' +
          '<div class="ob-track-dot">' + st.icon + '</div>' +
          '<div class="ob-track-label">' + escHtml(st.label) + '</div>' +
        '</div>'
      );
    }).join('');

    var itemsHtml = order.items.map(function (it) {
      return (
        '<div class="ob-track-item">' +
          '<span><strong>' + it.qty + 'x</strong> ' + escHtml(it.name) + (it.note ? ' <em>(' + escHtml(it.note) + ')</em>' : '') + '</span>' +
          '<span>' + fmtVnd(it.lineTotal) + '</span>' +
        '</div>'
      );
    }).join('');

    container.innerHTML =
      '<div class="ob-track-box">' +
        '<div class="ob-track-badge">' + (order.cancelled ? '❌ ĐÃ HỦY ĐƠN' : '🛵 THEO DÕI ĐƠN HÀNG TRỰC TIẾP') + '</div>' +
        '<h2>Đơn hàng ' + escHtml(order.id) + '</h2>' +
        '<p class="ob-track-sub">' + escHtml(order.restaurantName) + ' → ' + escHtml(order.deliveryAddress) + '</p>' +
        (!order.cancelled
          ? '<div class="ob-track-stepper">' + stepsHtml + '</div>' +
            '<div class="ob-driver-card">' +
              '<div class="ob-driver-avatar">🛵</div>' +
              '<div class="ob-driver-info">' +
                '<strong>Tài xế: ' + escHtml(order.driver.name) + ' • ⭐ ' + escHtml(order.driver.rating) + '</strong>' +
                '<span>Biển số: ' + escHtml(order.driver.plate) + ' • SĐT: ' + escHtml(order.driver.phone) + '</span>' +
                '<span>⏱️ Dự kiến giao: ' + order.etaMin + ' - ' + order.etaMax + ' phút</span>' +
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
        '<div class="ob-track-actions">' +
          (!order.cancelled && order.statusStep < 3
            ? '<button type="button" class="ob-btn-secondary" id="btnSimNextStep">⏩ Mô phỏng bước tiếp</button>'
            : '') +
          (!order.cancelled && order.statusStep <= 1
            ? '<button type="button" class="ob-btn-danger" id="btnCancelActiveOrder">✕ Hủy đơn</button>'
            : '') +
          (!order.cancelled && typeof window.openBillSplitterForPlace === 'function'
            ? '<button type="button" class="ob-btn-secondary" id="btnBillActiveOrder">🧾 Chia bill</button>'
            : '') +
          '<button type="button" class="ob-btn-primary" id="btnViewAllOrdersFromTrack">📋 Xem tất cả đơn</button>' +
        '</div>' +
      '</div>';

    $('btnSimNextStep')?.addEventListener('click', function () {
      var list = getOrders();
      var idx = list.findIndex(function (o) { return o.id === orderId; });
      if (idx !== -1 && list[idx].statusStep < 3) {
        list[idx].statusStep += 1;
        saveOrders(list);
        renderDeliveryModal();
      }
    });

    $('btnCancelActiveOrder')?.addEventListener('click', function () {
      var list = getOrders();
      var idx = list.findIndex(function (o) { return o.id === orderId; });
      if (idx !== -1) {
        list[idx].cancelled = true;
        saveOrders(list);
        clearInterval(trackingTimer);
        showToast('Đã hủy đơn hàng ' + orderId, 'ℹ️');
        renderDeliveryModal();
      }
    });

    $('btnBillActiveOrder')?.addEventListener('click', function () {
      clearInterval(trackingTimer);
      $('deliveryModal')?.classList.remove('open');
      openBillForOrder(order);
    });

    $('btnViewAllOrdersFromTrack')?.addEventListener('click', function () {
      $('deliveryModal')?.classList.remove('open');
      openOrdersHub('delivery');
    });
  }

  // --- TABLE RESERVATION MODAL ---
  function captureReserveForm() {
    if ($('obResName')) activeReserveState.form.name = $('obResName').value;
    if ($('obResPhone')) activeReserveState.form.phone = $('obResPhone').value;
    if ($('obResNotes')) activeReserveState.form.notes = $('obResNotes').value;
  }

  function pickDefaultSlotForDate(dateStr) {
    if (!isTimeSlotPast(dateStr, '19:00')) return '19:00';
    var avail = TIME_SLOTS.find(function (t) { return !isTimeSlotPast(dateStr, t); });
    return avail || '';
  }

  function openReservation(restaurantId) {
    var restaurant = findRestaurantById(restaurantId);
    if (!restaurant) return;

    var prof = getSavedProfile();
    var initDate = getTodayStr();
    var initSlot = pickDefaultSlotForDate(initDate);
    if (!initSlot) {
      initDate = getTomorrowStr();
      initSlot = '19:00';
    }

    activeReserveState.restaurant = restaurant;
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

    renderReservationModal();
    var modal = $('reservationModal');
    if (modal) modal.classList.add('open');
  }

  function renderReservationModal(confirmedBooking) {
    var container = $('reservationModalContent');
    var restaurant = activeReserveState.restaurant;
    if (!container || !restaurant) return;

    if (confirmedBooking) {
      var areaObj = SEATING_AREAS.find(function (a) { return a.id === confirmedBooking.seating; }) || SEATING_AREAS[0];
      container.innerHTML =
        '<div class="ob-reserve-confirm">' +
          '<div class="ob-confirm-icon">🏮</div>' +
          '<div class="ob-reserve-badge">✓ ĐẶT BÀN THÀNH CÔNG</div>' +
          '<h2>Mã đặt bàn: ' + escHtml(confirmedBooking.code) + '</h2>' +
          '<p>Bàn của quý khách tại <strong>' + escHtml(confirmedBooking.restaurantName) + '</strong> đã được giữ chỗ.</p>' +
          '<div class="ob-ticket-card">' +
            '<div><span>📅 Ngày &amp; Giờ:</span><strong>' + escHtml(confirmedBooking.date) + ' lúc ' + escHtml(confirmedBooking.timeSlot) + '</strong></div>' +
            '<div><span>👥 Số lượng khách:</span><strong>' + confirmedBooking.guests + ' người</strong></div>' +
            '<div><span>🪑 Khu vực ngồi:</span><strong>' + escHtml(areaObj.label) + '</strong></div>' +
            '<div><span>👤 Người đặt:</span><strong>' + escHtml(confirmedBooking.customerName) + ' (' + escHtml(confirmedBooking.customerPhone) + ')</strong></div>' +
            (confirmedBooking.preOrderDishes.length
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

      $('btnCopyBookingCode')?.addEventListener('click', function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(confirmedBooking.code).catch(function () {});
        }
        showToast('Đã sao chép mã đặt bàn ' + confirmedBooking.code, '📋');
      });

      $('btnViewAllBookings')?.addEventListener('click', function () {
        $('reservationModal')?.classList.remove('open');
        openOrdersHub('reservations');
      });
      return;
    }

    if (!canReserve(restaurant)) {
      container.innerHTML =
        '<div class="ob-reserve-confirm">' +
          '<div class="ob-confirm-icon">🥢</div>' +
          '<h2>Quán Phục Vụ Tại Chỗ (Không Nhận Đặt Bàn Trước)</h2>' +
          '<p><strong>' + escHtml(restaurant.name) + '</strong> thuộc mô hình quán ăn bình dân / phố cổ phục vụ nhanh theo lượt khách đến trực tiếp.</p>' +
          '<div class="ob-track-actions">' +
            '<button type="button" class="ob-btn-primary" id="btnSwitchToDelivery">🛵 Đặt Giao Tận Nơi Thay Thế</button>' +
          '</div>' +
        '</div>';
      $('btnSwitchToDelivery')?.addEventListener('click', function () {
        $('reservationModal')?.classList.remove('open');
        openDelivery(restaurant.id);
      });
      return;
    }

    captureReserveForm();
    if (isTimeSlotPast(activeReserveState.date, activeReserveState.timeSlot)) {
      activeReserveState.timeSlot = pickDefaultSlotForDate(activeReserveState.date);
    }
    var form = activeReserveState.form;
    var timeSlotsHtml = TIME_SLOTS.map(function (t) {
      var isPast = isTimeSlotPast(activeReserveState.date, t);
      return '<button type="button" class="ob-slot-pill ' + (!isPast && activeReserveState.timeSlot === t ? 'active' : '') + '" data-slot="' + t + '"' + (isPast ? ' disabled title="Đã qua khung giờ này"' : '') + '>' + t + '</button>';
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
        '<div class="ob-reserve-badge">🪑 HỖ TRỢ ĐẶT BÀN TRƯỚC</div>' +
        '<h2 id="reservationModalTitle">' + escHtml(restaurant.name) + '</h2>' +
        '<p>📍 ' + escHtml(restaurant.address) + ' • ⏰ ' + escHtml(restaurant.openingHours) + ' • 👥 ' + escHtml(restaurant.peopleRange) + '</p>' +
      '</div>' +
      '<div class="ob-reserve-body">' +
        '<div class="ob-form-grid">' +
          '<label class="ob-field">' +
            '<span>📅 Ngày đến *</span>' +
            '<input type="date" id="obResDate" min="' + getTodayStr() + '" value="' + escHtml(activeReserveState.date) + '" />' +
          '</label>' +
          '<div class="ob-field">' +
            '<span>👥 Số lượng khách *</span>' +
            '<div class="ob-guest-stepper">' +
              '<button type="button" id="btnResGuestDec">−</button>' +
              '<strong id="obResGuestVal">' + activeReserveState.guests + ' người</strong>' +
              '<button type="button" id="btnResGuestInc">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="ob-field">' +
          '<span>⏰ Chọn khung giờ đến *</span>' +
          '<div class="ob-slots-grid">' + timeSlotsHtml + '</div>' +
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
          '<label class="ob-field">' +
            '<span>👤 Họ tên người đặt *</span>' +
            '<input type="text" id="obResName" value="' + escHtml(form.name) + '" placeholder="Họ tên của bạn" required />' +
          '</label>' +
          '<label class="ob-field">' +
            '<span>📞 Số điện thoại *</span>' +
            '<input type="tel" id="obResPhone" value="' + escHtml(form.phone) + '" placeholder="09xx xxx xxx" required />' +
          '</label>' +
        '</div>' +

        '<label class="ob-field">' +
          '<span>📝 Yêu cầu đặc biệt (tùy chọn)</span>' +
          '<input type="text" id="obResNotes" value="' + escHtml(form.notes) + '" placeholder="VD: Bàn sinh nhật, có ghế trẻ em, tránh gió..." />' +
        '</label>' +

        '<button type="button" id="btnConfirmReservation" class="ob-submit-reserve-btn">' +
          '🪑 Xác Nhận Đặt Bàn (' + activeReserveState.guests + ' khách • ' + activeReserveState.timeSlot + ')' +
        '</button>' +
      '</div>';

    $('obResDate')?.addEventListener('change', function (e) {
      activeReserveState.date = e.target.value || getTodayStr();
      renderReservationModal();
    });

    $('obResName')?.addEventListener('input', function (e) { activeReserveState.form.name = e.target.value; });
    $('obResPhone')?.addEventListener('input', function (e) { activeReserveState.form.phone = e.target.value; });
    $('obResNotes')?.addEventListener('input', function (e) { activeReserveState.form.notes = e.target.value; });

    $('btnResGuestDec')?.addEventListener('click', function () {
      activeReserveState.guests = Math.max(1, activeReserveState.guests - 1);
      renderReservationModal();
    });
    $('btnResGuestInc')?.addEventListener('click', function () {
      activeReserveState.guests = Math.min(30, activeReserveState.guests + 1);
      renderReservationModal();
    });

    container.querySelectorAll('[data-slot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeReserveState.timeSlot = btn.getAttribute('data-slot');
        renderReservationModal();
      });
    });

    container.querySelectorAll('[data-seat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeReserveState.seating = btn.getAttribute('data-seat');
        renderReservationModal();
      });
    });

    container.querySelectorAll('[data-preorder-idx]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var val = chk.value;
        var list = activeReserveState.preOrderDishes;
        if (chk.checked) {
          if (list.indexOf(val) === -1) list.push(val);
        } else {
          activeReserveState.preOrderDishes = list.filter(function (x) { return x !== val; });
        }
      });
    });

    $('btnConfirmReservation')?.addEventListener('click', submitReservation);
  }

  function submitReservation() {
    var name = ($('obResName') && $('obResName').value || '').trim();
    var phone = ($('obResPhone') && $('obResPhone').value || '').trim();
    var date = ($('obResDate') && $('obResDate').value) || activeReserveState.date || getTodayStr();
    var notes = ($('obResNotes') && $('obResNotes').value || '').trim();

    if (date < getTodayStr()) {
      showToast('Không thể đặt bàn cho ngày đã qua!', '⚠️');
      $('obResDate')?.focus();
      return;
    }
    if (!activeReserveState.timeSlot || isTimeSlotPast(date, activeReserveState.timeSlot)) {
      showToast('Vui lòng chọn khung giờ hợp lệ (chưa qua)!', '⚠️');
      return;
    }
    if (!name) {
      showToast('Vui lòng nhập họ tên người đặt bàn!', '⚠️');
      $('obResName')?.focus();
      return;
    }
    var phoneDigits = phone.replace(/\D+/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      showToast('Số điện thoại chưa hợp lệ (9-11 số)!', '⚠️');
      $('obResPhone')?.focus();
      return;
    }

    var prof = getSavedProfile();
    saveProfile(name, phone, prof.address);

    var restaurant = activeReserveState.restaurant;
    var code = 'PV-' + String(Math.floor(100000 + Math.random() * 900000));
    var booking = {
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

    var list = getReservations();
    list.unshift(booking);
    saveReservations(list);

    showToast('Đặt bàn thành công! Mã ' + code, '🪑');
    renderReservationModal(booking);
  }

  function openBillForOrder(order) {
    if (!order || typeof window.openBillSplitterForPlace !== 'function') return;
    var billItems = (Array.isArray(order.items) ? order.items : []).filter(Boolean).map(function (it) {
      var itemName = (it.name && String(it.name).trim()) ? String(it.name).trim() : 'Món ăn';
      var itemNote = (it.note && String(it.note).trim()) ? ' (' + String(it.note).trim() + ')' : '';
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

  // --- ORDERS & RESERVATIONS HUB ---
  function openOrdersHub(tab) {
    activeHubTab = tab === 'reservations' ? 'reservations' : 'delivery';
    document.querySelectorAll('.ob-hub-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-ob-tab') === activeHubTab);
    });
    renderOrdersHubContent();
    var modal = $('ordersHubModal');
    if (modal) modal.classList.add('open');
  }

  function renderOrdersHubContent() {
    var content = $('ordersHubContent');
    if (!content) return;

    var orders = getOrders();
    var reserves = getReservations();
    updateHubBadges();

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

      content.innerHTML = orders.map(function (o) {
        var stepObj = ORDER_STEPS[o.statusStep] || ORDER_STEPS[0];
        var statusLabel = o.cancelled ? '❌ Đã hủy' : (stepObj.icon + ' ' + stepObj.label);
        var itemsSummary = o.items.map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');

        return (
          '<div class="ob-hub-card ' + (o.cancelled ? 'cancelled' : '') + '">' +
            '<div class="ob-hub-card-top">' +
              '<div>' +
                '<span class="ob-hub-code">' + escHtml(o.id) + '</span>' +
                '<strong>' + escHtml(o.restaurantName) + '</strong>' +
              '</div>' +
              '<span class="ob-hub-status ' + (o.cancelled ? 'cancel' : (o.statusStep === 3 ? 'done' : 'active')) + '">' + escHtml(statusLabel) + '</span>' +
            '</div>' +
            '<p class="ob-hub-items">🥢 ' + escHtml(itemsSummary) + '</p>' +
            '<div class="ob-hub-meta">' +
              '<span>📍 ' + escHtml(o.deliveryAddress) + '</span>' +
              '<span>💰 <strong>' + fmtVnd(o.total) + '</strong></span>' +
            '</div>' +
            '<div class="ob-hub-actions">' +
              (!o.cancelled && o.statusStep < 3
                ? '<button type="button" class="ob-btn-secondary" data-hub-track="' + escHtml(o.id) + '">📍 Theo dõi trực tiếp</button>'
                : '') +
              '<button type="button" class="ob-btn-secondary" data-hub-reorder="' + o.restaurantId + '" data-hub-reorder-id="' + escHtml(o.id) + '">🔄 Đặt lại</button>' +
              (!o.cancelled && typeof window.openBillSplitterForPlace === 'function'
                ? '<button type="button" class="ob-btn-secondary" data-hub-bill="' + escHtml(o.restaurantName) + '" data-hub-bill-id="' + escHtml(o.id) + '">🧾 Chia bill</button>'
                : '') +
              (!o.cancelled && o.statusStep <= 1
                ? '<button type="button" class="ob-btn-danger" data-hub-cancel-order="' + escHtml(o.id) + '">✕ Hủy đơn</button>'
                : '') +
            '</div>' +
          '</div>'
        );
      }).join('');

      content.querySelectorAll('[data-hub-track]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var oid = btn.getAttribute('data-hub-track');
          var order = getOrders().find(function (x) { return x.id === oid; });
          if (!order) return;
          var rest = findRestaurantById(order.restaurantId);
          activeDeliveryState.restaurant = rest || { id: order.restaurantId, name: order.restaurantName, district: order.district };
          activeDeliveryState.trackingOrderId = oid;
          $('ordersHubModal')?.classList.remove('open');
          renderDeliveryModal();
          $('deliveryModal')?.classList.add('open');
          startTrackingSimulation(oid);
        });
      });

      content.querySelectorAll('[data-hub-reorder]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var rid = parseInt(btn.getAttribute('data-hub-reorder'), 10);
          var oid = btn.getAttribute('data-hub-reorder-id');
          var prevOrder = oid ? getOrders().find(function (x) { return x.id === oid; }) : null;
          $('ordersHubModal')?.classList.remove('open');
          openDelivery(rid, prevOrder ? prevOrder.items : null);
        });
      });

      content.querySelectorAll('[data-hub-bill]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var oid = btn.getAttribute('data-hub-bill-id');
          var place = btn.getAttribute('data-hub-bill');
          var order = oid ? getOrders().find(function (x) { return x.id === oid; }) : null;
          $('ordersHubModal')?.classList.remove('open');
          if (order) {
            openBillForOrder(order);
          } else if (typeof window.openBillSplitterForPlace === 'function') {
            window.openBillSplitterForPlace(place);
          }
        });
      });

      content.querySelectorAll('[data-hub-cancel-order]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var oid = btn.getAttribute('data-hub-cancel-order');
          var list = getOrders();
          var idx = list.findIndex(function (x) { return x.id === oid; });
          if (idx !== -1) {
            list[idx].cancelled = true;
            saveOrders(list);
            showToast('Đã hủy đơn hàng ' + oid, 'ℹ️');
            renderOrdersHubContent();
          }
        });
      });
    } else {
      if (!reserves.length) {
        content.innerHTML =
          '<div class="ob-empty-hub">' +
            '<div style="font-size:2.6rem;">🪑</div>' +
            '<h3>Chưa có lịch đặt bàn nào</h3>' +
            '<p>Các nhà hàng có nhãn <strong>🪑 Đặt bàn</strong> cho phép giữ chỗ trước. Hãy chọn nhà hàng bạn thích để đặt bàn nhé!</p>' +
          '</div>';
        return;
      }

      content.innerHTML = reserves.map(function (b) {
        var areaObj = SEATING_AREAS.find(function (a) { return a.id === b.seating; }) || SEATING_AREAS[0];
        var isCancelled = b.status === 'cancelled';

        return (
          '<div class="ob-hub-card ' + (isCancelled ? 'cancelled' : '') + '">' +
            '<div class="ob-hub-card-top">' +
              '<div>' +
                '<span class="ob-hub-code">' + escHtml(b.code) + '</span>' +
                '<strong>' + escHtml(b.restaurantName) + '</strong>' +
              '</div>' +
              '<span class="ob-hub-status ' + (isCancelled ? 'cancel' : 'done') + '">' + (isCancelled ? '❌ Đã hủy' : '✓ Đã xác nhận') + '</span>' +
            '</div>' +
            '<div class="ob-hub-meta">' +
              '<span>📅 ' + escHtml(b.date) + ' lúc <strong>' + escHtml(b.timeSlot) + '</strong></span>' +
              '<span>👥 ' + b.guests + ' khách • ' + escHtml(areaObj.label) + '</span>' +
            '</div>' +
            (b.preOrderDishes && b.preOrderDishes.length
              ? '<p class="ob-hub-items">🍲 Đặt trước: ' + escHtml(b.preOrderDishes.join(', ')) + '</p>'
              : '') +
            '<div class="ob-hub-actions">' +
              '<button type="button" class="ob-btn-secondary" data-hub-copy-code="' + escHtml(b.code) + '">📋 Copy mã</button>' +
              (!isCancelled
                ? '<button type="button" class="ob-btn-danger" data-hub-cancel-res="' + escHtml(b.code) + '">✕ Hủy đặt bàn</button>'
                : '') +
            '</div>' +
          '</div>'
        );
      }).join('');

      content.querySelectorAll('[data-hub-copy-code]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-hub-copy-code');
          if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
          showToast('Đã sao chép mã ' + code, '📋');
        });
      });

      content.querySelectorAll('[data-hub-cancel-res]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-hub-cancel-res');
          var list = getReservations();
          var idx = list.findIndex(function (x) { return x.code === code; });
          if (idx !== -1) {
            list[idx].status = 'cancelled';
            saveReservations(list);
            showToast('Đã hủy lịch đặt bàn ' + code, 'ℹ️');
            renderOrdersHubContent();
          }
        });
      });
    }
  }

  function updateHubBadges() {
    var orders = getOrders();
    var reserves = getReservations();
    var activeOrders = orders.filter(function (o) { return !o.cancelled; }).length;
    var activeReserves = reserves.filter(function (r) { return r.status !== 'cancelled'; }).length;

    var totalBadge = $('ordersHubCountBadge');
    if (totalBadge) totalBadge.textContent = String(activeOrders + activeReserves);

    var delivPill = $('obTabDeliveryCount');
    if (delivPill) delivPill.textContent = String(orders.length);

    var resPill = $('obTabReserveCount');
    if (resPill) resPill.textContent = String(reserves.length);
  }

  function initOrderBooking() {
    updateHubBadges();

    $('btnOpenOrdersHubHero')?.addEventListener('click', function () {
      openOrdersHub('delivery');
    });

    $('btnCloseDeliveryModal')?.addEventListener('click', function () {
      clearInterval(trackingTimer);
      $('deliveryModal')?.classList.remove('open');
    });
    $('deliveryModal')?.addEventListener('click', function (e) {
      if (e.target === $('deliveryModal')) {
        clearInterval(trackingTimer);
        $('deliveryModal').classList.remove('open');
      }
    });

    $('btnCloseReservationModal')?.addEventListener('click', function () {
      $('reservationModal')?.classList.remove('open');
    });
    $('reservationModal')?.addEventListener('click', function (e) {
      if (e.target === $('reservationModal')) {
        $('reservationModal').classList.remove('open');
      }
    });

    $('btnCloseOrdersHubModal')?.addEventListener('click', function () {
      $('ordersHubModal')?.classList.remove('open');
    });
    $('ordersHubModal')?.addEventListener('click', function (e) {
      if (e.target === $('ordersHubModal')) {
        $('ordersHubModal').classList.remove('open');
      }
    });

    document.querySelectorAll('.ob-hub-tab').forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        activeHubTab = tabBtn.getAttribute('data-ob-tab') || 'delivery';
        document.querySelectorAll('.ob-hub-tab').forEach(function (t) {
          t.classList.toggle('active', t === tabBtn);
        });
        renderOrdersHubContent();
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if ($('deliveryModal')?.classList.contains('open')) {
          clearInterval(trackingTimer);
          $('deliveryModal').classList.remove('open');
        }
        if ($('reservationModal')?.classList.contains('open')) {
          $('reservationModal').classList.remove('open');
        }
        if ($('ordersHubModal')?.classList.contains('open')) {
          $('ordersHubModal').classList.remove('open');
        }
      }
    });
  }

  window.HNOrderBooking = {
    canReserve: canReserve,
    canDeliver: canDeliver,
    getDeliveryMeta: getDeliveryMeta,
    openDelivery: openDelivery,
    openReservation: openReservation,
    openOrdersHub: openOrdersHub
  };

  document.addEventListener('DOMContentLoaded', initOrderBooking);
})();
