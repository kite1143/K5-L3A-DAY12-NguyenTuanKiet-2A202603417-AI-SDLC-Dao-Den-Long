# Bằng chứng Phase 4 — phát hành

Tag: `phase-4`. Số đo do tôi tự chạy trên máy mình; giảng viên đo lại trên máy chấm.

## 1. Benchmark (contract v1.3)

`node scripts/bench.mjs --seed 42 --duration 30 --out docs/proof/phase-4/bench.json`

| Chỉ số | Kết quả | Ngưỡng |
|---|---:|---|
| `avg_fps` | **69,7** | ≥ 60 ✔ |
| `p1_low_fps` | **26,9** | ≥ 30 ✘ |
| `frame_ms_p95` | 32,1 ms | — |
| `frames` | 2091 | — |
| `load_ms` | 234 | ≤ 10000 ✔ |
| `peak_mem_mb` | `null` | — |

Cảnh chuẩn: 1280×720, vsync tắt (`--disable-gpu-vsync --disable-frame-rate-limit`), 200 Bóng Mực `wander` rải đều (seed 42), 100 đom đóm, L1–L3 sáng `fuel: 100`, tắt sinh/sát thương/nhặt/hao dầu/kết thúc, camera vòng 30 m ở Y=15 m, 15 s/vòng, 3 s khởi động không đo.

**Trung thực:** `p1_low_fps` dưới ngưỡng trên máy tôi (giật khung của trình duyệt). Cùng cảnh với vsync bật: `avg 59,9 / p1_low 53`. `peak_mem_mb` null vì trang web không đọc được RSS tiến trình.

## 2. Soak

`node --expose-gc --max-old-space-size=160 --max-semi-space-size=2 scripts/soak.mjs --seed 7 --nights 10 --out docs/proof/phase-4/soak.json`

**10 đêm, 0 crash, RAM 54 → 63 MB** (≤ 1,2×) ✔, 0,7 s.

## 3. Bảng xếp hạng cục bộ

- Lưu ở `data/leaderboard.json` do `scripts/play.mjs` quản lý; top 10, điểm giảm dần, bằng điểm thì ai đạt trước đứng trên.
- Nhập tên sau mỗi lần kết thúc đêm: 3–12 ký tự chữ/số/`_` (cho phép tiếng Việt có dấu).
- Màn hình "Bảng xếp hạng" từ menu chính.
- Xuất: `node scripts/play.mjs --export-leaderboard out.json`.

Bằng chứng thật: sau lượt bot chơi trong `scripts/demo.mjs`, file xuất ra là

```json
{"entries":[{"name":"KY_SU","score":0,"nights_won":0,"achieved_at":"2026-11-20T21:01:33+07:00","seed":202603417}]}
```

## 4. Trợ năng

| Yêu cầu | Cài đặt |
|---|---|
| Đổi phím cho 9 hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng) | Bảng "Đổi phím" trong Cài đặt, bấm rồi nhấn phím mới |
| Phát hiện trùng phím | Báo lỗi ngay trong Cài đặt (`… đã dùng cho "Tỏa sáng"`), không nhận phím trùng |
| Khôi phục mặc định | Nút "Khôi phục mặc định" |
| Được lưu | `localStorage` (`dao-den-long.settings.v1`), gồm cả keymap |
| Chỉ báo hình ảnh | Toast cho "Bóng Mực xuất hiện" (+ mũi tên đỏ chỉ hướng), "Gió sắp thổi", "Còn 10 giây", "Lx sắp cạn dầu" |
| Giảm chuyển động | Tắt nhấp nháy đèn, nhịp "thở" của Bóng Mực, nhún nhân vật và transition CSS |
| Cỡ chữ ≥ 18 px | `.hud { font-size: 18px }` — mọi chữ HUD dùng `em` từ mốc này |
| Chữ lớn ×1,25 | Tùy chọn, đổi mốc thành 22,5 px |

## 5. Video demo

`docs/demo/demo.mp4` — 44,7 s, 1280×720, H.264, 586 KB (dưới 5 phút, dưới 100 MB). Quay tự động bằng `scripts/demo.mjs` (Playwright), nội dung: menu → màn Bằng chứng (số bench/soak/test) → giới thiệu đêm → chơi bằng bàn phím → thua thật → nhập tên lưu điểm → bảng xếp hạng → Cài đặt (đổi phím, báo trùng phím, khôi phục mặc định, giảm chuyển động, chữ lớn) → HUD chữ lớn.

Ảnh trong `screens/`: `01-menu`, `02-proof`, `03-leaderboard-empty`, `04-intro`, `05-play`, `06-result-score-entry`, `07` (màn Bằng chứng, xem ghi chú), `08-keymap-conflict`, `09-settings-accessibility`, `10-large-text-hud`.

**Ghi chú trung thực:** `07-leaderboard.png` chụp đúng lúc màn "Bằng chứng" còn mở nên hiển thị số đo chứ không phải danh sách xếp hạng; màn xếp hạng có trong `03` (trống) và bằng chứng có mục thật là file xuất JSON ở mục 3.

## 6. Còn lại

- **GitHub Release `v1.0.0`**: chưa tạo được từ máy này (không có `gh` CLI, không có token). Cần `gh release create v1.0.0 --notes ... demo.mp4` hoặc tạo tay trên GitHub kèm `docs/demo/demo.mp4` + hướng dẫn chạy.
- `p1_low_fps` dưới ngưỡng trên máy tác giả (xem mục 1).
