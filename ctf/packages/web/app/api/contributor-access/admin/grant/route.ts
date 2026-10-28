import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireContributorAccessAdmin } from '../_lib';
import { grantEligibilityByHand, insertContributorAccessAudit } from 'lib/contributor-access/repository';
import { syncGatedChannelMembershipIfOpen } from 'lib/contributor-access/gated-channel';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Gives a member the Weavers badge by hand (3.1.0 plan, Access: current members get it once).

type GrantBody = {
  who?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireContributorAccessAdmin('contributor-access.member.grant');
  if (!gate.allowed) {
    return gate.response;
  }

  let body: GrantBody;
  try {
    body = (await request.json()) as GrantBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const who = body.who?.trim();
  if (!who) {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_payload', message: 'who is required: a username or an account id.' },
      { status: 400 },
    );
  }

  try {
    const granted = await grantEligibilityByHand(who, gate.auth.userId);
    if (granted === 'not_found') {
      return NextResponse.json(
        { ok: false, code: 'contributor_access_not_found', message: `No member with the username or account id ${who}.` },
        { status: 404 },
      );
    }
    if (granted === 'revoked') {
      return NextResponse.json(
        { ok: false, code: 'contributor_access_revoked', message: 'This member was revoked for cause. Reinstate them instead.' },
        { status: 409 },
      );
    }

    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.member.grant',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'member',
      targetId: granted.userId,
    });

    const channelSyncWarning = await syncGatedChannelMembershipIfOpen('admin_grant_channel_sync');
    return NextResponse.json({ ok: true, userId: granted.userId, ...(channelSyncWarning ? { channelSyncWarning } : {}) }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_member_grant' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: `Grant unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
