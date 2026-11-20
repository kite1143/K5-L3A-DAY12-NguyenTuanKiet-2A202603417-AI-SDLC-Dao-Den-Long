# Đảo Đèn Lồng — Giữ đảo sáng tới bình minh

> Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây.
> Đèn đã tắt, sương đen đã nuốt ánh sáng — và giờ **đèn cháy rồi vẫn cạn dầu**. Hãy giữ đủ đèn sáng cho tới bình minh, qua ba đêm, ba hòn đảo.

**Video demo:** _(sẽ đính kèm Release `v1.0.0` ở Phase 4 — chưa có video trong repo)_

| | |
|---|---|
| Phase hiện tại | **Phase 3 — Ticket-03, contract v1.2** |
| Tag | `phase-3` |
| Bằng chứng | [docs/proof/phase-3/](docs/proof/phase-3/summary.md) |
| ADR (quyết định thiết kế) | [docs/notes/adr-001-lantern-fuel.md](docs/notes/adr-001-lantern-fuel.md) |
| Spec Phase 2 + AC | [docs/notes/spec-phase-2.md](docs/notes/spec-phase-2.md) |
| Nhật ký AI & giả định | [docs/notes/](docs/notes/ai-journal.md) |

---

## Cài đặt và chạy (3 lệnh)

```bash
npm install
npm run build
npm run start          # mở http://localhost:5173
```

Đây là **bản web**, nên chạy được trên macOS, Linux và Windows mà không cần cài engine nào — chỉ cần Node.js ≥ 20 và một trình duyệt có WebGL2.

Đang phát triển thì dùng `npm run dev`. Tham số tuỳ chọn `?seed=202603417` để chơi lại đúng một bộ đảo.

## Điều khiển

| Phím | Việc |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera) |
| `Space` | Nhảy (7 m/s, chỉ khi chạm đất) |
| `Shift` | **Lướt**: 14 m/s trong 0,2 s, hồi 1,5 s |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn đang đứng gần |
| `F` | **Tỏa sáng**: 3 đom đóm, làm choáng và đẩy Bóng Mực |
| Kéo chuột | Xoay camera |
| `Esc` / `P` | Tạm dừng (Tiếp tục / Chơi lại đêm / Cài đặt / Về menu) |
| `Enter` | Chọn nút chính của màn đang hiện |
| `M` | Âm lượng nằm trong Cài đặt (được lưu lại giữa các lần mở) |

## Ba đêm

| Đêm | Đảo | Thời lượng | Đèn | Ngưỡng thắng | Điểm nhấn |
|---|---|---:|---:|---:|---|
| 1 | **Đảo Bến** — đảo tròn bán kính 40 m | 240 s | 5 | 3/5 | Làm quen luật cơ bản |
| 2 | **Đảo Cau** — hai đảo bán kính 28 m nối bằng **cầu tre**, tâm (0,0,0) và (70,0,0) | 270 s | 6 | 4/6 | **Bục nhảy** (14 m/s lên, 24 m/s ngang); **Gió Lạc**; **Bùa Gió** trên cầu |
| 3 | **Đảo Chuông** — ba tầng (0 m, 3 m ở vành 12–24 m nửa z>0, 6 m ở đĩa tâm bán kính 8 m) | 300 s | 7 | 5/7 | **Hai dốc** 30°/150°, **bục nhảy** lên tầng 2, **tháp chuông**, **gió mạnh** mỗi 30 s |

## Luật chơi (số liệu chuẩn contract v1.2)

- **Di chuyển 6,0 m/s** (tăng tốc tức thời), nhảy 7,0 m/s với trọng lực −20 m/s², lướt 14 m/s trong 0,2 s.
- **Đom đóm**: nhặt tự động khi cách ≤ 1,0 m và chênh cao ≤ 1,5 m. Bắt đầu 20 con, trần 30, thêm 1 con mỗi 4 giây nếu còn điểm trống.
- **Sức chứa**: 10 + 2 × số lần thắp đèn thành công trong đêm, **tối đa 20** (đèn đặt sẵn bằng scenario không tính).
- **Đèn có dầu**: tối đa **100**, hao **1/giây** khi đang sáng.
  - Thắp lần đầu tốn **10** đom đóm; **thắp lại** đèn đã từng sáng chỉ tốn **5**.
  - Đèn đang sáng mà chưa đầy: bấm `E` để **châm dầu**, mỗi đom đóm +10 dầu (`used = min(đang mang, ceil((100 − dầu)/10))`).
  - Dầu về 0 ⇒ đèn **tắt**, tiến độ thắp lại về 0, nhưng đèn nhớ "đã từng sáng".
  - Dầu < 30: đèn **nhấp nháy chậm** và **mất vùng an toàn**.
