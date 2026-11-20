import * as THREE from 'three';
import { TUNING } from '../core/index';
import type { World } from '../core/index';
import type { Stage } from './scene';
import { glowSprite } from './textures';

const WARM = 0xffb85e;
const INK = 0x1a0b26;

function disposeTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const holder = node as unknown as { material?: THREE.Material | THREE.Material[] };
    const material = holder.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

interface LanternView {
  group: THREE.Group;
  glass: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Sprite;
  safeRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  lit: boolean;
}

interface PulseView {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
}

/**
 * Builds and animates every dynamic object: Mây, the five lanterns, the motes
 * and the Ink Shades. It only ever reads the simulation state.
 */
export class GameView {
  private readonly root = new THREE.Group();
  private readonly playerGroup = new THREE.Group();
  private readonly playerHalo: THREE.Sprite;
  private readonly playerLight: THREE.PointLight;
  private readonly lanterns = new Map<string, LanternView>();
  private readonly motes = new Map<string, THREE.Group>();
  private readonly shades = new Map<string, THREE.Group>();
  private readonly pulses: PulseView[] = [];
  private facing = 0;
  private lastX = 0;
  private lastZ = 0;
  private walkPhase = 0;

  constructor(private readonly stage: Stage) {
    stage.scene.add(this.root);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xf7ecd8,
      emissive: 0x2a2216,
      emissiveIntensity: 1,
      roughness: 0.82,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf6dcc0, emissive: 0x241a12, roughness: 0.78 });
    const hatMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6cfa6,
      emissive: 0x2b2114,
      roughness: 0.88,
      flatShading: true,
    });
    const clothMaterial = new THREE.MeshStandardMaterial({ color: 0xa8835c, emissive: 0x1c1409, roughness: 0.9 });

    const legLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 3, 8), clothMaterial);
    legLeft.position.set(-0.14, 0.28, 0);
    const legRight = legLeft.clone();
    legRight.position.x = 0.14;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 4, 12), bodyMaterial);
    body.position.y = 0.78;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), skinMaterial);
    head.position.y = 1.24;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.44, 26, 1, true), hatMaterial);
    hat.position.y = 1.45;
    const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 26), hatMaterial);
    hatBrim.rotation.x = Math.PI / 2;
    hatBrim.position.y = 1.24;
    const armLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 3, 8), bodyMaterial);
    armLeft.position.set(-0.34, 0.84, 0);
    armLeft.rotation.z = 0.22;
    const armRight = armLeft.clone();
    armRight.position.x = 0.34;
    armRight.rotation.z = -0.22;

    // The little lantern that hangs from the tip of Mây's nón lá.
    const hatLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffca7a, emissive: WARM, emissiveIntensity: 2.2, roughness: 0.4 }),
    );
    hatLantern.position.set(0.34, 1.34, 0.3);
    const hatString = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4),
      new THREE.MeshStandardMaterial({ color: 0x6b5233 }),
    );
    hatString.position.set(0.3, 1.44, 0.26);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;

    this.playerHalo = glowSprite(WARM, 3.4, 0.3);
    this.playerHalo.position.y = 1.1;
    // Two small lantern lights, one in front and one behind the body: a single
    // light inside the mesh only lights the inside of the capsules, and one in
    // front leaves the back (which the camera sees) in the blue night.
    this.playerLight = new THREE.PointLight(0xffd2a0, 2.4, 13, 2);
    this.playerLight.position.set(0.42, 1.55, 0.55);
    const backLight = new THREE.PointLight(0xffc98c, 1.8, 11, 2);
    backLight.position.set(-0.2, 1.5, -0.55);

    this.playerGroup.add(
      legLeft,
      legRight,
      body,
      head,
      hat,
      hatBrim,
      armLeft,
      armRight,
      hatLantern,
      hatString,
      shadow,
      this.playerHalo,
      this.playerLight,
      backLight,
    );
    this.root.add(this.playerGroup);
  }

  /** Recreate every dynamic object for a fresh world (also used on replay). */
  rebuild(world: World): void {
    for (const view of this.lanterns.values()) {
      disposeTree(view.group);
      this.root.remove(view.group);
    }
    this.lanterns.clear();
    for (const view of this.motes.values()) {
      disposeTree(view);
      this.root.remove(view);
    }
    this.motes.clear();
    for (const view of this.shades.values()) {
      disposeTree(view);
      this.root.remove(view);
    }
    this.shades.clear();
    for (const pulse of this.pulses) {
      disposeTree(pulse.mesh);
      this.root.remove(pulse.mesh);
    }
    this.pulses.length = 0;

    for (const lantern of world.lanterns) {
      this.lanterns.set(lantern.id, this.buildLantern(lantern.x, lantern.z));
    }
    for (const mote of world.motes) {
      this.motes.set(mote.id, this.buildMote());
    }
    for (const shade of world.shades) {
      this.shades.set(shade.id, this.buildShade());
    }
    this.sync(world, 0);
  }

  private buildLantern(x: number, z: number): LanternView {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    // Turn the arm towards the middle of the island so the lantern "leans in"
    // on whoever is walking past.
    group.rotation.y = Math.atan2(z, -x);

    const wood = new THREE.MeshStandardMaterial({ color: 0x453629, roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.24, 12), wood);
    base.position.y = 0.12;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 4.2, 10), wood);
    pole.position.y = 2.22;
    // The lantern hangs off an arm at the top of the pole, so nothing crosses
    // the glass.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.09), wood);
    arm.position.set(0.42, 4.28, 0);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), wood);
    hook.position.set(0.82, 4.11, 0);

    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0x6a5236,
        emissive: 0x4a2f0e,
        emissiveIntensity: 0.9,
        roughness: 0.32,
        transparent: true,
        opacity: 0.95,
      }),
    );
    glass.position.set(0.82, 3.66, 0);
    glass.scale.set(1, 1.22, 1);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.26, 12), wood);
    cap.position.set(0.82, 4.14, 0);
    const capBottom = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.2, 12), wood);
    capBottom.position.set(0.82, 3.2, 0);
    capBottom.rotation.x = Math.PI;

    const halo = glowSprite(WARM, 5.4, 0);
    halo.position.set(0.82, 3.66, 0);

    // Safe zone marker: shades cannot cross this ring (TUNING.safe_radius).
    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(TUNING.safe_radius - 0.07, TUNING.safe_radius, 72),
      new THREE.MeshBasicMaterial({
        color: WARM,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.04;

    group.add(base, pole, arm, hook, glass, cap, capBottom, halo, safeRing);
    this.root.add(group);
    return { group, glass, halo, safeRing, lit: false };
  }

  private buildMote(): THREE.Group {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffdf9c, emissive: 0xffc65e, emissiveIntensity: 1.6, roughness: 0.4 }),
    );
    const halo = glowSprite(0xffc861, 1.5, 0.6);
    group.add(core, halo);
    this.root.add(group);
    return group;
  }

  private buildShade(): THREE.Group {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshStandardMaterial({
        color: INK,
        emissive: 0x3a1052,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.1,
        flatShading: true,
        transparent: true,
        opacity: 0.94,
      }),
    );
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.MeshBasicMaterial({
        color: 0x5b1f7a,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        wireframe: true,
      }),
    );
    const halo = glowSprite(0x4a1670, 3.6, 0.4);
    group.add(core, shell, halo);
    this.root.add(group);
    return group;
  }

  /** Push the current simulation state into the scene graph. */
  sync(world: World, elapsed: number): void {
    const player = world.player;
    this.playerGroup.position.set(player.x, player.y, player.z);

    const dx = player.x - this.lastX;
    const dz = player.z - this.lastZ;
    if (Math.hypot(dx, dz) > 0.0005) {
      this.facing = Math.atan2(dx, dz);
      this.walkPhase += Math.hypot(dx, dz) * 6;
    }
    this.lastX = player.x;
    this.lastZ = player.z;
    this.playerGroup.rotation.y = this.facing;
    this.playerGroup.position.y = player.y + (player.onGround ? Math.abs(Math.sin(this.walkPhase)) * 0.045 : 0);

    // Lanterns.
    for (const lantern of world.lanterns) {
      const view = this.lanterns.get(lantern.id);
      if (!view) continue;
      if (lantern.lit !== view.lit) {
        view.lit = lantern.lit;
        if (lantern.lit) {
          view.glass.material.emissive.setHex(WARM);
          view.glass.material.emissiveIntensity = 2.4;
          view.glass.material.color.setHex(0xffd9a0);
        } else {
          view.glass.material.emissive.setHex(0x4a2f0e);
          view.glass.material.emissiveIntensity = 0.9;
          view.glass.material.color.setHex(0x6a5236);
        }
      }
      const pulse = lantern.lit ? 0.85 + Math.sin(elapsed * 2.4) * 0.12 : 0;
      view.halo.material.opacity = pulse * 0.75;
      view.safeRing.material.opacity = lantern.lit ? 0.16 + Math.sin(elapsed * 1.8) * 0.03 : 0;
    }

    // Motes: only active ones are visible, and they float a little.
    for (const mote of world.motes) {
      const view = this.motes.get(mote.id);
      if (!view) continue;
      view.visible = mote.active;
      if (!mote.active) continue;
      const bob = Math.sin(elapsed * 2.2 + mote.x * 0.7 + mote.z * 0.5) * 0.18;
      view.position.set(mote.x, 0.95 + bob, mote.z);
      view.rotation.y = elapsed * 0.8;
    }

    // Shades.
    for (const shade of world.shades) {
      const view = this.shades.get(shade.id);
      if (!view) continue;
      view.position.set(shade.x, shade.y, shade.z);
      const stunned = shade.state === 'stunned';
      view.scale.setScalar(stunned ? 0.82 : 1);
      view.rotation.y = stunned ? elapsed * 3 : elapsed * 0.6;
      view.rotation.x = Math.sin(elapsed * 1.3 + shade.x) * 0.12;
    }
  }

  /** Expanding ring for the light pulse. */
  flashPulse(x: number, z: number): void {
    if (this.pulses.length > 6) {
      const oldest = this.pulses.shift();
      if (oldest) {
        disposeTree(oldest.mesh);
        this.root.remove(oldest.mesh);
      }
    }
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffe3ab,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.12, z);
    this.root.add(mesh);
    this.pulses.push({ mesh, age: 0 });
  }

  /** Animate transient effects. `dt` is real frame time. */
  update(dt: number): void {
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      pulse.age += dt;
      const life = 0.55;
      const t = pulse.age / life;
      if (t >= 1) {
        disposeTree(pulse.mesh);
        this.root.remove(pulse.mesh);
        this.pulses.splice(i, 1);
        continue;
      }
      const radius = THREE.MathUtils.lerp(1, TUNING.pulse_radius, Math.sqrt(t));
      pulse.mesh.scale.setScalar(radius);
      pulse.mesh.material.opacity = 0.85 * (1 - t) ** 1.5;
    }
  }

  /** Camera anchor: a little above Mây's feet. */
  readonly cameraTarget = new THREE.Vector3();
  getCameraTarget(world: World): THREE.Vector3 {
    this.cameraTarget.set(world.player.x, world.player.y + 1.55, world.player.z);
    return this.cameraTarget;
  }

  get stageScene(): THREE.Scene {
    return this.stage.scene;
  }
}
