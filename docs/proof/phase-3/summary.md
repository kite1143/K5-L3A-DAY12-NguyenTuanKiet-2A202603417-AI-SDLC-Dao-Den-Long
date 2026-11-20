# Bằng chứng Phase 3

Tag: `phase-3`. Mọi số liệu dưới đây sinh ra bằng `npm run verify`, `scripts/shots.mjs` (bot chơi thật) và `scripts/fps.mjs` (đo FPS thật trên GPU); không có output nào được sửa tay.

## 1. Tổng quan

| Hạng mục | Kết quả |
|---|---|
| Build | typecheck + core + headless + web: **PASS** |
| Test tự động | **108/108 pass** (contract, sim, feature, **fuel**, CLI) |
| Scenario headless | **18/18 đúng schema v1.2**, trong đó 1 ca kiểm tra mã thoát 2 |
| Tính tất định | Hai lần chạy cùng seed: **giống nhau từng byte** |
| Bundle headless đã commit | **khớp** với `src/` |
| Chạy trọn 1 đêm 18.000 tick (CLI) | **dưới 1 giây** (yêu cầu ≤ 30 s) |
| Hiệu năng bản thường | **59,8 FPS trung bình** ở 1280×720 (yêu cầu ≥ 30) |
| Bảng màu + bảng màu mù màu | **22/22 màu** trong `src/core/config.ts` |
| Chơi thật trong trình duyệt | menu → giới thiệu → chơi (mất lửa) → cảnh dầu cạn/hút dầu → cài đặt mù màu → Đêm 3, **không có page error** |

Báo cáo đầy đủ: [verify-report.md](verify-report.md) · FPS: [fps.json](fps.json) · Ảnh: [screens/](screens/)

## 2. Truy vết yêu cầu → cách kiểm chứng → bằng chứng

