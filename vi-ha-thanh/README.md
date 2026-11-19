# HÀ NỘI PHỐ VỊ - CẨM NANG ẨM THỰC CỔ ĐIỂN HÀ NỘI

> **"Miếng ngon Hà Nội không chỉ làm no cái bụng, mà còn đánh thức cả một trời ký ức thanh tao"**  
> Tuyển tập **102 nhà hàng & quán ăn đặc sản Hà Nội** (đặc biệt mở rộng khu vực Hà Đông với 17 quán phong phú và phủ khắp 12 quận thủ đô) kèm định vị Google Maps, bộ lọc thông minh 4 chiều, phân trang chống cuộn sâu và vòng quay may mắn chọn món ngẫu nhiên.

---

## 🌟 TỔNG QUAN DỰ ÁN & TRIẾT LÝ THIẾT KẾ UI/UX

Trang web **Hà Nội Phố Vị** được thiết kế bởi chuyên gia UI/UX nhằm giải quyết bài toán muôn thuở: *"Hôm nay ăn gì?", "Đi với người yêu thì ăn ở đâu?", "Tụ tập nhóm bạn 6 người quanh Hà Đông hoặc Cầu Giấy thì quán nào ngon?"*.

### 🎨 1. Phong Cách Thiết Kế: Đông Dương Hoài Niệm (Indochine & Phố Cổ)
- **Bảng màu truyền thống Tràng An:**
  - Nền giấy dó / kem trứng cổ điển (`#F7F3EA`, `#EDE6D6`).
  - Đỏ son sơn mài (`#9A2626` / `#7A1D1D`) tạo điểm nhấn quyền quý và kích thích vị giác.
  - Vàng hoàng yến / nghệ nướng (`#C28725`) tôn vinh nét đẹp ẩm thực dân gian.
  - Xanh rêu hồ Gươm (`#2E4B3E`) tạo cảm giác thư thái, trầm ấm.
- **Nghệ thuật chữ (Typography):**
  - Font tiêu đề: **Cormorant Garamond** & **Playfair Display** (Serif cổ điển, thanh lịch).
  - Font nội dung: **Be Vietnam Pro** (sắc nét, chuẩn hiển thị tiếng Việt trên mọi thiết bị).
- **Họa tiết & Chi tiết tinh xảo:** Khung viền tem thư hoài niệm, dấu mộc son cổ truyền, hiệu ứng noise giấy xưa, âm thanh gõ lách cách mộc mạc qua Web Audio API.

### 📄 2. Giải Pháp Chống Mỏi Cuộn (Scroll Fatigue) & Chia Nhỏ Trang
Khi kho dữ liệu mở rộng lên **102 quán ăn**, việc hiển thị tất cả trên một trang duy nhất gây ra hiện tượng cuộn quá sâu (*infinite scroll fatigue*). Hệ thống đã được nâng cấp toàn diện:
- **Bộ phân trang tương tác (Smart Pagination):**
  - Tùy chọn số lượng hiển thị linh hoạt: **9 quán/trang** (lưới 3x3 cân đối, tối ưu tầm mắt), **12 quán/trang**, **18 quán/trang** hoặc **Xem tất cả**.
  - Các nút điều hướng nhanh: `« Đầu`, `‹ Trước`, danh sách số trang rút gọn với dấu ba chấm thông minh `...`, `Sau ›`, `Cuối »`.
  - Ô nhảy trang trực tiếp (*Go to page input*) giúp chuyển đến trang mong muốn tức thì.
  - Tự động cuộn mượt (*smooth scroll*) về đầu danh sách mỗi khi chuyển trang hoặc đổi bộ lọc.
- **Thanh lọc quận phân tầng (District Quick Tabs Strip):**
  - Đặt ngay trên danh sách quán với đầy đủ 12 quận và huy hiệu đếm số lượng quán thực tế.
  - Cho phép người dùng chuyển nhanh giữa các quận (Hà Đông, Hoàn Kiếm, Ba Đình, Cầu Giấy, Đống Đa...) chỉ với một click.
- **Nút nổi cuộn nhanh lên đầu trang (Floating Back to Top):**
  - Tự động xuất hiện khi người dùng cuộn xuống quá 380px, nhấn vào sẽ đưa màn hình lướt êm ái về đầu trang.

