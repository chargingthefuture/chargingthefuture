import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { insertLighthouseAudit, updateMatch, validateMatchUpdateInput } from 'lib/lighthouse/repository';
import type { LighthouseMatchUpdateInput } from 'lib/lighthouse/types';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ matchId: string }>;
};

type MatchBody = Partial<LighthouseMatchUpdateInput>;

function hasBodyField(body: MatchBody, field: keyof LighthouseMatchUpdateInput): boolean {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function applySettlementFields(input: LighthouseMatchUpdateInput, body: MatchBody): boolean {
  if (hasBodyField(body, 'settlementAmount')) {
    if (body.settlementAmount !== null && typeof body.settlementAmount !== 'number') {
      return false;
    }
    input.settlementAmount = body.settlementAmount;
  }

  if (hasBodyField(body, 'settlementCurrency')) {
    if (body.settlementCurrency !== null && typeof body.settlementCurrency !== 'string') {
      return false;
    }
    input.settlementCurrency = body.settlementCurrency;
  }

  if (hasBodyField(body, 'settledAtIso')) {
    if (body.settledAtIso !== null && typeof body.settledAtIso !== 'string') {
      return false;
    }
    input.settledAtIso = body.settledAtIso;
  }

  return true;
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

export async function PUT(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: MatchBody;
  try {
    body = (await request.json()) as MatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input: LighthouseMatchUpdateInput = {
    status: body.status === 'accepted' || body.status === 'rejected' || body.status === 'cancelled' || body.status === 'completed'
      ? body.status
      : 'pending',
    hostResponse: typeof body.hostResponse === 'string' ? body.hostResponse : null,
  };

  if (!applySettlementFields(input, body)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid match settlement payload.' },
      { status: 400 },
    );
  }

  if (!validateMatchUpdateInput(input)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid match update payload.' },
      { status: 400 },
    );
  }

  const { matchId } = await params;

  try {
    const match = await updateMatch({
      actorUserId: gate.auth.userId,
      matchId,
      status: input.status,
      hostResponse: input.hostResponse,
      settlementAmount: input.settlementAmount,
      settlementCurrency: input.settlementCurrency,
      settledAtIso: input.settledAtIso,
      isAdmin: gate.auth.isAdmin,
    });

    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.match.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'match',
      targetId: match.id,
      metadata: { status: match.status, settlementCurrency: match.settlementCurrency },
    });

    return NextResponse.json({ ok: true, match }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'matches_matchid' });
    return lighthouseErrorResponse(error, 'Match update unavailable.');
  }
}