- **Vùng an toàn**: đèn sáng có dầu ≥ 30 tạo vòng bán kính **6 m**; Bóng Mực bị chặn ở mép và không gây sát thương trong đó.
- **Bóng Mực hút dầu**: con đang `wander` sẽ đi tới đèn **yếu gần nhất** (dầu < 30), đứng cách ≤ 2 m và hút **5 dầu/giây** (nhiều con cộng dồn). Nó bỏ hút khi Mây lại gần ≤ 6 m, khi đèn tắt, khi đèn được châm lên ≥ 30, hoặc khi bị đẩy ra.
- **Chạm**: XZ ≤ 1,0 m và chênh cao ≤ 1,5 m ⇒ mất 1 Ngọn Lửa, rơi `floor(mang/2)` đom đóm, bất tử 90 tick.
- **Rơi khỏi đảo** (Y < −10): mất 1 Ngọn Lửa và toàn bộ đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát.
- **Gió Lạc** (Đêm 2–3) và **Bùa Gió** giữ nguyên như Phase 2 (xem [CHANGELOG](CHANGELOG.md)).
- **Thắng**: khi **hết giờ** mà Mây còn sống **và** số đèn đang sáng ≥ `ceil(0,6 × tổng)` — Đêm 1 cần 3/5, Đêm 2 cần 4/6, Đêm 3 cần 5/7. **Không còn thắng sớm** khi thắp đủ đèn.
- **Thua**: hết 3 Ngọn Lửa (bất kỳ lúc nào, kể cả tick cuối), hoặc hết giờ mà dưới ngưỡng.

### Cách tính điểm

| Sự kiện | Điểm |
|---|---:|
| Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại, châm dầu) | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 (+15 nếu nó đang hút dầu) |
| **Bình minh (khi thắng):** mỗi đèn còn sáng | +50 + `floor(dầu)` |
| **Bình minh (khi thắng):** mỗi Ngọn Lửa còn lại | +50 |

Không còn thưởng theo thời gian. Tổng điểm của một lượt chơi là tổng điểm các đêm đã thắng; điểm cao nhất lưu trong trình duyệt.

### Trợ năng

Cài đặt có **"Bảng màu dễ phân biệt"** (được lưu): viền/mắt Bóng Mực chuyển `#00B3FF`, màu cảnh báo chuyển trắng kèm ⚠, và trạng thái đèn còn phân biệt được **không cần màu** — đèn tắt xẹp 20% và có vết rách, đèn sắp cạn thì nhấp nháy.

## Chế độ headless (Test Contract v1.2)

`game.contract.json` ở gốc repo khai báo mọi tham số và lệnh:

```bash
node dist/headless/main.js --seed 202603417 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/14-refuel.scenario.json] \
  [--inputs  scenarios/14-refuel.inputs.json] \
  [--snapshot-every 10]
```

- `--night` nhận **1, 2, 3**; logic chạy cố định 60 tick/giây, không cửa sổ, không GPU.
- Mã thoát: `0` thành công, `2` file scenario/inputs sai định dạng, `1` lỗi khác.
- Snapshot v1.2: thêm `lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`; Bóng Mực có thêm trạng thái `drain`; `fuel` xuất 1 chữ số thập phân.
- Scenario v1.2: `lanterns[].{lit, fuel, ever_lit}`, `player.successful_lights`, `shades[].target_lantern_id`.
- Event mới: `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`, `fuel_drain {lantern_id, shade_id, fuel}` (mỗi 60 tick khi đang hút); `lantern_lit` có thêm `relight`; `game_over.reason` có `dawn_survived`.
- Cùng seed + cùng scenario + cùng inputs → output **giống hệt nhau**; một đêm đầy đủ 18.000 tick chạy dưới 1 giây (yêu cầu ≤ 30 s).

## Benchmark và soak test (contract v1.3)

```bash
# cảnh chuẩn: 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng, camera bay vòng 30 m
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json

# 10 đêm liên tiếp trong một tiến trình, input ngẫu nhiên theo seed
node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
```

Với `bench_cmd`/`soak_cmd` trong `game.contract.json` (`npm run bench`, `npm run soak`). Số đo trên máy này: [docs/proof/phase-4/](docs/proof/phase-4/summary.md). `peak_mem_mb` là `null` vì trang web không đọc được RSS tiến trình; `vsync_off` bật được nhờ cờ Chromium `--disable-gpu-vsync --disable-frame-rate-limits`.

## Trạng thái Phase 4 (ghi trung thực)

| Yêu cầu | Trạng thái |
|---|---|
| Benchmark + `bench.json` | Xong (`avg_fps` 69,7 · `p1_low_fps` 26,9 · `load_ms` 234) |
| Soak test + `soak.json` | Xong (0 crash, 54 → 63 MB) |
| Bảng xếp hạng cục bộ + `--export-leaderboard` | **Chưa làm** |
| Trợ năng (đổi phím, chỉ báo, giảm chuyển động, cỡ chữ) | **Chưa làm** (mới có chế độ mù màu) |
| Video demo `.mp4` + Release `v1.0.0` | **Chưa làm** |

## Kiểm thử

```bash
npm test        # 108 test: hợp đồng, mô phỏng, nhiên liệu đèn, tính năng, CLI
npm run verify  # build + test + 18 scenario + tất định + palette → docs/proof/<phase>/
```

Đo hiệu năng (cần cài Playwright, không nằm trong dependencies):

```bash
npm install --no-save playwright && npx playwright install chromium
node scripts/fps.mjs http://localhost:5173/ docs/proof/phase-2/fps.json
```