| # | Yêu cầu Ticket-03 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1a | Dầu tối đa 100, hao 1/giây, tính bằng đơn vị 1/60 | Lit đèn `fuel: 100` → sau 60 tick còn 99,0; sau 120 tick còn 98,0 (1 chữ số thập phân) | `tests/fuel.test.mjs`, `scenarios/13-lantern-fuel-burn*` | Đạt |
| 1b | Châm dầu: `used = min(mang, ceil((100−dầu)/10))`, mỗi đom đóm +10, trần 100 | Dầu 25 + mang 10 → `refuel {amount: 8, fuel: 100}`, mang còn 2, điểm +40 | `tests/fuel.test.mjs`, `scenarios/14-refuel*` | Đạt |
| 1c | Chọn đèn khi tương tác: chỉ đèn nhận được, gần nhất, hoà → id nhỏ | Đèn đầy bị bỏ qua; đèn đang sáng nhưng thiếu dầu vẫn nhận châm | `tests/fuel.test.mjs` | Đạt |
| 1d | `fuel ≤ 0` ⇒ đèn tắt, `deposited = 0`, `lantern_out`, nhớ `ever_lit` | Đèn `fuel: 0.1` → `lantern_out` tại tick 6, snapshot `lit:false, fuel:0, deposited:0, ever_lit:true` | `tests/fuel.test.mjs`, `scenarios/15-lantern-out*` | Đạt |
| 1e | Thắp lại đèn đã từng sáng chỉ tốn 5 đom đóm | `lantern_lit {relight: true}` với 5 đom đóm, `relit_count: 1`, điểm +40+25 | `tests/fuel.test.mjs`, `scenarios/15-lantern-out*` | Đạt |
| 2a | Đèn `fuel < 30` mất vùng an toàn; đúng 30 vẫn còn | Bóng Mực đi vào được đèn dầu 20; bị giữ ở mép 6 m với đèn dầu 30,0 (đo ở tick 1) | `tests/fuel.test.mjs` | Đạt |
| 2b | Bóng Mực `wander` chọn đèn yếu gần nhất (hoà → id nhỏ) | Bóng đi tới đèn `fuel < 30` gần nhất, `target_lantern_id` đúng | `tests/fuel.test.mjs`, `scenarios/16-shade-drain*` | Đạt |
| 2c | Cách đèn ≤ 2 m → trạng thái `drain`, hút 5 dầu/giây, nhiều con cộng dồn | Đo tốc độ mất dầu 6,0/giây (5 hút + 1 hao) khi đang `drain`; 2 bóng cộng dồn (xem test) | `tests/fuel.test.mjs` | Đạt |
| 2d | Từ `drain`: → `chase` khi Mây ≤ 6 m; → `stunned` khi trúng Tỏa Sáng; → `wander` khi đèn tắt / dầu ≥ 30 / cách > 2 m | 4 test chuyển trạng thái | `tests/fuel.test.mjs` | Đạt |
| 2e | Châm đèn ≥ 30 khi có bóng trong 6 m → đẩy ra mép, không sát thương | Vùng an toàn cập nhật ngay sau bước châm dầu | `tests/fuel.test.mjs` | Đạt |
| 2f | `fuel_drain {lantern_id, shade_id, fuel}` mỗi 60 tick | Chuỗi event cách nhau đúng 60 tick | `tests/fuel.test.mjs`, `scenarios/16-shade-drain*` | Đạt |
| 3a | Thời lượng đêm 240 / 270 / 300 s | `time_left_s` tick 0 của ba đêm | `tests/features.test.mjs`, `tests/cli.test.mjs` | Đạt |
| 3b | Thắng = sống tới bình minh **và** đèn sáng ≥ `ceil(0.6 × tổng)` | 3/5 → `won/dawn_survived`; 2/5 → `lost/dawn`; 5/5 không kết thúc đêm sớm | `tests/sim.test.mjs`, `scenarios/17-dawn-survived*` | Đạt |
| 3c | Hết Ngọn Lửa luôn thua, kể cả khi đủ đèn | `flames: 0` + mọi đèn sáng → `lost/no_flames` | `tests/sim.test.mjs` | Đạt |
| 3d | `all_lit` không còn dùng | Không còn test/code nào phát `all_lit`; `GameOverReason` chỉ còn 3 giá trị | `tests/sim.test.mjs`, `src/core/types.ts` | Đạt |
| 4 | Sức chứa = 10 + 2 × số lần thắng, tối đa 20, reset mỗi đêm | Sau 1 lần thắng: 12; `successful_lights: 4` → 18; 6 → trần 20; 15 đom đóm chỉ nhặt được 12 | `tests/fuel.test.mjs`, `scenarios/18-capacity*` | Đạt |
| 5a | Điểm +5 mỗi đom đóm nạp; +100 thắp lần đầu; +40 thắp lại | Điểm sau mỗi hành động khớp công thức | `tests/fuel.test.mjs` | Đạt |
| 5b | Tỏa Sáng: +5/con, +15 nếu đang `drain` | Bóng đang `drain` → 20 điểm; đang `chase` → 5 điểm | `tests/fuel.test.mjs`, `scenarios/03-pulse-stun*` | Đạt |
| 5c | Bình minh: `50 + floor(dầu)` mỗi đèn sáng, `+50` mỗi Ngọn Lửa | Tính lại từ snapshot cuối: khớp tuyệt đối | `tests/fuel.test.mjs`, `scenarios/17-dawn-survived*` | Đạt |
| 5d | Bỏ thưởng thời gian | Đêm đứng yên 100 s → 0 điểm | `tests/fuel.test.mjs` | Đạt |
| 6a | Chế độ mù màu: viền Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + ⚠ | Hai màu có trong `PALETTE`, `hud.colorblind` đổi màu cảnh báo | `tests/contract.test.mjs`, `screens/06`, `screens/07` | Đạt |
| 6b | Đèn tắt/sáng phân biệt không cần màu: tắt xẹp 20% + vết rách; sắp cạn nhấp nháy | `entities.ts`: `scale 0.8` + `rip.visible`, nhấp nháy 1 Hz khi `< 30` | `screens/04-lantern-fuel.png` | Đạt |
| 7a | `contract_version: "1.2"` + 8 khoá tuning mới | Deep-equal `tuning` với `TUNING`; key set khớp | `tests/contract.test.mjs` | Đạt |
| 7b | Snapshot: `fuel`, `ever_lit`, `relit_count`, `player.capacity`, trạng thái `drain` | `verify.mjs` validate schema + test từng trường | `verify-report.md` | Đạt |
| 7c | Scenario: `lanterns.{fuel, ever_lit}`, `player.successful_lights`, `shades.target_lantern_id` | Scenario dùng mọi trường; 14 ca sai định dạng thoát mã 2 | `tests/cli.test.mjs` | Đạt |
| 7d | Event mới: `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`, `dawn_survived` | Mỗi event có test riêng | `tests/fuel.test.mjs` | Đạt |
| 7e | `lanterns.lit: true` không có `fuel` ⇒ mặc định 100 | Snapshot đèn đặt sẵn `lit` hiện `fuel: 100` | `tests/fuel.test.mjs` | Đạt |
| DoD-1 | Bằng chứng game chạy đúng | `npm run verify` PASS + 8 ảnh bot chơi thật | thư mục này | Đạt |
| DoD-2 | ADR mô tả mô hình trạng thái đèn và luật thắng | [ADR-001](../../notes/adr-001-lantern-fuel.md) | — | Đạt |
| DoD-3 | Test cũ bị luật mới làm sai được cập nhật/xoá có lý do | Bảng trong [CHANGELOG](../../../CHANGELOG.md) mục Phase 3 | `git log -p CHANGELOG.md` | Đạt |
| DoD-4 | Changelog có breaking changes | Mục "⚠ Breaking changes" (7 nhóm) | [CHANGELOG](../../../CHANGELOG.md) | Đạt |
| DoD-5 | Test ẩn Phase 1–2 không bị thay thế vẫn đạt | Các luật không đổi vẫn nguyên test: di chuyển, nhảy, lướt, tỏa sáng, va chạm, rơi, Gió Lạc, Bùa Gió, gió, pause, tất định, CLI | `tests/` (108 test xanh) | Đạt |

