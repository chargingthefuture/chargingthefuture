// The Unlock status screen, copied from the web's UnlockStatusView and UnlockStatusCard
// (components/unlock/unlock-status-view.tsx, unlock-status-card.tsx): the pinned header with the
// status pill, the status card (welcome on approval, the re-submit form on rejection), the help and
// survey notes side by side, and the ban policy.
//
// The back chevron shows only when the screen has somewhere to go back to (opened from Your
// account); on the wall in front of the app there is nothing behind it. The web header's admin
// shortcut is left out: the app has no Unlock admin screen.

import React, { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, RefreshCw, Unlock as UnlockIcon } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { UNLOCK_REWARD_SLA_HOURS } from './constants';
import { getUnlockTokens, STATUS_CONFIG, type DisplayStatus, type UnlockTokens } from './unlock-tokens';
import { UnlockQuoraHelp } from './UnlockQuoraHelp';
import { SurveyInviteNote, UnlockBanPolicy } from './UnlockNotes';

const SUBTEXT: Record<DisplayStatus, string> = {
  pending: 'Submitted · awaiting admin review',
  approved: 'Reviewed · full access unlocked',
  rejected: 'Reviewed · you can re-submit below',
};

type Props = {
  status: DisplayStatus;
  resubmitUrl: string;
  onResubmitUrlChange: (_value: string) => void;
  onResubmit: () => void;
  submitting: boolean;
  error: string | null;
  onGoHome: () => void;
  onBack?: () => void;
  footer?: ReactNode;
};

type Styles = ReturnType<typeof makeStyles>;

export function UnlockStatusView(props: Props) {
  const { status, onBack } = props;
  const { tokens } = useTheme();
  const tok = getUnlockTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <View style={s.root}>
      <View style={s.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={[s.back, { backgroundColor: `${cfg.color}1A`, borderColor: `${cfg.color}4D` }]}>
            <ChevronLeft size={20} color={cfg.color} />
          </TouchableOpacity>
        ) : null}
        <UnlockIcon size={18} color={cfg.color} />
        <Text style={s.headerTitle}>Unlock</Text>
        <View style={[s.pill, { backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }]}>
          <Icon size={11} color={cfg.color} />
          <Text style={[s.pillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <ScrollView style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <StatusCard s={s} tok={tok} {...props} />
        <View style={s.notes}>
          <UnlockQuoraHelp alreadyVerified={status === 'approved'} onGoHome={props.onGoHome} />
          <SurveyInviteNote accent={tok.ACCENT} muted={tok.MUTED} title={tok.TITLE} />
        </View>
        <UnlockBanPolicy />
        {props.footer}
      </ScrollView>
    </View>
  );
}

