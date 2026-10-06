import { NextResponse } from 'next/server';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import {
  getBeaconEventByCallId,
  insertBeaconAudit,
  postBeaconReplayNotice,
  recordBeaconRecording,
} from 'lib/beacon/repository';
import { startBeaconBroadcastEgress, verifyBeaconWebhookSignature } from 'lib/beacon/stream';
import type { StreamAppName } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { recordParticipantLeftUsage } from 'lib/stream-quota/webhook-usage';

export const dynamic = 'force-dynamic';

// Every call event carries `call_cid`, which looks like "livestream:beacon-<id>"; strip the type
// prefix to get the call id. A missing/odd value yields an empty string, which every caller treats as
// "nothing to do".
function extractCallId(payload: Record<string, unknown>): string {
  const callCid = typeof payload.call_cid === 'string' ? payload.call_cid : '';
  return callCid.includes(':') ? callCid.split(':').slice(1).join(':') : callCid;
}

// Pull the call id and recording URL out of the payload defensively. Missing/odd values yield empty
// strings, which the caller treats as "nothing to do". We never fabricate a URL.
function extractRecordingInfo(payload: Record<string, unknown>): { callId: string; recordingUrl: string } {
  const recording = (payload.call_recording ?? {}) as Record<string, unknown>;
  const recordingUrl = typeof recording.url === 'string' ? recording.url : '';
  return { callId: extractCallId(payload), recordingUrl };
}

