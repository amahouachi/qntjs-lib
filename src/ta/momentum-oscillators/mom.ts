/**
 * Momentum (difference) indicator.
 * Computes `src[i] - src[i - period]` for each index; positions where
 * the lagged value is not available are NaN.
 * @param src Input series
 * @param period Lag period (must be > 0)
 * @returns Float64Array of momentum values (NaN where undefined)
 */
export function mom(src: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = src.length;
  const out = new Float64Array(n).fill(NaN, 0, Math.min(n, period));
  if (n <= period) return out;

  for (let i = period; i < n; i++) {
    out[i] = src[i] - src[i - period];
  }
  return out;
}
