import { NextResponse } from 'next/server';
import { setCreditLimit, getCreditLimitInfo, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type CreditLimitBody = {
  targetUserId?: string;
  creditLimit?: number;
};

// Read a member's granted, earned, and effective mutual-credit limits (and freeze state) so the
// operator can grant in line with what the member has earned.
export async function GET(request: Request) {
  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const targetUserId = new URL(request.url).searchParams.get('targetUserId');
  if (!targetUserId) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'targetUserId is required.' }, { status: 400 });
  }

  try {
    const info = await getCreditLimitInfo(targetUserId);
    return NextResponse.json({ ok: true, creditLimit: info }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin-credit-limits-get' });
    return serviceCreditsErrorResponse(error, 'Could not read credit limit.');
  }
}

// Admin-only: grant or revoke a member's mutual-credit limit. New accounts default to 0, so this is the
// only way a member gains the ability to go negative — earned trust, capped by policy maxLimit.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: CreditLimitBody;
  try {
    body = (await request.json()) as CreditLimitBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  if (!body.targetUserId || typeof body.creditLimit !== 'number' || !Number.isFinite(body.creditLimit) || body.creditLimit < 0) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'targetUserId and a non-negative finite creditLimit are required.' }, { status: 400 });
  }

  try {
    const result = await setCreditLimit({ actorId: gate.auth.userId, targetUserId: body.targetUserId, creditLimit: body.creditLimit });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.credit-limit.set',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'wallet',
      targetId: result.targetUserId,
      metadata: { creditLimit: result.creditLimit },
    });

    return NextResponse.json({ ok: true, creditLimit: result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin-credit-limits' });
    return serviceCreditsErrorResponse(error, 'Could not set credit limit.');
  }
}
