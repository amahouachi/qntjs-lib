/**
 * Element-wise addition.
 * - If `b` is a number, returns `a + b` for each element.
 * - If `b` is an array, returns element-wise sum up to the shorter length.
 * @param a Left operand array
 * @param b Right operand array or scalar
 * @returns Float64Array of sums
 */
export function add(a: ArrayLike<number>, b: ArrayLike<number> | number): Float64Array {
  if (typeof b === 'number') {
    const n = a.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = a[i] + b;
    return out;
  }
  const bb = b as ArrayLike<number>;
  const n = Math.min(a.length, bb.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = a[i] + bb[i];
  }
  return out;
}


/**
 * Element-wise subtraction.
 * - If `b` is a number, returns `a - b` for each element.
 * - If `b` is an array, returns element-wise difference up to the shorter length.
 * @param a Left operand array
 * @param b Right operand array or scalar
 * @returns Float64Array of differences
 */
export function sub(a: ArrayLike<number>, b: ArrayLike<number> | number): Float64Array {
  if (typeof b === 'number') {
    const n = a.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = a[i] - b;
    return out;
  }
  const bb = b as ArrayLike<number>;
  const n = Math.min(a.length, bb.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = a[i] - bb[i];
  }
  return out;
}


/**
 * Element-wise multiplication.
 * - If `b` is a number, scales each element of `a` by `b`.
 * - If `b` is an array, returns element-wise products up to the shorter length.
 * @param a Left operand array
 * @param b Right operand array or scalar
 * @returns Float64Array of products
 */
export function mul(a: ArrayLike<number>, b: ArrayLike<number> | number): Float64Array {
  if (typeof b === 'number') {
    const n = a.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = a[i] * b;
    return out;
  }
  const bb = b as ArrayLike<number>;
  const n = Math.min(a.length, bb.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = a[i] * bb[i];
  }
  return out;
}

/**
 * Element-wise division.
 * - If `b` is a number, divides each element of `a` by `b`.
 * - If `b` is an array, returns element-wise quotients up to the shorter length.
 * @param a Numerator array
 * @param b Denominator array or scalar
 * @returns Float64Array of quotients
 */
export function div(a: ArrayLike<number>, b: ArrayLike<number> | number): Float64Array {
  if (typeof b === 'number') {
    const n = a.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = a[i] / b;
    return out;
  }
  const bb = b as ArrayLike<number>;
  const n = Math.min(a.length, bb.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = a[i] / bb[i];
  }
  return out;
}


/**
 * Element-wise average: (a + b) / 2.
 * Computes the average without allocating temporaries.
 * @param a First array
 * @param b Second array or scalar
 * @returns Float64Array of averages
 */
export function avg(a: ArrayLike<number>, b: ArrayLike<number> | number): Float64Array {
  // Compute element-wise average (a + b) / 2 in a single pass to avoid temporaries
  if (typeof b === 'number') {
    const n = a.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = (a[i] + b) / 2;
    return out;
  }
  const bb = b as ArrayLike<number>;
  const n = Math.min(a.length, bb.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (a[i] + bb[i]) / 2;
  }
  return out;
}


/**
 * Scale an array by a scalar: `source * s`.
 * @param source Input array
 * @param s Scale factor
 * @returns Float64Array scaled values
 */
export function scale(source: ArrayLike<number>, s: number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = source[i] * s;
  }
  return out;
}

/**
 * Clamp values to the inclusive range [lo, hi]. Preserves NaN entries.
 * @param source Input array
 * @param lo Lower bound
 * @param hi Upper bound
 * @returns Float64Array with values clamped or NaN preserved
 */
export function clamp(source: ArrayLike<number>, lo: number, hi: number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = source[i];
    if (v !== v) {
      out[i] = NaN;
      continue;
    }
    if (v < lo) {
      v = lo;
    } else if (v > hi) {
      v = hi;
    }
    out[i] = v;
  }
  return out;
}

/**
 * Element-wise absolute value.
 * @param source Input array
 * @returns Float64Array of absolute values
 */
export function abs(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.abs(source[i]);
  }
  return out;
}

/**
 * Element-wise sign (-1, 0, 1) for each entry.
 * @param source Input array
 * @returns Float64Array of sign values
 */
export function sign(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sign(source[i]);
  }
  return out;
}

/**
 * Round values to nearest integer. Ties are rounded away from zero.
 * @param source Input array
 * @returns Float64Array of rounded integers
 */
export function round(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v >= 0) {
      out[i] = Math.floor(v + 0.5);
    } else {
      out[i] = Math.ceil(v - 0.5);
    }
  }
  return out;
}

/**
 * Element-wise floor operation.
 * @param source Input array
 * @returns Float64Array of floored values
 */
export function floor(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.floor(source[i]);
  }
  return out;
}


/**
 * Element-wise ceil operation.
 * @param source Input array
 * @returns Float64Array of ceiled values
 */
export function ceil(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.ceil(source[i]);
  }
  return out;
}


/**
 * First difference: output[i] = source[i] - source[i-1].
 * The first element is NaN (no previous value).
 * @param source Input array
 * @returns Float64Array of differences (first element NaN)
 */
