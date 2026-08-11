-- Dữ liệu mẫu cho landing page: một tài khoản demo và ba trang kỷ niệm đã xuất bản.
--
-- Local:  npm run db:seed:local
-- Thật:   npm run db:seed
--
-- Tài khoản demo: demo@virai.com.vn / mật khẩu: demo-virai-2026
-- Đăng nhập bằng tài khoản này để tải ảnh thật cho ba trang mẫu (seed không tạo
-- được ảnh vì ảnh nằm trên R2). Chưa có ảnh thì trang mẫu hiện hình dấu chân.
--
-- Chạy lại nhiều lần cũng được: dùng INSERT OR REPLACE với id cố định.

INSERT OR REPLACE INTO users (id, email, password_hash, name, role, created_at) VALUES (
  'demo0000-0000-4000-8000-000000000001',
  'demo@virai.com.vn',
  'pbkdf2$100000$eosOjdyQTK2jvR7ZPUbfBg==$ZvuDll0lqQLrHb8OxayncNdpzZPDV8Y2iXF9GW2TIGQ=',
  'Trang mẫu Virai Memorial',
  'user',
  unixepoch()
);

-- ── Mít, Golden Retriever ───────────────────────────────────────────────────
INSERT OR REPLACE INTO memorials (
  id, user_id, slug, pet_name, species, breed, gender,
  birth_date, death_date, birth_date_lunar, death_date_lunar,
  bio, story_notes, theme, cover_photo_id,
  is_premium, is_published, visit_count, candle_count, flower_count,
  created_at, updated_at
) VALUES (
  'demo0000-0000-4000-8000-000000000101',
  'demo0000-0000-4000-8000-000000000001',
  'mit-golden',
  'Mít',
  'cho',
  'Golden Retriever',
  'duc',
  '2012-04-18',
  '2025-03-20',
  '28/03 âm lịch, năm Nhâm Thìn',
  '21/02 âm lịch, năm Ất Tỵ',
  'Mít về nhà mình năm 2012, hồi đó bé còn chưa biết leo bậc cửa. Bố mình bế bé từ Hà Đông về trong một cái thùng giấy, cả đường bé không kêu một tiếng, chỉ ngó ra ngoài.

Mười ba năm sau, mình vẫn còn quen tay với việc mở cửa là có một cái đầu vàng chờ sẵn. Mít không phải con chó thông minh nhất — bé học ngồi mất ba tuần, học bắt tay thì thôi luôn không học nữa. Nhưng bé là con chó biết chờ. Chờ mình đi làm về, chờ mình ăn cơm xong, chờ mình khóc xong rồi mới lấy mõm đẩy tay mình lên.

Mít thích nhất là cá hấp và cái ban công buổi chiều. Cứ tầm bốn giờ, nắng nghiêng vào là bé ra nằm đúng cái ô sáng đó, đến khi nắng dịch đi thì bé cũng dịch theo. Mùa hè bé nằm cả buổi, mình phải ra nhắc bé vào uống nước.

Cảm ơn con vì mười ba năm. Ban công vẫn có nắng, chỉ là bây giờ không ai ra nằm nữa.',
  '{"howWeMet":"Bố mình bế bé từ Hà Đông về trong một cái thùng giấy năm 2012","personality":"Không thông minh nhưng rất biết chờ","favourites":"Cá hấp và nằm phơi nắng ở ban công buổi chiều","bestMemory":"Mở cửa là thấy một cái đầu vàng chờ sẵn","message":"Cảm ơn con vì mười ba năm"}',
  'am-ap',
  NULL,
  1, 1, 428, 96, 51,
  unixepoch(), unixepoch()
);

