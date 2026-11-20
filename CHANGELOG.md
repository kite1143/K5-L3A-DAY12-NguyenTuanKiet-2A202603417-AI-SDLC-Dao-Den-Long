# Changelog

## Phase 4 â€” Ticket-04 "BÃ¬nh minh: phÃ¡t hÃ nh v1.0.0", contract v1.3

### ThÃªm
- **Cháº¿ Ä‘á»™ benchmark** theo contract v1.3: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`. Cáº£nh chuáº©n (`src/render/bench.ts`): 1280Ã—720, vsync táº¯t báº±ng cá» Chromium, 200 BÃ³ng Má»±c `wander` ráº£i Ä‘á»u, 100 Ä‘om Ä‘Ã³m, L1â€“L3 sÃ¡ng `fuel: 100`, táº¯t sinh/sÃ¡t thÆ°Æ¡ng/nháº·t/hao dáº§u/káº¿t thÃºc Ä‘Ãªm, camera bay vÃ²ng 30 m á»Ÿ Y=15 m, 15 s/vÃ²ng. `bench.json` cÃ³ `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`.
- **Soak test**: `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json` â€” 10 Ä‘Ãªm liÃªn tiáº¿p trong má»™t tiáº¿n trÃ¬nh, input ngáº«u nhiÃªn theo seed, bÃ¡o `crashes`, `mem_start_mb`, `mem_end_mb`, `duration_s`.
- **Contract v1.3**: `contract_version: "1.3"`, thÃªm `bench_cmd` vÃ  `soak_cmd`; `build_cmd` cÃ i Chromium cho Playwright (bench cáº§n trÃ¬nh duyá»‡t).
- Cá» `bench` trong scenario/simulation Ä‘á»ƒ Ä‘Ã³ng bÄƒng spawn, sÃ¡t thÆ°Æ¡ng, nháº·t, hao dáº§u vÃ  Ä‘iá»u kiá»‡n káº¿t thÃºc â€” Ä‘áº§u ra headless cá»§a gameplay **khÃ´ng Ä‘á»•i** khi cá» nÃ y váº¯ng máº·t.

### ChÆ°a lÃ m trong phase nÃ y (ghi trung thá»±c)
- **Báº£ng xáº¿p háº¡ng cá»¥c bá»™** (top 10, nháº­p tÃªn, mÃ n hÃ¬nh menu, `--export-leaderboard`): chÆ°a cÃ³.
- **Trá»£ nÄƒng**: Ä‘á»•i phÃ­m, chá»‰ bÃ¡o/phá»¥ Ä‘á», giáº£m chuyá»ƒn Ä‘á»™ng, cá»¡ chá»¯ â‰¥ 18 px + chá»¯ lá»›n: chÆ°a cÃ³ (má»›i cÃ³ cháº¿ Ä‘á»™ mÃ¹ mÃ u á»Ÿ Phase 3).
- **Video demo `.mp4`** vÃ  **GitHub Release v1.0.0**: chÆ°a táº¡o.

## Phase 3 â€” Ticket-03 "ÄÃ¨n cáº¡n dáº§u", contract v1.2

> Change request phÃ¡ vá»¡ tÆ°Æ¡ng thÃ­ch. Quyáº¿t Ä‘á»‹nh thiáº¿t káº¿: [ADR-001](docs/notes/adr-001-lantern-fuel.md).

### âš  Breaking changes

1. **ÄÃ¨n cÃ³ nhiÃªn liá»‡u, `lit` khÃ´ng cÃ²n lÃ  tráº¡ng thÃ¡i cuá»‘i.**
   - ThÃªm `fuel` (0â€“100), `ever_lit`, `relit_count`; hao 1 fuel/giÃ¢y; `fuel â‰¤ 0` â‡’ `lantern_out`, `deposited = 0`, Ä‘Ã¨n nhá»› `ever_lit`.
   - Báº¥m TÆ°Æ¡ng tÃ¡c á»Ÿ Ä‘Ã¨n **Ä‘ang sÃ¡ng nhÆ°ng chÆ°a Ä‘áº§y** = chÃ¢m dáº§u: `used = min(Ä‘ang mang, ceil((100 âˆ’ fuel)/10))`, má»—i Ä‘om Ä‘Ã³m +10 fuel.
   - ÄÃ¨n Ä‘Ã£ tá»«ng sÃ¡ng chá»‰ cáº§n **5** Ä‘om Ä‘Ã³m Ä‘á»ƒ tháº¯p láº¡i (chÆ°a tá»«ng sÃ¡ng: 10).
   - Dáº§u lÆ°u báº±ng **sá»‘ nguyÃªn 1/60** (`fuelUnits`) Ä‘á»ƒ khÃ´ng trÃ´i sá»‘ thá»±c; chá»‰ lÃ m trÃ²n 1 chá»¯ sá»‘ khi xuáº¥t snapshot.
2. **BÃ³ng Má»±c cÃ³ tráº¡ng thÃ¡i `drain`.** ÄÃ¨n `fuel < 30` máº¥t vÃ¹ng an toÃ n; BÃ³ng Má»±c Ä‘ang `wander` Ä‘i tá»›i Ä‘Ã¨n yáº¿u gáº§n nháº¥t, Ä‘á»©ng cÃ¡ch â‰¤ 2 m vÃ  hÃºt 5 fuel/giÃ¢y (cá»™ng dá»“n nhiá»u con). Chuyá»ƒn sang `chase` khi MÃ¢y vÃ o â‰¤ 6 m, sang `wander` khi Ä‘Ã¨n táº¯t / fuel â‰¥ 30 / cÃ¡ch > 2 m.
3. **Luáº­t tháº¯ng Ä‘á»•i hoÃ n toÃ n.** KhÃ´ng cÃ²n tháº¯ng sá»›m khi tháº¯p Ä‘á»§ Ä‘Ã¨n. Tháº¯ng khi háº¿t giá», cÃ²n sá»‘ng, vÃ  sá»‘ Ä‘Ã¨n sÃ¡ng â‰¥ `ceil(0.6 Ã— tá»•ng)` (ÄÃªm 1: 3/5, ÄÃªm 2: 4/6, ÄÃªm 3: 5/7); lÃ½ do má»›i `dawn_survived`. `all_lit` bá»‹ xoÃ¡.
4. **Thá»i lÆ°á»£ng Ä‘Ãªm**: 240 / 270 / 300 s (trÆ°á»›c 300/330/360).
5. **CÃ´ng thá»©c Ä‘iá»ƒm má»›i**: +5/Ä‘om Ä‘Ã³m náº¡p (thay +10), +100 tháº¯p láº§n Ä‘áº§u, +40 tháº¯p láº¡i, +5/BÃ³ng Má»±c trÃºng tá»a sÃ¡ng (+15 náº¿u nÃ³ Ä‘ang `drain`), thÆ°á»Ÿng bÃ¬nh minh `+50 + floor(fuel)` má»—i Ä‘Ã¨n sÃ¡ng vÃ  `+50` má»—i Ngá»n Lá»­a. **Bá»** thÆ°á»Ÿng thá»i gian vÃ  thÆ°á»Ÿng lá»­a cÅ©.
6. **Sá»©c chá»©a tÄƒng dáº§n**: 10 + 2 Ã— sá»‘ láº§n tháº¯p thÃ nh cÃ´ng, tá»‘i Ä‘a 20 (Ä‘Ã¨n Ä‘áº·t sáºµn báº±ng scenario khÃ´ng tÃ­nh); Ä‘áº·t láº¡i má»—i Ä‘Ãªm.
7. **Contract v1.2**: tuning thÃªm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`; snapshot thÃªm `lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`, vÃ  `drain` trong danh sÃ¡ch tráº¡ng thÃ¡i BÃ³ng Má»±c; scenario thÃªm `player.successful_lights`, `lanterns[].{fuel, ever_lit}`, `shades[].target_lantern_id`; event má»›i `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`, `game_over.reason = dawn_survived`.

