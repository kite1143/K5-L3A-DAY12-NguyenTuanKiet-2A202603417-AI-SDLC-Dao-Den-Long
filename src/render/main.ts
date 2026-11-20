import * as THREE from 'three';
import { createWorld, stepWorld, TUNING } from '../core/index';
import type { SimEvent, World } from '../core/index';
import { Sfx } from './audio';
import { GameView } from './entities';
import { Hud } from './hud';
import { Controls } from './input';
import { createStage } from './scene';
import './style.css';

const app = document.getElementById('app');
if (!app) throw new Error('#app is missing from index.html');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.domElement.className = 'game-canvas';
app.appendChild(renderer.domElement);

const stage = createStage();
const view = new GameView(stage);
const sfx = new Sfx();

let world: World = createWorld(randomSeed(), null);
let started = false;
let ended = false;
let accumulator = 0;
let elapsed = 0;

const hud = new Hud({
  onStart: () => start(),
  onRestart: () => restart(),
});

const controls = new Controls({
  onStart: () => start(),
  onRestart: () => restart(),
  onGesture: () => sfx.resume(),
  onMute: () => {
    const muted = sfx.toggleMute();
    document.body.classList.toggle('muted', muted);
  },
});
controls.attach(renderer.domElement);

view.rebuild(world);
hud.update(world);
hud.showIntro();

function randomSeed(): number {
  const fromUrl = new URLSearchParams(window.location.search).get('seed');
  if (fromUrl) {
    const parsed = Number.parseInt(fromUrl, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 1 + Math.floor(Math.random() * 999_999);
}

/**
 * Read-only inspection hook plus camera control, used by scripts/shots.mjs to
 * play the game automatically and capture proof screenshots. It cannot change
 * gameplay state.
 */
function installDebugHook(): void {
  (window as unknown as { __dao: unknown }).__dao = {
    seed: world.seed,
    snapshot: () => ({
      state: world.state,
      score: world.score,
      tick: world.tick,
      timeLeftTicks: world.timeLeftTicks,
      player: { ...world.player },
      motes: world.motes.filter((m) => m.active).map((m) => ({ id: m.id, x: m.x, z: m.z })),
      lanterns: world.lanterns.map((l) => ({ id: l.id, x: l.x, z: l.z, lit: l.lit, deposited: l.deposited })),
      shades: world.shades.map((s) => ({ id: s.id, x: s.x, z: s.z, state: s.state })),
    }),
    setYaw: (deg: number) => {
      controls.yaw = deg;
    },
  };
}

function start(): void {
  if (started) return;
  started = true;
  sfx.resume();
  hud.hideOverlay();
  controls.discard();
}

function restart(): void {
  world = createWorld(randomSeed(), null);
  view.rebuild(world);
  ended = false;
  started = true;
  accumulator = 0;
  hud.hideOverlay();
  hud.update(world);
  controls.discard();
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
        view.flashPulse(world.player.x, world.player.z);
        break;
      case 'player_hit':
        sfx.hit();
        break;
      case 'game_over':
        ended = true;
        hud.showEnd(world);
        hud.setHint('');
        if (world.state === 'won') sfx.win();
        else sfx.lose();
        break;
      default:
        break;
    }
  }
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
  const blend = 1 - Math.exp(-9 * dt);
  stage.camera.position.lerp(desiredCamera, blend);
  cameraTarget.copy(target);
  stage.camera.lookAt(cameraTarget);
}

function updateHint(): void {
  if (!started || ended) return;
  const { player } = world;
  if (player.carried >= TUNING.carry_capacity) {
    hud.setHint('Đom đóm đã đầy — hãy mang về Đèn Lồng Lớn');
    return;
  }
  for (const lantern of world.lanterns) {
    if (lantern.lit) continue;
    const distance = Math.hypot(lantern.x - player.x, lantern.z - player.z);
    if (distance <= TUNING.interact_radius) {
      hud.setHint(
        player.carried > 0
          ? `Nhấn E để nạp đèn (đang có ${player.carried}/${TUNING.carry_capacity} đom đóm)`
          : 'Cần đom đóm trước khi nạp đèn',
      );
      return;
    }
  }
  hud.setHint(player.carried > 0 ? 'Nhấn F để tỏa sáng xua Bóng Mực' : 'Thu thập đom đóm quanh đảo');
}

const FIXED_STEP = 1 / 60;

function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  elapsed += dt;

  if (started && !ended) {
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
  } else {
    controls.discard();
  }

  view.sync(world, elapsed);
  view.update(dt);
  stage.update(elapsed);
  const litCount = world.lanterns.filter((lantern) => lantern.lit).length;
  stage.setLitFraction(litCount / world.lanterns.length);
  for (let i = 0; i < stage.lanternLights.length; i += 1) {
    const lit = world.lanterns[i]?.lit ?? false;
    const target = lit ? 26 + Math.sin(elapsed * 2.6 + i) * 3 : 0;
    stage.lanternLights[i].intensity += (target - stage.lanternLights[i].intensity) * Math.min(1, dt * 6);
  }

  updateCamera(dt, controls.yaw);
  hud.update(world);
  updateHint();
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
onResize();

let lastTime = performance.now();
installDebugHook();
requestAnimationFrame(frame);
