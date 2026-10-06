import { NextResponse } from 'next/server';
import { beaconErrorResponse, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { listBeaconEventLogs, listBeaconEvents, postBeaconReplayNotice, recordBeaconRecording } from 'lib/beacon/repository';
import type { BeaconEvent, BeaconEventLogEntry } from 'lib/beacon/repository';
import { lookupBeaconRecording } from 'lib/beacon/stream';
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
//
// `recordingLookup` carries what Stream answered, so the history row says why there is still no
// recording rather than only that there is none (owner report: every event read "no recording found"
// with no way to tell why).
type AdminEvent = BeaconEvent & { recordingLookup?: string; log?: BeaconEventLogEntry[] };

async function recoverMissingRecording(event: BeaconEvent): Promise<AdminEvent> {
  try {
    const lookup = await lookupBeaconRecording(event.id);
    if (!lookup.url) {
      return { ...event, recordingLookup: lookup.detail };
    }
    const updated = (await recordBeaconRecording(event.id, lookup.url)) ?? { ...event, recordingUrl: lookup.url };
    await postBeaconReplayNotice(updated);
    return updated;
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'admin_recover_recording', extra: { eventId: event.id } });
    return { ...event, recordingLookup: `Saving the recording Stream returned failed: ${error instanceof Error ? error.message : String(error)}` };
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
    const resolved: AdminEvent[] = await Promise.all(
      events.map((event) => (missing.has(event.id) ? recoverMissingRecording(event) : event)),
    );
    // Each event's log of broadcast steps. A failed read leaves the list without logs rather than
    // failing it: the list is how the admin runs a broadcast.
    let logs = new Map<string, BeaconEventLogEntry[]>();
    try {
      logs = await listBeaconEventLogs(events.filter((event) => event.status !== 'draft').map((event) => event.id));
    } catch (error) {
      reportError(error, { area: 'beacon', op: 'admin_event_logs' });
    }
    const withLogs = resolved.map((event) => ({ ...event, log: logs.get(event.id) ?? [] }));
    return NextResponse.json({ ok: true, events: withLogs }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'admin_list' });
    return beaconErrorResponse('Could not load events.');
  }
}
