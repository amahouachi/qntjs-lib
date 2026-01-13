import { math, stats, arr } from '../index.js';

/**
 * Compute the (annualized) Sharpe ratio for a returns series.
 * Uses NaN-aware mean and sample standard deviation (ddof=1).
 * Returns NaN for empty input, zero or NaN volatility, or invalid mean.
 * @param returns Array-like returns series
 * @param riskFree Annualized risk-free rate (default 0)
 * @param freq Periods per year (default 252)
 * @returns Sharpe ratio (annualized) or NaN
 */
export function sharpe(
  returns: ArrayLike<number>,
  riskFree: number = 0,
  freq: number = 252
): number {
  const n = returns.length;
  if (n === 0) return NaN;

  const rfPerPeriod = riskFree / freq;
  // use math.sub and math.mean to compute excess mean (NaN-aware)
  const excess = math.sub(returns, rfPerPeriod);
  const mu = stats.mean(excess); // skipna=true by default
  if (!(mu === mu)) return NaN;

  // use math.stdev which defaults to unbiased/sample (ddof=1)
  const sigma = stats.stdev(excess, { ddof: 1, skipna: true });
  if (sigma === 0 || !(sigma === sigma)) return NaN;
  return (mu * Math.sqrt(freq)) / sigma;
}

/**
 * Compute the (annualized) Sortino ratio for a returns series.
 * Uses downside deviation (sample corrected) computed over negative excess returns.
 * Requires at least two downside observations; returns NaN otherwise.
 * @param returns Array-like returns series
 * @param requiredReturn Target return to define downside (default 0)
 * @param freq Periods per year (default 252)
 * @param minPeriod Minimum valid periods (unused for scalar Sortino)
 * @returns Sortino ratio (annualized) or NaN
 */
export function sortino(
  returns: ArrayLike<number>,
  requiredReturn: number = 0,
  freq: number = 252,
  minPeriod: number = 1
): number {
  const n = returns.length;
  if (n === 0) return NaN;

  const reqPerPeriod = requiredReturn / freq;

  // use math.sub and math.mean for average downside-adjusted return
  const excess = math.sub(returns, reqPerPeriod);
  const mu = stats.mean(excess);
  if (!(mu === mu)) return NaN;

  // compute downside squares and count
  let m2 = 0;
  let downCount = 0;
  for (let i = 0; i < n; i++) {
    const r = excess[i];
    if (r === r && r < 0) {
      m2 += r * r;
      downCount++;
    }
  }
  if (downCount < 2) return NaN;
  const downside = Math.sqrt(m2 / (downCount - 1));
  return (mu * Math.sqrt(freq)) / downside;
}

/**
 * Rolling Sharpe ratio computed over a trailing window.
 * Output is a Float64Array aligned with `returns`; positions before enough data are NaN.
 * @param returns Array-like returns series
 * @param window Rolling window length
 * @param riskFree Annualized risk-free rate (default 0)
 * @param freq Periods per year (default 252)
 * @param minPeriod Minimum number of valid samples required per window (default 1)
 * @returns Float64Array of rolling Sharpe ratios
 */
export function rollsharpe(
  returns: ArrayLike<number>,
  window: number,
  riskFree: number = 0,
  freq: number = 252,
  minPeriod: number = 1
): Float64Array {
  const n = returns.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const rfPerPeriod = riskFree / freq;

  // build excess returns array and a valid mask for counts
  const excess = math.sub(returns, rfPerPeriod);
  const validMask = arr.notna(excess);

  const means = stats.rollmean(excess, window);
  const stdpop = stats.rollstdev(excess, window, { skipna: true, ddof: 0 }); // population rolling std (ddof=0)
  const counts = math.rollsum(validMask, window); // rolling counts of valid samples
  for (let i = 0; i < n; i++) {
    const c = counts[i];
    if (!(c === c) || c < minPeriod) { out[i] = NaN; continue; }
    // need sample (ddof=1) adjustment: var_sample = var_pop * (n/(n-1))
    if (c <= 1) { out[i] = NaN; continue; }
    const sigma = stdpop[i] * Math.sqrt(c / (c - 1));
    const mu = means[i];
    if (!(sigma === sigma) || sigma === 0 || !(mu === mu)) { out[i] = NaN; continue; }
    out[i] = (mu * Math.sqrt(freq)) / sigma;
  }
  return out;
}

