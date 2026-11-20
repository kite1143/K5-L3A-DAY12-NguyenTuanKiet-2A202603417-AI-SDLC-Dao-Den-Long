# Bằng chứng Phase 1

Tag: `phase-1`. Mọi số liệu dưới đây sinh ra bằng `npm run verify` và bot chơi thật; không có output nào được sửa tay.

## 1. Tổng quan

| Hạng mục | Kết quả |
|---|---|
| Build | typecheck + core + headless + web: **PASS** |
| Test tự động | **67/67 pass** (`node --test tests/`) |
| Scenario headless | **8/8 đúng định dạng**, trong đó 1 ca kiểm tra mã thoát 2 |
| Tính tất định | Hai lần chạy cùng seed: **giống nhau từng byte** |
| Bundle headless đã commit | **khớp** với `src/` (build lại không đổi một byte) |
| Chơi thật trong trình duyệt | Bot **thắng** Đêm 1: 5/5 đèn, còn 3 ngọn lửa, điểm 1346 |
| Chơi lại sau khi thắng | **PASS**: đêm mới, điểm 0, 3 lửa, 0 đèn |

Báo cáo đầy đủ: [verify-report.md](verify-report.md)

## 2. Truy vết yêu cầu → cách kiểm chứng → bằng chứng → kết quả

### Yêu cầu gameplay của PRD-0

