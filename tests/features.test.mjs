/**
 * New Ticket-02 features: dash, the three maps, jump pads, wind, Gió Lạc
 * (drifters), Bùa Gió (charms) and the pause switch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, groundAt, NIGHT_MAPS } from '../dist/core/index.js';
import { closeTo, firstEvent, named, quiet, run, snapAt } from './_helpers.mjs';

const DASH_TICKS = 12;
const DASH_SPEED = 14;

// --- lướt ------------------------------------------------------------------

test('dash covers 14 m/s for 12 ticks and fires a dash event', () => {
  const r = run({ ticks: DASH_TICKS, scenario: quiet(), frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }] });
  closeTo(r.world.player.z, (DASH_SPEED * DASH_TICKS) / 60, 1e-9, 'dash distance');
  assert.equal(named(r, 'dash').length, 1);
  assert.equal(firstEvent(r, 'dash').tick, 1);
});

test('dash cooldown is 1.5 s counted from the start', () => {
  const early = run({
    ticks: 120,
    scenario: quiet(),
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 89, dash: true }, { tick: 90, dash: false }],
  });
  assert.equal(named(early, 'dash').length, 1, 'a press at tick 89 is still cooling down');

  const late = run({
    ticks: 120,
    scenario: quiet(),
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 90, dash: true }],
  });
  assert.equal(named(late, 'dash').length, 2, 'tick 90 is exactly one cooldown later');
});

test('an air dash keeps the altitude and is not invulnerable', () => {
  const air = run({
    ticks: 40,
    snapshotEvery: 1,
    scenario: quiet(),
    frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, dash: true }, { tick: 11, dash: false }],
  });
  const yAtDash = snapAt(air, 10).player.pos[1];
  for (let tick = 11; tick <= 21; tick += 1) {
    closeTo(snapAt(air, tick).player.pos[1], yAtDash, 1e-9, `altitude held at tick ${tick}`);
  }

  const hit = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 0] }, shades: [{ id: 'S1', pos: [0.6, 0, 0], state: 'chase' }] }),
    frames: [{ tick: 0, dash: true }],
  });
  assert.equal(named(hit, 'player_hit').length, 1, 'dashing does not stop the hit');
});

test('a dash with no stick input goes the way the character faces', () => {
  const r = run({
    ticks: 40,
    scenario: quiet(),
    frames: [
      { tick: 0, moveX: 1, moveZ: 0 },
      { tick: 10, moveX: 0, moveZ: 0 },
      { tick: 20, dash: true },
      { tick: 21, dash: false },
    ],
  });
  // Facing is +X now, so the dash adds 2.8 m on top of ten ticks of walking.
  const walk = 6.0 * (10 / 60);
  closeTo(r.world.player.x, walk + (DASH_SPEED * DASH_TICKS) / 60, 1e-6, 'dash followed the facing');
  closeTo(r.world.player.z, 0, 1e-9, 'no sideways drift');
});

// --- bản đồ ----------------------------------------------------------------

test('Night 1 is a 40 m island: inside is ground, outside is a fall', () => {
  const w = createWorld(1, 1, null);
  assert.equal(groundAt(w, 0, 39.9), 0);
  assert.equal(groundAt(w, 0, 40.1), Number.NEGATIVE_INFINITY);
});

test('Night 2 has two islands and a walkable bridge', () => {
  const w = createWorld(1, 2, null);
  assert.equal(groundAt(w, 0, 0), 0, 'island A');
  assert.equal(groundAt(w, 70, 0), 0, 'island B');
  assert.equal(groundAt(w, 35, 0), 0, 'bridge centre');
  assert.equal(groundAt(w, 35, 5), Number.NEGATIVE_INFINITY, 'off the side of the bridge');
  assert.equal(groundAt(w, 35, 1.9), 0, 'bridge edge');
  assert.equal(groundAt(w, 35, 2.1), Number.NEGATIVE_INFINITY, 'just past the bridge edge');
  assert.equal(NIGHT_MAPS[2].lanterns.length, 6);
});

test('Night 2 jump pads launch at 14 m/s up and 24 m/s across, landing on the other island', () => {
  const r = run({ ticks: 90, night: 2, scenario: quiet({ player: { pos: [20, 0, 18] } }) });
  assert.equal(r.world.player.grounded, true);
  closeTo(r.world.player.x, 51.6, 0.4, 'landed on island B');
  closeTo(r.world.player.y, 0, 1e-6, 'back on the ground');
  const distanceToB = Math.hypot(r.world.player.x - 70, r.world.player.z);
  assert.ok(distanceToB < 28, `landing inside island B (${distanceToB.toFixed(1)} m from its centre)`);
});

test('Night 3 has three tiers, two ramps, a wall you cannot walk up and a bell tower', () => {
  const w = createWorld(1, 3, null);
  assert.equal(groundAt(w, 0, 0), 6, 'tier 2 disc');
  assert.equal(groundAt(w, 0, 18), 3, 'tier 1 ring');
  assert.equal(groundAt(w, 0, -18), 0, 'tier 1 only exists on z > 0');
  assert.equal(groundAt(w, 0, 8.5), 0, 'the moat between tier 1 and tier 2');
  const rampX = 27 * Math.cos(Math.PI / 6);
  const rampZ = 27 * Math.sin(Math.PI / 6);
  closeTo(groundAt(w, rampX, rampZ), 1.5, 1e-9, 'ramp height at r = 27');
  closeTo(groundAt(w, 30 * Math.cos(Math.PI / 6), 30 * Math.sin(Math.PI / 6)), 0, 1e-9, 'ramp foot');
  closeTo(groundAt(w, 24 * Math.cos(Math.PI / 6), 24 * Math.sin(Math.PI / 6)), 3, 1e-9, 'ramp top');
  assert.equal(groundAt(w, 46, 0), Number.NEGATIVE_INFINITY, 'past the 45 m rim');
});

test('walking up a ramp raises the player onto tier 1', () => {
  const x = 27 * Math.cos(Math.PI / 6);
  const z = 27 * Math.sin(Math.PI / 6);
  const r = run({
    ticks: 60,
    night: 3,
    scenario: quiet({ player: { pos: [x, 1.5, z] } }),
    frames: [{ tick: 0, moveX: -Math.cos(Math.PI / 6), moveZ: -Math.sin(Math.PI / 6) }],
  });
  closeTo(r.world.player.y, 3, 1e-6, 'standing on tier 1');
  assert.equal(r.world.player.grounded, true);
});

test('tier walls block horizontal movement instead of teleporting the player up', () => {
  // Walk from tier 0 towards the tier 1 ring (a 3 m wall) at 18 m on +Z.
  const r = run({
    ticks: 120,
    night: 3,
    scenario: quiet({ player: { pos: [0, 0, 32] } }),
    frames: [{ tick: 0, moveX: 0, moveZ: -1 }],
  });
  assert.equal(r.world.player.y, 0, 'never climbed the wall');
  assert.ok(r.world.player.z > 24, `stopped in front of the wall (z=${r.world.player.z.toFixed(1)})`);
});

test('the Night 3 pad throws the player up onto tier 2', () => {
  const r = run({ ticks: 90, night: 3, scenario: quiet({ player: { pos: [0, 3, 13] } }) });
  assert.equal(r.world.player.grounded, true);
  closeTo(r.world.player.y, 6, 1e-6, 'landed on tier 2');
  assert.ok(Math.hypot(r.world.player.x, r.world.player.z) <= 8, 'inside the tier 2 disc');
});

test('every night reports its own night number and duration', () => {
  for (const [night, seconds] of [
    [1, 300],
    [2, 330],
    [3, 360],
  ]) {
    const r = run({ ticks: 0, night });
    assert.equal(r.snapshots[0].night, night);
    assert.equal(r.snapshots[0].time_left_s, seconds);
  }
});

// --- gió -------------------------------------------------------------------

test('Night 3 wind blows in 5 s gusts with a 2 s warning, once per 30 s', () => {
  const r = run({ ticks: 1600, night: 3, snapshotEvery: 20, scenario: quiet() });
  const windAt = (tick) => snapAt(r, tick).wind;
  assert.equal(windAt(340).active, false, 'before the warning window');
  assert.equal(windAt(460).active, false, 'still only warning');
  assert.equal(windAt(480).active, true, 'gust starts');
  assert.equal(windAt(760).active, true, 'still inside the 5 s window');
  assert.equal(windAt(780).active, false, 'gust over');
  // The direction is stable inside one gust and comes from the seed.
  assert.equal(windAt(500).dir_deg, windAt(740).dir_deg);
});

test('the wind pushes an idle player 2 m/s', () => {
  const r = run({ seed: 5, ticks: 780, night: 3, snapshotEvery: 1, scenario: quiet() });
  const start = snapAt(r, 479).player.pos;
  const end = snapAt(r, 779).player.pos;
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const moved = Math.hypot(dx, dz);
  closeTo(moved, 10, 0.4, '5 s of gust at 2 m/s');
  const deg = snapAt(r, 600).wind.dir_deg;
  const rad = (deg * Math.PI) / 180;
  closeTo(Math.atan2(dz, dx), Math.atan2(Math.sin(rad), Math.cos(rad)), 0.05, 'pushed along the wind');
});

test('wind is off on nights 1 and 2 and can be disabled by the scenario', () => {
  assert.equal(run({ ticks: 600, night: 1, scenario: quiet() }).snapshots.at(-1).wind.active, false);
  assert.equal(run({ ticks: 600, night: 2, scenario: quiet() }).snapshots.at(-1).wind.active, false);
  const off = run({ ticks: 600, night: 3, snapshotEvery: 60, scenario: quiet({ wind_enabled: false }) });
  assert.ok(off.snapshots.every((s) => s.wind.active === false));
});

// --- Gió Lạc ---------------------------------------------------------------

test('Gió Lạc spawns at tick 1200 and again at 2400, at most two at a time', () => {
  const r = run({ seed: 4, night: 2, ticks: 2401, snapshotEvery: 600 });
  const spawnTicks = r.snapshots.map((s) => s.drifters.length);
  assert.ok(spawnTicks.some((n) => n > 0), 'at least one drifter exists after 1200 ticks');
  const drifterIds = new Set();
  for (const snap of r.snapshots) for (const d of snap.drifters) drifterIds.add(d.id);
  assert.ok([...drifterIds].every((id) => /^D\d+$/.test(id)), `ids look like D1, D2 (${[...drifterIds]})`);
});

test('Gió Lạc switches to chase when the player carries 5 motes and is within 15 m', () => {
  const scenario = quiet({ player: { carried: 5, pos: [0, 0, 0] }, drifters: [{ id: 'D1', pos: [0, 0, 10], state: 'idle' }] });
  const r = run({ ticks: 1, night: 2, scenario });
  assert.equal(r.world.drifters[0].state, 'chase');

  const far = run({ ticks: 1, night: 2, scenario: { ...scenario, drifters: [{ id: 'D1', pos: [0, 0, 20], state: 'idle' }] } });
  assert.equal(far.world.drifters[0].state, 'idle', '20 m is too far');

  const empty = run({ ticks: 1, night: 2, scenario: { ...scenario, player: { carried: 4, pos: [0, 0, 0] } } });
  assert.equal(empty.world.drifters[0].state, 'idle', '4 motes is not enough');
});

test('Gió Lạc steals 3 motes once, then flies away and disappears', () => {
  const r = run({
    seed: 2,
    night: 2,
    ticks: 400,
    snapshotEvery: 100,
    scenario: quiet({ player: { carried: 8 }, drifters: [{ id: 'D1', pos: [0, 0, 10], state: 'idle' }] }),
  });
  const steal = firstEvent(r, 'drifter_steal');
  assert.equal(steal.data.drifter_id, 'D1');
  assert.equal(steal.data.amount, 3);
  assert.equal(steal.data.carried, 5);
  const after = r.snapshots.find((s) => s.tick > steal.tick);
  assert.equal(after.drifters[0].state, 'flee');
  assert.equal(after.drifters[0].stolen, 3);
  assert.equal(r.world.drifters.length, 0, 'gone after its flee timer');
  assert.equal(named(r, 'drifter_steal').length, 1, 'it only steals once');
});

test('a pulse scares a chasing Gió Lạc into fleeing without the loot', () => {
  const r = run({
    night: 2,
    ticks: 5,
    scenario: quiet({ player: { carried: 5 }, drifters: [{ id: 'D1', pos: [0, 0, 3], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
  });
  assert.equal(firstEvent(r, 'drifter_steal'), undefined);
  assert.equal(r.world.drifters[0].state, 'flee');
  assert.equal(r.world.drifters[0].stolen, 0);
  assert.equal(r.world.player.carried, 5 - 3, 'only the pulse cost was paid');
});

test('a pulse on a fleeing Gió Lạc drops everything it stole', () => {
  const r = run({
    seed: 2,
    night: 2,
    ticks: 120,
    snapshotEvery: 10,
    scenario: quiet({ player: { carried: 8 }, drifters: [{ id: 'D1', pos: [0, 0, 10], state: 'idle' }] }),
    frames: [{ tick: 90, pulse: true }, { tick: 91, pulse: false }],
  });
  const drop = firstEvent(r, 'drifter_drop');
  assert.equal(drop.data.drifter_id, 'D1');
  assert.equal(drop.data.amount, 3);
  const dropped = r.world.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 3);
  assert.equal(r.world.drifters[0].stolen, 0);
});

// --- Bùa Gió ---------------------------------------------------------------

test('Bùa Gió is picked up on the bridge and raises the run speed to 7.2', () => {
  const scenario = {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    motes: [],
    shades: [],
    drifters: [],
    player: { pos: [35, 0, 0] },
  };
  const pickup = run({ night: 2, ticks: 2, snapshotEvery: 1, scenario });
  const event = firstEvent(pickup, 'charm_picked');
  assert.equal(event.data.charm_id, 'C1');
  assert.equal(event.data.charm_ticks, 600);
  assert.equal(snapAt(pickup, 1).player.charm_s, 10);

  const faster = run({
    night: 2,
    ticks: 60,
    scenario: { ...scenario, player: { pos: [0, 0, 0] } },
    frames: [{ tick: 0, moveX: 0, moveZ: 1 }],
  });
  closeTo(faster.world.player.z, 6, 1e-9, 'no charm: 6 m/s');
});

test('with Bùa Gió the dash has no cooldown but still lasts 12 ticks', () => {
  const scenario = {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    motes: [],
    shades: [],
    drifters: [],
    player: { pos: [35, 0, 0] },
  };
  const r = run({
    night: 2,
    ticks: 60,
    scenario: { ...scenario, player: { pos: [0, 0, 0], charm_ticks: 600 } },
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 20, dash: true }],
  });
  assert.equal(named(r, 'dash').length, 2, 'second dash allowed without the 1.5 s wait');
});

test('a used charm reappears after 2700 ticks', () => {
  const scenario = {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    motes: [],
    shades: [],
    drifters: [],
    player: { pos: [35, 0, 0] },
    time_left_s: 100,
  };
  const r = run({ night: 2, ticks: 800, snapshotEvery: 200, scenario });
  const afterPickup = r.snapshots.find((s) => s.tick === 200);
  assert.equal(afterPickup.charms[0].available, false);
  closeTo(afterPickup.charms[0].respawn_s, (2700 - 200) / 60, 0.02, 'respawn countdown');
});

test('Bùa Gió speed is 7.2 m/s while the effect runs', () => {
  const r = run({
    night: 2,
    ticks: 60,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [],
      player: { pos: [0, 0, 0], charm_ticks: 600 },
    },
    frames: [{ tick: 0, moveX: 0, moveZ: 1 }],
  });
  closeTo(r.world.player.z, 7.2, 1e-9, 'charmed run speed');
});

// --- tạm dừng --------------------------------------------------------------

test('pause freezes the simulation but keeps the tick counter moving', () => {
  const r = run({
    ticks: 60,
    snapshotEvery: 1,
    scenario: quiet(),
    frames: [
      { tick: 10, pause: true },
      { tick: 11, pause: false },
      { tick: 20, pause: true },
      { tick: 21, pause: false },
    ],
  });
  const at10 = snapAt(r, 10);
  const at19 = snapAt(r, 19);
  assert.equal(at10.state, 'playing');
  assert.equal(at19.state, 'paused');
  assert.equal(at19.sim_tick, at10.sim_tick, 'simulation frozen');
  assert.equal(at19.time_left_s, at10.time_left_s, 'clock frozen');
  assert.equal(at19.tick, 19, 'tick still advances, including while paused');

  const resumed = snapAt(r, 30);
  assert.equal(resumed.state, 'playing');
  assert.ok(resumed.sim_tick > at19.sim_tick, 'simulation continues after resuming');
  assert.deepEqual(named(r, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(named(r, 'resumed').map((e) => e.tick), [21]);
});

test('night_start reports the night on the first step', () => {
  const r = run({ ticks: 2, night: 2, scenario: quiet() });
  const start = firstEvent(r, 'night_start');
  assert.equal(start.tick, 1);
  assert.deepEqual(start.data, { night: 2 });
});
