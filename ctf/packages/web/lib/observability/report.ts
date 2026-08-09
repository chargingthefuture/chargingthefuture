import * as Sentry from '@sentry/nextjs';

import { shouldEnableWebSentry } from './sentry-config';

type ReportContext = {
  // Coarse grouping for the error (e.g. 'chyme', 'directory', 'commons').
  area: string;
  // The specific operation that failed (e.g. 'join', 'list_members', 'send_message').
  op: string;
  // Extra non-sensitive context to make the error debuggable without reproducing
  // it: ids, status codes, filters, etc. NEVER put secrets, tokens, or API keys here.
  extra?: Record<string, unknown>;
};

// Report a caught error to Sentry with debugging context.
//
// Caught errors do not reach Sentry on their own — only unhandled exceptions do,
// via the Next.js onRequestError hook. Routes and client surfaces that catch their
// own errors (to return a friendly message) therefore hide the real cause. Call
// this in those catch blocks so the underlying error, tagged and annotated, shows
// up in Sentry. Works on both the server and the client (@sentry/nextjs).
export function reportError(error: unknown, context: ReportContext): void {
  // Always log to stdout as well, so caught errors are visible in the platform's
  // runtime logs (e.g. Render) even when Sentry is unconfigured or its DSN is
  // missing. Without this, a route that catches its own error and returns a
  // friendly 5xx leaves no readable trace anywhere. ReportContext forbids
  // secrets, so logging the tags/extra is safe.
  console.error(
    `[reportError] area=${context.area} op=${context.op}`,
    error instanceof Error ? (error.stack ?? error.message) : error,
    context.extra ? JSON.stringify(context.extra) : '',
  );

  // Respect the same enable/disable logic as the rest of this module: when Sentry
  // is intentionally off (CTF_SKIP_SENTRY_NEXTJS=1, an empty DSN, or the production
  // build phase), the stdout log above is the only trace and we do not forward to
  // Sentry.
  if (!shouldEnableWebSentry()) {
    return;
  }

  Sentry.captureException(error, {
    tags: { area: context.area, op: context.op },
    ...(context.extra ? { extra: context.extra } : {}),
  });
}
