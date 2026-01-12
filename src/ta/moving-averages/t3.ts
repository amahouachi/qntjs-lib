/**
 * Triple Exponential Moving Average (T3)
 * 
 * T3 is a triple-smoothed moving average developed by Tim Tillson that reduces lag
 * and smoothing compared to traditional EMAs while maintaining responsiveness to price changes.
 * 
 * @param source - Input data array
 * @param period - Smoothing period (default: 5)
 * @param volumeFactor - Volume factor for smoothing (default: 0.7)
 * @returns T3 values
 */
/**
 * Triple Exponential Moving Average (T3)
 *
 * Implemented following TA‑Lib's algorithm (see TA_T3 C implementation).
 * This inlines the nested EMA seeding (e1..e6) and performs a single-pass
 * update, which is significantly faster than calling `ema()` six times.
 *
 * Notes:
 * - Lookback = 6 * (period - 1)
 * - For inputs containing NaNs we propagate NaN outputs where we cannot
 *   compute valid seeds or updates.
 */

export function t3(source: ArrayLike<number>, period: number, volumeFactor: number): Float64Array{

  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  out.fill(NaN);
  if (n < period) return out; // need at least `period` samples

  const lookback = 6 * (period - 1);
  if (n <= lookback) return out; // not enough samples to produce any output

  const k = 2 / (period + 1);
  const one_minus_k = 1 - k;

  let idx = 0; // index into the source array

  // NaN-aware seeding: for each nested EMA we collect `period` valid
  // samples (skipping NaNs) and compute the initial averaged seed as in
  // the original TA-Lib implementation. If any stage cannot gather
  // `period` valid samples we return the NaN-filled output.

  // e1: average of first `period` valid source values
  let seedSum = 0;
  let valid = 0;
  while (idx < n && valid < period) {
    const v = source[idx++];
    if (v !== v) continue;
    seedSum += v;
    valid++;
  }
  if (valid < period) return out;
  let e1 = seedSum / period;

  // e2..e6: for each level, run updates only when encountering valid
  // source values and accumulate `period` updated EMA values to compute
  // the averaged seed for that level.
  // e2
  seedSum = e1;
  valid = 1;
  while (idx < n && valid < period) {
    const v = source[idx++];
    if (v !== v) continue;
    e1 = k * v + one_minus_k * e1;
    seedSum += e1;
    valid++;
  }
  if (valid < period) return out;
  let e2 = seedSum / period;

  // e3
  seedSum = e2;
  valid = 1;
  while (idx < n && valid < period) {
    const v = source[idx++];
    if (v !== v) continue;
    e1 = k * v + one_minus_k * e1;
    e2 = k * e1 + one_minus_k * e2;
    seedSum += e2;
    valid++;
  }
  if (valid < period) return out;
  let e3 = seedSum / period;

  // e4
  seedSum = e3;
  valid = 1;
  while (idx < n && valid < period) {
    const v = source[idx++];
    if (v !== v) continue;
    e1 = k * v + one_minus_k * e1;
    e2 = k * e1 + one_minus_k * e2;
    e3 = k * e2 + one_minus_k * e3;
    seedSum += e3;
    valid++;
  }
  if (valid < period) return out;
  let e4 = seedSum / period;

  // e5
  seedSum = e4;
  valid = 1;
  while (idx < n && valid < period) {
    const v = source[idx++];
    if (v !== v) continue;
    e1 = k * v + one_minus_k * e1;
    e2 = k * e1 + one_minus_k * e2;
    e3 = k * e2 + one_minus_k * e3;
    e4 = k * e3 + one_minus_k * e4;
    seedSum += e4;
    valid++;
  }
  if (valid < period) return out;
  let e5 = seedSum / period;

  // e6
  seedSum = e5;
  valid = 1;
  while (idx < n && valid < period) {
    const v = source[idx++];
    if (v !== v) continue;
    e1 = k * v + one_minus_k * e1;
    e2 = k * e1 + one_minus_k * e2;
    e3 = k * e2 + one_minus_k * e3;
    e4 = k * e3 + one_minus_k * e4;
    e5 = k * e4 + one_minus_k * e5;
    seedSum += e5;
    valid++;
  }
  if (valid < period) return out;
  let e6 = seedSum / period;

  // Skip the unstable/warmup period. The seeding logic advances `idx` past
  // the warmup, so the explicit warmup loop was unreachable and has been
  // removed to avoid dead code while preserving behavior by setting the
  // next processing index.
  const startIdx = lookback; // first index with output
  idx = startIdx + 1;

  // Compute coefficients (TA-Lib formulation)
  const tmp = volumeFactor * volumeFactor;
  const c1 = -(tmp * volumeFactor);
  const c2 = 3 * (tmp - c1);
  const c3 = -6 * tmp - 3 * (volumeFactor - c1);
  const c4 = 1 + 3 * volumeFactor - c1 + 3 * tmp;

  // Write first output at startIdx
  let outIndex = startIdx;
  out[outIndex++] = c1 * e6 + c2 * e5 + c3 * e4 + c4 * e3;

  // Main loop: process remaining samples. NaN inputs naturally propagate through
  // the recurrence (k * NaN + ... => NaN), so an explicit NaN branch is redundant.
  for (let j = idx; j < n; j++) {
    const v = source[j];
    e1 = k * v + one_minus_k * e1;
    e2 = k * e1 + one_minus_k * e2;
    e3 = k * e2 + one_minus_k * e3;
    e4 = k * e3 + one_minus_k * e4;
    e5 = k * e4 + one_minus_k * e5;
    e6 = k * e5 + one_minus_k * e6;
    out[outIndex++] = c1 * e6 + c2 * e5 + c3 * e4 + c4 * e3;
  }

  return out;
}
