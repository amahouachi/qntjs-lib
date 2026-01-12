/**
 * Product of array elements, ignoring NaNs. Returns NaN if no valid entries.
 * @param source Input array
 * @returns Product of values or NaN
 */
export function prod(source: ArrayLike<number>): number {
  let p = 1;
  let cnt = 0;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v) {
      p *= v;
      cnt++;
    }
  }
  if (cnt === 0) {
    return NaN;
  }
  return p;
}

/**
 * Cumulative product (NaN-preserving). At each index the product of all prior valid elements.
 * @param source Input array
 * @returns Float64Array of cumulative products (NaN where input was NaN)
 */
export function cumprod(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  let p = 1;

  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v === v) {
      p *= v;
      out[i] = p;
    } else {
      out[i] = NaN;
    }
  }

  return out;
}

/**
 * Rolling product over a window. NaN-aware: windows with no valid entries produce NaN.
 * Zeros are handled efficiently by tracking counts.
 * @param source Input array
 * @param period Window length (must be > 0)
 * @returns Float64Array of rolling products (NaN for positions before window fills)
 */
export function rollprod(source: ArrayLike<number>, period: number): Float64Array {
  // NaN-aware single-pass sliding product (skipna parameter retained for compatibility)
  const n = source.length;
  const out = new Float64Array(n);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out.fill(NaN);
  out.fill(NaN, 0, period - 1);

  let prod = 1;
  let zeros = 0;
  let validCount = 0;

  // Initialize window over first `period` entries (counting only non-NaN)
  for (let i = 0; i < period; i++) {
    const v = source[i];
    if (v === v) {
      validCount++;
      if (v === 0) zeros++;
      else prod *= v;
    }
  }
  out[period - 1] = validCount > 0 ? (zeros > 0 ? 0 : prod) : NaN;

  // Main loop: slide window one index at a time, ignoring NaNs
  for (let i = period; i < n; i++) {
    const oldV = source[i - period];
    const newV = source[i];

    // handle outgoing value
    if (oldV === oldV) {
      validCount--;
      if (oldV === 0) {
        zeros--;
      } else {
        if (prod !== 0) {
          prod /= oldV;
        } else if (zeros === 0) {
          // possible underflow to zero: recompute product over current valid window
          prod = 1;
          for (let j = i - period + 1; j < i; j++) {
            const val = source[j];
            // istanbul ignore next
            if (val === val) {
              if (val !== 0) prod *= val;
            }
          }
        }
      }
    }

    // handle incoming value
    if (newV === newV) {
      validCount++;
      if (newV === 0) {
        zeros++;
      } else {
        prod *= newV;
      }
    }

    out[i] = validCount > 0 ? (zeros > 0 ? 0 : prod) : NaN;
  }

  return out;
}