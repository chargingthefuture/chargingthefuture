import { NextResponse } from 'next/server';
import { parsePositiveInteger, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_DEFAULT_PAGE, TRUST_TRANSPORT_DEFAULT_PAGE_SIZE } from 'lib/trust-transport/constants';
import { listAvailableRequests } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

// Open requests a member can offer to help with — everyone's open requests except the caller's own.
// Returns only mode + settlement + age (no pickup/drop-off, no title): the requester's location is
// shared with a provider only after the requester accepts that provider's offer (discovery model B).
export async function GET(request: Request) {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), TRUST_TRANSPORT_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), TRUST_TRANSPORT_DEFAULT_PAGE_SIZE);
    const response = await listAvailableRequests({ excludeUserId: gate.auth.userId, page, pageSize });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'requests_available' });
    return trustTransportErrorResponse(error, 'Available request listing unavailable.');
  }
}
