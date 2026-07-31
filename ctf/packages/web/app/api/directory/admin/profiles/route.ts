import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { createAdminProfile, listAdminProfiles, parsePaginationParams, validateProfileInput } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import type { DirectoryProfileInput } from 'lib/directory/types';
import { reportError } from 'lib/observability/report';

type AdminProfileBody = Partial<DirectoryProfileInput>;

// Returns the value when it is a string, otherwise the given fallback. Keeps parseBody free of
// per-field type-guard ternaries so it stays within the complexity budget.
function asString<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

// Maps a persistence error to a response plus a validation flag. A message mentioning a "_not_found"
// selector is a client validation problem (400); anything else is a persistence failure (503). The
// flag lets the caller record the matching audit errorCategory.
function mapSelectorError(error: unknown): { response: NextResponse; isValidation: boolean } {
  const message = error instanceof Error ? error.message : 'unknown';
  const isValidation = message.includes('_not_found');

  const response = NextResponse.json(
    {
      ok: false,
      code: isValidation ? DIRECTORY_ERROR_CODE.invalidPayload : DIRECTORY_ERROR_CODE.persistenceUnavailable,
      message: isValidation ? 'Invalid selector references in profile payload.' : 'Unable to create profile.',
    },
    { status: isValidation ? 400 : 503 },
  );

  return { response, isValidation };
}

function parseBody(body: AdminProfileBody): DirectoryProfileInput {
  return {
    firstName: asString(body.firstName, ''),
    lastName: asString(body.lastName, null),
    headline: asString(body.headline, null),
    bio: asString(body.bio, null),
    profileUrl: asString(body.profileUrl, null),
    sectorId: asString(body.sectorId, null),
    jobTitleId: asString(body.jobTitleId, null),
    skillIds: stringArray(body.skillIds),
    city: asString(body.city, undefined),
    state: asString(body.state, undefined),
    country: asString(body.country, undefined),
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
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_profiles' });
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
    reportError(error, { area: 'directory', op: 'admin_profiles' });
    const { response, isValidation } = mapSelectorError(error);

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

    return response;
  }
}
