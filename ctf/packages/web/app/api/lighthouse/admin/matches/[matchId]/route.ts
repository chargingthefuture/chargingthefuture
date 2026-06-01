import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { insertLighthouseAudit, updateMatch, validateMatchUpdateInput } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';
import type { LighthouseMatchUpdateInput } from 'lib/lighthouse/types';

type RouteParams = {
  params: Promise<{ matchId: string }>;
};

type MatchBody = Partial<LighthouseMatchUpdateInput>;

export async function PUT(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: MatchBody;
  try {
    body = (await request.json()) as MatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input: LighthouseMatchUpdateInput = {
    status: body.status === 'pending' || body.status === 'accepted' || body.status === 'rejected' || body.status === 'cancelled' || body.status === 'completed'
      ? body.status
      : 'pending',
    hostResponse: typeof body.hostResponse === 'string' ? body.hostResponse : null,
  };

  if (!validateMatchUpdateInput(input)) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid match update payload.' },
      { status: 400 },
    );
  }

  const { matchId } = await params;

  try {
    const match = await updateMatch({
      actorUserId: gate.auth.userId,
      matchId,
      status: input.status,
      hostResponse: input.hostResponse,
      isAdmin: true,
    });

    await insertLighthouseAudit({
      actorId: gate.auth.userId,
      command: 'lighthouse.admin.match.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'match',
      targetId: match.id,
      metadata: { status: match.status },
    });

    return NextResponse.json({ ok: true, match }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';

    if (code === 'match_not_found') {
      return NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.matchNotFound, message: 'Lighthouse match not found.' },
        { status: 404 },
      );
    }

    reportError(error, { area: 'lighthouse', op: 'admin_match_update', extra: { userId: gate.auth.userId, matchId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin match update unavailable.' },
      { status: 503 },
    );
  }
}
