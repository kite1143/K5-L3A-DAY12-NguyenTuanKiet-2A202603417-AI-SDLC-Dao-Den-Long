/**
 * Deterministic PRNG (mulberry32). No Math.random anywhere in src/core, so the
 * same seed always produces the same world (Test Contract v1.0, section E).
 */
export interface Rng {
  next(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Uniform float in [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}
