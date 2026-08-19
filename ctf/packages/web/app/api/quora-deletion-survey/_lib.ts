import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit, getClientIp } from 'lib/security/rate-limit';
import {
  QUORA_SURVEY_ERROR_CODE,
  QUORA_SURVEY_SUBMIT_RATE_LIMIT,
  QUORA_SURVEY_SUBMIT_RATE_WINDOW_MS,
} from 'lib/quora-deletion-survey/constants';
import { insertSurveyAudit } from 'lib/quora-deletion-survey/repository';

export type SurveyApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Reading responses is admin-only, and every admin route gates on this regardless of what the
// nav shows (rule 131). There is no member-facing read of this data and no public projection:
// the whole point of the consent questions is that nothing is published until a person decides
// it is, and an app-wide reader would make that decision for them.
//
// The command name is passed in so a refused admin read is recorded here rather than in each
// route: a denial is exactly the event worth having, and leaving it to the caller means the one
// route that forgets is the one that mattered. A refusal has no user id to record — the session
// either was not there or was not an admin — so the actor stays null and the reason carries the
// deny code.
export async function requireSurveyAdminAccess(command: string): Promise<SurveyApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    await insertSurveyAudit({
      actorUserId: null,
      command,
      policyStatus: 'deny',
      reason: decision.reason,
      metadata: { status: decision.status, code: decision.code },
    });
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

// Submitting requires a signed-in member, at the lowest tier: any authenticated account, verified
// or not (owner decision, 2026-08-19). The bar keeps bulk junk out; it is not a claim that the
// member is verified, and the response records which account sent it. Someone who made an account
// minutes ago to answer this is exactly who the survey is for, so the gate must never be raised to
// `approved_full`.
export async function requireSurveyRespondentAccess(): Promise<SurveyApiGate> {
  const decision = await evaluatePluginAccess({
    minUnlockTier: 'any_authenticated',
    requireUsername: false,
  });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

// Same-origin CSRF, checked on top of the session above.
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

// Per-IP submit brake, kept alongside the sign-in requirement rather than replaced by it: one
// signed-in member is not a license to fill the table, and accidental double-taps are common. The
// IP is used for the in-memory counter and is never stored — no row here holds an address, an
// agent string, or any contact detail.
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
