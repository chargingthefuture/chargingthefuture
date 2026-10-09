/**
 * BeaconAdmin — the Beacon Admin screen in the Android app, copied from the web admin page
 * (components/beacon/beacon-admin-shell.tsx at /admin/beacon). Admins only: the app opens it from
 * the Admin button in the Beacon header, and every route behind it is admin-gated on the server.
 *
 * Below the header, as on the web: the error and notice banners, "Create an event", the
 * "Broadcast: <title>" card for the open event, and "Event history". Opening an event scrolls the
 * Broadcast card into view, as the web does. Leaving the screen leaves the call; the event stays
 * live until it is ended, here or on the web.
 */
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import { BeaconBroadcastSection } from './BeaconBroadcastSection';
import { BeaconEventHistory } from './BeaconEventHistory';
import {
  adminCardStyle, bannerStyle, cardTitleText, ctaStyle, ctaText, DANGER_BORDER, DANGER_TEXT, font, getBeaconTokens,
  inputStyle, labelText, type BeaconTokens,
} from './BeaconTheme';
import { useBeaconAdmin, type BeaconAdminState } from './useBeaconAdmin';

function CreateEventCard({ t, a }: { t: BeaconTokens; a: BeaconAdminState }) {
  return (
    <View style={adminCardStyle(t)}>
      <Text style={cardTitleText(t)}>Create an event</Text>
      <Text style={labelText(t)}>Title</Text>
      <TextInput
        value={a.title}
        onChangeText={a.setTitle}
        placeholder="State of the Skills Economy"
        placeholderTextColor={t.SUBTLE}
        accessibilityLabel="Title"
        style={inputStyle(t)}
      />
      <Text style={labelText(t)}>Description</Text>
      <TextInput
        value={a.description}
        onChangeText={a.setDescription}
        multiline
        numberOfLines={3}
        accessibilityLabel="Description"
        style={[inputStyle(t), styles.textarea]}
      />
      <TouchableOpacity
        onPress={() => void a.createEvent()}
        disabled={a.creating}
        accessibilityRole="button"
        style={[ctaStyle(t, 18, 10), styles.primary]}
      >
        <Text style={ctaText(t)}>{a.creating ? 'Creating…' : 'Create draft'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const BeaconAdmin: React.FC = () => {
  const { tokens, theme } = useTheme();
  const t = React.useMemo(() => getBeaconTokens(tokens, theme), [tokens, theme]);
  const a = useBeaconAdmin();
  const scrollRef = useRef<ScrollView | null>(null);
  const broadcastY = useRef(0);

  // On a phone the Broadcast card sits above the history, so opening an event scrolls to it.
  useEffect(() => {
    if (a.activeEventId) {
      scrollRef.current?.scrollTo({ y: broadcastY.current, animated: true });
    }
  }, [a.activeEventId]);

  return (
    <ScrollView ref={scrollRef} style={[styles.root, { backgroundColor: t.BG }]} contentContainerStyle={styles.content}>
      {a.error ? (
        <View style={bannerStyle(t, DANGER_BORDER)}>
          <Text style={[styles.banner, { color: DANGER_TEXT }]}>{a.error}</Text>
        </View>
      ) : null}
      {a.notice ? (
        <View style={bannerStyle(t, `${t.ACCENT}55`)}>
          <Text style={[styles.banner, { color: t.ACCENT }]}>{a.notice}</Text>
        </View>
      ) : null}

      <CreateEventCard t={t} a={a} />

      <View onLayout={(event) => { broadcastY.current = event.nativeEvent.layout.y; }}>
        <BeaconBroadcastSection
          t={t}
          activeEvent={a.activeEvent}
          ingest={a.ingest}
          host={a.host}
          chat={a.chat}
          copied={a.copied}
          moderateTarget={a.moderateTarget}
          onGoLive={(eventId) => void a.goLive(eventId)}
          onEndEvent={(eventId) => void a.endEvent(eventId)}
          onModerate={(eventId, action, extra) => void a.moderate(eventId, action, extra)}
          onCopy={a.copy}
          onModerateTargetChange={a.setModerateTarget}
        />
      </View>

      <BeaconEventHistory
        t={t}
        loading={a.loading}
        events={a.events}
        confirmDeleteId={a.confirmDeleteId}
        deletingId={a.deletingId}
        onOpen={(eventId) => void a.openEvent(eventId)}
        onDelete={(eventId) => void a.deleteDraft(eventId)}
        onArmDelete={a.setConfirmDeleteId}
        onCancelDelete={() => a.setConfirmDeleteId(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingVertical: 32, paddingHorizontal: 20 },
  banner: { fontSize: 14, ...font('400') },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  primary: { marginTop: 8 },
});
