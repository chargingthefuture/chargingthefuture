import type { CronCheckInInput, ObservabilityReporter } from './types';
import { shouldEnableWebSentry } from './sentry-config';

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureCheckIn: (checkIn: {
    monitorSlug: string;
    status: 'in_progress' | 'ok' | 'error';
    checkInId?: string;
  }) => string;
};

// The dynamically-imported Sentry SDK is cached for the lifetime of the process (the import is expensive
// and the module never changes at runtime). Tests that need a clean slate can call resetSentryModuleCache.
let sentryModulePromise: Promise<SentryModule | null> | null = null;

async function getSentryModule(): Promise<SentryModule | null> {
  if (!sentryModulePromise) {
    sentryModulePromise = import(
      /* webpackIgnore: true */ '@sentry/nextjs'
    )
      .then((module) => module as unknown as SentryModule)
      .catch(() => null);
  }

  return sentryModulePromise;
}

/**
 * Clear the cached Sentry SDK import so the next check-in re-imports it. Intended for test isolation only;
 * in normal operation the module is cached for the process lifetime by design.
 */
export function resetSentryModuleCache(): void {
  sentryModulePromise = null;
}

export function createSentryReporter(): ObservabilityReporter {
  return {
    async captureCronCheckIn(input: CronCheckInInput): Promise<string | undefined> {
      try {
        if (!shouldEnableWebSentry()) {
          return undefined;
        }

        const sentrySdk = await getSentryModule();
        if (!sentrySdk) {
          return undefined;
        }

        return sentrySdk.captureCheckIn({
          monitorSlug: input.monitorSlug,
          status: input.status,
          checkInId: input.checkInId,
        });
      } catch {
        return undefined;
      }
    },
  };
}
