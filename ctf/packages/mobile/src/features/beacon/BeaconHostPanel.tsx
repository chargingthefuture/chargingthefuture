/**
 * BeaconHostPanel — going live from the Android app. Shown on the Beacon screen to admins only; the
 * routes behind it are admin-gated on the server, which is the real enforcement.
 *
 * Steps, the same as the web admin page: create a draft (or pick up the event already live), set up
 * the call and fetch the host's credentials (GET ingest), take the call out of backstage (go-live,
 * which posts "live now" to the Commons), then broadcast with BeaconHostStage. End broadcast stops
 * it. Leaving the Beacon screen leaves the call; the event stays live until ended, here or on the web.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { type ThemeTokens } from '../../theme';
import {
  createBeaconEvent,
  endBeaconEvent,
  getBeaconHostCredentials,
  goLiveBeaconEvent,
  listBeaconAdminEvents,
  type BeaconEventLike,
  type BeaconHostCredentials,
} from './BeaconApi';
import { BeaconHostStage } from './BeaconHostStage';

export interface BeaconHostPanelProps {
  tokens: ThemeTokens;
  accent: string;
  displayName: string;
  onChanged: () => void;
}

type HostSession = { event: BeaconEventLike; credentials: BeaconHostCredentials };

export const BeaconHostPanel: React.FC<BeaconHostPanelProps> = ({ tokens, accent, displayName, onChanged }) => {
  const [liveEvent, setLiveEvent] = useState<BeaconEventLike | null>(null);
  const [session, setSession] = useState<HostSession | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const events = await listBeaconAdminEvents();
      setLiveEvent(events.find((event) => event.status === 'live') ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The event list did not load.');
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'That step failed.');
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  // A new event: create the draft, set up the call, then go live.
  const goLive = () =>
    run(async () => {
      const event = await createBeaconEvent(title.trim());
      const credentials = await getBeaconHostCredentials(event.id);
      await goLiveBeaconEvent(event.id);
      setSession({ event: { ...event, status: 'live' }, credentials });
      setTitle('');
    });

  // The event already live (started here or on the web): only the host credentials are needed.
  const rejoin = (event: BeaconEventLike) =>
    run(async () => {
      setSession({ event, credentials: await getBeaconHostCredentials(event.id) });
    });

  const end = (event: BeaconEventLike) =>
    run(async () => {
      setSession(null);
      await endBeaconEvent(event.id);
      setLiveEvent(null);
    });

  return (
    <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.surface, borderRadius: tokens.radius }]}>
      <Text style={[styles.heading, { color: tokens.textPrimary }]}>Go live</Text>
      {session ? (
        <>
          <Text style={[styles.body, { color: tokens.textSecondary }]}>Live: {session.event.title}</Text>
          <BeaconHostStage credentials={session.credentials} eventId={session.event.id} displayName={displayName} tokens={tokens} accent={accent} />
          <PanelButton label="End broadcast" color="#F87171" busy={busy} tokens={tokens} onPress={() => end(session.event)} />
        </>
      ) : liveEvent ? (
        <>
          <Text style={[styles.body, { color: tokens.textSecondary }]}>“{liveEvent.title}” is live.</Text>
          <PanelButton label="Broadcast to it from this phone" color={accent} busy={busy} tokens={tokens} onPress={() => rejoin(liveEvent)} />
          <PanelButton label="End broadcast" color="#F87171" busy={busy} tokens={tokens} onPress={() => end(liveEvent)} />
        </>
      ) : (
        <>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title, e.g. State of the Skills Economy"
            placeholderTextColor={tokens.textMuted}
            maxLength={160}
            style={[styles.input, { color: tokens.textPrimary, borderColor: tokens.border, borderRadius: tokens.radius }]}
          />
          <PanelButton label="Go live" color={accent} busy={busy || title.trim().length === 0} tokens={tokens} onPress={goLive} />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

function PanelButton({ label, color, busy, tokens, onPress }: {
  label: string;
  color: string;
  busy: boolean;
  tokens: ThemeTokens;
  onPress: () => Promise<void>;
}) {
  return (
    <TouchableOpacity
      disabled={busy}
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, { borderColor: color, backgroundColor: color + '22', borderRadius: tokens.radius, opacity: busy ? 0.6 : 1 }]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, gap: 10, marginBottom: 16 },
  heading: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14 },
  input: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15 },
  button: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  error: { fontSize: 13, color: '#F87171' },
});
