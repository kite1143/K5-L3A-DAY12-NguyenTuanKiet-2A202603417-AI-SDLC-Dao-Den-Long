import type { Rng } from './rng';

export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'chase' | 'stunned';
export type GameOverReason = 'all_lit' | 'dawn' | 'no_flames';
export type HitSource = 'shade' | 'fall';

export interface Mote {
  id: string;
  /** Ground point: y is always 0 by contract (float height is display only). */
  x: number;
  z: number;
  active: boolean;
}

export interface Shade {
  id: string;
  x: number;
  y: number;
  z: number;
  state: ShadeState;
  stunTicks: number;
}

export interface Lantern {
  id: string;
  x: number;
  z: number;
  cost: number;
  deposited: number;
  lit: boolean;
}

export interface Player {
  /** Feet position. */
  x: number;
  y: number;
  z: number;
  vy: number;
  onGround: boolean;
  carried: number;
  flames: number;
  invulnTicks: number;
  pulseCooldownTicks: number;
}

export interface World {
  seed: number;
  night: number;
  rng: Rng;
  /** Steps already simulated (equals `tick` in Phase 1). */
  tick: number;
  state: GameState;
  score: number;
  /** Remaining night time in whole ticks. */
  timeLeftTicks: number;
  initTimeTicks: number;
  player: Player;
  lanterns: Lantern[];
  motes: Mote[];
  shades: Shade[];
  randomMotes: boolean;
  randomShades: boolean;
  moteSeq: number;
  shadeSeq: number;
  spawnTimerTicks: number;
}

export interface SimEvent {
  tick: number;
  name: string;
  data: Record<string, unknown>;
}

export interface PresseFlags {
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

export interface ResolvedInput {
  /** Raw stick components in [-1, 1] (normalised to length 1 after transform). */
  moveX: number;
  moveZ: number;
  yawDeg: number;
  pressed: PresseFlags;
}
