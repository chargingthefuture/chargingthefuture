import { createNoopReporter } from './noop-reporter';
import { shouldEnableWebSentry } from './sentry-config';
import type { ObservabilityProvider, ObservabilityReporter } from './types';

let reporterInstance: ObservabilityReporter | null = null;

function resolveProvider(): ObservabilityProvider {
  if (!shouldEnableWebSentry()) {
    return 'noop';
  }

  const raw = (process.env.OBSERVABILITY_PROVIDER ?? '').trim().toLowerCase();
  return raw === 'sentry' ? 'sentry' : 'noop';
}

/**
 * Returns the process-wide observability reporter, resolving it from the environment on first call.
 *
 * The resolved reporter is cached for the lifetime of the process: once resolved (to Sentry or to the
 * noop reporter) it is reused for every subsequent call and env-var changes are NOT re-read. Changing
 * `OBSERVABILITY_PROVIDER` / Sentry configuration at runtime therefore requires a process restart. Tests
 * (or a hot-reload harness) that mutate `process.env` between cases must call {@link resetReporter} to
 * clear the cache and force re-resolution.
 */
export async function getObservabilityReporter(): Promise<ObservabilityReporter> {
  if (reporterInstance) {
    return reporterInstance;
  }

  const provider = resolveProvider();
  if (provider !== 'sentry') {
    reporterInstance = createNoopReporter();
    return reporterInstance;
  }

  try {
    const { createSentryReporter } = await import('./sentry-reporter.server');
    reporterInstance = createSentryReporter();
  } catch {
    reporterInstance = createNoopReporter();
  }

  return reporterInstance;
}

/**
 * Clear the cached reporter so the next {@link getObservabilityReporter} call re-resolves from the
 * current environment. Intended for tests (and hot-reload harnesses) that mutate `process.env` between
 * cases; not needed in normal request handling, where the process-lifetime cache is the desired behavior.
 */
export function resetReporter(): void {
  reporterInstance = null;
}
