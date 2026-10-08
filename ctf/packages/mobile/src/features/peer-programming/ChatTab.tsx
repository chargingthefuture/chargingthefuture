// The Direct Line tab, copied from the web's PeerProgrammingChatTab (web components/peer-programming/
// pp-chat-tab.tsx): the open cohort's messages in the order the room returns them, each with the
// author's initials, name and time over a bubble, then the message box, or a one-line notice in its
// place when the viewer cannot post (no cohort, an ended cohort, or listening in).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import type { Room, RoomMember, RoomMessage } from './PeerProgrammingApi';
import { authorName, formatStamp, initials } from './ppChat';
import { ChatComposer } from './ChatComposer';
import { usePPTheme } from './usePPTheme';

function MessageRow({ message, members }: { message: RoomMessage; members: RoomMember[] }) {
  const t = usePPTheme();
  const author = authorName(message.authorUserId, members);
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { borderRadius: t.r(10), backgroundColor: `${t.ACCENT}30` }]}>
        <Text style={[styles.avatarText, { color: t.ACCENT }]}>{initials(author || '?')}</Text>
      </View>
      <View style={styles.messageCol}>
        <Text style={[styles.meta, { color: t.MUTED }]}>{author} · {formatStamp(message.createdAtIso)}</Text>
        <View style={[styles.bubble, { borderColor: t.BORDER }, t.r(12) ? styles.bubbleShape : null]}>
          <Text style={[styles.body, { color: t.TEXT }]}>{message.body}</Text>
        </View>
      </View>
    </View>
  );
}

function ChatNotice({ text, color }: { text: string; color: string }) {
  const t = usePPTheme();
  return <Text style={[styles.notice, { color, borderTopColor: t.BORDER }]}>{text}</Text>;
}

function ChatFooter({ room, onSend }: { room: Room; onSend: (_body: string) => Promise<boolean> }) {
  const t = usePPTheme();
  if (!room.cohort) return <ChatNotice color={t.MUTED} text="Join a cohort to participate in chat" />;
  if (room.ended) return <ChatNotice color={t.SUBTLE} text="This cohort has ended — the conversation is read-only." />;
  if (room.access !== 'member') return <ChatNotice color={t.SUBTLE} text="You’re listening in — only cohort members can post here." />;
  return <ChatComposer onSend={onSend} />;
}

export function ChatTab({ room, onSend }: { room: Room; onSend: (_body: string) => Promise<boolean> }) {
  const t = usePPTheme();
  return (
    <View>
      <View style={styles.list}>
        {room.messages.length === 0 ? (
          <View style={styles.empty}>
            <MessageSquare size={32} color={t.ACCENT} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: t.SUBTLE }]}>No messages yet. Start the conversation!</Text>
          </View>
        ) : (
          room.messages.map((message) => <MessageRow key={message.id} message={message} members={room.members} />)
        )}
      </View>
      <ChatFooter room={room} onSend={onSend} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 16, paddingHorizontal: 24 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 12 },
  avatar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: interFamily('700') },
  messageCol: { maxWidth: '70%' },
  meta: { fontSize: 11, marginBottom: 3, fontFamily: interFamily('400') },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  bubbleShape: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderBottomLeftRadius: 4 },
  body: { fontSize: 14, lineHeight: 22.4, fontFamily: interFamily('400') },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { opacity: 0.5, marginBottom: 8 },
  emptyText: { fontSize: 15, fontFamily: interFamily('400') },
  notice: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: interFamily('400'),
  },
});
