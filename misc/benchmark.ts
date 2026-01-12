import { math, ta, stats } from '../src/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Data generation function
function generateData(size: number) {
  const CLOSE: number[] = new Array(size);
  let price = 1000;
  for (let i = 0; i < size; i++) {
    const step = (Math.random() - 0.5) * 2 + (Math.random() - 0.5) * 0.5;
    price += step;
    CLOSE[i] = price;
  }
  const VOLUME = Array.from({ length: size }, () => 100 + Math.random() * 400);
  const HIGH = CLOSE.map((v) => v + Math.random() * 2);
  const LOW = CLOSE.map((v) => v - Math.random() * 2);
  
  return { CLOSE, VOLUME, HIGH, LOW };
}

// Timing helper
function timeit(fn: () => void): number {
  const t0 = performance.now();
  fn();
  const t1 = performance.now();
  return parseFloat((t1 - t0).toFixed(2));
}

async function timeitAsync(fn: () => Promise<void>): Promise<number> {
  const t0 = performance.now();
  await fn();
  const t1 = performance.now();
  return parseFloat((t1 - t0).toFixed(2));
}

// Run `fn` `runs` times and return the median duration (ms)
function medianTime(fn: () => void, runs: number = 6): number {
  const times: number[] = new Array(runs);
  for (let i = 0; i < runs; i++) {
    times[i] = timeit(fn);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(runs / 2)];
}

// Benchmark result type (QuantJS column may now be string like '23.33|12.32')
interface BenchmarkResult {
  name: string;
  duration: number | string;
}

interface PythonBenchmarkResult {
  name: string;
  pandas?: string | number;
  numpy?: string | number;
  talib?: string | number;
}

