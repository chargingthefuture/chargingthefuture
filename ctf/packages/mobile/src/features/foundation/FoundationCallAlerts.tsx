/**
 * FoundationCallAlerts — the Android (React Native) "Enable call alerts on this
 * device" control (issue #884). It mirrors the web control
 * (ctf/packages/web/components/foundation/foundation-call-alerts.tsx): a provider
 * who allows instant 1:1 calls turns on native push so their phone wakes when a
 * member rings them, even with the app closed. The in-app poll is always the
 * fallback; this only augments it.
 *
 * Per-device: a member enables alerts on each device separately, because a push
 * token belongs to one install on one device. On enable we request notification
 * permission, fetch this device's Expo push token (using the EAS projectId from
 * runtime config), and POST it to /api/foundation/push/subscribe with
 * kind:'expo'. On disable we POST the same token to /api/foundation/push/unsubscribe.
 *
 * IMPORTANT — needs a native build: expo-notifications uses native code and does
 * NOT work in Expo Go. A device is only woken by a ring after an EAS dev/production
 * build that includes the expo-notifications config plugin (registered in
 * app.config.ts). In Expo Go this control reports "unsupported".
 *
 * States covered: checking, unsupported (Expo Go / no projectId), permission
 * denied, enabling, enabled-on-this-device, disabled, and error.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { authedFetch } from '../../auth/authedFetch';

const COLOR = '#F59E0B';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

type Status =
  | 'checking'
  | 'unsupported' // Expo Go, or no EAS projectId — native push cannot run here
  | 'denied'
  | 'enabled'
  | 'disabled';

// The EAS projectId from runtime config (app.config.ts puts it under extra.eas).
// getExpoPushTokenAsync needs it to mint a token for this project. Null when the
// build has no projectId (e.g. a bare local run), in which case push is unsupported.
function getEasProjectId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as {
    eas?: { projectId?: string };
  };
  const id = extra.eas?.projectId;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

// True only on a native build with a usable projectId. Expo Go cannot deliver a
// remote push (it has no native notification module wired for this app), so we
// treat it as unsupported and lean on the in-app poll.
function pushSupported(): boolean {
  return (Platform.OS === 'android' || Platform.OS === 'ios') && getEasProjectId() !== null;
}

// A short, non-identifying device label stored alongside the subscription so a
// member can tell their devices apart. No personal data.
function deviceLabel(): string {
  const name = Constants.deviceName ?? '';
  const os = Platform.OS;
  return `${name ? `${name} · ` : ''}${os}`.slice(0, 256);
}

export const FoundationCallAlerts: React.FC = () => {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The Expo push token this device last registered, kept so disable can target
  // exactly the row it created (the backend keys subscriptions on the token).
  const tokenRef = useRef<string | null>(null);

  // Work out the initial state: is native push supported here, and has the user
  // already granted permission? We cannot know server-side subscription state
  // cheaply, so a granted permission is shown as "enabled" (re-enabling is
  // idempotent on the server — it upserts the same token).
  const init = useCallback(async () => {
    setError(null);
    if (!pushSupported()) {
      setStatus('unsupported');
      return;
    }
    try {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.status === 'denied') {
        setStatus('denied');
        return;
      }
      setStatus(settings.status === 'granted' ? 'enabled' : 'disabled');
    } catch {
      setStatus('disabled');
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const projectId = getEasProjectId();
      if (!projectId) {
        setStatus('unsupported');
        return;
      }

      const permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        setStatus('denied');
        return;
      }

      // Android needs a notification channel for a heads-up incoming-call alert.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('foundation-calls', {
          name: 'Incoming calls',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;
      if (!token) {
        throw new Error('Could not turn on call alerts. Please try again.');
      }
      tokenRef.current = token;

      const saveRes = await authedFetch('/api/foundation/push/subscribe', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ kind: 'expo', token, userAgent: deviceLabel() }),
      });
      if (!saveRes.ok) {
        throw new Error('Could not turn on call alerts. Please try again.');
      }
      setStatus('enabled');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not turn on call alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Resolve this device's token (from this session, or freshly) so we delete
      // exactly the right server row. If the token cannot be resolved we still
      // flip the local state — the server prunes a dead token on the next send.
      let token = tokenRef.current;
      if (!token) {
        const projectId = getEasProjectId();
        if (projectId) {
          try {
            token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          } catch {
            token = null;
          }
        }
      }
      if (token) {
        await authedFetch('/api/foundation/push/unsubscribe', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ endpoint: token }),
        });
      }
      tokenRef.current = null;
      setStatus('disabled');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not turn off call alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.titleIcon}>🔔</Text>
        <Text style={styles.title}>Call alerts on this device</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {status === 'checking' ? <Text style={styles.note}>Checking this device…</Text> : null}

      {status === 'unsupported' ? (
        <Text style={styles.note}>
          This device cannot show call alerts. You will still see an incoming call when the app is open.
        </Text>
      ) : null}

      {status === 'denied' ? (
        <Text style={styles.note}>
          Notifications are turned off for this app in your device settings. Allow them there to turn on call
          alerts, or keep the app open to see incoming calls.
        </Text>
      ) : null}

      {status === 'disabled' ? (
        <>
          <Text style={styles.note}>
            Get woken to an incoming call on this device even when the app is closed.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, busy ? styles.btnBusy : null]}
            onPress={() => void enable()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Enable call alerts on this device"
          >
            <Text style={styles.primaryText}>{busy ? 'Turning on…' : 'Enable call alerts on this device'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {status === 'enabled' ? (
        <>
          <Text style={styles.onLabel}>On for this device</Text>
          <Text style={styles.note}>This device will be woken when a member rings you.</Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, busy ? styles.btnBusy : null]}
            onPress={() => void disable()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Turn off call alerts on this device"
          >
            <Text style={styles.secondaryText}>{busy ? 'Turning off…' : 'Turn off on this device'}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { fontSize: 14, color: COLOR },
  title: { fontSize: 14, fontWeight: '700', color: TEXT },
  note: { fontSize: 13, color: TEXT_DIM, lineHeight: 19 },
  onLabel: { fontSize: 13, color: COLOR, fontWeight: '600' },
  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { fontSize: 13, color: '#fecaca' },
  primaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLOR,
  },
  primaryText: { fontSize: 13, fontWeight: '700', color: '#1a1205' },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryText: { fontSize: 13, fontWeight: '600', color: TEXT },
  btnBusy: { opacity: 0.6 },
});
