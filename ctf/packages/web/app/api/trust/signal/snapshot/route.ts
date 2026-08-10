import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustMemberAccess, resolveRequestId, trustErrorResponse } from 'lib/trust/_lib';
import { refreshTrustSignalSnapshot } from 'lib/trust/repository';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { reportError } from 'lib/observability/report';

// POST /api/trust/signal/snapshot
// Recompute the CALLER's trust signal from real cross-plugin engagement (login frequency and
// completed SocketRelay trades), persist a snapshot row, and refresh their derived evidence.
// Never changes trust_status (status is admin-controlled).
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveRequestId(request);
  const userId = gate.auth.userId;

  try {
    const result = await refreshTrustSignalSnapshot(userId);
    await logTrustAuditEvent({
      actorUserId: userId,
      targetUserId: userId,
      command: 'trust.signal.snapshot.refresh',
      policyStatus: 'allow',
      reason: 'self_snapshot_refresh',
      requestId,
      metadata: {
        snapshotId: result.snapshotId,
        evidenceCount: result.evidence.length,
        metrics: result.metrics,
      },
    });
    return NextResponse.json(
      {
        ok: true,
        snapshotId: result.snapshotId,
        generatedAt: result.generatedAt,
        metrics: result.metrics,
        trustEvidence: result.evidence,
        trustStatus: result.extension.trustStatus,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'trust', op: 'signal_snapshot' });
    return trustErrorResponse('Trust signal refresh unavailable.');
  }
}
