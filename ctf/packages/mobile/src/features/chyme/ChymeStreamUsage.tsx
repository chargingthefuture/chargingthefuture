/**
 * ChymeStreamUsage — the Chyme admin screen ("Live audio usage"), copied from the web
 * (web components/chyme/chyme-stream-usage-shell.tsx, at /admin/chyme): the Stream Video minute
 * meter against the month's budget, what the quota policy is doing, the minutes by surface and by
 * day, the settings in force, and the members removed from a room. Admin-only on the server.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClipboardCopy, RefreshCw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { interFamily } from '../../components/ui';
import { getStreamUsage, type UsagePayload } from './chyme-admin-api';
import { useShellTokens, type ChymeTokens } from './chyme-tokens';
import { Spin } from './chyme-join-bar';
import { DailySection, MonthSection, NowSection, SettingsSection, SurfaceSection } from './chyme-usage-sections';
import { RemovedMembersSection } from './chyme-removed-members';
import { asPlainText, type DayRange } from './chyme-usage-text';

function useStreamUsage() {
  const [payload, setPayload] = useState<UsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPayload(await getStreamUsage());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The meter did not load.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { payload, error, loading, load, setError };
}

function UsageActions({ loading, canCopy, copied, onRefresh, onCopy, t }: { loading: boolean; canCopy: boolean; copied: boolean; onRefresh: () => void; onCopy: () => void; t: ChymeTokens }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity onPress={onRefresh} disabled={loading} accessibilityRole="button" style={[styles.action, { borderRadius: t.radius(10), backgroundColor: t.INPUT_BG, borderColor: t.BORDER }]}>
        <Spin spinning={loading}>
          <RefreshCw size={14} color={t.TEXT} />
        </Spin>
        <Text style={[styles.actionText, { color: t.TEXT }]}>Refresh</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onCopy}
        disabled={!canCopy}
        accessibilityRole="button"
        style={[styles.action, styles.copy, { borderRadius: t.radius(10), backgroundColor: t.ACCENT, opacity: canCopy ? 1 : 0.6 }]}
      >
        <ClipboardCopy size={14} color="#fff" />
        <Text style={[styles.actionText, styles.copyText]}>{copied ? 'Copied' : 'Copy as text'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ChymeStreamUsage({ onOpenReadings }: { onOpenReadings: () => void }) {
  const t = useShellTokens();
  const { payload, error, loading, load, setError } = useStreamUsage();
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<DayRange>('7');

  const onCopy = useCallback(async () => {
    if (!payload) return;
    try {
      await Clipboard.setStringAsync(asPlainText(payload, range));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [payload, range, setError]);

  return (
    <ScrollView style={[styles.screen, { backgroundColor: t.BG }]} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: t.SUBTLE }]}>
        How much of the month&apos;s Stream Video allowance the app has used: the Chyme rooms from their presence heartbeats, and Beacon, PeerProgramming, and Foundation calls from Stream&apos;s participant-left events as people leave a call. The Stream dashboard is the bill of record; this is the number the app acts on.
      </Text>
      <Text accessibilityRole="link" onPress={onOpenReadings} style={[styles.link, { color: t.ACCENT }]}>
        Readings loop (the switch and what it plays) →
      </Text>
      <UsageActions loading={loading} canCopy={payload !== null} copied={copied} onRefresh={() => void load()} onCopy={() => void onCopy()} t={t} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!payload && !error ? <Text style={[styles.loading, { color: t.SUBTLE }]}>Loading the meter…</Text> : null}
      {payload ? (
        <>
          <MonthSection usage={payload.usage} t={t} />
          <NowSection payload={payload} t={t} />
          <SurfaceSection usage={payload.usage} t={t} />
          <DailySection usage={payload.usage} range={range} onRange={setRange} t={t} />
          <SettingsSection payload={payload} t={t} />
        </>
      ) : null}
      <RemovedMembersSection t={t} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The app pads every screen's content area; the web screen sets its own padding, so this takes the
  // app's padding back and applies the web's.
  screen: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 40 },
  intro: { fontSize: 13, lineHeight: 19.5, marginBottom: 14, fontFamily: interFamily('400') },
  link: { fontSize: 13, marginBottom: 14, fontFamily: interFamily('600') },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  actionText: { fontSize: 13, fontFamily: interFamily('600') },
  copy: { borderWidth: 0 },
  copyText: { color: '#fff', fontFamily: interFamily('700') },
  error: { fontSize: 13, color: '#F87171', marginBottom: 14, fontFamily: interFamily('400') },
  loading: { fontSize: 13, fontFamily: interFamily('400') },
});
