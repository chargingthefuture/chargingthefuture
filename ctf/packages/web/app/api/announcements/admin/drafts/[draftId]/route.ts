import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { updateAnnouncementDraft, validateAnnouncementDraftInput } from 'lib/feed/repository';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import type { AnnouncementDraftInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = {
  params: Promise<{ draftId: string }>;
};

type DraftBody = Partial<AnnouncementDraftInput>;

function parseBody(body: DraftBody): AnnouncementDraftInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    scheduleAtIso: typeof body.scheduleAtIso === 'string' ? body.scheduleAtIso : null,
    expiresAtIso: typeof body.expiresAtIso === 'string' ? body.expiresAtIso : null,
    targeting: body.targeting,
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: DraftBody;
  try {
    body = (await request.json()) as DraftBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateAnnouncementDraftInput(input)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid draft payload.' },
      { status: 400 },
    );
  }

  const { draftId } = await params;

  try {
    const announcement = await updateAnnouncementDraft(gate.auth.userId, draftId, input);
    await recordFeedAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.draft.update',
      status: 'allow',
      reason: 'actor_admin',
      targetType: 'announcement',
      targetId: draftId,
      result: 'success',
      errorCategory: null,
    });
    // The command contract (announcements.draft.update) declares { announcementId, status, updatedAt }.
    return NextResponse.json(
      { ok: true, announcementId: announcement.id, status: announcement.status, updatedAt: announcement.updatedAtIso },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'admin_drafts_draftid' });
    const message = error instanceof Error ? error.message : 'error';
    const status = message === 'announcement_not_found' ? 404 : 503;
    const code = message === 'announcement_not_found' ? FEED_ERROR_CODE.notFound : FEED_ERROR_CODE.persistenceUnavailable;

    await recordFeedAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.draft.update',
      status: 'allow',
      reason: 'actor_admin',
      targetType: 'announcement',
      targetId: draftId,
      result: 'failure',
      errorCategory: message,
    });

    return NextResponse.json(
      { ok: false, code, message: `Unable to update draft: ${failureReason(error)}` },
      { status },
    );
  }
}
