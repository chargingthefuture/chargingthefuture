import { NextResponse } from 'next/server';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';

export type HubApiIdentity = {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type HubApiGate =
  | {
    allowed: true;
    auth: AllowDecision;
    identity: HubApiIdentity;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

export async function requireHubAccess(): Promise<HubApiGate> {
  const authDecision = await evaluatePluginAccess({
    requireUsername: false,
    // The Hub general channel is the support surface for not-yet-verified members, so
    // support-only users may read and post here in addition to fully-approved users.
    minUnlockTier: 'support_only',
  });

  if (!authDecision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(authDecision, { status: authDecision.status }),
    };
  }

  const identity: HubApiIdentity = {
    userId: authDecision.userId,
    username: authDecision.username,
    displayName: buildIdentityDisplayName(authDecision.username, authDecision.userId),
    avatarUrl: null,
  };

  return {
    allowed: true,
    auth: authDecision,
    identity,
  };
}
