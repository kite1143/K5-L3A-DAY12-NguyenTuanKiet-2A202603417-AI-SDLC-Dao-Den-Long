import {
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  CHARM_TICKS,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  DRIFTER_CHASE_MIN_CARRY,
  DRIFTER_CHASE_RADIUS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_SPEED,
  DRIFTER_STEAL_MAX,
  DRIFTER_STEAL_RADIUS,
  DRIFTER_VANISH_TICKS,
  DROPPED_TTL_TICKS,
  DROP_RING_MAX,
  DROP_RING_MIN,
  DT,
  FALL_KILL_Y,
  FALL_RESPAWN_TICKS,
  GRAVITY,
  HIT_MAX_HEIGHT_DIFF,
  INVULN_TICKS,
  JUMP_SPEED,
  MOTE_CAP,
  MOTE_SPAWN_INTERVAL_TICKS,
  PICKUP_MAX_HEIGHT_DIFF,
  PULSE_CENTRE_HEIGHT,
  PULSE_COOLDOWN_TICKS,
  PULSE_PUSH_TICKS,
  PULSE_STUN_TICKS,
  SHADE_DETECT_RADIUS,
  SHADE_LEAVE_RADIUS,
  SHADE_MIN_SPAWN_DISTANCE,
  SHADE_RECOIL_M,
  SHADE_RECOIL_TICKS,
  SHADE_SPAWNING_TICKS,
  SHADE_STEP_HEIGHT,
  SHADE_WANDER_SPEED,
  STEP_HEIGHT,
  TICKS_PER_SECOND,
  TUNING,
} from './config';
import { worldDirection } from './inputs';
import { groundAt, makeDroppedMote, shadeYAt, drifterYAt, spawnDrifterAt, spawnShadeAt, distance3D, distanceXZ } from './world';
import type { Drifter, Lantern, ResolvedInput, Shade, SimEvent, World } from './types';

const DEG = Math.PI / 180;