### ThÃªm
- **Cháº¿ Ä‘á»™ mÃ¹ mÃ u** (CÃ i Ä‘áº·t, Ä‘Æ°á»£c lÆ°u): viá»n BÃ³ng Má»±c `#00B3FF`, mÃ u cáº£nh bÃ¡o `#FFFFFF` kÃ¨m âš ; Ä‘Ã¨n táº¯t xáº¹p 20% + váº¿t rÃ¡ch, Ä‘Ã¨n sáº¯p cáº¡n nháº¥p nhÃ¡y 1 Hz â€” phÃ¢n biá»‡t Ä‘Æ°á»£c khÃ´ng cáº§n mÃ u.
- **Thanh dáº§u** trÃªn má»—i Ä‘Ã¨n Ä‘ang sÃ¡ng, Ä‘á»•i mÃ u khi gáº§n cáº¡n; HUD cÃ³ chip cáº£nh bÃ¡o "Lx sáº¯p cáº¡n dáº§u"; thanh Ä‘om Ä‘Ã³m giÃ£n theo sá»©c chá»©a hiá»‡n táº¡i (`x/capacity`).
- 6 scenario headless má»›i (13â€“18) cho hao dáº§u, chÃ¢m dáº§u, táº¯t Ä‘Ã¨n, hÃºt dáº§u, bÃ¬nh minh sá»‘ng sÃ³t, sá»©c chá»©a.

