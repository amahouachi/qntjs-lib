/**
 * Percentage Price Oscillator (PPO).
 * PPO = 100 * (EMA_short - EMA_long) / EMA_long.
 * Skips NaNs and seeds EMAs on first valid value; outputs are NaN until the
 * long EMA has enough data. When EMA_long is zero, returns 0 to avoid division.
 * @param src Input series
 * @param shortPeriod Short EMA period
 * @param longPeriod Long EMA period
 * @returns Float64Array of PPO values (NaN where undefined)
 */
export function ppo(src: ArrayLike<number>, shortPeriod: number, longPeriod: number): Float64Array {
  if (shortPeriod <= 0 || longPeriod <= 0) throw new Error('Periods must be positive');
  if (shortPeriod >= longPeriod) throw new Error('shortPeriod should be less than longPeriod');
  const n = src.length;

  const out = new Float64Array(n);
  // default all to NaN so that insufficient data or all-NaN source leads to all-NaN output
  for (let j = 0; j < n; j++) out[j] = NaN;
  if (n === 0) return out;

  const kShort = 2 / (shortPeriod + 1);
  const kLong = 2 / (longPeriod + 1);

  // find first valid sample
  let i = 0;
  while (i < n && !(src[i] === src[i])) i++;
  if (i === n) return out; // all NaNs -> all NaNs

  let emaS = src[i] as number;
  let emaL = src[i] as number;
  let validCount = 1;

  // process remaining indices
  for (i = i + 1; i < n; i++) {
    const v = src[i];
    if (!(v === v)) { continue; }
    emaS = emaS + kShort * (v - emaS);
    emaL = emaL + kLong * (v - emaL);
    validCount++;
    if (validCount >= longPeriod) {
      if (emaL === 0) out[i] = 0;
      else out[i] = 100 * (emaS - emaL) / emaL;
    }
  }

  return out;
}
