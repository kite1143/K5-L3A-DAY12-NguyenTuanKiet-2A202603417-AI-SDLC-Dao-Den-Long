# Spec Phase 2 — "Ba hòn đảo" (Ticket-02, Contract v1.1)

Tài liệu này là danh sách **acceptance criteria** cho từng mục của Ticket-02. Mỗi dòng phải kiểm chứng được bằng test hoặc bằng chứng thật. Ký hiệu: `[AC-n]`.

Số liệu chuẩn nằm ở `src/core/config.ts` (`TUNING`) + `src/core/nights.ts` (bản đồ), và phải khớp `game.contract.json` — test `tests/contract.test.mjs` canh việc này.

## Phần 1 — Số liệu chuẩn

| # | Yêu cầu | Acceptance criteria | Cách kiểm chứng |
|---|---|---|---|
| AC-1 | Chạy 6,0 m/s, tăng/giảm tốc ≤ 0,1 s | Đi 1 s từ trạng thái đứng yên được đúng 6,0 m (ramp = 0) | `sim.test.mjs` |
| AC-2 | Nhảy 7,0 m/s, g −20, chỉ khi chạm đất | Đỉnh nhảy ≈ 1,225 m; nhấn giữa không trung không đổi vận tốc | `sim.test.mjs` |
| AC-3 | Lướt 14 m/s / 0,2 s (12 tick) / hồi 1,5 s tính từ lúc bắt đầu | 12 tick lướt đi đúng 2,8 m; tick 90 mới lướt lại được | `sim.test.mjs` |
| AC-4 | Lướt trên không giữ nguyên độ cao; không bất tử | `player.pos.y` không đổi trong 12 tick lướt khi ở trên không; bị chạm vẫn mất lửa | `sim.test.mjs` |
| AC-5 | Hướng lướt = hướng đang di chuyển, đứng yên thì hướng mặt | Nhấn lướt khi đứng yên → bay theo hướng mặt gần nhất | `sim.test.mjs` |
| AC-6 | Sức chứa 10, đèn 10 đom đóm, nạp nhiều lần, đèn nhớ tiến độ | Nạp 6 rồi 4 → đèn sáng; `deposited` cộng dồn | `sim.test.mjs` |
| AC-7 | Nhặt khi XZ ≤ 1,0 m và chênh cao ≤ 1,5 m | Đúng biên 1,0 m; đom đóm cao 2 m không nhặt được | `sim.test.mjs` |
| AC-8 | 20 đom đóm lúc đầu tại 20 điểm khác nhau; trần 30; tick 240, 480… sinh thêm 1 | Snapshot tick 0 có 20 con id khác nhau; tick 240 có 21 | `sim.test.mjs` |
| AC-9 | Tương tác bán kính 2,0 m; chọn đèn chưa sáng gần nhất, hoà thì id nhỏ hơn | Đặt 2 đèn cách bằng nhau → nạp vào L1 | `sim.test.mjs` |
| AC-10 | Vùng an toàn 6 m; Bóng Mực ở trong bị đẩy ra ≤ 30 tick, không gây sát thương | Bóng trong 6 m bị đẩy ra mép, người chơi không mất lửa | `sim.test.mjs` |
| AC-11 | Tỏa sáng: 3 đom đóm / 5 m / hồi 3 s | Không đủ 3 → không có event `pulse`; đủ → trừ 3, hồi 180 tick | `sim.test.mjs` |
| AC-12 | Tâm tỏa sáng = chân Mây + 0,8 m; chọn mục tiêu theo khoảng cách 3D ≤ 5 m | Bóng Mực cùng XZ nhưng cao 5 m vẫn trúng | `sim.test.mjs` |
| AC-13 | Choáng 120 tick; 15 tick đầu đẩy lùi tổng 4 m ngang | Sau 15 tick bóng cách vị trí cũ đúng 4 m | `sim.test.mjs` |
| AC-14 | Bóng Mực 4,0 m/s (Đêm 3: 4,5), phát hiện 12 m, bỏ đuổi 18 m | Tốc độ đo được đúng; trạng thái wander ↔ chase đúng ngưỡng | `sim.test.mjs` |
| AC-15 | Chạm: XZ ≤ 1,0 m, chênh cao ≤ 1,5 m, tối đa 1 lần mất lửa/tick; recoil 2 m / 60 tick | 2 bóng chạm cùng tick chỉ mất 1 lửa; bóng lùi 2 m | `sim.test.mjs` |
| AC-16 | Lịch sinh: 2 con tick 300, sau đó 1 con mỗi 480 tick (Đêm 1), id S1… | `shade_spawned` tại tick 300×2, 780×1 | `sim.test.mjs` |
| AC-17 | Bị đánh: −1 lửa, rơi `floor(mang/2)` ra vành 1,5–2,5 m, TTL 480 tick, nhặt lại từ tick sau, bất tử 90 tick | Đom đóm rơi có `kind: dropped`; không nhặt được cùng tick | `sim.test.mjs` |
| AC-18 | Rơi (Y < −10) đúng 1 lần, bỏ qua bất tử: −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 | `player_hit` có `by:"fall"` + `lost`; hồi sinh đúng toạ độ gốc | `sim.test.mjs` |
| AC-19 | 3 Ngọn Lửa, hồi đầy mỗi đêm | Đêm 2 bắt đầu với 3 lửa | `sim.test.mjs` |
| AC-20 | Thời lượng 300/330/360 s | `time_left_s` tick 0 đúng từng đêm | `cli.test.mjs` |
| AC-21 | Thứ tự thắng/thua: hết lửa → luôn thua; còn sống + đủ đèn → thắng; hết giờ → dawn | Scenario hết giờ đúng tick thắng → `won` | `sim.test.mjs` |
| AC-22 | Điểm: +10/đom đóm **nạp**, +100/đèn, +5/Bóng Mực trúng tỏa sáng, thưởng khi thắng | Điểm cuối = tổng các nguồn | `sim.test.mjs` |