### Test bá»‹ luáº­t má»›i lÃ m sai â€” Ä‘Ã£ sá»­a/bá», cÃ³ lÃ½ do
| Test cÅ© | Xá»­ lÃ½ | LÃ½ do |
|---|---|---|
| "lighting every lantern wins" | **bá»**, thay báº±ng "surviving to dawn with enough lanterns" | Phase 3 khÃ´ng cÃ²n tháº¯ng sá»›m (`all_lit` Ä‘Ã£ bá»‹ xoÃ¡) |
| `time_left_s` 300/330/360, `21600` tick | sá»­a thÃ nh 240/270/300, `18000` tick | thá»i lÆ°á»£ng Ä‘Ãªm Ä‘á»•i |
| Äiá»ƒm +10/Ä‘om Ä‘Ã³m, thÆ°á»Ÿng thá»i gian | sá»­a thÃ nh +5/Ä‘om Ä‘Ã³m, thÆ°á»Ÿng bÃ¬nh minh | cÃ´ng thá»©c Ä‘iá»ƒm má»›i |
| Sá»©c chá»©a cá»‘ Ä‘á»‹nh 10 | sá»­a: 10 + 2 Ã— sá»‘ láº§n tháº¯ng, tráº§n 20 | luáº­t má»›i |
| VÃ¹ng an toÃ n luÃ´n cÃ³ | sá»­a: chá»‰ khi `fuel â‰¥ 30` | luáº­t má»›i |
| 5 tráº¡ng thÃ¡i BÃ³ng Má»±c | sá»­a: 6 (thÃªm `drain`) | luáº­t má»›i |

## Phase 2 â€” Ticket-02, contract v1.1 ("Ba hÃ²n Ä‘áº£o")

### Thay Ä‘á»•i (phÃ¡ vá»¡ tÆ°Æ¡ng thÃ­ch, theo yÃªu cáº§u)
- **Chuáº©n hoÃ¡ má»i sá»‘ liá»‡u** sang bá»™ sá»‘ cá»§a ticket: cháº¡y 6,0 m/s, nháº£y 7,0/âˆ’20, mang 10 Ä‘om Ä‘Ã³m, Ä‘Ã¨n giÃ¡ 10, nháº·t 1,0 m, tÆ°Æ¡ng tÃ¡c 2,0 m, tá»a sÃ¡ng 3 Ä‘om Ä‘Ã³m/5 m/3 s, an toÃ n 6 m, BÃ³ng Má»±c 4,0 m/s, `fall_enabled: true`.
- **Báº£n Ä‘á»“ chuáº©n hoÃ¡ láº¡i**: ÄÃªm 1 giá» bÃ¡n kÃ­nh 40 m vá»›i 5 Ä‘Ã¨n á»Ÿ toáº¡ Ä‘á»™ má»›i; Ä‘om Ä‘Ã³m vÃ  BÃ³ng Má»±c sinh theo danh sÃ¡ch Ä‘iá»ƒm chuáº©n.
- **Äiá»ƒm `per_mote` giá» tÃ­nh khi náº¡p vÃ o Ä‘Ã¨n**, khÃ´ng pháº£i khi nháº·t (theo Pháº§n 1 cá»§a ticket).
- **BÃ³ng Má»±c cÃ³ state chuáº©n**: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- **Test Phase 1 viáº¿t láº¡i** theo sá»‘ chuáº©n: 67 â†’ 89 test, cÃ³ nhÃ³m `features.test.mjs` cho tÃ­nh nÄƒng má»›i.

