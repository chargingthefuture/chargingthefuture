import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';

export type ChymeApiIdentity = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
};

export type ChymeApiGate =
  | {
    allowed: true;
    auth: AllowDecision;
    identity: ChymeApiIdentity;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

export async function requireChymeAccess(): Promise<ChymeApiGate> {
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

  const identity: ChymeApiIdentity = {
    userId: authDecision.userId,
    username: authDecision.username,
    avatarUrl: null,
  };

  return {
    allowed: true,
    auth: authDecision,
    identity,
  };
}
