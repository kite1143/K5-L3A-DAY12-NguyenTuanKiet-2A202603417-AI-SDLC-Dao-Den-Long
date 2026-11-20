# Nguồn gốc tài sản (CREDITS)

## Nhân vật và bối cảnh

**Đảo Đèn Lồng**, **Mây**, **Bóng Mực**, **đom đóm**, **Đèn Lồng Lớn** và **Đảo Bến** là nhân vật/bối cảnh gốc của lab Day 12 (AI SDLC). Không dùng nhân vật, nhạc, mô hình hay thương hiệu của game/phim nào khác.

## Hình ảnh

Không có file texture, mô hình nhân vật hay âm thanh nào được vẽ tay. Bối cảnh nền dựng bằng hình học Three.js; các prop ngoài cảnh lấy từ Polyfork (mục dưới).

| Thành phần | Sinh ra từ | Giấy phép |
|---|---|---|
| Đảo, đường đất, vành bờ, biển mây, sao, trăng | `src/render/scene.ts` — Three.js primitives | MIT (mã trong repo) |
| Nhân vật Mây, nón lá, đèn nhỏ trên nón | `src/render/entities.ts` | MIT (mã trong repo) |
| Bóng Mực, đom đóm, đèn lồng của người chơi | `src/render/entities.ts` | MIT (mã trong repo) |
| Quầng sáng (glow) | `src/render/textures.ts` — gradient vẽ bằng canvas 2D lúc chạy | MIT (mã trong repo) |
| Cây thông, đá, túp lều, thuyền, đèn lồng lớn, nấm | `public/models/*.glb` — Polyfork, CC BY 4.0 | xem mục dưới |

## Mô hình 3D ngoài — Polyfork, CC BY 4.0

Các file `.glb` trong `public/models/` là mô hình low-poly của **Polyfork**. Polyfork cấp mỗi mesh file dưới hai lựa chọn: **CC BY 4.0** hoặc licence riêng của họ (không cần credit nhưng **không được phân phối lại file**). Vì repo này **public** và chứa file trong lịch sử git, tôi chọn **CC BY 4.0** — giấy phép cho phép dùng, sửa và phân phối lại kèm credit.

**Đã sửa:** mỗi mô hình được scale về kích thước phù hợp cảnh và xoay quanh trục Y (xem `placeProp` trong `src/render/assets.ts`). Chỉ tải **mesh file `.glb`**; các file `.mjs` (source có tham số) không thuộc CC BY nên không dùng.

| Mô hình | Nguồn | Giấy phép |
|---|---|---|
| Tall Pine Tree | [polyfork.dev/asset/tall-pine-tree-ab4108](https://polyfork.dev/asset/tall-pine-tree-ab4108) | CC BY 4.0 |
| Young Pine | [polyfork.dev/asset/young-pine-0d7695](https://polyfork.dev/asset/young-pine-0d7695) | CC BY 4.0 |
| Medium Rock | [polyfork.dev/asset/medium-rock-e08405](https://polyfork.dev/asset/medium-rock-e08405) | CC BY 4.0 |
| Small Rock | [polyfork.dev/asset/small-rock-db33a7](https://polyfork.dev/asset/small-rock-db33a7) | CC BY 4.0 |
| Harbour Master's Hut | [polyfork.dev/asset/harbour-master-s-hut-226f34](https://polyfork.dev/asset/harbour-master-s-hut-226f34) | CC BY 4.0 |
| Wooden Rowboat | [polyfork.dev/asset/wooden-rowboat-916981](https://polyfork.dev/asset/wooden-rowboat-916981) | CC BY 4.0 |
| Spirit Lantern | [polyfork.dev/asset/spirit-lantern-8d1bfc](https://polyfork.dev/asset/spirit-lantern-8d1bfc) | CC BY 4.0 |
| Glowing Bonnet Mushroom | [polyfork.dev/asset/glowing-bonnet-mushroom-13f518](https://polyfork.dev/asset/glowing-bonnet-mushroom-13f518) | CC BY 4.0 |

Dòng credit theo đúng mẫu của Polyfork, ví dụ: `Tall Pine Tree by Polyfork (https://polyfork.dev/asset/tall-pine-tree-ab4108), CC BY 4.0` — đã sửa: scale và xoay. Tải lại bằng `npm run assets`; danh sách id nằm trong `scripts/fetch-assets.mjs`, credit tương ứng ở `src/render/assets.ts` (`PROP_CREDITS`).

Các mô hình này **chỉ** dùng ở lớp render. Chúng tải không được (offline, thiếu file) thì cảnh tự quay về mesh thủ tục — xem `placeProp` trả `null`. Mô phỏng headless không bao giờ import `src/render`, nên đầu ra theo Test Contract không thể đổi vì asset.

## Âm thanh

Không có file âm thanh. Toàn bộ tiếng động được tổng hợp lúc chạy bằng WebAudio (`src/render/audio.ts`): dao động sin/tam giác/vuông và nhiễu trắng tự sinh, không lấy mẫu từ bất kỳ nguồn nào.

## Thư viện

| Thư viện | Dùng cho | Giấy phép |
|---|---|---|
| [three.js](https://threejs.org/) | render 3D | MIT |
| [Vite](https://vite.dev/) | build bản web | MIT |
| [esbuild](https://esbuild.github.io/) | đóng gói bản headless | MIT |
| [TypeScript](https://www.typescriptlang.org/) | ngôn ngữ | Apache-2.0 |

Playwright chỉ dùng để chụp ảnh bằng chứng (`scripts/shots.mjs`), **không** nằm trong dependencies và không phải một phần của sản phẩm.

## Công cụ AI tạo nội dung

Mã nguồn, test, tài liệu và phần lớn nội dung chữ trong game được viết với sự hỗ trợ của trợ lý AI (DeepSeek Harness / Qwen / DeepSeek). Nội dung chữ tiếng Việt trong game ("Sương đen đã nuốt hết ánh sáng của đảo…") do tôi đặt và biên tập lại. Nhật ký dùng AI: [docs/notes/ai-journal.md](docs/notes/ai-journal.md).

## Tài liệu lab

`docs/lab/` giữ nguyên tài liệu do giảng viên phát hành (README lab, GUIDE, RULES, RUBRIC, CHECKPOINTS, SUBMISSION) để tham chiếu; bản quyền thuộc tác giả của lab.
