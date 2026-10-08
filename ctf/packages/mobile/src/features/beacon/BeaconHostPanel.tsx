/**
 * BeaconHostPanel — going live from the Android app. Shown on the Beacon screen to admins only; the
 * routes behind it are admin-gated on the server, which is the real enforcement.
 *
 * Copies the web admin page's banners and its "Create an event" and "Broadcast: …" cards
 * (components/beacon/beacon-admin-shell.tsx); the steps live in useBeaconHost. Leaving the Beacon
 * screen leaves the call; the event stays live until ended, here or on the web.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextStyle, type ViewStyle } from 'react-native';
import { BeaconHostStage } from './BeaconHostStage';
import { useBeaconHost } from './useBeaconHost';
import {
  ctaStyle,
  ctaText,
  DANGER_BG,
  DANGER_BORDER,
  DANGER_TEXT,
  font,
  radius,
  type BeaconTokens,
} from './BeaconTheme';

export interface BeaconHostPanelProps {
  t: BeaconTokens;
  displayName: string;
  onChanged: () => void;
}

export const BeaconHostPanel: React.FC<BeaconHostPanelProps> = ({ t, displayName, onChanged }) => {
  const h = useBeaconHost(onChanged);
  const event = h.activeEvent;
  return (
    <View>
      {h.error ? <Banner t={t} text={h.error} color={DANGER_TEXT} borderColor={DANGER_BORDER} /> : null}
      {h.notice ? <Banner t={t} text={h.notice} color={t.ACCENT} borderColor={`${t.ACCENT}55`} /> : null}

      <View style={cardStyle(t)}>
        <Text style={[styles.cardTitle, { color: t.TITLE }]}>Create an event</Text>
        <Text style={[styles.label, { color: t.SUBTLE }]}>Title</Text>
        <TextInput
          value={h.title}
          onChangeText={h.setTitle}
          placeholder="State of the Skills Economy"
          placeholderTextColor={t.SUBTLE}
          accessibilityLabel="Title"
          style={inputStyle(t)}
        />
        <Text style={[styles.label, { color: t.SUBTLE }]}>Description</Text>
        <TextInput
          value={h.description}
          onChangeText={h.setDescription}
          multiline
          numberOfLines={3}
          accessibilityLabel="Description"
          style={[inputStyle(t), styles.textarea]}
        />
        <PanelButton t={t} label={h.creating ? 'Creating…' : 'Create draft'} disabled={h.creating} onPress={() => void h.createEvent()} />
      </View>

      {event && event.status !== 'ended' ? (
        <View style={cardStyle(t)}>
          <Text style={[styles.cardTitle, { color: t.TITLE }]}>Broadcast: {event.title}</Text>
          {event.status === 'draft' ? (
            <PanelButton t={t} label="Go live" disabled={h.busy} onPress={() => void h.goLive(event)} />
          ) : (
            <PanelButton t={t} label="End broadcast" danger disabled={h.busy} onPress={() => void h.endEvent(event)} />
          )}
          {h.host ? (
            <View style={styles.stage}>
              <BeaconHostStage credentials={h.host} eventId={event.id} displayName={displayName} t={t} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

function Banner({ t, text, color, borderColor }: { t: BeaconTokens; text: string; color: string; borderColor: string }) {
  return (
    <View style={[styles.banner, { backgroundColor: t.SURFACE, borderColor, borderRadius: radius(t, 10) }]}>
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
}

// web primaryButtonStyle; End broadcast swaps in the red fill, border and text.
function PanelButton({ t, label, danger, disabled, onPress }: {
  t: BeaconTokens;
  label: string;
  danger?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const box: ViewStyle = danger ? { backgroundColor: DANGER_BG, borderColor: DANGER_BORDER } : {};
  const text: TextStyle = danger ? { color: DANGER_TEXT } : {};
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[ctaStyle(t, 18, 10), styles.button, box]}
    >
      <Text style={[ctaText(t), text]}>{label}</Text>
    </TouchableOpacity>
  );
}

function cardStyle(t: BeaconTokens): ViewStyle {
  return {
    marginTop: 18,
    borderRadius: radius(t, 14),
    backgroundColor: t.HEADER,
    borderWidth: 1,
    borderColor: t.BORDER_SOLID,
    padding: 18,
  };
}

function inputStyle(t: BeaconTokens): TextStyle {
  return {
    backgroundColor: t.SURFACE,
    borderWidth: 1,
    borderColor: t.BORDER_SOLID,
    borderRadius: radius(t, 10),
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: t.TITLE,
    fontSize: 14,
    marginBottom: 8,
    ...font('400'),
  };
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, ...font('700'), marginBottom: 12 },
  label: { fontSize: 12, ...font('600'), marginTop: 8, marginBottom: 4 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  button: { marginTop: 8 },
  stage: { marginTop: 18 },
  banner: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  bannerText: { fontSize: 14, ...font('400') },
});
