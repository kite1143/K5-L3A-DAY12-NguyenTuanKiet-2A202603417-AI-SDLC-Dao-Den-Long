/**
 * Contract v1.1 — canonical numbers from Ticket-02, part 1.
 *
 * `TUNING` is the single source of truth for `game.contract.json`. The grader
 * builds hidden scenarios from that file, so a drift between the two silently
 * breaks every test: tests/contract.test.mjs fails on purpose if they differ.
 */

export const DT = 1 / 60;
export const TICKS_PER_SECOND = 60;

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
  night2_duration_s: number;
  night3_duration_s: number;
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
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  score: ScoreTuning;
}

export const TUNING: Tuning = {
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// --- tick counts derived from the tuning, so they never disagree -----------
export const DASH_TICKS = Math.round(TUNING.dash_duration_s * TICKS_PER_SECOND); // 12
export const DASH_COOLDOWN_TICKS = Math.round(TUNING.dash_cooldown_s * TICKS_PER_SECOND); // 90
export const PULSE_STUN_TICKS = Math.round(TUNING.pulse_stun_s * TICKS_PER_SECOND); // 120
export const PULSE_COOLDOWN_TICKS = Math.round(TUNING.pulse_cooldown_s * TICKS_PER_SECOND); // 180
export const INVULN_TICKS = Math.round(TUNING.invuln_s * TICKS_PER_SECOND); // 90

// --- movement / physics ---------------------------------------------------
export const JUMP_SPEED = 7.0;
export const GRAVITY = 20.0;
/** Height a grounded character can step up (ramps move far less than this per tick). */
export const STEP_HEIGHT = 0.6;
/** Pulse push: 4 m over the first 15 ticks. */
export const PULSE_PUSH_TICKS = 15;
/** Where the pulse is centred, above the player's feet. */
export const PULSE_CENTRE_HEIGHT = 0.8;

// --- motes -----------------------------------------------------------------
export const MOTE_CAP = 30;
export const MOTE_START = 20;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;
export const PICKUP_MAX_HEIGHT_DIFF = 1.5;
export const DROPPED_TTL_TICKS = 480;
export const DROP_RING_MIN = 1.5;
export const DROP_RING_MAX = 2.5;

// --- damage / falling -----------------------------------------------------
export const HIT_MAX_HEIGHT_DIFF = 1.5;
export const FALL_KILL_Y = -10;
export const FALL_RESPAWN_TICKS = 60;
export const SHADE_RECOIL_M = 2.0;
export const SHADE_RECOIL_TICKS = 60;

// --- shades ---------------------------------------------------------------
export const SHADE_DETECT_RADIUS = 12;
export const SHADE_LEAVE_RADIUS = 18;
export const SHADE_SPAWNING_TICKS = 30;
export const SHADE_WANDER_SPEED = 1.2;
export const SHADE_FIRST_SPAWN_TICK = 300;
export const SHADE_MIN_SPAWN_DISTANCE = 15;
export const SHADE_HEIGHT = 1.0;
/** Distance a shade may step up while following the ground. */
export const SHADE_STEP_HEIGHT = 1.5;

// --- Gió Lạc (drifters) ---------------------------------------------------
export const DRIFTER_SPEED = 7.0;
export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_MAX = 2;
export const DRIFTER_FIRST_SPAWN_TICK = 1200;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_CHASE_MIN_CARRY = 5;
export const DRIFTER_CHASE_RADIUS = 15;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_STEAL_MAX = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_VANISH_TICKS = 120;
export const DRIFTER_HEIGHT = 1.6;

// --- Bùa Gió (charms) -----------------------------------------------------
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;
export const CHARM_SPEED = 7.2;

// --- wind (night 3) -------------------------------------------------------
export const WIND_PERIOD_TICKS = 1800;
export const WIND_DURATION_TICKS = 300;
export const WIND_WARN_TICKS = 120;
export const WIND_PUSH_SPEED = 2.0;
/** Where inside each period the gust starts (after the warning window). */
export const WIND_GUST_OFFSET_TICKS = 480;

// --- palette (contract part 3). Render uses these; tests assert the values --
export const PALETTE = {
  skyNight: '#0E1430',
  mist: '#1B2350',
  grass: '#2F5D50',
  sand: '#C9B48A',
  wood: '#6B4A2F',
  cloudSea: '#12384A',
  lanternLit: '#FFB347',
  lanternCore: '#FFE9B0',
  lanternOff: '#5B5F6E',
  moteCore: '#FFF6C2',
  moteHalo: '#FFE58A',
  shadeBody: '#120A1A',
  shadeRim: '#7A3CFF',
  shadeStunned: '#3A3450',
  robe: '#E8E2D0',
  scarf: '#C8102E',
  gold: '#F2C14E',
  drifter: '#8FA3B8',
  danger: '#FF5A5F',
  uiText: '#F5F1E6',
} as const;

/** Ambient intensity the stage must use: 0.15 + 0.55 × (lit / total). */
export function ambientForLit(lit: number, total: number): number {
  if (total <= 0) return 0.15;
  return 0.15 + 0.55 * (lit / total);
}
