import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listActiveCurrencies } from 'lib/currency/repository';
import { reportError } from 'lib/observability/report';

// Active currency catalog for the shared payment selector (issue #420). Any signed-in user can read it
// — the list is reference data, not sensitive, and is needed in every value-bearing plugin's create
// form. `any_authenticated` so a still-gated user can also see the options. ServiceCredits sorts first;
// barter is included when present in the catalog (kind=barter, requiresAmount=false).
export async function GET() {
  // The access check is inside the try on purpose. It reads the session and the account-restriction
  // table, so it can throw — and when it did, the throw escaped this handler as an unlogged 500. The
  // client only saw "not ok" and disabled the settlement control across every value-bearing plugin,
  // with nothing recorded to say why (owner report: the SocketRelay settlement field was stuck and
  // undiagnosable). Every failure path now reports before it answers.
  try {
    const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated' });
    if (!decision.allowed) {
      // Logged as well as returned: a member being denied reference data they are supposed to be able
      // to read is a misconfiguration, not a normal outcome, and it looks identical to an outage from
      // the client's side.
      reportError(new Error(`Currency catalog denied: ${decision.code}/${decision.reason}`), {
        area: 'currency',
        op: 'list_denied',
      });
      return NextResponse.json(decision, { status: decision.status });
    }

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
