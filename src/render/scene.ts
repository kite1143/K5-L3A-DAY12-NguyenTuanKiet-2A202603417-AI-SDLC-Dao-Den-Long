import * as THREE from 'three';
import { NIGHT2_GEOMETRY, NIGHT3_GEOMETRY, PALETTE, ambientForLit } from '../core/index';
import type { NightId, NightMap } from '../core/index';
import { placeProp } from './assets';
import type { PropSet } from './assets';
import { glowSprite } from './textures';

/** The static stage of one night: sky, terrain and props. */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lanternLights: THREE.PointLight[];
  /** Terrain height used to place things visually (same rules as the sim). */
  heightAt(x: number, z: number): number;
  setLitFraction(litFraction: number): void;
  setWind(active: boolean, dirDeg: number): void;
  update(elapsed: number): void;
  resize(aspect: number): void;
}

function hex(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}

export function createStage(night: NightId, map: NightMap, props: PropSet = {}): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(hex(PALETTE.skyNight));
  scene.fog = new THREE.FogExp2(hex(PALETTE.mist), 0.009);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
  camera.position.set(0, 9, -12);

  const ambient = new THREE.AmbientLight(0x4a5a8c, ambientForLit(0, map.lanterns.length));
  scene.add(ambient);
  scene.add(new THREE.HemisphereLight(0x5a6c9c, 0x22302a, 1.05));
  const moon = new THREE.DirectionalLight(0xa9c0ff, 0.8);
  moon.position.set(60, 90, -70);
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0x8fa3c8, 0.35);
  fill.position.set(-80, 40, 60);
  scene.add(fill);

  // --- sky ---------------------------------------------------------------
  const starCount = 600;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * 420;
    starPositions[i * 3 + 1] = Math.cos(phi) * 390 + 30;
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * 420;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0xdce6ff, size: 1.9, transparent: true, opacity: 0.85 }),
    ),
  );
  const moonSprite = glowSprite(0xcfd9ff, 110, 0.5);
  moonSprite.position.set(150, 130, -220);
  scene.add(moonSprite);

  // --- ground material ---------------------------------------------------
  const grass = new THREE.MeshStandardMaterial({
    color: hex(PALETTE.grass),
    emissive: 0x0d1a15,
    emissiveIntensity: 1,
    roughness: 1,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: hex(PALETTE.wood),
    emissive: 0x140d07,
    emissiveIntensity: 1,
    roughness: 0.95,
  });
  const sand = new THREE.MeshStandardMaterial({ color: hex(PALETTE.sand), emissive: 0x1a1610, emissiveIntensity: 1, roughness: 1 });

  const addDisc = (radius: number, y: number, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, Math.max(1, Math.abs(y) || 1), 72), material);
    mesh.position.y = y - Math.max(1, Math.abs(y) || 1) / 2;
    scene.add(mesh);
    return mesh;
  };

  if (night === 1) {
    addDisc(40, 0, grass);
    const rim = new THREE.Mesh(new THREE.RingGeometry(38.6, 40, 96), sand);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.02;
    scene.add(rim);
  } else if (night === 2) {
    const { islands, islandRadius, bridge } = NIGHT2_GEOMETRY;
    for (const island of islands) {
      const disc = addDisc(islandRadius, 0, grass);
      disc.position.x = island.x;
      disc.position.z = island.z;
    }
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(bridge.xMax - bridge.xMin, 0.4, bridge.halfZ * 2),
      wood,
    );
    deck.position.set((bridge.xMin + bridge.xMax) / 2, -0.2, 0);
    scene.add(deck);
    // Rope rails, purely decorative.
    for (const z of [-bridge.halfZ, bridge.halfZ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(bridge.xMax - bridge.xMin, 0.08, 0.08), wood);
      rail.position.set((bridge.xMin + bridge.xMax) / 2, 0.5, z);
      scene.add(rail);
    }
  } else {
    const { tier1, tier2, ramps } = NIGHT3_GEOMETRY;
    const stone = new THREE.MeshStandardMaterial({
      color: 0x46564e,
      emissive: 0x121b16,
      emissiveIntensity: 1,
      roughness: 0.95,
      flatShading: true,
    });
    addDisc(45, 0, grass);
    // Tier 1: a half ring on z > 0 (theta 0 is +Z in three's cylinder).
    const tier1Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(tier1.maxRadius, tier1.maxRadius, tier1.y, 72, 1, false, -Math.PI / 2, Math.PI),
      stone,
    );
    tier1Mesh.position.y = tier1.y / 2;
    scene.add(tier1Mesh);
    // Tier 2: a column with the playable disc on top.
    const tier2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(tier2.radius, tier2.radius, tier2.y, 48), stone);
    tier2Mesh.position.y = tier2.y / 2;
    scene.add(tier2Mesh);
    // Bright rims so the ledges read as walkable edges at night.
    const rimMaterial = new THREE.MeshBasicMaterial({ color: 0x8fb0a2, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const rim1 = new THREE.Mesh(new THREE.RingGeometry(tier1.maxRadius - 0.25, tier1.maxRadius, 96, 1, -Math.PI / 2, Math.PI), rimMaterial);
    rim1.rotation.x = -Math.PI / 2;
    rim1.position.y = tier1.y + 0.01;
    scene.add(rim1);
    const rim2 = new THREE.Mesh(new THREE.RingGeometry(tier2.radius - 0.25, tier2.radius, 64), rimMaterial);
    rim2.rotation.x = -Math.PI / 2;
    rim2.position.y = tier2.y + 0.01;
    scene.add(rim2);
    const rimOuter = new THREE.Mesh(new THREE.RingGeometry(44.6, 45, 96), rimMaterial);
    rimOuter.rotation.x = -Math.PI / 2;
    rimOuter.position.y = 0.02;
    scene.add(rimOuter);
    // Ramps: thin boxes rotated to the slope of the two radial ramps.
    for (const angleDeg of ramps.angles) {
      const a = (angleDeg * Math.PI) / 180;
      const length = ramps.outerRadius - ramps.innerRadius;
      const slope = new THREE.Mesh(new THREE.BoxGeometry(length, 0.25, ramps.halfWidth * 2), wood);
      const mid = (ramps.innerRadius + ramps.outerRadius) / 2;
      slope.position.set(Math.cos(a) * mid, tier1.y / 2, Math.sin(a) * mid);
      slope.rotation.y = -a;
      slope.rotation.z = Math.atan2(tier1.y, length);
      scene.add(slope);
    }
    // Bell tower: a tall cylinder the player cannot climb.
    const towerHeight = 8;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.2, towerHeight, 24),
      new THREE.MeshStandardMaterial({ color: 0x53483a, roughness: 0.9 }),
    );
    tower.position.y = tier2.y + towerHeight / 2;
    scene.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 16), new THREE.MeshStandardMaterial({ color: 0x7a3c2a }));
    roof.position.y = tier2.y + towerHeight + 0.8;
    scene.add(roof);
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 12),
      new THREE.MeshStandardMaterial({ color: hex(PALETTE.gold), metalness: 0.7, roughness: 0.35 }),
    );
    bell.position.y = tier2.y + towerHeight - 1.6;
    scene.add(bell);
  }

  // --- props -------------------------------------------------------------
  const treeSources = [props.tallPine, props.youngPine].filter((s): s is THREE.Object3D => Boolean(s));
  const rockSources = [props.rockLarge, props.rockSmall].filter((s): s is THREE.Object3D => Boolean(s));
  const spots: Array<{ x: number; z: number; kind: 'tree' | 'rock' }> = [];

  if (night === 1) {
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + 0.4;
      spots.push({ x: Math.cos(angle) * (33 + (i % 5)), z: Math.sin(angle) * (33 + (i % 5)), kind: 'tree' });
    }
    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * Math.PI * 2 + 0.11;
      spots.push({ x: Math.cos(angle) * (8 + (i % 18)), z: Math.sin(angle) * (8 + (i % 18)), kind: 'rock' });
    }
  } else if (night === 2) {
    for (const island of NIGHT2_GEOMETRY.islands) {
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2 + 0.3;
        spots.push({ x: island.x + Math.cos(angle) * 25, z: island.z + Math.sin(angle) * 25, kind: 'tree' });
      }
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + 0.9;
        spots.push({ x: island.x + Math.cos(angle) * 12, z: island.z + Math.sin(angle) * 12, kind: 'rock' });
      }
    }
  } else {
    for (let i = 0; i < 20; i += 1) {
      const angle = (i / 20) * Math.PI * 2 + 0.2;
      spots.push({ x: Math.cos(angle) * 39, z: Math.sin(angle) * 39, kind: 'tree' });
    }
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + 0.7;
      spots.push({ x: Math.cos(angle) * 28, z: Math.sin(angle) * 28, kind: 'rock' });
    }
  }

  let treeIndex = 0;
  let rockIndex = 0;
  for (const spot of spots) {
    const groundY = map.height(spot.x, spot.z);
    if (!Number.isFinite(groundY)) continue;
    if (spot.kind === 'tree') {
      const source = treeSources[treeIndex % Math.max(1, treeSources.length)];
      treeIndex += 1;
      const height = 5.2 + ((treeIndex * 37) % 26) / 10;
      const model = source ? placeProp(source, height) : null;
      if (model) {
        model.position.set(spot.x, groundY, spot.z);
        model.rotation.y = treeIndex * 1.7;
        scene.add(model);
      }
    } else {
      const source = rockSources[rockIndex % Math.max(1, rockSources.length)];
      rockIndex += 1;
      const model = source ? placeProp(source, 0.7 + ((rockIndex * 53) % 90) / 100) : null;
      if (model) {
        model.position.set(spot.x, groundY, spot.z);
        model.rotation.y = rockIndex * 2.1;
        scene.add(model);
      }
    }
  }

  // Harbour hut and rowboat belong to Đảo Bến.
  if (night === 1) {
    const hut = placeProp(props.hut, 3.6);
    if (hut) {
      hut.position.set(Math.cos(2.45) * 34, 0, Math.sin(2.45) * 34);
      hut.rotation.y = Math.atan2(-hut.position.x, -hut.position.z) + 0.3;
      scene.add(hut);
    }
    const boat = placeProp(props.boat, 1.15);
    if (boat) {
      boat.position.set(Math.cos(4.35) * 37, 0, Math.sin(4.35) * 37);
      boat.rotation.y = 4.35 + 1.1;
      scene.add(boat);
    }
  }

  // Jump pads glow so the player can spot them.
  for (const pad of map.pads) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1, 40),
      new THREE.MeshBasicMaterial({ color: hex(PALETTE.gold), transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, pad.y + 0.03, pad.z);
    scene.add(ring);
    const glow = glowSprite(hex(PALETTE.gold), 3, 0.4);
    glow.position.set(pad.x, pad.y + 0.4, pad.z);
    scene.add(glow);
  }

  // --- sea of clouds -----------------------------------------------------
  const cloudGroup = new THREE.Group();
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: hex(PALETTE.cloudSea), roughness: 1 });
  const puff = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 44; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 300;
    const mesh = new THREE.Mesh(puff, cloudMaterial);
    mesh.position.set(Math.cos(angle) * radius, -16 + Math.random() * 7, Math.sin(angle) * radius);
    mesh.scale.set(14 + Math.random() * 26, 3 + Math.random() * 4, 14 + Math.random() * 26);
    cloudGroup.add(mesh);
  }
  scene.add(cloudGroup);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshStandardMaterial({ color: 0x1b2438, roughness: 1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -22;
  scene.add(sea);

  // --- lantern lights ----------------------------------------------------
  const lanternLights: THREE.PointLight[] = [];
  for (const lantern of map.lanterns) {
    const light = new THREE.PointLight(hex(PALETTE.lanternLit), 0, 26, 2);
    light.position.set(lantern.x, lantern.y + 3.5, lantern.z);
    scene.add(light);
    lanternLights.push(light);
  }

  // --- wind indicator ----------------------------------------------------
  const windGroup = new THREE.Group();
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa86b, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 40; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), leafMaterial);
    leaf.position.set((Math.random() - 0.5) * 60, 1 + Math.random() * 9, (Math.random() - 0.5) * 60);
    leaf.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    windGroup.add(leaf);
  }
  windGroup.visible = false;
  scene.add(windGroup);

  return {
    scene,
    camera,
    lanternLights,
    heightAt: (x, z) => map.height(x, z),
    setLitFraction(litFraction: number): void {
      ambient.intensity = ambientForLit(litFraction * map.lanterns.length, map.lanterns.length);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = 0.009 - litFraction * 0.003;
        scene.fog.color.setHSL(0.62, 0.55, 0.06 + litFraction * 0.02);
      }
    },
    setWind(active: boolean, dirDeg: number): void {
      windGroup.visible = active;
      windGroup.rotation.y = (dirDeg * Math.PI) / 180;
    },
    update(elapsed: number): void {
      cloudGroup.rotation.y = elapsed * 0.006;
      if (windGroup.visible) windGroup.rotation.x = Math.sin(elapsed * 2) * 0.1;
    },
    resize(aspect: number): void {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
  };
}
