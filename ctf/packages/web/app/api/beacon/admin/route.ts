import { NextResponse } from 'next/server';
import { beaconErrorResponse, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { listBeaconEvents, postBeaconReplayNotice, recordBeaconRecording } from 'lib/beacon/repository';
import type { BeaconEvent } from 'lib/beacon/repository';
import { getFreshBeaconRecordingUrl } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// How many ended events without a recording are looked up on Stream per load. Keeps the admin list
// fast; the rest are picked up on later loads.
const RECOVERY_LOOKUPS_PER_LOAD = 5;

// An ended event gets its recording address only from Stream's recording-ready webhook. When that
// delivery is missed, the event has no address, so no replay is posted and the archive workflow has
// nothing to copy (owner report: two ended events with no recording). Ask Stream for the recording
// instead, store it, and post the replay exactly as the webhook would. Both writes only happen while
// still empty, so this never double-posts. A failed lookup leaves the event as it was.
async function recoverMissingRecording(event: BeaconEvent): Promise<BeaconEvent> {
  try {
    const recordingUrl = await getFreshBeaconRecordingUrl(event.id);
    if (!recordingUrl) {
      return event;
    }
    const updated = (await recordBeaconRecording(event.id, recordingUrl)) ?? { ...event, recordingUrl };
    await postBeaconReplayNotice(updated);
    return updated;
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'admin_recover_recording', extra: { eventId: event.id } });
    return event;
  }
}

// Admin: list events newest-first (history + recordings).
export async function GET() {
  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const events = await listBeaconEvents();
    const missing = new Set(
      events
        .filter((event) => event.status === 'ended' && !event.recordingUrl)
        .slice(0, RECOVERY_LOOKUPS_PER_LOAD)
        .map((event) => event.id),
    );
    const resolved = await Promise.all(
      events.map((event) => (missing.has(event.id) ? recoverMissingRecording(event) : event)),
    );
    return NextResponse.json({ ok: true, events: resolved }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'admin_list' });
    return beaconErrorResponse('Could not load events.');
  }
}
