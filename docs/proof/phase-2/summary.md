# Bằng chứng Phase 2

Tag: `phase-2`. Mọi số liệu dưới đây sinh ra bằng `npm run verify`, `scripts/shots.mjs` (bot chơi thật) và `scripts/fps.mjs` (đo FPS thật); không có output nào được sửa tay.

## 1. Tổng quan

| Hạng mục | Kết quả |
|---|---|
| Build | typecheck + core + headless + web: **PASS** |
| Test tự động | **89/89 pass** (contract, sim, features, CLI) |
| Scenario headless | **12/12 đúng schema v1.1**, trong đó 1 ca kiểm tra mã thoát 2 |
| Tính tất định | Hai lần chạy cùng seed: **giống nhau từng byte** |
| Bundle headless đã commit | **khớp** với `src/` |
| Chạy trọn 1 đêm 21.600 tick (CLI) | **dưới 1 giây** (yêu cầu ≤ 30 s) |
| Hiệu năng bản thường | **59,7 FPS trung bình** ở 1280×720 (yêu cầu ≥ 30) |
| Bảng màu chuẩn | Đủ **20/20 màu** trong `src/core/config.ts` |
| Chơi thật trong trình duyệt | menu → giới thiệu → chơi → **thua thật** → chơi lại → Đêm 2 → Đêm 3, **không có page error** |

Báo cáo đầy đủ: [verify-report.md](verify-report.md) · FPS: [fps.json](fps.json) · Ảnh: [screens/](screens/)

## 2. Truy vết yêu cầu → cách kiểm chứng → bằng chứng

Mỗi dòng dưới đây ứng với một mục `AC-n` trong [spec Phase 2](../../notes/spec-phase-2.md).

| # | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| AC-1 | Chạy 6,0 m/s | Đi 1 s từ đứng yên = đúng 6,000 m | `tests/sim.test.mjs` | Đạt |
| AC-2 | Nhảy 7,0 m/s, g −20, chỉ khi chạm đất | `vy` sau 1 tick = 6,667; nhấn giữa không trung không tăng tốc | `tests/sim.test.mjs` | Đạt |
| AC-3 | Lướt 14 m/s / 0,2 s / hồi 1,5 s | 12 tick lướt = 2,800 m; tick 89 bị từ chối, tick 90 được | `tests/features.test.mjs`, `scenarios/02-dash*` | Đạt |
| AC-4 | Lướt trên không giữ độ cao, không bất tử | `pos.y` không đổi 10 tick liền; vẫn mất lửa khi bị chạm | `tests/features.test.mjs` | Đạt |
| AC-5 | Hướng lướt = hướng mặt khi đứng yên | Đi +X 10 tick rồi lướt khi thả phím → lướt theo +X | `tests/features.test.mjs` | Đạt |
| AC-6 | Mang 10, đèn 10, nạp nhiều lần, nhớ tiến độ | Nạp 6 → 6/10; nạp tiếp 4 → đèn sáng | `tests/sim.test.mjs` | Đạt |
| AC-7 | Nhặt XZ ≤ 1,0 m, chênh cao ≤ 1,5 m | Biên 1,0 m nhặt ở tick 1; đom đóm cao 2 m không nhặt | `tests/sim.test.mjs` | Đạt |
| AC-8 | 20 con lúc đầu, trần 30, +1 mỗi 240 tick | Tick 0: 20; tick 240: 21; Đêm 3: chạm trần 30 | `tests/sim.test.mjs` | Đạt |
| AC-9 | Tương tác 2,0 m, chọn đèn gần nhất, hoà → id nhỏ | 2 đèn cách đều → nạp vào L1 | `tests/sim.test.mjs` | Đạt |
| AC-10 | Vùng an toàn 6 m, đẩy ra, không sát thương | Bóng Mực bị giữ ở mép, 0 `player_hit` | `tests/sim.test.mjs`, `scenarios/03*` | Đạt |
| AC-11 | Tỏa sáng 3 đom đóm / 5 m / 3 s | Mang 2 → không có `pulse`; mang 9 → trừ 3, hồi chiêu 1,35 s ở tick 100 | `tests/sim.test.mjs`, `scenarios/03-pulse-stun*` | Đạt |
| AC-12 | Tâm +0,8 m, chọn mục tiêu 3D ≤ 5 m | Bóng cách 4 m ngang + 2 m cao → trúng; 5,5 m + 3 m cao → trượt | `tests/sim.test.mjs` | Đạt |
| AC-13 | Choáng 120 tick, đẩy 4 m trong 15 tick | Tick 15: bóng ở +4,000 m; tick 120 còn choáng, 121 hết | `tests/sim.test.mjs` | Đạt |
| AC-14 | Bóng Mực 4,0 (Đ3 4,5) m/s, 12 m / 18 m | Đi 4 m trong 1 s; 15 m vẫn đuổi, 25 m bỏ | `tests/sim.test.mjs` | Đạt |
| AC-15 | Chạm XZ 1,0 m, cao 1,5 m, tối đa 1 lửa/tick, recoil 2 m/60 tick | 2 bóng cùng chạm → chỉ 1 lửa; bóng vào `recoil` | `tests/sim.test.mjs` | Đạt |
| AC-16 | 2 con tick 300, sau đó 1 mỗi 480, id S1… | `shade_spawned` tại 300, 300, 780 | `tests/sim.test.mjs`, `scenarios/11*` | Đạt |
| AC-17 | Rơi `floor(mang/2)` ra vành 1,5–2,5 m, TTL 480, nhặt từ tick sau, bất tử 90 | 4 mang → rơi 2, cách 1,5–2,5 m, `kind: dropped` | `tests/sim.test.mjs` | Đạt |
| AC-18 | Rơi Y < −10: −1 lửa + mất hết đom đóm, chờ 60 tick, hồi sinh, bất tử 90 | `player_hit` có `by:"fall"`, `lost:4`, hồi sinh ở (0,0) | `tests/sim.test.mjs`, `scenarios/04*` | Đạt |
| AC-19 | 3 Ngọn Lửa, hồi đầy mỗi đêm | Tick 0 mỗi đêm: `flames: 3` | `tests/cli.test.mjs` | Đạt |
| AC-20 | 300 / 330 / 360 s | `time_left_s` tick 0 của 3 đêm | `tests/features.test.mjs`, `tests/cli.test.mjs` | Đạt |
| AC-21 | Thứ tự thắng/thua | Đèn thứ 5 sáng đúng tick hết giờ → `won`; hết giờ → `dawn`; hết lửa → `no_flames` (kể cả khi đã đủ đèn) | `tests/sim.test.mjs` | Đạt |
| AC-22 | Điểm: +10/đom đóm nạp, +100/đèn, +5/Bóng Mực, thưởng khi thắng | Điểm cuối khớp tổng các nguồn | `tests/sim.test.mjs` | Đạt |
| AC-23 | Đêm 1: đảo 40 m, 5 đèn đúng toạ độ, ra ngoài là rơi | `groundAt` 39,9 m = 0; 40,1 m = void; toạ độ đèn khớp ticket | `tests/contract.test.mjs`, `tests/features.test.mjs` | Đạt |
| AC-24 | Đêm 2: 2 đảo 28 m + cầu tre x∈[26,44], \|z\|≤2, 6 đèn | Cầu đi được, mép cầu rơi, 6 đèn | `tests/features.test.mjs` | Đạt |
| AC-25 | Bục nhảy Đêm 2: vy 14, ngang 24, bay ≈1,4 s | Sau 90 tick đứng ở x ≈ 51,6 trên Đảo B | `tests/features.test.mjs`, `scenarios/06*` | Đạt |
| AC-26 | Đêm 3: 3 tầng, vách, 2 dốc, bục (0,3,13), tháp chuông | Cao độ đúng vùng; dốc đi lên được; tường chặn không cho leo; bục đưa lên tầng 2 | `tests/features.test.mjs`, `scenarios/09*` | Đạt |
| AC-27 | 30 điểm đom đóm, 16 điểm Bóng Mực, 7 đèn | Đếm trong `NIGHT_MAPS[3]` | `tests/contract.test.mjs` | Đạt |
| AC-28 | Gió Đêm 3: 5 s mỗi 30 s, báo trước 2 s, đẩy 2 m/s | `wind.active` đúng cửa sổ 480–780; đứng yên bị đẩy 10 m trong 5 s | `tests/features.test.mjs`, `scenarios/10*` | Đạt |
| AC-29 | Gió Lạc 7 m/s, tối đa 2, sinh tick 1200/2400, id D1… | Snapshot Đêm 2 có `drifters` đúng id | `tests/features.test.mjs` | Đạt |
| AC-30 | idle 2 m/s → chase khi mang ≥ 5 và ≤ 15 m | Đổi trạng thái đúng hai ngưỡng | `tests/features.test.mjs` | Đạt |
| AC-31 | Cướp `min(3, mang)` rồi flee 240 tick và biến mất | `drifter_steal` amount 3, carried 8 → 5; sau đó `drifters` rỗng | `tests/features.test.mjs`, `scenarios/07*` | Đạt |
| AC-32 | Tỏa sáng: chase → flee không cướp; flee có đồ → `drifter_drop` | 2 test riêng, đủ event và 3 đom đóm rơi | `tests/features.test.mjs` | Đạt |
| AC-33 | Bùa Gió 600 tick, 7,2 m/s, lướt không hồi chiêu, sinh lại 2700 tick | `charm_s` = 10 khi nhặt; 2 lần lướt liên tiếp được; `respawn_s` đếm | `tests/features.test.mjs`, `scenarios/08*` | Đạt |
| AC-34 | Chuỗi 3 đêm + Bình Minh, thua thì chơi lại đêm đó | Bot đi menu → giới thiệu → chơi → **thua thật** → chơi lại → Đêm 2 → Đêm 3 | ảnh `01`, `02`, `06`, `07`, `08`, `10` | Đạt |
| AC-35 | Tạm dừng dừng hoàn toàn, `sim_tick`/giờ/hồi chiêu/TTL đứng yên | Tick 19 vẫn là `sim_tick` 10, `time_left_s` không đổi, `state: paused` | `tests/features.test.mjs`, `scenarios/05*` | Đạt |
| AC-36 | Cài đặt âm lượng + độ nhạy lưu giữa các lần mở | `localStorage` (`dao-den-long.settings.v1`) | `src/render/main.ts` | Đạt (kiểm tra bằng code) |
| AC-37 | Nhạc nền + 10 hiệu ứng | 3 tầng dao động nền + 11 hàm hiệu ứng | `src/render/audio.ts`, console sạch trong `screens/console.log` | Đạt |
| AC-38 | HUD đầy đủ | Bot đọc DOM: `flames=●●○`, `clock=04:40`, `lanterns=0/5`, `score=50`, `motes=4/10`, thanh 10 ô, 2 icon hồi chiêu, mũi tên vàng | ảnh `03`, `05`; `screens/playthrough.json` | Đạt |
| AC-39 | Bảng màu chuẩn, sai lệch ≤ 10% | Verify so 20 mã màu trong code | `verify-report.md` | Đạt |
| AC-40 | Ánh sáng = 0,15 + 0,55 × (sáng/tổng) | `ambientForLit` + test giá trị | `tests/contract.test.mjs` | Đạt |
| AC-41 | `contract_version: "1.1"`, tuning khớp, đủ 5 khoá mới | Deep-equal `tuning` với `TUNING` | `tests/contract.test.mjs` | Đạt |
| AC-42 | `--night` 1, 2, 3 | Ba đêm chạy được; `--night 4` thoát mã 1 | `tests/cli.test.mjs` | Đạt |
| AC-43 | Snapshot v1.1 đầy đủ trường | `verify.mjs` validate từng đêm + `tests/cli.test.mjs` | `verify-report.md` | Đạt |
| AC-44 | Scenario v1.1 đầy đủ trường | 1 scenario dùng mọi trường mới; 14 ca sai định dạng thoát mã 2 | `tests/cli.test.mjs` | Đạt |
| AC-45 | Input thêm `dash`, `pause` | `scenarios/02-dash*`, `scenarios/05-pause*` | `verify-report.md` | Đạt |
| AC-46 | Event mới đủ 7 tên (+`lost`) | Có test cho từng event | `tests/sim.test.mjs`, `tests/features.test.mjs` | Đạt |
| AC-47 | Trạng thái Bóng Mực đúng 5 tên | Quét 1.800 tick, chỉ thấy 5 tên | `tests/sim.test.mjs` | Đạt |
| AC-48 | 1 đêm 21.600 tick ≤ 30 s | Đo trong test và trong `verify.mjs` | `verify-report.md` | Đạt |
| AC-49 | Bằng chứng game chạy đúng | `npm run verify` PASS + 10 ảnh bot chơi thật | thư mục này | Đạt |
| AC-50 | Test Phase 1 vẫn đạt với số chuẩn | Bộ test cũ được viết lại theo v1.1, 89/89 xanh | `tests/` | Đạt |
| AC-51 | Spec có acceptance criteria | [spec-phase-2.md](../../notes/spec-phase-2.md) | — | Đạt |
| AC-52 | AGENTS.md + skill cập nhật, có trong git | Commit riêng cho harness | `git log -- AGENTS.md` | Đạt |
| AC-53 | ≥ 1 scenario mỗi tính năng mới | 12 scenario trong `scenarios/manifest.json` | `verify-report.md` | Đạt |
| AC-54 | ≥ 30 FPS ở 1280×720 | Đo bằng Chromium + GPU thật: **59,7 FPS** | [fps.json](fps.json) | Đạt |

