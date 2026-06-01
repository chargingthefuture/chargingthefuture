import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { deleteProfile, getProfile, insertSocketRelayAudit, upsertProfile, validateProfileInput } from 'lib/socketrelay/repository';
import type { SocketRelayProfileInput } from 'lib/socketrelay/types';

function parseProfileInput(body: Record<string, unknown>): SocketRelayProfileInput {
  return {
    displayName: typeof body.displayName === 'string' ? body.displayName : null,
    bio: typeof body.bio === 'string' ? body.bio : null,
    relayPreferences: body.relayPreferences && typeof body.relayPreferences === 'object' && !Array.isArray(body.relayPreferences)
      ? (body.relayPreferences as Record<string, unknown>)
      : {},
    presenceOptIn: typeof body.presenceOptIn === 'boolean' ? body.presenceOptIn : true,
  };
}

async function upsertHandler(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseProfileInput(body);
  if (!validateProfileInput(input)) {
    return NextResponse.json(
      { ok: false, code: SOCKETRELAY_ERROR_CODE.invalidPayload, message: 'Invalid profile payload.' },
      { status: 400 },
    );
  }

  try {
    const profile = await upsertProfile(gate.auth.userId, input);
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socketrelay.profile.upsert',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'profile',
      targetId: gate.auth.userId,
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'profile_upsert', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Profile upsert unavailable.');
  }
}

export async function GET() {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const profile = await getProfile(gate.auth.userId);
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: SOCKETRELAY_ERROR_CODE.profileNotFound, message: 'SocketRelay profile not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'profile_get', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Profile lookup unavailable.');
  }
}

export async function POST(request: Request) {
  return upsertHandler(request);
}

export async function PUT(request: Request) {
  return upsertHandler(request);
}

export async function DELETE(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    await deleteProfile(gate.auth.userId);
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socketrelay.profile.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'profile',
      targetId: gate.auth.userId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'profile_delete', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Profile delete unavailable.');
  }
}
