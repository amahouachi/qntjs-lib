// Rolling helpers: highest and lowest
// highest(source, period) -> rolling maximum ending at each index (NaN until enough data)
// lowest(source, period) -> rolling minimum ending at each index (NaN until enough data)

// NOTE: forward-fill removal: cross functions should be strict by default.

/**
 * TA utility helpers for small boolean/rolling operations used by indicators.
 * Includes functions for detecting rising/falling masks and crosses with
 * strict NaN-aware semantics by default.
 */

/**
 * Determine whether global dense optimization should be skipped. Useful for
 * tests that need to exercise NaN-aware code paths by setting
 * `SKIP_DENSE_OPTIMIZATION=true` in the environment.
 * @returns `true` when dense optimizations should be skipped
 */
export function shouldSkipDenseOptimization(): boolean {
  return (typeof process === 'undefined' || typeof process.env === 'undefined') ? false : (process.env.SKIP_DENSE_OPTIMIZATION === 'true');
}

function risingOrFalling(source: ArrayLike<number>, length: number, direction: 'rising' | 'falling', skipna = true): Uint8Array {
  if (length <= 0) throw new Error('Length must be positive');
  const n = source.length;
  const out = new Uint8Array(n);
  if (n === 0) return out;

  const isRising = direction === 'rising';

  // Deque implemented with preallocated Int32Array
  const dq = new Int32Array(n);
  let head = 0, tail = 0;

  // Dense (no NaN) path
  if (!skipna) {
    head = 0; tail = 0;
    const warm = Math.min(n, length);
    // i = 0 is special: no prev index to push
    // warm-up: build deque for first window (outputs already 0 because Uint8Array is zeroed)
    for (let i = 1; i < warm; i++) {
      const prevIdx = i - 1; // >= 0
      const pv = source[prevIdx];
      if (isRising) {
        while (tail > head && source[dq[tail - 1]] <= pv) tail--;
      } else {
        while (tail > head && source[dq[tail - 1]] >= pv) tail--;
      }
      dq[tail++] = prevIdx;
      const headLimit = i - length;
      while (tail > head && dq[head] < headLimit) head++;
      // out[i] is already zero
    }

    // steady-state: i from length .. n-1, no need to check i >= length inside loop
    for (let i = Math.max(length, 1); i < n; i++) {
      const prevIdx = i - 1;
      const pv = source[prevIdx];
      if (isRising) {
        while (tail > head && source[dq[tail - 1]] <= pv) tail--;
      } else {
        while (tail > head && source[dq[tail - 1]] >= pv) tail--;
      }
      dq[tail++] = prevIdx;
      const headLimit = i - length;
      while (tail > head && dq[head] < headLimit) head++;
      const idx = tail > head ? dq[head] : -1;
      if (idx >= 0) {
        out[i] = isRising ? (source[i] > source[idx] ? 1 : 0) : (source[i] < source[idx] ? 1 : 0);
      } else out[i] = 0;
    }
    return out;
  }

  // NaN-aware path
  head = 0; tail = 0;
  let lastValid = -1;
  const warm = Math.min(n, length);

  // handle i = 0 explicitly
  if (n > 0) {
    const v0 = source[0];
    if (v0 !== v0) {
      out[0] = 0;
      lastValid = -1;
    } else {
      // no prev to push, just mark lastValid
      lastValid = 0;
      out[0] = 0;
    }
  }

  // warm-up: build deque using prev valid indices for i = 1 .. warm-1
  for (let i = 1; i < warm; i++) {
    const v = source[i];
    if (v !== v) { // NaN
      out[i] = out[i - 1];
      continue;
    }
    const prevIdx = lastValid;
    if (prevIdx >= 0) {
      const pv = source[prevIdx];
      if (isRising) {
        while (tail > head && source[dq[tail - 1]] <= pv) tail--;
      } else {
        while (tail > head && source[dq[tail - 1]] >= pv) tail--;
      }
      dq[tail++] = prevIdx;
    }
    lastValid = i;
    const headLimit = i - length;
    while (tail > head && dq[head] < headLimit) head++;
    // out[i] already appropriate (copied on NaN or zeroed)
  }

  // steady-state: compute outputs for i = length .. n-1
  for (let i = Math.max(length, 1); i < n; i++) {
    const v = source[i];
    if (v !== v) {
      out[i] = out[i - 1];
      continue;
    }
    const prevIdx = lastValid;
    if (prevIdx >= 0) {
      const pv = source[prevIdx];
      if (isRising) {
        while (tail > head && source[dq[tail - 1]] <= pv) tail--;
      } else {
        while (tail > head && source[dq[tail - 1]] >= pv) tail--;
      }
      dq[tail++] = prevIdx;
    }
    lastValid = i;
    const headLimit = i - length;
    while (tail > head && dq[head] < headLimit) head++;
    const idx = tail > head ? dq[head] : -1;
    if (idx >= 0) {
      out[i] = isRising ? (source[i] > source[idx] ? 1 : 0) : (source[i] < source[idx] ? 1 : 0);
    } else out[i] = 0;
  }
  return out;
}

