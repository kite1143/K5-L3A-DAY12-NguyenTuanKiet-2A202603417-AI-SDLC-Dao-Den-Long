// src/headless/main.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// src/core/scenario.ts
var ContractFormatError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractFormatError";
  }
};
var SHADE_STATES = ["spawning", "wander", "chase", "recoil", "stunned", "drain"];
var DRIFTER_STATES = ["idle", "chase", "flee", "removed"];
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function num(v, where) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ContractFormatError(`${where} must be a finite number`);
  }
  return v;
}
function nonNegativeInt(v, where) {
  const n = num(v, where);
  if (!Number.isInteger(n) || n < 0) throw new ContractFormatError(`${where} must be a non-negative integer`);
  return n;
}
function vec3(v, where) {
  if (!Array.isArray(v) || v.length !== 3) throw new ContractFormatError(`${where} must be an array of 3 numbers`);
  return [num(v[0], `${where}[0]`), num(v[1], `${where}[1]`), num(v[2], `${where}[2]`)];
}
function bool(v, where) {
  if (typeof v !== "boolean") throw new ContractFormatError(`${where} must be a boolean`);
  return v;
}
function parseScenario(raw) {
  if (!isRecord(raw)) throw new ContractFormatError("scenario must be a JSON object");
  const out = {};
  if (raw.player !== void 0) {
    if (!isRecord(raw.player)) throw new ContractFormatError("player must be an object");
    const p = {};
    if (raw.player.pos !== void 0) p.pos = vec3(raw.player.pos, "player.pos");
    if (raw.player.carried !== void 0) p.carried = nonNegativeInt(raw.player.carried, "player.carried");
    if (raw.player.flames !== void 0) p.flames = nonNegativeInt(raw.player.flames, "player.flames");
    if (raw.player.invuln_ticks !== void 0) {
      p.invuln_ticks = nonNegativeInt(raw.player.invuln_ticks, "player.invuln_ticks");
    }
    if (raw.player.dash_cd_ticks !== void 0) {
      p.dash_cd_ticks = nonNegativeInt(raw.player.dash_cd_ticks, "player.dash_cd_ticks");
    }
    if (raw.player.pulse_cd_ticks !== void 0) {
      p.pulse_cd_ticks = nonNegativeInt(raw.player.pulse_cd_ticks, "player.pulse_cd_ticks");
    }
    if (raw.player.charm_ticks !== void 0) {
      p.charm_ticks = nonNegativeInt(raw.player.charm_ticks, "player.charm_ticks");
    }
    if (raw.player.successful_lights !== void 0) {
      p.successful_lights = nonNegativeInt(raw.player.successful_lights, "player.successful_lights");
    }
    out.player = p;
  }
  if (raw.random_motes !== void 0) out.random_motes = bool(raw.random_motes, "random_motes");
  if (raw.random_shades !== void 0) out.random_shades = bool(raw.random_shades, "random_shades");
  if (raw.random_drifters !== void 0) out.random_drifters = bool(raw.random_drifters, "random_drifters");
  if (raw.wind_enabled !== void 0) out.wind_enabled = bool(raw.wind_enabled, "wind_enabled");
  if (raw.bench !== void 0) out.bench = bool(raw.bench, "bench");
  if (raw.motes !== void 0) {
    if (!Array.isArray(raw.motes)) throw new ContractFormatError("motes must be an array");
    out.motes = raw.motes.map((m, i) => vec3(m, `motes[${i}]`));
  }
  if (raw.shades !== void 0) {
    if (!Array.isArray(raw.shades)) throw new ContractFormatError("shades must be an array");
    out.shades = raw.shades.map((s, i) => {
      if (!isRecord(s)) throw new ContractFormatError(`shades[${i}] must be an object`);
      const shade = { pos: vec3(s.pos, `shades[${i}].pos`) };
      if (s.id !== void 0) {
        if (typeof s.id !== "string" || s.id.length === 0) {
          throw new ContractFormatError(`shades[${i}].id must be a non-empty string`);
        }
        shade.id = s.id;
      }
      if (s.state !== void 0) {
        if (typeof s.state !== "string" || !SHADE_STATES.includes(s.state)) {
          throw new ContractFormatError(`shades[${i}].state must be one of ${SHADE_STATES.join(", ")}`);
        }
        shade.state = s.state;
      }
      if (s.state_ticks_left !== void 0) {
        shade.state_ticks_left = nonNegativeInt(s.state_ticks_left, `shades[${i}].state_ticks_left`);
      }
      if (s.target_lantern_id !== void 0) {
        if (s.target_lantern_id !== null && typeof s.target_lantern_id !== "string") {
          throw new ContractFormatError(`shades[${i}].target_lantern_id must be a string or null`);
        }
        shade.target_lantern_id = s.target_lantern_id;
      }
      return shade;
    });
  }
  if (raw.drifters !== void 0) {
    if (!Array.isArray(raw.drifters)) throw new ContractFormatError("drifters must be an array");
    out.drifters = raw.drifters.map((d, i) => {
      if (!isRecord(d)) throw new ContractFormatError(`drifters[${i}] must be an object`);
      const drifter = { pos: vec3(d.pos, `drifters[${i}].pos`) };
      if (d.id !== void 0) {
        if (typeof d.id !== "string" || d.id.length === 0) {
          throw new ContractFormatError(`drifters[${i}].id must be a non-empty string`);
        }
        drifter.id = d.id;
      }
      if (d.state !== void 0) {
        if (typeof d.state !== "string" || !DRIFTER_STATES.includes(d.state)) {
          throw new ContractFormatError(`drifters[${i}].state must be one of ${DRIFTER_STATES.join(", ")}`);
        }
        drifter.state = d.state;
      }
      return drifter;
    });
  }
  if (raw.charms !== void 0) {
    if (!Array.isArray(raw.charms)) throw new ContractFormatError("charms must be an array");
    out.charms = raw.charms.map((c, i) => {
      if (!isRecord(c)) throw new ContractFormatError(`charms[${i}] must be an object`);
      if (typeof c.id !== "string" || c.id.length === 0) {
        throw new ContractFormatError(`charms[${i}].id must be a non-empty string`);
      }
      return { id: c.id, pos: vec3(c.pos, `charms[${i}].pos`) };
    });
  }
  if (raw.lanterns !== void 0) {
    if (!Array.isArray(raw.lanterns)) throw new ContractFormatError("lanterns must be an array");
    out.lanterns = raw.lanterns.map((l, i) => {
      if (!isRecord(l)) throw new ContractFormatError(`lanterns[${i}] must be an object`);
      if (typeof l.id !== "string" || l.id.length === 0) {
        throw new ContractFormatError(`lanterns[${i}].id must be a non-empty string`);
      }
      const lantern = { id: l.id };
      if (l.pos !== void 0) lantern.pos = vec3(l.pos, `lanterns[${i}].pos`);
      if (l.deposited !== void 0) lantern.deposited = nonNegativeInt(l.deposited, `lanterns[${i}].deposited`);
      if (l.lit !== void 0) lantern.lit = bool(l.lit, `lanterns[${i}].lit`);
      if (l.fuel !== void 0) {
        const fuel = num(l.fuel, `lanterns[${i}].fuel`);
        if (fuel < 0 || fuel > 100) throw new ContractFormatError(`lanterns[${i}].fuel must be in [0, 100]`);
        lantern.fuel = fuel;
      }
      if (l.ever_lit !== void 0) lantern.ever_lit = bool(l.ever_lit, `lanterns[${i}].ever_lit`);
      return lantern;
    });
  }
  if (raw.time_left_s !== void 0) {
    const t = num(raw.time_left_s, "time_left_s");
    if (t < 0) throw new ContractFormatError("time_left_s must be >= 0");
    out.time_left_s = t;
  }
  return out;
}
function parseInputs(raw) {
  if (!isRecord(raw)) throw new ContractFormatError("inputs must be a JSON object");
  if (!Array.isArray(raw.frames)) throw new ContractFormatError("inputs.frames must be an array");
  let lastTick = -1;
  const frames = raw.frames.map((f, i) => {
    if (!isRecord(f)) throw new ContractFormatError(`frames[${i}] must be an object`);
    const tick = nonNegativeInt(f.tick, `frames[${i}].tick`);
    if (tick <= lastTick) throw new ContractFormatError("frames[].tick must increase strictly");
    lastTick = tick;
    const frame = { tick };
    if (f.move !== void 0) {
      if (!Array.isArray(f.move) || f.move.length !== 2) {
        throw new ContractFormatError(`frames[${i}].move must be [x, z]`);
      }
      frame.moveX = num(f.move[0], `frames[${i}].move[0]`);
      frame.moveZ = num(f.move[1], `frames[${i}].move[1]`);
    }
    if (f.cam_yaw_deg !== void 0) frame.yawDeg = num(f.cam_yaw_deg, `frames[${i}].cam_yaw_deg`);
    if (f.jump !== void 0) frame.jump = bool(f.jump, `frames[${i}].jump`);
    if (f.interact !== void 0) frame.interact = bool(f.interact, `frames[${i}].interact`);
    if (f.pulse !== void 0) frame.pulse = bool(f.pulse, `frames[${i}].pulse`);
    if (f.dash !== void 0) frame.dash = bool(f.dash, `frames[${i}].dash`);
    if (f.pause !== void 0) frame.pause = bool(f.pause, `frames[${i}].pause`);
    return frame;
  });
  return { frames };
}

