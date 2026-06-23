import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { fetchTrustSelf, TrustUserExtension, TrustEvidenceItem } from './api';

// Brand palette from design mockup (MobileTrust.tsx)
const BRAND = '#0EA5E9';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

// ── Loading state ─────────────────────────────────────────────────────────────

function TrustLoadingView() {
  return (
    <View style={styles.loadingRoot}>
      <Text style={styles.loadingTagline}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingTagline}>EXIT THE PSYOP</Text>
    </View>
  );
}

// ── Public / unauthenticated state ────────────────────────────────────────────
// Shown when the API returns 401/403 (unauthenticated visitor).

const PUBLIC_SIGNALS = [
  'Identity verification',
  'Survivor-status attestation',
  'Service Credit history',
  'Community peer vouches',
  'Cohort completion record',
];

function TrustPublicView() {
  return (
    <ScrollView style={styles.publicRoot} contentContainerStyle={styles.publicContent}>
      <Text style={styles.publicTitle}>Trust</Text>
      <Text style={styles.publicTagline}>Privacy-respecting identity</Text>
      <Text style={styles.publicHeadline}>
        {'Prove you\'re real.\n'}
        <Text style={{ color: BRAND }}>Without exposing who you are.</Text>
      </Text>
      <Text style={styles.publicDesc}>
        Trust aggregates voluntary signals to establish credibility. Providers and peers can trust
        you — you reveal nothing beyond what you choose.
      </Text>
      {PUBLIC_SIGNALS.map((s) => (
        <React.Fragment key={s}>
          <View style={styles.publicSignalRow}>
            <View style={styles.publicSignalDot} />
            <Text style={styles.publicSignalText}>{s}</Text>
          </View>
        </React.Fragment>
      ))}
      <View style={styles.previewCard}>
        <View style={styles.previewIconWrap}>
          <Text style={styles.previewIconText}>🛡</Text>
        </View>
        <Text style={styles.previewScoreLabel}>Your Trust Score</Text>
        <Text style={styles.previewScoreDash}>—</Text>
        <Text style={styles.previewSignIn}>Sign in to build yours</Text>
      </View>
    </ScrollView>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
// Authenticated user with no evidence yet.

function TrustEmptyView({ visibility }: { visibility: string }) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🛡</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Trust</Text>
            <Text style={styles.headerSubtitle}>Signals</Text>
          </View>
        </View>
      </View>

      {/* Empty illustration */}
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyCircleOuter}>
          <View style={styles.emptyCircleInner}>
            <Text style={styles.emptyIconLarge}>🛡</Text>
          </View>
        </View>
        <Text style={styles.emptyTitle}>No trust signals yet</Text>
        <Text style={styles.emptyDesc}>
          Trust builds through community participation. Start with the steps below.
        </Text>
      </View>

      {/* Score card at zero */}
      <View style={styles.scoreCard}>
        <Text style={styles.sectionLabel}>TRUST SCORE</Text>
        <View style={styles.statsRow}>
          {([
            { label: 'Last Active', value: '—' },
            { label: 'Activity', value: '—' },
            { label: 'Transactions', value: '0' },
            { label: 'Active Plugins', value: '0' },
          ] as { label: string; value: string }[]).map(({ label, value }) => (
            <React.Fragment key={label}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: SUBTLE }]}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Signal progress</Text>
          <Text style={[styles.progressPct, { color: SUBTLE }]}>0%</Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>
      </View>

      {/* Visibility (display-only; update route is a stub) */}
      <View style={styles.visCard}>
        <Text style={styles.visLabel}>Visible to: {capitalise(visibility)}</Text>
      </View>
    </ScrollView>
  );
}

// ── Main (populated) state ────────────────────────────────────────────────────

