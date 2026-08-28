import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { createAnnouncementDraft, listAnnouncements, validateAnnouncementDraftInput } from 'lib/feed/repository';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import type { AnnouncementDraftInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type AnnouncementBody = Partial<AnnouncementDraftInput>;

function parseBody(body: AnnouncementBody): AnnouncementDraftInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    scheduleAtIso: typeof body.scheduleAtIso === 'string' ? body.scheduleAtIso : null,
    expiresAtIso: typeof body.expiresAtIso === 'string' ? body.expiresAtIso : null,
    targeting: body.targeting,
    // Optional linked plugins (0–3). The repository validates each slug against the visible plugin
    // registry, drops unknown/admin-only/duplicate slugs, and caps the list at 3.
    linkedPluginSlugs: Array.isArray(body.linkedPluginSlugs) ? body.linkedPluginSlugs : undefined,
  };
}

export async function GET() {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const announcements = await listAnnouncements(true);
    return NextResponse.json({ items: announcements }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to list announcements: ${failureReason(error)}` },
      { status: 503 },
    );
  }
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

  let body: AnnouncementBody;
  try {
    body = (await request.json()) as AnnouncementBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateAnnouncementDraftInput(input)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid announcement draft payload.' },
      { status: 400 },
    );
  }

  try {
    const announcement = await createAnnouncementDraft(gate.auth.userId, input);
    await recordFeedAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.draft.create',
      status: 'allow',
      reason: 'admin_authoring_allowed',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to create announcement draft: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
