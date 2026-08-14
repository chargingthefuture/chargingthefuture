import { NextResponse } from 'next/server';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import {
  getBeaconEventByCallId,
  postBeaconReplayNotice,
  recordBeaconRecording,
} from 'lib/beacon/repository';
import { startBeaconBroadcastEgress, verifyBeaconWebhookSignature } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
async function handleParticipantJoined(payload: Record<string, unknown>): Promise<NextResponse> {
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
    const started = await startBeaconBroadcastEgress(event.id);
    return NextResponse.json({ ok: true, handled: started }, { status: 200 });
  } catch (error) {
    // Reaching here usually means egress was already running — the browser screen-share control got
    // there first, or a second publisher joined — and Stream refused to start it twice. Either way the
    // broadcast is already on air, so this is recorded and acknowledged rather than retried.
    reportError(error, {
      area: 'beacon',
      op: 'start_egress_on_participant_joined',
      extra: { eventId: event.id, callId },
    });
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }
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
  await postBeaconReplayNotice(updated);

  return NextResponse.json({ ok: true, handled: true }, { status: 200 });
}

// Stream Video webhook. Verifies the signature, then acts on two events:
//
//   - `call.session_participant_joined` — a publisher is now on the call, so start the public HLS
//     feed and the recording. This is what carries a phone-only RTMP broadcast, which otherwise
//     starts neither.
//   - `call.recording_ready` — store the recording URL and post the replay to the Commons.
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

  const verified = await verifyBeaconWebhookSignature(rawBody, signature);
  if (!verified) {
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
      return await handleParticipantJoined(payload);
    }
    if (type === 'call.recording_ready') {
      return await handleRecordingReady(payload);
    }
    // Acknowledge every other lifecycle event so Stream stops retrying.
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'stream_webhook', extra: { type } });
    // Return 200 so Stream does not hammer retries on our transient failure; we logged it.
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }
}