## 3. Hiệu năng (fps.json)

| Lần đo | FPS | p95 khung hình | Worst |
|---|---:|---:|---:|
| night-1 | 60,0 | 16,7 ms | 16,8 ms |
| night-2 | 60,0 | 16,8 ms | 16,8 ms |
| night-3 | 59,3 | 16,8 ms | 149,9 ms |
| night-3-full-load | 60,0 | 16,8 ms | 16,8 ms |
| **Trung bình** | **59,8** | | |

Renderer: GPU thật qua ANGLE/D3D11 (Intel Iris Xe). Thanh dầu và vòng cảnh báo thêm vào không làm giảm khung hình.

## 4. Ảnh chụp

| Ảnh | Cho thấy gì |
|---|---|
| `screens/01-menu.png` | Menu chính |
| `screens/02-night1-intro.png` | Giới thiệu Đêm 1 |
| `screens/03-night1-play.png` | Chơi thật bằng bàn phím: HUD, thanh đom đóm theo sức chứa `1/10` |
| `screens/04-lantern-fuel.png` | **Thanh dầu** cạnh đèn L1 (77,7) và L2 (17,7) + **cảnh báo "⚠ L2 sắp cạn dầu"**; HUD `2/5` đèn, thanh đom đóm `6/10` |
| `screens/05-shade-drain.png` | **Bóng Mực đang hút dầu** L1 (còn 8,5) — đèn yếu nên mất vùng an toàn |
| `screens/06-settings-colorblind.png` | Cài đặt có "Bảng màu dễ phân biệt" |
| `screens/07-colorblind-gameplay.png` | Chế độ mù màu đang bật (viền Bóng Mực xanh `#00B3FF`, cảnh báo trắng) |
| `screens/08-night3.png` | Đêm 3 vẫn chạy đúng sau các thay đổi |

`playthrough.json` ghi nhật ký (`fuel bar: L1=77.7 L2=17.7`, `drain: S1 drain → L1`), `console.log` **rỗng lỗi**.

## 5. Điều chưa đạt / còn hạn chế

- **Video demo** chưa có (Phase 4).
- **Bình minh thắng cả 3 đêm** trong trình duyệt chưa có ảnh; luật thắng từng đêm đã có test + scenario `17-dawn-survived` (log: `won / 3 ticks / score 457`).
- **Chỉ báo Bóng Mực đang hút dầu ngoài khung hình** chưa có (chỉ thấy khi nó trong tầm nhìn) — ghi vào retro để cân nhắc.
- Hai cảnh dầu trong ảnh được dựng bằng **scenario qua hook debug** (`__dao.startNight(night, scenario)`) — cùng định dạng scenario của contract và cùng luật chạy; phần chơi tự do ở ảnh 01–03 thì hoàn toàn bằng bàn phím.
