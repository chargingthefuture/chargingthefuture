/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');
const shouldSkipSentryBuildPlugin = process.env.CTF_SKIP_SENTRY_NEXTJS === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..', '..', '..'),
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    dirs: ['app', 'components', 'lib'],
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
