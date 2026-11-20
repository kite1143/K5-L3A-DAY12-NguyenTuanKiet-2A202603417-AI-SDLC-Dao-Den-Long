/**
 * Headless runner for Test Contract v1.1.
 *
 *   node dist/headless/main.js --seed 1 --night 1 --ticks 600 --out out.jsonl
 *       [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
 *
 * Exit codes: 0 success, 2 malformed scenario/inputs file, 1 any other error.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ContractFormatError, parseInputs, parseScenario } from '../core/scenario';
import type { InputsInput, ScenarioInput } from '../core/scenario';
import type { NightId } from '../core/nights';
import { runSimulation } from '../core/runner';

interface RawArgs {
  seed: number;
  night: number;
  ticks: number | null;
  out: string | null;
  scenario: string | null;
  inputs: string | null;
  snapshotEvery: number;
}

interface CliArgs {
  seed: number;
  night: NightId;
  ticks: number;
  out: string;
  scenario: string | null;
  inputs: string | null;
  snapshotEvery: number;
}

class UsageError extends Error {}

function parseInteger(raw: string, flag: string): number {
  if (!/^-?\d+$/.test(raw.trim())) throw new UsageError(`${flag} expects an integer, got "${raw}"`);
  return Number.parseInt(raw, 10);
}

function parseArgs(argv: string[]): CliArgs {
  const args: RawArgs = {
    seed: 0,
    night: 1,
    ticks: null,
    out: null,
    scenario: null,
    inputs: null,
    snapshotEvery: 10,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const takeValue = (): string => {
      i += 1;
      const v = argv[i];
      if (v === undefined) throw new UsageError(`missing value for ${flag}`);
      return v;
    };
    switch (flag) {
      case '--seed':
        args.seed = parseInteger(takeValue(), '--seed');
        break;
      case '--night':
        args.night = parseInteger(takeValue(), '--night');
        break;
      case '--ticks':
        args.ticks = parseInteger(takeValue(), '--ticks');
        break;
      case '--out':
        args.out = takeValue();
        break;
      case '--scenario':
        args.scenario = takeValue();
        break;
      case '--inputs':
        args.inputs = takeValue();
        break;
      case '--snapshot-every':
        args.snapshotEvery = parseInteger(takeValue(), '--snapshot-every');
        break;
      default:
        // Unknown flags are ignored on purpose: graders may add their own.
        break;
    }
  }

  if (args.ticks === null) throw new UsageError('--ticks is required');
  if (args.out === null) throw new UsageError('--out is required');
  if (args.ticks < 0) throw new UsageError('--ticks must be >= 0');
  if (args.snapshotEvery < 1) throw new UsageError('--snapshot-every must be >= 1');
  if (args.night !== 1 && args.night !== 2 && args.night !== 3) {
    throw new UsageError(`unsupported --night ${args.night} (contract v1.1 ships nights 1, 2 and 3)`);
  }
  if (args.seed < 0) throw new UsageError('--seed must be >= 0');

  return {
    seed: args.seed,
    night: args.night as NightId,
    ticks: args.ticks,
    out: args.out,
    scenario: args.scenario,
    inputs: args.inputs,
    snapshotEvery: args.snapshotEvery,
  };
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new UsageError(`cannot read ${path}`);
  }
  // Files written by Windows editors may start with a UTF-8 BOM.
  text = text.replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch {
    throw new ContractFormatError(`${path} is not valid JSON`);
  }
}

function loadScenario(path: string | null): ScenarioInput | null {
  if (!path) return null;
  return parseScenario(readJson(resolve(path)));
}

function loadInputs(path: string | null): InputsInput | null {
  if (!path) return null;
  return parseInputs(readJson(resolve(path)));
}

function main(argv: string[]): number {
  let args: CliArgs;
  let scenario: ScenarioInput | null;
  let inputs: InputsInput | null;

  try {
    args = parseArgs(argv);
    scenario = loadScenario(args.scenario);
    inputs = loadInputs(args.inputs);
  } catch (err) {
    if (err instanceof ContractFormatError) {
      process.stderr.write(`format error: ${err.message}\n`);
      return 2;
    }
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  const result = runSimulation({
    seed: args.seed,
    night: args.night,
    ticks: args.ticks,
    snapshotEvery: args.snapshotEvery,
    scenario,
    inputsFrames: inputs?.frames ?? [],
  });

  const outPath = resolve(args.out);
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${result.lines.join('\n')}\n`, 'utf8');
  } catch (err) {
    process.stderr.write(`error: cannot write ${outPath}: ${(err as Error).message}\n`);
    return 1;
  }

  return 0;
}

process.exit(main(process.argv.slice(2)));
