import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests for the web package's pure logic only (no DB, no network). We deliberately scope the
// run to a few settled, high-value cores (ServiceCredits amount math, Trust evidence) rather than
// the whole app — see Rule 118 (testing scope) and Rule 133. The aliases mirror tsconfig `paths`
// (`@/*` -> package root, `lib/*` -> ./lib) so test imports resolve the same way the app does.
//
// `esbuild.jsx: 'automatic'` is set because one tested module builds JSX (the ClickLog report
// image). Without it esbuild emits `React.createElement` calls into a file that never imports
// React, and the test fails on a missing global rather than on anything real.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${resolve(__dirname, '.')}/` },
      { find: /^lib\//, replacement: `${resolve(__dirname, 'lib')}/` },
    ],
  },
});
