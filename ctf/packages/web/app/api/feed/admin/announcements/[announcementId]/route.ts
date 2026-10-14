import { NextResponse } from 'next/server';
import { recordFeedAdminFailure, requireFeedAdminMutation } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import { updateAnnouncementDraft, validateAnnouncementDraftInput } from 'lib/feed/repository';
import type { AnnouncementDraftInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = {
  params: Promise<{ announcementId: string }>;
};

type AnnouncementBody = Partial<AnnouncementDraftInput>;

function parseBody(body: AnnouncementBody): AnnouncementDraftInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    scheduleAtIso: typeof body.scheduleAtIso === 'string' ? body.scheduleAtIso : null,
    expiresAtIso: typeof body.expiresAtIso === 'string' ? body.expiresAtIso : null,
    targeting: body.targeting,
    // Optional linked plugins (0–3). Absent keeps the existing links; an empty array clears them.
    // The repository validates/dedupes/caps the slugs against the visible plugin registry.
    linkedPluginSlugs: Array.isArray(body.linkedPluginSlugs) ? body.linkedPluginSlugs : undefined,
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { announcementId } = await params;
  const audit = { command: 'feed.announcement.draft.update', targetType: 'announcement', targetId: announcementId };
  const gate = await requireFeedAdminMutation(request, audit);
  if (!gate.allowed) {
    return gate.response;
  }

  let body: AnnouncementBody;
  try {
    body = (await request.json()) as AnnouncementBody;
  } catch (error) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateAnnouncementDraftInput(input)) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid announcement payload.' },
      { status: 400 },
    );
  }

  try {
    const announcement = await updateAnnouncementDraft(gate.auth.userId, announcementId, input);
    await recordFeedAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.draft.update',
      status: 'allow',
      reason: 'admin_update_allowed',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_announcements_announcementid' });
    const message = error instanceof Error ? error.message : 'error';
    const status = message === 'announcement_not_found' ? 404 : 503;
    await recordFeedAdminFailure(gate.auth.userId, audit, {
      status: 'allow',
      reason: status === 404 ? 'announcement_not_found' : 'persistence_error',
      errorCategory: status === 404 ? 'not_found' : 'persistence_error',
    });
    const code = message === 'announcement_not_found' ? FEED_ERROR_CODE.notFound : FEED_ERROR_CODE.persistenceUnavailable;

    return NextResponse.json(
      { ok: false, code, message: `Unable to update announcement draft: ${failureReason(error)}` },
      { status },
    );
  }
}
