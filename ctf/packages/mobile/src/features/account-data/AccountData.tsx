// Real Account & Data screen — pixel-pass to
// design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileAccountData.tsx
// (plus MobileAccountDataEmpty / MobileAccountDataConfirmDelete states).
//
// API bindings: GET /api/account/services, DELETE /api/account/services/:slug,
// DELETE /api/account/full-account. Service names and summaries come from the live registry
// projection — never hardcoded here.
//
// Omissions vs mockup (no backing API): "Export your data" and "Deactivate instead" controls are
// not rendered — there is no export or deactivate endpoint, and the real-data-only rule forbids
// dead buttons.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchAccountServices,
  deleteServiceData,
  deleteFullAccount,
  type AccountService,
} from './api';

const BRAND = '#E91E8C';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const DANGER = '#EF4444';

const CONFIRM_PHRASE = 'delete my account';

const SERVICE_GLYPH: Record<string, string> = {
  chyme: '💬', directory: '📇', 'feed-announcements': '📣', foundation: '🪛', mood: '🌿',
  gentlepulse: '🎵', 'peer-programming': '👥', lighthouse: '🏠', socketrelay: '🔂',
  trusttransport: '📦', trust: '🛡️', workforce: '💼', 'skills-hunt': '🎯',
  'skills-taxonomy': '🗂️', unlock: '🔓', levelup: '🚀', clicklog: '🚨', comic: '🤖',
  feedback: '💬', 'service-credits': '⚙️', 'gross-domestic-product': '📊', 'weekly-performance': '📊',
};

function glyph(slug: string): string {
  return SERVICE_GLYPH[slug] ?? '📁';
}

type Tab = 'data' | 'danger';

