import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

// Crash reporting for the native Android app (the Chyme keep-list surface, rule 105). The DSN and
// provider flag have been passed through app config as `mobileSentryDsn` / `mobileObservabilityProvider`
// (from EXPO_SENTRY_DSN / MOBILE_OBSERVABILITY_PROVIDER) since the config was written, but the
// integration that consumed them was lost when the app was narrowed from the full plugin set to the
// keep-list — so native crashes went unreported (owner report; restored 2026-08-03). Init is a no-op
// when the DSN is absent or the provider is not 'sentry', so a local dev build without secrets runs
// exactly as before.
export function initMobileSentry(): void {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    mobileSentryDsn?: string;
    mobileObservabilityProvider?: string;
  };
  const dsn = (extra.mobileSentryDsn ?? '').trim();
  const provider = (extra.mobileObservabilityProvider ?? 'noop').trim().toLowerCase();
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
