import { NextResponse } from 'next/server';
import { requireContributorAccessAdmin } from '../_lib';
import {
  countEligibleMembers,
  insertContributorAccessAudit,
  listEligibleMembers,
} from 'lib/contributor-access/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin list of members who have earned eligibility (categorical fields only: user id, username,
// first_earned_at, revoke flag/reason). No score and no reason_snapshot is ever returned — the
// standing is eligible or not-yet, never a number (proposal hard guardrail).

export async function GET() {
  const gate = await requireContributorAccessAdmin('contributor-access.eligible.list');
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [members, eligibleCount] = await Promise.all([listEligibleMembers(), countEligibleMembers()]);
    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.eligible.list',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'eligibility',
      targetId: 'list',
    });
    return NextResponse.json({ ok: true, members, eligibleCount }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_eligible_list' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: `Eligible list unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
