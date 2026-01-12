/**
 * Absolute Price Oscillator (APO).
 * Computes the difference between a short and a long EMA of `src`.
 * Skips NaNs and seeds EMAs on the first valid value; returns NaN
 * for indices before both EMAs have filled.
 * @param src Input series
 * @param shortPeriod Short EMA period
 * @param longPeriod Long EMA period
 * @returns Float64Array of APO values (NaN where undefined)
 */
export function apo(src: ArrayLike<number>, shortPeriod: number, longPeriod: number): Float64Array {
  if (shortPeriod <= 0 || longPeriod <= 0) throw new Error('Periods must be positive');
  if (shortPeriod >= longPeriod) throw new Error('shortPeriod should be less than longPeriod');
  const n = src.length;
  const out = new Float64Array(n);
  out.fill(NaN);
  if (n < longPeriod) return out;

  const kShort = 2 / (shortPeriod + 1);
  const kLong = 2 / (longPeriod + 1);

  let emaS = NaN;
  let emaL = NaN;
  let validS = 0;
  let validL = 0;

  for (let i = 0; i < n; i++) {
    const v = src[i];
    if (v !== v) {
      // skip NaN
      continue;
    }
    if (validS === 0) {
      // seed on first valid
      emaS = v;
      emaL = v;
      validS = 1;
      validL = 1;
      continue;
    }
    // update EMAs
    emaS = emaS + kShort * (v - emaS);
    emaL = emaL + kLong * (v - emaL);
    validS++;
    validL++;
    if (validL >= longPeriod && validS >= shortPeriod) {
      out[i] = emaS - emaL;
    }
  }
  return out;
} 
