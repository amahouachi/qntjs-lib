import { shouldSkipDenseOptimization } from '../util.js';
import { havena } from '../../arr/arr.js';

/**
 * Parabolic SAR (PSAR) indicator.
 * @param high High price series
 * @param low Low price series
 * @param step Acceleration step increment (>0)
 * @param maxStep Maximum acceleration value (>= step)
 * @param skipna When true ignore NaNs; when false use dense fast-path
 * @returns Float64Array PSAR values (NaN for undefined positions)
 */
export function psar(high: ArrayLike<number>, low: ArrayLike<number>, step: number, maxStep: number, skipna= true): Float64Array{

  if (step <= 0 || maxStep <= 0) throw new Error('step and maxStep must be positive');
  if (step > maxStep) throw new Error('step must be <= maxStep');
  const n = high.length;
  if (low.length !== n) throw new Error('high and low must have same length');
  const out = new Float64Array(n);
  if (n === 0) return out;

  // Helper: compute next PSAR state for a single valid bar
  // Returns the new { sar, accel, lng, extreme, outVal }
  function computePSARStep(
    sar: number,
    accel: number,
    extreme: number,
    lng: boolean,
    hi: number,
    li: number,
    prev1_h: number,
    prev2_h: number,
    prev1_l: number,
    prev2_l: number
  ) {
    let nextSar = sar + accel * (extreme - sar);
    let outVal: number;
    let newAccel = accel;
    let newSar = sar;
    let newLng = lng;
    let newExtreme = extreme;

    if (lng) {
      // cap by previous two lows
      if (nextSar > prev2_l) nextSar = prev2_l;
      if (nextSar > prev1_l) nextSar = prev1_l;

      // accel update when new high beyond extreme
      if (hi > newExtreme){ 
        newExtreme = hi;
        newAccel += step;
        if (newAccel >= maxStep) {
          newAccel = maxStep;
        }
      }
      newSar = nextSar;
      if (li < nextSar) {
        // reversal to short
        newAccel = step;
        newSar = newExtreme;
        newLng = false;
        newExtreme = li;
      }
      outVal = newSar;
    } else {
      // short
      if (nextSar < prev2_h) nextSar = prev2_h;
      if (nextSar < prev1_h) nextSar = prev1_h;

      if (li < newExtreme){
        newExtreme = li;
        newAccel += step;
        if (newAccel >= maxStep) {
          newAccel = maxStep;
        }
      } 
      newSar = nextSar;
      if (hi > nextSar) {
        newAccel = step;
        newSar = newExtreme;
        newLng = true;
        newExtreme = hi;
      }
      outVal = newSar;
    }

    return { sar: newSar, accel: newAccel, lng: newLng, extreme: newExtreme, outVal };
  }

  function densePSAR(high: ArrayLike<number>, low: ArrayLike<number>): Float64Array {
    const m = high.length;
    const res = new Float64Array(m);
    res.fill(NaN);
    if (m < 2) return res;

    // Choose initial direction using sums of first two bars
    let lng = (high[0] + low[0] <= high[1] + low[1]);

    let sar: number;
    let extreme: number;
    if (lng) {
      extreme = high[0];
      sar = low[0];
    } else {
      extreme = low[0];
      sar = high[0];
    }

    let accel = step;

    // Handle i=1 separately to avoid checks inside main loop
    {
      const i = 1;
      const prev_h = high[0];
      const prev_l = low[0];
      const st = computePSARStep(sar, accel, extreme, lng, high[i], low[i], prev_h, prev_h, prev_l, prev_l);
      sar = st.sar;
      accel = st.accel;
      lng = st.lng;
      extreme = st.extreme;
      res[i] = st.outVal;
    }

    // Main loop from i=2 to m-1: no i>=2 checks inside
    for (let i = 2; i < m; i++) {
      // cache values
      const hi = high[i];
      const li = low[i];
      const prev1_h = high[i - 1];
      const prev2_h = high[i - 2];
      const prev1_l = low[i - 1];
      const prev2_l = low[i - 2];

      const st = computePSARStep(sar, accel, extreme, lng, hi, li, prev1_h, prev2_h, prev1_l, prev2_l);
      sar = st.sar;
      accel = st.accel;
      lng = st.lng;
      extreme = st.extreme;
      res[i] = st.outVal;
    }

    return res;
  }

  function psarNanAware(high: ArrayLike<number>, low: ArrayLike<number>): Float64Array {
    const res = new Float64Array(n).fill(NaN);
    if (n < 2) return res;

    const isValid = (i: number) => {
      const h = high[i];
      const l = low[i];
      return h === h && l === l;
    };

    const findNextValid = (start: number) => {
      let j = start;
      while (j < n && !isValid(j)) j++;
      return j;
    };

    // find first two valid bars
    const i0 = findNextValid(0);
    if (i0 >= n) return res;
    const i1 = findNextValid(i0 + 1);
    if (i1 >= n) return res;

    // initial direction based on first two valid bars
    let lng = (high[i0] + low[i0] <= high[i1] + low[i1]);

    let sar: number;
    let extreme: number;
    if (lng) {
      extreme = high[i0];
      sar = low[i0];
    } else {
      extreme = low[i0];
      sar = high[i0];
    }

    let accel = step;

    // handle the second valid bar (i1) similarly to densePSAR's i=1 block
    {
      const i = i1;
      const prev_h = high[i0];
      const prev_l = low[i0];
      const st = computePSARStep(sar, accel, extreme, lng, high[i], low[i], prev_h, prev_h, prev_l, prev_l);
      sar = st.sar;
      accel = st.accel;
      lng = st.lng;
      extreme = st.extreme;
      res[i] = st.outVal;
    }

    // prepare prev indices for the main loop (prev2 = i0, prev1 = i1)
    let prev2 = i0;
    let prev1 = i1;

    // iterate over remaining valid bars
    let cur = findNextValid(prev1 + 1);
    while (cur < n) {
      const hi = high[cur];
      const li = low[cur];
      const prev1_h = high[prev1];
      const prev2_h = high[prev2];
      const prev1_l = low[prev1];
      const prev2_l = low[prev2];

      const st = computePSARStep(sar, accel, extreme, lng, hi, li, prev1_h, prev2_h, prev1_l, prev2_l);
      sar = st.sar;
      accel = st.accel;
      lng = st.lng;
      extreme = st.extreme;
      res[cur] = st.outVal;

      // shift prev indices
      prev2 = prev1;
      prev1 = cur;
      cur = findNextValid(prev1 + 1);
    }

    return res;
  }

  if (skipna && !shouldSkipDenseOptimization()) {
    if (!havena(high, low)) {
      skipna = false;
    }
  }

  if (!skipna) {
    return densePSAR(high, low);
  }
  return psarNanAware(high, low);
}
