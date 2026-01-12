import { shouldSkipDenseOptimization } from "../ta/util.js";
import { havena } from "../arr/arr.js";
import { sum } from "../math/sum.js";

// mean: options-based signature { weights?, skipna? }
/**
 * Compute the (possibly weighted) mean of `source`.
 * By default NaNs are skipped (`skipna=true`). When `weights` are provided they
 * must match `source` length and the function computes the weighted mean.
 * A dense fast-path is used when the global optimization allows it.
 * @param source Input array
 * @param options Optional `{ weights?, skipna? }`
 * @returns Mean value or NaN when undefined
 */
export function mean(source: ArrayLike<number>, options: { weights?: ArrayLike<number>, skipna?: boolean } = { skipna: true }): number {
  const weights = options?.weights;
  let skipna = options?.skipna ?? true;

  if (weights && weights.length !== source.length) throw new Error('source and weights must have same length');

  // fast-path detection
  if (!shouldSkipDenseOptimization() && skipna) {
    if (weights) {
      if (!havena(source, weights)) skipna = false;
    } else {
      if (!havena(source)) skipna = false;
    }
  }

  if (!weights) {
    // unweighted mean (existing behavior)
    if (!skipna) {
      const s = sum(source, false);
      if (s !== s) return NaN;
      return s / source.length;
    }

    const s = sum(source, true);
    if (s !== s) return NaN;
    let cnt = 0;
    for (let i = 0; i < source.length; i++) if (source[i] === source[i]) cnt++;
    return s / cnt;
  }

  // weighted mean
  if (!skipna) {
    let num = 0;
    let wsum = 0;
    for (let i = 0; i < source.length; i++) {
      const v = source[i];
      const w = weights[i];
      num += v * w;
      wsum += w;
    }
    return wsum === 0 ? NaN : num / wsum;
  }

  let num = 0;
  let wsum = 0;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    const w = weights[i];
    if (v === v && w === w) {
      num += v * w;
      wsum += w;
    }
  }
  return wsum === 0 ? NaN : num / wsum;
} 

// rollmean(source, period, skipna?)
/**
 * Rolling mean (moving average) over a sliding window of length `period`.
 * When `skipna` is true, NaNs inside windows are ignored; windows with no
 * valid values produce NaN. A fast dense path is used when no NaNs.
 * @param source Input array
 * @param period Window length (>0)
 * @param skipna Whether to ignore NaNs (default: true)
 * @returns Float64Array of rolling means
 */
export function rollmean(source: ArrayLike<number>, period: number, skipna= true): Float64Array{
  const n = source.length;
  const out = new Float64Array(n);
  out.fill(NaN);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out;

  if (!shouldSkipDenseOptimization() && skipna && !havena(source)) {
    // fast dense path when no NaNs (or global mode assumes no NaNs): simple sliding sum divided by period
    let s = 0;
    for (let i = 0; i < period; i++) s += source[i];
    out[period - 1] = s / period;
    for (let i = period; i < n; i++) { s += source[i] - source[i - period]; out[i] = s / period; }
    return out;
  }

  // NaN-tolerant incremental mean (ignore NaNs inside window)
  let sum = 0;
  let count = 0;
  for (let i = 0; i < period; i++) {
    const v = source[i];
    if (v === v) { sum += v; count++; }
  }
  out[period - 1] = count > 0 ? sum / count : NaN;

  for (let i = period; i < n; i++) {
    const newV = source[i];
    const oldV = source[i - period];
    if (newV === newV) { sum += newV; count++; }
    if (oldV === oldV) { sum -= oldV; count--; }
    out[i] = count > 0 ? sum / count : NaN;
  }
  return out;
}

// hmean: options-based signature { weights?, skipna? }
/**
 * Harmonic mean (optionally weighted). Values must be positive; NaNs are
 * ignored when `skipna` is true. Returns NaN when no valid values.
 * @param source Input array
 * @param options Optional `{ weights?, skipna? }`
 * @returns Harmonic mean or NaN
 */
