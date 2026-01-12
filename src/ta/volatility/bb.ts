import { sma } from '../moving-averages/sma.js';
import { rollstdev } from '../../stats/var.js';
import { shouldSkipDenseOptimization } from '../util.js';
import { havena } from '../../arr/arr.js';

/**
 * Bollinger Bands (BB).
 * Returns `[middle, upper, lower]` where `middle` is the SMA, and `upper`/`lower`
 * are `middle ± mult * stddev`. Uses a NaN-aware or dense `rollstdev` depending
 * on input; positions before the window fills are NaN.
 * @param source Input series
 * @param period Window length (must be > 0)
 * @param mult Standard-deviation multiplier
 * @returns Tuple `[middle, upper, lower]` as Float64Array
 */
export function bb(source: ArrayLike<number>, period: number, mult: number): [Float64Array, Float64Array, Float64Array]{
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const middle = sma(source, period, true);
  const upper = new Float64Array(n);
  const lower = new Float64Array(n);

  // initialize outputs to NaN so positions before the first full period are NaN
  lower.fill(NaN, 0, Math.min(n, period));
  upper.fill(NaN, 0, Math.min(n, period));

  if (n < period) return [middle.fill(NaN), upper.fill(NaN), lower.fill(NaN)];

  // Choose dense or NaN-aware rollstdev depending on input
  const skipna = !(shouldSkipDenseOptimization() === false && !havena(source));
  const sd = rollstdev(source, period, { skipna, ddof: 0 }); // population stddev
  for (let i = period - 1; i < n; i++) {
    const m = middle[i];
    const s = sd[i];
    if (m !== m || s !== s) { // NaN check
      upper[i] = lower[i] = NaN;
      continue;
    }
    upper[i] = m + mult * s;
    lower[i] = m - mult * s;
  }

  return [middle, upper, lower];
}
