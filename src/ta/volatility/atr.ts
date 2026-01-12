import { apply, applyInPlace } from '../../math/basic.js';
import { rma } from '../moving-averages/rma.js';
import { shouldSkipDenseOptimization } from '../util.js';
import { havena } from '../../arr/arr.js';

/**
 * True Range (TR).
 * TR[i] = max(high[i]-low[i], |high[i]-close[i-1]|, |low[i]-close[i-1]|).
 * Preserves NaNs and returns NaN where inputs are invalid.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @returns Float64Array of TR values
 */
export function tr(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>): Float64Array {
  const n = high.length;
  if (low.length !== n || close.length !== n) throw new Error('high/low/close must have the same length');
  const out = new Float64Array(n);
  if (n === 0) return new Float64Array(n);

  out[0] = close[0] === close[0] ? high[0] - low[0] : NaN;
  for (let i = 1; i < n; i++) {
    const r1 = high[i] - low[i];
    const r2 = Math.abs(high[i] - close[i - 1]);
    const r3 = Math.abs(low[i] - close[i - 1]);
    out[i] = Math.max(r1, Math.max(r2, r3));
  }
  return out;
}

/**
 * Average True Range (ATR).
 * Computes ATR using Wilder's RMA over the true-range series. Handles NaNs
 * via the `rma` NaN-aware implementation; returns NaN for indices before the
 * lookback is filled.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of ATR values
 */
export function atr(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');
  const n = high.length;
  if (n < period) {
    return new Float64Array(n).fill(NaN);
  }

  const trArr = tr(high, low, close);
  // Choose dense path when inputs have no NaNs
  if (!shouldSkipDenseOptimization() && !havena(high, low, close)) {
    return rma(trArr, period, false);
  }
  return rma(trArr, period, true);
}


export function natr(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array {
  const natrArr = atr(high, low, close, period) as Float64Array;
  applyInPlace(natrArr, (v, i) => (v / close[i]) * 100);
  return natrArr;
}