### ThÃªm
- **ÄÃªm 2 â€” Äáº£o Cau**: hai Ä‘áº£o bÃ¡n kÃ­nh 28 m ná»‘i báº±ng cáº§u tre, 2 bá»¥c nháº£y (14 m/s lÃªn, 24 m/s ngang), 6 Ä‘Ã¨n.
- **ÄÃªm 3 â€” Äáº£o ChuÃ´ng**: ba táº§ng (0/3/6 m), 2 dá»‘c 30Â°/150Â°, bá»¥c nháº£y lÃªn táº§ng 2, thÃ¡p chuÃ´ng, giÃ³ giáº­t má»—i 30 s (bÃ¡o trÆ°á»›c 2 s, Ä‘áº©y 2 m/s), 7 Ä‘Ã¨n.
- **LÆ°á»›t (dash)**: 14 m/s trong 12 tick, há»“i 1,5 s, giá»¯ Ä‘á»™ cao khi lÆ°á»›t trÃªn khÃ´ng, khÃ´ng báº¥t tá»­.
- **GiÃ³ Láº¡c (drifters)**: 7 m/s, tá»‘i Ä‘a 2, sinh á»Ÿ tick 1200/2400, idleâ†”chase theo sá»‘ Ä‘om Ä‘Ã³m vÃ  khoáº£ng cÃ¡ch, cÆ°á»›p 3 Ä‘om Ä‘Ã³m rá»“i bá» cháº¡y; tá»a sÃ¡ng lÃ m nÃ³ Ä‘Ã¡nh rÆ¡i chiáº¿n lá»£i pháº©m.
- **BÃ¹a GiÃ³ (charms)**: 600 tick, cháº¡y 7,2 m/s, lÆ°á»›t khÃ´ng há»“i chiÃªu, xuáº¥t hiá»‡n láº¡i sau 2700 tick.
- **RÆ¡i khá»i Ä‘áº£o**: máº¥t 1 lá»­a + toÃ n bá»™ Ä‘om Ä‘Ã³m, chá» 60 tick, há»“i sinh á»Ÿ Ä‘iá»ƒm xuáº¥t phÃ¡t, báº¥t tá»­ 90 tick.
- **Äom Ä‘Ã³m rÆ¡i** khi bá»‹ Ä‘Ã¡nh: `kind: "dropped"`, TTL 480 tick, nháº·t láº¡i tá»« tick sau.
- **Táº¡m dá»«ng** (Esc/P): dá»«ng hoÃ n toÃ n, tick váº«n tÄƒng nhÆ°ng `sim_tick`, thá»i gian, há»“i chiÃªu, spawn vÃ  TTL Ä‘á»©ng yÃªn.
- **Chuá»—i 3 Ä‘Ãªm**: menu â†’ giá»›i thiá»‡u Ä‘Ãªm â†’ chÆ¡i â†’ káº¿t quáº£ â†’ Ä‘Ãªm káº¿; tháº¯ng ÄÃªm 3 hiá»‡n BÃ¬nh Minh vá»›i tá»•ng Ä‘iá»ƒm.
- **CÃ i Ä‘áº·t** Ã¢m lÆ°á»£ng + Ä‘á»™ nháº¡y chuá»™t, lÆ°u báº±ng `localStorage`.
- **HUD Ä‘áº§y Ä‘á»§** theo Pháº§n 3: lá»­a, Ä‘á»“ng há»“ mm:ss (Ä‘á» vÃ  nháº¥p nhÃ¡y â‰¤ 30 s), Ä‘Ã¨n k/n + Ä‘iá»ƒm, thanh 10 Ã´ Ä‘om Ä‘Ã³m, 2 icon há»“i chiÃªu, nháº¯c "E â€” Náº¡p Ã¡nh sÃ¡ng (x/10)", mÅ©i tÃªn chá»‰ Ä‘Ã¨n gáº§n nháº¥t ngoÃ i khung hÃ¬nh.
- **Ã‚m thanh**: nháº¡c ná»n Ä‘Ãªm + 11 hiá»‡u á»©ng (thÃªm nháº£y, lÆ°á»›t, BÃ¹a, GiÃ³ Láº¡c, Ä‘áº¿m ngÆ°á»£c 10 s).
- **Contract v1.1**: `--night 1..3`, snapshot/scenario/inputs/event má»›i, palette chuáº©n trong code.
- **Harness**: `scripts/fps.mjs` Ä‘o FPS tháº­t; `verify.mjs` kiá»ƒm tra schema v1.1 vÃ  báº£ng mÃ u.

### Sá»­a
- Nhá»‹p choÃ¡ng cá»§a Tá»a SÃ¡ng: trÆ°á»›c lÃ  119 tick do bá»‹ trá»« ngay trong tick kÃ­ch hoáº¡t; nay Ä‘Ãºng **120 tick**.

## ChÆ°a phÃ¡t hÃ nh (sau `phase-1`)

