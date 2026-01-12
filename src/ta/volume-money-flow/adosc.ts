import { havena } from '../../arr/arr.js';
import { shouldSkipDenseOptimization } from '../util.js';

function adoscDense(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, volume: ArrayLike<number>, n: number, shortPeriod: number, longPeriod: number, out: Float64Array): Float64Array {
  if (n < longPeriod) return out.fill(NaN);
  
  // EMAs coefficients
  const kShort = 2 / (shortPeriod + 1);
  const kLong = 2 / (longPeriod + 1);

  // Initialize with first value
  const hi0 = high[0];
  const lo0 = low[0];
  const ci0 = close[0];
  const vi0 = volume[0];
  let mfm0 = 0;
  const range0 = hi0 - lo0;
  if (range0 !== 0) mfm0 = ((ci0 - lo0) - (hi0 - ci0)) / range0;
  const mfv0 = mfm0 * vi0;
  
  let cum = mfv0;
  let emaS = cum;
  let emaL = cum;

  out[0]= NaN;

  // Warmup phase (indices 1 to longPeriod-1)
  for (let i = 1; i < longPeriod; i++) {
    const hi = high[i];
    const lo = low[i];
    const ci = close[i];
    const vi = volume[i];
    let mfm = 0;
    const range = hi - lo;
    if (range !== 0) mfm = ((ci - lo) - (hi - ci)) / range;
    const mfv = mfm * vi;
    cum += mfv;
    
    emaS = emaS + kShort * (cum - emaS);
    emaL = emaL + kLong * (cum - emaL);
    out[i]= NaN;
  }

  // Output starts at longPeriod-1 after warmup
  out[longPeriod - 1] = emaS - emaL;

  // Steady-state phase: compute AD, EMAs, and write output
  for (let i = longPeriod; i < n; i++) {
    const hi = high[i];
    const lo = low[i];
    const ci = close[i];
    const vi = volume[i];
    let mfm = 0;
    const range = hi - lo;
    if (range !== 0) mfm = ((ci - lo) - (hi - ci)) / range;
    const mfv = mfm * vi;
    cum += mfv;
    
    emaS = emaS + kShort * (cum - emaS);
    emaL = emaL + kLong * (cum - emaL);
    out[i] = emaS - emaL;
  }

  return out;
}

function adoscNanAware(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, volume: ArrayLike<number>, n: number, shortPeriod: number, longPeriod: number, out: Float64Array): Float64Array {
  out.fill(NaN);
  
  // EMAs coefficients
  const kShort = 2 / (shortPeriod + 1);
  const kLong = 2 / (longPeriod + 1);

  // Find first valid value and initialize
  let cum = 0;
  let emaS = NaN;
  let emaL = NaN;
  let validCount = 0;
  
  for (let i = 0; i < n; i++) {
    const hi = high[i];
    const lo = low[i];
    const ci = close[i];
    const vi = volume[i];
    
    // Early NaN check
    if (!(hi === hi && lo === lo && ci === ci && vi === vi)) continue;
    
    const range = hi - lo;
    let mfm = 0;
    if (range !== 0) mfm = ((ci - lo) - (hi - ci)) / range;
    const mfv = mfm * vi;
    cum += mfv;
    
    if (validCount === 0) {
      // Initialize EMAs with first valid AD value
      emaS = cum;
      emaL = cum;
    } else {
      emaS = emaS + kShort * (cum - emaS);
      emaL = emaL + kLong * (cum - emaL);
    }

    validCount++;

    // Output starts after longPeriod valid points. If never reached, array stays all-NaN.
    if (validCount >= longPeriod) {
      out[i] = emaS - emaL;
    }
  }

  return out;
}

// Expose internals for unit tests
// (internal helpers are not exported)


/**
 * Accumulation/Distribution Oscillator (ADOSC).
 * Computes the difference between short- and long-term EMAs of the cumulative
 * money flow (AD). Supports NaN-aware and dense fast-paths; outputs are NaN
 * until the long EMA seeding is complete.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param volume Volume series
 * @param shortPeriod Short EMA period
 * @param longPeriod Long EMA period
 * @param skipna Whether to ignore NaNs during computation (default: true)
 * @returns Float64Array of ADOSC values (NaN where undefined)
 */
export function adosc(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, volume: ArrayLike<number>, shortPeriod: number, longPeriod: number, skipna= true): Float64Array{

  if (shortPeriod <= 0 || longPeriod <= 0) throw new Error('Periods must be positive');
  if (shortPeriod >= longPeriod) throw new Error('shortPeriod should be less than longPeriod');

  // arrays path
  const n = close.length;
  if (high.length !== n || low.length !== n || volume.length !== n) throw new Error('high, low, close and volume must have equal length');

  if (skipna && !shouldSkipDenseOptimization() && !havena(high, low, close, volume)) {
    skipna = false;
  }

  const out = new Float64Array(n);//
  if(n === 0) return out;
  if (!skipna) return adoscDense(high, low, close, volume, n, shortPeriod, longPeriod, out);
  return adoscNanAware(high, low, close, volume, n, shortPeriod, longPeriod, out);
}
