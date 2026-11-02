// Today for a visitor who is not signed in, the Android copy of the web's public-today.tsx: the 3.1
// look with Today alone (no names, no mute) and a Sign in button where the tabs would be.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_AVENHOOD, seTheme, type SeThemeTokens } from '@ctf/shared';
import { useAuth } from '../../auth/auth-context';
import type { FeatureKey } from '../../navigation/screens';
import { SE_FONT } from './fonts';
import { TodayScreen } from './today/TodayScreen';
import { useSeTheme } from './useSeTheme';
import { SeRoomsProvider } from './rooms/SeRooms';

export function PublicToday({ onOpen }: { onOpen: (_key: FeatureKey) => void }) {
  const { theme } = useSeTheme();
  const t = seTheme(theme.color, theme.mode);
  const s = useMemo(() => makeStyles(t), [t]);
  const { signIn } = useAuth();
  return (
    <SeRoomsProvider>
      <ScrollView style={s.frame} contentContainerStyle={s.screen}>
        <View style={s.header}>
          <Text accessibilityRole="header" style={s.title}>
            Today in the {SE_AVENHOOD}
          </Text>
          <Text style={s.eyebrow}>What is happening now. Sign in to post, answer and take part.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => void signIn()} style={s.signIn}>
          <Text style={s.signInLabel}>Sign in</Text>
        </TouchableOpacity>
        <TodayScreen t={t} accountId={null} onOpen={onOpen} />
      </ScrollView>
    </SeRoomsProvider>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    frame: { flex: 1, backgroundColor: t.bg },
    screen: { gap: 18, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 },
    header: { gap: 2 },
    eyebrow: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    title: { fontSize: 30, lineHeight: 33, color: t.ink, fontFamily: SE_FONT.serif },
    signIn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999, backgroundColor: t.btn, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    signInLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
  });
}
