import * as THREE from 'three';
import { PALETTE, TUNING } from '../core/index';
import type { World } from '../core/index';
import { placeProp } from './assets';
import type { PropSet } from './assets';
import type { Stage } from './scene';
import { glowSprite } from './textures';

const C = {
  warm: Number.parseInt(PALETTE.lanternLit.slice(1), 16),
  core: Number.parseInt(PALETTE.lanternCore.slice(1), 16),
  off: Number.parseInt(PALETTE.lanternOff.slice(1), 16),
  moteCore: Number.parseInt(PALETTE.moteCore.slice(1), 16),
  moteHalo: Number.parseInt(PALETTE.moteHalo.slice(1), 16),
  shadeBody: Number.parseInt(PALETTE.shadeBody.slice(1), 16),
  shadeRim: Number.parseInt(PALETTE.shadeRim.slice(1), 16),
  shadeStunned: Number.parseInt(PALETTE.shadeStunned.slice(1), 16),
  robe: Number.parseInt(PALETTE.robe.slice(1), 16),
  scarf: Number.parseInt(PALETTE.scarf.slice(1), 16),
  gold: Number.parseInt(PALETTE.gold.slice(1), 16),
  drifter: Number.parseInt(PALETTE.drifter.slice(1), 16),
};

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
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Sprite;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  lit: boolean;
}

interface PulseView {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
}

/** Every object the player can see, built from the simulation state. */
export class GameView {
  private readonly root = new THREE.Group();
  private readonly playerGroup = new THREE.Group();
  private readonly playerHalo: THREE.Sprite;
  private readonly lanterns = new Map<string, LanternView>();
  private readonly motes = new Map<string, THREE.Group>();
  private readonly shades = new Map<string, THREE.Group>();
  private readonly drifters = new Map<string, THREE.Group>();
  private readonly charms = new Map<string, THREE.Group>();
  private readonly pulses: PulseView[] = [];
  private facing = 0;
  private lastX = 0;
  private lastZ = 0;
  private walkPhase = 0;

