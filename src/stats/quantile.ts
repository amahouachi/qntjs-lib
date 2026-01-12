// Quickselect (in-place) helpers for nth-order statistic (expected O(n))
/* Swap two elements in an array (in-place) */
function _swap(arr: Float64Array | number[], i: number, j: number) {
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
}

/* Partition helper for quickselect: move elements < pivot to left */
function _partition(arr: Float64Array | number[], left: number, right: number, pivotIndex: number): number {
  const pivotValue = arr[pivotIndex];
  _swap(arr, pivotIndex, right);
  let store = left;
  for (let i = left; i < right; i++) {
    if (arr[i] < pivotValue) { _swap(arr, store, i); store++; }
  }
  _swap(arr, store, right);
  return store;
}

/* quickselect (Floyd–Rivest style) — expected linear time, low variance */
function _quickselect(arr: Float64Array | number[], k: number, left: number, right: number): number {
  // iterative implementation with an initial adaptive narrowing step for large ranges
  while (right > left) {
    const n = right - left + 1;
    // for very large partitions, choose a good window around k using sampling heuristics
    if (n > 600) {
      const m = k - left + 1;
      const logn = Math.log(n);
      const s = Math.floor(0.5 * Math.exp(2 * logn / 3));
      const sd = Math.floor(0.5 * Math.sqrt((logn * s * (n - s)) / n) * (m - n / 2 >= 0 ? 1 : -1));
      const newLeft = Math.max(left, Math.floor(k - (m * s) / n + sd));
      const newRight = Math.min(right, Math.floor(k + ((n - m) * s) / n + sd));
      // recursively narrow into the smaller window (tail recursion style)
      _quickselect(arr, k, newLeft, newRight);
      // after narrowing, the desired element is within [newLeft, newRight]
      left = newLeft;
      right = newRight;
    }

    // Partition around a pivot chosen near the middle (median-of-three)
    const pivotIndex = (() => {
      const mid = left + ((right - left) >> 1);
      const al = arr[left];
      const am = arr[mid];
      const ar = arr[right];
      if ((al <= am && am <= ar) || (ar <= am && am <= al)) return mid;
      if ((am <= al && al <= ar) || (ar <= al && al <= am)) return left;
      return right;
    })();

    // Use partition similar to classic quickselect (but pivotIndex is inside current bounds)
    const p = _partition(arr, left, right, pivotIndex);
    if (k === p) return arr[k];
    else if (k < p) right = p - 1;
    else left = p + 1;
  }
  return arr[left];
}

/* Sift up in a typed heap (min or max depending on isMin) */
/**
 * Sift an index up within a typed heap (min or max depending on `isMin`).
 * This operates on a heap of indices where `arr` contains the keyed values.
 */
function siftUp(heap: Int32Array, idx: number, isMin: boolean, arr: ArrayLike<number>) {
  let i = idx;
  while (i > 0) {
    const j = (i - 1) >> 1;
    const hi = heap[i];
    const hj = heap[j];
    const xi = arr[hi];
    const xj = arr[hj];
    if ((isMin && xi < xj) || (!isMin && xi > xj) || (xi === xj && hi < hj)) { heap[i] = hj; heap[j] = hi; i = j; } else break;
  }
}

/* Sift down in a typed heap (min or max depending on isMin) */
/**
 * Sift an element down within a typed heap of indices.
 * @param heap Heap storage (Int32Array of indices)
 * @param len Logical length of the heap
 * @param idx Starting index to sift down
 * @param isMin Whether the heap is a min-heap (true) or max-heap (false)
 * @param arr Array-like providing comparable values at indices
 */
function siftDown(heap: Int32Array, len: number, idx: number, isMin: boolean, arr: ArrayLike<number>) {
  let i = idx;
  while (true) {
    const l = i * 2 + 1;
    const r = l + 1;
    let best = i;
    if (l < len) {
      const il = heap[l];
      const ibest = heap[best];
      const al = arr[il];
      const abest = arr[ibest];
      const leftBetter = isMin ? (al < abest || (al === abest && il < ibest)) : (al > abest || (al === abest && il < ibest));
      if (leftBetter) best = l;
    }
    if (r < len) {
      const ir = heap[r];
      const ibest2 = heap[best];
      const ar = arr[ir];
      const abest2 = arr[ibest2];
      const rightBetter = isMin ? (ar < abest2 || (ar === abest2 && ir < ibest2)) : (ar > abest2 || (ar === abest2 && ir < ibest2));
      if (rightBetter) best = r;
    }
    if (best !== i) { const t = heap[i]; heap[i] = heap[best]; heap[best] = t; i = best; } else break;
  }
}

/* Pop heap top (returns top and new length); clears owner if provided */
/**
 * Pop the heap top (logical) and return the popped index and the new length.
 * If `len` is zero returns `{ top: undefined, len: 0 }`.
 */
function popHeap(heap: Int32Array, len: number, isMin: boolean, arr: ArrayLike<number>, owner: Uint8Array): { top?: number; len: number } {
  if (len === 0) return { top: undefined, len: 0 };
  const top = heap[0];
  const last = heap[--len];
  { heap[0] = last; siftDown(heap, len, 0, isMin, arr); }
  owner[top] = 0;
  return { top, len };
}

