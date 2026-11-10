import { NextResponse } from 'next/server';
import { seParseTodayFeedback } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { addTodayFeedback } from 'lib/today/feedback/repository';

// POST /api/today/feedback { source, kind, signal: 'done' | 'not_for_me' }: a member marked a Today
// card done or picked Not for me. Adds one to that day's total for the card's source and kind;
// nothing about the member is stored. Open to every signed-in member at 'signed_in', the tier Today
// is read at. The Adoption admin screen reads the totals from GET /api/admin/today-feedback.

export const dynamic = 'force-dynamic';

const MARKS_PER_HOUR = 300;

function denied(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function csrfRefusal(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') return denied('feedback_denied', 'Missing CSRF confirmation header.', 403);
  const origin = checkMutationOrigin(request);
  if (origin === 'invalid_origin') return denied('feedback_denied', 'Invalid request origin metadata.', 403);
  if (origin === 'cross_origin') return denied('feedback_denied', 'Cross-origin mutation denied by CSRF policy.', 403);
  return null;
}

export async function POST(request: Request) {
  const csrf = csrfRefusal(request);
  if (csrf) return csrf;
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  const limit = checkRateLimit(`today-feedback:${decision.userId}`, MARKS_PER_HOUR, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many cards marked this hour. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const feedback = seParseTodayFeedback(await request.json().catch(() => null));
  if (!feedback) {
    return denied('invalid_feedback', "Send source (a card source name), kind (a card kind) and signal ('done' or 'not_for_me').", 400);
  }
  try {
    await addTodayFeedback(feedback);
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'today', op: 'feedback_add', extra: { source: feedback.source, kind: feedback.kind, signal: feedback.signal } });
    return denied('feedback_unavailable', `The mark was not counted: ${failureReason(error)}`, 503);
  }
}