// src/core/config.ts
var DT = 1 / 60;
var TICKS_PER_SECOND = 60;
var TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fuel_max: 100,
  fuel_decay_per_s: 1,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_relight: 40,
    per_stun: 5,
    per_stun_drain: 15,
    dawn_per_lantern: 50,
    dawn_per_flame: 50,
    per_second_left: 0,
    per_flame_left: 0
  }
};
var DASH_TICKS = Math.round(TUNING.dash_duration_s * TICKS_PER_SECOND);
var DASH_COOLDOWN_TICKS = Math.round(TUNING.dash_cooldown_s * TICKS_PER_SECOND);
var PULSE_STUN_TICKS = Math.round(TUNING.pulse_stun_s * TICKS_PER_SECOND);
var PULSE_COOLDOWN_TICKS = Math.round(TUNING.pulse_cooldown_s * TICKS_PER_SECOND);
var INVULN_TICKS = Math.round(TUNING.invuln_s * TICKS_PER_SECOND);
var JUMP_SPEED = 7;
var GRAVITY = 20;
var STEP_HEIGHT = 0.6;
var PULSE_PUSH_TICKS = 15;
var PULSE_CENTRE_HEIGHT = 0.8;
var MOTE_CAP = 30;
var MOTE_START = 20;
var MOTE_SPAWN_INTERVAL_TICKS = 240;
var PICKUP_MAX_HEIGHT_DIFF = 1.5;
var DROPPED_TTL_TICKS = 480;
var DROP_RING_MIN = 1.5;
var DROP_RING_MAX = 2.5;
var HIT_MAX_HEIGHT_DIFF = 1.5;
var FALL_KILL_Y = -10;
var FALL_RESPAWN_TICKS = 60;
var SHADE_RECOIL_M = 2;
var SHADE_RECOIL_TICKS = 60;
var SHADE_DETECT_RADIUS = 12;
var SHADE_LEAVE_RADIUS = 18;
var SHADE_SPAWNING_TICKS = 30;
var SHADE_WANDER_SPEED = 1.2;
var SHADE_MIN_SPAWN_DISTANCE = 15;
var SHADE_HEIGHT = 1;
var SHADE_STEP_HEIGHT = 1.5;
var DRIFTER_SPEED = 7;
var DRIFTER_IDLE_SPEED = 2;
var DRIFTER_MAX = 2;
var DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
var DRIFTER_CHASE_MIN_CARRY = 5;
var DRIFTER_CHASE_RADIUS = 15;
var DRIFTER_STEAL_RADIUS = 1.2;
var DRIFTER_STEAL_MAX = 3;
var DRIFTER_FLEE_TICKS = 240;
var DRIFTER_VANISH_TICKS = 120;
var DRIFTER_HEIGHT = 1.6;
var CHARM_TICKS = 600;
var CHARM_RESPAWN_TICKS = 2700;
var CHARM_SPEED = 7.2;
var WIND_PERIOD_TICKS = 1800;
var WIND_DURATION_TICKS = 300;
var WIND_WARN_TICKS = 120;
var WIND_PUSH_SPEED = 2;
var WIND_GUST_OFFSET_TICKS = 480;
var FUEL_MAX_UNITS = TUNING.fuel_max * 60;
var FUEL_DECAY_UNITS_PER_TICK = TUNING.fuel_decay_per_s;
var FUEL_PER_MOTE_UNITS = TUNING.fuel_per_mote * 60;
var DRAIN_UNITS_PER_TICK = TUNING.drain_per_s;
var LOW_FUEL_UNITS = TUNING.low_fuel_threshold * 60;
var DRAIN_RANGE = 2;
var DRAIN_EVENT_INTERVAL_TICKS = 60;
var CAPACITY_BASE = 10;
var CAPACITY_PER_LIGHT = 2;
function fuelToDisplay(fuelUnits) {
  return Math.round(Math.max(0, fuelUnits) / 60 * 10) / 10;
}
function dawnThreshold(total) {
  return Math.ceil(TUNING.win_ratio * total);
}

// src/core/inputs.ts
var InputTimeline = class {
  frames;
  index = 0;
  moveX = 0;
  moveZ = 0;
  yawDeg = 0;
  jump = false;
  interact = false;
  pulse = false;
  dash = false;
  pause = false;
  constructor(frames = []) {
    this.frames = frames;
  }
  /** Resolved input for `tick` (the tick whose state is read by that step). */
  at(tick) {
    const prev = {
      jump: this.jump,
      interact: this.interact,
      pulse: this.pulse,
      dash: this.dash,
      pause: this.pause
    };
    while (this.index < this.frames.length && this.frames[this.index].tick <= tick) {
      const f = this.frames[this.index];
      this.index += 1;
      if (f.moveX !== void 0) this.moveX = f.moveX;
      if (f.moveZ !== void 0) this.moveZ = f.moveZ;
      if (f.yawDeg !== void 0) this.yawDeg = f.yawDeg;
      if (f.jump !== void 0) this.jump = f.jump;
      if (f.interact !== void 0) this.interact = f.interact;
      if (f.pulse !== void 0) this.pulse = f.pulse;
      if (f.dash !== void 0) this.dash = f.dash;
      if (f.pause !== void 0) this.pause = f.pause;
    }
    return {
      moveX: this.moveX,
      moveZ: this.moveZ,
      yawDeg: this.yawDeg,
      pressed: {
        jump: this.jump && !prev.jump,
        interact: this.interact && !prev.interact,
        pulse: this.pulse && !prev.pulse,
        dash: this.dash && !prev.dash,
        pause: this.pause && !prev.pause
      }
    };
  }
};
function normaliseMove(moveX, moveZ) {
  const len = Math.hypot(moveX, moveZ);
  if (len > 1) return { x: moveX / len, z: moveZ / len };
  return { x: moveX, z: moveZ };
}
function worldDirection(moveX, moveZ, yawDeg) {
  const { x, z } = normaliseMove(moveX, moveZ);
  const th = yawDeg * Math.PI / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { x: x * c + z * s, z: -x * s + z * c };
}

// src/core/rng.ts
function makeRng(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  };
}

