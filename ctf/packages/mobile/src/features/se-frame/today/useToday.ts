// The Android copy of the web's use-today.ts: reads /api/today (or /api/today/public for a visitor
// who is not signed in) and keeps the last answer on the phone so Today draws at once on the next
// open. A signed-in member's Done and Not for me marks are stored on their account
// (POST /api/today/marks) and applied by the server, so every device agrees; the screen changes at
// once and the route stores the change. Marks this phone kept before that are sent up once, then
// removed here. A visitor who is not signed in has no account and no marks.

import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { seDayStartIso, seLegacyMarkChanges, seMarkCardInToday, seMarkChangeFor, seMarksFromToday, type SeCardMarkChange, type SeToday, type SeTodayMarks } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

export type TodayMarks = SeTodayMarks;
export type MarkKind = 'read' | 'hidden';

function store(name: string): File {
  return new File(Paths.document, name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
}

async function readJson<T>(name: string): Promise<T | null> {
  try {
    const file = store(name);
    if (!file.exists) return null;
    return JSON.parse(await file.text()) as T;
  } catch {
    // no-trace: nothing saved yet, or the saved copy is unreadable; the screen reads fresh.
    return null;
  }
}

function writeJson(name: string, value: unknown) {
  try {
    const file = store(name);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch (error) {
    reportError(error, { area: 'today', op: 'save_copy' });
  }
}

async function readMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown } | null;
    if (body && typeof body.message === 'string' && body.message) return body.message;
  } catch {
    // no-trace: the body is not JSON; the fallback sentence is shown.
  }
  return fallback;
}

async function postMarks(body: unknown): Promise<boolean> {
  try {
    const res = await authedFetch('/api/today/marks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });
    if (!res.ok) reportError(new Error(`The card mark was not saved (HTTP ${res.status}).`), { area: 'today', op: 'marks_save', extra: { status: res.status } });
    return res.ok;
  } catch (error) {
    reportError(error, { area: 'today', op: 'marks_save' });
    return false;
  }
}

// Marks this phone kept before they were stored on the account: sent once, then removed.
async function uploadLegacyMarks(owner: string): Promise<void> {
  const name = `se-today-marks-${owner}`;
  const changes = seLegacyMarkChanges(await readJson<unknown>(name));
  if (changes.length === 0 || !(await postMarks({ marks: changes, upload: true }))) return;
  try {
    const file = store(name);
    if (file.exists) file.delete();
  } catch (error) {
    reportError(error, { area: 'today', op: 'legacy_marks_remove' });
  }
}

// `accountId` null: a visitor who is not signed in. Their copy is kept under 'guest'.
export function useToday(accountId: string | null) {
  const owner = accountId ?? 'guest';
  const [today, setToday] = useState<SeToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const fallback = 'Could not load Today.';
    const url = accountId ? `/api/today?dayStart=${encodeURIComponent(seDayStartIso())}` : '/api/today/public';
    try {
      const res = await authedFetch(url);
      if (!res.ok) {
        setError(await readMessage(res, fallback));
        return;
      }
      const body = (await res.json()) as { today: SeToday };
      setToday(body.today);
      writeJson(`se-today-${owner}`, body.today);
    } catch (caught) {
      reportError(caught, { area: 'today', op: 'load' });
      setError(fallback);
    } finally {
      setLoading(false);
    }
  }, [accountId, owner]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const cached = await readJson<SeToday>(`se-today-${owner}`);
      if (live && cached) setToday((current) => current ?? cached);
      if (accountId) await uploadLegacyMarks(owner);
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [owner, accountId, load]);

  const apply = useCallback(
    (change: SeCardMarkChange | null) => {
      if (!change || !accountId) return;
      setToday((current) => {
        if (!current) return current;
        const next = seMarkCardInToday(current, change);
        writeJson(`se-today-${owner}`, next);
        return next;
      });
      // A mark that was not stored is read back as it is on the server.
      void postMarks(change).then((ok) => (ok ? undefined : load()));
    },
    [owner, accountId, load],
  );

  // Not for me: the card leaves Today on every device and never comes back.
  const mark = useCallback((kind: MarkKind, cardId: string) => apply(seMarkChangeFor(today, kind, cardId)), [apply, today]);
  // Done is a toggle on the card's timeline dot, so a card marked by mistake can be unmarked.
  const toggle = useCallback((kind: MarkKind, cardId: string) => apply(seMarkChangeFor(today, kind, cardId)), [apply, today]);

  return { today, loading, error, marks: seMarksFromToday(today), mark, toggle, reload: load };
}
