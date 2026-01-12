import { shouldSkipDenseOptimization } from "../util.js";

// Dense RSI calculator that assumes the input contains no NaNs.
function rsiDense(src: ArrayLike<number>, period: number): Float64Array {
  const n = src.length;
  const result= new Float64Array(n);
  // default to NaN for indices where RSI cannot be computed
  result.fill(NaN, 0, period);
  if (n < period + 1) return result;

  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = src[i] - src[i - 1];
    if (change > 0) sumGain += change; else sumLoss += -change;
  }
  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;

  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < n; i++) {
    const change = src[i] - src[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return result;
}

// NaN-aware in-place RSI that emulates compacting non-NaN values but without allocation.
function rsiSkipNan(src: ArrayLike<number>, period: number): Float64Array {
  const n = src.length;
  const result = new Float64Array(n);
  // default to NaN for indices where RSI cannot be computed
  result.fill(NaN);
  if (n < period + 1) return result;

  let sumGain = 0;
  let sumLoss = 0;
  let valid = 0; // number of deltas accumulated
  let avgGain = NaN;
  let avgLoss = NaN;

  let lastVal = NaN;
  for (let i = 0; i < n; i++) {
    const v = src[i];
    if (v !== v) {
      // gap; leave result[i] = NaN and continue without resetting state
      continue;
    }
    if (lastVal !== lastVal) {
      // this is the first non-NaN value seen
      lastVal = v;
      continue;
    }
    // compute delta between last valid and current
    const change = v - lastVal;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (valid < period) {
      sumGain += gain;
      sumLoss += loss;
      valid++;
      if (valid === period) {
        avgGain = sumGain / period;
        avgLoss = sumLoss / period;
        result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
      } else {
        result[i] = NaN;
      }
    } else {
      // Wilder smoothing
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }
    lastVal = v;
  }
  return result;
}

/**
 * Relative Strength Index (RSI) with optional NaN-aware behavior.
 * - `skipna=false` (dense path): assumes inputs contain no NaNs or that NaN
 *   propagation is desired; uses a dense fast-path implementation.
 * - `skipna=true` (NaN-aware): skips NaNs when computing deltas and preserves
 *   gaps in the output where insufficient valid data exists.
 * Seeding: the implementation seeds on the first valid value and uses Wilder
 * smoothing once the initial window is filled.
 * @param src Input series
 * @param period Lookback period for RSI (must be > 0)
 * @param skipna Whether to ignore NaNs during computation (default: true)
 * @returns Float64Array of RSI values (NaN where undefined)
 */
export function rsi(src: ArrayLike<number>, period: number, skipna= true): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n= src.length;

  if(skipna && !shouldSkipDenseOptimization()) {
    // Check if there are any NaNs in the inputs
    let hasNaN = false;
    for (let i = 0; i < n; i++) {
      if (src[i] !== src[i]) {
        hasNaN = true;
        break;
      }
    }
    // If no NaNs, use the dense algorithm for exact same precision
    if (!hasNaN) {
      skipna= false;
    }
  }
  if (!skipna) {
    return rsiDense(src, period);
  }

  // NaN-aware in-place path that reuses dense logic without compression
  return rsiSkipNan(src, period);
}
