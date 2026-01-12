import { mean } from './mean.js';

/**
 * Fisher-Pearson sample skewness (ignores NaNs). Returns NaN when insufficient data.
 * @param source Input array
 * @returns Skewness or NaN
 */
export function skew(source: ArrayLike<number>): number {
  const n = source.length;
  const m = mean(source);
  if (m !== m) return NaN;
  let s2 = 0;
  let s3 = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v === v) {
      const d = v - m;
      s2 += d * d;
      s3 += d * d * d;
      cnt++;
    }
  }
  if (cnt < 3) return NaN;
  const sd = Math.sqrt(s2 / cnt);
  if (sd === 0) return 0;
  return (s3 / cnt) / (sd * sd * sd);
}

/**
 * Excess kurtosis (kurtosis - 3) for `source` (ignores NaNs). Returns NaN when insufficient data.
 * @param source Input array
 * @returns Excess kurtosis or NaN
 */
export function kurtosis(source: ArrayLike<number>): number {
  const n = source.length;
  const m = mean(source);
  if (m !== m) return NaN;
  let s2 = 0;
  let s4 = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v === v) {
      const d = v - m;
      const d2 = d * d;
      s2 += d2;
      s4 += d2 * d2;
      cnt++;
    }
  }
  if (cnt < 4) return NaN;
  const varr = s2 / cnt;
  if (varr === 0) return 0;
  return (s4 / cnt) / (varr * varr) - 3;
}

/**
 * Rolling skewness over a sliding window of length `period`.
 * @param source Input array
 * @param period Window length
 * @returns Float64Array of rolling skewness values
 */
export function rollskew(source: ArrayLike<number>, period: number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;

  let s1 = 0, s2 = 0, s3 = 0, count = 0;

  for (let i = 0; i < period; i++) {
    const v = source[i];
    if (v === v) {
      count++;
      s1 += v;
      s2 += v*v;
      s3 += v*v*v;
    }
  }

  if (count >= 3) {
    const m1 = s1 / count;
    const variance = (s2 / count) - (m1 * m1);
    if (variance > 1e-12) {
      const std = Math.sqrt(variance);
      out[period-1] = ( (s3 / count) - 3 * m1 * variance - m1 * m1 * m1) / (std * std * std);
    } else {
      out[period-1] = 0;
    }
  }

  for (let i = period; i < n; i++) {
    const oldV = source[i - period];
    if (oldV === oldV) {
      count--;
      s1 -= oldV;
      s2 -= oldV*oldV;
      s3 -= oldV*oldV*oldV;
    }
    const newV = source[i];
    if (newV === newV) {
      count++;
      s1 += newV;
      s2 += newV*newV;
      s3 += newV*newV*newV;
    }

    if (count >= 3) {
      const m1 = s1 / count;
      const variance = (s2 / count) - (m1 * m1);
      if (variance > 1e-12) {
        const std = Math.sqrt(variance);
        out[i] = ( (s3 / count) - 3 * m1 * variance - m1 * m1 * m1) / (std * std * std);
      } else {
        out[i] = 0;
      }
    }
  }
  return out;
}

/**
 * Rolling excess kurtosis over a sliding window of length `period`.
 * @param source Input array
 * @param period Window length
 * @returns Float64Array of rolling kurtosis values
 */
export function rollkurtosis(source: ArrayLike<number>, period: number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;

  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, count = 0;

  for (let i = 0; i < period; i++) {
    const v = source[i];
    if (v === v) {
      count++;
      s1 += v;
      const v2 = v*v;
      s2 += v2;
      s3 += v2*v;
      s4 += v2*v2;
    }
  }

  if (count >= 4) {
    const m1 = s1 / count;
    const variance = (s2 / count) - (m1 * m1);
    if (variance > 1e-12) {
      const m2 = s2 / count;
      const m3 = s3 / count;
      const m4 = s4 / count;
      out[period-1] = (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (variance * variance) - 3;
    } else {
      out[period-1] = 0;
    }
  }

  for (let i = period; i < n; i++) {
    const oldV = source[i - period];
    if (oldV === oldV) {
      count--;
      s1 -= oldV;
      const oldV2 = oldV*oldV;
      s2 -= oldV2;
      s3 -= oldV2*oldV;
      s4 -= oldV2*oldV2;
    }
    const newV = source[i];
    if (newV === newV) {
      count++;
      s1 += newV;
      const newV2 = newV*newV;
      s2 += newV2;
      s3 += newV2*newV;
      s4 += newV2*newV2;
    }

    if (count >= 4) {
      const m1 = s1 / count;
      const variance = (s2 / count) - (m1 * m1);
      if (variance > 1e-12) {
        const m2 = s2 / count;
        const m3 = s3 / count;
        const m4 = s4 / count;
        out[i] = (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (variance * variance) - 3;
      } else {
        out[i] = 0;
      }
    }
  }
  return out;
}


