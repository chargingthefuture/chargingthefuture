import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ensureMutationCsrf } from '../_lib';
import { markServiceDeletion } from 'lib/chyme/repository';
import { deleteChymeStreamData } from 'lib/chyme/stream';
import { logChymeAudit } from 'lib/chyme/audit';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { reportError } from 'lib/observability/report';

export async function DELETE(request: Request) {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    minUnlockTier: 'any_authenticated',
  });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  // Same-origin CSRF guard before the destructive delete, matching the shared account
  // deletion routes and the SkillsHunt profile-delete path.
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const deletion = await markServiceDeletion(decision.userId);

    // This route uses the bespoke markServiceDeletion (not the shared deletion orchestrator), so the
    // orchestrator's external-cleanup hook does not run here — clear the member's Stream copy directly.
    // Best-effort after the DB delete: a Stream outage is logged, never fails the completed deletion.
    const streamCleared = await deleteChymeStreamData(decision.userId);
    if (!streamCleared) {
      reportError(new Error('Chyme Stream data was not cleared on service deletion'), {
        area: 'account',
        op: 'chyme_profile_stream_cleanup',
        extra: { userId: decision.userId },
      });
    }

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.profile.delete.service',
      actorId: decision.userId,
      status: 'allow',
      reason: 'service_scope_confirmed',
      target: {
        scope: 'service',
        streamCleared: streamCleared ? 'yes' : 'no',
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(deletion, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account', op: 'chyme_profile' });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.profile.delete.service',
      actorId: decision.userId,
      status: 'allow',
      reason: 'service_scope_confirmed',
      target: {
        scope: 'service',
      },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to delete Chyme service data.',
      },
      { status: 503 },
    );
  }
}
