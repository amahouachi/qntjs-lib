import { shouldSkipDenseOptimization } from "../util.js";
import { rollargmax, rollargmin } from '../../math/minmax.js';
import { arr } from "../../index.js";

/**
 * Aroon indicator: returns `[up, down]` arrays in percentage form (0-100)
 * describing the time since the highest/lowest value within the lookback
 * `period`. Supports NaN-aware and dense fast-paths.
 * @param high High price series
 * @param low Low price series
 * @param period Lookback period (>0)
 * @param skipna When true ignore NaNs in windows; false forces dense path
 * @returns Tuple `[up, down]` Float64Array indicators
 */
export function aroon(high: ArrayLike<number>, low: ArrayLike<number>, period: number, skipna= true): [Float64Array, Float64Array] {
  if (period <= 0) throw new Error('Period must be positive');
  const n = high.length;
  if (low.length !== n) throw new Error('high and low must have same length');

  const up = new Float64Array(n);
  const down = new Float64Array(n);
  up.fill(NaN); down.fill(NaN);
  if (n < period) return [up, down];

  if (arr.havena(high, low)) return [up, down];

  let _skipna = skipna;
  if(_skipna && !shouldSkipDenseOptimization()) {
    // Check if there are any NaNs in the inputs
    let hasNaN = false;
    for (let i = 0; i < n; i++) {
      if (high[i] !== high[i] || low[i] !== low[i]) {
        hasNaN = true;
        break;
      }
    }
    // If no NaNs, use the dense algorithm (keep skipna true for parity with existing indicators)
    if (!hasNaN) {
      _skipna = true;
    }
  }

  if (!_skipna) {
    let highestIdx = -1;
    let highestVal = NaN;
    let lowestIdx = -1;
    let lowestVal = NaN;

    for (let i = period; i < n; i++) {
      const start = i - period + 1;

      // highest
      if (highestIdx < start) {
        // rescan window
        highestIdx = -1; highestVal = NaN;
        for (let j = start; j <= i; j++) {
          const v = high[j];
          if (v !== v) continue;
          if (highestIdx === -1 || v > highestVal) { highestIdx = j; highestVal = v; }
        }
      } else {
        const v = high[i];
        if (v === v) {
          if (highestIdx === -1 || v > highestVal) { highestIdx = i; highestVal = v; }
        }
      }
      const daysSinceHigh = highestIdx === -1 ? NaN : (i - highestIdx);
      up[i - 1] = daysSinceHigh === daysSinceHigh ? ((period - daysSinceHigh) / period) * 100 : NaN;

      // lowest
      if (lowestIdx < start) {
        lowestIdx = -1; lowestVal = NaN;
        for (let j = start; j <= i; j++) {
          const v = low[j];
          if (v !== v) continue;
          if (lowestIdx === -1 || v < lowestVal) { lowestIdx = j; lowestVal = v; }
        }
      } else {
        const v = low[i];
        if (v === v) {
          if (lowestIdx === -1 || v < lowestVal) { lowestIdx = i; lowestVal = v; }
        }
      }
      const daysSinceLow = lowestIdx === -1 ? NaN : (i - lowestIdx);
      down[i - 1] = daysSinceLow === daysSinceLow ? ((period - daysSinceLow) / period) * 100 : NaN;
    }

    return [up, down];
  }

  // Dense path - use efficient rolling argmax/argmin
  const argMax = rollargmax(high, period);
  const argMin = rollargmin(low, period);
  
  for (let i = period; i < n; i++) {
    const hiIdx = argMax[i];
    up[i - 1] = hiIdx !== hiIdx ? NaN : ((period - (i - hiIdx)) / period) * 100;
    const loIdx = argMin[i];
    down[i - 1] = loIdx !== loIdx ? NaN : ((period - (i - loIdx)) / period) * 100;
  }
  return [up, down];
}
