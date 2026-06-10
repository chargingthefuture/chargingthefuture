// Contributions admin mobile screen — pixel pass to design/.../survivor-hub/
// MobileContributionsAdmin.tsx. Owner-only on the server; the API returns 401/403 to non-admins,
// which surfaces here as a forbidden notice. Three tabs: Queue (review confirm/reject with the
// resulting-SC helper), Drive (read-only summary of the current cycle), Settings (read-only view
// of the credit knobs). The richer create/edit flows live on the web admin console; this mirrors
// the review path one-to-one, which is the day-to-day admin action on mobile.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import {
  fetchAdminConfig,
  fetchAdminSubmissions,
  fetchFundraiser,
  reviewSubmission,
  type ContributionSubmissionAdminView,
  type ContributionsRuntimeConfig,
  type ContributionStatus,
  type FundraiserResponse,
} from './ContributionsApi';

const COLOR = '#F472B6';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT_COLOR = '#F9FAFB';
const SUBTLE = '#6B7280';

type Tab = 'queue' | 'drive' | 'settings';
type FilterKey = 'all' | 'pending' | 'confirmed' | 'rejected';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Not matched' },
];

function statusColor(status: string): string {
  if (status === 'confirmed') {
    return '#22C55E';
  }
  if (status === 'pending') {
    return '#F59E0B';
  }
  return SUBTLE;
}

function statusLabel(status: string): string {
  if (status === 'confirmed') {
    return 'Confirmed';
  }
  if (status === 'pending') {
    return 'Waiting';
  }
  return 'Not matched';
}

function kindLabel(sub: ContributionSubmissionAdminView): string {
  if (sub.kind === 'gift_card') {
    const method = sub.method ? sub.method.charAt(0).toUpperCase() + sub.method.slice(1) : '';
    return `Gift card${method ? ` (${method})` : ''}`;
  }
  return sub.kind === 'quora_comment' ? 'Quora comment' : 'GitHub star';
}