// src/core/nights.ts
var VOID = Number.NEGATIVE_INFINITY;
var DEG = Math.PI / 180;
function ring(count, radius, startDeg, stepDeg, cx = 0, cz = 0) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const a = (startDeg + i * stepDeg) * DEG;
    points.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
  }
  return points;
}
function spot(x, z, height) {
  const y = height(x, z);
  return { x, y: Number.isFinite(y) ? y : 0, z };
}
function withHeights(points, height) {
  return points.map((p) => spot(p.x, p.z, height));
}
var NIGHT1_RADIUS = 40;
function night1Height(x, z) {
  return Math.hypot(x, z) <= NIGHT1_RADIUS ? 0 : VOID;
}
var night1 = {
  id: 1,
  name: "\u0110\u1EA3o B\u1EBFn",
  label: "\u0110\xEAm 1 \u2014 \u0110\u1EA3o B\u1EBFn",
  durationTicks: TUNING.night1_duration_s * TICKS_PER_SECOND,
  spawn: { x: 0, y: 0, z: 0 },
  moteSpots: withHeights([...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)], night1Height),
  lanterns: [
    { id: "L1", x: 0, y: 0, z: 25 },
    { id: "L2", x: 23.8, y: 0, z: 7.7 },
    { id: "L3", x: 14.7, y: 0, z: -20.2 },
    { id: "L4", x: -14.7, y: 0, z: -20.2 },
    { id: "L5", x: -23.8, y: 0, z: 7.7 }
  ],
  shadeSpots: ring(12, 37, 15, 30),
  shadeSchedule: { firstTick: 300, intervalTicks: 480, batch: 2, max: 6 },
  shadeSpeed: TUNING.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  wind: null,
  height: night1Height
};
var N2_A = { x: 0, z: 0 };
var N2_B = { x: 70, z: 0 };
var N2_ISLAND_RADIUS = 28;
var N2_BRIDGE = { xMin: 26, xMax: 44, halfZ: 2 };
function night2Height(x, z) {
  if (Math.hypot(x - N2_A.x, z - N2_A.z) <= N2_ISLAND_RADIUS) return 0;
  if (Math.hypot(x - N2_B.x, z - N2_B.z) <= N2_ISLAND_RADIUS) return 0;
  if (x >= N2_BRIDGE.xMin && x <= N2_BRIDGE.xMax && Math.abs(z) <= N2_BRIDGE.halfZ) return 0;
  return VOID;
}
function padFrom(x, y, z, towardX, towardZ, vy, speed) {
  const dx = towardX - x;
  const dz = towardZ - z;
  const len = Math.hypot(dx, dz) || 1;
  return { x, y, z, radius: 1, vy, speed, dirX: dx / len, dirZ: dz / len };
}
var night2 = {
  id: 2,
  name: "\u0110\u1EA3o Cau",
  label: "\u0110\xEAm 2 \u2014 \u0110\u1EA3o Cau",
  durationTicks: TUNING.night2_duration_s * TICKS_PER_SECOND,
  spawn: { x: 0, y: 0, z: 0 },
  moteSpots: withHeights(
    [
      ...ring(4, 10, 0, 90, N2_A.x, N2_A.z),
      ...ring(8, 22, 0, 45, N2_A.x, N2_A.z),
      ...ring(4, 10, 0, 90, N2_B.x, N2_B.z),
      ...ring(8, 22, 0, 45, N2_B.x, N2_B.z)
    ],
    night2Height
  ),
  lanterns: [
    { id: "L1", x: 0, y: 0, z: 20 },
    { id: "L2", x: 17, y: 0, z: -10 },
    { id: "L3", x: -17, y: 0, z: -10 },
    { id: "L4", x: 70, y: 0, z: 20 },
    { id: "L5", x: 87, y: 0, z: -10 },
    { id: "L6", x: 53, y: 0, z: -10 }
  ],
  shadeSpots: [
    ...ring(8, 26, 22.5, 45, N2_A.x, N2_A.z),
    ...ring(8, 26, 22.5, 45, N2_B.x, N2_B.z)
  ],
  shadeSchedule: { firstTick: 300, intervalTicks: 420, batch: 1, max: 8 },
  shadeSpeed: TUNING.shade_speed,
  pads: [
    padFrom(20, 0, 18, N2_B.x, N2_B.z, 14, 24),
    padFrom(50, 0, -18, N2_A.x, N2_A.z, 14, 24)
  ],
  charms: [{ id: "C1", x: 35, y: 0, z: 0 }],
  drifters: true,
  wind: null,
  height: night2Height
};
var N3_RADIUS = 45;
var N3_TIER1 = { minRadius: 12, maxRadius: 24, y: 3 };
var N3_TIER2 = { radius: 8, y: 6 };
var N3_RAMP_ANGLES = [30, 150];
var N3_RAMP = { innerRadius: 24, outerRadius: 30, halfWidth: 1.5 };
function rampHeight(x, z) {
  for (const deg of N3_RAMP_ANGLES) {
    const a = deg * DEG;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const along = x * dx + z * dz;
    if (along < N3_RAMP.innerRadius || along > N3_RAMP.outerRadius) continue;
    const perp = Math.abs(-x * dz + z * dx);
    if (perp > N3_RAMP.halfWidth) continue;
    return (N3_RAMP.outerRadius - along) / (N3_RAMP.outerRadius - N3_RAMP.innerRadius) * N3_TIER1.y;
  }
  return null;
}
function night3Height(x, z) {
  const r = Math.hypot(x, z);
  if (r > N3_RADIUS) return VOID;
  if (r <= N3_TIER2.radius) return N3_TIER2.y;
  const ramp = rampHeight(x, z);
  if (ramp !== null) return ramp;
  if (z > 0 && r >= N3_TIER1.minRadius && r <= N3_TIER1.maxRadius) return N3_TIER1.y;
  return 0;
}
var night3 = {
  id: 3,
  name: "\u0110\u1EA3o Chu\xF4ng",
  label: "\u0110\xEAm 3 \u2014 \u0110\u1EA3o Chu\xF4ng",
  durationTicks: TUNING.night3_duration_s * TICKS_PER_SECOND,
  // The ticket fixes no start point for night 3; (0, -30) is open tier-0 ground
  // instead of the bell tower's disc at the centre.
  spawn: { x: 0, y: 0, z: -30 },
  moteSpots: withHeights(
    [...ring(18, 34, 0, 20), ...ring(8, 18, 20, 20), ...ring(4, 5, 45, 90)],
    night3Height
  ),
  lanterns: [
    { id: "L1", x: 0, y: 6, z: 6 },
    { id: "L2", x: 18, y: 3, z: 10 },
    { id: "L3", x: -18, y: 3, z: 10 },
    { id: "L4", x: 35, y: 0, z: -10 },
    { id: "L5", x: -35, y: 0, z: -10 },
    { id: "L6", x: 20, y: 0, z: -35 },
    { id: "L7", x: -20, y: 0, z: -35 }
  ],
  shadeSpots: ring(16, 43, 0, 22.5),
  shadeSchedule: { firstTick: 300, intervalTicks: 360, batch: 1, max: 10 },
  shadeSpeed: 4.5,
  pads: [padFrom(0, 3, 13, 0, 13 - 1, 12, 8)],
  charms: [
    { id: "C1", x: 30, y: 0, z: 25 },
    { id: "C2", x: -30, y: 0, z: 25 }
  ],
  drifters: true,
  wind: {
    periodTicks: WIND_PERIOD_TICKS,
    durationTicks: WIND_DURATION_TICKS,
    warnTicks: WIND_WARN_TICKS,
    pushSpeed: WIND_PUSH_SPEED,
    gustOffsetTicks: WIND_GUST_OFFSET_TICKS
  },
  height: night3Height
};
var NIGHT_MAPS = { 1: night1, 2: night2, 3: night3 };
function nightMap(id) {
  return NIGHT_MAPS[id];
}
var NIGHT3_GEOMETRY = {
  radius: N3_RADIUS,
  tier1: N3_TIER1,
  tier2: N3_TIER2,
  ramps: { angles: N3_RAMP_ANGLES, ...N3_RAMP },
  tower: { radius: 2, height: 8 }
};

