import { NextResponse } from 'next/server';
import { SE_SAVED_WORDS, seParseSaveChange } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { listSaves, saveChange } from 'lib/today/saves/repository';

// A member's Save for later list (today_card_saves). GET lists it, newest first, for Saved in Me.
// POST `{ cardId, saved: true, kind, title, href }` saves a story or replay from Today, and
// `{ cardId, saved: false }` takes it off. Only the member's own rows. Open to every signed-in member
// at 'signed_in', the tier Today is read at; saving changes nothing anybody else sees.

export const dynamic = 'force-dynamic';

const CHANGES_PER_HOUR = 300;

function denied(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function csrfRefusal(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') return denied('saves_denied', 'Missing CSRF confirmation header.', 403);
  const origin = checkMutationOrigin(request);
  if (origin === 'invalid_origin') return denied('saves_denied', 'Invalid request origin metadata.', 403);
  if (origin === 'cross_origin') return denied('saves_denied', 'Cross-origin mutation denied by CSRF policy.', 403);
  return null;
}

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  try {
    return NextResponse.json({ ok: true, saves: await listSaves(decision.userId) }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'saves_list' });
    return denied('saves_unavailable', `Saved could not be read: ${failureReason(error)}`, 503);
  }
}

export async function POST(request: Request) {
  const csrf = csrfRefusal(request);
  if (csrf) return csrf;
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  const limit = checkRateLimit(`today-saves:${decision.userId}`, CHANGES_PER_HOUR, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many cards saved this hour. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const change = seParseSaveChange(await request.json().catch(() => null));
  if (!change) {
    return denied('invalid_save', "Send { cardId, saved: true, kind: 'story' or 'replay', title, href } or { cardId, saved: false }. The address must be inside the app or start with https://.", 400);
  }
  try {
    const result = await saveChange(decision.userId, change);
    if (result === 'full') return denied('saves_full', SE_SAVED_WORDS.full, 409);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    reportError(error, { area: 'today', op: 'saves_change' });
    return denied('saves_unavailable', `The card was not saved: ${failureReason(error)}`, 503);
  }
}
