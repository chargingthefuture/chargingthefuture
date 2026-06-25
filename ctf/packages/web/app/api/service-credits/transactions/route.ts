import { NextResponse } from 'next/server';
import { requireServiceCreditsReadAccess } from 'lib/service-credits/_lib';
import { listWalletLedgerEntries } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

// The caller's own wallet history: recent rows from the authoritative double-entry ledger
// (service_credits_ledger_entries), newest first. Read-only and scoped to the signed-in member —
// it never returns another member's entries. Backs the "Recent Transactions" list in the wallet UI.
export async function GET(request: Request) {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitParam = Number(new URL(request.url).searchParams.get('limit') ?? 50);
  const limit = Number.isFinite(limitParam) ? limitParam : 50;

  try {
    const entries = await listWalletLedgerEntries(gate.auth.userId, limit);
    return NextResponse.json({ ok: true, entries }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'transactions' });
    return NextResponse.json(
      { ok: false, code: 'service_credits_transactions_unavailable', message: 'Unable to load transactions.' },
      { status: 503 },
    );
  }
}
