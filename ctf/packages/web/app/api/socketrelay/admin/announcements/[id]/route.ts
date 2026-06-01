import { NextResponse } from 'next/server';

import { ensureMutationCsrf, requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { deleteSocketRelayAdminAnnouncement, updateSocketRelayAdminAnnouncement, validateAnnouncementInput } from 'lib/socketrelay/repository';
import type { SocketRelayAnnouncementInput } from 'lib/socketrelay/types';

type RouteProps = {
  params: Promise<{ id: string }>;
};

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

export async function PUT(request: Request, { params }: RouteProps) {
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
      {
        ok: false,
        code: SOCKETRELAY_ERROR_CODE.invalidPayload,
        message: 'Invalid JSON body.',
      },
      { status: 400 },
    );
  }

  const input = parseAnnouncementInput(body);
  if (!validateAnnouncementInput(input)) {
    return NextResponse.json(
      {
        ok: false,
        code: SOCKETRELAY_ERROR_CODE.invalidPayload,
        message: 'Invalid announcement payload.',
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const announcement = await updateSocketRelayAdminAnnouncement(gate.auth.userId, id, input);
    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_announcement_update', extra: { userId: gate.auth.userId, id } });
    return socketRelayErrorResponse(error, 'Admin announcement update unavailable.');
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;
  try {
    const announcement = await deleteSocketRelayAdminAnnouncement(gate.auth.userId, id);
    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_announcement_delete', extra: { userId: gate.auth.userId, id } });
    return socketRelayErrorResponse(error, 'Admin announcement delete unavailable.');
  }
}
