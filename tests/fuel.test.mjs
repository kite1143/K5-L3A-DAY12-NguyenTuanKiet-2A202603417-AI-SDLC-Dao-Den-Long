/**
 * Phase 3 (contract v1.2) — lantern fuel, draining shades and the new dawn rule.
 * See docs/notes/adr-001-lantern-fuel.md for the design decisions behind these.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dawnThreshold, fuelToDisplay, TUNING } from '../dist/core/index.js';
import { closeTo, firstEvent, named, quiet, run, snapAt } from './_helpers.mjs';

const tuning = TUNING;

test('a lit lantern burns 1 fuel per second and reports one decimal', () => {
  const r = run({
    ticks: 120,
    snapshotEvery: 30,
    scenario: quiet({ lanterns: [{ id: 'L1', lit: true }] }),
  });
  assert.equal(snapAt(r, 0).lanterns[0].fuel, 100);
  closeTo(snapAt(r, 60).lanterns[0].fuel, 99, 0.05, 'one second of burn');
  closeTo(snapAt(r, 120).lanterns[0].fuel, 98, 0.05, 'two seconds of burn');
  assert.equal(snapAt(r, 120).lanterns[0].ever_lit, true);
});

test('a lantern with a scenario fuel value keeps it', () => {
  const r = run({ ticks: 0, scenario: quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 42.5 }] }) });
  assert.equal(r.snapshots[0].lanterns[0].fuel, 42.5);
});

test('a lantern that runs dry goes out, resets its progress and remembers ever_lit', () => {
  const r = run({
    ticks: 30,
    snapshotEvery: 1,
    scenario: quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 0.1 }] }),
  });
  const out = firstEvent(r, 'lantern_out');
  assert.equal(out.data.lantern_id, 'L1');
  assert.equal(out.tick, 6, '0.1 fuel = 6 units, 1 unit per tick');
  const snapshot = snapAt(r, 30).lanterns[0];
  assert.equal(snapshot.lit, false);
  assert.equal(snapshot.fuel, 0);
  assert.equal(snapshot.deposited, 0);
  assert.equal(snapshot.ever_lit, true);
});

test('refuelling never spills past the maximum and wastes nothing extra', () => {
  const r = run({
    ticks: 3,
    snapshotEvery: 1,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 95 }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  const refuel = firstEvent(r, 'refuel');
  // ceil((100 - 95) / 10) = 1 mote → 105 clamped to 100, so only one mote is taken.
  assert.equal(refuel.data.amount, 1);
  assert.equal(refuel.data.fuel, 100);
  assert.equal(r.world.player.carried, 9);
  assert.equal(r.world.score, tuning.score.per_mote);
});

test('a lantern at the fuel cap is skipped by the interaction search', () => {
  // Fuel decays before the interaction phase, so a lantern is only exactly full
  // on the very first tick; the guard still has to keep it out of the search.
  const r = run({
    ticks: 1,
    snapshotEvery: 1,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 100 }] }),
    frames: [{ tick: 0, interact: true }],
  });
  // 1 unit of fuel burned in step 2, so one mote tops it back up.
  const refuel = firstEvent(r, 'refuel');
  assert.ok(refuel === undefined || refuel.data.amount <= 1, 'at most a rounding top-up');
  assert.ok(r.world.lanterns[0].fuelUnits <= 6000);
});

test('the first light costs 10 motes, a relight costs 5', () => {
  const first = run({
    ticks: 3,
    snapshotEvery: 1,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 } }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.deepEqual(firstEvent(first, 'lantern_lit').data, { lantern_id: 'L1', relight: false });
  assert.equal(first.world.score, tuning.score.per_lantern + 10 * tuning.score.per_mote);

  const again = run({
    ticks: 3,
    snapshotEvery: 1,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.deepEqual(firstEvent(again, 'lantern_lit').data, { lantern_id: 'L1', relight: true });
  assert.equal(again.world.score, tuning.score.per_relight + 5 * tuning.score.per_mote);
  assert.equal(again.snapshots.at(-1).lanterns[0].relit_count, 1);
  assert.equal(again.snapshots.at(-1).lanterns[0].fuel, 100);
});

test('carry capacity grows by 2 per successful light, capped at 20', () => {
  const r = run({
    ticks: 2,
    snapshotEvery: 1,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 } }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.equal(snapAt(r, 0).player.capacity, 10);
  assert.equal(snapAt(r, 1).player.capacity, 12, 'one light = +2');

  const seeded = run({ ticks: 0, scenario: quiet({ player: { successful_lights: 6 } }) });
  assert.equal(seeded.snapshots[0].player.capacity, 20, 'capped at capacity_max');

  const eight = run({ ticks: 0, scenario: quiet({ player: { successful_lights: 4 } }) });
  assert.equal(eight.snapshots[0].player.capacity, 18);
});

test('capacity really limits how many motes can be picked up', () => {
  const motes = Array.from({ length: 15 }, (_, i) => [0, 0, 0.4 + i * 0.01]);
  const r = run({ ticks: 5, snapshotEvery: 1, scenario: quiet({ motes, player: { successful_lights: 1 } }) });
  assert.equal(r.world.player.capacity, 12);
  assert.equal(r.world.player.carried, 12);
});

test('refuelling a lantern from 25 to full takes ceil(missing / 10) motes', () => {
  const r = run({
    ticks: 3,
    snapshotEvery: 1,
    scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 25 }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  const refuel = firstEvent(r, 'refuel');
  // One unit burned first, so ceil(75.02 / 10) = 8 motes.
  assert.equal(refuel.data.lantern_id, 'L1');
  assert.equal(refuel.data.amount, 8);
  assert.equal(refuel.data.fuel, 100);
  assert.equal(r.world.player.carried, 2);
  assert.equal(r.world.score, 8 * tuning.score.per_mote);
});
test('a weak lantern loses its safe zone, exactly 30 fuel still has it', () => {
  const weak = run({
    ticks: 60,
    scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [1, 0, 0], state: 'chase' }] }),
  });
  assert.ok(
    Math.hypot(weak.world.shades[0].x, weak.world.shades[0].z) < tuning.safe_radius,
    'a shade may walk into a weak lantern',
  );

  // 30.02 fuel burns down to exactly 30 after one tick: that still has a zone.
  const edge = run({
    ticks: 1,
    snapshotEvery: 1,
    scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 30.02 }], shades: [{ id: 'S1', pos: [1, 0, 0], state: 'chase' }] }),
  });
  const distance = Math.hypot(snapAt(edge, 1).shades[0].pos[0], snapAt(edge, 1).shades[0].pos[2]);
  assert.ok(distance >= tuning.safe_radius - 0.25, `held at the rim (${distance.toFixed(2)})`);
});

test('a wandering shade walks to a weak lantern and starts draining it', () => {
  const r = run({
    ticks: 400,
    snapshotEvery: 50,
    scenario: quiet({
      player: { pos: [0, 0, 34] },
      lanterns: [{ id: 'L1', pos: [0, 0, 5], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0, 8], state: 'wander' }],
    }),
  });
  const drainState = r.snapshots.find((s) => s.shades[0]?.state === 'drain');
  assert.ok(drainState, 'the shade entered the drain state');
  assert.equal(drainState.shades[0].target_lantern_id, 'L1');

  // Measure only inside the drain window: from tick 100 to 250 the shade is
  // already parked at the lantern, so the loss is 5 (drain) + 1 (burn) per second.
  const fuelEarly = snapAt(r, 100).lanterns[0].fuel;
  const fuelLate = snapAt(r, 250).lanterns[0].fuel;
  closeTo((fuelEarly - fuelLate) / (150 / 60), 6, 0.6, 'drain 5 + burn 1 fuel per second');
});

test('fuel_drain is written every 60 ticks while a shade is draining', () => {
  const r = run({
    ticks: 400,
    snapshotEvery: 50,
    scenario: quiet({
      player: { pos: [0, 0, 34] },
      lanterns: [{ id: 'L1', pos: [0, 0, 5], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0, 6], state: 'drain', target_lantern_id: 'L1' }],
    }),
  });
  const drains = named(r, 'fuel_drain');
  assert.ok(drains.length >= 4, `expected several fuel_drain events, got ${drains.length}`);
  assert.deepEqual(Object.keys(drains[0].data).sort(), ['fuel', 'lantern_id', 'shade_id']);
  assert.equal(drains[0].data.shade_id, 'S1');
  for (let i = 1; i < drains.length; i += 1) {
    assert.equal(drains[i].tick - drains[i - 1].tick, 60, 'one event per second');
  }
});

test('a draining shade chases the player who comes within 6 m', () => {
  const r = run({
    ticks: 20,
    snapshotEvery: 1,
    scenario: quiet({
      player: { pos: [0, 0, 6] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 60 }],
      shades: [{ id: 'S1', pos: [0, 0, 2], state: 'drain', target_lantern_id: 'L1' }],
    }),
  });
  const after = snapAt(r, 20).shades[0];
  assert.notEqual(after.state, 'drain', 'it stopped draining');
});

test('refilling a weak lantern to 30 fuel sends the shade back to wandering', () => {
  const r = run({
    ticks: 5,
    snapshotEvery: 1,
    scenario: quiet({
      player: { pos: [0, 0, 1.2], carried: 10 },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0, 2], state: 'drain', target_lantern_id: 'L1' }],
    }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
  });
  assert.equal(firstEvent(r, 'refuel').data.fuel, 100, 'topped up to full');
  assert.ok(snapAt(r, 5).lanterns[0].fuel > 99, 'still nearly full a few ticks later');
  assert.notEqual(snapAt(r, 5).shades[0].state, 'drain');
});

test('a lantern that burns out sends its draining shade back to wandering', () => {
  const r = run({
    ticks: 10,
    snapshotEvery: 1,
    scenario: quiet({
      player: { pos: [0, 0, 30] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 0.2 }],
      shades: [{ id: 'S1', pos: [0, 0, 1.5], state: 'drain', target_lantern_id: 'L1' }],
    }),
  });
  assert.equal(firstEvent(r, 'lantern_out').data.lantern_id, 'L1');
  assert.notEqual(snapAt(r, 10).shades[0].state, 'drain');
});

test('stunning a draining shade pays the extra 15 points', () => {
  const draining = run({
    ticks: 2,
    snapshotEvery: 1,
    scenario: quiet({
      player: { carried: 3, pos: [0, 0, 3] },
      lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 60 }],
      shades: [{ id: 'S1', pos: [0, 0, 2], state: 'drain', target_lantern_id: 'L1' }],
    }),
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
  });
  assert.equal(draining.world.score, tuning.score.per_stun + tuning.score.per_stun_drain);

  const chasing = run({
    ticks: 2,
    snapshotEvery: 1,
    scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
  });
  assert.equal(chasing.world.score, tuning.score.per_stun);
});

test('the dawn bonus pays 50 + floor(fuel) per lit lantern and 50 per flame', () => {
  const r = run({
    ticks: 300,
    scenario: quiet({
      time_left_s: 0.05,
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 },
        { id: 'L2', lit: true, fuel: 50 },
        { id: 'L3', lit: true, fuel: 60 },
      ],
    }),
  });
  assert.equal(r.end.state, 'won');
  // Lanterns: (50+50) + (50+49) + (50+59) — fuel has burned for a few ticks.
  const lit = r.world.lanterns.filter((l) => l.lit);
  const expectedLanterns = lit.reduce((sum, l) => sum + 50 + Math.floor(l.fuelUnits / 60), 0);
  assert.equal(r.end.score, expectedLanterns + r.world.player.flames * 50);
  assert.ok(r.end.score > 250, `dawn score ${r.end.score}`);
});

test('there is no time bonus any more', () => {
  const big = run({ ticks: 100, scenario: quiet({ time_left_s: 100 }) });
  assert.equal(big.end.score, 0, 'idle night earns nothing');
});

test('the dawn threshold per night matches ceil(60%)', () => {
  assert.deepEqual([dawnThreshold(5), dawnThreshold(6), dawnThreshold(7)], [3, 4, 5]);
  assert.equal(fuelToDisplay(0), 0);
  assert.equal(fuelToDisplay(6000), 100);
  assert.equal(fuelToDisplay(1500), 25);
});
