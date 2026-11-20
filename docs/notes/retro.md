# Ghi chú & retro

## Phase 3

**Đạt:** toàn bộ Ticket-03 — 108/108 test, 18 scenario headless, tất định, thanh dầu + châm dầu + thắp lại + tắt đèn, Bóng Mực hút dầu với trạng thái `drain`, luật thắng `dawn_survived` (240/270/300 s), sức chứa tăng dần tới 20, công thức điểm mới, chế độ mù màu.

**Hỏng phase trước?** Có, và **theo đúng yêu cầu**: 6 nhóm test của Phase 1–2 dựa vào luật cũ đã bị sửa hoặc bỏ, mỗi nhóm có lý do trong [CHANGELOG](../../CHANGELOG.md). Cụ thể: "thắng khi thắp hết đèn" (bỏ), thời lượng đêm (sửa), công thức điểm (sửa), sức chứa cố định (sửa), vùng an toàn luôn có (sửa), 5 trạng thái Bóng Mực (sửa thành 6). Không test nào bị `skip` âm thầm.

**Điều cần chỉnh cho Phase 4:**
1. **Video demo** phải quay được cảnh `drain` và cảnh bình minh sống sót — đó là hai thứ đặc trưng nhất của Phase 3.
2. **Cân bằng lại độ khó**: 240 s cho 5 đèn × (10 + châm dầu) là khá căng; nếu playtest thấy quá khó thì ghi lại và **không** đổi số chuẩn (ticket quy định), chỉ ghi nhận.
3. **Bình minh khi thắng cả 3 đêm** vẫn chưa có ảnh (giống Phase 2) — sẽ quay trong video.
4. Cân nhắc thêm chỉ báo cho Bóng Mực đang hút dầu ở ngoài khung hình (hiện chỉ thấy khi nó trong tầm nhìn).

**Cách dùng token:** ước tính ~3,0 triệu token vào / ~70k ra (xem [nhật ký AI](ai-journal.md)). Rẻ hơn Phase 2 dù thay đổi phá vỡ nhiều hơn, nhờ ADR viết trước và bộ khung kiểm chứng đã có.

**Bài học:** với change request, thứ đáng viết trước không phải code mà là **mô hình trạng thái** (ADR). Câu hỏi "đèn là bình nhiên liệu hay công tắc" quyết định 80% khối lượng sửa; nếu trả lời sai thì mọi test về sau đều phải làm lại.

## Phase 2

**Đạt:** toàn bộ 54 acceptance criteria của [spec Phase 2](spec-phase-2.md) — 89/89 test, 12 scenario headless, tất định, 59,7 FPS trên GPU thật, HUD đủ 7 thành phần, chuỗi menu → giới thiệu → chơi → kết quả (thua thật) → chơi lại → Đêm 2 → Đêm 3.

**Hỏng phase trước?** Không hỏng, nhưng **phải viết lại** gần như toàn bộ test: ticket yêu cầu thay mọi số liệu tự chọn bằng số chuẩn, và đổi nghĩa `per_mote` (tính khi nạp thay vì khi nhặt). Đây là thay đổi có chủ đích của khách hàng, nên tôi sửa test và ghi lý do trong `CHANGELOG.md` thay vì giữ test cũ.

**Điều cần chỉnh cho phase 3–4:**
1. **Bình Minh** (thắng cả 3 đêm) chưa có bằng chứng ảnh — cần quay trong video Phase 4.
2. **Tháp chuông** hiện không chặn đường; nếu ticket sau nói là vật cản thì phải thêm vào `stepWorld` và test.
3. **Điều khiển trên không** đang để đầy đủ (ticket chỉ nói "không đầy đủ"); nếu giảng viên siết thì đổi ở `movePlayer` và cập nhật test.
4. Bộ test hiện chạy ~2 giây; vẫn còn chỗ để thêm scenario hồi quy giữa các phase.

**Cách dùng token:** ước tính ~3,8 triệu token vào / ~120k ra (xem [nhật ký AI](ai-journal.md)). Chỗ tiết kiệm nhiều nhất ở Phase 2 là **viết acceptance criteria trước khi code** — mỗi lần AI định làm sai, tôi chỉ cần đối chiếu một dòng AC thay vì đọc lại cả ticket.

**Bài học:** ba lỗi tốn thời gian nhất của Phase 2 đều **không** phải lỗi logic game: (a) test tự viết sai (đặt `carried` sai cấp), (b) công cụ sinh file của Windows (BOM/mảng lạ), (c) đo hiệu năng sai môi trường (SwiftShader). Cả ba đã thành một dòng trong bảng bẫy của `AGENTS.md`.

## Phase 1

**Đạt:** toàn bộ 12 yêu cầu gameplay của PRD-0 và 13 điểm của Test Contract v1.0 (xem [bằng chứng](../proof/phase-1/summary.md)). Game chơi được từ đầu tới khi thắng/thua và chơi lại được; bot chơi thật trong trình duyệt thắng Đêm 1.

**Hỏng phase trước:** không áp dụng (phase đầu).

**Điều cần chỉnh cho phase 2:**
1. `pulse_cost` đang là 0 vì lý do tương thích test — nếu ticket sau yêu cầu tỏa sáng tốn đom đóm thì phải sửa cả contract, test và README trong cùng một commit.
2. Bộ test mới có 67 ca nhưng chưa có ca nào cho **hồi quy giữa các phase**; sang phase 2 cần một nhóm test "luật cũ vẫn đúng" để chạy lại sau mỗi thay đổi.
3. Trang trí chưa có va chạm; nếu thấy ảnh hưởng trải nghiệm thì thêm, nhưng phải giữ nguyên đầu ra headless.

**Cách dùng token:** ước tính ~1,9 triệu token vào / ~70k ra cho Phase 1 (xem [nhật ký AI](ai-journal.md)). Chỗ tiết kiệm nhiều nhất là đưa contract cho AI trước khi thiết kế, và để AI tự chạy `tsc`/`node --test`/CLI thay vì mô tả kết quả.

**Bài học:** thứ bắt được nhiều lỗi nhất không phải đọc code, mà là (a) test có con số kỳ vọng tính từ contract, và (b) ảnh chụp từ bot chơi thật. Cả hai đều là thứ tôi sẽ dựng sớm hơn nữa ở các phase sau.
