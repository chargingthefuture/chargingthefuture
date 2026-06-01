import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { createBlock, insertLighthouseAudit, listBlocks } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

type CreateBlockBody = {
  blockedUserId?: string;
  reason?: string;
};

// Error messages the repository throws to signal an expected client error (4xx/409),
// handled by lighthouseErrorResponse. Anything else falls through to a 503 and is an
// unexpected server failure worth reporting to Sentry.
const LIGHTHOUSE_EXPECTED_ERROR_MESSAGES = new Set([
  'profile_not_found',
  'property_not_found',
  'match_not_found',
  'block_not_found',
  'not_owner',
  'policy_denied',
  'blocked_pair',
  'self_block',
  'duplicate_match',
  'invalid payload',
]);

function isUnexpectedLighthouseError(error: unknown): boolean {
  return !(error instanceof Error && LIGHTHOUSE_EXPECTED_ERROR_MESSAGES.has(error.message));
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

export async function GET() {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listBlocks(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    if (isUnexpectedLighthouseError(error)) {
      reportError(error, { area: 'lighthouse', op: 'block_list', extra: { userId: gate.auth.userId } });
    }
    return lighthouseErrorResponse(error, 'Block listing unavailable.');
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

  let body: CreateBlockBody;
  try {
    body = (await request.json()) as CreateBlockBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const blockedUserId = typeof body.blockedUserId === 'string' ? body.blockedUserId.trim() : '';
  if (!blockedUserId) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'blockedUserId is required.' },
      { status: 400 },
    );
  }

  try {
    const block = await createBlock(gate.auth.userId, blockedUserId, body.reason);
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.block.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'block',
      targetId: block.id,
      metadata: { blockedUserId: block.blockedUserId },
    });

    return NextResponse.json({ ok: true, block }, { status: 201 });
  } catch (error) {
    if (isUnexpectedLighthouseError(error)) {
      reportError(error, { area: 'lighthouse', op: 'block_create', extra: { userId: gate.auth.userId, blockedUserId } });
    }
    return lighthouseErrorResponse(error, 'Block create unavailable.');
  }
}