// src/core/world.ts
function groundAt(w, x, z) {
  return w.map.height(x, z);
}
function distanceXZ(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
function distance3D(ax, ay, az, bx, by, bz) {
  return Math.hypot(ax - bx, ay - by, az - bz);
}
function shuffle(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function makePlayer(map) {
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
    capacity: CAPACITY_BASE,
    successfulLights: 0,
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
    fallenTicks: 0
  };
}
function seedMotes(w, count) {
  const spots = w.map.moteSpots;
  const order = shuffle(w.rng, spots.map((_, i) => i)).slice(0, Math.min(count, spots.length));
  for (const spotIndex of order) {
    const p = spots[spotIndex];
    w.motes.push({
      id: `M${w.moteSeq}`,
      x: p.x,
      y: p.y,
      z: p.z,
      kind: "random",
      active: true,
      ttlTicks: 0,
      pickableFromTick: 0,
      spotIndex
    });
    w.moteSeq += 1;
  }
}
function buildLanterns(w, scenario) {
  w.lanterns = w.map.lanterns.map((spec) => ({
    id: spec.id,
    x: spec.x,
    y: spec.y,
    z: spec.z,
    cost: TUNING.lantern_cost,
    deposited: 0,
    lit: false,
    fuelUnits: 0,
    everLit: false,
    relitCount: 0
  }));
  for (const update of scenario?.lanterns ?? []) {
    const target = w.lanterns.find((l) => l.id === update.id);
    if (!target) continue;
    if (update.pos) {
      target.x = update.pos[0];
      target.y = update.pos[1];
      target.z = update.pos[2];
    }
    if (update.deposited !== void 0) target.deposited = update.deposited;
    if (update.ever_lit !== void 0) target.everLit = update.ever_lit;
    if (update.fuel !== void 0) {
      target.fuelUnits = Math.max(0, Math.min(FUEL_MAX_UNITS, Math.round(update.fuel * 60)));
    }
    if (update.lit !== void 0) {
      target.lit = update.lit;
      if (update.lit && update.fuel === void 0) target.fuelUnits = FUEL_MAX_UNITS;
      if (!update.lit) target.fuelUnits = 0;
    }
    if (target.lit) target.everLit = true;
  }
}
function buildCharms(w, scenario) {
  if (scenario?.charms) {
    w.charms = scenario.charms.map((c) => ({
      id: c.id,
      x: c.pos[0],
      y: c.pos[1],
      z: c.pos[2],
      available: true,
      respawnTicks: 0
    }));
    return;
  }
  w.charms = w.map.charms.map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, available: true, respawnTicks: 0 }));
}
function createWorld(seed, night = 1, scenario = null) {
  const map = nightMap(night);
  const w = {
    seed,
    night,
    map,
    rng: makeRng(seed),
    tick: 0,
    simTick: 0,
    state: "playing",
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
    bench: scenario?.bench === true,
    moteSeq: 1,
    shadeSeq: 1,
    drifterSeq: 1,
    dropSeq: 1
  };
  if (scenario) {
    if (scenario.time_left_s !== void 0) {
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
      if (p.carried !== void 0) w.player.carried = p.carried;
      if (p.flames !== void 0) w.player.flames = p.flames;
      if (p.successful_lights !== void 0) {
        w.player.successfulLights = p.successful_lights;
        w.player.capacity = Math.min(
          TUNING.capacity_max,
          CAPACITY_BASE + CAPACITY_PER_LIGHT * p.successful_lights
        );
      }
      if (p.invuln_ticks !== void 0) w.player.invulnTicks = p.invuln_ticks;
      if (p.dash_cd_ticks !== void 0) w.player.dashCdTicks = p.dash_cd_ticks;
      if (p.pulse_cd_ticks !== void 0) w.player.pulseCdTicks = p.pulse_cd_ticks;
      if (p.charm_ticks !== void 0) w.player.charmTicks = p.charm_ticks;
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
      kind: "random",
      active: true,
      ttlTicks: 0,
      pickableFromTick: 0,
      spotIndex: -1
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
      state: s.state ?? "chase",
      stateTicksLeft: s.state_ticks_left ?? 0,
      dirX: 0,
      dirZ: 1,
      pushX: 0,
      pushZ: 0,
      pushTicksLeft: 0,
      pushRemaining: 0,
      targetLanternId: s.target_lantern_id ?? null
    }));
    w.shadeSeq = w.shades.length + 1;
  }
  if (scenario?.drifters) {
    w.drifters = scenario.drifters.map((d, i) => ({
      id: d.id ?? `D${i + 1}`,
      x: d.pos[0],
      y: d.pos[1],
      z: d.pos[2],
      state: d.state ?? "idle",
      stateTicksLeft: 0,
      dirX: 0,
      dirZ: 1,
      stolen: 0,
      steals: 0,
      vanishTicks: 0
    }));
    w.drifterSeq = w.drifters.length + 1;
  }
  return w;
}
function shadeYAt(w, x, z) {
  const ground = groundAt(w, x, z);
  return (Number.isFinite(ground) ? ground : 0) + SHADE_HEIGHT;
}
function drifterYAt(w, x, z) {
  const ground = groundAt(w, x, z);
  return (Number.isFinite(ground) ? ground : 0) + DRIFTER_HEIGHT;
}
function timeLeftSeconds(w) {
  return w.timeLeftTicks / TICKS_PER_SECOND;
}
function activeMoteCount(w) {
  let n = 0;
  for (const m of w.motes) if (m.active) n += 1;
  return n;
}
function spawnShadeAt(w, x, z, spawningTicks = SHADE_SPAWNING_TICKS) {
  const shade = {
    id: `S${w.shadeSeq}`,
    x,
    y: shadeYAt(w, x, z),
    z,
    state: "spawning",
    stateTicksLeft: spawningTicks,
    dirX: 0,
    dirZ: 1,
    pushX: 0,
    pushZ: 0,
    pushTicksLeft: 0,
    pushRemaining: 0,
    targetLanternId: null
  };
  w.shadeSeq += 1;
  return shade;
}
function spawnDrifterAt(w, x, z) {
  const drifter = {
    id: `D${w.drifterSeq}`,
    x,
    y: drifterYAt(w, x, z),
    z,
    state: "idle",
    stateTicksLeft: 0,
    dirX: 1,
    dirZ: 0,
    stolen: 0,
    steals: 0,
    vanishTicks: 0
  };
  w.drifterSeq += 1;
  return drifter;
}
function makeDroppedMote(w, x, y, z, pickableFromTick, ttlTicks) {
  const mote = {
    id: `M${w.moteSeq}`,
    x,
    y,
    z,
    kind: "dropped",
    active: true,
    ttlTicks,
    pickableFromTick,
    spotIndex: -1
  };
  w.moteSeq += 1;
  return mote;
}

