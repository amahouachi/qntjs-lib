# qntjs-lib

A compact JavaScript/TypeScript library of numerical helpers and technical-analysis indicators.

This repository provides a comprehensive set of TA indicators (EMA, TEMA, T3, MFI, KAMA, etc.), vectorized math functions, array utilities, and statistical helpers.

For best performance, functions operate and return typed arrays like Float64Array.
For convenience, the same functions are also exposed with number[] return types.

Most functions skip NaN by default in their calculations. 
Some functions accept boolean skipna to skip or not NaN.
When skipna=false is passed to these functions, a fast dense path is executed. 

**Quick Start**

Install:

```bash
npm install qntjs-lib
```

Basic usage:

```js
import { ta, arr } from 'qntjs-lib';

const prices = [1,2,3,4,5,6,7];
const out = ta.ema(prices, 3);
console.log(out);
```

API highlights

- `ta.*` — technical indicators (e.g. `ta.ema`, `ta.t3`, `ta.mfi`, `ta.kama`)
- `arr.*` — array utilities
- `math.*` — math helpers

Tests & development

Run tests:

```bash
npm test
```

Run build (produce distributable artifacts):

```bash
npm run build
```

Contributing

- Open an issue to discuss larger changes.
- Run tests and keep coverage high for changes to core algorithms.
- Follow the existing style and types in `src/`.

License

See `LICENSE` in the repo root.
