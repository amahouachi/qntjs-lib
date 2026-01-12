import { shouldSkipDenseOptimization } from "../util.js";
import { havena } from "../../arr/arr.js";

function rmaDense(source: ArrayLike<number>, period: number, n: number, out: Float64Array): Float64Array {
  const k = 1 / period;
  // mark warmup indices as NaN
  for (let i = 0; i < period; i++) out[i] = NaN;

  if (period === 1) {
    for (let i = 0; i < n; i++) out[i] = source[i];
    return out;
  }

  // seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) sum += source[i];
  let rma = sum / period;
  out[period - 1] = rma;

  // main loop: Wilder/RMA recurrence
  for (let i = period; i < n; i++) {
    const v = source[i];
    // rma = rma + k * (v - rma)  // equivalent
    rma = (rma * (period - 1) + v) / period;
    out[i] = rma;
  }
  return out;
}

function rmaNanAware(source: ArrayLike<number>, period: number, n: number, out: Float64Array): Float64Array {
  out.fill(NaN);
  const k = 1 / period;

  let seedSum = 0;
  let validCount = 0;
  let rma: number | undefined = undefined;
  let seeded = false;

  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v !== v) continue; // skip NaN

    if (!seeded) {
      seedSum += v;
      validCount++;
      if (validCount === period) {
        rma = seedSum / period;
        out[i] = rma as number;
        seeded = true;
      }
      continue;
    }

    // seeded
    rma = (rma as number * (period - 1) + v) / period;
    out[i] = rma as number;
  }

  return out;
}

/**
 * Wilder's Moving Average / RMA.
 * Implements the Wilder smoothing recurrence (rma = (rma*(period-1) + x)/period).
 * When `skipna` is true NaNs are ignored during seeding and updates; otherwise
 * a dense fast-path is used for NaN-free inputs.
 * @param source Input series
 * @param period Smoothing period (must be > 0)
 * @param skipna Whether to ignore NaNs during computation (default: true)
 * @returns Float64Array of RMA values (NaN before window fills)
 */
export function rma(source: ArrayLike<number>, period: number, skipna = true): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  const out = new Float64Array(n);
  if (n < period) {
    out.fill(NaN);
    return out;
  }

  if (skipna && !shouldSkipDenseOptimization() && !havena(source)) {
    skipna = false;
  }

  if (!skipna) return rmaDense(source, period, n, out);
  return rmaNanAware(source, period, n, out);
}

