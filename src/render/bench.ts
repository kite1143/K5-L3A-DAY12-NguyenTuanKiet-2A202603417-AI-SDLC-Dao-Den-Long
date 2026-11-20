import * as THREE from 'three';
import { createWorld, stepWorld } from '../core/index';
import type { ScenarioInput } from '../core/index';
import type { PropSet } from './assets';
import { GameView } from './entities';
import { createStage } from './scene';

/**
 * Benchmark scene for contract v1.3.
 *
 * Fixed scene, identical on every machine: Night 1 with 200 wandering shades,
 * 100 motes and L1–L3 lit at full fuel, no spawning, damage, pickups, fuel burn
 * or night end. The camera orbits (0,0,0) at radius 30 m and height 15 m, one
 * turn every 15 s. The first 3 s are warm-up and are not measured.
 */
export interface BenchOptions {
  seed: number;
  durationS: number;
}

export interface BenchData {
  frames: number;
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
  load_ms: number;
  peak_mem_mb: number | null;
  vsync_off: boolean;
  renderer: string;
  os: string;
  warmup_s: number;
  duration_s: number;
}

const WARMUP_S = 3;
const SHADE_COUNT = 200;
const MOTE_COUNT = 100;
const ORBIT_RADIUS = 30;
const ORBIT_HEIGHT = 15;
const ORBIT_PERIOD_S = 15;

/** Deterministic, evenly spread points on the island disc (golden angle). */
function spread(count: number, radius: number, seed: number): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  const jitter = (seed % 97) * 0.013;
  for (let i = 0; i < count; i += 1) {
    const r = radius * Math.sqrt((i + 0.5) / count);
    const angle = i * 2.399963229728653 + jitter;
    points.push([Math.cos(angle) * r, 0, Math.sin(angle) * r]);
  }
  return points;
}

export function buildBenchScenario(seed: number): ScenarioInput {
  const shades = spread(SHADE_COUNT, 38, seed).map((p, i) => ({
    id: `S${i + 1}`,
    pos: p,
    state: 'wander' as const,
  }));
  return {
    bench: true,
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    motes: spread(MOTE_COUNT, 33, seed + 1),
    shades,
    drifters: [],
    charms: [],
    lanterns: [
      { id: 'L1', lit: true, fuel: 100 },
      { id: 'L2', lit: true, fuel: 100 },
      { id: 'L3', lit: true, fuel: 100 },
    ],
    time_left_s: 100000,
  };
}

function webglRendererName(): string {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) return 'no webgl';
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown';
}

export function runBench(
  renderer: THREE.WebGLRenderer,
  props: PropSet,
  options: BenchOptions,
): void {
  const world = createWorld(options.seed, 1, buildBenchScenario(options.seed));
  const stage = createStage(1, world.map, props);
  const view = new GameView(stage, props);
  view.rebuild(world);

  const camera = stage.camera;
  const target = new THREE.Vector3(0, 1.4, 0);
  const state = {
    done: false,
    data: null as BenchData | null,
    startedAt: 0,
    frames: [] as number[],
  };
  (window as unknown as { __bench: typeof state }).__bench = state;

  let last = performance.now();
  let warmupLeft = WARMUP_S * 1000;
  let measureLeft = options.durationS * 1000;
  let loadMs = 0;
  let firstFrame = true;
  let elapsed = 0;
  let angle = 0;

  const finish = (): void => {
    const dts = state.frames;
    const n = dts.length;
    const sum = dts.reduce((a, b) => a + b, 0);
    const sorted = [...dts].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * n) - 1))] ?? 0;
    const k = Math.max(1, Math.ceil(0.01 * n));
    const worst = [...dts].sort((a, b) => b - a).slice(0, k);
    const worstMean = worst.reduce((a, b) => a + b, 0) / Math.max(1, worst.length);
    state.data = {
      frames: n,
      avg_fps: sum > 0 ? (1000 * n) / sum : 0,
      p1_low_fps: worstMean > 0 ? 1000 / worstMean : 0,
      frame_ms_p95: p95,
      load_ms: loadMs,
      peak_mem_mb: null,
      vsync_off: false,
      renderer: `three.js r180 / ${webglRendererName()}`,
      os: navigator.userAgent,
      warmup_s: WARMUP_S,
      duration_s: options.durationS,
    };
    state.done = true;
  };

  // Reused so the measured loop allocates as little as possible: allocations
  // would show up as the worst 1% of frame times.
  const benchEvents: Parameters<typeof stepWorld>[2] = [];
  const benchInput = {
    moveX: 0,
    moveZ: 0,
    yawDeg: 0,
    pressed: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };

  const frame = (now: number): void => {
    const dt = now - last;
    last = now;
    elapsed += dt;

    if (firstFrame) {
      firstFrame = false;
      loadMs = Math.round(now);
    }

    // Physics: one fixed step per frame is enough for a visual benchmark; the
    // shades only need to keep wandering.
    benchEvents.length = 0;
    stepWorld(world, benchInput, benchEvents);

    // Camera orbit: counter-clockwise seen from above, 15 s per turn.
    angle -= (dt / 1000) * ((Math.PI * 2) / ORBIT_PERIOD_S);
    camera.position.set(
      Math.cos(angle) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.sin(angle) * ORBIT_RADIUS,
    );
    camera.lookAt(target);

    view.sync(world, elapsed / 1000);
    view.update(dt / 1000);
    stage.update(elapsed / 1000);
    const lit = world.lanterns.filter((l) => l.lit).length;
    stage.setLitFraction(lit / world.lanterns.length);
    for (let i = 0; i < stage.lanternLights.length; i += 1) {
      stage.lanternLights[i].intensity = world.lanterns[i]?.lit ? 26 : 0;
    }

    renderer.render(stage.scene, camera);

    if (warmupLeft > 0) {
      warmupLeft -= dt;
    } else if (measureLeft > 0) {
      state.frames.push(dt);
      measureLeft -= dt;
      if (measureLeft <= 0) {
        finish();
        return;
      }
    }
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
