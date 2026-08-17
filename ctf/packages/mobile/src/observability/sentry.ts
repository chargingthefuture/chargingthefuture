import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

// Crash reporting for the native Android app (the Chyme keep-list surface, rule 105). The DSN has
// been carried through app config as `mobileSentryDsn` (from EXPO_SENTRY_DSN, which already exists in
// Infisical) all along, but the code that consumed it was lost when the app was narrowed from the
// full plugin set to the keep-list — so the DSN sat unused and native crashes went unreported (owner
// report; restored 2026-08-03).
//
// Turning it on takes no new secret: reporting starts whenever a DSN is present, and the existing
// shared OBSERVABILITY_PROVIDER key can switch it off by naming a different provider. A build with no
// DSN — a local dev build — runs exactly as before.
export function initMobileSentry(): void {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    mobileSentryDsn?: string;
    mobileObservabilityProvider?: string;
  };
  const dsn = (extra.mobileSentryDsn ?? '').trim();
  // Default to on when a DSN is configured: requiring a second opt-in switch is how this stayed
  // silently off. Setting OBSERVABILITY_PROVIDER to anything other than 'sentry' turns it off.
  const provider = (extra.mobileObservabilityProvider ?? 'sentry').trim().toLowerCase();
  if (!dsn || provider !== 'sentry') return;
  Sentry.init({
    dsn,
    // Crash/error capture only — no session replay, no tracing, no PII. Members of this app carry a
    // real-world threat model; the report must never include more than the error itself.
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: __DEV__ ? 'development' : 'production',
  });
}
