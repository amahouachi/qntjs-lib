/**
 * Exponential Moving Average (EMA).
 * Seeds on the first non-NaN value and uses the standard EMA recurrence.
 * Preserves NaN gaps in the input: outputs are NaN until enough valid samples
 * have been seen to initialize the EMA.
 * @param source Input series
 * @param period Smoothing period (must be > 0)
 * @returns Float64Array of EMA values (NaN where undefined)
 */
export function ema(source: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) return out.fill(NaN);

  const mult = 2 / (period + 1);

  // Find first non-NaN value
  let idx = 0;
  while (idx < n && source[idx] !== source[idx]) idx++;
  if (idx === n) return out.fill(NaN); // all NaNs

  // Special-case period === 1: EMA is identity (but preserve NaNs)
  if (period === 1) {
    for (let j = 0; j < n; j++) {
      out[j] = source[j];
    }
    return out;
  }

  // Seed EMA with first valid value
  let emaVal = source[idx];
  let validCount = 1;
  idx++;

  // Warm up until we have 'period' valid samples
  while (idx < n && validCount < period) {
    const v = source[idx];
    idx++;
    if (v !== v) continue;
    emaVal = emaVal + mult * (v - emaVal);
    validCount++;
  }

  if (validCount < period) return out.fill(NaN);

  // At this point ema corresponds to the value at index (idx-1)
  const lastFilledIndex = idx - 1;
  out[lastFilledIndex] = emaVal;

  // Fill prefix with NaN up to (but not including) lastFilledIndex
  out.fill(NaN, 0, lastFilledIndex);

  // Hot loop: advance from idx .. n-1, write NaN when encountering NaN inputs
  for (let j = idx; j < n; j++) {
    const v = source[j];
    if (v !== v) { out[j] = NaN; continue; }
    emaVal = emaVal + mult * (v - emaVal);
    out[j] = emaVal;
  }

  return out;
}

