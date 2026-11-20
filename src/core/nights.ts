import { TICKS_PER_SECOND, TUNING, WIND_DURATION_TICKS, WIND_PERIOD_TICKS, WIND_WARN_TICKS, WIND_GUST_OFFSET_TICKS, WIND_PUSH_SPEED } from './config';

export type NightId = 1 | 2 | 3;
export const NIGHT_IDS: readonly NightId[] = [1, 2, 3];

/** A point in the world; `y` is the ground height there for spawn points. */
export interface Spot {
  x: number;
  y: number;
  z: number;
}

export interface LanternSpec {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface PadSpec {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Vertical launch speed (m/s). */
  vy: number;
  /** Horizontal launch speed (m/s). */
  speed: number;
  dirX: number;
  dirZ: number;
}

export interface CharmSpec {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface ShadeSchedule {
  firstTick: number;
  intervalTicks: number;
  batch: number;
  max: number;
}

export interface WindSchedule {
  periodTicks: number;
  durationTicks: number;
  warnTicks: number;
  pushSpeed: number;
  gustOffsetTicks: number;
}

export interface NightMap {
  id: NightId;
  name: string;
  label: string;
  durationTicks: number;
  spawn: Spot;
  moteSpots: Spot[];
  lanterns: LanternSpec[];
  shadeSpots: Array<{ x: number; z: number }>;
  shadeSchedule: ShadeSchedule;
  shadeSpeed: number;
  pads: PadSpec[];
  charms: CharmSpec[];
  drifters: boolean;
  wind: WindSchedule | null;
  /** Ground height at (x, z); `VOID` means there is no ground (a fall). */
  height(x: number, z: number): number;
}

export const VOID = Number.NEGATIVE_INFINITY;

const DEG = Math.PI / 180;

/** Points on a circle of `radius` around (cx, cz), `count` of them. */
function ring(count: number, radius: number, startDeg: number, stepDeg: number, cx = 0, cz = 0): Array<{ x: number; z: number }> {
  const points: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const a = (startDeg + i * stepDeg) * DEG;
    points.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
  }
  return points;
}

function spot(x: number, z: number, height: (x: number, z: number) => number): Spot {
  const y = height(x, z);
  return { x, y: Number.isFinite(y) ? y : 0, z };
}

function withHeights(points: Array<{ x: number; z: number }>, height: (x: number, z: number) => number): Spot[] {
  return points.map((p) => spot(p.x, p.z, height));
}

// --- Night 1: Đảo Bến ------------------------------------------------------

const NIGHT1_RADIUS = 40;

function night1Height(x: number, z: number): number {
  return Math.hypot(x, z) <= NIGHT1_RADIUS ? 0 : VOID;
}

const night1: NightMap = {
  id: 1,
  name: 'Đảo Bến',
  label: 'Đêm 1 — Đảo Bến',
  durationTicks: TUNING.night1_duration_s * TICKS_PER_SECOND,
  spawn: { x: 0, y: 0, z: 0 },
  moteSpots: withHeights([...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)], night1Height),
  lanterns: [
    { id: 'L1', x: 0, y: 0, z: 25 },
    { id: 'L2', x: 23.8, y: 0, z: 7.7 },
    { id: 'L3', x: 14.7, y: 0, z: -20.2 },
    { id: 'L4', x: -14.7, y: 0, z: -20.2 },
    { id: 'L5', x: -23.8, y: 0, z: 7.7 },
  ],
  shadeSpots: ring(12, 37, 15, 30),
  shadeSchedule: { firstTick: 300, intervalTicks: 480, batch: 2, max: 6 },
  shadeSpeed: TUNING.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  wind: null,
  height: night1Height,
};

// --- Night 2: Đảo Cau ------------------------------------------------------

const N2_A = { x: 0, z: 0 };
const N2_B = { x: 70, z: 0 };
const N2_ISLAND_RADIUS = 28;
const N2_BRIDGE = { xMin: 26, xMax: 44, halfZ: 2 };

function night2Height(x: number, z: number): number {
  if (Math.hypot(x - N2_A.x, z - N2_A.z) <= N2_ISLAND_RADIUS) return 0;
  if (Math.hypot(x - N2_B.x, z - N2_B.z) <= N2_ISLAND_RADIUS) return 0;
  if (x >= N2_BRIDGE.xMin && x <= N2_BRIDGE.xMax && Math.abs(z) <= N2_BRIDGE.halfZ) return 0;
  return VOID;
}

function padFrom(x: number, y: number, z: number, towardX: number, towardZ: number, vy: number, speed: number): PadSpec {
  const dx = towardX - x;
  const dz = towardZ - z;
  const len = Math.hypot(dx, dz) || 1;
  return { x, y, z, radius: 1, vy, speed, dirX: dx / len, dirZ: dz / len };
}

