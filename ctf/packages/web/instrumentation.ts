function shouldSkipSentryBootstrap(): boolean {
  return (
    process.env.CTF_SKIP_SENTRY_NEXTJS === '1'
    || process.env.NEXT_PHASE === 'phase-production-build'
  );
}

async function initSentryForRuntime(runtime: 'nodejs' | 'edge'): Promise<void> {
  try {
    const { resolveWebSentryDsn } = await import('./lib/observability/sentry-config');
    const dsn = resolveWebSentryDsn();
    if (!dsn) {
      return;
    }

    const Sentry = await import(
      /* webpackIgnore: true */ '@sentry/nextjs'
    );

    const environment = runtime === 'edge'
      ? (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV
      : process.env.NODE_ENV;

    Sentry.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment,
    });
  } catch {
    // Keep runtime startup resilient if telemetry initialization fails.
  }
}

// Sentry onRequestError hook for Next.js 15+
export async function onRequestError(error: unknown, context: Record<string, unknown>) {
  if (shouldSkipSentryBootstrap()) {
    return;
  }

  try {
    const Sentry = await import(
      /* webpackIgnore: true */ '@sentry/nextjs'
    );
    Sentry.withScope((scope) => {
      scope.setContext('next_request_error', context);
      Sentry.captureException(error, {
        mechanism: {
          handled: false,
          type: 'auto.function.nextjs.on_request_error',
        },
      });
    });
  } catch {
    // Do not fail request handling when telemetry cannot initialize.
  }
}

export async function register(): Promise<void> {
  if (shouldSkipSentryBootstrap()) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initSentryForRuntime('nodejs');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await initSentryForRuntime('edge');
  }
}