| Yêu cầu (PRD-0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Một màn Đêm 1, đảo tròn, **5 Đèn Lồng Lớn** | `LANTERN_LAYOUT` khai 5 đèn; test đối chiếu `lantern_count_night1` với bố cục thật | `tests/contract.test.mjs`; scenario `01`; ảnh `02-island.png` | Đạt |
| Nhân vật đi lại, nhảy, camera 3D | Test tốc độ: 60 tick đi đúng `player_speed`; test chuẩn hóa chéo và xoay `cam_yaw_deg` | `tests/sim.test.mjs` (5 ca chuyển động); ảnh `02-island.png` | Đạt |
| Đom đóm rải khắp đảo, nhặt được | Test biên `pickup_radius` (nhặt ở tick 46, không nhặt ở tick 45), test `carry_capacity` | `tests/sim.test.mjs`; scenario `01` (`mote_picked×3`) | Đạt |
| Nạp ánh sáng để thắp đèn | Test `deposit` đủ/phần thiếu/không lãng phí; test đèn đặt sẵn `lit` không cộng điểm | `tests/sim.test.mjs`; scenario `01`, `02` | Đạt |
| Bóng Mực xuất hiện và đuổi | Test tốc độ đuổi đúng `shade_speed`; test lịch sinh ở tick 360 và 960; test id tự sinh | `tests/sim.test.mjs`; scenario `07` (`shade_spawned×2`) | Đạt |
| Tỏa sáng để xua Bóng Mực | Test choáng + đẩy + hồi chiêu + ngoài tầm; test tự hồi trạng thái đuổi | `tests/sim.test.mjs`; scenario `03`; ảnh `04-pulse.png` | Đạt |
| Bị chạm thì mất máu, mất đóm đóm | Test `player_hit` (mất 1 lửa, rơi `floor(carried×ratio)`); test `invuln_s` đúng 90 tick | `tests/sim.test.mjs`; scenario `04` (`player_hit×2`) | Đạt |
| Bóng Mực sợ đèn | Test: Bóng Mực bị giữ ở đúng `safe_radius` quanh đèn đã thắng, không chạm được người chơi | `tests/sim.test.mjs`; scenario `06`; vòng sáng trong ảnh `05-first-lantern-lit.png` | Đạt |
| Thắng khi thắp hết đèn | Test: đèn thứ 5 cháy → `won`/`all_lit`, dừng ngay ở tick 1, điểm có thưởng thời gian + lửa | `tests/sim.test.mjs`; scenario `02`; ảnh `06-end.png` | Đạt |
| Thua khi hết máu / trời sáng | Test `lost`/`no_flames` và `lost`/`dawn` (đúng 90 tick với `time_left_s: 1.5`) | `tests/sim.test.mjs`; scenario `05` | Đạt |
| Điểm số | Test: điểm cuối bằng đúng tổng các nguồn điểm trong event | `tests/sim.test.mjs` | Đạt |
| HUD hiển thị thông tin cần thiết | Bot đọc DOM sau khi chơi: lửa, đom đóm, điểm, giờ, số đèn — đều khớp mô phỏng | `playthrough.json`, ảnh `02`, `05`, `06` | Đạt |
| Chơi lại sau khi thắng/thua | Bot bấm `R` sau khi thắng: đêm mới sạch (điểm 0, 3 lửa, 0 đèn) | `playthrough.json`, ảnh `07-replay.png` | Đạt |

### Test Contract v1.0

| Yêu cầu (contract) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` đủ trường, tuning đúng số đang dùng | Test so sánh sâu `tuning` với `TUNING` trong code | `tests/contract.test.mjs` | Đạt |
| Tham số headless `--seed --night --ticks --out [--scenario] [--inputs] [--snapshot-every]` | 20 ca CLI, gồm giá trị mặc định 10 của `--snapshot-every` | `tests/cli.test.mjs` | Đạt |
| 60 tick/giây; dừng khi hết tick hoặc khi game kết thúc; thoát mã 0 | Test: `--ticks 600` trên scenario thắng chỉ chạy 1 tick; `--ticks 0` vẫn có snapshot 0 + end | `tests/cli.test.mjs`; scenario `02` | Đạt |
| Lỗi định dạng → mã thoát 2 | 12 ca sai định dạng (motes sai kiểu, tick trùng, move sai số phần tử, cờ boolean sai kiểu, JSON hỏng) | `tests/cli.test.mjs`; scenario `08` | Đạt |
| Snapshot tick 0 trước khi áp input | Test: scenario đặt `player.pos = [2,0,3]` thì snapshot tick 0 đúng vị trí đó | `tests/sim.test.mjs` | Đạt |
| Bước k đọc input tick k, sự kiện ghi tick k+1 | Test: input `interact` ở tick 0 → event ở tick 1 | `tests/sim.test.mjs` | Đạt |
| `time_left_s = thời lượng − số bước / 60` | Test: snapshot ở tick 120 ghi 298,0 | `tests/sim.test.mjs`, `tests/cli.test.mjs` | Đạt |
| Quy ước vị trí, khoảng cách XZ | Toàn bộ test khoảng cách dùng XZ; `player.pos` là chân, `shade.pos` y = 1, đom đóm y = 0 | `tests/sim.test.mjs`; mã `src/core/step.ts` | Đạt |
| Định dạng event đúng tên và `data` | Test khớp `data` từng sự kiện (`mote_picked`, `deposit`, `lantern_lit`, `pulse`, `player_hit`, `shade_spawned`, `game_over`) | `tests/sim.test.mjs` | Đạt |
| Dòng `end` bắt buộc và ở cuối | Test với mọi scenario + `validateJsonl` trong `verify.mjs` | `verify-report.md` | Đạt |
| Toạ độ làm tròn 3 chữ số | Test regex trên toàn bộ output | `tests/sim.test.mjs` | Đạt |
| Tính tất định, kể cả id tự sinh | Test 2 lần chạy giống hệt; `verify.mjs` so sánh từng byte | `tests/sim.test.mjs`, `verify-report.md` | Đạt |
| Scenario không phát sự kiện, không cộng điểm | Test: 4 đèn đặt sẵn `lit: true` → 0 event, điểm 0 | `tests/sim.test.mjs` | Đạt |

### Bàn giao phase

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Tag `phase-1` trên repo public | `git tag --list` → `phase-1` | Đạt |
| README: cài đặt ≤ 3 lệnh, điều khiển, cách tính điểm | `README.md`; thử clone sạch trong `clean-clone.txt` | Đạt |
| `game.contract.json` + chế độ headless | `game.contract.json`; `dist/headless/main.js`; scenario 01–08 | Đạt |
| Bằng chứng + ghi chép (giả định, nhật ký AI) | `docs/notes/assumptions-phase-1.md`, `docs/notes/ai-journal.md` | Đạt |
| Harness AI | `AGENTS.md`, `scripts/verify.mjs`, `scripts/shots.mjs`, `.githooks/pre-commit` | Đạt |

## 3. Ảnh chụp (bot chơi thật, seed 202603417)

| Ảnh | Cho thấy gì |
|---|---|
| `screens/01-intro.png` | Màn giới thiệu tiếng Việt, HUD sẵn sàng |
| `screens/02-island.png` | Đảo Bến, đom đóm, Mây + nón lá + đèn nhỏ trên nón, camera góc thứ ba |
| `screens/03-first-mote.png` | Nhặt đom đóm đầu tiên (HUD đổi số) |
| `screens/04-pulse.png` | Tỏa sáng khi Bóng Mực lại gần (~4 m) |
| `screens/05-first-lantern-lit.png` | Đèn đầu tiên cháy, vòng an toàn 3 m hiện trên mặt đất, điểm 130 |
| `screens/06-end.png` | Màn thắng: 5/5 đèn, điểm 1346 |
| `screens/07-replay.png` | Bấm `R`: đêm mới sạch (điểm 0, 0 đèn, 3 lửa) |

`playthrough.json` ghi lại từng mốc thời gian của lượt chơi; `console.log` rỗng lỗi (không có `pageerror`).

## 4. Cách tự chạy lại

```bash
npm install && npm run build
npm test                                   # 67 test
npm run verify                             # sinh lại toàn bộ mục 1 và 2
node dist/headless/main.js --seed 7 --night 1 --ticks 260 --out out.jsonl \
  --scenario scenarios/01-movement-pickup-deposit.scenario.json \
  --inputs  scenarios/01-movement-pickup-deposit.inputs.json
```

## 5. Điều chưa đạt / còn hạn chế

- `pulse_cost` bằng 0 (xem lý do trong giả định) — PRD-0 nói tỏa sáng "tốn ánh sáng"; chi phí hiện tại là hồi chiêu, chưa phải đom đóm.
- Chưa có va chạm với đá/cây (trang trí đi xuyên được).
- Chưa có video demo: Phase 4 mới phát hành Release `v1.0.0` kèm video, nên Phase 1 chỉ có ảnh chụp.
