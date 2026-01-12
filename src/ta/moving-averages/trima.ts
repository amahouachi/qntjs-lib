import { sma } from "./sma.js";

/**
 * Triangular Moving Average (TRIMA).
 * A triangular-weighted moving average implemented via two `sma` passes.
 * Preserves NaN handling by delegating to `sma` implementations.
 * @param source Input series
 * @param period Window length (must be > 0)
 * @returns Float64Array of TRIMA values (NaN where undefined)
 */
export function trima(source: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  if (n < period) {
    return new Float64Array(n).fill(NaN);
  }
  const period2 = Math.floor((period + 1) / 2);
  return sma(sma(source, period2, false), period + 1 - period2, false);
}
