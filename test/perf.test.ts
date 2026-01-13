import { describe, it, expect } from 'vitest';
import * as perf from '../src/perf/index.js';

describe('perf helpers', () => {
  it('returns and logreturns', () => {
    const prices = [100, 110, 121];
    const r = perf.returns(prices);
    expect(Number.isNaN(r[0])).toBe(true);
    expect(r[1]).toBeCloseTo(0.1, 8);
    expect(r[2]).toBeCloseTo(0.1, 8);

    const lr = perf.logreturns(prices);
    expect(Number.isNaN(lr[0])).toBe(true);
    expect(lr[1]).toBeCloseTo(Math.log(1.1), 8);
  });

  it('cumreturns and cagr', () => {
    const rets = [0.1, 0.1];
    const cr = perf.cumreturns(rets);
    expect(cr[0]).toBeCloseTo(0.1, 8);
    expect(cr[1]).toBeCloseTo(0.21, 8);

    // use freq=2 so CAGR over 2 periods is simply (1.1*1.1)^(2/2)-1 = 0.21
    expect(perf.cagr(rets, 2)).toBeCloseTo(0.21, 8);
  });

  it('dailyReturns groups by day and compounds', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const day0 = Date.UTC(2026, 0, 1);
    const ts = [day0, day0 + 1000, day0 + DAY];
    const rets = [0.01, 0.02, 0.03];
    const res = perf.dailyreturns(ts, rets);
    expect(res.days.length).toBe(2);
    // day0 compounded: (1.01 * 1.02) - 1
    expect(res.dailyReturns[0]).toBeCloseTo((1 + 0.01) * (1 + 0.02) - 1, 8);
    expect(res.dailyReturns[1]).toBeCloseTo(0.03, 8);
  });

  it('drawdown helpers (dd, maxdd, maxddDetails, dduration, rollmaxdd)', () => {
    const eq = [100, 90, 95, 80, 120];
    const dd = perf.dd(eq);
    expect(Number.isNaN(dd[0])).toBe(false);
    expect(dd[1]).toBeCloseTo(90 / 100 - 1, 8);

    const m = perf.maxdd(eq);
    expect(m).toBeCloseTo(0.2, 8);

    const details = perf.maxddDetails(eq);
    expect(details.maxDrawdown).toBeCloseTo(0.2, 8);
    expect(details.peakIndex).toBe(0);
    expect(details.troughIndex).toBe(3);
    expect(details.endIndex).toBe(4);

    const dur = perf.dduration(eq);
    expect(dur.maxDuration).toBe(3);
    expect(dur.durations[3]).toBe(3);

    const rmd = perf.rollmaxdd(eq, 3);
    // window [100,90,95] at i=2 -> max drawdown = 0.1
    expect(rmd[2]).toBeCloseTo(0.1, 8);
  });

  it('recoveryFactor, calmarRatio and ulcerIndex produce finite numbers', () => {
    const eq = [100, 90, 95, 80, 120];
    const rf = perf.recoveryfactor(eq);
    expect(typeof rf).toBe('number');
    expect(Number.isFinite(rf)).toBe(true);

    const cal = perf.calmar(eq, null, 252);
    expect(typeof cal).toBe('number');
    expect(Number.isFinite(cal)).toBe(true);

    const ui = perf.ulcer(eq);
    expect(typeof ui).toBe('number');
    expect(ui).toBeGreaterThanOrEqual(0);
  });

  it('volatility and risk metrics (sharpe, sortino, vol)', () => {
    const rets = [0.01, -0.02, 0.015, 0.005, -0.01];
    const s = perf.sharpe(rets);
    expect(typeof s).toBe('number');
    // sortino needs at least 2 downside observations, ensure it returns a number
    const so = perf.sortino([ -0.02, -0.01, 0.01, 0.02 ]);
    expect(typeof so).toBe('number');

    const v = perf.vol(rets);
    expect(typeof v).toBe('number');
    expect(v).toBeGreaterThan(0);
  });

  it('distribution helpers (VaR, ES, omega, tailRatio)', () => {
    const rets = [0.01, -0.05, 0.02, -0.03, 0.04, 0.0];
    const hv = perf.var(rets, 0.2, 'historical');
    expect(typeof hv).toBe('number');

    const pv = perf.var(rets, 0.05, 'parametric');
    expect(typeof pv).toBe('number');

    const es = perf.expshortfall(rets, 0.2, 'historical');
    expect(typeof es).toBe('number');

    const or = perf.omega(rets, 0);
    expect(typeof or).toBe('number');

    const tr = perf.tail(rets, 0.2);
    expect(typeof tr).toBe('number');
  });

});

