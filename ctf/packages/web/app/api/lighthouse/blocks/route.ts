import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { createBlock, insertLighthouseAudit, listBlocks } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

type CreateBlockBody = {
  blockedUserId?: string;
  reason?: string;
};

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

// A policy denial raised by the repository (self_block, policy_denied) must also be audited.
async function auditBlockCreateDeny(actorId: string, error: unknown, blockedUserId: string): Promise<void> {
  const code = error instanceof Error ? error.message : '';
  if (code === 'self_block' || code === 'policy_denied') {
    await insertLighthouseAudit({
      actorId,
      command: 'lighthouse.block.create',
      policyStatus: 'deny',
      reason: code,
      targetType: 'block',
      targetId: blockedUserId,
      metadata: { blockedUserId },
    });
  }
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
    reportError(error, { area: 'lighthouse', op: 'blocks' });
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

  // Self-block check runs before the DB round-trip and emits the contract-required deny audit
  // event (the audit contract marks lighthouse.block.create as allow_or_deny with a selfBlockCheck).
  if (blockedUserId === gate.auth.userId) {
    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.block.create',
      policyStatus: 'deny',
      reason: 'self_block',
      targetType: 'block',
      targetId: blockedUserId,
      metadata: { blockedUserId },
    });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.selfBlock, message: 'Cannot block your own user account.' },
      { status: 403 },
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
    reportError(error, { area: 'lighthouse', op: 'blocks' });
    await auditBlockCreateDeny(gate.auth.userId, error, blockedUserId);
    return lighthouseErrorResponse(error, 'Block create unavailable.');
  }
}
