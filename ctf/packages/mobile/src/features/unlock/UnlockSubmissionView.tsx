// The Unlock submission screen, copied from the web's UnlockSubmissionView
// (components/unlock/unlock-submission-view.tsx) at phone width: the header, the form with the help
// and survey notes, then the "Why we verify via Quora" and "What gets unlocked" cards below it.
// The web header's admin shortcut is left out: the app has no Unlock admin screen.

import React, { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CheckCircle, ExternalLink, Send, Shield, Unlock as UnlockIcon } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { getUnlockTokens, UNLOCK_BENEFITS, type UnlockTokens } from './unlock-tokens';
import { UnlockQuoraHelp } from './UnlockQuoraHelp';
import { SurveyInviteNote } from './UnlockNotes';

const WHY = [
  { icon: '🔗', t: 'Real-person proof', d: "Quora activity proves you're a real person with history online." },
  { icon: '🛡', t: 'Reduces infiltration', d: 'Makes it harder for traffickers to create fake accounts.' },
  { icon: '✅', t: 'Admin-reviewed', d: 'A human reviews every submission — no automated rejection.' },
];

export function UnlockSubmissionView({
  url,
  onUrlChange,
  onSubmit,
  submitting,
  error,
  onGoHome,
  footer,
}: {
  url: string;
  onUrlChange: (_value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  onGoHome: () => void;
  footer?: ReactNode;
}) {
  const { tokens } = useTheme();
  const tok = getUnlockTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const canSubmit = url.trim().length > 0 && !submitting;

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <UnlockIcon size={18} color={tok.ACCENT} />
        <View style={s.headerText}>
          <Text style={s.headerTitle}>Unlock Full Access</Text>
          <Text style={s.headerSub}>Verify your Quora profile to get started</Text>
        </View>
      </View>

      <View style={s.content}>
        <View style={s.intro}>
          <Text style={s.h1}>Submit your Quora profile URL</Text>
          <Text style={s.lead}>
            To unlock full access to Skills Economy, submit your Quora profile URL for manual verification. This helps us confirm you are a real person and reduces infiltration risk from bad actors.
          </Text>
        </View>

        <View style={s.form}>
          <View>
            <Text style={s.label}>
              Your Quora Profile URL <Text style={{ color: tok.ACCENT }}>*</Text>
            </Text>
            <View style={[s.inputRow, url ? { borderColor: `${tok.ACCENT}50` } : null]}>
              <ExternalLink size={14} color={tok.MUTED} />
              <TextInput
                value={url}
                onChangeText={onUrlChange}
                onSubmitEditing={() => { if (canSubmit) onSubmit(); }}
                placeholder="https://quora.com/profile/your-name"
                placeholderTextColor={tok.MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={s.input}
              />
            </View>
            <Text style={s.fieldHint}>Make sure your Quora profile is set to public before submitting.</Text>
            {error ? <Text style={s.error}>{error}</Text> : null}
          </View>

          <TouchableOpacity onPress={onSubmit} disabled={!canSubmit} accessibilityRole="button" style={[s.submit, { backgroundColor: canSubmit ? tok.ACCENT : tok.BORDER }]}>
            <Send size={16} color={canSubmit ? '#fff' : tok.MUTED} />
            <Text style={[s.submitText, { color: canSubmit ? '#fff' : tok.MUTED }]}>{submitting ? 'Submitting…' : 'Submit for Verification'}</Text>
          </TouchableOpacity>

          <View>
            <UnlockQuoraHelp onGoHome={onGoHome} />
            <SurveyInviteNote accent={tok.ACCENT} muted={tok.MUTED} title={tok.TITLE} />
          </View>
        </View>

        <View style={s.side}>
          <View style={s.whyCard}>
            <Text style={s.whyHeading}>Why we verify via Quora</Text>
            {WHY.map(({ icon, t, d }) => (
              <View key={t} style={s.whyRow}>
                <Text style={s.whyIcon}>{icon}</Text>
                <View style={s.flex}>
                  <Text style={s.whyTitle}>{t}</Text>
                  <Text style={s.whyDesc}>{d}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.unlocks}>
            <View style={s.unlocksHead}>
              <Shield size={13} color={tok.ACCENT} />
              <Text style={s.unlocksTitle}>What gets unlocked</Text>
            </View>
            {UNLOCK_BENEFITS.map((f) => (
              <View key={f} style={s.unlockRow}>
                <CheckCircle size={11} color={tok.BORDER_SOLID} />
                <Text style={s.unlockText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
        {footer}
      </View>
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, tok: UnlockTokens) {
  const r = (n: number) => (t.isComic ? 0 : n);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tok.BG },
    flex: { flex: 1 },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 28, backgroundColor: tok.HEADER, borderBottomWidth: 1, borderBottomColor: tok.BORDER },
    headerText: { flex: 1, minWidth: 0 },
    headerTitle: { fontSize: 15, fontFamily: interFamily('600'), color: tok.TITLE },
    headerSub: { fontSize: 12, fontFamily: interFamily('400'), color: tok.MUTED },
    content: { paddingVertical: 24, paddingHorizontal: 16, gap: 24 },
    intro: { marginBottom: 28 },
    h1: { fontSize: 26, fontFamily: interFamily('800'), color: tok.TITLE, marginBottom: 10 },
    lead: { fontSize: 14, lineHeight: 23.8, fontFamily: interFamily('400'), color: tok.MUTED },
    form: { gap: 20 },
    label: { fontSize: 13, fontFamily: interFamily('600'), color: tok.SUBTLE, marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: tok.INPUT_BG, borderWidth: 1, borderColor: tok.BORDER_SOLID, borderRadius: r(12) },
    input: { flex: 1, padding: 0, fontSize: 14, fontFamily: interFamily('400'), color: tok.TITLE },
    fieldHint: { fontSize: 11, fontFamily: interFamily('400'), color: tok.FAINT, marginTop: 6 },
    error: { fontSize: 12, fontFamily: interFamily('400'), color: '#F87171', marginTop: 8 },
    submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: r(12) },
    submitText: { fontSize: 15, fontFamily: interFamily('700') },
    side: {},
    whyCard: { padding: 20, borderRadius: r(16), backgroundColor: tok.SURFACE_CARD, borderWidth: 1, borderColor: tok.BORDER_SOLID, marginBottom: 16 },
    whyHeading: { fontSize: 13, fontFamily: interFamily('700'), color: tok.ACCENT, marginBottom: 14 },
    whyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    whyIcon: { fontSize: 16 },
    whyTitle: { fontSize: 13, fontFamily: interFamily('600'), color: tok.TITLE, marginBottom: 2 },
    whyDesc: { fontSize: 12, lineHeight: 18, fontFamily: interFamily('400'), color: tok.MUTED },
    unlocks: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: r(12), backgroundColor: `${tok.ACCENT}06`, borderWidth: 1, borderColor: `${tok.ACCENT}20` },
    unlocksHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
    unlocksTitle: { fontSize: 12, fontFamily: interFamily('600'), color: tok.ACCENT },
    unlockRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
    unlockText: { flex: 1, fontSize: 12, fontFamily: interFamily('400'), color: tok.MUTED },
  });
}
