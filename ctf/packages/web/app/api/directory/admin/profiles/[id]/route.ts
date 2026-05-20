import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { deleteAdminProfile, updateAdminProfile, validateProfileInput } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import type { DirectoryProfileInput } from 'lib/directory/types';

type RouteParams = { params: Promise<{ id: string }> };

type AdminProfileBody = Partial<DirectoryProfileInput>;

function parseBody(body: AdminProfileBody): DirectoryProfileInput {
  return {
    displayName: typeof body.displayName === 'string' ? body.displayName : '',
    headline: typeof body.headline === 'string' ? body.headline : null,
    bio: typeof body.bio === 'string' ? body.bio : null,
    profileUrl: typeof body.profileUrl === 'string' ? body.profileUrl : null,
    sectorId: typeof body.sectorId === 'string' ? body.sectorId : null,
    jobTitleId: typeof body.jobTitleId === 'string' ? body.jobTitleId : null,
    skillIds: Array.isArray(body.skillIds)
      ? body.skillIds.filter((value): value is string => typeof value === 'string')
      : [],
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

  let body: AdminProfileBody;
  try {
    body = (await request.json()) as AdminProfileBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateProfileInput(input)) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid profile payload.' },
      { status: 400 },
    );
  }

  try {
    const profile = await updateAdminProfile(gate.auth.userId, id, input);
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const isValidation = message.includes('_not_found');

    return NextResponse.json(
      {
        ok: false,
        code: isValidation ? DIRECTORY_ERROR_CODE.invalidPayload : DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: isValidation ? 'Invalid selector references in profile payload.' : 'Unable to update profile.',
      },
      { status: isValidation ? 400 : 503 },
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
    const result = await deleteAdminProfile(gate.auth.userId, id);
    if (result === 'not_found') {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    if (result === 'claimed_guard') {
      logDirectoryAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.profile.delete',
        status: 'deny',
        reason: 'invalid_claimed_unclaimed_transition',
        targetType: 'profile',
        targetId: id,
        result: 'failure',
        errorCategory: 'policy',
      });

      return NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.claimedProfileGuard,
          message: 'Claimed profiles cannot be deleted; unassign first.',
        },
        { status: 409 },
      );
    }

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.delete',
      status: 'allow',
      reason: 'unclaimed_only_delete',
      targetType: 'profile',
      targetId: id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete profile.' },
      { status: 503 },
    );
  }
}
