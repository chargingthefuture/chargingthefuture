import { NextResponse } from 'next/server';
import { SE_MATCH_WORDS, seParseMatchChange, type SeMatchNeeds } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { countMatches, readMatchNeeds, resolveMatchChange, saveMatchNeeds } from 'lib/today/match/repository';

// GET and PUT /api/today/match: the Match card on Today (owner decision, 2026-11-16). GET answers the
// member's saved needs and how many Directory people fit them, counted live. PUT `{ needs: [keys] }`
// saves the needs picked on the card; PUT `{ code }` copies the job titles of a code saved on the
// landing page. Only the member's own row. Approved members only (the default tier), the same bar as
// the Directory the count is drawn from.

export const dynamic = 'force-dynamic';

const CHANGES_PER_HOUR = 60;
const NO_STORE = { 'cache-control': 'private, no-store' };

function denied(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function csrfRefusal(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') return denied('match_denied', 'Missing CSRF confirmation header.', 403);
  const origin = checkMutationOrigin(request);
  if (origin === 'invalid_origin') return denied('match_denied', 'Invalid request origin metadata.', 403);
  if (origin === 'cross_origin') return denied('match_denied', 'Cross-origin mutation denied by CSRF policy.', 403);
  return null;
}

// A count that could not be read leaves the needs on the card and the number out.
async function answer(needs: SeMatchNeeds | null) {
  let count: number | null = null;
  if (needs) {
    try {
      count = await countMatches(needs.jobTitleIds);
    } catch (error) {
      reportError(error, { area: 'today', op: 'match_count' });
    }
  }
  return NextResponse.json({ ok: true, needs, count }, { headers: NO_STORE });
}

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  try {
    return await answer(await readMatchNeeds(decision.userId));
  } catch (error) {
    reportError(error, { area: 'today', op: 'match_read' });
    return denied('match_unavailable', `Match could not be read: ${failureReason(error)}`, 503);
  }
}

export async function PUT(request: Request) {
  const csrf = csrfRefusal(request);
  if (csrf) return csrf;
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  const limit = checkRateLimit(`today-match:${decision.userId}`, CHANGES_PER_HOUR, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many changes this hour. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const change = seParseMatchChange(await request.json().catch(() => null));
  if (!change) return denied('invalid_match', `Send { needs: [one or more need keys] } or { code }. ${SE_MATCH_WORDS.badCode}`, 400);
  try {
    const resolved = await resolveMatchChange(change);
    if (resolved.kind === 'unknown_code') return denied('unknown_code', 'No match is saved under that code. Check it against the one lagatos.com showed.', 404);
    if (resolved.kind === 'no_titles') return denied('no_titles', 'None of those needs are in the Skills Taxonomy right now, so nothing was saved.', 422);
    await saveMatchNeeds(decision.userId, resolved.needs);
    return await answer(resolved.needs);
  } catch (error) {
    reportError(error, { area: 'today', op: 'match_save' });
    return denied('match_unavailable', `What you need was not saved: ${failureReason(error)}`, 503);
  }
}
