import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireContributorAccessAdmin } from '../_lib';
import { insertContributorAccessAudit, reinstateEligibility } from 'lib/contributor-access/repository';
import { syncGatedChannelMembershipIfOpen } from 'lib/contributor-access/gated-channel';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Clears a for-cause revocation. Eligibility returns because it was previously earned
// (first_earned_at is permanent) — this is not a fresh grant.

type ReinstateBody = {
  userId?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireContributorAccessAdmin('contributor-access.member.reinstate');
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ReinstateBody;
  try {
    body = (await request.json()) as ReinstateBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_payload', message: 'userId is required.' },
      { status: 400 },
    );
  }

  try {
    const reinstated = await reinstateEligibility(userId);
    if (!reinstated) {
      return NextResponse.json(
        { ok: false, code: 'contributor_access_not_found', message: 'No revoked eligibility to reinstate for this member.' },
        { status: 404 },
      );
    }

    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.member.reinstate',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'member',
      targetId: userId,
    });

    // A reinstated member rejoins the gated channel right away (when it is open). Guarded: a
    // Stream failure never fails the reinstate — membership reconciles on the next sync.
    const channelSyncWarning = await syncGatedChannelMembershipIfOpen('admin_reinstate_channel_sync');
    return NextResponse.json({ ok: true, ...(channelSyncWarning ? { channelSyncWarning } : {}) }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_member_reinstate' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: `Reinstate unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