function StatusCard({ s, tok, status, resubmitUrl, onResubmitUrlChange, onResubmit, submitting, error, onGoHome }: Props & { s: Styles; tok: UnlockTokens }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const canResubmit = resubmitUrl.trim().length > 0 && !submitting;
  return (
    <View style={s.cardWrap}>
      <View style={[s.card, { backgroundColor: cfg.bg, borderColor: `${cfg.color}25` }]}>
        <View style={s.cardHead}>
          <View style={[s.cardIcon, { backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}30` }]}>
            <Icon size={24} color={cfg.color} />
          </View>
          <View style={s.flex}>
            <Text style={[s.cardLabel, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={s.cardSub}>{SUBTEXT[status]}</Text>
          </View>
        </View>
        {status === 'approved' ? (
          <View style={s.welcome}>
            <Text style={s.welcomeEmoji}>🎉</Text>
            <Text style={s.welcomeTitle}>Welcome to Skills Economy (SE)</Text>
            <Text style={s.welcomeBody}>Your profile has been reviewed. All features are now unlocked.</Text>
            <Text style={s.welcomeReward}>
              Your ServiceCredits reward is issued automatically and arrives within {UNLOCK_REWARD_SLA_HOURS} hours, if not sooner.
            </Text>
            <TouchableOpacity onPress={onGoHome} accessibilityRole="link" style={s.continueBtn}>
              <Text style={s.continueText}>Continue to the Commons</Text>
              <ChevronRight size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
        {status === 'rejected' ? (
          <View style={s.rejected}>
            <Text style={s.rejectedTitle}>Not approved</Text>
            <Text style={s.rejectedBody}>
              Your submission was not approved. Please submit a valid, publicly accessible Quora profile URL below.
            </Text>
          </View>
        ) : null}
      </View>
      {status === 'rejected' ? (
        <View style={s.resubmit}>
          <Text style={s.resubmitTitle}>Re-submit with a new URL</Text>
          <View style={s.resubmitRow}>
            <TextInput
              value={resubmitUrl}
              onChangeText={onResubmitUrlChange}
              onSubmitEditing={() => { if (canResubmit) onResubmit(); }}
              placeholder="https://quora.com/profile/…"
              placeholderTextColor={tok.MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={s.resubmitInput}
            />
            <TouchableOpacity onPress={onResubmit} disabled={!canResubmit} accessibilityRole="button" style={[s.resubmitBtn, canResubmit ? null : s.dim]}>
              <RefreshCw size={13} color="#fff" />
              <Text style={s.resubmitBtnText}>Re-submit</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t: ThemeTokens, tok: UnlockTokens) {
  const r = (n: number) => (t.isComic ? 0 : n);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tok.BG },
    flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: tok.HEADER, borderBottomWidth: 1, borderBottomColor: tok.BORDER_SOLID },
    back: { width: 38, height: 38, borderRadius: r(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 15, fontFamily: interFamily('700'), color: tok.TITLE },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: r(20), borderWidth: 1 },
    pillText: { fontSize: 11, fontFamily: interFamily('600') },
    content: { padding: 16 },
    cardWrap: { maxWidth: 560, width: '100%', alignSelf: 'center', gap: 20 },
    card: { padding: 28, borderRadius: r(18), borderWidth: 1 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    cardIcon: { width: 48, height: 48, borderRadius: r(14), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    cardLabel: { fontSize: 20, fontFamily: interFamily('800') },
    cardSub: { fontSize: 13, fontFamily: interFamily('400'), color: tok.MUTED },
    welcome: { padding: 14, borderRadius: r(12), backgroundColor: `${tok.ACCENT}08`, borderWidth: 1, borderColor: `${tok.ACCENT}20`, alignItems: 'center' },
    welcomeEmoji: { fontSize: 28 },
    welcomeTitle: { fontSize: 16, fontFamily: interFamily('700'), color: tok.ACCENT, marginTop: 6, textAlign: 'center' },
    welcomeBody: { fontSize: 13, fontFamily: interFamily('400'), color: tok.MUTED, marginTop: 4, textAlign: 'center' },
    welcomeReward: { fontSize: 12, lineHeight: 18, fontFamily: interFamily('400'), color: tok.MUTED, marginTop: 10, textAlign: 'center' },
    continueBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 24, borderRadius: r(10), backgroundColor: tok.ACCENT, flexDirection: 'row', alignItems: 'center', gap: 6 },
    continueText: { fontSize: 13, fontFamily: interFamily('700'), color: '#fff' },
    rejected: { padding: 14, borderRadius: r(12), backgroundColor: 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    rejectedTitle: { fontSize: 13, fontFamily: interFamily('600'), color: '#EF4444', marginBottom: 4 },
    rejectedBody: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400'), color: tok.TITLE },
    resubmit: { padding: 20, borderRadius: r(14), backgroundColor: tok.SURFACE_CARD, borderWidth: 1, borderColor: tok.BORDER_SOLID },
    resubmitTitle: { fontSize: 14, fontFamily: interFamily('600'), color: tok.TITLE, marginBottom: 12 },
    resubmitRow: { flexDirection: 'row', gap: 10 },
    resubmitInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: tok.BG, borderWidth: 1, borderColor: tok.BORDER_SOLID, borderRadius: r(10), fontSize: 13, fontFamily: interFamily('400'), color: tok.TITLE },
    resubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: r(10), backgroundColor: tok.ACCENT },
    resubmitBtnText: { fontSize: 13, fontFamily: interFamily('700'), color: '#fff' },
    dim: { opacity: 0.6 },
    error: { fontSize: 12, fontFamily: interFamily('400'), color: '#F87171', marginTop: 8 },
    notes: { flexDirection: 'row', justifyContent: 'center' },
  });
}