### 📖 3. Khắc Phục Hoàn Toàn Giới Hạn Đọc Mô Tả Quán
- **Trong Cửa Sổ Chi Tiết (Detail Modal):** Bổ sung thanh cuộn dọc cổ điển tự nhiên (`overflow-y: auto; max-height: 92vh`), cố định nút đóng `X` ở góc trên, giúp người dùng thoải mái đọc hết phần mô tả dài, thực đơn đinh, địa chỉ và toàn bộ mẹo sành ăn mà không bị cắt ngắn.
- **Ngay Trên Thẻ Quán (Card In-Place Drawer):** Bổ sung nút **`[📖 Đọc thêm mô tả quán ▾]`**, bấm vào sẽ mở rộng đoạn văn bản mô tả và hộp mẹo ăn ngon ngay tại thẻ mà không cần mở modal.

---

## 🚀 TÍNH NĂNG NỔI BẬT

### 1. 🧭 Tích Hợp Google Maps Trực Tiếp 100%
- Toàn bộ **102 quán ăn** đều có địa chỉ thực tế, giờ mở cửa, số lượt đánh giá và xếp hạng sao Google Maps thực tế (tất cả đều từ **4.0★ đến 4.8★**).
- Mỗi thẻ quán và cửa sổ chi tiết đều có nút **"🧭 Google Maps"** mở đường dẫn tìm kiếm & chỉ đường trực tiếp tới quán trên ứng dụng bản đồ Google Maps.
- Nút **"📋 Sao chép địa chỉ"** giúp thực khách copy địa chỉ trong 1 chạm để gọi xe (Grab, Be, Xanh SM) dễ dàng.

### 2. 🎲 Mục Chọn Món Ngẫu Nhiên ("Vòng Quay Ẩm Thực Phố Cổ")
- **Vòng quay Canvas tương tác mượt mà:**
  - Cơ chế quay với thuật toán giảm tốc vật lý (Cubic Deceleration) chân thực.
  - Hiệu ứng âm thanh cơ học (Tick Sound) giả lập tiếng bánh răng quay bằng **Web Audio API**.
  - Hiệu ứng pháo hoa giấy (Confetti) bùng nổ chúc mừng khi chọn được quán ăn định mệnh.
  - Tùy chọn: *Quay trong danh sách đã lọc* hoặc *Quay ngẫu nhiên toàn bộ 102 quán*.
- **Tung Xúc Xắc May Mắn (1-Click Random Pick):** Dành cho những ai đang vội đói bụng, chỉ cần bấm 1 chạm là hệ thống mở ngay quán ăn ngẫu nhiên chuẩn vị kèm mẹo ăn ngon.

### 3. 🎯 Bộ Lọc Đa Chiều Thông Minh (4 Chiều)
1. **Giá thành (Mỗi người):**
   - Bình dân (< 50k) - Sinh viên, quà vặt vỉa hè
   - Phổ thông (50k - 150k) - Cơm trưa, bún phở gia truyền
   - Tầm trung (150k - 350k) - Lẩu nướng, hẹn hò, tiệc ấm cúng
   - Sang trọng (> 350k) - Fine dining, ẩm thực di sản
2. **Số lượng người tham gia:**
   - 1 người (Độc hành / Ăn nhanh)
   - 2 người (Hẹn hò / Tâm sự đôi bạn)
   - 3 - 5 người (Nhóm bạn bè, đồng nghiệp)
   - 6 - 10+ người (Gia đình, liên hoan đoàn đông)
3. **Địa điểm (12 Quận phủ khắp Hà Nội):**
   - Hà Đông (17 quán - Khu vực trọng tâm: Văn Quán, Vạn Phúc, Tô Hiệu, Văn Phú...)
   - Hoàn Kiếm (37 quán - Phố Cổ, Bờ Hồ)
   - Ba Đình (9 quán - Trúc Bạch, Giảng Võ, Quán Thánh)
   - Cầu Giấy (7 quán - Nghĩa Tân, Dịch Vọng Hậu)
   - Thanh Xuân (5 quán - Nguyễn Trãi, Nguyễn Tuân, Khuất Duy Tiến)
   - Đống Đa (5 quán - Văn Miếu, Thái Thịnh, Phạm Ngọc Thạch)
   - Long Biên (4 quán - Ngọc Lâm, Bồ Đề, Nguyễn Văn Cừ)
   - Nam Từ Liêm (4 quán - Mỹ Đình, Mễ Trì, Đỗ Đức Dục)
   - Hai Bà Trưng (4 quán - Lò Đúc, Triệu Việt Vương, Lê Văn Hưu)
   - Tây Hồ (4 quán - Phủ Tây Hồ, Quảng An, Lạc Long Quân)
   - Bắc Từ Liêm (3 quán - Hoàng Quốc Việt, Cổ Nhuế, Xuân Đỉnh)
   - Hoàng Mai (3 quán - Bán đảo Linh Đàm, Trương Định, Giải Phóng)
