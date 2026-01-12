#!/usr/bin/env python3
"""
Lightweight Python benchmark harness for common rolling/math primitives.
- Uses NumPy/pandas as baseline and prefers bottleneck or scipy where available.
- Generates synthetic random-walk data (1e6 samples) to match JS benchmark.
- Measures median time across repeats, with a single warm run.

Usage: python3 misc/python_benchmark.py
"""
import time
import math
import json
import numpy as np
import pandas as pd
import inspect
import gc

try:
    import talib
except Exception:
    talib = None

# Synthetic data
N = 1_000_000
WINDOW = 20
rng = np.random.default_rng(42)
steps = (rng.random(N) - 0.5) * 1.5 + (rng.random(N) - 0.5) * 0.5
price = 1000 + np.cumsum(steps).astype(np.float64)
volume = 100 + rng.random(N) * 400
high = price + rng.random(N) * 2
low = price - rng.random(N) * 2

# Ensure arrays are C-contiguous for TA-Lib
price = np.ascontiguousarray(price)
volume = np.ascontiguousarray(volume)
high = np.ascontiguousarray(high)
low = np.ascontiguousarray(low)

# Create NaN-containing variants for paired benchmarking (0.1% NaNs by default)
NAN_FRACTION = 0.001
_nans_rng = np.random.default_rng(123)

def make_with_nans(arr, frac, rng):
    a = arr.copy()
    n = a.shape[0]
    k = max(1, int(n * frac))
    idx = rng.choice(n, size=k, replace=False)
    a[idx] = np.nan
    return a

price_nan = make_with_nans(price, NAN_FRACTION, _nans_rng)
high_nan = make_with_nans(high, NAN_FRACTION, _nans_rng)
low_nan = make_with_nans(low, NAN_FRACTION, _nans_rng)
volume_nan = make_with_nans(volume, NAN_FRACTION, _nans_rng)

# --- PREBUILD pandas Series to avoid allocating Series in the hot path ---
price_s = pd.Series(price)
price_nan_s = pd.Series(price_nan)
high_s = pd.Series(high)
high_nan_s = pd.Series(high_nan)
low_s = pd.Series(low)
low_nan_s = pd.Series(low_nan)
volume_s = pd.Series(volume)
volume_nan_s = pd.Series(volume_nan)

