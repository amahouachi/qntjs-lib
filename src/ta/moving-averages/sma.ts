import { shouldSkipDenseOptimization } from "../util.js";
import { havena } from "../../arr/arr.js";

function smaDense(source: ArrayLike<number>, period: number, n: number, out: Float64Array): Float64Array {
    let sum = 0;
    for (let i = 0; i < period; i++){
      sum += source[i];
      out[i]= NaN;
    }
    out[period - 1] = sum / period;
    for (let i = period; i < n; i++) {
      sum += source[i] - source[i - period];
      out[i] = sum / period;
    }
    return out;
}
function smaNanAware(source: ArrayLike<number>, period: number, n: number, out: Float64Array): Float64Array {
  // NaN-aware sliding window: ignore NaNs inside window, emit NaN when window has zero valid samples
  let sum = 0;
  let count = 0;

  // initialize first window [0..period-1]
  for (let i = 0; i < period; i++) {
    const v = source[i];
    if (v === v) { sum += v; count++; }
    out[i] = NaN;
  }
  out[period - 1] = count > 0 ? sum / count : NaN;

  // slide window
  for (let i = period; i < n; i++) {
    const newV = source[i];
    const oldV = source[i - period];
    if (newV === newV) { sum += newV; count++; }
    if (oldV === oldV) { sum -= oldV; count--; }
    out[i] = count > 0 ? sum / count : NaN;
  }

  return out;
}

/**
 * Simple Moving Average (SMA).
 * Computes the arithmetic mean over a sliding window.
 * When `skipna` is true, NaNs inside the window are ignored; when false
 * a dense fast-path is used (assumes no NaNs).
 * @param source Input series
 * @param period Window length (must be > 0)
 * @param skipna Whether to ignore NaNs inside windows (default: true)
 * @returns Float64Array of SMA values (NaN before window fills)
 */
export function sma(source: ArrayLike<number>, period: number, skipna= true): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) {
    return out.fill(NaN) as any;
  }

  if (skipna && !shouldSkipDenseOptimization() && !havena(source)) {
    skipna = false;
  }
  
  return !skipna ? smaDense(source, period, n, out) : smaNanAware(source, period, n, out);
}


