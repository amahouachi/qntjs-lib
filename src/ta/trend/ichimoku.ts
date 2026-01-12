import { lag } from '../../arr/arr.js';

export type IchimokuOptions = { tenkan?: number; kijun?: number; senkouB?: number };
export const DEFAULT_TENKAN = 9;
export const DEFAULT_KIJUN = 26;
export const DEFAULT_SENKOUB = 52;

//TODO replace with existing rollmax/rollmin available in math
// Returns [tenkan, kijun, senkouA, senkouB, chikou]
/**
 * Ichimoku Kinko Hyo indicator components.
 * Returns `[tenkan, kijun, senkouA, senkouB, chikou]` where senkou lines
 * are shifted forward by the `kijun` displacement and chikou is the close
 * shifted backward. NaN is produced where rolling inputs are invalid.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param options Optional periods `{ tenkan, kijun, senkouB }`
 * @returns Tuple of Float64Array: `[tenkan, kijun, senkouA, senkouB, chikou]`
 */
export function ichimoku(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, options?: IchimokuOptions): [Float64Array, Float64Array, Float64Array, Float64Array, Float64Array] {
  const tenkan = options?.tenkan ?? DEFAULT_TENKAN;
  const kijun = options?.kijun ?? DEFAULT_KIJUN;
  const senkouB = options?.senkouB ?? DEFAULT_SENKOUB;
  const displacement = kijun;

  if (tenkan <= 0 || kijun <= 0 || senkouB <= 0) throw new Error('Periods must be positive');
  const n = high.length;
  if (low.length !== n || close.length !== n) throw new Error('high/low/close must have the same length');

  const ten = new Float64Array(n);
  const kij = new Float64Array(n);
  const senA = new Float64Array(n);
  const senB = new Float64Array(n);

  // Initialize to NaN
  ten.fill(NaN);
  kij.fill(NaN);
  senA.fill(NaN);
  senB.fill(NaN);

  // helper to compute rolling high/low with strict NaN handling
  function rollingHighLow(srcHigh: ArrayLike<number>, srcLow: ArrayLike<number>, period: number, outHigh: Float64Array, outLow: Float64Array) {
    if (n < period) return;
    for (let i = period - 1; i < n; i++) {
      let maxv = -Infinity;
      let minv = Infinity;
      let anyNaN = false;
      for (let j = i - period + 1; j <= i; j++) {
        const h = srcHigh[j];
        const l = srcLow[j];
        if (h !== h || l !== l) { anyNaN = true; break; }
        if (h > maxv) maxv = h;
        if (l < minv) minv = l;
      }
      if (anyNaN) { outHigh[i] = outLow[i] = NaN; continue; }
      outHigh[i] = maxv;
      outLow[i] = minv;
    }
  }

  // Tenkan (conversion) uses tenkan period
  const tHigh = new Float64Array(n);
  const tLow = new Float64Array(n);
  tHigh.fill(NaN); tLow.fill(NaN);
  rollingHighLow(high, low, tenkan, tHigh, tLow);
  for (let i = 0; i < n; i++) {
    const th = tHigh[i];
    const tl = tLow[i];
    if (th !== th || tl !== tl) ten[i] = NaN; else ten[i] = (th + tl) / 2;
  }

  // Kijun (base) uses kijun period
  const kHigh = new Float64Array(n);
  const kLow = new Float64Array(n);
  kHigh.fill(NaN); kLow.fill(NaN);
  rollingHighLow(high, low, kijun, kHigh, kLow);
  for (let i = 0; i < n; i++) {
    const kh = kHigh[i];
    const kl = kLow[i];
    if (kh !== kh || kl !== kl) kij[i] = NaN; else kij[i] = (kh + kl) / 2;
  }

  // Senkou A: (tenkan + kijun)/2 shifted forward by displacement
  for (let i = 0; i < n; i++) {
    const t = ten[i];
    const k = kij[i];
    if (t !== t || k !== k) continue;
    const v = (t + k) / 2;
    const idx = i + displacement;
    if (idx < n) senA[idx] = v;
  }

  // Senkou B: rolling high/low of senkouB period, shifted forward by displacement
  const sbHigh = new Float64Array(n);
  const sbLow = new Float64Array(n);
  sbHigh.fill(NaN); sbLow.fill(NaN);
  rollingHighLow(high, low, senkouB, sbHigh, sbLow);
  for (let i = 0; i < n; i++) {
    const h = sbHigh[i];
    const l = sbLow[i];
    if (h !== h || l !== l) continue;
    const v = (h + l) / 2;
    const idx = i + displacement;
    if (idx < n) senB[idx] = v;
  }

  // Chikou span: close shifted backward by displacement (plotted to the left)
  const chik = lag(close, -displacement);

  return [ten, kij, senA, senB, chik];
}

