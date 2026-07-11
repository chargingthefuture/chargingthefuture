import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { useAuth } from '../../auth/auth-context';
import {
  CurrencyRateEntry,
  fetchCurrencyRates,
  reviseCurrencyRate,
  isFixedBaseline,
  formatFactor,
} from './rateAdminApi';

// Admin-only GDP currency rate-admin (issue #312 P2), mirrors
// design/.../survivor-hub/MobileGDPRateAdmin.tsx. These factors exist solely to
// estimate aggregate GDP — never a redemption rate or per-wallet conversion.

// BG_DARK (#0D0F14, header backdrop) has no mobile theme token, so it stays raw.
// Chrome + the gdp accent are read from the active theme.
const BG_DARK = '#0D0F14';

// Resolve the memoized StyleSheet + the gdp accent for the active theme.
function useGdpRateAdminTheme() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('gdp', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { styles, accent, tokens };
}

const DISCLAIMER =
  'These factors exist solely to estimate aggregate GDP. They are never a redemption rate or per-wallet conversion.';

export const GdpRateAdmin = () => {
  const { styles, accent } = useGdpRateAdminTheme();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRateEntry[]>([]);

  const [editing, setEditing] = useState<CurrencyRateEntry | null>(null);
  const [newRate, setNewRate] = useState('');
  const [newSource, setNewSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCurrencyRates();
      setCurrencies(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load currency factors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    void load();
  }, [isAuthenticated, isAdmin, load]);

  const openEdit = (c: CurrencyRateEntry) => {
    setEditing(c);
    setNewRate(c.current ? String(c.current.usdRate) : '');
    setNewSource('');
    setSaved(false);
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setSaved(false);
    setSaveError(null);
  };

  const canSave = newRate.trim() !== '' && newSource.trim() !== '' && !saving;

  const save = async () => {
    if (!editing || !canSave) return;
    const rateNum = Number(newRate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setSaveError('Factor must be a number greater than zero.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await reviseCurrencyRate({ currencyCode: editing.code, usdRate: rateNum, source: newSource.trim() });
      setSaved(true);
      await load();
      setTimeout(() => {
        setSaved(false);
        setEditing(null);
      }, 2200);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save the new factor.');
    } finally {
      setSaving(false);
    }
  };

  // ── Gating states ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }
  if (!isAuthenticated || !isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.gateTitle}>Admin only</Text>
        <Text style={styles.gateDesc}>
          The GDP currency rate admin is available to administrators only.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        {editing && !saved ? (
          <TouchableOpacity onPress={closeEdit} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerGlobe}>🌐</Text>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>GDP Rate Admin</Text>
          <Text style={styles.headerSub}>
            {editing ? `Revising — ${editing.label}` : 'GDP estimate factors only'}
          </Text>
        </View>
        <View style={styles.adminChip}>
          <Text style={styles.adminChipText}>Admin only</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
          <Text style={styles.loadingText}>Loading currency factors…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          {editing ? (
            <RevisePanel
              editing={editing}
              saved={saved}
              saving={saving}
              newRate={newRate}
              newSource={newSource}
              saveError={saveError}
              canSave={canSave}
              onChangeRate={setNewRate}
              onChangeSource={setNewSource}
              onSave={save}
            />
          ) : (
            <CurrencyList currencies={currencies} onRevise={openEdit} />
          )}
        </ScrollView>
      )}
    </View>
  );
};

function Disclaimer() {
  const { styles } = useGdpRateAdminTheme();
  return (
    <View style={styles.disclaimer}>
      <Text style={styles.disclaimerIcon}>⚠</Text>
      <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
    </View>
  );
}

