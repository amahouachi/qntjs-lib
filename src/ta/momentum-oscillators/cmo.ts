/**
 * Chande Momentum Oscillator (CMO).
 * Computes CMO over `period` using percent scaling in [-100, 100].
 * Ignores NaNs in the input deltas; positions before the first
 * computable value are NaN.
 * @param src Input series
 * @param period Period over which to compute the oscillator
 * @returns Float64Array of CMO values (NaN where undefined)
 */
export function cmo(src: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error('Period must be positive');
  const n = src.length;
  const out = new Float64Array(n);
  if (n === 0) return out;

  // need at least period+1 points to compute first CMO at index `period`
  if (n < period + 1) {
    out.fill(NaN);
    return out;
  }

  // fill leading NaNs up to index `period`
  for (let i = 0; i < period; i++) out[i] = NaN;

  // initial sums over changes [1 .. period] but ignore any change involving NaN
  let sumUp = 0;
  let sumDown = 0;
  let validDeltas = 0;
  for (let i = 1; i <= period; i++) {
    const a = src[i - 1];
    const b = src[i];
    const change = b - a;
    if (change === change) {
      validDeltas++;
      if (change > 0) sumUp += change; else if (change < 0) sumDown += -change;
    }
  }
  const denom0 = sumUp + sumDown;
  out[period] = validDeltas === 0 ? NaN : (denom0 !== 0 ? 100 * (sumUp - sumDown) / denom0 : 0);

  for (let i = period + 1; i < n; i++) {
    // slide window: remove old change and add new change, updating validDeltas accordingly
    const aNew = src[i - 1];
    const bNew = src[i];
    const newChange = bNew - aNew;

    const aOld = src[i - period - 1];
    const bOld = src[i - period];
    const oldChange = bOld - aOld;

    const oldValid = oldChange === oldChange;
    const newValid = newChange === newChange;

    if (oldValid) {
      if (oldChange > 0) sumUp -= oldChange;
      else if (oldChange < 0) sumDown -= -oldChange;
      validDeltas--;
    }

    if (newValid) {
      if (newChange > 0) sumUp += newChange;
      else if (newChange < 0) sumDown += -newChange;
      validDeltas++;
    }

    if (validDeltas === 0) {
      out[i] = NaN;
      continue;
    }

    const denom = sumUp + sumDown;
    out[i] = denom !== 0 ? 100 * (sumUp - sumDown) / denom : 0;
  }

  return out;
}
