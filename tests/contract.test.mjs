/**
 * The contract file and the runtime tuning must never drift apart: the grader
 * builds scenarios from game.contract.json, so a mismatch silently breaks every
 * hidden test. This suite is the automated guard for that risk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NIGHT_MAPS, PALETTE, TUNING, ambientForLit } from '../dist/core/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));

test('game.contract.json declares contract_version 1.3 and a team id', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.match(contract.team, /^2A202603417-[a-z-]+$/);
});

test('contract commands and the headless entry point exist', () => {
  for (const key of ['build_cmd', 'run_cmd', 'headless_cmd']) {
    assert.equal(typeof contract[key], 'string', `${key} must be a string`);
    assert.ok(contract[key].length > 0, `${key} must not be empty`);
  }
  assert.match(contract.headless_cmd, /^node .*main\.js$/);
  const entry = contract.headless_cmd.replace(/^node /, '');
  assert.ok(existsSync(join(root, entry)), `${entry} must exist (it is committed on purpose)`);
});

test('contract tuning equals the runtime TUNING object', () => {
  assert.deepEqual(contract.tuning, TUNING);
});

test('tuning covers every key the contract requires', () => {
  const required = [
    'player_speed',
    'carry_capacity',
    'lantern_cost',
    'lantern_count_night1',
    'pickup_radius',
    'interact_radius',
    'pulse_cost',
    'pulse_radius',
    'night1_duration_s',
    'night2_duration_s',
    'night3_duration_s',
    'flames',
    'invuln_s',
    'hit_drop_ratio',
    'pulse_stun_s',
    'pulse_push_m',
    'pulse_cooldown_s',
    'safe_radius',
    'shade_speed',
    'shade_hit_radius',
    'fall_enabled',
    'dash_speed',
    'dash_duration_s',
    'dash_cooldown_s',
    'fuel_max',
    'fuel_decay_per_s',
    'fuel_per_mote',
    'relight_cost',
    'win_ratio',
    'drain_per_s',
    'low_fuel_threshold',
    'capacity_max',
    'score',
  ];
  assert.deepEqual(Object.keys(contract.tuning).sort(), [...required].sort());
  assert.deepEqual(Object.keys(contract.tuning.score).sort(), [
    'per_mote',
    'per_lantern',
    'per_relight',
    'per_stun',
    'per_stun_drain',
    'dawn_per_lantern',
    'dawn_per_flame',
    'per_second_left',
    'per_flame_left',
  ].sort());
});

test('tuning carries the canonical numbers from Ticket-03', () => {
  const expected = {
    player_speed: 6.0,
    carry_capacity: 10,
    lantern_cost: 10,
    lantern_count_night1: 5,
    pickup_radius: 1.0,
    interact_radius: 2.0,
    pulse_cost: 3,
    pulse_radius: 5.0,
    night1_duration_s: 240,
    night2_duration_s: 270,
    night3_duration_s: 300,
    flames: 3,
    invuln_s: 1.5,
    pulse_stun_s: 2.0,
    pulse_push_m: 4.0,
    pulse_cooldown_s: 3.0,
    safe_radius: 6.0,
    shade_speed: 4.0,
    shade_hit_radius: 1.0,
    dash_speed: 14.0,
    dash_duration_s: 0.2,
    dash_cooldown_s: 1.5,
    fall_enabled: true,
    fuel_max: 100,
    fuel_decay_per_s: 1.0,
    fuel_per_mote: 10,
    relight_cost: 5,
    win_ratio: 0.6,
    drain_per_s: 5,
    low_fuel_threshold: 30,
    capacity_max: 20,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(contract.tuning[key], value, `tuning.${key}`);
  }
  assert.deepEqual(contract.tuning.score, {
    per_mote: 5,
    per_lantern: 100,
    per_relight: 40,
    per_stun: 5,
    per_stun_drain: 15,
    dawn_per_lantern: 50,
    dawn_per_flame: 50,
    per_second_left: 0,
    per_flame_left: 0,
  });
});

test('declared lantern count matches the Night 1 map', () => {
  assert.equal(contract.tuning.lantern_count_night1, NIGHT_MAPS[1].lanterns.length);
});

test('mounting the night maps: lantern ids and durations match the ticket', () => {
  assert.deepEqual(NIGHT_MAPS[1].lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(NIGHT_MAPS[2].lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  assert.deepEqual(NIGHT_MAPS[3].lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  assert.equal(NIGHT_MAPS[1].durationTicks, 240 * 60);
  assert.equal(NIGHT_MAPS[2].durationTicks, 270 * 60);
  assert.equal(NIGHT_MAPS[3].durationTicks, 300 * 60);
});

test('Night 1 lantern positions are the canonical ones', () => {
  assert.deepEqual(
    NIGHT_MAPS[1].lanterns.map((l) => [l.x, l.y, l.z]),
    [
      [0, 0, 25],
      [23.8, 0, 7.7],
      [14.7, 0, -20.2],
      [-14.7, 0, -20.2],
      [-23.8, 0, 7.7],
    ],
  );
});

test('spawn point counts per night match the ticket', () => {
  assert.equal(NIGHT_MAPS[1].moteSpots.length, 24); // 8 @12 m + 16 @33 m
  assert.equal(NIGHT_MAPS[2].moteSpots.length, 24); // (4 + 8) per island
  assert.equal(NIGHT_MAPS[3].moteSpots.length, 30); // 18 + 8 + 4
  assert.equal(NIGHT_MAPS[1].shadeSpots.length, 12);
  assert.equal(NIGHT_MAPS[2].shadeSpots.length, 16);
  assert.equal(NIGHT_MAPS[3].shadeSpots.length, 16);
});

test('the standard palette is present and the ambient formula matches the ticket', () => {
  assert.equal(PALETTE.lanternLit, '#FFB347');
  assert.equal(PALETTE.shadeRim, '#7A3CFF');
  assert.equal(PALETTE.scarf, '#C8102E');
  assert.equal(PALETTE.shadeRimCb, '#00B3FF', 'colour-blind shade rim');
  assert.equal(PALETTE.dangerCb, '#FFFFFF', 'colour-blind warning colour');
  closeTo(ambientForLit(0, 5), 0.15);
  closeTo(ambientForLit(5, 5), 0.7);
  closeTo(ambientForLit(2, 4), 0.15 + 0.55 * 0.5);
});

function closeTo(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}
