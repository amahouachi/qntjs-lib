import { describe, it, expect } from 'vitest';
import { dot, norm, ols, olsMulti } from '../src/math/linalg.js';

describe('Linear algebra utilities', () => {
  it('dot product basic', () => {
    expect(dot([1,2,3], [4,5,6])).toBe(32);
    expect(dot([1,2], [3])).toBe(3); // min length
  });

  it('norm handles empty and various p and skipna', () => {
    expect(Number.isNaN(norm([], 2))).toBe(true);

    // L2 norm without NaNs, fast path (skipna=false)
    expect(norm([3,4], 2, false)).toBeCloseTo(5);

    // L1 norm
    expect(norm([1,-2,3], 1, false)).toBeCloseTo(6);

    // L-infinity
    expect(norm([1,-7,3], Infinity, false)).toBeCloseTo(7);

    // general p
    expect(norm([1,2,2], 3, false)).toBeCloseTo(Math.pow(1 + 8 + 8, 1/3));

    // skipna=true ignores NaNs
    expect(norm([3,4,NaN], 2, true)).toBeCloseTo(5);

    // if all NaNs -> NaN
    expect(Number.isNaN(norm([NaN, NaN], 2, true))).toBe(true);
  });

  it('ols simple cases and edge conditions', () => {
    // Perfect fit y = 1 + 2*x
    const x = [1,2,3,4];
    const y = x.map(v => 1 + 2*v);
    const res = ols(x, y);
    expect(res.slope).toBeCloseTo(2);
    expect(res.intercept).toBeCloseTo(1);

    // denom zero: x constant
    const r2 = ols([1,1,1], [2,3,4]);
    expect(Number.isNaN(r2.slope)).toBe(true);

    // no valid pairs -> NaN
    const r3 = ols([NaN, NaN], [NaN, NaN]);
    expect(Number.isNaN(r3.slope)).toBe(true);
  });

  it('olsMulti solves linear system and handles singular/empty cases', () => {
    // X: single feature, m=3 observations; y = 1 + 2*x
    const X = [[1],[2],[3]];
    const y = [3,5,7];
    const coeffs = olsMulti(X, y);
    expect(coeffs).not.toBeNull();
    if (coeffs) {
      expect(coeffs[0]).toBeCloseTo(1); // intercept
      expect(coeffs[1]).toBeCloseTo(2); // slope
    }

    // empty design -> null
    expect(olsMulti([], [])).toBeNull();

    // singular XtX -> null (duplicate rows creating dependent columns)
    const Xsing = [[1,2],[1,2],[1,2]];
    const ysing = [3,3,3];
    expect(olsMulti(Xsing, ysing)).toBeNull();
  });
});
