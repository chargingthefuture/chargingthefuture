import { NextResponse } from 'next/server';
import { MAX_MUTE_WORDS_LENGTH, addMute, listMutes, MuteLimitError } from 'lib/mutes/repository';
import { seNormalizeMuteWords } from '@ctf/shared';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { ensureMutationCsrf, requireAccountAccess } from '../_lib';

// Personal mute (3.1.0): the member's own list of muted people and words, beside blocks. A
// personal control, so it uses the account area's gate, the same as blocks. Nobody is told.
//
// GET  /api/account/mutes  — the member's mutes, newest first.
// POST /api/account/mutes  — { kind: 'person', target: accountId, label? } or { kind: 'words', target }.

export async function GET() {
  const gate = await requireAccountAccess();
  if (!gate.allowed) return gate.response;
  try {
    return NextResponse.json({ ok: true, mutes: await listMutes(gate.auth.userId) });
  } catch (error) {
    reportError(error, { area: 'account', op: 'mutes_list' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to load your mutes: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

function readMute(body: Record<string, unknown>, selfId: string): { kind: 'person' | 'words'; target: string; label: string | null } | string {
  const target = typeof body.target === 'string' ? body.target.trim() : '';
  if (body.kind === 'person') {
    if (!target) return 'Name the person to mute.';
    if (target === selfId) return 'You cannot mute yourself.';
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : null;
    return { kind: 'person', target, label: label || null };
  }
  if (body.kind === 'words') {
    const words = seNormalizeMuteWords(target);
    if (!words) return 'Type the words to mute.';
    if (words.length > MAX_MUTE_WORDS_LENGTH) return `Muted words can be at most ${MAX_MUTE_WORDS_LENGTH} characters.`;
    return { kind: 'words', target: words, label: null };
  }
  return "A mute is a 'person' or 'words'.";
}

export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireAccountAccess();
  if (!gate.allowed) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const mute = body ? readMute(body, gate.auth.userId) : 'Invalid JSON body.';
  if (typeof mute === 'string') {
    return NextResponse.json({ ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message: mute }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, mute: await addMute(gate.auth.userId, mute.kind, mute.target, mute.label) }, { status: 201 });
  } catch (error) {
    if (error instanceof MuteLimitError) return NextResponse.json({ ok: false, code: 'mute_limit', message: error.message }, { status: 429 });
    reportError(error, { area: 'account', op: 'mutes_add' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to save the mute: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
