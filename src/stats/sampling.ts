
/**
 * In-place Fisher–Yates shuffle of `arr`.
 * Uses `Math.random()`; tests should stub `Math.random` for determinism.
 * @param arr Array to shuffle (mutated)
 * @returns The shuffled array (same reference)
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }

  return arr;
}

/**
 * Draw `k` unique samples without replacement from `arr`.
 * If `k` >= arr.length a shallow copy is returned. Uses `Math.random()`.
 * @param arr Source array
 * @param k Number of samples to draw
 * @returns Array of sampled elements
 */
export function sample<T>(arr: T[], k: number): T[] {
  if (k <= 0) {
    return [];
  }

  const n = arr.length;

  if (k >= n) {
    return arr.slice();
  }

  const res: T[] = [];
  const copy = arr.slice();

  for (let i = 0; i < k; i++) {
    const j = Math.floor(Math.random() * (copy.length));
    res.push(copy[j]);
    copy.splice(j, 1);
  }

  return res;
}

/**
 * Draw `k` bootstrap samples (with replacement) from `arr`.
 * Uses `Math.random()`; tests should stub `Math.random` for determinism.
 * @param arr Source array
 * @param k Number of draws
 * @returns Array of sampled elements (with replacement)
 */
export function bootstrap<T>(arr: T[], k: number): T[] {
  const res: T[] = [];

  for (let i = 0; i < k; i++) {
    const j = Math.floor(Math.random() * arr.length);
    res.push(arr[j]);
  }

  return res;
}