import { sma } from '../moving-averages/index.js';

/**
 * Detrended Price Oscillator (DPO).
 * Computes DPO[i] = source[i - shift] - SMA(source, period)[i], where
 * shift = floor(period/2) + 1. Outputs are NaN for indices before the
 * shift or when insufficient data exists.
 * @param source Input series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of DPO values (NaN where undefined)
 */
export function dpo(source: ArrayLike<number>, period: number): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) return out.fill(NaN);

  const smaBuf = sma(source, period, true); // Float64Array
  const shift = Math.floor(period / 2) + 1;

  // explicitly mark outputs before `shift` as NaN
  for (let i = 0; i < shift && i < n; i++) {
    out[i] = NaN;
  }

  // start at `shift` so `srcIdx = i - shift` is always >= 0
  for (let i = shift; i < n; i++) {
    out[i] = source[i - shift] - smaBuf[i];
  }
  return out;
}