function CurrencyList({
  currencies,
  onRevise,
}: {
  currencies: CurrencyRateEntry[];
  onRevise: (_c: CurrencyRateEntry) => void;
}) {
  const { styles } = useGdpRateAdminTheme();
  return (
    <>
      <Disclaimer />
      {currencies.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active currencies to manage yet.</Text>
        </View>
      ) : (
        currencies.map((c) => {
          const fixed = isFixedBaseline(c);
          return (
            <React.Fragment key={c.code}>
              <View style={styles.currencyCard}>
                <View style={styles.currencyTopRow}>
                  <View style={[styles.currencyBadge, c.isServiceCredits && styles.currencyBadgeSc]}>
                    <Text style={[styles.currencyBadgeText, c.isServiceCredits && styles.currencyBadgeTextSc]}>
                      {c.symbol ?? c.code}
                    </Text>
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyLabel}>{c.label}</Text>
                    <Text style={styles.currencyAsOf}>
                      {c.current ? `as of ${c.current.asOf}` : 'no factor set'}
                    </Text>
                  </View>
                  <Text style={[styles.currencyFactor, fixed && styles.currencyFactorFixed]}>
                    {formatFactor(c)}
                  </Text>
                </View>
                <Text style={styles.currencySource}>
                  {c.current ? `Source: ${c.current.source}` : 'No factor recorded yet'}
                </Text>
                {!fixed ? (
                  <TouchableOpacity style={styles.reviseBtn} onPress={() => onRevise(c)} accessibilityRole="button">
                    <Text style={styles.reviseBtnText}>Revise</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.fixedNote}>Fixed baseline — no revision needed</Text>
                )}
              </View>
            </React.Fragment>
          );
        })
      )}
    </>
  );
}

