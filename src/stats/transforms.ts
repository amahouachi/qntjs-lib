import { covar, rollcovar, rollstdev, stdev } from './var.js';
import { mean } from './mean.js';
import { quantile } from './quantile.js';
import { shouldSkipDenseOptimization } from '../ta/util.js';
import { havena } from '../arr/arr.js';


/**
 * Compute z-scores for `source`: (x - mean) / std (ddof=1). NaNs preserved.
 * @param source Input array
 * @param options Optional `{ skipna? }` to ignore NaNs
 * @returns Float64Array of z-scores
 */
export function zscore(source: ArrayLike<number>, skipna: boolean = true): Float64Array{
  const n = source.length;
  const out = new Float64Array(n);
  
  if (n === 0) {
    return out;
  }

  if (!shouldSkipDenseOptimization() && skipna) {
    if (!havena(source)) skipna = false;
  }

  const m = mean(source, { skipna });
  const sd = stdev(source, { ddof: 1, skipna });

  if (sd === 0 || sd !== sd) {
    out.fill(NaN);
    return out;
  }

  for (let i = 0; i < n; i++) {
    out[i] = (source[i] - m) / sd;
  }

  return out;
}

/**
 * Normalize to [0,1] by min/max scaling. Preserves NaNs when `skipna` is true.
 * @param source Input array
 * @param options Optional `{ skipna? }`
 * @returns Float64Array of normalized values
 */
export function norminmax(source: ArrayLike<number>, skipna: boolean = true): Float64Array {
  const n = source.length;
  const out = new Float64Array(n);

  if (n === 0) {
    return out;
  }

  if (!skipna) {
    // Fast path: no NaN values
    let mn = source[0];
    let mx = source[0];

    for (let i = 1; i < n; i++) {
      const v = source[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }

    if (mx === mn) {
      out.fill(NaN);
      return out;
    }

    const range = mx - mn;
    for (let i = 0; i < n; i++) {
      out[i] = (source[i] - mn) / range;
    }

    return out;
  } else {
    // Slow path: has NaN values
    let mn = Infinity;
    let mx = -Infinity;

    for (let i = 0; i < n; i++) {
      const v = source[i];
      if (v === v) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }

    if (!(mn === mn) || !(mx === mx) || mx === mn) {
      out.fill(NaN);
      return out;
    }

    const range = mx - mn;
    for (let i = 0; i < n; i++) {
      const v = source[i];
      out[i] = (v === v) ? (v - mn) / range : NaN;
    }

    return out;
  }
}

/**
 * Pearson correlation between `x` and `y`. When `skipna` is true only
 * pairwise-valid entries are used; otherwise a dense fast-path is taken.
 * @param x First input array
 * @param y Second input array
 * @param options Optional `{ skipna? }`
 * @returns Correlation coefficient or NaN
 */
export function corr(x: ArrayLike<number>, y: ArrayLike<number>, skipna: boolean = true): number {
  if (x.length !== y.length) throw new Error('x and y must have same length');
  const n = x.length;
  
  if (n === 0) {
    return NaN;
  }

  if (!shouldSkipDenseOptimization() && skipna) {
    if (!havena(x, y)) skipna = false;
  }

  if (!skipna) {
    // Fast path: no NaN values, no need to check on every iteration
    let sx = 0;
    let sy = 0;

    for (let i = 0; i < n; i++) {
      sx += x[i];
      sy += y[i];
    }

    const mx = sx / n;
    const my = sy / n;
    let cov = 0;
    let vx = 0;
    let vy = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx;
      const dy = y[i] - my;
      cov += dx * dy;
      vx += dx * dx;
      vy += dy * dy;
    }

    if (vx === 0 || vy === 0) {
      return NaN;
    }

    return cov / Math.sqrt(vx * vy);
  } else {
    // NaN-aware path: compute covariance and standard deviations using
    // only pairwise-valid entries so denominators align.
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    let valid = 0;

    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      if (xi === xi && yi === yi) {
        sumX += xi;
        sumY += yi;
        sumXY += xi * yi;
        sumX2 += xi * xi;
        sumY2 += yi * yi;
        valid++;
      }
    }

    if (valid === 0) return NaN;

    const ddofLocal = 1;
    if (ddofLocal < 0 || !Number.isFinite(ddofLocal)) throw new Error('ddof must be a finite non-negative number');
    const denom = valid - ddofLocal;
    if (denom <= 0) return NaN;

    const meanX = sumX / valid;
    const meanY = sumY / valid;
    const cov = (sumXY - valid * meanX * meanY) / denom;
    const varX = (sumX2 - valid * meanX * meanX) / denom;
    const varY = (sumY2 - valid * meanY * meanY) / denom;

    if (varX === 0 || varY === 0) return NaN;

    return cov / Math.sqrt(varX * varY);
  }
}