/** Deterministic wind direction for a given night cycle (does not touch the RNG stream). */
function windDirDeg(seed: number, cycle: number): number {
  let h = (seed ^ Math.imul(cycle + 1, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 3600) / 10;
}

/**
 * One gameplay step, following Ticket-02's mandatory tick order:
 * pause → timers → move+fall → pickups → lanterns → safe zones → pulse →
 * shades+drifters → contacts → spawns → end check.
 */
export function stepWorld(w: World, input: ResolvedInput, out: SimEvent[]): void {
  const tick = w.tick + 1;

  // 1. Input, pause first.
  if (input.pressed.pause) {
    if (!w.paused) {
      w.paused = true;
      w.tick = tick;
      out.push({ tick, name: 'paused', data: {} });
      return;
    }
    w.paused = false;
    out.push({ tick, name: 'resumed', data: {} });
  }
  if (w.paused) {
    // Tick advances, the simulation does not.
    w.tick = tick;
    return;
  }
  if (w.state !== 'playing') {
    w.tick = tick;
    return;
  }

  const simTick = w.simTick + 1;
  if (simTick === 1) out.push({ tick, name: 'night_start', data: { night: w.night } });

  // 2. Counters.
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
  updateWind(w, simTick);

  // 3. Move the player, then check the fall.
  movePlayer(w, input, out, tick, simTick);

  // 4. Pick up motes and charms.
  pickups(w, out, tick, simTick);

  // 5. Lanterns.
  if (input.pressed.interact) interact(w, out, tick);

  // 6. Safe zones around lit lanterns.
  updateSafeZones(w);

  // 7. Light pulse.
  if (input.pressed.pulse) pulse(w, out, tick);

  // 8. Shades and drifters move.
  moveShades(w);
  moveDrifters(w);

  // 9. Contacts: a drifter steals first, then at most one shade hit.
  contacts(w, out, tick);

  // 10. Spawns (new entities can only be touched from the next tick).
  spawns(w, out, tick, simTick);

  // 11. End of night.
  if (p.flames <= 0) {
    finish(w, 'lost', 'no_flames', out, tick);
  } else if (w.lanterns.length > 0 && w.lanterns.every((l) => l.lit)) {
    finish(w, 'won', 'all_lit', out, tick);
  } else if (w.timeLeftTicks <= 0) {
    finish(w, 'lost', 'dawn', out, tick);
  }

  w.tick = tick;
  w.simTick = simTick;
}

function updateWind(w: World, simTick: number): void {
  const schedule = w.map.wind;
  if (!w.windEnabled || !schedule) {
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
  w.wind.dirX = Math.cos(deg * DEG);
  w.wind.dirZ = Math.sin(deg * DEG);
  w.wind.ticksLeft = w.wind.active ? gustEnd - within : 0;
}

// --- movement --------------------------------------------------------------

function canStand(w: World, x: number, z: number, y: number, maxStep: number): boolean {
  const ground = groundAt(w, x, z);
  if (!Number.isFinite(ground)) return true; // over the void: allowed, you fall
  return ground <= y + maxStep;
}

function moveHorizontal(w: World, dx: number, dz: number, maxStep: number): void {
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

function movePlayer(w: World, input: ResolvedInput, out: SimEvent[], tick: number, simTick: number): void {
  const p = w.player;

  // Waiting out a fall: no control, no contact, keep falling until respawn.
  if (p.fallenTicks > 0) {
    p.fallenTicks -= 1;
    if (p.fallenTicks === 0) respawn(w);
    return;
  }

  // Dash starts (and is ignored while another dash is running).
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
    // The charm removes the cooldown; the duration never changes.
    p.dashCdTicks = p.charmTicks > 0 ? 0 : DASH_COOLDOWN_TICKS;
    out.push({ tick, name: 'dash', data: {} });
  }

  if (input.pressed.jump && p.grounded && p.dashTicks <= 0) {
    p.vy = JUMP_SPEED;
    p.grounded = false;
  }

  const dashing = p.dashTicks > 0;
  if (dashing) {
    p.vx = p.dashX * TUNING.dash_speed;
    p.vz = p.dashZ * TUNING.dash_speed;
    if (!p.grounded) p.vy = 0; // dashing in the air keeps the same altitude
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

function resolveGround(w: World): void {
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

function tryJumpPad(w: World): void {
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

function applyFall(w: World, out: SimEvent[], tick: number, simTick: number): void {
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
  out.push({ tick, name: 'player_hit', data: { by: 'fall', flames: p.flames, dropped: 0, lost } });
}

function respawn(w: World): void {
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

// --- pickups ---------------------------------------------------------------

function pickups(w: World, out: SimEvent[], tick: number, simTick: number): void {
  const p = w.player;
  if (p.fallenTicks > 0) return;

  for (const mote of w.motes) {
    if (!mote.active) continue;
    if (p.carried >= TUNING.carry_capacity) break;
    if (mote.pickableFromTick > simTick) continue;
    if (distanceXZ(mote.x, mote.z, p.x, p.z) > TUNING.pickup_radius) continue;
    if (Math.abs(p.y - mote.y) > PICKUP_MAX_HEIGHT_DIFF) continue;
    mote.active = false;
    p.carried += 1;
    out.push({ tick, name: 'mote_picked', data: { carried: p.carried } });
  }

  for (const charm of w.charms) {
    if (!charm.available) continue;
    if (distanceXZ(charm.x, charm.z, p.x, p.z) > TUNING.pickup_radius) continue;
    if (Math.abs(p.y - charm.y) > PICKUP_MAX_HEIGHT_DIFF) continue;
    charm.available = false;
    charm.respawnTicks = CHARM_RESPAWN_TICKS;
    p.charmTicks = CHARM_TICKS;
    out.push({ tick, name: 'charm_picked', data: { charm_id: charm.id, charm_ticks: p.charmTicks } });
  }
}

// --- lanterns --------------------------------------------------------------

function interact(w: World, out: SimEvent[], tick: number): void {
  const p = w.player;
  if (p.fallenTicks > 0 || p.carried <= 0) return;

  let best: Lantern | null = null;
  let bestDistance = Infinity;
  for (const lantern of w.lanterns) {
    if (lantern.lit) continue;
    const d = distance3D(lantern.x, lantern.y, lantern.z, p.x, p.y, p.z);
    if (d > TUNING.interact_radius) continue;
    if (d < bestDistance - 1e-9) {
      best = lantern;
      bestDistance = d;
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
  w.score += amount * TUNING.score.per_mote;
  out.push({ tick, name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
  if (best.deposited >= best.cost) lightLantern(w, best, out, tick);
}

function lightLantern(w: World, lantern: Lantern, out: SimEvent[], tick: number): void {
  if (lantern.lit) return;
  lantern.lit = true;
  w.score += TUNING.score.per_lantern;
  out.push({ tick, name: 'lantern_lit', data: { lantern_id: lantern.id } });
}

// --- safe zones ------------------------------------------------------------

function updateSafeZones(w: World): void {
  for (const lantern of w.lanterns) {
    if (!lantern.lit) continue;
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
      shade.x = lantern.x + (dx / len) * TUNING.safe_radius;
      shade.z = lantern.z + (dz / len) * TUNING.safe_radius;
      shade.y = shadeYAt(w, shade.x, shade.z);
    }
  }
}

// --- pulse -----------------------------------------------------------------

function pulse(w: World, out: SimEvent[], tick: number): void {
  const p = w.player;
  if (p.fallenTicks > 0) return;
  if (p.pulseCdTicks > 0) return;
  if (p.carried < TUNING.pulse_cost) return;

  p.carried -= TUNING.pulse_cost;
  p.pulseCdTicks = PULSE_COOLDOWN_TICKS;

  const cx = p.x;
  const cy = p.y + PULSE_CENTRE_HEIGHT;
  const cz = p.z;
  const stunnedIds: string[] = [];

  for (const shade of w.shades) {
    if (distance3D(shade.x, shade.y, shade.z, cx, cy, cz) > TUNING.pulse_radius) continue;
    shade.state = 'stunned';
    // +1 because the movement phase later in this same tick already decrements
    // the counter: the stun has to last 120 full ticks, starting now.
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
  }

  for (const drifter of w.drifters) {
    if (drifter.state !== 'chase' && drifter.state !== 'flee') continue;
    if (distance3D(drifter.x, drifter.y, drifter.z, cx, cy, cz) > TUNING.pulse_radius) continue;
    if (drifter.state === 'chase') {
      drifter.state = 'flee';
      drifter.stateTicksLeft = DRIFTER_FLEE_TICKS;
      drifter.steals = Math.max(1, drifter.steals);
    } else if (drifter.stolen > 0) {
      dropStolen(w, drifter, out, tick);
    } else {
      drifter.state = 'flee';
      drifter.stateTicksLeft = DRIFTER_VANISH_TICKS;
    }
  }

  w.score += TUNING.score.per_stun * stunnedIds.length;
  out.push({ tick, name: 'pulse', data: { stunned_ids: stunnedIds } });
}

function dropStolen(w: World, drifter: Drifter, out: SimEvent[], tick: number): void {
  const amount = drifter.stolen;
  if (amount <= 0) return;
  for (let i = 0; i < amount; i += 1) {
    const angle = (i / Math.max(1, amount)) * Math.PI * 2;
    w.motes.push(
      makeDroppedMote(
        w,
        drifter.x + Math.cos(angle) * DROP_RING_MIN,
        drifter.y,
        drifter.z + Math.sin(angle) * DROP_RING_MIN,
        w.simTick + 2,
        DROPPED_TTL_TICKS,
      ),
    );
  }
  drifter.stolen = 0;
  drifter.vanishTicks = DRIFTER_VANISH_TICKS;
  out.push({ tick, name: 'drifter_drop', data: { drifter_id: drifter.id, amount } });
}

// --- motion ----------------------------------------------------------------

function shadeCanStand(w: World, x: number, z: number, currentGround: number): boolean {
  const ground = groundAt(w, x, z);
  if (!Number.isFinite(ground)) return false;
  return ground <= currentGround + SHADE_STEP_HEIGHT;
}

function stepShade(w: World, shade: Shade, dx: number, dz: number): void {
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

function moveShades(w: World): void {
  const p = w.player;
  for (const shade of w.shades) {
    // Pulse push runs during the first ticks of the stun.
    if (shade.pushTicksLeft > 0 && shade.pushRemaining > 0) {
      const step = Math.min(shade.pushRemaining, TUNING.pulse_push_m / PULSE_PUSH_TICKS);
      stepShade(w, shade, shade.pushX * step, shade.pushZ * step);
      shade.pushRemaining = Math.max(0, shade.pushRemaining - step);
      shade.pushTicksLeft -= 1;
    }

    switch (shade.state) {
      case 'spawning':
      case 'stunned': {
        if (shade.stateTicksLeft > 0) shade.stateTicksLeft -= 1;
        if (shade.stateTicksLeft <= 0) shade.state = 'wander';
        break;
      }
      case 'recoil': {
        const dx = shade.x - p.x;
        const dz = shade.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const step = SHADE_RECOIL_M / SHADE_RECOIL_TICKS;
        stepShade(w, shade, (dx / len) * step, (dz / len) * step);
        if (shade.stateTicksLeft > 0) shade.stateTicksLeft -= 1;
        if (shade.stateTicksLeft <= 0) shade.state = 'chase';
        break;
      }
      case 'wander':
      case 'chase': {
        const distance = distanceXZ(shade.x, shade.z, p.x, p.z);
        if (distance <= SHADE_DETECT_RADIUS) shade.state = 'chase';
        else if (distance > SHADE_LEAVE_RADIUS) shade.state = 'wander';

        const chasing = shade.state === 'chase';
        const speed = chasing ? w.map.shadeSpeed : SHADE_WANDER_SPEED;
        const targetX = chasing ? p.x : w.map.spawn.x;
        const targetZ = chasing ? p.z : w.map.spawn.z;
        const dx = targetX - shade.x;
        const dz = targetZ - shade.z;
        const len = Math.hypot(dx, dz);
        if (len > 1e-6) stepShade(w, shade, (dx / len) * speed * DT, (dz / len) * speed * DT);
        break;
      }
    }
    shade.y = shadeYAt(w, shade.x, shade.z);
  }
}

function moveDrifters(w: World): void {
  const p = w.player;
  for (const drifter of w.drifters) {
    if (drifter.state === 'removed') continue;

    if (drifter.vanishTicks > 0) {
      drifter.vanishTicks -= 1;
      if (drifter.vanishTicks === 0) drifter.state = 'removed';
    }

    switch (drifter.state) {
      case 'idle': {
        const distance = distanceXZ(drifter.x, drifter.z, p.x, p.z);
        if (p.carried >= DRIFTER_CHASE_MIN_CARRY && distance <= DRIFTER_CHASE_RADIUS) {
          drifter.state = 'chase';
          break;
        }
        // Slow circling drift.
        const angle = Math.atan2(drifter.dirZ, drifter.dirX) + 0.002;
        drifter.dirX = Math.cos(angle);
        drifter.dirZ = Math.sin(angle);
        drifter.x += drifter.dirX * DRIFTER_IDLE_SPEED * DT;
        drifter.z += drifter.dirZ * DRIFTER_IDLE_SPEED * DT;
        break;
      }
      case 'chase': {
        const distance = distanceXZ(drifter.x, drifter.z, p.x, p.z);
        if (p.carried < DRIFTER_CHASE_MIN_CARRY || distance > DRIFTER_CHASE_RADIUS) {
          drifter.state = 'idle';
          break;
        }
        const dx = p.x - drifter.x;
        const dz = p.z - drifter.z;
        const len = Math.hypot(dx, dz) || 1;
        drifter.dirX = dx / len;
        drifter.dirZ = dz / len;
        drifter.x += (dx / len) * DRIFTER_SPEED * DT;
        drifter.z += (dz / len) * DRIFTER_SPEED * DT;
        break;
      }
      case 'flee': {
        const dx = drifter.x - p.x;
        const dz = drifter.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        drifter.dirX = dx / len;
        drifter.dirZ = dz / len;
        drifter.x += (dx / len) * DRIFTER_SPEED * DT;
        drifter.z += (dz / len) * DRIFTER_SPEED * DT;
        if (drifter.stateTicksLeft > 0) drifter.stateTicksLeft -= 1;
        if (drifter.stateTicksLeft <= 0) drifter.state = 'removed';
        break;
      }
      default:
        break;
    }
    drifter.y = drifterYAt(w, drifter.x, drifter.z);
  }

  w.drifters = w.drifters.filter((d) => d.state !== 'removed' || d.vanishTicks > 0);
}

// --- contacts --------------------------------------------------------------

function contacts(w: World, out: SimEvent[], tick: number): void {
  const p = w.player;
  if (p.fallenTicks > 0) return;

  // Gió Lạc steals before any shade hit.
  for (const drifter of [...w.drifters].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (drifter.state !== 'chase') continue;
    if (drifter.steals > 0) continue;
    if (distanceXZ(drifter.x, drifter.z, p.x, p.z) > DRIFTER_STEAL_RADIUS) continue;
    const amount = Math.min(DRIFTER_STEAL_MAX, p.carried);
    if (amount <= 0) continue;
    p.carried -= amount;
    drifter.stolen += amount;
    drifter.steals = 1;
    drifter.state = 'flee';
    drifter.stateTicksLeft = DRIFTER_FLEE_TICKS;
    out.push({ tick, name: 'drifter_steal', data: { drifter_id: drifter.id, amount, carried: p.carried } });
  }

  if (p.invulnTicks > 0) return;

  for (const shade of [...w.shades].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (shade.state === 'spawning' || shade.state === 'stunned') continue;
    if (distanceXZ(shade.x, shade.z, p.x, p.z) > TUNING.shade_hit_radius) continue;
    if (Math.abs(shade.y - p.y) > HIT_MAX_HEIGHT_DIFF) continue;
    damagePlayer(w, out, tick, shade);
    break; // at most one lost flame per tick
  }
}

function damagePlayer(w: World, out: SimEvent[], tick: number, shade: Shade): void {
  const p = w.player;
  const dropped = Math.min(p.carried, Math.floor(p.carried * TUNING.hit_drop_ratio));
  for (let i = 0; i < dropped; i += 1) {
    const angle = w.rng.next() * Math.PI * 2;
    const radius = DROP_RING_MIN + w.rng.next() * (DROP_RING_MAX - DROP_RING_MIN);
    const x = p.x + Math.cos(angle) * radius;
    const z = p.z + Math.sin(angle) * radius;
    const ground = groundAt(w, x, z);
    w.motes.push(
      makeDroppedMote(w, x, Number.isFinite(ground) ? ground : p.y, z, w.simTick + 2, DROPPED_TTL_TICKS),
    );
  }
  p.carried -= dropped;
  p.flames = Math.max(0, p.flames - 1);
  p.invulnTicks = INVULN_TICKS;

  shade.state = 'recoil';
  shade.stateTicksLeft = SHADE_RECOIL_TICKS;

  out.push({ tick, name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
}

// --- spawns ----------------------------------------------------------------

function spawns(w: World, out: SimEvent[], tick: number, simTick: number): void {
  // Motes: one more every 4 s while there is an empty spawn point.
  if (w.randomMotes && simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
    const occupied = new Set(w.motes.filter((m) => m.active && m.spotIndex >= 0).map((m) => m.spotIndex));
    const empty = w.map.moteSpots.map((_, i) => i).filter((i) => !occupied.has(i));
    if (empty.length > 0 && occupied.size < MOTE_CAP) {
      const spotIndex = empty[Math.floor(w.rng.next() * empty.length)];
      const spot = w.map.moteSpots[spotIndex];
      w.motes.push({
        id: `M${w.moteSeq}`,
        x: spot.x,
        y: spot.y,
        z: spot.z,
        kind: 'random',
        active: true,
        ttlTicks: 0,
        pickableFromTick: simTick + 1,
        spotIndex,
      });
      w.moteSeq += 1;
    }
  }

  // Shades: first batch at 5 s, then one per interval.
  if (w.randomShades) {
    const schedule = w.map.shadeSchedule;
    let batch = 0;
    if (simTick === schedule.firstTick) batch = schedule.batch;
    else if (simTick > schedule.firstTick && (simTick - schedule.firstTick) % schedule.intervalTicks === 0) batch = 1;

    for (let i = 0; i < batch; i += 1) {
      if (w.shades.length >= schedule.max) break;
      const candidates = w.map.shadeSpots.filter(
        (s) => distanceXZ(s.x, s.z, w.player.x, w.player.z) >= SHADE_MIN_SPAWN_DISTANCE,
      );
      if (candidates.length === 0) break;
      const spot = candidates[Math.floor(w.rng.next() * candidates.length)];
      const shade = spawnShadeAt(w, spot.x, spot.z, SHADE_SPAWNING_TICKS);
      w.shades.push(shade);
      out.push({ tick, name: 'shade_spawned', data: { id: shade.id } });
    }
  }

  // Gió Lạc: ticks 1200, 2400, …
  if (w.randomDrifters && w.map.drifters && simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0) {
    const alive = w.drifters.filter((d) => d.state !== 'removed').length;
    if (alive < DRIFTER_MAX) {
      const candidates = w.map.shadeSpots.filter(
        (s) => distanceXZ(s.x, s.z, w.player.x, w.player.z) >= SHADE_MIN_SPAWN_DISTANCE,
      );
      const spots = candidates.length > 0 ? candidates : w.map.shadeSpots;
      const spot = spots[Math.floor(w.rng.next() * spots.length)];
      const drifter = spawnDrifterAt(w, spot.x, spot.z);
      const angle = w.rng.next() * Math.PI * 2;
      drifter.dirX = Math.cos(angle);
      drifter.dirZ = Math.sin(angle);
      w.drifters.push(drifter);
    }
  }
}

// --- end of night ----------------------------------------------------------

function finish(w: World, state: 'won' | 'lost', reason: 'all_lit' | 'dawn' | 'no_flames', out: SimEvent[], tick: number): void {
  if (state === 'won') {
    w.score +=
      Math.floor(w.timeLeftTicks / TICKS_PER_SECOND) * TUNING.score.per_second_left +
      w.player.flames * TUNING.score.per_flame_left;
  }
  w.state = state;
  out.push({ tick, name: 'game_over', data: { result: state, reason } });
}

export { windDirDeg };
