/**
 * Rate-of-change (ROC) and raw change helpers.
 * `_change` computes `mult * (src[i] - src[i-period]) / src[i-period]` (or
 * simple difference when `mult` is 1). Outputs are NaN for indices before
 * `period` and propagate NaNs for invalid input pairs.
 */
function _change(src: ArrayLike<number>, period: number, mult= 1): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = src.length;
  const out = new Float64Array(n);
  for(let i = 0; i < period; i++){
    out[i] = NaN;
  }
  if (n <= period) return out;

  // Always compute directly on the source. Per-pair NaN checks ensure NaN inputs
  // produce NaN outputs (out remains NaN) while valid pairs produce the fractional change.
  for (let i = period; i < n; i++) {
    const cur = src[i];
    const prev = src[i - period];
    out[i] = mult * (cur - prev) / prev;
  }
  return out;
}

/**
 * Simple change over `period`.
 * Computes `src[i] - src[i-period]` for each index `i >= period`.
 * Outputs NaN for indices before `period` and propagates NaNs for invalid pairs.
 * @param src Input series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of simple change values (NaN where undefined)
 */
export function change(src: ArrayLike<number>, period: number): Float64Array{
  return _change(src as ArrayLike<number>, period, 1);
}

/**
 * Percentage Rate-of-Change (ROC).
 * Returns 100 * (src[i] - src[i-period]) / src[i-period]. NaN is returned
 * for indices before `period` or when a denominator is NaN/zero.
 * @param src Input series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of ROC values (NaN where undefined)
 */
export function roc(src: ArrayLike<number>, period: number): Float64Array {
  return _change(src as ArrayLike<number>, period, 100);
}
