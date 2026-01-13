import { arr } from '../index.js';

export type DrawdownDurationResult= {
  durations: Int32Array; // -1 marks NaN positions
  maxDuration: number;
}

export type MaxDrawdownInfo= {
  maxDrawdown: number; // positive magnitude
  peakIndex: number;   // index of peak that started the worst drawdown
  troughIndex: number; // index of trough (min value during drawdown)
  startIndex: number;  // same as peakIndex (alias)
  endIndex: number;    // index where equity recovers above peak (or last valid)
}

// Drawdown series (relative, <= 0). Input: equity/prices series (level).
// For valid points: out[i] = equity[i]/peak - 1 (<= 0). NaN inputs produce NaN output and do not update peak.
/**
 * Compute the drawdown series from an equity/price series.
 * For valid points: out[i] = equity[i]/peak - 1 (<= 0). NaNs propagate and do not update the peak.
 * @param equity Array-like equity or price series
 * @returns Float64Array of drawdowns (same length)
 */
export function dd(equity: ArrayLike<number>): Float64Array {
  const n = equity.length;
  const out = new Float64Array(n);
  if (n === 0) return out;

  const mask = arr.notna(equity);
  // find first valid index
  let firstValidIdx = -1;
  for (let i = 0; i < n; i++) {
    if (mask[i] === 1) { firstValidIdx = i; break; }
  }
  if (firstValidIdx === -1) {
    return out.fill(NaN);
  }

  let peak = equity[firstValidIdx];
  // indices before first valid were NaN
  for (let i = 0; i < firstValidIdx; i++) out[i] = NaN;
  out[firstValidIdx] = 0; // first valid -> zero drawdown

  for (let i = firstValidIdx + 1; i < n; i++) {
    if (mask[i] !== 1) { out[i] = NaN; continue; }
    const v = equity[i];
    if (v > peak) {
      peak = v;
      out[i] = 0;
    } else {
      out[i] = v / peak - 1; // negative or zero
    }
  }
  return out;
}

// Maximum drawdown over the whole series, returned as a positive number (0..+inf).
// If no valid points, returns NaN.
/**
 * Compute the maximum drawdown magnitude over the entire series.
 * Returns a positive number (0..+inf) or NaN when no valid points.
 * @param equity Array-like equity or price series
 * @returns Maximum drawdown magnitude (positive) or NaN
 */
export function maxdd(equity: ArrayLike<number>): number {
  const n = equity.length;
  if (n === 0) return NaN;
  const mask = arr.notna(equity);
  // find first valid
  let first = -1;
  for (let i = 0; i < n; i++) if (mask[i] === 1) { first = i; break; }
  if (first === -1) return NaN;

  let peak = equity[first];
  let worst = 0; // most negative drawdown (<=0)
  let foundAny = false;

  for (let i = first + 1; i < n; i++) {
    if (mask[i] !== 1) continue;
    const v = equity[i];
    if (v > peak) {
      peak = v;
    } else {
      const dd = v / peak - 1;
      if (!foundAny || dd < worst) worst = dd;
      foundAny = true;
    }
  }
  if (!foundAny) return 0;
  return -worst; // positive magnitude
}

// Compute detailed max drawdown information including indices of peak and trough and recovery end.
// Returns NaN-filled indices (-1) when input has no valid points.
/**
 * Compute detailed information about the maximum drawdown, including peak, trough, and recovery indices.
 * When no valid points exist returns NaN/placeholder indices (-1).
 * @param equity Array-like equity or price series
 * @returns MaxDrawdownInfo with `maxDrawdown`, `peakIndex`, `troughIndex`, `startIndex`, and `endIndex`
 */
