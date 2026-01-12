import { shouldSkipDenseOptimization } from "../ta/util.js";
import { havena } from "../arr/arr.js";

/**
 * Sum of array elements with optional NaN-skipping.
 * When `skipna` is true (default) NaNs are ignored; returns NaN if no valid samples.
 * Uses a fast dense path when global optimization allows it.
 * @param source Input array
 * @param skipna Whether to ignore NaNs (default: true)
 * @returns Sum or NaN
 */
export function sum(source: ArrayLike<number>, skipna= true): number{
  let s = 0;
  let cnt = 0;
  
  if(!shouldSkipDenseOptimization() && skipna) {
    // fast-path: if no NaNs present, avoid per-element checks
    if (!havena(source)) {
      skipna = false;
    }
  }
  
  if(!skipna){
    cnt= source.length;
    for (let i = 0; i < source.length; i++) {
      s+= source[i];
    }
  }else{
    for (let i = 0; i < source.length; i++) {
      const v = source[i];
      if (v === v) {
        s += v;
        cnt++;
      }
    }
  }
  if (cnt === 0) {
    return NaN;
  }
  return s;
}
/**
 * Cumulative sum preserving NaNs: NaN entries do not increase the running sum
 * but are represented as the running total up to that point.
 * @param source Input array
 * @returns Float64Array of cumulative sums
 */
export function cumsum(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v === v) {
      s += v;
    }
    out[i] = s;
  }
  return out;
}
/**
 * Rolling sum over a window with optional NaN-skipping.
 * If `skipna` is true, windows with no valid values produce NaN.
 * Supports a fast dense path when inputs contain no NaNs.
 * @param source Input array
 * @param period Window length (must be > 0)
 * @param skipna Whether to ignore NaNs (default: true)
 * @returns Float64Array of rolling sums (NaN for positions before window fills)
 */
export function rollsum(source: ArrayLike<number>, period: number, skipna= true): Float64Array {
  // Coerce input to Float64Array once (and cache) so hot loops operate on typed memory
  const n = source.length;
  const out = new Float64Array(n);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out.fill(NaN);

  if (!shouldSkipDenseOptimization()) {
    // fast-path: if no NaNs present, avoid per-element checks
    if (skipna && !havena(source)) {
      skipna = false;
    }
  }

  // If input has no NaNs (or global mode assumes no NaNs) take the original fast dense path
  if (!skipna) {
    let s = 0;
    for (let i = 0; i < period; i++) s += source[i];
    out[period - 1] = s;
    for (let i = period; i < n; i++) { s += source[i] - source[i - period]; out[i] = s; }
    return out;
  }

  // Otherwise fall back to the NaN-tolerant incremental sliding window.
  let sum = 0;
  let count = 0;
  // initialize window [0..period-1]
  for (let i = 0; i < period; i++) {
    const v = source[i];
    if (v === v) { sum += v; count++; }
  }
  // first output at period-1: emit aggregated sum if any valid samples exist
  out[period - 1] = count > 0 ? sum : NaN;

  for (let i = period; i < n; i++) {
    const newV = source[i];
    const oldV = source[i - period];
    if (newV === newV) { sum += newV; count++; }
    if (oldV === oldV) { sum -= oldV; count--; }
    out[i] = count > 0 ? sum : NaN;
  }
  return out;
}
