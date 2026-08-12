import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { createFeedCommunityPost } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';
import { BEACON_MAX_DESCRIPTION_LENGTH, BEACON_MAX_TITLE_LENGTH, BEACON_STREAM_CALL_TYPE } from './constants';
import { beaconCallIdForEvent } from './stream';

export type BeaconEventStatus = 'draft' | 'live' | 'ended';

export type BeaconEvent = {
  id: string;
  title: string;
  description: string;
  status: BeaconEventStatus;
  hostUserId: string;
  streamCallType: string;
  streamCallId: string;
  startedAtIso: string | null;
  endedAtIso: string | null;
  recordingUrl: string | null;
  recordingReadyAtIso: string | null;
  commonsLivePostId: string | null;
  commonsRecordingPostId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type BeaconEventRow = {
  id: string;
  title: string;
  description: string;
  status: BeaconEventStatus;
  host_user_id: string;
  stream_call_type: string;
  stream_call_id: string;
  started_at: Date | null;
  ended_at: Date | null;
  recording_url: string | null;
  recording_ready_at: Date | null;
  commons_live_post_id: string | null;
  commons_recording_post_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function toIso(value: Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function mapEventRow(row: BeaconEventRow): BeaconEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    hostUserId: row.host_user_id,
    streamCallType: row.stream_call_type,
    streamCallId: row.stream_call_id,
    startedAtIso: toIso(row.started_at),
    endedAtIso: toIso(row.ended_at),
    recordingUrl: row.recording_url,
    recordingReadyAtIso: toIso(row.recording_ready_at),
    commonsLivePostId: row.commons_live_post_id,
    commonsRecordingPostId: row.commons_recording_post_id,
    createdAtIso: new Date(row.created_at).toISOString(),
    updatedAtIso: new Date(row.updated_at).toISOString(),
  };
}

const EVENT_COLUMNS = `id, title, description, status, host_user_id, stream_call_type, stream_call_id,
  started_at, ended_at, recording_url, recording_ready_at, commons_live_post_id,
  commons_recording_post_id, created_at, updated_at`;

export async function createBeaconEvent(input: {
  hostUserId: string;
  title: string;
  description: string;
}): Promise<BeaconEvent> {
  const id = randomUUID();
  const title = input.title.trim().slice(0, BEACON_MAX_TITLE_LENGTH);
  const description = input.description.trim().slice(0, BEACON_MAX_DESCRIPTION_LENGTH);
  const result = await queryDb<BeaconEventRow>(
    `INSERT INTO beacon_events (id, title, description, status, host_user_id, stream_call_type, stream_call_id)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6)
     RETURNING ${EVENT_COLUMNS}`,
    [id, title, description, input.hostUserId, BEACON_STREAM_CALL_TYPE, beaconCallIdForEvent(id)],
  );
  return mapEventRow(result.rows[0]);
}

export async function getBeaconEvent(eventId: string): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `SELECT ${EVENT_COLUMNS} FROM beacon_events WHERE id = $1::uuid LIMIT 1`,
    [eventId],
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

// The single currently-live event (the schema enforces at most one). Null when nothing is live.
export async function getLiveBeaconEvent(): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `SELECT ${EVENT_COLUMNS} FROM beacon_events WHERE status = 'live' ORDER BY started_at DESC NULLS LAST LIMIT 1`,
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

// The most recent ended event that has a recording, for the viewer's "watch the last replay" state.
export async function getLatestReplayBeaconEvent(): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `SELECT ${EVENT_COLUMNS} FROM beacon_events
     WHERE status = 'ended' AND recording_url IS NOT NULL
     ORDER BY ended_at DESC NULLS LAST LIMIT 1`,
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

export async function listBeaconEvents(limit = 50): Promise<BeaconEvent[]> {
  const result = await queryDb<BeaconEventRow>(
    `SELECT ${EVENT_COLUMNS} FROM beacon_events ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapEventRow);
}

// Delete a draft event. DRAFTS ONLY — the `status = 'draft'` predicate is in the SQL, not just in
// the route, so no future caller can delete a live or ended broadcast even by mistake. A draft has
// never been broadcast: nobody watched it, it has no recording, and it is absent from the member
// view, so deleting one destroys nothing a member ever saw. A live or ended event is the opposite —
// it is public history plus a recording, and removing it is not the app's job.
//
// Returns true when a row was deleted, false when the id does not exist OR is not a draft. The
// caller distinguishes those two cases by loading the event first.
export async function deleteDraftBeaconEvent(eventId: string): Promise<boolean> {
  const result = await queryDb(
    `DELETE FROM beacon_events WHERE id = $1::uuid AND status = 'draft'`,
    [eventId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markBeaconEventLive(eventId: string): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `UPDATE beacon_events
     SET status = 'live', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING ${EVENT_COLUMNS}`,
    [eventId],
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

export async function markBeaconEventEnded(eventId: string): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `UPDATE beacon_events
     SET status = 'ended', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING ${EVENT_COLUMNS}`,
    [eventId],
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

// Store the live-now Commons post id on the event. Idempotent — only sets it when still null, so a
// retried go-live never double-posts.
export async function setBeaconLivePostId(eventId: string, postId: string): Promise<void> {
  await queryDb(
    `UPDATE beacon_events SET commons_live_post_id = $2::uuid, updated_at = NOW()
     WHERE id = $1::uuid AND commons_live_post_id IS NULL`,
    [eventId, postId],
  );
}

export async function recordBeaconRecording(eventId: string, recordingUrl: string): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `UPDATE beacon_events
     SET recording_url = $2, recording_ready_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND recording_url IS NULL
     RETURNING ${EVENT_COLUMNS}`,
    [eventId, recordingUrl],
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

export async function setBeaconRecordingPostId(eventId: string, postId: string): Promise<void> {
  await queryDb(
    `UPDATE beacon_events SET commons_recording_post_id = $2::uuid, updated_at = NOW()
     WHERE id = $1::uuid AND commons_recording_post_id IS NULL`,
    [eventId, postId],
  );
}

// Find the event a Stream call id belongs to (the webhook carries the call id, not our event id).
export async function getBeaconEventByCallId(streamCallId: string): Promise<BeaconEvent | null> {
  const result = await queryDb<BeaconEventRow>(
    `SELECT ${EVENT_COLUMNS} FROM beacon_events WHERE stream_call_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [streamCallId],
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
}

export async function insertBeaconAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `INSERT INTO beacon_events_admin_audit_trail
      (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      randomUUID(),
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

// Commons notices carry the full web address, not a bare `/apps/beacon` path. A member reading the
// post in the mobile feed or in Commons can tap it and land on the broadcast; a path fragment only
// works if the reader already knows the domain and types it in. Same shape as the announcement link
// lines in `lib/feed/repository.ts`.
const BEACON_APP_URL = 'https://app.chargingthefuture.com/apps/beacon';

// Auto-post a "live now" notice to the Commons on go-live. Idempotent: if the event already carries a
// live-post id we skip. Returns the post id (or null when nothing was posted). A Commons failure is
// reported but never blocks go-live — the broadcast matters more than the notice.
export async function postBeaconLiveNotice(event: BeaconEvent): Promise<string | null> {
  if (event.commonsLivePostId) {
    return event.commonsLivePostId;
  }
  try {
    const body = `🔴 Live now: ${event.title}. Watch the broadcast at ${BEACON_APP_URL} — no sign-in needed to watch; sign in to chat.`;
    const post = await createFeedCommunityPost(event.hostUserId, { body, category: 'event' });
    await setBeaconLivePostId(event.id, post.postId);
    return post.postId;
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'commons_live_post', extra: { eventId: event.id } });
    return null;
  }
}

// Auto-post the replay to the Commons when the recording is ready. Idempotent on the stored post id.
export async function postBeaconReplayNotice(event: BeaconEvent): Promise<string | null> {
  if (event.commonsRecordingPostId) {
    return event.commonsRecordingPostId;
  }
  if (!event.recordingUrl) {
    return null;
  }
  try {
    const body = `▶️ Watch the replay: ${event.title}. The recording is available at ${BEACON_APP_URL}.`;
    const post = await createFeedCommunityPost(event.hostUserId, { body, category: 'event' });
    await setBeaconRecordingPostId(event.id, post.postId);
    return post.postId;
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'commons_replay_post', extra: { eventId: event.id } });
    return null;
  }
}