export function maxddDetails(equity: ArrayLike<number>): MaxDrawdownInfo {
  const n = equity.length;
  if (n === 0) return { maxDrawdown: NaN, peakIndex: -1, troughIndex: -1, startIndex: -1, endIndex: -1 };

  const mask = arr.notna(equity);
  // find first valid
  let first = -1;
  for (let i = 0; i < n; i++) if (mask[i] === 1) { first = i; break; }
  if (first === -1) return { maxDrawdown: NaN, peakIndex: -1, troughIndex: -1, startIndex: -1, endIndex: -1 };

  let peak = equity[first];
  let peakIdx = first;
  let worst = 0; // most negative drawdown
  let troughIdx = first;

  // Track the peak that produced the worst drawdown
  for (let i = first + 1; i < n; i++) {
    if (mask[i] !== 1) continue;
    const v = equity[i];
    if (v > peak) {
      peak = v;
      peakIdx = i;
    } else {
      const dd = v / peak - 1; // <= 0
      if (dd < worst) {
        worst = dd;
        troughIdx = i;
      }
    }
  }

  if (worst === 0) {
    // no drawdown observed
    return { maxDrawdown: 0, peakIndex: peakIdx, troughIndex: peakIdx, startIndex: peakIdx, endIndex: peakIdx };
  }

  const maxDrawdown = -worst;

  // Find the peak index associated with this trough: we need to find the last peak before troughIdx that was >= all previous values
  // We'll scan from first to troughIdx tracking peaks and keep the peak that was active when trough occurred.
  let curPeak = equity[first];
  let curPeakIdx = first;
  for (let i = first + 1; i <= troughIdx; i++) {
    if (mask[i] !== 1) continue;
    const v = equity[i];
    if (v > curPeak) {
      curPeak = v;
      curPeakIdx = i;
    }
  }

  const startIndex = curPeakIdx;

  // Find recovery end: first index after trough where value > peak at startIndex
  let endIndex = -1;
  const peakValue = equity[startIndex];
  for (let i = troughIdx + 1; i < n; i++) {
    if (mask[i] !== 1) continue;
    if (equity[i] > peakValue) { endIndex = i; break; }
  }
  if (endIndex === -1) {
    // no full recovery observed, set end to last valid index
    for (let i = n - 1; i >= 0; i--) if (mask[i] === 1) { endIndex = i; break; }
  }

  return {
    maxDrawdown,
    peakIndex: startIndex,
    troughIndex: troughIdx,
    startIndex,
    endIndex
  };
}

// Rolling maximum drawdown over a trailing window (window in periods).
// For each index i, compute max drawdown observed within [i-window+1 .. i].
// NaN handling: if the window contains no valid points, out[i] = NaN.
/**
 * Rolling maximum drawdown over a trailing window.
 * For each index i computes the max drawdown observed within the trailing window.
 * @param equity Array-like equity or price series
 * @param window Rolling window length (positive integer)
 * @returns Float64Array of rolling max drawdowns
 */
export function rollmaxdd(equity: ArrayLike<number>, window: number): Float64Array {
  if (window <= 0) throw new Error('window must be positive');
  const n = equity.length;
  const out = new Float64Array(n);
  if (n === 0) return out;

  const mask = arr.notna(equity);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - window + 1);
    // find first valid in window
    let first = -1;
    for (let j = start; j <= i; j++) if (mask[j] === 1) { first = j; break; }
    if (first === -1) { out[i] = NaN; continue; }

    let peak = equity[first];
    let worst = 0;
    let foundAny = false;
    for (let j = first + 1; j <= i; j++) {
      if (mask[j] !== 1) continue;
      const v = equity[j];
      if (v > peak) {
        peak = v;
      } else {
        const dd = v / peak - 1;
        if (!foundAny || dd < worst) worst = dd;
        foundAny = true;
      }
    }
    out[i] = foundAny ? -worst : 0;
  }
  return out;
}

// Drawdown duration series: number of consecutive periods in the current drawdown at each index.
// Returns an Int32Array (duration in periods) and maxDuration. Int entries are >= 0; positions where
// equity is NaN are marked with -1 in durations.
/**
 * Compute drawdown durations (consecutive periods in current drawdown) and the maximum duration.
 * Positions where equity is NaN are marked with -1.
 * @param equity Array-like equity or price series
 * @returns DrawdownDurationResult { durations: Int32Array, maxDuration: number }
 */
