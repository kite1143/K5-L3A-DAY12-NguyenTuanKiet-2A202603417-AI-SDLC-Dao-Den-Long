# ADR-001 — Đèn cạn dầu: mô hình trạng thái đèn và luật thắng mới

- **Trạng thái:** chấp nhận (Phase 3, Ticket-03, contract v1.2)
- **Ngày:** 2026-11-20
- **Bối cảnh:** playtest cho thấy người chơi giỏi thắp hết đèn trong ~2 phút rồi đêm kết thúc, mất căng thẳng cuối đêm.

## Quyết định

### 1. Đèn là một **bình nhiên liệu**, không phải một cái công tắc

Trước đây `lantern.deposited` là bộ đếm tiến độ có một chiều: nạp đủ thì `lit = true` và không bao giờ đổi lại. Nay đèn có **hai** khái niệm tách rời:

| Khái niệm | Ý nghĩa | Ai ghi |
|---|---|---|
| `deposited` | tiến độ thắp **lần này** (0…cost) | chỉ dùng khi `lit = false` |
| `fuel` | nhiên liệu còn lại của đèn **đang sáng** | hao 1/giây, bị Bóng Mực hút, được châm thêm |
| `ever_lit` | đèn từng sáng chưa | quyết định giá thắp lại (5 thay vì 10) |
| `relit_count` | số lần thắp lại | số liệu cho HUD/điểm thưởng |

Ba hệ quả:
- `lit` **không còn là trạng thái cuối**. `fuel ≤ 0` ⇒ tắt, `deposited = 0`, `ever_lit` giữ nguyên. Đèn có thể bật/tắt nhiều lần trong một đêm.
- Mọi chỗ trước đây hỏi "đèn này đã sáng chưa" phải hỏi thêm "còn dầu không". Vùng an toàn, chọn mục tiêu của Bóng Mực, HUD, ánh sáng môi trường đều phụ thuộc `fuel`.
- `successful_lights` (số lần thắp **thành công**) là nguồn duy nhất của sức chứa; đèn đặt sẵn bằng scenario không tính, vì đó không phải thành tích của người chơi.

### 2. Dầu tính bằng **số nguyên 1/60**, không dùng số thực

`số thực fuel` gây hai lỗi khó tái lập: (a) hao 1/60 mỗi tick cộng dồn sai số sau vài nghìn tick; (b) so sánh `fuel < 30` có thể lật qua lật lại ở biên.

Vì vậy `fuel` được lưu nội bộ là `fuelUnits` nguyên, `1 fuel = 60 units`, `0…6000`:

| Sự kiện | Đơn vị |
|---|---|
| Hao mỗi tick | −1 (đúng 1 fuel/giây ở 60 tick/giây) |
| Một Bóng Mực hút mỗi tick | −5 (đúng 5 fuel/giây) |
| Châm một đom đóm | +600 (đúng 10 fuel) |
| Ngưỡng "sắp cạn" | 1800 (= 30 fuel) |

Chỉ làm tròn khi **xuất** snapshot (`fuel`, 1 chữ số thập phân). Nhờ vậy `fuel ≤ 0`, `fuel ≥ 30` là so sánh nguyên, tất định và không phụ thuộc thứ tự cộng.

### 3. Luật thắng đổi từ "thắp hết" sang "sống tới bình minh"

| | Phase 2 | Phase 3 |
|---|---|---|
| Điều kiện thắng | mọi đèn sáng, **thắng ngay** | hết giờ **và** còn sống **và** số đèn đang sáng ≥ `ceil(0.6 × tổng)` |
| Thời lượng | 300/330/360 s | 240/270/300 s |
| `game_over.reason` | `all_lit`, `dawn`, `no_flames` | `dawn_survived`, `dawn`, `no_flames` |

Lý do: nếu vẫn thắng ngay khi đủ đèn thì người giỏi vẫn kết thúc đêm sớm và 90 giây cuối vẫn trống. Luật mới buộc phải **giữ** đèn cháy, nên phần "châm dầu" và áp lực của Bóng Mực mới có nghĩa.

`all_lit` bị xoá khỏi contract, không dùng lại. Ngưỡng `ceil(0.6 × tổng)` cho Đêm 1 3/5, Đêm 2 4/6, Đêm 3 5/7 — luôn chừa chỗ cho người chơi mất 1–2 đèn mà vẫn thắng, nhưng không thể bỏ mặc đảo.

### 4. Bóng Mực có thêm một **mục tiêu phi người chơi**

Trước đây Bóng Mực chỉ có một nguồn hành vi: người chơi. Nay có `drain`: đứng cạnh đèn **đang sáng nhưng yếu** và hút dầu. Ba lựa chọn đã cân nhắc:

1. Bóng Mực đứng hút đèn ngay cả khi bị người chơi đuổi → người chơi chỉ cần đứng đó, không căng thẳng.
2. Bóng Mực hút **mọi** đèn → không phòng thủ được, phá vỡ ý "giữ đảo sáng".
3. **Chỉ Bóng Mực đang `wander` mới chọn đèn yếu** (đã chọn). Bóng đang `chase` không đổi mục tiêu, nên người chơi vẫn điều khiển được nhịp bằng cách chạy vòng.

Ngưỡng `< 30` là ngưỡng "sắp cạn" của mục 2 và cũng là ngưỡng mất vùng an toàn — một ngưỡng, hai hệ quả, dễ hiểu cho người chơi: *đèn yếu không còn che được mình*.

## Hệ quả cho test

Các test của Phase 1–2 dựa vào luật cũ bị **sửa hoặc bỏ, có ghi lý do trong `CHANGELOG.md`**; không test nào bị `skip` âm thầm:

| Test cũ | Xử lý |
|---|---|
| "lighting every lantern wins" | **bỏ** — Phase 3 không còn thắng sớm; thay bằng test đếm đèn ở tick cuối |
| `time_left_s` 300/330/360 | **sửa** thành 240/270/300 |
| Điểm +10/đom đóm, +100/đèn, thưởng thời gian | **sửa** thành +5/đom đóm, +100/+40 thắp, +50+fuel mỗi đèn lúc bình minh, bỏ thưởng thời gian |
| Sức chứa cố định 10 | **sửa** thành 10 + 2 × số lần thắp, tối đa 20 |
| Vùng an toàn luôn có quanh đèn sáng | **sửa** thành chỉ khi `fuel ≥ 30` |

## Không thay đổi

Số liệu di chuyển, nhảy, lướt, tỏa sáng, chạm, rơi, Gió Lạc, Bùa Gió, gió, ba bản đồ, thứ tự 10 bước trong tick, tính tất định, và toàn bộ kiến trúc `src/core` ↔ `src/render` — chỉ thêm bước "trừ dầu" vào bước 2 và đổi bước xét thắng/thua.