## Phần 2 — Bản đồ

| # | Yêu cầu | Acceptance criteria |
|---|---|---|
| AC-23 | Đêm 1: đảo bán kính 40 m; 5 đèn đúng toạ độ; ra ngoài 40 m là rơi | Đi ra r > 40 → rơi; đèn khớp danh sách |
| AC-24 | Đêm 2: 2 đảo bán kính 28 m tâm (0,0,0) và (70,0,0); cầu tre x∈[26,44], |z|≤2; 6 đèn | Đứng giữa cầu không rơi; ngoài cầu và ngoài đảo thì rơi |
| AC-25 | Đêm 2: 2 bục nhảy bán kính 1 m tại (20,0,18) và (50,0,−18), phóng vy 14, ngang 24 về tâm đảo kia, bay ≈1,4 s | Chạm bục → `vy` tăng 14, đáp trong đảo đích sau ≈1,4 s |
| AC-26 | Đêm 3: 3 tầng (0; 3 ở vành 12–24 m nửa z>0; 6 ở đĩa bán kính 8 m), vách đứng, 2 dốc 30°/150°, bục (0,3,13), tháp chuông | Cao độ đúng từng vùng; bước khỏi tầng thì rơi xuống tầng dưới; dốc đi lên được |
| AC-27 | 30 điểm đom đóm Đêm 3 (18/8/4), 16 điểm Bóng Mực, 7 đèn | Số điểm và toạ độ khớp |
| AC-28 | Gió Đêm 3: mỗi 30 s, kéo dài 5 s, hướng ngẫu nhiên, đẩy 2 m/s, báo trước 2 s | `snapshot.wind.active` bật đúng cửa sổ; người chơi bị đẩy 2 m/s |

## Phần 3 — Tính năng mới

| # | Yêu cầu | Acceptance criteria |
|---|---|---|
| AC-29 | Gió Lạc: 7 m/s, tối đa 2, sinh tick 1200, 2400…, id D1… | `shade`-style đăng ký trong `drifters[]`; sinh đúng tick |
| AC-30 | Gió Lạc: idle (2 m/s) → chase khi mang ≥ 5 và cách ≤ 15 m → mất điều kiện về idle | Trạng thái đổi đúng hai ngưỡng |
| AC-31 | Gió Lạc chạm (XZ ≤ 1,2 m) cướp `min(3, mang)` rồi flee 7 m/s / 240 tick và biến mất cùng số đã cướp | Event `drifter_steal`; sau 240 tick biến mất |
| AC-32 | Tỏa sáng trúng Gió Lạc đang chase → flee không cướp; trúng lúc flee có đồ → `drifter_drop` toàn bộ, biến mất sau 120 tick | Event `drifter_drop` đúng số |
| AC-33 | Bùa Gió: 600 tick, tốc độ 7,2, lướt không hồi chiêu, nhặt lại làm mới, xuất hiện lại sau 2700 tick | `charm_s` đếm đúng; nhấn lướt 2 lần liên tiếp được |
| AC-34 | Chuỗi 3 đêm: menu → giới thiệu → chơi → kết quả → đêm kế; thắng đêm 3 hiện Bình Minh + tổng điểm; thua chơi lại đêm đó | Đi hết chuỗi trong trình duyệt, có ảnh từng màn |
| AC-35 | Tạm dừng Esc/P: dừng hoàn toàn, có Tiếp tục / Chơi lại / Cài đặt / Về menu; tick vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `state:"paused"` | Headless: bật pause → `sim_tick` và `time_left_s` không đổi |
| AC-36 | Cài đặt âm lượng + độ nhạy chuột, lưu giữa các lần mở | Đổi → tải lại trang → giá trị còn |
| AC-37 | Âm thanh: nhạc nền + 10 hiệu ứng (nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s) | Nghe được từng loại, không lỗi console |
| AC-38 | HUD: lửa, đồng hồ mm:ss (đỏ + nhấp nháy ≤ 30 s), đèn k/n + điểm, thanh 10 ô đom đóm, 2 icon hồi chiêu, nhắc "E — Nạp ánh sáng (x/10)", mũi tên chỉ đèn gần nhất ngoài màn hình | Ảnh chụp HUD đủ từng thành phần |
| AC-39 | Bảng màu chuẩn, sai lệch ≤ 10% mỗi kênh | Script so mã màu trong code với bảng |
| AC-40 | Ánh sáng môi trường = 0,15 + 0,55 × (đèn sáng / tổng đèn) | Giá trị đọc được khớp công thức |

