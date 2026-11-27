/**
 * HÀ NỘI PHỐ VỊ - UTILITIES, OWNER PORTAL, REPORTS, BUSY HOURS & VI/EN I18N
 * Loads right AFTER data.js and BEFORE app.js.
 * Strict ES5 IIFE (var/function), UTF-8 without BOM.
 */
(function (window, document) {
  'use strict';

  var OWNER_PLACES_KEY = 'hanoi_phovi_owner_places_v1';
  var OWNER_OVERRIDES_KEY = 'hanoi_phovi_owner_overrides_v1';
  var REPORTS_KEY = 'hanoi_phovi_reports_v1';
  var LANG_KEY = 'hanoi_phovi_lang_v1';
  var DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80';

  var ISSUE_TYPES = [
    'closed_permanently',
    'wrong_hours',
    'wrong_address',
    'wrong_price',
    'other'
  ];

  var DISTRICTS_LIST = [
    'Hoàn Kiếm',
    'Ba Đình',
    'Đống Đa',
    'Hai Bà Trưng',
    'Cầu Giấy',
    'Tây Hồ',
    'Hà Đông',
    'Thanh Xuân',
    'Nam Từ Liêm',
    'Bắc Từ Liêm',
    'Long Biên',
    'Hoàng Mai'
  ];

  var CATEGORIES_LIST = [
    'Phở & Bún',
    'Bún chả & Nem',
    'Bún & Miến',
    'Chả cá',
    'Cơm & Món Bắc',
    'Lẩu & Nướng',
    'Hải Sản & Đặc Sản',
    'Cao cấp & Fine Dining',
    'Ăn vặt & Đường phố',
    'Quà Vặt & Chè',
    'Quà Sáng & Bánh',
    'Tráng miệng & Cà phê',
    'Cà Phê & Quà Chiều',
    'Ẩm Thực Hàn Quốc',
    'Ẩm Thực Trung Hoa',
    'Ẩm Thực Quốc Tế'
  ];

  /* ========================================================================
     SHARED HELPERS
     ======================================================================== */
  function readJsonStorage(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed !== null && typeof parsed !== 'undefined' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJsonStorage(key, val) {
    try {
      window.localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(str) {
    if (str === null || typeof str === 'undefined') return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(str) {
    var s = String(str || '').toLowerCase();
    if (s.normalize) {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s.replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  }

  function getCatalog() {
    if (typeof RESTAURANTS_DATA !== 'undefined' && Array.isArray(RESTAURANTS_DATA)) {
      return RESTAURANTS_DATA;
    }
    if (window.HNAppBridge && typeof window.HNAppBridge.getAllRestaurants === 'function') {
      var list = window.HNAppBridge.getAllRestaurants();
      return Array.isArray(list) ? list : [];
    }
    return [];
  }

  function findRestaurantById(id) {
    var numId = Number(id);
    if (isNaN(numId)) return null;
    var list = getCatalog();
    for (var i = 0; i < list.length; i++) {
      if (Number(list[i].id) === numId) return list[i];
    }
    return null;
  }

  function showToastSafe(msg) {
    if (window.HNAppBridge && typeof window.HNAppBridge.showToast === 'function') {
      window.HNAppBridge.showToast(msg);
      return;
    }
    var toast = document.getElementById('toastNotice');
    if (toast) {
      toast.innerHTML = '<span>✨</span> <span>' + escapeHtml(msg) + '</span>';
      toast.classList.add('show');
      window.clearTimeout(toast._hnTimer);
      toast._hnTimer = window.setTimeout(function () {
        toast.classList.remove('show');
      }, 2800);
    }
  }

  function notifyCatalogUpdated() {
    if (window.HNAppBridge && typeof window.HNAppBridge.invalidateCacheAndRender === 'function') {
      window.HNAppBridge.invalidateCacheAndRender();
    }
  }

  function awardPointsSafe(points, reason, type) {
    if (window.HNRewards && typeof window.HNRewards.addPoints === 'function') {
      try {
        window.HNRewards.addPoints(points, reason, type);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function getCurrentUserLabel() {
    try {
      if (window.HNAuth && typeof window.HNAuth.getCurrentUser === 'function') {
        var u = window.HNAuth.getCurrentUser();
        if (u && (u.name || u.email)) {
          return u.name || u.email;
        }
      }
    } catch (e) {}
    return getLang() === 'en' ? 'Guest Diner' : 'Thực khách ẩn danh';
  }

  /* ========================================================================
     4. MULTILINGUAL VI / EN SUPPORT (window.HNi18n)
     ======================================================================== */
  var currentLang = 'vi';
  try {
    var savedLang = window.localStorage.getItem(LANG_KEY);
    if (savedLang === 'en' || savedLang === 'vi') {
      currentLang = savedLang;
    }
  } catch (e) {}
  if (document && document.documentElement) {
    document.documentElement.lang = currentLang;
  }

  var DICT = {
    vi: {
      top_notice: '🏮 Cẩm nang ẩm thực kinh kỳ • Dữ liệu định vị xác thực trên Google Maps & Michelin Guide',
      login_btn: 'Đăng nhập',
      register_btn: 'Tạo tài khoản',
      logout_btn: 'Đăng xuất',
      brightness_btn: 'Độ sáng',
      theme_dark: 'Tối',
      theme_light: 'Sáng',
      sound_on: 'Âm thanh: Bật',
      sound_off: 'Âm thanh: Tắt',
      install_app: 'Cài App',
      brand_badge: 'KHÁM PHÁ 2400 QUÁN ĂN & ĐẶC SẢN CHUẨN VỊ TỪ GOOGLE MAPS',
      site_subtitle: '"Miếng ngon Hà Nội không chỉ làm no cái bụng, mà còn đánh thức cả một trời ký ức thanh tao"',
      engage_hub: 'Danh Sách & Bình Chọn',
      owner_portal: 'Chủ Quán',
      lucky_btn: 'Hôm Nay Ăn Gì? (Máy Gashapon Món Ăn)',
      fav_btn: 'Sổ Tay Quán Quen',
      community_btn: 'Nhóm Chat & Bạn Bè',
      reels_btn: 'Lướt Reels & Up Bài',
      games_btn: 'Trò Chơi',
      bill_btn: 'Tính Tiền & Chia Bill',
      orders_btn: 'Đơn Giao & Đặt Bàn',
      movies_btn: 'Xem Phim',
      stat_1_title: '2400 Quán Ngon Khắp Hà Nội',
      stat_1_sub: 'Mỗi quận đều có từ 10+ quán tuyển chọn',
      stat_2_title: 'Đánh Giá Google Maps 4.0+',
      stat_2_sub: 'Hàng nghìn review thực tế',
      stat_3_title: 'Chỉ Đường Trực Tiếp',
      stat_3_sub: '1-click mở Google Maps',
      stat_4_title: 'Bộ Lọc 4 Chiều',
      stat_4_sub: 'Giá • Người • Quận • Dịp',
      lucky_heading: 'Bạn đang phân vân chưa biết chọn quán nào hôm nay?',
      lucky_sub: 'Bấm một chạm để hệ thống chọn ngay một quán ăn phù hợp theo tiêu chí hiện tại của bạn.',
      lucky_fast_btn: 'Tung Xúc Xắc May Mắn (1 Chạm)',
      search_placeholder: 'Tìm theo món ăn (phở, bún chả, chả cá, ốc...), tên quán hoặc tên phố...',
      nlp_search_btn: '✨ Tìm ngôn ngữ tự nhiên',
      claude_config_btn: '⚙️ Claude API',
      filter_price: 'Giá thành (Mỗi người)',
      filter_people: 'Số lượng người đi',
      filter_district: 'Địa điểm (Quận / Phố)',
      filter_occasion: 'Sự kiện / Dịp đi ăn',
      filter_time: 'Khung giờ đi ăn',
      time_now: '🕒 Giờ hiện tại (Mặc định)',
      time_custom: '⏰ Chọn giờ tùy chỉnh...',
      pill_all: 'Tất cả quán',
      pill_open_now: '🟢 Chỉ quán đang mở',
      pill_hadong: '🏘️ Quán ngon Hà Đông',
      pill_michelin: '🎖️ Đạt giải Michelin',
      pill_reservable: '🪑 Có đặt bàn trước',
      pill_favorites: '❤️ Quán đã lưu',
      reset_filters: '↺ Xóa tất cả bộ lọc',
      sort_label: 'Sắp xếp theo:',
      sort_rating_desc: '⭐ Đánh giá cao nhất (Google Maps)',
      sort_reviews_desc: '💬 Lượt đánh giá nhiều nhất',
      sort_price_asc: '💵 Giá từ thấp đến cao',
      sort_price_desc: '💎 Giá từ cao xuống thấp',
      sort_name_asc: '🔤 Tên quán (A - Z)',
      modal_claw_title: '🎰 MÁY GASHAPON ẨM THỰC',
      modal_auth_title: 'THẺ THỰC KHÁCH KINH KỲ',
      modal_comm_title: '💬 CỘNG ĐỒNG HÀ NỘI',
      modal_bill_title: '🧾 TÍNH TIỀN, CHIA BILL & XUẤT HÓA ĐƠN',
      modal_orders_title: '🛵 ĐƠN GIAO HÀNG & LỊCH ĐẶT BÀN',
      modal_movies_title: '🍿 RẠP CHIẾU PHIM HÀ NỘI PHỐ VỊ',
      modal_owner_title: '🏪 CỔNG CHỦ QUÁN & ĐỐI TÁC',
      modal_engage_title: '🏆 DANH SÁCH, BÌNH CHỌN & HUY HIỆU',
      modal_wte_title: '🎲 HÔM NAY ĂN GÌ?',
      modal_report_title: '🚩 BÁO LỖI THÔNG TIN / ĐÓNG CỬA',
      modal_claude_title: '⚙️ CẤU HÌNH CLAUDE API',
      modal_pwa_title: '📲 CÀI ĐẶT ỨNG DỤNG HÀ NỘI PHỐ VỊ',
      mob_explore: 'Khám phá',
      mob_random: 'Ăn gì?',
      mob_engage: 'Nhóm',
      mob_orders: 'Đơn bàn',
      mob_owner: 'Chủ quán',
      busy_title: '📊 Dự báo mật độ khách theo giờ',
      busy_low: 'Vắng khách',
      busy_medium: 'Đông vừa',
      busy_high: 'Rất đông',
      busy_closed: 'Đóng cửa',
      busy_peak: 'Cao điểm',
      busy_all_closed: 'Quán đang tạm nghỉ hoặc ngoài giờ mở cửa',
      status_open: 'Đang mở',
      status_closed: 'Đóng cửa',
      status_open_at: '🟢 Đang mở lúc ',
      status_closed_at: '🔴 Đóng cửa lúc ',
      toast_fav_removed: 'Đã bỏ quán khỏi Sổ tay quán quen',
      toast_fav_added: '❤️ Đã lưu vào Sổ tay quán quen!',
      results_empty: 'Không tìm thấy quán ăn phù hợp',
      results_empty_sub: 'Hãy thử giảm bớt các điều kiện lọc hoặc xóa từ khóa tìm kiếm để khám phá thêm nhiều quán ngon khác bạn nhé.',
      card_details_btn: 'Chi tiết & Mẹo',
      card_delivery_btn: 'Đặt giao tận nơi',
      card_reserve_btn: 'Đặt bàn trước',
      report_btn: '🚩 Báo lỗi / Đóng cửa',
      report_heading: 'Báo cáo thông tin chưa chính xác',
      report_choose: 'Chọn loại vấn đề bạn gặp phải:',
      report_note_label: 'Ghi chú thêm (tùy chọn)',
      report_note_ph: 'Ví dụ: Quán đã chuyển sang số 25, hoặc chỉ mở đến 21:00...',
      report_submit: '📨 Gửi báo cáo (+15 điểm)',
      report_success: '✅ Cảm ơn bạn! Đã ghi nhận báo cáo (+15 điểm thưởng nếu có).',
      report_banner_title: '⚠️ Cảnh báo từ cộng đồng thực khách',
      report_banner_temp_closed: '⏸️ Chủ quán hiện đánh dấu quán đang TẠM NGHỈ.',
      issue_closed_permanently: '🚫 Đóng cửa vĩnh viễn',
      issue_wrong_hours: '⏰ Sai giờ mở cửa',
      issue_wrong_address: '📍 Sai địa chỉ',
      issue_wrong_price: '💰 Sai mức giá',
      issue_other: '📝 Thông tin khác',
      owner_tab_register: '➕ Đăng ký quán mới',
      owner_tab_update: '✏️ Cập nhật quán',
      owner_tab_reports: '🚩 Xử lý báo lỗi',
      owner_reg_desc: 'Thêm địa điểm ẩm thực mới vào cẩm nang Hà Nội Phố Vị (+30 điểm thưởng).',
      owner_upd_desc: 'Chỉnh sửa giờ mở cửa, mức giá, món đặc trưng hoặc trạng thái tạm nghỉ.',
      owner_rep_desc: 'Xem và xử lý các báo cáo sai thông tin từ cộng đồng.',
      owner_name: 'Tên quán ăn / Nhà hàng *',
      owner_district: 'Quận / Khu vực *',
      owner_category: 'Danh mục món *',
      owner_address: 'Địa chỉ chi tiết *',
      owner_hours: 'Giờ mở cửa *',
      owner_price: 'Khoảng giá tham khảo *',
      owner_dishes: 'Món đặc trưng (phân cách dấu phẩy)',
      owner_phone: 'Số điện thoại liên hệ',
      owner_tips: 'Mẹo cho thực khách (chỗ gửi xe, giờ vắng...)',
      owner_image: 'Link ảnh quán (tùy chọn)',
      owner_reg_btn: '🏪 Đăng Ký Quán Lên Cẩm Nang',
      owner_upd_btn: '💾 Lưu Cập Nhật Thông Tin',
      owner_temp_closed: '⏸️ Đánh dấu quán đang TẠM NGHỈ phục vụ',
      owner_search_place: 'Tìm quán để cập nhật (tên hoặc ID)',
      owner_resolve_btn: '✓ Đánh dấu đã xử lý',
      owner_edit_place_btn: '✏️ Sửa quán này',
      owner_view_place_btn: '👁️ Xem quán',
      owner_no_reports: 'Hiện chưa có báo lỗi nào cần xử lý.',
      owner_resolved_tag: 'Đã xử lý',
      owner_pending_tag: 'Chờ xử lý'
    },
    en: {
      top_notice: '🏮 Hanoi Culinary Guide • Verified locations on Google Maps & Michelin Guide',
      login_btn: 'Sign In',
      register_btn: 'Register',
      logout_btn: 'Sign Out',
      brightness_btn: 'Brightness',
      theme_dark: 'Dark',
      theme_light: 'Light',
      sound_on: 'Sound: On',
      sound_off: 'Sound: Off',
      install_app: 'Install App',
      brand_badge: 'EXPLORE 2,400 AUTHENTIC HANOI EATERIES & SPECIALTIES',
      site_subtitle: '"Hanoi delicacies not only satisfy the appetite, they awaken an entire sky of refined memories"',
      engage_hub: 'Lists & Group Polls',
      owner_portal: 'Owner Portal',
      lucky_btn: 'What to Eat Today? (Gashapon)',
      fav_btn: 'Saved Favorites',
      community_btn: 'Community Chat & Friends',
      reels_btn: 'Food Reels & Posts',
      games_btn: 'Mini Games',
      bill_btn: 'Split Bill & Receipt',
      orders_btn: 'Orders & Bookings',
      movies_btn: 'Cinema',
      stat_1_title: '2,400+ Hanoi Eateries',
      stat_1_sub: 'Handpicked spots across every district',
      stat_2_title: 'Google Maps 4.0+ Rated',
      stat_2_sub: 'Thousands of real diner reviews',
      stat_3_title: 'Direct Navigation',
      stat_3_sub: '1-click Google Maps directions',
      stat_4_title: '4D Smart Filters',
      stat_4_sub: 'Price • Group • District • Occasion',
      lucky_heading: 'Not sure where to eat in Hanoi today?',
      lucky_sub: 'Tap once to let us pick an open spot matching your current filters.',
      lucky_fast_btn: 'Roll Lucky Dice (1-Tap)',
      search_placeholder: 'Search by dish (pho, bun cha, cha ca...), restaurant name or street...',
      nlp_search_btn: '✨ Natural Language Search',
      claude_config_btn: '⚙️ Claude API',
      filter_price: 'Price Range (Per Person)',
      filter_people: 'Party Size',
      filter_district: 'District / Area',
      filter_occasion: 'Dining Occasion',
      filter_time: 'Dining Time Slot',
      time_now: '🕒 Current Time (Default)',
      time_custom: '⏰ Choose Custom Time...',
      pill_all: 'All Places',
      pill_open_now: '🟢 Open Now Only',
      pill_hadong: '🏘️ Ha Dong Picks',
      pill_michelin: '🎖️ Michelin Listed',
      pill_reservable: '🪑 Table Booking',
      pill_favorites: '❤️ Saved Favorites',
      reset_filters: '↺ Reset All Filters',
      sort_label: 'Sort by:',
      sort_rating_desc: '⭐ Highest Rated (Google Maps)',
      sort_reviews_desc: '💬 Most Reviewed',
      sort_price_asc: '💵 Price: Low to High',
      sort_price_desc: '💎 Price: High to Low',
      sort_name_asc: '🔤 Name (A - Z)',
      modal_claw_title: '🎰 CULINARY GASHAPON MACHINE',
      modal_auth_title: 'DINER MEMBERSHIP CARD',
      modal_comm_title: '💬 HANOI FOOD COMMUNITY',
      modal_bill_title: '🧾 BILL SPLITTER & RECEIPT EXPORTER',
      modal_orders_title: '🛵 DELIVERY ORDERS & TABLE BOOKINGS',
      modal_movies_title: '🍿 HANOI PHO VI CINEMA',
      modal_owner_title: '🏪 RESTAURANT OWNER PORTAL',
      modal_engage_title: '🏆 LISTS, GROUP POLLS & BADGES',
      modal_wte_title: '🎲 WHAT TO EAT TODAY?',
      modal_report_title: '🚩 REPORT WRONG INFO / CLOSURE',
      modal_claude_title: '⚙️ CLAUDE API SETTINGS',
      modal_pwa_title: '📲 INSTALL HANOI PHO VI APP',
      mob_explore: 'Explore',
      mob_random: 'Random',
      mob_engage: 'Groups',
      mob_orders: 'Orders',
      mob_owner: 'Owners',
      busy_title: '📊 Hourly Busyness Forecast',
      busy_low: 'Not busy',
      busy_medium: 'Moderate',
      busy_high: 'Very busy',
      busy_closed: 'Closed',
      busy_peak: 'Peak hours',
      busy_all_closed: 'Currently temporarily closed or outside opening hours',
      status_open: 'Open',
      status_closed: 'Closed',
      status_open_at: '🟢 Open at ',
      status_closed_at: '🔴 Closed at ',
      toast_fav_removed: 'Removed from Saved Favorites',
      toast_fav_added: '❤️ Added to Saved Favorites!',
      results_empty: 'No matching restaurants found',
      results_empty_sub: 'Try relaxing your filters or clearing the search keyword to explore more Hanoi spots.',
      card_details_btn: 'Details & Tips',
      card_delivery_btn: 'Order Delivery',
      card_reserve_btn: 'Book Table',
      report_btn: '🚩 Report / Closed',
      report_heading: 'Report inaccurate restaurant details',
      report_choose: 'Select the issue type:',
      report_note_label: 'Additional details (optional)',
      report_note_ph: 'E.g. Moved to #25, or closes at 21:00...',
      report_submit: '📨 Submit Report (+15 pts)',
      report_success: '✅ Thank you! Report submitted (+15 reward pts).',
      report_banner_title: '⚠️ Community Diner Notice',
      report_banner_temp_closed: '⏸️ The owner has marked this venue as TEMPORARILY CLOSED.',
      issue_closed_permanently: '🚫 Permanently closed',
      issue_wrong_hours: '⏰ Wrong opening hours',
      issue_wrong_address: '📍 Wrong address',
      issue_wrong_price: '💰 Wrong price range',
      issue_other: '📝 Other issue',
      owner_tab_register: '➕ Register Place',
      owner_tab_update: '✏️ Update Place',
      owner_tab_reports: '🚩 Resolve Reports',
      owner_reg_desc: 'Add a new restaurant to the Hanoi Pho Vi directory (+30 reward pts).',
      owner_upd_desc: 'Update opening hours, price range, signature dishes, or temporary closure.',
      owner_rep_desc: 'Review and resolve inaccurate info reports submitted by diners.',
      owner_name: 'Restaurant Name *',
      owner_district: 'District *',
      owner_category: 'Cuisine Category *',
      owner_address: 'Street Address *',
      owner_hours: 'Opening Hours *',
      owner_price: 'Price Range *',
      owner_dishes: 'Signature Dishes (comma-separated)',
      owner_phone: 'Phone Number',
      owner_tips: 'Diner Tips (parking, quiet hours...)',
      owner_image: 'Photo URL (optional)',
      owner_reg_btn: '🏪 Publish Restaurant',
      owner_upd_btn: '💾 Save Updates',
      owner_temp_closed: '⏸️ Mark venue as TEMPORARILY CLOSED',
      owner_search_place: 'Find restaurant to edit (name or ID)',
      owner_resolve_btn: '✓ Mark Resolved',
      owner_edit_place_btn: '✏️ Edit Place',
      owner_view_place_btn: '👁️ View Place',
      owner_no_reports: 'No reports pending review right now.',
      owner_resolved_tag: 'Resolved',
      owner_pending_tag: 'Pending'
    }
  };

  var CATEGORY_EN_MAP = {
    'Phở & Bún': 'Pho & Noodles',
    'Bún chả & Nem': 'Bun Cha & Spring Rolls',
    'Bún & Miến': 'Vermicelli & Glass Noodles',
    'Chả cá': 'Hanoi Grilled Fish (Cha Ca)',
    'Cơm & Món Bắc': 'Northern Rice & Home Cooking',
    'Cao cấp & Fine Dining': 'Upscale & Fine Dining',
    'Lẩu & Nướng': 'Hotpot & BBQ',
    'Ăn vặt & Đường phố': 'Street Food & Snacks',
    'Tráng miệng & Cà phê': 'Desserts & Coffee',
    'Quà Vặt & Chè': 'Sweet Soup (Che) & Snacks',
    'Ẩm Thực Hàn Quốc': 'Korean Cuisine',
    'Ẩm Thực Trung Hoa': 'Chinese Cuisine',
    'Ẩm Thực Quốc Tế': 'International Cuisine',
    'Cà Phê & Quà Chiều': 'Coffee & Afternoon Tea',
    'Quà Sáng & Bánh': 'Breakfast & Pastries',
    'Hải Sản & Đặc Sản': 'Seafood & Specialties'
  };

  var OCCASION_MAP = {
    breakfast: { vi: 'Ăn sáng đầu ngày', en: 'Morning Breakfast' },
    quick_lunch: { vi: 'Bữa trưa công sở', en: 'Quick Office Lunch' },
    date: { vi: 'Hẹn hò lãng mạn', en: 'Romantic Date' },
    friends: { vi: 'Họp mặt bạn bè / Nhậu', en: 'Friends Hangout & Drinks' },
    family: { vi: 'Sum họp gia đình', en: 'Family Gathering' },
    business: { vi: 'Tiếp khách / Đối tác', en: 'Business & Clients' },
    night_snack: { vi: 'Ăn đêm / Quà vặt phố', en: 'Late-Night Eats' }
  };

  function getLang() {
    return currentLang === 'en' ? 'en' : 'vi';
  }

  function t(key, fallback) {
    var lang = getLang();
    if (DICT[lang] && typeof DICT[lang][key] === 'string') {
      return DICT[lang][key];
    }
    if (DICT.vi && typeof DICT.vi[key] === 'string') {
      return DICT.vi[key];
    }
    return typeof fallback === 'string' ? fallback : key;
  }

  function translateCategory(cat) {
    var raw = String(cat || '').trim();
    if (!raw) return getLang() === 'en' ? 'Hanoi Cuisine' : 'Ẩm thực Hà Nội';
    if (getLang() === 'vi') return raw;
    if (CATEGORY_EN_MAP[raw]) return CATEGORY_EN_MAP[raw];
    var norm = normalizeText(raw);
    for (var k in CATEGORY_EN_MAP) {
      if (Object.prototype.hasOwnProperty.call(CATEGORY_EN_MAP, k) && normalizeText(k) === norm) {
        return CATEGORY_EN_MAP[k];
      }
    }
    return raw;
  }

  function translateOccasion(occ) {
    var raw = String(occ || '').trim();
    if (!raw) return '';
    var lang = getLang();
    if (OCCASION_MAP[raw]) return OCCASION_MAP[raw][lang];
    var norm = normalizeText(raw);
    for (var k in OCCASION_MAP) {
      if (Object.prototype.hasOwnProperty.call(OCCASION_MAP, k)) {
        if (normalizeText(OCCASION_MAP[k].vi) === norm || normalizeText(OCCASION_MAP[k].en) === norm) {
          return OCCASION_MAP[k][lang];
        }
      }
    }
    return raw;
  }

  function setTextWithSavedVi(el, text) {
    if (!el) return;
    if (!el.dataset.hnOrigVi) {
      el.dataset.hnOrigVi = el.textContent;
    }
    el.textContent = getLang() === 'vi' ? el.dataset.hnOrigVi : text;
  }

  function setIconSpanButtonText(btnSelector, iconStr, dictKey) {
    var el = document.querySelector(btnSelector);
    if (!el) return;
    var spans = el.querySelectorAll('span');
    if (spans.length >= 2) {
      if (!spans[1].dataset.hnOrigVi) spans[1].dataset.hnOrigVi = spans[1].textContent;
      spans[1].textContent = getLang() === 'vi' ? spans[1].dataset.hnOrigVi : t(dictKey);
    } else if (spans.length === 1) {
      if (!spans[0].dataset.hnOrigVi) spans[0].dataset.hnOrigVi = spans[0].textContent;
      spans[0].textContent = getLang() === 'vi' ? spans[0].dataset.hnOrigVi : t(dictKey);
    } else {
      setTextWithSavedVi(el, (iconStr ? iconStr + ' ' : '') + t(dictKey));
    }
  }

  function applyDomTranslations() {
    var lang = getLang();
    if (document.documentElement) {
      document.documentElement.lang = lang;
    }

    var toggleBtn = document.getElementById('langToggleBtn');
    if (toggleBtn) {
      toggleBtn.textContent = lang === 'en' ? '🇬🇧 EN' : '🇻🇳 VI';
      toggleBtn.setAttribute('aria-label', lang === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh');
    }

    // Generic [data-i18n] elements (only leaf or text-safe nodes)
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var key = node.getAttribute('data-i18n');
      if (!key) continue;
      if (!node.dataset.hnOrigVi) {
        node.dataset.hnOrigVi = node.textContent;
      }
      node.textContent = lang === 'vi' ? node.dataset.hnOrigVi : t(key, node.dataset.hnOrigVi);
    }

    // Top bar
    var topNoticeSpan = document.querySelector('.top-notice-bar .notice-inner > div:first-child span');
    setTextWithSavedVi(topNoticeSpan, t('top_notice'));
    setIconSpanButtonText('#btnOpenLogin', '', 'login_btn');
    setIconSpanButtonText('#btnOpenRegister', '', 'register_btn');
    var logoutBtn = document.getElementById('btnQuickLogout');
    setTextWithSavedVi(logoutBtn, t('logout_btn'));
    var brightText = document.querySelector('#btnBrightnessControl .brightness-btn-text');
    setTextWithSavedVi(brightText, t('brightness_btn'));

    var themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      var isDark = document.documentElement.dataset.theme === 'dark';
      var tSpans = themeBtn.querySelectorAll('span');
      if (tSpans.length >= 2) {
        tSpans[1].textContent = isDark ? t('theme_light') : t('theme_dark');
      }
    }

    var soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      var sSpans = soundBtn.querySelectorAll('span');
      var soundPref = true;
      try { soundPref = window.localStorage.getItem('hanoi_phovi_sound') !== 'false'; } catch (e) {}
      if (sSpans.length >= 2) {
        sSpans[1].textContent = soundPref ? t('sound_on') : t('sound_off');
      }
    }

    // Hero / Masthead
    var badgeEl = document.querySelector('.brand-badge');
    if (badgeEl) {
      var bNodes = badgeEl.childNodes;
      for (var bi = 0; bi < bNodes.length; bi++) {
        if (bNodes[bi].nodeType === 3 && bNodes[bi].nodeValue.trim()) {
          if (!badgeEl.dataset.hnOrigVi) badgeEl.dataset.hnOrigVi = bNodes[bi].nodeValue;
          bNodes[bi].nodeValue = lang === 'vi' ? badgeEl.dataset.hnOrigVi : (' ' + t('brand_badge'));
          break;
        }
      }
    }
    setTextWithSavedVi(document.querySelector('.site-subtitle'), t('site_subtitle'));

    setIconSpanButtonText('#btnOpenClawHero', '', 'lucky_btn');
    setIconSpanButtonText('#btnOpenFavoritesHero', '', 'fav_btn');
    setIconSpanButtonText('#btnOpenCommunityHero', '', 'community_btn');
    setIconSpanButtonText('#btnOpenReelsHero', '', 'reels_btn');
    setIconSpanButtonText('#btnOpenGamesHero', '', 'games_btn');
    setIconSpanButtonText('#btnOpenBillHero', '', 'bill_btn');
    setIconSpanButtonText('#btnOpenOrdersHubHero', '', 'orders_btn');
    setIconSpanButtonText('#btnOpenMoviesHero', '', 'movies_btn');
    setIconSpanButtonText('#btnOpenEngageHub', '', 'engage_hub');
    setIconSpanButtonText('#btnOpenOwnerPortal', '', 'owner_portal');

    // Stats banner
    var statItems = document.querySelectorAll('.stats-banner .stat-item');
    var statKeys = [
      ['stat_1_title', 'stat_1_sub'],
      ['stat_2_title', 'stat_2_sub'],
      ['stat_3_title', 'stat_3_sub'],
      ['stat_4_title', 'stat_4_sub']
    ];
    for (var si = 0; si < statItems.length && si < statKeys.length; si++) {
      setTextWithSavedVi(statItems[si].querySelector('strong'), t(statKeys[si][0]));
      setTextWithSavedVi(statItems[si].querySelector('.stat-text span'), t(statKeys[si][1]));
    }

    // Lucky banner
    setTextWithSavedVi(document.querySelector('.lucky-text h4'), t('lucky_heading'));
    setTextWithSavedVi(document.querySelector('.lucky-text p'), t('lucky_sub'));
    var luckyFast = document.getElementById('btnLuckyFast');
    if (luckyFast) {
      if (!luckyFast.dataset.hnOrigHtml) luckyFast.dataset.hnOrigHtml = luckyFast.innerHTML;
      luckyFast.innerHTML = lang === 'vi'
        ? luckyFast.dataset.hnOrigHtml
        : ('<span>✨</span> ' + escapeHtml(t('lucky_fast_btn')));
    }

    // Search & NLP
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
      if (!searchInput.dataset.hnOrigPh) searchInput.dataset.hnOrigPh = searchInput.getAttribute('placeholder') || '';
      searchInput.setAttribute('placeholder', lang === 'vi' ? searchInput.dataset.hnOrigPh : t('search_placeholder'));
    }
    setTextWithSavedVi(document.getElementById('btnNlpSearch'), t('nlp_search_btn'));
    setTextWithSavedVi(document.getElementById('btnClaudeConfig'), t('claude_config_btn'));

    // Filter labels
    var filterLabels = [
      ['priceTierSelect', 'filter_price', '💰'],
      ['peopleCategorySelect', 'filter_people', '👥'],
      ['districtSelect', 'filter_district', '📍'],
      ['occasionSelect', 'filter_occasion', '✨'],
      ['timeSlotSelect', 'filter_time', '🕒']
    ];
    for (var fi = 0; fi < filterLabels.length; fi++) {
      var lbl = document.querySelector('label[for="' + filterLabels[fi][0] + '"]');
      if (lbl) {
        if (!lbl.dataset.hnOrigHtml) lbl.dataset.hnOrigHtml = lbl.innerHTML;
        lbl.innerHTML = lang === 'vi'
          ? lbl.dataset.hnOrigHtml
          : ('<span>' + filterLabels[fi][2] + '</span> ' + escapeHtml(t(filterLabels[fi][1])));
      }
    }

    var timeSelect = document.getElementById('timeSlotSelect');
    if (timeSelect) {
      var optNow = timeSelect.querySelector('option[value="now"]');
      var optCustom = timeSelect.querySelector('option[value="custom"]');
      setTextWithSavedVi(optNow, t('time_now'));
      setTextWithSavedVi(optCustom, t('time_custom'));
    }

    // Quick pills
    var pillMap = {
      all: 'pill_all',
      open_now: 'pill_open_now',
      hadong: 'pill_hadong',
      michelin: 'pill_michelin',
      reservable: 'pill_reservable',
      favorites: 'pill_favorites'
    };
    var pills = document.querySelectorAll('.quick-pills .pill-btn[data-filter]');
    for (var pi = 0; pi < pills.length; pi++) {
      var fKey = pills[pi].getAttribute('data-filter');
      if (pillMap[fKey]) setTextWithSavedVi(pills[pi], t(pillMap[fKey]));
    }
    setTextWithSavedVi(document.getElementById('btnResetFilters'), t('reset_filters'));

    // Sort controls
    setTextWithSavedVi(document.querySelector('.sort-select-wrapper label[for="sortBySelect"]'), t('sort_label'));
    var sortSelect = document.getElementById('sortBySelect');
    if (sortSelect) {
      var sortKeys = ['rating_desc', 'reviews_desc', 'price_asc', 'price_desc', 'name_asc'];
      for (var ski = 0; ski < sortKeys.length; ski++) {
        var sOpt = sortSelect.querySelector('option[value="' + sortKeys[ski] + '"]');
        setTextWithSavedVi(sOpt, t('sort_' + sortKeys[ski]));
      }
    }

    // Modal titles
    var modalTitles = [
      ['clawTitle', 'modal_claw_title'],
      ['authModalTitle', 'modal_auth_title'],
      ['commModalTitle', 'modal_comm_title'],
      ['billModalTitle', 'modal_bill_title'],
      ['ordersHubTitle', 'modal_orders_title'],
      ['moviesModalTitle', 'modal_movies_title'],
      ['ownerPortalTitle', 'modal_owner_title'],
      ['engageHubTitle', 'modal_engage_title'],
      ['whatToEatTitle', 'modal_wte_title'],
      ['reportPlaceTitle', 'modal_report_title'],
      ['claudeApiTitle', 'modal_claude_title'],
      ['pwaInstallTitle', 'modal_pwa_title']
    ];
    for (var mi = 0; mi < modalTitles.length; mi++) {
      setTextWithSavedVi(document.getElementById(modalTitles[mi][0]), t(modalTitles[mi][1]));
    }

    // Mobile bottom nav
    var mobPairs = [
      ['mobNavExplore', 'mob_explore'],
      ['mobNavRandom', 'mob_random'],
      ['mobNavEngage', 'mob_engage'],
      ['mobNavOrders', 'mob_orders'],
      ['mobNavOwner', 'mob_owner']
    ];
    for (var mbi = 0; mbi < mobPairs.length; mbi++) {
      var mBtn = document.getElementById(mobPairs[mbi][0]);
      if (mBtn) {
        var mSpans = mBtn.querySelectorAll('span');
        if (mSpans.length >= 2) {
          setTextWithSavedVi(mSpans[1], t(mobPairs[mbi][1]));
        }
      }
    }
  }

  function setLang(lang) {
    var next = lang === 'en' ? 'en' : 'vi';
    currentLang = next;
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch (e) {}
    if (document.documentElement) {
      document.documentElement.lang = next;
    }
    applyDomTranslations();
    notifyCatalogUpdated();
    try {
      window.dispatchEvent(new CustomEvent('hn-lang-changed', { detail: { lang: next } }));
    } catch (e) {}
    // Re-render open owner portal if visible
    var ownerModal = document.getElementById('ownerPortalModal');
    if (ownerModal && ownerModal.classList.contains('open')) {
      renderOwnerPortalTab(activeOwnerTab);
    }
    return next;
  }

  window.HNi18n = {
    getLang: getLang,
    setLang: setLang,
    t: t,
    translateCategory: translateCategory,
    translateOccasion: translateOccasion,
    applyDomTranslations: applyDomTranslations
  };

  /* ========================================================================
     1. OWNER PORTAL & CATALOG OVERRIDES (window.HNOwnerPortal)
     ======================================================================== */
  function loadOwnerPlaces() {
    var arr = readJsonStorage(OWNER_PLACES_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveOwnerPlaces(arr) {
    return writeJsonStorage(OWNER_PLACES_KEY, Array.isArray(arr) ? arr : []);
  }

  function loadOwnerOverrides() {
    var obj = readJsonStorage(OWNER_OVERRIDES_KEY, {});
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  }

  function saveOwnerOverrides(obj) {
    return writeJsonStorage(OWNER_OVERRIDES_KEY, obj && typeof obj === 'object' ? obj : {});
  }

  function parsePriceNumbers(priceRangeStr) {
    var raw = String(priceRangeStr || '').toLowerCase();
    var matches = raw.match(/\d+(?:[.,]\d{3})+|\d+(?:\.\d+)?\s*k\b|\d+(?:\.\d+)?\s*tr\b|\d+/g);
    if (!matches || !matches.length) return [];
    var nums = [];
    for (var i = 0; i < matches.length; i++) {
      var token = matches[i].trim();
      var val = 0;
      if (/k$/.test(token)) {
        val = parseFloat(token.replace(/k$/, '').replace(',', '.')) * 1000;
      } else if (/tr$/.test(token)) {
        val = parseFloat(token.replace(/tr$/, '').replace(',', '.')) * 1000000;
      } else {
        val = parseInt(token.replace(/[.,]/g, ''), 10);
      }
      if (!isNaN(val) && val > 0) {
        nums.push(val);
      }
    }
    return nums;
  }

  function computePriceMeta(priceRange, explicitAvg, explicitTier) {
    var avg = Number(explicitAvg);
    if (isNaN(avg) || avg <= 0) {
      var nums = parsePriceNumbers(priceRange);
      if (nums.length >= 2) {
        avg = Math.round((nums[0] + nums[1]) / 2);
      } else if (nums.length === 1) {
        avg = Math.round(nums[0]);
      } else {
        avg = 80000;
      }
    }
    var tier = explicitTier;
    if (tier !== 'budget' && tier !== 'moderate' && tier !== 'upscale' && tier !== 'luxury') {
      if (avg < 50000) tier = 'budget';
      else if (avg <= 150000) tier = 'moderate';
      else if (avg <= 350000) tier = 'upscale';
      else tier = 'luxury';
    }
    return { priceAvg: avg, priceTier: tier };
  }

  function parseDishesInput(val, fallbackCat) {
    if (Array.isArray(val)) {
      var cleaned = [];
      for (var i = 0; i < val.length; i++) {
        var s = String(val[i] || '').trim();
        if (s) cleaned.push(s);
      }
      if (cleaned.length) return cleaned;
    } else if (typeof val === 'string' && val.trim()) {
      var parts = val.split(',');
      var out = [];
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j].trim();
        if (p) out.push(p);
      }
      if (out.length) return out;
    }
    return fallbackCat ? [fallbackCat] : ['Đặc sản Hà Nội'];
  }

  function syncTempClosedBadge(badges, isTempClosed) {
    var list = Array.isArray(badges) ? badges.slice() : [];
    var filtered = [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]).indexOf('Tạm nghỉ') === -1) {
        filtered.push(list[i]);
      }
    }
    if (isTempClosed) {
      filtered.unshift('⏸️ Tạm nghỉ');
    }
    return filtered;
  }

  function normalizeOwnerPlace(rawPlace) {
    var district = String(rawPlace.district || 'Hoàn Kiếm').trim();
    var category = String(rawPlace.category || 'Phở & Bún').trim();
    var name = String(rawPlace.name || '').trim();
    var address = String(rawPlace.address || '').trim();
    var openingHours = String(rawPlace.openingHours || '07:00 - 22:00').trim();
    var priceRange = String(rawPlace.priceRange || '50.000đ - 100.000đ').trim();
    var priceMeta = computePriceMeta(priceRange, rawPlace.priceAvg, rawPlace.priceTier);
    var image = String(rawPlace.image || '').trim() || DEFAULT_IMAGE;
    var mapsUrl = String(rawPlace.mapsUrl || '').trim() ||
      ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + address));
    var badges = Array.isArray(rawPlace.specialBadges) ? rawPlace.specialBadges.slice() : ['🏪 Quán mới đăng ký'];
    if (badges.indexOf('🏪 Quán mới đăng ký') === -1) {
      badges.unshift('🏪 Quán mới đăng ký');
    }
    var tempClosed = Boolean(rawPlace.tempClosed);
    badges = syncTempClosedBadge(badges, tempClosed);

    return {
      id: Number(rawPlace.id),
      name: name,
      subname: String(rawPlace.subname || ('Địa điểm ẩm thực tại ' + district)).trim(),
      category: category,
      rating: Number(rawPlace.rating) > 0 ? Number(rawPlace.rating) : 4.8,
      reviews: Number(rawPlace.reviews) >= 0 ? Number(rawPlace.reviews) : 1,
      priceRange: priceRange,
      priceTier: priceMeta.priceTier,
      priceAvg: priceMeta.priceAvg,
      peopleRange: String(rawPlace.peopleRange || '1 - 6 người'),
      peopleCategory: Array.isArray(rawPlace.peopleCategory) && rawPlace.peopleCategory.length
        ? rawPlace.peopleCategory.slice()
        : ['solo', 'couple', 'group'],
      district: district,
      address: address,
      mapsUrl: mapsUrl,
      openingHours: openingHours,
      occasions: Array.isArray(rawPlace.occasions) && rawPlace.occasions.length
        ? rawPlace.occasions.slice()
        : ['quick_lunch', 'friends', 'family'],
      signatureDishes: parseDishesInput(rawPlace.signatureDishes, category),
      specialBadges: badges,
      description: String(rawPlace.description || (name + ' tại ' + address + ' (' + district + ').')).trim(),
      tips: String(rawPlace.tips || '').trim(),
      phone: String(rawPlace.phone || '').trim(),
      image: image,
      tempClosed: tempClosed,
      isOwnerRegistered: true,
      createdAt: rawPlace.createdAt || new Date().toISOString()
    };
  }

  function applyPatchToItem(item, patch) {
    if (!item || !patch || typeof patch !== 'object') return;
    if (typeof patch.name === 'string' && patch.name.trim()) item.name = patch.name.trim();
    if (typeof patch.subname === 'string' && patch.subname.trim()) item.subname = patch.subname.trim();
    if (typeof patch.category === 'string' && patch.category.trim()) item.category = patch.category.trim();
    if (typeof patch.district === 'string' && patch.district.trim()) item.district = patch.district.trim();
    if (typeof patch.address === 'string' && patch.address.trim()) item.address = patch.address.trim();
    if (typeof patch.openingHours === 'string' && patch.openingHours.trim()) item.openingHours = patch.openingHours.trim();
    if (typeof patch.priceRange === 'string' && patch.priceRange.trim()) {
      item.priceRange = patch.priceRange.trim();
      var pm = computePriceMeta(item.priceRange, patch.priceAvg, patch.priceTier);
      item.priceAvg = pm.priceAvg;
      item.priceTier = pm.priceTier;
    }
    if (typeof patch.phone === 'string') item.phone = patch.phone.trim();
    if (typeof patch.tips === 'string') item.tips = patch.tips.trim();
    if (typeof patch.description === 'string' && patch.description.trim()) item.description = patch.description.trim();
    if (typeof patch.image === 'string' && patch.image.trim()) item.image = patch.image.trim();
    if (typeof patch.signatureDishes !== 'undefined') {
      item.signatureDishes = parseDishesInput(patch.signatureDishes, item.category);
    }
    if (typeof patch.tempClosed !== 'undefined') {
      item.tempClosed = Boolean(patch.tempClosed);
      item.specialBadges = syncTempClosedBadge(item.specialBadges, item.tempClosed);
    }
    item.ownerUpdatedAt = patch.updatedAt || item.ownerUpdatedAt || new Date().toISOString();
  }

  function applyOwnerDataToCatalog() {
    var catalog = getCatalog();
    if (!catalog || !Array.isArray(catalog)) return 0;

    var customPlaces = loadOwnerPlaces();
    var overrides = loadOwnerOverrides();

    var byId = {};
    for (var i = 0; i < catalog.length; i++) {
      byId[String(catalog[i].id)] = catalog[i];
    }

    var appliedCount = 0;
    for (var p = 0; p < customPlaces.length; p++) {
      var raw = customPlaces[p];
      if (!raw || typeof raw.id === 'undefined') continue;
      var norm = normalizeOwnerPlace(raw);
      var key = String(norm.id);
      if (byId[key]) {
        applyPatchToItem(byId[key], norm);
      } else {
        catalog.push(norm);
        byId[key] = norm;
      }
      appliedCount++;
    }

    for (var idKey in overrides) {
      if (!Object.prototype.hasOwnProperty.call(overrides, idKey)) continue;
      var target = byId[String(idKey)];
      if (target) {
        applyPatchToItem(target, overrides[idKey]);
        appliedCount++;
      }
    }

    return appliedCount;
  }

  function getOwnedAndUpdatedIds() {
    var customPlaces = loadOwnerPlaces();
    var overrides = loadOwnerOverrides();
    var seen = {};
    var ids = [];
    for (var i = 0; i < customPlaces.length; i++) {
      var num = Number(customPlaces[i] && customPlaces[i].id);
      if (!isNaN(num) && !seen[num]) {
        seen[num] = true;
        ids.push(num);
      }
    }
    for (var k in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, k)) {
        var oNum = Number(k);
        if (!isNaN(oNum) && !seen[oNum]) {
          seen[oNum] = true;
          ids.push(oNum);
        }
      }
    }
    ids.sort(function (a, b) { return a - b; });
    return ids;
  }

  function registerRestaurant(payload) {
    var data = payload && typeof payload === 'object' ? payload : {};
    var required = ['name', 'district', 'category', 'address', 'openingHours', 'priceRange'];
    for (var i = 0; i < required.length; i++) {
      var field = required[i];
      if (!data[field] || !String(data[field]).trim()) {
        return {
          ok: false,
          error: (getLang() === 'en' ? 'Missing required field: ' : 'Vui lòng nhập đầy đủ trường bắt buộc: ') + field
        };
      }
    }

    var catalog = getCatalog();
    var customPlaces = loadOwnerPlaces();
    var maxId = 9999;
    for (var j = 0; j < catalog.length; j++) {
      var cid = Number(catalog[j].id);
      if (!isNaN(cid) && cid > maxId) maxId = cid;
    }
    for (var k = 0; k < customPlaces.length; k++) {
      var pid = Number(customPlaces[k].id);
      if (!isNaN(pid) && pid > maxId) maxId = pid;
    }

    var nextId = maxId + 1;
    var placePayload = {
      id: nextId,
      name: data.name,
      subname: data.subname,
      district: data.district,
      category: data.category,
      address: data.address,
      openingHours: data.openingHours,
      priceRange: data.priceRange,
      priceAvg: data.priceAvg,
      priceTier: data.priceTier,
      signatureDishes: data.signatureDishes,
      phone: data.phone,
      tips: data.tips,
      description: data.description,
      image: data.image,
      peopleRange: data.peopleRange,
      peopleCategory: data.peopleCategory,
      occasions: data.occasions,
      tempClosed: false,
      createdAt: new Date().toISOString()
    };

    var newPlace = normalizeOwnerPlace(placePayload);
    customPlaces.push(newPlace);
    saveOwnerPlaces(customPlaces);
    catalog.push(newPlace);

    notifyCatalogUpdated();
    awardPointsSafe(30, 'Đăng ký quán mới: ' + newPlace.name, 'owner');

    return { ok: true, restaurant: newPlace };
  }

  function updateRestaurant(id, patch) {
    var numId = Number(id);
    if (isNaN(numId)) {
      return { ok: false, error: 'Invalid restaurant ID' };
    }
    var target = findRestaurantById(numId);
    if (!target) {
      return {
        ok: false,
        error: getLang() === 'en' ? 'Restaurant not found' : 'Không tìm thấy quán ăn trong hệ thống'
      };
    }

    var cleanPatch = {};
    var src = patch && typeof patch === 'object' ? patch : {};
    var allowed = [
      'name', 'subname', 'category', 'district', 'address', 'openingHours',
      'priceRange', 'priceAvg', 'priceTier', 'phone', 'tips', 'description',
      'image', 'signatureDishes', 'tempClosed'
    ];
    for (var i = 0; i < allowed.length; i++) {
      var key = allowed[i];
      if (Object.prototype.hasOwnProperty.call(src, key) && typeof src[key] !== 'undefined') {
        cleanPatch[key] = src[key];
      }
    }
    cleanPatch.updatedAt = new Date().toISOString();

    applyPatchToItem(target, cleanPatch);

    var overrides = loadOwnerOverrides();
    var existingOverride = overrides[String(numId)] || {};
    for (var ok in cleanPatch) {
      if (Object.prototype.hasOwnProperty.call(cleanPatch, ok)) {
        existingOverride[ok] = cleanPatch[ok];
      }
    }
    overrides[String(numId)] = existingOverride;
    saveOwnerOverrides(overrides);

    // Also update custom places record if it's an owner-registered place
    var customPlaces = loadOwnerPlaces();
    var changedCustom = false;
    for (var c = 0; c < customPlaces.length; c++) {
      if (Number(customPlaces[c].id) === numId) {
        applyPatchToItem(customPlaces[c], cleanPatch);
        changedCustom = true;
      }
    }
    if (changedCustom) {
      saveOwnerPlaces(customPlaces);
    }

    notifyCatalogUpdated();
    return { ok: true, restaurant: target };
  }

  /* ========================================================================
     2. COMMUNITY REPORTS (window.HNReports)
     ======================================================================== */
  function loadReports() {
    var arr = readJsonStorage(REPORTS_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveReports(arr) {
    return writeJsonStorage(REPORTS_KEY, Array.isArray(arr) ? arr : []);
  }

  function submitReport(placeId, issueType, note) {
    var numId = Number(placeId);
    if (isNaN(numId)) {
      return { ok: false, error: 'Invalid placeId' };
    }
    var validType = ISSUE_TYPES.indexOf(issueType) !== -1 ? issueType : 'other';
    var place = findRestaurantById(numId);
    var placeName = place ? place.name : ('Quán #' + numId);

    var entry = {
      id: 'rep_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      placeId: numId,
      placeName: placeName,
      issueType: validType,
      note: String(note || '').trim(),
      reporter: getCurrentUserLabel(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    var all = loadReports();
    all.unshift(entry);
    saveReports(all);

    awardPointsSafe(15, 'Báo lỗi thông tin quán: ' + placeName, 'report');

    return { ok: true, report: entry };
  }

  function getReportsForPlace(placeId) {
    var numId = Number(placeId);
    if (isNaN(numId)) return [];
    var all = loadReports();
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (Number(all[i].placeId) === numId) {
        out.push(all[i]);
      }
    }
    return out;
  }

  function getAllReports() {
    return loadReports().slice();
  }

  function resolveReport(reportId) {
    var all = loadReports();
    var found = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === reportId) {
        all[i].status = 'resolved';
        all[i].resolvedAt = new Date().toISOString();
        found = all[i];
        break;
      }
    }
    if (!found) {
      return { ok: false, error: 'Report not found' };
    }
    saveReports(all);
    return { ok: true, report: found };
  }

  function getIssueLabel(issueType) {
    return t('issue_' + issueType, t('issue_other'));
  }

  /* ========================================================================
     3. BUSY HOURS FORECAST (window.HNBusyHours)
     ======================================================================== */
  function fallbackIsOpenAtMinutes(restaurant, mins) {
    var raw = String((restaurant && (restaurant.openingHours || restaurant.openHours)) || '07:00 - 22:00');
    if (/24\s*\/\s*24|24\s*\/\s*7/.test(raw)) return true;
    var segments = raw.replace(/\([^)]*\)/g, ' ').split(/[&,;]+/);
    for (var i = 0; i < segments.length; i++) {
      var m = segments[i].match(/(\d{1,2}):(\d{2})\s*[-–—~]+\s*(\d{1,2}):(\d{2})/);
      if (!m) continue;
      var sMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      var eMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
      if (eMin === 0 || m[3] === '24') eMin = 1440;
      if (eMin <= sMin) eMin += 1440;
      if ((mins >= sMin && mins < eMin) || (eMin > 1440 && (mins + 1440) < eMin)) {
        return true;
      }
    }
    return false;
  }

  function checkRestaurantOpenAtHour(restaurant, hour, dayOfWeek) {
    if (!restaurant || restaurant.tempClosed === true) return false;
    var mins = ((hour % 24) + 24) % 24 * 60;
    if (window.HNRestaurantHours && typeof window.HNRestaurantHours.isOpenAtMinutes === 'function') {
      return window.HNRestaurantHours.isOpenAtMinutes(restaurant, mins, dayOfWeek);
    }
    return fallbackIsOpenAtMinutes(restaurant, mins);
  }

  function getCategoryCurveValue(categoryStr, hour) {
    var norm = normalizeText(categoryStr);
    // 1. Pho & Bun / Breakfast
    if (/pho|bun|mien|banh|xoi|sang/.test(norm)) {
      var phoMap = {
        6: 52, 7: 78, 8: 84, 9: 68, 10: 44,
        11: 72, 12: 82, 13: 66, 14: 34, 15: 24,
        16: 26, 17: 38, 18: 56, 19: 62, 20: 54,
        21: 42, 22: 32, 23: 24
      };
      return phoMap[hour] || 30;
    }
    // 2. Coffee & Tea
    if (/ca phe|cafe|tra|coffee|trang mieng/.test(norm)) {
      var cafeMap = {
        6: 25, 7: 38, 8: 54, 9: 74, 10: 82,
        11: 72, 12: 46, 13: 48, 14: 74, 15: 84,
        16: 82, 17: 72, 18: 54, 19: 62, 20: 78,
        21: 80, 22: 68, 23: 40
      };
      return cafeMap[hour] || 40;
    }
    // 3. Snacks & Che
    if (/che|an vat|qua vat|duong pho|oc/.test(norm)) {
      var snackMap = {
        6: 20, 7: 26, 8: 32, 9: 38, 10: 42,
        11: 48, 12: 50, 13: 46, 14: 54, 15: 72,
        16: 82, 17: 76, 18: 62, 19: 78, 20: 86,
        21: 80, 22: 56, 23: 36
      };
      return snackMap[hour] || 40;
    }
    // 4. Hotpot / BBQ / Dining / Drinks
    var dinnerMap = {
      6: 18, 7: 22, 8: 26, 9: 30, 10: 38,
      11: 58, 12: 78, 13: 72, 14: 34, 15: 24,
      16: 28, 17: 50, 18: 78, 19: 88, 20: 86,
      21: 76, 22: 54, 23: 38
    };
    return dinnerMap[hour] || 35;
  }

  function classifyLevel(pct, isOpen) {
    if (!isOpen || pct <= 0) return 'closed';
    if (pct < 45) return 'low';
    if (pct < 72) return 'medium';
    return 'high';
  }

  function getLevelLabel(level) {
    if (level === 'closed') return t('busy_closed', 'Đóng cửa');
    if (level === 'low') return t('busy_low', 'Vắng khách');
    if (level === 'medium') return t('busy_medium', 'Đông vừa');
    return t('busy_high', 'Rất đông');
  }

  function formatPeakWindows(peakHours) {
    if (!peakHours.length) return t('busy_all_closed');
    var windows = [];
    var start = peakHours[0];
    var prev = peakHours[0];
    for (var i = 1; i < peakHours.length; i++) {
      if (peakHours[i] === prev + 1) {
        prev = peakHours[i];
      } else {
        windows.push((start < 10 ? '0' : '') + start + ':00 - ' + (prev + 1 < 10 ? '0' : '') + (prev + 1) + ':00');
        start = peakHours[i];
        prev = peakHours[i];
      }
    }
    windows.push((start < 10 ? '0' : '') + start + ':00 - ' + (prev + 1 < 10 ? '0' : '') + (prev + 1) + ':00');
    return t('busy_peak') + ': ' + windows.slice(0, 2).join(', ');
  }

  function computeBusyHours(restaurant, targetHour) {
    var now = new Date();
    var evalHour = (typeof targetHour === 'number' && !isNaN(targetHour))
      ? ((Math.floor(targetHour) % 24) + 24) % 24
      : now.getHours();
    var dayOfWeek = now.getDay();

    var rating = restaurant ? (Number(restaurant.rating) || 4.3) : 4.3;
    var reviews = restaurant ? (Number(restaurant.reviews) || 80) : 80;
    var rid = restaurant ? (Number(restaurant.id) || 1) : 1;
    var cat = restaurant ? (restaurant.category || '') : '';

    var ratingBoost = Math.max(-5, Math.min(8, (rating - 4.0) * 8));
    var reviewBoost = Math.min(8, Math.log10(reviews + 10) * 2.2);

    var hours = [];
    var currentEntry = null;
    var openHoursList = [];

    for (var h = 6; h <= 23; h++) {
      var isOpen = checkRestaurantOpenAtHour(restaurant, h, dayOfWeek);
      var pct = 0;
      if (isOpen) {
        var base = getCategoryCurveValue(cat, h);
        var jitter = (((rid * 17 + h * 7) % 9) - 4);
        pct = Math.round(base + ratingBoost + reviewBoost + jitter);
        if (pct < 15) pct = 15;
        if (pct > 98) pct = 98;
      }
      var level = classifyLevel(pct, isOpen);
      var item = {
        hour: h,
        label: (h < 10 ? '0' : '') + h + ':00',
        pct: pct,
        level: level
      };
      hours.push(item);
      if (h === evalHour) currentEntry = item;
      if (isOpen) openHoursList.push(item);
    }

    var currentLevel;
    if (currentEntry) {
      currentLevel = currentEntry.level;
    } else {
      var offOpen = checkRestaurantOpenAtHour(restaurant, evalHour, dayOfWeek);
      currentLevel = offOpen ? 'low' : 'closed';
    }

    // Identify top peak hours among open hours
    var sortedOpen = openHoursList.slice().sort(function (a, b) { return b.pct - a.pct; });
    var peakHourNums = [];
    if (sortedOpen.length) {
      var threshold = Math.max(62, sortedOpen[0].pct - 14);
      for (var k = 0; k < openHoursList.length; k++) {
        if (openHoursList[k].pct >= threshold) {
          peakHourNums.push(openHoursList[k].hour);
        }
      }
      if (!peakHourNums.length) {
        peakHourNums.push(sortedOpen[0].hour);
      }
    }

    return {
      hours: hours,
      targetHour: evalHour,
      currentLevel: currentLevel,
      currentLabel: getLevelLabel(currentLevel),
      peakText: formatPeakWindows(peakHourNums)
    };
  }

  /* ========================================================================
     UI RENDERING: DETAIL MODAL (BUSY HOURS + REPORTS), REPORT MODAL, OWNER PORTAL
     ======================================================================== */
  var activeOwnerTab = 'register';
  var activeUpdatePlaceId = null;

  function renderDetailExtensions(detailObj) {
    if (!detailObj || !detailObj.restaurant) return;
    var restaurant = detailObj.restaurant;
    var targetMins = typeof detailObj.targetMinutes === 'number'
      ? detailObj.targetMinutes
      : (new Date().getHours() * 60);
    var targetHour = Math.floor((((targetMins % 1440) + 1440) % 1440) / 60);

    // 1. Report button in #detailEngageActionsMount
    var actionsMount = document.getElementById('detailEngageActionsMount');
    if (actionsMount && !actionsMount.querySelector('[data-hn-report-btn]')) {
      var reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.className = 'btn-engage-mini';
      reportBtn.setAttribute('data-hn-report-btn', String(restaurant.id));
      reportBtn.textContent = t('report_btn');
      reportBtn.addEventListener('click', function () {
        openReportModal(restaurant.id);
      });
      actionsMount.appendChild(reportBtn);
    }

    // 2. Busy hours + report flag banner in #detailBusyHoursMount
    var busyMount = document.getElementById('detailBusyHoursMount');
    var reviewsMount = document.getElementById('detailReviewsMount');
    var bannerTarget = busyMount || reviewsMount;

    if (bannerTarget) {
      var oldBanner = bannerTarget.querySelector('.report-flag-banner');
      if (oldBanner && oldBanner.parentNode) oldBanner.parentNode.removeChild(oldBanner);

      var placeReports = getReportsForPlace(restaurant.id);
      var pending = [];
      for (var i = 0; i < placeReports.length; i++) {
        if (placeReports[i].status !== 'resolved') pending.push(placeReports[i]);
      }

      if (pending.length > 0 || restaurant.tempClosed) {
        var banner = document.createElement('div');
        banner.className = 'report-flag-banner';
        var lines = [];
        if (restaurant.tempClosed) {
          lines.push('<div><strong>' + escapeHtml(t('report_banner_temp_closed')) + '</strong></div>');
        }
        if (pending.length > 0) {
          var latestIssue = getIssueLabel(pending[0].issueType);
          var summaryMsg = getLang() === 'en'
            ? (pending.length + ' diner report(s) pending verification (' + latestIssue + ').')
            : ('Có ' + pending.length + ' phản ánh từ thực khách đang chờ xác minh (' + latestIssue + ').');
          lines.push('<div><strong>' + escapeHtml(t('report_banner_title')) + ':</strong> ' + escapeHtml(summaryMsg) + '</div>');
        }
        banner.innerHTML = lines.join('');
        bannerTarget.insertBefore(banner, bannerTarget.firstChild);
      }
    }

    if (busyMount) {
      var oldCard = busyMount.querySelector('.busy-hours-card');
      if (oldCard && oldCard.parentNode) oldCard.parentNode.removeChild(oldCard);

      var forecast = computeBusyHours(restaurant, targetHour);
      var barsHtml = '';
      for (var b = 0; b < forecast.hours.length; b++) {
        var slot = forecast.hours[b];
        var isNow = slot.hour === forecast.targetHour;
        var shortLbl = (slot.hour % 3 === 0 || isNow) ? (slot.hour + 'h') : '';
        var barStyle = 'height:' + slot.pct + '%;' + (slot.level === 'closed' ? 'opacity:0.25;' : '');
        barsHtml +=
          '<div class="busy-bar-col' + (isNow ? ' is-now' : '') + '" title="' +
          escapeHtml(slot.label + ' • ' + slot.pct + '% (' + getLevelLabel(slot.level) + ')') + '">' +
            '<div class="busy-bar-fill level-' + escapeHtml(slot.level) + '" style="' + barStyle + '"></div>' +
            '<span class="busy-bar-label">' + (shortLbl ? escapeHtml(shortLbl) : '&nbsp;') + '</span>' +
          '</div>';
      }

      var card = document.createElement('div');
      card.className = 'busy-hours-card';
      card.innerHTML =
        '<div class="busy-hours-head">' +
          '<div>' +
            '<strong>' + escapeHtml(t('busy_title')) + '</strong>' +
            '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">' + escapeHtml(forecast.peakText) + '</div>' +
          '</div>' +
          '<span class="busy-status-pill ' + escapeHtml(forecast.currentLevel) + '">' +
            escapeHtml((forecast.targetHour < 10 ? '0' : '') + forecast.targetHour + ':00 · ' + forecast.currentLabel) +
          '</span>' +
        '</div>' +
        '<div class="busy-hours-bars" role="img" aria-label="' + escapeHtml(t('busy_title')) + '">' +
          barsHtml +
        '</div>';
      busyMount.appendChild(card);
    }
  }

  function openReportModal(placeId) {
    var modal = document.getElementById('reportPlaceModal');
    var body = document.getElementById('reportPlaceBody');
    var place = findRestaurantById(placeId);
    if (!modal || !body || !place) return;

    var selectedIssue = 'wrong_hours';
    var pillsHtml = '';
    for (var i = 0; i < ISSUE_TYPES.length; i++) {
      var itype = ISSUE_TYPES[i];
      pillsHtml +=
        '<button type="button" class="report-issue-pill' + (itype === selectedIssue ? ' active' : '') +
        '" data-issue="' + escapeHtml(itype) + '">' + escapeHtml(getIssueLabel(itype)) + '</button>';
    }

    body.innerHTML =
      '<h2 id="reportPlaceTitle" style="margin:0 0 12px; font-size:1.15rem;">' + escapeHtml(t('modal_report_title')) + '</h2>' +
      '<form id="hnReportForm" class="owner-form">' +
        '<div style="margin-bottom:10px;">' +
          '<strong>' + escapeHtml(place.name) + '</strong>' +
          '<div style="font-size:0.84rem; color:var(--text-muted);">📍 ' + escapeHtml(place.address) + '</div>' +
        '</div>' +
        '<div class="owner-field">' +
          '<label>' + escapeHtml(t('report_choose')) + '</label>' +
          '<div class="report-issue-pills" id="hnReportPills">' + pillsHtml + '</div>' +
        '</div>' +
        '<div class="owner-field">' +
          '<label for="hnReportNote">' + escapeHtml(t('report_note_label')) + '</label>' +
          '<textarea id="hnReportNote" rows="3" maxlength="300" placeholder="' + escapeHtml(t('report_note_ph')) + '"></textarea>' +
        '</div>' +
        '<button type="submit" class="auth-submit-btn">' + escapeHtml(t('report_submit')) + '</button>' +
      '</form>';

    modal.classList.add('open');

    var pillBtns = body.querySelectorAll('.report-issue-pill');
    for (var p = 0; p < pillBtns.length; p++) {
      pillBtns[p].addEventListener('click', function () {
        selectedIssue = this.getAttribute('data-issue') || 'other';
        for (var j = 0; j < pillBtns.length; j++) {
          pillBtns[j].classList.toggle('active', pillBtns[j] === this);
        }
      });
    }

    var form = document.getElementById('hnReportForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var noteEl = document.getElementById('hnReportNote');
        var res = submitReport(place.id, selectedIssue, noteEl ? noteEl.value : '');
        if (res.ok) {
          modal.classList.remove('open');
          showToastSafe(t('report_success'));
          // Refresh open detail banner if detailModal is currently showing this place
          var detailModal = document.getElementById('detailModal');
          if (detailModal && detailModal.classList.contains('open')) {
            renderDetailExtensions({ restaurant: place, targetMinutes: new Date().getHours() * 60 });
          }
        }
      });
    }
  }

  function openOwnerPortalModal(initialTab, prefillPlaceId) {
    var modal = document.getElementById('ownerPortalModal');
    if (!modal) return;
    if (initialTab) activeOwnerTab = initialTab;
    if (typeof prefillPlaceId !== 'undefined' && prefillPlaceId !== null) {
      activeUpdatePlaceId = Number(prefillPlaceId);
    }
    syncOwnerTabsUI();
    renderOwnerPortalTab(activeOwnerTab);
    modal.classList.add('open');
  }

  function syncOwnerTabsUI() {
    var tabsContainer = document.getElementById('ownerPortalTabs');
    if (!tabsContainer) return;
    var btns = tabsContainer.querySelectorAll('.engage-tab[data-owner-tab]');
    var labelMap = {
      register: t('owner_tab_register'),
      update: t('owner_tab_update'),
      reports: t('owner_tab_reports')
    };
    for (var i = 0; i < btns.length; i++) {
      var tab = btns[i].getAttribute('data-owner-tab');
      btns[i].classList.toggle('active', tab === activeOwnerTab);
      btns[i].setAttribute('aria-selected', tab === activeOwnerTab ? 'true' : 'false');
      if (labelMap[tab]) {
        btns[i].textContent = labelMap[tab];
      }
    }
  }

  function renderOwnerPortalTab(tabName) {
    activeOwnerTab = tabName || 'register';
    syncOwnerTabsUI();
    var container = document.getElementById('ownerPortalContent');
    if (!container) return;

    if (activeOwnerTab === 'register') {
      renderOwnerRegisterForm(container);
    } else if (activeOwnerTab === 'update') {
      renderOwnerUpdateForm(container);
    } else {
      renderOwnerReportsTab(container);
    }
  }

  function buildSelectOptions(items, selectedVal, translateFn) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var val = items[i];
      var lbl = translateFn ? translateFn(val) : val;
      html += '<option value="' + escapeHtml(val) + '"' + (val === selectedVal ? ' selected' : '') + '>' + escapeHtml(lbl) + '</option>';
    }
    return html;
  }

  function renderOwnerRegisterForm(container) {
    container.innerHTML =
      '<p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:12px;">' + escapeHtml(t('owner_reg_desc')) + '</p>' +
      '<form id="hnOwnerRegForm" class="owner-form">' +
        '<div class="owner-field">' +
          '<label for="opRegName">' + escapeHtml(t('owner_name')) + '</label>' +
          '<input type="text" id="opRegName" required placeholder="VD: Bún Chả Phố Cổ 1986" />' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
          '<div class="owner-field">' +
            '<label for="opRegDistrict">' + escapeHtml(t('owner_district')) + '</label>' +
            '<select id="opRegDistrict">' + buildSelectOptions(DISTRICTS_LIST, 'Hoàn Kiếm') + '</select>' +
          '</div>' +
          '<div class="owner-field">' +
            '<label for="opRegCategory">' + escapeHtml(t('owner_category')) + '</label>' +
            '<select id="opRegCategory">' + buildSelectOptions(CATEGORIES_LIST, 'Phở & Bún', translateCategory) + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="owner-field">' +
          '<label for="opRegAddress">' + escapeHtml(t('owner_address')) + '</label>' +
          '<input type="text" id="opRegAddress" required placeholder="VD: 28 Hàng Quạt, Hoàn Kiếm, Hà Nội" />' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
          '<div class="owner-field">' +
            '<label for="opRegHours">' + escapeHtml(t('owner_hours')) + '</label>' +
            '<input type="text" id="opRegHours" required value="07:00 - 22:00" placeholder="07:00 - 22:00" />' +
          '</div>' +
          '<div class="owner-field">' +
            '<label for="opRegPrice">' + escapeHtml(t('owner_price')) + '</label>' +
            '<input type="text" id="opRegPrice" required value="50.000đ - 120.000đ" placeholder="50.000đ - 120.000đ" />' +
          '</div>' +
        '</div>' +
        '<div class="owner-field">' +
          '<label for="opRegDishes">' + escapeHtml(t('owner_dishes')) + '</label>' +
          '<input type="text" id="opRegDishes" placeholder="VD: Phở tái lăn, Quẩy giòn, Trà đá" />' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
          '<div class="owner-field">' +
            '<label for="opRegPhone">' + escapeHtml(t('owner_phone')) + '</label>' +
            '<input type="text" id="opRegPhone" placeholder="09xx xxx xxx" />' +
          '</div>' +
          '<div class="owner-field">' +
            '<label for="opRegImage">' + escapeHtml(t('owner_image')) + '</label>' +
            '<input type="url" id="opRegImage" placeholder="https://..." />' +
          '</div>' +
        '</div>' +
        '<div class="owner-field">' +
          '<label for="opRegTips">' + escapeHtml(t('owner_tips')) + '</label>' +
          '<input type="text" id="opRegTips" placeholder="VD: Có chỗ gửi xe miễn phí trước cửa" />' +
        '</div>' +
        '<div id="opRegFeedback" style="font-size:0.86rem; margin-bottom:8px;"></div>' +
        '<button type="submit" class="auth-submit-btn">' + escapeHtml(t('owner_reg_btn')) + '</button>' +
      '</form>';

    var form = document.getElementById('hnOwnerRegForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var res = registerRestaurant({
          name: document.getElementById('opRegName').value,
          district: document.getElementById('opRegDistrict').value,
          category: document.getElementById('opRegCategory').value,
          address: document.getElementById('opRegAddress').value,
          openingHours: document.getElementById('opRegHours').value,
          priceRange: document.getElementById('opRegPrice').value,
          signatureDishes: document.getElementById('opRegDishes').value,
          phone: document.getElementById('opRegPhone').value,
          image: document.getElementById('opRegImage').value,
          tips: document.getElementById('opRegTips').value
        });
        var fb = document.getElementById('opRegFeedback');
        if (!res.ok) {
          if (fb) fb.innerHTML = '<span style="color:#b91c1c;">❌ ' + escapeHtml(res.error) + '</span>';
          return;
        }
        activeUpdatePlaceId = res.restaurant.id;
        showToastSafe('🏪 Đã đăng ký quán "' + res.restaurant.name + '" (ID #' + res.restaurant.id + ')!');
        if (fb) {
          fb.innerHTML =
            '<span style="color:#15803d;">✅ Đã thêm "' + escapeHtml(res.restaurant.name) +
            '" (ID #' + res.restaurant.id + ')!</span> ' +
            '<button type="button" id="opViewNewBtn" class="btn-engage-mini" style="margin-left:8px;">' +
            escapeHtml(t('owner_view_place_btn')) + '</button>';
          var vBtn = document.getElementById('opViewNewBtn');
          if (vBtn) {
            vBtn.addEventListener('click', function () {
              var m = document.getElementById('ownerPortalModal');
              if (m) m.classList.remove('open');
              if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
                window.HNAppBridge.openDetail(res.restaurant.id);
              }
            });
          }
        }
        form.reset();
        document.getElementById('opRegHours').value = '07:00 - 22:00';
        document.getElementById('opRegPrice').value = '50.000đ - 120.000đ';
      });
    }
  }

  function renderOwnerUpdateForm(container) {
    var catalog = getCatalog();
    var target = activeUpdatePlaceId ? findRestaurantById(activeUpdatePlaceId) : null;
    if (!target && catalog.length) {
      var ownedIds = getOwnedAndUpdatedIds();
      target = ownedIds.length ? findRestaurantById(ownedIds[ownedIds.length - 1]) : catalog[0];
      if (target) activeUpdatePlaceId = target.id;
    }

    var optionsHtml = '';
    var matchesLimit = 25;
    for (var i = 0; i < catalog.length && i < matchesLimit; i++) {
      var item = catalog[i];
      optionsHtml += '<option value="' + item.id + '"' + (target && item.id === target.id ? ' selected' : '') + '>' +
        escapeHtml('#' + item.id + ' - ' + item.name + ' (' + item.district + ')') + '</option>';
    }
    if (target && target.id > matchesLimit) {
      optionsHtml = '<option value="' + target.id + '" selected>' +
        escapeHtml('#' + target.id + ' - ' + target.name + ' (' + target.district + ')') +
        '</option>' + optionsHtml;
    }

    var dishesVal = target && Array.isArray(target.signatureDishes) ? target.signatureDishes.join(', ') : '';

    container.innerHTML =
      '<p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:12px;">' + escapeHtml(t('owner_upd_desc')) + '</p>' +
      '<div class="owner-field">' +
        '<label for="opSearchPlace">' + escapeHtml(t('owner_search_place')) + '</label>' +
        '<input type="text" id="opSearchPlace" placeholder="Gõ tên quán hoặc ID (VD: Bát Đàn, 10000)..." />' +
      '</div>' +
      '<div class="owner-field">' +
        '<select id="opSelectPlace">' + optionsHtml + '</select>' +
      '</div>' +
      (target ? (
        '<form id="hnOwnerUpdateForm" class="owner-form">' +
          '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
            '<div class="owner-field">' +
              '<label for="opUpdHours">' + escapeHtml(t('owner_hours')) + '</label>' +
              '<input type="text" id="opUpdHours" required value="' + escapeHtml(target.openingHours || '') + '" />' +
            '</div>' +
            '<div class="owner-field">' +
              '<label for="opUpdPrice">' + escapeHtml(t('owner_price')) + '</label>' +
              '<input type="text" id="opUpdPrice" required value="' + escapeHtml(target.priceRange || '') + '" />' +
            '</div>' +
          '</div>' +
          '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
            '<div class="owner-field">' +
              '<label for="opUpdPhone">' + escapeHtml(t('owner_phone')) + '</label>' +
              '<input type="text" id="opUpdPhone" value="' + escapeHtml(target.phone || '') + '" />' +
            '</div>' +
            '<div class="owner-field">' +
              '<label for="opUpdDishes">' + escapeHtml(t('owner_dishes')) + '</label>' +
              '<input type="text" id="opUpdDishes" value="' + escapeHtml(dishesVal) + '" />' +
            '</div>' +
          '</div>' +
          '<div class="owner-field">' +
            '<label for="opUpdTips">' + escapeHtml(t('owner_tips')) + '</label>' +
            '<input type="text" id="opUpdTips" value="' + escapeHtml(target.tips || '') + '" />' +
          '</div>' +
          '<label style="display:flex; align-items:center; gap:8px; margin:8px 0 12px; cursor:pointer; font-weight:600;">' +
            '<input type="checkbox" id="opUpdTempClosed"' + (target.tempClosed ? ' checked' : '') + ' /> ' +
            '<span>' + escapeHtml(t('owner_temp_closed')) + '</span>' +
          '</label>' +
          '<button type="submit" class="auth-submit-btn">' + escapeHtml(t('owner_upd_btn')) + '</button>' +
        '</form>'
      ) : '');

    var searchBox = document.getElementById('opSearchPlace');
    var selectBox = document.getElementById('opSelectPlace');
    if (searchBox && selectBox) {
      searchBox.addEventListener('input', function () {
        var q = normalizeText(searchBox.value);
        var matched = [];
        for (var j = 0; j < catalog.length; j++) {
          var r = catalog[j];
          if (!q || String(r.id) === q || normalizeText(r.name + ' ' + r.district).indexOf(q) !== -1) {
            matched.push(r);
            if (matched.length >= 30) break;
          }
        }
        var html = '';
        for (var k = 0; k < matched.length; k++) {
          html += '<option value="' + matched[k].id + '">#' + matched[k].id + ' - ' +
            escapeHtml(matched[k].name + ' (' + matched[k].district + ')') + '</option>';
        }
        selectBox.innerHTML = html || '<option value="">Không tìm thấy quán</option>';
      });
    }

    if (selectBox) {
      selectBox.addEventListener('change', function () {
        var nextId = Number(selectBox.value);
        if (!isNaN(nextId) && nextId > 0) {
          activeUpdatePlaceId = nextId;
          renderOwnerUpdateForm(container);
        }
      });
    }

    var updForm = document.getElementById('hnOwnerUpdateForm');
    if (updForm && target) {
      updForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var res = updateRestaurant(target.id, {
          openingHours: document.getElementById('opUpdHours').value,
          priceRange: document.getElementById('opUpdPrice').value,
          phone: document.getElementById('opUpdPhone').value,
          signatureDishes: document.getElementById('opUpdDishes').value,
          tips: document.getElementById('opUpdTips').value,
          tempClosed: document.getElementById('opUpdTempClosed').checked
        });
        if (res.ok) {
          showToastSafe('✅ Đã cập nhật thông tin cho "' + res.restaurant.name + '"!');
        }
      });
    }
  }

  function renderOwnerReportsTab(container) {
    var reports = getAllReports();
    var listHtml = '';
    if (!reports.length) {
      listHtml = '<p style="color:var(--text-muted); padding:16px 0;">' + escapeHtml(t('owner_no_reports')) + '</p>';
    } else {
      for (var i = 0; i < reports.length; i++) {
        var rep = reports[i];
        var isResolved = rep.status === 'resolved';
        listHtml +=
          '<div class="custom-list-card" style="margin-bottom:10px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">' +
              '<div>' +
                '<strong>' + escapeHtml(rep.placeName) + '</strong> ' +
                '<span class="busy-status-pill ' + (isResolved ? 'low' : 'high') + '" style="margin-left:6px;">' +
                  escapeHtml(isResolved ? t('owner_resolved_tag') : t('owner_pending_tag')) +
                '</span>' +
                '<div style="font-size:0.84rem; margin-top:4px;">' +
                  '<span>' + escapeHtml(getIssueLabel(rep.issueType)) + '</span>' +
                  (rep.note ? ' — <em>"' + escapeHtml(rep.note) + '"</em>' : '') +
                '</div>' +
                '<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">' +
                  escapeHtml(rep.reporter) + ' • ' + escapeHtml(String(rep.createdAt || '').slice(0, 16).replace('T', ' ')) +
                '</div>' +
              '</div>' +
              '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                (!isResolved ? '<button type="button" class="btn-engage-mini" data-rep-resolve="' + escapeHtml(rep.id) + '">' + escapeHtml(t('owner_resolve_btn')) + '</button>' : '') +
                '<button type="button" class="btn-engage-mini" data-rep-edit="' + rep.placeId + '">' + escapeHtml(t('owner_edit_place_btn')) + '</button>' +
                '<button type="button" class="btn-engage-mini" data-rep-view="' + rep.placeId + '">' + escapeHtml(t('owner_view_place_btn')) + '</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
    }

    container.innerHTML =
      '<p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:12px;">' + escapeHtml(t('owner_rep_desc')) + '</p>' +
      '<div>' + listHtml + '</div>';

    var resBtns = container.querySelectorAll('[data-rep-resolve]');
    for (var r = 0; r < resBtns.length; r++) {
      resBtns[r].addEventListener('click', function () {
        var rid = this.getAttribute('data-rep-resolve');
        if (resolveReport(rid).ok) {
          showToastSafe('✅ Đã đánh dấu xử lý báo cáo!');
          renderOwnerReportsTab(container);
        }
      });
    }

    var editBtns = container.querySelectorAll('[data-rep-edit]');
    for (var eb = 0; eb < editBtns.length; eb++) {
      editBtns[eb].addEventListener('click', function () {
        activeUpdatePlaceId = Number(this.getAttribute('data-rep-edit'));
        renderOwnerPortalTab('update');
      });
    }

    var viewBtns = container.querySelectorAll('[data-rep-view]');
    for (var vb = 0; vb < viewBtns.length; vb++) {
      viewBtns[vb].addEventListener('click', function () {
        var pid = Number(this.getAttribute('data-rep-view'));
        var m = document.getElementById('ownerPortalModal');
        if (m) m.classList.remove('open');
        if (window.HNAppBridge && typeof window.HNAppBridge.openDetail === 'function') {
          window.HNAppBridge.openDetail(pid);
        }
      });
    }
  }

  /* ========================================================================
     INITIALIZATION & DOM EVENT BINDING
     ======================================================================== */
  // Apply stored owner places & overrides to RESTAURANTS_DATA immediately (before app.js init)
  applyOwnerDataToCatalog();

  function bindDomHandlers() {
    applyDomTranslations();

    // Language toggle button
    var langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        setLang(getLang() === 'vi' ? 'en' : 'vi');
      });
    }

    // Owner portal triggers & modal controls
    var btnOwnerHero = document.getElementById('btnOpenOwnerPortal');
    if (btnOwnerHero) {
      btnOwnerHero.addEventListener('click', function () {
        openOwnerPortalModal('register');
      });
    }
    var btnOwnerMob = document.getElementById('mobNavOwner');
    if (btnOwnerMob) {
      btnOwnerMob.addEventListener('click', function () {
        openOwnerPortalModal('register');
      });
    }
    var btnCloseOwner = document.getElementById('btnCloseOwnerPortal');
    if (btnCloseOwner) {
      btnCloseOwner.addEventListener('click', function () {
        var m = document.getElementById('ownerPortalModal');
        if (m) m.classList.remove('open');
      });
    }
    var ownerTabs = document.getElementById('ownerPortalTabs');
    if (ownerTabs) {
      ownerTabs.addEventListener('click', function (e) {
        var tabBtn = e.target && e.target.closest ? e.target.closest('.engage-tab[data-owner-tab]') : null;
        if (tabBtn) {
          renderOwnerPortalTab(tabBtn.getAttribute('data-owner-tab'));
        }
      });
    }

    // Report modal close
    var btnCloseReport = document.getElementById('btnCloseReportModal');
    if (btnCloseReport) {
      btnCloseReport.addEventListener('click', function () {
        var m = document.getElementById('reportPlaceModal');
        if (m) m.classList.remove('open');
      });
    }

    // Close modals on backdrop click
    var ownerModal = document.getElementById('ownerPortalModal');
    if (ownerModal) {
      ownerModal.addEventListener('click', function (e) {
        if (e.target === ownerModal) ownerModal.classList.remove('open');
      });
    }
    var reportModal = document.getElementById('reportPlaceModal');
    if (reportModal) {
      reportModal.addEventListener('click', function (e) {
        if (e.target === reportModal) reportModal.classList.remove('open');
      });
    }

    // Detail modal extension hook (Busy Hours + Report Button + Flag Banner)
    window.addEventListener('hn-detail-opened', function (e) {
      renderDetailExtensions(e && e.detail ? e.detail : null);
    });

    // Cross-tab storage sync for owner/report/lang
    window.addEventListener('storage', function (e) {
      if (!e) return;
      if (e.key === OWNER_PLACES_KEY || e.key === OWNER_OVERRIDES_KEY) {
        applyOwnerDataToCatalog();
        notifyCatalogUpdated();
      } else if (e.key === LANG_KEY && (e.newValue === 'vi' || e.newValue === 'en')) {
        currentLang = e.newValue;
        applyDomTranslations();
        notifyCatalogUpdated();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDomHandlers);
  } else {
    bindDomHandlers();
  }

  window.HNOwnerPortal = {
    applyOwnerDataToCatalog: applyOwnerDataToCatalog,
    getOwnedAndUpdatedIds: getOwnedAndUpdatedIds,
    registerRestaurant: registerRestaurant,
    updateRestaurant: updateRestaurant,
    openModal: openOwnerPortalModal
  };

  window.HNReports = {
    submitReport: submitReport,
    getReportsForPlace: getReportsForPlace,
    getAllReports: getAllReports,
    resolveReport: resolveReport,
    openReportModal: openReportModal
  };

  window.HNBusyHours = {
    computeBusyHours: computeBusyHours
  };
})(window, document);