function TrustMainView({ trust }: { trust: TrustUserExtension }) {
  const visibility = trust.trustVisibility;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🛡</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Trust</Text>
            <Text style={styles.headerSubtitle}>Signals</Text>
          </View>
        </View>
      </View>

      {/* Visibility (display-only; POST /api/trust/visibility is a stub) */}
      <View style={styles.visCardFull}>
        <Text style={styles.visFullLabel}>VISIBILITY</Text>
        <View style={styles.visRow}>
          <Text style={styles.visRowText}>Visible to: {capitalise(visibility)}</Text>
        </View>
      </View>

      {/* Trust evidence (real API field: trustEvidence array) */}
      <View style={styles.evidenceCard}>
        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        {trust.trustEvidence.map((item: TrustEvidenceItem, i: number) => (
          <React.Fragment key={`${item.type}-${i}`}>
            <View
              style={[
                styles.evidenceRow,
                i === trust.trustEvidence.length - 1 && styles.evidenceRowLast,
              ]}
            >
              <View style={styles.evidenceIconWrap}>
                <Text style={styles.evidenceIconText}>✦</Text>
              </View>
              <View style={styles.evidenceBody}>
                <Text style={styles.evidenceLabel}>{item.summary}</Text>
                <Text style={styles.evidenceTime}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Root screen ───────────────────────────────────────────────────────────────

export const Trust: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [trust, setTrust] = useState<TrustUserExtension | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTrustSelf()
      .then((data) => {
        if (!cancelled) {
          setTrust(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Treat auth errors as unauthenticated/public view
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
            setUnauthenticated(true);
          } else {
            setError(msg);
          }
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <TrustLoadingView />;
  if (unauthenticated) return <TrustPublicView />;
  if (error) {
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchTrustSelf()
              .then((data) => { setTrust(data); setLoading(false); })
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : String(e));
                setLoading(false);
              });
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!trust || trust.trustEvidence.length === 0) {
    return <TrustEmptyView visibility={trust?.trustVisibility ?? 'public'} />;
  }
  return <TrustMainView trust={trust} />;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Loading
  loadingRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingTagline: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 14,
    textAlign: 'center',
  },
  // Public
  publicRoot: { flex: 1, backgroundColor: BG },
  publicContent: { padding: 20, paddingBottom: 40 },
  publicTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 8 },
  publicTagline: {
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: BRAND + '20',
    borderWidth: 1,
    borderColor: BRAND + '40',
    fontSize: 11,
    color: BRAND,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 12,
    overflow: 'hidden',
  },
  publicHeadline: { fontSize: 22, fontWeight: '800', color: TEXT, lineHeight: 28, marginBottom: 12 },
  publicDesc: { fontSize: 14, color: '#9CA3AF', lineHeight: 21, marginBottom: 16 },
  publicSignalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  publicSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND,
  },
  publicSignalText: { fontSize: 13, color: '#D1D5DB' },
  previewCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND + '30',
    padding: 20,
    backgroundColor: BRAND + '06',
    alignItems: 'center',
    gap: 8,
  },
  previewIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: BRAND,
    backgroundColor: BRAND + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  previewIconText: { fontSize: 26 },
  previewScoreLabel: { fontSize: 11, color: SUBTLE },
  previewScoreDash: { fontSize: 28, fontWeight: '900', color: BRAND, marginTop: 2 },
  previewSignIn: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  // Shared screen root
  root: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingBottom: 32 },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BRAND + '15',
    borderWidth: 1,
    borderColor: BRAND + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  headerSubtitle: { fontSize: 11, color: SUBTLE },
  // Empty state
  emptyIllustration: { alignItems: 'center', textAlign: 'center', marginVertical: 24, paddingHorizontal: 16 },
  emptyCircleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: BRAND + '30',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCircleInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND + '08',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconLarge: { fontSize: 28, opacity: 0.3 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: SUBTLE, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  // Score card
  scoreCard: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND + '20',
    padding: 16,
    backgroundColor: SURFACE,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 12, fontWeight: '700', color: TEXT },
  statLabel: { fontSize: 9, color: '#4B5563', marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, color: SUBTLE },
  progressPct: { fontSize: 11, fontWeight: '700' },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND + '15',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: BRAND },
  // Visibility card (empty state)
  visCard: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    backgroundColor: SURFACE,
  },
  visLabel: { fontSize: 12, color: SUBTLE },
  // Visibility card (populated state)
  visCardFull: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    backgroundColor: SURFACE,
  },
  visFullLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  visRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 10,
  },
  visRowText: { fontSize: 13, fontWeight: '500', color: TEXT },
  // Evidence card
  evidenceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    backgroundColor: SURFACE,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  evidenceRowLast: { borderBottomWidth: 0 },
  evidenceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BRAND + '12',
    borderWidth: 1,
    borderColor: BRAND + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  evidenceIconText: { fontSize: 14, color: BRAND },
  evidenceBody: { flex: 1 },
  evidenceLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  evidenceTime: { fontSize: 11, color: SUBTLE },
  // Error
  errorRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: { color: '#EF4444', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    backgroundColor: BRAND + '20',
    borderWidth: 1,
    borderColor: BRAND + '40',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: BRAND, fontSize: 14, fontWeight: '700' },
});
