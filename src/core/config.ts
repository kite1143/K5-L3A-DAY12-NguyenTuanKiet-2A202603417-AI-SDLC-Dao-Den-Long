/**
 * Tuning and world layout for Night 1.
 *
 * IMPORTANT: `TUNING` is the single source of truth for the numbers declared in
 * /game.contract.json. A test (tests/contract.test.mjs) fails if the two drift
 * apart, so change both together.
 */

export const DT = 1 / 60;

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export const TUNING: Tuning = {
  player_speed: 5.0,
  carry_capacity: 3,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  /** Phase 1: pulsing costs no motes (the cost is the cooldown). See README. */
  pulse_cost: 0,
  pulse_radius: 6.0,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 3.0,
  pulse_cooldown_s: 1.5,
  safe_radius: 3.0,
  shade_speed: 2.6,
  shade_hit_radius: 1.0,
  /** Phase 1: the shore is a soft wall, the player cannot fall off. */
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

/** Island "Đảo Bến": a round island of this radius (metres), ground at Y = 0. */
export const ISLAND_RADIUS = 26;

/** Player is clamped to this horizontal radius (soft shore, no falling). */
export const EDGE_LIMIT = ISLAND_RADIUS - 0.6;

export const JUMP_SPEED = 6.2;
export const GRAVITY = 22;

/** Shades float: their reported centre sits at this height. */
export const SHADE_Y = 1.0;

/** How many motes are scattered when the scenario does not list them. */
export const DEFAULT_MOTES = 30;

/** Shade spawning when random_shades is true. */
export const SHADE_MAX = 4;
export const SHADE_FIRST_SPAWN_TICKS = 360; // 6 s
export const SHADE_SPAWN_INTERVAL_TICKS = 600; // 10 s

/** The five Big Lanterns of Đêm 1, arranged on a ring. */
export const LANTERN_LAYOUT: ReadonlyArray<{ id: string; x: number; z: number }> = [
  { id: 'L1', x: 0, z: 17 },
  { id: 'L2', x: -16.169, z: 5.253 },
  { id: 'L3', x: -9.992, z: -13.755 },
  { id: 'L4', x: 9.992, z: -13.755 },
  { id: 'L5', x: 16.169, z: 5.253 },
];
