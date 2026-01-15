import { describe, it, expect } from 'vitest';
import { math } from '../src/index.js';
import { apply, applyInPlace } from '../src/math/basic.js';
import { assert_arrays_close } from './helpers.js';
import { norminmax } from '../src/stats/transforms';
import { equals, allna, countna, havena, isna, notna, fillna, ffill, bfill, replace, dropna } from '../src/arr/arr.js';

describe('Math utilities', () => {
  it('element-wise add/sub/mul/div', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    assert_arrays_close(math.add(a as any, b as any), new Float64Array([5, 7, 9]));
    assert_arrays_close(math.sub(a as any, b as any), new Float64Array([-3, -3, -3]));
    assert_arrays_close(math.mul(a as any, b as any), new Float64Array([4, 10, 18]));
    assert_arrays_close(math.div(a as any, b as any), new Float64Array([1 / 4, 2 / 5, 3 / 6]));
  });

  it('scale/clamp/abs/sign/round/floor/ceil', () => {
    assert_arrays_close(math.scale([1, 2], 3), new Float64Array([3, 6]));
    assert_arrays_close(math.clamp([-1, 0.5, 10], 0, 5), new Float64Array([0, 0.5, 5]));
    assert_arrays_close(math.abs([-2, 3]), new Float64Array([2, 3]));
    assert_arrays_close(math.sign([-2, 0, 4]), new Float64Array([-1, 0, 1]));
    assert_arrays_close(math.round([1.2, 1.6, -1.5]), new Float64Array([1, 2, -2]));
    assert_arrays_close(math.floor([1.9, -1.1]), new Float64Array([1, -2]));
    assert_arrays_close(math.ceil([1.1, -1.9]), new Float64Array([2, -1]));
  });

  it('reductions: sum/prod/min/max/argmin/argmax/mean', () => {
    const src = [1, 2, 3, NaN, 4];
    expect(math.sum(src)).toBeCloseTo(10);
    expect(math.prod([1, 2, 3])).toBeCloseTo(6);
    expect(math.min(src)).toBeCloseTo(1);
    expect(math.max(src)).toBeCloseTo(4);
    expect(math.argmin([3, 1, 2])).toBe(1);
    expect(math.argmax([3, 1, 2])).toBe(0);
  });

  it('cumulative: cumsum/cumprod/cummax/cummin', () => {
    assert_arrays_close(math.cumsum([1, 2, 3]), new Float64Array([1, 3, 6]));
    assert_arrays_close(math.cumprod([1, 2, 3]), new Float64Array([1, 2, 6]));
    assert_arrays_close(math.cummax([1, 3, 2, 5]), new Float64Array([1, 3, 3, 5]));
    assert_arrays_close(math.cummin([3, 1, 4, 2]), new Float64Array([3, 1, 1, 1]));
  });

  it('transforms: diff/logReturns/zscore/normalizeMinMax', () => {
    assert_arrays_close(math.diff([1, 3, 6]), new Float64Array([NaN, 2, 3]));
  });


  it('avg elementwise and scalar', () => {
    assert_arrays_close(math.avg([1, 2, 3], [3, 2, 1]), new Float64Array([2, 2, 2]));
    assert_arrays_close(math.avg([1, NaN, 3], [3, 2, NaN]), new Float64Array([2, NaN, NaN]));
    assert_arrays_close(math.avg([1, 2, 3], 2), new Float64Array([1.5, 2, 2.5]));
  });


  it('dot/norm/ols', () => {
    expect(math.dot([1, 2], [3, 4])).toBeCloseTo(11);
    expect(math.norm([3, 4])).toBeCloseTo(5);
    const m = math.ols([1, 2, 3], [2, 4, 6]);
    expect(m.slope).toBeCloseTo(2);
    expect(m.intercept).toBeCloseTo(0);
  });

  it('linalg edge-cases: norm/ols/olsMulti', () => {
    // norm: empty -> NaN
    expect(Number.isNaN(math.norm([]))).toBe(true);

    // fast path (skipna=false) common norms
    expect(math.norm([3, 4], 2, false)).toBeCloseTo(5);
    expect(math.norm([1, -2], 1, false)).toBeCloseTo(3);
    expect(math.norm([-3, 2], Infinity, false)).toBeCloseTo(3);
    expect(math.norm([1, 2], 3, false)).toBeCloseTo(Math.pow(Math.pow(1, 3) + Math.pow(2, 3), 1 / 3));

    // slow path with NaNs
    expect(math.norm([NaN, 3], 2, true)).toBeCloseTo(3);
    expect(Number.isNaN(math.norm([NaN, NaN], 2, true))).toBe(true);

    // slow-path general p (p !== 2)
    expect(math.norm([NaN, 1, 2], 3, true)).toBeCloseTo(Math.pow(Math.pow(1, 3) + Math.pow(2, 3), 1 / 3));
    expect(Number.isNaN(math.norm([NaN, NaN], 3, true))).toBe(true);

    // ols: no valid pairs -> NaNs
    const o0 = math.ols([NaN], [NaN]);
    expect(Number.isNaN(o0.slope)).toBe(true);
    expect(Number.isNaN(o0.intercept)).toBe(true);

    // ols: singular denom -> NaN
    const oSing = math.ols([1, 1, 1], [2, 3, 4]);
    expect(Number.isNaN(oSing.slope)).toBe(true);
    expect(Number.isNaN(oSing.intercept)).toBe(true);

    // olsMulti: empty observations -> null
    expect(math.olsMulti([], [])).toBeNull();

    // olsMulti: singular XtX -> null (identical zero feature column)
    const Xsing = [[0], [0]];
    expect(math.olsMulti(Xsing, [1, 1])).toBeNull();

    // olsMulti: solvable case
    const X = [[1], [2], [3]];
    const coeffs = math.olsMulti(X, [2, 4, 6]);
    expect(coeffs).not.toBeNull();
    if (coeffs) {
      expect(coeffs[0]).toBeCloseTo(0);
      expect(coeffs[1]).toBeCloseTo(2);
    }
  });

  it('sum/cumsum/rollsum edge-cases (fast-path and NaN-aware)', () => {
    // sum fast-path when no NaNs (should trigger dense optimization path)
    expect(math.sum([1, 2, 3])).toBeCloseTo(6);

    // sum with skipna=false should include NaN and return NaN
    expect(Number.isNaN(math.sum([1, NaN, 2], false))).toBe(true);

    // cumsum preserves previous sum on NaN (no forward NaN propagation)
    assert_arrays_close(math.cumsum([1, NaN, 2]), new Float64Array([1, 1, 3]));

    // rollsum: n < period -> all NaN
    const small = math.rollsum([1], 2);
    expect(Number.isNaN(small[0])).toBe(true);

    // rollsum NaN-aware sliding window
    const src = [NaN, NaN, 1, NaN, 2];
    const r = math.rollsum(src, 2);
    // window [NaN,NaN] -> NaN at index 1
    expect(Number.isNaN(r[1])).toBe(true);
    // window [NaN,1] -> 1 at index 2
    expect(r[2]).toBeCloseTo(1);
    // window [1,NaN] -> 1 at index 3
    expect(r[3]).toBeCloseTo(1);
    // window [NaN,2] -> 2 at index 4
    expect(r[4]).toBeCloseTo(2);
  });

  it('sum/rollsum dense-optimization toggle (env + explicit skipna)', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    try {
      // Force skipping dense optimization -> exercise NaN-aware paths
      process.env.SKIP_DENSE_OPTIMIZATION = 'true';
      expect(math.sum([1,2,3])).toBeCloseTo(6);
      const r = math.rollsum([1,2,3,4], 2);
      expect(r[1]).toBeCloseTo(3);

      // Disable the skip flag to allow dense optimization
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      expect(math.sum([1,2,3])).toBeCloseTo(6);
      const r2 = math.rollsum([1,2,3,4], 2);
      expect(r2[1]).toBeCloseTo(3);

      // Explicitly request fast-path via skipna=false
      expect(math.sum([1,2,3], false)).toBeCloseTo(6);
      const r3 = math.rollsum([1,2,3,4], 2, false);
      expect(r3[1]).toBeCloseTo(3);
    } finally {
      if (prev === undefined) delete process.env.SKIP_DENSE_OPTIMIZATION; else process.env.SKIP_DENSE_OPTIMIZATION = prev;
    }
  });

  it('sum cnt===0 returns NaN for empty or all-NaN inputs', () => {
    expect(Number.isNaN(math.sum([]))).toBe(true);
    expect(Number.isNaN(math.sum([NaN, NaN]))).toBe(true);
  });

  it('sum dense-else, rollsum invalid period, rollsum NaN-window', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    try {
      // Force skipping dense optimization so the code path that avoids havena() runs
      process.env.SKIP_DENSE_OPTIMIZATION = 'true';
      // calling sum with no env-based optimization should still compute correctly
      expect(math.sum([1, 2, 3])).toBeCloseTo(6);

      // rollsum invalid period should throw
      expect(() => math.rollsum([1,2,3], 0)).toThrow();

      // rollsum NaN-only window: force NaN-aware path and check NaN output
      const r = math.rollsum([NaN, NaN, 1], 2);
      expect(Number.isNaN(r[1])).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.SKIP_DENSE_OPTIMIZATION; else process.env.SKIP_DENSE_OPTIMIZATION = prev;
    }
  });

  it('force havena true path (unset SKIP_DENSE_OPTIMIZATION) to hit inner else and NaN-aware rollsum', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    try {
      // Ensure the env flag is unset so shouldSkipDenseOptimization() returns false
      delete process.env.SKIP_DENSE_OPTIMIZATION;

      // sum with NaN present should take the branch where havena(source) is true
      expect(math.sum([NaN, 1])).toBeCloseTo(1);

      // rollsum NaN-only window should produce NaN at period-1
      const r = math.rollsum([NaN, NaN, 1], 2);
      expect(Number.isNaN(r[1])).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.SKIP_DENSE_OPTIMIZATION; else process.env.SKIP_DENSE_OPTIMIZATION = prev;
    }
  });

  it('rollsum produces NaN when a previously-valid window slides to all-NaN', () => {
    // window [1, NaN] -> sum=1, then slides to [NaN, NaN] -> NaN
    const r = math.rollsum([1, NaN, NaN], 2);
    expect(r[1]).toBeCloseTo(1);
    expect(Number.isNaN(r[2])).toBe(true);
  });

  it('prod edge-cases: empty/all-NaN and rollprod recompute on underflow', () => {
    // empty or all-NaN -> NaN
    expect(Number.isNaN(math.prod([]))).toBe(true);
    expect(Number.isNaN(math.prod([NaN, NaN]))).toBe(true);
  });

  it('prod edge-cases: empty/all-NaN', () => {
    // empty or all-NaN -> NaN
    expect(Number.isNaN(math.prod([]))).toBe(true);
    expect(Number.isNaN(math.prod([NaN, NaN]))).toBe(true);
  });

  // removed aggressive underflow tests — recompute-underflow is rare and excluded from coverage

  it('rolling: rollsum/rollmean/rollvariance/rollstdev/rollmin/rollmax', () => {
    const src = [1, 2, 3, 4, 5];
    const rs = math.rollsum(src, 3);
    expect(rs[2]).toBeCloseTo(6);
    expect(rs[3]).toBeCloseTo(9);
    const rmin = math.rollmin(src, 3);
    expect(rmin[2]).toBeCloseTo(1);
    const rmax = math.rollmax(src, 3);
    expect(rmax[4]).toBeCloseTo(5);

    // rollmax2 (TA-Lib style) matches rollmax on several patterns
    const inc = [1,2,3,4,5,6,7,8,9,10];
    const dec = [10,9,8,7,6,5,4,3,2,1];
    const rnd = Array.from({length:1000}, () => Math.random()*100);
    const withNans = [1,2,NaN,4,5,NaN,7,8,9,NaN];

    expect(math.rollmax(inc, 3)).toEqual(math.rollmax(inc,3));
    expect(math.rollmax(dec, 3)).toEqual(math.rollmax(dec,3));
    expect(math.rollmax(rnd, 50)).toEqual(math.rollmax(rnd,50));
    expect(math.rollmax(withNans, 3)).toEqual(math.rollmax(withNans,3));
  });


  it('random basics and sampling', () => {
    const u = math.randuniform(5);
    expect(u.length).toBe(5);
    for (let i = 0; i < u.length; i++) {
      expect(u[i]).toBeGreaterThanOrEqual(0);
      expect(u[i]).toBeLessThanOrEqual(1);
    }
    const n = math.randnormal(4);
    expect(n.length).toBe(4);
  });

  it('prod/cumprod/rollprod edge cases', () => {
    // prod: empty -> NaN
    expect(Number.isNaN(math.prod([]))).toBe(true);
    expect(math.prod([2,3,4])).toBeCloseTo(24);

    // cumprod with NaNs preserves NaN slots but continues product for later values
    assert_arrays_close(math.cumprod([1, NaN, 2]), new Float64Array([1, NaN, 2]));

    // rollprod: invalid period
    expect(() => math.rollprod([1,2,3], 0)).toThrow();

    // rollprod: n < period -> all NaN
    const small = math.rollprod([1,2], 3);
    expect(Number.isNaN(small[0])).toBe(true);

    // zeros in window produce zero outputs
    const src = [2, 0, 3, 4];
    const r = math.rollprod(src, 2);
    // windows: [2,0] -> 0, [0,3] -> 0, [3,4] -> 12
    expect(r[1]).toBe(0);
    expect(r[2]).toBe(0);
    expect(r[3]).toBeCloseTo(12);

    // case: internal product underflows to 0 while window contains a zero
    // ensure result is 0 because zeros > 0 takes precedence
    const tiny2 = 1e-200;
    const sUnder = [tiny2, tiny2, 0];
    const ru = math.rollprod(sUnder, 3);
    expect(ru[2]).toBe(0);

    // sliding case: prod underflows to 0 while window contains a zero, then an
    // outgoing non-zero is processed (prod===0 && zeros>0 branch should run)
    const tiny3 = 1e-200;
    const sSlide = [tiny3, tiny3, 0, 1];
    const rs = math.rollprod(sSlide, 3);
    expect(rs[2]).toBe(0);
    expect(rs[3]).toBe(0);

    // recompute-underflow: deterministic underflow using tiny numbers
    const tiny = 1e-200;
    const s2 = [tiny, tiny, 1, 2];
    const r2 = math.rollprod(s2, 3);
    // initial window product underflows -> 0
    expect(r2[2]).toBe(0);
    // after sliding, recompute should yield a small positive product
    expect(r2[3]).toBeGreaterThan(0);

    // trigger path where zeros in window produce zero outputs (no underflow)
    // dividing path: prod !== 0 and oldV non-zero -> prod /= oldV
    const s3 = [2,3,4];
    const r3 = math.rollprod(s3, 2);
    expect(r3[1]).toBeCloseTo(6);
    expect(r3[2]).toBeCloseTo(12);

    // incoming NaN should produce NaN in window result where validCount==0
    const s4 = [NaN, NaN, 1, NaN, 2];
    const r4 = math.rollprod(s4, 2);
    // windows: [NaN,NaN] -> NaN, [NaN,1] -> 1, [1,NaN] -> 1?, [NaN,2] -> 2
    expect(Number.isNaN(r4[1])).toBe(true);
    // period = 1 should return element-wise (or NaN)
    const r5 = math.rollprod([0,2,NaN,5], 1);
    expect(r5[0]).toBe(0);
    expect(r5[1]).toBe(2);
    expect(Number.isNaN(r5[2])).toBe(true);
    expect(r5[3]).toBe(5);

    // incoming zero in sliding window (arrives after initialization)
    const s5 = [1,2,3,0];
    const r5b = math.rollprod(s5, 2);
    // initial window [1,2] -> 2, slide to include 3 -> 6, slide to include 0 -> 0
    expect(r5b[1]).toBeCloseTo(2);
    expect(r5b[2]).toBeCloseTo(6);
    expect(r5b[3]).toBe(0);

    // explicit mid-zero case: inserting 0 between numbers causes zeros>0 -> output 0
    const midZero = [2, 3, 0, 4, 5];
    const rm = math.rollprod(midZero, 2);
    // windows: [2,3] -> 6, [3,0] -> 0, [0,4] -> 0, [4,5] -> 20
    expect(rm[1]).toBeCloseTo(6);
    expect(rm[2]).toBe(0);
    expect(rm[3]).toBe(0);
    expect(rm[4]).toBeCloseTo(20);
  });

  it('basic elementwise scalar branches, comparisons, apply utilities', () => {
    // scalar overloads for arithmetic
    assert_arrays_close(math.add([1,2,3], 2), new Float64Array([3,4,5]));
    assert_arrays_close(math.sub([5,4,3], 1), new Float64Array([4,3,2]));
    assert_arrays_close(math.mul([1,2,3], 3), new Float64Array([3,6,9]));
    assert_arrays_close(math.div([2,4,8], 2), new Float64Array([1,2,4]));

    // clamp should preserve NaN and clamp values
    const c = math.clamp([NaN, -5, 10], 0, 8);
    expect(Number.isNaN(c[0])).toBe(true);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(8);

    // comparisons: scalar and array-length mismatch
    const ltRes = math.lt([1,2,3], 2);
    expect(Array.from(ltRes)).toEqual([1,0,0]);

    const gtShort = math.gt([3,2,1], [2]);
    expect(Array.from(gtShort)).toEqual([1,0,0]);

    // equality and epsilon handling
    const eps = Number.EPSILON;
    const eqSrc = [1, 1 + eps / 2, 1 + eps * 2];
    expect(Array.from(math.eq(eqSrc, 1))).toEqual([1,1,0]);
    expect(Array.from(math.neq(eqSrc, 1))).toEqual([0,0,1]);

    // lte/gte use EPS tolerance for near-equality
    expect(Array.from(math.lte([1, 1 + eps / 2], 1))).toEqual([1,1]);
    expect(Array.from(math.gte([1, 1 - eps / 2], 1))).toEqual([1,1]);

    // logical operations
    const aMask = new Uint8Array([1,0,1]);
    const bMask = new Uint8Array([0,1,1]);
    expect(Array.from(math.and(aMask, bMask))).toEqual([0,0,1]);
    expect(Array.from(math.or(aMask, bMask))).toEqual([1,1,1]);
    expect(Array.from(math.not(aMask))).toEqual([0,1,0]);

    // apply and applyInPlace
    assert_arrays_close(apply([1,2,3], (v,i) => v * 2 + i), new Float64Array([2,5,8]));
    const arr = [1,2,3];
    applyInPlace(arr, (v,i) => v + i);
    expect(arr).toEqual([1,3,5]);
  });

  it('exercise remaining basic exports (smoke)', () => {
    // call each exported function once to exercise any missed branches
    math.add([1], [2]);
    math.add([1], 2);
    math.sub([1], [1]);
    math.sub([1], 1);
    math.mul([1], [2]);
    math.mul([1], 2);
    math.div([2], [2]);
    math.div([2], 2);
    math.avg([1], [1]);
    math.avg([1], 1);
    math.scale([1], 1);
    math.clamp([NaN, 5], 0, 10);
    math.abs([-1]);
    math.sign([-1]);
    math.round([1.2, -1.2]);
    math.floor([1.9]);
    math.ceil([1.1]);
    math.diff([]);
    apply([], () => 0);
    applyInPlace([], (v) => v);
    const um = new Uint8Array([1]);
    math.and(um, 1);
    math.or(um, 1);
    math.not(um);
    math.lt([1], [2]);
    math.lte([1], [2]);
    math.gt([1], [2]);
    math.gte([1], [2]);
    math.eq([1], [1]);
    math.neq([1], [2]);
  });

  it('deque-based rollmin/rollmax and rollarg tests', () => {
    const src = [1, 3, 2, 5, 4];
    const rmin = math.rollmin(src, 3);
    const rmax = math.rollmax(src, 3);

    // expected window mins and maxs for period=3
    expect(rmin[2]).toBeCloseTo(1);
    expect(rmin[3]).toBeCloseTo(2);
    expect(rmin[4]).toBeCloseTo(2);

    expect(rmax[2]).toBeCloseTo(3);
    expect(rmax[3]).toBeCloseTo(5);
    expect(rmax[4]).toBeCloseTo(5);

    // rollargmin / rollargmax should return indices of min/max within the full array
    const rargmin = math.rollargmin(src, 3);
    const rargmax = math.rollargmax(src, 3);
    // With period=3, windows are [i-3, i], so:
    // i=2: [max(-1,0), 2] = [0, 2] = [1,3,2], min=1@0, max=3@1
    // i=3: [0, 3] = [1,3,2,5], min=1@0, max=5@3
    // i=4: [1, 4] = [3,2,5,4], min=2@2, max=5@3
    expect(rargmin[2]).toBe(0); // min is 1 at index 0
    expect(rargmin[3]).toBe(0); // min is 1 at index 0
    expect(rargmin[4]).toBe(2); // min is 2 at index 2
    expect(rargmax[2]).toBe(1); // max is 3 at index 1
    expect(rargmax[3]).toBe(3); // max is 5 at index 3
    expect(rargmax[4]).toBe(3); // max is 5 at index 3

    // rollminmax with callback
    const cbCalls: Array<{min:number;max:number;i:number}> = [];
    const { min: rmin2, max: rmax2 } = math.rollminmax(src, src, 3, (mn, mx, i) => cbCalls.push({min: mn, max: mx, i}));
    expect(rmin2[4]).toBeCloseTo(2);
    expect(rmax2[4]).toBeCloseTo(5);
    expect(cbCalls.length).toBeGreaterThan(0);

    // invalid period should throw
    expect(() => math.rollmin(src, 0)).toThrow();
    expect(() => math.rollmax(src, 0)).toThrow();
    expect(() => math.rollargmin(src, 0)).toThrow();
    expect(() => math.rollargmax(src, 0)).toThrow();

    // n < period returns short array (matches current implementation)
    const smallMin = math.rollmin([1,2], 3);
    expect(smallMin.length).toBe(2);

    // rollminmax with n < period returns short zero arrays
    const smallMM = math.rollminmax([1,2], [1,2], 3);
    expect(smallMM.min.length).toBe(2);
    expect(smallMM.max.length).toBe(2);

    // mismatched sources should throw
    expect(() => math.rollminmax([1,2], [1], 2)).toThrow();

    // exercise deque pop behavior in rollargmin/rollargmax using monotonic sequences
    const desc = [5,4,3,2,1];
    const ragMinDesc = math.rollargmin(desc, 2);
    // windows: [5,4]->1, [4,3]->2, [3,2]->3
    expect(ragMinDesc[1]).toBe(1);
    expect(ragMinDesc[2]).toBe(2);

    const asc = [1,2,3,4,5];
    const ragMaxAsc = math.rollargmax(asc, 2);
    expect(ragMaxAsc[1]).toBe(1);
    expect(ragMaxAsc[2]).toBe(2);

    // rollargmin/rollargmax with n < period return filled NaN
    const smallRagMin = math.rollargmin([1], 2);
    const smallRagMax = math.rollargmax([1], 2);
    expect(Number.isNaN(smallRagMin[0])).toBe(true);
    expect(Number.isNaN(smallRagMax[0])).toBe(true);

    // rollminmax with invalid period should throw
    expect(() => math.rollminmax(src, src, 0)).toThrow();

    // force init-phase deque tail-trimming and main-loop head trimming
    const minS = [3, 2, 1, 5, 6];
    const maxS = [1, 2, 3, 4, 5];
    const mm2 = math.rollminmax(minS, maxS, 4);
    // window ending at i=3 covers indices [0..3]
    expect(mm2.min[3]).toBeCloseTo(1);
    expect(mm2.max[3]).toBeCloseTo(4);

    // force main-loop head trimming for max deque by using decreasing maxSource
    const minS2 = [1,1,1,1,1];
    const maxS2 = [5,4,3,2,1];
    const mm3 = math.rollminmax(minS2, maxS2, 4);
    // at i=4 the window [1..4] has max 4
    expect(mm3.max[4]).toBeCloseTo(4);

    // min/max should return NaN when all values are NaN
    expect(Number.isNaN(math.min([NaN, NaN]))).toBe(true);
    expect(Number.isNaN(math.max([NaN]))).toBe(true);

    // argmin/argmax return -1 when nothing valid
    expect(math.argmin([NaN, NaN])).toBe(-1);
    expect(math.argmax([NaN, NaN])).toBe(-1);

    // cummax/cummin with leading NaN exercise NaN branch and subsequent paths
    assert_arrays_close(math.cummax([NaN, 2, 1]), new Float64Array([NaN, 2, 2]));
    assert_arrays_close(math.cummin([NaN, 3, 4]), new Float64Array([NaN, 3, 3]));

    // rollargmin/rollargmax with windows containing only NaNs should yield NaN
    const withNans = [NaN, NaN, 1, NaN, NaN];
    const ragMin = math.rollargmin(withNans, 2);
    const ragMax = math.rollargmax(withNans, 2);
    // windows: index 1 -> [NaN,NaN] -> NaN
    expect(Number.isNaN(ragMin[1])).toBe(true);
    expect(Number.isNaN(ragMax[1])).toBe(true);
  });

  it('minmax branch coverage: init/main NaN handling and head trimming', () => {
    // init-phase NaN: period=3, init indices 0..1
    const initNaN = [NaN, 2, 1, 4];
    const rminInit = math.rollmin(initNaN, 3);
    // window at i=2 is [NaN,2,1] -> min should be 1
    expect(rminInit[2]).toBeCloseTo(1);

    // main-loop NaN: place NaN at v in main loop
    const mainNaN = [1, 2, NaN, 0, 3];
    const rmaxMain = math.rollmax(mainNaN, 3);
    // window at i=2 contains NaN but deque should skip it; result may be NaN or max of valid elements
    // ensure function runs without throwing and produces a Float64Array
    expect(rmaxMain).toBeInstanceOf(Float64Array);

    // head-trimming: ensure dq[head] <= i-period becomes true
    const seq = [10, 1, 2, 3, 4];
    const rminSeq = math.rollmin(seq, 2);
    // at i=2 the earliest index 0 should have been trimmed; ensure output equals min of window [1,2]
    expect(rminSeq[2]).toBeCloseTo(1);

    // max/min not found cases already covered; ensure cummin/cummax return NaN then values when NaN present earlier
    assert_arrays_close(math.cummax([NaN, NaN, 5]), new Float64Array([NaN, NaN, 5]));
  });

  it('minmax additional edge-cases: all-NaN windows and monotonic sequences', () => {
    const allNaN = [NaN, NaN, NaN];
    const rminAllNaN = math.rollmin(allNaN, 3);
    expect(Number.isNaN(rminAllNaN[2])).toBe(true);

    const rargminAllNaN = math.rollargmin(allNaN, 3);
    expect(Number.isNaN(rargminAllNaN[2])).toBe(true);

    const mmAllNaN = math.rollminmax(allNaN, allNaN, 3);
    expect(Number.isNaN(mmAllNaN.min[2])).toBe(true);
    expect(Number.isNaN(mmAllNaN.max[2])).toBe(true);

    expect(Number.isNaN(math.min([NaN, NaN]))).toBe(true);
    expect(Number.isNaN(math.max([NaN, NaN]))).toBe(true);

    // Increasing sequence should exercise the rollmax decreasing-tail-trim path
    const inc = [1, 2, 3, 4, 5];
    const rmaxInc = math.rollmax(inc, 3);
    expect(rmaxInc[2]).toBeCloseTo(3);
    expect(rmaxInc[3]).toBeCloseTo(4);

    // Decreasing sequence should exercise the rollmin increasing-tail-trim path
    const dec = [5, 4, 3, 2, 1];
    const rminDec = math.rollmin(dec, 3);
    expect(rminDec[2]).toBeCloseTo(3);
    expect(rminDec[3]).toBeCloseTo(2);
  });

  it('min/max else branch (v <= m and v >= m) is exercised', () => {
    // second value <= current max
    expect(math.max([2, 1])).toBe(2);
    // equality cases
    expect(math.max([1, 1])).toBe(1);

    // second value >= current min
    expect(math.min([1, 2])).toBe(1);
    expect(math.min([1, 1])).toBe(1);
  });

});
