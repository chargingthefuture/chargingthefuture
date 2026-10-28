
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
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
	});
	startReplayAfterLoad();
}

// Session Replay, fully masked: no text, no typed input and no images or video leave the
// browser, so a replay shows layout, taps and the failure, never what a member wrote or saw.
// Disclosed in the privacy policy (app/terms/policy-content.ts, Sentry line). Added once the page
// has loaded and the browser is idle, so its code is not part of the first load (3.1 speed budget).
function startReplayAfterLoad() {
	if (typeof window === 'undefined') return;
	const start = () => {
		void import('lib/observability/sentry-replay')
			.then(({ replayIntegration }) =>
				Sentry.addIntegration(
					replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true, networkDetailAllowUrls: [] }),
				),
			)
			.catch((error: unknown) => Sentry.captureException(error, { tags: { area: 'observability', op: 'replay_load' } }));
	};
	const idle = () => ('requestIdleCallback' in window ? window.requestIdleCallback(start, { timeout: 5000 }) : setTimeout(start, 2000));
	if (document.readyState === 'complete') idle();
	else window.addEventListener('load', idle, { once: true });
}
// ...existing code...

// Optionally, you can export other hooks or setup as needed