async function benchmark_qntjs(CLOSE: number[], VOLUME: number[], HIGH: number[], LOW: number[], PERIOD: number): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];


  // TA functions - use measureMaybeSkipna for ta.* calls where applicable
  results.push({ name: 'TA.SMA', duration: medianTime(() => ta.sma(CLOSE, PERIOD)) });
  results.push({ name: 'TA.EMA', duration: medianTime(() => ta.ema(CLOSE, PERIOD)) });
  results.push({ name: 'TA.RSI', duration: medianTime(() => ta.rsi(CLOSE, PERIOD)) });
  results.push({ name: 'TA.WMA', duration: medianTime(() => ta.wma(CLOSE, PERIOD)) });
  results.push({ name: 'TA.VWMA', duration: medianTime(() => ta.vwma(CLOSE, VOLUME, PERIOD)) });
  results.push({ name: 'TA.DEMA', duration: medianTime(() => ta.dema(CLOSE, PERIOD)) });
  results.push({ name: 'TA.TEMA', duration: medianTime(() => ta.tema(CLOSE, PERIOD)) });
  results.push({ name: 'TA.T3', duration: medianTime(() => ta.t3(CLOSE, PERIOD, 0.6)) });
  results.push({ name: 'TA.KAMA', duration: medianTime(() => ta.kama(CLOSE, PERIOD, 2, 30)) });
  results.push({ name: 'TA.HMA', duration: medianTime(() => ta.hma(CLOSE, PERIOD)) });
  results.push({ name: 'TA.TRIMA', duration: medianTime(() => ta.trima(CLOSE, PERIOD)) });
  results.push({ name: 'TA.DX', duration: medianTime(() => ta.dx(CLOSE, HIGH, LOW, PERIOD)) });
  results.push({ name: 'TA.ADX', duration: medianTime(() => ta.adx(CLOSE, HIGH, LOW, PERIOD)) });
  results.push({ name: 'TA.ADXR', duration: medianTime(() => ta.adxr(CLOSE, HIGH, LOW, PERIOD)) });
  results.push({ name: 'TA.TR', duration: medianTime(() => ta.tr(CLOSE, HIGH, LOW)) });
  results.push({ name: 'TA.ATR', duration: medianTime(() => ta.atr(CLOSE, HIGH, LOW, PERIOD)) });
  results.push({ name: 'TA.NATR', duration: medianTime(() => ta.natr(CLOSE, HIGH, LOW, PERIOD)) });
  results.push({ name: 'TA.AO', duration: medianTime(() => ta.ao(HIGH, LOW, PERIOD, PERIOD*2)) });
  results.push({ name: 'TA.APO', duration: medianTime(() => ta.apo(CLOSE, PERIOD, PERIOD*2)) });
  results.push({ name: 'TA.DPO', duration: medianTime(() => ta.dpo(CLOSE, PERIOD)) });
  results.push({ name: 'TA.CMO', duration: medianTime(() => ta.cmo(CLOSE, PERIOD)) });
  results.push({ name: 'TA.MACD', duration: medianTime(() => ta.macd(CLOSE, PERIOD, PERIOD*2, PERIOD+5)) });
  results.push({ name: 'TA.OBV', duration: medianTime(() => ta.obv(CLOSE, VOLUME)) });
  results.push({ name: 'TA.CHANGE', duration: medianTime(() => ta.change(CLOSE, PERIOD)) });
  results.push({ name: 'TA.ROC', duration: medianTime(() => ta.roc(CLOSE, PERIOD)) });
  results.push({ name: 'TA.BB', duration: medianTime(() => ta.bb(CLOSE, PERIOD, 2)) });
  results.push({ name: 'TA.MOM', duration: medianTime(() => ta.mom(CLOSE, PERIOD)) });
  results.push({ name: 'TA.STOCH', duration: medianTime(() => ta.stoch(HIGH, LOW, CLOSE, 5, 3, 10)) });
  results.push({ name: 'TA.STOCHRSI', duration: medianTime(() => ta.stochrsi(CLOSE, PERIOD)) });
  results.push({ name: 'TA.PSAR', duration: medianTime(() => ta.psar(HIGH, LOW, 0.2, 2)) });
  results.push({ name: 'TA.WR%', duration: medianTime(() => ta.wpr(HIGH, LOW, CLOSE, PERIOD)) });
  results.push({ name: 'TA.W ACC/DIST', duration: medianTime(() => ta.wad(HIGH, LOW, CLOSE)) });
  results.push({ name: 'TA.Chaikin ACC/DIST', duration: medianTime(() => ta.ad(HIGH, LOW, CLOSE, VOLUME)) });
  results.push({ name: 'TA.CCI', duration: medianTime(() => ta.cci(HIGH, LOW, CLOSE, PERIOD)) });
  results.push({ name: 'TA.MFI', duration: medianTime(() => ta.mfi(HIGH, LOW, CLOSE, VOLUME, PERIOD)) });
  results.push({ name: 'TA.ULTOSC', duration: medianTime(() => ta.ultosc(HIGH, LOW, CLOSE)) });
  results.push({ name: 'TA.ADOSC', duration: medianTime(() => ta.adosc(HIGH, LOW, CLOSE, VOLUME, 3, 10)) });
  results.push({ name: 'TA.PPO', duration: medianTime(() => ta.ppo(CLOSE, 12, 26)) });
  results.push({ name: 'TA.PNVI', duration: medianTime(() => ta.pnvi(CLOSE, VOLUME)) });
  results.push({ name: 'TA.RISING', duration: medianTime(() => ta.rising(CLOSE, PERIOD)) });
  results.push({ name: 'TA.FALLING', duration: medianTime(() => ta.falling(CLOSE, PERIOD)) });

  // Math functions
  results.push({ name: 'MATH.ADD', duration: medianTime(() => math.add(CLOSE, HIGH)) });
  results.push({ name: 'MATH.SUB', duration: medianTime(() => math.sub(CLOSE, HIGH)) });
  results.push({ name: 'MATH.MUL', duration: medianTime(() => math.mul(CLOSE, HIGH)) });
  results.push({ name: 'MATH.DIV', duration: medianTime(() => math.div(CLOSE, HIGH)) });
  results.push({ name: 'MATH.SCALE', duration: medianTime(() => math.scale(CLOSE, 2.5)) });
  results.push({ name: 'MATH.CLAMP', duration: medianTime(() => math.clamp(CLOSE, 0, 1e6)) });
  results.push({ name: 'MATH.ABS', duration: medianTime(() => math.abs(CLOSE)) });
  results.push({ name: 'MATH.SIGN', duration: medianTime(() => math.sign(CLOSE)) });
  results.push({ name: 'MATH.ROUND', duration: medianTime(() => math.round(CLOSE)) });
  results.push({ name: 'MATH.FLOOR', duration: medianTime(() => math.floor(CLOSE)) });
  results.push({ name: 'MATH.CEIL', duration: medianTime(() => math.ceil(CLOSE)) });
  results.push({ name: 'MATH.SUM', duration: medianTime(() => math.sum(CLOSE)) });
  results.push({ name: 'MATH.DIFF', duration: medianTime(() => math.diff(CLOSE)) });
  results.push({ name: 'MATH.PROD', duration: medianTime(() => math.prod(CLOSE)) });
  results.push({ name: 'STATS.MEAN', duration: medianTime(() => stats.mean(CLOSE)) });
  results.push({ name: 'MATH.DOT', duration: medianTime(() => math.dot(CLOSE, HIGH)) });
  results.push({ name: 'MATH.NORM', duration: medianTime(() => math.norm(CLOSE)) });
  results.push({ name: 'MATH.CORR', duration: medianTime(() => stats.corr(CLOSE, HIGH)) });
  results.push({ name: 'MATH.VAR', duration: medianTime(() => stats.var(CLOSE)) });
  results.push({ name: 'MATH.COVAR', duration: medianTime(() => stats.covar(CLOSE, HIGH)) });
  results.push({ name: 'MATH.STDEV', duration: medianTime(() => stats.stdev(CLOSE)) });
  results.push({ name: 'MATH.ZSCORE', duration: medianTime(() => stats.zscore(CLOSE)) });
  results.push({ name: 'MATH.SKEW', duration: medianTime(() => stats.skew(CLOSE)) });
  results.push({ name: 'MATH.KURTOSIS', duration: medianTime(() => stats.kurtosis(CLOSE)) });
  results.push({ name: 'MATH.QUANTILE', duration: medianTime(() => stats.quantile(CLOSE, 0.5)) });
  results.push({ name: 'MATH.MEDIAN', duration: medianTime(() => stats.median(CLOSE)) });
  results.push({ name: 'MATH.PERCENTILES', duration: medianTime(() => stats.percentiles(CLOSE, [0.25, 0.5, 0.75])) });
  results.push({ name: 'MATH.CUMSUM', duration: medianTime(() => math.cumsum(CLOSE)) });
  results.push({ name: 'MATH.CUMPROD', duration: medianTime(() => math.cumprod(CLOSE)) });
  results.push({ name: 'MATH.CUMMAX', duration: medianTime(() => math.cummax(CLOSE)) });
  results.push({ name: 'MATH.CUMMIN', duration: medianTime(() => math.cummin(CLOSE)) });
  results.push({ name: 'MATH.ROLLCOVAR', duration: medianTime(() => stats.rollcovar(CLOSE, HIGH, PERIOD)) });
  results.push({ name: 'MATH.ROLLCORR', duration: medianTime(() => stats.rollcorr(CLOSE, HIGH, PERIOD)) });
  results.push({ name: 'MATH.ROLLSUM', duration: medianTime(() => math.rollsum(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLMEAN', duration: medianTime(() => stats.rollmean(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLVAR', duration: medianTime(() => stats.rollvar(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLSTDEV', duration: medianTime(() => stats.rollstdev(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLMINMAX', duration: medianTime(() => math.rollminmax(CLOSE, CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLMAX', duration: medianTime(() => math.rollmax(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLMIN', duration: medianTime(() => math.rollmin(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLPROD', duration: medianTime(() => math.rollprod(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLSKEW', duration: medianTime(() => stats.rollskew(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLKURTOSIS', duration: medianTime(() => stats.rollkurtosis(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLARGMIN', duration: medianTime(() => math.rollargmin(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLARGMAX', duration: medianTime(() => math.rollargmax(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLMEDIAN', duration: medianTime(() => stats.rollmedian(CLOSE, PERIOD)) });
  results.push({ name: 'MATH.ROLLQUANTILE', duration: medianTime(() => stats.rollquantile(CLOSE, PERIOD, 0.5)) });
  return results;
}

async function benchmark_python(): Promise<PythonBenchmarkResult[]> {
  try {
    const { stdout } = await execAsync('~/python3/bin/python3 misc/python_benchmark.py');
    const results = JSON.parse(stdout.trim());
    return results;
  } catch (error) {
    console.error('Error running Python benchmark:', error);
    return [];
  }
}

function displayResults(qntjsResults: BenchmarkResult[], pythonResults: PythonBenchmarkResult[]) {
  // Create a map for quick lookup
  const resultMap = new Map<string, { 
    qntjs?: number | string, 
    python_pandas?: string | number,
    python_numpy?: string | number,
    python_talib?: string | number
  }>();

  qntjsResults.forEach(r => {
    if (!resultMap.has(r.name)) resultMap.set(r.name, {});
    resultMap.get(r.name)!.qntjs = r.duration;
  });

  pythonResults.forEach(r => {
    if (!resultMap.has(r.name)) resultMap.set(r.name, {});
    if (r.talib !== undefined) resultMap.get(r.name)!.python_talib = r.talib as any;
    if (r.pandas !== undefined) resultMap.get(r.name)!.python_pandas = r.pandas as any;
    if (r.numpy !== undefined) resultMap.get(r.name)!.python_numpy = r.numpy as any;
  });

  // Display header
  console.log('\n' + '='.repeat(142));
  console.log('BENCHMARK RESULTS (times in ms)');
  console.log('='.repeat(142));
  console.log(
    'Indicator'.padEnd(20) + 
    'QNTJS'.padStart(20) + 
    'Py:TALib'.padStart(12) +
    'Py:Pandas'.padStart(12) + 
    'Py:NumPy'.padStart(12)
  );
  console.log('-'.repeat(142));

  // Display results
  // Formatter that accepts either a number or a pre-formatted string (e.g. "9.32|5.43")
  function formatPy(v: string | number | undefined) {
    if (v === undefined) return '-'.padStart(12);
    if (typeof v === 'string') return String(v).padStart(12);
    return (v as number).toFixed(2).padStart(12);
  }

  for (const [name, values] of resultMap.entries()) {
    let qntjsStr: string;
    if (values.qntjs === undefined) qntjsStr = '-'.padStart(20);
    else if (typeof values.qntjs === 'string') qntjsStr = String(values.qntjs).padStart(20);
    else qntjsStr = (values.qntjs as number).toFixed(2).padStart(20);

    const py_pandas = formatPy(values.python_pandas as any);
    const py_numpy = formatPy(values.python_numpy as any);
    const py_talib = formatPy(values.python_talib as any);
    
    console.log(name.padEnd(20) + qntjsStr +  py_talib + py_pandas + py_numpy);
  }
  
  console.log('='.repeat(142));
}

async function main() {
  const PERIOD = 20;
  const SIZE = 1_000_000;
  
  // warm-up: small inputs to let the JIT optimize hot functions and fault-in memory
  //warmupTa(20, 1000);

  console.log(`Generating ${SIZE.toLocaleString()} data points...`);
  const { CLOSE, VOLUME, HIGH, LOW } = generateData(SIZE);

  console.log('\nRunning benchmarks...\n');
  
  console.log('Running QuantJS benchmarks...');
  const qntjsResults = await benchmark_qntjs(CLOSE, VOLUME, HIGH, LOW, PERIOD);
  
  console.log('Running Python benchmarks...');
  const pythonResults = await benchmark_python();

  displayResults(qntjsResults, pythonResults);
}

main();



