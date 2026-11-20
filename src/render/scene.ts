import * as THREE from 'three';
import { ISLAND_RADIUS, TUNING } from '../core/index';
import { placeProp } from './assets';
import type { PropSet } from './assets';
import { glowSprite } from './textures';

/**
 * The static stage of Đảo Bến: night sky, a sea of clouds, the round island and
 * its props. Everything here is decoration; nothing is read back by the sim.
 */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lanternLights: THREE.PointLight[];
  /** Warm up the island as lanterns are lit; `litFraction` is 0..1. */
  setLitFraction(litFraction: number): void;
  update(elapsed: number): void;
  resize(aspect: number): void;
}

export function createStage(props: PropSet = {}): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080d18);
  scene.fog = new THREE.FogExp2(0x0a1020, 0.011);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
  camera.position.set(0, 9, -12);

  // --- moonlight -----------------------------------------------------------
  const ambient = new THREE.AmbientLight(0x39456f, 1.15);
  scene.add(ambient);
  const hemisphere = new THREE.HemisphereLight(0x40507d, 0x1b2a20, 0.85);
  scene.add(hemisphere);
  const moonLight = new THREE.DirectionalLight(0xa9c0ff, 0.7);
  moonLight.position.set(60, 90, -70);
  scene.add(moonLight);

  // --- sky: stars + moon ---------------------------------------------------
  const starCount = 700;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const radius = 420;
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius * 0.9 + 30;
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xdce6ff, size: 1.9, sizeAttenuation: true, transparent: true, opacity: 0.85 }),
  );
  scene.add(stars);

  const moon = glowSprite(0xcfd9ff, 110, 0.5);
  moon.position.set(150, 130, -220);
  scene.add(moon);
  const moonCore = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8eeff }),
  );
  moonCore.position.copy(moon.position);
  scene.add(moonCore);

  // --- island --------------------------------------------------------------
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.82, 5, 72, 1),
    new THREE.MeshStandardMaterial({ color: 0x24402f, roughness: 1, metalness: 0 }),
  );
  island.position.y = -2.5;
  scene.add(island);

  const lawn = new THREE.Mesh(
    new THREE.CircleGeometry(ISLAND_RADIUS - 0.05, 72),
    new THREE.MeshStandardMaterial({ color: 0x2c4b39, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.01;
  scene.add(lawn);

  // The dirt ring the lanterns stand on.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(17 - 1.5, 17 + 1.5, 96),
    new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  const shore = new THREE.Mesh(
    new THREE.RingGeometry(ISLAND_RADIUS - 1.2, ISLAND_RADIUS, 96),
    new THREE.MeshStandardMaterial({ color: 0x37564a, roughness: 1 }),
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.03;
  scene.add(shore);

  // Floating-rock bottom so the island reads as an island in a cloud sea.
  const keel = new THREE.Mesh(
    new THREE.ConeGeometry(ISLAND_RADIUS * 0.82, 26, 9, 1),
    new THREE.MeshStandardMaterial({ color: 0x1b2a2f, roughness: 1, flatShading: true }),
  );
  keel.position.y = -18;
  keel.rotation.x = Math.PI;
  scene.add(keel);

  // --- props: rocks and pines ---------------------------------------------
  // Polyfork models (CC BY 4.0, credit in CREDITS.md) win when present; the
  // procedural shapes stay as the fallback so the island is never empty.
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3b3b, roughness: 1, flatShading: true });
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockSources = [props.rockLarge, props.rockSmall].filter((s): s is THREE.Object3D => Boolean(s));
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2 + (i % 3) * 0.11;
    const radius = 6 + ((i * 37) % 190) / 10;
    const height = 0.7 + ((i * 53) % 90) / 100;

    const model = rockSources.length > 0 ? placeProp(rockSources[i % rockSources.length], height) : null;
    if (model) {
      model.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      model.rotation.y = i * 1.7;
      scene.add(model);
      continue;
    }

    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(Math.cos(angle) * radius, height * 0.35, Math.sin(angle) * radius);
    rock.scale.setScalar(height);
    rock.rotation.set(i, i * 2, i * 0.5);
    scene.add(rock);
  }

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2b5142, roughness: 1, flatShading: true });
  const swaying: THREE.Group[] = [];
  const treeSources = [props.tallPine, props.youngPine].filter((s): s is THREE.Object3D => Boolean(s));
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2 + 0.4;
    // Pines stay on the outer shore so they never block the camera in the
    // middle of the island.
    const radius = 19.5 + ((i * 61) % 60) / 10;
    const height = 5.2 + ((i * 37) % 26) / 10;

    const model = treeSources.length > 0 ? placeProp(treeSources[i % treeSources.length], height) : null;
    if (model) {
      model.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      model.rotation.y = angle * 1.9 + i;
      scene.add(model);
      swaying.push(model);
      continue;
    }

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 6), trunkMaterial);
    trunk.position.y = 0.7;
    tree.add(trunk);
    for (let layer = 0; layer < 3; layer += 1) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.15 - layer * 0.26, 1.5, 8),
        leafMaterial,
      );
      cone.position.y = 1.5 + layer * 0.62;
      tree.add(cone);
    }
    tree.scale.setScalar(height / 4.6);
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    scene.add(tree);
    swaying.push(tree);
  }

  // Đảo Bến is a harbour island: one hut and one beached rowboat tell that
  // story without touching gameplay.
  const hut = placeProp(props.hut, 3.6);
  if (hut) {
    const angle = 2.45;
    hut.position.set(Math.cos(angle) * 21.5, 0, Math.sin(angle) * 21.5);
    hut.rotation.y = Math.atan2(-hut.position.x, -hut.position.z) + 0.3;
    scene.add(hut);
  }

  const boat = placeProp(props.boat, 1.15);
  if (boat) {
    const angle = 4.35;
    boat.position.set(Math.cos(angle) * 24.2, 0, Math.sin(angle) * 24.2);
    boat.rotation.y = angle + 1.1;
    scene.add(boat);
  }

  // Glowing bonnet mushrooms along the inner grass.
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + 1.1;
    const radius = 11 + ((i * 47) % 120) / 10;
    const mushroom = placeProp(props.mushroom, 0.32 + ((i * 23) % 30) / 100);
    if (!mushroom) break;
    mushroom.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    mushroom.rotation.y = i * 1.3;
    scene.add(mushroom);
  }

  // --- sea of clouds -------------------------------------------------------
  const cloudGroup = new THREE.Group();
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0x33415c, roughness: 1, metalness: 0 });
  const puffGeometry = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 46; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 40 + Math.random() * 300;
    const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
    puff.position.set(
      Math.cos(angle) * radius,
      -16 + Math.random() * 7,
      Math.sin(angle) * radius,
    );
    puff.scale.set(14 + Math.random() * 26, 3 + Math.random() * 4, 14 + Math.random() * 26);
    cloudGroup.add(puff);
  }
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(600, 48),
    new THREE.MeshStandardMaterial({ color: 0x1b2438, roughness: 1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -22;
  scene.add(sea);
  scene.add(cloudGroup);

  // --- one warm point light per Big Lantern --------------------------------
  const lanternLights: THREE.PointLight[] = [];
  const lanternPositions = [
    { x: 0, z: 17 },
    { x: -16.169, z: 5.253 },
    { x: -9.992, z: -13.755 },
    { x: 9.992, z: -13.755 },
    { x: 16.169, z: 5.253 },
  ];
  for (const spot of lanternPositions) {
    const light = new THREE.PointLight(0xffb45e, 0, 28, 2);
    light.position.set(spot.x, 3.7, spot.z);
    scene.add(light);
    lanternLights.push(light);
  }

  const baseAmbient = 1.15;
  const baseHemisphere = 0.85;

  return {
    scene,
    camera,
    lanternLights,
    setLitFraction(litFraction: number): void {
      const f = Math.max(0, Math.min(1, litFraction));
      ambient.intensity = baseAmbient + f * 0.55;
      hemisphere.intensity = baseHemisphere + f * 0.45;
      // The island literally brightens as the lanterns come back to life.
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = 0.011 - f * 0.004;
        scene.fog.color.setHSL(0.62, 0.55, 0.055 + f * 0.02);
      }
      cloudMaterial.color.setHSL(0.6, 0.28, 0.14 + f * 0.06);
    },
    update(elapsed: number): void {
      cloudGroup.rotation.y = elapsed * 0.006;
      stars.rotation.y = elapsed * 0.004;
      for (let i = 0; i < swaying.length; i += 1) {
        swaying[i].rotation.z = Math.sin(elapsed * 0.7 + i) * 0.02;
      }
    },
    resize(aspect: number): void {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
  };
}

/** Horizontal safe radius of a lit lantern, reused by the HUD/marker rings. */
export const SAFE_RING_RADIUS = TUNING.safe_radius;
