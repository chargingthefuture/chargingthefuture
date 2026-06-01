import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { deactivateAnnouncement, insertWorkforceAdminAudit, updateAnnouncement, validateAnnouncementInput } from 'lib/workforce/repository';
import type { WorkforceAnnouncementInput } from 'lib/workforce/types';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ id: string }>;
};

type AnnouncementBody = Partial<WorkforceAnnouncementInput>;

function toAnnouncementInput(body: AnnouncementBody): WorkforceAnnouncementInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    expiresAtIso: typeof body.expiresAtIso === 'string' || body.expiresAtIso === null ? body.expiresAtIso : undefined,
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

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
    const announcement = await updateAnnouncement(gate.auth.userId, id, input);
    if (!announcement) {
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'Announcement not found.' },
        { status: 404 },
      );
    }

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.announcements.admin.update',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: id,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_announcements_id' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to update announcement.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

  try {
    const result = await deactivateAnnouncement(gate.auth.userId, id);
    if (result === 'not_found') {
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'Announcement not found.' },
        { status: 404 },
      );
    }

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.announcements.admin.deactivate',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: id,
    });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_announcements_id' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to deactivate announcement.' },
      { status: 503 },
    );
  }
}
