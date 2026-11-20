# Changelog

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