export function AccountData() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletable, setDeletable] = useState<AccountService[]>([]);
  const [retained, setRetained] = useState<AccountService[]>([]);
  const [deletedSlugs, setDeletedSlugs] = useState<string[]>([]);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ slug: string; message: string } | null>(null);
  const [tab, setTab] = useState<Tab>('data');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchAccountServices()
      .then((data) => {
        setDeletable(data.deletable ?? []);
        setRetained(data.retained ?? []);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remaining = useMemo(
    () => deletable.filter((s) => !deletedSlugs.includes(s.slug)),
    [deletable, deletedSlugs],
  );
  const totalServices = deletable.length + retained.length;

  const handleDeleteService = useCallback((service: AccountService) => {
    Alert.alert(
      `Delete your ${service.name} data?`,
      `${service.summary}\n\nThis is permanent and cannot be undone. Some audit records may be retained for platform integrity. Your account stays open.`,
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setPendingSlug(service.slug);
            setRowError(null);
            try {
              await deleteServiceData(service.slug);
              setDeletedSlugs((prev) => (prev.includes(service.slug) ? prev : [...prev, service.slug]));
            } catch (e) {
              setRowError({ slug: service.slug, message: e instanceof Error ? e.message : 'Unable to delete this data.' });
            } finally {
              setPendingSlug(null);
            }
          },
        },
      ],
    );
  }, []);

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={BRAND} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.errTitle}>We couldn&apos;t load your data</Text>
        <Text style={s.errSub}>Please try again.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load} accessibilityRole="button">
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (confirmOpen) {
    return (
      <ConfirmDelete
        serviceCount={totalServices}
        onCancel={() => setConfirmOpen(false)}
      />
    );
  }

  const isEmpty = remaining.length === 0;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerIcon}>
            <Text style={s.headerIconText}>🛡</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>Account &amp; Data</Text>
            <Text style={s.headerSub}>{totalServices} services · your control</Text>
          </View>
        </View>
        <View style={s.tabRow}>
          {(['data', 'danger'] as Tab[]).map((t) => {
            const active = tab === t;
            const danger = t === 'danger';
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[
                  s.tab,
                  active && (danger ? s.tabDangerActive : s.tabActive),
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.tabText, active && (danger ? s.tabTextDangerActive : s.tabTextActive)]}>
                  {t === 'data' ? 'Your Data' : '⚠️ Danger Zone'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {tab === 'data' ? (
          isEmpty ? (
            <EmptyState hasRetained={retained.length > 0} />
          ) : (
            <>
              <View style={s.notice}>
                <Text style={s.noticeText}>
                  Deleting from a service is permanent. Some audit records are retained for platform integrity.
                </Text>
              </View>

              <Text style={s.sectionLabel}>Personal data — {remaining.length} {remaining.length === 1 ? 'service' : 'services'}</Text>
              <View style={s.list}>
                {remaining.map((service) => {
                  const isPending = pendingSlug === service.slug;
                  const error = rowError?.slug === service.slug ? rowError.message : null;
                  return (
                    <View key={service.slug} style={[s.row, error ? s.rowError : null, isPending && s.rowPending]}>
                      <View style={s.rowGlyph}>
                        <Text style={s.rowGlyphText}>{glyph(service.slug)}</Text>
                      </View>
                      <View style={s.rowBody}>
                        <Text style={s.rowName}>{service.name}</Text>
                        <Text style={[s.rowSummary, error ? s.rowSummaryError : null]}>{error ?? service.summary}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteService(service)}
                        disabled={isPending}
                        style={s.deleteBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete your ${service.name} data`}
                      >
                        {isPending ? <ActivityIndicator color={DANGER} size="small" /> : <Text style={s.deleteBtnText}>🗑</Text>}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {retained.length > 0 ? (
                <>
                  <Text style={s.sectionLabel}>Always retained — {retained.length} {retained.length === 1 ? 'service' : 'services'}</Text>
                  <View style={s.list}>
                    {retained.map((service) => (
                      <View key={service.slug} style={s.retainedRow}>
                        <View style={s.retainedGlyph}>
                          <Text style={s.rowGlyphText}>{glyph(service.slug)}</Text>
                        </View>
                        <View style={s.rowBody}>
                          <View style={s.retainedNameRow}>
                            <Text style={s.retainedName}>{service.name}</Text>
                            <Text style={s.lockGlyph}>🔒</Text>
                          </View>
                          <Text style={s.retainedReason}>{service.summary}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )
        ) : (
          <DangerZone serviceCount={totalServices} onContinue={() => setConfirmOpen(true)} />
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({ hasRetained }: { hasRetained: boolean }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyAnchor}>
        <Text style={s.emptyAnchorText}>🛡</Text>
      </View>
      <Text style={s.emptyTitle}>No personal data stored yet</Text>
      <Text style={s.emptySub}>
        As you use Survivor Hub apps, any personal data they hold will appear here for you to see and delete.
      </Text>
      {hasRetained ? (
        <View style={s.notice}>
          <Text style={s.noticeText}>
            ServiceCredits ledger and community totals are always retained for financial integrity. They hold no personal identifiers.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DangerZone({ serviceCount, onContinue }: { serviceCount: number; onContinue: () => void }) {
  const points: Array<{ t: string; warn: boolean }> = [
    { t: 'All personal data permanently deleted', warn: true },
    { t: 'ServiceCredits settled via standard process', warn: false },
    { t: 'Audit records retained (by design)', warn: false },
    { t: 'Profile removed from all directories', warn: true },
  ];
  return (
    <View style={s.dangerCard}>
      <Text style={s.dangerTitle}>⚠️ Delete Entire Account</Text>
      <Text style={s.dangerBody}>
        Removes your profile and all personal data across all {serviceCount} services. Your ServiceCredits are settled — not destroyed. Some audit records are retained by design.
      </Text>
      {points.map((p, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={[s.bulletDot, { backgroundColor: p.warn ? DANGER : '#4B5563' }]} />
          <Text style={[s.bulletText, p.warn ? s.bulletTextWarn : null]}>{p.t}</Text>
        </View>
      ))}
      <TouchableOpacity style={s.dangerBtn} onPress={onContinue} accessibilityRole="button">
        <Text style={s.dangerBtnText}>Continue to confirmation</Text>
      </TouchableOpacity>
    </View>
  );
}

function ConfirmDelete({ serviceCount, onCancel }: { serviceCount: number; onCancel: () => void }) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ready = input.toLowerCase().trim() === CONFIRM_PHRASE && status !== 'submitting';

  const handleConfirm = useCallback(async () => {
    if (input.toLowerCase().trim() !== CONFIRM_PHRASE || status === 'submitting') return;
    setStatus('submitting');
    setErrorMessage(null);
    try {
      await deleteFullAccount();
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unable to complete deletion.');
    }
  }, [input, status]);

  if (status === 'done') {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.doneGlyph}>✅</Text>
        <Text style={s.doneTitle}>Deletion queued</Text>
        <Text style={s.doneSub}>
          Your request has been received. Your personal data is being removed across all services, and your ServiceCredits balance will be settled through the standard process. Some audit records are retained for platform integrity.
        </Text>
      </View>
    );
  }

  const points: Array<{ t: string; warn: boolean }> = [
    { t: `All personal data deleted across ${serviceCount} services`, warn: true },
    { t: 'ServiceCredits balance settled via standard process — not destroyed', warn: false },
    { t: 'Some audit records retained for platform integrity — intentional', warn: false },
    { t: 'Your profile and username removed from all directories', warn: true },
  ];

  return (
    <View style={s.root}>
      <View style={s.confirmHeader}>
        <View style={s.confirmHeaderIcon}>
          <Text style={s.confirmHeaderIconText}>⚠️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Confirm Deletion</Text>
          <Text style={s.headerSub}>Full account · permanent</Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={s.confirmClose} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={s.confirmCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.confirmInfo}>
          <Text style={s.confirmInfoTitle}>Delete your entire account</Text>
          {points.map((p, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.confirmBulletGlyph, { color: p.warn ? DANGER : SUBTLE }]}>{p.warn ? '🗑' : '🔒'}</Text>
              <Text style={s.confirmBulletText}>{p.t}</Text>
            </View>
          ))}
        </View>

        <View style={s.confirmFieldWrap}>
          <Text style={s.confirmFieldLabel}>
            Type <Text style={s.confirmPhrase}>{CONFIRM_PHRASE}</Text> to confirm.
          </Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor="#4B5563"
            autoCapitalize="none"
            autoCorrect={false}
            style={[s.confirmInput, ready && s.confirmInputReady]}
          />
        </View>

        {status === 'error' && errorMessage ? (
          <View style={s.confirmErrorBox}>
            <Text style={s.confirmErrorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={!ready}
          style={[s.confirmDeleteBtn, ready ? s.confirmDeleteBtnReady : null]}
          accessibilityRole="button"
        >
          {status === 'submitting' ? (
            <ActivityIndicator color={DANGER} size="small" />
          ) : (
            <Text style={[s.confirmDeleteText, ready ? s.confirmDeleteTextReady : null]}>🗑 Delete permanently</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          disabled={status === 'submitting'}
          style={s.keepBtn}
          accessibilityRole="button"
        >
          <Text style={s.keepText}>Keep my data</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: `${BRAND}20`, borderWidth: 1, borderColor: `${BRAND}35`, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 16, color: BRAND },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  headerSub: { fontSize: 11, color: SUBTLE },
  tabRow: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  tabActive: { backgroundColor: `${BRAND}18`, borderColor: `${BRAND}40` },
  tabDangerActive: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' },
  tabText: { fontSize: 12, color: SUBTLE },
  tabTextActive: { color: BRAND, fontWeight: '700' },
  tabTextDangerActive: { color: DANGER, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  notice: { padding: 12, borderRadius: 10, backgroundColor: `${BRAND}0D`, borderWidth: 1, borderColor: `${BRAND}25`, marginBottom: 16 },
  noticeText: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  list: { gap: 7, marginBottom: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  rowError: { borderColor: 'rgba(239,68,68,0.35)' },
  rowPending: { opacity: 0.7 },
  rowGlyph: { width: 30, height: 30, borderRadius: 8, backgroundColor: `${BRAND}10`, borderWidth: 1, borderColor: `${BRAND}20`, alignItems: 'center', justifyContent: 'center' },
  rowGlyphText: { fontSize: 14 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '600', color: TEXT },
  rowSummary: { fontSize: 11, color: '#4B5563', lineHeight: 15, marginTop: 1 },
  rowSummaryError: { color: '#F87171' },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 7, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', minWidth: 36, alignItems: 'center' },
  deleteBtnText: { color: DANGER, fontSize: 13 },
  retainedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 1, borderColor: BORDER },
  retainedGlyph: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  retainedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  retainedName: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  lockGlyph: { fontSize: 10 },
  retainedReason: { fontSize: 11, color: '#4B5563', lineHeight: 15 },
  emptyWrap: { alignItems: 'center', paddingVertical: 24 },
  emptyAnchor: { width: 56, height: 56, borderRadius: 16, backgroundColor: `${BRAND}14`, borderWidth: 1, borderColor: `${BRAND}30`, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyAnchorText: { fontSize: 24 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: SUBTLE, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  dangerCard: { padding: 18, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.04)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)' },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 10 },
  dangerBody: { fontSize: 13, color: '#9CA3AF', lineHeight: 20, marginBottom: 14 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 12, color: '#9CA3AF', lineHeight: 17 },
  bulletTextWarn: { color: '#F87171' },
  dangerBtn: { marginTop: 8, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', alignItems: 'center' },
  dangerBtnText: { color: DANGER, fontSize: 14, fontWeight: '700' },
  confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  confirmHeaderIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', alignItems: 'center', justifyContent: 'center' },
  confirmHeaderIconText: { fontSize: 16 },
  confirmClose: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  confirmCloseText: { color: SUBTLE, fontSize: 14 },
  confirmInfo: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', marginBottom: 18 },
  confirmInfoTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 12 },
  confirmBulletGlyph: { fontSize: 13, marginTop: 1 },
  confirmBulletText: { flex: 1, fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  confirmFieldWrap: { padding: 14, borderRadius: 12, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, marginBottom: 18 },
  confirmFieldLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 10, lineHeight: 19 },
  confirmPhrase: { color: DANGER, fontWeight: '700' },
  confirmInput: { paddingVertical: 11, paddingHorizontal: 12, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 9, fontSize: 14, color: TEXT },
  confirmInputReady: { borderColor: 'rgba(239,68,68,0.5)', color: DANGER },
  confirmErrorBox: { padding: 12, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginBottom: 16 },
  confirmErrorText: { color: '#F87171', fontSize: 13, lineHeight: 18 },
  confirmDeleteBtn: { paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: BORDER, alignItems: 'center', marginBottom: 10 },
  confirmDeleteBtnReady: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.45)' },
  confirmDeleteText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  confirmDeleteTextReady: { color: DANGER },
  keepBtn: { paddingVertical: 14, borderRadius: 12, backgroundColor: `${BRAND}12`, borderWidth: 1, borderColor: `${BRAND}30`, alignItems: 'center' },
  keepText: { color: BRAND, fontSize: 15, fontWeight: '600' },
  doneGlyph: { fontSize: 48, marginBottom: 18 },
  doneTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 10, textAlign: 'center' },
  doneSub: { fontSize: 13, color: SUBTLE, lineHeight: 21, textAlign: 'center' },
  errTitle: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  errSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: `${BRAND}15`, borderWidth: 1, borderColor: `${BRAND}30` },
  retryText: { color: BRAND, fontSize: 14, fontWeight: '600' },
});
