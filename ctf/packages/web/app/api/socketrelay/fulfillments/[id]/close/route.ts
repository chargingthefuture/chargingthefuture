import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { resolveFulfillment } from 'lib/socketrelay/repository';
import type { SocketRelayResolveOutcome } from 'lib/socketrelay/types';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

const VALID_OUTCOMES: SocketRelayResolveOutcome[] = [
  'successful',
  'no_longer_needed',
  'unsuccessful_reopen',
  'unsuccessful_close',
];

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
  }

  const { id } = await params;
  const outcome = body.outcome;
  if (typeof outcome !== 'string' || !VALID_OUTCOMES.includes(outcome as SocketRelayResolveOutcome)) {
    return socketRelayErrorResponse(new Error('invalid_outcome'), 'Choose how to resolve this request.');
  }

  try {
    // resolveFulfillment enforces that only the requester (or an admin) can resolve.
    const item = await resolveFulfillment(id, gate.auth.userId, gate.auth.isAdmin, outcome as SocketRelayResolveOutcome);
    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'fulfillments_id_close' });
    return socketRelayErrorResponse(error, 'Fulfillment resolve unavailable.');
  }
}
