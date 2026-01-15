import { describe, it, expect } from 'vitest';
import { arr, ta, math } from '../src/index.js';
import * as tulind from 'tulind';
import { PERIOD, CLOSE, HIGH, LOW, VOLUME, compareToTulind, tulindRun, CLOSE_GAPPED, SLICED_INPUT, assert_arrays_close, talibRun, adaptTulindResults } from './helpers';
import { ALL_NAN, SHORT_INPUT } from './helpers.js';

describe('1-input indicators', () => {
  ['sma', 'ema', 'dema', 'tema', 'wma',
    'hma', 'kama', 'trima', 'rma',
    'stochrsi', 'dpo', 'rsi', 'cmo', 'change', 'mom'
  ].forEach(fn => {
    it(`${fn} matches Tulind`, async () => {
      let tulFn = fn;
      if (fn === 'rma') tulFn = 'wilders';
      if (fn === 'change') tulFn = 'roc';
      compareToTulind((ta as any)[fn](CLOSE, PERIOD), await tulindRun(tulind.indicators[tulFn], CLOSE, PERIOD));
    });
    it('throws error if period <= 0', () => {
      expect(() => (ta as any)[fn](CLOSE, 0)).toThrow();
      expect(() => (ta as any)[fn](CLOSE, -1)).toThrow();
    });

    it('returns all NaN if n < required period or input is all NaN', () => {
      expect(arr.allna((ta as any)[fn](SHORT_INPUT, PERIOD))).toBe(true);
      expect(arr.allna((ta as any)[fn](ALL_NAN, PERIOD))).toBe(true);
    });
  });
});
describe('hlc-inputs indicators', () => {
  ['dx', 'adx', 'adxr', 'atr',
    'natr', 'cci', 'wpr'
  ].forEach(fn => {
    it(`${fn} matches Tulind`, async () => {
      const qnt = (ta as any)[fn](HIGH, LOW, CLOSE, PERIOD);
      let tulFn = fn;
      if (fn === 'wpr') tulFn = 'willr';
      const tul = (await tulindRun(tulind.indicators[tulFn], [HIGH, LOW, CLOSE], PERIOD));
      compareToTulind(qnt, tul);
    });
    it(`${fn} throws if period <= 0`, () => {
      expect(() => (ta as any)[fn](HIGH, LOW, CLOSE, 0 )).toThrow();
      expect(() => (ta as any)[fn](HIGH, LOW, CLOSE, -1 )).toThrow();
    });
    it(`${fn} throws if input lengths differ`, () => {
      expect(() => (ta as any)[fn](SLICED_INPUT, LOW, CLOSE, PERIOD )).toThrow();
      expect(() => (ta as any)[fn](HIGH, SLICED_INPUT, CLOSE, PERIOD )).toThrow();
      expect(() => (ta as any)[fn](HIGH, LOW, SLICED_INPUT, PERIOD )).toThrow();
    });
    it(`${fn} returns all NaN if n < required period`, () => {
      expect(arr.allna((ta as any)[fn](SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, PERIOD))).toBe(true);
    });

    it(`${fn} returns all NaN if any input is all NaN`, () => {
      expect(arr.allna((ta as any)[fn](ALL_NAN, LOW, CLOSE, PERIOD ))).toBe(true);
      expect(arr.allna((ta as any)[fn](HIGH, ALL_NAN, CLOSE, PERIOD ))).toBe(true);
      expect(arr.allna((ta as any)[fn](HIGH, LOW, ALL_NAN, PERIOD ))).toBe(true);
    });
  });

});
describe('AO', () => {
  it('matches Tulind', async () => {
    compareToTulind(ta.ao(HIGH, LOW), await tulindRun(tulind.indicators.ao, [HIGH, LOW]));
  });
  it('returns all NaN if any input is all NaN', () => {
    expect(arr.allna(ta.ao(ALL_NAN, LOW, 5, 24))).toBe(true);
    expect(arr.allna(ta.ao(HIGH, ALL_NAN, 5, 24))).toBe(true);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.ao(HIGH.slice(0, 10), LOW, 5, 24)).toThrow();
  });

  it('parameter validation and short/long behavior', () => {
    // invalid periods
    expect(() => ta.ao(HIGH, LOW, 0, 10)).toThrow();
    expect(() => ta.ao(HIGH, LOW, 5, 0)).toThrow();
    // short >= long should throw
    expect(() => ta.ao(HIGH, LOW, 10, 5)).toThrow();
  });

  it('n < longPeriod returns NaN-filled output', () => {
    const h = [1,2,3,4,5,6,7];
    const l = [0,1,2,3,4,5,6];
    // longPeriod larger than series length -> all NaN
    const out = ta.ao(h, l, 3, 10);
    expect(out.length).toBe(h.length);
    for (let v of out) expect(Number.isNaN(v)).toBe(true);
  });

  it('dense vs NaN-aware produce same result on dense inputs', () => {
    const h = [10,11,12,13,14,15,16,17];
    const l = [9,10,11,12,13,14,15,16];
    // dense fast-path (skipna=false) vs default (skipna=true) should match for no-NaN inputs
    const d = ta.ao(h, l, 3, 5, false);
    const n = ta.ao(h, l, 3, 5, true);
    expect(d.length).toBe(n.length);
    // compare only from the first index where both windows are full
    const start = 5 - 1; // longPeriod - 1
    for (let i = start; i < d.length; i++) {
      const dv = d[i];
      const nv = n[i];
      expect(Number.isNaN(dv)).toBe(false);
      expect(Number.isNaN(nv)).toBe(false);
      expect(dv).toBeCloseTo(nv as number);
    }
  });

  it('NaN handling when skipna true produces NaNs in outputs', () => {
    const h = [1, NaN, 3, 4, 5, 6, NaN, 8];
    const l = [0, NaN, 2, 3, 4, 5, NaN, 7];
    const out = ta.ao(h, l, 3, 5, true);
    // outputs at positions that depend on NaN windows should be NaN
    let sawNaN = false;
    for (let i = 0; i < out.length; i++) { if (Number.isNaN(out[i])) sawNaN = true; }
    expect(sawNaN).toBe(true);
  });
});

