import { shouldSkipDenseOptimization } from "../util.js";
import { havena } from "../../arr/arr.js";

/**
 * Weighted Moving Average (WMA).
 * Computes a linearly-weighted average over a sliding window with weights
 * 1..period (oldest..newest). When `skipna` is true NaNs are ignored
 * within the window; when false a dense fast-path is used.
 * @param source Input series
 * @param period Window length (must be > 0)
 * @param skipna Whether to ignore NaNs inside windows (default: true)
 * @returns Float64Array of WMA values (NaN before window fills)
 */
export function wma(source: ArrayLike<number>, period: number, skipna= true): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');

  const n = source.length;
  const out = new Float64Array(n);
  if( n < period) return out.fill(NaN); 

  if (skipna && !shouldSkipDenseOptimization() && !havena(source)) {
    skipna = false;
  }
  // Fast path: no NaNs at all, use dense logic directly
  if (!skipna) {
    return wmaDense(source, period, out);
  }
  return wmaNanAware(source, period, out);
}

function wmaDense(source: ArrayLike<number>, period: number, result: Float64Array): Float64Array {
  const n = source.length;
  const weightSum = (period * (period + 1)) / 2;

  let sum = 0;
  let wsum = 0;

  // first full window [0..period-1], weights 1..period (oldest..newest)
  for (let i = 0; i < period; i++) {
    const v = source[i];
    sum += v;
    wsum += v * (i + 1);
    result[i]= NaN;
  }
  result[period - 1] = wsum / weightSum;

  // slide window across series
  for (let i = period; i < n; i++) {
    const newV = source[i];
    const old = source[i - period];

    sum += newV - old;
    // recurrence: wsum_new = wsum_old - sum + (period + 1)*newV - old
    wsum = wsum - sum + (period + 1) * newV - old;

    result[i] = wsum / weightSum;
  }

  return result;
}
/**
 * NaN-aware WMA implementation with inline checks
 */
function wmaNanAware(source: ArrayLike<number>, period: number, result: Float64Array): Float64Array {
  const n = source.length;
  const p = period;
  // Circular buffer holds current window values (NaN for missing)
  const buf = new Float64Array(p);
  for (let i = 0; i < p; i++) buf[i] = NaN;

  let sum = 0; // sum of valid values in window
  let wsum = 0; // weighted sum using positional weights 1..p
  let adjustedWeightSum = 0; // sum of weights for valid slots
  let validCount = 0; // number of valid samples in window

  // Initialize first window [0..p-1]
  const firstEnd = Math.min(n, p);
  for (let j = 0; j < firstEnd; j++) {
    const v = source[j];
    buf[j] = v;
    if (v === v) {
      const w = j + 1;
      sum += v;
      wsum += v * w;
      adjustedWeightSum += w;
      validCount++;
    }
    result[j]= NaN;
  }

  if (validCount > 0) {
    result[p - 1] = wsum / adjustedWeightSum;
  } else {
    result[p - 1] = NaN;
  }

  // idx points to the oldest element in buffer (to be removed next)
  let idx = 0;
  // process sliding windows for i = p .. n-1
  for (let i = p; i < n; i++) {
    const newV = source[i];

    const old = buf[idx];
    const oldValid = old === old;
    const newValid = newV === newV;

    const sumOld = sum; // sum including old

    // Update sum: remove old, add new (treat NaN as 0)
    if (oldValid) sum -= old;
    if (newValid) sum += newV;

    // Update wsum using recurrence derived for positional weights
    // wsum_new = wsum_old - sum_old + (newV_valid ? newV * p : 0)
    wsum = wsum - sumOld + (newValid ? newV * p : 0);

    // Update adjustedWeightSum: shifted weights decrease by validCount_old, then add p for new if valid
    adjustedWeightSum = adjustedWeightSum - validCount + (newValid ? p : 0);

    // Update validCount after removal/add
    if (oldValid) validCount--;
    if (newValid) validCount++;

    // place new value in buffer
    buf[idx] = newV;
    idx = (idx + 1) % p;

    // compute result
    if (adjustedWeightSum > 0) {
      result[i] = wsum / adjustedWeightSum;
    } else {
      result[i] = NaN;
    }
  }

  return result;
}
