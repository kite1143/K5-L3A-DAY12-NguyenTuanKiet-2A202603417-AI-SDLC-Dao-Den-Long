/**
 * Scenario (contract v1.1, section D) and input file (section C) parsing.
 * Malformed input must make the headless runner exit with code 2, so every
 * helper here throws `ContractFormatError`.
 */
import type { DrifterState, ShadeState } from './types';

export class ContractFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractFormatError';
  }
}

export interface ScenarioPlayer {
  pos?: [number, number, number];
  carried?: number;
  flames?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
}

export interface ScenarioLantern {
  id: string;
  pos?: [number, number, number];
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: [number, number, number];
  state?: ShadeState;
  state_ticks_left?: number;
}

export interface ScenarioDrifter {
  id?: string;
  pos: [number, number, number];
  state?: DrifterState;
}

export interface ScenarioCharm {
  id: string;
  pos: [number, number, number];
}

export interface ScenarioInput {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Array<[number, number, number]>;
  shades?: ScenarioShade[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

const SHADE_STATES: ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES: DrifterState[] = ['idle', 'chase', 'flee', 'removed'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ContractFormatError(`${where} must be a finite number`);
  }
  return v;
}

function nonNegativeInt(v: unknown, where: string): number {
  const n = num(v, where);
  if (!Number.isInteger(n) || n < 0) throw new ContractFormatError(`${where} must be a non-negative integer`);
  return n;
}

function vec3(v: unknown, where: string): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3) throw new ContractFormatError(`${where} must be an array of 3 numbers`);
  return [num(v[0], `${where}[0]`), num(v[1], `${where}[1]`), num(v[2], `${where}[2]`)];
}

function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') throw new ContractFormatError(`${where} must be a boolean`);
  return v;
}

export function parseScenario(raw: unknown): ScenarioInput {
  if (!isRecord(raw)) throw new ContractFormatError('scenario must be a JSON object');
  const out: ScenarioInput = {};

  if (raw.player !== undefined) {
    if (!isRecord(raw.player)) throw new ContractFormatError('player must be an object');
    const p: ScenarioPlayer = {};
    if (raw.player.pos !== undefined) p.pos = vec3(raw.player.pos, 'player.pos');
    if (raw.player.carried !== undefined) p.carried = nonNegativeInt(raw.player.carried, 'player.carried');
    if (raw.player.flames !== undefined) p.flames = nonNegativeInt(raw.player.flames, 'player.flames');
    if (raw.player.invuln_ticks !== undefined) {
      p.invuln_ticks = nonNegativeInt(raw.player.invuln_ticks, 'player.invuln_ticks');
    }
    if (raw.player.dash_cd_ticks !== undefined) {
      p.dash_cd_ticks = nonNegativeInt(raw.player.dash_cd_ticks, 'player.dash_cd_ticks');
    }
    if (raw.player.pulse_cd_ticks !== undefined) {
      p.pulse_cd_ticks = nonNegativeInt(raw.player.pulse_cd_ticks, 'player.pulse_cd_ticks');
    }
    if (raw.player.charm_ticks !== undefined) {
      p.charm_ticks = nonNegativeInt(raw.player.charm_ticks, 'player.charm_ticks');
    }
    out.player = p;
  }

  if (raw.random_motes !== undefined) out.random_motes = bool(raw.random_motes, 'random_motes');
  if (raw.random_shades !== undefined) out.random_shades = bool(raw.random_shades, 'random_shades');
  if (raw.random_drifters !== undefined) out.random_drifters = bool(raw.random_drifters, 'random_drifters');
  if (raw.wind_enabled !== undefined) out.wind_enabled = bool(raw.wind_enabled, 'wind_enabled');

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) throw new ContractFormatError('motes must be an array');
    out.motes = raw.motes.map((m, i) => vec3(m, `motes[${i}]`));
  }

  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) throw new ContractFormatError('shades must be an array');
    out.shades = raw.shades.map((s, i) => {
      if (!isRecord(s)) throw new ContractFormatError(`shades[${i}] must be an object`);
      const shade: ScenarioShade = { pos: vec3(s.pos, `shades[${i}].pos`) };
      if (s.id !== undefined) {
        if (typeof s.id !== 'string' || s.id.length === 0) {
          throw new ContractFormatError(`shades[${i}].id must be a non-empty string`);
        }
        shade.id = s.id;
      }
      if (s.state !== undefined) {
        if (typeof s.state !== 'string' || !SHADE_STATES.includes(s.state as ShadeState)) {
          throw new ContractFormatError(`shades[${i}].state must be one of ${SHADE_STATES.join(', ')}`);
        }
        shade.state = s.state as ShadeState;
      }
      if (s.state_ticks_left !== undefined) {
        shade.state_ticks_left = nonNegativeInt(s.state_ticks_left, `shades[${i}].state_ticks_left`);
      }
      return shade;
    });
  }

  if (raw.drifters !== undefined) {
    if (!Array.isArray(raw.drifters)) throw new ContractFormatError('drifters must be an array');
    out.drifters = raw.drifters.map((d, i) => {
      if (!isRecord(d)) throw new ContractFormatError(`drifters[${i}] must be an object`);
      const drifter: ScenarioDrifter = { pos: vec3(d.pos, `drifters[${i}].pos`) };
      if (d.id !== undefined) {
        if (typeof d.id !== 'string' || d.id.length === 0) {
          throw new ContractFormatError(`drifters[${i}].id must be a non-empty string`);
        }
        drifter.id = d.id;
      }
      if (d.state !== undefined) {
        if (typeof d.state !== 'string' || !DRIFTER_STATES.includes(d.state as DrifterState)) {
          throw new ContractFormatError(`drifters[${i}].state must be one of ${DRIFTER_STATES.join(', ')}`);
        }
        drifter.state = d.state as DrifterState;
      }
      return drifter;
    });
  }

  if (raw.charms !== undefined) {
    if (!Array.isArray(raw.charms)) throw new ContractFormatError('charms must be an array');
    out.charms = raw.charms.map((c, i) => {
      if (!isRecord(c)) throw new ContractFormatError(`charms[${i}] must be an object`);
      if (typeof c.id !== 'string' || c.id.length === 0) {
        throw new ContractFormatError(`charms[${i}].id must be a non-empty string`);
      }
      return { id: c.id, pos: vec3(c.pos, `charms[${i}].pos`) };
    });
  }

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) throw new ContractFormatError('lanterns must be an array');
    out.lanterns = raw.lanterns.map((l, i) => {
      if (!isRecord(l)) throw new ContractFormatError(`lanterns[${i}] must be an object`);
      if (typeof l.id !== 'string' || l.id.length === 0) {
        throw new ContractFormatError(`lanterns[${i}].id must be a non-empty string`);
      }
      const lantern: ScenarioLantern = { id: l.id };
      if (l.pos !== undefined) lantern.pos = vec3(l.pos, `lanterns[${i}].pos`);
      if (l.deposited !== undefined) lantern.deposited = nonNegativeInt(l.deposited, `lanterns[${i}].deposited`);
      if (l.lit !== undefined) lantern.lit = bool(l.lit, `lanterns[${i}].lit`);
      return lantern;
    });
  }

  if (raw.time_left_s !== undefined) {
    const t = num(raw.time_left_s, 'time_left_s');
    if (t < 0) throw new ContractFormatError('time_left_s must be >= 0');
    out.time_left_s = t;
  }

  return out;
}

