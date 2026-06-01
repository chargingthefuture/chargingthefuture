import { NextResponse } from 'next/server';
import { requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { listAdminFulfillments } from 'lib/socketrelay/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listAdminFulfillments();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_fulfillments' });
    return socketRelayErrorResponse(error, 'Admin fulfillments unavailable.');
  }
}
