import { InputTimeline } from './inputs';
import { stepWorld } from './step';
import { activeMoteCount, createWorld, timeLeftSeconds } from './world';
import type { InputFrame, ScenarioInput } from './scenario';
import type { SimEvent, World } from './types';

export interface RunOptions {
  seed: number;
  night: number;
  /** Number of steps to simulate. */
  ticks: number;
  /** Emit a snapshot every N ticks, starting at tick 0. */
  snapshotEvery: number;
  scenario?: ScenarioInput | null;
  inputsFrames?: InputFrame[];
}

export interface RunResult {
  lines: string[];
  finalState: 'playing' | 'won' | 'lost';
  steps: number;
  score: number;
  world: World;
}

/** Rounded to 3 decimals; -0 is normalised to 0 so JSON stays clean. */
export function round3(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
}

export function snapshotLine(w: World, tick: number): string {
  return JSON.stringify({
    type: 'snapshot',
    tick,
    sim_tick: tick,
    state: w.state,
    time_left_s: round3(timeLeftSeconds(w)),
    score: w.score,
    player: {
      pos: [round3(w.player.x), round3(w.player.y), round3(w.player.z)],
      flames: w.player.flames,
      carried: w.player.carried,
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id,
      pos: [round3(l.x), 0, round3(l.z)],
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: w.shades.map((s) => ({
      id: s.id,
      pos: [round3(s.x), round3(s.y), round3(s.z)],
      state: s.state,
    })),
    motes_active: activeMoteCount(w),
    motes: w.motes.filter((m) => m.active).map((m) => ({ id: m.id, pos: [round3(m.x), 0, round3(m.z)] })),
  });
}

/**
 * Runs the whole headless session and returns the JSONL lines in output order:
 * snapshot(tick 0), then events/snapshots interleaved, then the mandatory end
 * line. Stops early as soon as the game is won or lost.
 */
export function runSimulation(opts: RunOptions): RunResult {
  const w = createWorld(opts.seed, opts.scenario ?? null);
  const timeline = new InputTimeline(opts.inputsFrames ?? []);
  const lines: string[] = [];
  const events: SimEvent[] = [];
  let steps = 0;

  lines.push(snapshotLine(w, 0));

  for (let k = 0; k < opts.ticks; k += 1) {
    if (w.state !== 'playing') break;
    events.length = 0;
    stepWorld(w, timeline.at(k), events);
    steps = k + 1;
    for (const ev of events) {
      lines.push(JSON.stringify({ type: 'event', tick: ev.tick, name: ev.name, data: ev.data }));
    }
    if (steps % opts.snapshotEvery === 0) lines.push(snapshotLine(w, steps));
  }

  lines.push(JSON.stringify({ type: 'end', ticks: steps, state: w.state, score: w.score }));
  return { lines, finalState: w.state, steps, score: w.score, world: w };
}