/**
 * Rolling Sortino ratio computed over a trailing window using downside deviations.
 * Outputs NaN where insufficient downside or invalid data exists.
 * @param returns Array-like returns series
 * @param window Rolling window length
 * @param requiredReturn Target return to define downside (default 0)
 * @param freq Periods per year (default 252)
 * @param minPeriod Minimum number of valid samples required per window (default 1)
 * @returns Float64Array of rolling Sortino ratios
 */
export function rollsortino(
  returns: ArrayLike<number>,
  window: number,
  requiredReturn: number = 0,
  freq: number = 252,
  minPeriod: number = 1
): Float64Array {
  const n = returns.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const reqPerPeriod = requiredReturn / freq;

  // build excess returns and negative-only arrays plus masks
  const excess = math.sub(returns, reqPerPeriod);
  // build negOnly by copying excess and zeroing non-negative entries to NaN
  const negOnly = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = excess[i];
    negOnly[i] = (v === v && v < 0) ? v : NaN;
  }
  const negMask = arr.notna(negOnly);

  const means = stats.rollmean(excess, window);
  const stdpopNeg = stats.rollstdev(negOnly, window, { skipna: true, ddof: 0 }); // population rolling std on negatives (ddof=0)
  const negCounts = math.rollsum(negMask, window);
  for (let i = 0; i < n; i++) {
    const c = negCounts[i];
    const total = means[i];
    if (!(c === c) || !(total === total) || c < 2) { out[i] = NaN; continue; }
    // sample adjustment for downside deviation
    const downside = stdpopNeg[i] * Math.sqrt(c / (c - 1));
    if (!(downside === downside) || downside === 0) { out[i] = NaN; continue; }
    out[i] = (total * Math.sqrt(freq)) / downside;
  }
  return out;
}

// Annualized volatility (sample stddev) of returns
/**
 * Annualized volatility (sample standard deviation) of returns.
 * Uses NaN-aware `stats.stdev` with ddof=1. Returns NaN for empty input or zero/NaN sigma.
 * @param returns Array-like returns series
 * @param freq Periods per year (default 252)
 * @returns Annualized volatility or NaN
 */
export function vol(returns: ArrayLike<number>, freq: number = 252): number {
  const n = returns.length;
  if (n === 0) return NaN;
  // use sample standard deviation (ddof=1), NaN-aware
  const sigma = stats.stdev(returns, { ddof: 1, skipna: true });
  if (!(sigma === sigma) || sigma === 0) return NaN;
  return sigma * Math.sqrt(freq);
}

// Rolling annualized volatility (sample stddev) over a window
/**
 * Rolling annualized volatility (sample stddev) over a trailing window.
 * Outputs NaN for windows with insufficient valid samples or zero/NaN sigma.
 * @param returns Array-like returns series
 * @param window Rolling window length
 * @param freq Periods per year (default 252)
 * @param minPeriod Minimum number of valid samples required per window (default 1)
 * @returns Float64Array of rolling volatilities
 */
export function rollvol(
  returns: ArrayLike<number>,
  window: number,
  freq: number = 252,
  minPeriod: number = 1
): Float64Array {
  const n = returns.length;
  const out = new Float64Array(n);
  if (n === 0) return out;

  const stdpop = stats.rollstdev(returns, window, { skipna: true, ddof: 0 }); // population rolling std
  const counts = math.rollsum(arr.notna(returns), window);

  for (let i = 0; i < n; i++) {
    const c = counts[i];
    if (!(c === c) || c < minPeriod) { out[i] = NaN; continue; }
    if (c <= 1) { out[i] = NaN; continue; }
    const sigma = stdpop[i] * Math.sqrt(c / (c - 1)); // sample adjustment
    if (!(sigma === sigma) || sigma === 0) { out[i] = NaN; continue; }
    out[i] = sigma * Math.sqrt(freq);
  }
  return out;
}
