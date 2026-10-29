/** Seeded PRNG (mulberry32) so the simulated fleet looks the same after every restart. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export const chance = (rng: Rng, probability: number) => rng() < probability;

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
