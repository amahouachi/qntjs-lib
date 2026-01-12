import { shouldSkipDenseOptimization } from "../ta/util.js";
import { havena } from "../arr/arr.js";

/**
 * Variance: compute a single variance over the whole series, dropping NaNs.
 * Uses `ddof` (delta degrees of freedom) like NumPy/pandas: denominator = N - ddof.
 * Default pandas behavior is sample variance (ddof=1), so the default here is ddof=1.
 */
export function variance(source: ArrayLike<number>, options: { ddof?: number, skipna?: boolean } = { ddof: 1, skipna: true }): number {
  const ddof = options?.ddof ?? 1;
  let skipna = options?.skipna ?? true;

  const n = source.length;
  let sum = 0;
  let sumSq = 0;
  let cnt = 0;

  if (!skipna) {
    cnt = n;
    for (let i = 0; i < n; i++) {
      const v = source[i];
      { sum += v; sumSq += v * v; }
    }
  } else {
    if (!shouldSkipDenseOptimization() && skipna && !havena(source)) {
      // fast-path: no NaNs
      skipna = false;
    }
    for (let i = 0; i < n; i++) {
      const v = source[i];
      if (v === v) { sum += v; sumSq += v * v; cnt++; }
    }
  }
  if (cnt === 0) return NaN;
  const mean = sum / cnt;

  if (ddof < 0 || !Number.isFinite(ddof)) throw new Error('ddof must be a finite non-negative number');

  const denom = cnt - ddof;
  if (denom <= 0) return NaN;

  // Numerator: sumsq - N * mean^2
  return (sumSq - cnt * mean * mean) / denom;
}
/**
 * Standard deviation: compute a single standard deviation over the whole series, dropping NaNs.
 * Uses `ddof` (delta degrees of freedom) like NumPy/pandas: denominator = N - ddof.
 * Default pandas behavior is sample standard deviation (ddof=1), so the default here is ddof=1.
 */
export function stdev(source: ArrayLike<number>, options: { ddof?: number, skipna?: boolean } = { ddof: 1, skipna: true }): number {
  const v = variance(source, options);
  return Math.sqrt(v);
}

/**
 * Pairwise covariance: cov(X,Y) = E[XY] - E[X]E[Y]
 */
export function covar(x: ArrayLike<number>, y: ArrayLike<number>, options: { ddof?: number } = { ddof: 1 }): number {
  // pandas.Series.cov(other) computes the covariance over the whole
  // pairwise-aligned series, dropping any pairs where either value is NaN.
  // Default pandas ddof=1 (sample/unbiased covariance) so the default here is ddof=1.
  if (x.length !== y.length) throw new Error('x and y must have same length');
  const n = x.length;
  const ddof = options?.ddof ?? 1;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let valid = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    if (xi === xi && yi === yi) {
      sumX += xi;
      sumY += yi;
      sumXY += xi * yi;
      valid++;
    }
  }
  if (valid === 0) return NaN;
  const meanX = sumX / valid;
  const meanY = sumY / valid;

  if (ddof < 0 || !Number.isFinite(ddof)) throw new Error('ddof must be a finite non-negative number');

  const denom = valid - ddof;
  if (denom <= 0) return NaN;
  return (sumXY - valid * meanX * meanY) / denom;
}



// Dense fast path: assumes no NaNs in src
function rollvarianceDense(src: ArrayLike<number>, period: number, ddof: number): Float64Array {
  const n = src.length;
  const out = new Float64Array(n);
  out.fill(NaN);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out;

  let sum = 0;
  let sumsq = 0;
  // initialize window
  for (let i = 0; i < period; i++) {
    const v = src[i];
    sum += v;
    sumsq += v * v;
  }
  {
    const count = period;
    const denom = count - ddof;
    if (denom > 0) {
      const mean = sum / count;
      out[period - 1] = (sumsq - count * mean * mean) / denom;
    } else {
      out[period - 1] = NaN;
    }
  }

  for (let i = period; i < n; i++) {
    const vNew = src[i];
    const vOld = src[i - period];
    sum += vNew - vOld;
    sumsq += vNew * vNew - vOld * vOld;
    const count = period;
    const denom = count - ddof;
    if (denom > 0) {
      const mean = sum / count;
      out[i] = (sumsq - count * mean * mean) / denom;
    } else {
      out[i] = NaN;
    }
  }
  return out;
}

