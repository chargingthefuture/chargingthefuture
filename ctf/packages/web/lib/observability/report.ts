import * as Sentry from '@sentry/nextjs';

type ReportContext = {
  // Coarse grouping for the error (e.g. 'chyme', 'directory', 'hub').
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
  Sentry.captureException(error, {
    tags: { area: context.area, op: context.op },
    ...(context.extra ? { extra: context.extra } : {}),
  });
}
