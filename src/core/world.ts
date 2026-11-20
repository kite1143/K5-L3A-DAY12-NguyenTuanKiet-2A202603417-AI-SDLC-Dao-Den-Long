import {
  DRIFTER_HEIGHT,
  MOTE_CAP,
  MOTE_START,
  SHADE_HEIGHT,
  SHADE_SPAWNING_TICKS,
  TICKS_PER_SECOND,
  TUNING,
} from './config';
import { makeRng } from './rng';
import type { Rng } from './rng';
import { nightMap, VOID } from './nights';
import type { NightId, NightMap } from './nights';
import type { Charm, Drifter, Lantern, Mote, Player, Shade, World } from './types';
import type { ScenarioInput } from './scenario';

/** Ground height at (x, z) for a world; the map decides what is void. */
export function groundAt(w: World, x: number, z: number): number {
  return w.map.height(x, z);
}

export function isVoid(w: World, x: number, z: number): boolean {
  return !Number.isFinite(groundAt(w, x, z));
}

export function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function distance3D(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makePlayer(map: NightMap): Player {
  return {
    x: map.spawn.x,
    y: map.spawn.y,
    z: map.spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    facingX: 0,
    facingZ: 1,
    grounded: true,
    carried: 0,
    flames: TUNING.flames,
    invulnTicks: 0,
    dashTicks: 0,
    dashX: 0,
    dashZ: 0,
    dashCdTicks: 0,
    pulseCdTicks: 0,
    charmTicks: 0,
    launching: false,
    launchVX: 0,
    launchVZ: 0,
    fallenTicks: 0,
  };
}

function seedMotes(w: World, count: number): void {
  const spots = w.map.moteSpots;
  const order = shuffle(w.rng, spots.map((_, i) => i)).slice(0, Math.min(count, spots.length));
  for (const spotIndex of order) {
    const p = spots[spotIndex];
    w.motes.push({
      id: `M${w.moteSeq}`,
      x: p.x,
      y: p.y,
      z: p.z,
      kind: 'random',
      active: true,
      ttlTicks: 0,
      pickableFromTick: 0,
      spotIndex,
    });
    w.moteSeq += 1;
  }
}

function buildLanterns(w: World, scenario: ScenarioInput | null): void {
  w.lanterns = w.map.lanterns.map((spec) => ({
    id: spec.id,
    x: spec.x,
    y: spec.y,
    z: spec.z,
    cost: TUNING.lantern_cost,
    deposited: 0,
    lit: false,
  }));

  for (const update of scenario?.lanterns ?? []) {
    const target = w.lanterns.find((l) => l.id === update.id);
    if (!target) continue;
    if (update.pos) {
      target.x = update.pos[0];
      target.y = update.pos[1];
      target.z = update.pos[2];
    }
    if (update.deposited !== undefined) target.deposited = update.deposited;
    if (update.lit !== undefined) target.lit = update.lit;
  }
}

function buildCharms(w: World, scenario: ScenarioInput | null): void {
  if (scenario?.charms) {
    w.charms = scenario.charms.map((c) => ({
      id: c.id,
      x: c.pos[0],
      y: c.pos[1],
      z: c.pos[2],
      available: true,
      respawnTicks: 0,
    }));
    return;
  }
  w.charms = w.map.charms.map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, available: true, respawnTicks: 0 }));
}

/**
 * Build the world for one night. A scenario only overrides what it declares;
 * everything absent keeps the canonical map/standard numbers, and building a
 * scenario never emits events or awards score.
 */
