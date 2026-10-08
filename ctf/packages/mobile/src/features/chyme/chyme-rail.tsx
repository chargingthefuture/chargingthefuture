// The strip under the screen header, copied from the web Chyme shell (web components/chyme/
// chyme-shell.tsx): the rooms rail (Main Room and the private Weavers of the Commons room), then
// the hosting statement. The web rail adds a "Get the Android app" card only off Android, so the
// app, which is the Android app, has the two room cards.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock, Radio } from 'lucide-react-native';
import { HOSTING_NOT_ENDORSEMENT_SHORT } from '@ctf/shared';
import { interFamily } from '../../components/ui';
import type { ChymeRoomScope } from './ChymeApi';
import { useChymeTokens } from './chyme-tokens';
import { WeaversBadge } from './weavers-badge';

function RoomCard({ active, onPress, icon, title, subtitle }: { active: boolean; onPress: () => void; icon: (_color: string) => React.ReactNode; title: string; subtitle: string }) {
  const t = useChymeTokens();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        styles.card,
        {
          borderRadius: t.radius(14),
          borderColor: active ? t.ACCENT_TINT_40 : t.BORDER,
          backgroundColor: active ? t.ACCENT_TINT_15 : t.INPUT_BG,
        },
      ]}
    >
      <View style={styles.cardTop}>
        {icon(active ? t.ACCENT : t.SUBTLE)}
        <Text style={[styles.cardTitle, { color: active ? t.ACCENT : t.TITLE }]}>{title}</Text>
      </View>
      <Text style={[styles.cardSubtitle, { color: t.FAINT }]}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export function ChymeRoomsRail({ roomScope, onSelect }: { roomScope: ChymeRoomScope; onSelect: (_scope: ChymeRoomScope) => void }) {
  const t = useChymeTokens();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Chyme rooms"
      style={[styles.rail, { backgroundColor: t.HEADER, borderBottomColor: t.BORDER }]}
      contentContainerStyle={styles.railContent}
    >
      <RoomCard
        active={roomScope === 'main'}
        onPress={() => onSelect('main')}
        icon={(color) => <Radio size={15} color={color} />}
        title="Main Room"
        subtitle="Open to all members"
      />
      <RoomCard
        active={roomScope === 'contributors'}
        onPress={() => onSelect('contributors')}
        icon={(color) => (
          <View style={styles.weaversIcon}>
            <WeaversBadge size={15} />
            <Lock size={12} color={color} />
          </View>
        )}
        title="Weavers of the Commons"
        subtitle="Private · earned by contributors"
      />
    </ScrollView>
  );
}

export function ChymeHostingNote() {
  const t = useChymeTokens();
  return (
    <View style={[styles.note, { borderBottomColor: t.BORDER, backgroundColor: t.HEADER }]}>
      <Text style={[styles.noteText, { color: t.SUBTLE }]}>{HOSTING_NOT_ENDORSEMENT_SHORT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexGrow: 0, borderBottomWidth: 1 },
  railContent: { gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  card: { width: 180, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weaversIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTitle: { flexShrink: 1, fontSize: 13, lineHeight: 17, fontFamily: interFamily('700') },
  cardSubtitle: { fontSize: 11, lineHeight: 15, fontFamily: interFamily('400') },
  note: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  noteText: { fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400') },
});
