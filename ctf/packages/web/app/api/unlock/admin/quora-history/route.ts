import { NextResponse } from 'next/server';
import { requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { listQuoraUrlHistory } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';

// Admin-only read of a member's full Quora URL change history so a reviewer can see whether someone
// changed or tried to remove their social-proof URL (Directory is the only post-approval place it can
// be edited). This is a watch/audit trail for a human — a change is not itself proof of anything
// (Quora sometimes deletes accounts) — and the existing revoke action is the manual response.
export async function GET(request: Request) {
  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);
  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId || userId.trim().length === 0) {
    return unlockErrorResponse('A userId is required.', 400);
  }

  try {
    const history = await listQuoraUrlHistory(userId.trim());

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.quora.history.read',
      policyStatus: 'allow',
      reason: 'ok',
      requestId,
      metadata: { targetUserId: userId.trim(), count: history.length },
    });

    return NextResponse.json({ ok: true, history });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_quora_history' });
    return unlockErrorResponse('Quora URL history unavailable.', 503);
  }
}
