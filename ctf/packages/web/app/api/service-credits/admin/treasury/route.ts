import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { getTreasuryConfig, insertServiceCreditsAudit, updateTreasuryConfig } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type TreasuryBody = {
  policy?: Record<string, unknown>;
};

export async function GET() {
  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const treasuryConfig = await getTreasuryConfig();
    return NextResponse.json({ ok: true, treasuryConfig }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_treasury_get' });
    return serviceCreditsErrorResponse(error, 'Could not load treasury policy.');
  }
}

export async function PUT(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: TreasuryBody;
  try {
    body = (await request.json()) as TreasuryBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  if (!body.policy || typeof body.policy !== 'object') {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'policy object is required.' }, { status: 400 });
  }

  try {
    await updateTreasuryConfig({ actorId: gate.auth.userId, policy: body.policy });
    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.treasury.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'treasury',
      targetId: '1',
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_treasury_put' });
    return serviceCreditsErrorResponse(error, 'Could not save treasury policy.');
  }
}
