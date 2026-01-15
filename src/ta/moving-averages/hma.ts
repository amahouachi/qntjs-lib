import { wma } from "./wma.js";
import { havena } from "../../arr/arr.js";

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

  // Select skipna mode: dense=false (stricter), gapped=true (NaN-aware)
  const skipna = havena(source);

  // Compute WMAs and intermediate 'raw' series
  const wmaHalf = wma(source, half, skipna);
  const wmaFull = wma(source, period, skipna);

  for (let i = period - 1; i < n; i++) {
    raw[i] = 2 * wmaHalf[i] - wmaFull[i];
  }

  // Find first finite value in raw (where warmup ends)
  let firstFinite = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(raw[i])) {
      firstFinite = i;
      break;
    }
  }
  if (firstFinite === -1) return raw;

  // Extract suffix from first finite value and apply final WMA
  // This ensures correct index alignment for the final smoothing
  const suffix = raw.slice(firstFinite);
  const wmaSuffix = wma(suffix, sqrtP, skipna);

  // Map results back to original full-length array
  const result = new Float64Array(n);
  result.fill(NaN);
  for (let i = 0; i < wmaSuffix.length; i++) {
    result[firstFinite + i] = wmaSuffix[i];
  }
  return result;
}
