#!/usr/bin/env node
/**
 * bench.mjs — the contract v1.3 benchmark (bench_cmd).
 *
 *   node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
 *
 * Runs the fixed benchmark scene (see src/render/bench.ts) in Chromium at
 * 1280x720 with hardware WebGL, records the frame times the page reports, and
 * writes the numbers the ticket asks for.
 *
 * The browser cannot turn vsync off, so `vsync_off` is false; that is recorded
 * in the JSON and explained in the README.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const seed = Number.parseInt(flag('--seed', '42'), 10);
const duration = Number.parseFloat(flag('--duration', '30'));
const outPath = resolve(flag('--out', 'bench.json'));
const root = resolve('.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = join(root, 'dist', 'web', decodeURIComponent(url.pathname));
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, 'dist', 'web', 'index.html');
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer({ server, port: server.address().port }));
  });
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    process.stderr.write(
      'bench: playwright is missing. Run: npm install && npx playwright install chromium\n',
    );
    process.exit(1);
  }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    args: [
      '--use-angle=d3d11',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      // Turn the compositor's vsync off so the number measures the renderer,
      // not the display refresh rate (contract v1.3 asks for vsync off when the
      // engine allows it; a browser only allows it through these flags).
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const url = `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__bench), null, { timeout: 30000 });
  await page.waitForFunction(() => window.__bench.done === true, null, {
    timeout: (duration + 60) * 1000,
  });
  const data = await page.evaluate(() => window.__bench.data);

  await browser.close();
  await new Promise((done) => server.close(done));

  const report = {
    contract_version: '1.3',
    avg_fps: Number(data.avg_fps.toFixed(1)),
    p1_low_fps: Number(data.p1_low_fps.toFixed(1)),
    frame_ms_p95: Number(data.frame_ms_p95.toFixed(1)),
    frames: data.frames,
    load_ms: data.load_ms,
    peak_mem_mb: data.peak_mem_mb,
    vsync_off: data.vsync_off,
    renderer: data.renderer,
    os: `${process.platform} ${process.arch}`,
    notes: {
      peak_mem_mb:
        'null: a browser tab cannot read its own process RSS from JavaScript (performance.memory reports the JS heap only).',
      vsync_off: 'true: bench.mjs launches Chromium with --disable-gpu-vsync --disable-frame-rate-limit.',
      warmup_s: data.warmup_s,
      duration_s: data.duration_s,
      seed,
      page_errors: errors,
    },
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `bench: avg ${report.avg_fps} fps · p1 low ${report.p1_low_fps} fps · p95 ${report.frame_ms_p95} ms · ` +
      `${report.frames} frames · load ${report.load_ms} ms\n`,
  );
  process.stdout.write(`renderer: ${report.renderer}\n`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`bench failed: ${error.message}\n`);
  process.exit(1);
});
