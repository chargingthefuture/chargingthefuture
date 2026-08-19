import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { QUORA_CENSUS_ERROR_CODE } from 'lib/quora-live-census/constants';

export type CensusApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// The whole census is admin-only, read and write alike. It records observations about named public
// accounts belonging to people who never asked to be catalogued, so it has no member-facing or
// public surface at all — the output that reaches anyone else is a count, written by hand into a
// post, not this table.
export async function requireCensusAdminAccess(): Promise<CensusApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

export function ensureCensusMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_CENSUS_ERROR_CODE.csrfDenied,
        message: 'Missing CSRF confirmation header.',
      },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_CENSUS_ERROR_CODE.csrfDenied,
        message: 'Invalid request origin metadata.',
      },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_CENSUS_ERROR_CODE.csrfDenied,
        message: 'Cross-origin mutation denied by CSRF policy.',
      },
      { status: 403 },
    );
  }

  return null;
}

export function censusError(
  message: string,
  code: string,
  status: number,
  reason?: string,
): NextResponse {
  return NextResponse.json({ ok: false, code, message, ...(reason ? { reason } : {}) }, { status });
}
