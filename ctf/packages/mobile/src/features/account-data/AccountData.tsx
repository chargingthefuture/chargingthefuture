// Real Account & Data screen — pixel-pass to
// design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileAccountData.tsx
// (default theme) and ComicMobileAccountData.tsx / ComicMobileAccountDanger.tsx (comic theme).
//
// API bindings: GET /api/account/services, DELETE /api/account/services/:slug,
// DELETE /api/account/full-account. Service names and summaries come from the live registry
// projection — never hardcoded here.
//
// Theme: colours come from the active theme tokens (useTheme). In comic theme the panels use
// the ink/cream/danger palette with sharp corners and the 3px offset shadow; in default theme
// the screen is visually unchanged from before. The theme toggle lives in this screen's header.
//
// Omissions vs mockup (no backing API): "Export your data" and "Deactivate instead" controls are
// not rendered — there is no export or deactivate endpoint, and the real-data-only rule forbids
// dead buttons.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Trash2, Lock, CheckCircle, X, AlertTriangle } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { getApiBaseUrl } from '../../auth/authedFetch';
import {
  fetchAccountServices,
  deleteServiceData,
  deleteFullAccount,
  type AccountService,
} from './api';

const CONFIRM_PHRASE = 'delete my account';

// Public Terms and Privacy Policy page. Prefer the configured app origin so it
// follows the current environment; fall back to the canonical hosted URL when
// APP_URL is not set (getApiBaseUrl throws in that case).
const TERMS_FALLBACK_URL = 'https://app.chargingthefuture.com/terms';

function termsUrl(): string {
  try {
    return `${getApiBaseUrl()}/terms`;
  } catch {
    return TERMS_FALLBACK_URL;
  }
}

async function openTerms(): Promise<void> {
  const url = termsUrl();
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open', 'We could not open the Terms and Privacy Policy page.');
  }
}

// Public Accessibility Statement page, opened the same way as Terms.
const ACCESSIBILITY_FALLBACK_URL = 'https://app.chargingthefuture.com/accessibility';

function accessibilityUrl(): string {
  try {
    return `${getApiBaseUrl()}/accessibility`;
  } catch {
    return ACCESSIBILITY_FALLBACK_URL;
  }
}

async function openAccessibility(): Promise<void> {
  const url = accessibilityUrl();
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open', 'We could not open the Accessibility page.');
  }
}

const SERVICE_GLYPH: Record<string, string> = {
  chyme: '💬', directory: '📇', 'feed-announcements': '📣', foundation: '🪛', mood: '🌿',
  'peer-programming': '👥', lighthouse: '🏠', 'socket-relay': '🔂',
  'trust-transport': '📦', trust: '🛡️', workforce: '💼', 'skills-hunt': '🎯',
  'skills-taxonomy': '🗂️', unlock: '🔓', 'level-up': '🚀', 'click-log': '🚨', comic: '🤖',
  feedback: '💬', 'service-credits': '⚙️', 'gross-domestic-product': '📊', 'weekly-performance': '📊',
};

function glyph(slug: string): string {
  return SERVICE_GLYPH[slug] ?? '📁';
}

// The Account & Data accent is the destructive-zone colour: comic-danger in comic theme,
// the existing pink brand in default theme. Everything else is driven from the theme tokens.
function accentFor(t: ThemeTokens): string {
  return t.isComic ? '#B91C1C' : '#D946EF';
}

type Tab = 'data' | 'danger';

type Styles = ReturnType<typeof makeStyles>;

