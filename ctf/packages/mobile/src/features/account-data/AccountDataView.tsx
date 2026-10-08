// The Account & Data layout, copied from the web's AccountDataMobile
// (components/account-data/account-data-mobile.tsx): its own header (back, shield tile, title and
// service count, theme toggle), the Your Data / Danger Zone tabs, then the service list, the empty
// state or the danger card.
//
// The download controls write the JSON file to the app's cache and open the system share sheet, the
// phone's way to save or send a file (see exportAccountData in api.ts).

import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, ChevronRight, Download, Info, Shield } from 'lucide-react-native';
import { ThemeToggle, useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { AccountBackButton, getAccountTokens, radius, Spinner, type AccountTokens } from '../account';
import { ServiceLists } from './ServiceLists';
import type { AccountService } from './api';

export type AccountDataTab = 'data' | 'danger';

export type AccountDataViewProps = {
  view: AccountDataTab;
  onViewChange: (_next: AccountDataTab) => void;
  deletable: AccountService[];
  retained: AccountService[];
  deletedSlugs: string[];
  pendingSlug: string | null;
  rowError: { slug: string; message: string } | null;
  /** The export currently in flight: a service slug, or 'full-account'. */
  exportingKey: string | null;
  onExportService: (_service: AccountService) => void;
  onExportAll: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onDeleteService: (_service: AccountService) => void;
  onOpenAccountDelete: () => void;
};

export function AccountDataView(props: AccountDataViewProps) {
  const { view, deletable, retained, deletedSlugs, refreshing, onRefresh } = props;
  const { tokens } = useTheme();
  const tok = getAccountTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const remaining = deletable.filter((svc) => !deletedSlugs.includes(svc.slug));

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <AccountBackButton accent={tok.BRAND} size={34} onPress={props.onBack} />
          <View style={s.headerTile}>
            <Shield size={16} color={tok.BRAND} />
          </View>
          <View style={s.flex}>
            <Text style={s.title}>Account & Data</Text>
            <Text style={s.subtitle}>{deletable.length + retained.length} services · your control</Text>
          </View>
          <ThemeToggle />
        </View>
        <Tabs s={s} view={view} onViewChange={props.onViewChange} />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tok.BRAND} />}
      >
        {view === 'danger' ? (
          <Danger s={s} serviceCount={deletable.length} onContinue={props.onOpenAccountDelete} />
        ) : remaining.length === 0 ? (
          <Empty s={s} tok={tok} hasRetained={retained.length > 0} />
        ) : (
          <>
            <View style={s.notice}>
              <Info size={13} color={tok.BRAND} style={s.noticeIcon} />
              <Text style={s.noticeText}>Deleting from a service is permanent. Some audit records are retained for platform integrity.</Text>
            </View>
            <ExportAll s={s} tok={tok} rowError={props.rowError} exportingKey={props.exportingKey} onExportAll={props.onExportAll} />
            <ServiceLists
              remaining={remaining}
              retained={retained}
              pendingSlug={props.pendingSlug}
              rowError={props.rowError}
              exportingKey={props.exportingKey}
              onDeleteService={props.onDeleteService}
              onExportService={props.onExportService}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Tabs({ s, view, onViewChange }: { s: Styles; view: AccountDataTab; onViewChange: (_next: AccountDataTab) => void }) {
  return (
    <View style={s.tabs}>
      {(['data', 'danger'] as const).map((t) => {
        const active = view === t;
        const activeStyle = t === 'danger' ? s.tabDanger : s.tabData;
        const activeText = t === 'danger' ? s.tabTextDanger : s.tabTextData;
        return (
          <TouchableOpacity
            key={t}
            onPress={() => onViewChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[s.tab, active ? activeStyle : null]}
          >
            <Text style={[s.tabText, active ? activeText : null]}>{t === 'data' ? 'Your Data' : '⚠️ Danger Zone'}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// "Download all my data" and its error or help line (web ExportAllSection).
function ExportAll({ s, tok, rowError, exportingKey, onExportAll }: {
  s: Styles;
  tok: AccountTokens;
  rowError: { slug: string; message: string } | null;
  exportingKey: string | null;
  onExportAll: () => void;
}) {
  const exporting = exportingKey === 'full-account';
  const error = rowError?.slug === 'full-account' ? rowError.message : null;
  return (
    <>
      <TouchableOpacity
        onPress={onExportAll}
        disabled={exporting}
        accessibilityRole="button"
        style={[s.exportAll, error ? s.exportAllError : null]}
      >
        {exporting ? <Spinner size={14} color={tok.BRAND} /> : <Download size={14} color={tok.BRAND} />}
        <Text style={s.exportAllText}>{exporting ? 'Preparing your download…' : 'Download all my data (JSON)'}</Text>
      </TouchableOpacity>
      {error ? (
        <Text style={[s.exportLine, s.exportLineError]}>{error}</Text>
      ) : (
        <Text style={s.exportLine}>One JSON file with your own rows from every service. Money ledgers and audit records are retained by design and not included.</Text>
      )}
    </>
  );
}

function Empty({ s, tok, hasRetained }: { s: Styles; tok: AccountTokens; hasRetained: boolean }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyTile}>
        <Shield size={24} color={`${tok.BRAND}50`} />
      </View>
      <Text style={s.emptyTitle}>No personal data stored yet</Text>
      <Text style={s.emptyBody}>
        As you use Skills Economy apps, any personal data they hold will appear here for you to see and delete.
      </Text>
      {hasRetained ? (
        <View style={s.emptyNote}>
          <Info size={13} color={tok.BRAND} style={s.noticeIcon} />
          <Text style={s.emptyNoteText}>
            ServiceCredits ledger and community totals are always retained for financial integrity. They hold no personal identifiers.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const DANGER_POINTS = [
  { t: 'All personal data permanently deleted', warn: true },
  { t: 'ServiceCredits: held 7 days, then returned to the community treasury', warn: false },
  { t: 'Audit records retained (by design)', warn: false },
  { t: 'Profile removed from all directories', warn: true },
];

function Danger({ s, serviceCount, onContinue }: { s: Styles; serviceCount: number; onContinue: () => void }) {
  return (
    <View style={s.danger}>
      <View style={s.dangerHead}>
        <AlertTriangle size={16} color="#EF4444" />
        <Text style={s.dangerTitle}>Delete Entire Account</Text>
      </View>
      <Text style={s.dangerBody}>
        Removes your profile and all personal data across all {serviceCount} services. Your ServiceCredits are held for 7 days, then returned to the community treasury (an active escrow resolves first) — never withdrawable externally. Some audit records are retained by design.
      </Text>
      <View style={s.dangerPoints}>
        {DANGER_POINTS.map(({ t, warn }) => (
          <View key={t} style={s.dangerPoint}>
            <View style={[s.dot, { backgroundColor: warn ? '#EF4444' : '#4B5563' }]} />
            <Text style={[s.dangerPointText, { color: warn ? '#F87171' : '#9CA3AF' }]}>{t}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={onContinue} accessibilityRole="button" style={s.dangerBtn}>
        <AlertTriangle size={14} color="#EF4444" />
        <Text style={s.dangerBtnText}>Continue to confirmation</Text>
        <ChevronRight size={14} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: ThemeTokens, tok: AccountTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tok.BG },
    flex: { flex: 1 },
    header: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: tok.BORDER },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    headerTile: { width: 34, height: 34, borderRadius: radius(t, 9), backgroundColor: `${tok.BRAND}20`, borderWidth: 1, borderColor: `${tok.BRAND}35`, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 16, fontFamily: interFamily('700'), color: tok.TEXT },
    subtitle: { fontSize: 11, fontFamily: interFamily('400'), color: tok.SUBTLE },
    tabs: { flexDirection: 'row', gap: 4 },
    tab: { flex: 1, padding: 7, borderRadius: radius(t, 8), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: tok.BORDER, alignItems: 'center' },
    tabData: { backgroundColor: `${tok.BRAND}18`, borderColor: `${tok.BRAND}40` },
    tabDanger: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' },
    tabText: { fontSize: 12, fontFamily: interFamily('400'), color: tok.SUBTLE },
    tabTextData: { fontFamily: interFamily('700'), color: tok.BRAND },
    tabTextDanger: { fontFamily: interFamily('700'), color: '#EF4444' },
    content: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 24 },
    notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius(t, 10), backgroundColor: `${tok.BRAND}06`, borderWidth: 1, borderColor: `${tok.BRAND}18`, marginBottom: 12 },
    noticeIcon: { marginTop: 1 },
    noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: interFamily('400'), color: '#9CA3AF' },
    exportAll: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius(t, 10), backgroundColor: `${tok.BRAND}0C`, borderWidth: 1, borderColor: `${tok.BRAND}30`, marginBottom: 6 },
    exportAllError: { borderColor: 'rgba(239,68,68,0.35)' },
    exportAllText: { fontSize: 13, fontFamily: interFamily('700'), color: tok.BRAND },
    exportLine: { fontSize: 11, lineHeight: 15.4, fontFamily: interFamily('400'), color: '#4B5563', marginBottom: 10 },
    exportLineError: { color: '#F87171' },
    empty: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 4 },
    emptyTile: { width: 56, height: 56, borderRadius: radius(t, 16), backgroundColor: `${tok.BRAND}08`, borderWidth: 1, borderStyle: 'dashed', borderColor: `${tok.BRAND}30`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 19, fontFamily: interFamily('800'), color: tok.TEXT, marginBottom: 8, textAlign: 'center' },
    emptyBody: { fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: tok.SUBTLE, marginBottom: 20, textAlign: 'center' },
    emptyNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: radius(t, 12), backgroundColor: `${tok.BRAND}05`, borderWidth: 1, borderColor: `${tok.BRAND}15`, width: '100%' },
    emptyNoteText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: interFamily('400'), color: tok.SUBTLE },
    danger: { padding: 18, borderRadius: radius(t, 14), backgroundColor: 'rgba(239,68,68,0.04)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)' },
    dangerHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    dangerTitle: { fontSize: 15, fontFamily: interFamily('700'), color: tok.TEXT },
    dangerBody: { fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: '#9CA3AF', marginBottom: 14 },
    dangerPoints: { gap: 7, marginBottom: 14 },
    dangerPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    dot: { width: 4, height: 4, borderRadius: radius(t, 2), marginTop: 5 },
    dangerPointText: { flex: 1, fontSize: 12, lineHeight: 16.8, fontFamily: interFamily('400') },
    dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: radius(t, 10), backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
    dangerBtnText: { fontSize: 14, fontFamily: interFamily('700'), color: '#EF4444' },
  });
}
