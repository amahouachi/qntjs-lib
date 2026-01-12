/**
 * Elementwise equality comparison of two arrays, treating NaNs as equal.
 * If `precision` is provided, numeric comparison uses a tolerance of 10^-precision.
 * @param source1 First input array
 * @param source2 Second input array
 * @param precision Optional decimal precision for fuzzy equality
 * @returns `true` if arrays are equal, `false` otherwise
 */
function equals(source1: ArrayLike<number>, source2: ArrayLike<number>, precision?: number): boolean {
  if(source1.length!==source2.length) return false;
  for (let i = 0; i < source1.length; i++) {
    const v1 = source1[i];
    const v2= source2[i];
    if ((v1 !== v1 && v2 === v2) || (v1 === v1 && v2 !== v2)) return false;
    if(v1 !== v1 && v2 !== v2) continue;
    if (precision !== undefined) {
      // Compare with precision tolerance
      if (Math.abs(v1 - v2) > Math.pow(10, -precision)) return false;
    } else {
      // Exact equality
      if (v1 !== v2) return false;
    }
  }
  return true;
}
/**
 * Return true if all elements are NaN.
 * @param source Input array
 * @returns `true` when every entry is NaN
 */
function allna(source: ArrayLike<number>): boolean {
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v === v) return false;
  }
  return true;
}
/**
 * Count NaN entries in `source`.
 * @param source Input array
 * @returns Number of NaNs in the array
 */
function countna(source: ArrayLike<number>): number {
  let cnt = 0;
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (v !== v) cnt++;
  }
  return cnt;
}
/**
 * Test whether any of the provided arrays contains a NaN at the same index.
 * Performs a single-pass scan across arrays and exits early on the first NaN.
 * @param sources One or more input arrays
 * @returns `true` if any NaN is found, otherwise `false`
 */
function havena(...sources: ArrayLike<number>[]): boolean {
  if (sources.length === 0) return false;
  const n = sources[0].length;
  // Single pass through all arrays simultaneously - early exit on first NaN found
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < sources.length; j++) {
      const v = sources[j][i];
      if (v !== v) return true;
    }
  }
  return false;
}
/**
 * Return a mask indicating NaN positions: 1 for NaN, 0 otherwise.
 * @param source Input array
 * @returns Float64Array mask of 0/1 values
 */
function isna(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = source[i];
    out[i] = v !== v ? 1 : 0;
  }
  return out;
}

/**
 * Inverse of `isna`: mask with 1 for valid numbers and 0 for NaNs.
 * @param source Input array
 * @returns Float64Array mask of 0/1 values
 */
function notna(source: ArrayLike<number>): Float64Array {
  const mask = isna(source);
  const n = mask.length;
  for (let i = 0; i < n; i++) mask[i] = mask[i] ? 0 : 1;
  return mask;
}

function ensureFloat64(source: ArrayLike<number>, inplace: boolean): Float64Array {
  if (inplace && source instanceof Float64Array) return source as Float64Array;
  const out = new Float64Array(source.length);
  for (let i = 0; i < source.length; i++) out[i] = source[i];
  return out;
}

// Replace NaNs with a constant value. If inplace=true and source is Float64Array, mutate it.
/**
 * Replace NaNs with `value`. When `inplace=true` and `source` is a Float64Array,
 * the original buffer is mutated.
 * @param source Input array
 * @param value Replacement value for NaNs
 * @param inplace Whether to mutate the input when possible
 * @returns Float64Array with NaNs replaced
 */
function fillna(source: ArrayLike<number>, value: number, inplace: boolean = false): Float64Array {
  const out = ensureFloat64(source, inplace);
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (v !== v) out[i] = value;
  }
  return out;
}

// Forward-fill NaNs: propagate last valid value forward. Leading NaNs are left as NaN.
/**
 * Forward-fill NaNs: propagate the last valid value forward. Leading NaNs remain NaN.
 * @param source Input array
 * @param inplace Whether to mutate the input when possible
 * @returns Float64Array with forward-filled values
 */
function ffill(source: ArrayLike<number>, inplace: boolean = false): Float64Array {
  const out = ensureFloat64(source, inplace);
  let last: number | undefined = undefined;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (v === v) {
      last = v;
    } else if (last !== undefined) {
      out[i] = last as number;
    }
  }
  return out;
}

// Backward-fill NaNs: propagate next valid value backward. Trailing NaNs are left as NaN.
/**
 * Backward-fill NaNs: propagate the next valid value backward. Trailing NaNs remain NaN.
 * @param source Input array
 * @param inplace Whether to mutate the input when possible
 * @returns Float64Array with backward-filled values
 */
function bfill(source: ArrayLike<number>, inplace: boolean = false): Float64Array {
  const out = ensureFloat64(source, inplace);
  let next: number | undefined = undefined;
  for (let i = out.length - 1; i >= 0; i--) {
    const v = out[i];
    if (v === v) {
      next = v;
    } else if (next !== undefined) {
      out[i] = next as number;
    }
  }
  return out;
}

// Return a lagged/lead version of `source`.
// Positive `shift` produces a lag (value at i is source[i-shift]);
// negative `shift` produces a lead (value at i is source[i+abs(shift)]).
// Vacated positions are filled with NaN.
export function lag(source: ArrayLike<number>, shift = 1): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  if (shift === 0) {
    for (let i = 0; i < n; i++) out[i] = source[i];
    return out;
  }
  if (shift > 0) {
    for (let i = 0; i < n; i++) {
      const idx = i - shift;
      out[i] = idx >= 0 ? source[idx] : NaN;
    }
    return out;
  }
  // shift < 0 -> lead
  const s = -shift;
  for (let i = 0; i < n; i++) {
    const idx = i + s;
    out[i] = idx < n ? source[idx] : NaN;
  }
  return out;
}

// Replace occurrences of fromValue with toValue. If fromValue is NaN, replace NaNs.
/**
 * Replace occurrences of `fromValue` with `toValue`. If `fromValue` is NaN,
 * NaN entries are replaced.
 * @param source Input array
 * @param fromValue Value to replace (may be NaN)
 * @param toValue Replacement value
 * @param inplace Whether to mutate the input when possible
 * @returns Float64Array with replacements applied
 */
function replace(source: ArrayLike<number>, fromValue: number, toValue: number, inplace: boolean = false): Float64Array {
  const out = ensureFloat64(source, inplace);
  const isFromNaN = fromValue !== fromValue;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (isFromNaN) {
      if (v !== v) out[i] = toValue;
    } else {
      if (v === fromValue) out[i] = toValue;
    }
  }
  return out;
}

/**
 * Remove NaN entries from `source` and return a compacted Float64Array.
 * @param source Input array
 * @returns New Float64Array containing only the non-NaN values
 */
function dropna(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v === v) {
      out[j++] = v;
    }
  }
  return j === n ? out : out.slice(0, j);
}

export {
  isna, notna, fillna, ffill, bfill, replace,
  dropna, allna, equals, countna, havena
};