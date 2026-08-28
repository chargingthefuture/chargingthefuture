import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { deactivateAnnouncement, updateAnnouncement, validateAnnouncementInput } from 'lib/directory/repository';
import type { DirectoryAnnouncementInput } from 'lib/directory/types';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = { params: Promise<{ id: string }> };

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

export async function PUT(request: Request, { params }: RouteParams) {
  const gate = await requireDirectoryAdminAccess();
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
      targetId: id,
      result: 'failure',
      errorCategory: 'validation',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid announcement payload.' },
      { status: 400 },
    );
  }

  try {
    const announcement = await updateAnnouncement(gate.auth.userId, id, input);
    if (!announcement) {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.announcement.upsert',
        status: 'deny',
        reason: 'not_found',
        targetType: 'announcement',
        targetId: id,
        result: 'failure',
        errorCategory: 'not_found',
      });

      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Announcement not found.' },
        { status: 404 },
      );
    }

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.upsert',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_announcements_id' });
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.upsert',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'announcement',
      targetId: id,
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to update announcement: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

  try {
    const ok = await deactivateAnnouncement(gate.auth.userId, id);
    if (!ok) {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.announcement.deactivate',
        status: 'deny',
        reason: 'not_found',
        targetType: 'announcement',
        targetId: id,
        result: 'failure',
        errorCategory: 'not_found',
      });

      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Announcement not found.' },
        { status: 404 },
      );
    }

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.deactivate',
      status: 'allow',
      reason: 'admin_announcement_deactivate',
      targetType: 'announcement',
      targetId: id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_announcements_id' });
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.announcement.deactivate',
      status: 'allow',
      reason: 'admin_announcement_deactivate',
      targetType: 'announcement',
      targetId: id,
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to deactivate announcement: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
