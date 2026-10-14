import { withDbTransaction } from 'lib/db/postgres';
import { recordStreamVideoUsage } from './usage';

// The minute meter for every Stream Video call that has no presence heartbeat (owner decision,
// 2026-09-19: the app's own meter is the only one the owner reads; Stream's dashboard is not).
//
// Stream sends the app one webhook per call event, whatever the call. The Beacon route receives
// them all (it is the one URL registered with Stream) and until now acted on two Beacon events and
// acknowledged the rest. `call.session_participant_left` carries `duration_seconds` — how long
// that participant was in the session — which is exactly one participant's minutes. Credited here
// by the surface the call id names: Beacon publishers (`beacon-<event>`), PeerProgramming cohort
// calls (`pp-<cohort>`), Foundation calls (`foundation-call-<id>`).
//
// Chyme rooms and Back Channel calls are NOT credited from the webhook: their presence heartbeats
// already feed the meter, and crediting both would count every Chyme minute twice. Beacon viewers
// watch the public HLS feed and never join the call, so they never appear here; what Stream bills
// for HLS is egress, not participant-minutes.

export const STREAM_VIDEO_WEBHOOK_SURFACE = {
  beacon: 'beacon',
  peerProgramming: 'peer-programming',
  foundation: 'foundation',
  other: 'other',
} as const;

// The surface a call belongs to, from its `call_cid` ("<type>:<id>"), or null when the call is
// metered elsewhere (Chyme, Back Channel) and must not be counted again.
export function surfaceForCallCid(callCid: unknown): string | null {
  if (typeof callCid !== 'string') return null;
  const id = callCid.includes(':') ? callCid.slice(callCid.indexOf(':') + 1) : callCid;
  if (id.startsWith('chyme-') || id.startsWith('back-channel-')) return null;
  if (id.startsWith('beacon-')) return STREAM_VIDEO_WEBHOOK_SURFACE.beacon;
  if (id.startsWith('pp-')) return STREAM_VIDEO_WEBHOOK_SURFACE.peerProgramming;
  if (id.startsWith('foundation-call-')) return STREAM_VIDEO_WEBHOOK_SURFACE.foundation;
  return STREAM_VIDEO_WEBHOOK_SURFACE.other;
}

// What one `call.session_participant_left` payload is worth: the surface and the entire seconds,
// or null when the payload is not that event, names a call metered elsewhere, or carries no usable
// duration. Never throws on an odd payload — the webhook acknowledges and moves on.
export function participantLeftUsage(payload: Record<string, unknown>): { surface: string; seconds: number } | null {
  if (payload.type !== 'call.session_participant_left') return null;
  const surface = surfaceForCallCid(payload.call_cid);
  if (!surface) return null;
  const seconds = typeof payload.duration_seconds === 'number' ? Math.floor(payload.duration_seconds) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return { surface, seconds };
}

// One participant leaving one session, as a key: the call, the session, and the participant's own
// session id (a Stream-side id per join, not a member id). Stream re-sends a delivery it thinks
// failed (a slow response), and the body carries no delivery id, so this is what tells a re-send
// from a second participant leaving. Null when the payload lacks any part, in which case the
// minutes are still credited, as before, with nothing to dedupe on.
export function participantLeftDedupeKey(payload: Record<string, unknown>): string | null {
  const participant =
    typeof payload.participant === 'object' && payload.participant !== null
      ? (payload.participant as Record<string, unknown>)
      : null;
  const parts = [payload.call_cid, payload.session_id, participant?.user_session_id];
  if (!parts.every((part): part is string => typeof part === 'string' && part.length > 0)) return null;
  return parts.join('|');
}

// How long a processed delivery is remembered. Stream's re-sends arrive within minutes, so a day is
// ample, and pruning keeps the table to about a day of rows.
const DELIVERY_MEMORY_HOURS = 24;

// Credit the meter for a participant who left. Returns true when something was credited, false for
// a payload that credits nothing or a re-sent delivery already counted.
export async function recordParticipantLeftUsage(payload: Record<string, unknown>): Promise<boolean> {
  const usage = participantLeftUsage(payload);
  if (!usage) return false;
  const dedupeKey = participantLeftDedupeKey(payload);
  return withDbTransaction(async (client) => {
    if (dedupeKey) {
      await client.query(
        `DELETE FROM stream_video_webhook_deliveries WHERE received_at < NOW() - ($1 || ' hours')::interval`,
        [String(DELIVERY_MEMORY_HOURS)],
      );
      const fresh = await client.query(
        `INSERT INTO stream_video_webhook_deliveries (dedupe_key) VALUES ($1)
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING dedupe_key`,
        [dedupeKey],
      );
      if (fresh.rows.length === 0) return false;
    }
    await recordStreamVideoUsage(client, usage.surface, usage.seconds);
    return true;
  });
}
