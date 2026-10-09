// Seeded PRNG (mulberry32). The simulation never calls Math.random, so a
// battle replays identically from the same seed and the same inputs.
export interface Rng { next(): number; range(a: number, b: number): number; int(n: number): number; state(): number }

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: n => Math.floor(next() * n),
    state: () => s,
  };
}
