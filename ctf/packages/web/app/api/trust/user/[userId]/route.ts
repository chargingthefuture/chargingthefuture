import { NextResponse } from 'next/server';
import { requireTrustMemberAccess, resolveRequestId } from 'lib/trust/_lib';
import { TRUST_ERROR_CODE } from 'lib/trust/constants';
import { getTrustUserExtension } from 'lib/trust/repository';
import { summarizeTrustEvidenceForPeer } from 'lib/trust/peer-summary';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { reportError } from 'lib/observability/report';
import type { TrustPeerView, TrustUserExtension } from 'lib/trust/types';

// GET /api/trust/user/[userId]
// Returns another member's trust panel. What a viewer gets is decided here, in code — a member
// cannot set it, and there is no per-member visibility choice anywhere in the product (owner spec):
//   - the owner reading their own row, and any admin, read the full panel;
//   - every other member reads the SUMMARY projection: headline counts, no timestamps, per-plugin
//     items collapsed to one breadth line.
//
// Why one fixed rule rather than a setting. Trust exists so a member can tell whether the person
// they are dealing with is a real, participating member. A setting that let someone hide that
// removes the one signal the reader needs, and a setting that let someone reveal everything hands
// out a timeline of their activity. The summary answers the question without doing either, so it is
// what every member gets about every other member.
//
// The stored `trust_visibility` column is no longer read by this route. It is left in place rather
// than dropped in the same change; nothing writes to it now that POST /api/trust/visibility is gone.
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

    // The owner and admins always read the full panel.
    if (isPrivileged) {
      await audit('allow', isOwner ? 'self_summary_read' : 'admin_summary_read');
      return NextResponse.json(fullView(trust), { status: 200 });
    }

    // Everyone else reads the summary. There is no refused read: hiding a member's participation
    // from other members would defeat the point of the panel.
    await audit('allow', 'member_summary_read');
    return NextResponse.json(summaryView(trust), { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust', op: 'user_read' });
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.persistenceUnavailable, message: 'Trust data unavailable.' },
      { status: 503 },
    );
  }
}
