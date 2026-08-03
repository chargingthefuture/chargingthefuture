import * as Sentry from '@sentry/react-native';

type ReportContext = {
  // Coarse grouping for the error (e.g. 'chyme', 'auth', 'unlock').
  area: string;
  // The specific operation that failed (e.g. 'join_call', 'refresh_session').
  op: string;
  // Extra non-sensitive context: ids, status codes, filters. NEVER secrets, tokens, or keys.
  extra?: Record<string, unknown>;
};

// Report a caught error from the native app (rule 137), mirroring the web `reportError`.
//
// A caught error does not reach Sentry on its own — only an unhandled crash does. Every screen that
// catches its own failure to show a friendly message was therefore hiding the cause, and on a phone
// there is no console to check afterwards. This is the one place the reason gets recorded.
//
// Always logs to the device console as well, so a failure is visible in a dev build and in `adb logcat`
// even when Sentry is not configured (no DSN, or the provider flag is not 'sentry' — see
// `initMobileSentry`). ReportContext forbids secrets, so logging the tags is safe.
export function reportError(error: unknown, context: ReportContext): void {
  console.error(
    `[reportError] area=${context.area} op=${context.op}`,
    error instanceof Error ? (error.stack ?? error.message) : error,
    context.extra ? JSON.stringify(context.extra) : '',
  );

  try {
    Sentry.captureException(error, {
      tags: { area: context.area, op: context.op },
      extra: context.extra,
    });
  } catch {
    // no-trace: Sentry is not initialised in this build, and the console line above is the record.
  }
}

// The readable reason behind a caught value, for an operator-facing message on an admin screen. Member
// screens keep their own plain wording and send the reason to `reportError` instead.
export function reasonText(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim();
  if (raw.length === 0) {
    return error instanceof Error ? `${error.name} with no message` : 'unknown error';
  }
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}
