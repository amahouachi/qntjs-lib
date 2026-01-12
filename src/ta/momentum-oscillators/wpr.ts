import { rollminmax } from '../../math/minmax.js';

/**
 * Williams %R (WPR).
 * Computes %R = (highestHigh - close) / (highestHigh - lowestLow) * -100
 * over a rolling `period`. Uses `rollminmax` to compute window extrema and
 * returns NaN for indices before `period` or when the range is zero.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of %R values (NaN where undefined)
 */
export function wpr(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = close.length;
  if (high.length !== n || low.length !== n) throw new Error('high, low and close must have equal length');

  const out = new Float64Array(n);
  out.fill(NaN);

  // callback invoked by rollminmax for each output index i (for i >= period-1)
  const cb = (minV: number, maxV: number, i: number) => {
    const c = close[i];
    const range = maxV - minV;
    out[i] = range === 0 ? 0 : ((maxV - c) / range) * -100;
  };

  // rollminmax takes (minSource, maxSource, period, cb)
  rollminmax(low, high, period, cb);
  return out;
}