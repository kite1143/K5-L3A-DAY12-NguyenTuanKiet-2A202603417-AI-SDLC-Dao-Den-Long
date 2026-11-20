# Changelog

## Phase 2 — Ticket-02, contract v1.1 ("Ba hòn đảo")

### Thay đổi (phá vỡ tương thích, theo yêu cầu)
- **Chuẩn hoá mọi số liệu** sang bộ số của ticket: chạy 6,0 m/s, nhảy 7,0/−20, mang 10 đom đóm, đèn giá 10, nhặt 1,0 m, tương tác 2,0 m, tỏa sáng 3 đom đóm/5 m/3 s, an toàn 6 m, Bóng Mực 4,0 m/s, `fall_enabled: true`.
- **Bản đồ chuẩn hoá lại**: Đêm 1 giờ bán kính 40 m với 5 đèn ở toạ độ mới; đom đóm và Bóng Mực sinh theo danh sách điểm chuẩn.
- **Điểm `per_mote` giờ tính khi nạp vào đèn**, không phải khi nhặt (theo Phần 1 của ticket).
- **Bóng Mực có state chuẩn**: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- **Test Phase 1 viết lại** theo số chuẩn: 67 → 89 test, có nhóm `features.test.mjs` cho tính năng mới.

### Thêm
- **Đêm 2 — Đảo Cau**: hai đảo bán kính 28 m nối bằng cầu tre, 2 bục nhảy (14 m/s lên, 24 m/s ngang), 6 đèn.
- **Đêm 3 — Đảo Chuông**: ba tầng (0/3/6 m), 2 dốc 30°/150°, bục nhảy lên tầng 2, tháp chuông, gió giật mỗi 30 s (báo trước 2 s, đẩy 2 m/s), 7 đèn.
- **Lướt (dash)**: 14 m/s trong 12 tick, hồi 1,5 s, giữ độ cao khi lướt trên không, không bất tử.
- **Gió Lạc (drifters)**: 7 m/s, tối đa 2, sinh ở tick 1200/2400, idle↔chase theo số đom đóm và khoảng cách, cướp 3 đom đóm rồi bỏ chạy; tỏa sáng làm nó đánh rơi chiến lợi phẩm.
- **Bùa Gió (charms)**: 600 tick, chạy 7,2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick.
- **Rơi khỏi đảo**: mất 1 lửa + toàn bộ đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 tick.
- **Đom đóm rơi** khi bị đánh: `kind: "dropped"`, TTL 480 tick, nhặt lại từ tick sau.
- **Tạm dừng** (Esc/P): dừng hoàn toàn, tick vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn và TTL đứng yên.
- **Chuỗi 3 đêm**: menu → giới thiệu đêm → chơi → kết quả → đêm kế; thắng Đêm 3 hiện Bình Minh với tổng điểm.
- **Cài đặt** âm lượng + độ nhạy chuột, lưu bằng `localStorage`.
- **HUD đầy đủ** theo Phần 3: lửa, đồng hồ mm:ss (đỏ và nhấp nháy ≤ 30 s), đèn k/n + điểm, thanh 10 ô đom đóm, 2 icon hồi chiêu, nhắc "E — Nạp ánh sáng (x/10)", mũi tên chỉ đèn gần nhất ngoài khung hình.
- **Âm thanh**: nhạc nền đêm + 11 hiệu ứng (thêm nhảy, lướt, Bùa, Gió Lạc, đếm ngược 10 s).
- **Contract v1.1**: `--night 1..3`, snapshot/scenario/inputs/event mới, palette chuẩn trong code.
- **Harness**: `scripts/fps.mjs` đo FPS thật; `verify.mjs` kiểm tra schema v1.1 và bảng màu.

### Sửa
- Nhịp choáng của Tỏa Sáng: trước là 119 tick do bị trừ ngay trong tick kích hoạt; nay đúng **120 tick**.

## Chưa phát hành (sau `phase-1`)

### Sửa
- **Bóng Mực sinh ra trong lúc chơi không được vẽ.** `GameView.rebuild()` chỉ tạo mesh cho những shade tồn tại lúc dựng cảnh, mà lúc đó danh sách rỗng; shade spawn ở giây thứ 6 vẫn đuổi và gây sát thương trong mô phỏng nhưng **vô hình** trên màn hình. `sync()` giờ tạo mesh lazily theo `id`. Thêm kiểm tra tự động: hook `__dao.renderedShades()` so số mesh thật với số shade trong mô phỏng, bot trong `scripts/shots.mjs` báo `MISSING MESH` nếu lệch (đã chạy: `sim=1 rendered=1`).
- Bóng Mực đậm hơn cho ra dáng "mực đen trong sương" (lõi gần đen, quầng tím), thêm nhịp "thở" nhẹ để nhìn ra là sinh vật sống.

