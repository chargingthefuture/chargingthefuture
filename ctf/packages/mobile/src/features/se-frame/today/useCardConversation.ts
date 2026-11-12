// The conversation behind a card's sheet, the Android copy of the web's use-card-conversation.ts:
// read once on open, and replaced by what every write answers with. A write refused for Unlock
// (unlock_required, or unlock_paused after day 14) turns the sheet read-only with the line that says why.

import { useCallback, useEffect, useState } from 'react';
import { seCardLockLine, type SeCardAnswerKind, type SeCardConversation } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';

const CSRF = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

type Reply = { conversation?: SeCardConversation; message?: string; reason?: string };

export type CardConversation = {
  // The card this conversation is under, so the composer can say where a comment also appears.
  cardId: string;
  conversation: SeCardConversation | null;
  locked: boolean;
  // Why writing is closed: not approved (cards closed before Unlock), or paused after day 14.
  lockLine: string;
  note: string | null;
  busy: boolean;
  answer: (_kind: SeCardAnswerKind) => Promise<void>;
  // The card's author confirms that a member's "This helped me" is true.
  confirm: (_accountId: string) => Promise<void>;
  write: (_body: string, _partnerId: string | null) => Promise<boolean>;
  ask: (_partnerId: string) => Promise<boolean>;
  agree: (_partnerId: string) => Promise<void>;
  report: (_target: { messageId: string } | { authorId: string }) => Promise<boolean>;
  // The member's own message: change its text, or remove it for everyone.
  edit: (_messageId: string, _body: string) => Promise<boolean>;
  remove: (_messageId: string) => Promise<boolean>;
};

type Method = 'POST' | 'PATCH' | 'DELETE';

function requestInit(body: unknown, method: Method | undefined): RequestInit {
  if (method === 'DELETE') return { method, headers: CSRF };
  if (body === undefined) return {};
  return { method: method ?? 'POST', headers: CSRF, body: JSON.stringify(body) };
}

export function cardPath(cardId: string, rest = ''): string {
  return `/api/today/cards/${encodeURIComponent(cardId)}${rest}`;
}

async function call(path: string, body: unknown, op: string, method?: Method): Promise<{ ok: boolean; data: Reply | null }> {
  const init = requestInit(body, method);
  try {
    const res = await authedFetch(path, init);
    const data = (await res.json().catch(() => null)) as Reply | null;
    if (!res.ok && !seCardLockLine(data?.reason)) {
      reportError(new Error(data?.message ?? `Card request failed: ${res.status}`), { area: 'today-cards', op, extra: { status: res.status } });
    }
    return { ok: res.ok, data };
  } catch (error) {
    reportError(error, { area: 'today-cards', op });
    return { ok: false, data: null };
  }
}

export function useCardConversation(cardId: string, firstAnswer: SeCardAnswerKind | null): CardConversation {
  const [conversation, setConversation] = useState<SeCardConversation | null>(null);
  const [lockLine, setLockLine] = useState<string | null>(null);
  const locked = lockLine !== null;
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (rest: string, body: unknown, failed: string, method?: Method, op?: string): Promise<boolean> => {
      setBusy(true);
      const result = await call(cardPath(cardId, rest), body, op ?? (rest || 'read'), method);
      setBusy(false);
      const lock = seCardLockLine(result.data?.reason);
      if (lock) return (setLockLine(lock), false);
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
    cardId,
    conversation,
    locked,
    lockLine: lockLine ?? '',
    note,
    busy,
    answer: async (kind) => void (await run('/answers', { kind }, 'The answer was not saved: the app could not be reached.')),
    confirm: async (accountId) =>
      void (await run('/answers/confirm', { accountId }, 'The confirmation was not saved: the app could not be reached.', undefined, 'confirm-helped')),
    write: (body, partnerId) =>
      run('/messages', partnerId ? { body, private: true, partnerId } : { body, private: false }, 'The message was not sent: the app could not be reached.'),
    ask: (partnerId) => run('/pair', { partnerId }, 'The request was not sent: the app could not be reached.'),
    agree: async (partnerId) => void (await run('/pair/agree', { partnerId }, 'The agreement was not saved: the app could not be reached.')),
    report: (target) => run('/report', target, 'The report was not sent: the app could not be reached.'),
    edit: (messageId, body) =>
      run(`/messages/${encodeURIComponent(messageId)}`, { body }, 'The change was not saved: the app could not be reached.', 'PATCH', 'edit-message'),
    remove: (messageId) =>
      run(`/messages/${encodeURIComponent(messageId)}`, undefined, 'The message was not deleted: the app could not be reached.', 'DELETE', 'delete-message'),
  };
}