describe('AROON', () => {
  it('matches Tulind', async () => {
    const [qUp, qDown] = ta.aroon(HIGH, LOW, 14);
    const tul = await tulindRun(tulind.indicators.aroon, [HIGH, LOW], 14);
    // Tulind returns [aroonDown, aroonUp] so compare accordingly
    try {
      compareToTulind(qUp, tul[1]);
      compareToTulind(qDown, tul[0]);
    } catch (err) {
      // Diagnostic logs to inspect mismatch between our outputs and Tulind
      console.error('\n--- AROON DIAGNOSTIC ---');
      console.error('qUp finite count:', Array.from(qUp).filter(Number.isFinite).length);
      console.error('qDown finite count:', Array.from(qDown).filter(Number.isFinite).length);
      console.error('tul lengths:', tul.length, tul[0]?.length, tul[1]?.length);
      console.error('first 40 qUp:', Array.from(qUp).slice(0,40));
      console.error('first 40 qDown:', Array.from(qDown).slice(0,40));
      console.error('first 40 tulUp (adapted):', tul[1].slice(0,40));
      console.error('first 40 tulDown (adapted):', tul[0].slice(0,40));

      // More diagnostics: find first index where both are finite and differ
      const adaptedTulUp = adaptTulindResults(qUp, tul[1], qUp.length);
      const n = qUp.length; let mism = -1;
      for (let i=0;i<n;i++) {
        if (Number.isFinite(qUp[i]) && Number.isFinite(adaptedTulUp[i]) && Math.abs(qUp[i] - adaptedTulUp[i]) > 1e-9) { mism = i; break; }
      }
      if (mism !== -1) {
        console.error('First mismatch index', mism, 'qUp', qUp[mism], 'tul', adaptedTulUp[mism]);
        const i = mism + 1; const start = i - 14 + 1; console.error('lookback window indices', start, 'to', i);
        console.error('HIGH window:', HIGH.slice(Math.max(0,start), Math.min(HIGH.length, i+1)));
        console.error('LOW window:', LOW.slice(Math.max(0,start), Math.min(LOW.length, i+1)));
        const tulVal = adaptedTulUp[mism];
        const tul_daysSinceHigh = Number.isFinite(tulVal) ? Math.round(14 - (tulVal/100)*14) : NaN;
        const tulHiIdx = Number.isFinite(tul_daysSinceHigh) ? i - tul_daysSinceHigh : NaN;
        console.error('Tulind implied hiIdx', tulHiIdx, 'value', HIGH[tulHiIdx]);

        // compare to our rolling argmax indices
        const argMax = math.rollargmax(HIGH, 14);
        console.error('argMax at i-1, i, i+1:', argMax[mism-1], argMax[mism], argMax[mism+1]);
        console.error('values at argMax indices:', HIGH[argMax[mism-1]], HIGH[argMax[mism]], HIGH[argMax[mism+1]]);
      } else {
        console.error('No per-index finite mismatch found (unexpected)');
      }

      throw err;
    }
  });
  it('returns all NaN if any input is all NaN', () => {
    const [aUp, aDown] = ta.aroon(ALL_NAN, LOW, 14);
    expect(arr.allna(aUp) && arr.allna(aDown)).toBe(true);
    const [bUp, bDown] = ta.aroon(HIGH, ALL_NAN, 14);
    expect(arr.allna(bUp) && arr.allna(bDown)).toBe(true);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.aroon(HIGH.slice(0, 10), LOW, 14)).toThrow();
  });
  
  it('validation, short series and dense expected values', () => {
    expect(() => ta.aroon(HIGH, LOW, 0)).toThrow();
    // short series < period => outputs all NaN
    const h = [1,2,3,4];
    const l = [0,1,1,2];
    const [up, down] = ta.aroon(h, l, 6);
    for (let v of up) expect(Number.isNaN(v)).toBe(true);
    for (let v of down) expect(Number.isNaN(v)).toBe(true);
    
    // dense path: small example check against manual window scan
    const hd = [1,2,3,2,4];
    const ld = [0,1,1,1,2];
    const period = 3;
    const [ud, dd] = ta.aroon(hd, ld, period, false);
    // expected: up indices: [NaN, NaN, 66.666..., 100, NaN]
    expect(Number.isNaN(ud[0])).toBe(true);
    expect(Number.isNaN(ud[1])).toBe(true);
    // expected computed values for these windows
    expect(ud[2]).toBeCloseTo(100 * (2 / 3)); // 66.666...
    expect(ud[3]).toBeCloseTo(100); // full 100 when highest at window end
  });

  it('NaN-aware returns NaNs when inputs have gaps', () => {
    const h = [1, NaN, 3, 4, NaN, 6];
    const l = [0, NaN, 2, 3, NaN, 5];
    const [up, down] = ta.aroon(h, l, 3, true);
    // since inputs have NaN, function should return NaN-filled outputs
    expect(arr.allna(up)).toBe(true);
    expect(arr.allna(down)).toBe(true);
  });
});

describe('KST', () => {
  it('returns all NaN if input is all NaN', () => {
    expect(arr.allna(ta.kst(ALL_NAN))).toBe(true);
  });
  it('throws error if any period <= 0', () => {
    expect(() => ta.kst(CLOSE, { r1: 10, r2: 15, r3: 0, r4: 30 })).toThrow();
    expect(() => ta.kst(CLOSE, { r1: 10, r2: 15, r3: 20, r4: 30, n1: 0, n2: 10, n3: 10, n4: 15 })).toThrow();
  });
});
describe('APO/PPO', () => {
  ['apo', 'ppo'].forEach(fn => {
    it('matches Tulind', async () => {
      compareToTulind((ta as any)[fn](CLOSE, 12, 26), await tulindRun(tulind.indicators[fn], [CLOSE], undefined, [12, 26]));
    });
    it('throws error if periods <= 0', () => {
      for (const [short, long] of [[0, 26], [12, 0], [-1, 26], [12, -1]]) {
        expect(() => (ta as any)[fn](CLOSE, short, long)).toThrow();
      }
    });
    it('returns all NaN if n < required period or inputs are all NaN', () => {
      expect(arr.allna((ta as any)[fn]([1, 2, 3], 2, 5))).toBe(true);
      expect(arr.allna((ta as any)[fn](ALL_NAN, 12, 26))).toBe(true);
    });
  });
});
describe('STOCH', () => {
  it('matches Tulind', async () => {
    const qnt = ta.stoch(HIGH, LOW, CLOSE, 5, 3, 10);
    const tul = await tulindRun(tulind.indicators.stoch, [HIGH, LOW, CLOSE], undefined, [5, 3, 10]);
    compareToTulind(qnt[0], tul[0]);
    compareToTulind(qnt[1], tul[1]);
  });
  it('throws error if periods <= 0', () => {
    for (const [kPeriod, kSlow, dPeriod] of [[0, 3, 10], [5, 0, 10], [5, 3, 0], [-1, 3, 10]]) {
      expect(() => ta.stoch(HIGH, LOW, CLOSE, kPeriod, kSlow, dPeriod)).toThrow();
    }
  });
  it('returns all NaN if n < required period or inputs are all NaN', () => {
    expect(ta.stoch(SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, 5, 3, 10).every(a => arr.allna(a))).toBe(true);
    expect(ta.stoch(ALL_NAN, ALL_NAN, ALL_NAN, 5, 3, 10).every(a => arr.allna(a))).toBe(true);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.stoch(HIGH.slice(0, 10), LOW, CLOSE, 5, 3, 10)).toThrow();
  });
});

describe('DI', () => {
  it('matches Tulind', async () => {
    const [diplus, diminus] = ta.di(HIGH, LOW, CLOSE, PERIOD);
    const [tulPlus, tulMinus] = await tulindRun(tulind.indicators.di, [HIGH, LOW, CLOSE], PERIOD);
    compareToTulind(diplus, tulPlus);
    compareToTulind(diminus, tulMinus);
  });

});

describe('MACD', () => {
  it('matches Tulind', async () => {
    const [qMacd, qSignal, qHist] = ta.macd(CLOSE, 5, 20, 10);
    const [tMacd, tSignal, tHist] = await tulindRun(tulind.indicators.macd, [CLOSE], undefined, [5, 20, 10]);
    compareToTulind(qMacd, tMacd); compareToTulind(qSignal, tSignal); compareToTulind(qHist, tHist);
  });
  it('throws error if periods <= 0', () => {
    for(const [short, long, signal] of [[0, 20, 10], [5, 0, 10], [5, 20, 0], [-1, 20, 10]]){
      expect(() => ta.macd(CLOSE, short, long, signal)).toThrow();
    }
  });
  it('returns all NaN if n < required period or input is all NaN', () => {
    expect(ta.macd(SHORT_INPUT, PERIOD, PERIOD+1, PERIOD+2).every(a => arr.allna(a))).toBe(true);
    expect(ta.macd(ALL_NAN, 5, 20, 10).every(a => arr.allna(a))).toBe(true);
  });
});


describe('OBV', () => {
  it('matches Tulind', async () => {
    const quant = ta.obv(CLOSE, VOLUME);
    const tul = await tulindRun(tulind.indicators.obv, [CLOSE, VOLUME]);
    compareToTulind(quant, tul);
  });

  it('throws error if input lengths differ', () => {
    const closeShort = CLOSE.slice(0, 10);
    const volumeFull = VOLUME;
    expect(() => ta.obv(closeShort, volumeFull)).toThrow();
  });
  it('returns empty output for empty input', () => {
    const out = ta.obv([], []);
    expect(out.length).toBe(0);
  });
  it('skips NaNs and preserves accumulator across gaps', () => {
    const price = [1, 2, NaN, 3, 4];
    const volume = [10, 10, 10, 10, 10];
    const out = ta.obv(price, volume);
    expect(out.length).toBe(price.length);
    // initial
    expect(out[0]).toBeCloseTo(0);
    // after first rise
    expect(out[1]).toBeCloseTo(10);
    // NaN positions should be NaN
    expect(Number.isNaN(out[2])).toBe(true);
    expect(Number.isNaN(out[3])).toBe(true);
    // accumulator preserved and updated when valid comparison resumes
    expect(out[4]).toBeCloseTo(20);
  });
  it('preserves OBV when price does not change (price[i] === price[i-1])', () => {
    const price = [1, 1, 2, 2, 3];
    const volume = [5, 5, 10, 10, 10];
    const out = ta.obv(price, volume);
    expect(out.length).toBe(price.length);
    // start at 0
    expect(out[0]).toBeCloseTo(0);
    // no change at index 1 -> OBV stays 0
    expect(out[1]).toBeCloseTo(0);
    // rise at index 2 -> +10
    expect(out[2]).toBeCloseTo(10);
    // no change at index 3 -> stays 10
    expect(out[3]).toBeCloseTo(10);
    // rise at index 4 -> +10 -> 20
    expect(out[4]).toBeCloseTo(20);
  });
});