// Start the public broadcast as soon as a publisher is actually present.
//
// "Go live" only flips the call out of backstage. The public HLS feed and the recording are started
// separately by startBeaconBroadcastEgress, because Stream refuses to start either while no one is
// publishing. Until now the only caller was the in-browser screen-share control, which fires on
// `useHasOngoingScreenShare`. A phone pushing RTMP publishes an ordinary video track, not a
// screen-share track, so a broadcast run entirely from a phone started neither: viewers could sit in
// front of an empty player, and nothing was recorded, so no recording-ready event ever arrived and no
// replay was posted to the Commons. This handler closes that path, and covers the browser host too.
//
// Source: Stream Video webhook events (getstream.io/video/docs/api/webhooks/events/), confirmed
// 2026-08-10. `call.session_participant_joined` fires when a participant joins the call session, and
// Stream's RTMP ingress publishes into the call as a participant — so this is the first moment media
// exists and egress can be started.
//
// Only publishers ever join this call: viewers watch over public HLS and never join it, so this
// arrives once or twice per broadcast, not once per viewer.
//
// `ingress.started` arrives on the same path: it is Stream's own notice that the phone's RTMP feed
// connected, and it is sent whether or not a session-participant event follows. Either one starts the
// feed and recording, on the Stream app that sent the delivery; the second finds them already running.
async function handleParticipantJoined(
  payload: Record<string, unknown>,
  app: StreamAppName,
  command: string,
): Promise<NextResponse> {
  const callId = extractCallId(payload);
  if (callId.length === 0) {
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }

  const event = await getBeaconEventByCallId(callId);
  // Only a live event has anything to broadcast. A draft that has not gone live, or an ended event
  // still receiving a straggling join, must never be put back on air by a webhook.
  if (!event || event.status !== 'live') {
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }

  try {
    const started = await startBeaconBroadcastEgress(event.id, app);
    await logWebhookStep(
      event.id,
      command,
      started,
      started ? `ok (${app} Stream app): public feed and recording started` : `The ${app} Stream app is not configured.`,
    );
    return NextResponse.json({ ok: true, handled: started }, { status: 200 });
  } catch (error) {
    // startBeaconBroadcastEgress already treats "already running" as success, so reaching here is a
    // real refusal of HLS or recording. It is reported (the message names which one and why) and
    // acknowledged rather than retried, because Stream retrying the webhook would not change the answer.
    reportError(error, {
      area: 'beacon',
      op: 'start_egress_on_participant_joined',
      extra: { eventId: event.id, callId },
    });
    await logWebhookStep(
      event.id,
      command,
      false,
      `Starting the public feed or recording on the ${app} Stream app failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }
}

// Write one line to the event's log, which the admin history shows under the event. A failed write
// is reported and never fails the webhook: the log explains the broadcast, it is not part of it.
async function logWebhookStep(eventId: string, command: string, ok: boolean, reason: string): Promise<void> {
  try {
    await insertBeaconAudit({
      actorId: 'stream-webhook',
      command,
      policyStatus: ok ? 'allow' : 'deny',
      reason,
      targetType: 'event',
      targetId: eventId,
    });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'webhook_log', extra: { eventId, command } });
  }
}

// Stream's recording lifecycle events: started, stopped, failed. The app does nothing with them
// except write them to the event's log, so the admin history shows whether Stream ever began
// recording and, when it failed, what it said. Field names are read defensively because the failure
// payload is not documented in detail; any string among them is kept as the reason.
const RECORDING_LIFECYCLE_COMMANDS: Record<string, string> = {
  'call.recording_started': 'beacon.stream.recording-started',
  'call.recording_stopped': 'beacon.stream.recording-stopped',
  'call.recording_failed': 'beacon.stream.recording-failed',
  'ingress.stopped': 'beacon.stream.ingress-stopped',
  'ingress.error': 'beacon.stream.ingress-error',
};

const FAILURE_EVENT_TYPES = new Set(['call.recording_failed', 'ingress.error']);

async function handleRecordingLifecycle(type: string, payload: Record<string, unknown>): Promise<NextResponse> {
  const callId = extractCallId(payload);
  const event = callId.length > 0 ? await getBeaconEventByCallId(callId) : null;
  if (!event) {
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }
  const failed = FAILURE_EVENT_TYPES.has(type);
  const said = ['reason', 'error', 'message']
    .map((key) => payload[key])
    .find((value): value is string => typeof value === 'string' && value.length > 0);
  const reason = failed ? `Stream reported ${type}${said ? `: ${said}` : ' and gave no reason.'}` : 'ok';
  await logWebhookStep(event.id, RECORDING_LIFECYCLE_COMMANDS[type], !failed, reason);
  return NextResponse.json({ ok: true, handled: true }, { status: 200 });
}

// Handle the recording-ready payload: store the URL and post the replay. A payload missing a call id
// / URL / matching event is acknowledged without acting so Stream stops retrying.
async function handleRecordingReady(payload: Record<string, unknown>): Promise<NextResponse> {
  const { callId, recordingUrl } = extractRecordingInfo(payload);

  if (callId.length === 0 || recordingUrl.length === 0) {
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }

  const event = await getBeaconEventByCallId(callId);
  if (!event) {
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }

  // Store the URL (no-op when already set), then re-read so the post helper sees the URL even if
  // this delivery raced an earlier one.
  const updated = (await recordBeaconRecording(event.id, recordingUrl)) ?? {
    ...event,
    recordingUrl,
  };
  await logWebhookStep(event.id, 'beacon.stream.recording-ready', true, 'ok');
  await postBeaconReplayNotice(updated);

  return NextResponse.json({ ok: true, handled: true }, { status: 200 });
}

// A delivery whose signature matches neither Stream app's secret is refused, and until now left no
// trace: the event's log just had no start step. When the body names a Beacon call that exists, the
// refusal is written to that event's log once per event type and server instance, in fixed words.
// Nothing from the unverified body is written except an event type from this list.
const LOGGED_REFUSAL_TYPES = new Set([
  'call.session_participant_joined',
  'ingress.started',
  'call.recording_started',
  'call.recording_ready',
  'call.recording_failed',
]);
const loggedRefusals = new Set<string>();

async function logRefusedDelivery(rawBody: string): Promise<void> {
  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const type = typeof payload.type === 'string' ? payload.type : '';
    const callId = extractCallId(payload);
    if (!LOGGED_REFUSAL_TYPES.has(type) || !callId.startsWith('beacon-')) {
      return;
    }
    const event = await getBeaconEventByCallId(callId);
    const key = `${event?.id}:${type}`;
    if (!event || loggedRefusals.has(key)) {
      return;
    }
    loggedRefusals.add(key);
    await logWebhookStep(
      event.id,
      'beacon.stream.delivery-refused',
      false,
      `Stream sent ${type}, but its signature matched neither Stream app's secret, so it was refused. The secret set for this app differs from the one in the Stream dashboard.`,
    );
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'webhook_refusal_log' });
  }
}

