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

// Maps a repository error code (thrown as an Error message) to the exact status/body it produced
// before. Keeping this as a lookup table preserves each response 1:1 while avoiding a long if-chain.
const LIGHTHOUSE_ERROR_RESPONSES: Record<string, { code: string; message: string; status: number }> = {
  profile_not_found: { code: LIGHTHOUSE_ERROR_CODE.profileNotFound, message: 'Lighthouse profile not found.', status: 404 },
  property_not_found: { code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: 'Lighthouse property not found.', status: 404 },
  match_not_found: { code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.', status: 404 },
  block_not_found: { code: LIGHTHOUSE_ERROR_CODE.blockNotFound, message: 'Lighthouse block not found.', status: 404 },
  not_owner: { code: LIGHTHOUSE_ERROR_CODE.notOwner, message: 'Operation requires ownership.', status: 403 },
  policy_denied: { code: LIGHTHOUSE_ERROR_CODE.policyDenied, message: 'Operation denied by policy.', status: 403 },
  blocked_pair: { code: LIGHTHOUSE_ERROR_CODE.blockedPair, message: 'Match blocked by pair policy.', status: 403 },
  self_block: { code: LIGHTHOUSE_ERROR_CODE.selfBlock, message: 'Cannot block your own user account.', status: 403 },
  duplicate_match: { code: LIGHTHOUSE_ERROR_CODE.duplicateMatch, message: 'Active match request already exists.', status: 409 },
  'invalid payload': { code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid payload.', status: 400 },
};

function lighthouseErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';
  const mapped = LIGHTHOUSE_ERROR_RESPONSES[code];
  if (mapped) {
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json(
    { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}

function parseMatchUpdateInput(body: MatchBody): LighthouseMatchUpdateInput {
  return {
    status:
      body.status === 'accepted' || body.status === 'rejected' || body.status === 'canceled' || body.status === 'completed'
        ? body.status
        : 'pending',
    hostResponse: typeof body.hostResponse === 'string' ? body.hostResponse : null,
  };
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

  const input = parseMatchUpdateInput(body);

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
      isAdmin: gate.auth.isAdmin,
    });

    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.match.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'match',
      targetId: match.id,
      metadata: { status: match.status },
    });

    return NextResponse.json({ ok: true, match }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'matches_matchid' });
    return lighthouseErrorResponse(error, 'Match update unavailable.');
  }
}
