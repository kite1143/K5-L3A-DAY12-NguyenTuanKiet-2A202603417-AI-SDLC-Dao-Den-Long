# Nhật ký dùng AI

Ghi theo từng phase: đã nhờ AI việc gì, AI sai ở đâu, tôi phát hiện bằng cách nào, đã chỉnh harness gì, và ước tính token.

## Cách ước tính token

Tôi không có số đo chính xác từng request, nên ước tính theo công thức minh bạch:

```
token ≈ (số lượt trao đổi) × (ngữ cảnh trung bình mỗi lượt) + (token sinh ra)
```

Ngữ cảnh trung bình lấy bằng khoảng một nửa ngữ cảnh cuối phiên, vì ngữ cảnh lớn dần theo thời gian. Con số dưới đây là **ước tính**, không phải số đo — ghi để thấy mình có tiết kiệm hay không, không phải để khoe.

## Phase 1 (PRD-0 + Test Contract v1.0)

**Đã nhờ AI:** đọc PRD-0 và contract, viết giả định, thiết kế kiến trúc tách `core`/`render`/`headless`, viết toàn bộ mã nguồn, viết test, viết script kiểm chứng, chạy bot chơi thử trong Chromium.

**Ước tính:** ~35 lượt trao đổi, ngữ cảnh cuối phiên ~90k token, ngữ cảnh trung bình ~55k → **~1,9 triệu token vào**, **~70k token ra**. Chi phí ở mức giá hiện hành: khoảng vài chục cent.

**Cách tiết kiệm:**
- Đưa contract cho AI **trước** khi thiết kế, để kiến trúc tách logic/ hiển thị đúng ngay từ đầu — không phải sửa lại (tiết kiệm nhất là sửa thiết kế, không sửa code).
- Chia việc thành các tệp nhỏ, mỗi lần một tệp, thay vì bắt AI sinh cả repo trong một lượt rồi sửa hàng loạt.
- Cho AI chạy `tsc`/`node --test`/CLI thay vì hỏi "chạy được chưa" — output thật ngắn hơn nhiều so với giải thích.
- Không đưa tài liệu lab vào ngữ cảnh mỗi lượt; đọc một lần rồi ghi lại kết luận vào `docs/notes/`.

**AI sai ở đâu — và tôi phát hiện bằng cách nào:**

| Lần sai | Phát hiện nhờ | Đã sửa ở đâu (harness) |
|---|---|---|
| Viết 5 test đọc `snapshots.at(-1)` nhưng dùng `snapshotEvery: 10`, nên đọc snapshot cũ chứ không phải trạng thái cuối — test đỏ dù logic đúng | `node --test` báo `actual 5 !== expected 2` và tôi đối chiếu với snapshot tick 0 | Ghi bẫy này vào `AGENTS.md`; bộ test dùng `snapshotEvery: 1` hoặc đọc `result.world` |
| Kỳ vọng sai về `safe_radius`: cho rằng Bóng Mực vẫn chạm được người chơi đứng trong vòng an toàn | Chạy scenario `06-safe-haven` thấy 0 `player_hit` | Sửa kỳ vọng, ghi rõ trong giả định: đẩy ra khỏi vòng xảy ra **trước** bước kiểm tra va chạm |
| `vite build` hỏng trên Windows: esbuild không xoá được temp file (`Access is denied`) | Đọc stderr của lần build đầu | Thêm nhánh Windows dùng TEMP cục bộ trong `vite.config.ts`, ghi vào bảng bẫy |
| `JSON.parse` fail với file do PowerShell ghi vì có BOM | Chạy thử CLI bằng `Set-Content -Encoding utf8` | `readJson` bỏ BOM; thêm test CLI hồi quy |
| Đèn point đặt **trong** thân nhân vật nên nhân vật chỉ sáng mặt trong, trông tối đen | Bot chụp ảnh: nhân vật vẫn xanh đen dù đã tăng `emissive` | Dời đèn ra trước + thêm đèn phía sau; ghi vào bảng bẫy |
| Cây mọc giữa sân, che camera khi chơi | Ảnh chụp `05-first-lantern-lit.png` cho thấy cây đen chiếm nửa màn hình | Dời trang trí lớn ra vành đảo (bán kính ≥ 19 m) |

**Harness rút ra sau Phase 1:**
- `AGENTS.md` có lệnh, ranh giới kiến trúc và **bảng bẫy** — mỗi lỗi lặp lại một lần là thành một dòng.
- `scripts/verify.mjs`: một lệnh sinh toàn bộ bằng chứng, nên không phụ thuộc việc tôi nhớ chạy gì.
- `scripts/shots.mjs`: bot chơi thật. Đây là thứ duy nhất bắt được lỗi "logic đúng mà nhìn không chơi được".
- Hook `pre-commit`: chặn commit khi typecheck/test đỏ.
- Test `contract.test.mjs`: bắt `TUNING` lệch `game.contract.json` — lỗi này rất khó thấy bằng mắt nhưng làm trượt toàn bộ bài chấm tự động.
