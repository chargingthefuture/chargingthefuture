// "What helped", the Android copy of the web's ww-helped-sheet.tsx: after Use this or Add what helped
// in the sheet opened from the What works card on Today, the member names the product, its purchase
// link and why it works, and it goes to review through the route the 3.0 suggest form uses.

import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_WW_ADD_WORDS, SE_WW_HELPED_WORDS as W, seWwHelpedBody, seWwHelpedReady, type SeThemeTokens } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { makeWwAddSheetStyles, type WwAddSheetStyles } from './wwAddSheetStyles';

type Problem = { id: string; title: string };
type Draft = { name: string; purchaseUrl: string; note: string };

async function sendHelped(problemId: string, draft: Draft): Promise<string | null> {
  try {
    const res = await authedFetch('/api/what-works/products', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify(seWwHelpedBody({ problemId, ...draft })) });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return body?.message ?? W.failed;
  } catch {
    return W.failed;
  }
}

function HelpedForm({ s, t, problem, onSent }: { s: WwAddSheetStyles; t: SeThemeTokens; problem: Problem; onSent: () => void }) {
  const [draft, setDraft] = useState<Draft>({ name: '', purchaseUrl: '', note: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof Draft) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const disabled = sending || !seWwHelpedReady({ problemId: problem.id, ...draft });
  const send = async () => {
    setSending(true);
    const failure = await sendHelped(problem.id, draft);
    setSending(false);
    if (failure) return setError(failure);
    onSent();
  };
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {W.title}
      </Text>
      <Text style={s.rule}>{W.forProblem(problem.title)}</Text>
      <View style={s.field}>
        <Text style={s.label}>{W.name}</Text>
        <TextInput accessibilityLabel={W.name} style={s.input} value={draft.name} maxLength={120} placeholderTextColor={t.soft} onChangeText={set('name')} />
      </View>
      <View style={s.field}>
        <Text style={s.label}>{W.link}</Text>
        <TextInput accessibilityLabel={W.link} style={s.input} value={draft.purchaseUrl} maxLength={2048} keyboardType="url" autoCapitalize="none" placeholder="https://…" placeholderTextColor={t.soft} onChangeText={set('purchaseUrl')} />
      </View>
      <View style={s.field}>
        <Text style={s.label}>{W.note}</Text>
        <TextInput accessibilityLabel={W.note} style={s.textarea} value={draft.note} maxLength={400} multiline placeholderTextColor={t.soft} onChangeText={set('note')} />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      ) : null}
      <View style={s.spacer} />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[s.primary, disabled ? s.dim : null]} onPress={() => void send()}>
        <Text style={s.primaryLabel}>{sending ? W.sending : W.send}</Text>
      </TouchableOpacity>
    </>
  );
}

function HelpedSent({ s, onClose }: { s: WwAddSheetStyles; onClose: () => void }) {
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {W.sentTitle}
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.rule}>
        {W.sent}
      </Text>
      <View style={s.spacer} />
      <TouchableOpacity accessibilityRole="button" style={s.add} onPress={onClose}>
        <Text style={s.addLabel}>{W.done}</Text>
      </TouchableOpacity>
    </>
  );
}

export function WwHelpedSheet({ t, problem, onClose }: { t: SeThemeTokens; problem: Problem; onClose: () => void }) {
  const s = makeWwAddSheetStyles(t);
  const [sent, setSent] = useState(false);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={{ height: 48 }} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={W.title}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={s.top}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_WW_ADD_WORDS.close} style={s.close} onPress={onClose}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
                </Svg>
              </TouchableOpacity>
              <Text style={s.eyebrow}>{SE_WW_ADD_WORDS.eyebrow}</Text>
            </View>
            {sent ? <HelpedSent s={s} onClose={onClose} /> : <HelpedForm s={s} t={t} problem={problem} onSent={() => setSent(true)} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
