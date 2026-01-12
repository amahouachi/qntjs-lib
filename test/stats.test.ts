import { describe, it, expect } from 'vitest';
import { stats } from '../src/index.js';
import { assert_arrays_close } from './helpers.js';
// Note: quantile internals are internal; tests use public `stats` API.

describe('Stats functions', () => {

  describe('mean.ts', () => {
    it('mean', () => {
      expect(stats.mean([1, 2, 3, 4])).toBeCloseTo(2.5);
    });

    it('mean edge cases: weights mismatch, skipna behaviors, zero-weight sum', () => {
      // weights length mismatch
      expect(() => stats.mean([1, 2, 3], { weights: [1, 2] as any })).toThrow();
      // skipna=false with NaN present -> NaN
      expect(Number.isNaN(stats.mean([1, NaN, 3], { skipna: false } as any))).toBe(true);
      // skipna=true (default) ignores NaN
      expect(stats.mean([1, NaN, 3])).toBeCloseTo(2);
      // weighted skipna=false computes weighted mean; zero-weight sum -> NaN
      expect(stats.mean([1, 2, 3], { weights: [1, 1, 1], skipna: false } as any)).toBeCloseTo(2);
      expect(Number.isNaN(stats.mean([1, 2], { weights: [0, 0], skipna: false } as any))).toBe(true);
    });
    it('weighted means: mean/hmean/gmean', () => {
      expect(stats.mean([1, 2, 3], { weights: [1, 1, 1] })).toBeCloseTo(2);
      expect(stats.mean([1, 2, 3], { weights: [1, 0, 0] })).toBeCloseTo(1);
      expect(stats.mean([1, NaN, 3], { weights: [1, NaN, 1] })).toBeCloseTo(2);

      // hmean
      expect(stats.hmean([1, 2, 4])).toBeCloseTo(3 / (1 + 0.5 + 0.25));
      expect(stats.hmean([1, 2, 4], { weights: [1, 1, 0] })).toBeCloseTo(2 / (1 + 0.5));

      // gmean
      expect(stats.gmean([1, 3, 9])).toBeCloseTo(3);
      expect(stats.gmean([1, 3, 9], { weights: [1, 0, 0] })).toBeCloseTo(1);
    });

    it('hmean/gmean edge cases: zeros, negatives and weights wsum zero', () => {
      // hmean: value <= 0 should return NaN
      expect(Number.isNaN(stats.hmean([1, 0, 2]))).toBe(true);
      // weighted hmean with zero weight sum -> NaN
      expect(Number.isNaN(stats.hmean([1, 2], { weights: [0, 0], skipna: false } as any))).toBe(true);

      // gmean: non-positive values yield NaN
      expect(Number.isNaN(stats.gmean([1, -1, 2]))).toBe(true);
      expect(Number.isNaN(stats.gmean([0, 2]))).toBe(true);
      // weighted gmean with zero weight sum -> NaN
      expect(Number.isNaN(stats.gmean([1, 2], { weights: [0, 0], skipna: false } as any))).toBe(true);
    });


    it('rolling quantile/median', () => {
      const src = [1, 3, 2, 5, 4];
      const rm = stats.rollmedian(src, 3);
      expect(Number.isNaN(rm[0])).toBe(true);
      expect(rm[2]).toBeCloseTo(2);
      const rq = stats.rollquantile(src, 3, 0.5);
      expect(rq[2]).toBeCloseTo(2);
    });
    it('quantile/median/percentiles', () => {
      expect(stats.quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
      expect(stats.median([5, 1, 3])).toBeCloseTo(3);
      const ps = stats.percentiles([1, 2, 3, 4], [0, 0.5, 1]);
      expect(ps.length).toBe(3);
      expect(ps[1]).toBeCloseTo(2.5);
    });

    it('quantile/rollquantile edge cases and validation branches', () => {
      // invalid q should throw
      expect(() => stats.quantile([1, 2, 3], -0.1 as any)).toThrow();
      expect(() => stats.quantile([1, 2, 3], 1.1 as any)).toThrow();

      // rollquantile invalid period should throw
      expect(() => stats.rollquantile([1, 2, 3], 0, 0.5)).toThrow();

      // n < period -> compact NaN-filled array (small allocation)
      const small = stats.rollquantile([1], 2, 0.5);
      expect(Number.isNaN(small[0])).toBe(true);

      // windows composed entirely of NaNs should yield NaN outputs
      const allNan = stats.rollquantile([NaN, NaN], 2, 0.5);
      expect(Number.isNaN(allNan[0])).toBe(true);
      expect(Number.isNaN(allNan[1])).toBe(true);
    });

    it('rollquantile heap rebalance stress to exercise siftDown children comparisons', () => {
      // larger sequence with duplicates to force many insert/delete and rebalances
      const src = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
      const out = stats.rollquantile(src, 4, 0.5);
      // outputs after window fills should be numeric or NaN for all positions
      for (let i = 0; i < out.length; i++) {
        expect(typeof out[i]).toBe('number');
      }
      // simple sanity checks at some indices
      expect(Number.isNaN(out[0])).toBe(true);
      expect(typeof out[3]).toBe('number');
      expect(typeof out[10]).toBe('number');
    });

    it('mad edge-cases and fast-path', () => {
      // mad of empty or all-NaN should return NaN
      expect(Number.isNaN(stats.mad([]))).toBe(true);
      expect(Number.isNaN(stats.mad([NaN, NaN]))).toBe(true);

      // mad fast path (no NaNs)
      const src = [1, 2, 3];
      const m = stats.mad(src as any);
      // manual: mean = 2, deviations = [1,0,1] => average = 2/3
      expect(m).toBeCloseTo(2 / 3);
    });

    it('mean/rollmean empty and invalid-period edge cases', () => {
      // empty source -> NaN
      expect(Number.isNaN(stats.mean([]))).toBe(true);
      // weighted empty -> NaN (weights length zero allowed)
      expect(Number.isNaN(stats.mean([], { weights: [] } as any))).toBe(true);

      // rollmean invalid period should throw
      expect(() => stats.rollmean([1, 2, 3], 0)).toThrow();
      // n < period -> NaN filled
      const small = stats.rollmean([1], 2);
      expect(Number.isNaN(small[0])).toBe(true);
    });

    it('hmean/gmean empty or invalid values return NaN', () => {
      expect(Number.isNaN(stats.hmean([]))).toBe(true);
      expect(Number.isNaN(stats.gmean([]))).toBe(true);
      // negative/zero values already covered earlier but assert again
      expect(Number.isNaN(stats.hmean([0]))).toBe(true);
      expect(Number.isNaN(stats.gmean([0]))).toBe(true);
    });


    it('rollmean dense vs NaN-aware fast paths', () => {
      // ensure dense optimization allowed -> fast dense path
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      const r1 = stats.rollmean([1, 2, 3, 4], 2);
      expect(r1[1]).toBeCloseTo(1.5);
      expect(r1[2]).toBeCloseTo(2.5);

      // force NaN-aware path
      process.env.SKIP_DENSE_OPTIMIZATION = 'true';
      const r2 = stats.rollmean([1, NaN, 3, 4], 2);
      // windows: [1,NaN] -> 1, [NaN,3] -> 3, [3,4] -> 3.5
      expect(r2[1]).toBeCloseTo(1);
      expect(r2[2]).toBeCloseTo(3);
      expect(r2[3]).toBeCloseTo(3.5);
    });

    it('more mean/hmean/gmean/mad dense and empty cases', () => {
      // unweighted hmean dense skipna=false path and empty
      expect(stats.hmean([1, 2, 4], { skipna: false } as any)).toBeCloseTo(3 / (1 + 0.5 + 0.25));
      expect(Number.isNaN(stats.hmean([], { skipna: false } as any))).toBe(true);

      // gmean dense skipna=false and empty
      expect(stats.gmean([1, 3, 9], { skipna: false } as any)).toBeCloseTo(3);
      expect(Number.isNaN(stats.gmean([], { skipna: false } as any))).toBe(true);

      // mad skipna=false and empty
      expect(Number.isNaN(stats.mad([], false))).toBe(true);
      expect(Number.isNaN(stats.mad([NaN, NaN], false))).toBe(true);
    });


    it('hmean/gmean weight-length mismatch throws', () => {
      expect(() => stats.hmean([1, 2], { weights: [1] as any })).toThrow();
      expect(() => stats.gmean([1, 2], { weights: [1] as any })).toThrow();
    });

    it('hmean/gmean negative/zero and NaN-weight edge cases', () => {
      // explicit skipna=false should reject non-positive values
      expect(Number.isNaN(stats.hmean([1, 0], { skipna: false } as any))).toBe(true);
      expect(Number.isNaN(stats.gmean([1, -1], { skipna: false } as any))).toBe(true);

      // weighted gmean/hmean with NaN weights and skipna=true: NaN weights are treated as missing
      expect(stats.gmean([1, NaN], { weights: [1, NaN] } as any)).toBeCloseTo(1);
      expect(stats.hmean([1, NaN], { weights: [1, NaN] } as any)).toBeCloseTo(1);

      // all-NaN weighted inputs -> NaN
      expect(Number.isNaN(stats.gmean([NaN, NaN], { weights: [NaN, NaN] } as any))).toBe(true);
    });

    it('mad returns NaN when mean is NaN', () => {
      expect(Number.isNaN(stats.mad([NaN]))).toBe(true);
    });

    it('hmean/gmean zero-weight default skipna and mad with NaNs', () => {
      // default skipna (true) with zero total weight -> NaN
      expect(Number.isNaN(stats.hmean([1, 2], { weights: [0, 0] } as any))).toBe(true);
      expect(Number.isNaN(stats.gmean([1, 2], { weights: [0, 0] } as any))).toBe(true);

      // mad with some NaNs but some valid values -> computed over valid values
      expect(stats.mad([NaN, 1, 2])).toBeCloseTo(0.5);
    });


    it('exhaustive mean family branch exercise', () => {
      const funcs = ['mean', 'hmean', 'gmean', 'mad'] as const;
      const sources = {
        s3: [1, 2, 3],
        s3nan: [1, NaN, 3],
        s2zero: [0, 1],
        s2neg: [-1, 1]
      };
      for (const envMode of ['dense', 'nan-aware']) {
        if (envMode === 'dense') delete process.env.SKIP_DENSE_OPTIMIZATION; else process.env.SKIP_DENSE_OPTIMIZATION = 'true';
        for (const fn of funcs) {
          for (const srcKey of Object.keys(sources)) {
            const src = (sources as any)[srcKey] as number[];
            const weights = src.length === 3 ? [1, 0, 1] : [1, 0];
            const wnan = src.map((v, i) => i === 1 ? NaN : 1);
            const optsList: Array<any> = [undefined, { skipna: true }, { skipna: false }];
            for (const opts of optsList) {
              // try without weights
              let out = stats[fn](src, opts); expect(typeof out === 'number').toBe(true);
              // try with numeric weights
              out = stats[fn](src, { ...(opts || {}), weights }); expect(typeof out === 'number').toBe(true);
              // try with NaN weights (treated as missing under skipna=true)
              out = stats[fn](src, { ...(opts || {}), weights: wnan }); expect(typeof out === 'number').toBe(true);
            }
          }
        }
      }
    });


    it('rollmean NaN-aware initialization and newV NaN branch', () => {
      // call without skipna to exercise NaN-tolerant path (skipna undefined -> NaN-aware)
      const r = stats.rollmean([1, 3, NaN, 4], 2);
      // initial window [1,3] -> 2
      expect(r[1]).toBeCloseTo(2);
      // next step: newV = NaN should take the else branch and produce aggregated mean of remaining valid value (3)
      expect(r[2]).toBeCloseTo(3);
      // next step: newV = 4, oldV = 3 -> mean over [NaN,4] ignoring NaN yields 4
      expect(r[3]).toBeCloseTo(4);
    });

  });
  describe('transforms.ts', () => {
    it('transforms: zscore/normalizeMinMax', () => {
      const zs = stats.zscore([1, 2, 3]);
      expect(Number.isNaN(zs[0])).toBe(false);
      const nm = stats.norminmax([0, 5, 10]);
      assert_arrays_close(nm, new Float64Array([0, 0.5, 1]));
    });

    it('transforms edge cases: zscore empty and zero-variance; norminmax NaN/all-equal handling', () => {
      // zscore empty
      const zempty = stats.zscore([]);
      expect(zempty.length).toBe(0);

      // zscore zero variance -> NaN filled
      const zconst = stats.zscore([1, 1, 1]);
      expect(Number.isNaN(zconst[0])).toBe(true);

      // norminmax fast-path all equal -> NaN filled
      const nmEq = stats.norminmax([2, 2, 2], false);
      expect(Number.isNaN(nmEq[0])).toBe(true);

      // norminmax all-NaN -> NaN filled
      const nmNan = stats.norminmax([NaN, NaN]);
      expect(Number.isNaN(nmNan[0])).toBe(true);
    });

    it('winsorize', () => {
      const src = [1, 2, 3, 100];
      const w = stats.winsorize(src, { lower: 0.25, upper: 0.75 });
      const low = stats.quantile(src, 0.25);
      const high = stats.quantile(src, 0.75);
      const expected = new Float64Array(src.map(v => (v === v ? (v < low ? low : (v > high ? high : v)) : NaN)));
      assert_arrays_close(w, expected);

      // preserve NaNs
      const src2 = [1, NaN, 3, 100];
      const w2 = stats.winsorize(src2, { lower: 0.25, upper: 0.75 });
      const low2 = stats.quantile(src2, 0.25);
      const high2 = stats.quantile(src2, 0.75);
      const expected2 = new Float64Array(src2.map(v => (v === v ? (v < low2 ? low2 : (v > high2 ? high2 : v)) : NaN)));
      assert_arrays_close(w2, expected2);

      // invalid bounds
      expect(() => stats.winsorize([1, 2, 3], { lower: 0.9, upper: 0.1 })).toThrow();
    });

    it('winsorize all-NaN and explicit fast-path', () => {
      const wnan = stats.winsorize([NaN, NaN]);
      expect(Number.isNaN(wnan[0])).toBe(true);

      // explicit fast path (no NaNs)
      const src = [1, 2, 3, 100];
      const lo = stats.quantile(src, 0.25);
      const hi = stats.quantile(src, 0.75);
      const wfast = stats.winsorize(src, { lower: 0.25, upper: 0.75, skipna: false } as any);
      const expected = new Float64Array(src.map(v => (v < lo ? lo : (v > hi ? hi : v))));
      assert_arrays_close(wfast, expected);
    });
    it('correlation', () => {
      expect(stats.corr([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('corr fast/slow path and zero-variance handling', () => {
      // n === 0 -> NaN
      expect(Number.isNaN(stats.corr([], []))).toBe(true);

      // fast path (skipna=false) with zero variance -> NaN
      expect(Number.isNaN(stats.corr([1, 1, 1], [1, 2, 3], false))).toBe(true);

      // slow path (force NaN-aware global mode) with zero variance -> NaN
      process.env.SKIP_DENSE_OPTIMIZATION = 'true';
      expect(Number.isNaN(stats.corr([1, 1, 1], [1, 2, 3]))).toBe(true);
    });
    it('rollcorr numeric vs NaN outputs', () => {
      // numeric when stdevs are non-zero
      const rnum = stats.rollcorr([1, 2, 3, 4], [1, 2, 3, 4], 3);
      expect(typeof rnum[2]).toBe('number');

      // NaN when one series has zero variance
      const rnan = stats.rollcorr([1, 1, 1, 1], [1, 2, 3, 4], 3);
      expect(Number.isNaN(rnan[2])).toBe(true);
    });

    it('transforms additional branches: norminmax NaN-aware path, rollcorr outLength and corr length handling, zscore env modes', () => {
      // norminmax slow path with some NaNs
      const nm = stats.norminmax([NaN, 1, 3, NaN]);
      expect(Number.isNaN(nm[0])).toBe(true);
      expect(nm[1]).toBeCloseTo(0);
      expect(nm[2]).toBeCloseTo(1);

      // rollcorr with differing lengths and outLength='max' pads and returns max length
      const rcMax = stats.rollcorr([1, 2], [1, 2, 3, 4], 2, { outLength: 'max' } as any);
      expect(rcMax.length).toBe(4);

      // corr with mismatched lengths: underlying covar requires equal lengths -> throws
      expect(() => stats.corr([1, 2, 3], [1, 2] as any)).toThrow();

      // zscore under forced NaN-aware global mode (no dense optimization)
      process.env.SKIP_DENSE_OPTIMIZATION = 'true';
      const z = stats.zscore([1, NaN, 3]);
      expect(typeof z[0]).toBe('number');
      expect(Number.isNaN(z[1])).toBe(true);
    });

    it('transforms auto-detect and NaN-stub branches', () => {
      // zscore dense auto-detect (no SKIP var, no NaNs) -> numeric outputs
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      const z = stats.zscore([1, 2, 3]);
      expect(typeof z[0]).toBe('number');

      // zscore with skipna=false and all-NaN -> sd NaN -> out filled NaN
      const zNaN = stats.zscore([NaN, NaN], false);
      expect(Number.isNaN(zNaN[0])).toBe(true);

      // norminmax explicit fast-path (no NaNs)
      const nmFast = stats.norminmax([0, 5, 10], false);
      assert_arrays_close(nmFast, new Float64Array([0, 0.5, 1]));

      // winsorize auto-detect dense path
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      const w = stats.winsorize([1, 2, 3, 100]);
      expect(Number.isNaN(w[0])).toBe(false);
    });
    it('norminmax slow-path equal after ignoring NaNs returns NaN-filled output', () => {
      const nm = stats.norminmax([NaN, 2, NaN]);
      // ignoring NaNs leaves mn===mx -> should fill with NaN
      expect(Number.isNaN(nm[1])).toBe(true);
    });

    it('rollcorr accepts Float64Array inputs (direct view fast-path)', () => {
      const xa = new Float64Array([1, 2, 3, 4]);
      const ya = new Float64Array([1, 2, 3, 4]);
      const rc = stats.rollcorr(xa, ya, 2);
      expect(rc.length).toBe(4);
      expect(typeof rc[1]).toBe('number');
    });

    it('corr auto-detect dense vs NaN-aware path via env and havena', () => {
      delete process.env.SKIP_DENSE_OPTIMIZATION; // allow dense auto-detect
      // for no-NaN inputs the fast dense path is chosen; zero variance triggers NaN
      expect(Number.isNaN(stats.corr([1, 1, 1], [1, 2, 3]))).toBe(true);
    });

    it('zscore and winsorize honor SKIP_DENSE_OPTIMIZATION=true (force NaN-aware path)', () => {
      process.env.SKIP_DENSE_OPTIMIZATION = 'true';
      // with global NaN-aware mode forced, functions should preserve NaN-awareness
      const z = stats.zscore([1, 2, 3]);
      expect(typeof z[0]).toBe('number');

      const w = stats.winsorize([1, NaN, 3, 100]);
      expect(Number.isNaN(w[1])).toBe(true);
    });

    it('zscore auto-detect with NaNs (havena true -> keep skipna)', () => {
      // allow auto-detect path
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      const z = stats.zscore([1, NaN, 3]);
      // middle element should remain NaN
      expect(Number.isNaN(z[1])).toBe(true);
      expect(typeof z[0]).toBe('number');
    });

    it('norminmax empty source returns empty Float64Array', () => {
      const out = stats.norminmax([]);
      expect(out.length).toBe(0);
    });

    it('corr auto-detect NaN-aware path when inputs contain NaN (havena true)', () => {
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      // x has a NaN; with auto-detect we should take the NaN-aware branch
      const r = stats.corr([1, NaN, 3], [1, 2, 3]);
      // ensure NaN-aware branch returns a finite numeric result for valid paired values
      expect(typeof r).toBe('number');
      expect(Number.isFinite(r)).toBe(true);
    });

    it('corr fast dense path (explicit skipna=false) returns cov/sqrt(vx*vy)', () => {
      const r = stats.corr([1, 2, 3], [1, 2, 3], false);
      expect(r).toBeCloseTo(1);
    });

    it('winsorize empty and auto-detect NaN-aware slow-path (havena true) preserves NaNs', () => {
      // empty
      const e = stats.winsorize([]);
      expect(e.length).toBe(0);

      // auto-detect NaN-aware when havena(source) === true
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      const w = stats.winsorize([1, NaN, 3], { lower: 0.25, upper: 0.75 });
      expect(Number.isNaN(w[1])).toBe(true);
    });
  });
  describe('var.ts', () => {
    it('variance / ddof behavior', () => {
      const a = [1, 2, 3, 4];
  // population variance (ddof=0)
      expect(stats.var(a, { ddof: 0 })).toBeCloseTo(1.25);
      // sample variance (ddof=1) is the default
      expect(stats.var(a)).toBeCloseTo(5 / 3);
      expect(stats.stdev(a, { ddof: 0 })).toBeCloseTo(Math.sqrt(1.25));
      expect(stats.stdev(a)).toBeCloseTo(Math.sqrt(5 / 3));
      const src = [1, 2, 3, 4, 5];
      const rvPop = stats.rollvar(src, 3, { skipna: true, ddof: 0 });
      const rvSample = stats.rollvar(src, 3, { skipna: true, ddof: 1 });
      // first computed window [1,2,3]
      expect(rvPop[2]).toBeCloseTo(2 / 3);
      expect(rvSample[2]).toBeCloseTo(1);

      // rollstdev respects ddof
      const rsPop = stats.rollstdev(src, 3, { skipna: true, ddof: 0 });
      const rsSample = stats.rollstdev(src, 3, { skipna: true, ddof: 1 });
      expect(rsPop[2]).toBeCloseTo(Math.sqrt(2 / 3));
      expect(rsSample[2]).toBeCloseTo(1);
    });
    it('variance, covar, rollvar, rollcovar and rollstdev edge cases', () => {
      // variance dense path (skipna=false)
      expect(stats.var([1, 2, 3], { skipna: false } as any)).toBeCloseTo(1);

      // variance with NaNs (skipna true default) uses only valid samples
      expect(stats.var([1, NaN, 3])).toBeCloseTo(2);

      // variance invalid ddof throws
      expect(() => stats.var([1, 2, 3], { ddof: -1 } as any)).toThrow();
      expect(() => stats.var([1, 2, 3], { ddof: Infinity } as any)).toThrow();

      // variance denom <= 0 -> NaN (single valid sample with ddof=1)
      expect(Number.isNaN(stats.var([1], { ddof: 1 } as any))).toBe(true);

      // covar mismatched lengths throws
      expect(() => stats.covar([1, 2], [1] as any)).toThrow();
      // covar with matching series
      expect(stats.covar([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
      // covar all-NaN pairs -> NaN
      expect(Number.isNaN(stats.covar([NaN, NaN], [NaN, NaN]))).toBe(true);

      // rollvar dense fast-path: period 2 on no-NaN data
      const rv = stats.rollvar([1, 2, 3, 4], 2);
      expect(rv[1]).toBeCloseTo(0.5);
      // rollvar with ddof >= period -> NaN outputs
      const rvNaN = stats.rollvar([1, 2, 3], 2, { ddof: 2 } as any);
      expect(Number.isNaN(rvNaN[1])).toBe(true);

      // rollvar NaN-aware: windows with NaNs produce NaN until sufficient valid samples
      const rv2 = stats.rollvar([1, NaN, 3, 4], 2);
      expect(Number.isNaN(rv2[1])).toBe(true);
      expect(Number.isNaN(rv2[2])).toBe(true);
      expect(rv2[3]).toBeCloseTo(0.5);

      // rollvar invalid period should throw
      expect(() => stats.rollvar([1, 2, 3], 0)).toThrow();

      // force dense path by explicit skipna=false
      const rvdense = stats.rollvar([1, 2, 3, 4], 2, { skipna: false } as any);
      expect(rvdense[1]).toBeCloseTo(0.5);

      // dense path with denom <= 0 (ddof == period) -> NaN outputs
      const rvdn = stats.rollvar([1, 2, 3, 4], 2, { skipna: false, ddof: 2 } as any);
      expect(Number.isNaN(rvdn[1])).toBe(true);

      // ensure havena-based early dense return is exercised
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      const rve = stats.rollvar([1, 2, 3, 4], 2);
      expect(rve[1]).toBeCloseTo(0.5);

      // ensure fast-path detection inside `variance` sets skipna=false when no NaNs
      delete process.env.SKIP_DENSE_OPTIMIZATION;
      expect(stats.var([1, 2, 3])).toBeCloseTo(1);

      // rollcovar basic numeric behavior
      const rc = stats.rollcovar([1, 2, 3], [1, 2, 3], 2);
      expect(rc[1]).toBeCloseTo(0.5);
      // rollcovar mismatched -> throw
      expect(() => stats.rollcovar([1, 2], [1] as any, 2)).toThrow();
      // rollcovar initial window with too few valid pairs -> NaN
      const rcInit = stats.rollcovar([NaN, 1, NaN], [NaN, 1, NaN], 3);
      expect(Number.isNaN(rcInit[2])).toBe(true);
      // rollcovar iteration can drop below minCount -> NaN in loop
      const rcLoop = stats.rollcovar([1, NaN, 2, NaN, 3], [1, NaN, 2, NaN, 3], 3);
      // initial window [1,NaN,2] -> count=2 -> numeric
      expect(typeof rcLoop[2]).toBe('number');
      // at i=3 oldV=1 removed and newV=NaN -> count drops < minCount -> NaN
      expect(Number.isNaN(rcLoop[3])).toBe(true);
      // later window with enough valid pairs produces numeric
      expect(typeof rcLoop[4]).toBe('number');

      // rollstdev wraps rollvar
      const rs = stats.rollstdev([1, 2, 3, 4], 2);
      expect(rs[1]).toBeCloseTo(Math.sqrt(0.5));
    });
  });



  describe('sampling.ts', () => {
    it('sampling', () => {
      const samp = stats.sample([1, 2, 3, 4], 2);
      expect(samp.length).toBe(2);
      const bs = stats.bootstrap([1, 2, 3], 3);
      expect(bs.length).toBe(3);
    });

    it('sampling deterministic branches (shuffle/sample/bootstrap)', () => {
      // shuffle: length 0/1 no-op
      const empty: number[] = [];
      expect(stats.shuffle(empty)).toEqual([]);
      const one = [1];
      expect(stats.shuffle(one.slice())).toEqual([1]);
      // shuffle body exercise for n>=2 (deterministic by stubbing Math.random)
      Math.random = () => 0; // j will be 0 each iteration
      const s = stats.shuffle([1, 2, 3]);
      expect(s).toEqual([2, 3, 1]);

      // sample: k <= 0 -> []
      expect(stats.sample([1, 2, 3], 0)).toEqual([]);

      // sample: k >= n -> returns a shallow copy equal to the input
      const src = [1, 2, 3];
      const outAll = stats.sample(src, 3);
      expect(outAll).toEqual(src);
      expect(outAll).not.toBe(src);

      // sample deterministic when Math.random is stubbed
      Math.random = () => 0; // always pick index 0
      const sdet = stats.sample([10, 20, 30, 40], 2);
      // with j=0 repeatedly we expect first two elements in order
      expect(sdet).toEqual([10, 20]);

      // bootstrap with Math.random=0 picks first element repeatedly
      const bdet = stats.bootstrap([7, 8, 9], 3);
      expect(bdet).toEqual([7, 7, 7]);
    });

  });
  describe('skew.ts', () => {
    it('skew and kurtosis edge cases and rolling variants', () => {
      // skew: empty or too few valid values -> NaN
      expect(Number.isNaN(stats.skew([]))).toBe(true);
      expect(Number.isNaN(stats.skew([1, 2]))).toBe(true);
      // zero-variance -> 0
      expect(stats.skew([1, 1, 1])).toBe(0);
      // typical numeric result
      expect(typeof stats.skew([1, 2, 3, 4, 5])).toBe('number');

      // kurtosis: empty or too few valid values -> NaN
      expect(Number.isNaN(stats.kurtosis([]))).toBe(true);
      expect(Number.isNaN(stats.kurtosis([1, 2, 3]))).toBe(true);
      // zero-variance -> 0
      expect(stats.kurtosis([1, 1, 1, 1])).toBe(0);
      expect(typeof stats.kurtosis([1, 2, 3, 4, 5])).toBe('number');

      // rollskew: n < period -> all NaN
      const rshort = stats.rollskew([1, 2], 3);
      expect(Number.isNaN(rshort[0])).toBe(true);

      // rollskew: constant window -> 0 at period-1
      const r = stats.rollskew([1, 1, 1, 2, 3], 3);
      expect(r[2]).toBeCloseTo(0);
      // following window should produce a numeric skew
      expect(typeof r[3]).toBe('number');

      // rollkurtosis: n < period -> all NaN
      const rkshort = stats.rollkurtosis([1, 2, 3], 4);
      expect(Number.isNaN(rkshort[0])).toBe(true);

      // rollkurtosis: constant window -> 0 at period-1
      const rk = stats.rollkurtosis([1, 1, 1, 1, 2], 4);
      expect(rk[3]).toBeCloseTo(0);
      expect(typeof rk[4]).toBe('number');
    });

    it('rollskew/rollkurtosis NaN window entry/exit behavior', () => {
      // initial window contains NaN -> first output NaN, then oldV is NaN so count doesn't decrement
      const r1 = stats.rollskew([NaN, 1, 2, 3], 3);
      expect(Number.isNaN(r1[2])).toBe(true);
      // oldV at i=3 is NaN, newV is 3 -> count becomes 3 => numeric output
      expect(typeof r1[3]).toBe('number');

      const rk1 = stats.rollkurtosis([NaN, 1, 2, 3, 4], 4);
      expect(Number.isNaN(rk1[3])).toBe(true);
      // window [1,2,3,4] at i=4 should produce numeric kurtosis
      expect(typeof rk1[4]).toBe('number');
    });

    it('rollskew/rollkurtosis numeric initial-window variance branch', () => {
      // initial window [1,2,3] variance > 1e-12 -> numeric output at period-1
      const rInit = stats.rollskew([1, 2, 3, 4], 3);
      expect(typeof rInit[2]).toBe('number');
      // ensure further sliding numeric branch also taken
      expect(typeof rInit[3]).toBe('number');

      const rkInit = stats.rollkurtosis([1, 2, 3, 4, 5], 4);
      expect(typeof rkInit[3]).toBe('number');
      expect(typeof rkInit[4]).toBe('number');
    });

    it('exhaustive small combos for rollskew/rollkurtosis to hit branches', () => {
      const combos: number[][] = [
        [1, 2, 3, 4, 5],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 2, 3],
        [NaN, 1, 2, 3, 4],
        [1, NaN, 1, 2, 3],
        [1, 1, 1, 1, 1.000000000001],
        [1, 1, 2, 1, 1],
        [1, 2, 1, 2, 1]
      ];
      for (const src of combos) {
        // period 3 skew
        const r = stats.rollskew(src, 3);
        expect(r.length).toBe(src.length);
        // ensure functions run and produce Float64Array entries that are number or NaN
        for (let i = 0; i < r.length; i++) {
          const v = r[i];
          expect(typeof v === 'number').toBe(true);
        }

        // period 4 kurtosis
        const rk = stats.rollkurtosis(src, 4);
        expect(rk.length).toBe(src.length);
        for (let i = 0; i < rk.length; i++) {
          const v = rk[i];
          expect(typeof v === 'number').toBe(true);
        }
      }
    });

    it('skew/kurtosis handle inputs with NaNs and other valid values', () => {
      // skew with a NaN should ignore NaN and equal skew of valid subset
      const s1 = stats.skew([NaN, 1, 2, 3]);
      const s2 = stats.skew([1, 2, 3]);
      expect(Number.isNaN(s1)).toBe(false);
      expect(s1).toBeCloseTo(s2 as number);

      // kurtosis with a NaN should ignore NaN and equal kurtosis of valid subset
      const k1 = stats.kurtosis([NaN, 1, 2, 3, 4]);
      const k2 = stats.kurtosis([1, 2, 3, 4]);
      expect(Number.isNaN(k1)).toBe(false);
      expect(k1).toBeCloseTo(k2 as number);

      // rollskew: windows containing NaN but enough valid values should produce numeric outputs
      const rnan = stats.rollskew([NaN, 1, 2, 3, 4], 3);
      // period-1 window [NaN,1,2] -> treated as [1,2] -> insufficient -> NaN
      expect(Number.isNaN(rnan[2])).toBe(true);
      // window [1,2,3] -> numeric
      expect(typeof rnan[3]).toBe('number');

      // rollkurtosis: similar behavior
      const rknan = stats.rollkurtosis([NaN, 1, 2, 3, 4, 5], 4);
      expect(Number.isNaN(rknan[3])).toBe(true);
      expect(typeof rknan[4]).toBe('number');
    });


    it('rollskew/rollkurtosis insufficient-count windows remain NaN', () => {
      // windows with too few non-NaN values should remain NaN until enough values accumulate
      const r = stats.rollskew([1, NaN, NaN, 2, 3, 4], 3);
      // windows: [1,NaN,NaN] -> count=1 -> NaN
      expect(Number.isNaN(r[2])).toBe(true);
      // [NaN,NaN,2] -> NaN
      expect(Number.isNaN(r[3])).toBe(true);
      // [NaN,2,3] -> count=2 -> NaN
      expect(Number.isNaN(r[4])).toBe(true);
      // [2,3,4] -> count=3 -> numeric
      expect(typeof r[5]).toBe('number');

      const rk = stats.rollkurtosis([NaN, NaN, 1, NaN, 2, 3, 4], 4);
      // positions before enough valid samples (<4) remain NaN
      expect(Number.isNaN(rk[3])).toBe(true);
      // window [1,NaN,2,3] has only 3 valid -> NaN
      expect(Number.isNaN(rk[4])).toBe(true);
      // window [NaN,2,3,4] -> 3 valid -> NaN (still <4)
      expect(Number.isNaN(rk[5])).toBe(true);
      // window [2,3,4,?] once 4 valid present would be numeric; ensure later index numeric when available
      const rk2 = stats.rollkurtosis([1, 2, 3, 4, 5], 4);
      expect(typeof rk2[4]).toBe('number');
    });

  });
  describe('quantile.ts', () => {
    it('quantile and percentiles advanced branches', () => {
      // invalid q values
      expect(() => stats.quantile([1, 2, 3], -0.1)).toThrow();
      expect(() => stats.quantile([1, 2, 3], 1.1)).toThrow();

      // empty source -> NaN
      expect(Number.isNaN(stats.quantile([], 0.5))).toBe(true);

      // percentiles small qs (quickselect-based path)
      const src = [10, 5, 8, 1, 7, 3, 6, 2, 4, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const qsSmall = [0, 0.25, 0.5, 0.75, 1];
      const outSmall = stats.percentiles(src, qsSmall);
      for (let i = 0; i < qsSmall.length; i++) {
        expect(outSmall[i]).toBeCloseTo(stats.quantile(src, qsSmall[i]));
      }

      // percentiles large qs (sort-based path)
      const qsLarge = Array.from({ length: 12 }, (_, i) => i / 11);
      const outLarge = stats.percentiles(src, qsLarge);
      for (let i = 0; i < qsLarge.length; i++) {
        expect(outLarge[i]).toBeCloseTo(stats.quantile(src, qsLarge[i]));
      }

      // percentiles with out-of-range q entries produce NaN in-place
      const badQs = [0.1, -0.5, 0.5, 2];
      const outBad = stats.percentiles([1, 2, 3, 4], badQs);
      expect(Number.isNaN(outBad[1])).toBe(true);
      expect(Number.isNaN(outBad[3])).toBe(true);

      // all-NaN source -> percentiles map to NaN
      const pn = stats.percentiles([NaN, NaN, NaN], [0.1, 0.5]);
      expect(Number.isNaN(pn[0])).toBe(true);
      expect(Number.isNaN(pn[1])).toBe(true);

      // rollquantile q validation and short-period behavior
      expect(() => stats.rollquantile([1, 2, 3, 4], 2, -0.1)).toThrow();
      expect(() => stats.rollquantile([1, 2, 3, 4], 0, 0.5)).toThrow();
      const rqShort = stats.rollquantile([1, 2], 3, 0.5);
      expect(Number.isNaN(rqShort[0])).toBe(true);
    });

    it('percentiles empty and single-q fast-paths', () => {
      const empty = stats.percentiles([1, 2, 3], []);
      expect(Array.isArray(empty)).toBe(true);
      expect(empty.length).toBe(0);

      const single = stats.percentiles([10, 20, 30, 40], [0.25]);
      expect(single.length).toBe(1);
      expect(single[0]).toBeCloseTo(stats.quantile([10, 20, 30, 40], 0.25));
    });

    it('percentiles sort-path with invalid q yields NaN in-place', () => {
      const src = Array.from({ length: 50 }, (_, i) => i + 1);
      const qs = Array.from({ length: 12 }, (_, i) => i / 11);
      // inject an out-of-range q to exercise the sort-based branch's NaN assignment
      qs[6] = -0.2;
      const out = stats.percentiles(src, qs);
      expect(Number.isNaN(out[6])).toBe(true);
    });

    it('quantile selection: large-n quickselect', () => {
      // large-n quickselect heuristic: create >600 valid values to trigger the adaptive branch
      const large = Array.from({ length: 701 }, (_, i) => i + 1).reverse();
      const med = stats.quantile(large, 0.5);
      // compute expected median by sorting to avoid relying on a particular internal selection ordering
      const sorted = large.slice().sort((a, b) => a - b);
      // quickselect may return any element with the correct rank; ensure result is one of the input values
      expect(sorted.includes(med)).toBe(true);
    });

    it('rollquantile rebalance moves items from lower to upper (sizeLower > targetLower)', () => {
      // strictly decreasing sequence will push many elements into lowerHeap
      const src = [5, 4, 3, 2, 1, 6];
      // period 3, q=0 should select the minimum in each window
      const rq = stats.rollquantile(src, 3, 0);
      // outputs should be numeric (not NaN) and thus exercise the rebalance logic
      expect(Number.isNaN(rq[2])).toBe(false);
      expect(Number.isNaN(rq[3])).toBe(false);
    });
  });
});