## 3. Hiệu năng (fps.json)

| Lần đo | FPS | p95 khung hình | Worst |
|---|---:|---:|---:|
| night-1 | 60,0 | 16,8 ms | 16,8 ms |
| night-2 | 60,0 | 16,8 ms | 16,8 ms |
| night-3 | 58,8 | 16,7 ms | 166,7 ms |
| night-3-full-load | 60,0 | 16,7 ms | 16,8 ms |
| **Trung bình** | **59,7** | | |

Renderer: `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, Direct3D11)` — tức GPU thật, không phải SwiftShader. Ghi chú: nếu đo bằng Chromium mặc định (SwiftShader, không GPU) thì chỉ được 3–5 FPS; đó là giới hạn của software rasteriser chứ không phải của game.

## 4. Ảnh chụp (bot chơi thật, seed 202603417)

| Ảnh | Cho thấy gì |
|---|---|
| `screens/01-menu.png` | Menu chính + điểm cao nhất + hướng dẫn phím |
| `screens/02-night1-intro.png` | Màn giới thiệu Đêm 1 (tên đảo, lời Ông Đăng) |
| `screens/03-night1-play.png` | Đêm 1 đang chơi: HUD, đom đóm, Bóng Mực, cây/đá |
| `screens/05-hud.png` | HUD đầy đủ: lửa, đồng hồ, đèn 0/5, điểm 50, thanh 10 ô, 2 icon hồi chiêu |
| `screens/06-result.png` | Màn kết quả khi **thua thật** (rơi 3 lần hết lửa) |
| `screens/07-restart.png` | Bấm "Chơi lại đêm này" → vào lại đêm |
| `screens/08-night2-islands.png` | Đêm 2: hai đảo, cầu tre, bục nhảy |
| `screens/09-night2-view.png` | Đêm 2 nhìn từ hướng khác |
| `screens/10-night3-tiers.png` | Đêm 3: vách tầng 1, vành sáng mép tầng, HUD Đêm 3 (0/7) |