### Thêm
- **Prop cảnh vật low-poly** từ Polyfork (CC BY 4.0): thông, đá, túp lều của người giữ bến, thuyền mộc, đèn lồng lớn, nấm phát sáng. Tất cả nằm trong `public/models/` và được credit đầy đủ ở `CREDITS.md`.
- `src/render/assets.ts`: tải GLB bằng `GLTFLoader`, chuẩn hoá kích thước theo chiều cao mong muốn và đặt đáy về mặt đất; **tải lỗi thì trả `null`** và cảnh quay về mesh thủ tục, nên repo vẫn chạy khi offline hay thiếu file.
- `scripts/fetch-assets.mjs` + `npm run assets` để tải lại đúng danh sách model (id nằm trong script, credit nằm trong `PROP_CREDITS`).
- Màn "Đang tải đảo…" trong lúc nạp asset.

### Ghi chú
- Nhân vật Mây **vẫn** là hình học tự dựng: PRD-0 bắt buộc "nón lá có treo một chiếc đèn lồng nhỏ", không có mô hình ngoài nào khớp.
- Chỉ tải mesh file `.glb`; file `.mjs` của Polyfork **không** thuộc CC BY nên không dùng.
- Asset chỉ tồn tại ở lớp render → `npm run verify` vẫn PASS nguyên trạng (67 test, 8 scenario, tất định).

## Phase 1 — PRD-0 + Test Contract v1.0

### Sửa
- **Phím `A`/`D` bị đảo hướng.** Camera đứng sau Mây và nhìn về `+Z`, nên trong hệ toạ độ tay phải phía bên phải màn hình là `-X`; trước đây `D` lại gửi `+X` vào mô phỏng nên nhân vật đi sang trái. Sửa ở lớp input (`src/render/input.ts`), **không** đụng vào `src/core` vì Test Contract quy định cách `move` đổi sang hướng thế giới. Đã kiểm chứng bằng bot chơi thật ở hai góc camera: `D@yaw0 dx=−1.50`, `A@yaw0 dx=+1.50`, `D@yaw90 dz=+1.50`, `A@yaw90 dz=−1.50`.

### Thêm
- Màn **Đêm 1 — Đảo Bến**: đảo tròn bán kính 26 m, 5 Đèn Lồng Lớn trên vành 17 m.
- Nhân vật Mây: đi lại, nhảy, camera góc thứ ba xoay bằng chuột.
- Đom đóm: 30 con rải theo seed, nhặt tự động, mang tối đa 3.
- Nạp đom đóm vào đèn (`E`), đèn cháy khi đủ 3.
- Bóng Mực: đuổi theo người chơi, gây sát thương, sợ vòng an toàn quanh đèn đã cháy.
- Tỏa sáng (`F`): làm choáng và đẩy Bóng Mực, có hồi chiêu.
- Thắng/thua/điểm, HUD, màn giới thiệu, màn kết thúc, chơi lại.
- Âm thanh tổng hợp bằng WebAudio (không asset).
- Chế độ headless theo Test Contract v1.0: `game.contract.json`, CLI `dist/headless/main.js`, snapshot/event/end JSONL, tất định theo seed.
- 67 test tự động: hợp đồng, mô phỏng, CLI (gồm mã thoát 2 cho file sai định dạng).
- Harness: `AGENTS.md`, `scripts/verify.mjs`, `scripts/shots.mjs` (bot chơi thật), hook `pre-commit`.

### Ghi chú thiết kế
- Tách `src/core` (logic thuần, không DOM/three, không `Math.random`) khỏi `src/render` để cùng một đoạn mã mô phỏng phục vụ cả bản có giao diện và bản headless.
- Tốc độ di chuyển là tức thời (không quán tính) để phép đo trong contract chính xác: 1 giây đi đúng `player_speed` mét.
- `dist/headless/main.js` được commit vì `headless_cmd` trỏ trực tiếp vào nó; `verify.mjs` kiểm tra bundle còn khớp `src/`.
- Mọi trang trí lớn (cây) đặt ở vành đảo để không che camera.