/* Prune deleted entries from heap top using lazy deletion arrays */
/**
 * Prune logically deleted entries from the heap top using lazy deletion arrays.
 * Returns the new physical length after pruning.
 */
function prune(heap: Int32Array, len: number, isMin: boolean, del: Uint8Array, owner: Uint8Array, arr: ArrayLike<number>): number {
  while (len > 0) {
    const idx = heap[0];
    if (del[idx]) { const popped = popHeap(heap, len, isMin, arr, owner); len = popped.len; del[idx] = 0; }
    else break;
  }
  return len;
}

/* Compute median ignoring NaNs (single-pass, selection-based) */
/**
 * Median of `source` (ignores NaNs). Implemented via `quantile(source, 0.5)`.
 * @param source Input array
 * @returns Median value or NaN
 */
export function median(source: ArrayLike<number>): number {
  return quantile(source, 0.5);
}

/* Sliding quantile via two typed heaps and lazy deletion (rolling median/quantile) */
/**
 * Compute a rolling quantile using two typed heaps with lazy deletion.
 * Handles NaNs by ignoring them; validates `period` and `q`.
 * @param arr Input array
 * @param period Window length (>0)
 * @param q Quantile in [0,1]
 * @returns Float64Array of rolling quantiles (NaN before window fills)
 */
function slidingQuantileHeap(arr: ArrayLike<number>, period: number, q: number): Float64Array {
  const n = arr.length;
  const out = new Float64Array(n);
  // validate period
  if (period <= 0) throw new Error('period must be positive');
  // If not enough data for a single window, return a compact NaN-filled array (small allocation)
  if (n < period) {
    const tmp = new Float64Array(n);
    tmp.fill(NaN);
    return tmp;
  }
  // Only the prefix up to period-2 should be NaN; fill that small prefix instead of the whole array
  const prefix = Math.min(n, period - 1);
  for (let i = 0; i < prefix; i++) out[i] = NaN;

  // Validate q
  if (q < 0 || q > 1) throw new Error('q must be in [0,1]');

  // Typed heaps: physical storage in Int32Array, keep separate logical counts.
  const lowerHeap = new Int32Array(period); // max-heap storing indices
  const upperHeap = new Int32Array(period); // min-heap storing indices
  const del = new Uint8Array(n);
  const owner = new Uint8Array(n); // 0=not inserted, 1=lower, 2=upper
  let lowerLen = 0;
  let upperLen = 0;
  let sizeLower = 0; // logical count of valid elements in lower
  let sizeUpper = 0; // logical count in upper

  // Use local aliases for hot arrays to help JIT
  const a = arr;

  for (let i = 0; i < n; i++) {
    const idx = i;
    const v = a[idx];
    if (v === v) {
      const lTopIdx = lowerLen === 0 ? undefined : lowerHeap[0];
      if (lTopIdx === undefined || v <= a[lTopIdx]) {
        lowerHeap[lowerLen] = idx;
        siftUp(lowerHeap, lowerLen, false, a);
        lowerLen++;
        sizeLower++;
        owner[idx] = 1;
      } else {
        upperHeap[upperLen] = idx;
        siftUp(upperHeap, upperLen, true, a);
        upperLen++;
        sizeUpper++;
        owner[idx] = 2;
      }
    }
    if (i >= period) {
      const outIdx = i - period;
      if (owner[outIdx] === 1) { sizeLower--; del[outIdx] = 1; owner[outIdx] = 0; }
      else if (owner[outIdx] === 2) { sizeUpper--; del[outIdx] = 1; owner[outIdx] = 0; }
      // if owner[outIdx] === 0 then that element was NaN and was never inserted; nothing to do
    }
    // rebalance based on current total valid count
    const cnt = sizeLower + sizeUpper;
    if (cnt === 0) {
      // nothing to rebalance
    } else {
      // compute targetLower for quantile q: we want the lower partition to contain the
      // indices [0 .. lo] where lo = floor((cnt-1)*q), so targetLower = lo + 1
      const lo = Math.floor((cnt - 1) * q);
      const targetLower = lo + 1;
      // rebalance: move elements between heaps until sizeLower == targetLower
      // first prune tops
      lowerLen = prune(lowerHeap, lowerLen, false, del, owner, a);
      upperLen = prune(upperHeap, upperLen, true, del, owner, a);
      while (sizeLower > targetLower) {
        // move top of lower to upper
        lowerLen = prune(lowerHeap, lowerLen, false, del, owner, a);
        const popped = popHeap(lowerHeap, lowerLen, false, a, owner);
        const movedIdx = popped.top!;
        lowerLen = popped.len;
        sizeLower--;
        upperHeap[upperLen] = movedIdx;
        siftUp(upperHeap, upperLen, true, a);
        upperLen++;
        sizeUpper++;
      }
      while (sizeLower < targetLower) {
        upperLen = prune(upperHeap, upperLen, true, del, owner, a);
        const popped = popHeap(upperHeap, upperLen, true, a, owner);
        const movedIdx = popped.top!;
        upperLen = popped.len;
        sizeUpper--;
        lowerHeap[lowerLen] = movedIdx;
        siftUp(lowerHeap, lowerLen, false, a);
        lowerLen++;
        sizeLower++;
      }
      // final prune to make sure tops valid
      lowerLen = prune(lowerHeap, lowerLen, false, del, owner, a);
      upperLen = prune(upperHeap, upperLen, true, del, owner, a);
    }

    if (i >= period - 1) {
      // ensure heap tops are valid
      lowerLen = prune(lowerHeap, lowerLen, false, del, owner, a);
      upperLen = prune(upperHeap, upperLen, true, del, owner, a);
      const total = sizeLower + sizeUpper;
      if (total === 0) { out[i] = NaN; }
      else if ((total & 1) === 1) { const topLower = lowerHeap[0]; out[i] = a[topLower]; }
      else { const topLower = lowerHeap[0]; const topUpper = upperHeap[0]; out[i] = (a[topLower] + a[topUpper]) / 2; }
    }
  }
  return out;
}

