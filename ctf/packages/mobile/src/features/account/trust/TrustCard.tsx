// The member's own Trust card, copied from the web's TrustWidgetCard with isOwnCard
// (components/trust/TrustWidgetCard.tsx, trust-evidence-row.tsx, trust-member-view.tsx) as the
// account hub shows it: the Trust header, then either the empty state with its three steps, or
// "Your trust" (every signal) followed by "What members see" (the rows another member receives).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Eye, ShieldCheck } from 'lucide-react-native';
import { getAppAccent, useTheme, type ThemeTokens } from '../../../theme';
import { interFamily } from '../../../components/ui';
import { radius } from '../tokens';
import { summarizeTrustEvidenceForPeer } from './peer-summary';
import type { TrustPeerEvidenceItem } from './api';

const CARD_BG = 'rgba(14,165,233,0.06)';
const CARD_BORDER = 'rgba(14,165,233,0.18)';
const HAIRLINE = 'rgba(255,255,255,0.05)';
const STEPS = ['Complete your profile', 'Make your first transaction', 'Use at least one plugin'];

// The web's getTrustTokens: the plugin shell's text shades and the Trust accent.
function trustTokens(t: ThemeTokens) {
  return t.isComic
    ? { ACCENT: getAppAccent('trust', 'comic'), SUBTLE: '#7A6A50', MUTED: '#7A6A50', FAINT: '#4A3A2A' }
    : { ACCENT: '#0EA5E9', SUBTLE: '#9CA3AF', MUTED: '#6B7280', FAINT: '#4B5563' };
}

type Styles = ReturnType<typeof makeStyles>;

export function TrustCard({ evidence }: { evidence: TrustPeerEvidenceItem[] }) {
  const { tokens } = useTheme();
  const tt = trustTokens(tokens);
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.card}>
      <View style={s.head}>
        <ShieldCheck size={14} color={tt.ACCENT} />
        <Text style={s.headText}>Trust</Text>
      </View>
      {evidence.length > 0 ? <EvidenceBody s={s} evidence={evidence} /> : <EmptyBody s={s} />}
    </View>
  );
}

function EmptyBody({ s }: { s: Styles }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyTop}>
        <View style={s.emptyRing}>
          <ShieldCheck size={22} color="rgba(14,165,233,0.4)" />
        </View>
        <Text style={s.emptyTitle}>No trust signals yet</Text>
        <Text style={s.emptyBody}>Trust signals appear as you participate in the community</Text>
      </View>
      <View style={s.steps}>
        {STEPS.map((label) => (
          <View key={label} style={s.step}>
            <View style={s.stepCircle} />
            <Text style={s.stepText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EvidenceBody({ s, evidence }: { s: Styles; evidence: TrustPeerEvidenceItem[] }) {
  const peerRows = summarizeTrustEvidenceForPeer(evidence);
  return (
    <View style={s.evidenceWrap}>
      <Text style={[s.sectionLabel, s.sectionLabelTop]}>Your trust</Text>
      <View style={s.ownList}>
        {evidence.map((item, idx) => (
          <EvidenceRow key={`${item.type}-${idx}`} s={s} item={item} />
        ))}
      </View>
      <View style={s.memberView}>
        <Text style={[s.sectionLabel, s.memberLabel]}>What members see</Text>
        <Text style={s.memberNote}>
          Any member who opens your profile sees this, and only this. You cannot change it and neither can they.
        </Text>
        {peerRows.length === 0 ? (
          <Text style={s.memberEmpty}>Nothing yet — a line appears here once you have taken part somewhere.</Text>
        ) : (
          <View style={s.memberBox}>
            <SummaryNote s={s} />
            {peerRows.map((item, idx) => (
              <EvidenceRow key={`${item.type}-${idx}`} s={s} item={item} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function SummaryNote({ s }: { s: Styles }) {
  const { tokens } = useTheme();
  return (
    <View style={s.noteRow}>
      <Eye size={11} color={trustTokens(tokens).FAINT} />
      <Text style={s.noteText}>This member shares a summary of their participation, not the detail.</Text>
    </View>
  );
}

function humanizeType(type: string): string {
  const words = (type || '').replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Trust signal';
}

function formatEvidenceDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

function EvidenceRow({ s, item }: { s: Styles; item: TrustPeerEvidenceItem }) {
  const date = formatEvidenceDate(item.createdAt);
  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <CheckCircle2 size={12} color="#38BDF8" />
        <Text style={s.rowSummary}>{item.summary && item.summary.trim() ? item.summary : humanizeType(item.type)}</Text>
        {date ? <Text style={s.rowDate}>{date}</Text> : null}
      </View>
      {item.details ? <Text style={s.rowDetails}>{item.details}</Text> : null}
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  const tt = trustTokens(t);
  return StyleSheet.create({
    card: { borderRadius: radius(t, 12), backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden', marginBottom: 16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10 },
    headText: { fontSize: 12, fontFamily: interFamily('700'), color: '#38BDF8', letterSpacing: 0.72, textTransform: 'uppercase' },
    emptyWrap: { paddingTop: 4, paddingHorizontal: 14, paddingBottom: 14 },
    emptyTop: { alignItems: 'center', paddingTop: 16, paddingBottom: 14, borderTopWidth: 1, borderTopColor: HAIRLINE },
    emptyRing: { width: 48, height: 48, borderRadius: radius(t, 24), borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(14,165,233,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    emptyTitle: { fontSize: 13, fontFamily: interFamily('600'), color: tt.SUBTLE, marginBottom: 4 },
    emptyBody: { fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400'), color: tt.FAINT, textAlign: 'center' },
    steps: { gap: 6, marginBottom: 12 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radius(t, 8), borderWidth: 1, borderColor: HAIRLINE },
    stepCircle: { width: 16, height: 16, borderRadius: radius(t, 8), borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
    stepText: { fontSize: 11, fontFamily: interFamily('400'), color: tt.MUTED },
    evidenceWrap: { paddingTop: 4, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: HAIRLINE },
    sectionLabel: { fontSize: 10, fontFamily: interFamily('700'), color: tt.FAINT, textTransform: 'uppercase', letterSpacing: 0.6 },
    sectionLabelTop: { marginTop: 12 },
    ownList: { gap: 6, marginTop: 7, marginBottom: 10 },
    memberView: { paddingTop: 7, borderTopWidth: 1, borderTopColor: HAIRLINE },
    memberLabel: { marginTop: 4 },
    memberNote: { fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400'), color: tt.MUTED, marginTop: 6 },
    memberEmpty: { fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400'), color: tt.MUTED, marginTop: 8 },
    memberBox: { marginTop: 8, padding: 10, borderRadius: radius(t, 8), backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: HAIRLINE, gap: 6 },
    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    noteText: { flex: 1, fontSize: 10, lineHeight: 15, fontFamily: interFamily('400'), color: tt.MUTED },
    row: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius(t, 8), paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: HAIRLINE },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowSummary: { flex: 1, minWidth: 0, fontSize: 11, fontFamily: interFamily('600'), color: '#E2E8F0' },
    rowDate: { fontSize: 10, fontFamily: interFamily('400'), color: tt.FAINT },
    rowDetails: { fontSize: 10, lineHeight: 15, fontFamily: interFamily('400'), color: tt.MUTED, marginTop: 3 },
  });
}
