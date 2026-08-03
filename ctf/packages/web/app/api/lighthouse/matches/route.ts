import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import {
  createMatchRequest,
  insertLighthouseAudit,
  listMatches,
  validateMatchCreateInput,
} from 'lib/lighthouse/repository';
import type { LighthouseMatchCreateInput } from 'lib/lighthouse/types';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

type MatchBody = Partial<LighthouseMatchCreateInput> & { idempotencyKey?: string };

type CreatedMatchResult = Awaited<ReturnType<typeof createMatchRequest>>;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

// Maps a repository error code (thrown as an Error message) to the exact status/body it produced
// before. Keeping this as a lookup table preserves each response 1:1 while avoiding a long if-chain.
const LIGHTHOUSE_ERROR_RESPONSES: Record<string, { code: string; message: string; status: number }> = {
  profile_not_found: { code: LIGHTHOUSE_ERROR_CODE.profileNotFound, message: 'Lighthouse profile not found.', status: 404 },
  property_not_found: { code: LIGHTHOUSE_ERROR_CODE.propertyNotFound, message: 'Lighthouse property not found.', status: 404 },
  match_not_found: { code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.', status: 404 },
  not_owner: { code: LIGHTHOUSE_ERROR_CODE.notOwner, message: 'Operation requires ownership.', status: 403 },
  policy_denied: { code: LIGHTHOUSE_ERROR_CODE.policyDenied, message: 'Operation denied by policy.', status: 403 },
  blocked_pair: { code: LIGHTHOUSE_ERROR_CODE.blockedPair, message: 'This listing is not available to you.', status: 403 },
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

function parseMatchCreateInput(body: MatchBody): LighthouseMatchCreateInput {
  return {
    propertyId: asStringOr(body.propertyId, ''),
    message: asString(body.message),
    desiredMoveInDateIso: asString(body.desiredMoveInDateIso),
  };
}

function resolveIdempotencyKey(body: MatchBody, userId: string, propertyId: string): string {
  const provided = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  return provided.length > 0 ? provided : `${userId}:${propertyId}`;
}

// Notify the host that a seeker requested a stay on their listing — best-effort, deduped on the
// match id. The repository rejects a request on one's own listing, so the host is never the actor.
async function notifyHostOfMatch(created: CreatedMatchResult, actorUserId: string): Promise<void> {
  if (created.match.hostUserId && created.match.hostUserId !== actorUserId) {
    await notifySafe({
      userId: created.match.hostUserId,
      sourcePlugin: 'lighthouse',
      notificationType: 'lighthouse.match.requested',
      category: 'safety',
      summary: 'Someone requested a stay on your LightHouse listing.',
      linkPath: '/apps/lighthouse',
      targetRef: created.match.id,
    });
  }
}

// The seeker-role check, blocked-pair check, and duplicate check all live in the repository and
// raise these codes. The audit contract marks lighthouse.match.request.create as allow_or_deny,
// so a policy denial must emit a deny audit event, not only the success path.
async function auditMatchCreateDeny(actorId: string, error: unknown, propertyId: string): Promise<void> {
  const code = error instanceof Error ? error.message : '';
  if (code === 'policy_denied' || code === 'blocked_pair' || code === 'duplicate_match' || code === 'not_owner') {
    await insertLighthouseAudit({
      actorId,
      command: 'lighthouse.match.request.create',
      policyStatus: 'deny',
      reason: code,
      targetType: 'match',
      targetId: propertyId,
      metadata: { propertyId },
    });
  }
}

export async function GET() {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listMatches(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'matches' });
    return lighthouseErrorResponse(error, 'Match listing unavailable.');
  }
}

export async function POST(request: Request) {
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

  const input = parseMatchCreateInput(body);

  if (!validateMatchCreateInput(input)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid match request payload.' },
      { status: 400 },
    );
  }

  try {
    const created = await createMatchRequest({
      actorUserId: gate.auth.userId,
      actorDisplayName: gate.auth.username ?? gate.auth.userId,
      propertyId: input.propertyId,
      message: input.message,
      desiredMoveInDateIso: input.desiredMoveInDateIso,
      idempotencyKey: resolveIdempotencyKey(body, gate.auth.userId, input.propertyId),
    });

    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.match.request.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'match',
      targetId: created.match.id,
      metadata: { propertyId: created.match.propertyId },
    });

    await notifyHostOfMatch(created, gate.auth.userId);

    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'matches' });
    await auditMatchCreateDeny(gate.auth.userId, error, input.propertyId);
    return lighthouseErrorResponse(error, 'Match create unavailable.');
  }
}
