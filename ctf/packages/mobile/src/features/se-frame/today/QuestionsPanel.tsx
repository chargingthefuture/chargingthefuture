// The controls inside a 21 Questions card on Today, the Android copy of the web's
// questions-panel.tsx: the answers to pick from on the question card, and the conversation inside a
// match card. Nothing opens elsewhere; the talk stays in the card.

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_MATCH_MESSAGE_MAX, seAgo, seQuestionById, type SeMatchMessage, type SeThemeTokens, type SeTodayCard } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { SE_FONT } from '../fonts';

const CSRF = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

type Styles = ReturnType<typeof makeStyles>;

async function send(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null }> {
  const res = await authedFetch(path, { method: 'POST', headers: CSRF, body: JSON.stringify(body) }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: Boolean(res?.ok), data };
}

function messageOf(data: Record<string, unknown> | null, fallback: string): string {
  return typeof data?.message === 'string' ? data.message : fallback;
}

function QuestionChoices({ s, card, onChanged }: { s: Styles; card: SeTodayCard; onChanged: () => void }) {
  const question = seQuestionById(card.id.slice('questions:'.length));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!question) return null;
  const pick = async (choice: number) => {
    setBusy(true);
    const result = await send('/api/today/questions/answers', { questionId: question.id, choice });
    setBusy(false);
    if (!result.ok) return setNote(messageOf(result.data, 'The answer was not saved: the app could not be reached.'));
    setNote(`Saved: ${question.choices[choice]}.`);
    onChanged();
  };
  return (
    <View style={s.list}>
      {question.choices.map((choice, index) => (
        <TouchableOpacity
          key={choice}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          style={[s.choice, busy ? s.dim : null]}
          onPress={() => void pick(index)}
        >
          <Text style={s.choiceLabel}>{choice}</Text>
        </TouchableOpacity>
      ))}
      {note ? (
        <Text accessibilityLiveRegion="polite" style={s.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function useConversation(accountId: string) {
  const [messages, setMessages] = useState<SeMatchMessage[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const path = `/api/today/questions/matches/${encodeURIComponent(accountId)}/messages`;
  const load = useCallback(async () => {
    const res = await authedFetch(path).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { messages?: SeMatchMessage[]; message?: string } | null;
    if (!res?.ok || !data?.messages) return setNote(data?.message ?? 'The conversation could not be loaded: the app could not be reached.');
    setNote(null);
    setMessages(data.messages);
  }, [path]);
  useEffect(() => void load(), [load]);
  const post = async (body: string): Promise<boolean> => {
    const result = await send(path, { body });
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

function handleOf(card: SeTodayCard): string {
  return card.author?.handle ?? '';
}

function Bubble({ s, message, handle }: { s: Styles; message: SeMatchMessage; handle: string | undefined }) {
  const mine = message.mine ? s.onMine : null;
  return (
    <View style={[s.bubble, message.mine ? s.bubbleMine : null]}>
      <Text style={[s.bubbleText, mine]}>{message.body}</Text>
      <Text style={[s.bubbleWhen, mine]}>
        {message.mine ? 'You' : handle} · {seAgo(message.createdAtIso)}
      </Text>
    </View>
  );
}

function Conversation({ s, t, card }: { s: Styles; t: SeThemeTokens; card: SeTodayCard }) {
  const accountId = card.id.slice('questions-match:'.length);
  const { messages, note, post } = useConversation(accountId);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = busy || !draft.trim();
  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    if (await post(draft.trim())) setDraft('');
    setBusy(false);
  };
  return (
    <View style={s.list}>
      {messages === null && !note ? <Text style={s.note}>Loading the conversation…</Text> : null}
      {messages?.length === 0 ? <Text style={s.note}>No messages yet. Say what made you pick what you picked.</Text> : null}
      {messages?.map((message) => <Bubble key={message.id} s={s} message={message} handle={card.author?.handle} />)}
      {note ? (
        <Text accessibilityRole="alert" style={s.note}>
          {note}
        </Text>
      ) : null}
      <View style={s.form}>
        <TextInput
          accessibilityLabel={`Message ${handleOf(card)}`}
          style={s.input}
          value={draft}
          maxLength={SE_MATCH_MESSAGE_MAX}
          placeholder="Write a message"
          placeholderTextColor={t.soft}
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          style={[s.send, blocked ? s.dim : null]}
          onPress={() => void submit()}
        >
          <Text style={s.sendLabel}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function isQuestionsCard(card: SeTodayCard): boolean {
  return card.source === 'questions' || card.source === 'questions-match';
}

type PanelProps = { t: SeThemeTokens; card: SeTodayCard; open: boolean; onOpen: () => void; onChanged: () => void };

// The question card shows its answers at once; a match card shows the conversation once opened.
export function QuestionsPanel({ t, card, open, onOpen, onChanged }: PanelProps) {
  const s = makeStyles(t);
  if (card.source === 'questions') return card.done ? null : <QuestionChoices s={s} card={card} onChanged={onChanged} />;
  if (open) return <Conversation s={s} t={t} card={card} />;
  return (
    <TouchableOpacity accessibilityRole="button" style={s.send} onPress={onOpen}>
      <Text style={s.sendLabel}>Talk here</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    list: { gap: 8 },
    choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.sunk },
    choiceLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sans },
    dim: { opacity: 0.6 },
    note: { fontSize: 13, lineHeight: 18, color: t.soft, fontFamily: SE_FONT.sans },
    bubble: { alignSelf: 'flex-start', maxWidth: '85%', gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: t.sunk },
    bubbleMine: { alignSelf: 'flex-end', backgroundColor: t.kind.match },
    bubbleText: { fontSize: 15, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans },
    bubbleWhen: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    onMine: { color: t.bg },
    form: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card, color: t.ink, fontSize: 15, fontFamily: SE_FONT.sans },
    send: {
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    sendLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
  });
}
