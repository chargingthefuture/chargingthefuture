import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { createAnnouncementDraft, validateAnnouncementDraftInput } from 'lib/feed/repository';
import { logFeedAudit } from 'lib/feed/audit';
import type { AnnouncementDraftInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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

export async function POST(request: Request) {
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

  try {
    const announcement = await createAnnouncementDraft(gate.auth.userId, input);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.draft.create',
      status: 'allow',
      reason: 'actor_admin',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });
    // The command contract (announcements.draft.create) declares { announcementId, status, createdAt }.
    return NextResponse.json(
      { ok: true, announcementId: announcement.id, status: announcement.status, createdAt: announcement.createdAtIso },
      { status: 201 },
    );
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'admin_drafts' });
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.draft.create',
      status: 'allow',
      reason: 'actor_admin',
      targetType: 'announcement',
      targetId: 'unknown',
      result: 'failure',
      errorCategory: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to create draft: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
