import { TICKS_PER_SECOND } from './config';
import { InputTimeline } from './inputs';
import { stepWorld } from './step';
import { activeMoteCount, createWorld, timeLeftSeconds } from './world';
import type { InputFrame, ScenarioInput } from './scenario';
import type { NightId } from './nights';
import type { SimEvent, World } from './types';

export interface RunOptions {
  seed: number;
  night: NightId;
  /** Number of steps to run. */
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
  simSteps: number;
  score: number;
  world: World;
}

/** Rounded to 3 decimals; -0 is normalised to 0 so JSON stays clean. */
export function round3(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
}

export function snapshotLine(w: World, tick: number): string {
  const p = w.player;
  return JSON.stringify({
    type: 'snapshot',
    tick,
    sim_tick: w.simTick,
    state: w.paused ? 'paused' : w.state,
    night: w.night,
    wind: { active: w.wind.active, dir_deg: round3(w.wind.dirDeg) },
    time_left_s: round3(timeLeftSeconds(w)),
    score: w.score,
    player: {
      pos: [round3(p.x), round3(p.y), round3(p.z)],
      vel: [round3(p.vx), round3(p.vy), round3(p.vz)],
      flames: p.flames,
      carried: p.carried,
      grounded: p.grounded,
      invuln: p.invulnTicks,
      dash_cd_s: round3(p.dashCdTicks / TICKS_PER_SECOND),
      pulse_cd_s: round3(p.pulseCdTicks / TICKS_PER_SECOND),
      charm_s: round3(p.charmTicks / TICKS_PER_SECOND),
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id,
      pos: [round3(l.x), round3(l.y), round3(l.z)],
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: w.shades.map((s) => ({
      id: s.id,
      pos: [round3(s.x), round3(s.y), round3(s.z)],
      state: s.state,
    })),
    drifters: w.drifters.map((d) => ({
      id: d.id,
      pos: [round3(d.x), round3(d.y), round3(d.z)],
      state: d.state,
      stolen: d.stolen,
    })),
    charms: w.charms.map((c) => ({
      id: c.id,
      pos: [round3(c.x), round3(c.y), round3(c.z)],
      available: c.available,
      respawn_s: round3(c.respawnTicks / TICKS_PER_SECOND),
    })),
    motes: w.motes
      .filter((m) => m.active)
      .map((m) => ({
        id: m.id,
        pos: [round3(m.x), round3(m.y), round3(m.z)],
        kind: m.kind,
        ttl_s: m.ttlTicks > 0 ? round3(m.ttlTicks / TICKS_PER_SECOND) : null,
      })),
    motes_active: activeMoteCount(w),
  });
}

/**
 * Runs a whole headless session and returns the JSONL lines in output order:
 * snapshot(tick 0), then events/snapshots interleaved, then the mandatory end
 * line. Stops early as soon as the night is won or lost.
 */
export function runSimulation(opts: RunOptions): RunResult {
  const w = createWorld(opts.seed, opts.night, opts.scenario ?? null);
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
  return {
    lines,
    finalState: w.state,
    steps,
    simSteps: w.simTick,
    score: w.score,
    world: w,
  };
}
