/**
 * Compute simple period returns from a level series.
 * For each i>0: returns[i] = source[i]/source[i-1] - 1 when both values are finite and previous != 0.
 * The first element is always NaN. Invalid or non-finite inputs produce NaN at that position.
 * @param source Input level series (prices/equity)
 * @returns Float32Array of simple returns (same length as `source`)
 */
export function returns(source: ArrayLike<number>): Float32Array {
  const n = source.length;
  if (n === 0) return new Float32Array(0);
  const out = new Float32Array(n);
  out[0] = NaN;

  for (let i = 1; i < n; i++) {
    const a = source[i];
    const b = source[i - 1];
    if (a === a && b === b && b !== 0) {
      out[i] = a / b - 1;
    } else {
      out[i] = NaN;
    }
  }
  return out;
}

/**
 * Compute log returns from a level series.
 * For each i>0: logreturns[i] = log(source[i]/source[i-1]) when both values are finite and previous>0.
 * The first element is always NaN. Invalid or non-positive previous values yield NaN.
 * @param source Input level series (prices/equity)
 * @returns Float32Array of log returns (same length as `source`)
 */
export function logreturns(source: ArrayLike<number>): Float32Array {
  const n = source.length;
  if (n === 0) return new Float32Array(0);
  const out = new Float32Array(n);
  out[0] = NaN; // first element has no previous value

  for (let i = 1; i < n; i++) {
    const a = source[i];
    const b = source[i - 1];
    if (a === a && b === b && b > 0) {
      out[i] = Math.log(a / b);
    } else {
      out[i] = NaN;
    }
  }
  return out;
}

/**
 * Compute cumulative compound returns from a returns series, skipping NaNs.
 * Cumulative return at i is prod_{j<=i, r_j finite} (1+r_j) - 1; NaN inputs leave an output NaN at that position.
 * @param returns Simple returns series
 * @returns Float64Array of cumulative returns
 */
export function cumreturns(returns: ArrayLike<number>): Float64Array {
  const n = returns.length;
  if (n === 0) return new Float64Array(0);
  const out = new Float64Array(n);

  let prod = 1;
  for (let i = 0; i < n; i++) {
    const r = returns[i];
    if (r === r) {
      prod *= (1 + r);
      out[i] = prod - 1;
    } else {
      // skip NaN: leave prod unchanged but mark output as NaN
      out[i] = NaN;
    }
  }
  return out;
}

/**
 * Compute the compound annual growth rate (CAGR) from a returns series.
 * Ignores NaNs. `freq` is the number of periods per year (default 252).
 * @param returns Simple returns series
 * @param freq Periods per year (default 252)
 * @returns CAGR as a number, or NaN when insufficient data
 */
export function cagr(returns: ArrayLike<number>, freq: number = 252): number {
  const n = returns.length;
  if (n === 0) return NaN;

  let prod = 1;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const r = returns[i];
    if (r === r) {
      prod *= (1 + r);
      count++;
    }
  }

  if (count === 0) return NaN;
  return Math.pow(prod, freq / count) - 1;
}

/**
 * Aggregate irregular (event-aligned) returns into calendar-day returns.
 *
 * The function groups `returnsArr` by calendar day (optionally shifted by `tzOffsetMinutes`),
 * compounds returns within each day (prod(1+r)-1) and returns a continuous range of days
 * from the minimum to the maximum observed day. Missing days are filled with zero returns.
 *
 * @param tsMs Array of timestamps (ms since epoch) aligned to `returnsArr`
 * @param returnsArr Array of simple returns aligned to `tsMs`
 * @param tzOffsetMinutes Optional timezone offset in minutes (default 0, UTC)
 * @returns Object { days: number[], dailyReturns: Float32Array }
 */
export function dailyreturns(tsMs: ArrayLike<number>, returnsArr: ArrayLike<number>, tzOffsetMinutes = 0) {
  const n = Math.min(tsMs.length, returnsArr.length);
  if (n === 0) return { days: [], dailyReturns: new Float32Array(0) };

  const DAY = 24 * 60 * 60 * 1000;
  const offset = tzOffsetMinutes * 60 * 1000;

  // map dayKey -> compounded product and count
  const map = new Map<number, { prod: number; count: number }>();

  for (let i = 0; i < n; i++) {
    const t = Number(tsMs[i]);
    const r = Number(returnsArr[i]);
    if (!Number.isFinite(t)) continue;
    // skip NaN returns
    if (!(r === r)) continue;
    const dayKey = Math.floor((t + offset) / DAY);
    const cur = map.get(dayKey);
    if (cur) {
      cur.prod *= (1 + r);
      cur.count += 1;
    } else {
      map.set(dayKey, { prod: 1 + r, count: 1 });
    }
  }

  // determine continuous range of day keys from min -> max and fill missing with zero
  const keys = Array.from(map.keys()).sort((a, b) => a - b);
  if (keys.length === 0) return { days: [], dailyReturns: new Float32Array(0) };
  const minK = keys[0];
  const maxK = keys[keys.length - 1];
  const len = maxK - minK + 1;
  const days: number[] = new Array(len);
  const out = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const k = minK + i;
    days[i] = k * DAY - offset;
    const obj = map.get(k);
    if (obj) out[i] = obj.prod - 1;
    else out[i] = 0; // fill missing days with zero return
  }

  return { days, dailyReturns: out };
}