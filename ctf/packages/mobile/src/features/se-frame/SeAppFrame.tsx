// The 3.1 app frame, the Android copy of the web (components/se-frame/se-app-frame.tsx): one screen
// per tab and the tab bar along the bottom. The phone's back button returns to Today from any other
// tab, as the web's back button does through the address.

import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { seTheme, type SeTab, type SeThemeTokens } from '@ctf/shared';
import { useAuth } from '../../auth/auth-context';
import { SeTabBar } from './SeTabBar';
import { SE_FONT } from './fonts';
import { useInterfaceVersion } from './interface-version';

const TODAY_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const TITLES: Record<SeTab, string> = {
  today: 'Today in the Avenhood',
  people: 'People',
  new: 'New',
  activity: 'Activity',
  me: 'Me',
};

export function SeAppFrame({ onOpenAccount }: { onOpenAccount: () => void }) {
  const t = seTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { user } = useAuth();
  const { switchTo, saving, error } = useInterfaceVersion();
  const [tab, setTab] = useState<SeTab>('today');

  useEffect(() => {
    if (tab === 'today') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setTab('today');
      return true;
    });
    return () => sub.remove();
  }, [tab]);

  const handle = user?.username ? `@${user.username}` : 'Survivor';
  const back = () => void switchTo('3.0');

  return (
    <View style={s.frame}>
      <ScrollView contentContainerStyle={s.screen}>
        <View style={s.header}>
          {tab === 'today' ? <Text style={s.eyebrow}>{TODAY_DATE.format(new Date())}</Text> : null}
          <Text accessibilityRole="header" style={s.title}>
            {TITLES[tab]}
          </Text>
        </View>

        {tab === 'me' ? (
          <>
            <View style={s.card}>
              <Text style={s.handle}>{handle}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>Settings</Text>
              <Text style={s.emptyText}>You are using 3.1. You can go back to 3.0 at any time.</Text>
              <View style={s.buttonRow}>
                <SecondaryButton s={s} label="Back to 3.0" onPress={back} disabled={saving} />
                <TouchableOpacity accessibilityRole="link" onPress={onOpenAccount} style={s.textLink}>
                  <Text style={s.textLinkLabel}>Account and data</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <View style={s.card}>
            <Text style={s.emptyTitle}>This screen is still being built.</Text>
            <Text style={s.emptyText}>Everything you use today is in 3.0, unchanged.</Text>
            <SecondaryButton s={s} label="Back to 3.0" onPress={back} disabled={saving} />
          </View>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <SeTabBar t={t} active={tab} onSelect={setTab} />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function SecondaryButton({ s, label, onPress, disabled }: { s: Styles; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[s.secondaryButton, disabled ? s.disabled : null]}
    >
      <Text style={s.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    frame: { flex: 1, backgroundColor: t.bg },
    screen: { gap: 18, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 120 },
    header: { gap: 2 },
    eyebrow: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    title: { fontSize: 30, lineHeight: 33, color: t.ink, fontFamily: SE_FONT.serif },
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair, alignItems: 'flex-start' },
    cardLabel: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    emptyTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    emptyText: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    handle: { fontSize: 17, color: t.ink, fontFamily: SE_FONT.sansBold },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
    secondaryButton: {
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    secondaryLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    disabled: { opacity: 0.6 },
    textLink: { minHeight: 44, justifyContent: 'center' },
    textLinkLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
    error: { fontSize: 14, color: t.kind.ask, fontFamily: SE_FONT.sans },
  });
}
