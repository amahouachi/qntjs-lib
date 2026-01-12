// filepath: src/math/random.ts

/**
 * Generate `n` uniform random values in [lo, hi).
 * Uses `Math.random()`; tests should stub `Math.random` for determinism.
 * @param n Number of samples to generate
 * @param options Optional `{ lo, hi }` bounds (defaults to 0..1)
 * @returns Float64Array of length `n`
 */
export function randuniform(n: number, options?: { lo?: number, hi?: number }): Float64Array{
  const lo = options?.lo ?? 0;
  const hi = options?.hi ?? 1;
  const out = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    out[i] = lo + Math.random() * (hi - lo);
  }

  return out;
}

/**
 * Generate `n` standard normal samples using the Box-Muller transform.
 * Uses `Math.random()`; tests should stub `Math.random` for determinism.
 * @param n Number of samples to generate
 * @param options Optional `{ mean, sd }` to shift/scale samples
 * @returns Float64Array of length `n`
 */
export function randnormal(n: number, options?: { mean?: number, sd?: number }): Float64Array {
  const meanV = options?.mean ?? 0;
  const sd = options?.sd ?? 1;
  const out = new Float64Array(n);

  for (let i = 0; i < n; i += 2) {
    const u1 = Math.random();
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    out[i] = meanV + sd * r * Math.cos(theta);

    if (i + 1 < n) {
      out[i + 1] = meanV + sd * r * Math.sin(theta);
    }
  }

  return out;
}

