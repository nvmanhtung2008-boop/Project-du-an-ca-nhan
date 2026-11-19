/* ==========================================================================
   RẠP CHIẾU PHIM HÀ NỘI PHỐ VỊ (XEM PHIM TRỰC TUYẾN - THAM KHẢO MOTCHILL.SHOW)
   Tuyệt đối không chứa quảng cáo hay hình ảnh liên quan đến cá độ, bóng đá.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var WATCHLIST_KEY = 'hanoi_phovi_movie_watchlist_v1';
  var COMMENTS_KEY = 'hanoi_phovi_movie_comments_v1';
  var HISTORY_KEY = 'hanoi_phovi_movie_history_v1';

  var streamCache = {};
  var movieStates = {};
  var historyMemoryFallback = {};
  var hlsInstance = null;
  var activeLoadToken = 0;

  var MOVIES_CATALOG = [
    {
      id: 'mv_ngoc_diem_thu',
      slug: 'ngoc-diem-thu',
      posterUrl: 'https://image.tmdb.org/t/p/w500/dVywpeUgv5YG0zQxKp2meAOz106.jpg',
      title: 'Ngọc Điệm Thu',
      originalTitle: 'The Lament Of Autumn',
      category: 'Phim Bộ',
      genres: ['Chính Kịch', 'Tình Cảm'],
      country: 'Trung Quốc',
      year: 2026,
      rating: 9.2,
      badge: 'Full (40/40) Vietsub + Thuyết Minh',
      episodes: 40,
      theme: ['#7f1d1d', '#b45309', '#fef3c7'],
      icon: '🏮',
      shortDescription: 'Lấy bối cảnh đầu thế kỷ 20 giữa thời loạn lạc ở Nam Hoài, nữ sinh nghèo Diệp Bình Quân tình cờ vướng vào một vụ ám sát và gặp gỡ ngũ thiếu gia Ngu Sưởng Hiên. Sau nhiều biến cố khiến cả hai chia lìa, nhiều năm sau họ gặp lại để hóa giải hiểu lầm và đối mặt với bí mật quá khứ.'
    },
    {
      id: 'mv_ga_kim_thoa',
      slug: 'ga-kim-thoa-ga-tram-vang',
      posterUrl: 'https://image.tmdb.org/t/p/w500/ozczlsMlKUhzB11ygTj4QVEGS7v.jpg',
      title: 'Gả Kim Thoa / Gả Trâm Vàng',
      originalTitle: 'Where The Mask Ends',
      category: 'Phim Bộ',
      genres: ['Chính Kịch', 'Cổ Trang'],
      country: 'Trung Quốc',
      year: 2026,
      rating: 9.0,
      badge: 'Full (30/30) Vietsub + Thuyết Minh',
      episodes: 30,
      theme: ['#581c87', '#be185d', '#fce7f3'],
      icon: '👑',
      shortDescription: 'Thiếu nữ nghèo A Sửu bất ngờ trở thành tân nương xung hỷ cho thế tử Quốc Công Phủ vì có diện mạo giống hệt tiểu thư Ngụy Nhiêu. Giữa chốn hào môn đầy cạm bẫy và sự đề phòng của phu quân Lục Trạc, cô từng bước xoay sở, lật mở bí mật thân thế và thay đổi vận mệnh.'
    },
    {
      id: 'mv_bac_si_x',
      slug: 'bac-si-x',
      posterUrl: 'https://image.tmdb.org/t/p/w500/jzqPdwpiDTPzvnbV0pZzTtOIgWz.jpg',
      title: 'Bác Sĩ X',
      originalTitle: 'Doctor X: Mafia in White',
      category: 'Phim Bộ',
      genres: ['Chính Kịch', 'Bí Ẩn', 'Hình Sự'],
      country: 'Hàn Quốc',
      year: 2026,
      rating: 9.4,
      badge: 'Full (12/12) Vietsub',
      episodes: 12,
      theme: ['#0f172a', '#0284c7', '#e0f2fe'],
      icon: '🩺',
      shortDescription: 'Tại một bệnh viện đầy rẫy cái tôi và tệ nạn tham nhũng, một bác sĩ phẫu thuật bí ẩn nhưng xuất chúng bất ngờ xuất hiện. Bất chấp sự phản đối quyết liệt từ ban lãnh đạo, người bác sĩ này liên tục nhận những ca phẫu thuật tưởng chừng bất khả thi.'
    },
    {
      id: 'mv_100_ngay_lua_doi',
      slug: '100-ngay-lua-doi',
      posterUrl: 'https://image.tmdb.org/t/p/w500/yukp2lBvw4ENQvdLN1slneX6jxN.jpg',
      title: '100 Ngày Lừa Dối',
    originalTitle: '100 Days Of Deception',
      category: 'Phim Bộ',
      genres: ['Chính Kịch', 'Hành Động'],
      country: 'Hàn Quốc',
      year: 2026,
      rating: 8.9,
      badge: 'Tập 12/16 Vietsub',
      episodes: 16,
      theme: ['#1e1b4b', '#4338ca', '#e0e7ff'],
      icon: '🕵️',
      shortDescription: 'Mang khát vọng tự do, nữ đạo chích móc túi hàng đầu ở Gyeongseong thâm nhập vào bộ máy chính quyền thực dân để đánh cắp bí mật. Thế nhưng, kế hoạch của cô rơi vào thử thách lớn khi cô lại đem lòng yêu con trai của chính mục tiêu.'
    },
    {
      id: 'mv_tieng_yeu_nay',
      slug: 'tieng-yeu-nay-anh-dich-duoc-khong',
      posterUrl: 'https://image.tmdb.org/t/p/w500/xvlfY1XjZ2kKdaCCDvZLPTB65JG.jpg',
      title: 'Tiếng Yêu Này, Anh Dịch Được Không?',
      originalTitle: 'Can This Love Be Translated?',
      category: 'Phim Bộ',
      genres: ['Chính Kịch', 'Hài Hước', 'Tình Cảm'],
      country: 'Hàn Quốc',
      year: 2026,
      rating: 9.3,
      badge: 'Full (12/12) Vietsub + Lồng Tiếng',
      episodes: 12,
      theme: ['#831843', '#ec4899', '#fdf2f8'],
      icon: '💌',
      shortDescription: 'Cùng rong ruổi qua nhiều quốc gia để ghi hình một chương trình truyền hình, nữ ngôi sao nổi tiếng và chàng phiên dịch viên của cô lại thường xuyên hiểu lầm cảm xúc của nhau. Giữa những khác biệt ngôn ngữ và văn hóa, tình yêu của họ dần tìm được tiếng nói chung.'
    },
    {
      id: 'mv_vung_dat_quy_du',
      slug: 'vung-dat-quy-du-2026',
      posterUrl: 'https://image.tmdb.org/t/p/w500/jlFMvLuzjwt7aI1QVtiNVnFHNBe.jpg',
      title: 'Vùng Đất Quỷ Dữ',
      originalTitle: 'Resident Evil',
      category: 'Phim Chiếu Rạp',
      genres: ['Phiêu Lưu', 'Kinh Dị', 'Viễn Tưởng'],
      country: 'Hoa Kỳ',
      year: 2026,
      rating: 8.8,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#18181b', '#991b1b', '#fecaca'],
      icon: '☣️',
      shortDescription: 'Phiên bản điện ảnh mới của thương hiệu Resident Evil do đạo diễn Zach Cregger thực hiện. Bộ phim mang đến hành trình sinh tồn đầy kịch tính và kinh hoàng trước hiểm họa sinh học chết người.'
    },
    {
      id: 'mv_nguoi_nhen',
      slug: 'nguoi-nhen-khoi-dau-moi',
      posterUrl: 'https://image.tmdb.org/t/p/w500/wqGZVSCUSXE92WH2zyol2REaqT4.jpg',
      title: 'Người Nhện: Khởi Đầu Mới',
      originalTitle: 'Spider-Man: Brand New Day',
      category: 'Phim Chiếu Rạp',
      genres: ['Hành Động', 'Phiêu Lưu', 'Viễn Tưởng'],
      country: 'Hoa Kỳ',
      year: 2026,
      rating: 9.5,
      badge: 'Full HD Vietsub + Thuyết Minh',
      episodes: 1,
      theme: ['#1d4ed8', '#dc2626', '#eff6ff'],
      icon: '🕸️',
      shortDescription: 'Khi không còn những người thân thiết sát cánh bên mình, Peter Parker phải tự gánh vác trọng trách Người Nhện giữa thành phố đầy rẫy hiểm nguy. Đối mặt với hàng loạt vụ án bí ẩn và biến đổi thể chất bất thường, anh buộc phải vượt qua giới hạn bản thân để bảo vệ thành phố.'
    },
    {
      id: 'mv_quy_quyet',
      slug: 'quy-quyet-ranh-gioi-vo-dinh',
      posterUrl: 'https://image.tmdb.org/t/p/w500/u1ZyMm7HcYO1CJwtk28dStDH9Bp.jpg',
      title: 'Quỷ Quyệt: Ranh Giới Vô Định',
      originalTitle: 'Insidious: Out of the Further',
      category: 'Phim Chiếu Rạp',
      genres: ['Kinh Dị', 'Gây Cấn'],
      country: 'Hoa Kỳ',
      year: 2026,
      rating: 8.6,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#09090b', '#4c1d95', '#ddd6fe'],
      icon: '🕯️',
      shortDescription: 'Ba kẻ rình rập đột nhập vào một khu dân cư yên tĩnh và kéo gia đình mới chuyển đến sang cõi linh hồn. Tại đó, họ bàng hoàng phát hiện cõi âm đang dần xâm lấn trực tiếp vào thế giới thực.'
    },
    {
      id: 'mv_bay_tien',
      slug: 'bay-tien',
      posterUrl: 'https://image.tmdb.org/t/p/w500/ayDNI6x8g3638uQSTmNqW9CeUUU.jpg',
      title: 'Bẫy Tiền',
      originalTitle: 'The Fatal Dealz',
      category: 'Phim Chiếu Rạp',
      genres: ['Hành Động', 'Gây Cấn'],
      country: 'Việt Nam',
      year: 2026,
      rating: 8.7,
      badge: 'Full HD Chiếu Rạp',
      episodes: 1,
      theme: ['#14532d', '#ca8a04', '#fef9c3'],
      icon: '💸',
      shortDescription: 'Sau một vụ lừa đảo qua điện thoại bất ngờ, Đặng Thức bị cuốn khỏi cuộc sống ổn định vào vòng xoáy nguy hiểm của tiền bạc, gia đình và lòng tin. Mọi lựa chọn của anh đều phải trả giá bằng chính sự an nguy của những người anh yêu thương.'
    },
    {
      id: 'mv_su_thi_odyssey',
      slug: 'su-thi-odyssey',
      posterUrl: 'https://image.tmdb.org/t/p/w500/7876PK6gosE13Uq1B6nRxf7AJLT.jpg',
      title: 'Sử Thi Odyssey',
      originalTitle: 'The Odyssey',
      category: 'Phim Chiếu Rạp',
      genres: ['Hành Động', 'Phiêu Lưu', 'Giả Tưởng'],
      country: 'Hoa Kỳ',
      year: 2026,
      rating: 9.4,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#0c4a6e', '#d97706', '#fef3c7'],
      icon: '⛵',
      shortDescription: 'Tác phẩm theo chân Odysseus trong hành trình kéo dài 10 năm vượt biển trở về quê hương sau cuộc chiến thành Troy. Trên đường đi, ông phải đối đầu với các vị thần, quái vật và vô vàn thử thách để đoàn tụ với gia đình và giành lại vương quốc.'
    },
    {
      id: 'mv_hoan_doi_giang_sinh',
      slug: 'hoan-doi-dip-giang-sinh',
      posterUrl: 'https://image.tmdb.org/t/p/w500/9kHrUoPF2rl5Hj0QMquAy3xznXT.jpg',
      title: 'Hoán Đổi Dịp Giáng Sinh',
      originalTitle: 'The Christmas Switch',
      category: 'Phim Lẻ',
      genres: ['Tình Cảm', 'Hài Hước'],
      country: 'Thụy Điển',
      year: 2026,
      rating: 8.4,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#065f46', '#dc2626', '#ecfdf5'],
      icon: '🎄',
      shortDescription: 'Muốn tìm cảm giác mới mẻ dịp Giáng sinh, một cô gái thành thị sôi nổi quyết định hoán đổi cuộc sống với người chị gái quen nếp sống ở vùng quê. Thế nhưng, màn đổi vai này lại kéo cả hai vào hàng loạt tình huống dở khóc dở cười.'
    },
    {
      id: 'mv_khong_dau_hang',
      slug: 'khong-dau-hang-2026',
      posterUrl: 'https://image.tmdb.org/t/p/w500/hKROmLddpzpjkxKKVFYFRAOXX1b.jpg',
      title: 'Không Đầu Hàng',
      originalTitle: 'Never Surrender',
      category: 'Phim Lẻ',
      genres: ['Hành Động', 'Gây Cấn', 'Hình Sự'],
      country: 'Indonesia',
      year: 2026,
      rating: 8.5,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#27272a', '#ea580c', '#ffedd5'],
      icon: '🔥',
      shortDescription: 'Khi một băng nhóm tội phạm nguy hiểm tấn công ngôi nhà hẻo lánh, một cựu binh mang nhiều mặc cảm quá khứ buộc phải đứng lên chiến đấu. Ông phải hợp sức cùng những đứa cháu vốn xa cách để bảo vệ gia đình và giành lấy sự sống.'
    },
    {
      id: 'mv_tay_dam_thue',
      slug: 'tay-dam-thue',
      posterUrl: 'https://image.tmdb.org/t/p/w500/jbZ1HbrM5Cf6U7mnJLQV6Td9L2s.jpg',
      title: 'Tay Đấm Thuê',
      originalTitle: 'Brawlers',
      category: 'Phim Lẻ',
      genres: ['Hài Hước', 'Hành Động'],
      country: 'Pháp',
      year: 2026,
      rating: 8.3,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#312e81', '#0891b2', '#cffafe'],
      icon: '🥊',
      shortDescription: 'Vì cần gấp tiền để cứu chữa cho chú chó cưng của mình, Naïm nhận làm tay đấm thuê cho một dịch vụ ngầm ở Marseille. Từ đó, anh chuyên dùng nắm đấm để giải quyết các tranh chấp cho người khác và vướng vào nhiều rắc rối.'
    },
    {
      id: 'mv_cong_vien_giai_thoat',
      slug: 'cong-vien-giai-thoat',
      posterUrl: 'https://image.tmdb.org/t/p/w500/2IVeZyp6Tteyb4X9zxuGkE7zOOZ.jpg',
      title: 'Công Viên Giải Thoát',
      originalTitle: 'Kijsada Paradise',
      category: 'Phim Lẻ',
      genres: ['Kinh Dị', 'Bí Ẩn'],
      country: 'Thái Lan',
      year: 2026,
      rating: 8.4,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#111827', '#7c2d12', '#fed7aa'],
      icon: '🎡',
      shortDescription: 'Một bi kịch thời thơ ấu, vụ mất tích chưa có lời giải và chiếc áo mưa đỏ xuất hiện trở lại sau nhiều năm đã kéo nhóm bạn trẻ về công viên nước hoang tàn. Giữa bóng tối bao trùm, cả nhóm bị cuốn vào vòng xoáy kinh hoàng không lối thoát.'
    },
    {
      id: 'mv_nguoi_me_khac',
      slug: 'nguoi-me-khac',
      posterUrl: 'https://image.tmdb.org/t/p/w500/nZYi7HeXJVfJmZ0kprb1cJBHN2g.jpg',
      title: 'Người Mẹ Khác',
      originalTitle: 'Other Mommy',
      category: 'Phim Lẻ',
      genres: ['Kinh Dị'],
      country: 'Hoa Kỳ',
      year: 2026,
      rating: 8.2,
      badge: 'Full HD Vietsub',
      episodes: 1,
      theme: ['#1f2937', '#6d28d9', '#ede9fe'],
      icon: '🚪',
      shortDescription: 'Một cô bé cùng gia đình bị ám ảnh bởi thực thể tà ác ẩn náu trong chính ngôi nhà của họ. Để chiếm đoạt thân xác cô bé vĩnh viễn, thế lực này tìm cách dụ dỗ cô tự nguyện mở cửa cho nó bước vào.'
    },
    {
      id: 'mv_dao_hai_tac',
      slug: 'dao-hai-tac',
      posterUrl: 'https://image.tmdb.org/t/p/w500/zuL13RB91w6bssbmSpBiodd8lmC.jpg',
      title: 'Đảo Hải Tặc',
      originalTitle: 'One Piece',
      category: 'Hoạt Hình',
      genres: ['Hài Hước', 'Hoạt Hình', 'Hành Động'],
      country: 'Nhật Bản',
      year: 1999,
      rating: 9.7,
      badge: 'Tập 1180/1190 Vietsub + Lồng Tiếng',
      episodes: 24,
      theme: ['#0369a1', '#eab308', '#fef9c3'],
      icon: '🏴‍☠️',
      shortDescription: 'Cậu bé Monkey D. Luffy sở hữu cơ thể cao su sau khi ăn nhầm Trái Ác Quỷ đã ra khơi lập băng Hải tặc Mũ Rơm. Cùng các đồng đội, cậu vượt qua nhiều đối thủ hùng mạnh và Hải quân để chinh phục kho báu One Piece.'
    },
    {
      id: 'mv_doraemon_day_bien',
      slug: 'doraemon-nobita-va-lau-dai-duoi-day-bien-phien-ban-moi',
      posterUrl: 'https://image.tmdb.org/t/p/w500/68GLX3MVuwd2gNQSOnjSKEU3LpF.jpg',
      title: 'Doraemon: Nobita và Lâu Đài Dưới Đáy Biển',
      originalTitle: 'Doraemon: Castle of the Undersea Devil',
      category: 'Hoạt Hình',
      genres: ['Gia Đình', 'Phiêu Lưu', 'Hoạt Hình'],
      country: 'Nhật Bản',
      year: 2026,
      rating: 9.5,
      badge: 'Full (3/3) Vietsub + Lồng Tiếng',
      episodes: 3,
      theme: ['#0284c7', '#38bdf8', '#e0f2fe'],
      icon: '🐚',
      shortDescription: 'Phiên bản làm mới của tác phẩm điện ảnh kinh điển về chuyến thám hiểm đại dương của nhóm bạn Doraemon và Nobita. Trong hành trình khám phá đáy biển sâu thẳm, cả nhóm phát hiện ra bí mật về tòa lâu đài cổ xưa đầy nguy hiểm.'
    },
    {
      id: 'mv_su_huynh',
      slug: 'su-huynh-a-su-huynh',
      posterUrl: 'https://image.tmdb.org/t/p/w500/eUkXgiZlKg1XVLcmZsUFCT1SVOf.jpg',
      title: 'Sư Huynh À Sư Huynh',
      originalTitle: 'My Senior Brother is Too Steady',
      category: 'Hoạt Hình',
      genres: ['Giả Tưởng', 'Hài Hước', 'Hoạt Hình'],
      country: 'Trung Quốc',
      year: 2023,
      rating: 9.1,
      badge: 'Tập 168/180 Vietsub',
      episodes: 20,
      theme: ['#0f766e', '#14b8a6', '#ccfbf1'],
      icon: '☯️',
      shortDescription: 'Lý Trường Thọ tái sinh vào thời thượng cổ trước đại chiến Phong Thần và trở thành một Luyện khí sĩ luôn hành sự cực kỳ thận trọng để cầu trường sinh. Tuy nhiên, cuộc sống ẩn dật an toàn của anh bị đảo lộn khi sư phụ nhận thêm một tiểu sư muội.'
    },
    {
      id: 'mv_phap_su_tu_linh',
      slug: 'phap-su-tu-linh-ta-chinh-la-thien-tai',
      posterUrl: 'https://phimimg.com/uploads/movies/20260807/phap-su-tu-linh-ta-chinh-la-thien-tai-poster.webp',
      title: 'Pháp Sư Tử Linh: Ta Chính Là Thiên Tai',
      originalTitle: 'Necromancer: King of the Scourge',
      category: 'Hoạt Hình',
      genres: ['Chính Kịch', 'Hoạt Hình', 'Viễn Tưởng', 'Hành Động'],
      country: 'Trung Quốc',
      year: 2026,
      rating: 9.0,
      badge: 'Tập 35/60 Vietsub',
      episodes: 20,
      theme: ['#3b0764', '#9333ea', '#f3e8ff'],
      icon: '🔮',
      shortDescription: 'Trong thế giới bị quy tắc trò chơi đảo lộn và đe dọa bởi sự xâm lăng của ma tộc cùng long tộc, Lâm Mặc Ngữ sở hữu năng lực đặc biệt chỉ cần xua tay là triệu hồi được đội quân hùng mạnh. Anh từng bước đẩy lùi dị tộc, thống nhất thiên hạ và trở thành vị quân vương thực thụ.'
    },
    {
      id: 'mv_ichijouma',
      slug: 'ichijouma-mankitsugurashi',
      posterUrl: 'https://phimimg.com/upload/vod/20260414-1/042274d110b2f594a24d416123a9e508.jpg',
      title: 'Ichijouma Mankitsugurashi',
      originalTitle: 'Ichijouma Mankitsugurashi',
      category: 'Hoạt Hình',
      genres: ['Hài Hước', 'Chính Kịch', 'Tâm Lý'],
      country: 'Nhật Bản',
      year: 2026,
      rating: 8.6,
      badge: 'Tập 11/13 Vietsub',
      episodes: 13,
      theme: ['#be123c', '#fb7185', '#ffe4e6'],
      icon: '📚',
      shortDescription: 'Meiko, một cô gái từ vùng nông thôn, được nhận vào trường nữ sinh danh giá với điều kiện tham gia chương trình tình nguyện nhưng lại được phân công sống và làm việc tại một tiệm cà phê truyện tranh. Nhờ sự đồng hành của dàn nữ sinh dễ thương, cuộc sống mới trong không gian nhỏ hẹp trở nên thú vị.'
    }
  ];

  var state = {
    category: 'Tất cả',
    country: 'Tất cả',
    search: '',
    activeMovie: null,
    activeEpisode: 1,
    activeServerIdx: 0,
    playMode: 'hls',
    theaterDark: false
  };

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getWatchlist() { return loadJson(WATCHLIST_KEY, []); }
  function isSavedMovie(id) { return getWatchlist().indexOf(id) !== -1; }
  function toggleWatchlist(id) {
    var list = getWatchlist();
    var idx = list.indexOf(id);
    if (idx === -1) list.unshift(id);
    else list.splice(idx, 1);
    saveJson(WATCHLIST_KEY, list);
  }

  function getHistory() {
    var hist = loadJson(HISTORY_KEY, null);
    var merged = Object.assign({}, historyMemoryFallback);
    if (hist && typeof hist === 'object' && !Array.isArray(hist)) {
      Object.keys(hist).forEach(function (k) {
        if (hist[k] && typeof hist[k] === 'object') {
          if (!merged[k] || (hist[k].at || 0) >= (merged[k].at || 0)) {
            merged[k] = hist[k];
          }
        }
      });
    }
    return merged;
  }

  function recordHistory(movieId, ep) {
    if (!movieId) return;
    var safeEp = Math.max(1, parseInt(ep, 10) || 1);
    var entry = { ep: safeEp, at: Date.now() };
    historyMemoryFallback[movieId] = entry;
    var hist = loadJson(HISTORY_KEY, null);
    if (!hist || typeof hist !== 'object' || Array.isArray(hist)) hist = {};
    hist[movieId] = entry;
    saveJson(HISTORY_KEY, hist);
  }

  function getMovieState(movieId) {
    if (!movieId) return { ep: 1, serverIdx: null, playMode: 'hls' };
    if (!movieStates[movieId]) {
      var hist = getHistory();
      var savedEp = hist[movieId] && hist[movieId].ep ? parseInt(hist[movieId].ep, 10) : 1;
      movieStates[movieId] = {
        ep: Math.max(1, savedEp || 1),
        serverIdx: null,
        playMode: 'hls'
      };
    }
    return movieStates[movieId];
  }

  function setMovieEpisode(movieId, ep) {
    if (!movieId) return 1;
    var safeEp = Math.max(1, parseInt(ep, 10) || 1);
    var ms = getMovieState(movieId);
    ms.ep = safeEp;
    recordHistory(movieId, safeEp);
    if (state.activeMovie && state.activeMovie.id === movieId) {
      state.activeEpisode = safeEp;
    }
    return safeEp;
  }

  function setMovieServer(movieId, serverIdx) {
    if (!movieId) return 0;
    var safeIdx = Math.max(0, parseInt(serverIdx, 10) || 0);
    var ms = getMovieState(movieId);
    ms.serverIdx = safeIdx;
    if (state.activeMovie && state.activeMovie.id === movieId) {
      state.activeServerIdx = safeIdx;
    }
    return safeIdx;
  }

  function setMoviePlayMode(movieId, mode) {
    if (!movieId) return 'hls';
    var safeMode = mode === 'embed' ? 'embed' : 'hls';
    var ms = getMovieState(movieId);
    ms.playMode = safeMode;
    if (state.activeMovie && state.activeMovie.id === movieId) {
      state.playMode = safeMode;
    }
    return safeMode;
  }

  function getCommentsMap() { return loadJson(COMMENTS_KEY, {}); }
  function addMovieComment(movieId, text) {
    var cur = window.HNAuth && window.HNAuth.getCurrentUser();
    var author = cur ? cur.fullName : 'Khán giả Phố Cổ';
    var map = getCommentsMap();
    if (!map[movieId]) map[movieId] = [];
    map[movieId].unshift({
      author: author,
      text: text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    });
    saveJson(COMMENTS_KEY, map);
  }

  function buildPosterStyle(m) {
    var t = m.theme || ['#1e293b', '#b91c1c', '#fef3c7'];
    return 'background: radial-gradient(circle at 80% 18%, ' + t[1] + '55 0%, transparent 55%), linear-gradient(155deg, ' + t[0] + ' 0%, ' + t[1] + ' 100%); color: ' + t[2] + ';';
  }

  function getFilteredMovies() {
    var wl = getWatchlist();
    var q = state.search.trim().toLowerCase();
    return MOVIES_CATALOG.filter(function (m) {
      if (state.category === 'Đã Lưu' && wl.indexOf(m.id) === -1) return false;
      if (state.category !== 'Tất cả' && state.category !== 'Đã Lưu' && m.category !== state.category) return false;
      if (state.country !== 'Tất cả' && m.country !== state.country) return false;
      if (q) {
        var hay = (m.title + ' ' + m.originalTitle + ' ' + m.genres.join(' ') + ' ' + m.country).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderMovieGrid() {
    var grid = $('moviesGrid');
    var countEl = $('moviesCountInfo');
    if (!grid) return;
    var list = getFilteredMovies();
    var wl = getWatchlist();
    var hist = getHistory();
    if (countEl) countEl.textContent = 'Đang hiển thị ' + list.length + ' phim sạch · Không quảng cáo cá độ / bóng đá';

    if (!list.length) {
      grid.innerHTML = '<div class="mv-empty">🎬 Không tìm thấy phim phù hợp. Thử chọn thể loại khác nhé!</div>';
      return;
    }

    grid.innerHTML = list.map(function (m) {
      var saved = wl.indexOf(m.id) !== -1;
      var watched = hist[m.id];
      return '<article class="mv-card" data-movie-id="' + m.id + '">' +
        '<div class="mv-poster" style="' + buildPosterStyle(m) + '">' +
          (m.posterUrl ? '<img class="mv-poster-img" src="' + escHtml(m.posterUrl) + '" alt="' + escHtml(m.title) + '" loading="lazy" onerror="this.style.display=\'none\'" />' : '') +
          '<span class="mv-badge-top">' + escHtml(m.badge) + '</span>' +
          '<button type="button" class="mv-save-btn' + (saved ? ' saved' : '') + '" data-save-mv="' + m.id + '" title="Lưu vào danh sách xem sau">' + (saved ? '❤️' : '🤍') + '</button>' +
          '<div class="mv-poster-art">' + m.icon + '</div>' +
          '<div class="mv-poster-caption">' +
            '<span class="mv-poster-cat">' + escHtml(m.category) + ' • ' + m.year + '</span>' +
            '<h4 class="mv-poster-title">' + escHtml(m.title) + '</h4>' +
            '<span class="mv-poster-orig">' + escHtml(m.originalTitle) + '</span>' +
          '</div>' +
          '<div class="mv-play-overlay"><span>▶ Xem Ngay</span></div>' +
        '</div>' +
        '<div class="mv-card-meta">' +
          '<div class="mv-card-title">' + escHtml(m.title) + '</div>' +
          '<div class="mv-card-sub">⭐ ' + m.rating + ' • ' + escHtml(m.country) + ' • ' + escHtml(m.genres.slice(0, 2).join(', ')) + '</div>' +
          (watched ? '<div class="mv-watched-tag">▶ Đã xem Tập ' + watched.ep + '</div>' : '') +
        '</div>' +
      '</article>';
    }).join('');

    grid.querySelectorAll('.mv-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-save-mv]')) return;
        var mid = card.getAttribute('data-movie-id');
        var mv = MOVIES_CATALOG.find(function (x) { return x.id === mid; });
        if (mv) openPlayer(mv);
      });
    });

    grid.querySelectorAll('[data-save-mv]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleWatchlist(btn.getAttribute('data-save-mv'));
        renderMovieGrid();
      });
    });
  }

  function fetchJsonWithTimeout(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  function normalizeStandardEpisodes(rawEpisodes) {
    if (!Array.isArray(rawEpisodes)) return [];
    return rawEpisodes.map(function (srv, idx) {
      var list = Array.isArray(srv.server_data) ? srv.server_data : [];
      var cleaned = list.filter(function (ep) {
        return ep && (ep.link_m3u8 || ep.link_embed);
      }).map(function (ep, epIdx) {
        return {
          name: ep.name || String(epIdx + 1),
          slug: ep.slug || String(epIdx + 1),
          link_m3u8: ep.link_m3u8 || '',
          link_embed: ep.link_embed || ''
        };
      });
      return {
        server_name: srv.server_name || ('Server #' + (idx + 1)),
        server_data: cleaned
      };
    }).filter(function (srv) {
      return srv.server_data.length > 0;
    });
  }

  function normalizeNguonCEpisodes(rawEpisodes) {
    if (!Array.isArray(rawEpisodes)) return [];
    return rawEpisodes.map(function (srv, idx) {
      var list = Array.isArray(srv.items) ? srv.items : [];
      var cleaned = list.filter(function (ep) {
        return ep && (ep.m3u8 || ep.embed);
      }).map(function (ep, epIdx) {
        return {
          name: ep.name || String(epIdx + 1),
          slug: ep.slug || String(epIdx + 1),
          link_m3u8: ep.m3u8 || '',
          link_embed: ep.embed || ''
        };
      });
      return {
        server_name: srv.server_name || ('Server #' + (idx + 1)),
        server_data: cleaned
      };
    }).filter(function (srv) {
      return srv.server_data.length > 0;
    });
  }

  function firstResolvedPromise(promises) {
    return new Promise(function (resolve, reject) {
      if (!promises || !promises.length) {
        reject(new Error('No promises'));
        return;
      }
      var remaining = promises.length;
      var settled = false;
      promises.forEach(function (p) {
        Promise.resolve(p).then(function (val) {
          if (!settled) {
            settled = true;
            resolve(val);
          }
        }, function () {
          remaining--;
          if (remaining === 0 && !settled) {
            reject(new Error('All promises failed'));
          }
        });
      });
    });
  }

  function fetchPhimApiBySlug(slug) {
    return fetchJsonWithTimeout('https://phimapi.com/phim/' + encodeURIComponent(slug), 7000)
      .then(function (data) {
        var eps = normalizeStandardEpisodes((data && data.episodes) || (data && data.data && data.data.item && data.data.item.episodes));
        if (eps.length) return eps;
        throw new Error('Empty episodes on phimapi');
      });
  }

  function fetchOphimBySlug(slug) {
    return fetchJsonWithTimeout('https://ophim1.com/phim/' + encodeURIComponent(slug), 7000)
      .then(function (data) {
        var eps = normalizeStandardEpisodes((data && data.episodes) || (data && data.data && data.data.item && data.data.item.episodes));
        if (eps.length) return eps;
        throw new Error('Empty episodes on ophim1');
      });
  }

  function fetchNguonCBySlug(slug) {
    return fetchJsonWithTimeout('https://phim.nguonc.com/api/film/' + encodeURIComponent(slug), 7000)
      .then(function (data) {
        var eps = normalizeNguonCEpisodes(data && data.movie && data.movie.episodes);
        if (eps.length) return eps;
        throw new Error('Empty episodes on nguonc');
      });
  }

  function tryFetchFromSlugApis(slug) {
    if (!slug) return Promise.reject(new Error('No slug'));
    return firstResolvedPromise([
      fetchPhimApiBySlug(slug),
      fetchOphimBySlug(slug),
      fetchNguonCBySlug(slug)
    ]);
  }

  function rankSearchItems(items, movie) {
    var targetSlug = (movie.slug || '').toLowerCase();
    var targetTitle = (movie.title || '').toLowerCase();
    var targetOrig = (movie.originalTitle || '').toLowerCase();
    return items.slice().sort(function (a, b) {
      var sa = 0;
      var sb = 0;
      var aSlug = String(a && a.slug || '').toLowerCase();
      var bSlug = String(b && b.slug || '').toLowerCase();
      var aName = String(a && a.name || '').toLowerCase();
      var bName = String(b && b.name || '').toLowerCase();
      var aOrig = String(a && a.origin_name || '').toLowerCase();
      var bOrig = String(b && b.origin_name || '').toLowerCase();
      if (aSlug === targetSlug) sa += 100;
      if (bSlug === targetSlug) sb += 100;
      if (aName === targetTitle || (targetOrig && aOrig === targetOrig)) sa += 50;
      if (bName === targetTitle || (targetOrig && bOrig === targetOrig)) sb += 50;
      return sb - sa;
    });
  }

  function trySequentialDetails(slugs, detailFetcher) {
    var chain = Promise.reject(new Error('No candidates'));
    slugs.forEach(function (slug) {
      chain = chain.catch(function () {
        return detailFetcher(slug);
      });
    });
    return chain;
  }

  function trySearchProvider(searchUrl, movie, extractItems, detailFetcher) {
    return fetchJsonWithTimeout(searchUrl, 7000).then(function (res) {
      var items = extractItems(res);
      var ranked = rankSearchItems(items, movie);
      var slugs = ranked.map(function (it) { return it && it.slug; }).filter(Boolean).slice(0, 3);
      if (!slugs.length) throw new Error('No search match');
      return trySequentialDetails(slugs, detailFetcher);
    });
  }

  function buildSearchKeywords(movie) {
    var raw = [];
    if (movie.title) {
      raw.push(movie.title);
      if (movie.title.indexOf('/') !== -1) {
        raw.push(movie.title.split('/')[0].trim());
      }
      if (movie.title.indexOf(':') !== -1) {
        raw.push(movie.title.split(':')[0].trim());
      }
    }
    if (movie.originalTitle) raw.push(movie.originalTitle);
    var seen = {};
    return raw.filter(function (k) {
      var key = String(k || '').trim().toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function trySearchAllApis(movie) {
    var keywords = buildSearchKeywords(movie);
    var chain = Promise.reject(new Error('No keywords'));
    keywords.forEach(function (kw) {
      chain = chain.catch(function () {
        var enc = encodeURIComponent(kw);
        return firstResolvedPromise([
          trySearchProvider(
            'https://phimapi.com/v1/api/tim-kiem?keyword=' + enc + '&limit=5',
            movie,
            function (r) { return r && r.data && Array.isArray(r.data.items) ? r.data.items : []; },
            fetchPhimApiBySlug
          ),
          trySearchProvider(
            'https://ophim1.com/v1/api/tim-kiem?keyword=' + enc,
            movie,
            function (r) { return (r && r.data && Array.isArray(r.data.items) ? r.data.items : (r && Array.isArray(r.items) ? r.items : [])); },
            fetchOphimBySlug
          ),
          trySearchProvider(
            'https://phim.nguonc.com/api/films/search?keyword=' + enc,
            movie,
            function (r) { return r && Array.isArray(r.items) ? r.items : []; },
            fetchNguonCBySlug
          )
        ]);
      });
    });
    return chain;
  }

  function fetchMovieStreams(movie) {
    if (streamCache[movie.id] && streamCache[movie.id].length) {
      return Promise.resolve(streamCache[movie.id]);
    }
    return tryFetchFromSlugApis(movie.slug)
      .catch(function () { return trySearchAllApis(movie); })
      .then(function (servers) {
        streamCache[movie.id] = servers;
        return servers;
      });
  }

  function pickPreferredServerIdx(servers, epNum) {
    if (!servers || !servers.length) return 0;
    for (var i = 0; i < servers.length; i++) {
      var list = servers[i].server_data || [];
      var idx = Math.max(0, Math.min(epNum - 1, list.length - 1));
      if (list[idx] && list[idx].link_m3u8) return i;
    }
    return 0;
  }

  function stopPlayback() {
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch (e) {}
      hlsInstance = null;
    }
    var video = $('mvVideoElement');
    if (video) {
      try { video.pause(); } catch (e) {}
      video.removeAttribute('src');
      video.removeAttribute('poster');
      try { video.load(); } catch (e) {}
    }
    var iframe = $('mvEmbedFrame');
    if (iframe) {
      iframe.src = 'about:blank';
      iframe.hidden = true;
    }
  }

  function setStageStatus(html) {
    var box = $('mvStageStatus');
    if (!box) return;
    if (!html) {
      box.hidden = true;
      box.innerHTML = '';
    } else {
      box.innerHTML = html;
      box.hidden = false;
    }
  }

  function getMotchillUrl(movie, epNum) {
    var slug = movie && movie.slug ? movie.slug : '';
    return slug ? ('https://motchill.show/xem-phim/' + slug + '?tap=' + epNum) : 'https://motchill.show';
  }

  function showUnavailableStatus(movie, epNum, reasonText) {
    stopPlayback();
    var video = $('mvVideoElement');
    if (video) video.hidden = true;
    var url = getMotchillUrl(movie, epNum);
    setStageStatus(
      '<div style="font-size:2rem;">🎬</div>' +
      '<p>' + escHtml(reasonText || 'Không thể tải luồng phát trực tiếp cho tập này.') + '</p>' +
      '<div class="mv-stage-actions">' +
        '<button type="button" id="btnMvRetryStream" class="mv-pill-btn">🔄 Thử tải lại</button>' +
        '<a class="mv-motchill-btn" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">🎬 Xem trên MotChill</a>' +
      '</div>'
    );
    var retryBtn = $('btnMvRetryStream');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        if (!state.activeMovie || state.activeMovie.id !== movie.id) return;
        delete streamCache[movie.id];
        loadAndPlayActiveMovie(true);
      });
    }
  }

  function formatEpisodeLabel(rawName) {
    var s = String(rawName || '').trim();
    if (!s) return 'Tập 1';
    if (/^\d+$/.test(s)) return 'Tập ' + s;
    return s;
  }

  function playResolvedEpisode(movie, servers, autoPlay) {
    if (!movie || !state.activeMovie || state.activeMovie.id !== movie.id) return;
    var ms = getMovieState(movie.id);
    var video = $('mvVideoElement');
    var iframe = $('mvEmbedFrame');
    if (!servers || !servers.length) {
      showUnavailableStatus(movie, ms.ep, 'Phim này hiện chưa có nguồn phát trực tuyến trên server công khai. Bạn có thể mở trực tiếp trên MotChill để xem.');
      return;
    }

    var srvIdx = ms.serverIdx !== null ? ms.serverIdx : 0;
    if (srvIdx >= servers.length || srvIdx < 0) srvIdx = 0;
    setMovieServer(movie.id, srvIdx);

    var server = servers[srvIdx];
    var epIdx = Math.max(0, Math.min(ms.ep - 1, server.server_data.length - 1));
    if (ms.ep !== epIdx + 1) {
      setMovieEpisode(movie.id, epIdx + 1);
      renderPlayerMetaAndControls(servers);
    }
    var epObj = server.server_data[epIdx];
    if (!epObj) {
      showUnavailableStatus(movie, ms.ep, 'Không tìm thấy dữ liệu cho tập phim này.');
      return;
    }

    var useHls = ms.playMode === 'hls' && !!epObj.link_m3u8;
    if (!useHls && !epObj.link_embed && epObj.link_m3u8) useHls = true;

    stopPlayback();
    setStageStatus(null);
    var playToken = activeLoadToken;

    if (useHls && video) {
      if (iframe) iframe.hidden = true;
      video.hidden = false;
      video.poster = movie.posterUrl || '';

      if (window.Hls && window.Hls.isSupported()) {
        var recoveredMedia = false;
        hlsInstance = new window.Hls({ enableWorker: true, lowLatencyMode: false });
        hlsInstance.loadSource(epObj.link_m3u8);
        hlsInstance.attachMedia(video);
        hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
          if (playToken !== activeLoadToken || !state.activeMovie || state.activeMovie.id !== movie.id) return;
          if (autoPlay) video.play().catch(function () {});
        });
        hlsInstance.on(window.Hls.Events.ERROR, function (_evt, data) {
          if (playToken !== activeLoadToken || !state.activeMovie || state.activeMovie.id !== movie.id || !data || !data.fatal) return;
          if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && !recoveredMedia && hlsInstance) {
            recoveredMedia = true;
            try {
              hlsInstance.recoverMediaError();
              return;
            } catch (e) {}
          }
          if (hlsInstance) {
            try { hlsInstance.destroy(); } catch (e) {}
            hlsInstance = null;
          }
          if (epObj.link_embed) {
            setMoviePlayMode(movie.id, 'embed');
            renderPlayerMetaAndControls(servers);
            playResolvedEpisode(movie, servers, autoPlay);
          } else {
            showUnavailableStatus(movie, ms.ep, 'Luồng HLS bị chặn hoặc gián đoạn. Vui lòng thử lại hoặc xem trên MotChill.');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = epObj.link_m3u8;
        video.load();
        if (autoPlay) video.play().catch(function () {});
      } else if (epObj.link_embed && iframe) {
        video.hidden = true;
        iframe.hidden = false;
        iframe.src = epObj.link_embed;
      } else {
        showUnavailableStatus(movie, ms.ep, 'Trình duyệt chưa hỗ trợ phát trực tiếp định dạng HLS của phim này.');
      }
    } else if (epObj.link_embed && iframe) {
      if (video) video.hidden = true;
      iframe.hidden = false;
      iframe.src = epObj.link_embed;
    } else {
      showUnavailableStatus(movie, ms.ep, 'Tập phim chưa có link phát khả dụng.');
    }
  }

  function renderPlayerMetaAndControls(servers) {
    var m = state.activeMovie;
    if (!m) return;
    var ms = getMovieState(m.id);
    var activeSrvIdx = ms.serverIdx !== null ? ms.serverIdx : 0;

    if ($('mvPlayerTitle')) $('mvPlayerTitle').textContent = m.title + ' (' + m.originalTitle + ')';
    if ($('mvPlayerMeta')) $('mvPlayerMeta').textContent = m.category + ' • ' + m.country + ' • ' + m.year + ' • ⭐ ' + m.rating + ' • ' + m.badge;
    if ($('mvPlayerDesc')) $('mvPlayerDesc').textContent = m.shortDescription;

    var activeSrv = servers && servers[activeSrvIdx] ? servers[activeSrvIdx] : null;
    var totalEps = activeSrv ? activeSrv.server_data.length : m.episodes;
    var clampedEp = activeSrv ? Math.max(1, Math.min(ms.ep, activeSrv.server_data.length)) : Math.max(1, Math.min(ms.ep, Math.max(1, m.episodes)));
    var activeEpObj = activeSrv && activeSrv.server_data[clampedEp - 1];
    var epLabel = activeEpObj ? formatEpisodeLabel(activeEpObj.name) : ('Tập ' + clampedEp);

    if ($('mvNowPlayingEp')) {
      $('mvNowPlayingEp').textContent = totalEps > 1 ? (epLabel + ' / ' + totalEps) : (/^full$/i.test(String(activeEpObj ? activeEpObj.name : '').trim()) ? 'Bản Full HD' : epLabel);
    }

    var motchillLink = $('btnMvOpenMotchill');
    if (motchillLink) {
      motchillLink.href = getMotchillUrl(m, clampedEp);
      motchillLink.textContent = totalEps > 1 ? ('🎬 Xem Full Tập ' + clampedEp + ' trên MotChill') : '🎬 Xem Bản Full trên MotChill';
    }

    var saveBtn = $('btnMvPlayerSave');
    if (saveBtn) {
      var saved = isSavedMovie(m.id);
      saveBtn.textContent = saved ? '❤️ Đã Lưu Phim' : '🤍 Lưu Phim';
      saveBtn.classList.toggle('saved', saved);
    }

    var srvRow = document.querySelector('.mv-server-row');
    if (srvRow) {
      if (servers && servers.length) {
        var srvHtml = '<span>📡 Server phát:</span>';
        servers.forEach(function (srv, idx) {
          srvHtml += '<button type="button" class="mv-server-btn' + (idx === activeSrvIdx ? ' active' : '') + '" data-srv-idx="' + idx + '">' + escHtml(srv.server_name) + '</button>';
        });
        if (activeEpObj && activeEpObj.link_m3u8 && activeEpObj.link_embed) {
          srvHtml += '<button type="button" id="btnMvToggleMode" class="mv-mode-btn">' +
            (ms.playMode === 'hls' ? '🛡️ Chế độ: HLS Sạch (Đổi sang Embed)' : '🖥️ Chế độ: Embed (Đổi sang HLS Sạch)') +
          '</button>';
        }
        srvRow.innerHTML = srvHtml;
        srvRow.querySelectorAll('[data-srv-idx]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!state.activeMovie || state.activeMovie.id !== m.id) return;
            setMovieServer(m.id, parseInt(btn.getAttribute('data-srv-idx'), 10) || 0);
            renderPlayerMetaAndControls(servers);
            playResolvedEpisode(m, servers, true);
          });
        });
        var modeBtn = $('btnMvToggleMode');
        if (modeBtn) {
          modeBtn.addEventListener('click', function () {
            if (!state.activeMovie || state.activeMovie.id !== m.id) return;
            var curMs = getMovieState(m.id);
            setMoviePlayMode(m.id, curMs.playMode === 'hls' ? 'embed' : 'hls');
            renderPlayerMetaAndControls(servers);
            playResolvedEpisode(m, servers, true);
          });
        }
      } else if (servers === null) {
        srvRow.innerHTML = '<span>📡 Server phát:</span><button type="button" class="mv-server-btn active">Đang kết nối...</button>';
      } else {
        srvRow.innerHTML = '<span>📡 Server phát:</span><button type="button" class="mv-server-btn">Chưa có server khả dụng</button>';
      }
    }

    var epWrap = $('mvEpisodesList');
    if (epWrap) {
      if (activeSrv && activeSrv.server_data.length) {
        epWrap.innerHTML = activeSrv.server_data.map(function (ep, idx) {
          var epNum = idx + 1;
          var label = formatEpisodeLabel(ep.name);
          return '<button type="button" class="mv-ep-btn' + (epNum === clampedEp ? ' active' : '') + '" data-ep="' + epNum + '">' + escHtml(label) + '</button>';
        }).join('');
        epWrap.querySelectorAll('[data-ep]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!state.activeMovie || state.activeMovie.id !== m.id) return;
            setMovieEpisode(m.id, parseInt(btn.getAttribute('data-ep'), 10) || 1);
            renderPlayerMetaAndControls(servers);
            playResolvedEpisode(m, servers, true);
          });
        });
      } else if (servers === null) {
        if (m.episodes <= 1) {
          epWrap.innerHTML = '<button type="button" class="mv-ep-btn active">Full HD</button>';
        } else {
          var html = '';
          for (var i = 1; i <= m.episodes; i++) {
            html += '<button type="button" class="mv-ep-btn' + (i === clampedEp ? ' active' : '') + '" data-ep="' + i + '">Tập ' + i + '</button>';
          }
          epWrap.innerHTML = html;
          epWrap.querySelectorAll('[data-ep]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              if (!state.activeMovie || state.activeMovie.id !== m.id) return;
              var nextEp = setMovieEpisode(m.id, parseInt(btn.getAttribute('data-ep'), 10) || 1);
              epWrap.querySelectorAll('[data-ep]').forEach(function (b) {
                b.classList.toggle('active', b === btn);
              });
              if ($('mvNowPlayingEp')) {
                $('mvNowPlayingEp').textContent = 'Tập ' + nextEp + ' / ' + m.episodes;
              }
              if (motchillLink) {
                motchillLink.href = getMotchillUrl(m, nextEp);
                motchillLink.textContent = '🎬 Xem Full Tập ' + nextEp + ' trên MotChill';
              }
            });
          });
        }
      } else {
        epWrap.innerHTML = '<div class="mv-cmt-empty">Chưa có danh sách tập khả dụng. Bạn có thể bấm "Thử tải lại" hoặc mở trên MotChill.</div>';
      }
    }

    renderMovieComments();
  }

  function loadAndPlayActiveMovie(autoPlay) {
    var m = state.activeMovie;
    if (!m) return;
    var token = ++activeLoadToken;
    var ms = getMovieState(m.id);
    state.activeEpisode = ms.ep;
    state.playMode = ms.playMode || 'hls';
    var cached = streamCache[m.id];

    if (cached && cached.length) {
      var srvIdx = (ms.serverIdx !== null && ms.serverIdx < cached.length)
        ? ms.serverIdx
        : pickPreferredServerIdx(cached, ms.ep);
      setMovieServer(m.id, srvIdx);
      renderPlayerMetaAndControls(cached);
      playResolvedEpisode(m, cached, autoPlay);
      return;
    }

    state.activeServerIdx = ms.serverIdx !== null ? ms.serverIdx : 0;
    renderPlayerMetaAndControls(null);
    stopPlayback();
    var video = $('mvVideoElement');
    if (video) {
      video.hidden = false;
      video.poster = m.posterUrl || '';
    }
    setStageStatus('<div style="font-size:1.8rem;">⏳</div><p>Đang tải nguồn phim <strong>' + escHtml(m.title) + '</strong> (sạch 100%, không quảng cáo cá độ)...</p>');

    fetchMovieStreams(m).then(function (servers) {
      if (token !== activeLoadToken || !state.activeMovie || state.activeMovie.id !== m.id) return;
      var curMs = getMovieState(m.id);
      var srvIdx = (curMs.serverIdx !== null && curMs.serverIdx < servers.length)
        ? curMs.serverIdx
        : pickPreferredServerIdx(servers, curMs.ep);
      setMovieServer(m.id, srvIdx);
      renderPlayerMetaAndControls(servers);
      playResolvedEpisode(m, servers, autoPlay);
    }).catch(function () {
      if (token !== activeLoadToken || !state.activeMovie || state.activeMovie.id !== m.id) return;
      var curMs = getMovieState(m.id);
      renderPlayerMetaAndControls([]);
      showUnavailableStatus(m, curMs.ep, 'Không thể kết nối tới nguồn phim tự động. Bạn có thể thử lại hoặc mở trực tiếp trên MotChill.');
    });
  }

  function openPlayer(movie, epNum) {
    if (!movie) return;
    activeLoadToken++;
    stopPlayback();
    setStageStatus(null);

    state.activeMovie = movie;
    var ms = getMovieState(movie.id);
    if (epNum !== undefined && epNum !== null) {
      ms.ep = Math.max(1, parseInt(epNum, 10) || 1);
    }
    recordHistory(movie.id, ms.ep);

    state.activeEpisode = ms.ep;
    state.activeServerIdx = ms.serverIdx !== null ? ms.serverIdx : 0;
    state.playMode = ms.playMode || 'hls';

    if ($('moviesCatalogView')) $('moviesCatalogView').hidden = true;
    if ($('moviesPlayerView')) $('moviesPlayerView').hidden = false;

    loadAndPlayActiveMovie(true);
  }

  function renderMovieComments() {
    var m = state.activeMovie;
    var box = $('mvCommentsList');
    if (!m || !box) return;
    var list = getCommentsMap()[m.id] || [];
    if (!list.length) {
      box.innerHTML = '<div class="mv-cmt-empty">Chưa có bình luận nào. Hãy chia sẻ cảm nhận của bạn về bộ phim này!</div>';
      return;
    }
    box.innerHTML = list.map(function (c) {
      return '<div class="mv-cmt-item"><strong>' + escHtml(c.author) + '</strong> <span>(' + escHtml(c.time) + ')</span><p>' + escHtml(c.text) + '</p></div>';
    }).join('');
  }

  function resetPlayerUI() {
    if ($('mvPlayerTitle')) $('mvPlayerTitle').textContent = 'Tên Phim';
    if ($('mvPlayerMeta')) $('mvPlayerMeta').textContent = '';
    if ($('mvPlayerDesc')) $('mvPlayerDesc').textContent = '';
    if ($('mvNowPlayingEp')) $('mvNowPlayingEp').textContent = 'Full HD';
    if ($('mvEpisodesList')) $('mvEpisodesList').innerHTML = '';
    if ($('mvCommentsList')) $('mvCommentsList').innerHTML = '';
    var srvRow = document.querySelector('.mv-server-row');
    if (srvRow) srvRow.innerHTML = '';
  }

  function closePlayerToCatalog() {
    activeLoadToken++;
    stopPlayback();
    setStageStatus(null);
    state.activeMovie = null;
    state.activeEpisode = 1;
    state.activeServerIdx = 0;
    state.playMode = 'hls';
    resetPlayerUI();
    if ($('moviesPlayerView')) $('moviesPlayerView').hidden = true;
    if ($('moviesCatalogView')) $('moviesCatalogView').hidden = false;
    renderMovieGrid();
  }

  function initMoviesModal() {
    var modal = $('moviesModal');
    var btnOpen = $('btnOpenMoviesHero');
    var btnClose = $('btnCloseMoviesModal');
    if (!modal || !btnOpen) return;

    btnOpen.addEventListener('click', function () {
      modal.classList.add('open');
      closePlayerToCatalog();
    });
    btnClose?.addEventListener('click', function () {
      closePlayerToCatalog();
      modal.classList.remove('open');
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closePlayerToCatalog();
        modal.classList.remove('open');
      }
    });

    document.querySelectorAll('.mv-cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.category = tab.getAttribute('data-mv-cat');
        document.querySelectorAll('.mv-cat-tab').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        renderMovieGrid();
      });
    });

    $('mvCountryFilter')?.addEventListener('change', function (e) {
      state.country = e.target.value;
      renderMovieGrid();
    });

    $('mvSearchInput')?.addEventListener('input', function (e) {
      state.search = e.target.value;
      renderMovieGrid();
    });

    $('btnMvBackCatalog')?.addEventListener('click', closePlayerToCatalog);

    $('btnMvPlayerSave')?.addEventListener('click', function () {
      if (!state.activeMovie) return;
      toggleWatchlist(state.activeMovie.id);
      renderPlayerMetaAndControls(streamCache[state.activeMovie.id] || null);
    });

    $('btnMvTheaterLights')?.addEventListener('click', function () {
      state.theaterDark = !state.theaterDark;
      modal.querySelector('.mv-modal-container')?.classList.toggle('theater-dark', state.theaterDark);
      $('btnMvTheaterLights').textContent = state.theaterDark ? '💡 Bật đèn' : '🌙 Tắt đèn rạp';
    });

    function submitMovieComment() {
      if (!state.activeMovie) return;
      var inp = $('mvCmtInput');
      var txt = (inp && inp.value || '').trim();
      if (!txt) return;
      addMovieComment(state.activeMovie.id, txt);
      inp.value = '';
      renderMovieComments();
    }

    $('btnMvCmtSend')?.addEventListener('click', submitMovieComment);
    $('mvCmtInput')?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitMovieComment();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initMoviesModal);
})();