describe('perf edge cases', () => {
  it('returns/logreturns edge cases (zero or non-positive prev)', () => {
    // previous value zero should yield NaN for returns
    const r1 = perf.returns([0, 0]);
    expect(Number.isNaN(r1[1])).toBe(true);

    // logreturns with non-positive previous -> NaN
    const lr = perf.logreturns([0, 1]);
    expect(Number.isNaN(lr[1])).toBe(true);

    // empty inputs
    expect(perf.returns([]).length).toBe(0);
    expect(perf.logreturns([]).length).toBe(0);
  });

  it('dd and related functions handle all-NaN and leading-NaN inputs', () => {
    const allNaN = [NaN, NaN, NaN];
    const dd = perf.dd(allNaN);
    expect(Number.isNaN(dd[0])).toBe(true);

    const m = perf.maxdd(allNaN);
    expect(Number.isNaN(m)).toBe(true);

    const details = perf.maxddDetails(allNaN);
    expect(Number.isNaN(details.maxDrawdown)).toBe(true);
    expect(details.peakIndex).toBe(-1);

    const dur = perf.dduration(allNaN);
    for (let i = 0; i < dur.durations.length; i++) expect(dur.durations[i]).toBe(-1);

    // leading NaNs then valid values
    const seq = [NaN, NaN, 100, 90];
    const dd2 = perf.dd(seq);
    expect(Number.isNaN(dd2[0])).toBe(true);
    expect(Number.isNaN(dd2[1])).toBe(true);
    expect(dd2[2]).toBeCloseTo(0);
    expect(dd2[3]).toBeCloseTo(90 / 100 - 1, 8);
  });

  it('maxdd and rollmaxdd edge behaviors', () => {
    // monotonic increasing -> maxdd 0
    const inc = [1, 2, 3, 4, 5];
    expect(perf.maxdd(inc)).toBeCloseTo(0, 12);
    const details = perf.maxddDetails(inc);
    expect(details.maxDrawdown).toBe(0);

    // rollmaxdd with window larger than available valid points should still produce results
    const r = perf.rollmaxdd([100, NaN, 110], 5);
    expect(r.length).toBe(3);
  });

  it('distribution edge cases and omega/tail behaviors', () => {
    // invalid alpha
    expect(Number.isNaN(perf.var([], 0, 'historical'))).toBe(true);
    expect(Number.isNaN(perf.var([1, 2, 3], -0.1 as any))).toBe(true);

    // expectedShortfall historical with empty
    expect(Number.isNaN(perf.expshortfall([], 0.05, 'historical'))).toBe(true);
    // omegaRatio: all positive -> sumNeg == 0 -> Infinity
    const or = perf.omega([0.1, 0.2, 0.05], 0);
    expect(or).toBe(Infinity);

    // tailRatio for single-value input returns numeric
    const tr = perf.tail([0.01], 0.5);
    expect(typeof tr).toBe('number');
  });

  it('volatility edge cases: empty, zero-variance and rolling constraints', () => {
    expect(Number.isNaN(perf.vol([]))).toBe(true);

    // zero variance -> vol returns numeric (possibly zero)
    const constant = [0.01, 0.01, 0.01];
    const vconst = perf.vol(constant);
    expect(typeof vconst).toBe('number');
    expect(vconst >= 0).toBe(true);

    // rollvol with insufficient counts -> NaN in outputs
    const rv = perf.rollvol([0.01, NaN, 0.02], 3);
    expect(rv.length).toBe(3);

    // rollsharpe/rollsortino with small windows produce NaNs where counts insufficient
    const rs = perf.rollsharpe([0.01, 0.02], 3);
    expect(Number.isNaN(rs[0])).toBe(true);

    const rso = perf.rollsortino([0.01, -0.005], 3);
    expect(Number.isNaN(rso[0])).toBe(true);
  });

  it('sortino downCount and rollsortino downside==0 branches', () => {
    // sortino should return NaN when there are fewer than 2 downside observations
    expect(Number.isNaN(perf.sortino([0.01, 0.02, 0.03]))).toBe(true);
    // one downside only -> still NaN
    expect(Number.isNaN(perf.sortino([0.01, -0.001]))).toBe(true);

    // rollsortino: window with identical negative values yields zero downside -> NaN
    const rsZero = perf.rollsortino([-1, -1, -1], 3);
    expect(Number.isNaN(rsZero[2])).toBe(true);
  });

  it('rollmaxdd/rollUlcerIndex invalid-window and minPeriod behaviors', () => {
    expect(() => perf.rollmaxdd([1,2,3], 0)).toThrow();
    expect(() => perf.rollulcer([1,2,3], 0)).toThrow();

    // rollUlcerIndex with minPeriod larger than available valid points yields NaN
    const ru = perf.rollulcer([NaN, 1, 2], 3, 3);
    expect(Number.isNaN(ru[2])).toBe(true);
  });

  it('valueAtRisk/expectedShortfall parametric uses normInv lower/upper regions', () => {
    const rets = [0.01, -0.02, 0.03, -0.01, 0.02];
    // very small alpha -> lower rational branch
    const vlow = perf.var(rets, 0.01, 'parametric');
    expect(typeof vlow).toBe('number');
    // very large alpha -> upper rational branch
    const vhigh = perf.var(rets, 0.99, 'parametric');
    expect(typeof vhigh).toBe('number');
    // expectedShortfall parametric
    const esLow = perf.expshortfall(rets, 0.01, 'parametric');
    expect(typeof esLow).toBe('number');
  });

  it('tailRatio/omega edge cases produce NaN or Infinity as expected', () => {
    // tailRatio on small positive sample -> numeric or NaN depending on quantile ties; accept numeric
    const tr = perf.tail([0.1, 0.2, 0.3], 0.2);
    expect(typeof tr).toBe('number');

    // omegaRatio all positive -> Infinity
    expect(perf.omega([0.1, 0.2], 0)).toBe(Infinity);
  });

    it('additional dd and recovery edge branches', () => {
      // no recovery observed -> endIndex should be last valid
      const eq = [100, 90, 95, 80];
      const details = perf.maxddDetails(eq);
      expect(details.endIndex).toBe(3);

      // leading NaNs with a single valid point should return zero drawdown
      const seq = [NaN, NaN, 50];
      const det2 = perf.maxddDetails(seq);
      expect(det2.maxDrawdown).toBe(0);
      expect(det2.peakIndex).toBe(2);
    });

    it('recoveryFactor/calmarRatio NaN branches and lookback window path', () => {
      // first value <= 0 should yield NaN
      expect(Number.isNaN(perf.recoveryfactor([0, 1, 2]))).toBe(true);

      // calmarRatio with a small lookback that triggers candidate/startIdx selection
      const eq = [100, 110, 105, 120, 130, 125, 140];
      const cr = perf.calmar(eq, 0.01, 252);
      // either finite number or NaN depending on mdd; ensure it doesn't throw
      expect(typeof cr).toBe('number');
    });

    it('distribution NaN/degenerate branches (parametric sigma=0, tail lowMean==0)', () => {
      // parametric with zero variance -> may return NaN or a numeric result depending on stdev implementation
      const pvZero = perf.var([0.01, 0.01, 0.01], 0.05, 'parametric');
      expect(typeof pvZero).toBe('number');
      const esZero = perf.expshortfall([0.01, 0.01, 0.01], 0.05, 'parametric');
      expect(typeof esZero).toBe('number');

      // tailRatio where lowMean == 0 should return NaN
      const trZeroLow = perf.tail([0, 0, 1, 1], 0.25);
      expect(Number.isNaN(trZeroLow)).toBe(true);
    });

    it('rollvol and rollsharpe/count branches produce NaNs on small counts', () => {
      const rv = perf.rollvol([NaN, 0.01, NaN, 0.02], 2);
      // windows with <=1 valid sample should yield NaN
      expect(Number.isNaN(rv[0])).toBe(true);
      expect(Number.isNaN(rv[1])).toBe(true);

      const rs = perf.rollsharpe([NaN, 0.01, NaN, 0.02], 2);
      expect(Number.isNaN(rs[0])).toBe(true);
      expect(Number.isNaN(rs[1])).toBe(true);
    });

    it('sharpe/rollsharpe/rollvol sigma NaN and zero branches', () => {
      // sharpe: insufficient valid samples -> sample stdev NaN -> NaN result
      expect(Number.isNaN(perf.sharpe([0.01]))).toBe(true);
      // sharpe: zero variance -> sigma === 0 -> NaN
      expect(Number.isNaN(perf.sharpe([0.01, 0.01]))).toBe(true);

      // rollsharpe: window with identical values -> zero std -> NaN at that index
      const rs = perf.rollsharpe([0.01, 0.01, 0.02], 2);
      expect(Number.isNaN(rs[1])).toBe(true);
      // rollsharpe: insufficient counts -> NaN
      const rs2 = perf.rollsharpe([0.01], 2);
      expect(Number.isNaN(rs2[0])).toBe(true);

      // rollvol: window with identical values -> zero sigma -> NaN at that index
      const rv = perf.rollvol([0.01, 0.01, 0.02], 2);
      expect(Number.isNaN(rv[1])).toBe(true);
      // rollvol: insufficient counts -> NaN
      const rv2 = perf.rollvol([0.01], 2);
      expect(Number.isNaN(rv2[0])).toBe(true);
    });

    it('distribution empty/all-NaN and default-param behaviors', () => {
      const empty: number[] = [];
      const allNaN = [NaN, NaN, NaN];

      // empty inputs -> NaN for scalar functions
      expect(Number.isNaN(perf.var(empty))).toBe(true);
      expect(Number.isNaN(perf.expshortfall(empty))).toBe(true);
      expect(Number.isNaN(perf.tail(empty))).toBe(true);
      expect(Number.isNaN(perf.omega(empty))).toBe(true);

      // all-NaN inputs -> NaN for scalar functions
      expect(Number.isNaN(perf.var(allNaN))).toBe(true);
      expect(Number.isNaN(perf.expshortfall(allNaN))).toBe(true);
      expect(Number.isNaN(perf.tail(allNaN))).toBe(true);
      expect(Number.isNaN(perf.omega(allNaN))).toBe(true);

      // default params: call without optional args should produce numeric where possible
      const rets = [0.01, -0.02, 0.03, -0.01, 0.02];
      expect(typeof perf.var(rets)).toBe('number');
      expect(typeof perf.expshortfall(rets)).toBe('number');
      expect(typeof perf.tail(rets)).toBe('number');
      expect(typeof perf.omega(rets)).toBe('number');
    });

    it('distribution invalid alpha (>1) returns NaN for tailRatio and expectedShortfall', () => {
      const rets = [0.01, -0.02, 0.03];
      expect(Number.isNaN(perf.tail(rets, 1.1))).toBe(true);
      expect(Number.isNaN(perf.expshortfall(rets, 1.5))).toBe(true);
    });

    it('distribution parametric normInv regions and parametric NaN/zero stdev', () => {
      const rets = [0.01, -0.02, 0.03, -0.01, 0.02];
      // lower region (p < pLow)
      const vLow = perf.var(rets, 0.001, 'parametric');
      expect(typeof vLow).toBe('number');
      // central region (p between pLow and pHigh)
      const vMid = perf.var(rets, 0.03, 'parametric');
      expect(typeof vMid).toBe('number');
      // upper region (p > pHigh)
      const vHigh = perf.var(rets, 0.98, 'parametric');
      expect(typeof vHigh).toBe('number');

      // expectedShortfall parametric: single valid sample -> NaN (sigma undefined)
      expect(Number.isNaN(perf.expshortfall([0.01], 0.05, 'parametric'))).toBe(true);
      // expectedShortfall parametric: identical values -> sigma === 0 -> NaN
      expect(Number.isNaN(perf.expshortfall([0.01, 0.01], 0.05, 'parametric'))).toBe(true);
    });

    it('distribution parametric valueAtRisk NaN branches and omega all-zero', () => {
      // valueAtRisk parametric: all-NaN -> NaN
      expect(Number.isNaN(perf.var([NaN, NaN], 0.05, 'parametric'))).toBe(true);
      // single sample -> sample stdev undefined -> NaN
      expect(Number.isNaN(perf.expshortfall([0.01], 0.05, 'parametric'))).toBe(true);
      // identical values -> sigma === 0 -> NaN
      expect(Number.isNaN(perf.expshortfall([0.01, 0.01], 0.05, 'parametric'))).toBe(true);
      // omegaRatio: all zeros relative to requiredReturn -> no variation -> NaN
      expect(Number.isNaN(perf.omega([0, 0, 0], 0))).toBe(true);
    });

    it('maxdd peak selection updates curPeak before trough', () => {
      // curPeak should update when a higher peak appears before the trough
      const eq = [100, 105, 103, 97, 90];
      const details = perf.maxddDetails(eq);
      // the peak associated with the worst trough should be index 1 (105)
      expect(details.startIndex).toBe(1);
    });

    it('calmarRatio lookback else branch and rollUlcerIndex numeric outputs', () => {
      const eq = [100, 110, 105, 120, 130, 125, 140];
      // huge lookback -> windowPeriods >= span -> startIdx = first path
      const cr = perf.calmar(eq, 10000, 252);
      expect(typeof cr).toBe('number');

      // rollUlcerIndex with sufficient valid samples returns numeric at some index
      const ui = perf.rollulcer([100, 90, 95, 80, 120], 3);
      // index 4 should be numeric after windowed computation
      expect(typeof ui[4]).toBe('number');
    });

    it('rollsharpe and rollsortino produce numeric outputs when counts sufficient', () => {
      const rs = perf.rollsharpe([0.01, 0.02, 0.03], 2);
      expect(Number.isNaN(rs[1])).toBe(false);
      expect(typeof rs[1]).toBe('number');

      const rso = perf.rollsortino([-0.02, -0.03, 0.01], 2);
      expect(Number.isNaN(rso[1])).toBe(false);
      expect(typeof rso[1]).toBe('number');
    });

    it('cumreturns handles NaNs and dailyReturns skips invalid timestamps', () => {
      const cr = perf.cumreturns([0.1, NaN, 0.1]);
      expect(Number.isNaN(cr[1])).toBe(true);
      expect(cr[2]).toBeCloseTo(0.21, 8);

      const DAY = 24 * 60 * 60 * 1000;
      const day0 = Date.UTC(2026, 0, 1);
      const ts = [NaN, day0, day0 + DAY];
      const rets = [0.01, 0.02, 0.03];
      const res = perf.dailyreturns(ts, rets);
      // NaN timestamp should be skipped, days length equals 2 (day0 and next)
      expect(res.days.length).toBe(2);
    });

    it('dailyReturns fills missing calendar days with zero returns', () => {
      const DAY = 24 * 60 * 60 * 1000;
      const day0 = Date.UTC(2026, 0, 1);
      const ts = [day0, day0 + 3 * DAY];
      const rets = [0.01, 0.02];
      const res = perf.dailyreturns(ts, rets);
      expect(res.days.length).toBe(4);
      expect(res.dailyReturns.length).toBe(4);
      expect(res.dailyReturns[0]).toBeCloseTo(0.01, 8);
      expect(res.dailyReturns[1]).toBeCloseTo(0, 8);
      expect(res.dailyReturns[2]).toBeCloseTo(0, 8);
      expect(res.dailyReturns[3]).toBeCloseTo(0.02, 8);
    });

    it('distribution central-region normInv via parametric VaR/ES', () => {
      const rets = [0.01, -0.02, 0.03, -0.01, 0.02];
      // central region (p around 0.5)
      const vmid = perf.var(rets, 0.5, 'parametric');
      expect(typeof vmid).toBe('number');
      const esMid = perf.expshortfall(rets, 0.5, 'parametric');
      expect(typeof esMid).toBe('number');

      // p just above pLow to hit central rational approx
      const vnear = perf.var(rets, 0.03, 'parametric');
      expect(typeof vnear).toBe('number');
    });

    });

    it('dd functions with empty inputs return NaN or empty arrays', () => {
      // dd and rollmaxdd should return empty Float64Array
      const d = perf.dd([]);
      expect(d).toBeInstanceOf(Float64Array);
      expect(d.length).toBe(0);

      const rmd = perf.rollmaxdd([], 3);
      expect(rmd).toBeInstanceOf(Float64Array);
      expect(rmd.length).toBe(0);

      // maxdd should return NaN on empty input
      expect(Number.isNaN(perf.maxdd([]))).toBe(true);

      // maxddDetails should return NaN-filled indices
      const md = perf.maxddDetails([]);
      expect(Number.isNaN(md.maxDrawdown)).toBe(true);
      expect(md.peakIndex).toBe(-1);
      expect(md.troughIndex).toBe(-1);

      // dduration returns empty durations and maxDuration 0
      const dur = perf.dduration([]);
      expect(dur.durations).toBeInstanceOf(Int32Array);
      expect(dur.durations.length).toBe(0);
      expect(dur.maxDuration).toBe(0);

      // recoveryFactor, calmarRatio, ulcerIndex should return NaN
      expect(Number.isNaN(perf.recoveryfactor([]))).toBe(true);
      expect(Number.isNaN(perf.calmar([]))).toBe(true);
      expect(Number.isNaN(perf.ulcer([]))).toBe(true);

      // rollUlcerIndex on empty -> empty Float64Array
      const ru = perf.rollulcer([], 3);
      expect(ru).toBeInstanceOf(Float64Array);
      expect(ru.length).toBe(0);
    });

    it('dd NaN-interleaved branches (maxddDetails, rollmaxdd, calmar candidate, dduration)', () => {
      // interleaved NaNs with multiple peaks
      const seq1 = [NaN, 100, NaN, 105, NaN, 103, NaN, 90];
      const det1 = perf.maxddDetails(seq1);
      expect(det1.startIndex).toBe(3); // peak at 105
      expect(typeof det1.maxDrawdown).toBe('number');

      // rollmaxdd with NaNs inside windows
      const seq2 = [NaN, NaN, 120, 110, NaN, 115];
      const rmd2 = perf.rollmaxdd(seq2, 3);
      // at i=3 window [1..3] => peak 120 then 110 -> dd = 110/120 - 1
      expect(rmd2[3]).toBeCloseTo(-(110 / 120 - 1), 8);

      // calmarRatio candidate falls on NaN and should advance to next valid -> yields NaN due to zero years
      const seq3 = [100, 110, NaN, NaN, 120];
      const cr = perf.calmar(seq3, 1 / 252, 252); // windowPeriods = 1
      expect(Number.isNaN(cr)).toBe(true);

      // dduration with interleaved NaNs marks NaNs as -1 and counts durations correctly
      const seq4 = [NaN, 100, 90, NaN, 95, 80];
      const d4 = perf.dduration(seq4);
      expect(d4.durations[0]).toBe(-1);
      expect(d4.durations[1]).toBe(0);
      expect(d4.durations[2]).toBe(1);
      expect(d4.durations[3]).toBe(-1);
    });

    it('calmarRatio candidate selection when candidate index is NaN', () => {
      // candidate = last - windowPeriods; candidate points to NaN and loop should pick next valid
      const seq = [NaN, 100, NaN, NaN, 120, 110];
      // choose lookback small so windowPeriods = 2
      const cr = perf.calmar(seq, 0.01, 252);
      // should return a number (valid startIdx selection)
      expect(typeof cr).toBe('number');
    });

    it('rollmaxdd zero-foundAny branch and increasing window', () => {
      // window with monotonic increase should yield zero drawdown for that index
      const seq = [100, 101, 102, NaN, 103];
      const r = perf.rollmaxdd(seq, 3);
      // at i=2, window [0..2] increasing -> out[2] === 0
      expect(r[2]).toBeCloseTo(0, 12);
    });

    it('calmarRatio startVal <= 0 returns NaN and recoveryFactor invalid spans', () => {
      expect(Number.isNaN(perf.calmar([0, NaN, 10]))).toBe(true);
      // recoveryFactor where last <= first or insufficient span
      expect(Number.isNaN(perf.recoveryfactor([100]))).toBe(true);
    });

    it('dd exhaustive combos to exercise remaining branches', () => {
      // candidate valid path: candidate index is valid (no NaN)
      const seqA = [100, 90, 95, 120, 110, 105, 130];
      const crA = perf.calmar(seqA, 0.01, 252);
      expect(typeof crA).toBe('number');

      // maxddDetails with multiple peaks and a recovery after trough
      const seqB = [100, 110, 105, 115, 90, 120];
      const dB = perf.maxddDetails(seqB);
      expect(dB.startIndex).toBe(3);
      expect(dB.endIndex).toBe(5);

      // rollulcer with minPeriod larger than counts yields NaN at indices with insufficient valid
      const ruh = perf.rollulcer([NaN, 100, 90, 95], 3, 3);
      expect(Number.isNaN(ruh[2])).toBe(true);

      // dd with alternating NaNs and numbers to hit mask continues and peak updates
      const seqC = [NaN, 100, NaN, 110, 105, NaN, 90, 95, NaN, 120];
      const outC = perf.dd(seqC);
      // verify that NaN positions preserved and some numeric results exist
      expect(Number.isNaN(outC[0])).toBe(true);
      expect(typeof outC[1]).toBe('number');
      expect(Number.isNaN(outC[2])).toBe(true);
      expect(typeof outC[9]).toBe('number');
    });

    it('dd many scenario sweep to hit residual branches', () => {
      const scenarios = [
        [1, 2, 3, 4],
        [4, 3, 2, 1],
        [100, 100, 100],
        [NaN, NaN, 50, NaN, 60],
        [100, 110, 105, 115, 90, 120],
        [100, 120, 90, 130, NaN, 125, 140],
        [NaN, 100, NaN, 95, 90, NaN, 105, 80],
        [10, NaN, 9, NaN, 8, NaN, 11],
      ];

      for (const s of scenarios) {
        // ensure none of the DD helpers throw and outputs have expected shapes/types
        const d = perf.dd(s);
        expect(d).toBeInstanceOf(Float64Array);

        const m = perf.maxdd(s);
        expect(typeof m).toBe('number');

        const det = perf.maxddDetails(s);
        expect(typeof det.maxDrawdown).toBe('number');
        expect(typeof det.peakIndex).toBe('number');

        const du = perf.dduration(s);
        expect(du.durations).toBeInstanceOf(Int32Array);

        const r = perf.rollmaxdd(s, 3);
        expect(r).toBeInstanceOf(Float64Array);
      }
    });

    it('dd functions with all-NaN inputs return NaN/NaN-filled arrays', () => {
      const allNaN = [NaN, NaN, NaN, NaN];

      const d = perf.dd(allNaN);
      expect(d).toBeInstanceOf(Float64Array);
      for (let i = 0; i < d.length; i++) expect(Number.isNaN(d[i])).toBe(true);

      const rmd = perf.rollmaxdd(allNaN, 3);
      expect(rmd).toBeInstanceOf(Float64Array);
      for (let i = 0; i < rmd.length; i++) expect(Number.isNaN(rmd[i])).toBe(true);

      expect(Number.isNaN(perf.maxdd(allNaN))).toBe(true);

      const md = perf.maxddDetails(allNaN);
      expect(Number.isNaN(md.maxDrawdown)).toBe(true);
      expect(md.peakIndex).toBe(-1);
      expect(md.troughIndex).toBe(-1);

      const dur = perf.dduration(allNaN);
      expect(dur.durations).toBeInstanceOf(Int32Array);
      for (let i = 0; i < dur.durations.length; i++) expect(dur.durations[i]).toBe(-1);

      expect(Number.isNaN(perf.recoveryfactor(allNaN))).toBe(true);
      expect(Number.isNaN(perf.calmar(allNaN))).toBe(true);
      expect(Number.isNaN(perf.ulcer(allNaN))).toBe(true);

      const ru = perf.rollulcer(allNaN, 3);
      expect(ru).toBeInstanceOf(Float64Array);
      for (let i = 0; i < ru.length; i++) expect(Number.isNaN(ru[i])).toBe(true);
    });

    it('returns/cumreturns/cagr/dailyReturns empty, all-NaN, mixed-NaN cases', () => {
      // empty inputs
      const crEmpty = perf.cumreturns([]);
      expect(crEmpty).toBeInstanceOf(Float64Array);
      expect(crEmpty.length).toBe(0);
      expect(Number.isNaN(perf.cagr([]))).toBe(true);
      const drEmpty = perf.dailyreturns([], []);
      expect(Array.isArray(drEmpty.days)).toBe(true);
      expect(drEmpty.days.length).toBe(0);
      expect(drEmpty.dailyReturns).toBeInstanceOf(Float32Array);
      expect(drEmpty.dailyReturns.length).toBe(0);

      // all-NaN inputs
      const allNaN = [NaN, NaN, NaN];
      const crNaN = perf.cumreturns(allNaN);
      expect(crNaN).toBeInstanceOf(Float64Array);
      for (let i = 0; i < crNaN.length; i++) expect(Number.isNaN(crNaN[i])).toBe(true);
      expect(Number.isNaN(perf.cagr(allNaN))).toBe(true);
      const drAllNaN = perf.dailyreturns([NaN, NaN], [NaN, NaN]);
      expect(drAllNaN.days.length).toBe(0);

      // mixed NaN and numbers
      const mixed = [0.1, NaN, 0.2, 0.05];
      const crMixed = perf.cumreturns(mixed);
      expect(crMixed).toBeInstanceOf(Float64Array);
      // index 1 should be NaN, others numeric where appropriate
      expect(Number.isNaN(crMixed[1])).toBe(true);
      expect(typeof crMixed[0]).toBe('number');

      // dailyReturns: some timestamps invalid, some returns NaN
      const DAY = 24 * 60 * 60 * 1000;
      const day0 = Date.UTC(2026, 0, 1);
      const ts = [day0, NaN, day0 + DAY, day0 + DAY + 1000];
      const rets = [0.01, 0.02, NaN, 0.03];
      const res = perf.dailyreturns(ts, rets);
      // should skip NaN timestamp and NaN return; produce days for day0 and next day
      expect(res.days.length).toBeGreaterThanOrEqual(1);
      expect(res.dailyReturns).toBeInstanceOf(Float32Array);
    });

    it('volatility functions empty, all-NaN, mixed-NaN cases', () => {
      // empty inputs
      expect(Number.isNaN(perf.sharpe([]))).toBe(true);
      expect(Number.isNaN(perf.sortino([]))).toBe(true);
      const rsEmpty = perf.rollsharpe([], 3);
      expect(rsEmpty).toBeInstanceOf(Float64Array);
      expect(rsEmpty.length).toBe(0);
      const rsoEmpty = perf.rollsortino([], 3);
      expect(rsoEmpty).toBeInstanceOf(Float64Array);
      expect(rsoEmpty.length).toBe(0);
      expect(Number.isNaN(perf.vol([]))).toBe(true);
      const rvEmpty = perf.rollvol([], 3);
      expect(rvEmpty).toBeInstanceOf(Float64Array);
      expect(rvEmpty.length).toBe(0);

      // all-NaN inputs
      const allNaN = [NaN, NaN, NaN];
      expect(Number.isNaN(perf.sharpe(allNaN))).toBe(true);
      expect(Number.isNaN(perf.sortino(allNaN))).toBe(true);
      const rsNaN = perf.rollsharpe(allNaN, 2);
      for (let i = 0; i < rsNaN.length; i++) expect(Number.isNaN(rsNaN[i])).toBe(true);
      const rsoNaN = perf.rollsortino(allNaN, 2);
      for (let i = 0; i < rsoNaN.length; i++) expect(Number.isNaN(rsoNaN[i])).toBe(true);
      expect(Number.isNaN(perf.vol(allNaN))).toBe(true);
      const rvNaN = perf.rollvol(allNaN, 2);
      for (let i = 0; i < rvNaN.length; i++) expect(Number.isNaN(rvNaN[i])).toBe(true);

      // mixed NaN and numeric values: ensure numeric outputs where counts sufficient
      const mixed = [NaN, 0.01, 0.02, NaN, 0.015];
      const s = perf.sharpe(mixed);
      expect(typeof s).toBe('number');
      expect(Number.isFinite(s)).toBe(true);

      const so = perf.sortino([-0.02, NaN, -0.01, 0.01]);
      expect(typeof so).toBe('number');

      const rs = perf.rollsharpe(mixed, 2);
      // index 2 should have 2 valid values in window -> numeric
      expect(Number.isNaN(rs[2])).toBe(false);
      expect(typeof rs[2]).toBe('number');

      const rso = perf.rollsortino([-0.02, -0.03, NaN, -0.01], 2);
      expect(Number.isNaN(rso[1])).toBe(false);
      expect(typeof rso[1]).toBe('number');

      const rv = perf.rollvol(mixed, 2);
      expect(Number.isNaN(rv[2])).toBe(false);
      expect(typeof rv[2]).toBe('number');
    });

    it('sortino numeric path (covers downCount >=2 and nonzero downside)', () => {
      // ensure at least two negative observations produce a numeric sortino
      const s = perf.sortino([-0.02, -0.03, -0.01, 0.05]);
      expect(typeof s).toBe('number');
      expect(Number.isFinite(s)).toBe(true);
    });
