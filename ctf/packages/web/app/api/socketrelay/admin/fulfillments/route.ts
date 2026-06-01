import { NextResponse } from 'next/server';
import { requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { listAdminFulfillments } from 'lib/socketrelay/repository';

export async function GET() {
  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listAdminFulfillments();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_fulfillments_list', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Admin fulfillments unavailable.');
  }
}