4. **Sự kiện quan trọng / Dịp đi ăn:**
   - 🌅 Ăn sáng đầu ngày
   - 💼 Bữa trưa công sở
   - 🌹 Hẹn hò lãng mạn
   - 🍻 Họp mặt bạn bè / Nhậu lai rai
   - 🏡 Sum họp gia đình
   - 🎩 Tiếp khách / Đối tác sang trọng
   - 🌙 Ăn đêm / Quà vặt phố cổ

### 4. ❤️ Sổ Tay Quán Quen (Bookmarks)
- Lưu quán yêu thích bằng nút trái tim trên mỗi thẻ, dữ liệu được ghi nhớ bền vững qua `localStorage`.
- Xem nhanh các quán quen chỉ với 1 click vào thẻ "Quán đã lưu" hoặc nút "Sổ Tay Quán Quen" trên đầu trang.

---

## 📂 DANH MỤC 102 QUÁN ĂN ĐẶC SẮC

| STT | Tên Quán / Nhà Hàng | Món Đặc Trưng | Địa Chỉ (Google Maps) | Mức Giá | Quận |
|:---:|:---|:---|:---|:---:|:---|
| 1 | Phở Gia Truyền Bát Đàn | Phở bò tái lăn ngập hành | 49 Bát Đàn, Hoàn Kiếm | 55k - 70k | Hoàn Kiếm |
| 2 | Phở 10 Lý Quốc Sư | Phở bò tái nạm gầu giòn | 10 Lý Quốc Sư, Hoàn Kiếm | 70k - 120k | Hoàn Kiếm |
| 3 | Phở Thìn Lò Đúc | Phở tái lăn xào tỏi ngập hành | 13 Lò Đúc, Hai Bà Trưng | 80k - 100k | Hai Bà Trưng |
| 4 | Phở Gà Nguyệt | Phở gà trộn trứng non (Michelin Bib) | 5 Phủ Doãn, Hoàn Kiếm | 50k - 90k | Hoàn Kiếm |
| 5 | Bún Chả Đắc Kim | Chả quạt than hoa, nem cua bể | 1 Hàng Mành, Hoàn Kiếm | 70k - 110k | Hoàn Kiếm |
| 6 | Bún Chả Ta | Bún chả hoài cổ (Michelin Bib) | 21 Nguyễn Hữu Huân, Hoàn Kiếm | 60k - 100k | Hoàn Kiếm |
| 7 | Bún Chả Hương Liên (Obama) | Bún chả tiếp đón Tổng thống | 24 Lê Văn Hưu, Hai Bà Trưng | 50k - 85k | Hai Bà Trưng |
| 8 | Chả Cá Thăng Long | Chả cá lăng chảo gang (Michelin) | 6B Đường Thành, Hoàn Kiếm | 160k - 220k | Hoàn Kiếm |
| 9 | Chả Cá Lã Vọng | Chả cá lịch sử từ 1871 | 14 Chả Cá, Hoàn Kiếm | 180k - 250k | Hoàn Kiếm |
| 10 | Nhà Hàng Tầm Vị | Cơm Bắc nhà gỗ (1 Sao Michelin) | 4B Yên Thế, Đống Đa | 200k - 450k | Đống Đa |
| 11 | Cửa Hàng Ăn Uống Mậu Dịch Số 37 | Dưa chua tóp mỡ thời bao cấp | 37 Nam Tràng, Ba Đình | 80k - 180k | Ba Đình |
| 12 | Quán Ăn Ngon | Biệt thự Pháp cổ ẩm thực 3 miền | 18 Phan Bội Châu, Hoàn Kiếm | 120k - 250k | Hoàn Kiếm |
| 13 | Bếp Quán | Ẩm thực Việt đương đại Indochine | 38 Hàm Long, Hoàn Kiếm | 180k - 320k | Hoàn Kiếm |
| 14 | Ưu Đàm Chay | Ẩm thực chay thanh tịnh (Michelin) | 34 Hàng Bài, Hoàn Kiếm | 200k - 450k | Hoàn Kiếm |
| 15 | Gia Restaurant | Fine Dining di sản (1 Sao Michelin) | 61 Văn Miếu, Đống Đa | 1.500k - 2.800k | Đống Đa |
| 16 | Home Hanoi Restaurant | Biệt thự Pháp cổ thập niên 1930 | 34 Châu Long, Ba Đình | 350k - 800k | Ba Đình |
| 17 | Cầu Gỗ Restaurant | Món Việt view triệu đô ngắm Bờ Hồ | 7 Đinh Tiên Hoàng, Hoàn Kiếm | 300k - 650k | Hoàn Kiếm |
| 18 | Bò Tơ Quán Mộc | Bò tơ cuốn bánh tráng retro 1980 | 102 Thái Thịnh, Đống Đa | 180k - 280k | Đống Đa |
| 19 | Lẩu Ếch Ngân Béo | Lẩu ếch măng cay hồ Trúc Bạch | 43 Trúc Bạch, Ba Đình | 130k - 220k | Ba Đình |
| 20 | Lẩu Riêu Cua Phó Đức Chính | Lẩu riêu dấm bỗng sườn sụn bắp bò | 66 Phó Đức Chính, Ba Đình | 120k - 200k | Ba Đình |
| 21 | Quán Nhậu Tự Do | Bia hơi & mồi nhậu sân vườn thoáng | 67A Phó Đức Chính, Ba Đình | 150k - 300k | Ba Đình |
| 22 | Pao Quán | Mẹt gà nướng xôi nương Tây Bắc | Ngõ 62 Trần Thái Tông, Cầu Giấy | 160k - 260k | Cầu Giấy |
| 23 | Trâu Ngon Quán | Thịt trâu tươi 108 món đại sảnh | KĐT An Hưng, Hà Đông | 180k - 300k | Hà Đông |
| 24 | Nhà Hàng Sen Tây Hồ | Buffet đình làng Bắc Bộ 150 món | 614 Lạc Long Quân, Tây Hồ | 320k - 480k | Tây Hồ |
| 25 | Bánh Tôm Hồ Tây | Bánh tôm giòn ngắm ráng chiều | Số 1 Thanh Niên, Tây Hồ | 80k - 150k | Tây Hồ |
| 26 | Bún Đậu Ngõ Tràng Tiền | Bún đậu chả cốm lòng non giòn | Số 2 Ngõ Tràng Tiền, Hoàn Kiếm | 35k - 65k | Hoàn Kiếm |
| 27 | Bún Đậu Cô Tuyến Hàng Khay | Bún đậu dồi rán giòn ngõ Bờ Hồ | 31 Ngõ Hàng Khay, Hoàn Kiếm | 40k - 70k | Hoàn Kiếm |
| 28 | Ngan Cháy Tỏi Thủy Bông | Ngan cháy tỏi phi vàng giòn rụm | 51 Hàng Thiếc, Hoàn Kiếm | 80k - 160k | Hoàn Kiếm |
| 29 | Bún Ngan Nhàn | Bún ngan nước dùng ngọt từ xương | 14 Ngõ Trung Yên, Hoàn Kiếm | 50k - 90k | Hoàn Kiếm |
| 30 | Bún Thang Bà Đức | Bún thang thanh tao đất Tràng An | 48 Cầu Gỗ, Hoàn Kiếm | 45k - 70k | Hoàn Kiếm |
| 31 | Bún Ốc Cô Huệ | Bún ốc nguội giấm bỗng gia truyền | 43 Nguyễn Siêu, Hoàn Kiếm | 35k - 60k | Hoàn Kiếm |
| 32 | Bún Ốc Giang | Bún ốc nóng vỉa hè phố Tạ Hiện | 36 Lương Ngọc Quyến, Hoàn Kiếm | 40k - 65k | Hoàn Kiếm |
| 33 | Bánh Cuốn Bà Xuân | Bánh cuốn tráng tay nóng hổi | 16 Dốc Hòe Nhai, Ba Đình | 35k - 55k | Ba Đình |
| 34 | Phở Cuốn Hương Mai | Phở cuốn, phở chiên phồng Ngũ Xã | 25 Ngũ Xã, Ba Đình | 60k - 120k | Ba Đình |
| 35 | Phở Cuốn Chinh Thắng | Địa chỉ gốc phở cuốn Ngũ Xã | 48 Mạc Đĩnh Chi, Ba Đình | 60k - 110k | Ba Đình |
| 36 | Miến Lươn Đông Thịnh | Miến lươn giòn nước dùng ngọt lịm | 87 Hàng Điếu, Hoàn Kiếm | 45k - 75k | Hoàn Kiếm |
| 37 | Xôi Yến | Xôi xéo gà xào nấm thịt kho trứng | 35B Nguyễn Hữu Huân, Hoàn Kiếm | 40k - 80k | Hoàn Kiếm |
| 38 | Bánh Mì 25 | Bánh mì xá xíu pate phố cổ | 25 Hàng Cá, Hoàn Kiếm | 30k - 50k | Hoàn Kiếm |
| 39 | Bánh Mì Dân Tổ | Bánh mì nhân xào ăn đêm 3h sáng | Cao Thắng - Trần Nhật Duật | 25k - 40k | Hoàn Kiếm |
| 40 | Cơm Sườn Đào Duy Từ | Cơm đảo sườn nướng than hoa | 47 Đào Duy Từ, Hoàn Kiếm | 50k - 85k | Hoàn Kiếm |
| 41 | Cơm Rang Dưa Bò Mã Mây | Cơm rang giòn bò xào dưa chua | Số 8 Mã Mây, Hoàn Kiếm | 50k - 80k | Hoàn Kiếm |
| 42 | Bánh Đúc Nóng Trung Tự | Bánh đúc dẻo thịt mộc nhĩ hành phi | C2 TT Trung Tự, Đống Đa | 25k - 40k | Đống Đa |
| 43 | Bánh Gối Gốc Đa | Bánh gối giòn rụm bên Nhà Thờ Lớn | 52 Lý Quốc Sư, Hoàn Kiếm | 20k - 50k | Hoàn Kiếm |
| 44 | Nộm Bò Khô Long Vi Dung | Nộm phố ngắn nhất Hà Nội (52m) | 23 Hồ Hoàn Kiếm, Hoàn Kiếm | 35k - 65k | Hoàn Kiếm |
| 45 | Ốc Hà Trang | Ốc luộc nước chấm gừng xả đệ nhất | 1 Đinh Liệt, Hoàn Kiếm | 50k - 110k | Hoàn Kiếm |
| 46 | Cà Phê Giảng | Cà phê trứng gia truyền từ 1946 | 39 Nguyễn Hữu Huân, Hoàn Kiếm | 30k - 50k | Hoàn Kiếm |
| 47 | Chè Bốn Mùa | Chè sen long nhãn thanh tao | 4 Hàng Cân, Hoàn Kiếm | 20k - 40k | Hoàn Kiếm |
| 48 | Mỳ Vằn Thắn Bình Tây | Sợi mỳ trứng tươi, sủi cảo tôm thịt | 54 Hàng Chiếu, Hoàn Kiếm | 45k - 65k | Hoàn Kiếm |
| 49 | Lòng Rán Nhất Quán | Lòng non rán giòn mắm tôm đêm phố | 23 Nguyễn Siêu, Hoàn Kiếm | 80k - 160k | Hoàn Kiếm |
| 50 | Cơm Niêu Kombo | Cơm niêu cháy 2 mặt bò tiêu đen | 60 Lê Văn Hưu, Hai Bà Trưng | 80k - 150k | Hai Bà Trưng |
| 51 | Bún Riêu Cua Hàng Bạc | Nước riêu dấm bỗng cua đồng béo ngậy | 11 Hàng Bạc, Hoàn Kiếm | 35k - 60k | Hoàn Kiếm |
| 52 | Luk Lak Restaurant | Tinh hoa bếp trưởng Madame Bình | 4A Lê Thánh Tông, Hoàn Kiếm | 250k - 550k | Hoàn Kiếm |
| 53 | Nem Chua Rán Tạm Thương | Nem chua rán khay lá chuối ngõ cổ | Ngõ Tạm Thương, Hoàn Kiếm | 30k - 65k | Hoàn Kiếm |
| 54 | Chim Quay Ánh Tuyết | Nghệ nhân ẩm thực đãi khách APEC | 25 Mã Mây, Hoàn Kiếm | 200k - 450k | Hoàn Kiếm |
| 55 | Bò Tơ Quán Mộc Văn Phú | Bò tơ cuốn bánh tráng retro 1980 | BT8 KĐT Văn Phú, Hà Đông | 180k - 280k | Hà Đông |
| 56 | Bánh Mì Chảo 2 Chị Em | Bánh mì chảo sốt bơ tỏi bò trứng | 135 Vạn Phúc, Hà Đông | 30k - 55k | Hà Đông |
| 57 | Lẩu Nấm Gia Khánh | Lẩu nấm chim câu tiến vua dưỡng sinh | Số 5 Vũ Trọng Khánh, Hà Đông | 190k - 350k | Hà Đông |
| 58 | Nhà Hàng Mâm Việt | Mâm cơm đồng quê Bắc Bộ thuần khiết | 58 Đường 19/5, Văn Quán, Hà Đông | 120k - 240k | Hà Đông |
| 59 | Biệt Thự Ốc Hồ Văn Quán | Hải sản & ốc tươi sốt trứng muối | 20B Hồ Văn Quán, Hà Đông | 60k - 150k | Hà Đông |
| 60 | Chả Cá Lão Ngư Tô Hiệu | Chả cá lăng nghệ tươi mắm tôm nồng | Số 2 Tô Hiệu, Quang Trung, Hà Đông | 140k - 210k | Hà Đông |
| 61 | Phở Bò Tái Lăn Oanh Cường | Phở bò xào lăn tỏi lửa lớn ngập hành | Số 6 Tô Hiệu, Quang Trung, Hà Đông | 45k - 65k | Hà Đông |
| 62 | Bún Bò Huế Chu Văn An | Bún bò móng giò chả cua đậm vị sả | 98 Vạn Phúc, Vạn Phúc, Hà Đông | 40k - 65k | Hà Đông |
| 63 | Bún Chả Sơn Xuyến | Bún chả quạt than hoa gia truyền | 195 Quang Trung, Hà Đông | 40k - 65k | Hà Đông |
| 64 | Ốc Gạo Sài Gòn | Cánh gà chiên mắm bơ tỏi, ốc xào me | 195 Quang Trung, Hà Đông | 55k - 130k | Hà Đông |
| 65 | Gà Mẹt Thiên Ân | Mẹt gà ta 7 món xôi nếp nương | Liền kề 11 KĐT Xa La, Hà Đông | 130k - 220k | Hà Đông |
| 66 | Nem Nướng Cô Lê | Mẹt nem nướng Nha Trang ram giòn | 16 Nguyễn Văn Lộc, Mộ Lao, Hà Đông | 35k - 60k | Hà Đông |
| 67 | Lẩu Dê Tuấn Hằng | Dê núi tái chanh & lẩu dê thuốc bắc | Khu Đấu Giá Vạn Phúc, Hà Đông | 180k - 300k | Hà Đông |
| 68 | Bún Cá Chấm An Viên | Cá rô phi chiên giòn chấm mắm tỏi gừng | Liền kề 12 KĐT Văn Quán, Hà Đông | 40k - 65k | Hà Đông |
| 69 | Bánh Tráng Cuốn Hoàng Bèo | Heo quay giòn bì cuốn rau rừng | 40 Nguyễn Văn Lộc, Mộ Lao, Hà Đông | 50k - 85k | Hà Đông |
| 70 | Lẩu Bò Nhúng Dấm 555 | Bắp bò nhúng dấm chua ngọt thanh | 2B BT1 KĐT Văn Phú, Hà Đông | 150k - 250k | Hà Đông |
| 71 | Cơm Niêu Tố Uyên | Cơm niêu cháy giòn chim bồ câu quay | 102C2 Phạm Ngọc Thạch, Đống Đa | 90k - 180k | Đống Đa |
| 72 | Phở Bò Cụ Chiêu | Bát phở bò gia truyền nước ngọt tủy | Ngõ 214 Khuất Duy Tiến, Thanh Xuân | 45k - 70k | Thanh Xuân |
| 73 | Bún Đậu Mơ Cự Lộc | Đậu Mơ chiên lướt ván dồi rán giòn | 22 Ngõ Cự Lộc, Thanh Xuân | 35k - 60k | Thanh Xuân |
| 74 | Quán Quê Mễ Trì | Gà đồi nướng than hoa tre trúc làng quê | 2A Đỗ Đức Dục, Nam Từ Liêm | 150k - 260k | Nam Từ Liêm |
| 75 | Bún Ốc Phủ Tây Hồ | Bún ốc nguội giấm bỗng ngắm sóng hồ | Ngõ 50 Đặng Thai Mai, Tây Hồ | 45k - 75k | Tây Hồ |
| 76 | Bún Chả Sinh Từ | Bún chả nướng que tre từ năm 1900 | 316 Nguyễn Văn Cừ, Long Biên | 55k - 90k | Long Biên |
| 77 | Bánh Đa Cua An Biên | Bánh đa đỏ Hải Phòng chả mực tôm tươi | 111 Triệu Việt Vương, Hai Bà Trưng | 65k - 110k | Hai Bà Trưng |
| 78 | Bánh Mì Chảo Cột Điện Quán | Chảo pate trứng ốp sốt vang Nghĩa Tân | 105B C3 Nghĩa Tân, Cầu Giấy | 35k - 60k | Cầu Giấy |
| 79 | Nhà Hàng Phương Nam | Lẩu mắm, bánh xèo & cơm cháy kho quẹt | 35 Dịch Vọng Hậu, Cầu Giấy | 150k - 260k | Cầu Giấy |
| 80 | Cơm Niêu Kombo Cầu Giấy | Niêu cơm cháy giòn 2 mặt bò sốt tiêu | 86 Nguyễn Phong Sắc, Cầu Giấy | 80k - 160k | Cầu Giấy |
| 81 | Bún Đậu Nghĩa Tân | Mẹt bún đậu chả cốm dồi rán giòn | 104 C3 Nghĩa Tân, Cầu Giấy | 35k - 65k | Cầu Giấy |
| 82 | Chả Cá Hà Thành | Chả cá lăng sông Đà biệt thự thanh lịch | 20 Nguyễn Văn Huyên, Cầu Giấy | 180k - 260k | Cầu Giấy |
| 83 | Nộm Bò Khô & Bột Lọc Tô Hiệu | Đĩa nộm đu đủ giòn sần sật bánh bột lọc | 106 Tô Hiệu, Cầu Giấy | 25k - 50k | Cầu Giấy |
| 84 | Bò Nhúng Dấm 555 Linh Đàm | Lẩu bắp bò nhúng dấm cuốn rau rừng | TT2-40 KĐT Linh Đàm, Hoàng Mai | 150k - 250k | Hoàng Mai |
| 85 | Mì Vằn Thắn Thành Vy | Mì trứng tươi nước ngọt tôm Trương Định | 157A Trương Định, Hoàng Mai | 40k - 65k | Hoàng Mai |
| 86 | Nhà Hàng Nam Sơn | Hải sản tươi sống bơi bể đại sảnh tiệc | 809 Giải Phóng, Hoàng Mai | 200k - 450k | Hoàng Mai |
| 87 | Lẩu Phan Hoàng Quốc Việt | Buffet bò Úc nhúng lẩu tomyum chua cay | BT24 KĐT Nghĩa Đô, Bắc Từ Liêm | 130k - 220k | Bắc Từ Liêm |
| 88 | Bò Tơ Quán Mộc Cổ Nhuế | Bò tơ cuốn bánh tráng KĐT Nam Cường | CT2A KĐT Nam Cường, Bắc Từ Liêm | 180k - 280k | Bắc Từ Liêm |
| 89 | Gà Nướng Lu & Lẩu Gà Lá É | Gà ta nướng lu da giòn lẩu lá é ấm nồng | 180 Xuân Đỉnh, Bắc Từ Liêm | 120k - 220k | Bắc Từ Liêm |
| 90 | Cơm Tấm Sà Bì Chưởng | Cơm tấm sườn nướng mỡ hành tóp mỡ | 86 Nguyễn Tuân, Thanh Xuân | 55k - 95k | Thanh Xuân |
| 91 | Lẩu Bò Dốc Tam Đa Nguyễn Trãi | Lẩu lòng bò bắp bò dấm bỗng chua cay | 495 Nguyễn Trãi, Thanh Xuân | 120k - 220k | Thanh Xuân |
| 92 | Bún Chả Hương Quê | Bún chả nướng than hoa nạc dăm mọng | 102 Nguyễn Tuân, Thanh Xuân | 40k - 65k | Thanh Xuân |
| 93 | Cơm Niêu Thúy Nga | Cơm niêu cháy giòn cá kho tộ Mễ Trì | 110B Đồng Me, Nam Từ Liêm | 90k - 180k | Nam Từ Liêm |
| 94 | Lẩu Dê Nhất Ly Mỹ Đình | Dê nướng tảng lẩu dê thuốc bắc đại sảnh | 15 Lê Đức Thọ, Nam Từ Liêm | 200k - 350k | Nam Từ Liêm |
| 95 | Nướng Ngói Sapa Nguyễn Hoàng | Bò cuốn nấm nầm heo nướng ngói không khói | 36 Nguyễn Hoàng, Nam Từ Liêm | 120k - 200k | Nam Từ Liêm |
| 96 | Vịt Nướng Vân Đình Ngọc Lâm | Vịt nướng than hoa mật ong lẩu vịt sấu | 185 Ngọc Lâm, Long Biên | 60k - 120k | Long Biên |
| 97 | Bò Tơ Tây Ninh Năm Sánh | Bò tơ nướng than sân vườn Vĩnh Tuy | 23 Đàm Quang Trung, Long Biên | 160k - 280k | Long Biên |
| 98 | Lẩu Ốc Bà Tẹo Bồ Đề | Lẩu ốc chuối đậu tía tô dấm bỗng gia truyền | 16 Phố Bồ Đề, Long Biên | 100k - 180k | Long Biên |
| 99 | Bánh Tôm Cô Ầm | Bánh tôm khoai lang giòn tan ngõ chợ | Đầu ngõ Đồng Xuân, Hoàn Kiếm | 25k - 50k | Hoàn Kiếm |
| 100 | Sen Đầm Trị Tây Hồ | Mâm cỗ sen kinh kỳ & tiệc cung đình | 2 Đặng Thai Mai, Tây Hồ | 280k - 450k | Tây Hồ |
| 101 | Phở Sướng Ngõ Trung Yên | Phở bò gia truyền 'ăn vào là sướng' | 24 Ngõ Trung Yên, Hoàn Kiếm | 55k - 85k | Hoàn Kiếm |
| 102 | Cơm Niêu Hải Sư Giảng Võ | Cơm niêu cháy giòn xá xíu Singapore | 111 K1 Giảng Võ, Ba Đình | 75k - 140k | Ba Đình |

---

## 💻 HƯỚNG DẪN MỞ & SỬ DỤNG TRANG WEB

Trang web được xây dựng hoàn toàn độc lập bằng **HTML5, CSS3 và Vanilla JavaScript thuần khiết**, không phụ thuộc vào bất kỳ thư viện bên ngoài nặng nề nào và không cần cài đặt Node.js hay build code phức tạp.

### Cách 1: Mở trực tiếp trên trình duyệt
Bạn chỉ cần mở tệp tin sau bằng trình duyệt bất kỳ (Google Chrome, Microsoft Edge, Firefox, Cốc Cốc, Safari):
```
C:\Users\phamv\.gemini\antigravity\scratch\vi-ha-thanh\index.html
```

### Cách 2: Chạy qua Live Server (VS Code / Antigravity IDE)
1. Khuyên nghị đặt thư mục `C:\Users\phamv\.gemini\antigravity\scratch\vi-ha-thanh` làm Không gian làm việc chính (Active Workspace).
2. Nhấp chuột phải vào `index.html` chọn **Open with Live Server**.
3. Trang web sẽ mở tại địa chỉ máy cục bộ `http://localhost:5500`.
