# Bằng chứng Phase 4 — phát hành

Tag: `phase-4`. Số liệu dưới đây do tôi tự chạy trên máy mình; **giảng viên đo lại trên máy chấm**, nên các con số này chỉ để tham khảo đúng như ticket nói.

## 1. Benchmark (contract v1.3)

Lệnh: `node scripts/bench.mjs --seed 42 --duration 30 --out docs/proof/phase-4/bench.json`

Cảnh chuẩn (giống nhau ở mọi bài, xem `src/render/bench.ts`):
- Cửa sổ 1280×720, WebGL tăng tốc phần cứng, **vsync tắt** (`--disable-gpu-vsync --disable-frame-rate-limit`).
- Đêm 1 đầy đủ hiệu ứng; **200 Bóng Mực** trạng thái `wander` rải đều trên đảo (golden angle, seed 42), **100 đom đóm**, L1–L3 sáng với `fuel: 100`.
- Tắt: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu, điều kiện kết thúc. Bóng Mực vẫn di chuyển theo luật `wander`.
- Camera bay vòng tâm (0,0,0), bán kính 30 m, cao 15 m, 15 s/vòng, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ.
- 3 s khởi động không đo, sau đó đo đúng `--duration` giây.

| Chỉ số | Kết quả của tôi | Ngưỡng |
|---|---:|---|
| `avg_fps` | **69,7** | ≥ 60 ✔ |
| `p1_low_fps` | **26,9** | ≥ 30 ✘ |
| `frame_ms_p95` | 32,1 ms | — |
| `frames` | 2091 | — |
| `load_ms` | 234 | ≤ 10000 ✔ |
| `peak_mem_mb` | `null` | — |

`renderer`: `three.js r180 / ANGLE (Intel Iris Xe, D3D11)`.

**Ghi chú trung thực:** `p1_low_fps` (trung bình của 1% khung chậm nhất) **dưới ngưỡng** trên máy tôi. Nguyên nhân là những cú giật khung không đều của trình duyệt (compositor/GC) chứ không phải tốc độ trung bình — `avg_fps` vượt ngưỡng 16%. Trong một lần đo khác cùng cảnh (vsync bật) tôi được `avg 59,9 / p1_low 53`. Hai chế độ đo cho hai kết cục khác nhau, nên con số trên máy chấm mới là con số quyết định.

`peak_mem_mb` là `null` vì trang web không đọc được RSS của tiến trình mình (`performance.memory` chỉ cho JS heap). Đã ghi rõ trong `bench.json` và README.

## 2. Soak test

Lệnh: `node --expose-gc --max-old-space-size=160 --max-semi-space-size=2 scripts/soak.mjs --seed 7 --nights 10 --out docs/proof/phase-4/soak.json`

| Chỉ số | Kết quả | Ngưỡng |
|---|---:|---|
| `nights` | 10 (Đêm 1→2→3→1…, seed 7+i) | — |
| `crashes` | **0** | = 0 ✔ |
| `mem_start_mb` | 54 | — |
| `mem_end_mb` | **63** | ≤ 1,2 × 54 = 64,8 ✔ |
| `duration_s` | 0,7 | — |

Input ngẫu nhiên theo seed: đổi hướng mỗi 30 tick, 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác mỗi tick.

## 3. Những gì Phase 4 **chưa** làm xong (ghi trung thực)

| Yêu cầu | Trạng thái |
|---|---|
| 1. Benchmark + `bench.json` | **Xong** (số ở trên) |
| 2. Soak test + `soak.json` | **Xong** |
| 3. Bảng xếp hạng cục bộ (top 10, nhập tên, màn hình menu, `--export-leaderboard`) | **Chưa làm** |
| 4. Trợ năng: đổi phím, phụ đề/chỉ báo, giảm chuyển động, cỡ chữ ≥18px + chữ lớn | **Chưa làm** (chỉ có chế độ mù màu của Phase 3) |
| 5. Đóng gói: README đầy đủ, CHANGELOG 4 phase, CREDITS, LICENSE, Release `v1.0.0` | README/CHANGELOG/CREDITS/LICENSE có; **Release cần tạo sau khi quay video** |
| 6. Contract v1.3 (`bench_cmd`, `soak_cmd`) | **Xong** |
| 7. Retro + video `.mp4` < 5 phút | Retro có; **video chưa quay** |

Tag `phase-4` đánh dấu trạng thái hiện tại. Phần còn thiếu ở mục 3, 4 và video là việc tiếp theo, không được tính là đã xong.
