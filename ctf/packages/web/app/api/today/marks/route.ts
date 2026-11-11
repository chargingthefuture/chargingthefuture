import { NextResponse } from 'next/server';
import { SE_CARD_MARKS_MAX_BATCH, seParseCardMarkChanges } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { saveCardMarks } from 'lib/today/marks/repository';
import { readMarkedCards } from 'lib/today/marked-cards';

// POST /api/today/marks: a member's own mark on a Today card, stored on the account so every device
// agrees (today_card_marks). `{ cardId, mark }` with mark 'done' (the timeline dot), 'not_for_me'
// (the ••• menu) or 'clear' (the dot again, taking Done away); or `{ marks: [...], upload: true }`,
// sent once by a device that kept marks before they were stored here (a card already marked keeps
// its mark). GET /api/today applies them. GET /api/today/marks?mark=done|not_for_me lists the
// member's own marked cards that are still around, for Me → Read and Hidden. Open to every signed-in member at 'signed_in', the tier
// Today is read at. Separate from POST /api/today/feedback, which counts marks with no names.

export const dynamic = 'force-dynamic';

const CHANGES_PER_HOUR = 600;

function denied(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function csrfRefusal(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') return denied('marks_denied', 'Missing CSRF confirmation header.', 403);
  const origin = checkMutationOrigin(request);
  if (origin === 'invalid_origin') return denied('marks_denied', 'Invalid request origin metadata.', 403);
  if (origin === 'cross_origin') return denied('marks_denied', 'Cross-origin mutation denied by CSRF policy.', 403);
  return null;
}

export async function POST(request: Request) {
  const csrf = csrfRefusal(request);
  if (csrf) return csrf;
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  const limit = checkRateLimit(`today-marks:${decision.userId}`, CHANGES_PER_HOUR, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many cards marked this hour. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const body = (await request.json().catch(() => null)) as { upload?: unknown } | null;
  const changes = seParseCardMarkChanges(body);
  if (!changes) {
    return denied('invalid_mark', `Send { cardId, mark } with mark 'done', 'not_for_me' or 'clear', or { marks: [...] } with 1 to ${SE_CARD_MARKS_MAX_BATCH} of them.`, 400);
  }
  try {
    await saveCardMarks(decision.userId, changes, body?.upload === true);
    return NextResponse.json({ ok: true, saved: changes.length });
  } catch (error) {
    reportError(error, { area: 'today', op: 'marks_save', extra: { count: changes.length } });
    return denied('marks_unavailable', `The mark was not saved: ${failureReason(error)}`, 503);
  }
}

export async function GET(request: Request) {
  const mark = new URL(request.url).searchParams.get('mark');
  if (mark !== 'done' && mark !== 'not_for_me') return denied('invalid_mark', "Send ?mark=done or ?mark=not_for_me.", 400);
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  try {
    const cards = await readMarkedCards(decision, mark);
    return NextResponse.json({ ok: true, cards }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'marks_list', extra: { mark } });
    return denied('marks_unavailable', `Could not read your marked cards: ${failureReason(error)}`, 503);
  }
}
