# Nguồn gốc tài sản (CREDITS)

## Nhân vật và bối cảnh

**Đảo Đèn Lồng**, **Mây**, **Bóng Mực**, **đom đóm**, **Đèn Lồng Lớn** và **Đảo Bến** là nhân vật/bối cảnh gốc của lab Day 12 (AI SDLC). Không dùng nhân vật, nhạc, mô hình hay thương hiệu của game/phim nào khác.

## Hình ảnh

Không có file ảnh, mô hình 3D hay texture nào được đưa vào repo. Toàn bộ hình ảnh được dựng bằng hình học Three.js và ánh sáng trong mã nguồn:

| Thành phần | Sinh ra từ | Giấy phép |
|---|---|---|
| Đảo, đá, cây thông, đường đất, vành bờ | `src/render/scene.ts` — Three.js primitives | MIT (mã trong repo) |
| Mây, nón lá, thân nhân vật, đèn lồng, Bóng Mực | `src/render/entities.ts` | MIT (mã trong repo) |
| Quầng sáng (glow) | `src/render/textures.ts` — gradient vẽ bằng canvas 2D lúc chạy | MIT (mã trong repo) |
| Bầu trời, sao, trăng, biển mây | `src/render/scene.ts` | MIT (mã trong repo) |

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
