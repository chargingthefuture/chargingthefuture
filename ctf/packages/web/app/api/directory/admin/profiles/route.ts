import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { createAdminProfile, listAdminProfiles, parsePaginationParams, validateProfileInput } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import type { DirectoryProfileInput } from 'lib/directory/types';

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

export async function GET(request: Request) {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const pagination = parsePaginationParams(request.url);
  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';

  try {
    const payload = await listAdminProfiles(pagination, includeInactive);
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to list admin profiles.' },
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
    const profile = await createAdminProfile(gate.auth.userId, input);

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.create',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'profile',
      targetId: profile.id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const isValidation = message.includes('_not_found');

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.create',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'profile',
      targetId: 'pending',
      result: 'failure',
      errorCategory: isValidation ? 'validation' : 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: isValidation ? DIRECTORY_ERROR_CODE.invalidPayload : DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: isValidation ? 'Invalid selector references in profile payload.' : 'Unable to create profile.',
      },
      { status: isValidation ? 400 : 503 },
    );
  }
}
