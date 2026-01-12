import { bb } from './bb.js';

/**
 * Bollinger Band Width (BBW).
 * Returns the normalized width of the Bollinger Bands as percentage: `100*(upper-lower)/middle`.
 * NaNs propagate and positions with `middle === 0` leave the output unchanged (NaN or 0).
 * @param source Input series
 * @param period Window length
 * @param mult Standard-deviation multiplier used for BB
 * @returns Float64Array of BB width percentages
 */
export function bbw(source: ArrayLike<number>, period: number, mult: number): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n === 0) return out;

  const [middle, upper, lower] = bb(source, period, mult);
  for (let i = 0; i < n; i++) {
    const m = middle[i];
    const u = upper[i];
    const l = lower[i];
    if (m !== 0) {
      out[i] = 100 * (u - l) / m;
    }
  }
  return out;
}
