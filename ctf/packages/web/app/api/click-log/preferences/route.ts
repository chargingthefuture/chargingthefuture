import { NextRequest, NextResponse } from 'next/server';
import { getPreferences, setPreferences } from 'lib/click-log/repository';
import { logClickLogAudit } from 'lib/click-log/audit';
import { ensureMutationCsrf, requireClickLogAccess } from '../_lib';

// Member ClickLog preferences. shareWithOwner is the member's global default for whether a newly
// logged incident is shared with the owner for aggregate trends. Opt-in: a member who has never
// touched the setting reads back false.

export async function GET() {
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const prefs = await getPreferences(gate.auth.userId);
  logClickLogAudit({ actorId: gate.auth.userId, command: 'click-log.preferences.fetch', result: 'success' });
  return NextResponse.json(prefs);
}

export async function PUT(req: NextRequest) {
  const csrfDenied = ensureMutationCsrf(req);
  if (csrfDenied) {
    return csrfDenied;
  }
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const shareWithOwner = (body as { shareWithOwner?: unknown })?.shareWithOwner;
  if (typeof shareWithOwner !== 'boolean') {
    return NextResponse.json({ error: 'Invalid shareWithOwner' }, { status: 400 });
  }
  await setPreferences(gate.auth.userId, { shareWithOwner });
  logClickLogAudit({
    actorId: gate.auth.userId,
    command: 'click-log.preferences.update',
    result: 'success',
    target: { shareWithOwner: String(shareWithOwner) },
  });
  return NextResponse.json({ shareWithOwner });
}
