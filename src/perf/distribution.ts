import { arr, stats } from '../index.js';

// Approximate inverse normal CDF (probit) using Peter J. Acklam's algorithm.
// Accurate to about 1e-9 for double precision.
function normInv(p: number): number {
  // Coefficients in rational approximations
  const a1 = -3.969683028665376e+01;
  const a2 = 2.209460984245205e+02;
  const a3 = -2.759285104469687e+02;
  const a4 = 1.383577518672690e+02;
  const a5 = -3.066479806614716e+01;
  const a6 = 2.506628277459239e+00;

  const b1 = -5.447609879822406e+01;
  const b2 = 1.615858368580409e+02;
  const b3 = -1.556989798598866e+02;
  const b4 = 6.680131188771972e+01;
  const b5 = -1.328068155288572e+01;

  const c1 = -7.784894002430293e-03;
  const c2 = -3.223964580411365e-01;
  const c3 = -2.400758277161838e+00;
  const c4 = -2.549732539343734e+00;
  const c5 = 4.374664141464968e+00;
  const c6 = 2.938163982698783e+00;

  const d1 = 7.784695709041462e-03;
  const d2 = 3.224671290700398e-01;
  const d3 = 2.445134137142996e+00;
  const d4 = 3.754408661907416e+00;

  // Define break-points
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r;
  let result: number;

  if (p < pLow) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    result = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
             ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    return -result;
  }

  if (p <= pHigh) {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    result = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
             (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    return result;
  }

  // Rational approximation for upper region
  q = Math.sqrt(-2 * Math.log(1 - p));
  result = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
           ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  return result;
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Historical VaR: empirical quantile at level alpha (left-tail).
/**
 * Value-at-Risk (VaR) estimator.
 * Supports `historical` (empirical quantile) and `parametric` (normal) methods.
 * Returns NaN for empty inputs or invalid alpha or when parametric stats are invalid.
 * @param returns Array-like returns series
 * @param alpha Tail probability (default 0.05)
 * @param method 'historical' | 'parametric' (default 'historical')
 * @returns VaR as a number (left-tail) or NaN
 */
export function valueAtRisk(
  returns: ArrayLike<number>,
  alpha: number = 0.05,
  method: 'historical' | 'parametric' = 'historical'
): number {
  const n = returns.length;
  if (n === 0) return NaN;
  if (alpha <= 0 || alpha >= 1) return NaN;

  if (method === 'historical') {
    const clean = arr.dropna(returns);
    if (clean.length === 0) return NaN;
    return stats.quantile(clean, alpha);
  }

  // parametric normal
  const mu = stats.mean(returns);
  const sigma = stats.stdev(returns);
  if (!(mu === mu) || !(sigma === sigma) || sigma === 0) return NaN;
  const z = normInv(alpha);
  return mu + sigma * z;
}

/**
 * Expected shortfall (conditional tail expectation) estimator.
 * Supports `historical` (empirical mean of losses <= VaR) and `parametric` (normal) methods.
 * Returns NaN for empty inputs, invalid alpha, or invalid parametric stats.
 * @param returns Array-like returns series
 * @param alpha Tail probability (default 0.05)
 * @param method 'historical' | 'parametric' (default 'historical')
 * @returns Expected shortfall (left-tail) or NaN
 */
export function expshortfall(
  returns: ArrayLike<number>,
  alpha: number = 0.05,
  method: 'historical' | 'parametric' = 'historical'
): number {
  const n = returns.length;
  if (n === 0) return NaN;
  if (alpha <= 0 || alpha >= 1) return NaN;

  if (method === 'historical') {
    const clean = arr.dropna(returns);
    if (clean.length === 0) return NaN;
    const vaR = stats.quantile(clean, alpha);
    // mean of losses at or below VaR
    let sumLoss = 0;
    let count = 0;
    for (let i = 0; i < clean.length; i++) {
      const r = clean[i];
      if (r <= vaR) { sumLoss += r; count++; }
    }
    return sumLoss / count;
  }

  // parametric normal: ES = mu - sigma * phi(z) / alpha  (for left tail)
  const mu = stats.mean(returns);
  const sigma = stats.stdev(returns);
  if (!(mu === mu) || !(sigma === sigma) || sigma === 0) return NaN;
  const z = normInv(alpha);
  const es = mu - sigma * (normPdf(z) / alpha);
  return es;
}

/**
 * Tail ratio: mean of upper tail divided by absolute mean of lower tail.
 * Returns NaN for empty inputs, invalid alpha, or when either tail has no observations or lower mean is zero.
 * @param returns Array-like returns series
 * @param alpha Tail probability (default 0.05)
 * @returns Tail ratio or NaN
 */
export function tail(returns: ArrayLike<number>, alpha: number = 0.05): number {
  const n = returns.length;
  if (n === 0) return NaN;
  if (alpha <= 0 || alpha >= 1) return NaN;

  const clean = arr.dropna(returns);
  if (clean.length === 0) return NaN;

  const lowThresh = stats.quantile(clean, alpha);
  const highThresh = stats.quantile(clean, 1 - alpha);
  let lowSum = 0;
  let lowCount = 0;
  let highSum = 0;
  let highCount = 0;
  for (let i = 0; i < clean.length; i++) {
    const r = clean[i];
    if (r <= lowThresh) { lowSum += r; lowCount++; }
    if (r >= highThresh) { highSum += r; highCount++; }
  }
  
  const lowMean = lowSum / lowCount;
  const highMean = highSum / highCount;
  if (lowMean === 0) return NaN;
  return highMean / Math.abs(lowMean);
}

// Omega ratio: sum of gains above threshold divided by sum of losses below threshold
/**
 * Omega ratio: sum of gains above `requiredReturn` divided by sum of losses below it.
 * Returns NaN for empty inputs or when there is no variation (all gains or all losses zero).
 * @param returns Array-like returns series
 * @param requiredReturn Threshold for gains/losses (default 0)
 * @returns Omega ratio number, Infinity if no losses, or NaN when no variation
 */
export function omega(
  returns: ArrayLike<number>,
  requiredReturn: number = 0
): number {
  const n = returns.length;
  if (n === 0) return NaN;

  const clean = arr.dropna(returns);
  if (clean.length === 0) return NaN;

  let sumPos = 0;
  let sumNeg = 0;
  for (let i = 0; i < clean.length; i++) {
    const r = clean[i];
    const dev = r - requiredReturn;
    if (dev > 0) sumPos += dev;
    else sumNeg += -dev; // positive magnitude of losses
  }
  if (sumNeg === 0) {
    if (sumPos === 0) return NaN; // no variation
    return Infinity;
  }
  return sumPos / sumNeg;
}

export default {
  valueAtRisk,
  expectedShortfall: expshortfall,
  tailRatio: tail,
  omegaRatio: omega
};
