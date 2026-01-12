/**
 * On-Balance Volume (OBV).
 * Accumulates volume by sign of price change: add volume when price rises,
 * subtract when price falls; NaNs in inputs yield NaN outputs for that index.
 * @param price Price series
 * @param volume Volume series
 * @returns Float64Array of OBV values
 */
export function obv(price: ArrayLike<number>, volume: ArrayLike<number>): Float64Array {
  const n = price.length;
  if (volume.length !== n) throw new Error('price and volume must have same length');
  const out = new Float64Array(n);
  if (n === 0) return out;

  let obvVal = 0;
  out[0] = obvVal;
  for (let i = 1; i < n; i++) {
    const p = price[i];
    const prev = price[i - 1];
    const v = volume[i];

    if (p !== p || prev !== prev || v !== v) {
      out[i] = NaN;
      continue;
    }

    if (p > prev) obvVal += v;
    else if (p < prev) obvVal -= v;
    out[i] = obvVal;
  }
  return out;
}