Kết quả trên máy này (Chromium, WebGL tăng tốc phần cứng, 1280×720): **59,7 FPS trung bình** (yêu cầu ≥ 30).

## Cấu trúc

```text
game.contract.json      khai báo contract v1.1 + tuning đang dùng
src/core/               logic game thuần TypeScript (không import three/DOM)
  config.ts             TUNING chuẩn hoá + bảng màu + công thức ánh sáng
  nights.ts             bản đồ 3 đêm: đảo, cầu, tầng, dốc, bục nhảy, điểm sinh
  world.ts step.ts      dựng thế giới và mô phỏng một tick (đúng thứ tự 10 bước)
  runner.ts             vòng chạy headless + serialize JSONL v1.1
  scenario.ts inputs.ts đọc và kiểm tra file scenario/inputs v1.1
src/headless/main.ts    CLI theo Test Contract v1.1 (bundle đã commit ở dist/headless/)
src/render/             Three.js: địa hình 3 đêm, HUD, menu/pause/settings, âm thanh
  assets.ts             tải prop .glb + fallback về mesh thủ tục
public/models/          prop low-poly (Polyfork, CC BY 4.0 — xem CREDITS.md)
tests/                  node:test: contract, sim, features, cli
scenarios/              scenario + inputs tái lập được, có manifest
scripts/verify.mjs      kiểm chứng một lệnh, sinh docs/proof/<phase>/
scripts/shots.mjs       bot chơi thật trong Chromium và chụp ảnh bằng chứng
scripts/fps.mjs         đo FPS trung bình ở 1280×720
scripts/fetch-assets.mjs tải lại prop ngoài (npm run assets)
docs/notes/             spec, giả định, nhật ký dùng AI, retro
docs/proof/             bằng chứng từng phase
docs/lab/               tài liệu gốc của lab (giữ nguyên để tham chiếu)
```

## Sáng tạo của tôi (ngoài phần lõi)

Những thứ thêm vào không làm đổi một dòng nào của mô phỏng headless:

1. **Chiếc đèn lồng nhỏ treo trên nón lá** của Mây, kèm quầng sáng ấm.
2. **Vòng an toàn phát sáng** quanh mỗi đèn đã thắp — vẽ đúng bán kính `safe_radius` 6 m.
3. **Đảo sáng dần theo số đèn** theo đúng công thức `0,15 + 0,55 × (đèn sáng / tổng đèn)`.
4. **Âm thanh tổng hợp bằng WebAudio**: nhạc nền đêm (drone 3 tầng) + 11 hiệu ứng, không có file asset nào.
5. **Ông Đăng dẫn chuyện** ở đầu mỗi đêm, tiếng Việt, để ba hòn đảo có mạch.
6. **Bùa Gió và Gió Lạc** vẽ bằng hình học thuần (dải lụa bán nguyệt, lá bùa đỏ viền vàng — đúng bảng màu chuẩn).
7. **Mũi tên chỉ đèn gần nhất** khi nó ở ngoài khung hình, để người chơi không lạc trên Đảo Chuông ba tầng.
8. **Thanh dầu 3D** cạnh mỗi đèn đang sáng, đổi màu và nhấp nháy 1 Hz khi sắp cạn — để người chơi thấy được luật mới mà không phải mở HUD.
9. **Đảo Bến có bến thật**: lều người giữ bến, thuyền mộc, thông, đá, nấm phát sáng — 6 prop low-poly của **Polyfork, CC BY 4.0** (xem [CREDITS](CREDITS.md)). Nhân vật Mây vẫn là hình học tự dựng để giữ đúng "nón lá có treo đèn lồng nhỏ".

### Vì sao asset không thể phá Test Contract

`src/render/assets.ts` chỉ được `src/render/**` import; `src/core` và `src/headless` không biết asset tồn tại. Model tải lỗi thì `placeProp` trả `null` và cảnh quay về mesh thủ tục. Đã kiểm chứng: `npm run verify` vẫn PASS sau khi thêm asset.

## Bằng chứng từng phase

| Phase | Tag | Bằng chứng | Kết quả |
|---|---|---|---|
| 1 | `phase-1` | [docs/proof/phase-1/summary.md](docs/proof/phase-1/summary.md) | 67/67 test, 8 scenario, tất định, bot chơi thắng trong trình duyệt |
| 2 | `phase-2` | [docs/proof/phase-2/summary.md](docs/proof/phase-2/summary.md) | 89/89 test, 12 scenario, tất định, 59,7 FPS, HUD đủ, chuỗi menu→đêm→kết quả→chơi lại |
| 3 | `phase-3` | [docs/proof/phase-3/summary.md](docs/proof/phase-3/summary.md) | 108/108 test, 18 scenario, tất định, thanh dầu + hút dầu + bình minh sống sót, chế độ mù màu |

## Giấy phép và nguồn

Mã nguồn theo giấy phép MIT — xem [LICENSE](LICENSE). Mọi hình ảnh và âm thanh đều sinh bằng code trong repo này (trừ 6 prop Polyfork ghi rõ ở [CREDITS.md](CREDITS.md)).
