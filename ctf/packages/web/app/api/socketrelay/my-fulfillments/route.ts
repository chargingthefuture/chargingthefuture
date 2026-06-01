import { NextResponse } from 'next/server';
import { requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { listMyFulfillments } from 'lib/socketrelay/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listMyFulfillments(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'my_fulfillments' });
    return socketRelayErrorResponse(error, 'My fulfillments unavailable.');
  }
}