/* Rolling median wrapper (q = 0.5) */
/**
 * Compute the rolling median over a sliding window.
 * Ignores NaNs and validates `period`.
 * Returns a Float64Array with NaN entries for positions before the window fills.
 * @param source Input array
 * @param period Window length
 * @returns Float64Array of rolling medians
 */
export function rollmedian(source: ArrayLike<number>, period: number): Float64Array {
  const n = source.length;
  return slidingQuantileHeap(source, period, 0.5);
}
// compute quantile from a pre-filled Float64Array of length p (operates in-place)
function _quantileFromBuf(buf: Float64Array, p: number, q: number): number {
  const idx = (p - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return _quickselect(buf, lo, 0, p - 1);

  const loVal = _quickselect(buf, lo, 0, p - 1);
  // find next smallest in right partition by linear scan
  let hiVal = Infinity;
  for (let i = lo + 1; i < p; i++) {
    const v = buf[i];
    if (v < hiVal) hiVal = v;
  }
  const w = idx - lo;
  return loVal * (1 - w) + hiVal * w;
}

/**
 * Compute the quantile `q` of `source`, ignoring NaNs. Implements a
 * selection-based algorithm using quickselect for expected linear time.
 * @param source Input array
 * @param q Quantile in [0,1]
 * @returns Quantile value or NaN
 */
export function quantile(source: ArrayLike<number>, q: number): number {
  if (q < 0 || q > 1) throw new Error('q must be in [0,1]');
  const nTotal = source.length;
  if (nTotal === 0) return NaN;

  // Single-pass: fill a typed buffer with valid values
  const buf = new Float64Array(nTotal);
  let p = 0;
  for (let i = 0; i < nTotal; i++) {
    const v = source[i];
    if (v === v) buf[p++] = v;
  }
  if (p === 0) return NaN;

  return _quantileFromBuf(buf, p, q);
}

/**
 * Compute multiple percentiles (quantiles) for `source`. When `qs.length`
 * is small, selection is used for each quantile; otherwise the data are
 * sorted once for efficiency.
 * @param source Input array
 * @param qs Array of quantiles in [0,1]
 * @returns Array of quantile values
 */
export function percentiles(source: ArrayLike<number>, qs: number[]): number[] {
  if (qs.length === 0) return [];
  if (qs.length === 1) return [quantile(source, qs[0])];

  // Multiple percentiles: single-pass copy into typed buffer, then either
  // compute each quantile via selection (cheap when qs is small) or sort once
  const nTotal = source.length;
  const buf = new Float64Array(nTotal);
  let p = 0;
  for (let i = 0; i < nTotal; i++) {
    const v = source[i];
    if (v === v) buf[p++] = v;
  }
  if (p === 0) return qs.map(() => NaN);

  // Heuristic: if number of requested percentiles is small relative to data,
  // compute each with quickselect (in-place on the shared buffer). Otherwise
  // sort once and index into sorted array.
  const out: number[] = new Array(qs.length);
  if (qs.length <= 10) {
    // operate on the same buffer; quickselect modifies buffer in-place but that's fine
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (q < 0 || q > 1) { out[i] = NaN; continue; }
      out[i] = _quantileFromBuf(buf, p, q);
    }
    return out;
  }

  const arr = buf.subarray(0, p);
  arr.sort();
  const m = p;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (q < 0 || q > 1) { out[i] = NaN; continue; }
    const idx = (m - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) out[i] = arr[lo];
    else {
      const w = idx - lo;
      out[i] = arr[lo] * (1 - w) + arr[hi] * w;
    }
  }
  return out;
}

/**
 * Compute the rolling quantile over a sliding window.
 * Ignores NaNs and validates `period` and `q`.
 * Returns a Float64Array with NaN entries for positions before the window fills.
 * @param source Input array
 * @param period Window length
 * @param q Quantile in [0,1]
 * @returns Float64Array of rolling quantiles
 */
export function rollquantile(source: ArrayLike<number>, period: number, q: number): Float64Array {
  const n = source.length;
  return slidingQuantileHeap(source, period, q);
}
