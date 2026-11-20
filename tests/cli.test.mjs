/**
 * CLI contract tests: exit codes, defaults and output file shape.
 * Contract v1.0 section B: exit 0 on success, 2 for malformed scenario/inputs,
 * any other non-zero for other errors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist/headless/main.js');

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

test('a plain run exits 0 and writes a well-formed JSONL file', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--night', '1', '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readLines(out);
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.equal(lines.at(-1).type, 'end');
  assert.equal(lines.at(-1).ticks, 120);
  assert.deepEqual(
    lines.filter((l) => l.type === 'snapshot').map((l) => l.tick),
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    'snapshot-every defaults to 10',
  );
});

test('--snapshot-every is honoured', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--ticks', '30', '--out', out, '--snapshot-every', '7']);
  assert.equal(res.status, 0, res.stderr);
  const ticks = readLines(out).filter((l) => l.type === 'snapshot').map((l) => l.tick);
  assert.deepEqual(ticks, [0, 7, 14, 21, 28]);
});

test('scenario and inputs files are applied', () => {
  const dir = tmpDir();
  const scenario = writeJson(dir, 'scenario.json', {
    player: { pos: [0, 0, 0], carried: 1, flames: 2 },
    random_motes: false,
    random_shades: false,
    motes: [[0, 0, 3]],
    shades: [{ pos: [5, 0, 0] }],
    lanterns: [{ id: 'L2', pos: [0, 0, 6], deposited: 1 }],
    time_left_s: 42,
  });
  const inputs = writeJson(dir, 'inputs.json', {
    frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }],
  });
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '5', '--ticks', '60', '--out', out, '--scenario', scenario, '--inputs', inputs]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readLines(out);
  const first = lines[0];
  assert.deepEqual(first.player, { pos: [0, 0, 0], flames: 2, carried: 1 });
  assert.equal(first.time_left_s, 42);
  assert.equal(first.shades.length, 1);
  assert.equal(first.lanterns.find((l) => l.id === 'L2').deposited, 1);
  const lastSnap = lines.filter((l) => l.type === 'snapshot').at(-1);
  assert.equal(lastSnap.time_left_s, 41);
  closeTo(lastSnap.player.pos[2], 5, 1e-9);
});

test('a run may stop early when the game ends', () => {
  const dir = tmpDir();
  const scenario = writeJson(dir, 'scenario.json', {
    random_motes: false,
    random_shades: false,
    player: { flames: 0 },
  });
  const out = join(dir, 'run.jsonl');
  const res = runCli(['--seed', '1', '--ticks', '600', '--out', out, '--scenario', scenario]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readLines(out);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 1, state: 'lost', score: 0 });
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
  const res = runCli(['--seed', '1', '--ticks', '5', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
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

test('a scenario with the wrong shape exits 2', () => {
  const dir = tmpDir();
  const cases = [
    { motes: 'nope' },
    { motes: [[0, 0]] },
    { player: { carried: -1 } },
    { player: { pos: [0, 0] } },
    { lanterns: [{ pos: [0, 0, 0] }] },
    { random_shades: 'yes' },
    { time_left_s: 'soon' },
  ];
  for (const [i, scenario] of cases.entries()) {
    const path = writeJson(dir, `bad-${i}.json`, scenario);
    const res = runCli(['--seed', '1', '--ticks', '5', '--out', join(dir, 'o.jsonl'), '--scenario', path]);
    assert.equal(res.status, 2, `case ${i} should exit 2, got ${res.status}`);
  }
});

test('an inputs file with misordered frames exits 2', () => {
  const dir = tmpDir();
  const bad = writeJson(dir, 'inputs.json', {
    frames: [{ tick: 5, move: [0, 1] }, { tick: 5, move: [0, 1] }],
  });
  const res = runCli(['--seed', '1', '--ticks', '10', '--out', join(dir, 'o.jsonl'), '--inputs', bad]);
  assert.equal(res.status, 2);
});

test('an inputs file with a malformed move exits 2', () => {
  const dir = tmpDir();
  const bad = writeJson(dir, 'inputs.json', { frames: [{ tick: 0, move: [0, 1, 2] }] });
  const res = runCli(['--seed', '1', '--ticks', '10', '--out', join(dir, 'o.jsonl'), '--inputs', bad]);
  assert.equal(res.status, 2);
});

test('an inputs file with a non-boolean button exits 2', () => {
  const dir = tmpDir();
  const bad = writeJson(dir, 'inputs.json', { frames: [{ tick: 0, pulse: 'yes' }] });
  const res = runCli(['--seed', '1', '--ticks', '10', '--out', join(dir, 'o.jsonl'), '--inputs', bad]);
  assert.equal(res.status, 2);
});

test('missing required flags exit non-zero (but not 2)', () => {
  const dir = tmpDir();
  const noTicks = runCli(['--seed', '1', '--out', join(dir, 'o.jsonl')]);
  assert.equal(noTicks.status, 1);
  const noOut = runCli(['--seed', '1', '--ticks', '5']);
  assert.equal(noOut.status, 1);
});

test('an unsupported night exits non-zero', () => {
  const dir = tmpDir();
  const res = runCli(['--seed', '1', '--night', '2', '--ticks', '5', '--out', join(dir, 'o.jsonl')]);
  assert.equal(res.status, 1);
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
  const res = runCli(['--seed', '1', '--ticks', '5', '--out', join(dir, 'o.jsonl'), '--scenario', path]);
  assert.equal(res.status, 0, res.stderr);
});

test('two CLI runs with the same seed produce identical files', () => {
  const dir = tmpDir();
  const a = join(dir, 'a.jsonl');
  const b = join(dir, 'b.jsonl');
  const args = ['--seed', '77', '--night', '1', '--ticks', '900', '--snapshot-every', '30'];
  assert.equal(runCli([...args, '--out', a]).status, 0);
  assert.equal(runCli([...args, '--out', b]).status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('every line is valid JSON and the file ends with a newline', () => {
  const dir = tmpDir();
  const out = join(dir, 'run.jsonl');
  assert.equal(runCli(['--seed', '3', '--ticks', '250', '--out', out]).status, 0);
  const text = readFileSync(out, 'utf8');
  assert.ok(text.endsWith('\n'), 'output must end with a newline');
  for (const line of text.trimEnd().split('\n')) {
    assert.doesNotThrow(() => JSON.parse(line), `bad line: ${line}`);
  }
});

function closeTo(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
}
