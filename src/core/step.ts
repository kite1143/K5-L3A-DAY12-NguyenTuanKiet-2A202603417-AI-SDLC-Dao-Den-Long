import {
  DT,
  EDGE_LIMIT,
  GRAVITY,
  ISLAND_RADIUS,
  JUMP_SPEED,
  SHADE_MAX,
  SHADE_SPAWN_INTERVAL_TICKS,
  SHADE_Y,
  TUNING,
} from './config';
import { worldDirection } from './inputs';
import { randRange } from './rng';
import { distanceXZ, timeLeftSeconds } from './world';
import type { GameOverReason, GameState, HitSource, Lantern, ResolvedInput, SimEvent, World } from './types';

/**
 * One gameplay step: reads the input for tick `w.tick` and produces the state of
 * tick `w.tick + 1`. Every event raised here carries tick = w.tick + 1, exactly
 * as Test Contract v1.0 section B requires.
 */
export function stepWorld(w: World, input: ResolvedInput, out: SimEvent[]): void {
  if (w.state !== 'playing') return;
  const t = TUNING;
  const p = w.player;
  const tick = w.tick + 1;

  // 1. Edge-triggered actions.
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

  // 2. Horizontal movement. Velocity is instantaneous (no acceleration ramp) so
  //    a headless run moves exactly player_speed * dt per tick.
  const dir = worldDirection(input.moveX, input.moveZ, input.yawDeg);
  p.x += dir.x * t.player_speed * DT;
  p.z += dir.z * t.player_speed * DT;

  // 3. Jump / gravity. Y never takes part in any contract distance.
  if (!p.onGround) {
    p.vy -= GRAVITY * DT;
    p.y += p.vy * DT;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }

  // 4. Shore. fall_enabled is false in Phase 1: the island edge is a soft wall.
  if (!t.fall_enabled) {
    const r = Math.hypot(p.x, p.z);
    if (r > EDGE_LIMIT) {
      const k = EDGE_LIMIT / r;
      p.x *= k;
      p.z *= k;
    }
  }

  // 5. Automatic mote pickup.
  collectMotes(w, out, tick);

  // 6. Timers.
  if (p.invulnTicks > 0) p.invulnTicks -= 1;
  if (p.pulseCooldownTicks > 0) p.pulseCooldownTicks -= 1;
  for (const s of w.shades) {
    if (s.stunTicks > 0) {
      s.stunTicks -= 1;
      if (s.stunTicks === 0) s.state = 'chase';
    }
  }

  // 7. Shades: stunned ones hold still, the rest chase.
  moveShades(w);

  // 8. Contact damage.
  if (p.invulnTicks <= 0) {
    for (const s of w.shades) {
      if (distanceXZ(s.x, s.z, p.x, p.z) <= t.shade_hit_radius) {
        damagePlayer(w, 'shade', out, tick);
        break;
      }
    }
  }

  // 9. New shades (only when random_shades is on).
  updateShadeSpawn(w, out, tick);

  // 10. Clock, then resolution. The clock is decremented before the checks so
  //     time_left_s in a snapshot always equals init - steps / 60.
  w.timeLeftTicks = Math.max(0, w.timeLeftTicks - 1);
  w.tick = tick;

  if (w.lanterns.every((l) => l.lit)) {
    finish(w, 'won', 'all_lit', out, tick);
  } else if (p.flames <= 0) {
    finish(w, 'lost', 'no_flames', out, tick);
  } else if (w.timeLeftTicks <= 0) {
    finish(w, 'lost', 'dawn', out, tick);
  }
}

function collectMotes(w: World, out: SimEvent[], tick: number): void {
  const t = TUNING;
  const p = w.player;
  for (const m of w.motes) {
    if (!m.active) continue;
    if (p.carried >= t.carry_capacity) break;
    if (distanceXZ(m.x, m.z, p.x, p.z) <= t.pickup_radius) {
      m.active = false;
      p.carried += 1;
      w.score += t.score.per_mote;
      out.push({ tick, name: 'mote_picked', data: { carried: p.carried } });
    }
  }
}

