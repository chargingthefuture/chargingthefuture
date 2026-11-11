// Me on Android, the copy of the web (components/se-frame/me/me-screen.tsx), built to the approved
// board "Me": the member's name, since when they have been an Aven, their badges and the gear to
// Settings; their three profile lines; ServiceCredits; Saved, Read and Hidden; the Tools grid; and
// emoji rain. Tools the Android app does not carry open in the browser.

import React, { useMemo, useState, type ReactNode } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import {
  SE_AVEN_DEFINITION,
  SE_ME_BADGE_LABELS,
  SE_ME_CREDIT_ICONS,
  SE_ME_GEAR_ICON,
  SE_ME_LINKS,
  SE_ME_PROMPT_KEYS,
  SE_ME_PROMPT_LABELS,
  SE_ME_TOOL_INK,
  SE_ME_TOOLS,
  SE_ME_WORDS as W,
  SE_SETTINGS_WORDS,
  seMeName,
  seMeSince,
  type SeMeProfile,
  type SeMeView,
  type SeReadingPrefs,
  type SeThemeTokens,
} from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { makeMeStyles, type MeStyles } from './meStyles';
import { useCredits, type Read } from './meData';

type Go = (_href: string) => void;

export function MeIcon({ d, color, size = 18 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

function Since({ s, sinceIso }: { s: MeStyles; sinceIso: string | null }) {
  const [open, setOpen] = useState(false);
  const since = seMeSince(sinceIso);
  if (!since) return null;
  return (
    <>
      <Text style={s.since}>
        <Text accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={s.term}>
          {W.aven}
        </Text>
        {` ${W.since} ${since}`}
      </Text>
      {open ? <Text style={s.since}>{SE_AVEN_DEFINITION}</Text> : null}
    </>
  );
}

function Badges({ s, profile, go }: { s: MeStyles; profile: SeMeProfile; go: Go }) {
  if (profile.badges.length === 0) return null;
  return (
    <View style={s.badges}>
      {profile.badges.map((badge) => (
        // The System Architect badge is also the way into the admin screens, as on the web.
        <TouchableOpacity
          key={badge}
          accessibilityRole={badge === 'architect' ? 'link' : 'text'}
          disabled={badge !== 'architect'}
          onPress={() => go(SE_ME_LINKS.architect)}
          style={s.badge}
        >
          <Text style={[s.badgeText, badge === 'weaver' ? s.badgeWeaver : null]}>{SE_ME_BADGE_LABELS[badge]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Head({ s, t, user, profile, go, onSettings }: { s: MeStyles; t: SeThemeTokens; user: MeUser; profile: Read<SeMeProfile>; go: Go; onSettings: () => void }) {
  const ready = profile.kind === 'ready' ? profile.value : null;
  return (
    <View style={s.head}>
      <View style={s.avatar}>
        <SeAvatar accountId={user.id} size={64} />
      </View>
      <View style={s.who}>
        <Text accessibilityRole="header" style={s.name}>
          {seMeName(user.username)}
        </Text>
        {ready ? <Since s={s} sinceIso={ready.sinceIso} /> : null}
        {ready ? <Badges s={s} profile={ready} go={go} /> : null}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.settings} onPress={onSettings} style={s.gear}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2} strokeLinecap="round">
          <Path d={SE_ME_GEAR_ICON} />
          <Circle cx={16} cy={7} r={2} />
          <Circle cx={8} cy={17} r={2} />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

function Prompts({ s, profile, onEdit }: { s: MeStyles; profile: Read<SeMeProfile>; onEdit: () => void }) {
  if (profile.kind === 'loading') return null;
  if (profile.kind === 'error') {
    return (
      <Text accessibilityRole="alert" style={s.alert}>
        {profile.message}
      </Text>
    );
  }
  const written = SE_ME_PROMPT_KEYS.filter((key) => profile.value.prompts[key]);
  return (
    <View style={s.card}>
      {written.map((key) => (
        <View key={key}>
          <Text style={s.q}>{SE_ME_PROMPT_LABELS[key]}</Text>
          <Text style={s.a}>{profile.value.prompts[key]}</Text>
        </View>
      ))}
      <TouchableOpacity accessibilityRole="button" onPress={onEdit} style={s.textButton}>
        <Text style={s.textButtonLabel}>{written.length > 0 ? W.promptsEdit : W.promptsAdd}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreditAction({ s, t, label, icon, onPress }: { s: MeStyles; t: SeThemeTokens; label: string; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={s.creditAction}>
      <View style={s.creditIcon}>
        <MeIcon d={icon} color={t.onBtn} size={17} />
      </View>
      <Text style={s.creditLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function CreditsCard({ s, t, go, handle }: { s: MeStyles; t: SeThemeTokens; go: Go; handle: string | null }) {
  const credits = useCredits();
  const [note, setNote] = useState<string | null>(null);
  const receive = () => {
    if (!handle) return setNote(W.receiveNoHandle);
    void Clipboard.setStringAsync(handle)
      .then(() => setNote(W.receiveCopied(handle)))
      .catch((error: unknown) => setNote(W.receiveCopyFailed(handle, error instanceof Error ? error.message : 'the phone refused')));
  };
  return (
    <>
      <View style={s.credits} accessibilityLabel={W.credits}>
        <View style={s.creditsText}>
          <Text style={s.label}>{W.credits}</Text>
          <Text style={s.balance}>{credits.kind === 'ready' ? credits.value.toLocaleString('en-US') : '–'}</Text>
          <Text style={s.note}>{W.creditsNote}</Text>
        </View>
        <CreditAction s={s} t={t} label={W.send} icon={SE_ME_CREDIT_ICONS.send} onPress={() => go(`${SE_ME_LINKS.credits}?tab=send`)} />
        <CreditAction s={s} t={t} label={W.receive} icon={SE_ME_CREDIT_ICONS.receive} onPress={receive} />
        <CreditAction s={s} t={t} label={W.history} icon={SE_ME_CREDIT_ICONS.history} onPress={() => go(`${SE_ME_LINKS.credits}?tab=wallet`)} />
      </View>
      {credits.kind === 'error' ? (
        <Text accessibilityRole="alert" style={s.alert}>
          {credits.message}
        </Text>
      ) : null}
      {note ? <Text style={s.status}>{note}</Text> : null}
    </>
  );
}

function Tools({ s, go }: { s: MeStyles; go: Go }) {
  return (
    <>
      <Text accessibilityRole="header" style={s.h2}>
        {W.tools}
      </Text>
      <View style={s.tools}>
        {SE_ME_TOOLS.map((tool) => (
          <TouchableOpacity key={tool.key} accessibilityRole="link" onPress={() => go(tool.href)} style={s.tool}>
            <View style={[s.toolIcon, { backgroundColor: tool.tint }]}>
              <MeIcon d={tool.icon} color={SE_ME_TOOL_INK} />
            </View>
            <Text style={s.toolLabel}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

export type MeUser = { id: string; username?: string | null };

type MeScreenProps = {
  t: SeThemeTokens;
  user: MeUser;
  profile: Read<SeMeProfile>;
  reading: SeReadingPrefs;
  onReading: (_change: Partial<SeReadingPrefs>) => void;
  onView: (_view: SeMeView) => void;
  go: Go;
  // Me → Saved is built separately; it goes first in the row, before Read and Hidden.
  saved?: ReactNode;
};

export function MeScreen({ t, user, profile, reading, onReading, onView, go, saved }: MeScreenProps) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  return (
    <View style={s.stack}>
      <Head s={s} t={t} user={user} profile={profile} go={go} onSettings={() => onView('settings')} />
      <Prompts s={s} profile={profile} onEdit={() => onView('prompts')} />
      <CreditsCard s={s} t={t} go={go} handle={user.username ? `@${user.username}` : null} />
      <View style={s.shortcuts}>
        {saved ?? null}
        {(['read', 'hidden'] as const).map((view) => (
          <TouchableOpacity key={view} accessibilityRole="button" onPress={() => onView(view)} style={s.shortcut}>
            <Text style={s.shortcutLabel}>{view === 'read' ? W.read : W.hidden}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Tools s={s} go={go} />
      <View style={s.switchRow}>
        <Text style={s.switchLabel}>{SE_SETTINGS_WORDS.emojiRain}</Text>
        <Switch
          accessibilityLabel={SE_SETTINGS_WORDS.emojiRain}
          value={reading.emojiRain}
          onValueChange={(on) => onReading({ emojiRain: on })}
          trackColor={{ true: t.btn, false: t.sunk }}
        />
      </View>
    </View>
  );
}
