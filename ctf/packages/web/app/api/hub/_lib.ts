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
    allowUnlockSupportOnly: true,
    requireUsername: false,
    requireApprovedUserOrAdmin: true,
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