describe('BB', () => {
  it('matches Tulind', async () => {
    const quant = ta.bb(CLOSE, PERIOD, 2);
    const tul = await tulindRun(tulind.indicators.bbands, [CLOSE], undefined, [PERIOD, 2]);
    // tulind BB returns [lower, middle, upper]
    compareToTulind(quant[0], tul[1]); // middle
    compareToTulind(quant[2], tul[0]); // lower
    compareToTulind(quant[1], tul[2]); // upper
  });

  it('throws error if period <= 0', () => {
    expect(() => ta.bb(CLOSE, 0, 2)).toThrow();
    expect(() => ta.bb(CLOSE, -1, 2)).toThrow();
  });

  it('returns all NaN if n < required period or input is all NaN', () => {
    expect(ta.bb(SHORT_INPUT, PERIOD, 2).every(a => arr.allna(a))).toBe(true);
    expect(ta.bb(ALL_NAN, PERIOD, 2).every(a => arr.allna(a))).toBe(true);
  });

});

describe('BBW', () => {
  it('throws error if period <= 0', () => {
    expect(() => ta.bbw(CLOSE, 0, 2)).toThrow();
    expect(() => ta.bbw(CLOSE, -1, 2)).toThrow();
  });

  it('returns empty output for empty input', () => {
    const out = ta.bbw([], 5, 2);
    expect(out.length).toBe(0);
  });
});

describe('KELTNER', () => {
  it('throws error if period <= 0', () => {
    expect(() => ta.keltner(HIGH, LOW, CLOSE, 0, 1)).toThrow();
    expect(() => ta.keltner(HIGH, LOW, CLOSE, -1, 1)).toThrow();
  });

  it('returns empty outputs for empty input', () => {
    const [m,u,l] = ta.keltner([], [], [], 5, 1);
    expect(m.length).toBe(0);
    expect(u.length).toBe(0);
    expect(l.length).toBe(0);
  });

  it('throws when input lengths mismatch', () => {
    expect(() => ta.keltner(HIGH.slice(0,5), LOW, CLOSE, 3, 1)).toThrow();
    expect(() => ta.keltner(HIGH, LOW.slice(0,5), CLOSE, 3, 1)).toThrow();
    expect(() => ta.keltner(HIGH, LOW, CLOSE.slice(0,5), 3, 1)).toThrow();
  });
});

describe('DONCHIAN', () => {
  it('validation and mismatched lengths', () => {
    expect(() => ta.donchian(HIGH, LOW, 0)).toThrow();
    expect(() => ta.donchian(HIGH.slice(0, 5), LOW, 3)).toThrow();
    expect(() => ta.donchian(HIGH, LOW.slice(0, 5), 3)).toThrow();
  });

  it('n < period returns NaN-filled outputs', () => {
    const [u, l, m] = ta.donchian([1, 2], [0, 1], 3);
    expect(arr.allna(u) && arr.allna(l) && arr.allna(m)).toBe(true);
  });

  it('computes upper/lower/middle on simple dense input', () => {
    const high = [1, 2, 3, 4];
    const low = [0, 1, 1, 2];
    const [u, l, m] = ta.donchian(high, low, 3);
    expect(Number.isNaN(u[0])).toBe(true);
    expect(u[2]).toBeCloseTo(3);
    expect(l[2]).toBeCloseTo(0);
    expect(m[2]).toBeCloseTo(1.5);
    expect(u[3]).toBeCloseTo(4);
    expect(l[3]).toBeCloseTo(1);
    expect(m[3]).toBeCloseTo(2.5);
  });

  it('NaN in window yields NaN outputs (NaN-aware path)', () => {
    const high = [1, NaN, 3, 4];
    const low = [0, NaN, 1, 2];
    const [u, l, m] = ta.donchian(high, low, 3);
    expect(Number.isNaN(u[2])).toBe(true);
    expect(Number.isNaN(l[2])).toBe(true);
    expect(Number.isNaN(m[2])).toBe(true);
  });
});

