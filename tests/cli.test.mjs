/**
 * CLI contract tests (v1.1): exit codes, defaults and output file shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'headless', 'main.js');

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'ddl-'));
}

function writeJson(dir, name, value) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value), 'utf8');
  return path;
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

function readLines(path) {
  return readFileSync(path, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
}

test('a plain run exits 0 and writes a well-formed v1.1 JSONL file', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--night', '1', '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readLines(out);
  const first = lines[0];
  assert.equal(first.type, 'snapshot');
  assert.equal(first.tick, 0);
  assert.equal(first.night, 1);
  assert.ok('wind' in first && 'active' in first.wind && 'dir_deg' in first.wind);
  for (const key of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) {
    assert.ok(key in first.player, `player.${key} missing`);
  }
  assert.ok(Array.isArray(first.motes) && first.motes.length === 20);
  assert.ok(first.motes.every((m) => 'kind' in m && 'ttl_s' in m));
  assert.ok(Array.isArray(first.drifters));
  assert.ok(Array.isArray(first.charms));
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 120, state: 'playing', score: 0 });
  assert.deepEqual(
    lines.filter((l) => l.type === 'snapshot').map((l) => l.tick),
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    'snapshot-every defaults to 10',
  );
});

test('all three nights run and report their duration', () => {
  const dir = tmpDir();
  for (const [night, seconds] of [
    [1, 240],
    [2, 270],
    [3, 300],
  ]) {
    const out = join(dir, `night-${night}.jsonl`);
    const res = runCli(['--seed', '7', '--night', String(night), '--ticks', '5', '--out', out]);
    assert.equal(res.status, 0, res.stderr);
    const first = readLines(out)[0];
    assert.equal(first.night, night);
    assert.equal(first.time_left_s, seconds);
  }
});

test('--snapshot-every is honoured', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--night', '1', '--ticks', '30', '--out', out, '--snapshot-every', '7']);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(readLines(out).filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 7, 14, 21, 28]);
});

test('scenario and inputs files are applied', () => {
  const dir = tmpDir();
  const scenario = writeJson(dir, 'scenario.json', {
    player: { pos: [0, 0, 0], carried: 4, flames: 2, invuln_ticks: 30, dash_cd_ticks: 10, pulse_cd_ticks: 20, charm_ticks: 0 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    motes: [[0, 0, 3]],
    shades: [{ id: 'S1', pos: [8, 0, 0], state: 'wander', state_ticks_left: 5 }],
    drifters: [{ id: 'D1', pos: [12, 0, 0], state: 'idle' }],
    charms: [{ id: 'C9', pos: [9, 0, 0] }],
    lanterns: [{ id: 'L2', deposited: 4 }],
    time_left_s: 42,
  });
  const inputs = writeJson(dir, 'inputs.json', { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }] });
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '5', '--night', '1', '--ticks', '60', '--out', out, '--scenario', scenario, '--inputs', inputs]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readLines(out);
  const first = lines[0];
  assert.deepEqual(first.player.pos, [0, 0, 0]);
  assert.equal(first.player.flames, 2);
  assert.equal(first.player.carried, 4);
  assert.equal(first.player.invuln, 30);
  assert.equal(first.player.dash_cd_s, 0.167);
  assert.equal(first.time_left_s, 42);
  assert.equal(first.shades[0].id, 'S1');
  assert.equal(first.drifters[0].id, 'D1');
  assert.equal(first.charms[0].id, 'C9');
  assert.equal(first.lanterns.find((l) => l.id === 'L2').deposited, 4);
  const lastSnap = lines.filter((l) => l.type === 'snapshot').at(-1);
  closeTo(lastSnap.player.pos[2], 6, 1e-9);
});

test('dash and pause work through the inputs file', () => {
  const dir = tmpDir();
  const inputs = writeJson(dir, 'inputs.json', {
    frames: [
      { tick: 0, dash: true },
      { tick: 1, dash: false },
      { tick: 20, pause: true },
      { tick: 21, pause: false },
    ],
  });
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--night', '1', '--ticks', '60', '--out', out, '--inputs', inputs, '--snapshot-every', '1']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readLines(out);
  assert.ok(lines.some((l) => l.type === 'event' && l.name === 'dash'));
  assert.ok(lines.some((l) => l.type === 'event' && l.name === 'paused'));
  const paused = lines.filter((l) => l.type === 'snapshot').find((s) => s.tick === 21);
  assert.equal(paused.state, 'paused');
  assert.equal(paused.sim_tick, 20, 'simulation frozen while paused');
});

test('a run may stop early when the night ends', () => {
  const dir = tmpDir();
  const scenario = writeJson(dir, 'scenario.json', { random_motes: false, random_shades: false, player: { flames: 0 } });
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--night', '1', '--ticks', '600', '--out', out, '--scenario', scenario]);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(readLines(out).at(-1), { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('--ticks 0 writes a snapshot and an end line', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--night', '1', '--ticks', '0', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(readLines(out).map((l) => l.type), ['snapshot', 'end']);
});

test('a missing output directory is created', () => {
  const dir = tmpDir();
  const out = join(dir, 'deep', 'nested', 'run.jsonl');
  assert.equal(runCli(['--seed', '1', '--ticks', '5', '--out', out]).status, 0);
  assert.equal(readLines(out).at(-1).type, 'end');
});

test('invalid JSON in a scenario file exits 2', () => {
  const dir = tmpDir();
  const bad = join(dir, 'scenario.json');
  writeFileSync(bad, '{ this is not json', 'utf8');
  const res = runCli(['--seed', '1', '--ticks', '5', '--out', join(dir, 'o.jsonl'), '--scenario', bad]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /not valid JSON/);
});

test('malformed scenario shapes exit 2', () => {
  const dir = tmpDir();
  const cases = [
    { motes: 'nope' },
    { motes: [[0, 0]] },
    { player: { carried: -1 } },
    { player: { pos: [0, 0] } },
    { player: { dash_cd_ticks: -5 } },
    { lanterns: [{ pos: [0, 0, 0] }] },
    { random_shades: 'yes' },
    { random_drifters: 1 },
    { wind_enabled: 'off' },
    { time_left_s: 'soon' },
    { shades: [{ pos: [0, 0, 0], state: 'sleeping' }] },
    { drifters: [{ pos: [0, 0, 0], state: 'napping' }] },
    { charms: [{ pos: [0, 0, 0] }] },
    { drifters: [{ pos: [0, 0] }] },
  ];
  for (const [i, scenario] of cases.entries()) {
    const path = writeJson(dir, `bad-${i}.json`, scenario);
    const res = runCli(['--seed', '1', '--ticks', '5', '--out', join(dir, 'o.jsonl'), '--scenario', path]);
    assert.equal(res.status, 2, `case ${i} should exit 2, got ${res.status}`);
  }
});

test('malformed inputs exit 2', () => {
  const dir = tmpDir();
  const cases = [
    { frames: [{ tick: 5 }, { tick: 5 }] },
    { frames: [{ tick: 0, move: [0, 1, 2] }] },
    { frames: [{ tick: 0, pulse: 'yes' }] },
    { frames: [{ tick: 0, dash: 1 }] },
    { frames: [{ tick: 0, pause: 'no' }] },
    { frames: [{ tick: 0, move: ['a', 1] }] },
  ];
  for (const [i, inputs] of cases.entries()) {
    const path = writeJson(dir, `bad-inputs-${i}.json`, inputs);
    const res = runCli(['--seed', '1', '--ticks', '10', '--out', join(dir, 'o.jsonl'), '--inputs', path]);
    assert.equal(res.status, 2, `inputs case ${i} should exit 2, got ${res.status}`);
  }
});

test('missing required flags exit non-zero (but not 2)', () => {
  const dir = tmpDir();
  assert.equal(runCli(['--seed', '1', '--out', join(dir, 'o.jsonl')]).status, 1);
  assert.equal(runCli(['--seed', '1', '--ticks', '5']).status, 1);
});

test('an unsupported night exits non-zero', () => {
  const dir = tmpDir();
  assert.equal(runCli(['--seed', '1', '--night', '4', '--ticks', '5', '--out', join(dir, 'o.jsonl')]).status, 1);
});

test('unknown flags are ignored so graders can add their own', () => {
  const dir = tmpDir();
  const res = runCli(['--seed', '1', '--ticks', '5', '--out', join(dir, 'o.jsonl'), '--verbose', '--foo', 'bar']);
  assert.equal(res.status, 0, res.stderr);
});

test('a UTF-8 BOM in a scenario file is tolerated', () => {
  const dir = tmpDir();
  const path = join(dir, 'scenario.json');
  writeFileSync(path, `\uFEFF${JSON.stringify({ random_motes: false, random_shades: false })}`, 'utf8');
  assert.equal(runCli(['--seed', '1', '--ticks', '5', '--out', join(dir, 'o.jsonl'), '--scenario', path]).status, 0);
});

test('two CLI runs with the same seed produce identical files', () => {
  const dir = tmpDir();
  const a = join(dir, 'a.jsonl');
  const b = join(dir, 'b.jsonl');
  const args = ['--seed', '77', '--night', '2', '--ticks', '900', '--snapshot-every', '30'];
  assert.equal(runCli([...args, '--out', a]).status, 0);
  assert.equal(runCli([...args, '--out', b]).status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('every line is valid JSON and the file ends with a newline', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  assert.equal(runCli(['--seed', '3', '--night', '3', '--ticks', '250', '--out', out]).status, 0);
  const text = readFileSync(out, 'utf8');
  assert.ok(text.endsWith('\n'));
  for (const line of text.trimEnd().split('\n')) assert.doesNotThrow(() => JSON.parse(line));
});

test('a full 18000-tick night through the CLI finishes well under 30 s', () => {
  const dir = tmpDir();
  const out = join(dir, 'full.jsonl');
  const scenario = writeJson(dir, 'quiet.json', {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    motes: [],
    shades: [],
    drifters: [],
    charms: [],
  });
  const started = Date.now();
  const res = runCli([
    '--seed', '3',
    '--night', '3',
    '--ticks', '18000',
    '--out', out,
    '--snapshot-every', '600',
    '--scenario', scenario,
  ]);
  const seconds = (Date.now() - started) / 1000;
  assert.equal(res.status, 0, res.stderr);
  assert.ok(seconds < 30, `took ${seconds.toFixed(2)} s`);
  assert.equal(readLines(out).at(-1).ticks, 18000);
});

function closeTo(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} +/- ${tolerance}, got ${actual}`);
}
