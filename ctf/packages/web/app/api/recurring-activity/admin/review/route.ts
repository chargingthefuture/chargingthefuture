import { NextResponse } from 'next/server';
import {
  recurringActivityErrorResponse,
  requireRecurringActivityAccess,
  resolveRequestId,
  resolveTraceId,
} from 'lib/recurring-activity/_lib';
import { logRecurringActivityAuditEvent } from 'lib/recurring-activity/audit';
import { reviewRecurringActivityForCollusion } from 'lib/recurring-activity/review';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { reportError } from 'lib/observability/report';

// GET /api/recurring-activity/admin/review — admin-only collusion review (inventory Gaps #4).
//
// A recurring activity only counts once the other member confirms it, which stops one member
// inflating their own standing but not a small group confirming each other's. This read surfaces the
// three patterns that shape looks like: two members who each declared an arrangement with the other,
// arrangements confirmed within seconds of being declared, and small groups whose arrangements point
// back at each other.
//
// Read-only. Nothing here changes a row, scores a member, or feeds any member-facing surface — it
// gives a person something to look at. A flag is a question, not a finding: real members in one town
// genuinely do have arrangements with each other. Every read writes an audit row, because looking at
// who is connected to whom is itself a use of admin power.
export async function GET(request: Request) {
  const gate = await requireRecurringActivityAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const requestId = resolveRequestId(request);
  const traceId = resolveTraceId(request);

  if (!gate.auth.isAdmin) {
    await logRecurringActivityAuditEvent({
      actorUserId: gate.auth.userId,
      command: 'recurring-activity.admin.review.read',
      policyStatus: 'deny',
      reason: 'not_admin',
      requestId,
      traceId,
    }).catch((error) => reportError(error, { area: 'recurring-activity', op: 'review_audit' }));
    return NextResponse.json({ ok: false, code: 'forbidden', message: 'Not authorized.' }, { status: 403 });
  }

  try {
    const review = await reviewRecurringActivityForCollusion();

    // Resolve the ids on the flagged rows only — never the whole roster — so the reviewer sees who is
    // involved without this becoming a member directory.
    const involved = new Set<string>();
    review.reciprocalPairs.forEach((pair) => { involved.add(pair.userA); involved.add(pair.userB); });
    review.fastConfirmations.forEach((row) => { involved.add(row.ownerUserId); involved.add(row.counterpartyUserId); });
    review.tightClusters.forEach((cluster) => cluster.memberUserIds.forEach((id) => involved.add(id)));
    const names = await resolveUsernames([...involved]).catch(() => new Map<string, string | null>());

    await logRecurringActivityAuditEvent({
      actorUserId: gate.auth.userId,
      command: 'recurring-activity.admin.review.read',
      policyStatus: 'allow',
      reason: 'collusion_review',
      requestId,
      traceId,
      metadata: {
        activeArrangementCount: review.activeArrangementCount,
        reciprocalPairs: review.reciprocalPairs.length,
        fastConfirmations: review.fastConfirmations.length,
        tightClusters: review.tightClusters.length,
      },
    });

    return NextResponse.json(
      { ok: true, review, names: Object.fromEntries([...names].map(([id, name]) => [id, name])) },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'recurring-activity', op: 'admin_review' });
    return recurringActivityErrorResponse('Review unavailable.');
  }
}
