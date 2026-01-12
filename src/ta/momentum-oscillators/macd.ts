
/**
 * Moving Average Convergence Divergence (MACD).
 * Produces the MACD line (short EMA - long EMA), the signal line (EMA of MACD),
 * and the histogram (MACD - signal). Skips NaNs and seeds EMAs on first valid
 * value; outputs are NaN until the EMAs and signal have seeded.
 * @param src Input series
 * @param shortPeriod Short EMA period
 * @param longPeriod Long EMA period
 * @param signalPeriod Signal EMA period
 * @returns Tuple `[macdLine, signalLine, histogram]` as Float64Array
 */
export function macd(src: ArrayLike<number>, shortPeriod: number, longPeriod: number, signalPeriod: number): [Float64Array, Float64Array, Float64Array] {
  if (shortPeriod <= 0 || longPeriod <= 0 || signalPeriod <= 0) throw new Error('Periods must be positive');
  const n = src.length;

  const macdLine = new Float64Array(n);
  const signal = new Float64Array(n);
  const hist = new Float64Array(n);

  // initialize with NaN so that insufficient data (n < required) returns all NaNs
  macdLine.fill(NaN);
  signal.fill(NaN);
  hist.fill(NaN);

  const required = longPeriod + signalPeriod - 1; // conservative bound for having full MACD+signal
  if (n < required) return [macdLine, signal, hist];

  // NaN-aware single-pass: skip NaNs and run the EMA algorithm inline
  const kShort = 2 / (shortPeriod + 1);
  const kLong = 2 / (longPeriod + 1);
  const kSig = 2 / (signalPeriod + 1);

  let haveSig = false;
  let emaS = NaN;
  let emaL = NaN;
  let emaSig = NaN;
  let validS = 0;
  let validL = 0;

  for (let i = 0; i < n; i++) {
    const v = src[i];
    if (v !== v) {
      // skip NaN input, keep NaN outputs at this index
      continue;
    }
    if (validS === 0) {
      // seed on first valid
      emaS = v;
      emaL = v;
      validS = 1;
      validL = 1;
      continue;
    }

    // update EMAs
    emaS = emaS + kShort * (v - emaS);
    emaL = emaL + kLong * (v - emaL);
    validS++;
    validL++;

    if (validL >= longPeriod && validS >= shortPeriod) {
      const macdVal = emaS - emaL;
      macdLine[i] = macdVal;
      if (!haveSig) {
        emaSig = macdVal;
        haveSig = true;
        signal[i] = emaSig;
        hist[i] = 0;
      } else {
        emaSig = emaSig + kSig * (macdVal - emaSig);
        signal[i] = emaSig;
        hist[i] = macdVal - emaSig;
      }
    }
  }

  return [macdLine, signal, hist];
}
