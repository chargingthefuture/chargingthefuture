// What sits behind the room's More button, the Android copy of the web (web components/chyme/
// se-room/se-room-more.tsx): Refresh the room, the admin's speak-mode switch, and for each other
// person in the call Tip, Back Channel and an admin's moderation actions. Drawn by whichever part
// of the room is showing, over the screen.

import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SE_LIVE_ROOM_WORDS as W } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { useChymeEmbed } from '../chyme-embed';
import { SeRoomIcon } from './SeRoomIcon';
import { useSeRoomStyles } from './useSeRoomStyles';

export type SeRoomPerson = { key: string; accountId: string; name: string; actions: React.ReactNode };

function People({ people }: { people: SeRoomPerson[] }) {
  const { s } = useSeRoomStyles();
  return (
    <>
      <Text style={s.sheetLabel}>{W.people}</Text>
      {people.length === 0 ? <Text style={s.status}>{W.noPeople}</Text> : null}
      {people.map((person) => (
        <View key={person.key} style={s.person}>
          <View style={s.personName}>
            <SeAvatar accountId={person.accountId} size={32} />
            <Text style={s.personNameText}>{person.name}</Text>
          </View>
          <View style={s.personActions}>{person.actions}</View>
        </View>
      ))}
    </>
  );
}

export function SeRoomMoreSheet({ admin, people }: { admin?: React.ReactNode; people?: SeRoomPerson[] }) {
  const embed = useChymeEmbed();
  const { t, s } = useSeRoomStyles();
  if (!embed) return null;
  const close = () => embed.setMoreOpen(false);
  return (
    <Modal visible={embed.moreOpen} transparent animationType="slide" onRequestClose={close}>
      <View style={s.sheetLayer}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} onPress={close} style={s.backdrop} />
        <View style={s.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.sheetBody}>
            <View style={s.sheetHead}>
              <Text accessibilityRole="header" style={s.sheetTitle}>
                {W.moreTitle}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} onPress={close} style={s.round}>
                <SeRoomIcon name="close" size={16} strokeWidth={2.4} color={t.ink} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity accessibilityRole="button" disabled={embed.refreshing} onPress={embed.refresh} style={s.pill}>
              <Text style={s.pillText}>{embed.refreshing ? W.refreshing : W.refresh}</Text>
            </TouchableOpacity>
            {admin}
            {people ? <People people={people} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// A one-line notice in the room: the quota policy, hand-raise mode, a dropped connection.
export function SeRoomNotice({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  const { s } = useSeRoomStyles();
  return (
    <View accessibilityRole="alert" style={[s.notice, warn ? s.noticeWarn : null]}>
      {typeof children === 'string' ? <Text style={[s.noticeText, warn ? s.noticeTextWarn : null]}>{children}</Text> : children}
    </View>
  );
}
