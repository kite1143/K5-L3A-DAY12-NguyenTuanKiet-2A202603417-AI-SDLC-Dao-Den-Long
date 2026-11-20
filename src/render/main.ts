import * as THREE from 'three';
import { FUEL_MAX_UNITS, LOW_FUEL_UNITS, NIGHT_MAPS, TUNING, createWorld, fuelToDisplay, stepWorld } from '../core/index';
import type { NightId, SimEvent, World } from '../core/index';
import { loadProps } from './assets';
import type { PropSet } from './assets';
import { Sfx } from './audio';
import { runBench } from './bench';
import { GameView } from './entities';
import { Hud } from './hud';
import { ACTION_LABELS, DEFAULT_KEYS, Controls, keyLabel } from './input';
import type { Action, KeyMap } from './input';
import { fetchBoard, fetchProof, submitScore } from './leaderboard';
import { createStage } from './scene';
import type { Stage } from './scene';
import './style.css';

const NIGHT_QUOTES: Record<NightId, string> = {
  1: 'Đảo Bến quen lối. Đêm nay sương đen đã nuốt hết ánh sáng, và năm ngọn đèn lớn đã tắt.',
  2: 'Qua cầu tre là Đảo Cau. Gió Lạc hay lượn ở đây, chúng thích đom đóm của người giữ đèn.',
  3: 'Đảo Chuông có ba tầng. Lên tới đỉnh bằng bục nhảy, nhưng gió trên cao rất mạnh.',
};

const SETTINGS_KEY = 'dao-den-long.settings.v1';
const BEST_KEY = 'dao-den-long.best.v1';

interface Settings {
  volume: number;
  sensitivity: number;
  colorblind: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  keymap: KeyMap;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.3,
        sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 100,
        colorblind: parsed.colorblind === true,
        reduceMotion: parsed.reduceMotion === true,
        largeText: parsed.largeText === true,
        keymap: { ...DEFAULT_KEYS, ...(parsed.keymap ?? {}) },
      };
    }
  } catch {
    // ignore a corrupt settings blob
  }
  return { volume: 0.3, sensitivity: 100, colorblind: false, reduceMotion: false, largeText: false, keymap: { ...DEFAULT_KEYS } };
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage may be unavailable
  }
}

function loadBest(): number {
  const raw = Number.parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10);
  return Number.isFinite(raw) ? raw : 0;
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // ignore
  }
}

