import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { deleteOwnDirectoryProfile, getOwnProfile, upsertOwnProfile, validateProfileInput } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import type { DirectoryProfileInput } from 'lib/directory/types';

type ProfileBody = Partial<DirectoryProfileInput>;

function toProfileInput(body: ProfileBody): DirectoryProfileInput {
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
    venmoAddress: typeof body.venmoAddress === 'string' ? body.venmoAddress : null,
    moneroAddress: typeof body.moneroAddress === 'string' ? body.moneroAddress : null,
    bitcoinAddress: typeof body.bitcoinAddress === 'string' ? body.bitcoinAddress : null,
    serviceCreditsAddress: typeof body.serviceCreditsAddress === 'string' ? body.serviceCreditsAddress : null,
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
    const profile = await upsertOwnProfile(gate.auth.userId, input);

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

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
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

export async function DELETE() {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
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
