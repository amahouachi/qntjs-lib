import { wma } from "./wma.js";

/**
 * Hull Moving Average (HMA).
 * Computes a lower-lag smoothing by combining WMAs at different lengths
 * and then applying a final WMA on the derived series. Pine-compatible
 * and NaN-aware: NaNs propagate where insufficient valid samples exist.
 * @param source Input series
 * @param period Window length (must be > 0)
 * @returns Float64Array of HMA values (NaN where undefined)
 */
export function hma(source: ArrayLike<number>, period: number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) return out.fill(NaN);

  const half = Math.floor(period / 2);
  const sqrtP = Math.floor(Math.sqrt(period));

  const raw = new Float64Array(n);
  for (let i = 0; i < period - 1; i++) raw[i] = NaN;

  const wmaHalf = wma(source, half);
  const wmaFull = wma(source, period);

  for (let i = period - 1; i < n; i++) {
    raw[i] = 2 * wmaHalf[i] - wmaFull[i];
  }

  return wma(raw, sqrtP, false);
}
