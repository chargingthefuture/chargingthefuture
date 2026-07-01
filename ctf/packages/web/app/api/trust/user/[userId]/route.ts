import { NextResponse } from 'next/server';
import { requireTrustMemberAccess, resolveRequestId } from 'lib/trust/_lib';
import { TRUST_ERROR_CODE } from 'lib/trust/constants';
import { getTrustUserExtension } from 'lib/trust/repository';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { reportError } from 'lib/observability/report';

// GET /api/trust/user/[userId]
// Returns another member's trust panel, gated by authentication AND the target's visibility setting:
//   - public     → any authenticated, unlocked member may read.
//   - private    → only the owner (self) or an admin.
//   - restricted → only the owner (self) or an admin (this full-evidence endpoint is owner/admin
//                  only; coarser, profile-embedded surfaces decide their own restricted display).
// A blocked viewer gets 403 (the row exists but is not visible to them). A non-existent target
// with no extension row defaults to `public` (the default state), so it reads like any new member.
export async function GET(request: Request, context: unknown) {
  const { userId: targetUserId } = (context as { params: { userId: string } }).params;

  const gate = await requireTrustMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const viewerUserId = gate.auth.userId;
  const viewerIsAdmin = gate.auth.isAdmin;
  const requestId = resolveRequestId(request);

  // The audit contract requires a trust.summary.read event on every read of a member's trust panel,
  // including denied reads. A failed audit write must never change the response the viewer gets, so
  // log-and-continue on error.
  const audit = async (policyStatus: 'allow' | 'deny', reason: string) => {
    try {
      await logTrustAuditEvent({
        actorUserId: viewerUserId,
        targetUserId,
        command: 'trust.summary.read',
        policyStatus,
        reason,
        requestId,
        metadata: { viewerUserId, subjectUserId: targetUserId, surface: 'user_panel' },
      });
    } catch (error) {
      reportError(error, { area: 'trust', op: 'user_summary_read_audit' });
    }
  };

  try {
    const trust = await getTrustUserExtension(targetUserId);

    const isOwner = viewerUserId === targetUserId;
    const isPublic = trust.trustVisibility === 'public';

    if (!isPublic && !isOwner && !viewerIsAdmin) {
      await audit('deny', 'forbidden_visibility');
      return NextResponse.json(
        {
          ok: false,
          code: TRUST_ERROR_CODE.forbiddenVisibility,
          message: 'This member limits who can view their trust details.',
        },
        { status: 403 },
      );
    }

    await audit('allow', isOwner ? 'self_summary_read' : viewerIsAdmin ? 'admin_summary_read' : 'public_summary_read');
    return NextResponse.json(trust, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust', op: 'user_read' });
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.persistenceUnavailable, message: 'Trust data unavailable.' },
      { status: 503 },
    );
  }
}
