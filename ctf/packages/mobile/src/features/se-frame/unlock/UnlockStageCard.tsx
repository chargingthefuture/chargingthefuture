// Where the member stands on Android, the copy of the web's unlock/unlock-stage-card.tsx. While
// nothing is sent, the card is the Unlock banner's own (boards "Unlock banner, day 9 of 14" and
// "After the Unlock deadline"); after that it says waiting, approved, or needs another look.

import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_UNLOCK_SCREEN_WORDS as W, SE_UNLOCK_WORDS, type SeThemeTokens, type SeUnlockStage, type SeUnlockStanding } from '@ctf/shared';
import type { UnlockStyles } from './unlockStyles';
import { seUnlockPost } from './useUnlockScreen';

type Props = {
  s: UnlockStyles;
  t: SeThemeTokens;
  stage: SeUnlockStage;
  standing: SeUnlockStanding | null;
  helpAsked: boolean;
  onSent: () => void;
  onToday: () => void;
};

export function UnlockStageCard({ s, t, stage, standing, helpAsked, onSent, onToday }: Props) {
  if (stage === 'send') return <SendCard s={s} t={t} standing={standing} helpAsked={helpAsked} onSent={onSent} />;
  if (stage === 'waiting') {
    return (
      <View style={s.card} accessibilityLabel={W.waitingTitle}>
        <Text accessibilityRole="header" style={s.cardTitle}>
          {W.waitingTitle}
        </Text>
        <Text style={s.text}>{W.waitingText}</Text>
      </View>
    );
  }
  if (stage === 'approved') {
    return (
      <View style={s.card} accessibilityLabel={W.approvedTitle}>
        <Text accessibilityRole="header" style={s.cardTitle}>
          {W.approvedTitle}
        </Text>
        <Text style={s.text}>{W.approvedText}</Text>
        <Text style={s.note}>{W.approvedCredits}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onToday} style={s.primary}>
          <Text style={s.addLabel}>{W.backToToday}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={s.card} accessibilityLabel={W.anotherLookTitle}>
      <Text accessibilityRole="header" style={s.cardTitle}>
        {W.anotherLookTitle}
      </Text>
      <Text style={s.text}>{W.anotherLookText}</Text>
      <AddressForm s={s} t={t} label={W.resend} pick={false} onSent={onSent} />
    </View>
  );
}

type SendProps = { s: UnlockStyles; t: SeThemeTokens; standing: SeUnlockStanding | null; helpAsked: boolean; onSent: () => void };

function SendCard({ s, t, standing, helpAsked, onSent }: SendProps) {
  const pick = !(standing?.paused ?? false);
  const title = standing?.form ? standing.title : W.sendTitle;
  const ink = pick ? s.onPick : null;
  return (
    <View style={pick ? s.pickCard : s.card} accessibilityLabel={title}>
      {standing?.dayLabel ? (
        <View style={s.dayRow}>
          <Text style={s.day}>{standing.dayLabel.toUpperCase()}</Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.round(standing.progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[s.cardTitle, ink]}>
        {title}
      </Text>
      {standing?.form ? <Text style={[s.text, ink]}>{standing.text}</Text> : null}
      {helpAsked ? <Text style={[s.text, ink]}>{W.helpAsked}</Text> : null}
      <AddressForm s={s} t={t} label={W.label} pick={pick} onSent={onSent} />
      <Text style={[s.small, ink]}>{W.publicNote}</Text>
    </View>
  );
}

type FormProps = { s: UnlockStyles; t: SeThemeTokens; label: string; pick: boolean; onSent: () => void };

function AddressForm({ s, t, label, pick, onSent }: FormProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value.trim() || busy) return;
    setBusy(true);
    const failed = await seUnlockPost('/api/unlock/submission', { quoraProfileUrl: value.trim() }, W.sendFailed);
    setBusy(false);
    setError(failed);
    if (!failed) onSent();
  }

  const ink = pick ? s.onPick : null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={[s.label, ink]}>{label}</Text>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={label}
          style={[s.input, pick ? s.pickInput : null]}
          placeholder={SE_UNLOCK_WORDS.placeholder}
          placeholderTextColor={pick ? t.onPick : t.soft}
          value={value}
          onChangeText={setValue}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void submit()}
        />
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void submit()}
          disabled={busy || !value.trim()}
          style={[s.add, pick ? s.pickAdd : null, busy || !value.trim() ? s.busy : null]}
        >
          <Text style={[s.addLabel, pick ? s.pickAddLabel : null]}>{busy ? W.sending : W.send}</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[s.error, ink]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