export interface InputFrame {
  tick: number;
  moveX?: number;
  moveZ?: number;
  yawDeg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputsInput {
  frames: InputFrame[];
}

export function parseInputs(raw: unknown): InputsInput {
  if (!isRecord(raw)) throw new ContractFormatError('inputs must be a JSON object');
  if (!Array.isArray(raw.frames)) throw new ContractFormatError('inputs.frames must be an array');

  let lastTick = -1;
  const frames: InputFrame[] = raw.frames.map((f, i) => {
    if (!isRecord(f)) throw new ContractFormatError(`frames[${i}] must be an object`);
    const tick = nonNegativeInt(f.tick, `frames[${i}].tick`);
    if (tick <= lastTick) throw new ContractFormatError('frames[].tick must increase strictly');
    lastTick = tick;

    const frame: InputFrame = { tick };
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2) {
        throw new ContractFormatError(`frames[${i}].move must be [x, z]`);
      }
      frame.moveX = num(f.move[0], `frames[${i}].move[0]`);
      frame.moveZ = num(f.move[1], `frames[${i}].move[1]`);
    }
    if (f.cam_yaw_deg !== undefined) frame.yawDeg = num(f.cam_yaw_deg, `frames[${i}].cam_yaw_deg`);
    if (f.jump !== undefined) frame.jump = bool(f.jump, `frames[${i}].jump`);
    if (f.interact !== undefined) frame.interact = bool(f.interact, `frames[${i}].interact`);
    if (f.pulse !== undefined) frame.pulse = bool(f.pulse, `frames[${i}].pulse`);
    if (f.dash !== undefined) frame.dash = bool(f.dash, `frames[${i}].dash`);
    if (f.pause !== undefined) frame.pause = bool(f.pause, `frames[${i}].pause`);
    return frame;
  });

  return { frames };
}
