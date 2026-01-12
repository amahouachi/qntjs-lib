// Single-pass dense computation optimized: computes TR,+DM,-DM on the fly without allocating temp arrays

/**
 * Compute directional movement (DI) helpers.
 * Returns an object with `diplus`, `diminus`, `dx`, `adx`, and `adxr` buffers.
 * All outputs are Float64Array and NaNs propagate for insufficient data
 * or invalid input pairs.
 */
function _computeDM(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number) {
  if (period <= 0) throw new Error('Period must be positive');
  const n = high.length;
  if (low.length !== n || close.length !== n) throw new Error('high, low and close must have equal length');
  // Use typed arrays for numeric work to reduce GC and improve numeric throughput
  const diplus = new Float64Array(n);
  const diminus = new Float64Array(n);
  const dx = new Float64Array(n);
  const adx = new Float64Array(n);
  const adxr = new Float64Array(n);
  // If not enough data, return arrays filled with NaN
  if (n < period) {
    diplus.fill(NaN);
    diminus.fill(NaN);
    dx.fill(NaN);
    adx.fill(NaN);
    adxr.fill(NaN);
    return { diplus, diminus, dx, adx, adxr };
  }

  // Initial sums over [0..period-1]
  let smTR = 0;
  let smP = 0;
  let smM = 0;

  // small helper to compute tr, p, m for a given index i (assumes i > 0)
  function computeBar(i: number) {
    const up = high[i] - high[i - 1];
    const down = low[i - 1] - low[i];
    const p = up > down && up > 0 ? up : 0;
    const m = down > up && down > 0 ? down : 0;
    const r1 = high[i] - low[i];
    const r2 = Math.abs(high[i] - close[i - 1]);
    const r3 = Math.abs(low[i] - close[i - 1]);
    const tr = Math.max(r1, Math.max(r2, r3));
    return { tr, p, m };
  }

  // i = 0: compute once outside the hot loop
  const tr0 = high[0] - low[0];
  smTR += 0//tr0;
  // pdm/mdm at 0 are zero

  // accumulate for indices 1 .. period-1
  for (let i = 1; i < period; i++) {
    const b = computeBar(i);
    smTR += b.tr;
    smP += b.p;
    smM += b.m;
  }

  // ensure outputs before first index are NaN (only indices < period-1)
  for (let i = 0; i < period - 1 && i < n; i++) {
    diplus[i] = NaN;
    diminus[i] = NaN;
    dx[i] = NaN;
    adxr[i] = NaN;
  }

  // first output at period-1
  const dp0 = smTR !== 0 ? 100 * (smP / smTR) : NaN;
  const dm0 = smTR !== 0 ? 100 * (smM / smTR) : NaN;
  diplus[period - 1] = dp0;
  diminus[period - 1] = dm0;
  // compute dx even when dp0/dm0 are NaN or sum==0; result will be NaN in those cases
  dx[period - 1] = 100 * Math.abs(dp0 - dm0) / (dp0 + dm0);

  // Prepare ADX streaming: seed DX accumulation covers indices [period-1 .. 2*period-2]
  const endSeed = 2 * period - 2;
  // Ensure ADX indices before the first ADX sample are NaN (0..endSeed-1).
  // Only fill the small prefix; the rest will be written during streaming.
  if (endSeed > 0) {
    // fill up to and including endSeed so adxr[endSeed] isn't left as 0 by default
    adx.fill(NaN, 0, Math.min(n, endSeed + 1));
    adxr.fill(NaN, 0, Math.min(n, endSeed + 1));
  }
  let sumDX = 0;
  let countDX = 0;
  // include dx at period-1 in seed accumulation
  const dx0 = dx[period - 1];
  if (dx0 === dx0) { sumDX += dx0; countDX++; }

  // iterate forward in two phases to avoid branching inside the hot loop:
  // 1) seed phase: i in [period .. endSeed] (collect DX for ADX seed)
  // 2) streaming phase: i > endSeed (compute ADX via Wilder smoothing)

  // Phase 1: seeding DX up to endSeed
  for (let i = period; i <= endSeed && i < n; i++) {
    const { tr, p, m } = computeBar(i);

    smTR = smTR - smTR / period + tr;
    smP = smP - smP / period + p;
    smM = smM - smM / period + m;

    const dp = smTR !== 0 ? 100 * (smP / smTR) : NaN;
    const dm = smTR !== 0 ? 100 * (smM / smTR) : NaN;
    diplus[i] = dp;
    diminus[i] = dm;
    const dxv = 100 * Math.abs(dp - dm) / (dp + dm);
    dx[i] = dxv;

    if (dxv === dxv) { sumDX += dxv; countDX++; }
    if (i === endSeed) {
      // Explicitly set the seed ADX value (or NaN if insufficient DX seeding)
      adx[endSeed] = (countDX === period) ? (sumDX / countDX) : NaN;
      // ADXR not available yet at endSeed (needs adx[endSeed-period]) so leave as NaN
    }
  }

  // Phase 2: streaming remaining bars and compute ADX via Wilder smoothing
  for (let i = Math.max(period, endSeed + 1); i < n; i++) {
    const { tr, p, m } = computeBar(i);

    smTR = smTR - smTR / period + tr;
    smP = smP - smP / period + p;
    smM = smM - smM / period + m;

    const dp = smTR !== 0 ? 100 * (smP / smTR) : NaN;
    const dm = smTR !== 0 ? 100 * (smM / smTR) : NaN;
    diplus[i] = dp;
    diminus[i] = dm;
    const dxv = 100 * Math.abs(dp - dm) / (dp + dm);
    dx[i] = dxv;

    // Streaming ADX using Wilder smoothing
    adx[i] = ((adx[i - 1] * (period - 1)) + dxv) / period;

    // Compute ADXR when adx[i - period] exists (not NaN)
    const prevAdx = adx[i - period+1];
    adxr[i] = (adx[i] + prevAdx) / 2;
  }

  // Return typed buffers and let callers convert only what they need
  return { diplus, diminus, dx, adx, adxr };
}

/**
 * Directional Indicators (DI+ and DI-).
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Tuple `[diplus, diminus]` as Float64Array
 */
export function di(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): [Float64Array, Float64Array]{
  const dm= _computeDM(high as ArrayLike<number>, low as ArrayLike<number>, close as ArrayLike<number>, period);
  return [dm.diplus, dm.diminus];
}

// Update dx to always return Float64Array
/**
 * DX (Directional Movement Index).
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of DX values (NaN where undefined)
 */
export function dx(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array {
  return _computeDM(high as ArrayLike<number>, low as ArrayLike<number>, close as ArrayLike<number>, period).dx;
}

// Update adx to work with Float64Array dx and return Float64Array
/**
 * Average Directional Index (ADX).
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of ADX values (NaN where undefined)
 */
export function adx(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array{
  return _computeDM(high as ArrayLike<number>, low as ArrayLike<number>, close as ArrayLike<number>, period).adx;
}

// ADXR (Average DI Rating) - ADXR[t] = (ADX[t] + ADX[t-period]) / 2
/**
 * ADXR (Average DX Rating) - smoothed ADX.
 * @param high High price series
 * @param low Low price series
 * @param close Close price series
 * @param period Lookback period (must be > 0)
 * @returns Float64Array of ADXR values (NaN where undefined)
 */
export function adxr(high: ArrayLike<number>, low: ArrayLike<number>, close: ArrayLike<number>, period: number): Float64Array{
  return _computeDM(high as ArrayLike<number>, low as ArrayLike<number>, close as ArrayLike<number>, period).adxr;
}