// Stream Video webhook. Verifies the signature, then acts on these events:
//
//   - `call.session_participant_joined` — a publisher is now on the call, so start the public HLS
//     feed and the recording. This is what carries a phone-only RTMP broadcast, which otherwise
//     starts neither.
//   - `call.recording_ready` — store the recording URL and post the replay to the Commons.
//   - `ingress.started` — the phone's RTMP feed connected; handled exactly like a participant join.
//   - `call.recording_started` / `_stopped` / `_failed`, `ingress.stopped` / `.error` — written to
//     the event's log only.
//
// Both Stream apps (production, and the demo app) send here; the signature says which one, and the
// start is made on that app.
//   - `call.session_participant_left` — for ANY call, not only Beacon's: this is the one URL Stream
//     sends every call event to, and the event carries how long the participant was in the session,
//     which is one participant's minutes. Credited to the Stream Video minute meter by the surface
//     the call id names (lib/stream-quota/webhook-usage.ts); Chyme and Back Channel are skipped
//     because their heartbeats already feed the meter (2026-09-19).
//
// Every other event is acknowledged without acting so Stream stops retrying.
//
// Idempotent in both directions: the recording URL and the Commons post id are each written only when
// still null, so a redelivered webhook never double-posts the replay, and a repeated participant-join
// is reported and ignored rather than starting a second broadcast.
//
// Source: Stream Video recording docs (getstream.io/video/docs/react/advanced/recording/), confirmed
// 2026-06-21, and Stream Video webhook events (getstream.io/video/docs/api/webhooks/events/),
// confirmed 2026-08-10. `call.recording_ready` fires ~30s+ after the recording stops and carries the
// URL at `call_recording.url`; `call.session_participant_joined` fires when a participant joins the
// session. Both carry `call_cid` (e.g. "livestream:beacon-<id>") identifying the call. We read those
// defensively and never fabricate a URL.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-signature');

  const app = verifyBeaconWebhookSignature(rawBody, signature);
  if (!app) {
    await logRefusedDelivery(rawBody);
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.webhookSignatureInvalid, message: 'Invalid webhook signature.' },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = rawBody.length > 0 ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch (error) {
    return NextResponse.json({ ok: false, code: BEACON_ERROR_CODE.invalidJson, message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const type = typeof payload.type === 'string' ? payload.type : '';

  try {
    if (type === 'call.session_participant_joined') {
      return await handleParticipantJoined(payload, app, 'beacon.stream.publisher-joined');
    }
    if (type === 'ingress.started') {
      return await handleParticipantJoined(payload, app, 'beacon.stream.ingress-started');
    }
    if (type === 'call.recording_ready') {
      return await handleRecordingReady(payload);
    }
    if (type in RECORDING_LIFECYCLE_COMMANDS) {
      return await handleRecordingLifecycle(type, payload);
    }
    if (type === 'call.session_participant_left') {
      const credited = await recordParticipantLeftUsage(payload);
      return NextResponse.json({ ok: true, handled: credited }, { status: 200 });
    }
    // Acknowledge every other lifecycle event so Stream stops retrying.
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'stream_webhook', extra: { type } });
    // Return 200 so Stream does not hammer retries on our transient failure; we logged it.
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }
}
