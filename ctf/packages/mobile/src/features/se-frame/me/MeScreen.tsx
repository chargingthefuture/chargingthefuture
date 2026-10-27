// Me on Android, the copy of the web (web components/se-frame/me/me-screen.tsx): only what is the
// member's own. The profile, ServiceCredits, the private tools, About, Settings and, for the owner,
// the System Architect entry. Links to parts of the app the Android app does not carry open in the
// browser.

import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  SE_AVEN_DEFINITION,
  SE_AVENHOOD,
  SE_AVENHOOD_DEFINITION,
  SE_ME_LINKS,
  SE_ME_TILES,
  SE_ME_WORDS as W,
  SE_THEME_COLORS,
  SE_THEME_LABELS,
  SE_THEME_MODES,
  seTheme,
  type SeThemeChoice,
  type SeThemeTokens,
} from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { reportError } from '../../../observability/report';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';
import { MutedCard } from './MutedCard';

type Styles = ReturnType<typeof makeStyles>;
type Go = (_href: string) => void;

type CreditsState = { kind: 'loading' } | { kind: 'ready'; available: number } | { kind: 'error'; message: string };

function useCredits(): CreditsState {
  const [state, setState] = useState<CreditsState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    authedFetchJson<{ wallet?: { availableBalance?: unknown } }>('/api/service-credits/wallet')
      .then((body) => {
        const available = body.wallet?.availableBalance;
        if (typeof available !== 'number') throw new Error('The wallet answer had no balance.');
        if (active) setState({ kind: 'ready', available });
      })
      .catch((error: unknown) => {
        reportError(error, { area: 'se-frame', op: 'me_credits' });
        if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

function Pill({ s, label, onPress, picked }: { s: Styles; label: string; onPress: () => void; picked?: boolean }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: picked }} onPress={onPress} style={[s.pill, picked ? s.pillPicked : null]}>
      <Text style={[s.pillLabel, picked ? s.pillLabelPicked : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CreditsCard({ s, go, handle }: { s: Styles; go: Go; handle: string | null }) {
  const credits = useCredits();
  const [note, setNote] = useState<string | null>(null);
  const receive = () => {
    if (!handle) return setNote(W.receiveNoHandle);
    void Clipboard.setStringAsync(handle)
      .then(() => setNote(W.receiveCopied(handle)))
      .catch((error: unknown) => setNote(W.receiveCopyFailed(handle, error instanceof Error ? error.message : 'the phone refused')));
  };
  return (
    <View style={s.card}>
      <Text style={s.label}>{W.credits}</Text>
      {credits.kind === 'ready' ? <Text style={s.big}>{W.creditsUnit(credits.available)}</Text> : null}
      {credits.kind === 'error' ? <Text style={s.text}>{`${W.creditsFailed} ${credits.message}`}</Text> : null}
      <View style={s.row}>
        <Pill s={s} label={W.send} onPress={() => go(`${SE_ME_LINKS.credits}?tab=send`)} />
        <Pill s={s} label={W.history} onPress={() => go(`${SE_ME_LINKS.credits}?tab=wallet`)} />
        <Pill s={s} label={W.receive} onPress={receive} />
      </View>
      {note ? <Text style={s.text}>{note}</Text> : null}
    </View>
  );
}

function Tile({ s, title, text, onPress }: { s: Styles; title: string; text: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="link" onPress={onPress} style={s.tile}>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.text}>{text}</Text>
    </TouchableOpacity>
  );
}

function ThemePicker({ s, theme, onChange }: { s: Styles; theme: SeThemeChoice; onChange: (_next: SeThemeChoice) => void }) {
  return (
    <View style={s.picker}>
      <Text style={s.label}>{W.theme}</Text>
      <View style={s.row} accessibilityRole="radiogroup">
        {SE_THEME_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            accessibilityRole="radio"
            accessibilityState={{ checked: theme.color === color }}
            onPress={() => onChange({ ...theme, color })}
            style={[s.pill, theme.color === color ? s.pillPicked : null]}
          >
            <View style={[s.dot, { backgroundColor: seTheme(color, theme.mode).bg, borderColor: seTheme(color, theme.mode).btn }]} />
            <Text style={[s.pillLabel, theme.color === color ? s.pillLabelPicked : null]}>{SE_THEME_LABELS[color]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.row} accessibilityRole="radiogroup">
        {SE_THEME_MODES.map((mode) => (
          <Pill key={mode} s={s} label={mode === 'dark' ? W.dark : W.light} picked={theme.mode === mode} onPress={() => onChange({ ...theme, mode })} />
        ))}
      </View>
      <Text style={s.text}>{W.themeText}</Text>
    </View>
  );
}

type SettingsProps = { theme: SeThemeChoice; onTheme: (_next: SeThemeChoice) => void; onBack: () => void; saving: boolean; onOpenAccount: () => void };

function SettingsCard({ s, go, theme, onTheme, onBack, saving, onOpenAccount }: SettingsProps & { s: Styles; go: Go }) {
  const links: Array<[string, () => void]> = [
    [W.account, onOpenAccount],
    [W.survey, () => go(SE_ME_LINKS.survey)],
    [W.wallpapers, () => void Linking.openURL(SE_ME_LINKS.wallpapers)],
  ];
  return (
    <View style={s.card}>
      <Text style={s.label}>Settings</Text>
      <ThemePicker s={s} theme={theme} onChange={onTheme} />
      <Text style={s.text}>{W.version}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={onBack} style={[s.pill, saving ? s.disabled : null]}>
        <Text style={s.pillLabel}>{W.backTo30}</Text>
      </TouchableOpacity>
      {links.map(([label, onPress]) => (
        <TouchableOpacity key={label} accessibilityRole="link" onPress={onPress} style={s.link}>
          <Text style={s.linkLabel}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

type MeProps = SettingsProps & {
  t: SeThemeTokens;
  user: { id: string; username?: string | null } | null;
  isAdmin: boolean;
  onOpen: (_key: FeatureKey) => void;
};

export function MeScreen({ t, user, isAdmin, onOpen, ...settings }: MeProps) {
  const s = useMemo(() => makeStyles(t), [t]);
  const go: Go = (href) => openTodayLink(href, onOpen);
  const handle = user?.username ? `@${user.username}` : null;
  return (
    <>
      <View style={s.card}>
        <View style={s.profile}>
          {user ? <SeAvatar accountId={user.id} size={56} /> : null}
          <Text style={s.handle}>{handle ?? 'Survivor'}</Text>
        </View>
      </View>
      <CreditsCard s={s} go={go} handle={handle} />
      {SE_ME_TILES.map((tile) => (
        <Tile key={tile.key} s={s} title={tile.label} text={tile.text} onPress={() => go(tile.href)} />
      ))}
      <View style={s.card}>
        <Text style={s.label}>About</Text>
        <Text style={s.title}>The {SE_AVENHOOD}</Text>
        <Text style={s.text}>{SE_AVENHOOD_DEFINITION}</Text>
        <Text style={s.text}>{SE_AVEN_DEFINITION}</Text>
      </View>
      <MutedCard t={t} />
      <SettingsCard s={s} go={go} {...settings} />
      {isAdmin ? <Tile s={s} title={W.architect} text={W.architectText} onPress={() => go(SE_ME_LINKS.architect)} /> : null}
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    handle: { fontSize: 17, color: t.ink, fontFamily: SE_FONT.sansBold },
    label: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 20, color: t.ink, fontFamily: SE_FONT.serif },
    big: { fontSize: 28, color: t.ink, fontFamily: SE_FONT.serif },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
      alignSelf: 'flex-start',
    },
    pillPicked: { backgroundColor: t.btn },
    pillLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    pillLabelPicked: { color: t.onBtn },
    disabled: { opacity: 0.6 },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
    picker: { gap: 8 },
    tile: { gap: 4, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    tileTitle: { fontSize: 16, color: t.ink, fontFamily: SE_FONT.sansBold },
    link: { minHeight: 44, justifyContent: 'center' },
    linkLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
  });
}