// src/core/step.ts
var DEG2 = Math.PI / 180;
function windDirDeg(seed, cycle) {
  let h = (seed ^ Math.imul(cycle + 1, 2654435761)) >>> 0;
  h = Math.imul(h ^ h >>> 15, 2246822519) >>> 0;
  h = Math.imul(h ^ h >>> 13, 3266489917) >>> 0;
  h = (h ^ h >>> 16) >>> 0;
  return h % 3600 / 10;
}
function stepWorld(w, input, out) {
  const tick = w.tick + 1;
  if (input.pressed.pause) {
    if (!w.paused) {
      w.paused = true;
      w.tick = tick;
      out.push({ tick, name: "paused", data: {} });
      return;
    }
    w.paused = false;
    out.push({ tick, name: "resumed", data: {} });
  }
  if (w.paused) {
    w.tick = tick;
    return;
  }
  if (w.state !== "playing") {
    w.tick = tick;
    return;
  }
  const simTick = w.simTick + 1;
  if (simTick === 1) out.push({ tick, name: "night_start", data: { night: w.night } });
  const p = w.player;
  w.timeLeftTicks = Math.max(0, w.timeLeftTicks - 1);
  if (p.invulnTicks > 0) p.invulnTicks -= 1;
  if (p.dashCdTicks > 0) p.dashCdTicks -= 1;
  if (p.pulseCdTicks > 0) p.pulseCdTicks -= 1;
  if (p.charmTicks > 0) p.charmTicks -= 1;
  for (const mote of w.motes) {
    if (!mote.active || mote.ttlTicks <= 0) continue;
    mote.ttlTicks -= 1;
    if (mote.ttlTicks <= 0) mote.active = false;
  }
  for (const charm of w.charms) {
    if (charm.available) continue;
    if (charm.respawnTicks > 0) charm.respawnTicks -= 1;
    if (charm.respawnTicks === 0) charm.available = true;
  }
  if (!w.bench) {
    let drainedByLantern = null;
    for (const shade of w.shades) {
      if (shade.state !== "drain" || !shade.targetLanternId) continue;
      if (!drainedByLantern) drainedByLantern = /* @__PURE__ */ new Map();
      drainedByLantern.set(
        shade.targetLanternId,
        (drainedByLantern.get(shade.targetLanternId) ?? 0) + DRAIN_UNITS_PER_TICK
      );
    }
    for (const lantern of w.lanterns) {
      if (!lantern.lit) continue;
      lantern.fuelUnits -= FUEL_DECAY_UNITS_PER_TICK + (drainedByLantern?.get(lantern.id) ?? 0);
    }
    if (drainedByLantern && simTick % DRAIN_EVENT_INTERVAL_TICKS === 0) {
      for (const shade of w.shades) {
        if (shade.state !== "drain" || !shade.targetLanternId) continue;
        const lantern = w.lanterns.find((l) => l.id === shade.targetLanternId);
        if (!lantern || !lantern.lit) continue;
        out.push({
          tick,
          name: "fuel_drain",
          data: { lantern_id: lantern.id, shade_id: shade.id, fuel: fuelToDisplay(lantern.fuelUnits) }
        });
      }
    }
    for (const lantern of w.lanterns) {
      if (!lantern.lit || lantern.fuelUnits > 0) continue;
      lantern.lit = false;
      lantern.fuelUnits = 0;
      lantern.deposited = 0;
      lantern.everLit = true;
      out.push({ tick, name: "lantern_out", data: { lantern_id: lantern.id } });
    }
  }
  updateWind(w, simTick);
  movePlayer(w, input, out, tick, simTick);
  if (!w.bench) pickups(w, out, tick, simTick);
  if (input.pressed.interact) interact(w, out, tick);
  updateSafeZones(w);
  if (input.pressed.pulse) pulse(w, out, tick);
  moveShades(w);
  moveDrifters(w);
  if (!w.bench) contacts(w, out, tick);
  if (!w.bench) spawns(w, out, tick, simTick);
  if (!w.bench) {
    if (p.flames <= 0) {
      finish(w, "lost", "no_flames", out, tick);
    } else if (w.timeLeftTicks <= 0) {
      const lit = w.lanterns.filter((l) => l.lit).length;
      if (lit >= dawnThreshold(w.lanterns.length)) finish(w, "won", "dawn_survived", out, tick);
      else finish(w, "lost", "dawn", out, tick);
    }
  }
  w.tick = tick;
  w.simTick = simTick;
}
function updateWind(w, simTick) {
  const schedule = w.map.wind;
  if (!w.windEnabled || !schedule || w.bench) {
    w.wind.active = false;
    w.wind.warnActive = false;
    return;
  }
  const within = simTick % schedule.periodTicks;
  const gustStart = schedule.gustOffsetTicks;
  const gustEnd = gustStart + schedule.durationTicks;
  w.wind.active = within >= gustStart && within < gustEnd;
  w.wind.warnActive = within >= gustStart - schedule.warnTicks && within < gustStart;
  const deg = windDirDeg(w.seed, Math.floor(simTick / schedule.periodTicks));
  w.wind.dirDeg = deg;
  w.wind.dirX = Math.cos(deg * DEG2);
  w.wind.dirZ = Math.sin(deg * DEG2);
  w.wind.ticksLeft = w.wind.active ? gustEnd - within : 0;
}
function canStand(w, x, z, y, maxStep) {
  const ground = groundAt(w, x, z);
  if (!Number.isFinite(ground)) return true;
  return ground <= y + maxStep;
}
function moveHorizontal(w, dx, dz, maxStep) {
  const p = w.player;
  if (canStand(w, p.x + dx, p.z + dz, p.y, maxStep)) {
    p.x += dx;
    p.z += dz;
    return;
  }
  if (canStand(w, p.x + dx, p.z, p.y, maxStep)) {
    p.x += dx;
    return;
  }
  if (canStand(w, p.x, p.z + dz, p.y, maxStep)) {
    p.z += dz;
  }
}
function movePlayer(w, input, out, tick, simTick) {
  const p = w.player;
  if (p.fallenTicks > 0) {
    p.fallenTicks -= 1;
    if (p.fallenTicks === 0) respawn(w);
    return;
  }
  if (input.pressed.dash && p.dashTicks <= 0 && p.dashCdTicks <= 0) {
    const moving = input.moveX !== 0 || input.moveZ !== 0;
    let dx = p.facingX;
    let dz = p.facingZ;
    if (moving) {
      const dir = worldDirection(input.moveX, input.moveZ, input.yawDeg);
      dx = dir.x;
      dz = dir.z;
    }
    const len = Math.hypot(dx, dz) || 1;
    p.dashX = dx / len;
    p.dashZ = dz / len;
    p.dashTicks = DASH_TICKS;
    p.dashCdTicks = p.charmTicks > 0 ? 0 : DASH_COOLDOWN_TICKS;
    out.push({ tick, name: "dash", data: {} });
  }
  if (input.pressed.jump && p.grounded && p.dashTicks <= 0) {
    p.vy = JUMP_SPEED;
    p.grounded = false;
  }
  const dashing = p.dashTicks > 0;
  if (dashing) {
    p.vx = p.dashX * TUNING.dash_speed;
    p.vz = p.dashZ * TUNING.dash_speed;
    if (!p.grounded) p.vy = 0;
  } else if (p.launching) {
    p.vx = p.launchVX;
    p.vz = p.launchVZ;
  } else {
    const dir = worldDirection(input.moveX, input.moveZ, input.yawDeg);
    const speed = p.charmTicks > 0 ? CHARM_SPEED : TUNING.player_speed;
    p.vx = dir.x * speed;
    p.vz = dir.z * speed;
    if (dir.x !== 0 || dir.z !== 0) {
      const len = Math.hypot(dir.x, dir.z);
      p.facingX = dir.x / len;
      p.facingZ = dir.z / len;
    }
  }
  if (w.wind.active && w.map.wind) {
    p.vx += w.wind.dirX * w.map.wind.pushSpeed;
    p.vz += w.wind.dirZ * w.map.wind.pushSpeed;
  }
  moveHorizontal(w, p.vx * DT, p.vz * DT, p.grounded ? STEP_HEIGHT : 0.02);
  if (!p.grounded) {
    if (!dashing) p.vy -= GRAVITY * DT;
    p.y += p.vy * DT;
  }
  resolveGround(w);
  if (dashing) p.dashTicks -= 1;
  if (p.grounded) tryJumpPad(w);
  if (p.y < FALL_KILL_Y) applyFall(w, out, tick, simTick);
}
function resolveGround(w) {
  const p = w.player;
  const ground = groundAt(w, p.x, p.z);
  if (!Number.isFinite(ground)) {
    p.grounded = false;
    return;
  }
  if (p.grounded) {
    if (ground < p.y - 0.02) {
      p.grounded = false;
      p.vy = 0;
    } else {
      p.y = ground;
    }
  } else if (p.vy <= 0 && p.y <= ground) {
    p.y = ground;
    p.vy = 0;
    p.grounded = true;
    p.launching = false;
  }
}
function tryJumpPad(w) {
  const p = w.player;
  for (const pad of w.map.pads) {
    if (Math.hypot(p.x - pad.x, p.z - pad.z) > pad.radius) continue;
    if (Math.abs(p.y - pad.y) > 0.5) continue;
    p.vy = pad.vy;
    p.launchVX = pad.dirX * pad.speed;
    p.launchVZ = pad.dirZ * pad.speed;
    p.launching = true;
    p.grounded = false;
    return;
  }
}
function applyFall(w, out, tick, simTick) {
  const p = w.player;
  const lost = p.carried;
  p.carried = 0;
  p.flames = Math.max(0, p.flames - 1);
  p.fallenTicks = FALL_RESPAWN_TICKS;
  p.dashTicks = 0;
  p.launching = false;
  p.vx = 0;
  p.vz = 0;
  void simTick;
  out.push({ tick, name: "player_hit", data: { by: "fall", flames: p.flames, dropped: 0, lost } });
}
function respawn(w) {
  const p = w.player;
  p.x = w.map.spawn.x;
  p.y = w.map.spawn.y;
  p.z = w.map.spawn.z;
  p.vx = 0;
  p.vy = 0;
  p.vz = 0;
  p.launching = false;
  p.launchVX = 0;
  p.launchVZ = 0;
  p.grounded = true;
  p.invulnTicks = INVULN_TICKS;
}
function pickups(w, out, tick, simTick) {
  const p = w.player;
  if (p.fallenTicks > 0) return;
  for (const mote of w.motes) {
    if (!mote.active) continue;
    if (p.carried >= p.capacity) break;
    if (mote.pickableFromTick > simTick) continue;
    if (distanceXZ(mote.x, mote.z, p.x, p.z) > TUNING.pickup_radius) continue;
    if (Math.abs(p.y - mote.y) > PICKUP_MAX_HEIGHT_DIFF) continue;
    mote.active = false;
    p.carried += 1;
    out.push({ tick, name: "mote_picked", data: { carried: p.carried } });
  }
  for (const charm of w.charms) {
    if (!charm.available) continue;
    if (distanceXZ(charm.x, charm.z, p.x, p.z) > TUNING.pickup_radius) continue;
    if (Math.abs(p.y - charm.y) > PICKUP_MAX_HEIGHT_DIFF) continue;
    charm.available = false;
    charm.respawnTicks = CHARM_RESPAWN_TICKS;
    p.charmTicks = CHARM_TICKS;
    out.push({ tick, name: "charm_picked", data: { charm_id: charm.id, charm_ticks: p.charmTicks } });
  }
}
function interact(w, out, tick) {
  const p = w.player;
  if (p.fallenTicks > 0 || p.carried <= 0) return;
  let best = null;
  let bestDistance = Infinity;
  for (const lantern of w.lanterns) {
    if (lantern.lit && lantern.fuelUnits >= FUEL_MAX_UNITS) continue;
    const d = distance3D(lantern.x, lantern.y, lantern.z, p.x, p.y, p.z);
    if (d > TUNING.interact_radius) continue;
    if (d < bestDistance - 1e-9) {
      best = lantern;
      bestDistance = d;
    }
  }
  if (!best) return;
  if (best.lit) {
    const used = Math.min(p.carried, Math.ceil((FUEL_MAX_UNITS - best.fuelUnits) / FUEL_PER_MOTE_UNITS));
    if (used <= 0) return;
    best.fuelUnits = Math.min(FUEL_MAX_UNITS, best.fuelUnits + used * FUEL_PER_MOTE_UNITS);
    p.carried -= used;
    w.score += used * TUNING.score.per_mote;
    out.push({
      tick,
      name: "refuel",
      data: { lantern_id: best.id, amount: used, fuel: fuelToDisplay(best.fuelUnits) }
    });
    return;
  }
  const cost = best.everLit ? TUNING.relight_cost : best.cost;
  const need = cost - best.deposited;
  const amount = Math.min(p.carried, Math.max(0, need));
  if (amount <= 0) return;
  p.carried -= amount;
  best.deposited += amount;
  w.score += amount * TUNING.score.per_mote;
  out.push({ tick, name: "deposit", data: { lantern_id: best.id, amount, deposited: best.deposited } });
  if (best.deposited >= cost) lightLantern(w, best, out, tick);
}
function lightLantern(w, lantern, out, tick) {
  const relight = lantern.everLit;
  lantern.lit = true;
  lantern.fuelUnits = FUEL_MAX_UNITS;
  lantern.deposited = 0;
  lantern.everLit = true;
  if (relight) lantern.relitCount += 1;
  w.player.successfulLights += 1;
  w.player.capacity = Math.min(
    TUNING.capacity_max,
    CAPACITY_BASE + CAPACITY_PER_LIGHT * w.player.successfulLights
  );
  w.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
  out.push({ tick, name: "lantern_lit", data: { lantern_id: lantern.id, relight } });
}
function updateSafeZones(w) {
  for (const lantern of w.lanterns) {
    if (!lantern.lit || lantern.fuelUnits < LOW_FUEL_UNITS) continue;
    for (const shade of w.shades) {
      const d = distanceXZ(shade.x, shade.z, lantern.x, lantern.z);
      if (d >= TUNING.safe_radius) continue;
      let dx = shade.x - lantern.x;
      let dz = shade.z - lantern.z;
      let len = Math.hypot(dx, dz);
      if (len < 1e-6) {
        dx = 1;
        dz = 0;
        len = 1;
      }
      shade.x = lantern.x + dx / len * TUNING.safe_radius;
      shade.z = lantern.z + dz / len * TUNING.safe_radius;
      shade.y = shadeYAt(w, shade.x, shade.z);
    }
  }
}
function pulse(w, out, tick) {
  const p = w.player;
  if (p.fallenTicks > 0) return;
  if (p.pulseCdTicks > 0) return;
  if (p.carried < TUNING.pulse_cost) return;
  p.carried -= TUNING.pulse_cost;
  p.pulseCdTicks = PULSE_COOLDOWN_TICKS;
  const cx = p.x;
  const cy = p.y + PULSE_CENTRE_HEIGHT;
  const cz = p.z;
  const stunnedIds = [];
  for (const shade of w.shades) {
    if (distance3D(shade.x, shade.y, shade.z, cx, cy, cz) > TUNING.pulse_radius) continue;
    const wasDraining = shade.state === "drain";
    shade.state = "stunned";
    shade.stateTicksLeft = PULSE_STUN_TICKS + 1;
    let dx = shade.x - cx;
    let dz = shade.z - cz;
    let len = Math.hypot(dx, dz);
    if (len < 1e-6) {
      dx = 1;
      dz = 0;
      len = 1;
    }
    shade.pushX = dx / len;
    shade.pushZ = dz / len;
    shade.pushTicksLeft = PULSE_PUSH_TICKS;
    shade.pushRemaining = TUNING.pulse_push_m;
    stunnedIds.push(shade.id);
    w.score += TUNING.score.per_stun + (wasDraining ? TUNING.score.per_stun_drain : 0);
  }
  for (const drifter of w.drifters) {
    if (drifter.state !== "chase" && drifter.state !== "flee") continue;
    if (distance3D(drifter.x, drifter.y, drifter.z, cx, cy, cz) > TUNING.pulse_radius) continue;
    if (drifter.state === "chase") {
      drifter.state = "flee";
      drifter.stateTicksLeft = DRIFTER_FLEE_TICKS;
      drifter.steals = Math.max(1, drifter.steals);
    } else if (drifter.stolen > 0) {
      dropStolen(w, drifter, out, tick);
    } else {
      drifter.state = "flee";
      drifter.stateTicksLeft = DRIFTER_VANISH_TICKS;
    }
  }
  out.push({ tick, name: "pulse", data: { stunned_ids: stunnedIds } });
}
function dropStolen(w, drifter, out, tick) {
  const amount = drifter.stolen;
  if (amount <= 0) return;
  for (let i = 0; i < amount; i += 1) {
    const angle = i / Math.max(1, amount) * Math.PI * 2;
    w.motes.push(
      makeDroppedMote(
        w,
        drifter.x + Math.cos(angle) * DROP_RING_MIN,
        drifter.y,
        drifter.z + Math.sin(angle) * DROP_RING_MIN,
        w.simTick + 2,
        DROPPED_TTL_TICKS
      )
    );
  }
  drifter.stolen = 0;
  drifter.vanishTicks = DRIFTER_VANISH_TICKS;
  out.push({ tick, name: "drifter_drop", data: { drifter_id: drifter.id, amount } });
}
function shadeCanStand(w, x, z, currentGround) {
  const ground = groundAt(w, x, z);
  if (!Number.isFinite(ground)) return false;
  return ground <= currentGround + SHADE_STEP_HEIGHT;
}
function stepShade(w, shade, dx, dz) {
  const currentGround = groundAt(w, shade.x, shade.z);
  const base = Number.isFinite(currentGround) ? currentGround : 0;
  if (shadeCanStand(w, shade.x + dx, shade.z + dz, base)) {
    shade.x += dx;
    shade.z += dz;
    return;
  }
  if (shadeCanStand(w, shade.x + dx, shade.z, base)) {
    shade.x += dx;
    return;
  }
  if (shadeCanStand(w, shade.x, shade.z + dz, base)) {
    shade.z += dz;
  }
}
function moveToward(w, shade, tx, tz, speed) {
  const dx = tx - shade.x;
  const dz = tz - shade.z;
  const len = Math.hypot(dx, dz);
  if (len <= 1e-6) return;
  stepShade(w, shade, dx / len * speed * DT, dz / len * speed * DT);
}
function chooseWanderTarget(w, shade) {
  let weak = null;
  let weakDistance = Infinity;
  let dark = null;
  let darkDistance = Infinity;
  for (const lantern of w.lanterns) {
    const distance = distanceXZ(shade.x, shade.z, lantern.x, lantern.z);
    if (lantern.lit) {
      if (lantern.fuelUnits >= LOW_FUEL_UNITS) continue;
      if (distance < weakDistance - 1e-9) {
        weak = lantern;
        weakDistance = distance;
      }
    } else if (distance < darkDistance - 1e-9) {
      dark = lantern;
      darkDistance = distance;
    }
  }
  return weak ?? dark;
}
function moveShades(w) {
  const p = w.player;
  for (const shade of w.shades) {
    if (shade.pushTicksLeft > 0 && shade.pushRemaining > 0) {
      const step = Math.min(shade.pushRemaining, TUNING.pulse_push_m / PULSE_PUSH_TICKS);
      stepShade(w, shade, shade.pushX * step, shade.pushZ * step);
      shade.pushRemaining = Math.max(0, shade.pushRemaining - step);
      shade.pushTicksLeft -= 1;
    }
    switch (shade.state) {
      case "spawning":
      case "stunned": {
        if (shade.stateTicksLeft > 0) shade.stateTicksLeft -= 1;
        if (shade.stateTicksLeft <= 0) {
          shade.state = "wander";
          shade.targetLanternId = null;
        }
        break;
      }
      case "recoil": {
        const dx = shade.x - p.x;
        const dz = shade.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const step = SHADE_RECOIL_M / SHADE_RECOIL_TICKS;
        stepShade(w, shade, dx / len * step, dz / len * step);
        if (shade.stateTicksLeft > 0) shade.stateTicksLeft -= 1;
        if (shade.stateTicksLeft <= 0) shade.state = "chase";
        break;
      }
      case "drain": {
        const lantern = shade.targetLanternId ? w.lanterns.find((l) => l.id === shade.targetLanternId) : void 0;
        const targetInvalid = !lantern || !lantern.lit || lantern.fuelUnits >= LOW_FUEL_UNITS || distanceXZ(shade.x, shade.z, lantern.x, lantern.z) > DRAIN_RANGE;
        if (targetInvalid) {
          shade.state = "wander";
          shade.targetLanternId = null;
          break;
        }
        if (distanceXZ(shade.x, shade.z, p.x, p.z) <= 6) {
          shade.state = "chase";
          shade.targetLanternId = null;
        }
        break;
      }
      case "wander":
      case "chase": {
        const distance = distanceXZ(shade.x, shade.z, p.x, p.z);
        if (distance <= SHADE_DETECT_RADIUS && !w.bench) shade.state = "chase";
        else if (shade.state === "chase" && distance > SHADE_LEAVE_RADIUS) shade.state = "wander";
        if (shade.state === "chase") {
          shade.targetLanternId = null;
          moveToward(w, shade, p.x, p.z, w.map.shadeSpeed);
          break;
        }
        const target = chooseWanderTarget(w, shade);
        if (!target) {
          moveToward(w, shade, w.map.spawn.x, w.map.spawn.z, SHADE_WANDER_SPEED);
          break;
        }
        shade.targetLanternId = target.id;
        if (distanceXZ(shade.x, shade.z, target.x, target.z) <= DRAIN_RANGE) {
          shade.state = "drain";
          break;
        }
        moveToward(w, shade, target.x, target.z, SHADE_WANDER_SPEED);
        break;
      }
      default:
        break;
    }
    shade.y = shadeYAt(w, shade.x, shade.z);
  }
}
function moveDrifters(w) {
  const p = w.player;
  for (const drifter of w.drifters) {
    if (drifter.state === "removed") continue;
    if (drifter.vanishTicks > 0) {
      drifter.vanishTicks -= 1;
      if (drifter.vanishTicks === 0) drifter.state = "removed";
    }
    switch (drifter.state) {
      case "idle": {
        const distance = distanceXZ(drifter.x, drifter.z, p.x, p.z);
        if (p.carried >= DRIFTER_CHASE_MIN_CARRY && distance <= DRIFTER_CHASE_RADIUS) {
          drifter.state = "chase";
          break;
        }
        const angle = Math.atan2(drifter.dirZ, drifter.dirX) + 2e-3;
        drifter.dirX = Math.cos(angle);
        drifter.dirZ = Math.sin(angle);
        drifter.x += drifter.dirX * DRIFTER_IDLE_SPEED * DT;
        drifter.z += drifter.dirZ * DRIFTER_IDLE_SPEED * DT;
        break;
      }
      case "chase": {
        const distance = distanceXZ(drifter.x, drifter.z, p.x, p.z);
        if (p.carried < DRIFTER_CHASE_MIN_CARRY || distance > DRIFTER_CHASE_RADIUS) {
          drifter.state = "idle";
          break;
        }
        const dx = p.x - drifter.x;
        const dz = p.z - drifter.z;
        const len = Math.hypot(dx, dz) || 1;
        drifter.dirX = dx / len;
        drifter.dirZ = dz / len;
        drifter.x += dx / len * DRIFTER_SPEED * DT;
        drifter.z += dz / len * DRIFTER_SPEED * DT;
        break;
      }
      case "flee": {
        const dx = drifter.x - p.x;
        const dz = drifter.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        drifter.dirX = dx / len;
        drifter.dirZ = dz / len;
        drifter.x += dx / len * DRIFTER_SPEED * DT;
        drifter.z += dz / len * DRIFTER_SPEED * DT;
        if (drifter.stateTicksLeft > 0) drifter.stateTicksLeft -= 1;
        if (drifter.stateTicksLeft <= 0) drifter.state = "removed";
        break;
      }
      default:
        break;
    }
    drifter.y = drifterYAt(w, drifter.x, drifter.z);
  }
  w.drifters = w.drifters.filter((d) => d.state !== "removed" || d.vanishTicks > 0);
}
function contacts(w, out, tick) {
  const p = w.player;
  if (p.fallenTicks > 0) return;
  for (const drifter of [...w.drifters].sort((a, b) => a.id < b.id ? -1 : 1)) {
    if (drifter.state !== "chase") continue;
    if (drifter.steals > 0) continue;
    if (distanceXZ(drifter.x, drifter.z, p.x, p.z) > DRIFTER_STEAL_RADIUS) continue;
    const amount = Math.min(DRIFTER_STEAL_MAX, p.carried);
    if (amount <= 0) continue;
    p.carried -= amount;
    drifter.stolen += amount;
    drifter.steals = 1;
    drifter.state = "flee";
    drifter.stateTicksLeft = DRIFTER_FLEE_TICKS;
    out.push({ tick, name: "drifter_steal", data: { drifter_id: drifter.id, amount, carried: p.carried } });
  }
  if (p.invulnTicks > 0) return;
  for (const shade of [...w.shades].sort((a, b) => a.id < b.id ? -1 : 1)) {
    if (shade.state === "spawning" || shade.state === "stunned") continue;
    if (distanceXZ(shade.x, shade.z, p.x, p.z) > TUNING.shade_hit_radius) continue;
    if (Math.abs(shade.y - p.y) > HIT_MAX_HEIGHT_DIFF) continue;
    damagePlayer(w, out, tick, shade);
    break;
  }
}
function damagePlayer(w, out, tick, shade) {
  const p = w.player;
  const dropped = Math.min(p.carried, Math.floor(p.carried * TUNING.hit_drop_ratio));
  for (let i = 0; i < dropped; i += 1) {
    const angle = w.rng.next() * Math.PI * 2;
    const radius = DROP_RING_MIN + w.rng.next() * (DROP_RING_MAX - DROP_RING_MIN);
    const x = p.x + Math.cos(angle) * radius;
    const z = p.z + Math.sin(angle) * radius;
    const ground = groundAt(w, x, z);
    w.motes.push(
      makeDroppedMote(w, x, Number.isFinite(ground) ? ground : p.y, z, w.simTick + 2, DROPPED_TTL_TICKS)
    );
  }
  p.carried -= dropped;
  p.flames = Math.max(0, p.flames - 1);
  p.invulnTicks = INVULN_TICKS;
  shade.state = "recoil";
  shade.stateTicksLeft = SHADE_RECOIL_TICKS;
  out.push({ tick, name: "player_hit", data: { by: "shade", flames: p.flames, dropped } });
}
function spawns(w, out, tick, simTick) {
  if (w.randomMotes && simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
    const occupied = new Set(w.motes.filter((m) => m.active && m.spotIndex >= 0).map((m) => m.spotIndex));
    const empty = w.map.moteSpots.map((_, i) => i).filter((i) => !occupied.has(i));
    if (empty.length > 0 && occupied.size < MOTE_CAP) {
      const spotIndex = empty[Math.floor(w.rng.next() * empty.length)];
      const spot2 = w.map.moteSpots[spotIndex];
      w.motes.push({
        id: `M${w.moteSeq}`,
        x: spot2.x,
        y: spot2.y,
        z: spot2.z,
        kind: "random",
        active: true,
        ttlTicks: 0,
        pickableFromTick: simTick + 1,
        spotIndex
      });
      w.moteSeq += 1;
    }
  }
  if (w.randomShades) {
    const schedule = w.map.shadeSchedule;
    let batch = 0;
    if (simTick === schedule.firstTick) batch = schedule.batch;
    else if (simTick > schedule.firstTick && (simTick - schedule.firstTick) % schedule.intervalTicks === 0) batch = 1;
    for (let i = 0; i < batch; i += 1) {
      if (w.shades.length >= schedule.max) break;
      const candidates = w.map.shadeSpots.filter(
        (s) => distanceXZ(s.x, s.z, w.player.x, w.player.z) >= SHADE_MIN_SPAWN_DISTANCE
      );
      if (candidates.length === 0) break;
      const spot2 = candidates[Math.floor(w.rng.next() * candidates.length)];
      const shade = spawnShadeAt(w, spot2.x, spot2.z, SHADE_SPAWNING_TICKS);
      w.shades.push(shade);
      out.push({ tick, name: "shade_spawned", data: { id: shade.id } });
    }
  }
  if (w.randomDrifters && w.map.drifters && simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0) {
    const alive = w.drifters.filter((d) => d.state !== "removed").length;
    if (alive < DRIFTER_MAX) {
      const candidates = w.map.shadeSpots.filter(
        (s) => distanceXZ(s.x, s.z, w.player.x, w.player.z) >= SHADE_MIN_SPAWN_DISTANCE
      );
      const spots = candidates.length > 0 ? candidates : w.map.shadeSpots;
      const spot2 = spots[Math.floor(w.rng.next() * spots.length)];
      const drifter = spawnDrifterAt(w, spot2.x, spot2.z);
      const angle = w.rng.next() * Math.PI * 2;
      drifter.dirX = Math.cos(angle);
      drifter.dirZ = Math.sin(angle);
      w.drifters.push(drifter);
    }
  }
}
function finish(w, state, reason, out, tick) {
  if (state === "won") {
    for (const lantern of w.lanterns) {
      if (!lantern.lit) continue;
      w.score += TUNING.score.dawn_per_lantern + Math.floor(lantern.fuelUnits / 60);
    }
    w.score += w.player.flames * TUNING.score.dawn_per_flame;
  }
  w.state = state;
  out.push({ tick, name: "game_over", data: { result: state, reason } });
}

