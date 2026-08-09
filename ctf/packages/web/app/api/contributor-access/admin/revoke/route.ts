import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireContributorAccessAdmin } from '../_lib';
import { insertContributorAccessAudit, revokeEligibility } from 'lib/contributor-access/repository';
import { syncGatedChannelMembershipIfOpen } from 'lib/contributor-access/gated-channel';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// For-cause revoke — the ONLY way eligibility is removed (a reviewed harm/abuse action). Never for
// inactivity, and never on an unreviewed report alone. A non-empty reason is required.

type RevokeBody = {
  userId?: string;
  reason?: string;
};

// Both a target userId and a non-empty reason are required (revoke is never reasonless). Returns a
// 400 response when either is missing/blank.
function parseRevokeBody(body: RevokeBody): { error: NextResponse } | { userId: string; reason: string } {
  const userId = body.userId?.trim();
  const reason = body.reason?.trim();
  if (!userId || !reason) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'contributor_access_invalid_payload', message: 'userId and a non-empty reason are required.' },
        { status: 400 },
      ),
    };
  }
  return { userId, reason };
}

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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const parsed = parseRevokeBody(body);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { userId, reason } = parsed;

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

    // A revoked member leaves the gated channel right away (when it is open). Guarded: a Stream
    // failure never fails the revoke — the flag is already off, and membership reconciles on the
    // next sync.
    const channelSyncWarning = await syncGatedChannelMembershipIfOpen('admin_revoke_channel_sync');
    return NextResponse.json({ ok: true, ...(channelSyncWarning ? { channelSyncWarning } : {}) }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_member_revoke' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: `Revoke unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