describe('T3', () => {
  it('validation and short-series behavior', () => {
    expect(() => ta.t3([1,2,3], 0, 0.7)).toThrow();
    const out = ta.t3([1,2], 3, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

  it('produces outputs after warmup and computes expected indices (dense)', () => {
    const src = [1,2,3,4,5,6,7,8,9,10];
    const out = ta.t3(src, 2, 0.7);
    // lookback = 6 * (period - 1) = 6 -> first output at index 6
    expect(Number.isNaN(out[5])).toBe(true);
    expect(typeof out[6]).toBe('number');
    expect(out.length).toBe(src.length);
  });

  it('e1 seeding skips NaNs during initial collection (hits continue)', () => {
    const src = [NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = ta.t3(src, 2, 0.7);
    // Should not be all NaN because seeding skips the leading NaN and continues
    expect(arr.allna(out)).toBe(false);
  });

  it('insufficient valid samples during e1 seeding returns all NaN (hits return)', () => {
    const src = [NaN, NaN, 1];
    const out = ta.t3(src, 3, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

  it('seeding fails at e2 when subsequent values are NaN', () => {
    const src = [1,2, NaN, NaN, NaN, NaN, NaN, NaN];
    const out = ta.t3(src, 2, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

  it('seeding fails at e3 when insufficient valid values for e3', () => {
    const src = [1,2,3, NaN, NaN, NaN, NaN, NaN];
    const out = ta.t3(src, 2, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

  it('seeding fails at e4 when insufficient valid values for e4', () => {
    const src = [1,2,3,4, NaN, NaN, NaN, NaN];
    const out = ta.t3(src, 2, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

  it('seeding fails at e5 when insufficient valid values for e5', () => {
    const src = [1,2,3,4,5, NaN, NaN, NaN];
    const out = ta.t3(src, 2, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

  it('seeding fails at e6 when insufficient valid values for e6', () => {
    const src = [1,2,3,4,5,6, NaN, NaN];
    const out = ta.t3(src, 2, 0.7);
    expect(arr.allna(out)).toBe(true);
  });

describe('DEMA', () => {
  it('skips NaNs during EMA1 warmup (hits continue at line 32)', () => {
    const src = [1, NaN, 2, 3, 4, 5];
    const out = ta.dema(src, 3);
    // seeding should skip the NaN and produce numeric outputs later
    expect(arr.allna(out)).toBe(false);
  });

  it('returns all NaN when EMA1 never reaches period (covers line 38)', () => {
    const src = [NaN, NaN, NaN, 1, NaN, NaN]; // only one valid value overall
    const out = ta.dema(src, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('skips NaNs during EMA2 warmup (hits continue at line 48)', () => {
    const src = [1, 2, NaN, 3, NaN, 4, 5, 6];
    const out = ta.dema(src, 3);
    // despite NaNs during EMA2 warmup, there are enough valids later to produce outputs
    expect(arr.allna(out)).toBe(false);
  });

  it('returns all NaN when EMA2 never reaches period (covers line 58)', () => {
    const src = [1, 2, 3, NaN, NaN, NaN]; // EMA1 seeds but EMA2 lacks enough EMA1 updates
    const out = ta.dema(src, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('propagates NaN in hot loop (covers line 68)', () => {
    const src = [1,2,3,4,5, NaN, 7,8,9,10];
    const out = ta.dema(src, 3);
    // find index of NaN in source and expect NaN in output at same index
    const nanIdx = src.findIndex(v => Number.isNaN(v));
    expect(Number.isNaN(out[nanIdx])).toBe(true);
  });
});

it('sma pre-call dense-optimization toggles skipna and uses dense fast-path (covers line 60)', () => {
  const prev = process.env.SKIP_DENSE_OPTIMIZATION;
  process.env.SKIP_DENSE_OPTIMIZATION = 'false';
  const src = [1,2,3,4,5,6,7,8,9,10];
  const rTrue = ta.sma(src, 3, true);
  const rFalse = ta.sma(src, 3, false);
  process.env.SKIP_DENSE_OPTIMIZATION = prev;
  expect(arr.equals(rTrue, rFalse)).toBe(true);
});


  it('insufficient total valid samples despite n>lookback triggers e1 early-return (covers line 55)', () => {
    // Ensure n > lookback but total valid values in the series < period.
    // period=3 -> lookback=12, so length must be >=13. Provide only 2 valid values.
    const src = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 1, 2];
    const out = ta.t3(src, 3, 0.7);
    expect(arr.allna(out)).toBe(true);
  });
});

describe('WILLIAMS A/D (WAD)', () => {
  it('matches Tulind', async () => {
    const [quant_dense, quant_nan] = [ta.wad(HIGH, LOW, CLOSE, false), ta.wad(HIGH, LOW, CLOSE, true)];
    const tul = await tulindRun(tulind.indicators.wad, [HIGH,LOW,CLOSE]);
    compareToTulind(quant_dense, tul);
    compareToTulind(quant_nan, tul);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.wad(HIGH.slice(0, 5), LOW, CLOSE, false)).toThrow();
    expect(() => ta.wad(HIGH, LOW.slice(0, 5), CLOSE, false)).toThrow();
    expect(() => ta.wad(HIGH, LOW, CLOSE.slice(0, 5), false)).toThrow();
  });
  it('defaults to skipna when skipna arg is omitted', () => {
    const def = ta.wad(HIGH, LOW, CLOSE);
    const explicit = ta.wad(HIGH, LOW, CLOSE, true);
    expect(arr.equals(def, explicit)).toBe(true);
  });
  it('n === 0 returns empty Float64Array', () => {
    const out = ta.wad([], [], []);
    expect(out.length).toBe(0);
  });
  it('pre-call dense-optimization branch executes when inputs are dense', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    process.env.SKIP_DENSE_OPTIMIZATION = 'false';
    const h = [1,2,3,4,5,6,7,8,9,10];
    const l = [0,1,2,3,4,5,6,7,8,9];
    const c = [1,2,3,4,5,6,7,8,9,10];
    const rTrue = ta.wad(h, l, c, true);
    const rFalse = ta.wad(h, l, c, false);
    process.env.SKIP_DENSE_OPTIMIZATION = prev;
    expect(arr.equals(rTrue, rFalse)).toBe(true);
  });
  it('returns all NaN when all inputs are NaN', () => {
    expect(arr.allna(ta.wad(ALL_NAN, ALL_NAN, ALL_NAN))).toBe(true);
  });
  it('NaN-aware path returns NaNs for gaps and numbers elsewhere', () => {
    const h = [1, NaN, 3, 4, NaN, 6];
    const l = [0, NaN, 2, 3, NaN, 5];
    const c = [1, NaN, 3, 4, NaN, 6];
    const out = ta.wad(h, l, c, true);
    let sawNaN = false, sawNum = false;
    for (let v of out) { if (Number.isNaN(v)) sawNaN = true; else sawNum = true; }
    expect(sawNaN).toBe(true);
    expect(sawNum).toBe(true);
  });
  it('no accumulation when close[i] === close[i-1] with skipna=true', () => {
    const h = [1,1,1];
    const l = [0,0,0];
    const c = [1,1,2];
    const out = ta.wad(h, l, c, true);
    expect(out.length).toBe(3);
    // at index 1 close == prev -> mf == 0
    expect(out[1]).toBeCloseTo(0);
    // at index 2 rise -> positive accumulation
    expect(out[2]).toBeCloseTo(2);
  });
  it('no accumulation when close[i] === close[i-1] with skipna=false', () => {
    const h = [1,1,1];
    const l = [0,0,0];
    const c = [1,1,2];
    const out = ta.wad(h, l, c, false);
    expect(out.length).toBe(3);
    expect(out[1]).toBeCloseTo(0);
    expect(out[2]).toBeCloseTo(2);
  });
});

describe('CHAIKIN AccDist (volume-based)', () => {
  it('matches Tulind', async () => {
    compareToTulind(ta.ad(HIGH, LOW, CLOSE, VOLUME), await tulindRun(tulind.indicators.ad, [HIGH,LOW,CLOSE,VOLUME]));
  });
  it('handles high==low (denom=0) by treating MFM as 0', () => {
    const h = [5, 5, 6];
    const l = [5, 5, 4];
    const c = [5, 5, 6];
    const v = [10, 10, 10];
    const out = ta.ad(h, l, c, v);
    expect(out.length).toBe(3);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0);
    expect(out[2]).toBeCloseTo(10);
  });
  it('propagates NaN when a close is NaN and does not update accumulator', () => {
    const h = [5, 6, 7];
    const l = [4, 5, 6];
    const c = [5, NaN, 7];
    const v = [10, 10, 10];
    const out = ta.ad(h, l, c, v);
    expect(out.length).toBe(3);
    // first step: mf = 1 -> acc = 10
    expect(out[0]).toBeCloseTo(10);
    // second step: close is NaN -> xacc becomes NaN and accumulator remains previous
    expect(Number.isNaN(out[1])).toBe(true);
    // third step: accumulator preserved from first valid (10) -> mf = 1 -> acc = 20
    expect(out[2]).toBeCloseTo(20);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.ad(HIGH.slice(0, 5), LOW, CLOSE, VOLUME)).toThrow();
    expect(() => ta.ad(HIGH, LOW.slice(0, 5), CLOSE, VOLUME)).toThrow();
    expect(() => ta.ad(HIGH, LOW, CLOSE.slice(0, 5), VOLUME)).toThrow();
    expect(() => ta.ad(HIGH, LOW, CLOSE, VOLUME.slice(0, 5))).toThrow();
  });
});

describe('MFI', () => {
  it('matches Tulind', async () => {
    compareToTulind(ta.mfi(HIGH, LOW, CLOSE, VOLUME, PERIOD), await tulindRun(tulind.indicators.mfi, [HIGH, LOW, CLOSE, VOLUME], PERIOD));
  });
  it('throws error if period <= 0', () => {
    expect(() => ta.mfi(HIGH, LOW, CLOSE, VOLUME, 0)).toThrow();
    expect(() => ta.mfi(HIGH, LOW, CLOSE, VOLUME, -1)).toThrow();
  });
  it('warmup mf NaN (mfIsFinite false) keeps output NaN at period', () => {
    const period = 5;
    const h = [1,2,3,4,5,6,7];
    const l = [0,1,2,3,4,5,6];
    const c = [1,2,3,4,5,6,7];
    const v = [10, 10, NaN, 10, 10, 10, 10];
    const out = ta.mfi(h, l, c, v, period);
    expect(Number.isNaN(out[period])).toBe(true);
  });
  it('constant typical price across window yields MFI=50 (posSum+negSum == 0)', () => {
    const period = 5;
    // identical bars -> typical price equal each bar
    const h = new Array(10).fill(2);
    const l = new Array(10).fill(1);
    const c = new Array(10).fill(1.5);
    const v = new Array(10).fill(10);
    const out = ta.mfi(h, l, c, v, period);
    // at index == period expect 50
    expect(out[period]).toBeCloseTo(50);
  });
  it('explicit throws for non-positive period (redundant check)', () => {
    expect(() => ta.mfi(HIGH, LOW, CLOSE, VOLUME, 0)).toThrow();
  });
  it('handles repeated-price bars before warmup and after warmup', () => {
    const period = 5;
    // build series length 12
    const h = [1,2,3,4,4,5,6,7,8,9,10,11];
    const l = [0,1,2,3,4,4,5,6,7,8,9,10];
    const c = [1,2,3,4,4,5,6,7,8,9,10,11];
    const v = new Array(h.length).fill(10);
    const out = ta.mfi(h, l, c, v, period);
    // index period-2 (3) is before warmup -> NaN
    expect(Number.isNaN(out[period - 2])).toBe(true);
    // index after warmup (period + 1) should be numeric
    expect(Number.isNaN(out[period + 1])).toBe(false);
  });
  it('returns all NaN if n < required period or input is all NaN', () => {
    expect(arr.allna(ta.mfi(SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, PERIOD))).toBe(true);
    expect(arr.allna(ta.mfi(ALL_NAN, LOW, CLOSE, VOLUME, PERIOD))).toBe(true);
    expect(arr.allna(ta.mfi(HIGH, ALL_NAN, CLOSE, VOLUME, PERIOD))).toBe(true);
    expect(arr.allna(ta.mfi(HIGH, LOW, ALL_NAN, VOLUME, PERIOD))).toBe(true);
    expect(arr.allna(ta.mfi(HIGH, LOW, CLOSE, ALL_NAN, PERIOD))).toBe(true);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.mfi(HIGH.slice(0, PERIOD+5), LOW, CLOSE, VOLUME, PERIOD)).toThrow();
    expect(() => ta.mfi(HIGH, LOW.slice(0, PERIOD+5), CLOSE, VOLUME, PERIOD)).toThrow();
    expect(() => ta.mfi(HIGH, LOW, CLOSE.slice(0, PERIOD+5), VOLUME, PERIOD)).toThrow();
    expect(() => ta.mfi(HIGH, LOW, CLOSE, VOLUME.slice(0, PERIOD+5), PERIOD)).toThrow();
  });
});

describe('ULTOSC', () => {
  it('matches Tulind', async () => {
    const quant = ta.ultosc(HIGH, LOW, CLOSE);
    const tul = await tulindRun(tulind.indicators.ultosc, [HIGH, LOW, CLOSE], undefined, [7, 14, 28]);
    compareToTulind(quant, tul);
  });

  it('throws error if periods <= 0', () => {
    expect(() => ta.ultosc(HIGH, LOW, CLOSE, {s1: 0, s2: 14, s3: 28})).toThrow();
    expect(() => ta.ultosc(HIGH, LOW, CLOSE, {s1: 7, s2: 0, s3: 28})).toThrow();
    expect(() => ta.ultosc(HIGH, LOW, CLOSE, {s1: 7, s2: 14, s3: 0})).toThrow();
    expect(() => ta.ultosc(HIGH, LOW, CLOSE, {s1: -1, s2: 14, s3: 28})).toThrow();
  });

  it('returns all NaN if n < required period or input is all NaN', () => {
    expect(arr.allna(ta.ultosc(SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, {s1: PERIOD, s2: PERIOD+1, s3: PERIOD+2}))).toBe(true);
    expect(arr.allna(ta.ultosc(ALL_NAN, LOW, CLOSE))).toBe(true);
    expect(arr.allna(ta.ultosc(HIGH, ALL_NAN, CLOSE))).toBe(true);
    expect(arr.allna(ta.ultosc(HIGH, LOW, ALL_NAN))).toBe(true);
  });

  it('throws error if input lengths differ', () => {
    expect(() => ta.ultosc(SLICED_INPUT, LOW, CLOSE)).toThrow();
    expect(() => ta.ultosc(HIGH, SLICED_INPUT, CLOSE)).toThrow();
    expect(() => ta.ultosc(HIGH, LOW, SLICED_INPUT)).toThrow();
  });
});

describe('ADOSC', () => {
  it('matches Tulind', async () => {
    compareToTulind(ta.adosc(HIGH, LOW, CLOSE, VOLUME, 3, 10), await tulindRun(tulind.indicators.adosc, [HIGH, LOW, CLOSE, VOLUME], undefined, [3, 10]));
  });
  it('throws error if periods <= 0', () => {
    for(const [short, long] of [[0, 10], [3, 0], [-1, 10], [3, -1]]){
      expect(() => ta.adosc(HIGH, LOW, CLOSE, VOLUME, short, long)).toThrow();
    }
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.adosc(SLICED_INPUT, LOW, CLOSE, VOLUME, 3, 10)).toThrow();
    expect(() => ta.adosc(HIGH, SLICED_INPUT, CLOSE, VOLUME, 3, 10)).toThrow();
    expect(() => ta.adosc(HIGH, LOW, SLICED_INPUT, VOLUME, 3, 10)).toThrow();
    expect(() => ta.adosc(HIGH, LOW, CLOSE, SLICED_INPUT, 3, 10)).toThrow();
  });
  it('throws when shortPeriod is zero', () => {
    expect(() => ta.adosc(HIGH, LOW, CLOSE, VOLUME, 0, 10)).toThrow();
  });
  it('throws when longPeriod is zero', () => {
    expect(() => ta.adosc(HIGH, LOW, CLOSE, VOLUME, 3, 0)).toThrow();
  });
  it('throws when shortPeriod > longPeriod', () => {
    expect(() => ta.adosc(HIGH, LOW, CLOSE, VOLUME, 10, 3)).toThrow();
  });
  it('throws when close length differs from others', () => {
    expect(() => ta.adosc(HIGH, LOW, CLOSE.slice(0, 10), VOLUME, 3, 10)).toThrow();
  });
  it('pre-call dense-optimization if-block executes (skipna && !shouldSkipDenseOptimization())', () => {
    const skipDenseOptimization = process.env.SKIP_DENSE_OPTIMIZATION;
    process.env.SKIP_DENSE_OPTIMIZATION= 'false';
    const h = [1,2,3,4,5,6,7,8,9,10];
    const l = [0,1,2,3,4,5,6,7,8,9];
    const c = [1,2,3,4,5,6,7,8,9,10];
    const v = new Array(h.length).fill(10);
    // with default env (dense optimization allowed) and dense inputs,
    // skipna=true should delegate to dense implementation and match skipna=false
    const rTrue = ta.adosc(h, l, c, v, 3, 6, true);
    const rFalse = ta.adosc(h, l, c, v, 3, 6, false);
    process.env.SKIP_DENSE_OPTIMIZATION= skipDenseOptimization;
    expect(arr.equals(rTrue, rFalse)).toBe(true);
  });
  it('returns all NaN if n < required period or input is all NaN', () => {
    expect(arr.allna(ta.adosc(SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, SHORT_INPUT, PERIOD, PERIOD+5))).toBe(true);
    expect(arr.allna(ta.adosc(ALL_NAN, ALL_NAN, ALL_NAN, ALL_NAN, 3, 10))).toBe(true);
  });
  it('nan-aware path delegates to dense when dense optimization allowed (internal shortcut)', () => {
    // import internal helpers directly from module
    // dense inputs (no NaNs) should cause adoscNanAware to call adoscDense
    // build small dense series
    const h = [1,2,3,4,5,6,7,8,9,10];
    const l = [0,1,2,3,4,5,6,7,8,9];
    const c = [1,2,3,4,5,6,7,8,9,10];
    const v = [10,10,10,10,10,10,10,10,10,10];
    // Compare public API dense vs nan-aware behavior: skipna=true should
    // delegate to dense implementation for dense inputs (no NaNs).
    const rTrue = ta.adosc(h, l, c, v, 3, 6, true);
    const rFalse = ta.adosc(h, l, c, v, 3, 6, false);
    expect(arr.equals(rTrue, rFalse)).toBe(true);
  });
  it('n === 0 returns empty Float64Array', () => {
    const out = ta.adosc([], [], [], [], 3, 10);
    expect(out.length).toBe(0);
  });
  it('n < longPeriod returns NaN-filled output', () => {
    const h = [1,2,3,4,5];
    const l = [0,1,2,3,4];
    const c = [1,2,3,4,5];
    const v = [10,10,10,10,10];
    let out = ta.adosc(h, l, c, v, 3, 10, false);
    expect(arr.allna(out)).toBe(true);
    out = ta.adosc(h, l, c, v, 3, 10, true);
    expect(arr.allna(out)).toBe(true);
  });
  it('handles high==low at position 0 (warmup case)', () => {
    const n = 10;
    const shortP = 3, longP = 5;
    const h = [5,6,7,8,9,10,11,12,13,14];
    const l = [5,5,6,7,8,9,10,11,12,13];
    const c = [...h];
    const v = new Array(n).fill(10);
    const out = ta.adosc(h, l, c, v, shortP, longP, false);
    expect(out.length).toBe(n);
    for (let i = 0; i < longP - 1; i++) expect(Number.isNaN(out[i])).toBe(true);
    for (let i = longP - 1; i < n; i++) expect(Number.isNaN(out[i])).toBe(false);
  });
  it('handles high==low at position longPeriod-2 (end of warmup)', () => {
    const n = 10;
    const shortP = 3, longP = 5;
    const h = [1,2,3,4,5,6,7,8,9,10];
    const l = [0,1,2,3,4,5,6,7,8,9];
    l[longP - 2] = h[longP - 2];
    const c = [...h];
    const v = new Array(n).fill(10);
    const out = ta.adosc(h, l, c, v, shortP, longP, false);
    expect(Number.isNaN(out[longP - 1])).toBe(false);
  });
  it('handles high==low at position > longPeriod (steady state)', () => {
    const n = 12;
    const shortP = 3, longP = 5;
    const h = [1,2,3,4,5,6,7,8,9,10,11,12];
    const l = [0,1,2,3,4,5,6,7,8,9,10,11];
    const idx = longP + 1;
    l[idx] = h[idx];
    const c = [...h];
    const v = new Array(n).fill(10);
    const out = ta.adosc(h, l, c, v, shortP, longP, false);
    expect(Number.isNaN(out[idx])).toBe(false);
  });
});


describe('PVI/NVI', () => {
  it('matches Tulind', async () => {
    const [quant_pvi, quant_nvi] = ta.pnvi(CLOSE, VOLUME, 1000);
    const tul_pvi = await tulindRun(tulind.indicators.pvi, [CLOSE, VOLUME]);
    const tul_nvi = await tulindRun(tulind.indicators.nvi, [CLOSE, VOLUME]);
    compareToTulind(quant_pvi, tul_pvi);
    compareToTulind(quant_nvi, tul_nvi);
  });

  it('returns all NaN if input is all NaN', () => {
    expect(ta.pnvi(ALL_NAN, ALL_NAN).every(a => arr.allna(a))).toBe(true);
  });

  it('n === 0 returns empty arrays', () => {
    const [pvi, nvi] = ta.pnvi([], []);
    expect(pvi.length).toBe(0);
    expect(nvi.length).toBe(0);
  });

  it('handles a single NaN in inputs (NaN-aware)', () => {
    const price = [1, 2, NaN, 3, 4];
    const vol =   [10,10,10,10,10];
    const [pvi, nvi] = ta.pnvi(price, vol, 1000);
    // ensure NaNs are present in outputs where appropriate
    let sawNaN = false, sawNum = false;
    for (let v of pvi) { if (Number.isNaN(v)) sawNaN = true; else sawNum = true; }
    expect(sawNaN).toBe(true);
    expect(sawNum).toBe(true);
  });

  it('throws error if input lengths differ', () => {
    expect(() => ta.pnvi(SLICED_INPUT, VOLUME)).toThrow();
    expect(() => ta.pnvi(CLOSE, SLICED_INPUT)).toThrow();
  });
});

describe('PSAR', () => {
  it('matches Tulind', async () => {
    compareToTulind(ta.psar(HIGH, LOW, 0.2, 2), await tulindRun(tulind.indicators.psar, [HIGH,LOW], undefined, [0.2,2]));
  });
  it('returns all NaN if input is all NaN', () => {
    expect(arr.allna(ta.psar(ALL_NAN, LOW, 0.2, 2))).toBe(true);
    expect(arr.allna(ta.psar(HIGH, ALL_NAN, 0.2, 2))).toBe(true);
  });
  it('throws error if input lengths differ', () => {
    expect(() => ta.psar(SLICED_INPUT, LOW, 0.2, 2)).toThrow();
    expect(() => ta.psar(HIGH, SLICED_INPUT, 0.2, 2)).toThrow();
  });
  
  it('parameter validation and tiny-input behavior', () => {
    expect(() => ta.psar(HIGH, LOW, 0, 2)).toThrow();
    expect(() => ta.psar(HIGH, LOW, 0.1, 0)).toThrow();
    expect(() => ta.psar(HIGH, LOW, 2, 1)).toThrow(); // step > maxStep

    // tiny input length 1 -> single NaN output
    const h = [1];
    const l = [0];
    const out = ta.psar(h, l, 0.02, 0.2);
    expect(out.length).toBe(1);
    expect(Number.isNaN(out[0])).toBe(true);
  });

  it('dense vs NaN-aware parity on dense inputs', () => {
    const h = [1,2,3,4,5,6];
    const l = [0,1,1,2,2,3];
    const dense = ta.psar(h, l, 0.02, 0.2, false);
    const nanaware = ta.psar(h, l, 0.02, 0.2, true);
    // compare from index 1 onward (first computed index)
    for (let i = 1; i < h.length; i++) {
      const dv = dense[i];
      const nv = nanaware[i];
      if (Number.isNaN(dv)) expect(Number.isNaN(nv)).toBe(true); else expect(dv).toBeCloseTo(nv as number);
    }
  });

  it('NaN-aware handles gaps and returns NaNs where insufficient valid bars', () => {
    const h = [1, NaN, NaN, 4, 5, NaN, 7];
    const l = [0, NaN, NaN, 3, 4, NaN, 6];
    const out = ta.psar(h, l, 0.02, 0.2, true);
    // ensure at least one NaN remains and at least one numeric output exists
    let hasNaN = false, hasNum = false;
    for (let v of out) {
      if (Number.isNaN(v)) hasNaN = true; else hasNum = true;
    }
    expect(hasNaN).toBe(true);
    expect(hasNum).toBe(true);
  });
});

describe('T3', () => {
  it('matches Talib', async () => {
    const out = await talibRun('T3', CLOSE, { optInTimePeriod: PERIOD, optInVFactor: 0.7 });
    // Compare to Talib at high precision now that implementation follows TA-Lib's algorithm
    assert_arrays_close(ta.t3(CLOSE, PERIOD, 0.7), out, 8);
  });


  it('matches Talib for VF=0', async () => {
    const out = await talibRun('T3', CLOSE, { optInTimePeriod: PERIOD, optInVFactor: 0 });
    assert_arrays_close(ta.t3(CLOSE, PERIOD, 0), out, 8);
  });



  it('should handle edge cases', () => {
    // Empty array
    const emptyResult = ta.t3([], 5, 0.7);
    expect(emptyResult.length).toBe(0);
    
    // Array with NaN values
    const nanSource = [1, 2, NaN, 4, 5];
    const nanResult = ta.t3(nanSource, 3, 0.7);
    expect(Number.isNaN(nanResult[2])).toBe(true);
    
    // Period less than or equal to zero
    expect(() => ta.t3([1, 2, 3], 0, 0.7)).toThrow('Period must be positive');
    expect(() => ta.t3([1, 2, 3], -1, 0.7)).toThrow('Period must be positive');
  });
});

describe('T3 NaN handling (additional)', () => {
  it('handles inputs with interspersed NaNs and returns mixed outputs', () => {
    // use period=2 so warmup completes within a short series
    const src = [1, 2, 3, 4, NaN, 6, 7, 8];
    const out = ta.t3(src, 2, 0.7);
    expect(out.length).toBe(src.length);
    let hasNaN = false, hasNum = false;
    for (const v of out) { if (Number.isNaN(v)) hasNaN = true; else hasNum = true; }
    expect(hasNaN).toBe(true);
    expect(hasNum).toBe(true);
  });
});

// Rolling helpers tests
describe('Others', () => {
  it('rising/falling', () => {
    const srcUp = [1, NaN, 3, 4, 5];
    const r1 = ta.rising(srcUp, 3, true);
    expect(r1[0]).toBe(0); 
    expect(r1[1]).toBe(0);
    expect(r1[2]).toBe(0); 
    expect(r1[3]).toBe(1);
    expect(r1[4]).toBe(1);
    const r2 = ta.rising(srcUp, 3, false);
    expect(r2[0]).toBe(0); 
    expect(r2[1]).toBe(0);
    expect(r2[2]).toBe(0); 
    expect(r2[3]).toBe(1);
    expect(r2[4]).toBe(0);

    const srcDown = [5, NaN, 3, 2, 1];
    const f1 = ta.falling(srcDown, 3, true);
    expect(f1[0]).toBe(0);
    expect(f1[1]).toBe(0);
    expect(f1[2]).toBe(0);
    expect(f1[3]).toBe(1);
    expect(f1[4]).toBe(1);
    const f2 = ta.falling(srcDown, 3, false);
    expect(f2[0]).toBe(0);
    expect(f2[1]).toBe(0);
    expect(f2[2]).toBe(0);
    expect(f2[3]).toBe(1);
    expect(f2[4]).toBe(0);

    expect(() => ta.rising([1,2,4],0)).toThrow();
    expect(() => ta.falling([1,2,4],0)).toThrow();

  });

});

describe('BBW', () => {
  it('code coverage', async () => {
    ta.bbw(CLOSE, PERIOD, 2);
  });
});

describe('VWMA', () => {
  it('matches Tulind', async () => {
    compareToTulind(ta.vwma(CLOSE, VOLUME, PERIOD), await tulindRun(tulind.indicators.vwma, [CLOSE, VOLUME], PERIOD));
  });

  it('validation, length mismatch and short-series behavior', () => {
    expect(() => ta.vwma(CLOSE, VOLUME, 0)).toThrow();
    expect(() => ta.vwma(CLOSE, VOLUME.slice(0, 10), PERIOD)).toThrow();
    const p = [1,2]; const v = [1,2];
    // period > n -> NaN-filled
    const out = ta.vwma(p, v, 3);
    expect(out.length).toBe(2);
    expect(Number.isNaN(out[0]) && Number.isNaN(out[1])).toBe(true);
  });

  it('vSum zero produces NaN for windows with zero volume', () => {
    const price = [10,20,30,40,50];
    const volZero = [0,0,0,0,0];
    const out = ta.vwma(price, volZero, 3);
    // indices 2.. end should be NaN because vSum == 0
    for (let i = 2; i < out.length; i++) expect(Number.isNaN(out[i])).toBe(true);
  });

  it('dense vs NaN-aware parity on dense inputs', () => {
    const price = [10,11,12,13,14,15,16];
    const vol = [1,2,3,4,5,6,7];
    const dense = ta.vwma(price, vol, 3, false);
    const nanaware = ta.vwma(price, vol, 3, true);
    const start = 3 - 1;
    for (let i = start; i < price.length; i++) {
      expect(Number.isNaN(dense[i])).toBe(false);
      expect(Number.isNaN(nanaware[i])).toBe(false);
      expect(dense[i]).toBeCloseTo(nanaware[i] as number);
    }
  });

  it('NaN-aware handles gaps and returns NaNs where window lacks valid entries', () => {
    const price = [1, NaN, 3, 4, NaN, 6, 7];
    const vol =   [1, NaN, 1, 1, NaN, 1, 1];
    const out = ta.vwma(price, vol, 3, true);
    // ensure some NaNs and some numeric outputs exist
    let hasNaN = false, hasNum = false;
    for (let v of out) { if (Number.isNaN(v)) hasNaN = true; else hasNum = true; }
    expect(hasNaN).toBe(true);
    expect(hasNum).toBe(true);
  });
});

describe('New indicators: Donchian / Keltner / SuperTrend / Ichimoku', () => {
  it('donchian basic behaviour', () => {
    const high = [1,2,3,4,5];
    const low = [1,1,1,1,1];
    const [upper, lower, mid] = ta.donchian(high, low, 3);
    expect(Number.isNaN(upper[0])).toBe(true);
    expect(Number.isNaN(upper[1])).toBe(true);
    expect(upper[2]).toBe(3);
    expect(lower[2]).toBe(1);
    expect(mid[2]).toBe((3 + 1) / 2);
  });

  it('keltner invariants and constant series', () => {
    const n = 10;
    const high = new Array(n).fill(10);
    const low = new Array(n).fill(10);
    const close = new Array(n).fill(10);
    const [middle, upper, lower] = ta.keltner(high, low, close, 3, 1);
    // For constant series ATR==0 so upper==middle==lower when defined
    for (let i = 0; i < n; i++) {
      if (!Number.isNaN(middle[i])) {
        expect(upper[i]).toBeCloseTo(middle[i]);
        expect(lower[i]).toBeCloseTo(middle[i]);
      }
    }
  });

  it('supertrend basic properties', () => {
    const high = [1,2,3,4,5,6,7,8];
    const low =  [1,2,3,4,5,6,7,8];
    const close= [1,2,3,4,5,6,7,8];
    const [st, finalUpper, finalLower, isUp] = ta.supertrend(high, low, close, 3, 1);
    // where isUp == 1, supertrend value should equal finalLower; where isUp == 0, should equal finalUpper
    for (let i = 0; i < st.length; i++) {
      const s = st[i];
      const fu = finalUpper[i];
      const fl = finalLower[i];
      if (isUp[i]) {
        if (Number.isNaN(s) && Number.isNaN(fl)) continue;
        expect(s).toBeCloseTo(fl);
      } else {
        if (Number.isNaN(s) && Number.isNaN(fu)) continue;
        expect(s).toBeCloseTo(fu);
      }
    }
  });

  it('ichimoku basic rolling checks', () => {
    const high = [1,2,3,4,5];
    const low =  [1,1,1,1,1];
    const close=[1,2,3,4,5];
    const [tenkan, kijun, senA, senB, chikou] = ta.ichimoku(high, low, close, { tenkan: 3, kijun: 4, senkouB: 5 });
    // Tenkan at index 2 for period=3 should be (max(1,2,3)+min(1,1,1))/2 = (3+1)/2 = 2
    expect(Number.isNaN(tenkan[0])).toBe(true);
    expect(Number.isNaN(tenkan[1])).toBe(true);
    expect(tenkan[2]).toBe(2);
    // Kijun at index 3 (period=4) should be computed
    expect(Number.isNaN(kijun[2])).toBe(true);
    expect(Number.isNaN(kijun[3])).toBe(false);
    // Chikou is close shifted left by kijun (4) -> chikou[0] should equal close[4]
    if (chikou.length > 0 && !Number.isNaN(chikou[0])) {
      expect(chikou[0]).toBe(close[4]);
    }
  });
});

describe('cross helpers', () => {
  it('cross/crossover/crossunder with scalar b', () => {
    const a = [1, 2, 0, 3];
    const b = 1;
    expect(Array.from(ta.cross(a, b))).toEqual([0, 1, 1, 1]);
    expect(Array.from(ta.crossover(a, b))).toEqual([0, 1, 0, 1]);
    expect(Array.from(ta.crossunder(a, b))).toEqual([0, 0, 1, 0]);
  });

  it('cross works with array b', () => {
    const a = [1, 2, 3, 2];
    const b = [1, 1, 2, 2];
    // expectations derived from element-wise comparisons
    expect(Array.from(ta.crossover(a, b))).toEqual([0, 1, 0, 0]);
    expect(Array.from(ta.cross(a, b))).toEqual([0, 1, 0, 0]);
  });
});

describe('dense input produce same result for skipna=true/false', () => {
  ['sma', 'wma', 'rma', 'rsi'].forEach(fn => {
    it(`${fn}`, () => {
      expect(arr.equals((ta as any)[fn](CLOSE, PERIOD, true), (ta as any)[fn](CLOSE, PERIOD, false), 8)).toBe(true);
    });
  })
});


describe('gapped input does not produce same result for skipna=true/false', () => {
  ['sma', 'wma', 'rma', 'rsi'].forEach(fn => {
    it(`${fn}`, async() => {
      expect(arr.equals((ta as any)[fn](CLOSE_GAPPED, PERIOD, true), (ta as any)[fn](CLOSE_GAPPED, PERIOD, false))).toBe(false);
    });
  })
});

describe('RMA additional edge cases', () => {
  it('period === 1 copies input (dense fast-path)', () => {
    const src = [1, 2, 3, 4, 5];
    const out = ta.rma(src, 1, false);
    expect(out.length).toBe(src.length);
    for (let i = 0; i < src.length; i++) expect(out[i]).toBeCloseTo(src[i]);
  });

  it('pre-call dense-optimization branch executes (skipna flip)', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    process.env.SKIP_DENSE_OPTIMIZATION = 'false';
    const src = [1,2,3,4,5,6,7,8,9,10];
    // default skipna=true should delegate to dense implementation for dense inputs
    const rTrue = ta.rma(src, 3, true);
    const rFalse = ta.rma(src, 3, false);
    process.env.SKIP_DENSE_OPTIMIZATION = prev;
    expect(arr.equals(rTrue, rFalse)).toBe(true);
  });
});

describe('kama/adosc gapped vs dense', () => {
  // `kama` has additional parameters before `skipna` (fastPeriod, slowPeriod).
  // Call it explicitly with its full signature in a standalone test.
  it('kama (dense) produces same result for skipna=true/false', () => {
    expect(arr.equals(ta.kama(CLOSE, PERIOD, 2, 30, true), ta.kama(CLOSE, PERIOD, 2, 30, false))).toBe(true);
  });

  it('kama (gapped) does not produce same result for skipna=true/false', async () => {
    expect(arr.equals(ta.kama(CLOSE_GAPPED, PERIOD, 2, 30, true), ta.kama(CLOSE_GAPPED, PERIOD, 2, 30, false))).toBe(false);
  });
  it('kama pre-call dense-optimization branch executes (covers line 27)', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    process.env.SKIP_DENSE_OPTIMIZATION = 'false';
    const src = [1,2,3,4,5,6,7,8,9,10,11,12];
    const rTrue = ta.kama(src, 3, 2, 30, true);
    const rFalse = ta.kama(src, 3, 2, 30, false);
    process.env.SKIP_DENSE_OPTIMIZATION = prev;
    expect(arr.equals(rTrue, rFalse)).toBe(true);
  });

  it('kama dense early-return when m < period+1 (covers line 44)', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    process.env.SKIP_DENSE_OPTIMIZATION = 'false';
    const src = [1,2,3];
    const out = ta.kama(src, 3, 2, 30, true);
    process.env.SKIP_DENSE_OPTIMIZATION = prev;
    expect(arr.allna(out)).toBe(true);
  });
  it('adosc (dense) produces same result for skipna=true/false', () => {
    expect(arr.equals(ta.adosc(HIGH, LOW, CLOSE, VOLUME, 3, 10, true), ta.adosc(HIGH, LOW, CLOSE, VOLUME, 3, 10, false))).toBe(true);
  });

});

describe('WMA', () => {
  it('throws error if period <= 0', () => {
    expect(() => ta.wma([1,2,3], 0)).toThrow();
    expect(() => ta.wma([1,2,3], -1)).toThrow();
  });

  it('pre-call dense-optimization branch toggles skipna (covers line 22)', () => {
    const prev = process.env.SKIP_DENSE_OPTIMIZATION;
    process.env.SKIP_DENSE_OPTIMIZATION = 'false';
    const src = [1,2,3,4,5,6,7,8,9,10];
    const rTrue = ta.wma(src, 3, true);
    const rFalse = ta.wma(src, 3, false);
    process.env.SKIP_DENSE_OPTIMIZATION = prev;
    expect(arr.equals(rTrue, rFalse)).toBe(true);
  });
});

describe('SUPERTREND', () => {
  it('throws when period <= 0', () => {
    expect(() => ta.supertrend(HIGH, LOW, CLOSE, 0, 3)).toThrow();
    expect(() => ta.supertrend(HIGH, LOW, CLOSE, -1, 3)).toThrow();
  });

  it('throws when input lengths differ', () => {
    const h = [1,2,3,4];
    const l = [1,2,3]; // shorter
    const c = [1,2,3,4];
    expect(() => ta.supertrend(h, l, c, 3, 3)).toThrow();
  });

  it('returns empty arrays for n === 0', () => {
    const [st, fu, fl, mask] = ta.supertrend([], [], [], 3, 3);
    expect(st.length).toBe(0);
    expect(fu.length).toBe(0);
    expect(fl.length).toBe(0);
    expect(mask.length).toBe(0);
  });
});

describe('TEMA additional edge cases', () => {
  it('returns all NaN for all-NaN input (idx === n branch)', () => {
    const out = ta.tema(ALL_NAN, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('insufficient valid samples during EMA1 warmup (valid1 < period)', () => {
    // n >= period but not enough non-NaN values to warm EMA1
    const src = [NaN, 1, NaN, NaN, NaN];
    const out = ta.tema(src, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('insufficient valid samples during EMA2 warmup (valid2 < period)', () => {
    // enough values to seed EMA1 but not enough to seed EMA2
    const src = [1,2,3, NaN, NaN];
    const out = ta.tema(src, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('insufficient valid samples during EMA3 warmup (valid3 < period)', () => {
    // enough to seed EMA1 and EMA2 but not EMA3
    const src = [1,2,3,4,5,6, NaN, NaN];
    const out = ta.tema(src, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('fills prefix with NaN and produces value at lastFilledIndex (lastFilledIndex > 0)', () => {
    const src = [1,2,3,4,5,6,7,8,9,10];
    const out = ta.tema(src, 3);
    // find first non-NaN value and ensure previous indices are NaN
    let firstIdx = -1;
    for (let i = 0; i < out.length; i++) if (!Number.isNaN(out[i])) { firstIdx = i; break; }
    expect(firstIdx).toBeGreaterThan(0);
    for (let i = 0; i < firstIdx; i++) expect(Number.isNaN(out[i])).toBe(true);
  });

  it('hot loop writes NaN when encountering NaN inputs (hot-loop NaN handling)', () => {
    const src = [1,2,3,4,5,6,7, NaN, 9, 10];
    const out = ta.tema(src, 3);
    expect(Number.isNaN(out[7])).toBe(true);
  });
});

describe('TEMA lastFilledIndex edge', () => {
  it('no prefix fill when lastFilledIndex == 0 (period === 1)', () => {
    const src = [1,2,3,4];
    const out = ta.tema(src, 1);
    // with period==1 the first output should be defined at index 0
    expect(Number.isNaN(out[0])).toBe(false);
    // subsequent outputs should be numeric as well (no NaN prefix)
    for (let i = 0; i < src.length; i++) expect(Number.isNaN(out[i])).toBe(false);
  });
});

describe('EMA additional edge cases', () => {
  it('period === 1 copies input and preserves NaNs', () => {
    const src = [1, NaN, 3, 4];
    const out = ta.ema(src, 1);
    expect(out.length).toBe(src.length);
    for (let i = 0; i < src.length; i++) {
      if (Number.isNaN(src[i])) expect(Number.isNaN(out[i])).toBe(true); else expect(out[i]).toBeCloseTo(src[i]);
    }
  });

  it('all-NaN input returns all NaN (idx === n branch)', () => {
    const out = ta.ema(ALL_NAN, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('insufficient valid samples during warmup yields all NaN (validCount < period)', () => {
    const src = [NaN, 1, NaN, NaN];
    const out = ta.ema(src, 3);
    expect(arr.allna(out)).toBe(true);
  });

  it('fills prefix with NaN and produces value at lastFilledIndex (lastFilledIndex > 0)', () => {
    const src = [1,2,3,4,5,6];
    const out = ta.ema(src, 3);
    let firstIdx = -1;
    for (let i = 0; i < out.length; i++) if (!Number.isNaN(out[i])) { firstIdx = i; break; }
    expect(firstIdx).toBeGreaterThan(0);
    for (let i = 0; i < firstIdx; i++) expect(Number.isNaN(out[i])).toBe(true);
  });

  it('hot loop writes NaN when encountering NaN inputs', () => {
    const src = [1,2,3,4,5,6, NaN, 8, 9];
    const out = ta.ema(src, 3);
    expect(Number.isNaN(out[6])).toBe(true);
  });
});