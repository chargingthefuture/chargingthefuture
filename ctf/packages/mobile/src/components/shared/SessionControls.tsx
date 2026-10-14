// The sign-out control for the Android app.
//
// `AuthProvider` (src/auth/auth-context.tsx) already runs the Clerk sign-in flow and clears the
// stored session on sign-out; this control and the header's Sign in button are the only places the shell calls them.
//
//   - Sign in itself is the gradient button in the top bar and every screen header
//     (src/components/shell/ShellChrome.tsx), as on the web.
//   - `UserMenuButton` is the account menu on the Your account screen's Identity card, where the
//     web places Clerk's account menu (UserButton) and its Sign out item. Clerk's menu cannot be
//     drawn in React Native, so a round avatar opens the same choice as a system menu.
//   - `SignOutButton` sits on the Unlock screen, which covers the app for a member still held at
//     the Unlock wall.
//
// Signing out clears the stored session from the device keychain and drops the bearer token;
// App.tsx keys the content view on the signed-in member's id, so every Chyme screen holding a
// Stream client unmounts and disconnects it.

import React, { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { useTheme, type ThemeTokens } from '../../theme';
import { Button, interFamily, typeScale } from '../ui';

export function SignOutButton() {
  const { signOut, user, isAuthenticated } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);

  const onPress = useCallback(() => {
    Alert.alert('Sign out of this device?', 'You can sign back in at any time.', [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }, [signOut]);

  // Nothing to sign out of; the header shows the Sign in button instead.
  if (!isAuthenticated) return null;

  const who = user?.username ?? user?.email ?? null;

  return (
    <View style={s.signOutWrap}>
      {who ? <Text style={s.signedInAs}>Signed in as {who}</Text> : null}
      <Button title="Sign out" variant="outline" accent={tokens.textSecondary} onPress={onPress} />
    </View>
  );
}

// The web's Clerk UserButton: a 28px round avatar. Pressing it offers Sign out, the one item of
// Clerk's menu the app can carry (its Manage account page is web-only).
export function UserMenuButton() {
  const { signOut, user, isAuthenticated } = useAuth();
  const { tokens } = useTheme();

  const onPress = useCallback(() => {
    const who = user?.email ?? user?.username ?? 'Your account';
    Alert.alert(who, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void signOut() },
    ]);
  }, [signOut, user]);

  if (!isAuthenticated) return null;
  const initial = (user?.username ?? user?.email ?? 'S').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Your account — sign out"
      style={[avatarStyles.avatar, { backgroundColor: tokens.brand, borderRadius: tokens.isComic ? 0 : 14 }]}
    >
      <Text style={[avatarStyles.avatarText, { color: tokens.brandText }]}>{initial}</Text>
    </TouchableOpacity>
  );
}

const avatarStyles = StyleSheet.create({
  avatar: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5 },
  avatarText: { fontSize: 12, fontFamily: interFamily('700') },
});

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    signOutWrap: { gap: 8, marginTop: 16 },
    signedInAs: { ...typeScale.label, color: t.textSecondary, textAlign: 'center' },
  });
}
