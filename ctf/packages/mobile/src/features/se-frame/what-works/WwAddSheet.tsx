// What Works, add a problem, the Android copy of the web's ww-add-sheet.tsx (the approved 3.1 board
// "What works: add a problem"): the member types the problem, sees the problems already on the list
// that share words with it, and either uses one or adds theirs, which waits for review. Opened from
// the What works card on Today.

import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_WW_ADD_WORDS as W, seWwAddsFrom, seWwHelpedCount, seWwSuggestHref, type SeThemeTokens } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { useWwSimilar, WW_MIN_QUERY, type WwMatchState } from './useWwSimilar';
import { makeWwAddSheetStyles, type WwAddSheetStyles } from './wwAddSheetStyles';

export type WwAddedProblem = { id: string; title: string };

type Props = {
  t: SeThemeTokens;
  onClose: () => void;
  onUse: (_problemId: string) => void;
  onAddWhatHelped: (_problem: WwAddedProblem) => void;
};

type Reply = { problemId?: string; message?: string };

async function sendProblem(title: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const res = await authedFetch('/api/what-works/problems', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify({ title }) });
    const body = (await res.json().catch(() => null)) as Reply | null;
    if (!res.ok) return { ok: false, message: body?.message ?? `The problem could not be saved (HTTP ${res.status}).` };
    return body?.problemId ? { ok: true, id: body.problemId } : { ok: false, message: 'The problem was saved but the answer named no problem. Reload the list.' };
  } catch (error) {
    return { ok: false, message: `The problem could not be saved: ${error instanceof Error ? error.message : 'the connection failed'}.` };
  }
}

function Matches({ s, state, onUse }: { s: WwAddSheetStyles; state: WwMatchState; onUse: (_id: string) => void }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'loading') return <Text style={s.note}>{W.searching}</Text>;
  if (state.kind === 'error') return <Text accessibilityLiveRegion="polite" style={s.error}>{W.matchesFailed(state.reason)}</Text>;
  if (state.matches.length === 0) return <Text style={s.note}>{W.noMatches}</Text>;
  return (
    <View style={s.matches}>
      <Text style={s.label}>{W.matchesLabel}</Text>
      {state.matches.map((m) => (
        <TouchableOpacity key={m.id} accessibilityRole="button" style={s.match} onPress={() => onUse(m.id)}>
          <View style={s.matchText}>
            <Text style={s.matchTitle}>{m.title}</Text>
            <Text style={s.matchCount}>{seWwHelpedCount(m.helpedCount)}</Text>
          </View>
          <Text style={s.use}>{W.useThis}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Sent({ s, problem, onAddWhatHelped, onClose }: { s: WwAddSheetStyles; problem: WwAddedProblem; onAddWhatHelped: Props['onAddWhatHelped']; onClose: () => void }) {
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {W.sentTitle}
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.rule}>
        {W.sent}
      </Text>
      <View style={s.spacer} />
      <TouchableOpacity accessibilityRole="button" style={s.primary} onPress={() => onAddWhatHelped(problem)}>
        <Text style={s.primaryLabel}>{W.addWhatHelped}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={s.add} onPress={onClose}>
        <Text style={s.addLabel}>{W.done}</Text>
      </TouchableOpacity>
    </>
  );
}

function addLabel(sending: boolean, matches: WwMatchState): string {
  if (sending) return W.sending;
  return matches.kind === 'ready' && matches.matches.length > 0 ? W.addIt : W.addItEmpty;
}

function AddForm({ s, t, onUse, onSent }: { s: WwAddSheetStyles; t: SeThemeTokens; onUse: (_id: string) => void; onSent: (_p: WwAddedProblem) => void }) {
  const [title, setTitle] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = useWwSimilar(title);
  const add = async () => {
    const clean = title.trim();
    if (clean.length < WW_MIN_QUERY) return setError(W.tooShort);
    setSending(true);
    setError(null);
    const result = await sendProblem(clean);
    setSending(false);
    if ('message' in result) return setError(result.message);
    onSent({ id: result.id, title: clean });
  };
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {W.title}
      </Text>
      <Text style={s.rule}>{W.rule}</Text>
      <View style={s.field}>
        <Text style={s.label}>{W.label}</Text>
        <TextInput accessibilityLabel={W.label} style={s.input} value={title} maxLength={120} autoCorrect={false} placeholderTextColor={t.soft} onChangeText={setTitle} />
      </View>
      <Matches s={s} state={matches} onUse={onUse} />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      ) : null}
      <View style={s.spacer} />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: sending }} disabled={sending} style={[s.add, sending ? s.dim : null]} onPress={() => void add()}>
        <Text style={s.addLabel}>{addLabel(sending, matches)}</Text>
      </TouchableOpacity>
    </>
  );
}

export function WwAddSheet({ t, onClose, onUse, onAddWhatHelped }: Props) {
  const s = makeWwAddSheetStyles(t);
  const [sent, setSent] = useState<WwAddedProblem | null>(null);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={{ height: 48 }} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={W.title}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={s.top}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} style={s.close} onPress={onClose}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
                </Svg>
              </TouchableOpacity>
              <Text style={s.eyebrow}>{W.eyebrow}</Text>
            </View>
            {sent ? <Sent s={s} problem={sent} onAddWhatHelped={onAddWhatHelped} onClose={onClose} /> : <AddForm s={s} t={t} onUse={onUse} onSent={setSent} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// "Add a problem" on the What works card opened in place on Today, under the "Open in" link. Use
// this and Add what helped open the What Works page with its suggest form on that problem.
type FromCardProps = { t: SeThemeTokens; source: string; linkStyle: StyleProp<ViewStyle>; labelStyle: StyleProp<TextStyle>; onOpenLink: (_href: string) => void };

export function WwAddFromCard({ t, source, linkStyle, labelStyle, onOpenLink }: FromCardProps) {
  const [open, setOpen] = useState(false);
  if (!seWwAddsFrom(source)) return null;
  const go = (href: string) => {
    setOpen(false);
    onOpenLink(href);
  };
  return (
    <>
      <TouchableOpacity accessibilityRole="button" style={linkStyle} onPress={() => setOpen(true)}>
        <Text style={labelStyle}>{W.title}</Text>
      </TouchableOpacity>
      {open ? <WwAddSheet t={t} onClose={() => setOpen(false)} onUse={(id) => go(seWwSuggestHref(id))} onAddWhatHelped={(p) => go(seWwSuggestHref(p.id, p.title))} /> : null}
    </>
  );
}
