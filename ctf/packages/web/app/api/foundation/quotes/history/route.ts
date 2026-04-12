import { NextRequest, NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, listQuoteHistory } from 'lib/foundation/repository';
import type { FoundationQuoteState } from 'lib/foundation/types';

export async function GET(request: NextRequest) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const actorScope = searchParams.get('actorScope');
    const statusFilter = searchParams
      .getAll('status')
      .map((value) => value.trim())
      .filter(Boolean) as FoundationQuoteState[];
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);

    const history = await listQuoteHistory({
      actorUserId: gate.auth.userId,
      actorScope: actorScope === 'survivor' || actorScope === 'provider' ? actorScope : undefined,
      statusFilter,
      page,
      pageSize,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.quote.request.history.list',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'quote_history',
      targetId: gate.auth.userId,
      metadata: { total: history.total },
    });

    return NextResponse.json({ ok: true, ...history }, { status: 200 });
  } catch (error) {
    console.error('[Foundation] Quote history list failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Quote history unavailable.' },
      { status: 503 },
    );
  }
}
