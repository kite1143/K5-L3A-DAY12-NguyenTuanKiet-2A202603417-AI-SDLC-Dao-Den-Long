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
  if (!Number.isInteger(n) || n < 0) {
    throw new ContractFormatError(`${where} must be a non-negative integer`);
  }
  return n;
}
function vec3(v, where) {
  if (!Array.isArray(v) || v.length !== 3) {
    throw new ContractFormatError(`${where} must be an array of 3 numbers`);
  }
  return [num(v[0], `${where}[0]`), num(v[1], `${where}[1]`), num(v[2], `${where}[2]`)];
}
function bool(v, where) {
  if (typeof v !== "boolean") {
    throw new ContractFormatError(`${where} must be a boolean`);
  }
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
    out.player = p;
  }
  if (raw.random_motes !== void 0) out.random_motes = bool(raw.random_motes, "random_motes");
  if (raw.random_shades !== void 0) out.random_shades = bool(raw.random_shades, "random_shades");
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
      return shade;
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
    if (tick <= lastTick) {
      throw new ContractFormatError("frames[].tick must increase strictly");
    }
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
    return frame;
  });
  return { frames };
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
  constructor(frames = []) {
    this.frames = frames;
  }
  /** Resolved input for `tick` (the tick whose state is read by that step). */
  at(tick) {
    const prevJump = this.jump;
    const prevInteract = this.interact;
    const prevPulse = this.pulse;
    while (this.index < this.frames.length && this.frames[this.index].tick <= tick) {
      const f = this.frames[this.index];
      this.index += 1;
      if (f.moveX !== void 0) this.moveX = f.moveX;
      if (f.moveZ !== void 0) this.moveZ = f.moveZ;
      if (f.yawDeg !== void 0) this.yawDeg = f.yawDeg;
      if (f.jump !== void 0) this.jump = f.jump;
      if (f.interact !== void 0) this.interact = f.interact;
      if (f.pulse !== void 0) this.pulse = f.pulse;
    }
    return {
      moveX: this.moveX,
      moveZ: this.moveZ,
      yawDeg: this.yawDeg,
      pressed: {
        jump: this.jump && !prevJump,
        interact: this.interact && !prevInteract,
        pulse: this.pulse && !prevPulse
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

// src/core/config.ts
var DT = 1 / 60;
var TUNING = {
  player_speed: 5,
  carry_capacity: 3,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  /** Phase 1: pulsing costs no motes (the cost is the cooldown). See README. */
  pulse_cost: 0,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 3,
  pulse_cooldown_s: 1.5,
  safe_radius: 3,
  shade_speed: 2.6,
  shade_hit_radius: 1,
  /** Phase 1: the shore is a soft wall, the player cannot fall off. */
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50
  }
};
var ISLAND_RADIUS = 26;
var EDGE_LIMIT = ISLAND_RADIUS - 0.6;
var JUMP_SPEED = 6.2;
var GRAVITY = 22;
var SHADE_Y = 1;
var DEFAULT_MOTES = 30;
var SHADE_MAX = 4;
var SHADE_FIRST_SPAWN_TICKS = 360;
var SHADE_SPAWN_INTERVAL_TICKS = 600;
var LANTERN_LAYOUT = [
  { id: "L1", x: 0, z: 17 },
  { id: "L2", x: -16.169, z: 5.253 },
  { id: "L3", x: -9.992, z: -13.755 },
  { id: "L4", x: 9.992, z: -13.755 },
  { id: "L5", x: 16.169, z: 5.253 }
];

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
function randRange(rng, min, max) {
  return min + (max - min) * rng.next();
}

// src/core/world.ts
function scatterMotes(w, count, startSeq) {
  const motes = [];
  for (let i = 0; i < count; i += 1) {
    const angle = randRange(w.rng, 0, Math.PI * 2);
    const radius = Math.sqrt(randRange(w.rng, 16, (ISLAND_RADIUS - 3) * (ISLAND_RADIUS - 3)));
    motes.push({
      id: `M${startSeq + i}`,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      active: true
    });
  }
  return motes;
}
function nextShadeSeq(ids) {
  let max = 0;
  for (const id of ids) {
    const m = /^S(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}
function createWorld(seed, scenario = null) {
  const w = {
    seed,
    night: 1,
    rng: makeRng(seed),
    tick: 0,
    state: "playing",
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
      pulseCooldownTicks: 0
    },
    lanterns: LANTERN_LAYOUT.map((l) => ({
      id: l.id,
      x: l.x,
      z: l.z,
      cost: TUNING.lantern_cost,
      deposited: 0,
      lit: false
    })),
    motes: [],
    shades: [],
    randomMotes: scenario?.random_motes !== false,
    randomShades: scenario?.random_shades !== false,
    moteSeq: 1,
    shadeSeq: 1,
    spawnTimerTicks: SHADE_FIRST_SPAWN_TICKS
  };
  if (scenario) {
    if (scenario.time_left_s !== void 0) {
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
      if (p.carried !== void 0) w.player.carried = p.carried;
      if (p.flames !== void 0) w.player.flames = p.flames;
    }
    if (scenario.lanterns) {
      for (const upd of scenario.lanterns) {
        const target = w.lanterns.find((l) => l.id === upd.id);
        if (!target) continue;
        if (upd.pos) {
          target.x = upd.pos[0];
          target.z = upd.pos[2];
        }
        if (upd.deposited !== void 0) target.deposited = upd.deposited;
        if (upd.lit !== void 0) target.lit = upd.lit;
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
        state: "chase",
        stunTicks: 0
      }));
      w.shadeSeq = nextShadeSeq(w.shades.map((s) => s.id));
    }
  } else if (w.randomMotes) {
    w.motes = scatterMotes(w, DEFAULT_MOTES, w.moteSeq);
    w.moteSeq += w.motes.length;
  }
  return w;
}
function distanceXZ(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
function timeLeftSeconds(w) {
  return w.timeLeftTicks / 60;
}
function activeMoteCount(w) {
  let n = 0;
  for (const m of w.motes) if (m.active) n += 1;
  return n;
}

// src/core/step.ts
function stepWorld(w, input, out) {
  if (w.state !== "playing") return;
  const t = TUNING;
  const p = w.player;
  const tick = w.tick + 1;
  if (input.pressed.jump && p.onGround) {
    p.vy = JUMP_SPEED;
    p.onGround = false;
  }
  if (input.pressed.pulse && p.pulseCooldownTicks <= 0) {
    applyPulse(w, out, tick);
  }
  if (input.pressed.interact) {
    applyInteract(w, out, tick);
  }
  const dir = worldDirection(input.moveX, input.moveZ, input.yawDeg);
  p.x += dir.x * t.player_speed * DT;
  p.z += dir.z * t.player_speed * DT;
  if (!p.onGround) {
    p.vy -= GRAVITY * DT;
    p.y += p.vy * DT;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  if (!t.fall_enabled) {
    const r = Math.hypot(p.x, p.z);
    if (r > EDGE_LIMIT) {
      const k = EDGE_LIMIT / r;
      p.x *= k;
      p.z *= k;
    }
  }
  collectMotes(w, out, tick);
  if (p.invulnTicks > 0) p.invulnTicks -= 1;
  if (p.pulseCooldownTicks > 0) p.pulseCooldownTicks -= 1;
  for (const s of w.shades) {
    if (s.stunTicks > 0) {
      s.stunTicks -= 1;
      if (s.stunTicks === 0) s.state = "chase";
    }
  }
  moveShades(w);
  if (p.invulnTicks <= 0) {
    for (const s of w.shades) {
      if (distanceXZ(s.x, s.z, p.x, p.z) <= t.shade_hit_radius) {
        damagePlayer(w, "shade", out, tick);
        break;
      }
    }
  }
  updateShadeSpawn(w, out, tick);
  w.timeLeftTicks = Math.max(0, w.timeLeftTicks - 1);
  w.tick = tick;
  if (w.lanterns.every((l) => l.lit)) {
    finish(w, "won", "all_lit", out, tick);
  } else if (p.flames <= 0) {
    finish(w, "lost", "no_flames", out, tick);
  } else if (w.timeLeftTicks <= 0) {
    finish(w, "lost", "dawn", out, tick);
  }
}
function collectMotes(w, out, tick) {
  const t = TUNING;
  const p = w.player;
  for (const m of w.motes) {
    if (!m.active) continue;
    if (p.carried >= t.carry_capacity) break;
    if (distanceXZ(m.x, m.z, p.x, p.z) <= t.pickup_radius) {
      m.active = false;
      p.carried += 1;
      w.score += t.score.per_mote;
      out.push({ tick, name: "mote_picked", data: { carried: p.carried } });
    }
  }
}
function applyInteract(w, out, tick) {
  const t = TUNING;
  const p = w.player;
  if (p.carried <= 0) return;
  let best = null;
  let bestDist = Infinity;
  for (const l of w.lanterns) {
    if (l.lit) continue;
    const d = distanceXZ(l.x, l.z, p.x, p.z);
    if (d <= t.interact_radius && d < bestDist) {
      best = l;
      bestDist = d;
    }
  }
  if (!best) return;
  const need = best.cost - best.deposited;
  if (need <= 0) {
    lightLantern(w, best, out, tick);
    return;
  }
  const amount = Math.min(p.carried, need);
  p.carried -= amount;
  best.deposited += amount;
  out.push({ tick, name: "deposit", data: { lantern_id: best.id, amount, deposited: best.deposited } });
  if (best.deposited >= best.cost) lightLantern(w, best, out, tick);
}
function lightLantern(w, lantern, out, tick) {
  if (lantern.lit) return;
  lantern.lit = true;
  w.score += TUNING.score.per_lantern;
  out.push({ tick, name: "lantern_lit", data: { lantern_id: lantern.id } });
}
function applyPulse(w, out, tick) {
  const t = TUNING;
  const p = w.player;
  if (t.pulse_cost > 0 && p.carried < t.pulse_cost) return;
  const stunnedIds = [];
  for (const s of w.shades) {
    if (distanceXZ(s.x, s.z, p.x, p.z) > t.pulse_radius) continue;
    s.state = "stunned";
    s.stunTicks = Math.round(t.pulse_stun_s * 60);
    pushAway(p.x, p.z, s, t.pulse_push_m);
    stunnedIds.push(s.id);
  }
  p.carried -= t.pulse_cost;
  if (stunnedIds.length > 0) w.score += t.score.per_stun * stunnedIds.length;
  p.pulseCooldownTicks = Math.round(t.pulse_cooldown_s * 60);
  out.push({ tick, name: "pulse", data: { stunned_ids: stunnedIds } });
  resolveSafeZones(w);
}
function pushAway(fromX, fromZ, shade, dist) {
  let dx = shade.x - fromX;
  let dz = shade.z - fromZ;
  let d = Math.hypot(dx, dz);
  if (d < 1e-6) {
    dx = 1;
    dz = 0;
    d = 1;
  }
  shade.x += dx / d * dist;
  shade.z += dz / d * dist;
}
function moveShades(w) {
  const t = TUNING;
  const p = w.player;
  const stepLen = t.shade_speed * DT;
  for (const s of w.shades) {
    if (s.state === "stunned") continue;
    const dx = p.x - s.x;
    const dz = p.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) continue;
    if (stepLen >= d) {
      s.x = p.x;
      s.z = p.z;
    } else {
      s.x += dx / d * stepLen;
      s.z += dz / d * stepLen;
    }
    s.y = SHADE_Y;
  }
  resolveSafeZones(w);
}
function resolveSafeZones(w) {
  const r = TUNING.safe_radius;
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    for (const s of w.shades) {
      if (distanceXZ(s.x, s.z, l.x, l.z) >= r) continue;
      let dx = s.x - l.x;
      let dz = s.z - l.z;
      let d = Math.hypot(dx, dz);
      if (d < 1e-6) {
        dx = 1;
        dz = 0;
        d = 1;
      }
      s.x = l.x + dx / d * r;
      s.z = l.z + dz / d * r;
    }
  }
}
function damagePlayer(w, by, out, tick) {
  const t = TUNING;
  const p = w.player;
  const dropped = Math.min(p.carried, Math.floor(p.carried * t.hit_drop_ratio + 1e-9));
  p.carried -= dropped;
  p.flames = Math.max(0, p.flames - 1);
  p.invulnTicks = Math.round(t.invuln_s * 60);
  out.push({ tick, name: "player_hit", data: { by, flames: p.flames, dropped } });
}
function updateShadeSpawn(w, out, tick) {
  if (!w.randomShades) return;
  if (w.spawnTimerTicks > 0) w.spawnTimerTicks -= 1;
  if (w.spawnTimerTicks > 0) return;
  if (w.shades.length >= SHADE_MAX) return;
  const angle = randRange(w.rng, 0, Math.PI * 2);
  const radius = ISLAND_RADIUS - 2;
  const id = `S${w.shadeSeq}`;
  w.shadeSeq += 1;
  w.shades.push({
    id,
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    y: SHADE_Y,
    state: "chase",
    stunTicks: 0
  });
  w.spawnTimerTicks = SHADE_SPAWN_INTERVAL_TICKS;
  out.push({ tick, name: "shade_spawned", data: { id } });
}
function finish(w, state, reason, out, tick) {
  if (state === "won") {
    w.score += Math.floor(timeLeftSeconds(w)) * TUNING.score.per_second_left + w.player.flames * TUNING.score.per_flame_left;
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
  return JSON.stringify({
    type: "snapshot",
    tick,
    sim_tick: tick,
    state: w.state,
    time_left_s: round3(timeLeftSeconds(w)),
    score: w.score,
    player: {
      pos: [round3(w.player.x), round3(w.player.y), round3(w.player.z)],
      flames: w.player.flames,
      carried: w.player.carried
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id,
      pos: [round3(l.x), 0, round3(l.z)],
      lit: l.lit,
      deposited: l.deposited
    })),
    shades: w.shades.map((s) => ({
      id: s.id,
      pos: [round3(s.x), round3(s.y), round3(s.z)],
      state: s.state
    })),
    motes_active: activeMoteCount(w),
    motes: w.motes.filter((m) => m.active).map((m) => ({ id: m.id, pos: [round3(m.x), 0, round3(m.z)] }))
  });
}
function runSimulation(opts) {
  const w = createWorld(opts.seed, opts.scenario ?? null);
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
  return { lines, finalState: w.state, steps, score: w.score, world: w };
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
  if (args.night !== 1) throw new UsageError(`unsupported --night ${args.night} (Phase 1 ships night 1 only)`);
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
