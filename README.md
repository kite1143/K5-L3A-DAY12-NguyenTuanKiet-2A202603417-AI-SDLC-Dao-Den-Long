# Đảo Đèn Lồng — Ba hòn đảo

> Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây.
> Sương đen đã nuốt hết ánh sáng: hãy gom đom đóm, thắp lại những **Đèn Lồng Lớn** và né **Bóng Mực** trước khi trời sáng — qua ba đêm, ba hòn đảo.

**Video demo:** _(sẽ đính kèm Release `v1.0.0` ở Phase 4 — chưa có video trong repo)_

| | |
|---|---|
| Phase hiện tại | **Phase 2 — Ticket-02, contract v1.1** |
| Tag | `phase-2` |
| Bằng chứng | [docs/proof/phase-2/](docs/proof/phase-2/summary.md) |
| Spec + acceptance criteria | [docs/notes/spec-phase-2.md](docs/notes/spec-phase-2.md) |
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

| Đêm | Đảo | Thời lượng | Đèn | Điểm nhấn |
|---|---|---:|---:|---|
| 1 | **Đảo Bến** — đảo tròn bán kính 40 m | 300 s | 5 | Bục nhảy không có; làm quen luật cơ bản |
| 2 | **Đảo Cau** — hai đảo bán kính 28 m nối bằng **cầu tre**, tâm (0,0,0) và (70,0,0) | 330 s | 6 | **Bục nhảy** (14 m/s lên, 24 m/s ngang) phóng qua đảo; **Gió Lạc**; **Bùa Gió** trên cầu |
| 3 | **Đảo Chuông** — ba tầng (0 m, 3 m ở vành 12–24 m nửa z>0, 6 m ở đĩa tâm bán kính 8 m) | 360 s | 7 | **Hai dốc** 30°/150°, **bục nhảy** lên tầng 2, **tháp chuông**, **gió mạnh** mỗi 30 s |

## Luật chơi (số liệu chuẩn contract v1.1)

- **Di chuyển 6,0 m/s** (tăng tốc tức thời), nhảy 7,0 m/s với trọng lực −20 m/s², lướt 14 m/s trong 0,2 s.
- **Đom đóm**: nhặt tự động khi cách ≤ 1,0 m và chênh cao ≤ 1,5 m; mang tối đa **10**. Bắt đầu 20 con, trần 30, thêm 1 con mỗi 4 giây nếu còn điểm trống.
- **Đèn**: mỗi đèn cần **10 đom đóm**, nạp nhiều lần được và đèn nhớ tiến độ. Đứng trong **2,0 m** và nhấn `E`.
- **Vùng an toàn**: đèn đã sáng tạo vòng bán kính **6 m**; Bóng Mực bị chặn ở mép và không gây sát thương khi ở trong.
- **Bóng Mực**: 4,0 m/s (Đêm 3: 4,5 m/s), phát hiện 12 m, bỏ đuổi 18 m. Chạm (XZ ≤ 1,0 m, chênh cao ≤ 1,5 m) mất 1 Ngọn Lửa; bóng lùi lại 2 m trong 60 tick.
- **Tỏa sáng**: 3 đom đóm, bán kính **5 m** tính từ **chân Mây + 0,8 m**, choáng 120 tick, 15 tick đầu đẩy lùi tổng 4 m, hồi chiêu 3 s.
- **Rơi khỏi đảo** (Y < −10): mất 1 Ngọn Lửa và toàn bộ đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát với 90 tick bất tử.
- **Gió Lạc** (Đêm 2–3): dải lụa xám xanh 7 m/s, tối đa 2 con, sinh ở tick 1200, 2400…; chỉ đuổi khi bạn mang ≥ 5 đom đóm và cách ≤ 15 m; chạm thì cướp `min(3, đang mang)` rồi bay đi. Tỏa sáng xua được nó và làm nó đánh rơi chiến lợi phẩm.
- **Bùa Gió**: 600 tick, chạy 7,2 m/s, lướt không hồi chiêu; xuất hiện lại sau 2700 tick.
- **Thắng** khi cả đèn của đêm cùng sáng (kể cả đúng tick hết giờ). **Thua** khi hết 3 Ngọn Lửa, hoặc hết giờ mà chưa đủ đèn.

### Cách tính điểm

| Sự kiện | Điểm |
|---|---:|
| Mỗi đom đóm **nạp vào đèn** | +10 |
| Thắp một Đèn Lồng Lớn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| **Thắng:** mỗi giây còn lại | +2 |
| **Thắng:** mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm của một lượt chơi là tổng điểm các đêm đã thắng; điểm cao nhất được lưu trong trình duyệt.

## Chế độ headless (Test Contract v1.1)

`game.contract.json` ở gốc repo khai báo mọi tham số và lệnh:

```bash
node dist/headless/main.js --seed 202603417 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/03-pulse-stun.scenario.json] \
  [--inputs  scenarios/03-pulse-stun.inputs.json] \
  [--snapshot-every 10]
```

- `--night` nhận **1, 2, 3**; logic chạy cố định 60 tick/giây, không cửa sổ, không GPU.
- Mã thoát: `0` thành công, `2` file scenario/inputs sai định dạng, `1` lỗi khác.
- Snapshot v1.1 có thêm `night`, `wind`, `player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, và các mảng `motes` (kèm `kind`/`ttl_s`), `drifters`, `charms`.
- Event mới: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`; `player_hit` do rơi có thêm `lost`.
- Cùng seed + cùng scenario + cùng inputs → output **giống hệt nhau**; một đêm đầy đủ 21.600 tick chạy dưới 1 giây (yêu cầu ≤ 30 s).

## Kiểm thử

```bash
npm test        # 89 test: hợp đồng, mô phỏng, tính năng mới, CLI
npm run verify  # build + test + 12 scenario + tất định + palette → docs/proof/<phase>/
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
8. **Đảo Bến có bến thật**: lều người giữ bến, thuyền mộc, thông, đá, nấm phát sáng — 6 prop low-poly của **Polyfork, CC BY 4.0** (xem [CREDITS](CREDITS.md)). Nhân vật Mây vẫn là hình học tự dựng để giữ đúng "nón lá có treo đèn lồng nhỏ".

### Vì sao asset không thể phá Test Contract

`src/render/assets.ts` chỉ được `src/render/**` import; `src/core` và `src/headless` không biết asset tồn tại. Model tải lỗi thì `placeProp` trả `null` và cảnh quay về mesh thủ tục. Đã kiểm chứng: `npm run verify` vẫn PASS sau khi thêm asset.

## Bằng chứng từng phase

| Phase | Tag | Bằng chứng | Kết quả |
|---|---|---|---|
| 1 | `phase-1` | [docs/proof/phase-1/summary.md](docs/proof/phase-1/summary.md) | 67/67 test, 8 scenario, tất định, bot chơi thắng trong trình duyệt |
| 2 | `phase-2` | [docs/proof/phase-2/summary.md](docs/proof/phase-2/summary.md) | 89/89 test, 12 scenario, tất định, 59,7 FPS, HUD đủ, chuỗi menu→đêm→kết quả→chơi lại |

## Giấy phép và nguồn

Mã nguồn theo giấy phép MIT — xem [LICENSE](LICENSE). Mọi hình ảnh và âm thanh đều sinh bằng code trong repo này (trừ 6 prop Polyfork ghi rõ ở [CREDITS.md](CREDITS.md)).