## Phần 4 — Contract v1.1

| # | Yêu cầu | Acceptance criteria |
|---|---|---|
| AC-41 | `contract_version: "1.1"`; tuning khớp số chuẩn; thêm `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s` | Test so sánh sâu `tuning` với `TUNING` |
| AC-42 | `--night` nhận 1, 2, 3 | Chạy được cả 3, sai thì thoát mã 1 |
| AC-43 | Snapshot thêm `night`, `wind{active,dir_deg}`, `player{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, mảng `motes(id,pos,kind,ttl_s)`, `drifters(id,pos,state,stolen)`, `charms(id,available,respawn_s)` | `verify.mjs` validate schema từng đêm |
| AC-44 | Scenario thêm `player.{invuln_ticks,dash_cd_ticks,pulse_cd_ticks,charm_ticks}`, `shades[].{state,state_ticks_left}`, `drifters`, `charms`, `random_drifters`, `wind_enabled` | Test dựng scenario dùng mọi trường |
| AC-45 | Input thêm `dash`, `pause` (edge false→true) | Headless: `dash`/`pause` hoạt động |
| AC-46 | Event mới: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`; `player_hit` có `lost` khi rơi | Mỗi event có test |
| AC-47 | Trạng thái Bóng Mực đúng tên: `spawning`, `wander`, `chase`, `recoil`, `stunned` | Snapshot chỉ chứa 5 tên này |
| AC-48 | Chạy headless trọn 1 đêm (21.600 tick) ≤ 30 s | `verify.mjs` đo thời gian |

## Phần 5 — DoD

| # | Yêu cầu | Acceptance criteria |
|---|---|---|
| AC-49 | Bằng chứng game chạy đúng | `npm run verify` PASS + ảnh bot chơi thật |
| AC-50 | Test Phase 1 vẫn đạt với số chuẩn | Bộ test cũ được cập nhật theo số mới, chạy xanh |
| AC-51 | Spec có acceptance criteria | Chính file này |
| AC-52 | AGENTS.md + skill cập nhật cho phạm vi mới, có trong lịch sử git | Commit riêng cho harness |
| AC-53 | ≥ 1 scenario headless cho mỗi tính năng mới | `scenarios/manifest.json` có mục cho lướt, gió, Gió Lạc, Bùa, rơi, pause, Đêm 2, Đêm 3 |
| AC-54 | ≥ 30 FPS trung bình ở 1280×720 | `scripts/fps.mjs` đo trên Chromium, lưu số vào bằng chứng |

## Giả định (ghi lại vì ticket không nói)

1. **Tăng tốc = 0 s.** Ticket cho budget "≤ 0,1 s", tôi dùng vận tốc tức thời để phép đo headless chính xác tuyệt đối (đi 1 s = đúng 6,0 m).
2. **Điều khiển trên không = đầy đủ.** "Không đầy đủ" không có số; tôi giữ đầy đủ để mọi phép đo là tất định. Ghi ở đây để phase sau siết nếu giám khảo yêu cầu.
3. **Bán kính tương tác đèn đo 3D** (không phải XZ) vì Đêm 3 có đèn ở tầng 1 và tầng 2; nếu đo XZ thì đứng dưới chân tháp vẫn nạp được đèn trên nóc.
4. **Vùng an toàn đo XZ**; Bóng Mực bị đẩy ra mép ngay trong tick đó (ticket cho phép tới 30 tick).
5. **Bóng Mực `wander`** bò 1,2 m/s về tâm đảo (ticket không nêu tốc độ wander).
6. **`spawning` kéo dài 30 tick** (0,5 s) để có hiệu ứng hiện hình; đây là giai đoạn không tương tác.
7. **Tháp chuông không chặn đường** (chỉ là vật thể trang trí không leo được), vì ticket không định nghĩa va chạm cho nó.
8. **`invuln` trong snapshot tính bằng tick** (ticket đặt tên không có `_s`), còn `dash_cd_s`, `pulse_cd_s`, `charm_s` tính bằng giây.
9. **Bục nhảy** chỉ kích hoạt khi chân Mây chạm đất trong bán kính bục.
10. **Gió Đêm 3** không ảnh hưởng Bóng Mực/Gió Lạc, chỉ đẩy Mây.
