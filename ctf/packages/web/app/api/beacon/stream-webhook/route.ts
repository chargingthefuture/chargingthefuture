import { NextResponse } from 'next/server';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import {
  getBeaconEventByCallId,
  postBeaconReplayNotice,
  recordBeaconRecording,
} from 'lib/beacon/repository';
import { verifyBeaconWebhookSignature } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// Pull the call id and recording URL out of the payload defensively. `call_cid` looks like
// "livestream:beacon-<id>"; strip the type prefix to get the call id. Missing/odd values yield empty
// strings, which the caller treats as "nothing to do". We never fabricate a URL.
function extractRecordingInfo(payload: Record<string, unknown>): { callId: string; recordingUrl: string } {
  const callCid = typeof payload.call_cid === 'string' ? payload.call_cid : '';
  const callId = callCid.includes(':') ? callCid.split(':').slice(1).join(':') : callCid;
  const recording = (payload.call_recording ?? {}) as Record<string, unknown>;
  const recordingUrl = typeof recording.url === 'string' ? recording.url : '';
  return { callId, recordingUrl };
}

// Handle the recording-ready payload: store the URL and post the replay. Non-recording-ready events,
// and recording-ready events missing a call id / URL / matching event, are acknowledged without
// acting so Stream stops retrying.
async function handleRecordingReady(payload: Record<string, unknown>): Promise<NextResponse> {
  const type = typeof payload.type === 'string' ? payload.type : '';
  if (type !== 'call.recording_ready') {
    // Acknowledge other lifecycle events so Stream stops retrying; only recording-ready acts.
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }

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

// Stream Video webhook. Verifies the signature, and on a recording-ready event stores the recording
// URL and posts the replay to the Commons. Idempotent: the recording URL and the Commons post id are
// each written only when still null, so a redelivered webhook never double-posts the replay.
//
// Source: Stream Video recording docs (getstream.io/video/docs/react/advanced/recording/), confirmed
// 2026-06-21. The event name is `call.recording_ready` (fired ~30s+ after the recording stops). The
// payload carries `call_cid` (e.g. "livestream:beacon-<id>") identifying the call and the recording
// URL at `call_recording.url`. We read those defensively and never fabricate a URL.
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
  } catch {
    return NextResponse.json({ ok: false, code: BEACON_ERROR_CODE.invalidJson, message: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    return await handleRecordingReady(payload);
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'stream_webhook' });
    // Return 200 so Stream does not hammer retries on our transient failure; we logged it.
    return NextResponse.json({ ok: true, handled: false }, { status: 200 });
  }
}