/** Deposit carried light into the nearest unlit lantern within interact_radius. */
function applyInteract(w: World, out: SimEvent[], tick: number): void {
  const t = TUNING;
  const p = w.player;
  if (p.carried <= 0) return;

  let best: Lantern | null = null;
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
  out.push({ tick, name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
  if (best.deposited >= best.cost) lightLantern(w, best, out, tick);
}

function lightLantern(w: World, lantern: Lantern, out: SimEvent[], tick: number): void {
  if (lantern.lit) return;
  lantern.lit = true;
  w.score += TUNING.score.per_lantern;
  out.push({ tick, name: 'lantern_lit', data: { lantern_id: lantern.id } });
}

/** Light pulse: stun + push every shade inside pulse_radius. */
function applyPulse(w: World, out: SimEvent[], tick: number): void {
  const t = TUNING;
  const p = w.player;
  if (t.pulse_cost > 0 && p.carried < t.pulse_cost) return;

  const stunnedIds: string[] = [];
  for (const s of w.shades) {
    if (distanceXZ(s.x, s.z, p.x, p.z) > t.pulse_radius) continue;
    s.state = 'stunned';
    s.stunTicks = Math.round(t.pulse_stun_s * 60);
    pushAway(p.x, p.z, s, t.pulse_push_m);
    stunnedIds.push(s.id);
  }

  p.carried -= t.pulse_cost;
  if (stunnedIds.length > 0) w.score += t.score.per_stun * stunnedIds.length;
  p.pulseCooldownTicks = Math.round(t.pulse_cooldown_s * 60);
  out.push({ tick, name: 'pulse', data: { stunned_ids: stunnedIds } });
  resolveSafeZones(w);
}

function pushAway(fromX: number, fromZ: number, shade: { x: number; z: number }, dist: number): void {
  let dx = shade.x - fromX;
  let dz = shade.z - fromZ;
  let d = Math.hypot(dx, dz);
  if (d < 1e-6) {
    dx = 1;
    dz = 0;
    d = 1;
  }
  shade.x += (dx / d) * dist;
  shade.z += (dz / d) * dist;
}

function moveShades(w: World): void {
  const t = TUNING;
  const p = w.player;
  const stepLen = t.shade_speed * DT;
  for (const s of w.shades) {
    if (s.state === 'stunned') continue;
    const dx = p.x - s.x;
    const dz = p.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) continue;
    if (stepLen >= d) {
      s.x = p.x;
      s.z = p.z;
    } else {
      s.x += (dx / d) * stepLen;
      s.z += (dz / d) * stepLen;
    }
    s.y = SHADE_Y;
  }
  resolveSafeZones(w);
}

/** Shades are afraid of lit lanterns: they cannot come closer than safe_radius. */
function resolveSafeZones(w: World): void {
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
      s.x = l.x + (dx / d) * r;
      s.z = l.z + (dz / d) * r;
    }
  }
}

function damagePlayer(w: World, by: HitSource, out: SimEvent[], tick: number): void {
  const t = TUNING;
  const p = w.player;
  const dropped = Math.min(p.carried, Math.floor(p.carried * t.hit_drop_ratio + 1e-9));
  p.carried -= dropped;
  p.flames = Math.max(0, p.flames - 1);
  p.invulnTicks = Math.round(t.invuln_s * 60);
  out.push({ tick, name: 'player_hit', data: { by, flames: p.flames, dropped } });
}

function updateShadeSpawn(w: World, out: SimEvent[], tick: number): void {
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
    state: 'chase',
    stunTicks: 0,
  });
  w.spawnTimerTicks = SHADE_SPAWN_INTERVAL_TICKS;
  out.push({ tick, name: 'shade_spawned', data: { id } });
}

function finish(w: World, state: GameState, reason: GameOverReason, out: SimEvent[], tick: number): void {
  if (state === 'won') {
    w.score +=
      Math.floor(timeLeftSeconds(w)) * TUNING.score.per_second_left +
      w.player.flames * TUNING.score.per_flame_left;
  }
  w.state = state;
  out.push({ tick, name: 'game_over', data: { result: state, reason } });
}
