import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { blockUser, listBlocksForUser, SelfBlockError } from 'lib/blocks/repository';
import { reportError } from 'lib/observability/report';

// Member blocking — the cross-cutting "block / unblock / see who you've blocked" API (issue #809,
// task 2). Blocking is a baseline safety control available to ANY signed-in member, so these routes
// use the same `any_authenticated` gate as account deletion (requireAccountAccess) — never the
// unlock gate. A block is the member's own private boundary; it is never visible to the person
// blocked and carries no reason.
//
// GET  /api/account/blocks            — list the signed-in member's blocks (newest first).
// POST /api/account/blocks            — create a block; body { blockedUserId }.

// List the signed-in member's blocks for the manage-list UI.
export async function GET() {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const blocks = await listBlocksForUser(gate.auth.userId);
    return NextResponse.json({ ok: true, blocks }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account', op: 'blocks_list' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load your blocked members.' },
      { status: 503 },
    );
  }
}

type BlockBody = { blockedUserId?: unknown };

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

// Create a block. CSRF-protected and idempotent (blocking the same person twice is a no-op). A
// self-block and a missing/blank target both map to a clear 400.
export async function POST(request: Request) {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: BlockBody;
  try {
    body = (await request.json()) as BlockBody;
  } catch {
    return badRequest('Invalid JSON body.');
  }

  if (typeof body.blockedUserId !== 'string' || body.blockedUserId.trim().length === 0) {
    return badRequest('blockedUserId is required.');
  }
  const blockedUserId = body.blockedUserId.trim();

  try {
    await blockUser(gate.auth.userId, blockedUserId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof SelfBlockError) {
      return badRequest('You cannot block yourself.');
    }
    reportError(error, { area: 'account', op: 'blocks_create' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to block this member.' },
      { status: 503 },
    );
  }
}
