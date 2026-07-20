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