/**
 * Rising mask: returns a Uint8Array where `1` indicates `source[i]` is
 * strictly greater than the value `length` periods ago (NaN-aware).
 * When `skipna` is true, NaNs are tolerated and preserved; when false a
 * dense fast-path is used (assumes no NaNs).
 * @param source Input numeric series
 * @param length Lookback length (>0)
 * @param skipna Whether to ignore NaNs during computation (default: true)
 * @returns Uint8Array mask with 0/1 values
 */
export function rising(source: ArrayLike<number>, length: number, skipna = true): Uint8Array {
  return risingOrFalling(source, length, 'rising', skipna);
}

/**
 * Falling mask: returns a Uint8Array where `1` indicates `source[i]` is
 * strictly less than the value `length` periods ago (NaN-aware).
 * When `skipna` is true, NaNs are tolerated and preserved; when false a
 * dense fast-path is used (assumes no NaNs).
 * @param source Input numeric series
 * @param length Lookback length (>0)
 * @param skipna Whether to ignore NaNs during computation (default: true)
 * @returns Uint8Array mask with 0/1 values
 */
export function falling(source: ArrayLike<number>, length: number, skipna = true): Uint8Array {
  return risingOrFalling(source, length, 'falling', skipna);
}

/**
 * Test whether series `a` crosses `b` (or a scalar) between the previous and
 * current index. By default uses a symmetric cross test that detects both
 * upward and downward crossings. Comparisons are strict and require non-NaN
 * current and previous values for both operands.
 * @param a Left series
 * @param b Right series or scalar
 * @param test Optional custom comparator receiving (ai, aim1, bi, bim1)
 * @returns Uint8Array mask where 1 indicates a crossing at that index
 */
export function cross(a: ArrayLike<number>, b: ArrayLike<number> | number, test?: (ai: number, aim1: number, bi: number, bim1: number) => boolean): Uint8Array {
  const cmp = test ?? ((ai: number, aim1: number, bi: number, bim1: number) => (ai > bi && aim1 <= bim1) || (ai < bi && aim1 >= bim1));
  return crossBase(a, b, cmp);
}

/**
 * Detect an upward crossover (a crosses above b).
 */
export function crossover(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const test = (ai: number, aim1: number, bi: number, bim1: number) => ai > bi && aim1 <= bim1;
  return cross(a, b, test);
}

/**
 * Detect a downward crossunder (a crosses below b).
 */
export function crossunder(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const test = (ai: number, aim1: number, bi: number, bim1: number) => ai < bi && aim1 >= bim1;
  return cross(a, b, test);
}

function crossBase(a: ArrayLike<number>, b: ArrayLike<number> | number, test: (ai: number, aim1: number, bi: number, bim1: number) => boolean): Uint8Array {
  const n = a.length;
  const out = new Uint8Array(n);
  if (n === 0) return out;
  // Strict NaN-aware comparison: require both current and previous values
  // to be present (non-NaN) for both operands. Do not forward-fill here; if
  // callers want gaps handling they should perform it when preparing tickers.
  if (typeof b === 'number') {
    const bv = b as number;
    for (let i = 1; i < n; i++) {
      const ai = a[i];
      const aim1 = a[i - 1];
      if (ai !== ai || aim1 !== aim1) continue;
      if (test(ai, aim1, bv, bv)) out[i] = 1;
    }
    return out;
  }

  const bArr = b as ArrayLike<number>;
  const m = Math.min(n, bArr.length);
  for (let i = 1; i < m; i++) {
    const ai = a[i];
    const aim1 = a[i - 1];
    const bi = bArr[i];
    const bim1 = bArr[i - 1];
    if (ai !== ai || aim1 !== aim1 || bi !== bi || bim1 !== bim1) continue;
    if (test(ai, aim1, bi, bim1)) out[i] = 1;
  }
  return out;
}

