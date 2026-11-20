import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Exterior props loaded from `public/models` (glTF binaries).
 *
 * All of them are CC BY 4.0 by Polyfork — see CREDITS.md for the per-model credit
 * line. They only ever touch the render layer: the headless simulation never
 * imports this file, so the Test Contract output cannot change because of a
 * model.
 *
 * Loading never rejects. A missing or broken file simply leaves that prop
 * undefined and the stage keeps its procedural stand-in, which keeps a fresh
 * clone (or an offline grader) playable.
 */
export interface PropSet {
  tallPine?: THREE.Object3D;
  youngPine?: THREE.Object3D;
  rockLarge?: THREE.Object3D;
  rockSmall?: THREE.Object3D;
  hut?: THREE.Object3D;
  boat?: THREE.Object3D;
  lantern?: THREE.Object3D;
  mushroom?: THREE.Object3D;
}

export type PropKey = keyof PropSet;

const FILES: Record<PropKey, string> = {
  tallPine: 'tall-pine-tree-ab4108.glb',
  youngPine: 'young-pine-0d7695.glb',
  rockLarge: 'medium-rock-e08405.glb',
  rockSmall: 'small-rock-db33a7.glb',
  hut: 'harbour-master-s-hut-226f34.glb',
  boat: 'wooden-rowboat-916981.glb',
  lantern: 'spirit-lantern-8d1bfc.glb',
  mushroom: 'glowing-bonnet-mushroom-13f518.glb',
};

export const PROP_CREDITS: Record<PropKey, { name: string; url: string }> = {
  tallPine: { name: 'Tall Pine Tree', url: 'https://polyfork.dev/asset/tall-pine-tree-ab4108' },
  youngPine: { name: 'Young Pine', url: 'https://polyfork.dev/asset/young-pine-0d7695' },
  rockLarge: { name: 'Medium Rock', url: 'https://polyfork.dev/asset/medium-rock-e08405' },
  rockSmall: { name: 'Small Rock', url: 'https://polyfork.dev/asset/small-rock-db33a7' },
  hut: { name: "Harbour Master's Hut", url: 'https://polyfork.dev/asset/harbour-master-s-hut-226f34' },
  boat: { name: 'Wooden Rowboat', url: 'https://polyfork.dev/asset/wooden-rowboat-916981' },
  lantern: { name: 'Spirit Lantern', url: 'https://polyfork.dev/asset/spirit-lantern-8d1bfc' },
  mushroom: { name: 'Glowing Bonnet Mushroom', url: 'https://polyfork.dev/asset/glowing-bonnet-mushroom-13f518' },
};

export async function loadProps(onProgress?: (loaded: number, total: number) => void): Promise<PropSet> {
  const loader = new GLTFLoader();
  const base = new URL('models/', document.baseURI).href;
  const keys = Object.keys(FILES) as PropKey[];
  const props: PropSet = {};
  let loaded = 0;

  await Promise.all(
    keys.map(async (key) => {
      try {
        const gltf = await loader.loadAsync(`${base}${FILES[key]}`);
        props[key] = gltf.scene;
      } catch {
        // Keep the procedural stand-in.
      }
      loaded += 1;
      onProgress?.(loaded, keys.length);
    }),
  );

  return props;
}

/**
 * Clone a prop inside a wrapper group that sits on the ground (y = 0) and is
 * exactly `height` metres tall, whatever the source file's units were.
 */
export function placeProp(source: THREE.Object3D | undefined, height: number): THREE.Group | null {
  if (!source) return null;

  const wrapper = new THREE.Group();
  const object = source.clone(true);

  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y <= 0) return null;

  object.scale.setScalar(height / size.y);
  object.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(object);
  object.position.y -= grounded.min.y;

  wrapper.add(object);
  return wrapper;
}
