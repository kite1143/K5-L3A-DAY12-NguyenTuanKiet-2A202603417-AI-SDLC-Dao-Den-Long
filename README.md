# Đảo Đèn Lồng — Đêm 1: Đảo Bến

> Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây.
> Đêm nay sương đen đã nuốt hết ánh sáng: hãy gom đom đóm, thắp lại **5 Đèn Lồng Lớn** và né **Bóng Mực** trước khi trời sáng.

**Video demo:** _(sẽ đính kèm Release `v1.0.0` ở Phase 4 — Phase 1 chưa có video)_

| | |
|---|---|
| Phase hiện tại | **Phase 1 — PRD-0 + Test Contract v1.0** |
| Tag | `phase-1` |
| Bằng chứng | [docs/proof/phase-1/](docs/proof/phase-1/summary.md) |
| Nhật ký AI & giả định | [docs/notes/](docs/notes/assumptions-phase-1.md) |

---

## Cài đặt và chạy (3 lệnh)

```bash
npm install
npm run build
npm run start          # mở http://localhost:5173
```

Đây là **bản web**, nên chạy được trên macOS, Linux và Windows mà không cần cài engine nào — chỉ cần Node.js ≥ 20 và một trình duyệt có WebGL2.

Đang phát triển thì dùng `npm run dev` (tự nạp lại khi sửa code).

Tham số tuỳ chọn: `http://localhost:5173/?seed=202603417` để chơi lại đúng một hòn đảo (seed hiển thị trong console và ảnh chụp).

## Điều khiển

| Phím | Việc |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera) |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn đang đứng gần |
| `F` | Tỏa sáng: làm choáng và đẩy Bóng Mực ra xa |
| Kéo chuột | Xoay camera |
| `R` | Chơi lại sau khi thắng/thua |
| `Enter` | Bắt đầu / bỏ qua màn giới thiệu |
| `M` | Tắt tiếng |

## Luật chơi Đêm 1

- Đảo tròn, **5 Đèn Lồng Lớn** xếp quanh một vành bán kính 17 m. Mỗi đèn cần **3 đom đóm**.
- Đom đóm rải khắp đảo, nhặt tự động khi đi qua (bán kính 1,2 m). Mây mang được **tối đa 3 con** một lúc.
- Đứng trong **2,5 m** quanh chân đèn và nhấn `E` để nạp. Đủ 3 thì đèn cháy.
- **Bóng Mực** đuổi theo Mây, chạm vào thì mất **1 ngọn lửa** (có 3). Trúng đòn thì rơi một nửa số đom đóm đang mang, và có 1,5 giây bất tử.
- **Ánh sáng của đèn đã thắp là nơi trú ẩn**: Bóng Mực không vào được vòng 3 m quanh đèn đã cháy.
- `F` tỏa sáng: làm choáng mọi Bóng Mực trong 6 m (2 giây) và đẩy chúng ra 3 m. Hồi chiêu 1,5 giây.
- **Thắng** khi cả 5 đèn cùng cháy. **Thua** khi hết 3 ngọn lửa, hoặc khi đồng hồ 5 phút về 0 (trời sáng).
- Mép đảo là rào chắn mềm: Mây không rơi xuống biển mây (`fall_enabled: false`).

### Cách tính điểm

| Sự kiện | Điểm |
|---|---:|
| Nhặt một đom đóm | +10 |
| Thắp một Đèn Lồng Lớn | +100 |
| Làm choáng một Bóng Mực | +5 |
| **Thắng:** mỗi giây còn lại của đêm | +2 |
| **Thắng:** mỗi ngọn lửa còn lại | +50 |

Điểm thưởng thời gian và ngọn lửa chỉ cộng khi thắng, đúng lúc đèn thứ năm cháy.

---

## Chế độ headless (Test Contract v1.0)

`game.contract.json` ở gốc repo khai báo mọi tham số và lệnh:

```bash
node dist/headless/main.js --seed 202603417 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/03-pulse-stuns-shade.scenario.json] \
  [--inputs  scenarios/03-pulse-stuns-shade.inputs.json] \
  [--snapshot-every 10]
```

