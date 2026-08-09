import { NextResponse } from 'next/server';
import { requireTrustMemberAccess, resolveRequestId } from 'lib/trust/_lib';
import { TRUST_ERROR_CODE } from 'lib/trust/constants';
import { getTrustUserExtension } from 'lib/trust/repository';
import { summarizeTrustEvidenceForPeer } from 'lib/trust/peer-summary';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { reportError } from 'lib/observability/report';
import type { TrustPeerView, TrustUserExtension } from 'lib/trust/types';

// GET /api/trust/user/[userId]
// Returns another member's trust panel, gated by authentication AND the target's visibility setting:
//   - public     → any authenticated, unlocked member reads the full panel.
//   - restricted → the owner and admins read the full panel; any other member reads the SUMMARY
//                  projection (headline counts, no timestamps, per-plugin items collapsed to one
//                  breadth line). This is the middle tier the setting is named for: a member
//                  checking whether someone is an engaged participant gets that answer without
//                  seeing the record behind it.
//   - private    → only the owner (self) or an admin; everyone else is refused.
// A refused viewer gets 403 (the row exists but is not visible to them). A non-existent target with
// no extension row defaults to `public` (the default state), so it reads like any new member.
//
// `trustDisclosure` on the response tells the client which of the two it received, so the widget can
// label a summary as a summary instead of presenting it as the member's whole record.
function fullView(trust: TrustUserExtension): TrustPeerView {
  return { ...trust, trustDisclosure: 'full' };
}

// Build the reduced projection from the stored evidence. Nothing else on the extension is widened:
// the same fields a `public` profile already exposes are returned, with only the evidence narrowed.
function summaryView(trust: TrustUserExtension): TrustPeerView {
  return {
    ...trust,
    trustEvidence: summarizeTrustEvidenceForPeer(trust.trustEvidence),
    trustDisclosure: 'summary',
  };
}

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
    const isPrivileged = isOwner || viewerIsAdmin;

    // The owner and admins always read the full panel, whatever the setting says.
    if (isPrivileged) {
      await audit('allow', isOwner ? 'self_summary_read' : 'admin_summary_read');
      return NextResponse.json(fullView(trust), { status: 200 });
    }

    if (trust.trustVisibility === 'public') {
      await audit('allow', 'public_summary_read');
      return NextResponse.json(fullView(trust), { status: 200 });
    }

    if (trust.trustVisibility === 'restricted') {
      await audit('allow', 'restricted_summary_read');
      return NextResponse.json(summaryView(trust), { status: 200 });
    }

    await audit('deny', 'forbidden_visibility');
    return NextResponse.json(
      {
        ok: false,
        code: TRUST_ERROR_CODE.forbiddenVisibility,
        message: 'This member limits who can view their trust details.',
      },
      { status: 403 },
    );
  } catch (error) {
    reportError(error, { area: 'trust', op: 'user_read' });
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.persistenceUnavailable, message: 'Trust data unavailable.' },
      { status: 503 },
    );
  }
}
