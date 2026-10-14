import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isBeaconArchiveUrl, isBeaconEventId } from 'lib/beacon/replays';
import { listUnarchivedBeaconReplays, setBeaconArchivedRecordingUrl } from 'lib/beacon/repository';
import { getFreshBeaconRecordingUrl } from 'lib/beacon/stream';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// Cron-only: the two halves of keeping this project's own copy of every Beacon recording. Stream
// hosts the recording, and its copy can expire or be deleted; the workflow
// `beacon-recordings-archive.yml` downloads each one and publishes it as a GitHub release asset, which
// costs nothing and does not expire.
//
// GET answers with the recordings not copied yet, each with a download address. That address is a
// signed file address, so this route is guarded by CRON_SECRET (Bearer), matching the other internal
// runs, and the workflow never prints it.
// POST records where the copy now lives. Only the one release address per event is accepted.

const ARCHIVE_BATCH = 5;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

function forbidden() {
  return NextResponse.json(
    { ok: false, code: 'beacon_archive_forbidden', message: 'Invalid cron secret.' },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return forbidden();
  }
  try {
    const events = await listUnarchivedBeaconReplays(ARCHIVE_BATCH);
    const pending = [];
    for (const event of events) {
      const downloadUrl = (await getFreshBeaconRecordingUrl(event.id)) ?? event.recordingUrl;
      pending.push({ id: event.id, title: event.title, downloadUrl });
    }
    return NextResponse.json({ ok: true, pending }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'archive_list' });
    return NextResponse.json(
      { ok: false, code: 'beacon_archive_unavailable', message: `Archive list unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

const bodySchema = z.object({
  eventId: z.string().refine(isBeaconEventId, 'eventId must be a Beacon event id.'),
  archivedUrl: z.string(),
});

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return forbidden();
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'beacon_archive_invalid_payload', message: `Invalid body: ${failureReason(error)}` },
      { status: 400 },
    );
  }
  if (!isBeaconArchiveUrl(parsed.archivedUrl, parsed.eventId)) {
    return NextResponse.json(
      {
        ok: false,
        code: 'beacon_archive_invalid_payload',
        message: 'archivedUrl must be <eventId>.mp4 on this repository\'s beacon-recording-<eventId> release.',
      },
      { status: 400 },
    );
  }
  try {
    const event = await setBeaconArchivedRecordingUrl(parsed.eventId, parsed.archivedUrl);
    if (!event) {
      return NextResponse.json(
        { ok: false, code: 'beacon_not_found', message: 'No ended, recorded broadcast has that id.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, eventId: event.id }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'archive_record', extra: { eventId: parsed.eventId } });
    return NextResponse.json(
      { ok: false, code: 'beacon_archive_unavailable', message: `Could not record the copy: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
