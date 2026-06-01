import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { createSocketRelayAdminAnnouncement, listSocketRelayAdminAnnouncements, validateAnnouncementInput } from 'lib/socketrelay/repository';
import type { SocketRelayAnnouncementInput } from 'lib/socketrelay/types';

function parseAnnouncementInput(body: Record<string, unknown>): SocketRelayAnnouncementInput {
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
  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listSocketRelayAdminAnnouncements();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_announcements_list', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Admin announcements unavailable.');
  }
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseAnnouncementInput(body);
  if (!validateAnnouncementInput(input)) {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid announcement payload.' },
      { status: 400 },
    );
  }

  try {
    const announcement = await createSocketRelayAdminAnnouncement(gate.auth.userId, input);
    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_announcement_create', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Admin announcement create unavailable.');
  }
}
