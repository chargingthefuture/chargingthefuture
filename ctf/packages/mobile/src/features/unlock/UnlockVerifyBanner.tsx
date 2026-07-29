import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeName, type ThemeTokens } from '../../theme';
import { fetchUnlockStatus, submitUnlockUrl, type UnlockStatus } from './api';

// Shown at the top of the mobile Commons (HubHome) for an early-Commons A/B treatment member who has
// not yet completed Quora verification. Treatment members now land on the Commons (the client gate in
// App.tsx lets them through, mirroring the web redirect), so — like the web `UnlockVerifyBanner` — they
// need a prompt here or they would not know verification is still required. It prompts for the Quora
// profile URL inline (posting to the same submission endpoint) and nudges a stuck member to just ask
// for help in the Commons chat below. Self-hides for control / verified members and fetches its own
// status, so HubHome needs no new props.
export function UnlockVerifyBanner() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('unlock', theme);
  const s = makeStyles(tokens, theme, accent);

  const [status, setStatus] = useState<UnlockStatus | null>(null);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Flip to the "under review" state after a successful inline submit, without a full reload.
  const [justSubmitted, setJustSubmitted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchUnlockStatus());
    } catch {
      // Best-effort: a status failure just leaves the banner hidden. The server gates still enforce.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Only a treatment-bucket member who is not yet fully verified sees the prompt.
  if (!status || !status.earlyCommonsAccess || status.accessTier === 'approved_full') {
    return null;
  }

  const isPending = justSubmitted || (status.hasSubmission && status.reviewStatus === 'pending');
  const wasRejected = status.hasSubmission && (status.reviewStatus === 'rejected' || status.reviewStatus === 'spam');

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitUnlockUrl(trimmed);
      setUrl('');
      setJustSubmitted(true);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.title}>
        {isPending ? 'Your verification is under review' : 'Verify your account to unlock full access'}
      </Text>
      {isPending ? (
        <Text style={s.body}>
          Thanks — your Quora profile is submitted and a human is reviewing it. You have Commons access
          while you wait.
        </Text>
      ) : (
        <>
          <Text style={s.body}>
            {wasRejected
              ? 'Your last submission could not be verified. Re-submit your Quora profile URL below — a human reviews every one.'
              : 'Submit your Quora profile URL so we can confirm you are a real person. A human reviews every submission.'}
          </Text>
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://quora.com/profile/your-name"
            placeholderTextColor={tokens.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!submitting}
            accessibilityLabel="Your Quora profile URL"
          />
          <Pressable
            style={[s.btn, !url.trim() || submitting ? s.btnDisabled : null]}
            onPress={submit}
            disabled={!url.trim() || submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.btnText}>Submit for verification</Text>
            )}
          </Pressable>
          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* Prominent, universal help for a member who can't find their Quora profile URL. */}
          <View style={s.quoraHelp}>
            <Text style={s.quoraHelpText}>
              <Text style={s.quoraHelpStrong}>Can&apos;t find your Quora profile URL? </Text>
              Go to{' '}
              <Text
                style={s.quoraHelpLink}
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL('https://skillseconomy.quora.com');
                }}
              >
                skillseconomy.quora.com
              </Text>{' '}
              and comment on any post asking for help — I&apos;ll reply with your profile URL.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, _theme: ThemeName, accent: string) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: t.isComic ? `${accent}12` : `${accent}14`,
      borderWidth: t.isComic ? 1.5 : 1,
      borderColor: `${accent}55`,
    },
    title: { fontSize: 14, fontWeight: '800', color: t.textPrimary, marginBottom: 6 },
    body: { fontSize: 13, color: t.textSecondary, lineHeight: 19, marginBottom: 10 },
    input: {
      minHeight: 44,
      borderRadius: t.radius,
      backgroundColor: t.isComic ? t.surface : 'rgba(0,0,0,0.25)',
      borderWidth: t.isComic ? 1.5 : 1,
      borderColor: t.isComic ? `${t.border}60` : 'rgba(255,255,255,0.12)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.textPrimary,
      marginBottom: 10,
    },
    btn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: t.radius,
      backgroundColor: accent,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    error: { fontSize: 12, color: t.danger, marginTop: 8 },
    quoraHelp: {
      marginTop: 12,
      padding: 12,
      borderRadius: t.radius,
      backgroundColor: `${accent}1F`,
      borderWidth: 1.5,
      borderColor: `${accent}73`,
    },
    quoraHelpText: { fontSize: 12.5, color: t.textSecondary, lineHeight: 18 },
    quoraHelpStrong: { fontWeight: '800', color: t.textPrimary },
    quoraHelpLink: { color: accent, fontWeight: '700', textDecorationLine: 'underline' },
  });
}
