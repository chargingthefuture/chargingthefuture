// Sign-in and sign-out controls for the Android app.
//
// `AuthProvider` (src/auth/auth-context.tsx) already runs the Clerk sign-in flow and clears the
// stored session on sign-out; these two controls are the only places the shell calls them.
//
//   - `SignInPrompt` sits above the shell content while nobody is signed in, so a member on a fresh
//     install has a way to an account from whichever pill they are on. A signed-out member can still
//     listen to a Chyme room as a guest, so the prompt does not block anything.
//   - `SignOutButton` sits on the Account & Data screen, and on the Unlock screen, which covers the
//     app for a member still held at the Unlock wall. Signing out clears the stored session from
//     the device keychain and drops the bearer token; App.tsx keys the content view on the signed-in
//     member's id, so every Chyme screen holding a Stream client unmounts and disconnects it.
//
// Both reuse the shared Card / Button primitives so they match the shipped controls in either theme.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { useTheme, type ThemeTokens } from '../../theme';
import { Button, Card, CtaButton, typeScale } from '../ui';

export function SignInPrompt() {
  const { signIn } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [busy, setBusy] = useState(false);

  const onPress = useCallback(async () => {
    setBusy(true);
    try {
      // signIn reports and alerts its own failures, so there is nothing more to handle here.
      await signIn();
    } finally {
      setBusy(false);
    }
  }, [signIn]);

  return (
    <Card style={s.card}>
      <View style={s.textCol}>
        <Text style={s.title}>You are not signed in</Text>
        <Text style={s.body}>Sign in to speak in Chyme rooms and to see and manage your data.</Text>
      </View>
      <CtaButton title={busy ? 'Signing in…' : 'Sign in'} onPress={onPress} disabled={busy} />
    </Card>
  );
}

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

  // Nothing to sign out of; the shell shows SignInPrompt instead.
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
    card: {
      padding: 14,
      gap: 10,
      marginTop: 8,
    },
    textCol: { gap: 4 },
    title: { ...typeScale.cardTitle, color: t.textPrimary },
    body: { ...typeScale.body, color: t.textSecondary },
    signOutWrap: { gap: 8, marginTop: 16 },
    signedInAs: { ...typeScale.label, color: t.textSecondary, textAlign: 'center' },
  });
}
