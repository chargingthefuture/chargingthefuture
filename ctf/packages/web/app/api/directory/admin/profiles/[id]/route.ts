import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { deleteAdminProfile, updateAdminProfile, validateProfileInput } from 'lib/directory/repository';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import type { DirectoryProfileInput } from 'lib/directory/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = { params: Promise<{ id: string }> };

type AdminProfileBody = Partial<DirectoryProfileInput>;

// Returns the value when it is a string, otherwise the given fallback. Keeps parseBody free of
// per-field type-guard ternaries so it stays within the complexity budget.
function asString<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

// Free-text proposed skills are optional in the admin payload. An absent field stays undefined so
// updateAdminProfile preserves whatever is already stored; an array (including an empty one) replaces
// the stored labels.
function optionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? stringArray(value) : undefined;
}

// Maps a persistence error to the response used by PUT. A message mentioning a "_not_found" selector
// is a client validation problem (400); anything else is a persistence failure (503).
function mapSelectorError(error: unknown): NextResponse {
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
    proposedSkills: optionalStringArray(body.proposedSkills),
    // Fields the admin form may leave out stay undefined so updateAdminProfile preserves
    // the stored value instead of nulling it (payment addresses are member-owned and are
    // never sent by the admin drawer; location is sent, and an empty string clears it).
    venmoAddress: asString(body.venmoAddress, undefined),
    moneroAddress: asString(body.moneroAddress, undefined),
    bitcoinAddress: asString(body.bitcoinAddress, undefined),
    serviceCreditsAddress: asString(body.serviceCreditsAddress, undefined),
    city: asString(body.city, undefined),
    state: asString(body.state, undefined),
    country: asString(body.country, undefined),
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
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
    reportError(error, { area: 'directory', op: 'admin_profiles_id' });
    return mapSelectorError(error);
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
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.profile.delete',
        status: 'deny',
        reason: 'not_found',
        targetType: 'profile',
        targetId: id,
        result: 'failure',
        errorCategory: 'not_found',
      });

      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    if (result === 'claimed_guard') {
      await recordDirectoryAdminAudit({
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

    await recordDirectoryAdminAudit({
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
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_profiles_id' });
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.delete',
      status: 'allow',
      reason: 'unclaimed_only_delete',
      targetType: 'profile',
      targetId: id,
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to delete profile: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