### Sá»­a
- **BÃ³ng Má»±c sinh ra trong lÃºc chÆ¡i khÃ´ng Ä‘Æ°á»£c váº½.** `GameView.rebuild()` chá»‰ táº¡o mesh cho nhá»¯ng shade tá»“n táº¡i lÃºc dá»±ng cáº£nh, mÃ  lÃºc Ä‘Ã³ danh sÃ¡ch rá»—ng; shade spawn á»Ÿ giÃ¢y thá»© 6 váº«n Ä‘uá»•i vÃ  gÃ¢y sÃ¡t thÆ°Æ¡ng trong mÃ´ phá»ng nhÆ°ng **vÃ´ hÃ¬nh** trÃªn mÃ n hÃ¬nh. `sync()` giá» táº¡o mesh lazily theo `id`. ThÃªm kiá»ƒm tra tá»± Ä‘á»™ng: hook `__dao.renderedShades()` so sá»‘ mesh tháº­t vá»›i sá»‘ shade trong mÃ´ phá»ng, bot trong `scripts/shots.mjs` bÃ¡o `MISSING MESH` náº¿u lá»‡ch (Ä‘Ã£ cháº¡y: `sim=1 rendered=1`).
- BÃ³ng Má»±c Ä‘áº­m hÆ¡n cho ra dÃ¡ng "má»±c Ä‘en trong sÆ°Æ¡ng" (lÃµi gáº§n Ä‘en, quáº§ng tÃ­m), thÃªm nhá»‹p "thá»Ÿ" nháº¹ Ä‘á»ƒ nhÃ¬n ra lÃ  sinh váº­t sá»‘ng.

### ThÃªm
- **Prop cáº£nh váº­t low-poly** tá»« Polyfork (CC BY 4.0): thÃ´ng, Ä‘Ã¡, tÃºp lá»u cá»§a ngÆ°á»i giá»¯ báº¿n, thuyá»n má»™c, Ä‘Ã¨n lá»“ng lá»›n, náº¥m phÃ¡t sÃ¡ng. Táº¥t cáº£ náº±m trong `public/models/` vÃ  Ä‘Æ°á»£c credit Ä‘áº§y Ä‘á»§ á»Ÿ `CREDITS.md`.
- `src/render/assets.ts`: táº£i GLB báº±ng `GLTFLoader`, chuáº©n hoÃ¡ kÃ­ch thÆ°á»›c theo chiá»u cao mong muá»‘n vÃ  Ä‘áº·t Ä‘Ã¡y vá» máº·t Ä‘áº¥t; **táº£i lá»—i thÃ¬ tráº£ `null`** vÃ  cáº£nh quay vá» mesh thá»§ tá»¥c, nÃªn repo váº«n cháº¡y khi offline hay thiáº¿u file.
- `scripts/fetch-assets.mjs` + `npm run assets` Ä‘á»ƒ táº£i láº¡i Ä‘Ãºng danh sÃ¡ch model (id náº±m trong script, credit náº±m trong `PROP_CREDITS`).
- MÃ n "Äang táº£i Ä‘áº£oâ€¦" trong lÃºc náº¡p asset.

### Ghi chÃº
- NhÃ¢n váº­t MÃ¢y **váº«n** lÃ  hÃ¬nh há»c tá»± dá»±ng: PRD-0 báº¯t buá»™c "nÃ³n lÃ¡ cÃ³ treo má»™t chiáº¿c Ä‘Ã¨n lá»“ng nhá»", khÃ´ng cÃ³ mÃ´ hÃ¬nh ngoÃ i nÃ o khá»›p.
- Chá»‰ táº£i mesh file `.glb`; file `.mjs` cá»§a Polyfork **khÃ´ng** thuá»™c CC BY nÃªn khÃ´ng dÃ¹ng.
- Asset chá»‰ tá»“n táº¡i á»Ÿ lá»›p render â†’ `npm run verify` váº«n PASS nguyÃªn tráº¡ng (67 test, 8 scenario, táº¥t Ä‘á»‹nh).

## Phase 1 â€” PRD-0 + Test Contract v1.0

