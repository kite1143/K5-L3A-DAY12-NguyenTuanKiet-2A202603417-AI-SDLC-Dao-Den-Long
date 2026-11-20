# Giả định — Phase 1 (PRD-0 + Test Contract v1.0)

Ghi lại mọi chỗ PRD-0 hoặc contract còn mơ hồ, và con số tôi chọn. Nếu phase sau đổi luật, sửa đúng dòng tương ứng và ghi lý do vào `CHANGELOG.md`.

## A. Chỗ PRD-0 nói nhưng không nêu số

| Chỗ mơ hồ | Giả định đã chọn | Lý do |
|---|---|---|
| Đảo tròn lớn cỡ nào | Bán kính 26 m, 5 đèn trên vành 17 m | Đi một vòng mất ~25 giây: đủ xa để có cảm giác đảo, đủ gần để thắng trong 5 phút |
| Mỗi đèn cần bao nhiêu đom đóm | 3 (`lantern_cost`) | Bằng đúng sức chứa túi, nên mỗi chuyến mang về là một ngọn đèn — nhịp chơi rõ ràng |
| Mang được bao nhiêu | 3 (`carry_capacity`) | Như trên |
| Đom đóm trên đảo | 30 con, rải ngẫu nhiên theo seed | Cần 15 con để thắng: dư 2× để người chơi lỡ tay |
| Thời lượng đêm | 300 giây (`night1_duration_s`) | Khớp con số ví dụ `time_left_s: 300` trong contract |
| Máu | 3 ngọn lửa, mỗi lần bị chạm mất 1 | `flames: 3` cũng là giá trị mặc định trong scenario mẫu của contract |
| Bóng Mực nhanh bao nhiêu | 2,6 m/s, chậm hơn Mây 5 m/s | Đuổi kịp nếu người chơi đứng yên, nhưng luôn có thể chạy thoát — PRD nói "né Bóng Mực" |
| Mấy con Bóng Mực | Tối đa 4, con đầu xuất hiện ở giây thứ 6, sau đó 10 giây một con | Đủ áp lực, không biến đảo thành mê cung |
| Tỏa sáng mạnh cỡ nào | Bán kính 6 m, choáng 2 giây, đẩy 3 m, hồi 1,5 giây | Đủ để thoát một lần bị vây, không đủ để đi xuyên cả đảo |
| Đánh rơi bao nhiêu khi bị chạm | Một nửa, làm tròn xuống (`floor`) | Đọc thẳng từ `hit_drop_ratio: 0.5` |
| Điểm số | 10/đom đóm, 100/đèn, 5/lần làm choáng, +2/giây còn lại, +50/ngọn lửa còn lại (thưởng chỉ khi thắng) | Đã ghi trong README; mọi nguồn điểm đều phát ra từ một sự kiện kiểm chứng được |

## B. Chỗ contract nói nhưng cần diễn giải

| Điểm cần diễn giải | Cách làm | Lý do |
|---|---|---|
| `pulse_cost` | **0** — tỏa sáng không tiêu đom đóm, chi phí là hồi chiêu 1,5 giây | Nếu thu đom đóm thì test tự sinh (người chơi mang 0 đom đóm, bấm `pulse`) sẽ không thấy sự kiện `pulse`, trượt oan. Tinh thần "tốn ánh sáng" của PRD được giữ bằng hồi chiêu. **Sẽ xem lại nếu ticket phase sau yêu cầu giá cụ thể** — khi đó sửa cả `game.contract.json` và test |
| `fall_enabled` | **false** — mép đảo là rào chắn mềm ở bán kính 25,4 m | Contract cho phép `false`; rơi xuống biển mây không phải luật của PRD-0. Hệ quả: game không bao giờ phát `player_hit` với `by: "fall"` |
| Đom đóm rơi khi bị chạm | Tan vào sương, **không** nhặt lại được | Contract chỉ có trường `dropped`; biến chúng thành đom đóm mới sẽ làm `motes_active` phình ra và khó đoán trong test |
| `safe_radius` áp dụng cho đèn nào | Chỉ đèn **đã thắp** | "Bóng Mực sợ những chiếc đèn" — đèn chưa cháy thì không có ánh sáng |
| `deposit` khi túi nhiều hơn phần còn thiếu | Chỉ nạp đúng phần còn thiếu, phần dư giữ trong túi | Không bắt người chơi trả giá vì mang dư; `amount` trong event phản ánh số thật đã nạp |
| `deposit` khi đứng gần nhiều đèn | Chọn đèn chưa thắp gần nhất trong `interact_radius` | Tất định, không phụ thuộc thứ tự duyệt |
| Đèn đặt sẵn `lit: true` trong scenario | Không cộng điểm, không phát `lantern_lit` | Contract nói rõ: dựng scenario không cộng điểm |
| Điểm thưởng khi thua | Không cộng | `per_second_left` / `per_flame_left` là thưởng khi thắng; thua mà vẫn thưởng thì vô lý |
| `shade.pos` độ cao | Luôn 1,0 m | Contract ví dụ `pos: [30.1, 1.0, 2.0]` cho tâm Bóng Mực |
| Nhảy có ảnh hưởng gì không | Chỉ đổi Y, không đổi XZ, không đổi khoảng cách nào | Contract: mọi khoảng cách đo trên mặt phẳng XZ |
| Di chuyển có quán tính không | Không. Vận tốc tức thời = `player_speed` | Để "đi 1 giây thì được đúng 5 m" — test ẩn có thể kiểm tra chính xác điều này |
| `move` có thành phần ngoài [-1, 1] | Chấp nhận và chuẩn hóa, **không** báo lỗi | Contract vừa nói thành phần trong [-1,1] vừa nói vector dài hơn 1 thì chuẩn hóa; dễ dãi ở đây an toàn hơn là thoát mã 2 |
| Cờ CLI lạ | Bỏ qua im lặng | Giảng viên có thể thêm cờ riêng; từ chối sẽ làm gãy bài chấm |
| File JSON có BOM | Chấp nhận | Người chấm có thể tạo file bằng editor Windows |
| `motes` trong snapshot | Có phát (id + pos), dù contract chỉ khuyến nghị | Thêm thông tin, không phá định dạng |
| Đèn chưa thắp nhưng `deposited` đã đủ | Lần `E` kế tiếp sẽ thắp đèn (không cần thêm đom đóm) | Tránh trạng thái kẹt do scenario dựng sẵn |

## C. Điều chưa làm trong Phase 1 (ghi trung thực)

- Không có âm thanh môi trường liên tục (chỉ có hiệu ứng rời rạc bằng WebAudio).
- Bóng Mực chỉ có một loại; PRD-0 cho phép sáng tạo thêm loại khác — để phase sau.
- Chưa có va chạm vật lý với đá/cây (chúng là trang trí, đi xuyên qua được).
- Chưa có video demo (Phase 4 mới phát hành Release `v1.0.0` kèm video).