export function diff(source: ArrayLike<number>): Float64Array {
  const n = source.length;
  if (n === 0) {
    return new Float64Array(0);
  }
  const out = new Float64Array(n);
  out[0] = NaN; // First element is always NaN
  
  for (let i = 1; i < n; i++) {
    out[i] = source[i] - source[i - 1];
  }
  return out;
}

/**
 * Map a callback across `source` producing a new Float64Array.
 * @param source Input array
 * @param cb Mapping callback `(value, index, array) => number`
 * @returns Float64Array of mapped values
 */
export function apply(source: ArrayLike<number>, cb: (v: number, i: number, arr: ArrayLike<number>) => number): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);
  const _cb= cb;
  for (let i = 0; i < n; i++) {
    out[i] = _cb(source[i], i, source);
  }
  return out;
}

/**
 * Apply a callback to each element in `source` in-place.
 * Modifies the provided array.
 * @param source Mutable array to update
 * @param cb Callback `(value, index) => newValue`
 */
export function applyInPlace(source: number[]|Float64Array, cb: (value: number, index: number) => number): void {
  const n = source.length;
  const _cb= cb;
  for (let i = 0; i < n; i++) {
    source[i] = _cb(source[i], i);
  }
}

function compareImpl(a: ArrayLike<number>, b: ArrayLike<number> | number, op: (x: number, y: number) => boolean): Uint8Array {
  const n = a.length;
  const out = new Uint8Array(n);
  if (typeof b === 'number') {
    const bv = b as number;
    for (let i = 0; i < n; i++) {
      out[i] = op(a[i], bv) ? 1 : 0;
    }
    return out;
  }
  const bb = b as ArrayLike<number>;
  const m = Math.min(n, bb.length);
  for (let i = 0; i < m; i++) {
    out[i] = op(a[i], bb[i]) ? 1 : 0;
  }
  return out;
}

/**
 * Element-wise less-than comparison. Returns `Uint8Array` mask with 1 where true.
 * @param a Left operand
 * @param b Right operand or scalar
 * @returns Uint8Array mask of comparisons
 */
export function lt(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const op = (x: number, y: number) => x < y;
  return compareImpl(a as ArrayLike<number>, b as ArrayLike<number> | number, op);
}

/**
 * Element-wise less-than-or-equal comparison (with epsilon tolerance).
 * @param a Left operand
 * @param b Right operand or scalar
 * @returns Uint8Array mask of comparisons
 */
export function lte(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const op = (x: number, y: number) => x < y || Math.abs(x - y) < Number.EPSILON;
  return compareImpl(a, b, op);
}

/**
 * Element-wise greater-than comparison. Returns `Uint8Array` mask with 1 where true.
 * @param a Left operand
 * @param b Right operand or scalar
 * @returns Uint8Array mask of comparisons
 */
export function gt(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const op = (x: number, y: number) => x > y;
  return compareImpl(a, b, op);
}

/**
 * Element-wise greater-than-or-equal comparison (with epsilon tolerance).
 * @param a Left operand
 * @param b Right operand or scalar
 * @returns Uint8Array mask of comparisons
 */
export function gte(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const op = (x: number, y: number) => x > y || Math.abs(x - y) < Number.EPSILON;
  return compareImpl(a, b, op);
}

/**
 * Element-wise equality comparison using `Number.EPSILON` tolerance.
 * @param a Left operand
 * @param b Right operand or scalar
 * @returns Uint8Array mask of equality tests
 */
export function eq(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const op = (x: number, y: number) => Math.abs(x - y) < Number.EPSILON;
  return compareImpl(a, b, op);
}
/**
 * Element-wise inequality comparison.
 * @param a Left operand
 * @param b Right operand or scalar
 * @returns Uint8Array mask where elements are not equal
 */
export function neq(a: ArrayLike<number>, b: ArrayLike<number> | number): Uint8Array{
  const op = (x: number, y: number) => x !== y;
  return compareImpl(a, b, op);
}

/**
 * Logical AND for boolean masks (Uint8Array) or with a scalar.
 * Returns a Uint8Array of 1/0 values.
 * @param a Left boolean mask
 * @param b Right boolean mask or scalar
 * @returns Uint8Array mask result
 */
export function and(a: Uint8Array, b: Uint8Array | number): Uint8Array {
  return compareImpl(a as ArrayLike<number>, b as ArrayLike<number> | number, (x, y) => (x !== 0) && (y !== 0));
}

/**
 * Logical OR for boolean masks (Uint8Array) or with a scalar.
 * Returns a Uint8Array of 1/0 values.
 * @param a Left boolean mask
 * @param b Right boolean mask or scalar
 * @returns Uint8Array mask result
 */
export function or(a: Uint8Array, b: Uint8Array | number): Uint8Array {
  return compareImpl(a as ArrayLike<number>, b as ArrayLike<number> | number, (x, y) => (x !== 0) || (y !== 0));
}

/**
 * Logical NOT for a boolean mask (Uint8Array).
 * @param a Input boolean mask
 * @returns Uint8Array mask with bits inverted
 */
export function not(a: Uint8Array): Uint8Array {
  const n = a.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = a[i] === 0 ? 1 : 0;
  }
  return out;
}