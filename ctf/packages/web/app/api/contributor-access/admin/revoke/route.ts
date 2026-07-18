import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireContributorAccessAdmin } from '../_lib';
import { insertContributorAccessAudit, revokeEligibility } from 'lib/contributor-access/repository';
import { reportError } from 'lib/observability/report';

// For-cause revoke — the ONLY way eligibility is removed (a reviewed harm/abuse action). Never for
// inactivity, and never on an unreviewed report alone. A non-empty reason is required.

type RevokeBody = {
  userId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireContributorAccessAdmin('contributor-access.member.revoke');
  if (!gate.allowed) {
    return gate.response;
  }

  let body: RevokeBody;
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_json', message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const userId = body.userId?.trim();
  const reason = body.reason?.trim();
  if (!userId || !reason) {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_payload', message: 'userId and a non-empty reason are required.' },
      { status: 400 },
    );
  }

  try {
    const revoked = await revokeEligibility({ userId, reason, revokedBy: gate.auth.userId });
    if (!revoked) {
      return NextResponse.json(
        { ok: false, code: 'contributor_access_not_found', message: 'No earned eligibility to revoke for this member.' },
        { status: 404 },
      );
    }

    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.member.revoke',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'member',
      targetId: userId,
      metadata: { revokedReason: reason },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_member_revoke' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: 'Revoke unavailable.' },
      { status: 503 },
    );
  }
}
