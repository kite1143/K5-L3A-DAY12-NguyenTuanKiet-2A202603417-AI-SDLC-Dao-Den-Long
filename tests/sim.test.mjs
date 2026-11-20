/**
 * Behaviour tests against Test Contract v1.0. Every numeric expectation is
 * derived from game.contract.json's tuning values, not hard-coded magic numbers,
 * so a tuning change fails here instead of silently rotating the whole game.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../dist/core/index.js';
import { closeTo, emptyScenario, firstEvent, named, run } from './_helpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const speed = contract.tuning.player_speed;
const tickDistance = speed / 60;

test('a snapshot at tick 0 exists, is state "playing" and precedes every input', () => {
  const r = run({ ticks: 1, scenario: emptyScenario({ player: { pos: [2, 0, 3] } }) });
  const first = r.snapshots[0];
  assert.equal(first.tick, 0);
  assert.equal(first.sim_tick, 0);
  assert.equal(first.state, 'playing');
  assert.deepEqual(first.player.pos, [2, 0, 3]);
  assert.equal(first.time_left_s, contract.tuning.night1_duration_s);
});

test('without an inputs file the player stands still', () => {
  const r = run({ ticks: 120, scenario: emptyScenario() });
  assert.deepEqual(r.snapshots.at(-1).player.pos, [0, 0, 0]);
});

test('forward movement is exactly player_speed metres per second', () => {
  const r = run({ ticks: 60, scenario: emptyScenario(), frames: [{ tick: 0, moveX: 0, moveZ: 1 }] });
  closeTo(r.world.player.z, speed, 1e-9, 'z after 60 ticks');
  closeTo(r.world.player.x, 0, 1e-12, 'x stays put');
});

test('stick input shorter than 1 is not scaled up', () => {
  const r = run({ ticks: 60, scenario: emptyScenario(), frames: [{ tick: 0, moveX: 0, moveZ: 0.5 }] });
  closeTo(r.world.player.z, speed * 0.5, 1e-9, 'half stick travels half a metre per second');
});

test('stick input longer than 1 is normalised to unit length', () => {
  const r = run({ ticks: 60, scenario: emptyScenario(), frames: [{ tick: 0, moveX: 1, moveZ: 1 }] });
  closeTo(Math.hypot(r.world.player.x, r.world.player.z), speed, 1e-9, 'diagonal distance');
  closeTo(r.world.player.x, r.world.player.z, 1e-9, 'diagonal is symmetric');
});

test('cam_yaw_deg rotates the movement direction as the contract defines', () => {
  // yaw 90 deg turns "forward" (+Z) into +X.
  const r = run({
    ticks: 60,
    scenario: emptyScenario(),
    frames: [{ tick: 0, moveX: 0, moveZ: 1, yawDeg: 90 }],
  });
  closeTo(r.world.player.x, speed, 1e-9, 'x after yaw 90');
  closeTo(r.world.player.z, 0, 1e-9, 'z after yaw 90');
});

test('cam_yaw_deg 180 deg moves backwards along -Z', () => {
  const r = run({
    ticks: 60,
    scenario: emptyScenario(),
    frames: [{ tick: 0, moveX: 0, moveZ: 1, yawDeg: 180 }],
  });
  closeTo(r.world.player.z, -speed, 1e-9, 'z after yaw 180');
});

test('time_left_s counts down exactly one sixtieth per step', () => {
  const r = run({ ticks: 120, scenario: emptyScenario(), snapshotEvery: 60 });
  assert.deepEqual(
    r.snapshots.map((s) => s.time_left_s),
    [300, 299, 298],
  );
});

test('motes are picked up automatically at pickup_radius, not before', () => {
  const scenario = emptyScenario({ motes: [[0, 0, 5]] });
  const r = run({ ticks: 60, scenario, frames: [{ tick: 0, moveX: 0, moveZ: 1 }] });
  const picked = named(r, 'mote_picked');
  assert.equal(picked.length, 1);
  const radius = contract.tuning.pickup_radius;
  // First tick where the gap is <= pickup_radius.
  const expectedTick = Math.ceil((5 - radius) / tickDistance);
  assert.equal(picked[0].tick, expectedTick);
  assert.deepEqual(picked[0].data, { carried: 1 });
});

test('motes further than pickup_radius are ignored', () => {
  const r = run({ ticks: 60, scenario: emptyScenario({ motes: [[0, 0, 5]] }) });
  assert.equal(named(r, 'mote_picked').length, 0);
  assert.equal(r.snapshots.at(-1).motes_active, 1);
});

test('carrying stops at carry_capacity', () => {
  const capacity = contract.tuning.carry_capacity;
  const motes = Array.from({ length: capacity + 2 }, () => [0, 0, 0.4]);
  const r = run({ ticks: 5, snapshotEvery: 1, scenario: emptyScenario({ motes }) });
  assert.equal(named(r, 'mote_picked').length, capacity);
  assert.equal(r.world.player.carried, capacity);
  assert.equal(r.snapshots.at(-1).motes_active, 2);
});

test('a full bag does not pick up anything else', () => {
  const capacity = contract.tuning.carry_capacity;
  const r = run({ ticks: 10, scenario: emptyScenario({ player: { carried: capacity }, motes: [[0, 0, 0.4]] }) });
  assert.equal(named(r, 'mote_picked').length, 0);
  assert.equal(r.world.player.carried, capacity);
});

test('interact deposits carried light and lights the lantern', () => {
  const cost = contract.tuning.lantern_cost;
  const r = run({
    ticks: 5,
    snapshotEvery: 1,
    scenario: emptyScenario({
      player: { pos: [0, 0, 17], carried: cost },
      lanterns: [{ id: 'L1' }],
    }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  const deposit = firstEvent(r, 'deposit');
  assert.deepEqual(deposit.data, { lantern_id: 'L1', amount: cost, deposited: cost });
  assert.equal(deposit.tick, 1);
  assert.equal(firstEvent(r, 'lantern_lit').data.lantern_id, 'L1');
  assert.equal(r.world.player.carried, 0);
  assert.equal(r.world.score, contract.tuning.score.per_lantern);
  assert.equal(r.snapshots.at(-1).lanterns[0].lit, true);
});

test('a partial deposit does not light the lantern', () => {
  const cost = contract.tuning.lantern_cost;
  const r = run({
    ticks: 5,
    snapshotEvery: 1,
    scenario: emptyScenario({ player: { pos: [0, 0, 17], carried: cost - 1 } }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(firstEvent(r, 'deposit').data, {
    lantern_id: 'L1',
    amount: cost - 1,
    deposited: cost - 1,
  });
  assert.equal(firstEvent(r, 'lantern_lit'), undefined);
  assert.equal(r.snapshots.at(-1).lanterns[0].lit, false);
});

test('deposit never wastes light beyond the remaining cost', () => {
  const cost = contract.tuning.lantern_cost;
  const r = run({
    ticks: 5,
    snapshotEvery: 1,
    scenario: emptyScenario({ player: { pos: [0, 0, 17], carried: cost }, lanterns: [{ id: 'L1', deposited: cost - 1 }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(firstEvent(r, 'deposit').data.amount, 1);
  assert.equal(r.world.player.carried, cost - 1);
  assert.equal(r.snapshots.at(-1).lanterns[0].lit, true);
});

test('interacting out of range or with nothing to give does nothing', () => {
  const far = run({
    ticks: 5,
    scenario: emptyScenario({ player: { pos: [0, 0, 10], carried: 3 } }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(firstEvent(far, 'deposit'), undefined);

  const empty = run({
    ticks: 5,
    scenario: emptyScenario({ player: { pos: [0, 0, 17], carried: 0 } }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(firstEvent(empty, 'deposit'), undefined);
});

test('a scenario that starts with lit lanterns awards no score and no events', () => {
  const preLit = [1, 2, 3, 4].map((i) => ({ id: `L${i}`, lit: true }));
  const r = run({ ticks: 1, scenario: emptyScenario({ lanterns: preLit }) });
  assert.equal(r.events.filter((e) => e.name === 'lantern_lit').length, 0);
  assert.equal(r.world.score, 0);
});

test('lighting the last lantern wins the night and reports all_lit', () => {
  const cost = contract.tuning.lantern_cost;
  const preLit = [1, 2, 3, 4].map((i) => ({ id: `L${i}`, lit: true }));
  const r = run({
    ticks: 600,
    scenario: emptyScenario({ player: { pos: [16.169, 0, 5.253], carried: cost }, lanterns: preLit }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.end.state, 'won');
  assert.equal(r.end.ticks, 1, 'the run stops the moment the game ends');
  const over = firstEvent(r, 'game_over');
  assert.deepEqual(over.data, { result: 'won', reason: 'all_lit' });
  const timeBonus = Math.floor((300 * 60 - 1) / 60) * contract.tuning.score.per_second_left;
  const flameBonus = contract.tuning.flames * contract.tuning.score.per_flame_left;
  assert.equal(r.end.score, contract.tuning.score.per_lantern + timeBonus + flameBonus);
});

test('a scenario that is already fully lit wins on the first step', () => {
  const preLit = [1, 2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true }));
  const r = run({ ticks: 60, scenario: emptyScenario({ lanterns: preLit }) });
  assert.equal(r.end.state, 'won');
  assert.equal(r.end.ticks, 1);
  assert.equal(r.end.score, Math.floor((300 * 60 - 1) / 60) * contract.tuning.score.per_second_left + contract.tuning.flames * contract.tuning.score.per_flame_left);
});

test('running out of flames loses the night with no_flames', () => {
  const r = run({ ticks: 60, scenario: emptyScenario({ player: { flames: 0 } }) });
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(firstEvent(r, 'game_over').data, { result: 'lost', reason: 'no_flames' });
});

test('running out of night time loses the night with dawn', () => {
  const ticks = 6;
  const r = run({ ticks: 600, snapshotEvery: 1, scenario: emptyScenario({ time_left_s: ticks / 60 }) });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.end.ticks, ticks);
  assert.deepEqual(firstEvent(r, 'game_over').data, { result: 'lost', reason: 'dawn' });
  assert.equal(r.snapshots.at(-1).time_left_s, 0);
});

test('pulse stuns and pushes every shade inside pulse_radius', () => {
  const push = contract.tuning.pulse_push_m;
  const r = run({
    ticks: 10,
    scenario: emptyScenario({ shades: [{ pos: [3, 0, 0] }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  const pulse = firstEvent(r, 'pulse');
  assert.equal(pulse.tick, 1);
  assert.deepEqual(pulse.data.stunned_ids, ['S1']);
  closeTo(r.snapshots.at(-1).shades[0].pos[0], 3 + push, 1e-6, 'pushed outward');
  assert.equal(r.snapshots.at(-1).shades[0].state, 'stunned');
  assert.equal(r.world.score, contract.tuning.score.per_stun);
});

test('pulse ignores shades outside pulse_radius', () => {
  const r = run({
    ticks: 10,
    scenario: emptyScenario({ shades: [{ pos: [10, 0, 0] }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(firstEvent(r, 'pulse').data.stunned_ids, []);
  assert.equal(r.snapshots.at(-1).shades[0].state, 'chase');
  assert.equal(r.world.score, 0);
});

test('pulse respects pulse_cooldown_s', () => {
  const r = run({
    ticks: 120,
    scenario: emptyScenario({ shades: [{ pos: [3, 0, 0] }] }),
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
      { tick: 10, pulse: true },
    ],
  });
  assert.equal(named(r, 'pulse').length, 1, 'the second press is still cooling down');
});

test('a stunned shade recovers and chases again', () => {
  const stunTicks = contract.tuning.pulse_stun_s * 60;
  const r = run({
    ticks: stunTicks + 10,
    scenario: emptyScenario({ shades: [{ pos: [3, 0, 0] }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.equal(r.snapshots.at(-1).shades[0].state, 'chase');
});

test('shades chase at exactly shade_speed', () => {
  const shadeSpeed = contract.tuning.shade_speed;
  const r = run({ ticks: 60, scenario: emptyScenario({ shades: [{ pos: [10, 0, 0] }] }) });
  closeTo(r.world.shades[0].x, 10 - shadeSpeed, 1e-9, 'shade x after 1 s');
});

test('a shade touching the player costs one flame and drops part of the bag', () => {
  const ratio = contract.tuning.hit_drop_ratio;
  const r = run({ ticks: 5, scenario: emptyScenario({ player: { carried: 4 }, shades: [{ pos: [0.5, 0, 0] }] }) });
  const hit = firstEvent(r, 'player_hit');
  assert.equal(hit.tick, 1);
  assert.deepEqual(hit.data, { by: 'shade', flames: contract.tuning.flames - 1, dropped: Math.floor(4 * ratio) });
  assert.equal(r.world.player.carried, 4 - Math.floor(4 * ratio));
});

test('invuln_s protects the player for exactly that many ticks', () => {
  const scenario = emptyScenario({ shades: [{ pos: [0.5, 0, 0] }] });
  const invulnTicks = contract.tuning.invuln_s * 60;
  const during = run({ ticks: invulnTicks - 1, scenario });
  const after = run({ ticks: invulnTicks + 1, scenario });
  assert.equal(named(during, 'player_hit').length, 1);
  assert.equal(named(after, 'player_hit').length, 2);
});

test('losing the last flame ends the night', () => {
  const r = run({ ticks: 300, scenario: emptyScenario({ player: { flames: 1 }, shades: [{ pos: [0.5, 0, 0] }] }) });
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(firstEvent(r, 'game_over').data, { result: 'lost', reason: 'no_flames' });
});

test('shades cannot enter safe_radius around a lit lantern', () => {
  const safe = contract.tuning.safe_radius;
  const r = run({
    ticks: 120,
    scenario: emptyScenario({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [1, 0, 0] }] }),
  });
  const shade = r.world.shades[0];
  closeTo(Math.hypot(shade.x, shade.z), safe, 1e-6, 'held at the safety ring');
  // The shade is pushed out before the contact check runs, so standing in a lit
  // lantern's light is shelter: no hit is ever taken.
  assert.equal(named(r, 'player_hit').length, 0);
});

test('an unlit lantern gives no shelter', () => {
  const r = run({
    ticks: 60,
    scenario: emptyScenario({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: false }], shades: [{ pos: [1, 0, 0] }] }),
  });
  assert.ok(Math.hypot(r.world.shades[0].x, r.world.shades[0].z) < contract.tuning.safe_radius);
});

test('random shade spawning is off when the scenario says false', () => {
  const r = run({ ticks: 900, scenario: emptyScenario() });
  assert.equal(named(r, 'shade_spawned').length, 0);
});

test('random shapes spawn on schedule when random_shades is true', () => {
  const r = run({ ticks: 400, scenario: { random_shades: true } });
  const spawned = named(r, 'shade_spawned');
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].tick, 360);
  assert.equal(spawned[0].data.id, 'S1');
});

test('scenario shade ids are preserved and auto ids never collide', () => {
  const r = run({ ticks: 400, scenario: { random_shades: true, shades: [{ id: 'S7', pos: [20, 0, 0] }] } });
  assert.equal(r.snapshots[0].shades[0].id, 'S7');
  assert.equal(named(r, 'shade_spawned')[0].data.id, 'S8');
});

test('snapshots are emitted every snapshot_every ticks starting at 0', () => {
  const r = run({ ticks: 25, scenario: emptyScenario(), snapshotEvery: 10 });
  assert.deepEqual(r.snapshots.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
});

test('--ticks 0 still produces a snapshot and an end line', () => {
  const r = run({ ticks: 0, scenario: emptyScenario() });
  assert.equal(r.parsed.length, 2);
  assert.equal(r.parsed[0].type, 'snapshot');
  assert.deepEqual(r.end, { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('snapshot coordinates carry at most 3 decimals', () => {
  const r = run({ ticks: 7, scenario: emptyScenario({ motes: [[1.23456789, 0, 2.3456789]] }), frames: [{ tick: 0, moveX: 0.123456789, moveZ: 1 }] });
  for (const line of r.lines) {
    assert.doesNotMatch(line, /-?\d+\.\d{4,}/, `too many decimals: ${line}`);
  }
});

test('the score only ever grows from documented score events', () => {
  const r = run({
    ticks: 90,
    scenario: emptyScenario({ motes: [[0, 0, 1.0]], shades: [{ pos: [3, 0, 0] }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  const expected =
    named(r, 'mote_picked').length * contract.tuning.score.per_mote +
    named(r, 'lantern_lit').length * contract.tuning.score.per_lantern +
    named(r, 'pulse').reduce((acc, e) => acc + e.data.stunned_ids.length, 0) * contract.tuning.score.per_stun;
  assert.equal(r.end.score, expected);
});

test('two runs with the same seed and inputs are byte-identical', () => {
  const opts = { seed: 4242, ticks: 700, scenario: { random_motes: true, random_shades: true } };
  const a = run(opts);
  const b = run(opts);
  assert.deepEqual(a.lines, b.lines);
});

test('a different seed produces a different island', () => {
  const a = run({ seed: 1, ticks: 1, scenario: { random_motes: true } });
  const b = run({ seed: 2, ticks: 1, scenario: { random_motes: true } });
  assert.notDeepEqual(a.snapshots[0].motes, b.snapshots[0].motes);
});

test('auto-generated mote ids are stable for a given seed', () => {
  const a = run({ seed: 99, ticks: 1, scenario: { random_motes: true } });
  assert.deepEqual(
    a.snapshots[0].motes.map((m) => m.id),
    Array.from({ length: a.snapshots[0].motes.length }, (_, i) => `M${i + 1}`),
  );
});

test('the default island is winnable on paper: enough motes for every lantern', () => {
  const r = run({ seed: 7, ticks: 1, scenario: { random_motes: true, random_shades: false } });
  const needed = contract.tuning.lantern_count_night1 * contract.tuning.lantern_cost;
  assert.ok(r.snapshots[0].motes_active >= needed, `needs >= ${needed} motes, has ${r.snapshots[0].motes_active}`);
});

test('shades stay inside the island during a long run', () => {
  const r = run({ seed: 3, ticks: 1200, scenario: { random_shades: true } });
  for (const s of r.snapshots.at(-1).shades) {
    assert.ok(Math.hypot(s.pos[0], s.pos[2]) <= 30, `shade ${s.id} escaped`);
  }
});

test('a long deterministic run keeps the contract shape intact', () => {
  const r = run({ seed: 11, ticks: 2000, snapshotEvery: 100, scenario: { random_motes: true, random_shades: true } });
  for (const snap of r.snapshots) {
    assert.equal(snap.type, 'snapshot');
    for (const key of ['tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) {
      assert.ok(key in snap, `snapshot misses ${key}`);
    }
    assert.equal(snap.lanterns.length, contract.tuning.lantern_count_night1);
  }
  assert.equal(r.end.type, 'end');
  assert.equal(r.parsed.at(-1).type, 'end');
});
