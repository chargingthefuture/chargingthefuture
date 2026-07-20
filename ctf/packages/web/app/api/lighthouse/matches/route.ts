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

  const input: LighthouseMatchCreateInput = {
    propertyId: typeof body.propertyId === 'string' ? body.propertyId : '',
    message: typeof body.message === 'string' ? body.message : null,
    desiredMoveInDateIso: typeof body.desiredMoveInDateIso === 'string' ? body.desiredMoveInDateIso : null,
  };

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
      idempotencyKey: typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
        ? body.idempotencyKey.trim()
        : `${gate.auth.userId}:${input.propertyId}`,
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

    // Notify the host that a seeker requested a stay on their listing — best-effort, deduped on the
    // match id. The repository rejects a request on one's own listing, so the host is never the actor.
    if (created.match.hostUserId && created.match.hostUserId !== gate.auth.userId) {
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

    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'matches' });
    // The seeker-role check, blocked-pair check, and duplicate check all live in the repository and
    // raise these codes. The audit contract marks lighthouse.match.request.create as allow_or_deny,
    // so a policy denial must emit a deny audit event, not only the success path.
    const code = error instanceof Error ? error.message : '';
    if (code === 'policy_denied' || code === 'blocked_pair' || code === 'duplicate_match' || code === 'not_owner') {
      await insertLighthouseAudit({
        actorId: gate.auth.userId,
        command: 'lighthouse.match.request.create',
        policyStatus: 'deny',
        reason: code,
        targetType: 'match',
        targetId: input.propertyId,
        metadata: { propertyId: input.propertyId },
      });
    }
    return lighthouseErrorResponse(error, 'Match create unavailable.');
  }
}
