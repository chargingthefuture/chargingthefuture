import { NextResponse } from 'next/server';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { getContributorAccessConfig, isMemberEligible } from 'lib/contributor-access/repository';

// Gated contributor channel — member route gate. Access requires ALL of:
//   1. an approved, signed-in member (the standard plugin gate);
//   2. the channel being open (contributor_access_config.channel_open — the launch gate);
//   3. the member's contributor_access_eligibility flag (the ONLY membership source), OR the
//      admin role (moderators keep read access, disclosed in-channel).
// A member who fails 2 or 3 receives a bare 404: the spec's no-shaming rule means non-eligible
// members see no locked teaser and no absence state — to them these routes do not exist.

export type GatedChannelGate =
  | {
    allowed: true;
    auth: AllowDecision;
    displayName: string;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

export async function requireGatedChannelAccess(): Promise<GatedChannelGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const [config, eligible] = await Promise.all([
    getContributorAccessConfig(),
    isMemberEligible(decision.userId),
  ]);

  if (!config.channelOpen || (!eligible && !decision.isAdmin)) {
    // Deliberately indistinguishable from a route that does not exist (no-shaming rule).
    return {
      allowed: false,
      response: NextResponse.json({ ok: false, message: 'Not found.' }, { status: 404 }),
    };
  }

  return {
    allowed: true,
    auth: decision,
    displayName: buildIdentityDisplayName(decision.username, decision.userId),
  };
}
