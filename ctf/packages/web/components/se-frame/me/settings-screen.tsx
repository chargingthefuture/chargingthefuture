'use client';

import { useEffect, useState } from 'react';
import {
  SE_ME_LINKS,
  SE_SETTINGS_WORDS as W,
  SE_TEXT_SIZE_LABELS,
  SE_TEXT_SIZES,
  SE_THEME_LABELS,
  type SeReadingPrefs,
  type SeReadingSwitch,
  type SeThemeChoice,
} from '@ctf/shared';
import { useAuth } from '@/hooks/useAuth';
import { reportError } from '@/lib/observability/report';
import { BugReportModal } from '../../bug-reports/bug-report-modal';
import { MatchingToggle } from '../today/matching-toggle';
import { BackHeader } from './back-header';
import { MutedCard } from './muted-card';
import { NotificationGroup } from './notification-group';
import { SettingsGroup, SettingsRow } from './settings-rows';
import styles from './settings.module.css';

// Settings, built to the approved board "Settings": Notifications, Look and reading, Safety and
// privacy, Help, Get and Your data, then Back to 3.0 and Sign out. Reached from the gear in Me.

// How many rows a list route answers (blocked people, muted people and words), or null until read.
function useCount(url: string, key: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as Record<string, unknown>) : null))
      .then((body) => {
        const list = body?.[key];
        if (active && Array.isArray(list)) setCount(list.length);
      })
      .catch(() => {
        // no-trace: the count is left off the row; the row still opens the list.
      });
    return () => {
      active = false;
    };
  }, [url, key]);
  return count;
}

type LookProps = { theme: SeThemeChoice; reading: SeReadingPrefs; onReading: (_change: Partial<SeReadingPrefs>) => void; onTheme: () => void };

function LookGroup({ theme, reading, onReading, onTheme }: LookProps) {
  const nextSize = SE_TEXT_SIZES[(SE_TEXT_SIZES.indexOf(reading.textSize) + 1) % SE_TEXT_SIZES.length];
  const switches: Array<[SeReadingSwitch, string]> = [
    ['highContrast', W.highContrast],
    ['readableFont', W.readableFont],
    ['emojiRain', W.emojiRain],
  ];
  return (
    <SettingsGroup title={W.look}>
      <SettingsRow label={W.theme} value={`${SE_THEME_LABELS[theme.color]}, ${theme.mode}`} onPress={onTheme} />
      <SettingsRow label={W.textSize} value={SE_TEXT_SIZE_LABELS[reading.textSize]} onPress={() => onReading({ textSize: nextSize })} />
      {switches.map(([key, label]) => (
        <SettingsRow key={key} label={label} value={reading[key] ? W.on : W.off} pressed={reading[key]} onPress={() => onReading({ [key]: !reading[key] })} />
      ))}
    </SettingsGroup>
  );
}

function SafetyGroup({ censusAdded }: { censusAdded: boolean | null }) {
  const blocked = useCount('/api/account/blocks', 'blocks');
  const muted = useCount('/api/account/mutes', 'mutes');
  const [mutedOpen, setMutedOpen] = useState(false);
  const census = censusAdded === null ? undefined : censusAdded ? W.censusAdded : W.censusNotAdded;
  return (
    <SettingsGroup
      title={W.safety}
      after={
        <>
          {mutedOpen ? <MutedCard /> : null}
          <MatchingToggle />
        </>
      }
    >
      <SettingsRow label={W.blocked} value={blocked === null ? undefined : String(blocked)} href={SE_ME_LINKS.blocks} />
      <SettingsRow label={W.muted} value={muted === null ? undefined : String(muted)} expanded={mutedOpen} onPress={() => setMutedOpen((value) => !value)} />
      <SettingsRow label={W.census} value={census} href={SE_ME_LINKS.survey} />
    </SettingsGroup>
  );
}

function HelpGroup({ onAskArchitect }: { onAskArchitect: () => void }) {
  const [reporting, setReporting] = useState(false);
  return (
    <SettingsGroup title={W.help} after={<BugReportModal open={reporting} onClose={() => setReporting(false)} />}>
      <SettingsRow label={W.architect} onPress={onAskArchitect} />
      <SettingsRow label={W.bug} onPress={() => setReporting(true)} />
      <SettingsRow label={W.guide} href={SE_ME_LINKS.guide} />
      <SettingsRow label={W.terms} href={SE_ME_LINKS.terms} />
    </SettingsGroup>
  );
}

// Sign out of this device, back to signed-out Today.
function useSignOut() {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (!window.confirm(`${W.signOutConfirm} ${W.signOutConfirmText}`)) return;
    setPending(true);
    setError(null);
    try {
      await signOut({ redirectUrl: '/' });
    } catch (err) {
      reportError(err, { area: 'se-frame', op: 'me_sign_out' });
      const reason = err instanceof Error && err.message ? ` (${err.message})` : '';
      setError(`${W.signOutFailed}${reason}`);
      setPending(false);
    }
  };
  return { pending, error, run };
}

function LeaveGroup({ onBack, saving }: { onBack: () => void; saving: boolean }) {
  const signOut = useSignOut();
  return (
    <SettingsGroup
      after={
        <>
          <p className={styles.note}>{W.version}</p>
          {signOut.error ? (
            <p role="alert" className={styles.alert}>
              {signOut.error}
            </p>
          ) : null}
        </>
      }
    >
      <SettingsRow label={W.backTo30} onPress={saving ? undefined : onBack} />
      <SettingsRow label={signOut.pending ? W.signingOut : W.signOut} onPress={signOut.pending ? undefined : () => void signOut.run()} />
    </SettingsGroup>
  );
}

export type SettingsScreenProps = LookProps & {
  censusAdded: boolean | null;
  onAskArchitect: () => void;
  onBackTo30: () => void;
  saving: boolean;
  onClose: () => void;
};

export function SettingsScreen(props: SettingsScreenProps) {
  return (
    <div className={styles.stack}>
      <BackHeader title={W.title} back={W.backToMe} onBack={props.onClose} />
      <NotificationGroup />
      <LookGroup theme={props.theme} reading={props.reading} onReading={props.onReading} onTheme={props.onTheme} />
      <SafetyGroup censusAdded={props.censusAdded} />
      <HelpGroup onAskArchitect={props.onAskArchitect} />
      <SettingsGroup title={W.get}>
        <SettingsRow label={W.wallpapers} href={SE_ME_LINKS.wallpapers} external />
        <SettingsRow label={W.androidApp} href={SE_ME_LINKS.androidApp} external />
      </SettingsGroup>
      <SettingsGroup title={W.data}>
        <SettingsRow label={W.deletePart} href={SE_ME_LINKS.accountData} />
        <SettingsRow label={W.deleteAccount} href={SE_ME_LINKS.accountData} />
      </SettingsGroup>
      <LeaveGroup onBack={props.onBackTo30} saving={props.saving} />
    </div>
  );
}
