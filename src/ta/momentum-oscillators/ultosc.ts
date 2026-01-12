export type UltoscOptions= {
  s1?: number;
  s2?: number;
  s3?: number;
}

const DEFAULT_ULTOSC = { s1: 7, s2: 14, s3: 28 };

/**
 * Ultimate Oscillator (ULTOSC).
 * Combines short-, mid-, and long-term averages of the buying pressure / true range
 * to produce a bounded oscillator in [0,100]. Preserves NaN inputs and returns
 * NaN for indices before the longest lookback has sufficient data.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param options Optional periods for short/mid/long (s1,s2,s3)
 * @returns Float64Array of Ultimate Oscillator values (NaN where undefined)
 */
export function ultosc(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, options?: UltoscOptions): Float64Array {
  const s1 = options?.s1 ?? DEFAULT_ULTOSC.s1;
  const s2Val = options?.s2 ?? DEFAULT_ULTOSC.s2;
  const s3Val = options?.s3 ?? DEFAULT_ULTOSC.s3;

  if (s1 <= 0 || s2Val <= 0 || s3Val <= 0) throw new Error('Periods must be positive');
  const n = close.length;
  if (high.length !== n || low.length !== n) throw new Error('high, low and close must have equal length');

  const out = new Float64Array(n);
  // initialize with NaN so indices before first valid calculation remain NaN
  for (let i = 0; i < n; i++) out[i] = NaN;
  if (n === 0) return out;

  // Build cumulative BP and TR with an extra leading 0 to avoid boundary checks
  const cumBP = new Float64Array(n + 1);
  const cumTR = new Float64Array(n + 1);
  
  // Handle first element
  {
    const hi = high[0];
    const lo = low[0];
    const ci = close[0];
    const bpVal = ci - lo;
    const trVal = hi - lo;
    cumBP[1] = bpVal;
    cumTR[1] = trVal;
  }
  
  // Process remaining elements - note: storing at index i+1 in cumBP/cumTR
  for (let i = 1; i < n; i++) {
    const hi = high[i];
    const lo = low[i];
    const ci = close[i];
    const prev = close[i - 1];
    
    const minLowPrevClose = Math.min(lo, prev);
    const maxHighPrevClose = Math.max(hi, prev);
    const bpVal = ci - minLowPrevClose;
    const trVal = maxHighPrevClose - minLowPrevClose;

    cumBP[i + 1] = cumBP[i] + bpVal;
    cumTR[i + 1] = cumTR[i] + trVal;
  }

  const w1 = 4, w2 = 2, w3 = 1;
  const denomWeight = w1 + w2 + w3;
  
  // Largest period determines when we can start calculating
  const maxPeriod = Math.max(s1, s2Val, s3Val);
  if (n < maxPeriod) {
    // not enough data, keep all NaN
    return out;
  }
  const startIdx = maxPeriod;

  for (let i = startIdx; i < n; i++) {
    const i1 = i - s1 + 1;
    const i2 = i - s2Val + 1;
    const i3 = i - s3Val + 1;

    const sumBP1 = cumBP[i + 1] - cumBP[i1];
    const sumTR1 = cumTR[i + 1] - cumTR[i1];
    const avg1 = sumTR1 === 0 ? 0 : sumBP1 / sumTR1;

    const sumBP2 = cumBP[i + 1] - cumBP[i2];
    const sumTR2 = cumTR[i + 1] - cumTR[i2];
    const avg2 = sumTR2 === 0 ? 0 : sumBP2 / sumTR2;

    const sumBP3 = cumBP[i + 1] - cumBP[i3];
    const sumTR3 = cumTR[i + 1] - cumTR[i3];
    const avg3 = sumTR3 === 0 ? 0 : sumBP3 / sumTR3;

    out[i] = 100 * ((w1 * avg1 + w2 * avg2 + w3 * avg3) / denomWeight);
  }

  return out;
}
