import { insertBeaconAudit } from 'lib/beacon/repository';
import { startBeaconBroadcastEgress } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

// Start a live event's public feed and recording from the viewer poll when nothing is playing yet.
//
// A phone broadcast had exactly one trigger for this: Stream's `call.session_participant_joined`
// webhook. When that delivery never arrives (the webhook not registered in Stream's dashboard, or
// refused), the event goes live with no public feed and no recording, and nothing says why (owner
// report: five broadcasts on 2026-10-06, each logged as live then ended with no start step between).
// `GET /api/beacon/current` is polled by every open viewer page, including the admin's own, so it
// sees a live event with no playlist within seconds of the phone connecting.
//
// Stream refuses to start either while nobody is publishing, so the first attempts before the phone
// connects fail and are retried. Attempts are throttled per event per server instance, and a start
// that has already worked is not repeated by this instance. Each distinct outcome is written to the
// event's log once, so the admin history shows the attempt and Stream's answer without a line per poll.
const ATTEMPT_INTERVAL_MS = 15_000;

type KickState = { lastAttemptAt: number; started: boolean; lastLogged: string };
const kickState = new Map<string, KickState>();

async function logOutcome(eventId: string, state: KickState, ok: boolean, reason: string): Promise<void> {
  if (state.lastLogged === reason) {
    return;
  }
  state.lastLogged = reason;
  try {
    await insertBeaconAudit({
      actorId: 'beacon-viewer-poll',
      command: 'beacon.viewer.start-broadcast',
      policyStatus: ok ? 'allow' : 'deny',
      reason,
      targetType: 'event',
      targetId: eventId,
    });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'viewer_start_log', extra: { eventId } });
  }
}

export async function kickBeaconEgressIfIdle(eventId: string): Promise<void> {
  const now = Date.now();
  const state = kickState.get(eventId) ?? { lastAttemptAt: 0, started: false, lastLogged: '' };
  kickState.set(eventId, state);
  if (state.started || now - state.lastAttemptAt < ATTEMPT_INTERVAL_MS) {
    return;
  }
  state.lastAttemptAt = now;
  try {
    const started = await startBeaconBroadcastEgress(eventId);
    if (started) {
      state.started = true;
      await logOutcome(eventId, state, true, 'ok: public feed and recording started');
    } else {
      await logOutcome(eventId, state, false, 'Live video is not configured.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportError(error, { area: 'beacon', op: 'viewer_start_broadcast', extra: { eventId } });
    await logOutcome(eventId, state, false, `Starting the public feed or recording failed: ${message}`);
  }
}
