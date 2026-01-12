import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Focus tests on core module suite during migration
    include: ['test/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
      // tests import ESM files from `src/*.js` during dev; include JS outputs so v8 maps coverage
      extension: ".js",
      exclude: ['dist/**', 'test/**', 'node_modules/**']
    }
  }
})