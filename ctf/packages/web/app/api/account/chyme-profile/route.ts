import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ensureMutationCsrf } from '../_lib';
import { markServiceDeletion } from 'lib/chyme/repository';
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

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.profile.delete.service',
      actorId: decision.userId,
      status: 'allow',
      reason: 'service_scope_confirmed',
      target: {
        scope: 'service',
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
