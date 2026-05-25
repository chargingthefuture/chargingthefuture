/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');
const shouldSkipSentryBuildPlugin = process.env.CTF_SKIP_SENTRY_NEXTJS === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
    // Route handler params type changed to Promise<{...}> in Next.js 15+.
    // Suppress build-time type errors until all 71 route handlers are migrated.
    ignoreBuildErrors: true,
  },
};

module.exports = shouldSkipSentryBuildPlugin
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: true,
      webpack: {
        automaticVercelMonitors: true,
      },
    });