function QueueRow({
  row,
  config,
  reviewing,
  onReview,
}: {
  row: ContributionSubmissionAdminView;
  config: ContributionsRuntimeConfig | null;
  reviewing: boolean;
  onReview: (_id: string, _body: { action: 'confirm' | 'reject'; confirmedAmountUsd?: number; reviewNote?: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isGiftCard = row.kind === 'gift_card';
  const [value, setValue] = useState(String(row.confirmedAmountUsd ?? (isGiftCard ? row.claimedAmountUsd ?? '' : config?.nonMonetaryUnitValueUsd ?? 1)));
  const creditsPerUsd = config?.creditsPerUsd ?? 10;
  const resultingSc = Math.round((Number(value) || 0) * creditsPerUsd);
  const sc = statusColor(row.status);
  const isPending = row.status === 'pending';

  return (
    <View style={st.queueRow}>
      <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={st.queueHead}>
        <View style={{ flex: 1 }}>
          <Text style={st.member}>{row.userId}</Text>
          <Text style={st.kindLine}>{kindLabel(row)}</Text>
          {row.signalContact ? <Text style={st.signalLine}>Signal: {row.signalContact}</Text> : null}
        </View>
        <View style={[st.statusPill, { backgroundColor: `${sc}15` }]}>
          <Text style={[st.statusPillText, { color: sc }]}>{statusLabel(row.status)}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={st.reviewPanel}>
          <View style={st.valueRow}>
            <Text style={st.fieldLabel}>Confirmed value $</Text>
            <TextInput value={value} onChangeText={setValue} editable={isPending} keyboardType="numeric" style={st.valueInput} />
            <Text style={st.scHint}>→ {resultingSc} SC</Text>
          </View>
          {isPending ? (
            <View style={st.actions}>
              <TouchableOpacity
                disabled={reviewing}
                onPress={() => onReview(row.id, { action: 'confirm', confirmedAmountUsd: Number(value) || undefined })}
                style={[st.confirmBtn, { opacity: reviewing ? 0.6 : 1 }]}
              >
                <Text style={st.confirmText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={reviewing} onPress={() => onReview(row.id, { action: 'reject' })} style={[st.rejectBtn, { opacity: reviewing ? 0.6 : 1 }]}>
                <Text style={st.rejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={st.reviewedText}>Already reviewed{row.reviewNote ? ` — ${row.reviewNote}` : ''}.</Text>
          )}
        </View>
      )}
    </View>
  );
}

export const ContributionsAdmin: React.FC = () => {
  const [tab, setTab] = useState<Tab>('queue');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [submissions, setSubmissions] = useState<ContributionSubmissionAdminView[]>([]);
  const [config, setConfig] = useState<ContributionsRuntimeConfig | null>(null);
  const [fundraiser, setFundraiser] = useState<FundraiserResponse | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function loadQueue(f: FilterKey) {
    try {
      setSubmissions(await fetchAdminSubmissions(f === 'all' ? undefined : (f as ContributionStatus)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('403') || msg.includes('401') || msg.toLowerCase().includes('forbidden')) {
        setForbidden(true);
      } else {
        setError(msg || 'Could not load the queue.');
      }
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [subs, cfg, f] = await Promise.all([fetchAdminSubmissions(), fetchAdminConfig().catch(() => null), fetchFundraiser().catch(() => null)]);
        setSubmissions(subs);
        setConfig(cfg);
        setFundraiser(f);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('403') || msg.includes('401') || msg.toLowerCase().includes('forbidden')) {
          setForbidden(true);
        } else {
          setError(msg || 'Could not load the admin console.');
        }
      }
    }
    void load();
  }, []);

  async function onReview(id: string, body: { action: 'confirm' | 'reject'; confirmedAmountUsd?: number; reviewNote?: string }) {
    setReviewing(id);
    setError(null);
    try {
      await reviewSubmission(id, body);
      await loadQueue(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setReviewing(null);
    }
  }

  if (forbidden) {
    return (
      <View style={[st.fill, st.center]}>
        <Text style={st.headerTitle}>Admin only</Text>
        <Text style={[st.bodyText, { textAlign: 'center', marginTop: 8 }]}>This console is available to the platform owner only.</Text>
      </View>
    );
  }

  const cycle = fundraiser?.fundraiser.cycle ?? null;
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  return (
    <View style={st.fill}>
      <View style={st.header}>
        <Text style={st.headerTitle}>Contributions Admin</Text>
      </View>
      <View style={st.tabBar}>
        {(['queue', 'drive', 'settings'] as Tab[]).map((k) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabActive]}>
            <Text style={[st.tabText, { color: tab === k ? COLOR : SUBTLE, fontWeight: tab === k ? '700' : '400' }]}>
              {k === 'queue' ? `Queue${pendingCount > 0 ? ` (${pendingCount})` : ''}` : k === 'drive' ? 'Drive' : 'Settings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={[st.errorText, { paddingHorizontal: 14, paddingTop: 8 }]}>{error}</Text> : null}

      {tab === 'queue' && (
        <>
          <View style={st.filterBar}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => {
                  setFilter(f.key);
                  void loadQueue(f.key);
                }}
                style={[st.filterChip, { backgroundColor: filter === f.key ? COLOR : BORDER }]}
              >
                <Text style={[st.filterChipText, { color: filter === f.key ? '#fff' : SUBTLE }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: BG }}>
            {submissions.length === 0 ? <Text style={[st.bodyText, { padding: 16 }]}>No submissions match this view.</Text> : null}
            {submissions.map((row) => (
              <QueueRow key={row.id} row={row} config={config} reviewing={reviewing === row.id} onReview={onReview} />
            ))}
          </ScrollView>
        </>
      )}

      {tab === 'drive' && (
        <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 14 }}>
          <Text style={st.sectionHeading}>Active drive</Text>
          {cycle ? (
            <View style={st.infoCard}>
              <Text style={st.infoRow}>Window: {new Date(cycle.startsAt).toLocaleDateString()} → {new Date(cycle.endsAt).toLocaleDateString()}</Text>
              <Text style={st.infoRow}>Funding goal: ${cycle.fiatGoalUsd.toLocaleString()}</Text>
              <Text style={st.infoRow}>Quora goal: {cycle.quoraCommentGoal}</Text>
              <Text style={st.infoRow}>GitHub stars goal: {cycle.githubStarGoal}</Text>
            </View>
          ) : (
            <Text style={st.bodyText}>No active drive. Start one from the web admin console.</Text>
          )}
        </ScrollView>
      )}

      {tab === 'settings' && (
        <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 14 }}>
          <Text style={st.sectionHeading}>Service Credits</Text>
          {config ? (
            <View style={st.infoCard}>
              <Text style={st.infoRow}>Credits per dollar: {config.creditsPerUsd}</Text>
              <Text style={st.infoRow}>Credits per comment or star: {Math.round(config.nonMonetaryUnitValueUsd * config.creditsPerUsd)}</Text>
              <Text style={st.infoRow}>Per-member per-drive cap: {config.perUserCycleCreditCap} SC</Text>
              <Text style={st.infoRow}>Fundraiser banner: {config.bannerEnabled ? 'On' : 'Off'}</Text>
            </View>
          ) : (
            <Text style={st.bodyText}>Settings unavailable.</Text>
          )}
          <Text style={[st.bodyText, { marginTop: 12 }]}>Edit these values and the Signal instructions from the web admin console.</Text>
        </ScrollView>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { padding: 16, paddingBottom: 10, backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR },
  bodyText: { fontSize: 13, color: SUBTLE, lineHeight: 20 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: BG },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLOR },
  tabText: { fontSize: 12 },
  filterBar: { flexDirection: 'row', gap: 6, padding: 12, borderBottomWidth: 1, borderBottomColor: BORDER, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  filterChipText: { fontSize: 11, fontWeight: '500' },
  queueRow: { borderBottomWidth: 1, borderBottomColor: BORDER },
  queueHead: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 8 },
  member: { fontSize: 13, fontWeight: '600', color: TEXT_COLOR },
  kindLine: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  signalLine: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontWeight: '600' },
  reviewPanel: { padding: 12, backgroundColor: `${COLOR}04`, borderTopWidth: 1, borderTopColor: BORDER },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fieldLabel: { fontSize: 11, color: SUBTLE },
  valueInput: { width: 60, padding: 6, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 7, fontSize: 12, color: TEXT_COLOR },
  scHint: { fontSize: 11, color: SUBTLE },
  actions: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, backgroundColor: '#22C55E', paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  confirmText: { fontSize: 12, fontWeight: '600', color: '#000' },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: '#EF4444', paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  rejectText: { fontSize: 12, color: '#EF4444' },
  reviewedText: { fontSize: 12, color: SUBTLE },
  errorText: { fontSize: 12, color: '#F87171' },
  sectionHeading: { fontSize: 14, fontWeight: '600', color: TEXT_COLOR, marginBottom: 12 },
  infoCard: { backgroundColor: SURFACE, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER },
  infoRow: { fontSize: 13, color: TEXT_COLOR, marginBottom: 8 },
});
