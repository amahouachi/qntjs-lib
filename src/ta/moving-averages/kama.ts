import { shouldSkipDenseOptimization } from "../util.js";
import { havena } from "../../arr/arr.js";

/**
 * Kaufman Adaptive Moving Average (KAMA).
 * Adapts smoothing based on the efficiency ratio (market noise vs direction).
 * This implementation supports NaN-aware and dense fast-paths; when NaNs are
 * present the compacting + mapping strategy is used, otherwise an O(n)
 * incremental volatility approach is used for speed.
 * @param source Input series
 * @param period Efficiency smoothing lookback (must be > 0)
 * @param fastPeriod Fast smoothing period (default: 2)
 * @param slowPeriod Slow smoothing period (default: 30)
 * @param skipna Whether to ignore NaNs (default: true)
 * @returns Float64Array of KAMA values (NaN where undefined)
 */
export function kama(source: ArrayLike<number>, period: number, fastPeriod: number= 2, slowPeriod: number= 30, skipna= true): Float64Array {

  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const result = new Float64Array(n);
  if (n < period) {
    result.fill(NaN);
    return result;
  }

  if (skipna && !shouldSkipDenseOptimization() && !havena(source)) {
    skipna = false;
  }

  if (!skipna) {
    return kamaDense(source, period, fastPeriod, slowPeriod);
  }

  return kamaNanAware(source, period, fastPeriod, slowPeriod);
} 

// Dense path for inputs without NaNs. Computes initial volatility by summing first period abs-differences
// and then updates the volatility incrementally using on-the-fly abs computations (no diffs array).
function kamaDense(source: ArrayLike<number>, period: number, fastPeriod: number, slowPeriod: number): Float64Array {
  const m = source.length;
  const result = new Float64Array(m);
  result.fill(NaN);
  if (m < period + 1) return result;

  const fastSC = 2 / (fastPeriod + 1);
  const slowSC = 2 / (slowPeriod + 1);
  const abs = Math.abs;

  // initial volatility: sum abs diffs for first `period` steps
  let vol = 0;
  for (let k = 1; k <= period; k++) vol += abs(source[k] - source[k - 1]);

  let prevKama = source[period - 1];
  result[period - 1] = prevKama;

  for (let i = period; i < m; i++) {
    const dirChange = abs(source[i] - source[i - period]);
    const er = vol !== 0 ? dirChange / vol : 0;
    const smoothConstant = er * (fastSC - slowSC) + slowSC;
    const sc = smoothConstant * smoothConstant;

    prevKama = prevKama + sc * (source[i] - prevKama);
    result[i] = prevKama;

    // Slide volatility window: compute next diff and outgoing diff on the fly
    if (i + 1 < m) {
      const diffIn = abs(source[i + 1] - source[i]);
      const diffOut = abs(source[i - period + 1] - source[i - period]);
      vol += diffIn - diffOut;
    }
  }

  return result;
}

// NaN-aware path optimized with a circular buffer to maintain the last (period+1) valid values
// and an incremental volatility sum. This makes updates O(1) per new valid value and avoids
// recomputing the entire volatility each step.
function kamaNanAware(source: ArrayLike<number>, period: number, fastPeriod: number, slowPeriod: number): Float64Array {
  // Simpler NaN-aware implementation: compact non-NaN values, run dense KAMA
  // on the compacted series, then map results back to original indices.
  const n = source.length;
  const out = new Float64Array(n);
  out.fill(NaN);

  // detect presence of NaNs
  let hasNaN = false;
  for (let i = 0; i < n; i++) if (source[i] !== source[i]) { hasNaN = true; break; }

  // If no NaNs, delegate to dense implementation for bit-identical behavior
  if (!hasNaN) return kamaDense(source, period, fastPeriod, slowPeriod);

  // compact non-NaN values
  const idxs: number[] = [];
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v === v) { idxs.push(i); vals.push(v); }
  }
  if (vals.length < period + 1) return out;

  // run dense KAMA on compacted values
  const compactResult = kamaDense(vals, period, fastPeriod, slowPeriod);

  // map compacted results back to original positions
  for (let j = 0; j < compactResult.length; j++) {
    const pos = idxs[j];
    out[pos] = compactResult[j];
  }

  return out;
}