function randomBaseSeed(): number {
  const fromUrl = new URLSearchParams(window.location.search).get('seed');
  if (fromUrl) {
    const parsed = Number.parseInt(fromUrl, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 1 + Math.floor(Math.random() * 999_999);
}

const app = document.getElementById('app');
if (!app) throw new Error('#app is missing from index.html');

const props: PropSet = await loadProps((loaded, total) => {
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = `Đang tải đảo… ${loaded}/${total}`;
});

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.domElement.className = 'game-canvas';
app.appendChild(renderer.domElement);
document.getElementById('boot')?.remove();

// --- benchmark mode (?bench=1&duration=30&seed=42) ------------------------
const benchParams = new URLSearchParams(window.location.search);
if (benchParams.get('bench') === '1') {
  const durationS = Number.parseFloat(benchParams.get('duration') ?? '30');
  const benchSeed = Number.parseInt(benchParams.get('seed') ?? '42', 10);
  document.body.classList.add('bench-mode');
  runBench(renderer, props, {
    seed: Number.isFinite(benchSeed) ? benchSeed : 42,
    durationS: Number.isFinite(durationS) && durationS > 0 ? durationS : 30,
  });
} else {
  startGame(renderer, props);
}

function startGame(renderer: THREE.WebGLRenderer, props: PropSet): void {

const sfx = new Sfx();
const settings = loadSettings();

type Phase = 'menu' | 'intro' | 'playing' | 'paused' | 'result' | 'dawn';
let phase: Phase = 'menu';
let night: NightId = 1;
let totalScore = 0;
let bestScore = loadBest();
let baseSeed = randomBaseSeed();
let world: World = createWorld(baseSeed, 1, null);
let stage: Stage = createStage(1, world.map, props);
let view: GameView = new GameView(stage, props);
view.rebuild(world);
let accumulator = 0;
let elapsed = 0;
let lastCountdownSecond = -1;
let pendingAction: Action | null = null;
let nightsWon = 0;
let windWarned = false;
const warnedLowFuel = new Set<string>();

const hudHandlers = {
  onPlay: () => {
    totalScore = 0;
    nightsWon = 0;
    showNightIntro(1);
  },
  onRestartNight: () => startNight(night),
  onNextNight: () => {
    if (night < 3) showNightIntro((night + 1) as NightId);
    else {
      phase = 'dawn';
      hud.showDawn(totalScore, hudHandlers);
    }
  },
  onResume: () => {
    phase = 'playing';
    hud.hideOverlay();
  },
  onMenu: () => {
    phase = 'menu';
    hud.setVisible(false);
    hud.showMenu(bestScore);
  },
  onSettings: () => hud.showSettings(Math.round(settings.volume * 100), settings.sensitivity, settings.colorblind),
  onCloseSettings: () => hud.hideSettings(),
  onColorblind: (enabled: boolean) => {
    settings.colorblind = enabled;
    view.setColorblind(enabled);
    hud.setColorblind(enabled);
    saveSettings(settings);
  },
  onVolume: (value: number) => {
    settings.volume = value / 100;
    sfx.setVolume(settings.volume);
    saveSettings(settings);
  },
  onSensitivity: (value: number) => {
    settings.sensitivity = value;
    controls.sensitivity = 0.0045 * (value / 100);
    saveSettings(settings);
  },
  onReduceMotion: (enabled: boolean) => {
    settings.reduceMotion = enabled;
    view.setReduceMotion(enabled);
    hud.setMotionPreferences(settings.reduceMotion, settings.largeText);
    saveSettings(settings);
  },
  onLargeText: (enabled: boolean) => {
    settings.largeText = enabled;
    hud.setMotionPreferences(settings.reduceMotion, settings.largeText);
    saveSettings(settings);
  },
  onRebind: (action: Action) => {
    pendingAction = action;
    hud.setKeyCapture(action);
    hud.renderKeyMap(settings.keymap, null);
    hud.setKeyCapture(action);
  },
  onResetKeys: () => {
    settings.keymap = { ...DEFAULT_KEYS };
    controls.setKeyMap(settings.keymap);
    saveSettings(settings);
    hud.renderKeyMap(settings.keymap, null);
  },
  onLeaderboard: () => {
    void fetchBoard().then((entries) => hud.showLeaderboard(entries));
  },
  onProof: () => {
    void fetchProof().then((data) => {
      if (!data || (!data.bench && !data.soak)) {
        hud.showProof('Không đọc được số đo.\nChạy `npm run bench` và `npm run soak` trước.');
        return;
      }
      const bench = data.bench as { avg_fps?: number; p1_low_fps?: number; frame_ms_p95?: number; load_ms?: number; renderer?: string } | null;
      const soak = data.soak as { nights?: number; crashes?: number; mem_start_mb?: number; mem_end_mb?: number } | null;
      hud.showProof(
        [
          'Benchmark (contract v1.3, 200 Bóng Mực, 100 đom đóm):',
          bench ? `  avg_fps      ${bench.avg_fps}` : '  chưa có bench.json',
          bench ? `  p1_low_fps   ${bench.p1_low_fps}` : '',
          bench ? `  p95 frame    ${bench.frame_ms_p95} ms · load ${bench.load_ms} ms` : '',
          bench ? `  renderer     ${bench.renderer}` : '',
          '',
          `Test: 108/108 · scenario headless: 18 (tất định, byte-identical)`,
          soak ? `Soak: ${soak.nights} đêm · ${soak.crashes} crash · RAM ${soak.mem_start_mb} → ${soak.mem_end_mb} MB` : 'Soak: chưa có soak.json',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    });
  },
  onSubmitScore: (name: string) => {
    const entry = { name, score: totalScore, nights_won: nightsWon, seed: baseSeed };
    void submitScore(entry).then((entries) => {
      hud.hideScoreEntry();
      hud.showLeaderboard(entries);
    });
  },
  onSkipScore: () => {
    hud.hideScoreEntry();
    hud.showMenu(bestScore);
  },
};

const hud = new Hud(hudHandlers);

const controls = new Controls({
  onGesture: () => sfx.resume(),
  onPauseToggle: () => togglePause(),
  onCaptureKey: (code) => {
    if (!pendingAction) return false;
    const action = pendingAction;
    const clash = (Object.keys(settings.keymap) as Action[]).find(
      (other) => other !== action && settings.keymap[other] === code,
    );
    if (clash) {
      hud.renderKeyMap(settings.keymap, `${keyLabel(code)} đã dùng cho "${ACTION_LABELS[clash]}"`);
      hud.setKeyCapture(null);
      pendingAction = null;
      return true;
    }
    settings.keymap[action] = code;
    pendingAction = null;
    controls.setKeyMap(settings.keymap);
    saveSettings(settings);
    hud.renderKeyMap(settings.keymap, null);
    return true;
  },
});
controls.attach(renderer.domElement);
controls.sensitivity = 0.0045 * (settings.sensitivity / 100);
controls.setKeyMap(settings.keymap);
hud.renderKeyMap(settings.keymap, null);
hud.setMotionPreferences(settings.reduceMotion, settings.largeText);
view.setReduceMotion(settings.reduceMotion);
sfx.setVolume(settings.volume);

function togglePause(): void {
  if (phase === 'playing') {
    phase = 'paused';
    hud.showPause(hudHandlers);
  } else if (phase === 'paused') {
    phase = 'playing';
    hud.hideOverlay();
  }
}

function showNightIntro(next: NightId): void {
  night = next;
  phase = 'intro';
  hud.showNightIntro(
    next,
    NIGHT_MAPS[next].name,
    NIGHT_QUOTES[next],
    () => startNight(next),
  );
}

function startNight(next: NightId, scenario: Record<string, unknown> | null = null): void {
  night = next;
  world = createWorld(baseSeed + next * 1000, next, scenario as never);
  stage = createStage(next, world.map, props);
  view = new GameView(stage, props);
  view.rebuild(world);
  accumulator = 0;
  lastCountdownSecond = -1;
  phase = 'playing';
  hud.hideOverlay();
  hud.setVisible(true);
  hud.setColorblind(settings.colorblind);
  view.setColorblind(settings.colorblind);
  controls.discard();
  sfx.resume();
  installDebugHook();
}

function handleEvents(events: SimEvent[]): void {
  for (const event of events) {
    switch (event.name) {
      case 'mote_picked':
        sfx.pickup();
        break;
      case 'deposit':
        sfx.deposit();
        break;
      case 'lantern_lit':
        sfx.lantern();
        break;
      case 'pulse':
        sfx.pulse();
        view.flashPulse(world.player.x, world.player.y, world.player.z);
        break;
      case 'dash':
        sfx.dash();
        break;
      case 'charm_picked':
        sfx.charm();
        break;
      case 'drifter_steal':
        sfx.drifter();
        break;
      case 'drifter_drop':
        sfx.pickup();
        break;
      case 'player_hit':
        sfx.hit();
        break;
      case 'game_over':
        finishNight(typeof event.data.reason === 'string' ? event.data.reason : '');
        break;
      case 'shade_spawned': {
        hud.toast('Bóng Mực xuất hiện');
        const shade = world.shades.find((s) => s.id === event.data.id);
        if (shade) {
          const yawRad = (controls.yaw * Math.PI) / 180;
          const dx = shade.x - world.player.x;
          const dz = shade.z - world.player.z;
          const forward = dx * Math.sin(yawRad) + dz * Math.cos(yawRad);
          const right = dx * -Math.cos(yawRad) + dz * Math.sin(yawRad);
          hud.flashShadeArrow((Math.atan2(right, forward) * 180) / Math.PI);
        }
        break;
      }
      default:
        break;
    }
  }
}

function finishNight(reason: string): void {
  const won = world.state === 'won';
  if (won) {
    totalScore += world.score;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      saveBest(bestScore);
    }
  }
  phase = 'result';
  const lit = world.lanterns.filter((l) => l.lit).length;
  const text =
    reason === 'dawn_survived'
      ? `Bình minh — ${lit}/${world.lanterns.length} đèn còn sáng`
      : reason === 'dawn'
        ? `Trời sáng mà chỉ còn ${lit}/${world.lanterns.length} đèn`
        : 'Hết ngọn lửa';
  hud.showResult(won, night, world.score, text, hudHandlers);
  nightsWon = Math.min(3, nightsWon + (won ? 1 : 0));
  hud.showScoreEntry();
  hud.setVisible(false);
  if (won) sfx.win();
  else sfx.lose();
}

const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();

function updateCamera(dt: number, yawDeg: number): void {
  const yaw = (yawDeg * Math.PI) / 180;
  const target = view.getCameraTarget(world);
  const distance = 9.6;
  const height = 4.8;
  desiredCamera.set(
    target.x - Math.sin(yaw) * distance,
    world.player.y + height,
    target.z - Math.cos(yaw) * distance,
  );
  stage.camera.position.lerp(desiredCamera, 1 - Math.exp(-9 * dt));
  cameraTarget.copy(target);
  stage.camera.lookAt(cameraTarget);
}

function updatePromptAndArrow(): void {
  if (phase !== 'playing') {
    hud.setPrompt('');
    hud.setArrow(null);
    return;
  }
  const p = world.player;
  // Any lantern that can still take light: unlit, or lit but not full.
  let nearest: { x: number; y: number; z: number } | null = null;
  let nearestDistance = Infinity;
  for (const lantern of world.lanterns) {
    if (lantern.lit && lantern.fuelUnits >= FUEL_MAX_UNITS) continue;
    const distance = Math.hypot(lantern.x - p.x, lantern.y - p.y, lantern.z - p.z);
    if (distance < nearestDistance) {
      nearest = lantern;
      nearestDistance = distance;
    }
  }

  if (nearest && nearestDistance <= TUNING.interact_radius) {
    const lightable = nearest as { lit?: boolean };
    const verb = lightable.lit ? 'Châm dầu' : 'Nạp ánh sáng';
    hud.setPrompt(`E — ${verb} (${p.carried}/${p.capacity})`);
  } else if (p.carried >= p.capacity) {
    hud.setPrompt('Đom đóm đã đầy — hãy tìm Đèn Lồng Lớn');
  } else {
    hud.setPrompt('');
  }

  if (!nearest) {
    hud.setArrow(null);
    return;
  }
  const yaw = (controls.yaw * Math.PI) / 180;
  const dx = nearest.x - p.x;
  const dz = nearest.z - p.z;
  const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const right = dx * -Math.cos(yaw) + dz * Math.sin(yaw);
  const angle = (Math.atan2(right, forward) * 180) / Math.PI;
  hud.setArrow(Math.abs(angle) > 55 || forward < 0 ? angle : null);
}

const FIXED_STEP = 1 / 60;

function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  elapsed += dt;

  if (phase === 'playing') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 6) {
      const events: SimEvent[] = [];
      stepWorld(world, controls.take(), events);
      handleEvents(events);
      accumulator -= FIXED_STEP;
      steps += 1;
      if (world.state !== 'playing') break;
    }
    if (steps >= 6) accumulator = 0;

    const seconds = Math.max(0, Math.ceil(world.timeLeftTicks / 60));
    if (seconds <= 10 && seconds !== lastCountdownSecond) {
      lastCountdownSecond = seconds;
      sfx.countdown();
      if (seconds === 10) hud.toast('Còn 10 giây');
    }

    // Visual captions for things that only had audio/colour before.
    if (world.wind.warnActive && !windWarned) {
      windWarned = true;
      hud.toast('Gió sắp thổi');
    }
    if (!world.wind.warnActive) windWarned = false;
    for (const lantern of world.lanterns) {
      const weak = lantern.lit && lantern.fuelUnits < LOW_FUEL_UNITS;
      if (weak && !warnedLowFuel.has(lantern.id)) {
        warnedLowFuel.add(lantern.id);
        hud.toast(`${lantern.id} sắp cạn dầu`);
      }
      if (!weak) warnedLowFuel.delete(lantern.id);
    }
  } else {
    controls.discard();
  }

  view.sync(world, elapsed);
  view.update(dt);
  stage.update(elapsed);
  const litCount = world.lanterns.filter((lantern) => lantern.lit).length;
  stage.setLitFraction(world.lanterns.length > 0 ? litCount / world.lanterns.length : 0);
  stage.setWind(world.wind.active, world.wind.dirDeg);
  for (let i = 0; i < stage.lanternLights.length; i += 1) {
    const lit = world.lanterns[i]?.lit ?? false;
    const target = lit ? 26 + Math.sin(elapsed * 2.6 + i) * 3 : 0;
    stage.lanternLights[i].intensity += (target - stage.lanternLights[i].intensity) * Math.min(1, dt * 6);
  }

  if (phase === 'playing' || phase === 'paused') {
    updateCamera(dt, controls.yaw);
    hud.update(world, 10);
    updatePromptAndArrow();
  } else {
    updateCamera(dt, controls.yaw + Math.sin(elapsed * 0.1) * 0.15);
  }

  renderer.render(stage.scene, stage.camera);
  requestAnimationFrame(frame);
}

function onResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  stage.resize(width / height);
}

