// Test setup: force NaN-aware (skip dense optimization) paths for tests in this run
// Sets SKIP_DENSE_OPTIMIZATION so functions that check shouldSkipDenseOptimization() use the NaN-aware implementation
process.env.SKIP_DENSE_OPTIMIZATION = 'true';
