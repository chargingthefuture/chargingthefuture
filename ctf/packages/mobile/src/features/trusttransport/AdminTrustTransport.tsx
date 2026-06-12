import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  fetchAdminAuditEvents,
  fetchAdminIncidents,
  fetchAdminMarketConfig,
  resolveAdminIncident,
  restoreAdminAccount,
  restrictAdminAccount,
  updateAdminMarketConfig,
  type TrustTransportAuditEvent,
  type TrustTransportIncident,
  type TrustTransportMarketConfig,
} from './admin-api';

const COLOR = '#F43F5E';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

function severityColor(severity: TrustTransportIncident['severity']): string {
  switch (severity) {
    case 'critical':
      return '#F43F5E';
    case 'high':
      return '#FB923C';
    case 'medium':
      return '#F59E0B';
    default:
      return '#9CA3AF';
  }
}

function statusColor(status: TrustTransportIncident['status']): string {
  switch (status) {
    case 'resolved':
      return '#22C55E';
    case 'dismissed':
      return '#9CA3AF';
    default:
      return '#F59E0B';
  }
}

export const AdminTrustTransport = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<TrustTransportIncident[]>([]);
  const [auditEvents, setAuditEvents] = useState<TrustTransportAuditEvent[]>([]);
  const [config, setConfig] = useState<TrustTransportMarketConfig | null>(null);

  // Market config form mirrors the web admin's market controls.
  const [maxConcurrentTrips, setMaxConcurrentTrips] = useState('3');
  const [requireProofOnDelivery, setRequireProofOnDelivery] = useState(true);
  const [emergencyFreezeEnabled, setEmergencyFreezeEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Account restriction tools mirror the web admin's account controls.
  const [accountUserId, setAccountUserId] = useState('');
  const [restrictReason, setRestrictReason] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const [incidentsResult, configResult, auditResult] = await Promise.all([
      fetchAdminIncidents(),
      fetchAdminMarketConfig(),
      fetchAdminAuditEvents(),
    ]);

    if (incidentsResult.forbidden || configResult.forbidden || auditResult.forbidden) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);

    const firstError =
      incidentsResult.message ?? configResult.message ?? auditResult.message ?? null;
    if (firstError) setError(firstError);

    setIncidents(incidentsResult.items);
    setAuditEvents(auditResult.items);
    if (configResult.config) {
      setConfig(configResult.config);
      setMaxConcurrentTrips(String(configResult.config.maxConcurrentTrips));
      setRequireProofOnDelivery(configResult.config.requireProofOnDelivery);
      setEmergencyFreezeEnabled(configResult.config.emergencyFreezeEnabled);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const confirmResolve = useCallback(
    (incident: TrustTransportIncident) => {
      Alert.alert(
        'Resolve incident',
        `Mark this ${incident.kind === 'dispute' ? 'dispute' : 'risk signal'} as resolved?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resolve',
            style: 'default',
            onPress: () => {
              void (async () => {
                if (!auth?.userId) return;
                setResolvingId(incident.id);
                setError(null);
                setNotice(null);
                try {
                  await resolveAdminIncident(incident.id, null);
                  setNotice('Incident resolved.');
                  await load();
                } catch {
                  setError('Could not resolve the incident. Try again.');
                } finally {
                  setResolvingId(null);
                }
              })();
            },
          },
        ],
      );
    },
    [auth, load],
  );

  const saveConfig = useCallback(() => {
    Alert.alert('Update market config', 'Apply these market controls for all trips?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update',
        style: 'default',
        onPress: () => {
          void (async () => {
            if (!auth?.userId) return;
            const parsed = Number.parseInt(maxConcurrentTrips, 10);
            if (!Number.isInteger(parsed) || parsed < 1) {
              setError('Max concurrent trips must be a whole number of at least 1.');
              return;
            }
            setSavingConfig(true);
            setError(null);
            setNotice(null);
            try {
              const saved = await updateAdminMarketConfig({
                maxConcurrentTrips: parsed,
                requireProofOnDelivery,
                emergencyFreezeEnabled,
              });
              setConfig(saved);
              setMaxConcurrentTrips(String(saved.maxConcurrentTrips));
              setRequireProofOnDelivery(saved.requireProofOnDelivery);
              setEmergencyFreezeEnabled(saved.emergencyFreezeEnabled);
              setNotice('Market config updated.');
              await load();
            } catch {
              setError('Could not update the market config. Try again.');
            } finally {
              setSavingConfig(false);
            }
          })();
        },
      },
    ]);
  }, [auth, maxConcurrentTrips, requireProofOnDelivery, emergencyFreezeEnabled, load]);

  const confirmRestrict = useCallback(() => {
    const target = accountUserId.trim();
    if (!target) {
      setError('Enter a user ID to restrict.');
      return;
    }
    Alert.alert('Restrict account', `Restrict account ${target}? They will be blocked from trips.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restrict',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (!auth?.userId) return;
            setAccountBusy(true);
            setError(null);
            setNotice(null);
            try {
              await restrictAdminAccount(target, restrictReason.trim() || null);
              setNotice(`Account ${target} restricted.`);
              await load();
            } catch {
              setError('Could not restrict the account. Try again.');
            } finally {
              setAccountBusy(false);
            }
          })();
        },
      },
    ]);
  }, [auth, accountUserId, restrictReason, load]);

  const confirmRestore = useCallback(() => {
    const target = accountUserId.trim();
    if (!target) {
      setError('Enter a user ID to restore.');
      return;
    }
    Alert.alert('Restore account', `Restore account ${target}? They will regain trip access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'default',
        onPress: () => {
          void (async () => {
            if (!auth?.userId) return;
            setAccountBusy(true);
            setError(null);
            setNotice(null);
            try {
              await restoreAdminAccount(target);
              setNotice(`Account ${target} restored.`);
              await load();
            } catch {
              setError('Could not restore the account. Try again.');
            } finally {
              setAccountBusy(false);
            }
          })();
        },
      },
    ]);
  }, [auth, accountUserId, load]);

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>The TrustTransport admin tools are available to admins only.</Text>
      </View>
    );
  }

  const openIncidents = incidents.filter((item) => item.status === 'open').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TrustTransport Admin</Text>
      <Text style={styles.subtitle}>
        Safety operations: incidents, account restrictions, market controls, and admin audit visibility.
      </Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Incidents (recent)</Text>
          <Text style={styles.statValue}>{incidents.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Open incidents</Text>
          <Text style={styles.statValue}>{openIncidents}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Audit events</Text>
          <Text style={styles.statValue}>{auditEvents.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Max concurrent trips</Text>
          <Text style={styles.statValue}>{config ? config.maxConcurrentTrips : '—'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incident queue</Text>
        <Text style={styles.cardMeta}>Disputes and risk signals, newest first. Resolve open items.</Text>
        {incidents.length === 0 ? (
          <Text style={styles.emptyText}>No incidents reported.</Text>
        ) : (
          incidents.map((incident) => (
            <React.Fragment key={incident.id}>
            <View style={styles.incidentRow}>
              <View style={styles.incidentHeader}>
                <View style={styles.incidentHeaderText}>
                  <Text style={styles.incidentReason}>{incident.reason}</Text>
                  <Text style={styles.incidentMeta}>
                    {incident.kind === 'dispute' ? 'Dispute' : 'Risk signal'} · opened by {incident.openedByUserId}
                  </Text>
                </View>
                <View style={styles.badgeColumn}>
                  <Text style={[styles.badge, { color: severityColor(incident.severity) }]}>
                    {incident.severity}
                  </Text>
                  <Text style={[styles.badge, { color: statusColor(incident.status) }]}>
                    {incident.status}
                  </Text>
                </View>
              </View>
              {incident.status === 'open' ? (
                <Pressable
                  style={[styles.resolveBtn, resolvingId === incident.id ? styles.btnBusy : null]}
                  onPress={() => confirmResolve(incident)}
                  disabled={resolvingId === incident.id}
                >
                  {resolvingId === incident.id ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <Text style={styles.resolveBtnText}>Resolve</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            </React.Fragment>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Market controls</Text>
        <Text style={styles.cardMeta}>Apply to all trips. Changes are recorded in the audit trail.</Text>

        <Text style={styles.label}>Max concurrent trips</Text>
        <TextInput
          style={styles.input}
          value={maxConcurrentTrips}
          onChangeText={setMaxConcurrentTrips}
          placeholder="3"
          placeholderTextColor={SUBTLE}
          keyboardType="number-pad"
        />

        <View style={styles.switchRow}>
          <Switch value={requireProofOnDelivery} onValueChange={setRequireProofOnDelivery} />
          <Text style={styles.switchLabel}>Require proof on delivery</Text>
        </View>

        <View style={styles.switchRow}>
          <Switch value={emergencyFreezeEnabled} onValueChange={setEmergencyFreezeEnabled} />
          <Text style={styles.switchLabel}>Emergency freeze enabled</Text>
        </View>

        <Pressable
          style={[styles.primaryBtn, savingConfig ? styles.btnBusy : null]}
          onPress={saveConfig}
          disabled={savingConfig}
        >
          {savingConfig ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Update market config</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account controls</Text>
        <Text style={styles.cardMeta}>
          Restrict or restore a member by user ID. Restricting blocks trips immediately.
        </Text>

        <Text style={styles.label}>User ID</Text>
        <TextInput
          style={styles.input}
          value={accountUserId}
          onChangeText={setAccountUserId}
          placeholder="member-user-id"
          placeholderTextColor={SUBTLE}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Restriction reason (optional)</Text>
        <TextInput
          style={styles.input}
          value={restrictReason}
          onChangeText={setRestrictReason}
          placeholder="Why this account is being restricted"
          placeholderTextColor={SUBTLE}
        />

        <View style={styles.accountBtnRow}>
          <Pressable
            style={[styles.restrictBtn, accountBusy ? styles.btnBusy : null]}
            onPress={confirmRestrict}
            disabled={accountBusy}
          >
            <Text style={styles.restrictBtnText}>Restrict</Text>
          </Pressable>
          <Pressable
            style={[styles.restoreBtn, accountBusy ? styles.btnBusy : null]}
            onPress={confirmRestore}
            disabled={accountBusy}
          >
            <Text style={styles.restoreBtnText}>Restore</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin audit trail</Text>
        <Text style={styles.cardMeta}>Recent admin actions, newest first.</Text>
        {auditEvents.length === 0 ? (
          <Text style={styles.emptyText}>No audit events yet.</Text>
        ) : (
          auditEvents.slice(0, 25).map((event) => (
            <React.Fragment key={event.id}>
            <View style={styles.auditRow}>
              <Text style={styles.auditCommand}>{event.command}</Text>
              <Text style={styles.auditMeta}>
                {event.policyStatus} · {event.targetType}:{event.targetId} · {event.createdAtIso}
              </Text>
            </View>
            </React.Fragment>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: TEXT },
  subtitle: { fontSize: 13, color: SUBTLE, lineHeight: 19 },
  noticeText: { fontSize: 14, color: SUBTLE, textAlign: 'center' },
  errorBanner: {
    fontSize: 13,
    color: '#FCA5A5',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeBanner: {
    fontSize: 13,
    color: '#86EFAC',
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statLabel: { fontSize: 11, color: SUBTLE },
  statValue: { fontSize: 22, fontWeight: '800', color: TEXT },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
  emptyText: { fontSize: 13, color: SUBTLE, fontStyle: 'italic' },
  label: { fontSize: 12, fontWeight: '600', color: '#D1D5DB', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: TEXT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  switchLabel: { fontSize: 13, color: '#D1D5DB', flex: 1 },
  incidentRow: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  incidentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  incidentHeaderText: { flex: 1, gap: 2 },
  incidentReason: { fontSize: 14, fontWeight: '600', color: TEXT },
  incidentMeta: { fontSize: 12, color: SUBTLE },
  badgeColumn: { alignItems: 'flex-end', gap: 4 },
  badge: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  resolveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  resolveBtnText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  accountBtnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  restrictBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  restrictBtnText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  restoreBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  restoreBtnText: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
  auditRow: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    gap: 2,
  },
  auditCommand: { fontSize: 13, fontWeight: '600', color: TEXT },
  auditMeta: { fontSize: 11, color: SUBTLE },
  primaryBtn: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: COLOR,
  },
  btnBusy: { opacity: 0.7 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
