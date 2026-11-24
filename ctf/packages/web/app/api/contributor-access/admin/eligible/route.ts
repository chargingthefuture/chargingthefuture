import { NextResponse } from 'next/server';
import { requireContributorAccessAdmin } from '../_lib';
import {
  countEligibleMembers,
  insertContributorAccessAudit,
  listEligibleMembers,
  listScoredMembers,
} from 'lib/contributor-access/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin list of members who have earned eligibility (user id, username, first_earned_at, revoke
// flag/reason), plus scoredMembers: every member whose last weekly recompute stored a score above
// zero, with that score and the gate readings. Admin only; no member surface returns a score.

export async function GET() {
  const gate = await requireContributorAccessAdmin('contributor-access.eligible.list');
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [members, eligibleCount, scoredMembers] = await Promise.all([
      listEligibleMembers(),
      countEligibleMembers(),
      listScoredMembers(),
    ]);
    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.eligible.list',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'eligibility',
      targetId: 'list',
    });
    return NextResponse.json({ ok: true, members, eligibleCount, scoredMembers }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_eligible_list' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: `Eligible list unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
