import { sma } from "./sma.js";
import { havena } from "../../arr/arr.js";

/**
 * Triangular Moving Average (TRIMA).
 * A triangular-weighted moving average implemented via two `sma` passes.
 * Preserves NaN handling by delegating to `sma` implementations.
 * @param source Input series
 * @param period Window length (must be > 0)
 * @returns Float64Array of TRIMA values (NaN where undefined)
 */
export function trima(source: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = source.length;
  if (n < period) {
    return new Float64Array(n).fill(NaN);
  }

  const out = new Float64Array(n);
  out.fill(NaN);
  // Build triangular weights of length `period`: 1..k..1
  const k = Math.floor((period + 1) / 2);
  const weights = new Float64Array(period);
  for (let i = 0; i < period; i++) {
    weights[i] = i < k ? i + 1 : period - i;
  }
  let wsum = 0;
  for (let i = 0; i < period; i++) wsum += weights[i];

  // Sliding NaN-aware convolution: maintain weighted sum and weight sum
  let weightedSum = 0;
  let weightSum = 0;
  // initialize first window
  for (let j = 0; j < period; j++) {
    const v = source[j];
    if (Number.isFinite(v)) {
      weightedSum += weights[j] * v;
      weightSum += weights[j];
    }
    out[j] = NaN;
  }
  // first full window result
  out[period - 1] = weightSum > 0 ? weightedSum / weightSum : NaN;

  // slide window
  for (let i = period; i < n; i++) {
    // remove outgoing element at position i - period
    const oldIdx = i - period;
    const oldV = source[oldIdx];
    if (Number.isFinite(oldV)) {
      weightedSum -= weights[0] * oldV;
      weightSum -= weights[0];
    }
    // shift weights: rather than rotate the weights array, update contributions
    // by subtracting the contribution of each existing weight position and
    // adding the next value multiplied by weight p. To keep O(1) per step,
    // we maintain a circular buffer of the last `period` values and their
    // associated weights. Simpler approach: update by recomputing delta using
    // the pattern of weights shifting, which is O(period) worst-case but
    // period is expected small; trade-off accepted for clarity.
    weightedSum = 0;
    weightSum = 0;
    const base = i - period + 1;
    for (let j = 0; j < period; j++) {
      const v = source[base + j];
      if (Number.isFinite(v)) {
        weightedSum += weights[j] * v;
        weightSum += weights[j];
      }
    }
    out[i] = weightSum > 0 ? weightedSum / weightSum : NaN;
  }

  return out;
}
