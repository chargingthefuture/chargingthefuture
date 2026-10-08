// The sign-out control for the Android app.
//
// `AuthProvider` (src/auth/auth-context.tsx) already runs the Clerk sign-in flow and clears the
// stored session on sign-out; this control and the header's Sign in button are the only places the shell calls them.
//
//   - Sign in itself is the gradient button in the top bar and every screen header
//     (src/components/shell/ShellChrome.tsx), as on the web.
//   - `SignOutButton` sits on the Account & Data screen, and on the Unlock screen, which covers the
//     app for a member still held at the Unlock wall. Signing out clears the stored session from
//     the device keychain and drops the bearer token; App.tsx keys the content view on the signed-in
//     member's id, so every Chyme screen holding a Stream client unmounts and disconnects it.
//
// It reuses the shared Button primitive so it matches the shipped controls in either theme.

import React, { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { useTheme, type ThemeTokens } from '../../theme';
import { Button, typeScale } from '../ui';

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

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    signOutWrap: { gap: 8, marginTop: 16 },
    signedInAs: { ...typeScale.label, color: t.textSecondary, textAlign: 'center' },
  });
}
