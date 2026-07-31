import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { blockUser, blockUserTx, listBlocksForUser, SelfBlockError } from 'lib/blocks/repository';
import { insertSafetyReportTx } from 'lib/safety/repository';
import { SAFETY_REPORT_DETAIL_MAX_LENGTH } from 'lib/safety/constants';
import { withDbTransaction } from 'lib/db/postgres';
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

type BlockBody = { blockedUserId?: unknown; safetyConcern?: unknown; safetyDetail?: unknown };

type ParsedBlockRequest = { blockedUserId: string; safetyConcern: boolean; safetyDetail: string | null };

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

// Parse and validate the block request body, resolving the optional safety escalation. Returns a
// discriminated result so the caller keeps TypeScript narrowing.
async function parseBlockRequest(request: Request): Promise<{ error: NextResponse } | { data: ParsedBlockRequest }> {
  let body: BlockBody;
  try {
    body = (await request.json()) as BlockBody;
  } catch {
    return { error: badRequest('Invalid JSON body.') };
  }

  if (typeof body.blockedUserId !== 'string' || body.blockedUserId.trim().length === 0) {
    return { error: badRequest('blockedUserId is required.') };
  }
  const blockedUserId = body.blockedUserId.trim();

  // A safety escalation is opt-in. Anything other than a literal `true` is treated as an ordinary
  // block, so a missing/odd value never accidentally raises an admin alert.
  const safetyConcern = body.safetyConcern === true;

  // The free-text context is optional even when escalating. Reject only a value that is present but
  // not a string (a clear client bug); trim and cap an actual string, and store null when blank.
  let safetyDetail: string | null = null;
  if (safetyConcern && body.safetyDetail !== undefined && body.safetyDetail !== null) {
    if (typeof body.safetyDetail !== 'string') {
      return { error: badRequest('safetyDetail must be a string.') };
    }
    const trimmed = body.safetyDetail.trim();
    if (trimmed.length > SAFETY_REPORT_DETAIL_MAX_LENGTH) {
      return { error: badRequest(`safetyDetail must be ${SAFETY_REPORT_DETAIL_MAX_LENGTH} characters or fewer.`) };
    }
    safetyDetail = trimmed.length > 0 ? trimmed : null;
  }

  return { data: { blockedUserId, safetyConcern, safetyDetail } };
}

// Create a block. CSRF-protected and idempotent (blocking the same person twice is a no-op). A
// self-block and a missing/blank target both map to a clear 400.
//
// The body MAY carry an optional safety escalation (issue #809, task 3): `safetyConcern: true` with
// an optional short `safetyDetail`. An ordinary block (no flag) behaves exactly as before and writes
// nothing to the reports table — it stays the member's own private boundary that the admin never
// sees. When the flag is set, the block AND a member_safety_reports row are written in ONE
// transaction, so they succeed or fail together: a report can never exist without its block, and a
// failure to record the report rolls the block back so the member can retry rather than silently
// losing their safety report. This is the only path by which a member block reaches the admin.
export async function POST(request: Request) {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const parsed = await parseBlockRequest(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { blockedUserId, safetyConcern, safetyDetail } = parsed.data;

  try {
    if (safetyConcern) {
      // Block + safety report, atomic.
      await withDbTransaction(async (client) => {
        await blockUserTx(client, gate.auth.userId, blockedUserId);
        await insertSafetyReportTx(client, gate.auth.userId, blockedUserId, safetyDetail);
      });
      return NextResponse.json({ ok: true, safetyReported: true }, { status: 200 });
    }

    await blockUser(gate.auth.userId, blockedUserId);
    return NextResponse.json({ ok: true, safetyReported: false }, { status: 200 });
  } catch (error) {
    if (error instanceof SelfBlockError) {
      return badRequest('You cannot block yourself.');
    }
    reportError(error, { area: 'account', op: safetyConcern ? 'blocks_create_with_safety_report' : 'blocks_create' });
    const message = safetyConcern
      ? 'We could not record your safety report, so this person was not blocked. Please try again.'
      : 'Unable to block this member.';
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message },
      { status: 503 },
    );
  }
}
