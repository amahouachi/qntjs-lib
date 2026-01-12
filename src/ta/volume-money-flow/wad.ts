import { havena } from "../../arr/arr.js";
import { shouldSkipDenseOptimization } from "../util.js";

function wadDense(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, n: number, out: Float64Array): Float64Array {
  let acc = 0;
  out[0] = NaN;
  for (let i = 1; i < n; i++) {
    const prev = close[i - 1];
    const c = close[i];
    let mf = 0;
    if (c > prev) {
      mf = c - Math.min(low[i], prev);
    } else if (c < prev) {
      mf = c - Math.max(high[i], prev);
    }
    acc += mf;
    out[i] = acc;
  }
  return out;
}

function wadNanAware(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, n: number, out: Float64Array): Float64Array {
  // NaN-aware: same algorithm as dense but skip NaN values
  let acc = 0;
  
  // Find first valid value to initialize
  let firstValidIdx = -1;
  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    if (h === h && l === l && c === c) {
      out[i] = NaN;
      firstValidIdx = i;
      break;
    }
  }
  
  if (firstValidIdx === -1) return out; // No valid values
  
  // Process remaining values
  for (let i = firstValidIdx + 1; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    const prevC = close[i - 1];
    
    // Only accumulate if all current and previous values are valid
    if (h === h && l === l && c === c && prevC === prevC) {
      let mf = 0;
      if (c > prevC) {
        mf = c - Math.min(l, prevC);
      } else if (c < prevC) {
        mf = c - Math.max(h, prevC);
      }
      acc += mf;
      out[i] = acc;
    }
    // else out[i] remains NaN
  }
  
  return out;
}

/**
 * Williams Accumulation/Distribution (WAD).
 * Accumulates the money flow based on price movement using either a dense
 * fast-path or a NaN-aware path depending on `skipna` and input contents.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param skipna Whether to ignore NaNs (default: true)
 * @returns Float64Array of WAD values (NaN where undefined)
 */
export function wad(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, skipna= true): Float64Array {
  const n = close.length;
  if (high.length !== n || low.length !== n) throw new Error('high, low and close must have equal length');
  const out = new Float64Array(n);
  if (n === 0) return out;

  if(skipna && !shouldSkipDenseOptimization() && !havena(high, low, close)) {
    return wadDense(high, low, close, n, out);
  }
  if (!skipna) {
    return wadDense(high, low, close, n, out);
  }
  out.fill(NaN);
  return wadNanAware(high, low, close, n, out);
}
