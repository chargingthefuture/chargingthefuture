// "Call alerts on this device": the switch that lets an incoming Foundation call ring this phone with
// the app closed. The Android counterpart of the web FoundationCallAlerts (foundation-call-alerts.tsx),
// using the native push instead of Web Push. callAlerts.ts does the device and server work.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { disableCallAlerts, enableCallAlerts, ensureRingChannel, loadAlertToken } from './callAlerts';
import { useFDTheme } from './useFDTheme';
import { reportError } from '../../observability/report';

type Status = 'checking' | 'on' | 'off' | 'saving';

function useCallAlerts() {
  const [status, setStatus] = useState<Status>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void ensureRingChannel().catch((channelError: unknown) => reportError(channelError, { area: 'foundation', op: 'ring_channel_create' }));
    void loadAlertToken().then((stored) => {
      if (canceled) return;
      setToken(stored);
      setStatus(stored ? 'on' : 'off');
    });
    return () => {
      canceled = true;
    };
  }, []);

  const turnOn = async () => {
    const result = await enableCallAlerts();
    if ('error' in result) {
      setError(result.error);
      return setStatus('off');
    }
    setToken(result.token as string);
    setStatus('on');
  };

  const turnOff = async (current: string) => {
    await disableCallAlerts(current);
    setToken(null);
    setStatus('off');
  };

  const toggle = (next: boolean) => {
    const previous: Status = token ? 'on' : 'off';
    setStatus('saving');
    setError(null);
    const work = next ? turnOn() : token ? turnOff(token) : Promise.resolve(setStatus('off'));
    void work.catch((toggleError: unknown) => {
      reportError(toggleError, { area: 'foundation', op: next ? 'call_alerts_enable' : 'call_alerts_disable' });
      setError(toggleError instanceof Error ? toggleError.message : 'Call alerts could not be changed.');
      setStatus(previous);
    });
  };

  return { status, error, toggle };
}

export function FoundationCallAlerts() {
  const { tokens, accent } = useFDTheme();
  const { status, error, toggle } = useCallAlerts();
  const on = status === 'on';
  const busy = status === 'checking' || status === 'saving';
  return (
    <View style={[styles.card, { borderColor: tokens.border, borderRadius: tokens.radius, backgroundColor: tokens.surface }]}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Call alerts on this device</Text>
          <Text style={[styles.body, { color: tokens.textSecondary }]}>
            {on
              ? 'This phone rings when someone calls you on Foundation, even with the app closed.'
              : 'Turn on to have this phone ring when someone calls you on Foundation. With it off, you only see a call while the app is open.'}
          </Text>
        </View>
        <Switch
          value={on}
          disabled={busy}
          onValueChange={toggle}
          trackColor={{ true: accent, false: tokens.border }}
          accessibilityLabel="Call alerts on this device"
        />
      </View>
      {error ? <Text style={[styles.body, { color: tokens.danger }]} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
});
