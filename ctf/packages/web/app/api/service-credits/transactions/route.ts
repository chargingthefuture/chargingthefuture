import { NextResponse } from 'next/server';
import { requireServiceCreditsReadAccess } from 'lib/service-credits/_lib';
import { listWalletLedgerEntries } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

// The caller's own wallet history: one page of rows from the authoritative double-entry ledger
// (service_credits_ledger_entries), newest first. Read-only and scoped to the signed-in member —
// it never returns another member's entries. Backs the "Recent Transactions" list in the wallet UI,
// which shows a page at a time rather than a list that grows without a bottom, so the response
// carries the member's total row count alongside the page.
export async function GET(request: Request) {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const params = new URL(request.url).searchParams;
  const limitParam = Number(params.get('limit') ?? 50);
  // Cap the caller-supplied page size so a member cannot request an arbitrarily large ledger dump.
  // The repository also clamps to [1, 200]; this enforces the same ceiling at the route boundary.
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  // How many rows to skip before the page starts. Anything that is not a real number, or is
  // negative, means "start at the newest row".
  const offsetParam = Number(params.get('offset') ?? 0);
  const offset = Number.isFinite(offsetParam) ? Math.max(Math.trunc(offsetParam), 0) : 0;

  try {
    const page = await listWalletLedgerEntries(gate.auth.userId, limit, offset);
    return NextResponse.json(
      { ok: true, entries: page.entries, total: page.total, limit, offset },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'transactions' });
    return NextResponse.json(
      { ok: false, code: 'service_credits_transactions_unavailable', message: 'Unable to load transactions.' },
      { status: 503 },
    );
  }
}
