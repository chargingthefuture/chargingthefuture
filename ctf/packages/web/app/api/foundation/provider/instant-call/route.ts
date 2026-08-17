import { NextResponse } from 'next/server';
import { requireFoundationReadAccess, ensureMutationCsrf } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { getOwnInstantCallSettings, setOwnInstantCallSettings } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// The provider's own instant 1:1 call settings (Foundation "Connect now", issue #808): whether they
// are reachable for an immediate paid call, the rate in ServiceCredits, and the per-block interval.
// Read access requires Unlock (the gate enforces approved_full), so only unlocked members reach this.
export async function GET() {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const instantCall = await getOwnInstantCallSettings(gate.auth.userId);
    return NextResponse.json({ ok: true, instantCall }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'provider_instant_call_get' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to load your instant-call settings.' },
      { status: 503 },
    );
  }
}

type InstantCallBody = { enabled?: unknown; rateCredits?: unknown; intervalMinutes?: unknown };

type ValidatedInstantCallBody = { enabled: boolean; rateCredits: number | null; intervalMinutes: number };

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

// Validate the instant-call body shape: enabled is required boolean, rateCredits is a number or null,
// and intervalMinutes is a number. Returns a 400 response on the first shape error, otherwise the
// narrowed body ready to persist (the repository still enforces the rate/interval value ranges).
function validateInstantCallBody(body: InstantCallBody): NextResponse | ValidatedInstantCallBody {
  if (typeof body.enabled !== 'boolean') {
    return badRequest('enabled must be a boolean.');
  }
  if (body.rateCredits !== null && typeof body.rateCredits !== 'number') {
    return badRequest('rateCredits must be a number or null.');
  }
  if (typeof body.intervalMinutes !== 'number') {
    return badRequest('intervalMinutes must be a number.');
  }
  return { enabled: body.enabled, rateCredits: body.rateCredits, intervalMinutes: body.intervalMinutes };
}

// Save the member's instant-call settings. The repository validates the rate and interval and throws a
// stable code ('invalid_rate' / 'invalid_interval') that maps to a clear member-facing 400; anything
// else is a persistence failure.
export async function PUT(request: Request) {
  // CSRF first, then auth — the canonical mutation order across this plugin (e.g. connections/threads),
  // so a cross-origin request is bounced before it reaches the auth subsystem (issue #989).
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: InstantCallBody;
  try {
    body = (await request.json()) as InstantCallBody;
  } catch {
    return badRequest('Invalid JSON body.');
  }

  const validated = validateInstantCallBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const instantCall = await setOwnInstantCallSettings(gate.auth.userId, {
      enabled: validated.enabled,
      rateCredits: validated.rateCredits,
      intervalMinutes: validated.intervalMinutes,
    });
    return NextResponse.json({ ok: true, instantCall }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'invalid_rate') {
      return badRequest('Set a rate of at least 1 credit.');
    }
    if (message === 'invalid_interval') {
      return badRequest('Choose an interval between 5 and 60 minutes.');
    }
    reportError(error, { area: 'foundation', op: 'provider_instant_call_set' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to save your instant-call settings.' },
      { status: 503 },
    );
  }
}
