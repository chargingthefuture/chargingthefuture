import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { NOTIFICATION_ERROR_CODE } from 'lib/notifications/types';

export type NotificationsGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Notifications are member-scoped: a member's own feed and preferences, which 3.1 shows as Activity.
// Any signed-in member can read their own (SOCIAL_REDESIGN_3_1_PLAN, Access).
export async function requireNotificationsAccess(): Promise<NotificationsGate> {
  const authDecision = await evaluatePluginAccess({
    requireUsername: false,
    minUnlockTier: 'signed_in',
  });

  if (!authDecision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(authDecision, { status: authDecision.status }),
    };
  }

  return { allowed: true, auth: authDecision };
}

// Mutation CSRF check mirroring the feed one: a state-changing request must carry `x-ctf-csrf: '1'`.
export function ensureNotificationsCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  return null;
}
