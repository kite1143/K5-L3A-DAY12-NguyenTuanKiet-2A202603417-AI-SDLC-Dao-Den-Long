# Nhật ký dùng AI

Ghi theo từng phase: đã nhờ AI việc gì, AI sai ở đâu, tôi phát hiện bằng cách nào, đã chỉnh harness gì, và ước tính token.

## Cách ước tính token

Tôi không có số đo chính xác từng request, nên ước tính theo công thức minh bạch:

```
token ≈ (số lượt trao đổi) × (ngữ cảnh trung bình mỗi lượt) + (token sinh ra)
```

Ngữ cảnh trung bình lấy bằng khoảng một nửa ngữ cảnh cuối phiên, vì ngữ cảnh lớn dần theo thời gian. Con số dưới đây là **ước tính**, không phải số đo — ghi để thấy mình có tiết kiệm hay không, không phải để khoe.

## Phase 2 (Ticket-02, contract v1.1)

**Đã nhờ AI:** đọc ticket, viết spec + acceptance criteria (AC-1…AC-54), viết lại toàn bộ lớp core theo số chuẩn, thêm 3 bản đồ, 3 cơ chế mới (lướt, Gió Lạc, Bùa Gió), rơi khỏi đảo, gió, pause; viết lại lớp render cho 3 đêm + HUD + menu/pause/settings + âm thanh; viết lại bộ test và bằng chứng.

**Ước tính:** ~45 lượt trao đổi, ngữ cảnh cuối phiên ~150k token, ngữ cảnh trung bình ~85k → **~3,8 triệu token vào**, **~120k token ra**. Nhiều hơn Phase 1 khoảng 2×, đúng với khối lượng (ticket gấp ~3 lần PRD-0).

**Cách tiết kiệm:**
- Viết **spec + acceptance criteria trước** rồi mới code: mọi yêu cầu thành một dòng kiểm chứng được, nên không phải quay lại đọc ticket nhiều lần.
- Dựng `verify.mjs` + `shots.mjs` từ Phase 1 nên Phase 2 chỉ việc thêm scenario, không phải nghĩ lại cách lấy bằng chứng.
- Gom việc: một lần viết cả `nights.ts` (bản đồ 3 đêm + địa hình) thay vì từng đêm một.
- Không đưa output JSONL đầy đủ vào ngữ cảnh — chỉ đọc các dòng tổng kết do `verify.mjs` in ra.

**AI sai ở đâu — và tôi phát hiện bằng cách nào:**

| Lần sai | Phát hiện nhờ | Đã sửa ở đâu (harness) |
|---|---|---|
| Viết test đặt `carried` ở **cấp scenario** thay vì trong `player` → tưởng code sai trong khi code đúng | Assertion báo `firstEvent(...)` là `undefined`, tôi in `parseScenario` của chính file đó ra | Ghi vào `AGENTS.md`: scenario v1.1 đặt mọi thứ của người chơi trong `player` |
| Test đọc tick 121 nhưng `snapshotEvery: 15` → không có snapshot đó | `snapAt(...)` trả `undefined` | Bảng bẫy: "muốn xem tick cụ thể thì đặt `snapshotEvery: 1`" |
| Choáng Tỏa Sáng chỉ 119 tick vì bị trừ ngay trong tick kích hoạt | Test so tick 120/121 | Sửa `stateTicksLeft = PULSE_STUN_TICKS + 1` + ghi bẫy |
| Test "chạy hết đêm" thất bại vì gió Đêm 3 đẩy người chơi rơi khỏi đảo | `end.ticks` = 16.983 thay vì 21.600 | Test phải tắt `wind_enabled`; ghi bẫy |
| Sinh file scenario bằng `ConvertTo-Json` của PowerShell → có BOM và có mảng 4 phần tử | CLI trả "motes[0] must be an array of 3 numbers" | Viết JSON trực tiếp; thêm bước kiểm tra bằng `parseScenario` trước khi commit |
| Đo FPS ra 3,8 → tưởng game quá nặng | Kiểm tra `WEBGL_debug_renderer_info` thấy "SwiftShader" | Chuyển sang `--use-angle=d3d11` (GPU thật) → 59,7 FPS; ghi bẫy |
| Quên `--night` trong `verify.mjs` khi mở rộng manifest | Scenario Đêm 2/3 chạy sai đêm | `verify.mjs` đọc `entry.night` |

**Harness rút ra sau Phase 2:**
- Spec + AC **là** công cụ kiểm chứng: mỗi AC ánh xạ 1-1 sang một test hoặc một ảnh.
- `verify.mjs` giờ kiểm tra cả **schema snapshot v1.1** và **bảng màu chuẩn** — hai thứ rất dễ trôi mà test đơn vị không thấy.
- `fps.mjs` đo bằng GPU thật và ghi lại tên renderer, để con số FPS không bị hiểu sai là "game chậm".

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
