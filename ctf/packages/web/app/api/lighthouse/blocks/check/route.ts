import { NextRequest, NextResponse } from 'next/server';
import { requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { isBlockedPair } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: NextRequest) {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const blockedUserId = request.nextUrl.searchParams.get('blockedUserId')?.trim() ?? '';
  if (!blockedUserId) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'blockedUserId query parameter is required.' },
      { status: 400 },
    );
  }

  try {
    const blocked = await isBlockedPair(gate.auth.userId, blockedUserId);
    return NextResponse.json({ ok: true, blocked }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'block_check', extra: { userId: gate.auth.userId, blockedUserId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Block check unavailable.' },
      { status: 503 },
    );
  }
}
