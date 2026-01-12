/**
 * Barrel exports for math helpers. Re-exports individual functions from
 * the `src/math` submodules for convenient imports.
 */
// filepath: src/math/index.ts
// Barrel file: re-export individual math functions as named exports

import { diff, add, sub, mul, div, avg, scale, clamp, abs, sign, round, floor, ceil, eq, neq, and, or, not, gt, gte, lt, lte } from './basic.js';
import { prod, cumprod, rollprod } from './prod.js';
import { sum, rollsum, cumsum } from './sum.js';
import { min, rollmin, max, rollmax, argmin, argmax, cummax, cummin, rollminmax, rollargmin, rollargmax } from './minmax.js';
import { randuniform, randnormal } from './random.js';
import { dot, norm, ols, olsMulti } from './linalg.js';

export {
  add, sub, avg, mul, div, scale, abs, sign, round, floor, ceil,
  eq, neq, gt, gte, lt, lte, and, or, not,
  clamp, sum, prod, min, max, argmin, argmax, cumsum, cumprod,
  cummax, cummin, rollsum, rollmin, rollmax,
  rollminmax, rollprod, rollargmin, rollargmax, diff,
  randuniform, randnormal, dot, norm, ols, olsMulti
};
