import { NextRequest, NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { listNotificationEvents } from 'lib/foundation/repository';

export async function GET(request: NextRequest) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true';
    const notifications = await listNotificationEvents(gate.auth.userId, unreadOnly);
    return NextResponse.json({ ok: true, items: notifications }, { status: 200 });
  } catch (error) {
    console.error('[Foundation] Notifications list failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Notifications unavailable.' },
      { status: 503 },
    );
  }
}
