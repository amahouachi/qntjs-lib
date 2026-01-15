import { rollminmax } from '../../math/minmax.js';
import { sma } from '../moving-averages/sma.js';

/**
 * Stochastic oscillator (fast %K and %D smoothed outputs).
 * Computes fast %K based on rolling highest/lowest over `kPeriod`, then
 * smooths with `kSlow` and `dPeriod` using dense SMA. Assumes input series
 * length equality and returns NaN when insufficient data exists.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param kPeriod %K lookback period
 * @param kSlow Smoothing period for %K
 * @param dPeriod Smoothing period for %D
 * @returns Tuple `[slowK, slowD]` as Float64Array
 */
export function stoch(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, kPeriod: number, kSlow: number, dPeriod: number): [Float64Array, Float64Array] {
  if (kPeriod <= 0 || kSlow <= 0 || dPeriod <= 0) throw new Error('Periods must be positive');
  const n = close.length;
  if (high.length !== n || low.length !== n) throw new Error('high, low and close must have equal length');

  const outK = new Float64Array(n);
  const outD = new Float64Array(n);
  if (n === 0) return [outK, outD];

  // Match Tulind's minimum: kperiod + kslow + dperiod - 3
  // This is when the first output appears
  const required = kPeriod + kSlow + dPeriod - 3;
  if (n <= required) {
    return [outK.fill(NaN), outD.fill(NaN)];
  }

  // fastK buffer will be filled by the callback during rollminmax
  const fastK = new Float64Array(n).fill(NaN);

  // callback computes fastK[i] when rollminmax produces a window result for i
  const cb = (minV: number, maxV: number, i: number) => {
    const cv = close[i];
    const range = maxV - minV;
    fastK[i] = range === 0 ? 0 : ((cv - minV) / range) * 100;
  };

  // run single-pass rollminmax and compute fastK inline via callback
  rollminmax(low, high, kPeriod, cb);

  // smooth fastK -> slowK, then slowK -> slowD using SMA with skipna=true
  // to skip the leading NaNs from the rollminmax warmup period
  const slowK = sma(fastK, kSlow, true);
  const slowD = sma(slowK, dPeriod, true);

  // Mask out values before the required minimum (Tulind compatibility)
  // The first valid outputs should appear at index kPeriod + kSlow + dPeriod - 3
  for (let i = 0; i < required; i++) {
    outK[i] = NaN;
    outD[i] = NaN;
  }
  for (let i = required; i < n; i++) {
    outK[i] = slowK[i];
    outD[i] = slowD[i];
  }

  return [outK, outD];
}
