import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { addReadingsTrack, parseHttpsUrl, removeReadingsTrack, type NewReadingsTrack } from 'lib/chyme/readings/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { ensureMutationCsrf, requireChymeAdminAccess } from '../../../_lib';
import { invalid, readJsonBody, recordReadingsAudit } from '../../_lib';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 200;

function optionalHttpsUrl(value: unknown): { url: string | null } | null {
  if (value === undefined || value === null || value === '') return { url: null };
  const url = parseHttpsUrl(value);
  return url ? { url } : null;
}

// Checks the add-a-recording body field by field and names the first field that is wrong.
function parseNewTrack(body: Record<string, unknown>): { track: NewReadingsTrack } | { error: string } {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > MAX_TITLE_LENGTH) return { error: `title is required and must be at most ${MAX_TITLE_LENGTH} characters.` };
  const audioUrl = parseHttpsUrl(body.audioUrl);
  if (!audioUrl) return { error: 'audioUrl must be an https link to the recording.' };
  const postUrl = optionalHttpsUrl(body.postUrl);
  if (!postUrl) return { error: 'postUrl must be an https link to the blog post, or left empty.' };
  const durationSeconds = typeof body.durationSeconds === 'number' ? Math.round(body.durationSeconds) : NaN;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return { error: 'durationSeconds must be a positive number.' };
  return { track: { title, audioUrl, postUrl: postUrl.url, durationSeconds } };
}

// POST /api/chyme/readings/admin/tracks  { title, audioUrl, durationSeconds, postUrl? }
// Add a recording to the end of the loop. durationSeconds is read from the file by the admin's browser.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) return gate.response;

  const parsed = parseNewTrack(await readJsonBody(request));
  if ('error' in parsed) return invalid(parsed.error);
  const { title, durationSeconds } = parsed.track;

  const audit = { actorId: gate.auth.userId, command: 'chyme.admin.readings.track.add' as const, targetType: 'chyme_readings_tracks' };
  try {
    const id = await addReadingsTrack(gate.auth.userId, parsed.track);
    await recordReadingsAudit({ ...audit, targetId: id, ok: true, metadata: { title, durationSeconds } });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'readings_admin_track_add' });
    await recordReadingsAudit({ ...audit, targetId: 'new', ok: false, metadata: { title } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Could not add the recording: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

// DELETE /api/chyme/readings/admin/tracks?id=<uuid> — take a recording out of the loop. The audio
// file itself lives elsewhere and is not touched.
export async function DELETE(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) return gate.response;

  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID_PATTERN.test(id)) return invalid('id must be the recording id.');

  const audit = { actorId: gate.auth.userId, command: 'chyme.admin.readings.track.remove' as const, targetType: 'chyme_readings_tracks', targetId: id };
  try {
    const removed = await removeReadingsTrack(id);
    await recordReadingsAudit({ ...audit, ok: true, metadata: { removed } });
    if (!removed) {
      return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: 'No recording with that id; it may already have been removed.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'readings_admin_track_remove' });
    await recordReadingsAudit({ ...audit, ok: false });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Could not remove the recording: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
