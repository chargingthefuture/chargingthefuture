// The Unlock banner on every 3.1 screen on Android, the copy of the web
// (web components/se-frame/unlock-banner.tsx), built to the approved boards "Unlock banner, day 9 of
// 14" and "After the Unlock deadline": the day count, the address box, the two other ways to finish,
// and, after day 14, that posting is paused. It can be closed only in the first week, and only until
// the next visit. An approved member never sees it.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_UNLOCK_WORDS as W, type SeThemeTokens, type SeUnlockStanding } from '@ctf/shared';
import { authedFetchJson } from '../../auth/authedFetch';
import { openWebPage } from '../../navigation/openWebPage';
import { requestUnlockHelp, submitUnlockUrl } from '../unlock/api';
import { SE_FONT } from './fonts';

type Styles = ReturnType<typeof makeStyles>;

export function UnlockBanner({ t, onOpenUnlock }: { t: SeThemeTokens; onOpenUnlock: () => void }) {
  const [standing, setStanding] = useState<SeUnlockStanding | null>(null);
  const [closed, setClosed] = useState(false);
  const paused = Boolean(standing?.paused);
  const s = useMemo(() => makeStyles(t, paused), [t, paused]);

  const load = useCallback(() => {
    authedFetchJson<{ standing?: SeUnlockStanding }>('/api/unlock/standing')
      .then((body) => setStanding(body.standing ?? null))
      .catch(() => {
        // no-trace: without the standing the banner stays away; every gated route still says why.
      });
  }, []);

  useEffect(load, [load]);

  if (!standing || standing.approved || closed) return null;
  return (
    <View style={s.banner} accessibilityLabel={paused ? 'Paused until Unlock' : 'Finish Unlock'}>
      <TopRow s={s} standing={standing} onClose={() => setClosed(true)} />
      <Text style={s.title}>{standing.title}</Text>
      <Text style={s.text}>{standing.text}</Text>
      {standing.form ? <AddressForm s={s} t={t} label={paused ? W.pausedLabel : W.label} onSent={load} /> : null}
      {standing.form && !paused ? <OtherRoutes s={s} onOpenUnlock={onOpenUnlock} onSent={load} /> : null}
      {paused ? <HelpButton s={s} label={W.askArchitect} onSent={load} /> : null}
    </View>
  );
}

