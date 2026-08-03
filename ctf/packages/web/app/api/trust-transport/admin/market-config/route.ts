import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { getMarketConfig, insertTrustTransportAudit, updateMarketConfig } from 'lib/trust-transport/repository';
import type { TrustTransportMarketConfig } from 'lib/trust-transport/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
    reportError(error, { area: 'trust-transport', op: 'admin_market_config' });
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parseMarketConfig(body);

  try {
    const config = await updateMarketConfig(gate.auth.userId, input);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.admin.market.config.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'market_config',
      targetId: 'singleton',
      metadata: input,
    });
    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'admin_market_config' });
    return trustTransportErrorResponse(error, 'Market config update unavailable.');
  }
}
