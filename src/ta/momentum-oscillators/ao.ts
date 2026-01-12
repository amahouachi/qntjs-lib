import { shouldSkipDenseOptimization } from "../util.js";
import { ta, math, arr } from '../../index.js';

/**
 * Awesome Oscillator (AO): difference between short and long simple moving averages
 * of the median price ((high + low)/2). Supports NaN-aware and dense fast-paths.
 * @param high High price series
 * @param low Low price series
 * @param shortPeriod Short SMA period (default 5)
 * @param longPeriod Long SMA period (default 34)
 * @param skipna When true, ignore NaNs inside windows; false forces dense path
 * @returns Float64Array AO series (NaN where undefined)
 */
export function ao(high: ArrayLike<number>, low: ArrayLike<number>, shortPeriod: number= 5, longPeriod: number= 34, skipna= true): Float64Array{
  if (shortPeriod <= 0 || longPeriod <= 0) throw new Error('Periods must be positive');
  if (shortPeriod >= longPeriod) throw new Error('shortPeriod should be less than longPeriod');
  const n = high.length;
  if (low.length !== n) throw new Error('high and low must have same length');

  const out = new Float64Array(n);
  if (n < longPeriod) return out.fill(NaN);

  let _skipna = skipna;
  if(_skipna && !shouldSkipDenseOptimization()) {
    // Check if there are any NaNs in the inputs
    if (!arr.havena(high, low)) {
      _skipna = true;
    }
  }
  if (!_skipna) {
    // ring buffers to store last values for subtraction
    const bufLong = new Float64Array(longPeriod);
    const bufShort = new Float64Array(shortPeriod);
    // buffers initialized to 0 by default
    let sumLong = 0;
    let sumShort = 0;
    let idxLong = 0;
    let idxShort = 0;

    for (let i = 0; i < n; i++) {
      const med = (high[i] + low[i]) / 2;

      // add new
      sumLong += med;
      sumShort += med;

      // remove old long
      const oldLong = bufLong[idxLong];
      sumLong -= oldLong;
      bufLong[idxLong] = med;
      // replace modulo with branch-wrapping increment to avoid division in hot loop
      idxLong++;
      if (idxLong === longPeriod) idxLong = 0;

      // remove old short
      const oldShort = bufShort[idxShort];
      sumShort -= oldShort;
      bufShort[idxShort] = med;
      // replace modulo with branch-wrapping increment to avoid division in hot loop
      idxShort++;
      if (idxShort === shortPeriod) idxShort = 0;

      // compute when windows are full
      if (i >= longPeriod - 1) {
        // short may become full earlier; ensure both are considered
        if (i >= shortPeriod - 1) {
          out[i] = (sumShort / shortPeriod) - (sumLong / longPeriod);
        } else {
          out[i]= NaN;
        }
      }
    }
    return out;
  }

  const mp = math.avg(high, low);
  const shortSma = ta.sma(mp, shortPeriod);
  const longSma = ta.sma(mp, longPeriod);
  return math.sub(shortSma, longSma);
} 
