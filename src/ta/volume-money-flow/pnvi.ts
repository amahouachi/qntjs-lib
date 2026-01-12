/**
 * Positive/Negative Volume Index (PNVI).
 * Returns `[pvi, nvi]` series tracking separate indices when volume increases
 * (PVI) or decreases (NVI). Preserves NaNs and treats zero close as missing.
 * @param close Close price series
 * @param volume Volume series
 * @param start Initial index value (default: 1000)
 * @returns Tuple `[pvi, nvi]` as Float64Array
 */
export function pnvi(close: ArrayLike<number>, volume: ArrayLike<number>, start = 1000): [Float64Array, Float64Array] {
  const n = close.length;
  if (volume.length !== n) throw new Error('close and volume must have equal length');

  const pvi = new Float64Array(n);
  const nvi = new Float64Array(n);
  // if no data, return empty arrays
  if (n === 0) return [pvi, nvi];
  // Initialize with NaN so skipped indices remain NaN
  pvi.fill(NaN);
  nvi.fill(NaN);

  // Find first valid index: both close and volume numeric and close !== 0
  let firstValid = -1;
  for (let i = 0; i < n; i++) {
    const c = close[i];
    const v = volume[i];
    if (c === c && v === v && c !== 0) { firstValid = i; break; }
  }
  if (firstValid === -1) return [pvi, nvi];

  let prevP = start;
  let prevN = start;
  pvi[firstValid] = prevP;
  nvi[firstValid] = prevN;

  let prevClose = close[firstValid];
  let prevVolume = volume[firstValid];

  for (let i = firstValid + 1; i < n; i++) {
    const c = close[i];
    const v = volume[i];

    // skip if current invalid or close is zero (treated as missing)
    if (!(c === c && v === v && c !== 0)) {
      // leave outP[i], outN[i] as NaN
      continue;
    }

    // compute price change ratio based on previous valid close
    // prevClose is guaranteed non-zero
    const change = (c - prevClose) / prevClose;

    if (v > prevVolume) {
      prevP = prevP + change * prevP;
    }
    if (v < prevVolume) {
      prevN = prevN + change * prevN;
    }

    pvi[i] = prevP;
    nvi[i] = prevN;

    // update previous valid values
    prevClose = c;
    prevVolume = v;
  }

  return [pvi, nvi];
}
