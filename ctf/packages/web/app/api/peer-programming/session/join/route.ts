import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { getMyCohort, insertPeerProgrammingAudit } from 'lib/peer-programming/repository';
import { createPeerProgrammingVideoCredentials } from 'lib/peer-programming/stream';
import { PEER_PROGRAMMING_ERROR_CODE } from 'lib/peer-programming/constants';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

// Mint credentials for the caller to join their cohort's live video session. The
// cohort is resolved server-side from the signed-in member, so a non-member cannot
// obtain a call token and the call is always scoped to the caller's own cohort.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const cohort = await getMyCohort(gate.auth.userId);
    if (!cohort) {
      await insertPeerProgrammingAudit({
        actorId: gate.auth.userId,
        command: 'peer-programming.session.join',
        policyStatus: 'deny',
        reason: 'no_cohort',
        targetType: 'session',
        targetId: gate.auth.userId,
      });
      return NextResponse.json(
        { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.notFound, message: 'Join a cohort to access live sessions.' },
        { status: 404 },
      );
    }

    const displayName = buildIdentityDisplayName(gate.auth.username, gate.auth.userId);
    const credentials = await createPeerProgrammingVideoCredentials({
      userId: gate.auth.userId,
      name: displayName,
      cohortId: cohort.id,
    });

    if (!credentials) {
      await insertPeerProgrammingAudit({
        actorId: gate.auth.userId,
        command: 'peer-programming.session.join',
        policyStatus: 'deny',
        reason: 'stream_not_configured',
        targetType: 'session',
        targetId: cohort.id,
      });
      return NextResponse.json(
        { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
        { status: 503 },
      );
    }

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.session.join',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'session',
      targetId: cohort.id,
      metadata: { streamCallId: credentials.streamCallId },
    });

    return NextResponse.json({ ok: true, cohortId: cohort.id, displayName, ...credentials }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'session_join' });
    return peerProgrammingErrorResponse(error, 'Live session unavailable.');
  }
}
