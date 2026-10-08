/**
 * The "Broadcast: <title>" card of Beacon Admin, copied from BroadcastSection and CopyRow in the web
 * admin page (components/beacon/beacon-admin-shell.tsx): Go live or End broadcast, the host's own
 * broadcast controls, the broadcaster-app address and stream key, and, while live, chat moderation
 * with the admin's own chat view. Renders nothing unless an event is open and not ended.
 *
 * The web's "Broadcast from this browser — camera and microphone, or a computer screen" heading over
 * the host controls is left out: in the app there is no browser and no computer screen.
 * The stream key is shown masked and only ever copied; it is never logged.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, Copy } from 'lucide-react-native';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { type BeaconChatCredentials, type BeaconHostCredentials } from './BeaconApi';
import { type BeaconAdminEvent, type BeaconIngest, type BeaconModerationAction } from './BeaconAdminApi';
import { BeaconHostStage } from './BeaconHostStage';
import {
  adminCardStyle, cardTitleText, chipStyle, chipText, ctaStyle, ctaText, DANGER_BG, DANGER_BORDER, DANGER_TEXT,
  font, inputStyle, radius, sectionLabelText, type BeaconTokens,
} from './BeaconTheme';

export type BroadcastSectionProps = {
  t: BeaconTokens;
  activeEvent: BeaconAdminEvent | null;
  ingest: BeaconIngest | null;
  host: BeaconHostCredentials | null;
  chat: BeaconChatCredentials | null;
  copied: string | null;
  moderateTarget: string;
  onGoLive: (_eventId: string) => void;
  onEndEvent: (_eventId: string) => void;
  onModerate: (_eventId: string, _action: BeaconModerationAction, _extra?: { targetUserId?: string; cooldownSeconds?: number }) => void;
  onCopy: (_label: string, _value: string) => void;
  onModerateTargetChange: (_value: string) => void;
};

function CopyRow({ t, label, value, copied, onCopy, masked }: { t: BeaconTokens; label: string; value: string; copied: boolean; onCopy: () => void; masked?: boolean }) {
  const shown = value.length === 0 ? '(not provided by Stream)' : masked ? '••••••••••••' : value;
  return (
    <View style={styles.copyRow}>
      <Text style={[styles.copyLabel, { color: t.SUBTLE }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.code, { color: t.TITLE, backgroundColor: t.HEADER, borderColor: t.BORDER_SOLID, borderRadius: radius(t, 8) }]}
      >
        {shown}
      </Text>
      <TouchableOpacity onPress={onCopy} disabled={value.length === 0} accessibilityRole="button" accessibilityLabel={`Copy ${label}`} style={chipStyle(t)}>
        {copied ? <Check size={14} color={t.TITLE} /> : <Copy size={14} color={t.TITLE} />}
        <Text style={chipText(t)}>{copied ? 'Copied' : 'Copy'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ModerationBlock({ t, event, chat, moderateTarget, onModerate, onModerateTargetChange }: BroadcastSectionProps & { event: BeaconAdminEvent }) {
  const chip = (label: string, onPress: () => void) => (
    <TouchableOpacity key={label} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={chipStyle(t)}>
      <Text style={chipText(t)}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.block}>
      <Text style={sectionLabelText(t)}>Moderate the chat</Text>
      <View style={styles.modRow}>
        <TextInput
          value={moderateTarget}
          onChangeText={onModerateTargetChange}
          placeholder="member user id"
          placeholderTextColor={t.SUBTLE}
          autoCapitalize="none"
          autoCorrect={false}
          style={[inputStyle(t), styles.modInput]}
        />
        {chip('Mute', () => moderateTarget && onModerate(event.id, 'mute', { targetUserId: moderateTarget }))}
        {chip('Ban', () => moderateTarget && onModerate(event.id, 'ban', { targetUserId: moderateTarget }))}
        {chip('Slow-mode 10s', () => onModerate(event.id, 'slow_mode', { cooldownSeconds: 10 }))}
        {chip('Slow-mode off', () => onModerate(event.id, 'slow_mode', { cooldownSeconds: 0 }))}
      </View>
      {chat ? (
        <View style={[styles.chat, { borderRadius: radius(t, 12), borderColor: t.BORDER_SOLID }]}>
          <StreamChatView
            streamApiKey={chat.streamApiKey}
            streamToken={chat.streamToken}
            streamUserId={chat.streamUserId}
            streamChannelId={chat.streamChannelId}
            channelType={chat.streamChannelType}
            accentColor={t.ACCENT}
          />
        </View>
      ) : null}
    </View>
  );
}

export function BeaconBroadcastSection(props: BroadcastSectionProps) {
  const { t, activeEvent: event, ingest, host, copied, onGoLive, onEndEvent, onCopy } = props;
  if (!event || event.status === 'ended') return null;
  return (
    <View style={adminCardStyle(t)}>
      <Text style={cardTitleText(t)}>Broadcast: {event.title}</Text>
      {event.status === 'draft' ? (
        <TouchableOpacity onPress={() => onGoLive(event.id)} accessibilityRole="button" style={[ctaStyle(t, 18, 10), styles.primary]}>
          <Text style={ctaText(t)}>Go live</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onEndEvent(event.id)}
          accessibilityRole="button"
          style={[ctaStyle(t, 18, 10), styles.primary, { backgroundColor: DANGER_BG, borderColor: DANGER_BORDER }]}
        >
          <Text style={[ctaText(t), { color: DANGER_TEXT }]}>End broadcast</Text>
        </TouchableOpacity>
      )}

      {host ? (
        <View style={styles.block}>
          <BeaconHostStage credentials={host} eventId={event.id} displayName="Beacon host" t={t} />
        </View>
      ) : null}

      {ingest ? (
        <View style={styles.block}>
          <Text style={sectionLabelText(t)}>Or use a broadcaster app — push to this RTMP target</Text>
          <CopyRow t={t} label="RTMP URL" value={ingest.rtmpIngestUrl} copied={copied === 'RTMP URL'} onCopy={() => onCopy('RTMP URL', ingest.rtmpIngestUrl)} />
          <CopyRow t={t} label="Stream key" value={ingest.streamKey} copied={copied === 'Stream key'} onCopy={() => onCopy('Stream key', ingest.streamKey)} masked />
        </View>
      ) : null}

      {event.status === 'live' ? <ModerationBlock {...props} event={event} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: { marginTop: 8 },
  block: { marginTop: 18 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  copyLabel: { width: 88, fontSize: 12, ...font('400') },
  code: { flex: 1, fontSize: 12, fontFamily: 'monospace', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10 },
  modRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  modInput: { marginBottom: 0, width: '100%', maxWidth: 240 },
  chat: { marginTop: 14, height: 360, borderWidth: 1, overflow: 'hidden' },
});
