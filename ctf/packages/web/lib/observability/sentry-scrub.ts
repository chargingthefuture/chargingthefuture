// The privacy filters every web Sentry runtime (browser, server, edge) passes to Sentry.init, so
// nothing sent carries an id, typed text, a request body, a cookie or a sign-in header. The rules
// themselves are shared with Android in @ctf/shared (observability/scrub.ts).
import { seScrubBreadcrumb, seScrubEvent, seScrubReplayFrame } from '@ctf/shared';

export const webSentryScrubOptions = {
  beforeBreadcrumb: seScrubBreadcrumb,
  beforeSend: seScrubEvent,
  beforeSendTransaction: seScrubEvent,
};

// Replay events skip beforeSend; an event processor still sees them, so their addresses are
// scrubbed here.
export function scrubReplayEvent<T extends { type?: string }>(event: T): T {
  return event.type === 'replay_event' ? seScrubEvent(event) : event;
}

export { seScrubReplayFrame as scrubReplayFrame };
