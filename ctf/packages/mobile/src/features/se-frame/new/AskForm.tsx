// + New → Ask on Android, the copy of the web (web components/se-frame/new/ask-form.tsx): posted as
// a public SocketRelay request with no place on it. Suggestions from the holiday list appear while
// typing.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_ASK_WORDS as W, seAskSuggestions, type SeThemeTokens } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { SE_FONT } from '../fonts';

const MAX_TITLE = 120;
const MAX_DETAILS = 5000;

function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function AskForm({ t }: { t: SeThemeTokens }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [tag, setTag] = useState(W.defaultTag);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await authedFetchJson('/api/socket-relay/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ title: title.trim(), details: details.trim(), tags: [tag], isPublic: true, idempotencyKey: randomKey() }),
      });
      setPosted(true);
      setTitle('');
      setDetails('');
      setTag(W.defaultTag);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : W.failed);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !title.trim() || !details.trim();
  return (
    <View style={s.form}>
      {posted ? <Text style={s.done}>{W.posted}</Text> : null}
      <Text style={s.label}>{W.what}</Text>
      <TextInput accessibilityLabel={W.what} style={s.input} value={title} maxLength={MAX_TITLE} onChangeText={setTitle} />
      <View style={s.chips} accessibilityLabel={W.suggestions}>
        {seAskSuggestions(title).map((item) => (
          <TouchableOpacity
            key={item.text}
            accessibilityRole="button"
            onPress={() => {
              setTitle(item.text);
              setTag(item.group);
            }}
            style={s.chip}
          >
            <Text style={s.chipLabel}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>{W.details}</Text>
      <TextInput accessibilityLabel={W.details} style={[s.input, s.multiline]} value={details} maxLength={MAX_DETAILS} onChangeText={setDetails} multiline />
      <Text style={s.text}>{W.hint}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => void submit()}
        style={[s.submit, disabled ? s.disabled : null]}
      >
        <Text style={s.submitLabel}>{busy ? W.submitting : W.submit}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    form: { gap: 8, alignSelf: 'stretch' },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    input: {
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.bg,
      color: t.ink,
      fontSize: 16,
      fontFamily: SE_FONT.sans,
    },
    multiline: { minHeight: 88, textAlignVertical: 'top' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 40, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.bg },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sans },
    error: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    done: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.hair, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    submit: {
      minHeight: 46,
      marginTop: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.btn,
      boxShadow: `0px 3px 0px ${t.line}`,
    },
    submitLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    disabled: { opacity: 0.6 },
  });
}
