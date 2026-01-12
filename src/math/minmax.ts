function rollminOrmax(source: ArrayLike<number>, period: number, isMax: boolean): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out;
  const dq = new Int32Array(n);
  let head = 0;
  let tail = 0;
  // Init phase
  for (let i = 0; i < period - 1; i++) {
    const v = source[i];
    if (v === v) {
      // if isMax=true we maintain decreasing deque (remove tail if tailVal < v)
      // if isMax=false (min) we maintain increasing deque (remove tail if tailVal > v)
      while (tail > head && (isMax ? source[dq[tail - 1]] < v : source[dq[tail - 1]] > v)) tail--;
      dq[tail++] = i;
    }
  }
  // Main loop
  for (let i = period - 1; i < n; i++) {
    const v = source[i];
    while (tail > head && dq[head] <= i - period) head++;
    if (v === v) {
      while (tail > head && (isMax ? source[dq[tail - 1]] < v : source[dq[tail - 1]] > v)) tail--;
      dq[tail++] = i;
    }
    out[i] = tail > head ? source[dq[head]] : NaN;
  }
  return out;
}

/**
 * Rolling minimum over a window. NaN-aware: windows containing only NaNs produce NaN.
 * @param source Input values
 * @param period Window length (must be > 0)
 * @returns Float64Array of rolling minima (NaN for positions before the window fills)
 */
export function rollmin(source: ArrayLike<number>, period: number): Float64Array {
  return rollminOrmax(source, period, false);
}

/**
 * Rolling maximum over a window. NaN-aware: windows containing only NaNs produce NaN.
 * @param source Input values
 * @param period Window length (must be > 0)
 * @returns Float64Array of rolling maxima (NaN for positions before the window fills)
 */
export function rollmax(source: ArrayLike<number>, period: number): Float64Array {
  return rollminOrmax(source, period, true);
}

/**
 * Compute rolling minima and maxima pairwise over two input series.
 * Optional callback `cb(minVal, maxVal, i)` is invoked for each computed window.
 * @param minSource Input for minima
 * @param maxSource Input for maxima
 * @param period Window length (must be > 0)
 * @param cb Optional callback invoked per window
 * @returns Object with `min` and `max` Float64Array results
 */
export function rollminmax(minSource: ArrayLike<number>, maxSource: ArrayLike<number>, period: number, cb?: (minVal: number, maxVal: number, i: number) => void): { min: Float64Array; max: Float64Array } {
  const n = minSource.length;
  if (maxSource.length !== n) throw new Error('minSource and maxSource must have equal length');
  const outMin = new Float64Array(n);
  const outMax = new Float64Array(n);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return { min: outMin, max: outMax };

  const dqMin = new Int32Array(n);
  const dqMax = new Int32Array(n);
  let headMin = 0, tailMin = 0;
  let headMax = 0, tailMax = 0;

  // Init phase
  for (let i = 0; i < period - 1; i++) {
    const vMin = minSource[i];
    const vMax = maxSource[i];
    while (tailMin > headMin && minSource[dqMin[tailMin - 1]] > vMin) tailMin--;
    while (tailMax > headMax && maxSource[dqMax[tailMax - 1]] < vMax) tailMax--;
    if (vMin === vMin) dqMin[tailMin++] = i;
    if (vMax === vMax) dqMax[tailMax++] = i;
  }

  // Main loop
  for (let i = period - 1; i < n; i++) {
    const vMin = minSource[i];
    const vMax = maxSource[i];
    while (tailMin > headMin && dqMin[headMin] <= i - period) headMin++;
    while (tailMin > headMin && minSource[dqMin[tailMin - 1]] > vMin) tailMin--;
    while (tailMax > headMax && dqMax[headMax] <= i - period) headMax++;
    while (tailMax > headMax && maxSource[dqMax[tailMax - 1]] < vMax) tailMax--;
    if (vMin === vMin) dqMin[tailMin++] = i;
    if (vMax === vMax) dqMax[tailMax++] = i;
    const curMin = tailMin > headMin ? minSource[dqMin[headMin]] : NaN;
    const curMax = tailMax > headMax ? maxSource[dqMax[headMax]] : NaN;
    outMin[i] = curMin;
    outMax[i] = curMax;
    if (cb) cb(curMin, curMax, i);
    //_cb(curMin, curMax, i);
  }

  return { min: outMin, max: outMax };
}