`playthrough.json` ghi lại nhật ký lượt chơi; `console.log` **rỗng lỗi** (không có `pageerror`).

## 5. Cách tự chạy lại

```bash
npm install && npm run build
npm test                                   # 89 test
npm run verify                             # sinh lại toàn bộ mục 1–2
node dist/headless/main.js --seed 3 --night 2 --ticks 900 --out out.jsonl
node scripts/fps.mjs http://localhost:5173/ docs/proof/phase-2/fps.json
```

## 6. Điều chưa đạt / còn hạn chế

- **Video demo** chưa có: theo kế hoạch Phase 4 mới phát hành `v1.0.0` kèm video.
- **Bình Minh (thắng cả 3 đêm liên tiếp trong trình duyệt)** chưa có ảnh: bot chỉ chơi trọn Đêm 1 (thua có chủ đích để chụp màn kết quả) rồi mở Đêm 2 và Đêm 3 để chụp bản đồ. Luật thắng từng đêm đã có test headless; màn Bình Minh sẽ được quay trong video Phase 4.
- **Cài đặt (âm lượng, độ nhạy)** kiểm bằng code + `localStorage`, chưa có ảnh chụp màn Cài đặt.
- **Tháp chuông** là vật thể trang trí không chặn đường (ticket không định nghĩa va chạm cho nó) — đã ghi trong giả định.
