#!/usr/bin/env node
/**
 * shots.mjs — plays the real browser build and saves proof screenshots.
 *
 * Phase 3 focus: the lantern fuel bar, the low-fuel warning, a draining shade,
 * the colour-blind palette and the settings panel. Fuel situations are set up
 * with the same scenario format the headless contract uses (through the
 * `__dao.startNight(night, scenario)` debug hook), so the rules that run are the
 * real ones — only the starting state is scripted. Normal play is exercised
 * first, from the menu, with keyboard input only.
 *
 * Requirements (kept out of package.json on purpose: graders do not need it):
 *   npm install --no-save playwright && npx playwright install chromium
 *
 * Usage: node scripts/shots.mjs <url> [outDir] [seed]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outDir = process.argv[3] ?? 'docs/proof/phase-3/screens';
const seed = process.argv[4] ?? '202603417';
mkdirSync(outDir, { recursive: true });

const transcript = [];
const consoleLog = [];
const log = (m) => {
  transcript.push(m);
  process.stdout.write(`${m}\n`);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
page.on('console', (m) => consoleLog.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => consoleLog.push(`[pageerror] ${e.message}`));

const read = () => page.evaluate(() => window.__dao.snapshot());
const phaseOf = () => page.evaluate(() => window.__dao.snapshot().phase);
const waitPhase = (name) =>
  page.waitForFunction((phase) => window.__dao?.snapshot().phase === phase, name, { timeout: 60000 });
const setYaw = (deg) => page.evaluate((value) => window.__dao.setYaw(value), deg);
const startNight = (n, scenario = null) => page.evaluate(([night, s]) => window.__dao.startNight(night, s), [n, scenario]);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clickButton = (text) =>
  page.evaluate((label) => {
    const buttons = [...document.querySelectorAll('.overlay .buttons button')];
    buttons.find((b) => b.textContent?.includes(label))?.click();
  }, text);
const shot = async (name) => {
  await page.screenshot({ path: join(outDir, name) });
  log(`  screenshot ${name}`);
};

await page.goto(`${url.split('?')[0]}?seed=${seed}`, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__dao), null, { timeout: 20000 });
await page.waitForTimeout(1200);

// --- normal play from the menu --------------------------------------------
await shot('01-menu.png');
await page.keyboard.press('Enter');
await waitPhase('intro');
await page.waitForTimeout(400);
await shot('02-night1-intro.png');
await page.keyboard.press('Enter');
await waitPhase('playing');
await page.waitForTimeout(600);
log(`night 1 started: seed ${seed}`);

async function measure(key, yaw) {
  await setYaw(yaw);
  await page.waitForTimeout(200);
  const before = await read();
  await page.keyboard.down(key);
  await page.waitForTimeout(700);
  await page.keyboard.up(key);
  await page.waitForTimeout(350);
  const after = await read();
  return { dx: after.player.x - before.player.x, dz: after.player.z - before.player.z };
}
const d0 = await measure('KeyD', 0);
const a0 = await measure('KeyA', 0);
const controlsOk = d0.dx < -0.3 && a0.dx > 0.3;
log(`  controls: D dx=${d0.dx.toFixed(2)} A dx=${a0.dx.toFixed(2)} -> ${controlsOk ? 'OK' : 'WRONG'}`);
if (!controlsOk) process.exitCode = 1;

// Collect a handful of motes with real keyboard input, then screenshot the HUD.
await setYaw(0);
await page.keyboard.down('KeyW');
let deposited = 0;
for (let step = 0; step < 200; step += 1) {
  const state = await read();
  if (state.state !== 'playing') break;
  const shade = state.shades.find((s) => s.state !== 'stunned' && distance(s, state.player) < 4.5);
  if (shade && state.player.carried >= 3) await page.keyboard.press('KeyF');
  const unlit = state.lanterns.filter((l) => !l.lit);
  if (state.player.carried > 0 && unlit.length > 0) {
    const target = unlit.reduce((best, l) => (distance(l, state.player) < distance(best, state.player) ? l : best));
    if (distance(target, state.player) <= 2.0) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(150);
      deposited += 1;
      continue;
    }
    await setYaw((Math.atan2(target.x - state.player.x, target.z - state.player.z) * 180) / Math.PI);
  } else {
    const mote = state.motes.reduce(
      (best, m) => (best === null || distance(m, state.player) < distance(best, state.player) ? m : best),
      null,
    );
    if (!mote) break;
    await setYaw((Math.atan2(mote.x - state.player.x, mote.z - state.player.z) * 180) / Math.PI);
  }
  await page.waitForTimeout(105);
}
await page.keyboard.up('KeyW');
const played = await read();
const rendered = await page.evaluate(() => window.__dao.rendered());
log(
  `  after play: carried ${played.player.carried}/${played.player.capacity}, ` +
    `lanterns lit ${played.lanterns.filter((l) => l.lit).length}/${played.lanterns.length}, ` +
    `shades ${played.shades.length} (rendered ${rendered.shades}), deposit presses ${deposited}`,
);
await shot('03-night1-play.png');
const hud = await page.evaluate(() => {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
  return {
    flames: text('.flames'),
    clock: text('.clock'),
    lanterns: text('.lanterns'),
    score: text('.score'),
    meter: text('.meter-label'),
    slots: document.querySelectorAll('.mote-slot').length,
    full: document.querySelectorAll('.mote-slot.full').length,
    warning: document.querySelector('.warning')?.classList.contains('visible') ?? null,
  };
});
log(`  HUD: flames=${hud.flames} clock=${hud.clock} lanterns=${hud.lanterns} score=${hud.score} motes=${hud.meter} warning=${hud.warning}`);

// --- fuel scenarios through the same scenario format the contract uses -----
const base = {
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  motes: [],
  shades: [],
  drifters: [],
  charms: [],
};

await startNight(1, {
  ...base,
  player: { pos: [0, 0, 20], carried: 6 },
  lanterns: [
    { id: 'L1', lit: true, fuel: 80 },
    { id: 'L2', lit: true, fuel: 20 },
  ],
});
await page.waitForTimeout(1500);
await setYaw(0);
await page.waitForTimeout(600);
await shot('04-lantern-fuel.png');
const fuelState = await read();
log(
  `  fuel bar: ${fuelState.lanterns
    .filter((l) => l.lit)
    .map((l) => `${l.id}=${l.fuel}`)
    .join(' ')} warning=${await page.evaluate(() => document.querySelector('.warning')?.classList.contains('visible'))}`,
);

await startNight(1, {
  ...base,
  player: { pos: [0, 0, -10] },
  lanterns: [{ id: 'L1', pos: [0, 0, 5], lit: true, fuel: 20 }],
  shades: [{ id: 'S1', pos: [0, 0, 3.4], state: 'drain', target_lantern_id: 'L1' }],
});
await page.waitForTimeout(1200);
await setYaw(0);
await page.waitForTimeout(500);
await shot('05-shade-drain.png');
const drainState = await read();
log(
  `  drain: ${drainState.shades.map((s) => `${s.id} ${s.state} → ${s.target_lantern_id ?? '-'}`).join(', ')}; ` +
    `L1 fuel ${drainState.lanterns[0].fuel}`,
);

// --- settings + colour-blind palette --------------------------------------
let phase = await phaseOf();
if (phase === 'playing') {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  phase = await phaseOf();
  log(`  paused for the settings check: phase=${phase}`);
}
if (phase === 'paused' || phase === 'result' || phase === 'dawn') {
  await clickButton('Về menu');
  await waitPhase('menu');
  await page.waitForTimeout(300);
}
await clickButton('Cài đặt');
await page.waitForTimeout(500);
await page.check('.colorblind');
await page.waitForTimeout(300);
await shot('06-settings-colorblind.png');
await page.click('.settings .close');
await page.waitForTimeout(200);
await clickButton('Bắt đầu');
await waitPhase('intro');
await clickButton('Vào đêm');
await waitPhase('playing');
await page.waitForTimeout(900);
await shot('07-colorblind-gameplay.png');
log(
  `  colour-blind mode on: ${await page.evaluate(() => document.querySelector('.hud')?.classList.contains('colorblind'))}`,
);

// --- one more map for the record -----------------------------------------
await startNight(3);
await page.waitForTimeout(2000);
await setYaw(0);
await page.waitForTimeout(800);
await shot('08-night3.png');

writeFileSync(join(outDir, 'playthrough.json'), JSON.stringify({ seed, transcript, consoleLog, hud }, null, 2));
writeFileSync(join(outDir, 'console.log'), `${consoleLog.join('\n')}\n`);
await browser.close();

const errors = consoleLog.filter((line) => line.includes('[pageerror]') || line.includes('[error]'));
if (errors.length > 0) {
  process.stdout.write(`\npage errors detected:\n${errors.join('\n')}\n`);
  process.exitCode = 1;
}
process.stdout.write('\nscreenshots written\n');
