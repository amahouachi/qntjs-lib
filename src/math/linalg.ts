// filepath: src/math/linalg.ts

/**
 * Dot product of two vectors: sum_i x[i] * y[i].
 * Operates up to the shorter length of the inputs.
 * @param x First vector
 * @param y Second vector
 * @returns Scalar dot product
 */
export function dot(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = Math.min(x.length, y.length);
  let s = 0;

  for (let i = 0; i < n; i++) {
    s += x[i] * y[i];
  }

  return s;
}

/**
 * Vector p-norm. Supports common p values (1, 2, Infinity) with a fast dense path.
 * When `skipna` is true the implementation ignores NaNs and returns NaN if no valid entries exist.
 * @param x Input vector
 * @param p Norm order (default 2)
 * @param skipna Whether to ignore NaNs (default true)
 * @returns Norm value or NaN
 */
export function norm(x: ArrayLike<number>, p: number = 2, skipna= true): number {
  const n = x.length;
  
  if (n === 0) {
    return NaN;
  }

  if (!skipna) {
    // Fast path: no NaN values
    if (p === 2) {
      // Optimized L2 norm (most common case)
      let s = 0;
      for (let i = 0; i < n; i++) {
        const v = x[i];
        s += v * v;
      }
      return Math.sqrt(s);
    } else if (p === 1) {
      // L1 norm
      let s = 0;
      for (let i = 0; i < n; i++) {
        s += Math.abs(x[i]);
      }
      return s;
    } else if (p === Infinity) {
      // L-infinity norm
      let m = 0;
      for (let i = 0; i < n; i++) {
        const av = Math.abs(x[i]);
        if (av > m) m = av;
      }
      return m;
    } else {
      // General case
      let s = 0;
      for (let i = 0; i < n; i++) {
        s += Math.pow(Math.abs(x[i]), p);
      }
      return Math.pow(s, 1 / p);
    }
  } else {
    // Slow path: has NaN values
    let s = 0;
    let cnt = 0;

    if (p === 2) {
      for (let i = 0; i < n; i++) {
        const v = x[i];
        if (v === v) {
          s += v * v;
          cnt++;
        }
      }
      if (cnt === 0) return NaN;
      return Math.sqrt(s);
    } else {
      for (let i = 0; i < n; i++) {
        const v = x[i];
        if (v === v) {
          s += Math.pow(Math.abs(v), p);
          cnt++;
        }
      }
      if (cnt === 0) return NaN;
      return Math.pow(s, 1 / p);
    }
  }
}

// Simple OLS for y = a + b*x
/**
 * Ordinary least squares for a simple linear model y = intercept + slope * x.
 * Ignores paired NaN entries and returns NaN coefficients if no valid pairs or singular design.
 * @param x Predictor values
 * @param y Response values
 * @returns Object with `intercept` and `slope` or NaNs on failure
 */
export function ols(x: ArrayLike<number>, y: ArrayLike<number>): { intercept: number; slope: number } {
  const n = Math.min(x.length, y.length);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let cnt = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];

    if (xi === xi && yi === yi) {
      sx += xi;
      sy += yi;
      sxx += xi * xi;
      sxy += xi * yi;
      cnt++;
    }
  }

  if (cnt === 0) {
    return { intercept: NaN, slope: NaN };
  }

  const denom = cnt * sxx - sx * sx;

  if (denom === 0) {
    return { intercept: NaN, slope: NaN };
  }

  const slope = (cnt * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / cnt;

  return { intercept, slope };
}

// OLS multi using normal equations (X: rows observations, columns features)
function _invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const M: number[][] = new Array(n);

  for (let i = 0; i < n; i++) {
    M[i] = A[i].slice();
  }

  const I: number[][] = new Array(n);

  for (let i = 0; i < n; i++) {
    I[i] = new Array(n).fill(0);
    I[i][i] = 1;
  }

  for (let i = 0; i < n; i++) {
    let pivot = i;

    for (let r = i; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) {
        pivot = r;
      }
    }

    if (Math.abs(M[pivot][i]) < 1e-12) {
      return null;
    }

    const tmpM = M[i];
    const tmpPivotM = M[pivot];
    M[i] = tmpPivotM;
    M[pivot] = tmpM;

    const tmpI = I[i];
    const tmpPivotI = I[pivot];
    I[i] = tmpPivotI;
    I[pivot] = tmpI;

    const div = M[i][i];

    for (let j = 0; j < n; j++) {
      M[i][j] /= div;
      I[i][j] /= div;
    }

    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = M[r][i];

        for (let c = 0; c < n; c++) {
          M[r][c] -= factor * M[i][c];
          I[r][c] -= factor * I[i][c];
        }
      }
    }
  }

  return I;
}

/**
 * Multiple linear regression using normal equations (adds intercept column internally).
 * Returns coefficient vector or null if the normal matrix is singular or inputs are empty.
 * @param X Design matrix (rows = observations, cols = features)
 * @param y Response vector
 * @returns Coefficient array [intercept, beta1, beta2, ...] or null
 */
export function olsMulti(X: number[][], y: number[]): number[] | null {
  const m = X.length;

  if (m === 0) {
    return null;
  }

  const p = X[0].length;
  const cols = p + 1;
  const XtX: number[][] = Array.from({ length: cols }, function() { return new Array(cols).fill(0); });
  const Xty: number[] = new Array(cols).fill(0);

  for (let i = 0; i < m; i++) {
    const row = X[i];
    const yi = y[i];
    const xi: number[] = [1];

    for (let j = 0; j < p; j++) {
      xi.push(row[j]);
    }

    for (let a = 0; a < cols; a++) {
      for (let b = 0; b < cols; b++) {
        XtX[a][b] += xi[a] * xi[b];
      }
    }

    for (let a = 0; a < cols; a++) {
      Xty[a] += xi[a] * yi;
    }
  }

  const inv = _invertMatrix(XtX);

  if (!inv) {
    return null;
  }

  const coeffs = new Array(cols).fill(0);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      coeffs[i] += inv[i][j] * Xty[j];
    }
  }

  return coeffs;
}