### Sá»­a
- **PhÃ­m `A`/`D` bá»‹ Ä‘áº£o hÆ°á»›ng.** Camera Ä‘á»©ng sau MÃ¢y vÃ  nhÃ¬n vá» `+Z`, nÃªn trong há»‡ toáº¡ Ä‘á»™ tay pháº£i phÃ­a bÃªn pháº£i mÃ n hÃ¬nh lÃ  `-X`; trÆ°á»›c Ä‘Ã¢y `D` láº¡i gá»­i `+X` vÃ o mÃ´ phá»ng nÃªn nhÃ¢n váº­t Ä‘i sang trÃ¡i. Sá»­a á»Ÿ lá»›p input (`src/render/input.ts`), **khÃ´ng** Ä‘á»¥ng vÃ o `src/core` vÃ¬ Test Contract quy Ä‘á»‹nh cÃ¡ch `move` Ä‘á»•i sang hÆ°á»›ng tháº¿ giá»›i. ÄÃ£ kiá»ƒm chá»©ng báº±ng bot chÆ¡i tháº­t á»Ÿ hai gÃ³c camera: `D@yaw0 dx=âˆ’1.50`, `A@yaw0 dx=+1.50`, `D@yaw90 dz=+1.50`, `A@yaw90 dz=âˆ’1.50`.

### ThÃªm
- MÃ n **ÄÃªm 1 â€” Äáº£o Báº¿n**: Ä‘áº£o trÃ²n bÃ¡n kÃ­nh 26 m, 5 ÄÃ¨n Lá»“ng Lá»›n trÃªn vÃ nh 17 m.
- NhÃ¢n váº­t MÃ¢y: Ä‘i láº¡i, nháº£y, camera gÃ³c thá»© ba xoay báº±ng chuá»™t.
- Äom Ä‘Ã³m: 30 con ráº£i theo seed, nháº·t tá»± Ä‘á»™ng, mang tá»‘i Ä‘a 3.
- Náº¡p Ä‘om Ä‘Ã³m vÃ o Ä‘Ã¨n (`E`), Ä‘Ã¨n chÃ¡y khi Ä‘á»§ 3.
- BÃ³ng Má»±c: Ä‘uá»•i theo ngÆ°á»i chÆ¡i, gÃ¢y sÃ¡t thÆ°Æ¡ng, sá»£ vÃ²ng an toÃ n quanh Ä‘Ã¨n Ä‘Ã£ chÃ¡y.
- Tá»a sÃ¡ng (`F`): lÃ m choÃ¡ng vÃ  Ä‘áº©y BÃ³ng Má»±c, cÃ³ há»“i chiÃªu.
- Tháº¯ng/thua/Ä‘iá»ƒm, HUD, mÃ n giá»›i thiá»‡u, mÃ n káº¿t thÃºc, chÆ¡i láº¡i.
- Ã‚m thanh tá»•ng há»£p báº±ng WebAudio (khÃ´ng asset).
- Cháº¿ Ä‘á»™ headless theo Test Contract v1.0: `game.contract.json`, CLI `dist/headless/main.js`, snapshot/event/end JSONL, táº¥t Ä‘á»‹nh theo seed.
- 67 test tá»± Ä‘á»™ng: há»£p Ä‘á»“ng, mÃ´ phá»ng, CLI (gá»“m mÃ£ thoÃ¡t 2 cho file sai Ä‘á»‹nh dáº¡ng).
- Harness: `AGENTS.md`, `scripts/verify.mjs`, `scripts/shots.mjs` (bot chÆ¡i tháº­t), hook `pre-commit`.

### Ghi chÃº thiáº¿t káº¿
- TÃ¡ch `src/core` (logic thuáº§n, khÃ´ng DOM/three, khÃ´ng `Math.random`) khá»i `src/render` Ä‘á»ƒ cÃ¹ng má»™t Ä‘oáº¡n mÃ£ mÃ´ phá»ng phá»¥c vá»¥ cáº£ báº£n cÃ³ giao diá»‡n vÃ  báº£n headless.
- Tá»‘c Ä‘á»™ di chuyá»ƒn lÃ  tá»©c thá»i (khÃ´ng quÃ¡n tÃ­nh) Ä‘á»ƒ phÃ©p Ä‘o trong contract chÃ­nh xÃ¡c: 1 giÃ¢y Ä‘i Ä‘Ãºng `player_speed` mÃ©t.
- `dist/headless/main.js` Ä‘Æ°á»£c commit vÃ¬ `headless_cmd` trá» trá»±c tiáº¿p vÃ o nÃ³; `verify.mjs` kiá»ƒm tra bundle cÃ²n khá»›p `src/`.
- Má»i trang trÃ­ lá»›n (cÃ¢y) Ä‘áº·t á»Ÿ vÃ nh Ä‘áº£o Ä‘á»ƒ khÃ´ng che camera.
