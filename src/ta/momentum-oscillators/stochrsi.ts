import { rsi } from './rsi.js';

/**
 * Stochastic RSI.
 * Applies a stochastic calculation to the RSI series, producing values in [0,1].
 * This implementation is NaN-aware and maintains deques over valid RSI samples.
 * @param close Close price series
 * @param period RSI lookback period
 * @returns Float64Array of StochRSI values (NaN where undefined)
 */
export function stochrsi(close: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = close.length;
  const out = new Float64Array(n);
  out.fill(NaN);

  const r = rsi(close, period);
  if (n === 0) return out;

  // NaN-aware single-pass: process original RSI series but skip NaNs and maintain deques over valid samples
  const dqMin = new Int32Array(n);
  const dqMax = new Int32Array(n);
  const dqCompMin = new Int32Array(n);
  const dqCompMax = new Int32Array(n);
  let headMin = 0, tailMin = 0;
  let headMax = 0, tailMax = 0;
  let compIdx = -1; // compressed index of last valid sample

  for (let i = 0; i < n; i++) {
    const v = r[i];
    if (v !== v) {
      out[i] = NaN;
      continue;
    }
    compIdx++;
    // maintain min deque (values increasing)
    while (tailMin > headMin && r[dqMin[tailMin - 1]] >= v) tailMin--;
    dqMin[tailMin] = i;
    dqCompMin[tailMin] = compIdx;
    tailMin++;
    // prune old
    const minLimit = compIdx - period;
    while (tailMin > headMin && dqCompMin[headMin] <= minLimit) headMin++;

    // maintain max deque (values decreasing)
    while (tailMax > headMax && r[dqMax[tailMax - 1]] <= v) tailMax--;
    dqMax[tailMax] = i;
    dqCompMax[tailMax] = compIdx;
    tailMax++;
    // prune old
    const maxLimit = compIdx - period;
    while (tailMax > headMax && dqCompMax[headMax] <= maxLimit) headMax++;

    if (compIdx >= period - 1) {
      const lo = r[dqMin[headMin]];
      const hi = r[dqMax[headMax]];
      const range = hi - lo;
      out[i] = range === 0 ? 0 : ((v - lo) / range);
    } else {
      out[i] = NaN;
    }
  }

  return out;
}

