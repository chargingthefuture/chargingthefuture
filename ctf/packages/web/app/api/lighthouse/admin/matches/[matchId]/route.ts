import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
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

export async function PUT(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseAdminAccess();
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

  // Reject an unknown/typo status outright rather than silently resetting the match to 'pending'.
  const allowedStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] as const;
  if (!allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid match status.' },
      { status: 400 },
    );
  }

  const input: LighthouseMatchUpdateInput = {
    status: body.status as (typeof allowedStatuses)[number],
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
      isAdmin: true,
    });

    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.admin.match.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'match',
      targetId: match.id,
      metadata: { status: match.status, settlementCurrency: match.settlementCurrency },
    });

    return NextResponse.json({ ok: true, match }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_matches_matchid' });
    const code = error instanceof Error ? error.message : '';

    if (code === 'match_not_found') {
      return NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin match update unavailable.' },
      { status: 503 },
    );
  }
}
