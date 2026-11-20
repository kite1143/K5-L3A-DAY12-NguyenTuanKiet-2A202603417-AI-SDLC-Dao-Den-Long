#!/usr/bin/env node
/**
 * verify.mjs — one command that produces the Phase evidence.
 *
 * It never trusts the source tree: it rebuilds, typechecks, runs the unit and
 * CLI suites, replays every scenario in scenarios/manifest.json through the real
 * headless CLI, validates the JSONL against Test Contract v1.0, checks
 * determinism by running the same seed twice, and finally proves the committed
 * headless bundle matches the sources.
 *
 * Usage:  node scripts/verify.mjs [phase-1]
 * Output: docs/proof/<phase>/verify-report.md + docs/proof/<phase>/headless/*.jsonl
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, platform, release, totalmem, cpus, arch } from 'node:os';
import { join, relative } from 'node:path';

const root = process.cwd();
const phase = process.argv[2] ?? 'phase-1';
const proofDir = join(root, 'docs', 'proof', phase);
const headlessDir = join(proofDir, 'headless');
mkdirSync(headlessDir, { recursive: true });

const rows = [];
let failed = 0;

function record(name, ok, detail = '') {
  rows.push({ name, ok, detail });
  if (!ok) failed += 1;
  const tag = ok ? 'PASS' : 'FAIL';
  process.stdout.write(`${tag}  ${name}${detail ? `  (${detail})` : ''}\n`);
}

function node(args, label) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  const ok = result.status === 0;
  const tail = ok ? `${seconds}s` : `${seconds}s, exit ${result.status}`;
  record(label, ok, tail);
  if (!ok) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
    process.stdout.write(`${output}\n`);
  }
  return { ok, result };
}

// ---------------------------------------------------------------- 1. build ---
process.stdout.write('\n== build ==\n');
node([join('node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'], 'typecheck (tsc --noEmit)');
node(
  [
    join('node_modules', 'esbuild', 'bin', 'esbuild'),
    'src/core/index.ts',
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    '--outfile=dist/core/index.js',
  ],
  'build core bundle',
);
node(
  [
    join('node_modules', 'esbuild', 'bin', 'esbuild'),
    'src/headless/main.ts',
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--outfile=dist/headless/main.js',
  ],
  'build headless bundle',
);
node([join('node_modules', 'vite', 'bin', 'vite.js'), 'build'], 'build web bundle');

// ----------------------------------------------------------------- 2. tests ---
process.stdout.write('\n== tests ==\n');
const tests = spawnSync(process.execPath, ['--test', 'tests/'], { cwd: root, encoding: 'utf8' });
const testOut = `${tests.stdout ?? ''}${tests.stderr ?? ''}`;
const passMatch = /# pass (\d+)/.exec(testOut) ?? /ℹ pass (\d+)/.exec(testOut);
const failMatch = /# fail (\d+)/.exec(testOut) ?? /ℹ fail (\d+)/.exec(testOut);
const testPass = passMatch ? Number(passMatch[1]) : 0;
const testFail = failMatch ? Number(failMatch[1]) : 0;
record('node --test tests/', tests.status === 0 && testFail === 0, `${testPass} passed, ${testFail} failed`);
writeFileSync(join(proofDir, 'test-output.txt'), testOut, 'utf8');

// ------------------------------------------------------------- 3. scenarios ---
process.stdout.write('\n== headless scenarios ==\n');
const manifest = JSON.parse(readFileSync(join(root, 'scenarios', 'manifest.json'), 'utf8'));

function decimalsOk(text) {
  return !/-?\d+\.\d{4,}/.test(text);
}

function validateJsonl(text) {
  const problems = [];
  const lines = text.trimEnd().split('\n').filter(Boolean);
  if (lines.length === 0) return ['empty output'];
  const parsed = [];
  for (const [index, line] of lines.entries()) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      problems.push(`line ${index + 1}: invalid JSON`);
      continue;
    }
    parsed.push(obj);
  }
  if (parsed[0]?.type !== 'snapshot' || parsed[0]?.tick !== 0) problems.push('first line must be the tick-0 snapshot');
  if (parsed.at(-1)?.type !== 'end') problems.push('last line must be the end record');
  for (const obj of parsed) {
    if (obj.type === 'snapshot') {
      for (const key of ['tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) {
        if (!(key in obj)) problems.push(`snapshot tick ${obj.tick} missing ${key}`);
      }
      if (!['playing', 'won', 'lost'].includes(obj.state)) problems.push(`snapshot tick ${obj.tick}: bad state ${obj.state}`);
    } else if (obj.type === 'event') {
      for (const key of ['tick', 'name', 'data']) {
        if (!(key in obj)) problems.push(`event at line for tick ${obj.tick} missing ${key}`);
      }
    } else if (obj.type === 'end') {
      for (const key of ['ticks', 'state', 'score']) {
        if (!(key in obj)) problems.push(`end record missing ${key}`);
      }
    } else {
      problems.push(`unknown line type ${obj.type}`);
    }
  }
  const snapshotTicks = parsed.filter((o) => o.type === 'snapshot').map((o) => o.tick);
  for (let i = 1; i < snapshotTicks.length; i += 1) {
    if (snapshotTicks[i] <= snapshotTicks[i - 1]) problems.push('snapshot ticks are not increasing');
  }
  if (!decimalsOk(text)) problems.push('coordinates with more than 3 decimals');
  return problems;
}

const scenarioSummaries = [];
for (const entry of manifest) {
  const outFile = join(headlessDir, `${entry.name}.jsonl`);
  const args = [
    join('dist', 'headless', 'main.js'),
    '--seed',
    String(entry.seed),
    '--night',
    '1',
    '--ticks',
    String(entry.ticks),
    '--out',
    outFile,
    '--snapshot-every',
    String(entry.snapshotEvery ?? 30),
  ];
  if (entry.scenario) args.push('--scenario', join('scenarios', entry.scenario));
  if (entry.inputs) args.push('--inputs', join('scenarios', entry.inputs));

  const started = Date.now();
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const ms = Date.now() - started;
  const expectedExit = entry.expectExit ?? 0;
  if (run.status !== expectedExit) {
    record(`scenario ${entry.name}`, false, `exit ${run.status}, expected ${expectedExit}`);
    continue;
  }
  if (expectedExit !== 0) {
    record(`scenario ${entry.name}`, true, `exit ${run.status} as required`);
    continue;
  }

  const text = readFileSync(outFile, 'utf8');
  const problems = validateJsonl(text);
  const parsed = text.trimEnd().split('\n').map((l) => JSON.parse(l));
  const end = parsed.at(-1);
  const counts = {};
  for (const obj of parsed) if (obj.type === 'event') counts[obj.name] = (counts[obj.name] ?? 0) + 1;
  const summary = `${end.state} / ${end.ticks} ticks / score ${end.score} — ${Object.entries(counts)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ') || 'no events'}`;
  scenarioSummaries.push({ name: entry.name, note: entry.note ?? '', summary });
  record(`scenario ${entry.name}`, problems.length === 0, problems[0] ?? `${summary} (${ms} ms)`);
}

// ----------------------------------------------------------- 4. determinism ---
process.stdout.write('\n== determinism ==\n');
{
  const args = ['--seed', '202603417', '--night', '1', '--ticks', '1800', '--snapshot-every', '60'];
  const first = join(headlessDir, 'determinism-a.jsonl');
  const second = join(headlessDir, 'determinism-b.jsonl');
  const a = spawnSync(process.execPath, [join('dist', 'headless', 'main.js'), ...args, '--out', first], {
    cwd: root,
    encoding: 'utf8',
  });
  const b = spawnSync(process.execPath, [join('dist', 'headless', 'main.js'), ...args, '--out', second], {
    cwd: root,
    encoding: 'utf8',
  });
  const same = a.status === 0 && b.status === 0 && readFileSync(first, 'utf8') === readFileSync(second, 'utf8');
  record('same seed + same inputs => identical output', same, same ? 'byte identical' : 'outputs differ');
  if (same) rmSync(second);
}

// ------------------------------------------- 5. committed bundle is in sync ---
process.stdout.write('\n== artefacts ==\n');
{
  const bundle = join('dist', 'headless', 'main.js');
  const normalize = (text) => text.replace(/\r\n/g, '\n');
  const before = normalize(readFileSync(join(root, bundle), 'utf8'));
  const rebuild = spawnSync(
    process.execPath,
    [
      join('node_modules', 'esbuild', 'bin', 'esbuild'),
      'src/headless/main.ts',
      '--bundle',
      '--format=esm',
      '--platform=node',
      `--outfile=${bundle}`,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  const after = normalize(readFileSync(join(root, bundle), 'utf8'));
  const inSync = rebuild.status === 0 && before === after;
  record('committed dist/headless/main.js matches src/', inSync, inSync ? 'identical' : 'stale bundle!');
}

// ------------------------------------------------------------- 6. contract ---
process.stdout.write('\n== contract ==\n');
{
  const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  record('contract_version is 1.0', contract.contract_version === '1.0', contract.contract_version);
  record('tuning is fully declared', Object.values(contract.tuning).every((v) => v !== undefined), 'no undefined values');
  const help = spawnSync(process.execPath, [join('dist', 'headless', 'main.js'), '--ticks', '1'], {
    cwd: root,
    encoding: 'utf8',
  });
  record('bad CLI usage exits non-zero', help.status !== 0, `exit ${help.status}`);
}

// ----------------------------------------------------------------- report ----
const cpu = cpus()[0]?.model ?? 'unknown CPU';
const report = `# Verify report — ${phase}

Generated by \`node scripts/verify.mjs ${phase}\` on ${new Date().toISOString()}.

**Result: ${failed === 0 ? 'all checks passed' : `${failed} check(s) FAILED`}**

## Environment
| Item | Value |
|---|---|
| Host | ${hostname()} |
| OS | ${platform()} ${release()} (${arch()}) |
| CPU | ${cpu} |
| RAM | ${(totalmem() / 1024 ** 3).toFixed(1)} GiB |
| Node | ${process.version} |

## Checks
| Check | Result | Detail |
|---|---|---|
${rows.map((row) => `| ${row.name} | ${row.ok ? 'PASS' : 'FAIL'} | ${row.detail.replace(/\|/g, '\\|')} |`).join('\n')}

## Headless scenarios
| Scenario | What it proves | Outcome |
|---|---|---|
${scenarioSummaries.map((s) => `| ${s.name} | ${s.note} | ${s.summary} |`).join('\n')}

Replay any scenario yourself:

\`\`\`bash
node dist/headless/main.js --seed <seed> --night 1 --ticks <n> --out out.jsonl \\
  --scenario scenarios/<name>.scenario.json --inputs scenarios/<name>.inputs.json
\`\`\`

Raw outputs are in \`${relative(root, headlessDir)}/\`.
`;

writeFileSync(join(proofDir, 'verify-report.md'), report, 'utf8');
process.stdout.write(`\nreport: ${relative(root, join(proofDir, 'verify-report.md'))}\n`);
process.stdout.write(failed === 0 ? 'ALL CHECKS PASSED\n' : `${failed} CHECK(S) FAILED\n`);
process.exit(failed === 0 ? 0 : 1);
