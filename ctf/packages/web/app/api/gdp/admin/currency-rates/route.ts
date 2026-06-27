import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireGdpAdminAccess } from 'lib/gdp/_lib';
import {
  currencyExists,
  insertGdpAudit,
  listCurrencyRateAdmin,
  upsertCurrencyUsdRate,
} from 'lib/gdp/repository';
import { reportError } from 'lib/observability/report';

// Admin-only currency USD-rate management (issue #312 P2). These factors exist
// ONLY to roll multi-currency volume into the single USD-denominated GDP estimate.
// LEGAL GUARDRAIL: never a per-wallet, per-price, or redemption "ServiceCredits = fiat" value.

export async function GET() {
  const gate = await requireGdpAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const currencies = await listCurrencyRateAdmin();
  return NextResponse.json({ ok: true, currencies }, { status: 200 });
}

type ReviseBody = {
  currencyCode?: string;
  usdRate?: number | string;
  asOf?: string;
  source?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireGdpAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ReviseBody;
  try {
    body = (await request.json()) as ReviseBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'gdp_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const currencyCode = typeof body.currencyCode === 'string' ? body.currencyCode.trim().toUpperCase() : '';
  if (!currencyCode) {
    return NextResponse.json(
      { ok: false, code: 'gdp_invalid_payload', message: 'currencyCode is required.' },
      { status: 400 },
    );
  }

  const usdRate = typeof body.usdRate === 'string' ? Number(body.usdRate) : body.usdRate;
  if (typeof usdRate !== 'number' || !Number.isFinite(usdRate) || usdRate <= 0) {
    return NextResponse.json(
      { ok: false, code: 'gdp_invalid_rate', message: 'usdRate must be a number greater than zero.' },
      { status: 400 },
    );
  }

  const asOf = typeof body.asOf === 'string' && body.asOf.trim() ? body.asOf.trim() : todayIso();
  if (!ISO_DATE.test(asOf)) {
    return NextResponse.json(
      { ok: false, code: 'gdp_invalid_date', message: 'asOf must be an ISO date (YYYY-MM-DD).' },
      { status: 400 },
    );
  }

  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'owner';

  const exists = await currencyExists(currencyCode);
  if (!exists) {
    await insertGdpAudit({
      actorId: gate.auth.userId,
      command: 'gdp.currency-rate.revise',
      policyStatus: 'deny',
      reason: 'currency_not_found',
      targetType: 'currency_usd_rate',
      targetId: currencyCode,
      metadata: { currencyCode, asOf },
    });
    return NextResponse.json(
      { ok: false, code: 'gdp_currency_not_found', message: 'Unknown or inactive currency code.' },
      { status: 404 },
    );
  }

  const rate = await upsertCurrencyUsdRate({ currencyCode, usdRate, asOf, source });

  // Best-effort audit: the rate is already persisted, so a failed audit write must not turn a saved
  // change into a 500 and lose the response. Report the audit failure but still return success.
  try {
    await insertGdpAudit({
      actorId: gate.auth.userId,
      command: 'gdp.currency-rate.revise',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'currency_usd_rate',
      targetId: `${currencyCode}:${asOf}`,
      metadata: { currencyCode, usdRate, asOf, source },
    });
  } catch (auditError) {
    reportError(auditError, { area: 'gdp', op: 'currency_rate_revise_audit' });
  }

  return NextResponse.json({ ok: true, rate }, { status: 201 });
}
