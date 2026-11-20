/**
 * Core behaviour against the canonical numbers of Ticket-02 / contract v1.1.
 * Every expectation is derived from game.contract.json's tuning values.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeTo, firstEvent, named, quiet, run, snapAt } from './_helpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const tuning = contract.tuning;
const speed = tuning.player_speed;

test('tick 0 snapshot has the v1.1 shape and the night defaults', () => {
  const r = run({ ticks: 0 });
  const s = r.snapshots[0];
  assert.equal(s.tick, 0);
  assert.equal(s.sim_tick, 0);
  assert.equal(s.state, 'playing');
  assert.equal(s.night, 1);
  assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
  assert.equal(s.time_left_s, tuning.night1_duration_s);
  assert.equal(s.motes_active, 20);
  assert.equal(s.motes.length, 20);
  assert.ok(s.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.equal(new Set(s.motes.map((m) => m.id)).size, 20, 'twenty distinct motes');
  assert.equal(s.lanterns.length, 5);
  assert.deepEqual(s.player.vel, [0, 0, 0]);
  assert.equal(s.player.grounded, true);
  assert.equal(s.player.invuln, 0);
  assert.equal(s.player.dash_cd_s, 0);
  assert.equal(s.player.pulse_cd_s, 0);
  assert.equal(s.player.charm_s, 0);
  assert.deepEqual(s.drifters, []);
  assert.deepEqual(s.charms, []);
});

test('forward movement is exactly player_speed metres per second', () => {
  const r = run({ ticks: 60, scenario: quiet(), frames: [{ tick: 0, moveX: 0, moveZ: 1 }] });
  closeTo(r.world.player.z, speed, 1e-9, 'z after 60 ticks');
  closeTo(r.world.player.x, 0, 1e-12, 'x stays put');
});

test('stick input is normalised and rotated by cam_yaw_deg', () => {
  const half = run({ ticks: 60, scenario: quiet(), frames: [{ tick: 0, moveX: 0, moveZ: 0.5 }] });
  closeTo(half.world.player.z, speed * 0.5, 1e-9, 'half stick');

  const diag = run({ ticks: 60, scenario: quiet(), frames: [{ tick: 0, moveX: 1, moveZ: 1 }] });
  closeTo(Math.hypot(diag.world.player.x, diag.world.player.z), speed, 1e-9, 'diagonal length');

  const yaw = run({ ticks: 60, scenario: quiet(), frames: [{ tick: 0, moveX: 0, moveZ: 1, yawDeg: 90 }] });
  closeTo(yaw.world.player.x, speed, 1e-9, 'yaw 90 turns forward into +X');
  closeTo(yaw.world.player.z, 0, 1e-9, 'yaw 90 kills z');
});

test('jump uses 7 m/s against 20 m/s^2 gravity and only fires on the ground', () => {
  const r = run({ ticks: 1, scenario: quiet(), frames: [{ tick: 0, jump: true }] });
  closeTo(r.world.player.vy, 7 - 20 / 60, 1e-9, 'vy after one tick');
  assert.equal(r.world.player.grounded, false);

  const again = run({ ticks: 3, scenario: quiet(), frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 2, jump: true }] });
  assert.equal(again.parsed.filter((l) => l.name === 'dash').length, 0);
  // Second press in mid-air must not add speed.
  assert.ok(again.world.player.vy < 7);
});

test('time_left_s counts one sixtieth per step', () => {
  const r = run({ ticks: 120, scenario: quiet(), snapshotEvery: 60 });
  const total = tuning.night1_duration_s;
  assert.deepEqual(r.snapshots.map((s) => s.time_left_s), [total, total - 1, total - 2]);
});

test('motes are picked up inside pickup_radius only, and the height gap matters', () => {
  const inside = run({ ticks: 30, scenario: quiet({ motes: [[0, 0, 1.0]] }), frames: [{ tick: 0, moveX: 0, moveZ: 1 }] });
  assert.equal(named(inside, 'mote_picked').length, 1);
  assert.equal(firstEvent(inside, 'mote_picked').tick, 1);

  const outside = run({ ticks: 30, scenario: quiet({ motes: [[0, 0, 5]] }), frames: [{ tick: 0, moveX: 0, moveZ: 1 }] });
  assert.equal(named(outside, 'mote_picked').length, 0);

  const high = run({ ticks: 30, scenario: quiet({ motes: [[0, 2, 0]] }) });
  assert.equal(named(high, 'mote_picked').length, 0, 'a mote 2 m up is out of reach');

  const low = run({ ticks: 30, scenario: quiet({ motes: [[0, 1.5, 0]] }) });
  assert.equal(named(low, 'mote_picked').length, 1, '1.5 m is still reachable');
});

test('carrying stops at carry_capacity', () => {
  const motes = Array.from({ length: tuning.carry_capacity + 3 }, () => [0, 0, 0.4]);
  const r = run({ ticks: 5, snapshotEvery: 1, scenario: quiet({ motes }) });
  assert.equal(named(r, 'mote_picked').length, tuning.carry_capacity);
  assert.equal(r.world.player.carried, tuning.carry_capacity);
});

test('one extra mote spawns every 240 ticks while points are free', () => {
  const r = run({ ticks: 241, snapshotEvery: 240 });
  assert.equal(snapAt(r, 240).motes_active, 21);
  assert.equal(snapAt(r, 0).motes_active, 20);
});

test('the mote ceiling is 30 (Night 3 has 30 spawn points)', () => {
  const r = run({
    night: 3,
    ticks: 240 * 12,
    snapshotEvery: 240 * 6,
    scenario: { random_motes: true, random_shades: false, random_drifters: false, wind_enabled: false },
  });
  assert.equal(r.snapshots.at(-1).motes_active, 30);
});

test('a partial deposit is remembered and the next press finishes the lantern', () => {
  const partial = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 6 } }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.deepEqual(firstEvent(partial, 'deposit').data, { lantern_id: 'L1', amount: 6, deposited: 6 });
  assert.equal(firstEvent(partial, 'lantern_lit'), undefined, 'six motes are not enough');

  const finish = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 4 }, lanterns: [{ id: 'L1', deposited: 6 }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.deepEqual(firstEvent(finish, 'deposit').data, { lantern_id: 'L1', amount: 4, deposited: 10 });
  assert.equal(firstEvent(finish, 'lantern_lit').tick, 1);
  assert.equal(finish.world.player.carried, 0);
});

test('a scenario can preseed lantern progress and the next press finishes it', () => {
  const r = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', deposited: 6 }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.deepEqual(firstEvent(r, 'deposit').data, { lantern_id: 'L1', amount: 4, deposited: 10 });
  assert.equal(r.world.player.carried, 6);
  assert.equal(firstEvent(r, 'lantern_lit').tick, 1);
});

test('interact needs to be inside interact_radius', () => {
  const away = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 22], carried: 10 } }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(firstEvent(away, 'deposit'), undefined);

  const near = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 23.1], carried: 10 } }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(firstEvent(near, 'deposit').data.lantern_id, 'L1');
});

test('two equidistant lanterns resolve to the smaller id', () => {
  const r = run({
    ticks: 5,
    scenario: quiet({
      player: { pos: [0, 0, 12], carried: 10 },
      lanterns: [
        { id: 'L1', pos: [0, 0, 13.5] },
        { id: 'L2', pos: [0, 0, 10.5] },
      ],
    }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(firstEvent(r, 'deposit').data.lantern_id, 'L1');
});

test('shades cannot enter safe_radius around a lit lantern and cannot hurt there', () => {
  const r = run({
    ticks: 120,
    scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [1, 0, 0], state: 'chase' }] }),
  });
  const shade = r.world.shades[0];
  const distance = Math.hypot(shade.x, shade.z);
  // The shade is pushed to the rim, then takes one chase step back inside
  // before the next tick pushes it out again.
  assert.ok(distance >= tuning.safe_radius - 0.25, `held near the safe rim (${distance.toFixed(3)})`);
  assert.equal(named(r, 'player_hit').length, 0);
});

test('pulse costs 3 motes, is refused below that, and respects its cooldown', () => {
  const poor = run({
    ticks: 5,
    scenario: quiet({ player: { carried: 2 }, shades: [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.equal(firstEvent(poor, 'pulse'), undefined, 'not enough motes: no pulse at all');
  assert.equal(poor.world.player.carried, 2);

  const rich = run({
    ticks: 200,
    snapshotEvery: 100,
    scenario: quiet({ player: { carried: 9 }, shades: [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }] }),
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
      { tick: 100, pulse: true },
      { tick: 101, pulse: false },
    ],
  });
  assert.equal(named(rich, 'pulse').length, 1, 'the press at tick 100 is still cooling down');
  assert.equal(snapAt(rich, 100).player.pulse_cd_s, 1.35);
  assert.equal(snapAt(rich, 100).player.carried, 6);
  assert.equal(snapAt(rich, 200).player.pulse_cd_s, 0, 'cooldown is back after 3 s');
  closeTo(rich.world.score, tuning.score.per_stun, 1e-9, 'five points for the stun');
});

test('pulse reaches 5 m in 3D from a centre 0.8 m above the feet', () => {
  // 4 m away and 2 m above: 3D distance from the centre = sqrt(16 + 1.2^2) = 4.18 => hit
  const hit = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 0], carried: 3 }, shades: [{ id: 'S1', pos: [0, 2, 4], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(firstEvent(hit, 'pulse').data.stunned_ids, ['S1']);

  // 5 m away, 3 m up: way outside
  const miss = run({
    ticks: 5,
    scenario: quiet({ player: { pos: [0, 0, 0], carried: 3 }, shades: [{ id: 'S1', pos: [0, 3, 5.5], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(firstEvent(miss, 'pulse').data.stunned_ids, []);
});

test('pulse stuns for 120 ticks and pushes 4 m over the first 15', () => {
  const r = run({
    ticks: 200,
    snapshotEvery: 1,
    scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
  });
  const at15 = snapAt(r, 15);
  closeTo(at15.shades[0].pos[0], 3 + tuning.pulse_push_m, 0.05, 'pushed 4 m out');
  assert.equal(at15.shades[0].state, 'stunned');
  assert.equal(snapAt(r, 120).shades[0].state, 'stunned', 'still stunned on tick 120');
  assert.notEqual(snapAt(r, 121).shades[0].state, 'stunned', 'the stun is over after 120 ticks');
  // Inside the 12 m detection radius it goes straight back to chasing.
  assert.equal(snapAt(r, 135).shades[0].state, 'chase');
});

test('shades chase at their night speed, detect at 12 m and give up past 18 m', () => {
  const chase = run({ ticks: 60, scenario: quiet({ shades: [{ id: 'S1', pos: [0, 0, 10], state: 'chase' }] }) });
  closeTo(chase.world.shades[0].z, 10 - tuning.shade_speed, 1e-6, 'moved 4 m in one second');

  const stayChasing = run({ ticks: 1, scenario: quiet({ player: { pos: [0, 0, 30] }, shades: [{ id: 'S1', pos: [0, 0, 15], state: 'chase' }] }) });
  assert.equal(stayChasing.world.shades[0].state, 'chase', '15 m is inside the 18 m leave radius');

  const giveUp = run({ ticks: 1, scenario: quiet({ player: { pos: [0, 0, 30] }, shades: [{ id: 'S1', pos: [0, 0, 5], state: 'chase' }] }) });
  assert.equal(giveUp.world.shades[0].state, 'wander', '25 m is past the leave radius');
});

test('night 1 spawns two shades at tick 300 and one every 480 ticks after', () => {
  const r = run({ ticks: 790 });
  const spawned = named(r, 'shade_spawned');
  assert.deepEqual(spawned.map((e) => e.tick), [300, 300, 780]);
  assert.deepEqual(spawned.map((e) => e.data.id), ['S1', 'S2', 'S3']);
});

test('a shade touch costs one flame, drops half the bag and recoils', () => {
  const r = run({
    ticks: 5,
    snapshotEvery: 1,
    scenario: quiet({ player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 0, 0], state: 'chase' }] }),
  });
  const hit = firstEvent(r, 'player_hit');
  assert.deepEqual(hit.data, { by: 'shade', flames: tuning.flames - 1, dropped: 2 });
  assert.equal(r.world.player.carried, 2);

  const dropped = r.world.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const mote of dropped) {
    const distance = Math.hypot(mote.x - r.world.player.x, mote.z - r.world.player.z);
    assert.ok(distance >= 1.5 - 1e-6 && distance <= 2.5 + 1e-6, `dropped at ${distance}`);
    assert.ok(mote.ttlTicks > 0 && mote.ttlTicks <= 480, `ttl ${mote.ttlTicks}`);
  }
  assert.ok(snapAt(r, 1).motes.some((m) => m.kind === 'dropped' && m.ttl_s > 7.9));
  const shade = r.world.shades[0];
  assert.equal(shade.state, 'recoil', 'the shade recoils after a hit');
});

test('invuln_s protects for exactly 90 ticks', () => {
  const scenario = quiet({ shades: [{ id: 'S1', pos: [0.5, 0, 0], state: 'chase' }] });
  const during = run({ ticks: 89, scenario });
  const after = run({ ticks: 91, scenario });
  assert.equal(named(during, 'player_hit').length, 1);
  assert.equal(named(after, 'player_hit').length, 2);
});

test('only one flame is lost per tick even with several shades on top of the player', () => {
  const r = run({
    ticks: 1,
    scenario: quiet({ shades: [{ id: 'S1', pos: [0.4, 0, 0], state: 'chase' }, { id: 'S2', pos: [0, 0, 0.4], state: 'chase' }] }),
  });
  assert.equal(named(r, 'player_hit').length, 1);
});

test('a shade cannot climb onto another tier, so tiers are real high ground', () => {
  const r = run({
    ticks: 300,
    snapshotEvery: 100,
    night: 3,
    scenario: quiet({ player: { pos: [0, 6, 0] }, shades: [{ id: 'S1', pos: [0, 0, 26], state: 'chase' }] }),
  });
  assert.equal(named(r, 'player_hit').length, 0, 'the shade is stopped by the tier wall');
  assert.equal(r.world.shades[0].y, 1, 'shade stayed on tier 0');
});

test('walking off the island costs a flame, all carried motes and respawns later', () => {
  const r = run({
    ticks: 200,
    snapshotEvery: 50,
    scenario: quiet({ player: { pos: [0, 0, 39], carried: 4 } }),
    frames: [{ tick: 0, moveX: 0, moveZ: 1 }, { tick: 20, moveX: 0, moveZ: 0 }],
  });
  const hit = firstEvent(r, 'player_hit');
  assert.equal(hit.data.by, 'fall');
  assert.equal(hit.data.lost, 4);
  assert.equal(hit.data.flames, tuning.flames - 1);
  assert.equal(r.world.player.carried, 0);
  closeTo(r.world.player.x, 0, 1e-9, 'respawned at the start x');
  closeTo(r.world.player.z, 0, 1e-9, 'respawned at the start z');
  assert.equal(r.world.player.grounded, true);
  assert.ok(r.world.player.invulnTicks > 0);
});

test('falling with the last flame is a loss, with no respawn', () => {
  const r = run({
    ticks: 400,
    scenario: quiet({ player: { pos: [0, 0, 39], flames: 1 } }),
    frames: [{ tick: 0, moveX: 0, moveZ: 1 }],
  });
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(firstEvent(r, 'game_over').data, { result: 'lost', reason: 'no_flames' });
});

test('surviving to dawn with enough lanterns wins, and a full house does not end the night early', () => {
  // v1.2 replaced the old "light them all and win instantly" rule (see ADR-001).
  const allLit = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const early = run({ ticks: 200, scenario: quiet({ lanterns: allLit }) });
  assert.equal(early.end.state, 'playing', 'lit lanterns alone no longer win the night');
  assert.equal(named(early, 'game_over').length, 0);

  // 3/5 lit is exactly the threshold (ceil(0.6 * 5)).
  const three = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  const dawn = run({ ticks: 600, scenario: quiet({ lanterns: three, time_left_s: 0.05 }) });
  assert.equal(dawn.end.state, 'won');
  assert.deepEqual(firstEvent(dawn, 'game_over').data, { result: 'won', reason: 'dawn_survived' });

  // 2/5 is below it.
  const two = ['L1', 'L2'].map((id) => ({ id, lit: true }));
  const fail = run({ ticks: 600, scenario: quiet({ lanterns: two, time_left_s: 0.05 }) });
  assert.equal(fail.end.state, 'lost');
  assert.deepEqual(firstEvent(fail, 'game_over').data, { result: 'lost', reason: 'dawn' });
});

test('running out of time loses with dawn unless every lantern is lit', () => {
  const r = run({ ticks: 600, scenario: quiet({ time_left_s: 0.1 }) });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.end.ticks, 6);
  assert.deepEqual(firstEvent(r, 'game_over').data, { result: 'lost', reason: 'dawn' });
});

test('running out of flames always loses, even with everything lit', () => {
  const r = run({
    ticks: 10,
    scenario: quiet({
      player: { flames: 0 },
      lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })),
    }),
  });
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(firstEvent(r, 'game_over').data, { result: 'lost', reason: 'no_flames' });
});

test('pre-lit lanterns award nothing when the scenario is built', () => {
  const r = run({ ticks: 1, scenario: quiet({ lanterns: [{ id: 'L1', lit: true }] }) });
  assert.equal(named(r, 'lantern_lit').length, 0);
  assert.equal(r.world.score, 0);
});

test('snapshots are emitted every snapshot_every ticks and always end with end', () => {
  const r = run({ ticks: 25, scenario: quiet(), snapshotEvery: 10 });
  assert.deepEqual(r.snapshots.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
});

test('coordinates carry at most 3 decimals', () => {
  const r = run({
    ticks: 7,
    scenario: quiet({ motes: [[1.23456789, 0, 2.3456789]] }),
    frames: [{ tick: 0, moveX: 0.123456789, moveZ: 1 }],
  });
  for (const line of r.lines) assert.doesNotMatch(line, /-?\d+\.\d{4,}/, `too many decimals: ${line}`);
});

test('two runs with the same seed and inputs are byte-identical', () => {
  const opts = { seed: 4242, night: 2, ticks: 900 };
  const a = run(opts);
  const b = run(opts);
  assert.deepEqual(a.lines, b.lines);
});

test('a different seed produces a different island', () => {
  const a = run({ seed: 1, ticks: 0 });
  const b = run({ seed: 2, ticks: 0 });
  assert.notDeepEqual(a.snapshots[0].motes, b.snapshots[0].motes);
});

test('shade states only ever use the six contract names', () => {
  const allowed = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
  const r = run({ seed: 9, night: 1, ticks: 1800, snapshotEvery: 30 });
  for (const snap of r.snapshots) {
    for (const shade of snap.shades) assert.ok(allowed.has(shade.state), `bad state ${shade.state}`);
  }
});

test('a full night of headless simulation finishes in under 30 seconds', () => {
  const started = Date.now();
  const r = run({
    seed: 3,
    night: 3,
    ticks: 300 * 60,
    snapshotEvery: 600,
    scenario: { ...quiet(), wind_enabled: false },
  });
  const seconds = (Date.now() - started) / 1000;
  assert.equal(r.end.ticks, 300 * 60, 'the quiet scenario survives the whole night');
  assert.ok(seconds < 30, `took ${seconds.toFixed(2)} s`);
});
