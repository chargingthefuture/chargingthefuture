import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listActiveCurrencies } from 'lib/currency/repository';
import { reportError } from 'lib/observability/report';

// Active currency catalog for the shared payment selector (issue #420). Any signed-in user can read it
// — the list is reference data, not sensitive, and is needed in every value-bearing plugin's create
// form. `any_authenticated` so a still-gated user can also see the options. ServiceCredits sorts first;
// barter is included when present in the catalog (kind=barter, requiresAmount=false).
export async function GET() {
  const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const currencies = await listActiveCurrencies();
    return NextResponse.json({ ok: true, currencies }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'currency', op: 'list' });
    return NextResponse.json(
      { ok: false, code: 'currency_catalog_unavailable', message: 'Unable to load the currency list.' },
      { status: 503 },
    );
  }
}