export function AccountData() {
  const { tokens, theme, setTheme } = useTheme();
  const brand = accentFor(tokens);
  const s = useMemo(() => makeStyles(tokens, brand), [tokens, brand]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletable, setDeletable] = useState<AccountService[]>([]);
  const [retained, setRetained] = useState<AccountService[]>([]);
  const [deletedSlugs, setDeletedSlugs] = useState<string[]>([]);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ slug: string; message: string } | null>(null);
  const [tab, setTab] = useState<Tab>('data');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // `background` skips the full-screen spinner so pull-to-refresh keeps the current content visible.
  const load = useCallback((background = false) => {
    if (!background) setLoading(true);
    setLoadError(false);
    return fetchAccountServices()
      .then((data) => {
        setDeletable(data.deletable ?? []);
        setRetained(data.retained ?? []);
      })
      .catch(() => setLoadError(true))
      .finally(() => {
        if (!background) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: re-pull the service list without flashing the loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const remaining = useMemo(
    () => deletable.filter((svc) => !deletedSlugs.includes(svc.slug)),
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
        <ActivityIndicator color={brand} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.errTitle}>We couldn&apos;t load your data</Text>
        <Text style={s.errSub}>Please try again.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()} accessibilityRole="button">
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (confirmOpen) {
    return (
      <ConfirmDelete
        s={s}
        tokens={tokens}
        brand={brand}
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

        {/* App theme toggle — keeps web and mobile in sync for the signed-in user */}
        <View style={s.themeRow}>
          <Text style={s.themeLabel}>App theme</Text>
          <ThemeToggleControl />
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

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand} />}
      >
        {tab === 'data' ? (
          isEmpty ? (
            <EmptyState s={s} hasRetained={retained.length > 0} />
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
                    // key goes on the Fragment, not the View: @types/react rejects `key`
                    // on class-based host components like View ("does not exist on ViewProps").
                    <React.Fragment key={service.slug}>
                      <View style={[s.row, error ? s.rowError : null, isPending && s.rowPending]}>
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
                          {isPending ? <ActivityIndicator color={brand} size="small" /> : <Trash2 size={13} color={tokens.danger} strokeWidth={2} />}
                        </TouchableOpacity>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>

              {retained.length > 0 ? (
                <>
                  <Text style={s.sectionLabel}>Always retained — {retained.length} {retained.length === 1 ? 'service' : 'services'}</Text>
                  <View style={s.list}>
                    {retained.map((service) => (
                      <React.Fragment key={service.slug}>
                        <View style={s.retainedRow}>
                          <View style={s.retainedGlyph}>
                            <Text style={s.rowGlyphText}>{glyph(service.slug)}</Text>
                          </View>
                          <View style={s.rowBody}>
                            <View style={s.retainedNameRow}>
                              <Text style={s.retainedName}>{service.name}</Text>
                              <Lock size={10} color={tokens.textMuted} strokeWidth={2} />
                            </View>
                            <Text style={s.retainedReason}>{service.summary}</Text>
                          </View>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )
        ) : (
          <DangerZone s={s} tokens={tokens} serviceCount={totalServices} onContinue={() => setConfirmOpen(true)} />
        )}

        <View style={s.legalFooter}>
          <TouchableOpacity
            onPress={openTerms}
            style={s.legalLink}
            accessibilityRole="link"
            accessibilityLabel="Open the Terms and Privacy Policy"
          >
            <Text style={s.legalLinkText}>Terms &amp; Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openAccessibility}
            style={s.legalLink}
            accessibilityRole="link"
            accessibilityLabel="Open the Accessibility page"
          >
            <Text style={s.legalLinkText}>Accessibility</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // Inline so the toggle reads the same theme context (theme + setTheme) without prop
  // drilling. Mirrors the shared ThemeToggle but uses this screen's themed styles.
  function ThemeToggleControl() {
    const options: Array<{ value: 'default' | 'comic'; label: string }> = [
      { value: 'default', label: 'Default' },
      { value: 'comic', label: 'Comic' },
    ];
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel="App theme" style={s.themeGroup}>
        {options.map((opt) => {
          const active = theme === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setTheme(opt.value)}
              style={[s.themeOption, active && s.themeOptionActive]}
            >
              <Text style={[s.themeOptionText, active && s.themeOptionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
}

function EmptyState({ s, hasRetained }: { s: Styles; hasRetained: boolean }) {
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

function DangerZone({ s, tokens, serviceCount, onContinue }: { s: Styles; tokens: ThemeTokens; serviceCount: number; onContinue: () => void }) {
  const danger = tokens.danger;
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
        <React.Fragment key={i}>
          <View style={s.bulletRow}>
            <View style={[s.bulletDot, { backgroundColor: p.warn ? danger : tokens.textSecondary }]} />
            <Text style={[s.bulletText, p.warn ? s.bulletTextWarn : null]}>{p.t}</Text>
          </View>
        </React.Fragment>
      ))}
      <TouchableOpacity style={s.dangerBtn} onPress={onContinue} accessibilityRole="button">
        <Text style={s.dangerBtnText}>Continue to confirmation</Text>
      </TouchableOpacity>
    </View>
  );
}

function ConfirmDelete({ s, tokens, brand, serviceCount, onCancel }: { s: Styles; tokens: ThemeTokens; brand: string; serviceCount: number; onCancel: () => void }) {
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
        <CheckCircle size={48} color={tokens.success} strokeWidth={2} style={{ marginBottom: 18 }} />
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
          <AlertTriangle size={16} color={tokens.danger} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Confirm Deletion</Text>
          <Text style={s.headerSub}>Full account · permanent</Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={s.confirmClose} accessibilityRole="button" accessibilityLabel="Cancel">
          <X size={14} color={tokens.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.confirmInfo}>
          <Text style={s.confirmInfoTitle}>Delete your entire account</Text>
          {points.map((p, i) => (
            <React.Fragment key={i}>
              <View style={s.bulletRow}>
                {p.warn ? (
                  <Trash2 size={13} color={tokens.danger} strokeWidth={2} style={{ marginTop: 1 }} />
                ) : (
                  <Lock size={13} color={tokens.textSecondary} strokeWidth={2} style={{ marginTop: 1 }} />
                )}
                <Text style={s.confirmBulletText}>{p.t}</Text>
              </View>
            </React.Fragment>
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
            placeholderTextColor={tokens.textMuted}
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
            <ActivityIndicator color={brand} size="small" />
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

function makeStyles(t: ThemeTokens, brand: string) {
  const danger = t.danger;
  const r = t.radius;
  const rChip = t.radiusChip;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: t.isComic ? 2 : 1, borderBottomColor: t.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    headerIcon: { width: 34, height: 34, borderRadius: rChip, backgroundColor: t.isComic ? t.bg : `${brand}20`, borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? t.border : `${brand}35`, alignItems: 'center', justifyContent: 'center' },
    headerIconText: { fontSize: 16, color: brand, fontFamily: interFamily('400') },
    headerTitle: { fontSize: 16, fontWeight: '700', fontFamily: interFamily('700'), color: t.textPrimary, letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    headerSub: { fontSize: 11, color: t.textSecondary, fontFamily: interFamily('400') },
    themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    themeLabel: { fontSize: 11, fontWeight: '700', fontFamily: interFamily('700'), color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7 },
    themeGroup: { flexDirection: 'row', borderWidth: 1.5, borderColor: t.border, borderRadius: rChip, overflow: 'hidden', backgroundColor: t.surface },
    themeOption: { paddingHorizontal: 14, paddingVertical: 5 },
    themeOptionActive: { backgroundColor: t.isComic ? t.border : t.textPrimary },
    themeOptionText: { fontSize: 11, fontWeight: '700', fontFamily: interFamily('700'), color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
    themeOptionTextActive: { color: t.bg },
    tabRow: { flexDirection: 'row', gap: t.isComic ? 5 : 4 },
    tab: { flex: 1, paddingVertical: 7, borderRadius: t.isComic ? 0 : 8, backgroundColor: t.isComic ? 'transparent' : 'rgba(255,255,255,0.04)', borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? `${t.borderDim}40` : t.border, alignItems: 'center' },
    tabActive: { backgroundColor: t.isComic ? `${t.border}14` : `${brand}18`, borderColor: t.isComic ? t.border : `${brand}40` },
    tabDangerActive: { backgroundColor: t.isComic ? `${danger}18` : 'rgba(239,68,68,0.12)', borderColor: t.isComic ? danger : 'rgba(239,68,68,0.4)' },
    tabText: { fontSize: t.isComic ? 11 : 12, color: t.textSecondary, fontFamily: interFamily('400'), textTransform: t.isComic ? 'uppercase' : 'none', letterSpacing: t.isComic ? 0.6 : 0 },
    tabTextActive: { color: t.isComic ? t.textPrimary : brand, fontWeight: '700' },
    tabTextDangerActive: { color: danger, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 28 },
    notice: { padding: 12, borderRadius: r, backgroundColor: t.isComic ? `${t.border}08` : `${brand}0D`, borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? t.border : `${brand}25`, marginBottom: 16 },
    noticeText: { fontSize: 12, color: t.textSecondary, lineHeight: 18, fontFamily: interFamily('400') },
    sectionLabel: { fontSize: t.isComic ? 9 : 12, fontWeight: t.isComic ? '800' : '700', fontFamily: interFamily(t.isComic ? '800' : '700'), color: t.isComic ? t.border : t.textSecondary, textTransform: 'uppercase', letterSpacing: t.isComic ? 1.4 : 0.7, marginBottom: 10, ...(t.isComic ? { borderLeftWidth: 3, borderLeftColor: t.border, paddingLeft: 7 } : {}) },
    list: { gap: t.isComic ? 5 : 7, marginBottom: 22 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: r, backgroundColor: t.surface, borderWidth: t.isComic ? 1.5 : 1, borderColor: t.isComic ? `${t.border}35` : t.border },
    rowError: { borderColor: t.isComic ? danger : 'rgba(239,68,68,0.35)' },
    rowPending: { opacity: 0.7 },
    rowGlyph: { width: 30, height: 30, borderRadius: rChip, backgroundColor: t.isComic ? `${t.border}0C` : `${brand}10`, borderWidth: 1, borderColor: t.isComic ? `${t.border}30` : `${brand}20`, alignItems: 'center', justifyContent: 'center' },
    rowGlyphText: { fontSize: 14, fontFamily: interFamily('400') },
    rowBody: { flex: 1 },
    rowName: { fontSize: 13, fontWeight: t.isComic ? '700' : '600', fontFamily: interFamily(t.isComic ? '700' : '600'), color: t.textPrimary },
    rowSummary: { fontSize: t.isComic ? 10 : 11, color: t.textMuted, lineHeight: 15, marginTop: 1, fontFamily: interFamily('400') },
    rowSummaryError: { color: t.isComic ? danger : '#F87171' },
    deleteBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: t.isComic ? 0 : 7, backgroundColor: t.isComic ? t.surface : 'rgba(239,68,68,0.06)', borderWidth: 1.5, borderColor: t.isComic ? `${danger}60` : 'rgba(239,68,68,0.2)', minWidth: 36, alignItems: 'center' },
    deleteBtnText: { color: danger, fontSize: 13, fontWeight: t.isComic ? '800' : '400', fontFamily: interFamily(t.isComic ? '800' : '400') },
    retainedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 11, borderRadius: r, backgroundColor: t.isComic ? `${t.border}05` : 'rgba(255,255,255,0.01)', borderWidth: 1, borderColor: t.isComic ? `${t.borderDim}35` : t.border },
    retainedGlyph: { width: 30, height: 30, borderRadius: rChip, backgroundColor: t.isComic ? `${t.border}08` : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: t.isComic ? `${t.borderDim}30` : t.border, alignItems: 'center', justifyContent: 'center' },
    retainedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    retainedName: { fontSize: 13, fontWeight: t.isComic ? '700' : '600', fontFamily: interFamily(t.isComic ? '700' : '600'), color: t.textSecondary },
    lockGlyph: { fontSize: 10, fontFamily: interFamily('400') },
    retainedReason: { fontSize: t.isComic ? 10 : 11, color: t.textMuted, lineHeight: 15, fontFamily: interFamily('400') },
    emptyWrap: { alignItems: 'center', paddingVertical: 24 },
    emptyAnchor: { width: 56, height: 56, borderRadius: t.isComic ? 0 : 16, backgroundColor: t.isComic ? `${t.border}14` : `${brand}14`, borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? t.border : `${brand}30`, borderStyle: t.isComic ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyAnchorText: { fontSize: 24, fontFamily: interFamily('400') },
    emptyTitle: { fontSize: 19, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 13, color: t.textSecondary, lineHeight: 20, textAlign: 'center', marginBottom: 20, fontFamily: interFamily('400') },
    dangerCard: { padding: 18, borderRadius: r, backgroundColor: t.isComic ? `${danger}08` : 'rgba(239,68,68,0.04)', borderWidth: 2, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.18)' },
    dangerTitle: { fontSize: 15, fontWeight: t.isComic ? '800' : '700', fontFamily: interFamily(t.isComic ? '800' : '700'), color: t.textPrimary, marginBottom: 10, textTransform: t.isComic ? 'uppercase' : 'none', letterSpacing: t.isComic ? 0.6 : 0 },
    dangerBody: { fontSize: 13, color: t.textSecondary, lineHeight: 20, marginBottom: 14, fontFamily: interFamily('400') },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
    bulletDot: { width: 4, height: 4, borderRadius: t.isComic ? 0 : 2, marginTop: 6 },
    bulletText: { flex: 1, fontSize: 12, color: t.textSecondary, lineHeight: 17, fontFamily: interFamily('400') },
    bulletTextWarn: { color: t.isComic ? `${danger}CC` : '#F87171' },
    dangerBtn: { marginTop: 8, paddingVertical: 11, borderRadius: r, backgroundColor: t.isComic ? `${danger}12` : 'rgba(239,68,68,0.1)', borderWidth: 2, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.35)', alignItems: 'center' },
    dangerBtnText: { color: danger, fontSize: 14, fontWeight: t.isComic ? '800' : '700', fontFamily: interFamily(t.isComic ? '800' : '700'), textTransform: t.isComic ? 'uppercase' : 'none', letterSpacing: t.isComic ? 0.6 : 0 },
    confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: t.isComic ? 2 : 1, borderBottomColor: t.isComic ? t.border : t.border },
    confirmHeaderIcon: { width: 34, height: 34, borderRadius: rChip, backgroundColor: t.isComic ? `${danger}12` : 'rgba(239,68,68,0.12)', borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.25)', alignItems: 'center', justifyContent: 'center' },
    confirmHeaderIconText: { fontSize: 16, fontFamily: interFamily('400') },
    confirmClose: { width: 30, height: 30, borderRadius: rChip, backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    confirmCloseText: { color: t.textSecondary, fontSize: 14, fontFamily: interFamily('400') },
    confirmInfo: { padding: 16, borderRadius: r, backgroundColor: t.isComic ? `${danger}08` : 'rgba(239,68,68,0.05)', borderWidth: 2, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.18)', marginBottom: 18 },
    confirmInfoTitle: { fontSize: 14, fontWeight: '700', fontFamily: interFamily('700'), color: t.textPrimary, marginBottom: 12 },
    confirmBulletGlyph: { fontSize: 13, marginTop: 1, fontFamily: interFamily('400') },
    confirmBulletText: { flex: 1, fontSize: 12, color: t.textSecondary, lineHeight: 18, fontFamily: interFamily('400') },
    confirmFieldWrap: { padding: 14, borderRadius: r, backgroundColor: t.surface, borderWidth: t.isComic ? 1.5 : 1, borderColor: t.border, marginBottom: 18 },
    confirmFieldLabel: { fontSize: 13, color: t.textSecondary, marginBottom: 10, lineHeight: 19, fontFamily: interFamily('400') },
    confirmPhrase: { color: danger, fontWeight: '700' },
    confirmInput: { paddingVertical: 11, paddingHorizontal: 12, backgroundColor: t.bg, borderWidth: t.isComic ? 1.5 : 1, borderColor: t.border, borderRadius: r, fontSize: 14, color: t.textPrimary, fontFamily: interFamily('400') },
    confirmInputReady: { borderColor: t.isComic ? danger : 'rgba(239,68,68,0.5)', color: danger },
    confirmErrorBox: { padding: 12, borderRadius: r, backgroundColor: t.isComic ? `${danger}10` : 'rgba(239,68,68,0.08)', borderWidth: 1.5, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.3)', marginBottom: 16 },
    confirmErrorText: { color: t.isComic ? danger : '#F87171', fontSize: 13, lineHeight: 18, fontFamily: interFamily('400') },
    confirmDeleteBtn: { paddingVertical: 14, borderRadius: r, backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.04)', borderWidth: t.isComic ? 1.5 : 1, borderColor: t.border, alignItems: 'center', marginBottom: 10 },
    confirmDeleteBtnReady: { backgroundColor: t.isComic ? `${danger}14` : 'rgba(239,68,68,0.14)', borderColor: t.isComic ? danger : 'rgba(239,68,68,0.45)' },
    confirmDeleteText: { color: t.textMuted, fontSize: 15, fontWeight: '700', fontFamily: interFamily('700') },
    confirmDeleteTextReady: { color: danger },
    keepBtn: { paddingVertical: 14, borderRadius: r, backgroundColor: t.isComic ? `${t.border}12` : `${brand}12`, borderWidth: 1, borderColor: t.isComic ? t.border : `${brand}30`, alignItems: 'center' },
    keepText: { color: t.isComic ? t.textPrimary : brand, fontSize: 15, fontWeight: '600', fontFamily: interFamily('600') },
    doneGlyph: { fontSize: 48, marginBottom: 18, fontFamily: interFamily('400') },
    doneTitle: { fontSize: 20, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary, marginBottom: 10, textAlign: 'center' },
    doneSub: { fontSize: 13, color: t.textSecondary, lineHeight: 21, textAlign: 'center', fontFamily: interFamily('400') },
    errTitle: { fontSize: 16, fontWeight: '700', fontFamily: interFamily('700'), color: t.textPrimary, marginBottom: 8, textAlign: 'center' },
    errSub: { fontSize: 13, color: t.textSecondary, textAlign: 'center', marginBottom: 16, fontFamily: interFamily('400') },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: r, backgroundColor: t.isComic ? `${t.border}15` : `${brand}15`, borderWidth: 1, borderColor: t.isComic ? t.border : `${brand}30` },
    retryText: { color: t.isComic ? t.textPrimary : brand, fontSize: 14, fontWeight: '600', fontFamily: interFamily('600') },
    legalFooter: { marginTop: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.border, alignItems: 'center' },
    legalLink: { paddingVertical: 8, paddingHorizontal: 12 },
    legalLinkText: { fontSize: 12, color: t.textSecondary, textDecorationLine: 'underline', letterSpacing: t.isComic ? 0.4 : 0, fontFamily: interFamily('400') },
  });
}
