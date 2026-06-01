import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import {
  deleteLighthouseAdminAnnouncement,
  insertLighthouseAudit,
  updateLighthouseAdminAnnouncement,
  validateAnnouncementInput,
} from 'lib/lighthouse/repository';
import type { LighthouseAnnouncementInput } from 'lib/lighthouse/types';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ announcementId: string }>;
};

type AnnouncementBody = Partial<LighthouseAnnouncementInput>;

function parseAnnouncementInput(body: AnnouncementBody): LighthouseAnnouncementInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    mandatory: typeof body.mandatory === 'boolean' ? body.mandatory : false,
    priority: typeof body.priority === 'number' ? body.priority : 0,
    expiresAtIso: typeof body.expiresAtIso === 'string' ? body.expiresAtIso : null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: AnnouncementBody;
  try {
    body = (await request.json()) as AnnouncementBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseAnnouncementInput(body);
  if (!validateAnnouncementInput(input)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid announcement payload.' },
      { status: 400 },
    );
  }

  const { announcementId } = await params;

  try {
    const announcement = await updateLighthouseAdminAnnouncement(gate.auth.userId, announcementId, input);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.admin.announcement.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'announcement',
      targetId: announcement.id,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_announcements_announcementid' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin announcement update unavailable.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { announcementId } = await params;

  try {
    const announcement = await deleteLighthouseAdminAnnouncement(gate.auth.userId, announcementId);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.admin.announcement.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'announcement',
      targetId: announcement.id,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_announcements_announcementid' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin announcement delete unavailable.' },
      { status: 503 },
    );
  }
}
