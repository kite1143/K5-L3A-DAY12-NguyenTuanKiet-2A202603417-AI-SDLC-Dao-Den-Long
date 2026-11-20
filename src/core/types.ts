import type { Rng } from './rng';
import type { NightId, NightMap } from './nights';

export type GameState = 'playing' | 'won' | 'lost';
/** Contract v1.2 fixes these six names for shades. */
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';
export type MoteKind = 'random' | 'dropped';
export type GameOverReason = 'dawn_survived' | 'dawn' | 'no_flames';
export type HitSource = 'shade' | 'fall';

export interface Mote {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: MoteKind;
  active: boolean;
  /** Ticks left before a dropped mote fades; 0 for random motes. */
  ttlTicks: number;
  /** First simulation tick on which it can be picked up. */
  pickableFromTick: number;
  /** Index in `map.moteSpots` for random motes (-1 when from a scenario). */
  spotIndex: number;
}

export interface Shade {
  id: string;
  x: number;
  y: number;
  z: number;
  state: ShadeState;
  stateTicksLeft: number;
  dirX: number;
  dirZ: number;
  /** Pulse push: direction, ticks left and metres still to travel. */
  pushX: number;
  pushZ: number;
  pushTicksLeft: number;
  pushRemaining: number;
  /** v1.2: the lantern a wandering/draining shade walks to. */
  targetLanternId: string | null;
}

export interface Drifter {
  id: string;
  x: number;
  y: number;
  z: number;
  state: DrifterState;
  stateTicksLeft: number;
  dirX: number;
  dirZ: number;
  /** Motes carried away. */
  stolen: number;
  /** 1 once it has had its one steal (or was scared off by a pulse). */
  steals: number;
  /** Ticks until it disappears after dropping its loot. */
  vanishTicks: number;
}

export interface Charm {
  id: string;
  x: number;
  y: number;
  z: number;
  available: boolean;
  respawnTicks: number;
}

export interface Lantern {
  id: string;
  x: number;
  y: number;
  z: number;
  cost: number;
  /** Progress toward lighting *this* time (only meaningful while unlit). */
  deposited: number;
  lit: boolean;
  /** Remaining fuel in 1/60 units; 0 when the lantern is out. */
  fuelUnits: number;
  /** True once the lantern has ever been lit; makes a relight cost 5 motes. */
  everLit: boolean;
  relitCount: number;
}

export interface Player {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Unit horizontal facing; used by the dash when standing still. */
  facingX: number;
  facingZ: number;
  grounded: boolean;
  carried: number;
  /** Current carry limit: 10 + 2 per successful light, capped at 20. */
  capacity: number;
  /** Lights and relights this night (scenario-seeded lit lanterns do not count). */
  successfulLights: number;
  flames: number;
  invulnTicks: number;
  dashTicks: number;
  dashX: number;
  dashZ: number;
  dashCdTicks: number;
  pulseCdTicks: number;
  charmTicks: number;
  /** A jump pad launch locks the horizontal velocity until landing. */
  launching: boolean;
  launchVX: number;
  launchVZ: number;
  /** Ticks left of the post-fall wait before respawning. */
  fallenTicks: number;
}

export interface Wind {
  active: boolean;
  warnActive: boolean;
  dirDeg: number;
  dirX: number;
  dirZ: number;
  ticksLeft: number;
}

export interface World {
  seed: number;
  night: NightId;
  map: NightMap;
  rng: Rng;
  /** Every step increments this, including paused steps. */
  tick: number;
  /** Only unpaused steps increment this. */
  simTick: number;
  state: GameState;
  paused: boolean;
  score: number;
  timeLeftTicks: number;
  initTimeTicks: number;
  player: Player;
  lanterns: Lantern[];
  motes: Mote[];
  shades: Shade[];
  drifters: Drifter[];
  charms: Charm[];
  wind: Wind;
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  /**
   * Benchmark scene (contract v1.3): no spawning, damage, pickups, fuel burn or
   * end-of-night checks. Shades keep wandering; everything else is frozen so the
   * measurement is the same on every machine.
   */
  bench: boolean;
  moteSeq: number;
  shadeSeq: number;
  drifterSeq: number;
  dropSeq: number;
}

export interface SimEvent {
  tick: number;
  name: string;
  data: Record<string, unknown>;
}

export interface PressedFlags {
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface ResolvedInput {
  moveX: number;
  moveZ: number;
  yawDeg: number;
  pressed: PressedFlags;
}