/**
 * Rolling variance over a sliding window. Accepts `{ skipna?, ddof? }`.
 * @param source Input array
 * @param period Window length (>0)
 * @param options Optional `{ skipna?, ddof? }`
 * @returns Float64Array of rolling variances
 */
export function rollvar(source: ArrayLike<number>, period: number, options: { skipna?: boolean, ddof?: number } = { skipna: true, ddof: 1 }): Float64Array {
  // This duplicate declaration is intentionally a thin wrapper in case the
  // code previously used a local helper; keep existing implementation below.
  let skipna = options.skipna ?? true;
  let ddof = options.ddof ?? 1;

  if (skipna) {
    if (!shouldSkipDenseOptimization()) {
      if (!havena(source)) {
        return rollvarianceDense(source, period, ddof);
      }
    }
    return rollvarianceNanAware(source, period, ddof);
  }
  return rollvarianceDense(source, period, ddof);
}

// NaN-aware incremental sliding variance: ignores NaNs inside window
function rollvarianceNanAware(src: ArrayLike<number>, period: number, ddof: number): Float64Array {
  const n = src.length;
  const out = new Float64Array(n);
  out.fill(NaN);
  if (period <= 0) throw new Error('period must be positive');
  if (n < period) return out;

  // Track running sum, sum of squares and count of valid (non-NaN) samples
  let sum = 0, sumsq = 0, count = 0;
  for (let i = 0; i < period; i++) {
    const v = src[i];
    if (v === v) { sum += v; sumsq += v * v; count++; }
  }
  {
    const denom = count - ddof;
    out[period - 1] = denom > 0 ? (sumsq - count * (sum / count) * (sum / count)) / denom : NaN;
  }

  for (let i = period; i < n; i++) {
    const vNew = src[i];
    const vOld = src[i - period];
    if (vNew === vNew) { sum += vNew; sumsq += vNew * vNew; count++; }
    if (vOld === vOld) { sum -= vOld; sumsq -= vOld * vOld; count--; }
    const denom = count - ddof;
    out[i] = denom > 0 ? (sumsq - count * (sum / count) * (sum / count)) / denom : NaN;
  }
  return out;
}

export function rollcovar(x: ArrayLike<number>, y: ArrayLike<number>, period: number, options: { ddof?: number } = { ddof: 1 }): Float64Array {
  const ddof = options?.ddof ?? 1;
  if (x.length !== y.length) throw new Error('x and y must have same length');
  // Track running sums and count of valid (non-NaN paired) samples
  const n = x.length;
  const out = new Float64Array(n);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let count = 0;
  for (let i = 0; i < period; i++) {
    const xi = x[i];
    const yi = y[i];
    if (xi === xi && yi === yi) {
      sumX += xi;
      sumY += yi;
      sumXY += xi * yi;
      count++;
    }
  }

  const minCount = ddof + 1;
  if (count >= minCount) {
    const invC = 1 / count;
    const meanX = sumX * invC;
    const meanY = sumY * invC;
    const denom = count - ddof;
    out[period - 1] = denom > 0 ? (sumXY - count * meanX * meanY) / denom : NaN;
  } else {
    out[period - 1] = NaN;
  }

  for (let i = period; i < n; i++) {
    const xNew = x[i];
    const yNew = y[i];
    const xOld = x[i - period];
    const yOld = y[i - period];

    if (xNew === xNew && yNew === yNew) {
      sumX += xNew;
      sumY += yNew;
      sumXY += xNew * yNew;
      count++;
    }
    if (xOld === xOld && yOld === yOld) {
      sumX -= xOld;
      sumY -= yOld;
      sumXY -= xOld * yOld;
      count--;
    }

    const minCount2 = ddof + 1;
    if (count >= minCount2) {
      const invC = 1 / count;
      const meanX = sumX * invC;
      const meanY = sumY * invC;
      const denom = count - ddof;
      out[i] = denom > 0 ? (sumXY - count * meanX * meanY) / denom : NaN;
    } else {
      out[i] = NaN;
    }
  }
  return out;
} 

export function rollstdev(source: ArrayLike<number>, period: number, options: { skipna?: boolean, ddof?: number } = { skipna: true, ddof: 1 }): Float64Array {
  const v = rollvar(source, period, options);
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) {
    out[i] = Math.sqrt(v[i]);
  }
  return out;
}