import { describe, it, expect } from 'vitest';
import { arr } from '../src/index.js';
import { assert_arrays_close } from './helpers.js';

describe('Array utilities', () => {
  it('equals with lengths and NaN/precision', () => {
    expect(arr.equals([1,2,3], [1,2,3])).toBe(true);
    expect(arr.equals([1,2], [1,2,3])).toBe(false);
    expect(arr.equals([NaN, 2], [NaN, 2])).toBe(true);
    expect(arr.equals([NaN, 2], [1, 2])).toBe(false);
    // numeric mismatch (exact equality branch)
    expect(arr.equals([1,2], [1,3])).toBe(false);
    // precision: tolerance 1e-3
    expect(arr.equals([0.1234], [0.1235], 3)).toBe(true);
    expect(arr.equals([0.1234], [0.1236], 4)).toBe(false);
  });

  it('allna and countna', () => {
    expect(arr.allna([NaN, NaN])).toBe(true);
    expect(arr.allna([NaN, 1])).toBe(false);
    expect(arr.countna([NaN, 1, NaN, 2])).toBe(2);
  });

  it('havena across sources', () => {
    expect(arr.havena()).toBe(false);
    expect(arr.havena([1,2,3])).toBe(false);
    expect(arr.havena([1,NaN,3])).toBe(true);
    expect(arr.havena([1,2,3],[4,5,NaN])).toBe(true);
  });

  it('isna and notna masks', () => {
    const m = arr.isna([1, NaN, 3]);
    assert_arrays_close(m, new Float64Array([0,1,0]));
    const n = arr.notna([1, NaN, 3]);
    assert_arrays_close(n, new Float64Array([1,0,1]));
  });

  it('fillna mutates in-place when Float64Array and inplace=true', () => {
    const f = new Float64Array([1, NaN, 3]);
    const out = arr.fillna(f, 9, true);
    expect(out).toBe(f);
    assert_arrays_close(out, new Float64Array([1,9,3]));
    // when not inplace or not Float64Array, returns new array
    const src = [1, NaN, 3];
    const out2 = arr.fillna(src as any, 7, false);
    expect(out2).not.toBe(src as any);
    assert_arrays_close(out2, new Float64Array([1,7,3]));

    // inplace=true but not Float64Array should return a new Float64Array
    const out3 = arr.fillna(src as any, 5, true);
    expect(out3).not.toBe(src as any);
    assert_arrays_close(out3, new Float64Array([1,5,3]));
  });

  it('fillna/ffill/bfill no-op cases and replace no-op', () => {
    // fillna when no NaNs should return same values
    assert_arrays_close(arr.fillna([1,2,3] as any, 9, false), new Float64Array([1,2,3]));

    // ffill/bfill when no NaNs should be identity
    assert_arrays_close(arr.ffill([1,2,3] as any, false), new Float64Array([1,2,3]));
    assert_arrays_close(arr.bfill([1,2,3] as any, false), new Float64Array([1,2,3]));

    // replace value not present => no-op
    assert_arrays_close(arr.replace([1,2,3] as any, 9, 0, false), new Float64Array([1,2,3]));
  });

  it('ffill and bfill behavior', () => {
    const src = [NaN, 1, NaN, NaN, 2, NaN];
    const f = arr.ffill(src as any, false);
    assert_arrays_close(f, new Float64Array([NaN,1,1,1,2,2]));
    const b = arr.bfill(src as any, false);
    assert_arrays_close(b, new Float64Array([1,1,2,2,2,NaN]));

    // ffill/bfill on all-NaN should leave values as NaN
    assert_arrays_close(arr.ffill([NaN, NaN] as any, false), new Float64Array([NaN, NaN]));
    assert_arrays_close(arr.bfill([NaN, NaN] as any, false), new Float64Array([NaN, NaN]));
  });

  it('lag with shifts', () => {
    const src = [1,2,3,4];
    assert_arrays_close(arr.lag(src as any, 0), new Float64Array([1,2,3,4]));
    assert_arrays_close(arr.lag(src as any, 1), new Float64Array([NaN,1,2,3]));
    assert_arrays_close(arr.lag(src as any, -1), new Float64Array([2,3,4,NaN]));
  });

  it('replace handles NaN and values and respects inplace', () => {
    const src = [1, NaN, 2, NaN];
    const r = arr.replace(src as any, NaN, 0, false);
    assert_arrays_close(r, new Float64Array([1,0,2,0]));
    const f = new Float64Array([1, NaN, 2]);
    const r2 = arr.replace(f, 2, 9, true);
    expect(r2).toBe(f);
    assert_arrays_close(r2, new Float64Array([1, NaN, 9]));
  });

  it('dropna removes NaN entries', () => {
    const src = [NaN, 1, NaN, 2];
    assert_arrays_close(arr.dropna(src as any), new Float64Array([1,2]));
    const src2 = [1,2,3];
    // dropna returns same length array when no NaNs (but new Float64Array)
    const out = arr.dropna(src2 as any);
    assert_arrays_close(out, new Float64Array([1,2,3]));
  });

  it('default-parameter branches: omit optional args', () => {
    // fillna without inplace param (defaults to false)
    const outNoInplace = arr.fillna([1, NaN, 3] as any, 5);
    assert_arrays_close(outNoInplace, new Float64Array([1,5,3]));

    // ffill without inplace param
    assert_arrays_close(arr.ffill([NaN, 1, NaN] as any), new Float64Array([NaN,1,1]));

    // bfill without inplace param
    assert_arrays_close(arr.bfill([NaN, 1, NaN] as any), new Float64Array([1,1,NaN]));

    // lag without shift param (defaults to 1)
    const src = [1,2,3];
    assert_arrays_close(arr.lag(src as any), new Float64Array([NaN,1,2]));

    // replace without inplace param
    assert_arrays_close(arr.replace([1,2,1] as any, 1, 9), new Float64Array([9,2,9]));
  });
});
