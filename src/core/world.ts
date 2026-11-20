import { DT, DEFAULT_MOTES, ISLAND_RADIUS, LANTERN_LAYOUT, SHADE_FIRST_SPAWN_TICKS, SHADE_Y, TUNING } from './config';
import { makeRng, randRange } from './rng';
import type { Lantern, Mote, Shade, World } from './types';
import type { ScenarioInput } from './scenario';

/** Scatter motes on the island disc, deterministically from the seed. */
function scatterMotes(w: World, count: number, startSeq: number): Mote[] {
  const motes: Mote[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = randRange(w.rng, 0, Math.PI * 2);
    const radius = Math.sqrt(randRange(w.rng, 16, (ISLAND_RADIUS - 3) * (ISLAND_RADIUS - 3)));
    motes.push({
      id: `M${startSeq + i}`,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      active: true,
    });
  }
  return motes;
}

/** Highest `S<n>` suffix in a list of ids, so auto ids never collide. */
function nextShadeSeq(ids: string[]): number {
  let max = 0;
  for (const id of ids) {
    const m = /^S(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/**
 * Build the Night 1 world. A scenario only overrides what it declares: absent
 * fields keep the game defaults, and building a scenario never emits events or
 * awards score (contract section D).
 */
export function createWorld(seed: number, scenario: ScenarioInput | null = null): World {
  const w: World = {
    seed,
    night: 1,
    rng: makeRng(seed),
    tick: 0,
    state: 'playing',
    score: 0,
    timeLeftTicks: Math.round(TUNING.night1_duration_s * 60),
    initTimeTicks: Math.round(TUNING.night1_duration_s * 60),
    player: {
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      onGround: true,
      carried: 0,
      flames: TUNING.flames,
      invulnTicks: 0,
      pulseCooldownTicks: 0,
    },
    lanterns: LANTERN_LAYOUT.map((l) => ({
      id: l.id,
      x: l.x,
      z: l.z,
      cost: TUNING.lantern_cost,
      deposited: 0,
      lit: false,
    })),
    motes: [],
    shades: [],
    randomMotes: scenario?.random_motes !== false,
    randomShades: scenario?.random_shades !== false,
    moteSeq: 1,
    shadeSeq: 1,
    spawnTimerTicks: SHADE_FIRST_SPAWN_TICKS,
  };

  if (scenario) {
    if (scenario.time_left_s !== undefined) {
      w.initTimeTicks = Math.round(scenario.time_left_s * 60);
      w.timeLeftTicks = w.initTimeTicks;
    }

    if (scenario.player) {
      const p = scenario.player;
      if (p.pos) {
        w.player.x = p.pos[0];
        w.player.y = p.pos[1];
        w.player.z = p.pos[2];
      }
      if (p.carried !== undefined) w.player.carried = p.carried;
      if (p.flames !== undefined) w.player.flames = p.flames;
    }

    if (scenario.lanterns) {
      for (const upd of scenario.lanterns) {
        const target = w.lanterns.find((l) => l.id === upd.id);
        if (!target) continue;
        if (upd.pos) {
          target.x = upd.pos[0];
          target.z = upd.pos[2];
        }
        if (upd.deposited !== undefined) target.deposited = upd.deposited;
        if (upd.lit !== undefined) target.lit = upd.lit;
      }
    }

    if (scenario.motes) {
      w.motes = scenario.motes.map((m, i) => ({ id: `M${i + 1}`, x: m[0], z: m[2], active: true }));
      w.moteSeq = w.motes.length + 1;
    } else if (w.randomMotes) {
      w.motes = scatterMotes(w, DEFAULT_MOTES, w.moteSeq);
      w.moteSeq += w.motes.length;
    }

    if (scenario.shades) {
      w.shades = scenario.shades.map((s, i) => ({
        id: s.id ?? `S${i + 1}`,
        x: s.pos[0],
        y: SHADE_Y,
        z: s.pos[2],
        state: 'chase' as const,
        stunTicks: 0,
      }));
      w.shadeSeq = nextShadeSeq(w.shades.map((s) => s.id));
    }
  } else if (w.randomMotes) {
    w.motes = scatterMotes(w, DEFAULT_MOTES, w.moteSeq);
    w.moteSeq += w.motes.length;
  }

  return w;
}

/** Horizontal distance (XZ only, as the contract requires). */
export function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

/** Current night time in seconds (exact: computed from integer ticks). */
export function timeLeftSeconds(w: World): number {
  return w.timeLeftTicks / 60;
}

/** Physics step in seconds, exported for readability in tests. */
export const STEP_SECONDS = DT;

export function lanternById(w: World, id: string): Lantern | undefined {
  return w.lanterns.find((l) => l.id === id);
}

export function activeMoteCount(w: World): number {
  let n = 0;
  for (const m of w.motes) if (m.active) n += 1;
  return n;
}

export function activeShades(w: World): Shade[] {
  return w.shades;
}