const night2: NightMap = {
  id: 2,
  name: 'Đảo Cau',
  label: 'Đêm 2 — Đảo Cau',
  durationTicks: TUNING.night2_duration_s * TICKS_PER_SECOND,
  spawn: { x: 0, y: 0, z: 0 },
  moteSpots: withHeights(
    [
      ...ring(4, 10, 0, 90, N2_A.x, N2_A.z),
      ...ring(8, 22, 0, 45, N2_A.x, N2_A.z),
      ...ring(4, 10, 0, 90, N2_B.x, N2_B.z),
      ...ring(8, 22, 0, 45, N2_B.x, N2_B.z),
    ],
    night2Height,
  ),
  lanterns: [
    { id: 'L1', x: 0, y: 0, z: 20 },
    { id: 'L2', x: 17, y: 0, z: -10 },
    { id: 'L3', x: -17, y: 0, z: -10 },
    { id: 'L4', x: 70, y: 0, z: 20 },
    { id: 'L5', x: 87, y: 0, z: -10 },
    { id: 'L6', x: 53, y: 0, z: -10 },
  ],
  shadeSpots: [
    ...ring(8, 26, 22.5, 45, N2_A.x, N2_A.z),
    ...ring(8, 26, 22.5, 45, N2_B.x, N2_B.z),
  ],
  shadeSchedule: { firstTick: 300, intervalTicks: 420, batch: 1, max: 8 },
  shadeSpeed: TUNING.shade_speed,
  pads: [
    padFrom(20, 0, 18, N2_B.x, N2_B.z, 14, 24),
    padFrom(50, 0, -18, N2_A.x, N2_A.z, 14, 24),
  ],
  charms: [{ id: 'C1', x: 35, y: 0, z: 0 }],
  drifters: true,
  wind: null,
  height: night2Height,
};

// --- Night 3: Đảo Chuông ---------------------------------------------------

const N3_RADIUS = 45;
const N3_TIER1 = { minRadius: 12, maxRadius: 24, y: 3 };
const N3_TIER2 = { radius: 8, y: 6 };
const N3_RAMP_ANGLES = [30, 150];
const N3_RAMP = { innerRadius: 24, outerRadius: 30, halfWidth: 1.5 };

/** Height of the two radial ramps, or null when (x, z) is not on one. */
function rampHeight(x: number, z: number): number | null {
  for (const deg of N3_RAMP_ANGLES) {
    const a = deg * DEG;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const along = x * dx + z * dz;
    if (along < N3_RAMP.innerRadius || along > N3_RAMP.outerRadius) continue;
    const perp = Math.abs(-x * dz + z * dx);
    if (perp > N3_RAMP.halfWidth) continue;
    // Flat across the width, rising linearly with the radius: 0 at 30 m, 3 at 24 m.
    return ((N3_RAMP.outerRadius - along) / (N3_RAMP.outerRadius - N3_RAMP.innerRadius)) * N3_TIER1.y;
  }
  return null;
}

function night3Height(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r > N3_RADIUS) return VOID;
  if (r <= N3_TIER2.radius) return N3_TIER2.y;
  const ramp = rampHeight(x, z);
  if (ramp !== null) return ramp;
  if (z > 0 && r >= N3_TIER1.minRadius && r <= N3_TIER1.maxRadius) return N3_TIER1.y;
  return 0;
}

const night3: NightMap = {
  id: 3,
  name: 'Đảo Chuông',
  label: 'Đêm 3 — Đảo Chuông',
  durationTicks: TUNING.night3_duration_s * TICKS_PER_SECOND,
  // The ticket fixes no start point for night 3; (0, -30) is open tier-0 ground
  // instead of the bell tower's disc at the centre.
  spawn: { x: 0, y: 0, z: -30 },
  moteSpots: withHeights(
    [...ring(18, 34, 0, 20), ...ring(8, 18, 20, 20), ...ring(4, 5, 45, 90)],
    night3Height,
  ),
  lanterns: [
    { id: 'L1', x: 0, y: 6, z: 6 },
    { id: 'L2', x: 18, y: 3, z: 10 },
    { id: 'L3', x: -18, y: 3, z: 10 },
    { id: 'L4', x: 35, y: 0, z: -10 },
    { id: 'L5', x: -35, y: 0, z: -10 },
    { id: 'L6', x: 20, y: 0, z: -35 },
    { id: 'L7', x: -20, y: 0, z: -35 },
  ],
  shadeSpots: ring(16, 43, 0, 22.5),
  shadeSchedule: { firstTick: 300, intervalTicks: 360, batch: 1, max: 10 },
  shadeSpeed: 4.5,
  pads: [padFrom(0, 3, 13, 0, 13 - 1, 12, 8)],
  charms: [
    { id: 'C1', x: 30, y: 0, z: 25 },
    { id: 'C2', x: -30, y: 0, z: 25 },
  ],
  drifters: true,
  wind: {
    periodTicks: WIND_PERIOD_TICKS,
    durationTicks: WIND_DURATION_TICKS,
    warnTicks: WIND_WARN_TICKS,
    pushSpeed: WIND_PUSH_SPEED,
    gustOffsetTicks: WIND_GUST_OFFSET_TICKS,
  },
  height: night3Height,
};

export const NIGHT_MAPS: Record<NightId, NightMap> = { 1: night1, 2: night2, 3: night3 };

export function nightMap(id: NightId): NightMap {
  return NIGHT_MAPS[id];
}

/** Bridge and pad constants are exported for the renderer and tests. */
export const NIGHT2_GEOMETRY = { islands: [N2_A, N2_B], islandRadius: N2_ISLAND_RADIUS, bridge: N2_BRIDGE };
export const NIGHT3_GEOMETRY = {
  radius: N3_RADIUS,
  tier1: N3_TIER1,
  tier2: N3_TIER2,
  ramps: { angles: N3_RAMP_ANGLES, ...N3_RAMP },
  tower: { radius: 2, height: 8 },
};
