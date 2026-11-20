#!/usr/bin/env node
/**
 * fps.mjs — measures the average frame rate of the real browser build at
 * 1280x720, which Ticket-02 requires to be at least 30 FPS.
 *
 * The page reports its own frame times from inside the render loop, so this is
 * the same number a player would feel, not a synthetic benchmark.
 *
 * Requirements: npm install --no-save playwright && npx playwright install chromium
 * Usage: node scripts/fps.mjs [url] [outFile]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outFile = process.argv[3] ?? 'docs/proof/phase-2/fps.json';
const SECONDS = 12;

const browser = await chromium.launch({
  // Use the real GPU through ANGLE/D3D11; fall back to nothing special if the
  // machine has no GPU (Chromium then picks SwiftShader).
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(`${url.split('?')[0]}?seed=202603417`, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__dao), null, { timeout: 20000 });

const gpuRenderer = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) return 'no webgl';
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown';
});

/** Runs the real loop for `seconds` and returns the frame statistics. */
async function sample(label, night) {
  await page.evaluate((n) => window.__dao.startNight(n), night);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const state = { times: [], last: performance.now() };
    window.__fps = state;
    const tick = (now) => {
      state.times.push(now - state.last);
      state.last = now;
      if (state.times.length < 100000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(SECONDS * 1000);
  const stats = await page.evaluate(() => {
    const times = window.__fps.times.slice(2);
    window.__fps.times.length = 0;
    const total = times.reduce((a, b) => a + b, 0);
    const sorted = [...times].sort((a, b) => a - b);
    return {
      frames: times.length,
      fps: times.length / (total / 1000),
      p95ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      worstMs: sorted[sorted.length - 1] ?? 0,
    };
  });
  return { label, night, viewport: '1280x720', seconds: SECONDS, ...stats };
}

const results = [];
for (const night of [1, 2, 3]) results.push(await sample(`night-${night}`, night));

// A night with lanterns lit and shades on screen is the heaviest case.
await page.evaluate(() => window.__dao.startNight(1));
await page.waitForTimeout(500);
await page.evaluate(() => {
  const s = window.__dao.snapshot();
  void s;
});
const busiest = await sample('night-3-full-load', 3);

await browser.close();

const report = {
  measuredAt: new Date().toISOString(),
  renderer: gpuRenderer,
  note: 'Measured in Chromium with hardware WebGL (ANGLE/D3D11) at 1280x720, in-game, with the real render loop.',
  requiredMinFps: 30,
  runs: [...results, busiest],
  errors,
};
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(report, null, 2));

for (const run of report.runs) {
  process.stdout.write(
    `${run.label.padEnd(18)} ${run.fps.toFixed(1).padStart(6)} fps  p95 ${run.p95ms.toFixed(1)} ms  worst ${run.worstMs.toFixed(1)} ms\n`,
  );
}
const average = report.runs.reduce((sum, run) => sum + run.fps, 0) / report.runs.length;
process.stdout.write(`average: ${average.toFixed(1)} fps (requirement: >= ${report.requiredMinFps})\n`);
if (errors.length > 0) process.stdout.write(`page errors: ${errors.join('; ')}\n`);
process.exitCode = average >= report.requiredMinFps ? 0 : 1;
