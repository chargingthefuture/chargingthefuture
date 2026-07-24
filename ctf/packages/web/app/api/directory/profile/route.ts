import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { deleteOwnDirectoryProfile, getOwnProfile, upsertOwnProfile, validateProfileInput } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import type { DirectoryProfileInput } from 'lib/directory/types';

type ProfileBody = Partial<DirectoryProfileInput>;

function toProfileInput(body: ProfileBody): DirectoryProfileInput {
  return {
    firstName: typeof body.firstName === 'string' ? body.firstName : '',
    lastName: typeof body.lastName === 'string' ? body.lastName : null,
    headline: typeof body.headline === 'string' ? body.headline : null,
    bio: typeof body.bio === 'string' ? body.bio : null,
    profileUrl: typeof body.profileUrl === 'string' ? body.profileUrl : null,
    sectorId: typeof body.sectorId === 'string' ? body.sectorId : null,
    jobTitleId: typeof body.jobTitleId === 'string' ? body.jobTitleId : null,
    skillIds: Array.isArray(body.skillIds)
      ? body.skillIds.filter((value): value is string => typeof value === 'string')
      : [],
    proposedSkills: Array.isArray(body.proposedSkills)
      ? body.proposedSkills.filter((value): value is string => typeof value === 'string')
      : [],
    venmoAddress: typeof body.venmoAddress === 'string' ? body.venmoAddress : null,
    moneroAddress: typeof body.moneroAddress === 'string' ? body.moneroAddress : null,
    bitcoinAddress: typeof body.bitcoinAddress === 'string' ? body.bitcoinAddress : null,
    serviceCreditsAddress: typeof body.serviceCreditsAddress === 'string' ? body.serviceCreditsAddress : null,
    city: typeof body.city === 'string' ? body.city : null,
    state: typeof body.state === 'string' ? body.state : null,
    country: typeof body.country === 'string' ? body.country : null,
  };
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
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
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
    const message = error instanceof Error ? error.message : 'unknown';

    // A first-time profile with no valid Quora URL: the Quora profile link is required to appear in
    // the directory (it is the only social proof), so this is a client validation problem, not a fault.
    if (message === 'directory_quora_url_required') {
      logDirectoryAudit({
        actorId: gate.auth.userId,
        command: 'directory.profile.upsert',
        status: 'deny',
        reason: 'quora_url_required',
        targetType: 'profile',
        targetId: gate.auth.userId,
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
      reportError(error, { area: 'directory', op: 'upsert_own_profile', extra: { userId: gate.auth.userId } });
    }

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.profile.upsert',
      status: 'allow',
      reason: 'profile_ownership_or_admin',
      targetType: 'profile',
      targetId: gate.auth.userId,
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