export function dduration(equity: ArrayLike<number>): DrawdownDurationResult {
  const n = equity.length;
  const durations = new Int32Array(n);
  const mask = arr.notna(equity);
  // find first valid
  let first = -1;
  for (let i = 0; i < n; i++) if (mask[i] === 1) { first = i; break; }
  if (first === -1) {
    for (let i = 0; i < n; i++) durations[i] = -1;
    return { durations, maxDuration: 0 };
  }

  let peak = equity[first];
  for (let i = 0; i < first; i++) durations[i] = -1;
  durations[first] = 0;
  let curDur = 0;
  let maxDur = 0;

  for (let i = first + 1; i < n; i++) {
    if (mask[i] !== 1) { durations[i] = -1; continue; }
    const v = equity[i];
    if (v > peak) {
      peak = v;
      curDur = 0;
      durations[i] = 0;
    } else {
      curDur++;
      durations[i] = curDur;
      if (curDur > maxDur) maxDur = curDur;
    }
  }
  return { durations, maxDuration: maxDur };
}

// Recovery factor: ratio of annualized return (CAGR) to maximum drawdown magnitude.
// Input: equity series (price/equity curve). freq = periods per year (default 252).
// Returns NaN when not enough data or max drawdown is zero.
/**
 * Recovery factor: ratio of annualized return (CAGR) to maximum drawdown magnitude.
 * Returns NaN if insufficient data, invalid start value, or zero/NaN max drawdown.
 * @param equity Array-like equity or price series
 * @param freq Periods per year (default 252)
 * @returns Recovery factor or NaN
 */
export function recoveryFactor(equity: ArrayLike<number>, freq: number = 252): number {
  const n = equity.length;
  if (n === 0) return NaN;

  const mask = arr.notna(equity);
  // find first and last valid indices
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) if (mask[i] === 1) { first = i; break; }
  for (let i = n - 1; i >= 0; i--) if (mask[i] === 1) { last = i; break; }
  if (first === -1 || last === -1 || last <= first) return NaN;

  const firstVal = equity[first];
  const lastVal = equity[last];
  if (!(firstVal === firstVal) || !(lastVal === lastVal) || firstVal <= 0) return NaN;

  const periods = last - first; // number of periods between first and last
  const years = periods / freq;
  if (years <= 0) return NaN;

  const cagr = Math.pow(lastVal / firstVal, 1 / years) - 1;
  const mdd = maxdd(equity);
  if (!(mdd === mdd) || mdd === 0) return NaN;
  return cagr / mdd;
}

// Calmar ratio: annualized return (CAGR) over lookbackPeriodYears divided by max drawdown magnitude
// If lookbackPeriodYears is null/undefined, uses the entire series span. freq is periods per year.
/**
 * Calmar ratio: CAGR over a lookback period divided by the max drawdown magnitude over the same period.
 * If `lookbackPeriodYears` is null uses the entire series. Returns NaN on invalid inputs or zero drawdown.
 * @param equity Array-like equity or price series
 * @param lookbackPeriodYears Lookback window in years (null = full span)
 * @param freq Periods per year (default 252)
 * @returns Calmar ratio or NaN
 */
