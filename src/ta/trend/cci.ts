/**
 * Commodity Channel Index (CCI).
 * Computes the typical price (TP) and compares to a moving average and
 * mean absolute deviation (MAD) scaled by 0.015. Positions before the
 * full lookback or with invalid inputs are NaN.
 * Performance: O(n*p) due to MAD recomputation per window.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of CCI values (NaN where undefined)
 */
export function cci(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');
  const n = close.length;
  if (high.length !== n || low.length !== n) throw new Error('high, low and close must have equal length');

  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;


  // Precompute TP once (preserve NaNs)
  const tp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    tp[i] = (high[i] + low[i] + close[i]) / 3;
  }

  // NaN-aware inline implementation (used for all calls)
  // sliding window sum and count for TP valid values
  let sum = 0;
  let count = 0;
  const p = period;
  for (let i = 0; i < p && i < n; i++) {
    const v = tp[i];
    if (v === v) { sum += v; count++; }
  }

  const abs = Math.abs;
  const invPeriod = 1 / p;
  const scale = 0.015;
  const endSeed = 2 * p - 2;

  for (let i = p - 1; i < n; i++) {
    if (count === p && i >= endSeed) {
      const ma = sum * invPeriod;
      // compute MAD by resumming |tp[j] - ma| over the window
      let md = 0;
      const start = i - p + 1;
      for (let j = start; j <= i; j++) {
        md += abs(tp[j] - ma);
      }
      md = md * invPeriod;
      const denom = scale * md;
      const tp_i = tp[i];
      out[i] = denom === 0 ? 0 : (tp_i - ma) / denom;
    }

    // advance window: remove at rem = i - period + 1, add at add = i+1
    if (i + 1 < n) {
      const remIdx = i - p + 1;
      const remV = tp[remIdx];
      if (remV === remV) { sum -= remV; count--; }
      const addV = tp[i + 1];
      if (addV === addV) { sum += addV; count++; }
    }
  }

  return out;
}
