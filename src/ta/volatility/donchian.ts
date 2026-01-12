import { shouldSkipDenseOptimization } from '../util.js';
import { havena } from '../../arr/arr.js';

// Returns [upper, lower, middle]
/**
 * Donchian Channels.
 * Returns `[upper, lower, middle]` where `upper` is the highest high
 * and `lower` the lowest low over the lookback `period`. `middle` is the
 * midpoint. NaNs propagate when inputs are invalid.
 * @param high High price series
 * @param low Low price series
 * @param period Lookback period (must be > 0)
 * @returns Tuple `[upper, lower, middle]` as Float64Array
 */
export function donchian(high: ArrayLike<number>, low: ArrayLike<number>, period: number): [Float64Array, Float64Array, Float64Array] {
  if (period <= 0) throw new Error('Period must be positive');
  const n = high.length;
  if (low.length !== n) throw new Error('high/low must have the same length');

  const upper = new Float64Array(n);
  const lower = new Float64Array(n);
  const middle = new Float64Array(n);

  // fill initial positions with NaN up to period-1
  upper.fill(NaN, 0, Math.min(n, period - 1));
  lower.fill(NaN, 0, Math.min(n, period - 1));
  middle.fill(NaN, 0, Math.min(n, period - 1));

  if (n < period) return [upper, lower, middle];

  // simple dense/NaN-aware selection: when inputs contain NaNs we keep NaN in outputs
  const dense = !shouldSkipDenseOptimization() && !havena(high, low);

  for (let i = period - 1; i < n; i++) {
    let maxv = -Infinity;
    let minv = Infinity;
    let anyNaN = false;
    for (let j = i - period + 1; j <= i; j++) {
      const hv = high[j];
      const lv = low[j];
      if (hv !== hv || lv !== lv) {
        anyNaN = true;
        if (dense) break; // in dense path we shouldn't hit NaNs, but just in case
        break;
      }
      if (hv > maxv) maxv = hv;
      if (lv < minv) minv = lv;
    }
    if (anyNaN) {
      upper[i] = lower[i] = middle[i] = NaN;
      continue;
    }
    upper[i] = maxv;
    lower[i] = minv;
    middle[i] = (maxv + minv) / 2;
  }

  return [upper, lower, middle];
}
