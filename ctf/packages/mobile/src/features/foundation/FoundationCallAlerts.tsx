// "Call alerts on this device", copied from the web CallAlerts (foundation-call-alerts.tsx): the same
// card, notes and buttons. The device work is the native push in callAlerts.ts instead of Web Push, so
// an incoming Foundation call rings this phone with the app closed.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BellRing } from 'lucide-react-native';
import { disableCallAlerts, enableCallAlerts, ensureRingChannel, loadAlertToken } from './callAlerts';
import { FDButton, looks } from './FDButton';
import { ErrorBanner } from './FDParts';
import { font, useFDTheme } from './useFDTheme';
import { reportError } from '../../observability/report';

type Status = 'checking' | 'enabled' | 'disabled';

function useCallAlerts() {
  const [status, setStatus] = useState<Status>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void ensureRingChannel().catch((channelError: unknown) => reportError(channelError, { area: 'foundation', op: 'ring_channel_create' }));
    void loadAlertToken().then((stored) => {
      if (canceled) return;
      setToken(stored);
      setStatus(stored ? 'enabled' : 'disabled');
    });
    return () => {
      canceled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await enableCallAlerts();
      if ('error' in result) return setError(result.error);
      setToken(result.token as string);
      setStatus('enabled');
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'call_alerts_enable' });
      setError(caught instanceof Error ? caught.message : 'Could not turn on call alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      if (token) await disableCallAlerts(token);
      setToken(null);
      setStatus('disabled');
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'call_alerts_disable' });
      setError(caught instanceof Error ? caught.message : 'Could not turn off call alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return { status, busy, error, enable, disable };
}

export function FoundationCallAlerts() {
  const { t, r } = useFDTheme();
  const { status, busy, error, enable, disable } = useCallAlerts();
  const note = [font(13), styles.note, { color: t.SUBTLE }];
  return (
    <View style={[styles.card, { borderRadius: r(12), borderColor: t.BORDER_STRONG }]}>
      <View style={styles.head}>
        <BellRing size={16} color={t.ACCENT} />
        <Text style={[font(14, '700'), { color: t.TITLE }]}>Call alerts on this device</Text>
      </View>
      {error ? <ErrorBanner text={error} style={styles.errorBanner} /> : null}
      {status === 'checking' ? <Text style={note}>Checking this device…</Text> : null}
      {status === 'disabled' ? (
        <>
          <Text style={note}>Get woken to an incoming call on this device even when the app is closed.</Text>
          <FDButton
            label={busy ? 'Turning on…' : 'Enable call alerts on this device'}
            disabled={busy}
            dimmed={0.6}
            look={looks(t).primary}
            pad={[9, 16]}
            radius={10}
            size={13}
            onPress={() => void enable()}
          />
        </>
      ) : null}
      {status === 'enabled' ? (
        <>
          <Text style={[font(13, '600'), { color: t.ACCENT }]}>On for this device</Text>
          <Text style={note}>This device will be woken when a member rings you.</Text>
          <FDButton
            label={busy ? 'Turning off…' : 'Turn off on this device'}
            disabled={busy}
            dimmed={0.6}
            look={looks(t).neutral}
            weight="600"
            pad={[9, 16]}
            radius={10}
            size={13}
            onPress={() => void disable()}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { lineHeight: 19.5 },
  errorBanner: { paddingVertical: 8, paddingHorizontal: 12 },
});