// src/core/runner.ts
function round3(n) {
  const v = Math.round(n * 1e3) / 1e3;
  return Object.is(v, -0) ? 0 : v;
}
function snapshotLine(w, tick) {
  const p = w.player;
  return JSON.stringify({
    type: "snapshot",
    tick,
    sim_tick: w.simTick,
    state: w.paused ? "paused" : w.state,
    night: w.night,
    wind: { active: w.wind.active, dir_deg: round3(w.wind.dirDeg) },
    time_left_s: round3(timeLeftSeconds(w)),
    score: w.score,
    player: {
      pos: [round3(p.x), round3(p.y), round3(p.z)],
      vel: [round3(p.vx), round3(p.vy), round3(p.vz)],
      flames: p.flames,
      carried: p.carried,
      capacity: p.capacity,
      grounded: p.grounded,
      invuln: p.invulnTicks,
      dash_cd_s: round3(p.dashCdTicks / TICKS_PER_SECOND),
      pulse_cd_s: round3(p.pulseCdTicks / TICKS_PER_SECOND),
      charm_s: round3(p.charmTicks / TICKS_PER_SECOND)
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id,
      pos: [round3(l.x), round3(l.y), round3(l.z)],
      lit: l.lit,
      deposited: l.deposited,
      fuel: fuelToDisplay(l.fuelUnits),
      ever_lit: l.everLit,
      relit_count: l.relitCount
    })),
    shades: w.shades.map((s) => ({
      id: s.id,
      pos: [round3(s.x), round3(s.y), round3(s.z)],
      state: s.state,
      target_lantern_id: s.targetLanternId
    })),
    drifters: w.drifters.map((d) => ({
      id: d.id,
      pos: [round3(d.x), round3(d.y), round3(d.z)],
      state: d.state,
      stolen: d.stolen
    })),
    charms: w.charms.map((c) => ({
      id: c.id,
      pos: [round3(c.x), round3(c.y), round3(c.z)],
      available: c.available,
      respawn_s: round3(c.respawnTicks / TICKS_PER_SECOND)
    })),
    motes: w.motes.filter((m) => m.active).map((m) => ({
      id: m.id,
      pos: [round3(m.x), round3(m.y), round3(m.z)],
      kind: m.kind,
      ttl_s: m.ttlTicks > 0 ? round3(m.ttlTicks / TICKS_PER_SECOND) : null
    })),
    motes_active: activeMoteCount(w)
  });
}
function runSimulation(opts) {
  const w = createWorld(opts.seed, opts.night, opts.scenario ?? null);
  const timeline = new InputTimeline(opts.inputsFrames ?? []);
  const lines = [];
  const events = [];
  let steps = 0;
  lines.push(snapshotLine(w, 0));
  for (let k = 0; k < opts.ticks; k += 1) {
    if (w.state !== "playing") break;
    events.length = 0;
    stepWorld(w, timeline.at(k), events);
    steps = k + 1;
    for (const ev of events) {
      lines.push(JSON.stringify({ type: "event", tick: ev.tick, name: ev.name, data: ev.data }));
    }
    if (steps % opts.snapshotEvery === 0) lines.push(snapshotLine(w, steps));
  }
  lines.push(JSON.stringify({ type: "end", ticks: steps, state: w.state, score: w.score }));
  return {
    lines,
    finalState: w.state,
    steps,
    simSteps: w.simTick,
    score: w.score,
    world: w
  };
}

