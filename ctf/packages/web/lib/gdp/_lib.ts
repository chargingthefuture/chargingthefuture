import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';

export async function requireGdpReadAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}