export function calmarRatio(equity: ArrayLike<number>, lookbackPeriodYears: number | null = 3, freq: number = 252): number {
  const n = equity.length;
  if (n === 0) return NaN;
  const mask = arr.notna(equity);
  // find first and last valid
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) if (mask[i] === 1) { first = i; break; }
  for (let i = n - 1; i >= 0; i--) if (mask[i] === 1) { last = i; break; }
  if (first === -1 || last === -1 || last <= first) return NaN;

  // determine start index for lookback
  let startIdx = first;
  if (lookbackPeriodYears && lookbackPeriodYears > 0) {
    const windowPeriods = Math.floor(lookbackPeriodYears * freq);
    if (windowPeriods < (last - first)) {
      const candidate = last - windowPeriods;
      // find first valid >= candidate
      for (let i = candidate; i <= last; i++) if (mask[i] === 1) { startIdx = i; break; }
    } else {
      startIdx = first; // not enough history, use full
    }
  }

  const startVal = equity[startIdx];
  const endVal = equity[last];
  if (!(startVal === startVal) || !(endVal === endVal) || startVal <= 0) return NaN;

  const periods = last - startIdx;
  const years = periods / freq;
  if (years <= 0) return NaN;
  const cagr = Math.pow(endVal / startVal, 1 / years) - 1;

  // compute max drawdown over the same window by slicing (avoid allocation by computing via maxdd on subarray)
  // create a view of equity for the window
  const slice = new Float64Array(last - startIdx + 1);
  let idx = 0;
  for (let i = startIdx; i <= last; i++) slice[idx++] = equity[i];
  const mdd = maxdd(slice);
  if (!(mdd === mdd) || mdd === 0) return NaN;
  return cagr / mdd;
}

// Ulcer Index: measures depth and duration of drawdowns over a period.
// UI = sqrt( (1/N) * sum_i depth_i^2 ) where depth_i = (peak_i - value_i) / peak_i (>= 0) and N is count of valid points.
/**
 * Ulcer Index: measures depth and duration of drawdowns (root-mean-square of depths).
 * Returns NaN for empty input.
 * @param equity Array-like equity or price series
 * @returns Ulcer Index (>=0) or NaN
 */
export function ulcerIndex(equity: ArrayLike<number>): number {
  const n = equity.length;
  if (n === 0) return NaN;
  const mask = arr.notna(equity);
  // find first valid
  let first = -1;
  for (let i = 0; i < n; i++) if (mask[i] === 1) { first = i; break; }
  if (first === -1) return NaN;

  let peak = equity[first];
  let sumsq = 0;
  let count = 0;
  for (let i = first; i < n; i++) {
    if (mask[i] !== 1) continue;
    const v = equity[i];
    if (v > peak) {
      peak = v;
    }
    const depth = (peak - v) / peak; // >= 0
    sumsq += depth * depth;
    count++;
  }
  if (count === 0) return NaN;
  return Math.sqrt(sumsq / count);
}

// Rolling Ulcer Index over trailing window (window in periods).
// For each i, compute ulcer index over [i-window+1 .. i] using local-window peaks.
// If the window contains fewer than minPeriod valid points, out[i] = NaN.
/**
 * Rolling Ulcer Index computed over a trailing window.
 * Returns NaN for windows with insufficient valid samples (< minPeriod) or invalid window.
 * @param equity Array-like equity or price series
 * @param window Rolling window length (positive integer)
 * @param minPeriod Minimum number of valid points required in window
 * @returns Float64Array of rolling ulcer index values
 */
export function rollUlcerIndex(equity: ArrayLike<number>, window: number, minPeriod: number = 1): Float64Array {
  if (window <= 0) throw new Error('window must be positive');
  const n = equity.length;
  const out = new Float64Array(n);
  if (n === 0) return out;

  const mask = arr.notna(equity);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - window + 1);
    // find first valid in window
    let first = -1;
    for (let j = start; j <= i; j++) if (mask[j] === 1) { first = j; break; }
    if (first === -1) { out[i] = NaN; continue; }

    let peak = equity[first];
    let sumsq = 0;
    let count = 0;
    for (let j = first; j <= i; j++) {
      if (mask[j] !== 1) continue;
      const v = equity[j];
      if (v > peak) {
        peak = v;
      }
      const depth = (peak - v) / peak;
      sumsq += depth * depth;
      count++;
    }
    if (count < minPeriod || count === 0) { out[i] = NaN; continue; }
    out[i] = Math.sqrt(sumsq / count);
  }
  return out;
}
