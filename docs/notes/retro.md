# Ghi chú & retro

## Phase 1

**Đạt:** toàn bộ 12 yêu cầu gameplay của PRD-0 và 13 điểm của Test Contract v1.0 (xem [bằng chứng](../proof/phase-1/summary.md)). Game chơi được từ đầu tới khi thắng/thua và chơi lại được; bot chơi thật trong trình duyệt thắng Đêm 1.

**Hỏng phase trước:** không áp dụng (phase đầu).

**Điều cần chỉnh cho phase 2:**
1. `pulse_cost` đang là 0 vì lý do tương thích test — nếu ticket sau yêu cầu tỏa sáng tốn đom đóm thì phải sửa cả contract, test và README trong cùng một commit.
2. Bộ test mới có 67 ca nhưng chưa có ca nào cho **hồi quy giữa các phase**; sang phase 2 cần một nhóm test "luật cũ vẫn đúng" để chạy lại sau mỗi thay đổi.
3. Trang trí chưa có va chạm; nếu thấy ảnh hưởng trải nghiệm thì thêm, nhưng phải giữ nguyên đầu ra headless.

**Cách dùng token:** ước tính ~1,9 triệu token vào / ~70k ra cho Phase 1 (xem [nhật ký AI](ai-journal.md)). Chỗ tiết kiệm nhiều nhất là đưa contract cho AI trước khi thiết kế, và để AI tự chạy `tsc`/`node --test`/CLI thay vì mô tả kết quả.

**Bài học:** thứ bắt được nhiều lỗi nhất không phải đọc code, mà là (a) test có con số kỳ vọng tính từ contract, và (b) ảnh chụp từ bot chơi thật. Cả hai đều là thứ tôi sẽ dựng sớm hơn nữa ở các phase sau.
