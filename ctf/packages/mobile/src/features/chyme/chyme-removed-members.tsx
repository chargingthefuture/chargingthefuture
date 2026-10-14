// "Removed members" on the live audio usage screen, copied from the web (web components/chyme/
// chyme-stream-usage-shell.tsx RemovedMembersSection): members an admin removed from a room, each
// with "Let back in", which lifts the removal for that row's room and re-reads the list.

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import { getRemovals, postLiftRemoval, type RoomRemoval } from './chyme-admin-api';
import { Section, SectionTitle, usageStyles } from './chyme-usage-sections';
import type { ChymeTokens } from './chyme-tokens';

// The web prints new Date(...).toLocaleString('en-US'), e.g. "10/8/2026, 9:05:12 PM".
function formatRemovedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hour = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${hour}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function RemovalRow({ row, busy, onLetBackIn, t }: { row: RoomRemoval; busy: boolean; onLetBackIn: () => void; t: ChymeTokens }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: t.TEXT }]}>{row.username ? `@${row.username}` : `user-${row.userId.slice(0, 8)}`}</Text>
        <Text style={[styles.meta, { color: t.SUBTLE }]}>
          {row.roomName} · removed {formatRemovedAt(row.removedAtIso)}
          {row.reason ? ` · ${row.reason}` : ''}
        </Text>
      </View>
      <TouchableOpacity disabled={busy} onPress={onLetBackIn} accessibilityRole="button" style={[styles.button, { borderRadius: t.radius(10), backgroundColor: t.ACCENT }]}>
        <Text style={styles.buttonText}>Let back in</Text>
      </TouchableOpacity>
    </View>
  );
}

function useRemovals() {
  const [rows, setRows] = useState<RoomRemoval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getRemovals());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The removed-members list did not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const letBackIn = useCallback(async (row: RoomRemoval) => {
    setBusyId(row.id);
    try {
      const result = await postLiftRemoval(row);
      setError(result.streamNotice ?? null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action did not complete.');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  return { rows, error, busyId, letBackIn };
}

export function RemovedMembersSection({ t }: { t: ChymeTokens }) {
  const { rows, error, busyId, letBackIn } = useRemovals();
  return (
    <Section t={t}>
      <SectionTitle t={t}>Removed members</SectionTitle>
      {error ? <Text accessibilityRole="alert" style={[usageStyles.body, styles.error]}>{error}</Text> : null}
      {rows === null && !error ? <Text style={[usageStyles.body, { color: t.SUBTLE }]}>Loading…</Text> : null}
      {rows && rows.length === 0 ? <Text style={[usageStyles.body, { color: t.SUBTLE }]}>Nobody is removed from a room right now.</Text> : null}
      {rows && rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((row) => (
            <RemovalRow key={row.id} row={row} busy={busyId === row.id} onLetBackIn={() => void letBackIn(row)} t={t} />
          ))}
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  error: { color: '#FDE68A', marginBottom: 8 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('600') },
  meta: { fontSize: 12, lineHeight: 18, fontFamily: interFamily('400') },
  button: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { color: '#fff', fontSize: 12, fontFamily: interFamily('700') },
});
