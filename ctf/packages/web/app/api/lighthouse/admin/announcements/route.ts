import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import {
  createLighthouseAdminAnnouncement,
  insertLighthouseAudit,
  listLighthouseAdminAnnouncements,
  validateAnnouncementInput,
} from 'lib/lighthouse/repository';
import type { LighthouseAnnouncementInput } from 'lib/lighthouse/types';
import { reportError } from 'lib/observability/report';

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

export async function GET() {
  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listLighthouseAdminAnnouncements();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin announcement listing unavailable.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
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

  try {
    const announcement = await createLighthouseAdminAnnouncement(gate.auth.userId, input);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.admin.announcement.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'announcement',
      targetId: announcement.id,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin announcement create unavailable.' },
      { status: 503 },
    );
  }
}
