
import * as Sentry from '@sentry/nextjs';

// Sentry navigation instrumentation for Next.js 15+
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;


// Sentry client config (migrated from sentry.client.config.ts)
import { resolveWebSentryDsn } from 'lib/observability/sentry-config';

const dsn = resolveWebSentryDsn();

if (dsn) {
	Sentry.init({
		dsn,
		sendDefaultPii: false,
		tracesSampleRate: 0,
		environment: process.env.NODE_ENV,
		// Session Replay, fully masked: no text, no typed input and no images or video leave the
		// browser, so a replay shows layout, taps and the failure, never what a member wrote or saw.
		// Disclosed in the privacy policy (app/terms/policy-content.ts, Sentry line).
		integrations: [
			Sentry.replayIntegration({
				maskAllText: true,
				maskAllInputs: true,
				blockAllMedia: true,
				networkDetailAllowUrls: [],
			}),
		],
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
	});
}
// ...existing code...

// Optionally, you can export other hooks or setup as needed
