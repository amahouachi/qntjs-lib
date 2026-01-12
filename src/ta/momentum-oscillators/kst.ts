import { ta, math } from '../../index.js';

/**
 * Know Sure Thing (KST) momentum oscillator
 * Default parameters match common KST configuration
 */
export type KstOptions = {
  r1?: number; r2?: number; r3?: number; r4?: number;
  n1?: number; n2?: number; n3?: number; n4?: number;
  w1?: number; w2?: number; w3?: number; w4?: number;
}

const DEFAULT_KST = {
  r1: 10, r2: 15, r3: 20, r4: 30,
  n1: 10, n2: 10, n3: 10, n4: 15,
  w1: 1, w2: 2, w3: 3, w4: 4,
};

/**
 * Know Sure Thing (KST) momentum oscillator.
 * Computes a weighted sum of smoothed rate-of-change series.
 * Parameters may be supplied via the `options` object or defaults are used.
 * The output length equals `src.length`; positions before the required
 * lookback periods are NaN.
 * @param src Input series
 * @param options Optional parameters for ROC and smoothing windows
 * @returns Float64Array of KST values (NaN where insufficient data)
 */
export function kst(src: ArrayLike<number>, options?: KstOptions): Float64Array {
  // resolve parameters from positional or options
  let r1= options?.r1 ?? DEFAULT_KST.r1, r2= options?.r2 ?? DEFAULT_KST.r2, r3= options?.r3 ?? DEFAULT_KST.r3, r4= options?.r4 ?? DEFAULT_KST.r4;
  let n1= options?.n1 ?? DEFAULT_KST.n1, n2= options?.n2 ?? DEFAULT_KST.n2, n3= options?.n3 ?? DEFAULT_KST.n3, n4= options?.n4 ?? DEFAULT_KST.n4;
  let w1= options?.w1 ?? DEFAULT_KST.w1, w2= options?.w2 ?? DEFAULT_KST.w2, w3= options?.w3 ?? DEFAULT_KST.w3, w4= options?.w4 ?? DEFAULT_KST.w4;

  // basic validation
  const rocs = [r1, r2, r3, r4];
  const ns = [n1, n2, n3, n4];
  for (const p of rocs.concat(ns)) if (p <= 0) throw new Error('Periods must be positive');

  const n = src.length;
  if (n === 0) return new Float64Array(0);

  const roc1 = ta.roc(src, r1);
  const roc2 = ta.roc(src, r2);
  const roc3 = ta.roc(src, r3);
  const roc4 = ta.roc(src, r4);

  const sma1 = ta.sma(roc1, n1);
  const sma2 = ta.sma(roc2, n2);
  const sma3 = ta.sma(roc3, n3);
  const sma4 = ta.sma(roc4, n4);

  const part1 = math.mul(sma1, w1);
  const part2 = math.mul(sma2, w2);
  const part3 = math.mul(sma3, w3);
  const part4 = math.mul(sma4, w4);

  return math.add(math.add(part1, part2), math.add(part3, part4));
}
