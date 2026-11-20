#!/usr/bin/env node
/**
 * soak.mjs — the contract v1.3 soak test (soak_cmd).
 *
 *   node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
 *
 * Runs `nights` nights in one process (night 1 → 2 → 3 → 1 …), night i uses seed
 * `seed + i`, each night runs to its end or its standard duration, with seeded
 * pseudo-random input (new direction every 30 ticks; 5% jump, 3% dash,
 * 2% pulse, 10% interact per tick).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runSimulation, TICKS_PER_SECOND } from '../dist/core/index.js';
import { makeRng } from '../dist/core/index.js';

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const baseSeed = Number.parseInt(flag('--seed', '7'), 10);
const nights = Number.parseInt(flag('--nights', '10'), 10);
const outPath = resolve(flag('--out', 'soak.json'));

const NIGHT_TICKS = { 1: 240 * TICKS_PER_SECOND, 2: 270 * TICKS_PER_SECOND, 3: 300 * TICKS_PER_SECOND };

let crashes = 0;
const results = [];
const started = Date.now();
let memStart = 0;
let memEnd = 0;

/** RSS after letting V8 collect the previous night's garbage. */
function measureMem() {
  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
  return Math.round(process.memoryUsage().rss / 1048576);
}

for (let i = 1; i <= nights; i += 1) {
  const night = ((i - 1) % 3) + 1;
  const seed = baseSeed + i;
  const rng = makeRng(seed);
  const frames = [];
  let dirX = 0;
  let dirZ = 1;
  for (let tick = 0; tick < NIGHT_TICKS[night] + 600; tick += 1) {
    if (tick % 30 === 0) {
      const angle = rng.next() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirZ = Math.sin(angle);
    }
    frames.push({
      tick,
      moveX: dirX,
      moveZ: dirZ,
      jump: rng.next() < 0.05,
      dash: rng.next() < 0.03,
      pulse: rng.next() < 0.02,
      interact: rng.next() < 0.1,
    });
  }

  try {
    const result = runSimulation({
      seed,
      night,
      ticks: NIGHT_TICKS[night] + 600,
      snapshotEvery: NIGHT_TICKS[night],
      scenario: null,
      inputsFrames: frames,
    });
    results.push(result.finalState === 'won' ? 'won' : 'lost');
    if (i === 1) memStart = measureMem();
    if (i === nights) memEnd = measureMem();
  } catch (error) {
    crashes += 1;
    results.push('crash');
    process.stderr.write(`night ${i} crashed: ${error.message}\n`);
  }
}

const report = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Number(((Date.now() - started) / 1000).toFixed(1)),
  contract_version: '1.3',
  seed: baseSeed,
  night_ticks: NIGHT_TICKS,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `soak: ${nights} nights, ${crashes} crashes, mem ${memStart} → ${memEnd} MB, ` +
    `${report.duration_s}s, results ${results.join(',')}\n`,
);
const memOk = memStart === 0 || memEnd <= 1.2 * memStart;
process.exit(crashes === 0 && memOk ? 0 : 1);
