// Session Replay, kept out of the first load: instrumentation-client.ts imports this file only
// after the page has drawn, so the replay recorder does not count against the 3.1 speed budget.
export { replayIntegration } from '@sentry/nextjs';
