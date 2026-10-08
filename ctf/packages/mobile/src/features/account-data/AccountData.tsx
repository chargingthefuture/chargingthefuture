// Account & Data — the Android copy of the web /account/data screen
// (components/account-data/account-data-shell.tsx). Reached from Your account; back returns there.
//
// API bindings: GET /api/account/services, DELETE /api/account/services/:slug,
// DELETE /api/account/full-account, and the two JSON export routes. Service names and summaries
// come from the live registry.
//
// The loading and error screens use the default dark colors in either theme and carry no header,
// as on the web. The web asks the member to refresh the page; here pulling down on the error screen
// does the same.

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
import { DEFAULT_ACCOUNT_TOKENS } from '../account';
import { AccountDataView, type AccountDataTab } from './AccountDataView';
import { ConfirmDelete } from './ConfirmDelete';
import {
  AccountRequestError,
  deleteFullAccount,
  deleteServiceData,
  exportAccountData,
  fetchAccountServices,
  type AccountService,
} from './api';

type LoadState = 'loading' | 'ready' | 'error';

export function AccountData({ onBack }: { onBack: () => void }) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [deletable, setDeletable] = useState<AccountService[]>([]);
  const [retained, setRetained] = useState<AccountService[]>([]);
  const [view, setView] = useState<AccountDataTab>('data');
  const [deletedSlugs, setDeletedSlugs] = useState<string[]>([]);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ slug: string; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Which export is in flight: a service slug, or 'full-account' for the download-all action.
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  // `background` keeps the current screen up while a pull-to-refresh reloads the list.
  const load = useCallback(async (background = false) => {
    if (!background) setLoadState('loading');
    try {
      const data = await fetchAccountServices();
      setDeletable(data.deletable ?? []);
      setRetained(data.retained ?? []);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const runDelete = useCallback(async (service: AccountService) => {
    setPendingSlug(service.slug);
    setRowError(null);
    try {
      await deleteServiceData(service.slug);
      setDeletedSlugs((prev) => (prev.includes(service.slug) ? prev : [...prev, service.slug]));
    } catch (error) {
      const message = error instanceof AccountRequestError ? error.message : 'Network error. Please try again.';
      setRowError({ slug: service.slug, message });
    } finally {
      setPendingSlug(null);
    }
  }, []);

  // The web asks with the browser's confirm dialog; this is the same question in the system dialog.
  const handleDeleteService = useCallback((service: AccountService) => {
    Alert.alert(
      `Delete your ${service.name} data?`,
      `${service.summary}\n\nThis is permanent and cannot be undone. Some audit records may be retained for platform integrity. Your account stays open.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => void runDelete(service) },
      ],
    );
  }, [runDelete]);

  const downloadExport = useCallback(async (path: string, filename: string, key: string) => {
    setExportingKey(key);
    setRowError(null);
    try {
      await exportAccountData(path, filename);
    } catch (error) {
      const message = error instanceof AccountRequestError ? error.message : 'Network error. Please try again.';
      setRowError({ slug: key, message });
    } finally {
      setExportingKey(null);
    }
  }, []);

  const handleExportService = useCallback((service: AccountService) => {
    const date = new Date().toISOString().slice(0, 10);
    void downloadExport(
      `/api/account/services/${encodeURIComponent(service.slug)}/export`,
      `ctf-account-data-${service.slug}-${date}.json`,
      service.slug,
    );
  }, [downloadExport]);

  const handleExportAll = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    void downloadExport('/api/account/full-account/export', `ctf-account-data-full-account-${date}.json`, 'full-account');
  }, [downloadExport]);

  const handleConfirmFullAccount = useCallback(async () => {
    try {
      await deleteFullAccount();
    } catch (error) {
      if (error instanceof AccountRequestError) throw error;
      throw new Error('Unable to complete full-account deletion. Please try again.');
    }
  }, []);

  if (loadState === 'loading') return <LoadingState />;
  if (loadState === 'error') return <ErrorState refreshing={refreshing} onRefresh={onRefresh} />;

  return (
    <>
      <AccountDataView
        view={view}
        onViewChange={setView}
        deletable={deletable}
        retained={retained}
        deletedSlugs={deletedSlugs}
        pendingSlug={pendingSlug}
        rowError={rowError}
        exportingKey={exportingKey}
        onExportService={handleExportService}
        onExportAll={handleExportAll}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onBack={onBack}
        onDeleteService={handleDeleteService}
        onOpenAccountDelete={() => setConfirmOpen(true)}
      />
      {confirmOpen ? (
        <ConfirmDelete
          serviceCount={deletable.length + retained.length}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmFullAccount}
        />
      ) : null}
    </>
  );
}

function LoadingState() {
  return (
    <View style={[styles.fill, styles.center]}>
      <Text style={[styles.loadingLine, styles.loadingLead]}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingLine}>EXIT THE PSYOP</Text>
    </View>
  );
}

function ErrorState({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.center}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.errorTitle}>We couldn&apos;t load your data right now</Text>
      <Text style={styles.errorBody}>Please refresh the page to try again. Your data and deletion controls will be here.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: DEFAULT_ACCOUNT_TOKENS.BG },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingLine: {
    fontSize: 11,
    letterSpacing: 1.98,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontFamily: interFamily('500'),
    lineHeight: 22,
    textAlign: 'center',
  },
  loadingLead: { marginBottom: 16 },
  errorTitle: { fontSize: 18, fontFamily: interFamily('700'), color: DEFAULT_ACCOUNT_TOKENS.TEXT, marginBottom: 10, textAlign: 'center' },
  errorBody: { fontSize: 14, lineHeight: 22.4, fontFamily: interFamily('400'), color: '#9CA3AF', textAlign: 'center', maxWidth: 420 },
});
