import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import {
  deleteProfile,
  getProfile,
  insertLighthouseAudit,
  upsertProfile,
  validateProfileInput,
} from 'lib/lighthouse/repository';
import type { LighthouseProfileInput } from 'lib/lighthouse/types';
import { reportError } from 'lib/observability/report';

type ProfileBody = Partial<LighthouseProfileInput>;

function parseProfileInput(body: ProfileBody): LighthouseProfileInput {
  return {
    profileType: body.profileType === 'host' ? 'host' : 'seeker',
    bio: typeof body.bio === 'string' ? body.bio : null,
    phoneNumber: typeof body.phoneNumber === 'string' ? body.phoneNumber : null,
    signalUrl: typeof body.signalUrl === 'string' ? body.signalUrl : null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    hasProperty: typeof body.hasProperty === 'boolean' ? body.hasProperty : false,
    housingNeeds: typeof body.housingNeeds === 'string' ? body.housingNeeds : null,
    desiredMoveInDateIso: typeof body.desiredMoveInDateIso === 'string' ? body.desiredMoveInDateIso : null,
    budgetMin: typeof body.budgetMin === 'number' ? body.budgetMin : null,
    budgetMax: typeof body.budgetMax === 'number' ? body.budgetMax : null,
    desiredCountry: typeof body.desiredCountry === 'string' ? body.desiredCountry : null,
  };
}

function lighthouseErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';

  if (code === 'profile_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.profileNotFound, message: 'Lighthouse profile not found.' },
      { status: 404 },
    );
  }

  if (code === 'property_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: 'Lighthouse property not found.' },
      { status: 404 },
    );
  }

  if (code === 'match_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.' },
      { status: 404 },
    );
  }

  if (code === 'block_not_found') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.blockNotFound, message: 'Lighthouse block not found.' },
      { status: 404 },
    );
  }

  if (code === 'not_owner') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.notOwner, message: 'Operation requires ownership.' },
      { status: 403 },
    );
  }

  if (code === 'policy_denied') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
      { status: 403 },
    );
  }

  if (code === 'blocked_pair') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.blockedPair, message: 'Match blocked by pair policy.' },
      { status: 403 },
    );
  }

  if (code === 'self_block') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.selfBlock, message: 'Cannot block your own user account.' },
      { status: 403 },
    );
  }

  if (code === 'duplicate_match') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.duplicateMatch, message: 'Active match request already exists.' },
      { status: 409 },
    );
  }

  if (code === 'invalid payload') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid payload.' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}

async function upsertProfileHandler(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseProfileInput(body);
  if (!validateProfileInput(input)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid profile payload.' },
      { status: 400 },
    );
  }

  try {
    const profile = await upsertProfile(gate.auth.userId, input, gate.auth.isAdmin);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.profile.upsert',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'profile',
      targetId: profile.id,
      metadata: { profileType: profile.profileType },
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'profile' });
    // The audit contract marks lighthouse.profile.upsert as allow_or_deny (with an ownership and a
    // profile-type-lock check). A policy denial raised by the repository must emit a deny audit
    // event, not only the success path.
    const code = error instanceof Error ? error.message : '';
    if (code === 'not_owner' || code === 'policy_denied') {
      await insertLighthouseAudit({
        actorId: gate.auth.userId,
        command: 'lighthouse.profile.upsert',
        policyStatus: 'deny',
        reason: code,
        targetType: 'profile',
        targetId: gate.auth.userId,
        metadata: { profileType: input.profileType },
      });
    }
    return lighthouseErrorResponse(error, 'Profile upsert unavailable.');
  }
}

export async function GET() {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const profile = await getProfile(gate.auth.userId);
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.profileNotFound, message: 'Lighthouse profile not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'profile' });
    return lighthouseErrorResponse(error, 'Profile lookup unavailable.');
  }
}

export async function POST(request: Request) {
  return upsertProfileHandler(request);
}

export async function PUT(request: Request) {
  return upsertProfileHandler(request);
}

export async function DELETE(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    await deleteProfile(gate.auth.userId);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.profile.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'profile',
      targetId: gate.auth.userId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'profile' });
    return lighthouseErrorResponse(error, 'Profile delete unavailable.');
  }
}
