/**
 * Money Flow Index (MFI).
 * Computes MFI over `period` using typical price and money flow; NaN-aware
 * sliding-window implementation that emits NaN where insufficient valid data exists.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param volume Volume series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of MFI values in [0,100]
 */
export function mfi(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, volume: ArrayLike<number>, period: number): Float64Array{
  if (period <= 0) throw new Error('Period must be positive');

  // arrays path
  const n = close.length;
  if (high.length !== n || low.length !== n || volume.length !== n) throw new Error('high, low, close and volume must have equal length');

  const out = new Float64Array(n);
  out.fill(NaN);
  if (n <= period) return out;

  // Single-pass inline: compute typical price (t) and money flow (mf)
  // on the fly and maintain circular windows of positive/negative contributions.
  const posWindow = new Float64Array(period);
  const negWindow = new Float64Array(period);
  const nanWindow = new Uint8Array(period);
  let posSum = 0;
  let negSum = 0;
  let nanCount = 0;

  // initialize tPrev from index 0
  const t0 = (high[0] + low[0] + close[0]) / 3;
  let tPrev = t0;

  // Warmup: fill slots 1..period-1
  for (let i = 1; i < period; i++) {
    const t = (high[i] + low[i] + close[i]) / 3;
    const mfv = t * volume[i];
    const mfIsFinite = Number.isFinite(mfv);

    let posVal = 0;
    let negVal = 0;
    if (mfIsFinite) {
      if (t > tPrev) posVal = mfv;
      else if (t < tPrev) negVal = mfv;
    } else {
      nanWindow[i] = 1;
      nanCount++;
    }

    posWindow[i] = posVal;
    negWindow[i] = negVal;
    posSum += posVal;
    negSum += negVal;
    tPrev = t;
  }

  // handle index = period -> stored at window slot 0
  {
    const i = period;
    const t = (high[i] + low[i] + close[i]) / 3;
    const mfv = t * volume[i];
    const mfIsFinite = Number.isFinite(mfv);

    let posVal = 0;
    let negVal = 0;
    if (mfIsFinite) {
      if (t > tPrev) posVal = mfv;
      else if (t < tPrev) negVal = mfv;
    } else {
      nanWindow[0] = 1;
      nanCount++;
    }

    posWindow[0] = posVal;
    negWindow[0] = negVal;
    posSum += posVal;
    negSum += negVal;

    const tpIsFinite = Number.isFinite(t);
    if (tpIsFinite && nanCount === 0) {
      if (posSum + negSum === 0) out[i] = 50;
      else if (negSum === 0) out[i] = 100;
      else {
        const ratio = posSum / negSum;
        out[i] = 100 - (100 / (1 + ratio));
      }
    }
    tPrev = t;
  }

  // Steady-state phase: sliding window
  let wPtr = 1;
  for (let i = period + 1; i < n; i++) {
    const t = (high[i] + low[i] + close[i]) / 3;
    const mfv = t * volume[i];
    const mfIsFinite = Number.isFinite(mfv);

    let posVal = 0;
    let negVal = 0;
    let curIsNaNSlot = 0;
    if (mfIsFinite) {
      if (t > tPrev) posVal = mfv;
      else if (t < tPrev) negVal = mfv;
    } else {
      curIsNaNSlot = 1;
    }

    posSum += posVal - posWindow[wPtr];
    negSum += negVal - negWindow[wPtr];

    nanCount += curIsNaNSlot - nanWindow[wPtr];

    posWindow[wPtr] = posVal;
    negWindow[wPtr] = negVal;
    nanWindow[wPtr] = curIsNaNSlot;

    wPtr++;
    if (wPtr === period) wPtr = 0;

    const tpIsFinite = Number.isFinite(t);
    if (tpIsFinite && nanCount === 0) {
      if (posSum + negSum === 0) out[i] = 50;
      else if (negSum === 0) out[i] = 100;
      else {
        const ratio = posSum / negSum;
        out[i] = 100 - (100 / (1 + ratio));
      }
    }

    tPrev = t;
  }

  return out;
}
