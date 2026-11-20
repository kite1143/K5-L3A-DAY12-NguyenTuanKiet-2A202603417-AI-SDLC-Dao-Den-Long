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
import { LANTERN_LAYOUT, TUNING } from '../dist/core/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));

test('game.contract.json declares contract_version 1.0 and a team id', () => {
  assert.equal(contract.contract_version, '1.0');
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
    'score',
  ];
  assert.deepEqual(Object.keys(contract.tuning).sort(), [...required].sort());
  assert.deepEqual(Object.keys(contract.tuning.score).sort(), [
    'per_flame_left',
    'per_lantern',
    'per_mote',
    'per_second_left',
    'per_stun',
  ]);
});

test('declared lantern count matches the actual Night 1 layout', () => {
  assert.equal(contract.tuning.lantern_count_night1, LANTERN_LAYOUT.length);
});

test('tuning values are numbers (or the declared booleans) and sane', () => {
  for (const [key, value] of Object.entries(contract.tuning)) {
    if (key === 'score') continue;
    assert.ok(
      typeof value === 'number' || typeof value === 'boolean',
      `tuning.${key} must be a number or boolean`,
    );
  }
  assert.ok(contract.tuning.player_speed > contract.tuning.shade_speed, 'the player must outrun shades');
  assert.ok(contract.tuning.pickup_radius > 0);
  assert.ok(contract.tuning.interact_radius > contract.tuning.pickup_radius);
  assert.equal(contract.tuning.fall_enabled, false, 'Phase 1 disables falling; documented in README');
});
