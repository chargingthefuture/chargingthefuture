// + New → Talk on Android, the copy of the web (web components/se-frame/new/talk-form.tsx): book an
// empty 90 minutes on TI Radio, held in the Chyme Main Room, through the same routes the TI Radio
// guide uses. A phone has no drop-down, so the open times are a list to tap.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_TALK_WORDS as W, seSlotDay, seSlotLabel, seTalkBooked, type SeThemeTokens } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { openTodayLink } from '../today/openTodayLink';
import type { FeatureKey } from '../../../navigation/screens';
import { SE_FONT } from '../fonts';

// The same limits the web form and the route hold (lib/ti-radio/constants.ts).
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 500;
const SHOWN_SLOTS = 12;

type GuideSlot = { slotStartIso: string; slotEndIso: string; state: 'open' | 'booked'; isOnAir: boolean };
type Guide = { slots: GuideSlot[]; viewer: { canHost: boolean } };
type GuideState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; guide: Guide };

function useGuide() {
  const [state, setState] = useState<GuideState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const payload = await authedFetchJson<{ guide: Guide }>('/api/ti-radio/guide');
      setState({ kind: 'ready', guide: payload.guide });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not read the TI Radio schedule.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

export function TalkForm({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { state, reload } = useGuide();
  if (state.kind === 'loading') return <Text style={s.text}>{W.loading}</Text>;
  if (state.kind === 'error') {
    return (
      <Text accessibilityRole="alert" style={s.error}>
        {state.message}{' '}
        <Text accessibilityRole="button" onPress={() => void reload()} style={s.link}>
          {W.tryAgain}
        </Text>
      </Text>
    );
  }
  if (!state.guide.viewer.canHost) {
    return (
      <Text style={s.text}>
        {W.needsUnlock}{' '}
        <Text accessibilityRole="link" onPress={() => openTodayLink('/plugin/unlock', onOpen)} style={s.link}>
          {W.finishUnlock}
        </Text>
      </Text>
    );
  }
  return <TalkFields s={s} guide={state.guide} reload={reload} />;
}

type Styles = ReturnType<typeof makeStyles>;

function TalkFields({ s, guide, reload }: { s: Styles; guide: Guide; reload: () => Promise<void> }) {
  const [slot, setSlot] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  const open = guide.slots.filter((item) => item.state === 'open' && !item.isOnAir).slice(0, SHOWN_SLOTS);
  if (open.length === 0 && !booked) return <Text style={s.text}>{W.noOpen}</Text>;

  async function submit() {
    if (!slot || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await authedFetchJson('/api/ti-radio/slots', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ slotStart: slot, title: title.trim(), description: description.trim() }),
      });
      setBooked(slot);
      setSlot('');
      setTitle('');
      setDescription('');
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not book the talk.');
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !slot || !title.trim();
  return (
    <View style={s.form}>
      {booked ? <Text style={s.done}>{seTalkBooked(seSlotDay(booked))}</Text> : null}
      <Text style={s.label}>{W.when}</Text>
      <View style={s.slots}>
        {open.map((item) => {
          const picked = item.slotStartIso === slot;
          return (
            <TouchableOpacity
              key={item.slotStartIso}
              accessibilityRole="radio"
              accessibilityState={{ checked: picked }}
              onPress={() => setSlot(item.slotStartIso)}
              style={[s.slot, picked ? s.slotPicked : null]}
            >
              <Text style={[s.slotLabel, picked ? s.slotLabelPicked : null]}>{seSlotLabel(item.slotStartIso, item.slotEndIso)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.label}>{W.about}</Text>
      <TextInput accessibilityLabel={W.about} style={s.input} value={title} maxLength={MAX_TITLE} onChangeText={setTitle} />
      <Text style={s.label}>{W.detail}</Text>
      <TextInput
        accessibilityLabel={W.detail}
        style={[s.input, s.multiline]}
        value={description}
        maxLength={MAX_DESCRIPTION}
        onChangeText={setDescription}
        multiline
      />
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
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    slots: { gap: 6 },
    slot: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg },
    slotPicked: { backgroundColor: t.btn },
    slotLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sans },
    slotLabelPicked: { color: t.onBtn, fontFamily: SE_FONT.sansBold },
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