  constructor(
    stage: Stage,
    private readonly props: PropSet = {},
  ) {
    stage.scene.add(this.root);

    const cloth = new THREE.MeshStandardMaterial({ color: C.robe, emissive: 0x2a2216, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf6dcc0, emissive: 0x241a12, roughness: 0.8 });
    const hat = new THREE.MeshStandardMaterial({ color: 0xe6cfa6, emissive: 0x2b2114, roughness: 0.9, flatShading: true });
    const trousers = new THREE.MeshStandardMaterial({ color: 0xa8835c, emissive: 0x1c1409, roughness: 0.9 });
    const scarf = new THREE.MeshStandardMaterial({ color: C.scarf, emissive: 0x2a0206, roughness: 0.8 });

    const legLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 3, 8), trousers);
    legLeft.position.set(-0.14, 0.28, 0);
    const legRight = legLeft.clone();
    legRight.position.x = 0.14;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 4, 12), cloth);
    body.position.y = 0.78;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 10), scarf);
    neck.position.y = 1.02;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), skin);
    head.position.y = 1.24;
    const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.44, 26, 1, true), hat);
    hatCone.position.y = 1.45;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 26), hat);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 1.24;
    const armLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 3, 8), cloth);
    armLeft.position.set(-0.34, 0.84, 0);
    armLeft.rotation.z = 0.22;
    const armRight = armLeft.clone();
    armRight.position.x = 0.34;
    armRight.rotation.z = -0.22;

    const hatLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      new THREE.MeshStandardMaterial({ color: C.core, emissive: C.warm, emissiveIntensity: 2.2, roughness: 0.4 }),
    );
    hatLantern.position.set(0.34, 1.34, 0.3);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x6b5233 }));
    string.position.set(0.3, 1.44, 0.26);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;

    this.playerHalo = glowSprite(C.warm, 3.4, 0.3);
    this.playerHalo.position.y = 1.1;
    const front = new THREE.PointLight(0xffd2a0, 2.4, 13, 2);
    front.position.set(0.42, 1.55, 0.55);
    const back = new THREE.PointLight(0xffc98c, 1.8, 11, 2);
    back.position.set(-0.2, 1.5, -0.55);

    this.playerGroup.add(
      legLeft,
      legRight,
      body,
      neck,
      head,
      hatCone,
      brim,
      armLeft,
      armRight,
      hatLantern,
      string,
      shadow,
      this.playerHalo,
      front,
      back,
    );
    this.root.add(this.playerGroup);
  }

  rebuild(world: World): void {
    for (const map of [this.lanterns, this.motes, this.shades, this.drifters, this.charms]) {
      for (const view of map.values()) {
        disposeTree(view as THREE.Object3D);
        this.root.remove(view as THREE.Object3D);
      }
      map.clear();
    }
    for (const pulse of this.pulses) {
      disposeTree(pulse.mesh);
      this.root.remove(pulse.mesh);
    }
    this.pulses.length = 0;
    for (const lantern of world.lanterns) this.lanterns.set(lantern.id, this.buildLantern(lantern.x, lantern.y, lantern.z));
    this.sync(world, 0);
  }

  private buildLantern(x: number, y: number, z: number): LanternView {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const timber = new THREE.MeshStandardMaterial({ color: 0x453629, roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.24, 12), timber);
    base.position.y = 0.12;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 4.2, 10), timber);
    pole.position.y = 2.22;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.09), timber);
    arm.position.set(0.42, 4.28, 0);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), timber);
    hook.position.set(0.82, 4.11, 0);

    const housing = placeProp(this.props.lantern, 1.5);
    const coreRadius = housing ? 0.3 : 0.42;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius, 20, 16),
      new THREE.MeshStandardMaterial({
        color: C.off,
        emissive: 0x1d1a10,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        transparent: true,
        opacity: 0.95,
      }),
    );
    core.position.set(0.82, 3.55, 0);
    core.scale.set(1, 1.22, 1);
    const halo = glowSprite(C.warm, 6.6, 0);
    halo.position.set(0.82, 3.55, 0);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(TUNING.safe_radius - 0.07, TUNING.safe_radius, 72),
      new THREE.MeshBasicMaterial({ color: C.warm, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;

    group.add(base, pole, arm, hook, core, halo, ring);
    if (housing) {
      housing.position.set(0.82, 4.26 - 1.5, 0);
      group.add(housing);
    }
    this.root.add(group);
    return { group, core, halo, ring, lit: false };
  }

  private buildMote(kind: 'random' | 'dropped'): THREE.Group {
    const group = new THREE.Group();
    const color = kind === 'random' ? C.moteCore : C.gold;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      new THREE.MeshStandardMaterial({ color, emissive: C.moteHalo, emissiveIntensity: 1.6, roughness: 0.4 }),
    );
    const halo = glowSprite(C.moteHalo, 1.5, 0.6);
    group.add(core, halo);
    this.root.add(group);
    return group;
  }

  private buildShade(): THREE.Group {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshStandardMaterial({
        color: C.shadeBody,
        emissive: C.shadeRim,
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.15,
        flatShading: true,
        transparent: true,
        opacity: 0.97,
      }),
    );
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.02, 1),
      new THREE.MeshBasicMaterial({
        color: C.shadeRim,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        wireframe: true,
      }),
    );
    const halo = glowSprite(C.shadeRim, 4.8, 0.45);
    group.add(core, shell, halo);
    this.root.add(group);
    return group;
  }

  private buildDrifter(): THREE.Group {
    const group = new THREE.Group();
    const ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.16, 8, 32, Math.PI * 1.6),
      new THREE.MeshStandardMaterial({ color: C.drifter, emissive: 0x2a3a4a, roughness: 0.6, metalness: 0.2 }),
    );
    ribbon.rotation.x = Math.PI / 2.4;
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 3.2),
      new THREE.MeshBasicMaterial({ color: C.drifter, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    veil.position.y = 0.6;
    const halo = glowSprite(C.drifter, 3.4, 0.35);
    group.add(ribbon, veil, halo);
    this.root.add(group);
    return group;
  }

  private buildCharm(): THREE.Group {
    const group = new THREE.Group();
    const talisman = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.62, 0.05),
      new THREE.MeshStandardMaterial({ color: C.scarf, emissive: 0x3a0a10, roughness: 0.7 }),
    );
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.03),
      new THREE.MeshStandardMaterial({ color: C.gold, emissive: 0x4a3208, roughness: 0.5, metalness: 0.5 }),
    );
    border.position.z = -0.03;
    const halo = glowSprite(C.gold, 1.9, 0.55);
    group.add(border, talisman, halo);
    this.root.add(group);
    return group;
  }

  sync(world: World, elapsed: number): void {
    const p = world.player;
    this.playerGroup.position.set(p.x, p.y, p.z);
    const dx = p.x - this.lastX;
    const dz = p.z - this.lastZ;
    if (Math.hypot(dx, dz) > 0.0005) {
      this.facing = Math.atan2(dx, dz);
      this.walkPhase += Math.hypot(dx, dz) * 6;
    }
    this.lastX = p.x;
    this.lastZ = p.z;
    this.playerGroup.rotation.y = this.facing;
    this.playerGroup.position.y = p.y + (p.grounded ? Math.abs(Math.sin(this.walkPhase)) * 0.045 : 0);
    this.playerGroup.visible = p.fallenTicks <= 0 || p.fallenTicks % 8 < 4;
    // Dashing makes the halo flare.
    this.playerHalo.material.opacity = p.dashTicks > 0 ? 0.85 : 0.3;

    for (const lantern of world.lanterns) {
      const view = this.lanterns.get(lantern.id);
      if (!view) continue;
      if (lantern.lit !== view.lit) {
        view.lit = lantern.lit;
        view.core.material.emissive.setHex(lantern.lit ? C.warm : 0x1d1a10);
        view.core.material.emissiveIntensity = lantern.lit ? 3.2 : 0.7;
        view.core.material.color.setHex(lantern.lit ? C.core : C.off);
      }
      const glow = lantern.lit ? 0.85 + Math.sin(elapsed * 2.4) * 0.12 : 0;
      view.halo.material.opacity = glow * 0.95;
      view.ring.material.opacity = lantern.lit ? 0.18 + Math.sin(elapsed * 1.8) * 0.03 : 0;
    }

    for (const charm of world.charms) {
      let view = this.charms.get(charm.id);
      if (!view) {
        view = this.buildCharm();
        this.charms.set(charm.id, view);
      }
      view.visible = charm.available;
      view.position.set(charm.x, charm.y + 1.0 + Math.sin(elapsed * 2 + charm.x) * 0.12, charm.z);
      view.rotation.y = elapsed * 1.4;
    }

    for (const mote of world.motes) {
      let view = this.motes.get(mote.id);
      if (!view) {
        view = this.buildMote(mote.kind);
        this.motes.set(mote.id, view);
      }
      view.visible = mote.active;
      if (!mote.active) continue;
      const bob = Math.sin(elapsed * 2.2 + mote.x * 0.7 + mote.z * 0.5) * 0.18;
      view.position.set(mote.x, mote.y + 0.95 + bob, mote.z);
      view.rotation.y = elapsed * 0.8;
    }

    for (const shade of world.shades) {
      let view = this.shades.get(shade.id);
      if (!view) {
        view = this.buildShade();
        this.shades.set(shade.id, view);
      }
      view.position.set(shade.x, shade.y, shade.z);
      const { state } = shade;
      const spawn = state === 'spawning' ? 0.4 + 0.6 * (1 - Math.min(1, shade.stateTicksLeft / 30)) : 1;
      const breathe = state === 'stunned' ? 0.82 : 1 + Math.sin(elapsed * 2.6 + shade.x) * 0.045;
      view.scale.setScalar(breathe * spawn);
      view.rotation.y = state === 'stunned' ? elapsed * 3 : elapsed * 0.6;
      view.rotation.x = Math.sin(elapsed * 1.3 + shade.x) * 0.12;
      const shell = view.children[1] as THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
      shell.material.color.setHex(state === 'stunned' ? C.shadeStunned : C.shadeRim);
      shell.material.opacity = state === 'stunned' ? 0.08 : 0.16;
    }

    for (const drifter of world.drifters) {
      let view = this.drifters.get(drifter.id);
      if (!view) {
        view = this.buildDrifter();
        this.drifters.set(drifter.id, view);
      }
      view.position.set(drifter.x, drifter.y, drifter.z);
      view.rotation.y = elapsed * 1.2 + drifter.x * 0.1;
      const scale = drifter.state === 'flee' ? 0.9 : 1;
      view.scale.setScalar(scale);
    }
  }

  flashPulse(x: number, y: number, z: number): void {
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
        color: C.core,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.12, z);
    this.root.add(mesh);
    this.pulses.push({ mesh, age: 0 });
  }

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
      pulse.mesh.scale.setScalar(THREE.MathUtils.lerp(1, TUNING.pulse_radius, Math.sqrt(t)));
      pulse.mesh.material.opacity = 0.85 * (1 - t) ** 1.5;
    }
  }

  readonly cameraTarget = new THREE.Vector3();
  getCameraTarget(world: World): THREE.Vector3 {
    this.cameraTarget.set(world.player.x, world.player.y + 1.55, world.player.z);
    return this.cameraTarget;
  }

  /** Counts used by the screenshot bot to prove spawned entities are drawn. */
  get counts(): { shades: number; drifters: number; motes: number; charms: number } {
    return {
      shades: this.shades.size,
      drifters: this.drifters.size,
      motes: this.motes.size,
      charms: this.charms.size,
    };
  }
}
