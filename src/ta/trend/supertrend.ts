import { atr } from '../volatility/atr.js';

// Returns [supertrend, finalUpper, finalLower, isUpMask]
/**
 * Supertrend indicator.
 * Returns `[supertrend, finalUpper, finalLower, isUpMask]`.
 * `supertrend` contains the plotted trend line (either finalLower when up or finalUpper when down),
 * `finalUpper`/`finalLower` are the band values, and `isUpMask` is a Uint8Array mask (1 when up).
 * NaNs are preserved for invalid inputs or before enough data is available.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period ATR lookback period
 * @param mult Multiplier applied to ATR to form bands
 * @returns Tuple `[supertrend, finalUpper, finalLower, isUpMask]`
 */
export function supertrend(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number, mult: number): [Float64Array, Float64Array, Float64Array, Uint8Array] {
  if (period <= 0) throw new Error('Period must be positive');
  const n = high.length;
  if (low.length !== n || close.length !== n) throw new Error('high/low/close must have the same length');

  const st = new Float64Array(n);
  const finalUpper = new Float64Array(n);
  const finalLower = new Float64Array(n);
  const isUp = new Uint8Array(n);

  if (n === 0) return [st, finalUpper, finalLower, isUp];

  const atrArr = atr(high, low, close, period);

  // initialize arrays to NaN
  for (let i = 0; i < n; i++) {
    st[i] = finalUpper[i] = finalLower[i] = NaN;
  }

  let prevFinalUpper = NaN;
  let prevFinalLower = NaN;
  let prevTrend = 1; // 1 = up, 0 = down

  for (let i = 0; i < n; i++) {
    const a = atrArr[i];
    const h = high[i];
    const l = low[i];
    const c = close[i];
    if (a !== a || h !== h || l !== l || c !== c) {
      // leave NaN
      continue;
    }

    const basicMid = (h + l) / 2;
    const basicUpper = basicMid + mult * a;
    const basicLower = basicMid - mult * a;

    let currFinalUpper = basicUpper;
    let currFinalLower = basicLower;

    if (i > 0 && prevFinalUpper === prevFinalUpper) {
      // final upper: choose the higher of prevFinalUpper unless basicUpper is lower or prevClose > prevFinalUpper
      const prevClose = close[i - 1];
      if (!(basicUpper < prevFinalUpper || (prevClose !== prevClose ? false : prevClose > prevFinalUpper))) {
        currFinalUpper = prevFinalUpper;
      }
    }

    if (i > 0 && prevFinalLower === prevFinalLower) {
      const prevClose = close[i - 1];
      if (!(basicLower > prevFinalLower || (prevClose !== prevClose ? false : prevClose < prevFinalLower))) {
        currFinalLower = prevFinalLower;
      }
    }

    // determine trend
    let currTrend = prevTrend;
    if (c > currFinalUpper) currTrend = 1;
    else if (c < currFinalLower) currTrend = 0;

    st[i] = currTrend ? currFinalLower : currFinalUpper;
    finalUpper[i] = currFinalUpper;
    finalLower[i] = currFinalLower;
    isUp[i] = currTrend ? 1 : 0;

    prevFinalUpper = currFinalUpper;
    prevFinalLower = currFinalLower;
    prevTrend = currTrend;
  }

  return [st, finalUpper, finalLower, isUp];
}