function RevisePanel({
  editing,
  saved,
  saving,
  newRate,
  newSource,
  saveError,
  canSave,
  onChangeRate,
  onChangeSource,
  onSave,
}: {
  editing: CurrencyRateEntry;
  saved: boolean;
  saving: boolean;
  newRate: string;
  newSource: string;
  saveError: string | null;
  canSave: boolean;
  onChangeRate: (_v: string) => void;
  onChangeSource: (_v: string) => void;
  onSave: () => void;
}) {
  const { styles, tokens } = useGdpRateAdminTheme();
  if (saved) {
    return (
      <View style={styles.savedWrap}>
        <View style={styles.savedCircle}>
          <Text style={styles.savedCheck}>✓</Text>
        </View>
        <Text style={styles.savedTitle}>Factor saved</Text>
        <Text style={styles.savedDesc}>New row added with today&apos;s date. Prior values preserved as history.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerIcon}>⚠</Text>
        <Text style={styles.disclaimerText}>
          GDP estimate factor only — never a redemption rate or per-wallet value.
        </Text>
      </View>

      <Text style={styles.fieldLabel}>New USD factor *</Text>
      <View style={styles.rateInputWrap}>
        <Text style={styles.rateDollar}>$</Text>
        <TextInput
          value={newRate}
          onChangeText={onChangeRate}
          keyboardType="decimal-pad"
          placeholder="0.00000"
          placeholderTextColor={tokens.textSecondary}
          style={styles.rateInput}
        />
        {editing.symbol ? <Text style={styles.rateUnit}>/ {editing.symbol}</Text> : null}
      </View>

      <Text style={styles.fieldLabel}>Source / note *</Text>
      <TextInput
        value={newSource}
        onChangeText={onChangeSource}
        placeholder="e.g. Owner — quarterly review"
        placeholderTextColor={tokens.textSecondary}
        style={styles.sourceInput}
      />

      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
      >
        <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
          {saving ? 'Saving…' : 'Save new factor'}
        </Text>
      </TouchableOpacity>

      {editing.history.length > 0 ? (
        <>
          <Text style={styles.priorLabel}>Prior values</Text>
          {editing.history.map((h) => (
            <React.Fragment key={`${h.asOf}-${h.usdRate}`}>
              <View style={styles.priorCard}>
                <View style={styles.priorTopRow}>
                  <Text style={styles.priorRate}>
                    ${h.usdRate}{editing.symbol ? ` / ${editing.symbol}` : ''}
                  </Text>
                  <Text style={styles.priorDate}>{h.asOf}</Text>
                </View>
                <Text style={styles.priorSource}>{h.source}</Text>
              </View>
            </React.Fragment>
          ))}
        </>
      ) : null}
    </>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  // Alias the theme values to the names the StyleSheet already uses (exemplar idiom).
  const COLOR = accent;
  const BG = t.bg;
  const SURFACE = t.surface;
  const BORDER = t.border;
  const TEXT = t.textPrimary;
  const SUBTLE = t.textSecondary;
  const MUTED = t.textSecondary;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: BG },
  loadingText: { color: SUBTLE, fontSize: 13, marginTop: 12 },
  errorText: { color: t.danger, fontSize: 13, textAlign: 'center', marginVertical: 8 },
  gateTitle: { color: TEXT, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  gateDesc: { color: SUBTLE, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Header
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: BG_DARK,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: { paddingRight: 4 },
  backChevron: { color: COLOR, fontSize: 26, lineHeight: 26, fontWeight: '700' },
  headerGlobe: { fontSize: 17 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  headerSub: { fontSize: 11.5, color: SUBTLE },
  adminChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${COLOR}12`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
  },
  adminChipText: { fontSize: 10.5, fontWeight: '700', color: COLOR },
  // Scroll
  scroll: { flex: 1 },
  scrollPad: { padding: 16 },
  // Disclaimer
  disclaimer: {
    padding: 13,
    borderRadius: 11,
    backgroundColor: 'rgba(234,179,8,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.18)',
    marginBottom: 18,
    flexDirection: 'row',
    gap: 9,
  },
  disclaimerIcon: { color: '#EAB308', fontSize: 13, marginTop: 1 },
  disclaimerText: { flex: 1, fontSize: 11.5, color: MUTED, lineHeight: 18 },
  // Currency card
  emptyCard: {
    padding: 24,
    borderRadius: 13,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  emptyText: { color: SUBTLE, fontSize: 13 },
  currencyCard: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  currencyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  currencyBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyBadgeSc: { backgroundColor: `${COLOR}15`, borderColor: `${COLOR}30` },
  currencyBadgeText: { fontSize: 12, fontWeight: '800', color: SUBTLE },
  currencyBadgeTextSc: { color: COLOR },
  currencyInfo: { flex: 1, minWidth: 0 },
  currencyLabel: { fontSize: 13.5, fontWeight: '700', color: TEXT },
  currencyAsOf: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  currencyFactor: { fontSize: 15, fontWeight: '800', color: COLOR },
  currencyFactorFixed: { color: SUBTLE },
  currencySource: { fontSize: 11, color: SUBTLE, marginBottom: 10 },
  reviseBtn: {
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: `${COLOR}12`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
  },
  reviseBtnText: { color: COLOR, fontSize: 13, fontWeight: '700' },
  fixedNote: { textAlign: 'center', fontSize: 12, color: SUBTLE },
  // Revise form
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: MUTED, marginBottom: 6 },
  rateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 11,
    gap: 8,
    marginBottom: 14,
  },
  rateDollar: { fontSize: 13, color: SUBTLE },
  rateInput: { flex: 1, fontSize: 14, color: TEXT, padding: 0 },
  rateUnit: { fontSize: 12, color: SUBTLE },
  sourceInput: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 11,
    fontSize: 13,
    color: TEXT,
    marginBottom: 20,
  },
  saveBtn: {
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: COLOR,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveBtnDisabled: { backgroundColor: t.borderFaint },
  saveBtnText: { fontSize: 14.5, fontWeight: '700', color: '#0A0E06' },
  saveBtnTextDisabled: { color: SUBTLE },
  // Saved confirmation
  savedWrap: { alignItems: 'center', paddingTop: 48 },
  savedCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  savedCheck: { color: COLOR, fontSize: 30, fontWeight: '800' },
  savedTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 8 },
  savedDesc: { fontSize: 13, color: SUBTLE, lineHeight: 20, textAlign: 'center' },
  // Prior values
  priorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  priorCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  priorTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  priorRate: { fontSize: 12, fontWeight: '700', color: MUTED },
  priorDate: { fontSize: 11, color: SUBTLE },
  priorSource: { fontSize: 11, color: SUBTLE },
  });
}
