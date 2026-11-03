// Today for a visitor who is not signed in, the Android copy of the web's public-today.tsx, to the
// approved "Today, signed out" board: the Skills Economy name with Sign in, the guest Today, and a bar
// along the bottom with Sign up.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_SIGNED_OUT_THEME, SE_GUEST_WORDS as W, seTheme, type SeThemeTokens } from '@ctf/shared';
import { useAuth } from '../../auth/auth-context';
import type { FeatureKey } from '../../navigation/screens';
import { SE_FONT } from './fonts';
import { GuestToday } from './today/GuestToday';
import { SeRoomsProvider } from './rooms/SeRooms';

export function PublicToday({ onOpen }: { onOpen: (_key: FeatureKey) => void }) {
  const theme = SE_SIGNED_OUT_THEME;
  const t = seTheme(theme.color, theme.mode);
  const s = useMemo(() => makeStyles(t), [t]);
  const { signIn } = useAuth();
  return (
    <SeRoomsProvider>
      <View style={s.frame}>
        <ScrollView contentContainerStyle={s.screen}>
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.wordmark}>
              {W.brand}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void signIn()} style={s.signIn}>
              <Text style={s.signInLabel}>{W.signIn}</Text>
            </TouchableOpacity>
          </View>
          <GuestToday t={t} onSignUp={() => void signIn()} onOpen={onOpen} />
        </ScrollView>
        <View style={s.bar} accessibilityLabel="Main">
          <Text style={s.barText}>{W.bar}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void signIn()} style={s.barButton}>
            <Text style={s.barButtonLabel}>{W.signUp}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SeRoomsProvider>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    frame: { flex: 1, backgroundColor: t.bg },
    screen: { gap: 18, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 120 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    wordmark: { fontSize: 22, color: t.btn, fontFamily: SE_FONT.serif },
    signIn: { minHeight: 44, justifyContent: 'center' },
    signInLabel: { fontSize: 14, color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansSemi },
    bar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 6,
      paddingLeft: 18,
      paddingRight: 6,
      borderRadius: 999,
      backgroundColor: t.card,
      borderWidth: 1.5,
      borderColor: t.line,
      boxShadow: `0px 3px 0px ${t.line}`,
    },
    barText: { flexShrink: 1, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansSemi },
    barButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999, backgroundColor: t.btn },
    barButtonLabel: { fontSize: 14, color: t.onBtn, fontFamily: SE_FONT.sansBold },
  });
}
