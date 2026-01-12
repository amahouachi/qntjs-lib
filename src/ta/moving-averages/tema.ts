/**
 * Triple Exponential Moving Average (TEMA).
 * Combines three nested EMAs to reduce lag while smoothing:
 * TEMA = 3*EMA1 - 3*EMA2 + EMA3. Preserves NaN gaps and seeds
 * each EMA before emitting values.
 * @param source Input series
 * @param period Smoothing period (must be > 0)
 * @returns Float64Array of TEMA values (NaN where undefined)
 */
export function tema(source: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) return out.fill(NaN);

  const mult = 2 / (period + 1);

  // Find first non-NaN value
  let idx = 0;
  while (idx < n && !(source[idx] === source[idx])) idx++;
  if (idx === n) return out.fill(NaN); // all NaNs

  // Seed EMA1
  let prevEma1 = source[idx] as number;
  let valid1 = 1;
  idx++;

  // Warm up EMA1 until we have 'period' samples
  while (idx < n && valid1 < period) {
    const v = source[idx];
    idx++;
    if (!(v === v)) continue;
    prevEma1 = prevEma1 + mult * (v - prevEma1);
    valid1++;
  }
  if (valid1 < period) return out.fill(NaN);

  // Seed EMA2 from EMA1 and warm until it has 'period' EMA1 values
  let prevEma2 = prevEma1;
  let valid2 = 1;
  while (idx < n && valid2 < period) {
    const v = source[idx];
    idx++;
    if (!(v === v)) continue;
    prevEma1 = prevEma1 + mult * (v - prevEma1);
    valid1++;
    prevEma2 = prevEma2 + mult * (prevEma1 - prevEma2);
    valid2++;
  }
  if (valid2 < period) return out.fill(NaN);

  // Seed EMA3 from EMA2 and warm until it has 'period' EMA2 values
  let prevEma3 = prevEma2;
  let valid3 = 1;
  while (idx < n && valid3 < period) {
    const v = source[idx];
    idx++;
    if (!(v === v)) continue;
    prevEma1 = prevEma1 + mult * (v - prevEma1);
    prevEma2 = prevEma2 + mult * (prevEma1 - prevEma2);
    prevEma3 = prevEma3 + mult * (prevEma2 - prevEma3);
    valid3++;
  }
  if (valid3 < period) return out.fill(NaN);

  // At this point prevEma1/2/3 correspond to the last processed valid sample at index (idx-1)
  const lastFilledIndex = idx - 1;
  out[lastFilledIndex] = 3 * prevEma1 - 3 * prevEma2 + prevEma3;

  // Fill prefix with NaN up to (but not including) lastFilledIndex to preserve computed value
  if (lastFilledIndex > 0) out.fill(NaN, 0, lastFilledIndex);

  // Hot loop: update for subsequent values; write NaN when encountering NaN inputs
  for (let j = idx; j < n; j++) {
    const v = source[j];
    if (!(v === v)) { out[j] = NaN; continue; }
    prevEma1 = prevEma1 + mult * (v - prevEma1);
    prevEma2 = prevEma2 + mult * (prevEma1 - prevEma2);
    prevEma3 = prevEma3 + mult * (prevEma2 - prevEma3);
    out[j] = 3 * prevEma1 - 3 * prevEma2 + prevEma3;
  }

  return out;
}