export function createWorld(seed: number, night: NightId = 1, scenario: ScenarioInput | null = null): World {
  const map = nightMap(night);
  const w: World = {
    seed,
    night,
    map,
    rng: makeRng(seed),
    tick: 0,
    simTick: 0,
    state: 'playing',
    paused: false,
    score: 0,
    timeLeftTicks: map.durationTicks,
    initTimeTicks: map.durationTicks,
    player: makePlayer(map),
    lanterns: [],
    motes: [],
    shades: [],
    drifters: [],
    charms: [],
    wind: { active: false, warnActive: false, dirDeg: 0, dirX: 0, dirZ: 0, ticksLeft: 0 },
    randomMotes: scenario?.random_motes !== false,
    randomShades: scenario?.random_shades !== false,
    randomDrifters: scenario?.random_drifters !== false,
    windEnabled: scenario?.wind_enabled !== false,
    moteSeq: 1,
    shadeSeq: 1,
    drifterSeq: 1,
    dropSeq: 1,
  };

  if (scenario) {
    if (scenario.time_left_s !== undefined) {
      w.initTimeTicks = Math.round(scenario.time_left_s * TICKS_PER_SECOND);
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
      if (p.invuln_ticks !== undefined) w.player.invulnTicks = p.invuln_ticks;
      if (p.dash_cd_ticks !== undefined) w.player.dashCdTicks = p.dash_cd_ticks;
      if (p.pulse_cd_ticks !== undefined) w.player.pulseCdTicks = p.pulse_cd_ticks;
      if (p.charm_ticks !== undefined) w.player.charmTicks = p.charm_ticks;
    }
  }

  buildLanterns(w, scenario);
  buildCharms(w, scenario);

  if (scenario?.motes) {
    w.motes = scenario.motes.map((m, i) => ({
      id: `M${i + 1}`,
      x: m[0],
      y: m[1],
      z: m[2],
      kind: 'random' as const,
      active: true,
      ttlTicks: 0,
      pickableFromTick: 0,
      spotIndex: -1,
    }));
    w.moteSeq = w.motes.length + 1;
  } else if (w.randomMotes) {
    seedMotes(w, Math.min(MOTE_START, MOTE_CAP));
  }

  if (scenario?.shades) {
    w.shades = scenario.shades.map((s, i) => ({
      id: s.id ?? `S${i + 1}`,
      x: s.pos[0],
      y: s.pos[1],
      z: s.pos[2],
      state: s.state ?? 'chase',
      stateTicksLeft: s.state_ticks_left ?? 0,
      dirX: 0,
      dirZ: 1,
      pushX: 0,
      pushZ: 0,
      pushTicksLeft: 0,
      pushRemaining: 0,
    }));
    w.shadeSeq = w.shades.length + 1;
  }

  if (scenario?.drifters) {
    w.drifters = scenario.drifters.map((d, i) => ({
      id: d.id ?? `D${i + 1}`,
      x: d.pos[0],
      y: d.pos[1],
      z: d.pos[2],
      state: d.state ?? 'idle',
      stateTicksLeft: 0,
      dirX: 0,
      dirZ: 1,
      stolen: 0,
      steals: 0,
      vanishTicks: 0,
    }));
    w.drifterSeq = w.drifters.length + 1;
  }

  return w;
}

/** Height at which a shade of this world floats at (x, z). */
export function shadeYAt(w: World, x: number, z: number): number {
  const ground = groundAt(w, x, z);
  return (Number.isFinite(ground) ? ground : 0) + SHADE_HEIGHT;
}

export function drifterYAt(w: World, x: number, z: number): number {
  const ground = groundAt(w, x, z);
  return (Number.isFinite(ground) ? ground : 0) + DRIFTER_HEIGHT;
}

export function timeLeftSeconds(w: World): number {
  return w.timeLeftTicks / TICKS_PER_SECOND;
}

export function activeMoteCount(w: World): number {
  let n = 0;
  for (const m of w.motes) if (m.active) n += 1;
  return n;
}

export function lanternById(w: World, id: string): Lantern | undefined {
  return w.lanterns.find((l) => l.id === id);
}

export function spawnShadeAt(w: World, x: number, z: number, spawningTicks = SHADE_SPAWNING_TICKS): Shade {
  const shade: Shade = {
    id: `S${w.shadeSeq}`,
    x,
    y: shadeYAt(w, x, z),
    z,
    state: 'spawning',
    stateTicksLeft: spawningTicks,
    dirX: 0,
    dirZ: 1,
    pushX: 0,
    pushZ: 0,
    pushTicksLeft: 0,
    pushRemaining: 0,
  };
  w.shadeSeq += 1;
  return shade;
}

export function spawnDrifterAt(w: World, x: number, z: number): Drifter {
  const drifter: Drifter = {
    id: `D${w.drifterSeq}`,
    x,
    y: drifterYAt(w, x, z),
    z,
    state: 'idle',
    stateTicksLeft: 0,
    dirX: 1,
    dirZ: 0,
    stolen: 0,
    steals: 0,
    vanishTicks: 0,
  };
  w.drifterSeq += 1;
  return drifter;
}

/** A mote dropped by damage, placed on a ring around the player. */
export function makeDroppedMote(w: World, x: number, y: number, z: number, pickableFromTick: number, ttlTicks: number): Mote {
  const mote: Mote = {
    id: `M${w.moteSeq}`,
    x,
    y,
    z,
    kind: 'dropped',
    active: true,
    ttlTicks,
    pickableFromTick,
    spotIndex: -1,
  };
  w.moteSeq += 1;
  return mote;
}

export const VOID_HEIGHT = VOID;

export type { Charm, NightId };
