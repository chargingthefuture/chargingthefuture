'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_MATCH_MESSAGE_MAX, seAgo, seLocalDay, seQuestionById, type SeMatchMessage, type SeTodayCard } from '@ctf/shared';
import styles from './today.module.css';

// The controls inside a 21 Questions card on Today: the answers to pick from on the question card,
// and the conversation on a match card. Nothing opens elsewhere; the talk stays in the card.

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

async function send(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null }> {
  const res = await fetch(url, { method: 'POST', headers: CSRF, body: JSON.stringify(body) }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: Boolean(res?.ok), data };
}

function messageOf(data: Record<string, unknown> | null, fallback: string): string {
  return typeof data?.message === 'string' ? data.message : fallback;
}

function QuestionChoices({ card, onChanged }: { card: SeTodayCard; onChanged: () => void }) {
  const question = seQuestionById(card.id.slice('questions:'.length));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!question) return null;
  const pick = async (choice: number) => {
    setBusy(true);
    const result = await send('/api/today/questions/answers', { questionId: question.id, choice, day: seLocalDay() });
    setBusy(false);
    if (!result.ok) return setNote(messageOf(result.data, 'The answer was not saved: the app could not be reached.'));
    setNote(`Saved: ${question.choices[choice]}.`);
    onChanged();
  };
  return (
    <div className={styles.choiceList}>
      {question.choices.map((choice, index) => (
        <button key={choice} type="button" className={styles.choiceButton} disabled={busy} onClick={() => void pick(index)}>
          {choice}
        </button>
      ))}
      {note ? (
        <p role="status" className={styles.noticeQuiet}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

function useConversation(accountId: string) {
  const [messages, setMessages] = useState<SeMatchMessage[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const url = `/api/today/questions/matches/${encodeURIComponent(accountId)}/messages`;
  const load = useCallback(async () => {
    const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { messages?: SeMatchMessage[]; message?: string } | null;
    if (!res?.ok || !data?.messages) return setNote(data?.message ?? 'The conversation could not be loaded: the app could not be reached.');
    setNote(null);
    setMessages(data.messages);
  }, [url]);
  useEffect(() => void load(), [load]);
  const post = async (body: string): Promise<boolean> => {
    const result = await send(url, { body });
    if (!result.ok) {
      setNote(messageOf(result.data, 'The message was not sent: the app could not be reached.'));
      return false;
    }
    setNote(null);
    setMessages((current) => [...(current ?? []), result.data?.message as SeMatchMessage]);
    return true;
  };
  return { messages, note, post };
}

function Conversation({ card }: { card: SeTodayCard }) {
  const accountId = card.id.slice('questions-match:'.length);
  const { messages, note, post } = useConversation(accountId);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    if (await post(draft.trim())) setDraft('');
    setBusy(false);
  };
  return (
    <div className={styles.talk}>
      {messages === null && !note ? <p className={styles.noticeQuiet}>Loading the conversation…</p> : null}
      {messages?.length === 0 ? <p className={styles.noticeQuiet}>No messages yet. Say what made you pick what you picked.</p> : null}
      {messages?.map((message) => (
        <p key={message.id} className={message.mine ? `${styles.bubble} ${styles.bubbleMine}` : styles.bubble}>
          {message.body}
          <span className={styles.bubbleWhen}>{message.mine ? 'You' : card.author?.handle} · {seAgo(message.createdAtIso)}</span>
        </p>
      ))}
      {note ? (
        <p role="alert" className={styles.noticeQuiet}>
          {note}
        </p>
      ) : null}
      <form className={styles.talkForm} onSubmit={(event) => void submit(event)}>
        <label className={styles.srOnly} htmlFor={`talk-${accountId}`}>
          Message {card.author?.handle}
        </label>
        <input
          id={`talk-${accountId}`}
          className={styles.talkInput}
          value={draft}
          maxLength={SE_MATCH_MESSAGE_MAX}
          placeholder="Write a message"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.actionButton} disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export function isQuestionsCard(card: SeTodayCard): boolean {
  return card.source === 'questions' || card.source === 'questions-match';
}

// The question card shows its answers at once until one is picked (the card then says which); a match card shows the conversation once opened.
type PanelProps = { card: SeTodayCard; open: boolean; onOpen: () => void; onChanged: () => void };

export function QuestionsPanel({ card, open, onOpen, onChanged }: PanelProps) {
  if (card.source === 'questions') return card.done ? null : <QuestionChoices card={card} onChanged={onChanged} />;
  if (open) return <Conversation card={card} />;
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.actionButton} onClick={onOpen}>
        Talk here
      </button>
    </div>
  );
}