// src/headless/main.ts
var UsageError = class extends Error {
};
function parseInteger(raw, flag) {
  if (!/^-?\d+$/.test(raw.trim())) throw new UsageError(`${flag} expects an integer, got "${raw}"`);
  return Number.parseInt(raw, 10);
}
function parseArgs(argv) {
  const args = {
    seed: 0,
    night: 1,
    ticks: null,
    out: null,
    scenario: null,
    inputs: null,
    snapshotEvery: 10
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const takeValue = () => {
      i += 1;
      const v = argv[i];
      if (v === void 0) throw new UsageError(`missing value for ${flag}`);
      return v;
    };
    switch (flag) {
      case "--seed":
        args.seed = parseInteger(takeValue(), "--seed");
        break;
      case "--night":
        args.night = parseInteger(takeValue(), "--night");
        break;
      case "--ticks":
        args.ticks = parseInteger(takeValue(), "--ticks");
        break;
      case "--out":
        args.out = takeValue();
        break;
      case "--scenario":
        args.scenario = takeValue();
        break;
      case "--inputs":
        args.inputs = takeValue();
        break;
      case "--snapshot-every":
        args.snapshotEvery = parseInteger(takeValue(), "--snapshot-every");
        break;
      default:
        break;
    }
  }
  if (args.ticks === null) throw new UsageError("--ticks is required");
  if (args.out === null) throw new UsageError("--out is required");
  if (args.ticks < 0) throw new UsageError("--ticks must be >= 0");
  if (args.snapshotEvery < 1) throw new UsageError("--snapshot-every must be >= 1");
  if (args.night !== 1 && args.night !== 2 && args.night !== 3) {
    throw new UsageError(`unsupported --night ${args.night} (contract v1.1 ships nights 1, 2 and 3)`);
  }
  if (args.seed < 0) throw new UsageError("--seed must be >= 0");
  return {
    seed: args.seed,
    night: args.night,
    ticks: args.ticks,
    out: args.out,
    scenario: args.scenario,
    inputs: args.inputs,
    snapshotEvery: args.snapshotEvery
  };
}
function readJson(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(`cannot read ${path}`);
  }
  text = text.replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new ContractFormatError(`${path} is not valid JSON`);
  }
}
function loadScenario(path) {
  if (!path) return null;
  return parseScenario(readJson(resolve(path)));
}
function loadInputs(path) {
  if (!path) return null;
  return parseInputs(readJson(resolve(path)));
}
function main(argv) {
  let args;
  let scenario;
  let inputs;
  try {
    args = parseArgs(argv);
    scenario = loadScenario(args.scenario);
    inputs = loadInputs(args.inputs);
  } catch (err) {
    if (err instanceof ContractFormatError) {
      process.stderr.write(`format error: ${err.message}
`);
      return 2;
    }
    process.stderr.write(`error: ${err.message}
`);
    return 1;
  }
  const result = runSimulation({
    seed: args.seed,
    night: args.night,
    ticks: args.ticks,
    snapshotEvery: args.snapshotEvery,
    scenario,
    inputsFrames: inputs?.frames ?? []
  });
  const outPath = resolve(args.out);
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${result.lines.join("\n")}
`, "utf8");
  } catch (err) {
    process.stderr.write(`error: cannot write ${outPath}: ${err.message}
`);
    return 1;
  }
  return 0;
}
process.exit(main(process.argv.slice(2)));
