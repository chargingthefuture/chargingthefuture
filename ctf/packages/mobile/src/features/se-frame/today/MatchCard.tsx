// The Match card on Today on Android, the copy of the web (components/se-frame/today/match-card.tsx),
// built to the Match card on the approved Today board: "Match", a big number, "people fit what you
// need" and Get introduced, which opens People on "Fits what you need". Until the member has picked
// something it asks "What do you need today?" with the landing page's need chips, or takes a code
// saved on lagatos.com. Approved members only: for anybody else the card is not drawn.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SE_MATCH_NEEDS, SE_MATCH_WORDS as W, seMatchCode, type SeMatchChange, type SeMatchState, type SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';
import { useMatchCard } from './useMatchCard';

type Styles = ReturnType<typeof makeStyles>;
type Save = (_change: SeMatchChange) => Promise<string | null>;

function Button({ s, label, onPress, disabled, primary }: { s: Styles; label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={[primary ? s.primary : s.button, disabled ? s.disabled : null]}
    >
      <Text style={primary ? s.primaryLabel : s.buttonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function CodeForm({ t, s, busy, onSave }: { t: SeThemeTokens; s: Styles; busy: boolean; onSave: Save }) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const submit = async () => {
    const normal = seMatchCode(code);
    if (!normal) return setNote(W.badCode);
    setNote(await onSave({ kind: 'code', code: normal }));
  };
  return (
    <View style={s.codeForm}>
      <Text style={s.codeLabel}>{W.codeLabel}</Text>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={W.codeLabel}
          style={s.codeInput}
          value={code}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={W.codePlaceholder}
          placeholderTextColor={t.soft}
          onChangeText={setCode}
          onSubmitEditing={() => void submit()}
        />
        <Button s={s} label={W.useCode} disabled={busy || code.trim() === ''} onPress={() => void submit()} />
      </View>
      {note ? (
        <Text accessibilityRole="alert" style={s.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

type PickerProps = { t: SeThemeTokens; s: Styles; initial: string[]; onSave: Save; onCancel?: () => void };

function Picker({ t, s, initial, onSave, onCancel }: PickerProps) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const toggle = (key: string) => setPicked((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));
  const save: Save = async (change) => {
    setBusy(true);
    const failed = await onSave(change);
    setBusy(false);
    return failed;
  };
  return (
    <>
      <Text style={s.ask}>{W.ask}</Text>
      <View style={s.chips} accessibilityLabel={W.needsLabel}>
        {SE_MATCH_NEEDS.map((need) => {
          const on = picked.includes(need.key);
          return (
            <TouchableOpacity key={need.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => toggle(need.key)} style={[s.chip, on ? s.chipOn : null]}>
              <Text style={[s.chipLabel, on ? s.chipLabelOn : null]}>{need.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.row}>
        <Button s={s} primary label={busy ? W.saving : W.show} disabled={busy || picked.length === 0} onPress={() => void save({ kind: 'needs', needKeys: picked }).then(setNote)} />
        {onCancel ? <Button s={s} label={W.cancel} onPress={onCancel} /> : null}
      </View>
      {note ? (
        <Text accessibilityRole="alert" style={s.note}>
          {note}
        </Text>
      ) : null}
      <CodeForm t={t} s={s} busy={busy} onSave={save} />
    </>
  );
}

function Count({ s, match, onIntroduce, onChange }: { s: Styles; match: SeMatchState; onIntroduce: () => void; onChange: () => void }) {
  const count = match.count;
  return (
    <>
      {count === null ? <Text style={s.line}>{W.noCount}</Text> : <Text style={s.big}>{count}</Text>}
      {count === null ? null : <Text style={s.line}>{W.fit(count)}</Text>}
      {count ? (
        <TouchableOpacity accessibilityRole="link" onPress={onIntroduce} style={s.linkTap}>
          <Text style={s.link}>{W.introduce}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity accessibilityRole="button" onPress={onChange} style={s.textTap}>
        <Text style={s.textButton}>{W.change}</Text>
      </TouchableOpacity>
    </>
  );
}

function Body({ t, s, match, onSave, onIntroduce }: { t: SeThemeTokens; s: Styles; match: SeMatchState; onSave: Save; onIntroduce: () => void }) {
  const [editing, setEditing] = useState(false);
  const needs = match.needs;
  if (!needs || editing) {
    const save: Save = async (change) => {
      const failed = await onSave(change);
      if (!failed) setEditing(false);
      return failed;
    };
    return <Picker t={t} s={s} initial={needs?.needKeys ?? []} onSave={save} onCancel={needs ? () => setEditing(false) : undefined} />;
  }
  return <Count s={s} match={match} onIntroduce={onIntroduce} onChange={() => setEditing(true)} />;
}

export function MatchCard({ t, refreshKey, onIntroduce }: { t: SeThemeTokens; refreshKey?: string; onIntroduce: () => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { state, retry, save } = useMatchCard(refreshKey);
  if (state.kind === 'hidden') return null;
  return (
    <View style={s.card} accessibilityLabel={W.label}>
      <View style={s.dot}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.bg} strokeWidth={2.4} strokeLinecap="round">
          <Circle cx={11} cy={11} r={6} />
          <Path d="M20 20l-4.5-4.5" />
        </Svg>
      </View>
      <Text style={s.label}>{W.label}</Text>
      {state.kind === 'loading' ? <Text style={s.line}>{W.loading}</Text> : null}
      {state.kind === 'error' ? (
        <View accessibilityRole="alert" style={s.row}>
          <Text style={s.line}>
            {state.message}
          </Text>
          <Button s={s} label={W.tryAgain} onPress={retry} />
        </View>
      ) : null}
      {state.kind === 'ready' ? <Body t={t} s={s} match={state.match} onSave={save} onIntroduce={onIntroduce} /> : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 6, padding: 12, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair, alignItems: 'flex-start' },
    dot: { position: 'absolute', left: -40, top: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: t.kind.match, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 12, color: t.kind.match, fontFamily: SE_FONT.sansBold },
    big: { fontSize: 34, lineHeight: 36, color: t.ink, fontFamily: SE_FONT.serif },
    line: { fontSize: 13, lineHeight: 18, color: t.ink, fontFamily: SE_FONT.sans },
    linkTap: { minHeight: 32, justifyContent: 'center' },
    link: { fontSize: 13, color: t.kind.match, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
    textTap: { minHeight: 32, justifyContent: 'center' },
    textButton: { fontSize: 12, color: t.soft, textDecorationLine: 'underline', fontFamily: SE_FONT.sans },
    ask: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
    chip: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.hair },
    chipOn: { backgroundColor: t.ink, borderColor: t.ink },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    chipLabelOn: { color: t.bg },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 },
    primary: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.btn, backgroundColor: t.btn },
    primaryLabel: { fontSize: 13, color: t.onBtn, fontFamily: SE_FONT.sansSemi },
    button: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, boxShadow: `0px 2px 0px ${t.line}` },
    buttonLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    disabled: { opacity: 0.5 },
    codeForm: { alignSelf: 'stretch', gap: 4, marginTop: 6, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: t.hair },
    codeLabel: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    codeInput: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.sunk, color: t.ink, fontSize: 14, letterSpacing: 0.8, fontFamily: SE_FONT.sans },
    note: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
