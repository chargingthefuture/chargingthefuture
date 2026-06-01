import { NextResponse } from 'next/server';
import { requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { listMyFulfillments } from 'lib/socketrelay/repository';

export async function GET() {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listMyFulfillments(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'my_fulfillments_list', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'My fulfillments unavailable.');
  }
}
