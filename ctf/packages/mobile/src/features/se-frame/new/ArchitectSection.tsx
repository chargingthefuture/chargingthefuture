// + New → Ask the architect on Android, the copy of the web (web components/se-frame/new/
// architect-section.tsx and use-architect.ts): the 3.1 home of the 3.0 chat's @comic assistant.
// The member asks here and sees their questions below, each marked being checked until a person
// approves the answer.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_ARCHITECT_MAX_QUESTION, SE_ARCHITECT_WORDS as W, seAgo, seArchitectMessage, type SeArchitectItem, type SeThemeTokens } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';

type Styles = ReturnType<typeof makeStyles>;
type Rating = 'helpful' | 'not_helpful';

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

async function messageOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? `${fallback} ${body.message}` : `${fallback} (HTTP ${res.status})`;
}

function useArchitect() {
  const [items, setItems] = useState<SeArchitectItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await authedFetch('/api/comic/conversation?limit=20').catch(() => null);
    if (!res) return setLoadError(`${W.loadFailed} The app could not be reached.`);
    if (!res.ok) return setLoadError(await messageOf(res, W.loadFailed));
    const body = (await res.json().catch(() => null)) as { items?: SeArchitectItem[] } | null;
    setLoadError(null);
    setItems(body?.items ?? []);
  }, []);
  useEffect(() => void load(), [load]);
  const ask = async (question: string): Promise<string | null> => {
    const res = await authedFetch('/api/comic/message', {
      method: 'POST',
      headers: CSRF,
      body: JSON.stringify({ body: seArchitectMessage(question), channel: 'commons', consentGranted: true }),
    }).catch(() => null);
    if (!res) return `${W.failed} The app could not be reached.`;
    if (!res.ok) return messageOf(res, W.failed);
    await load();
    return null;
  };
  const rate = async (turnId: string, rating: Rating): Promise<string | null> => {
    const res = await authedFetch(`/api/comic/answers/${encodeURIComponent(turnId)}/rate`, {
      method: 'POST',
      headers: CSRF,
      body: JSON.stringify({ rating }),
    }).catch(() => null);
    if (!res) return `${W.rateFailed} The app could not be reached.`;
    if (!res.ok) return messageOf(res, W.rateFailed);
    setItems((current) => current?.map((item) => (item.answerTurnId === turnId ? { ...item, currentUserRating: rating } : item)) ?? null);
    return null;
  };
  return { items, loadError, ask, rate };
}

function RatingRow({ s, item, onRate }: { s: Styles; item: SeArchitectItem; onRate: (_rating: Rating) => Promise<string | null> }) {
  const [note, setNote] = useState<string | null>(null);
  if (!item.answerTurnId) return null;
  const press = async (rating: Rating) => setNote((await onRate(rating)) ?? W.rated);
  return (
    <View style={s.chips}>
      {(['helpful', 'not_helpful'] as const).map((rating) => (
        <TouchableOpacity
          key={rating}
          accessibilityRole="button"
          accessibilityState={{ selected: item.currentUserRating === rating }}
          style={s.chip}
          onPress={() => void press(rating)}
        >
          <Text style={s.chipLabel}>{rating === 'helpful' ? W.helpful : W.notHelpful}</Text>
        </TouchableOpacity>
      ))}
      {note ? <Text style={s.text}>{note}</Text> : null}
    </View>
  );
}

type ItemProps = { s: Styles; item: SeArchitectItem; onRate: (_turnId: string, _rating: Rating) => Promise<string | null>; go: (_href: string) => void };

function Item({ s, item, onRate, go }: ItemProps) {
  return (
    <View style={s.item}>
      <Text style={s.question}>{item.question}</Text>
      <Text style={s.text}>
        {item.status === 'pending' ? W.pending : item.answer} · {seAgo(item.askedAtIso)}
      </Text>
      {item.linkedPlugins.length > 0 ? (
        <View style={s.chips}>
          {item.linkedPlugins.map((plugin) => (
            <TouchableOpacity key={plugin.slug} accessibilityRole="link" style={s.chip} onPress={() => go(`/apps/${plugin.slug}`)}>
              <Text style={s.chipLabel}>{plugin.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {item.status === 'answered' ? <RatingRow s={s} item={item} onRate={(rating) => onRate(item.answerTurnId as string, rating)} /> : null}
    </View>
  );
}

export function ArchitectSection({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { items, loadError, ask, rate } = useArchitect();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const go = (href: string) => openTodayLink(href, onOpen);
  const blocked = busy || !question.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    const failure = await ask(question);
    setBusy(false);
    if (failure) return setError(failure);
    setSent(true);
    setQuestion('');
  }

  return (
    <View style={s.form}>
      {sent ? <Text style={s.done}>{W.sent}</Text> : null}
      <Text style={s.label}>{W.question}</Text>
      <TextInput
        accessibilityLabel={W.question}
        style={[s.input, s.multiline]}
        multiline
        value={question}
        maxLength={SE_ARCHITECT_MAX_QUESTION}
        onChangeText={setQuestion}
      />
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: blocked }} disabled={blocked} style={[s.submit, blocked ? s.disabled : null]} onPress={() => void submit()}>
        <Text style={s.submitLabel}>{busy ? W.submitting : W.submit}</Text>
      </TouchableOpacity>
      {loadError ? <Text accessibilityRole="alert" style={s.error}>{loadError}</Text> : null}
      {items === null && !loadError ? <Text style={s.text}>{W.loading}</Text> : null}
      {items?.map((item) => <Item key={item.questionTurnId} s={s} item={item} onRate={rate} go={go} />)}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    form: { gap: 8, alignSelf: 'stretch' },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    input: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg, color: t.ink, fontSize: 16, fontFamily: SE_FONT.sans },
    multiline: { minHeight: 88, textAlignVertical: 'top' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 40, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.bg },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sans },
    error: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    done: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.hair, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    submit: { minHeight: 46, marginTop: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    submitLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    disabled: { opacity: 0.6 },
    item: { gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg },
    question: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