- Logic chạy cố định **60 tick/giây**, không cửa sổ, không GPU.
- Mã thoát: `0` thành công, `2` file scenario/inputs sai định dạng, `1` lỗi khác.
- Đầu ra JSONL gồm `snapshot`, `event`, và dòng `end` cuối cùng. Toạ độ làm tròn 3 chữ số thập phân.
- Cùng `--seed`, cùng scenario và cùng inputs thì output **giống hệt nhau** (đã kiểm chứng bằng cách chạy hai lần và so sánh từng byte).

Bộ scenario dùng lại được nằm trong [scenarios/](scenarios/manifest.json); cách chạy lại xem [scenarios/manifest.json](scenarios/manifest.json) và báo cáo trong `docs/proof/phase-1/`.

## Kiểm thử

```bash
npm test        # 67 test: hợp đồng, mô phỏng, CLI
npm run verify  # build + test + chạy mọi scenario + kiểm tra tất định → docs/proof/<phase>/
```

`npm run verify` là lệnh duy nhất tạo ra bằng chứng; nó không tin vào cây nguồn mà build lại từ đầu.

## Cấu trúc

```text
game.contract.json      khai báo contract + tuning đang dùng
src/core/               logic game thuần TypeScript (không import three/DOM)
  config.ts             TUNING và bố cục đảo
  world.ts step.ts      dựng thế giới và mô phỏng một tick
  runner.ts             vòng chạy headless + serialize JSONL
  scenario.ts inputs.ts đọc và kiểm tra file scenario/inputs
src/headless/main.ts    CLI theo Test Contract v1.0 (bundle đã commit ở dist/headless/)
src/render/             Three.js: cảnh, nhân vật, HUD, âm thanh, điều khiển
tests/                  node:test (hợp đồng, mô phỏng, CLI)
scenarios/              scenario + inputs tái lập được, có manifest
scripts/verify.mjs      kiểm chứng một lệnh, sinh docs/proof/<phase>/
scripts/shots.mjs       bot chơi thật trong Chromium và chụp ảnh bằng chứng
docs/notes/             giả định, nhật ký dùng AI, retro
docs/proof/             bằng chứng từng phase
docs/lab/               tài liệu gốc của lab (giữ nguyên để tham chiếu)
```

## Sáng tạo của tôi (ngoài phần lõi)

Những thứ thêm vào không làm đổi một dòng nào của mô phỏng headless — chúng chỉ sống ở lớp render, nên đầu ra theo contract vẫn y như phần lõi:

1. **Chiếc đèn lồng nhỏ treo trên nón lá** của Mây, kèm quầng sáng ấm và tiếng bước chân nhẹ.
2. **Vòng an toàn phát sáng** quanh mỗi đèn đã thắp — vẽ đúng bán kính `safe_radius` 3 m trong contract, để người chơi thấy được luật chơi thay vì phải đoán.
3. **Đảo sáng dần theo số đèn** (sương mỏng đi, nền ấm lên) đúng yêu cầu "đảo sáng dần lên khi thắp đèn" trong PRD-0.
4. **Âm thanh tổng hợp bằng WebAudio**, không có file asset nào: tiếng nhặt đom đóm, tiếng nạp đèn, chuông khi đèn cháy, tiếng ù khi tỏa sáng, tiếng va chạm trầm.
5. **Biển mây và màn đêm thủ tục**: sao, trăng, mây trôi chậm, cỏ và đá thấp thoáng — toàn bộ sinh bằng code, không dùng asset ngoài.
6. **Màn giới thiệu ngắn** kể bối cảnh bằng tiếng Việt, và tham số `?seed=` để chia sẻ lại đúng hòn đảo.

Bằng chứng phần lõi vẫn đúng sau khi thêm các mục trên: `npm test` 67/67 và `npm run verify` xanh ([báo cáo](docs/proof/phase-1/verify-report.md)).

## Bằng chứng từng phase

| Phase | Tag | Bằng chứng | Kết quả |
|---|---|---|---|
| 1 | `phase-1` | [docs/proof/phase-1/summary.md](docs/proof/phase-1/summary.md) | 67/67 test, 8 scenario, tất định, bot chơi thắng 5/5 đèn trong trình duyệt |

## Giấy phép và nguồn

Mã nguồn theo giấy phép MIT — xem [LICENSE](LICENSE). Mọi hình ảnh và âm thanh đều sinh bằng code trong repo này; chi tiết ở [CREDITS.md](CREDITS.md).