-- ── Bắp, mèo tam thể ────────────────────────────────────────────────────────
INSERT OR REPLACE INTO memorials (
  id, user_id, slug, pet_name, species, breed, gender,
  birth_date, death_date, birth_date_lunar, death_date_lunar,
  bio, story_notes, theme, cover_photo_id,
  is_premium, is_published, visit_count, candle_count, flower_count,
  created_at, updated_at
) VALUES (
  'demo0000-0000-4000-8000-000000000102',
  'demo0000-0000-4000-8000-000000000001',
  'bap-meo-tam-the',
  'Bắp',
  'meo',
  'Mèo tam thể',
  'cai',
  '2015-08-02',
  '2024-11-11',
  '18/06 âm lịch, năm Ất Mùi',
  '11/10 âm lịch, năm Giáp Thìn',
  'Bắp không phải mèo của mình. Bắp là mèo hoang ở khu trọ, mình chỉ là người cho ăn. Nhưng cho ăn được ba tháng thì một hôm trời mưa, bé tự đi vào nhà, tự tìm cái gối, rồi từ đó không đi nữa.

Bé nhát người lạ tới mức có khách là biến mất, nhưng với mình thì Bắp là con mèo nói nhiều nhất mình từng gặp. Đi làm về là bé kêu, mở tủ lạnh là bé kêu, mình ngồi làm việc lâu quá là bé nhảy lên bàn ngồi chắn trước màn hình rồi kêu tiếp.

Chín năm, Bắp chưa từng để mình ăn cơm một mình.

Bây giờ nhà yên hơn nhiều. Yên quá.',
  '{"howWeMet":"Mèo hoang ở khu trọ, một hôm trời mưa tự đi vào nhà","personality":"Nhát người lạ nhưng nói rất nhiều với mình","favourites":"Ngồi chắn trước màn hình máy tính","bestMemory":"Chín năm chưa từng để mình ăn cơm một mình","message":"Bây giờ nhà yên quá"}',
  'thanh-tinh',
  NULL,
  1, 1, 213, 64, 38,
  unixepoch(), unixepoch()
);

-- ── Lucky, Corgi ────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO memorials (
  id, user_id, slug, pet_name, species, breed, gender,
  birth_date, death_date, birth_date_lunar, death_date_lunar,
  bio, story_notes, theme, cover_photo_id,
  is_premium, is_published, visit_count, candle_count, flower_count,
  created_at, updated_at
) VALUES (
  'demo0000-0000-4000-8000-000000000103',
  'demo0000-0000-4000-8000-000000000001',
  'lucky-corgi',
  'Lucky',
  'cho',
  'Corgi',
  'duc',
  '2016-01-09',
  '2026-02-03',
  '30/11 âm lịch, năm Ất Mùi',
  '16/12 âm lịch, năm Ất Tỵ',
  'Lucky là con chó ngắn chân nhất và bận rộn nhất nhà. Bé không đi, bé chạy — chạy ra cửa, chạy vào bếp, chạy vòng quanh cái ghế sofa vì lý do không ai hiểu.

Bé đi cùng nhà mình hai chuyến Đà Lạt. Chuyến đầu bé say xe, nằm bẹp cả đường nhưng vẫn cố ngóc đầu nhìn ra cửa sổ. Chuyến thứ hai bé quen hơn, ngồi hẳn lên ghế trước như người lớn.

Mấy tháng cuối chân sau bé yếu, không chạy được nữa. Bé vẫn cố ra cửa đón mình, chỉ là đi chậm thôi. Mình nghĩ về hình ảnh đó nhiều hơn cả những lúc bé còn khoẻ.

Con nghỉ đi, không phải chạy nữa.',
  '{"howWeMet":"Về nhà mình từ hồi còn bé xíu, đầu năm 2016","personality":"Không đi mà chạy, lúc nào cũng bận rộn","favourites":"Đi Đà Lạt, ngồi ghế trước như người lớn","bestMemory":"Chuyến Đà Lạt đầu tiên, say xe nhưng vẫn ngóc đầu nhìn ra cửa sổ","message":"Con nghỉ đi, không phải chạy nữa"}',
  'dem-sao',
  NULL,
  1, 1, 157, 41, 29,
  unixepoch(), unixepoch()
);

-- Vài lời lưu bút mẫu đã duyệt để sổ lưu bút không trống
INSERT OR REPLACE INTO guestbook_entries (id, memorial_id, author_name, message, status, ip_hash, created_at) VALUES
  ('demo0000-0000-4000-8000-000000000201', 'demo0000-0000-4000-8000-000000000101', 'Hà', 'Mít ơi, chị vẫn nhớ hồi em còn hay ra cửa đón. Ngủ ngoan nhé em.', 'approved', NULL, unixepoch() - 86400 * 12),
  ('demo0000-0000-4000-8000-000000000202', 'demo0000-0000-4000-8000-000000000101', 'Nam', 'Thương Mít. Cả xóm ai cũng biết con chó vàng hay nằm ban công.', 'approved', NULL, unixepoch() - 86400 * 9),
  ('demo0000-0000-4000-8000-000000000203', 'demo0000-0000-4000-8000-000000000102', 'Linh', 'Bắp kêu nhiều thật, nhưng nhà vắng tiếng bé thì buồn lắm.', 'approved', NULL, unixepoch() - 86400 * 20),
  ('demo0000-0000-4000-8000-000000000204', 'demo0000-0000-4000-8000-000000000103', 'Chú Tuấn', 'Lucky chạy giỏi nhất khu. Yên nghỉ nhé con.', 'approved', NULL, unixepoch() - 86400 * 4);
