/**
 * Shared helpers for the test suite. Files starting with "_" are not picked up
 * by `node --test`, so this module is only ever imported.
 */
import { runSimulation } from '../dist/core/index.js';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * Run the simulation in-process and return the parsed JSONL plus convenience
 * views. `frames` uses the internal InputFrame shape ({tick, moveX, moveZ, ...});
 * `scenario` uses the contract JSON shape.
 */
export function run(opts = {}) {
  const result = runSimulation({
    seed: opts.seed ?? 1,
    night: 1,
    ticks: opts.ticks ?? 60,
    snapshotEvery: opts.snapshotEvery ?? 10,
    scenario: opts.scenario ?? null,
    inputsFrames: opts.frames ?? [],
  });
  const parsed = result.lines.map((line) => JSON.parse(line));
  return {
    ...result,
    parsed,
    snapshots: parsed.filter((l) => l.type === 'snapshot'),
    events: parsed.filter((l) => l.type === 'event'),
    end: parsed[parsed.length - 1],
  };
}

export function named(r, name) {
  return r.events.filter((e) => e.name === name);
}

export function firstEvent(r, name) {
  return r.events.find((e) => e.name === name);
}

/** A quiet scenario: no random spawning, empty island. */
export function emptyScenario(extra = {}) {
  return { random_motes: false, random_shades: false, motes: [], shades: [], ...extra };
}

export function closeTo(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message ?? 'value'}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
}
