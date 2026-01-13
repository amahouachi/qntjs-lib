<div align="center">

# qntjs-lib

[![CI](https://github.com/amahouachi/qntjs-lib/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/amahouachi/qntjs-lib/actions/workflows/node.js.yml)
[![NPM Version](https://img.shields.io/npm/v/qntjs-lib)](https://www.npmjs.com/package/qntjs-lib)
[![GitHub License](https://img.shields.io/github/license/amahouachi/qntjs-lib?label=license)](./LICENSE)

</div>

A pure fast JavaScript/TypeScript library of technical‑analysis indicators, trading performance/risk metrics, array utilities, and numerical helpers.

This package implements several TA indicators (EMA, TEMA, T3, MFI, KAMA, etc.), common trading performance metrics/utilities, vectorized math functions, and statistical helpers. 

By default the main (typed) build returns typed arrays (e.g. `Float64Array`) for better numeric performance and predictable memory layout. A companion "untyped" build exposes the same API but returns plain `number[]` values for easier interoperability with plain JavaScript code.

The library has no runtime dependencies. It can be used in browser web applications or in Node.js environments that support ESM imports.

## Quick Start

Install:

```bash
npm install qntjs-lib
```

Basic usage (default — typed output):

```js
import { ta } from 'qntjs-lib';

const prices = [1,2,3,4,5,6,7];
// returns Float64Array by default (typed numeric output)
const out = ta.ema(prices, 3);
```

Basic usage (untyped — plain arrays):

```js
import { ta } from 'qntjs-lib/untyped';

const prices = [1,2,3,4,5,6,7];
// returns plain number[] (easier to inspect/serialize)
const out = ta.ema(prices, 3);
```

When to use each:
- Use the default import (`qntjs-lib`) when you want outputs as `Float64Array` for numeric performance and predictable memory layout.
- Use `qntjs-lib/untyped` when you prefer plain `number[]` outputs for easier inspection or serialization.

## Modules

Overview of top-level modules and minimal examples showing common usage patterns.

### `ta` — technical indicators (moving averages, oscillators, volatility measures).

Example: compute an exponential moving average (EMA)

```js
import { ta } from 'qntjs-lib';
const prices = [1,2,3,4,5,6,7];
const ema3 = ta.ema(prices, 3); // Float64Array
```

### `math` — array-oriented math primitives and elementwise operations.

Example: elementwise subtract and scale

```js
import { math } from 'qntjs-lib';
const a = [1,2,3];
const b = [0.1,0.1,0.1];
const diff = math.sub(a, b); // Float64Array of a-b
const scaled = math.scale(diff, 100);
```

### `perf` — performance and risk helpers (returns, drawdowns, volatility, VaR/ES, ratios).

Example: compute daily returns, Sharpe, and parametric VaR

```js
import { perf } from 'qntjs-lib';
const prices = [100, 110, 105, 120];
const rets = perf.returns(prices); // simple returns (Float32Array)
const daily = perf.dailyReturns([Date.now(), Date.now() + 86400000], [0.01, 0.02]);
const sr = perf.sharpe([0.01, -0.02, 0.03]);
const varP = perf.valueAtRisk([0.01, -0.02, 0.03], 0.05, 'parametric');
```

### `stats` — aggregations, percentiles, variance, sampling utilities.

Example: quantile and sample

```js
import { stats } from 'qntjs-lib';
const v = stats.quantile([1,2,3,4,5], 0.1);
const sample = stats.sample([1,2,3,4,5], 3);
```

### `arr` — low-level array utilities (NaN handling, masks, fill/shift helpers).

Example: drop NaNs and forward-fill

```js
import { arr } from 'qntjs-lib';
const a = [NaN, 1, NaN, 2];
const clean = arr.dropna(a);
const filled = arr.ffill(a);
```

## List of available API

 - **`arr.*`** : `isna`, `notna`, `fillna`, `ffill`, `bfill`, `replace`, `dropna`, `allna`, `equals`, `countna`, `havena`, `lag`

 - **`math.*`** : `add`, `sub`, `avg`, `mul`, `div`, `scale`, `abs`, `sign`, `round`, `floor`, `ceil`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`, `clamp`, `sum`, `prod`, `min`, `max`, `argmin`, `argmax`, `cumsum`, `cumprod`, `cummax`, `cummin`, `rollsum`, `rollmin`, `rollmax`, `rollminmax`, `rollprod`, `rollargmin`, `rollargmax`, `diff`, `randuniform`, `randnormal`, `dot`, `norm`, `ols`, `olsMulti`

 - **`stats.*`** : `mean`, `hmean`, `gmean`, `mad`, `skew`, `kurtosis`, `median`, `quantile`, `percentiles`, `var`, `covar`, `stdev`, `corr`, `zscore`, `norminmax`, `winsorize`, `sample`, `shuffle`, `bootstrap`

- **`ta.*`** : `dema`, `ema`, `hma`, `kama`, `sma`, `wma`, `vwma`, `trima`, `t3`, `tema`, `rma`, `ao`, `apo`, `aroon`, `change`, `cmo`, `kst`, `macd`, `mom`, `ppo`, `roc`, `rsi`, `stoch`, `stochrsi`, `ultosc`, `wpr`, `supertrend`, `adx`, `adxr`, `dx`, `cci`, `di`, `dpo`, `ichimoku`, `psar`, `atr`, `tr`, `natr`, `bb`, `bbw`, `donchian`, `keltner`, `adosc`, `obv`, `pnvi`, `wad`, `ad`, `mfi`, `cross`, `crossover`, `crossunder`, `rising`, `falling`

 - **`perf.*`** : `returns`, `logreturns`, `cumreturns`, `cagr`, `dailyReturns`, `dd`, `maxdd`, `maxddDetails`, `dduration`, `rollmaxdd`, `recoveryFactor`, `calmarRatio`, `ulcerIndex`, `rollUlcerIndex`, `sharpe`, `sortino`, `rollsharpe`, `rollsortino`, `vol`, `rollvol`, `valueAtRisk`, `expectedShortfall`, `tailRatio`, `omegaRatio`


## skipna and dense fast-path

Where applicable, implementations are optimized for two common usage patterns:

- NaN‑aware workflows (default): functions are NaN‑aware and will skip NaN values where appropriate.
- Dense fast‑path: when you know inputs contain no NaNs you can opt into a dense, faster implementation by passing `skipna=false` to supported functions.

```js
// NaN-aware (default)
ta.sma(pricesWithGaps, 5);

// Dense fast-path (assume no NaNs)
ta.sma(densePrices, 5, false);
```

## Tests & development

Many functions, especially TA indicators are tested for correctness against Tulind library.

Run tests:

```bash
npm test
```

Build

```bash
npm run build
```

## License

This project is licensed under the terms of the [MIT license](./LICENSE)
