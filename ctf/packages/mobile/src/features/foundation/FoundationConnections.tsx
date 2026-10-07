// The member's Foundation connections, each with "Connect now" where the web would offer it: the
// provider accepts instant calls at a valid rate and is not the member (canOfferConnectNow, as on the
// web). The list is the connection history the web keeps (GET /api/foundation/connections/history);
// each provider's name and call settings come from GET /api/foundation/providers/[providerId].
// Messages stay on the web, so tapping a name opens Foundation in the browser.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  canOfferConnectNow,
  fetchProvider,
  fetchThreads,
  rateLabel,
  type ConnectionThread,
  type ProviderCallSettings,
} from './FoundationApi';
import { ConnectNowConfirm } from './ConnectNowConfirm';
import { FDButton } from './FDButton';
import { useFDTheme } from './useFDTheme';
import { getApiBaseUrl } from '../../auth/authedFetch';
import { reportError } from '../../observability/report';

type Row = {
  thread: ConnectionThread;
  // Null when the member is the provider on this thread, or the provider could not be read.
  provider: ProviderCallSettings | null;
  callable: boolean;
};

async function providersById(threads: ConnectionThread[]): Promise<Map<string, { provider: ProviderCallSettings; viewerUserId: string }>> {
  const ids = Array.from(new Set(threads.map((t) => t.providerDirectoryProfileId)));
  const settled = await Promise.allSettled(ids.map((id) => fetchProvider(id)));
  const found = new Map<string, { provider: ProviderCallSettings; viewerUserId: string }>();
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') found.set(ids[index], result.value);
    else reportError(result.reason, { area: 'foundation', op: 'connections_provider_read' });
  });
  return found;
}

async function loadRows(viewerUserId: string | null): Promise<Row[]> {
  const threads = await fetchThreads();
  const providers = await providersById(threads.filter((t) => t.providerUserId !== viewerUserId));
  return threads.map((thread) => {
    const entry = providers.get(thread.providerDirectoryProfileId) ?? null;
    const callable = entry ? canOfferConnectNow(entry.provider, entry.viewerUserId) : false;
    return { thread, provider: entry?.provider ?? null, callable };
  });
}

function rowName(row: Row, viewerUserId: string | null): string {
  if (row.thread.providerUserId === viewerUserId) return 'A member who contacted you';
  return row.provider?.displayName ?? 'A provider';
}

function openOnWeb() {
  let url: string;
  try {
    url = `${getApiBaseUrl()}/apps/foundation`;
  } catch (configError) {
    return reportError(configError, { area: 'foundation', op: 'open_on_web' });
  }
  void Linking.openURL(url).catch((linkError: unknown) => reportError(linkError, { area: 'foundation', op: 'open_on_web' }));
}

function ConnectionRow({ row, viewerUserId, onConnect }: { row: Row; viewerUserId: string | null; onConnect: (_p: ProviderCallSettings) => void }) {
  const { tokens } = useFDTheme();
  const provider = row.provider;
  return (
    <View style={[styles.row, { borderColor: tokens.border, borderRadius: tokens.radius, backgroundColor: tokens.surface }]}>
      <Pressable onPress={openOnWeb} accessibilityRole="link" accessibilityLabel={`Open ${rowName(row, viewerUserId)} on the web`} style={styles.rowText}>
        <Text style={[styles.name, { color: tokens.textPrimary }]}>{rowName(row, viewerUserId)}</Text>
        {row.callable && provider ? (
          <Text style={[styles.meta, { color: tokens.textSecondary }]}>{rateLabel(provider.instantCallRateCredits ?? 0, provider.instantCallIntervalMinutes)}</Text>
        ) : null}
        {row.thread.status === 'closed' ? <Text style={[styles.meta, { color: tokens.textMuted }]}>Closed</Text> : null}
      </Pressable>
      {row.callable && provider ? <FDButton label="Connect now" variant="primary" onPress={() => onConnect(provider)} /> : null}
    </View>
  );
}

export function FoundationConnections({ viewerUserId }: { viewerUserId: string | null }) {
  const { tokens, accent } = useFDTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ProviderCallSettings | null>(null);

  const load = useCallback(() => {
    setError(null);
    loadRows(viewerUserId).then(setRows, (loadError: unknown) => {
      reportError(loadError, { area: 'foundation', op: 'connections_load' });
      setError(loadError instanceof Error ? loadError.message : 'Could not load your connections.');
    });
  }, [viewerUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <Text style={[styles.hint, { color: tokens.textSecondary }]}>
      Messages with each person are on the web. Tap a name to open Foundation there. Finding someone new is on the web too.
    </Text>
  );

  if (error) {
    return (
      <View style={styles.list}>
        {header}
        <Text style={[styles.hint, { color: tokens.danger }]}>{error}</Text>
        <FDButton label="Try again" onPress={load} />
      </View>
    );
  }
  if (!rows) return <ActivityIndicator color={accent} />;
  return (
    <View style={styles.list}>
      {header}
      {rows.length === 0 ? (
        <Text style={[styles.hint, { color: tokens.textSecondary }]}>No connections yet. Find someone on Foundation on the web, and they show here.</Text>
      ) : (
        rows.map((row) => <ConnectionRow key={row.thread.id} row={row} viewerUserId={viewerUserId} onConnect={setConfirming} />)
      )}
      <FDButton label="Refresh" onPress={load} />
      {confirming ? <ConnectNowConfirm provider={confirming} onClose={() => setConfirming(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  hint: { fontSize: 13, lineHeight: 18 },
  row: { borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5 },
});
