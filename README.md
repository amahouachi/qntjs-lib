# qntjs-lib

High-performance JavaScript and TypeScript library of technical‑analysis indicators, array utilities, and numerical helpers.

This repository implements a wide set of TA indicators (EMA, TEMA, T3, MFI, KAMA, etc.), vectorized math functions, and statistical helpers. Implementations are optimized for two common usage patterns:

- NaN‑aware workflows (default): functions are NaN‑aware and will skip NaN values where appropriate.
- Dense fast‑path: when you know inputs contain no NaNs you can opt into a dense, faster implementation by passing `skipna=false` to supported functions.

By default the main (typed) build returns typed arrays (e.g. `Float64Array`) for better numeric performance and predictable memory layout. A companion "untyped" build exposes the same API but returns plain `number[]` values for easier interoperability with plain JavaScript code.

The library has no runtime dependencies and is zero-dependency by design. It can be used in browser web applications or in Node.js environments that support ESM imports.

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

## skipna and dense fast-path

Many indicators accept an optional `skipna` boolean (default `true`). Example:

```js
// NaN-aware (default)
ta.sma(pricesWithGaps, 5);

// Dense fast-path (assume no NaNs)
ta.sma(densePrices, 5, false);
```

## API highlights

 - `arr.*` — array utilities: `isna`, `notna`, `fillna`, `ffill`, `bfill`, `replace`, `dropna`, `allna`, `equals`, `countna`, `havena`, `lag`
 - `math.*` — math helpers: `add`, `sub`, `avg`, `mul`, `div`, `scale`, `abs`, `sign`, `round`, `floor`, `ceil`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`, `clamp`, `sum`, `prod`, `min`, `max`, `argmin`, `argmax`, `cumsum`, `cumprod`, `cummax`, `cummin`, `rollsum`, `rollmin`, `rollmax`, `rollminmax`, `rollprod`, `rollargmin`, `rollargmax`, `diff`, `randuniform`, `randnormal`, `dot`, `norm`, `ols`, `olsMulti`
 - `stats.*` — statistical helpers: `mean`, `hmean`, `gmean`, `mad`, `skew`, `kurtosis`, `median`, `quantile`, `percentiles`, `var`, `covar`, `stdev`, `corr`, `zscore`, `norminmax`, `winsorize`, `sample`, `shuffle`, `bootstrap`
- `ta.*` — technical indicators: `dema`, `ema`, `hma`, `kama`, `sma`, `wma`, `vwma`, `trima`, `t3`, `tema`, `rma`, `ao`, `apo`, `aroon`, `change`, `cmo`, `kst`, `macd`, `mom`, `ppo`, `roc`, `rsi`, `stoch`, `stochrsi`, `ultosc`, `wpr`, `supertrend`, `adx`, `adxr`, `dx`, `cci`, `di`, `dpo`, `ichimoku`, `psar`, `atr`, `tr`, `natr`, `bb`, `bbw`, `donchian`, `keltner`, `adosc`, `obv`, `pnvi`, `wad`, `ad`, `mfi`, `cross`, `crossover`, `crossunder`, `rising`, `falling`

## Tests & development

Run tests:

```bash
npm test
```

Build (produce distributable artifacts):

```bash
npm run build
```

## Contributing

- Open an issue to discuss larger changes.
- Run tests and keep coverage high for changes to core algorithms.
- Follow the existing style and types in `src/`.

## License

See `LICENSE` in the repo root.
