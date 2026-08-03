import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { deleteOwnDirectoryProfile, getOwnProfile, upsertOwnProfile, validateProfileInput } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import type { DirectoryProfileInput } from 'lib/directory/types';
import { failureReason } from 'lib/errors/failure';

type ProfileBody = Partial<DirectoryProfileInput>;

// Returns the value when it is a string, otherwise the given fallback. Keeps toProfileInput free of
// per-field type-guard ternaries so it stays within the complexity budget.
function asString<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toProfileInput(body: ProfileBody): DirectoryProfileInput {
  return {
    firstName: asString(body.firstName, ''),
    lastName: asString(body.lastName, null),
    headline: asString(body.headline, null),
    bio: asString(body.bio, null),
    profileUrl: asString(body.profileUrl, null),
    sectorId: asString(body.sectorId, null),
    jobTitleId: asString(body.jobTitleId, null),
    skillIds: stringArray(body.skillIds),
    proposedSkills: stringArray(body.proposedSkills),
    venmoAddress: asString(body.venmoAddress, null),
    moneroAddress: asString(body.moneroAddress, null),
    bitcoinAddress: asString(body.bitcoinAddress, null),
    serviceCreditsAddress: asString(body.serviceCreditsAddress, null),
    city: asString(body.city, null),
    state: asString(body.state, null),
    country: asString(body.country, null),
  };
}

// Maps a failed upsert to its response, logging the matching audit entry and reporting unexpected
// faults. Extracted from handleUpsert to keep that handler within the complexity budget; behavior is
// unchanged from the inline handling.
function handleUpsertError(error: unknown, userId: string): NextResponse {
  const message = error instanceof Error ? error.message : 'unknown';

  // A first-time profile with no valid Quora URL: the Quora profile link is required to appear in
  // the directory (it is the only social proof), so this is a client validation problem, not a fault.
  if (message === 'directory_quora_url_required') {
    logDirectoryAudit({
      actorId: userId,
      command: 'directory.profile.upsert',
      status: 'deny',
      reason: 'quora_url_required',
      targetType: 'profile',
      targetId: userId,
      result: 'failure',
      errorCategory: 'validation',
    });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.invalidPayload,
        message: 'A valid Quora profile URL is required (e.g. https://www.quora.com/profile/Your-Name).',
      },
      { status: 400 },
    );
  }

  const isSelectorIssue = message.includes('directory_') && message.endsWith('_not_found');

  // A selector-not-found is a client validation problem; anything else is an
  // unexpected server/persistence failure worth reporting.
  if (!isSelectorIssue) {
    reportError(error, { area: 'directory', op: 'upsert_own_profile', extra: { userId } });
  }

  logDirectoryAudit({
    actorId: userId,
    command: 'directory.profile.upsert',
    status: 'allow',
    reason: 'profile_ownership_or_admin',
    targetType: 'profile',
    targetId: userId,
    result: 'failure',
    errorCategory: isSelectorIssue ? 'validation' : 'persistence_error',
  });

  return NextResponse.json(
    {
      ok: false,
      code: isSelectorIssue ? DIRECTORY_ERROR_CODE.invalidPayload : DIRECTORY_ERROR_CODE.persistenceUnavailable,
      message: isSelectorIssue ? 'Invalid selector references in profile payload.' : 'Unable to save profile.',
    },
    { status: isSelectorIssue ? 400 : 503 },
  );
}

export async function GET() {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const profile = await getOwnProfile(gate.auth.userId);
    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'get_own_profile', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch profile.' },
      { status: 503 },
    );
  }
}

async function handleUpsert(request: Request) {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = toProfileInput(body);
  if (!validateProfileInput(input)) {
    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.profile.upsert',
      status: 'deny',
      reason: 'invalid_payload',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'failure',
      errorCategory: 'validation',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid profile payload.' },
      { status: 400 },
    );
  }

  try {
    const { profile, quoraUrlKept } = await upsertOwnProfile(gate.auth.userId, input);

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.profile.upsert',
      status: 'allow',
      reason: 'profile_ownership_or_admin',
      targetType: 'profile',
      targetId: profile.id,
      result: 'success',
      errorCategory: null,
    });

    // quoraUrlKept === true means the member submitted an empty/invalid Quora URL and we kept their
    // previous one (the URL can never be emptied). The client shows a note when this is set.
    return NextResponse.json({ ok: true, profile, quoraUrlKept }, { status: 200 });
  } catch (error) {
    return handleUpsertError(error, gate.auth.userId);
  }
}

export async function POST(request: Request) {
  return handleUpsert(request);
}

export async function PUT(request: Request) {
  return handleUpsert(request);
}

export async function DELETE(request: Request) {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const deletion = await deleteOwnDirectoryProfile(gate.auth.userId);

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.profile.delete.service',
      status: 'allow',
      reason: 'service_scope_confirmed',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(
      { ok: true, scope: 'service', status: 'completed', requestedAtIso: deletion.requestedAtIso },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'directory', op: 'delete_own_profile', extra: { userId: gate.auth.userId } });
    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.profile.delete.service',
      status: 'allow',
      reason: 'service_scope_confirmed',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete directory profile.' },
      { status: 503 },
    );
  }
}
