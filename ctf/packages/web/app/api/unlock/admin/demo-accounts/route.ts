import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { setDemoAccount } from 'lib/demo-mode/demo-accounts';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { failureResponse } from 'lib/errors/failure';

type DemoBody = { userId?: string; demo?: boolean };

function parseDemoBody(raw: DemoBody): { ok: true; userId: string; demo: boolean } | { ok: false; message: string } {
  const userId = raw.userId?.trim();
  if (!userId) {
    return { ok: false, message: 'userId is required.' };
  }
  if (typeof raw.demo !== 'boolean') {
    return { ok: false, message: 'demo must be true (show this account demo data) or false (show it real data).' };
  }
  return { ok: true, userId, demo: raw.demo };
}

// Admin action: switch an account to demo data, or back (public.demo_mode_accounts). While on, every
// request from that account reads and writes the demo schema. It does not touch the member's access,
// their submission, or any reward. Admin-gated, CSRF-guarded, and audited.
export async function POST(request: Request) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  let raw: DemoBody;
  try {
    raw = (await request.json()) as DemoBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  const parsed = parseDemoBody(raw);
  if (!parsed.ok) {
    return unlockErrorResponse(parsed.message, 400);
  }
  const { userId, demo } = parsed;

  try {
    await setDemoAccount({ userId, on: demo, actorUserId: gate.auth.userId });

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.signups.demo',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: userId,
      requestId,
      metadata: { demo },
    });

    return NextResponse.json({ ok: true, userId, demo });
  } catch (error) {
    return failureResponse({
      summary: 'The demo data switch could not be changed',
      error,
      code: 'unlock_demo_accounts_update_failed',
      area: 'unlock',
      op: 'admin_demo_accounts_update',
      extra: { demo },
    });
  }
}
