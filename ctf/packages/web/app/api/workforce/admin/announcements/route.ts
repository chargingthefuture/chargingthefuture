import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { createAnnouncement, insertWorkforceAdminAudit, listAnnouncements, validateAnnouncementInput } from 'lib/workforce/repository';
import type { WorkforceAnnouncementInput } from 'lib/workforce/types';
import { reportError } from 'lib/observability/report';

type AnnouncementBody = Partial<WorkforceAnnouncementInput>;

function toAnnouncementInput(body: AnnouncementBody): WorkforceAnnouncementInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    expiresAtIso: typeof body.expiresAtIso === 'string' || body.expiresAtIso === null ? body.expiresAtIso : undefined,
  };
}

export async function GET() {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const announcements = await listAnnouncements(false);
    return NextResponse.json({ announcements }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch announcements.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireWorkforceAdminAccess();
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
  } catch {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toAnnouncementInput(body);
  if (!validateAnnouncementInput(input)) {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid announcement payload.' },
      { status: 400 },
    );
  }

  try {
    const announcement = await createAnnouncement(gate.auth.userId, input);

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.announcements.admin.create',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: announcement.id,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to create announcement.' },
      { status: 503 },
    );
  }
}