/**
 * Rolling Pearson correlation computed from rolling covariance and stddev.
 * Supports alignment modes via `options.outLength` ('min' or 'max').
 * @param x First input array
 * @param y Second input array
 * @param period Window length
 * @param options Optional `{ skipna?, outLength? }`
 * @returns Float64Array of rolling correlations
 */
export function rollcorr(x: ArrayLike<number>, y: ArrayLike<number>, period: number, options?: { skipna?: boolean, outLength?: 'min' | 'max' }): Float64Array {
  // Align input lengths according to options.outLength (default 'min').
  const mode = options?.outLength ?? 'min';
  const desiredLen = mode === 'max' ? Math.max(x.length, y.length) : Math.min(x.length, y.length);
  const skipna = options?.skipna ?? true;

  // If both already same length and equal to desiredLen, operate directly for speed
  let xs: Float64Array;
  let ys: Float64Array;
  if (x.length === desiredLen && y.length === desiredLen) {
    // coerce to Float64Array view if needed
    xs = (x instanceof Float64Array) ? x : Float64Array.from(x as ArrayLike<number>);
    ys = (y instanceof Float64Array) ? y : Float64Array.from(y as ArrayLike<number>);
  } else {
    // build aligned arrays: copy existing values, pad with NaN when overflowing
    xs = new Float64Array(desiredLen);
    ys = new Float64Array(desiredLen);
    for (let i = 0; i < desiredLen; i++) {
      xs[i] = (i < x.length) ? (x[i] as number) : NaN;
      ys[i] = (i < y.length) ? (y[i] as number) : NaN;
    }
  }

  const cov = rollcovar(xs, ys, period);
  const stdX = rollstdev(xs, period, { skipna });
  const stdY = rollstdev(ys, period, { skipna });

  const out = new Float64Array(desiredLen);
  for (let i = 0; i < desiredLen; i++) {
    const stdProd = stdX[i] * stdY[i];
    if (stdProd > 1e-12) {
      out[i] = cov[i] / stdProd;
    } else {
      out[i] = NaN;
    }
  }

  return out;
}

/**
 * Winsorize values to the given lower and upper quantile bounds.
 * Preserves NaNs when `skipna` is true.
 * @param source Input array
 * @param options Optional `{ lower?, upper?, skipna? }` where bounds are in [0,1]
 * @returns Float64Array of winsorized values
 */
export function winsorize(source: ArrayLike<number>, options?: { lower?: number, upper?: number, skipna?: boolean }): Float64Array {
  let lower = options?.lower ?? 0.05;
  let upper = options?.upper ?? 0.95;
  let skipna = options?.skipna ?? true;

  const n = source.length;
  const out = new Float64Array(n);

  if (n === 0) return out;

  if (lower < 0 || upper < 0 || lower > 1 || upper > 1 || lower > upper) {
    throw new Error('invalid quantile bounds');
  }

  if (!shouldSkipDenseOptimization() && skipna) {
    // fast-path detection: if there are no NaNs we can avoid per-element checks
    if (!havena(source)) skipna = false;
  }

  const lo = quantile(source, lower);
  const hi = quantile(source, upper);

  if (!(lo === lo) || !(hi === hi)) { // if either quantile is NaN, nothing to winsorize
    out.fill(NaN);
    return out;
  }

  if (!skipna) {
    // fast path: no NaNs present
    for (let i = 0; i < n; i++) {
      const v = source[i];
      if (v < lo) out[i] = lo;
      else if (v > hi) out[i] = hi;
      else out[i] = v;
    }
  } else {
    // slow path: preserve NaNs
    for (let i = 0; i < n; i++) {
      const v = source[i];
      if (!(v === v)) {
        out[i] = NaN;
      } else if (v < lo) {
        out[i] = lo;
      } else if (v > hi) {
        out[i] = hi;
      } else {
        out[i] = v;
      }
    }
  }

  return out;
}
