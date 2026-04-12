import { NextRequest, NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, listConnectionHistory } from 'lib/foundation/repository';

export async function GET(request: NextRequest) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const includeMessages = (searchParams.get('includeMessages') ?? 'true') === 'true';
    const includeCalls = (searchParams.get('includeCalls') ?? 'true') === 'true';
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);

    const history = await listConnectionHistory({
      actorUserId: gate.auth.userId,
      includeMessages,
      includeCalls,
      page,
      pageSize,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.history.list',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'connection_history',
      targetId: gate.auth.userId,
      metadata: {
        threadCount: history.threads.length,
        messageCount: history.messages.length,
        callCount: history.calls.length,
      },
    });

    return NextResponse.json({ ok: true, ...history }, { status: 200 });
  } catch (error) {
    console.error('[Foundation] Connection history list failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Connection history unavailable.' },
      { status: 503 },
    );
  }
}
