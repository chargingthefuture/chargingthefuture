import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { createAnnouncement, listDirectoryAnnouncements, validateAnnouncementInput } from 'lib/directory/repository';
import type { DirectoryAnnouncementInput } from 'lib/directory/types';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type AnnouncementBody = Partial<DirectoryAnnouncementInput>;

function parseBody(body: AnnouncementBody): DirectoryAnnouncementInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    publishedAtIso: typeof body.publishedAtIso === 'string' ? body.publishedAtIso : undefined,
    expiresAtIso: typeof body.expiresAtIso === 'string' ? body.expiresAtIso : undefined,
  };
}

export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listDirectoryAnnouncements(false);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_announcements' });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to list announcements: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireDirectoryAdminAccess();
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
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateAnnouncementInput(input)) {
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.upsert',
      status: 'deny',
      reason: 'invalid_payload',
      targetType: 'announcement',
      targetId: 'pending',
      result: 'failure',
      errorCategory: 'validation',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid announcement payload.' },
      { status: 400 },
    );
  }

  try {
    const announcement = await createAnnouncement(gate.auth.userId, input);

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.upsert',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_announcements' });
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.upsert',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: 'pending',
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to create announcement: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
