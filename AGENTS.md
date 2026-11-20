# AGENTS.md — Đảo Đèn Lồng

Hướng dẫn cho agent làm việc trong repo này. Ngắn, cụ thể, cập nhật khi agent mắc lỗi lặp lại.

## Lệnh

```bash
npm install            # cài phụ thuộc
npm run build          # typecheck + core + headless + web
npm test               # 67 test (node:test), phải xanh trước khi commit
npm run verify         # build + test + scenario + tất định → docs/proof/<phase>/
npm run headless -- --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]
npm run dev            # http://localhost:5173 (nạp lại khi sửa)
```

Chạy bot chơi thật để chụp ảnh bằng chứng (cần cài thêm, không nằm trong dependencies):

```bash
npm install --no-save playwright && npx playwright install chromium
node scripts/shots.mjs http://localhost:5173/ docs/proof/phase-N/screens <seed>
```

## Kiến trúc — ranh giới không được vượt

- `src/core/**` là **nguồn sự thật** cho mô phỏng. **Cấm** import `three`, DOM, `window`, `node:*` và **cấm** dùng `Math.random`, `Date.now`, `performance.now`. Mọi ngẫu nhiên đi qua `makeRng(seed)`.
- `src/render/**` chỉ **đọc** trạng thái từ core rồi vẽ. Không được quyết định luật chơi ở đây.
- `src/headless/**` chỉ là CLI mỏng quanh `runSimulation`.
- Chuẩn hình học: gốc toạ độ ở tâm đảo, Y hướng lên, mặt đất Y = 0, mọi khoảng cách là XZ.

## Quy tắc cứng

1. **Tuning phải khớp contract.** `TUNING` trong `src/core/config.ts` và `tuning` trong `game.contract.json` phải giống hệt; test `tests/contract.test.mjs` canh việc này. Sửa một bên thì sửa cả hai trong cùng commit.
2. **Không kết thúc công việc khi test đỏ.** Hook `pre-commit` chặn commit nếu typecheck hoặc test fail.
3. **`dist/headless/main.js` được commit vì `headless_cmd` trỏ vào nó.** Sau khi sửa `src/core` hoặc `src/headless`, chạy `npm run build:headless` và commit lại file đó; `verify.mjs` sẽ báo "stale bundle" nếu quên.
4. **Mỗi yêu cầu mới phải có test trước, bằng chứng sau.** Không có output thật trong `docs/proof/` thì coi như chưa xong.
5. **Yêu cầu mới làm sai test cũ thì sửa hoặc bỏ test kèm lý do**, ghi vào `CHANGELOG.md` và `docs/notes/`, không được xoá âm thầm.
6. Không commit `.env`, API key, token. Assets ngoài chỉ nhận CC0/CC-BY/MIT và phải ghi vào `CREDITS.md`.

## Bẫy đã gặp (đừng lặp lại)

| Bẫy | Cách tránh |
|---|---|
| Test đọc `snapshots.at(-1)` với `--snapshot-every 10` sẽ nhận snapshot cũ, không phải trạng thái cuối | Dùng `snapshotEvery: 1`, hoặc đọc `result.world` |
| `vite build` lỗi `Access is denied` khi esbuild xoá temp file trên Windows | Đã xử lý trong `vite.config.ts` (Windows dùng TEMP cục bộ `.tmp/`) |
| File JSON do PowerShell ghi có BOM làm `JSON.parse` fail | `readJson` đã bỏ BOM; test CLI có ca hồi quy |
| Point light đặt **trong** mesh nhân vật thì chỉ sáng mặt trong | Đặt đèn lồng ở phía trước **và** phía sau nhân vật |
| Cây/đá mọc giữa sân che camera | Trang trí lớn chỉ đặt ở vành đảo (bán kính ≥ 19 m) |
| `A`/`D` đi ngược hướng màn hình: camera nhìn về `+Z` nên **phải màn hình là `-X`** | Đảo dấu trục X ở lớp input (`src/render/input.ts`), không sửa `src/core`; bot trong `scripts/shots.mjs` có kiểm tra hướng ở hai góc camera |
| Đo chuyển động bằng bot ở headless Chromium (SwiftShader ~5–10 fps) dễ ra 0 m nếu giữ phím quá ngắn | Giữ phím ≥ 900 ms rồi chờ thêm ≥ 450 ms trước khi đọc trạng thái |

## Quy ước commit

```
<type>(phase-N): mô tả ngắn ở thể mệnh lệnh
```

`type`: `feat`, `fix`, `test`, `docs`, `chore`. Mỗi commit một việc. Không force push sau khi đã gắn tag phase.