function TopRow({ s, standing, onClose }: { s: Styles; standing: SeUnlockStanding; onClose: () => void }) {
  if (!standing.dayLabel && !standing.closable) return null;
  return (
    <View style={s.top}>
      {standing.dayLabel ? (
        <>
          <Text style={s.day}>{standing.dayLabel.toUpperCase()}</Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.round(standing.progress * 100)}%` }]} />
          </View>
        </>
      ) : (
        <View style={s.spacer} />
      )}
      {standing.closable ? (
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={s.close}>
          <Text style={s.closeLabel}>{W.close}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AddressForm({ s, t, label, onSent }: { s: Styles; t: SeThemeTokens; label: string; onSent: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value.trim() || busy) return;
    setBusy(true);
    const failed = await submitUnlockUrl(value.trim()).then(
      () => null,
      (err: unknown) => (err instanceof Error ? err.message : W.addFailed),
    );
    setBusy(false);
    setError(failed);
    if (!failed) onSent();
  }

  return (
    <View style={s.form}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={label}
          style={s.input}
          placeholder={W.placeholder}
          placeholderTextColor={t.soft}
          value={value}
          onChangeText={setValue}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void submit()}
        />
        <TouchableOpacity accessibilityRole="button" onPress={() => void submit()} disabled={busy} style={[s.add, busy ? s.busy : null]}>
          <Text style={s.addLabel}>{busy ? W.adding : W.add}</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function OtherRoutes({ s, onOpenUnlock, onSent }: { s: Styles; onOpenUnlock: () => void; onSent: () => void }) {
  return (
    <>
      <Text style={s.small}>
        <Text style={s.bold}>{W.removedLead}</Text> {W.removedText}{' '}
        <Text accessibilityRole="link" style={s.link} onPress={() => void openWebPage(W.censusHref, 'unlock')}>
          {W.census}
        </Text>{' '}
        {W.or}{' '}
        <Text accessibilityRole="link" style={s.link} onPress={() => void openWebPage(W.knowledgeHref, 'unlock')}>
          {W.knowledge}
        </Text>
        .
      </Text>
      <Text style={s.smaller}>
        {W.countLine}{' '}
        <Text accessibilityRole="link" style={s.link} onPress={onOpenUnlock}>
          {W.why}
        </Text>
        {' · '}
        <HelpText s={s} label={W.cantFind} onSent={onSent} />
      </Text>
    </>
  );
}

// "Can't find it?" asks for help finding the address: the same request the Unlock screen sends,
// which stops the count and opens the Commons so there is somebody to ask.
function useHelpRequest(onSent: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function ask() {
    if (busy) return;
    setBusy(true);
    const failed = await requestUnlockHelp('', W.addFailed);
    setBusy(false);
    setError(failed);
    if (!failed) onSent();
  }
  return { busy, error, ask };
}

function HelpText({ s, label, onSent }: { s: Styles; label: string; onSent: () => void }) {
  const help = useHelpRequest(onSent);
  return (
    <Text accessibilityRole="button" style={s.link} onPress={() => void help.ask()}>
      {help.busy ? W.asking : label}
      {help.error ? <Text style={s.error}>{` ${help.error}`}</Text> : null}
    </Text>
  );
}

function HelpButton({ s, label, onSent }: { s: Styles; label: string; onSent: () => void }) {
  const help = useHelpRequest(onSent);
  return (
    <View>
      <TouchableOpacity accessibilityRole="button" onPress={() => void help.ask()} disabled={help.busy} style={s.askButton}>
        <Text style={s.askLabel}>{help.busy ? W.asking : label}</Text>
      </TouchableOpacity>
      {help.error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {help.error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens, paused: boolean) {
  const ink = paused ? t.ink : t.onPick;
  const line = paused ? t.line : t.onPick;
  return StyleSheet.create({
    banner: {
      gap: 10,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: line,
      backgroundColor: paused ? t.card : t.pick,
      shadowColor: line,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    day: { fontSize: 12, letterSpacing: 1, color: ink, fontFamily: SE_FONT.sansBold },
    track: { flex: 1, height: 8, borderRadius: 999, borderWidth: 1.5, borderColor: ink, backgroundColor: t.pickField, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: ink },
    spacer: { flex: 1 },
    close: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: ink },
    closeLabel: { fontSize: 13, color: ink, fontFamily: SE_FONT.sansBold },
    title: { fontSize: paused ? 21 : 20, lineHeight: paused ? 25 : 24, color: ink, fontFamily: SE_FONT.serif },
    text: { fontSize: 14, lineHeight: 20, color: ink, fontFamily: SE_FONT.sans },
    form: { gap: 10 },
    label: { fontSize: 13, color: ink, fontFamily: SE_FONT.sansBold },
    row: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 46,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: line,
      backgroundColor: paused ? t.bg : t.pickField,
      color: ink,
      fontSize: 14,
      fontFamily: SE_FONT.sans,
    },
    add: {
      minHeight: 46,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: line,
      backgroundColor: paused ? t.btn : t.hero,
    },
    busy: { opacity: 0.7 },
    addLabel: { fontSize: 14, color: paused ? t.onBtn : t.onHero, fontFamily: SE_FONT.sansBold },
    small: { fontSize: 13, lineHeight: 19, color: ink, fontFamily: SE_FONT.sans },
    smaller: { fontSize: 12, lineHeight: 17, color: ink, fontFamily: SE_FONT.sans },
    bold: { fontFamily: SE_FONT.sansBold },
    link: { color: ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
    askButton: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
    askLabel: { fontSize: 13, color: ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
    error: { fontSize: 13, color: ink, fontFamily: SE_FONT.sansBold },
  });
}