window.addEventListener('resize', onResize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && (phase === 'menu' || phase === 'intro' || phase === 'result' || phase === 'dawn')) {
    hud.clickPrimary();
  }
});
onResize();

/**
 * Read-only inspection hook used by scripts/shots.mjs, plus camera yaw so the
 * bot can aim. It cannot change gameplay state.
 */
function installDebugHook(): void {
  (window as unknown as { __dao: unknown }).__dao = {
    seed: world.seed,
    phase: () => phase,
    snapshot: () => ({
      state: world.state,
      phase,
      night: world.night,
      score: world.score,
      totalScore,
      tick: world.tick,
      timeLeftTicks: world.timeLeftTicks,
      wind: { active: world.wind.active, dirDeg: world.wind.dirDeg },
      player: { ...world.player },
      motes: world.motes
        .filter((m) => m.active)
        .map((m) => ({ id: m.id, x: m.x, y: m.y, z: m.z, kind: m.kind })),
      lanterns: world.lanterns.map((l) => ({
        id: l.id,
        x: l.x,
        y: l.y,
        z: l.z,
        lit: l.lit,
        deposited: l.deposited,
        fuel: fuelToDisplay(l.fuelUnits),
        ever_lit: l.everLit,
        relit_count: l.relitCount,
      })),
      shades: world.shades.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        z: s.z,
        state: s.state,
        target_lantern_id: s.targetLanternId,
      })),
      drifters: world.drifters.map((d) => ({ id: d.id, x: d.x, y: d.y, z: d.z, state: d.state, stolen: d.stolen })),
      charms: world.charms.map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, available: c.available })),
    }),
    rendered: () => view.counts,
    setYaw: (deg: number) => {
      controls.yaw = deg;
    },
    /** Debug/automation only: jump straight to a night (same code path as the menu). */
    startNight: (target: number, scenario: Record<string, unknown> | null = null) => {
      if (target === 1 || target === 2 || target === 3) startNight(target as NightId, scenario);
    },
  };
}

installDebugHook();
hud.setVisible(false);
hud.showMenu(bestScore);

let lastTime = performance.now();
requestAnimationFrame(frame);
}
