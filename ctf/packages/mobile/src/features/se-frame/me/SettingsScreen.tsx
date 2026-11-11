// Settings on Android, the copy of the web's settings-screen.tsx, built to the approved board
// "Settings": Notifications, Look and reading, Safety and privacy, Help, Get and Your data, then
// Back to 3.0 and Sign out. Parts the Android app does not carry open in the browser.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import {
  SE_ME_LINKS,
  SE_SETTINGS_WORDS as W,
  SE_TEXT_SIZE_LABELS,
  SE_TEXT_SIZES,
  SE_THEME_LABELS,
  type SeReadingPrefs,
  type SeReadingSwitch,
  type SeThemeChoice,
  type SeThemeTokens,
} from '@ctf/shared';
import { useAuth } from '../../../auth/auth-context';
import { BugReportModal } from '../../bug-reporting';
import { reportError } from '../../../observability/report';
import type { FeatureKey } from '../../../navigation/screens';
import { MatchingToggle } from '../today/MatchingToggle';
import { makeMeStyles, type MeStyles } from './meStyles';
import { useCount } from './meData';
import { MutedCard } from './MutedCard';
import { NotificationGroup } from './NotificationGroup';
import { BackHeader, SettingsGroup, SettingsRow } from './SettingsParts';

type Base = { s: MeStyles; t: SeThemeTokens };
type LookProps = { theme: SeThemeChoice; reading: SeReadingPrefs; onReading: (_change: Partial<SeReadingPrefs>) => void; onTheme: () => void };

function LookGroup({ s, t, theme, reading, onReading, onTheme }: Base & LookProps) {
  const nextSize = SE_TEXT_SIZES[(SE_TEXT_SIZES.indexOf(reading.textSize) + 1) % SE_TEXT_SIZES.length];
  const switches: Array<[SeReadingSwitch, string]> = [
    ['highContrast', W.highContrast],
    ['readableFont', W.readableFont],
    ['emojiRain', W.emojiRain],
  ];
  return (
    <SettingsGroup s={s} title={W.look}>
      <SettingsRow s={s} t={t} label={W.theme} value={`${SE_THEME_LABELS[theme.color]}, ${theme.mode}`} onPress={onTheme} />
      <SettingsRow s={s} t={t} label={W.textSize} value={SE_TEXT_SIZE_LABELS[reading.textSize]} onPress={() => onReading({ textSize: nextSize })} />
      {switches.map(([key, label], index) => (
        <SettingsRow
          key={key}
          s={s}
          t={t}
          label={label}
          value={reading[key] ? W.on : W.off}
          pressed={reading[key]}
          onPress={() => onReading({ [key]: !reading[key] })}
          last={index === switches.length - 1}
        />
      ))}
    </SettingsGroup>
  );
}

function SafetyGroup({ s, t, censusAdded, onOpen, go }: Base & { censusAdded: boolean | null; onOpen: (_key: FeatureKey) => void; go: (_href: string) => void }) {
  const blocked = useCount('/api/account/blocks', 'blocks');
  const muted = useCount('/api/account/mutes', 'mutes');
  const [mutedOpen, setMutedOpen] = useState(false);
  const census = censusAdded === null ? undefined : censusAdded ? W.censusAdded : W.censusNotAdded;
  return (
    <SettingsGroup
      s={s}
      title={W.safety}
      after={
        <>
          {mutedOpen ? <MutedCard t={t} /> : null}
          <MatchingToggle t={t} />
        </>
      }
    >
      <SettingsRow s={s} t={t} label={W.blocked} value={blocked === null ? undefined : String(blocked)} onPress={() => onOpen('blocked-members')} />
      <SettingsRow s={s} t={t} label={W.muted} value={muted === null ? undefined : String(muted)} expanded={mutedOpen} onPress={() => setMutedOpen((v) => !v)} />
      <SettingsRow s={s} t={t} label={W.census} value={census} onPress={() => go(SE_ME_LINKS.survey)} last />
    </SettingsGroup>
  );
}

