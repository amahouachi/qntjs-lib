import { shouldSkipDenseOptimization } from "../util.js";
import { havena } from "../../arr/arr.js";

/**
 * Volume Weighted Moving Average (VWMA).
 * Computes pvSum / vSum over a sliding window, NaN-aware. When `skipna` is
 * true NaNs in either series are ignored within the window; when false a
 * dense fast-path is used (assumes no NaNs).
 * @param price Price series
 * @param volume Volume series
 * @param period Window length (>0)
 * @param skipna Whether to ignore NaNs inside windows (default: true)
 * @returns Float64Array of VWMA values (NaN before window fills)
 */
export function vwma(price: ArrayLike<number>, volume: ArrayLike<number>, period: number, skipna= true): Float64Array {
  const n = price.length;
  if (volume.length !== n) throw new Error('price and volume must have equal length');

  if (period <= 0) throw new Error('Period must be positive');
  const out = new Float64Array(n);
  if (n < period) return out.fill(NaN);
  for (let i = 0; i < period; i++) out[i] = NaN;

  if (skipna && !shouldSkipDenseOptimization() && !havena(price, volume)) {
    skipna = false;
  }

  if (!skipna) {
    return vwmaDense(price, volume, period, out);
  }
  return vwmaNanAware(price, volume, period, out);

}

function vwmaNanAware(price: ArrayLike<number>, volume: ArrayLike<number>, period: number, result: Float64Array): Float64Array {
  // Optimized NaN-aware path: O(n) rolling sums using circular buffers
  const n = price.length;
  const p = period;
  if (n < p) return result.fill(NaN);

  const bufPV = new Float64Array(p);
  const bufV = new Float64Array(p);
  for (let i = 0; i < p; i++) { bufPV[i] = NaN; bufV[i] = NaN; }

  let pvSum = 0;
  let vSum = 0;
  let validCount = 0;

  // Initialize first window [0..p-1]
  for (let j = 0; j < p; j++) {
    const pj = price[j];
    const vj = volume[j];
    if (pj === pj && vj === vj) {
      const pv = pj * vj;
      bufPV[j] = pv;
      bufV[j] = vj;
      pvSum += pv;
      vSum += vj;
      validCount++;
    } else {
      bufPV[j] = NaN;
      bufV[j] = NaN;
    }
  }

  result[p - 1] = vSum !== 0 ? pvSum / vSum : NaN;

  // Slide window
  let idx = 0; // points to oldest element
  for (let i = p; i < n; i++) {
    const pNew = price[i];
    const vNew = volume[i];

    const oldPV = bufPV[idx];
    const oldV = bufV[idx];

    if (oldV === oldV) { // old was valid
      pvSum -= oldPV;
      vSum -= oldV;
      validCount--;
    }

    if (pNew === pNew && vNew === vNew) {
      const newPV = pNew * vNew;
      bufPV[idx] = newPV;
      bufV[idx] = vNew;
      pvSum += newPV;
      vSum += vNew;
      validCount++;
    } else {
      bufPV[idx] = NaN;
      bufV[idx] = NaN;
    }

    idx++;
    if (idx === p) idx = 0;

    result[i] = vSum !== 0 ? pvSum / vSum : NaN;
  }

  return result;
}

/**
 * Fast VWMA for dense data (no NaNs).
 * O(n) sliding window: classic pvSum / vSum.
 */
export function vwmaDense(price: ArrayLike<number>, volume: ArrayLike<number>, period: number, result: Float64Array): Float64Array {
  const n = price.length;

  let pvSum = 0;
  let vSum = 0;

  // Initialize first full window [0 .. period-1]
  for (let i = 0; i < period; i++) {
    const p = price[i];
    const v = volume[i];
    pvSum += p * v;
    vSum += v;
  }

  result[period - 1] = vSum !== 0 ? pvSum / vSum : NaN;

  // Slide the window across the series
  for (let i = period; i < n; i++) {
    const pNew = price[i];
    const vNew = volume[i];
    const pOld = price[i - period];
    const vOld = volume[i - period];

    pvSum += pNew * vNew - pOld * vOld;
    vSum += vNew - vOld;

    result[i] = vSum !== 0 ? pvSum / vSum : NaN;
  }

  return result;
}