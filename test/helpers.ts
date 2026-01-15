import { expect } from 'vitest';
import { arr } from '../src';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const talib = require('talib');

export const PERIOD = 14;
export const CLOSE = Array.from({ length: 500 }, (_, i) => i * Math.random() + 100);
export const HIGH = Array.from({ length: 500 }, (_, i) => i * Math.random() + 200);
export const LOW = Array.from({ length: 500 }, (_, i) => i * Math.random() + 50);
export const VOLUME = Array.from({ length: 500 }, (_, i) => 100 + Math.random() * 10);
export const ALL_NAN = Array.from(CLOSE).fill(NaN);
export const SHORT_INPUT = new Array(PERIOD-3).fill(10);
export const SLICED_INPUT = CLOSE.slice(0, PERIOD+10);
// create gapped arrays by inserting NaNs at the given indices (shifts subsequent elements)
function makeGapped(src: number[], insertIndices: number[]) {
  const out = Array.from(src);
  let offset = 0;
  for (const idx of insertIndices) {
    const pos = idx + offset;
    if (pos < 0 || pos > out.length) continue;
    out.splice(pos, 0, NaN);
    offset++;
  }
  return out;
}

const GAP_POSITIONS = [50, 100, 150, 200, 250, 300, 350, 400, 450];

export const CLOSE_GAPPED = makeGapped(CLOSE, GAP_POSITIONS);
export const HIGH_GAPPED = makeGapped(HIGH, GAP_POSITIONS);
export const LOW_GAPPED = makeGapped(LOW, GAP_POSITIONS);
export const VOLUME_GAPPED = makeGapped(VOLUME, GAP_POSITIONS);

export function adaptTulindResults(qntjsResults: Float64Array, tulResults: number[], n: number): Float64Array {
  const out = new Float64Array(n);
  out.fill(NaN);
  if (!tulResults || tulResults.length === 0) return out;

  // collect indices where quant is not NaN
  const idxs: number[] = [];
  for (let i = 0; i < n; i++) if (!Number.isNaN(qntjsResults[i])) idxs.push(i);

  // If compact exactly matches non-NaN slots, transcribe into those slots (sparse)
  if (tulResults.length === idxs.length) {
    for (let j = 0; j < tulResults.length; j++) out[idxs[j]] = tulResults[j];
    return out;
  }

  // fallback: place contiguously starting at the first non-NaN index
  let first = 0;
  while (first < n && Number.isNaN(qntjsResults[first])) first++;
  let start = first;
  // ensure it fits; if not, right-align so it fits within [0..n-1]
  if (start + tulResults.length > n) start = Math.max(0, n - tulResults.length);
  for (let j = 0; j < tulResults.length && start + j < n; j++) out[start + j] = tulResults[j];
  return out;
}


export function compareToTulind(qntjsResult: Float64Array, tulResult: number[], tol = 1e-8) {
  const n= qntjsResult.length;
  const adaptedTulindResults = adaptTulindResults(qntjsResult, tulResult, n);
  // Ensure there is at least one overlapping finite value to compare. If not,
  // fail early — this catches cases where our implementation produced all
  // NaNs while Tulind returned valid numbers (a silent false-positive).
  let foundOverlap = false;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(qntjsResult[i]) && Number.isFinite(adaptedTulindResults[i])) {
      foundOverlap = true;
      break;
    }
  }
  if (!foundOverlap) {
    throw new Error('No overlapping finite outputs between qntjs results and Tulind outputs — possible implementation bug');
  }

  // find first index where both are valid
  let start= 0;
  while (start < n && (Number.isNaN(qntjsResult[start]) || Number.isNaN(adaptedTulindResults[start]))) start++;
  for(let i = start; i < n; i++){
    const a = qntjsResult[i], b = adaptedTulindResults[i];
    if (Number.isNaN(a)) expect(Number.isNaN(b)).toBe(true);
    else expect(a).toBeCloseTo(b, 8);
  }
}

export function assert_arrays_close(arr1: ArrayLike<number>, arr2: ArrayLike<number>, precision: number = 8) {
  expect(arr1.length).toBe(arr2.length);
  for (let i = 0; i < arr1.length; i++) {
    const a = arr1[i];
    const b = arr2[i];
    if (Number.isNaN(a) && Number.isNaN(b)) {
      continue;
    }
    expect(a).toBeCloseTo(b, precision);
  }
}

export function tulindRun(
  indicator: any,
  inputOrInputs: number[] | number[][],
  period?: number,
  ...extras: any[]
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Normalize inputs to an array of arrays: tulind expects [input1, input2, ...]
    let inputs: number[][] = [];
    if (Array.isArray(inputOrInputs) && inputOrInputs.length > 0 && Array.isArray((inputOrInputs as any)[0])) {
      // Caller passed an array-of-arrays: tulindPromise(indicator, [a,b,c], ...)
      inputs = inputOrInputs as number[][];
    } else {
      const additionalInputs: number[][] = [];
      for (const e of extras) {
        if (Array.isArray(e) && typeof (e as any)[0] === 'number') additionalInputs.push(e as number[]);
        else break; // stop at first non-array extra (likely an options array)
      }
      inputs = [inputOrInputs as number[]].concat(additionalInputs);
    }

    let options: number[] = [];
    if (extras && extras.length > 0) {
      const maybeOpts = extras[0];
      if (Array.isArray(maybeOpts) && typeof maybeOpts[0] === 'number') {
        options = maybeOpts as number[];
      }
    }
    if (options.length === 0) {
      options = typeof period === 'number' ? [period] : [];
    }

    indicator.indicator(inputs, options, (err: any, results: number[][]) => {
      if (err) reject(err);
      else {
        if (!results) resolve([]);
        else if (results.length === 1) resolve(results[0]);
        else resolve(results);
      }
    });
  });
}
export function talibRun(name: string, inReal: number[], opts: Record<string, any> = {}): Promise<Float64Array> {
  return new Promise((resolve, reject) => {
    talib.execute({ name, startIdx: 0, endIdx: inReal.length - 1, inReal, ...opts }, (err: any, res: any) => {
      if (err) return reject(err);
      if (!res || !res.result) return reject(new Error('talib returned no result'));
      const arrOut: number[] = res.result.outReal || [];
      const beg = typeof res.begIndex === 'number' ? res.begIndex : 0;
      const nb = typeof res.nbElement === 'number' ? res.nbElement : arrOut.length;
      if (arrOut.length !== nb) return reject(new Error('talib returned inconsistent nbElement/outReal length'));
      if (beg + nb > inReal.length) return reject(new Error('talib output overruns input length'));
      const out = new Float64Array(inReal.length);
      out.fill(NaN);
      for (let i = 0; i < arrOut.length; i++) out[beg + i] = arrOut[i];
      resolve(out);
    });
  });
}