# Bằng chứng: chuẩn bị asset cho các phase sau

Thư mục này ghi lại việc **lấy mô hình cảnh vật bên ngoài** (để không phải dựng lại từ đầu ở Phase 2–4) và chứng minh nó không phá phần lõi của Phase 1.

> Không nằm trong tag `phase-1`. Tag `phase-1` có bằng chứng riêng ở [`docs/proof/phase-1/`](../phase-1/summary.md); ảnh chụp ở đây được chụp sau khi thêm asset nên **không** khớp mã ở tag đó — đó là lý do chúng nằm ở đây thay vì bị trộn vào bằng chứng Phase 1.

## Đã lấy gì

8 mô hình low-poly từ **Polyfork**, qua CLI `polyfork` (npm, MIT), lưu ở `public/models/*.glb` (~620 KB tổng):

| Model | Dùng cho | Tris |
|---|---|---:|
| Tall Pine Tree | rặng thông ở vành đảo | 350 |
| Young Pine | thông non xen kẽ | 270 |
| Medium Rock | đá lớn rải trên đảo | 374 |
| Small Rock | đá nhỏ | 202 |
| Harbour Master's Hut | túp lều của người giữ bến (Đảo Bến) | 1468 |
| Wooden Rowboat | thuyền mộc neo trên bờ | 1262 |
| Spirit Lantern | vỏ đèn lồng treo trên cột Đèn Lồng Lớn | 732 |
| Glowing Bonnet Mushroom | nấm phát sáng ven cỏ | 586 |

## Giấy phép — lý do chọn CC BY 4.0

Polyfork cấp mesh file dưới **hai** lựa chọn: CC BY 4.0, hoặc licence riêng "không cần credit nhưng không được phân phối lại file". Repo này **public** và chứa file trong lịch sử git, nên bắt buộc dùng **CC BY 4.0** và ghi credit.

- Dòng credit cho từng model ở [`CREDITS.md`](../../../CREDITS.md), đúng mẫu `Tên by Polyfork (link), CC BY 4.0`.
- **Đã sửa**: scale về kích thước cảnh và xoay quanh trục Y — đã ghi rõ trong CREDITS.
- Chỉ tải mesh `.glb`. File `.mjs` (source có tham số) **không** thuộc CC BY → không dùng, không commit.

## Vì sao không phá Test Contract

- `public/models/` chỉ được `src/render/assets.ts` đọc; `src/render` không bao giờ được `src/core` hay `src/headless` import.
- `placeProp()` trả `null` khi model thiếu/hỏng → cảnh tự quay về mesh thủ tục, game vẫn chạy (thử bằng cách xoá một file `.glb` và tải lại trang).
- `npm run verify` sau khi thêm asset: **ALL CHECKS PASSED** — 67 test, 8 scenario, output headless từng byte giống trước, bundle headless không đổi.

## Nhân vật thì không lấy model ngoài

PRD-0 bắt buộc Mây **"đội nón lá có treo một chiếc đèn lồng nhỏ"**. Không mô hình nào trong catalogue khớp mô tả đó, và thay bằng một nhân vật chung chung sẽ sai yêu cầu. Vì vậy nhân vật, nón lá, đèn trên nón, Bóng Mực và đom đóm vẫn là hình học tự dựng.

## Ảnh chụp (bot chơi thật, seed 202603417, 1152×648)

| Ảnh | Cho thấy gì |
|---|---|
| `screens/01-intro.png` | Màn giới thiệu, đảo phía sau đã có thông/đá/đèn thật |
| `screens/02-island.png` | Toàn cảnh với rặng thông, đá, lều, thuyền, nấm phát sáng |
| `screens/03-first-mote.png` | Nhặt đom đóm đầu tiên |
| `screens/04-pulse.png` | Tỏa sáng khi Bóng Mực áp sát |
| `screens/05-first-lantern-lit.png` | Đèn lồng (model Spirit Lantern) đã cháy, vòng an toàn 3 m |
| `screens/06-end.png` | Màn thắng 5/5 đèn, điểm 1362 |
| `screens/07-replay.png` | Bấm `R`: đêm mới sạch |
| `screens/08-shade.png` | Bóng Mực đuổi ở 8,87 m — bằng chứng mesh được tạo cho shade sinh ra **trong lúc chơi** (trước đó vô hình) |

`playthrough.json` ghi lại nhật ký lượt chơi, `console.log` rỗng lỗi (không có `pageerror`, tức 8 model đều nạp thành công).

## Tải lại

```bash
npm run assets     # đọc danh sách id trong scripts/fetch-assets.mjs
```
