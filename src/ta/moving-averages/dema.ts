/**
 * Double Exponential Moving Average (DEMA).
 * DEMA reduces lag by combining a single EMA and a double-smoothed EMA:
 * DEMA = 2 * EMA(source, period) - EMA(EMA(source, period), period).
 * Preserves NaN gaps and follows the same seeding semantics as `ema`.
 * @param source Input series
 * @param period Smoothing period (must be > 0)
 * @returns Float64Array of DEMA values (NaN where undefined)
 */
export function dema(source: ArrayLike<number>, period: number): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) return out.fill(NaN);

  const k = 2 / (period + 1);

  // Find first non-NaN value
  let idx = 0;
  while (idx < n && !(source[idx] === source[idx])) idx++;
  if (idx === n) return out.fill(NaN); // all NaNs

  // Seed EMA1 with first valid value
  let prevEma1 = source[idx] as number;
  let valid1 = 1;
  idx++;

  // Warm up EMA1 until we have 'period' samples
  while (idx < n && valid1 < period) {
    const v = source[idx];
    idx++;
    if (!(v === v)) continue;
    prevEma1 = prevEma1 + k * (v - prevEma1);
    valid1++;
  }

  // If EMA1 never reached the required count, we can't produce outputs
  if (valid1 < period) return out.fill(NaN);

  // Initialize EMA2 seeded from current EMA1
  let prevEma2 = prevEma1;
  let valid2 = 1;

  // Warm up EMA2 until we have 'period' EMA1 values
  while (idx < n && valid2 < period) {
    const v = source[idx];
    idx++;
    if (!(v === v)) continue;
    // update EMA1 with this new source value
    prevEma1 = prevEma1 + k * (v - prevEma1);
    valid1++;
    // update EMA2 with the new EMA1
    prevEma2 = prevEma2 + k * (prevEma1 - prevEma2);
    valid2++;
  }

  // If EMA2 never reached the required count, we can't produce outputs
  if (valid2 < period) return out.fill(NaN);

  // At this point prevEma1 and prevEma2 correspond to the last processed valid sample at index (idx-1)
  const lastFilledIndex = idx - 1;
  out[lastFilledIndex] = 2 * prevEma1 - prevEma2;

  // Hot loop: from idx .. n-1, buffer is ready; skip NaNs but otherwise just update and write
  out.fill(NaN, 0, lastFilledIndex);
  for (let j = idx; j < n; j++) {
    const v = source[j];
    if (!(v === v)) {out[j]= NaN; continue;}
    prevEma1 = prevEma1 + k * (v - prevEma1);
    prevEma2 = prevEma2 + k * (prevEma1 - prevEma2);
    out[j] = 2 * prevEma1 - prevEma2;
  }

  return out;
}