export function hmean(source: ArrayLike<number>, options: { weights?: ArrayLike<number>, skipna?: boolean } = { skipna: true }): number {
  const weights = options?.weights;
  let skipna = options?.skipna ?? true;
  if (weights && weights.length !== source.length) throw new Error('source and weights must have same length');

  if (!shouldSkipDenseOptimization() && skipna) {
    if (weights) {
      if (!havena(source, weights)) skipna = false;
    } else {
      if (!havena(source)) skipna = false;
    }
  }

  // Weighted harmonic mean: wsum / sum(w / x)
  if (!weights) {
    if (!skipna) {
      let recipSum = 0;
      for (let i = 0; i < source.length; i++) {
        const v = source[i];
        if (v <= 0 || v !== v) return NaN;
        recipSum += 1 / v;
      }
      return source.length === 0 ? NaN : source.length / recipSum;
    }

    let recipSum = 0;
    let cnt = 0;
    for (let i = 0; i < source.length; i++) {
      const v = source[i];
      if (v === v) {
        if (v <= 0) return NaN;
        recipSum += 1 / v;
        cnt++;
      }
    }
    return cnt === 0 ? NaN : cnt / recipSum;
  }

  // weighted
  if (!skipna) {
    let recipSum = 0;
    let wsum = 0;
    for (let i = 0; i < source.length; i++) {
      const v = source[i];
      const w = weights[i];
      if (v <= 0 || v !== v || w !== w) return NaN;
      recipSum += w / v;
      wsum += w;
    }
    return wsum === 0 ? NaN : wsum / recipSum;
  }

  let recipSum = 0;
  let wsum = 0;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    const w = weights[i];
    if (v === v && w === w) {
      if (v <= 0) return NaN;
      recipSum += w / v;
      wsum += w;
    }
  }
  return wsum === 0 ? NaN : wsum / recipSum;
} 

// gmean: options-based signature { weights?, skipna? }
/**
 * Geometric mean (optionally weighted). Values must be positive; NaNs are
 * ignored when `skipna` is true. Returns NaN when no valid values.
 * @param source Input array
 * @param options Optional `{ weights?, skipna? }`
 * @returns Geometric mean or NaN
 */
export function gmean(source: ArrayLike<number>, options: { weights?: ArrayLike<number>, skipna?: boolean } = { skipna: true }): number {
  const weights = options?.weights;
  let skipna = options?.skipna ?? true;
  if (weights && weights.length !== source.length) throw new Error('source and weights must have same length');

  if (!shouldSkipDenseOptimization() && skipna) {
    if (weights) {
      if (!havena(source, weights)) skipna = false;
    } else {
      if (!havena(source)) skipna = false;
    }
  }

  if (!weights) {
    if (!skipna) {
      let logSum = 0;
      for (let i = 0; i < source.length; i++) {
        const v = source[i];
        if (v <= 0 || v !== v) return NaN;
        logSum += Math.log(v);
      }
      return source.length === 0 ? NaN : Math.exp(logSum / source.length);
    }

    let logSum = 0;
    let cnt = 0;
    for (let i = 0; i < source.length; i++) {
      const v = source[i];
      if (v === v) {
        if (v <= 0) return NaN;
        logSum += Math.log(v);
        cnt++;
      }
    }
    return cnt === 0 ? NaN : Math.exp(logSum / cnt);
  }

  // weighted geometric mean: exp( sum(w_i * ln(v_i)) / sum(w_i) )
  if (!skipna) {
    let logSum = 0;
    let wsum = 0;
    for (let i = 0; i < source.length; i++) {
      const v = source[i];
      const w = weights[i];
      if (v <= 0 || v !== v || w !== w) return NaN;
      logSum += w * Math.log(v);
      wsum += w;
    }
    return wsum === 0 ? NaN : Math.exp(logSum / wsum);
  }

  let logSum = 0;
  let wsum = 0;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    const w = weights[i];
    if (v === v && w === w) {
      if (v <= 0) return NaN;
      logSum += w * Math.log(v);
      wsum += w;
    }
  }
  return wsum === 0 ? NaN : Math.exp(logSum / wsum);
} 
// mad
/**
 * Mean absolute deviation from the mean. When `skipna` is true NaNs are
 * ignored. Returns NaN when the input contains no valid values.
 * @param source Input array
 * @param options Optional `{ skipna? }`
 * @returns Mean absolute deviation or NaN
 */
export function mad(source: ArrayLike<number>, skipna: boolean = true): number {
  if (source.length === 0) return NaN;
  const m = mean(source, { skipna });
  if (m !== m) return NaN; 

  if (!shouldSkipDenseOptimization() && skipna && !havena(source)) {
    // fast-path: no NaNs
    let s = 0;
    for (let i = 0; i < source.length; i++) s += Math.abs(source[i] - m);
    return s / source.length;
  }

  let s = 0;
  let cnt = 0;
  if (!skipna) {
    for (let i = 0; i < source.length; i++) s += Math.abs(source[i] - m);
    return s / source.length;
  }
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v) { s += Math.abs(v - m); cnt++; }
  }
  return cnt === 0 ? NaN : s / cnt;
}
