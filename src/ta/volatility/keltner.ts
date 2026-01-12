import { ema } from '../moving-averages/ema.js';
import { atr } from './atr.js';

// Returns [middle (EMA of typical), upper, lower]
/**
 * Keltner Channels.
 * Returns `[middle(EMA of typical price), upper, lower]` where upper/lower are `middle ± mult * ATR`.
 * Preserves NaNs when inputs are invalid.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @param mult Multiplier applied to ATR
 * @returns Tuple `[middle, upper, lower]` as Float64Array
 */
export function keltner(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number, mult: number): [Float64Array, Float64Array, Float64Array] {
  if (period <= 0) throw new Error('Period must be positive');
  const n = high.length;
  if (low.length !== n || close.length !== n) throw new Error('high/low/close must have the same length');

  if (n === 0) return [new Float64Array(0), new Float64Array(0), new Float64Array(0)];

  // compute typical price
  const tp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    if (h !== h || l !== l || c !== c) tp[i] = NaN;
    else tp[i] = (h + l + c) / 3;
  }

  const middle = ema(tp, period);
  const atrArr = atr(high, low, close, period);

  const upper = new Float64Array(n);
  const lower = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const m = middle[i];
    const a = atrArr[i];
    if (m !== m || a !== a) {
      upper[i] = lower[i] = NaN;
      continue;
    }
    upper[i] = m + mult * a;
    lower[i] = m - mult * a;
  }

  return [middle, upper, lower];
}
