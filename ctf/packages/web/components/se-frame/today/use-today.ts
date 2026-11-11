'use client';

import { useCallback, useEffect, useState } from 'react';
import { seDayStartIso, seLegacyMarkChanges, seSaveCardInToday, seSaveChangeFor, SE_SAVED_WORDS, type SeTodayCard, seMarkCardInToday, seMarkChangeFor, seMarksFromToday, type SeCardMarkChange, type SeToday, type SeTodayMarks } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { reportError } from 'lib/observability/report';

// Reads /api/today (or, for a visitor who is not signed in, /api/today/public), and keeps the last
// answer in this browser so the screen draws at once on the next open and is replaced when the fresh
// answer arrives. A signed-in member's Done and Not for me marks are stored on their account
// (POST /api/today/marks) and applied by the server, so every device agrees; the screen changes at
// once and the route stores the change. Marks this browser kept before that are sent up once, then
// removed here. A visitor who is not signed in has no account and no marks.

const CACHE_PREFIX = 'se-today-v1:';
const LEGACY_MARKS_PREFIX = 'se-today-marks-v1:';

export type TodayMarks = SeTodayMarks;
export type MarkKind = 'read' | 'hidden';

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // no-trace: storage refused or holds something unreadable; the screen reads fresh.
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-trace: storage refused; the screen still works for this visit.
  }
}

async function postMarks(body: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/today/marks', {
      method: 'POST',
      credentials: 'same-origin',
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

// Null when stored, otherwise why not, in words the screen shows.
async function postSave(change: unknown): Promise<string | null> {
  try {
    const res = await fetch('/api/today/saves', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(change),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return `${SE_SAVED_WORDS.failed} ${body?.message ?? `HTTP ${res.status}`}`;
  } catch (error) {
    reportError(error, { area: 'today', op: 'saves_change' });
    return `${SE_SAVED_WORDS.failed} the app could not be reached.`;
  }
}

// Marks this browser kept before they were stored on the account: sent once, then removed.
async function uploadLegacyMarks(owner: string): Promise<boolean> {
  const changes = seLegacyMarkChanges(readJson<unknown>(LEGACY_MARKS_PREFIX + owner));
  if (changes.length === 0) return false;
  if (!(await postMarks({ marks: changes, upload: true }))) return false;
  try {
    window.localStorage.removeItem(LEGACY_MARKS_PREFIX + owner);
  } catch {
    // no-trace: storage refused; the next upload keeps the marks already stored.
  }
  return true;
}

// `accountId` null: a visitor who is not signed in. Their cache is kept under 'guest'.
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
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        setError(await responseFailureText(res, fallback, 'member'));
        return;
      }
      const body = (await res.json()) as { today: SeToday };
      setToday(body.today);
      writeJson(CACHE_PREFIX + owner, body.today);
    } catch (caught) {
      setError(failureText(caught, { area: 'today', op: 'load', fallback, audience: 'member' }));
    } finally {
      setLoading(false);
    }
  }, [owner, accountId]);

  useEffect(() => {
    const cached = readJson<SeToday>(CACHE_PREFIX + owner);
    if (cached) setToday(cached);
    void (async () => {
      if (accountId) await uploadLegacyMarks(owner);
      await load();
    })();
  }, [owner, accountId, load]);

  const apply = useCallback(
    (change: SeCardMarkChange | null) => {
      if (!change || !accountId) return;
      setToday((current) => {
        if (!current) return current;
        const next = seMarkCardInToday(current, change);
        writeJson(CACHE_PREFIX + owner, next);
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

  // Save for later: drawn at once, stored by POST /api/today/saves. A change that was not stored is
  // read back as it is on the server, with the reason shown.
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const save = useCallback(
    (card: SeTodayCard) => {
      const change = seSaveChangeFor(card);
      setSaveNote(null);
      setToday((current) => (current ? seSaveCardInToday(current, change) : current));
      void postSave(change).then((failure) => {
        if (!failure) return;
        setSaveNote(failure);
        void load();
      });
    },
    [load],
  );

  return { today, loading, error, marks: seMarksFromToday(today), mark, toggle, save, saveNote, reload: load };
}
