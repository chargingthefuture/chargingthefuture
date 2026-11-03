'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SeCardAnswerKind, SeCardConversation } from '@ctf/shared';

// The conversation behind a card's sheet: read once on open, and replaced by what every write
// answers with. A member not approved yet is refused with reason unlock_required; the sheet then
// shows the card read-only.

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

type Reply = { conversation?: SeCardConversation; message?: string; reason?: string };

export type CardConversation = {
  conversation: SeCardConversation | null;
  locked: boolean;
  note: string | null;
  busy: boolean;
  answer: (kind: SeCardAnswerKind) => Promise<void>;
  write: (body: string, partnerId: string | null) => Promise<boolean>;
  ask: (partnerId: string) => Promise<boolean>;
  agree: (partnerId: string) => Promise<void>;
  report: (target: { messageId: string } | { authorId: string }) => Promise<boolean>;
};

export function cardPath(cardId: string, rest = ''): string {
  return `/api/today/cards/${encodeURIComponent(cardId)}${rest}`;
}

async function call(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Reply | null }> {
  const init: RequestInit = body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: CSRF, body: JSON.stringify(body) };
  const res = await fetch(path, init).catch(() => null);
  const data = (await res?.json().catch(() => null)) as Reply | null;
  return { ok: Boolean(res?.ok), status: res?.status ?? 0, data };
}

export function useCardConversation(cardId: string, firstAnswer: SeCardAnswerKind | null): CardConversation {
  const [conversation, setConversation] = useState<SeCardConversation | null>(null);
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (rest: string, body: unknown, failed: string): Promise<boolean> => {
      setBusy(true);
      const result = await call(cardPath(cardId, rest), body);
      setBusy(false);
      if (result.data?.reason === 'unlock_required') return (setLocked(true), false);
      if (!result.ok) return (setNote(result.data?.message ?? failed), false);
      setNote(null);
      if (result.data?.conversation) setConversation(result.data.conversation);
      return true;
    },
    [cardId],
  );

  useEffect(() => {
    void (async () => {
      if (firstAnswer && (await run('/answers', { kind: firstAnswer }, 'The answer was not saved: the app could not be reached.'))) return;
      await run('', undefined, 'The conversation could not be loaded: the app could not be reached.');
    })();
  }, [run, firstAnswer]);

  return {
    conversation,
    locked,
    note,
    busy,
    answer: async (kind) => void (await run('/answers', { kind }, 'The answer was not saved: the app could not be reached.')),
    write: (body, partnerId) =>
      run('/messages', partnerId ? { body, private: true, partnerId } : { body, private: false }, 'The message was not sent: the app could not be reached.'),
    ask: (partnerId) => run('/pair', { partnerId }, 'The request was not sent: the app could not be reached.'),
    agree: async (partnerId) => void (await run('/pair/agree', { partnerId }, 'The agreement was not saved: the app could not be reached.')),
    report: (target) => run('/report', target, 'The report was not sent: the app could not be reached.'),
  };
}
