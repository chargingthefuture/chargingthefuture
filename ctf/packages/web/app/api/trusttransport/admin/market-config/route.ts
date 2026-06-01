import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
import { getMarketConfig, insertTrustTransportAudit, updateMarketConfig } from 'lib/trusttransport/repository';
import type { TrustTransportMarketConfig } from 'lib/trusttransport/types';
import { reportError } from 'lib/observability/report';

function parseMarketConfig(body: Record<string, unknown>): TrustTransportMarketConfig {
  return {
    maxConcurrentTrips: typeof body.maxConcurrentTrips === 'number' ? body.maxConcurrentTrips : 3,
    requireProofOnDelivery: typeof body.requireProofOnDelivery === 'boolean' ? body.requireProofOnDelivery : true,
    emergencyFreezeEnabled: typeof body.emergencyFreezeEnabled === 'boolean' ? body.emergencyFreezeEnabled : true,
  };
}

export async function GET() {
  const gate = await requireTrustTransportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getMarketConfig();
    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'admin_market_config' });
    return trustTransportErrorResponse(error, 'Market config unavailable.');
  }
}

export async function PUT(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseMarketConfig(body);

  try {
    const config = await updateMarketConfig(gate.auth.userId, input);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trusttransport.admin.market.config.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'market_config',
      targetId: 'singleton',
      metadata: input,
    });
    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'admin_market_config' });
    return trustTransportErrorResponse(error, 'Market config update unavailable.');
  }
}
