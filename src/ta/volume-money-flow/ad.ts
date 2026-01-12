/**
 * Accumulation/Distribution (AD) line.
 * Computes the cumulative money flow: AD[i] = AD[i-1] + MFM[i] * volume[i],
 * where MFM = ((close - low) - (high - close)) / (high - low).
 * NaNs propagate for invalid input tuples and the accumulator only updates on finite values.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param volume Volume series
 * @returns Float64Array of AD values
 */
export function ad(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, volume: ArrayLike<number>): Float64Array {
  const n = close.length;
  if (high.length !== n || low.length !== n || volume.length !== n) throw new Error('high/low/close/volume must have same length');
  const out = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    const v = volume[i];

    const denom = (h - l);
    const mf = denom === 0 ? 0 : ((c - l) - (h - c)) / denom;

    const xacc = acc + mf * v;
    if (xacc === xacc) {
      acc = xacc;
    }
    out[i] = xacc;
  }
  return out;
}