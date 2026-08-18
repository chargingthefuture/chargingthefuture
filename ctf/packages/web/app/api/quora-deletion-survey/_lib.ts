import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit, getClientIp } from 'lib/security/rate-limit';
import {
  QUORA_SURVEY_ERROR_CODE,
  QUORA_SURVEY_SUBMIT_RATE_LIMIT,
  QUORA_SURVEY_SUBMIT_RATE_WINDOW_MS,
} from 'lib/quora-deletion-survey/constants';

export type SurveyApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Reading responses is admin-only, and every admin route gates on this regardless of what the
// nav shows (rule 131). There is no member-facing read of this data and no public projection:
// the whole point of the consent questions is that nothing is published until a person decides
// it is, and an app-wide reader would make that decision for them.
export async function requireSurveyAdminAccess(): Promise<SurveyApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

// The submit path takes no session at all — the people this survey is for do not have accounts
// here, and requiring one would sample only the members we already reached. So the write is
// protected by same-origin CSRF plus a per-IP brake instead of by identity.
export function ensureSurveyMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.csrfDenied,
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
        code: QUORA_SURVEY_ERROR_CODE.csrfDenied,
        message: 'Invalid request origin metadata.',
      },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.csrfDenied,
        message: 'Cross-origin mutation denied by CSRF policy.',
      },
      { status: 403 },
    );
  }

  return null;
}

// Per-IP submit brake. The IP is used for the in-memory counter and is never stored — the table
// deliberately holds no address, agent string, or contact detail for anyone.
export function enforceSurveySubmitRateLimit(request: Request): NextResponse | null {
  const result = checkRateLimit(
    `quora-deletion-survey:submit:${getClientIp(request)}`,
    QUORA_SURVEY_SUBMIT_RATE_LIMIT,
    QUORA_SURVEY_SUBMIT_RATE_WINDOW_MS,
  );
  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      code: QUORA_SURVEY_ERROR_CODE.rateLimited,
      message: 'That is several responses from one connection in a short time. Try again later.',
    },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}