# Helper timing
def timeit(fn, repeats=5):
    # warm - call once to ensure compilation/caching and consistent call signature
    try:
        result = fn()
        # Force evaluation if needed: handle arrays, pandas Series, and tuples/lists of arrays
        if isinstance(result, (tuple, list)):
            for r in result:
                if hasattr(r, 'shape'):
                    _ = r.sum()
        else:
            if hasattr(result, 'shape'):
                _ = result.sum()
    except Exception as e:
        print(f"Error in warmup: {e}", file=__import__('sys').stderr)
        return None
    
    times = []
    for _ in range(repeats):
        try:
            # minimize GC interference
            gc.collect()
            gc_disabled = gc.isenabled()
            if gc_disabled:
                gc.disable()
            t0 = time.perf_counter()
            result = fn()
            # Force evaluation for lazy operations
            if isinstance(result, (tuple, list)):
                for r in result:
                    if hasattr(r, 'shape'):
                        _ = r.sum()
            else:
                if hasattr(result, 'shape'):
                    _ = result.sum()
            t1 = time.perf_counter()
            if gc_disabled:
                gc.enable()
            elapsed = (t1 - t0) * 1000.0
            times.append(elapsed)
        except Exception as e:
            print(f"Error in timing: {e}", file=__import__('sys').stderr)
            try:
                if gc_disabled:
                    gc.enable()
            except Exception:
                pass
            return None
    times.sort()
    median_time = times[len(times)//2]
    # Return at least 0.01 if we got a real result
    return median_time if median_time > 0 else 0.01

# Pandas Series-based wrappers (use prebuilt Series to avoid allocation in timed calls)
def rollmean_pandas_s(s: pd.Series, w):
    return s.rolling(w, min_periods=1).mean()

def rollsum_pandas_s(s, w):
    return s.rolling(w, min_periods=1).sum()

def rollmin_pandas_s(s, w):
    return s.rolling(w, min_periods=1).min()

def rollmax_pandas_s(s, w):
    return s.rolling(w, min_periods=1).max()

def rollmedian_pandas_s(s, w):
    return s.rolling(w, min_periods=1).median()

def rollquantile_pandas_s(s: pd.Series, w, q):
    return s.rolling(w, min_periods=1).quantile(q)

def quantile_pandas_s(s: pd.Series, q):
    return s.quantile(q)

def quantile_numpy_s(s: pd.Series, q, skipna=False):
    return np.quantile(s, q) if skipna else np.nanquantile(s, q)

def rollskew_pandas_s(s, w):
    return s.rolling(w, min_periods=1).skew()

def skew_pandas_s(s: pd.Series):
    return s.skew()

def kurtosis_pandas_s(s: pd.Series):
    return s.kurtosis()

def mean_pandas_s(s: pd.Series):
    return s.mean()

def sum_pandas_s(s: pd.Series):
    return s.sum()

def rollkurtosis_pandas_s(s, w):
    return s.rolling(w, min_periods=1).kurt()

def rollstdev_pandas_s(s, w):
    return s.rolling(w, min_periods=1).std()

def rollvar_pandas_s(s, w):
    return s.rolling(w, min_periods=1).var()

def rollcovar_pandas_s(s, w):
    # rolling cov requires two series and a window; here s is expected to be a tuple (s1, s2)
    s1, s2 = s
    return s1.rolling(w, min_periods=1).cov(s2)

def covar_pandas_s(s1, s2):
    return s1.cov(s2, min_periods=1)

def rollcorr_pandas_s(s, w):
    return s.rolling(w, min_periods=1).corr()

# Implementations - Rolling functions, min_count=1
def rollsum_cumsum(arr, w):
    n = arr.shape[0]
    if n < w:
        return np.full(n, np.nan)
    cs = np.empty(n + 1, dtype=np.float64)
    cs[0] = 0.0
    np.cumsum(arr, out=cs[1:])
    out = (cs[w:] - cs[:-w])
    return np.concatenate((np.full(w-1, np.nan), out))

def rollmean_cumsum(arr, w):
    return rollsum_cumsum(arr, w) / float(w)

# NumPy wrappers that honor skipna using nan-aware functions when requested
def cumsum_numpy(arr, skipna=False):
    return np.nancumsum(arr) if skipna else np.cumsum(arr)

def cumprod_numpy(arr, skipna=False):
    # nancumprod exists in modern numpy
    return np.nancumprod(arr) if skipna else np.cumprod(arr)

def variance_numpy(arr, skipna=False):
    return np.nanvar(arr) if skipna else np.var(arr)

def stdev_numpy(arr, skipna=False):
    return np.nanstd(arr) if skipna else np.std(arr)

def median_numpy(arr, skipna=False):
    return np.nanmedian(arr) if skipna else np.median(arr)

def zscore_numpy(arr, skipna=False):
    mean = np.nanmean(arr) if skipna else np.mean(arr)
    std = np.nanstd(arr) if skipna else np.std(arr)
    return (arr - mean) / std

def nansum_numpy(arr, skipna=False):
    return np.nansum(arr) if skipna else np.sum(arr)

def nanprod_numpy(arr, skipna=False):
    return np.nanprod(arr) if skipna else np.prod(arr)

def nanmin_numpy(arr, skipna=False):
    return np.nanmin(arr) if skipna else np.min(arr)

def nanmax_numpy(arr, skipna=False):
    return np.nanmax(arr) if skipna else np.max(arr)

# TA Indicators
def ema_pandas(arr, span):
    return pd.Series(arr).ewm(span=span, adjust=False).mean().to_numpy()

def sma_pandas(arr, w):
    return pd.Series(arr).rolling(w).mean().to_numpy()

def wma_numpy(arr, w):
    # Use convolution for fast WMA calculation
    weights = np.arange(1, w + 1, dtype=np.float64)
    weight_sum = weights.sum()
    # Convolve with reversed weights (since convolution reverses)
    result = np.convolve(arr, weights[::-1], mode='valid') / weight_sum
    # Pad with NaN at the beginning
    return np.concatenate((np.full(w-1, np.nan), result))

def rsi_pandas(arr, period=14):
    delta = np.diff(arr, prepend=arr[0])
    up = np.where(delta > 0, delta, 0.0)
    down = np.where(delta < 0, -delta, 0.0)
    avg_gain = pd.Series(up).ewm(alpha=1/period, adjust=False).mean()
    avg_loss = pd.Series(down).ewm(alpha=1/period, adjust=False).mean()
    rs = (avg_gain / avg_loss).replace([np.inf, -np.inf], np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.to_numpy()

def vwma_numpy(price_arr, vol_arr, w):
    pv = price_arr * vol_arr
    weights = np.ones(w)
    num = np.convolve(pv, weights, mode='valid')
    den = np.convolve(vol_arr, weights, mode='valid')
    out = num / den
    return np.concatenate((np.full(w-1, np.nan), out))

def obv_numpy(close_arr, vol_arr):
    delta = np.diff(close_arr, prepend=close_arr[0])
    obv_change = np.where(delta > 0, vol_arr, np.where(delta < 0, -vol_arr, 0))
    return np.cumsum(obv_change)

def mom_numpy(arr, period):
    result = np.full(len(arr), np.nan)
    result[period:] = arr[period:] - arr[:-period]
    return result

def roc_numpy(arr, period):
    result = np.full(len(arr), np.nan)
    result[period:] = ((arr[period:] - arr[:-period]) / arr[:-period]) * 100
    return result

# Math functions
def diff_numpy(arr):
    return np.diff(arr, prepend=arr[0])

def dot_numpy(arr1, arr2):
    return np.dot(arr1, arr2)

def norm_numpy(arr):
    return np.linalg.norm(arr)

def add_numpy(arr1, arr2):
    return arr1 + arr2

def sub_numpy(arr1, arr2):
    return arr1 - arr2

def mul_numpy(arr1, arr2):
    return arr1 * arr2

def div_numpy(arr1, arr2):
    return arr1 / arr2

# Prepare tests: name -> {pandas: fn, numpy: fn, talib: fn}
tests = []

tests.append(('MATH.MEAN', {
    'pandas': (lambda: mean_pandas_s(price_s)),
}))

tests.append(('MATH.SUM', {
    'pandas': (lambda: sum_pandas_s(price_s)),
}))

# Rolling functions
tests.append(('MATH.ROLLSUM', {
    'pandas': (lambda : rollsum_pandas_s(price_s, WINDOW)),
    'numpy': (lambda skipna=None: rollsum_cumsum(price_nan if skipna else price, WINDOW))
}))

tests.append(('MATH.ROLLMEAN', {
    'pandas': (lambda: rollmean_pandas_s(price_s, WINDOW)),
    'numpy': (lambda skipna=None: rollmean_cumsum(price_nan if skipna else price, WINDOW))
}))

tests.append(('MATH.ROLLMIN', {
    'pandas': (lambda: rollmin_pandas_s(price_s, WINDOW)),
    'talib': (lambda: talib.MIN(price, timeperiod=WINDOW) if talib else None)
}))

tests.append(('MATH.ROLLMAX', {
    'pandas': (lambda: rollmax_pandas_s(price_s, WINDOW)),
    'talib': (lambda: talib.MAX(price, timeperiod=WINDOW) if talib else None)
}))

tests.append(('MATH.ROLLMEDIAN', {
    'pandas': (lambda: rollmedian_pandas_s(price_s, WINDOW))
}))

tests.append(('MATH.ROLLQUANTILE', {
    'pandas': (lambda: rollquantile_pandas_s(price_s, WINDOW, 0.5))
}))

tests.append(('MATH.QUANTILE', {
    'pandas': (lambda: quantile_pandas_s(price_s, 0.5)),
    'numpy': (lambda: quantile_numpy_s(price_s, 0.5))
}))

tests.append(('MATH.SKEW', {
    'pandas': (lambda: skew_pandas_s(price_s))
}))

tests.append(('MATH.KURTOSIS', {
    'pandas': (lambda: kurtosis_pandas_s(price_s))
}))

tests.append(('MATH.ROLLSKEW', {
    'pandas': (lambda: rollskew_pandas_s(price_s, WINDOW))
}))

tests.append(('MATH.ROLLKURTOSIS', {
    'pandas': (lambda: rollkurtosis_pandas_s(price_s, WINDOW))
}))

tests.append(('MATH.ROLLSTDEV', {
    'pandas': (lambda: rollstdev_pandas_s(price_s, WINDOW)),
    'talib': (lambda: talib.STDDEV(price, timeperiod=WINDOW) if talib else None)
}))

tests.append(('MATH.ROLLVAR', {
    'pandas': (lambda: rollvar_pandas_s(price_s, WINDOW)),
    'talib': (lambda: talib.VAR(price, timeperiod=WINDOW) if talib else None)
}))

tests.append(('MATH.ROLLCOVAR', {
    'pandas': (lambda: rollcovar_pandas_s((price_s, price_s), WINDOW))
}))

tests.append(('MATH.COVAR', {
    'pandas': (lambda: covar_pandas_s(high_s, low_s))
}))

tests.append(('MATH.ROLLCORR', {
    'pandas': (lambda: rollcorr_pandas_s(price_s, WINDOW))
}))

# Moving Averages
tests.append(('TA.SMA', { 'talib': (lambda: talib.SMA(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.EMA', { 'talib': (lambda: talib.EMA(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.WMA', { 'talib': (lambda: talib.WMA(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.DEMA', { 'talib': (lambda: talib.DEMA(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.TEMA', { 'talib': (lambda: talib.TEMA(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.T3', { 'talib': (lambda: talib.T3(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.KAMA', { 'talib': (lambda: talib.KAMA(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.TRIMA', { 'talib': (lambda: talib.TRIMA(price, timeperiod=WINDOW) if talib else None) }))

# Momentum / Oscillators
tests.append(('TA.RSI', { 'talib': (lambda: talib.RSI(price, timeperiod=14) if talib else None) }))
tests.append(('TA.MOM', { 'talib': (lambda: talib.MOM(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.ROC', { 'talib': (lambda: talib.ROC(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.CMO', { 'talib': (lambda: talib.CMO(price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.MACD', { 'talib': (lambda: talib.MACD(price, fastperiod=12, slowperiod=26, signalperiod=9) if talib else None) }))
tests.append(('TA.APO', { 'talib': (lambda: talib.APO(price, fastperiod=12, slowperiod=26) if talib else None) }))
tests.append(('TA.PPO', { 'talib': (lambda: talib.PPO(price, fastperiod=12, slowperiod=26) if talib else None) }))

# Trend / volatility / misc
tests.append(('TA.CCI', { 'talib': (lambda: talib.CCI(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.WR%', { 'talib': (lambda: talib.WILLR(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.STOCH', { 'talib': (lambda: talib.STOCH(high, low, price, fastk_period=WINDOW, slowk_period=WINDOW*2, slowd_period=WINDOW+5) if talib else None) }))
tests.append(('TA.STOCHRSI', { 'talib': (lambda: talib.STOCHRSI(price, timeperiod=WINDOW, fastk_period=5, fastd_period=3) if talib else None) }))
tests.append(('TA.ULTOSC', { 'talib': (lambda: talib.ULTOSC(high, low, price, timeperiod1=7, timeperiod2=14, timeperiod3=28) if talib else None) }))

tests.append(('TA.ADX', { 'talib': (lambda: talib.ADX(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.ADXR', { 'talib': (lambda: talib.ADXR(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.DX', { 'talib': (lambda: talib.DX(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.PSAR', { 'talib': (lambda: talib.SAR(high, low, acceleration=0.02, maximum=0.2) if talib else None) }))

tests.append(('TA.ATR', { 'talib': (lambda: talib.ATR(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.NATR', { 'talib': (lambda: talib.NATR(high, low, price, timeperiod=WINDOW) if talib else None) }))
tests.append(('TA.TR', { 'talib': (lambda: talib.TRANGE(high, low, price) if talib else None) }))
tests.append(('TA.BB', { 'talib': (lambda: talib.BBANDS(price, timeperiod=WINDOW, nbdevup=2, nbdevdn=2) if talib else None) }))

tests.append(('TA.OBV', { 'talib': (lambda: talib.OBV(price, volume) if talib else None) }))
tests.append(('TA.Chaikin ACC/DIST', { 'talib': (lambda: talib.AD(high, low, price, volume) if talib else None) }))
tests.append(('TA.ADOSC', { 'talib': (lambda: talib.ADOSC(high, low, price, volume, fastperiod=3, slowperiod=10) if talib else None) }))
tests.append(('TA.MFI', { 'talib': (lambda: talib.MFI(high, low, price, volume, timeperiod=WINDOW) if talib else None) }))

# Math/Stats examples
tests.append(('MATH.CUMSUM', {
    'numpy': (lambda skipna=None: cumsum_numpy(price, skipna=True if skipna else False))
}))
tests.append(('MATH.CUMPROD', {
    'numpy': (lambda skipna=None: cumprod_numpy(price, skipna=True if skipna else False))
}))

tests.append(('MATH.ZSCORE', {
    'numpy': (lambda skipna=None: zscore_numpy(price, skipna=True if skipna else False))
}))

tests.append(('MATH.MEDIAN', {
    'numpy': (lambda skipna=None: median_numpy(price, skipna=True if skipna else False))
}))

tests.append(('MATH.VAR', {
    'numpy': (lambda skipna=None: variance_numpy(price, skipna=True if skipna else False))
}))

tests.append(('MATH.STDEV', {
    'numpy': (lambda skipna=None: stdev_numpy(price, skipna=True if skipna else False))
}))

# Run benchmarks and output JSON
results = []

def _time_impl(fn):
    # If the callable declares at least one positional parameter, call it with True/False.
    # Otherwise do a single timing call. This avoids passing an argument to 0-arg lambdas
    try:
        sig = inspect.signature(fn)
        pos_params = [p for p in sig.parameters.values() if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)]
        if len(pos_params) >= 1:
            t_true = timeit(lambda: fn(True), repeats=5)
            t_false = timeit(lambda: fn(False), repeats=5)
            if t_true is None and t_false is None:
                return None
            if t_true is None:
                return round(t_false, 2)
            if t_false is None:
                return round(t_true, 2)
            return f"{round(t_true,2):.2f}|{round(t_false,2):.2f}"
        else:
            t = timeit(lambda: fn(), repeats=5)
            return round(t, 2) if t is not None else None
    except (ValueError, TypeError):
        # In case signature inspection fails, fall back to safe single-call timing
        t = timeit(lambda: fn(), repeats=5)
        return round(t, 2) if t is not None else None

for name, implementations in tests:
    result = {'name': name}
    for impl_name, fn in implementations.items():
        if fn is not None:
            duration = _time_impl(fn)
            if duration is not None:
                # Normalize duration to a string so the caller can display it without further formatting
                if isinstance(duration, str):
                    result[impl_name] = duration
                else:
                    # numeric duration -> format to 2 decimals
                    result[impl_name] = f"{float(duration):.2f}"
    results.append(result)

print(json.dumps(results))