function HelpGroup({ s, t, onAskArchitect, go }: Base & { onAskArchitect: () => void; go: (_href: string) => void }) {
  const [reporting, setReporting] = useState(false);
  return (
    <SettingsGroup s={s} title={W.help} after={<BugReportModal visible={reporting} onClose={() => setReporting(false)} />}>
      <SettingsRow s={s} t={t} label={W.architect} onPress={onAskArchitect} />
      <SettingsRow s={s} t={t} label={W.bug} onPress={() => setReporting(true)} />
      <SettingsRow s={s} t={t} label={W.guide} onPress={() => go(SE_ME_LINKS.guide)} />
      <SettingsRow s={s} t={t} label={W.terms} onPress={() => go(SE_ME_LINKS.terms)} last />
    </SettingsGroup>
  );
}

// Sign out of this device, back to signed-out Today, the same as the web.
function useSignOut() {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await signOut();
    } catch (err) {
      reportError(err, { area: 'se-frame', op: 'me_sign_out' });
      const reason = err instanceof Error && err.message ? ` (${err.message})` : '';
      setError(`${W.signOutFailed}${reason}`);
      setPending(false);
    }
  }, [signOut]);
  const confirm = () =>
    Alert.alert(W.signOutConfirm, W.signOutConfirmText, [
      { text: 'Cancel', style: 'cancel' },
      { text: W.signOut, style: 'destructive', onPress: () => void run() },
    ]);
  return { pending, error, confirm };
}

function LeaveGroup({ s, t, onBack, saving }: Base & { onBack: () => void; saving: boolean }) {
  const signOut = useSignOut();
  return (
    <SettingsGroup
      s={s}
      after={
        <>
          <Text style={s.settingsNote}>{W.version}</Text>
          {signOut.error ? (
            <Text accessibilityRole="alert" style={s.alert}>
              {signOut.error}
            </Text>
          ) : null}
        </>
      }
    >
      <SettingsRow s={s} t={t} label={W.backTo30} onPress={saving ? undefined : onBack} />
      <SettingsRow s={s} t={t} label={signOut.pending ? W.signingOut : W.signOut} onPress={signOut.pending ? undefined : signOut.confirm} last />
    </SettingsGroup>
  );
}

type SettingsProps = LookProps & {
  t: SeThemeTokens;
  censusAdded: boolean | null;
  onAskArchitect: () => void;
  onBackTo30: () => void;
  saving: boolean;
  onClose: () => void;
  onOpen: (_key: FeatureKey) => void;
  go: (_href: string) => void;
};

export function SettingsScreen(props: SettingsProps) {
  const { t, go } = props;
  const s = useMemo(() => makeMeStyles(t), [t]);
  const external = (url: string) => void Linking.openURL(url);
  return (
    <View style={s.settingsStack}>
      <BackHeader s={s} t={t} title={W.title} back={W.backToMe} onBack={props.onClose} />
      <NotificationGroup s={s} t={t} />
      <LookGroup s={s} t={t} theme={props.theme} reading={props.reading} onReading={props.onReading} onTheme={props.onTheme} />
      <SafetyGroup s={s} t={t} censusAdded={props.censusAdded} onOpen={props.onOpen} go={go} />
      <HelpGroup s={s} t={t} onAskArchitect={props.onAskArchitect} go={go} />
      <SettingsGroup s={s} title={W.get}>
        <SettingsRow s={s} t={t} label={W.wallpapers} onPress={() => external(SE_ME_LINKS.wallpapers)} />
        <SettingsRow s={s} t={t} label={W.androidApp} onPress={() => external(SE_ME_LINKS.androidApp)} last />
      </SettingsGroup>
      <SettingsGroup s={s} title={W.data}>
        <SettingsRow s={s} t={t} label={W.deletePart} onPress={() => props.onOpen('account-data')} />
        <SettingsRow s={s} t={t} label={W.deleteAccount} onPress={() => props.onOpen('account-data')} last />
      </SettingsGroup>
      <LeaveGroup s={s} t={t} onBack={props.onBackTo30} saving={props.saving} />
    </View>
  );
}
