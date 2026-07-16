import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { createAnnouncementDraft, validateAnnouncementDraftInput } from 'lib/feed/repository';
import type { AnnouncementDraftInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';

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
  } catch {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
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
    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'admin_drafts' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to create draft.' },
      { status: 503 },
    );
  }
}