/**
 * Minimum of an array, ignoring NaNs. Returns NaN if no valid entries.
 * @param source Input array
 * @returns Minimum value or NaN
 */
export function min(source: ArrayLike<number>): number {
  let m = Infinity;
  let found = false;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v) {
      if (v < m) {
        m = v;
      }
      found = true;
    }
  }
  if (found) {
    return m;
  }
  return NaN;
}

/**
 * Maximum of an array, ignoring NaNs. Returns NaN if no valid entries.
 * @param source Input array
 * @returns Maximum value or NaN
 */
export function max(source: ArrayLike<number>): number {
  let m = -Infinity;
  let found = false;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v) {
      if (v > m) {
        m = v;
      }
      found = true;
    }
  }
  if (found) {
    return m;
  }
  return NaN;
}

/**
 * Index of the first minimum value (ignores NaNs). Returns -1 if none found.
 * @param source Input array
 * @returns Index of minimum or -1
 */
export function argmin(source: ArrayLike<number>): number {
  let best = -1;
  let bestVal = Infinity;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v && v < bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

/**
 * Index of the first maximum value (ignores NaNs). Returns -1 if none found.
 * @param source Input array
 * @returns Index of maximum or -1
 */
export function argmax(source: ArrayLike<number>): number {
  let best = -1;
  let bestVal = -Infinity;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v && v > bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

/**
 * Cumulative maximum: at each index the maximum over all prior valid elements.
 * NaNs are preserved in the output at positions where input is NaN.
 * @param source Input array
 * @returns Float64Array of cumulative maxima
 */
export function cummax(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  let cur = -Infinity;

  for (let i = 0; i < n; i++) {
    const v = source[i];

    if (v !== v) {
      out[i] = NaN;
    } else {
      if (i === 0) {
        cur = v;
      } else {
        cur = Math.max(cur, v);
      }

      out[i] = cur;
    }
  }

  return out;
}

/**
 * Cumulative minimum: at each index the minimum over all prior valid elements.
 * NaNs are preserved in the output at positions where input is NaN.
 * @param source Input array
 * @returns Float64Array of cumulative minima
 */
export function cummin(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  let cur = Infinity;

  for (let i = 0; i < n; i++) {
    const v = source[i];

    if (v !== v) {
      out[i] = NaN;
    } else {
      if (i === 0) {
        cur = v;
      } else {
        cur = Math.min(cur, v);
      }

      out[i] = cur;
    }
  }

  return out;
}

/**
 * Rolling argmin: returns the index (into `source`) of the minimum value in each window.
 * Positions before the window fills are NaN.
 * @param source Input array
 * @param period Window length
 * @returns Float64Array of argmin indices (NaN when not available)
 */
export function rollargmin(source: ArrayLike<number>, period: number): Float64Array {
  // NaN-aware deque-based single-pass (skip NaNs)
  const n = source.length;
  const out = new Float64Array(n);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out.fill(NaN);
  out.fill(NaN, 0, period - 1);

  const dq = new Int32Array(n);
  let head = 0, tail = 0;

  for (let i = 0; i < n; i++) {
    const v = source[i];
    while (tail > head && dq[head] <= i - period) head++;
    if (v === v) {
      while (tail > head && source[dq[tail - 1]] > v) tail--;
      dq[tail++] = i;
    }
    if (i >= period - 1) out[i] = tail > head ? dq[head] : NaN;
  }
  return out;
}

/**
 * Rolling argmax: returns the index (into `source`) of the maximum value in each window.
 * Positions before the window fills are NaN.
 * @param source Input array
 * @param period Window length
 * @returns Float64Array of argmax indices (NaN when not available)
 */
export function rollargmax(source: ArrayLike<number>, period: number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out.fill(NaN);
  out.fill(NaN, 0, period - 1);

  const dq = new Int32Array(n);
  let head = 0, tail = 0;

  for (let i = 0; i < n; i++) {
    const v = source[i];
    while (tail > head && dq[head] <= i - period) head++;
    if (v === v) {
      while (tail > head && source[dq[tail - 1]] < v) tail--;
      dq[tail++] = i;
    }
    if (i >= period - 1) out[i] = tail > head ? dq[head] : NaN;
  }
  return out;
}

