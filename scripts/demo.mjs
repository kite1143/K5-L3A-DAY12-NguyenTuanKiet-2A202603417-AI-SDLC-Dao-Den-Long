#!/usr/bin/env node
/**
 * demo.mjs — records the demo video and the Phase 4 screenshots.
 *
 * Drives the real build through scripts/play.mjs: menu, evidence screen, a short
 * play with keyboard only, a real lost night, entering a name on the result
 * screen, the leaderboard, key remapping and the large-text option.
 * Output: docs/demo/demo.webm + docs/proof/phase-4/screens/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const shotDir = 'docs/proof/phase-4/screens';
const videoDir = 'docs/demo';
mkdirSync(shotDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const log = (m) => process.stdout.write(`${m}\n`);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

const read = () => page.evaluate(() => window.__dao.snapshot());
const phaseOf = () => page.evaluate(() => window.__dao.snapshot().phase);
const waitPhase = (name) =>
  page.waitForFunction((p) => window.__dao?.snapshot().phase === p, name, { timeout: 60000 });
const setYaw = (d) => page.evaluate((v) => window.__dao.setYaw(v), d);
const clickText = (text) =>
  page.evaluate((label) => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.includes(label) && b.offsetParent !== null)?.click();
  }, text);
const shot = async (name) => {
  await page.screenshot({ path: join(shotDir, name) });
  log(`  screenshot ${name}`);
};

await page.goto(`${url.split('?')[0]}?seed=202603417`, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__dao), null, { timeout: 30000 });
await page.waitForTimeout(1500);
await shot('01-menu.png');

// Evidence screen (bench + soak numbers served by play.mjs).
await clickText('Bằng chứng');
await page.waitForTimeout(900);
await shot('02-proof.png');
await clickText('Đóng');
await page.waitForTimeout(300);

// Leaderboard screen (may be empty at first).
await clickText('Bảng xếp hạng');
await page.waitForTimeout(700);
await shot('03-leaderboard-empty.png');
await clickText('Đóng');
await page.waitForTimeout(300);

// Play with the keyboard only.
await clickText('Bắt đầu');
await waitPhase('intro');
await page.waitForTimeout(400);
await shot('04-intro.png');
await clickText('Vào đêm');
await waitPhase('playing');
await page.waitForTimeout(500);

await setYaw(0);
await page.keyboard.down('KeyW');
let targetId = null;
for (let step = 0; step < 420; step += 1) {
  const state = await read();
  if (state.state !== 'playing') break;
  const shade = state.shades.find((s) => s.state !== 'stunned' && dist(s, state.player) < 4.5);
  if (shade && state.player.carried >= 3) await page.keyboard.press('KeyF');
  if (state.player.carried > 0) {
    const unlit = state.lanterns.filter((l) => !l.lit);
    if (unlit.length > 0) {
      if (!targetId) {
        const near = unlit.reduce((b, l) => (dist(l, state.player) < dist(b, state.player) ? l : b));
        targetId = near.id;
      }
      const target = state.lanterns.find((l) => l.id === targetId) ?? unlit[0];
      if (target.lit) targetId = null;
      else if (dist(target, state.player) <= 2) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(150);
        continue;
      } else await setYaw((Math.atan2(target.x - state.player.x, target.z - state.player.z) * 180) / Math.PI);
    }
  } else {
    const mote = state.motes.reduce((b, m) => (b === null || dist(m, state.player) < dist(b, state.player) ? m : b), null);
    if (!mote) break;
    await setYaw((Math.atan2(mote.x - state.player.x, mote.z - state.player.z) * 180) / Math.PI);
  }
  if (step === 120) await shot('05-play.png');
  await page.waitForTimeout(100);
}

// Lose on purpose (three falls) so the result screen and score entry show up.
await setYaw(0);
await page.keyboard.down('KeyW');
for (let step = 0; step < 600; step += 1) {
  const state = await read();
  if (state.state !== 'playing') break;
  await page.waitForTimeout(140);
}
await page.keyboard.up('KeyW');
await waitPhase('result');
await page.waitForTimeout(700);
await shot('06-result-score-entry.png');

await page.fill('.name-input', 'KY_SU');
await page.waitForTimeout(300);
await clickText('Lưu điểm');
await page.waitForTimeout(900);
await shot('07-leaderboard.png');

// Settings: remap jump, turn on reduce motion and large text.
await clickText('Về menu');
await waitPhase('menu');
await page.waitForTimeout(300);
await clickText('Cài đặt');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.key-button')];
  buttons.find((b) => b.dataset.action === 'jump')?.click();
});
await page.waitForTimeout(300);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(300);
// Try a duplicate on purpose to show the conflict message.
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.key-button')];
  buttons.find((b) => b.dataset.action === 'pulse')?.click();
});
await page.waitForTimeout(200);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(400);
await shot('08-keymap-conflict.png');
await clickText('Khôi phục mặc định');
await page.check('.reduce-motion');
await page.check('.large-text');
await page.waitForTimeout(400);
await shot('09-settings-accessibility.png');
await clickText('Xong');
await page.waitForTimeout(300);
await clickText('Bắt đầu');
await waitPhase('intro');
await clickText('Vào đêm');
await waitPhase('playing');
await page.waitForTimeout(1200);
await shot('10-large-text-hud.png');

writeFileSync(join(shotDir, 'demo-notes.json'), JSON.stringify({ phase: await phaseOf(), url }, null, 2));
await context.close();
await browser.close();
const video = await page.video()?.path();
log(`video: ${video ?? 'none'}`);
process.exit(0);
