#!/usr/bin/env node
/**
 * shots.mjs — plays the real browser build and saves proof screenshots.
 *
 * It launches Chromium (Playwright), opens the game, and drives it with a small
 * bot that steers toward the nearest mote, then toward an unlit lantern, presses
 * E to deposit and F when a shade closes in. Everything it relies on is the
 * same input path a human uses (keyboard + camera yaw), so a successful run is
 * real evidence that the browser build plays.
 *
 * Requirements (kept out of package.json on purpose: graders do not need it):
 *   npm install --no-save playwright && npx playwright install chromium
 *
 * Usage:
 *   node scripts/shots.mjs <url> [outDir] [seed]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outDir = process.argv[3] ?? 'docs/proof/phase-1/screens';
const seed = process.argv[4] ?? '202603417';
const target = `${url.split('?')[0]}?seed=${seed}`;
mkdirSync(outDir, { recursive: true });

const transcript = [];
const consoleLog = [];

function log(message) {
  transcript.push(message);
  process.stdout.write(`${message}\n`);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on('console', (message) => consoleLog.push(`[${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => consoleLog.push(`[pageerror] ${error.message}`));

const read = () => page.evaluate(() => window.__dao.snapshot());
const setYaw = (deg) => page.evaluate((value) => window.__dao.setYaw(value), deg);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

await page.goto(target, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__dao), null, { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '01-intro.png') });
log(`intro screenshot — seed ${seed}`);

// ---- start the night --------------------------------------------------------
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '02-island.png') });
const initial = await read();
log(`island ready: ${initial.motes.length} motes, ${initial.lanterns.length} lanterns, ${initial.timeLeftTicks / 60}s of night`);

// ---- controls sanity check --------------------------------------------------
// The camera looks along +Z, so the right-hand side of the screen is world -X.
// D must walk towards it, A must walk away from it, at any camera yaw.
// Headless Chromium renders through SwiftShader at a low frame rate, so hold the
// key long enough that several frames (and therefore simulation steps) happen.
async function measure(key, yaw) {
  await setYaw(yaw);
  await page.waitForTimeout(250);
  const before = await read();
  await page.keyboard.down(key);
  await page.waitForTimeout(900);
  await page.keyboard.up(key);
  await page.waitForTimeout(450);
  const after = await read();
  return { dx: after.player.x - before.player.x, dz: after.player.z - before.player.z };
}

const dYaw0 = await measure('KeyD', 0);
const aYaw0 = await measure('KeyA', 0);
const dYaw90 = await measure('KeyD', 90);
const aYaw90 = await measure('KeyA', 90);
const controlsOk =
  dYaw0.dx < -0.3 &&
  Math.abs(dYaw0.dz) < Math.abs(dYaw0.dx) &&
  aYaw0.dx > 0.3 &&
  Math.abs(aYaw0.dz) < Math.abs(aYaw0.dx) &&
  dYaw90.dz > 0.3 &&
  Math.abs(dYaw90.dx) < Math.abs(dYaw90.dz) &&
  aYaw90.dz < -0.3 &&
  Math.abs(aYaw90.dx) < Math.abs(aYaw90.dz);
log(
  `controls: D@yaw0 dx=${dYaw0.dx.toFixed(2)} dz=${dYaw0.dz.toFixed(2)} | ` +
    `A@yaw0 dx=${aYaw0.dx.toFixed(2)} | D@yaw90 dz=${dYaw90.dz.toFixed(2)} | ` +
    `A@yaw90 dz=${aYaw90.dz.toFixed(2)} -> ${controlsOk ? 'OK' : 'WRONG DIRECTION'}`,
);
if (!controlsOk) {
  log('CONTROLS CHECK FAILED');
  process.exitCode = 1;
}

// ---- play: collect, deposit, keep the shades off ---------------------------
let firstMoteShot = false;
let firstLanternShot = false;
let allLanternShot = false;
let pressed = 0;

await page.keyboard.down('KeyW');

for (let step = 0; step < 900; step += 1) {
  const state = await read();
  if (state.state !== 'playing') break;

  // Grab the milestone screenshots from the top of the loop so they are taken
  // whichever branch runs next.
  if (!firstMoteShot && state.player.carried >= 1) {
    firstMoteShot = true;
    await page.screenshot({ path: join(outDir, '03-first-mote.png') });
    log(`first mote picked up at ${((initial.timeLeftTicks - state.timeLeftTicks) / 60).toFixed(1)}s`);
  }
  {
    const litNow = state.lanterns.filter((l) => l.lit).length;
    if (!firstLanternShot && litNow >= 1) {
      firstLanternShot = true;
      await page.screenshot({ path: join(outDir, '05-first-lantern-lit.png') });
      log(`lantern lit #1 at ${((initial.timeLeftTicks - state.timeLeftTicks) / 60).toFixed(1)}s`);
    }
    if (!allLanternShot && litNow === state.lanterns.length) {
      allLanternShot = true;
      await page.screenshot({ path: join(outDir, '06-all-lit.png') });
      log(`all ${litNow} lanterns lit at ${((initial.timeLeftTicks - state.timeLeftTicks) / 60).toFixed(1)}s`);
    }
  }

  const shade = state.shades.find((s) => s.state !== 'stunned' && distance(s, state.player) < 4.2);
  if (shade) {
    await page.keyboard.press('KeyF');
    pressed += 1;
    if (pressed === 1) {
      await page.waitForTimeout(140);
      await page.screenshot({ path: join(outDir, '04-pulse.png') });
      log(`pulse screenshot — shade ${shade.id} at ${distance(shade, state.player).toFixed(2)} m`);
    }
  }

  const unlit = state.lanterns.filter((l) => !l.lit);
  const carrying = state.player.carried > 0;

  if (carrying && unlit.length > 0) {
    const lantern = unlit.reduce((best, l) => (distance(l, state.player) < distance(best, state.player) ? l : best));
    const gap = distance(lantern, state.player);
    if (gap <= 2.1) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(160);
      continue;
    }
    await setYaw((Math.atan2(lantern.x - state.player.x, lantern.z - state.player.z) * 180) / Math.PI);
    await page.waitForTimeout(110);
    continue;
  }

  const mote = state.motes.reduce(
    (best, m) => (best === null || distance(m, state.player) < distance(best, state.player) ? m : best),
    null,
  );
  if (!mote) break;

  await setYaw((Math.atan2(mote.x - state.player.x, mote.z - state.player.z) * 180) / Math.PI);
  await page.waitForTimeout(105);
}

await page.keyboard.up('KeyW');
await page.waitForTimeout(500);

const finalState = await read();
await page.screenshot({ path: join(outDir, finalState.state === 'playing' ? '06-progress.png' : '06-end.png') });
log(
  `final: ${finalState.state} / score ${finalState.score} / lanterns lit ${
    finalState.lanterns.filter((l) => l.lit).length
  }/${finalState.lanterns.length} / flames ${finalState.player.flames}`,
);

// ---- replay after the night ends -------------------------------------------
if (finalState.state !== 'playing') {
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(900);
  const replay = await read();
  const replayOk =
    replay.state === 'playing' &&
    replay.score === 0 &&
    replay.lanterns.every((l) => !l.lit) &&
    replay.player.flames === 3 &&
    replay.timeLeftTicks > initial.timeLeftTicks - 600;
  log(`replay after ${finalState.state}: state=${replay.state} score=${replay.score} flames=${replay.player.flames}`);
  await page.screenshot({ path: join(outDir, '07-replay.png') });
  if (!replayOk) {
    log('REPLAY CHECK FAILED');
    process.exitCode = 1;
  } else {
    log('replay check: new night starts clean');
  }
}

// The HUD must reflect the simulation, otherwise the game is unplayable even if
// the logic is right. Read it straight out of the DOM.
const hud = await page.evaluate(() => {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
  return {
    flames: text('.flames'),
    carry: text('.carry'),
    score: text('.score'),
    time: text('.time'),
    lit: text('.lit'),
    overlay: document.querySelector('.overlay')?.classList.contains('hidden') ?? null,
  };
});
log(`HUD: flames=${hud.flames} carry=${hud.carry} score=${hud.score} time=${hud.time} lanterns=${hud.lit}`);

const canvasBox = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  return { width: canvas.width, height: canvas.height };
});
log(`canvas ${canvasBox ? `${canvasBox.width}x${canvasBox.height}` : 'MISSING'}`);

writeFileSync(join(outDir, 'playthrough.json'), JSON.stringify({ seed, transcript, consoleLog, hud }, null, 2));
writeFileSync(join(outDir, 'console.log'), `${consoleLog.join('\n')}\n`);

await browser.close();

const errors = consoleLog.filter((line) => line.includes('[pageerror]') || line.includes('[error]'));
if (errors.length > 0) {
  process.stdout.write(`\npage errors detected:\n${errors.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('\nscreenshots and playthrough log written\n');
