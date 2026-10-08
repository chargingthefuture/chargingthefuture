// Room Chat, copied from the web (web components/chyme/chyme-chat-panel.tsx): a panel inside the
// room, opened by the room's Chat button, with a bounded message window that scrolls inside itself,
// Edit and Delete under the member's own messages, and the composer at the bottom. Edit is delete
// + repost, as on the web: the text goes back into the composer and the original is deleted.

import React, { useRef } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Hash, Pencil, Send, Trash2 } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { chymeHandle, type ChymeMessage } from './ChymeApi';
import { useChymeTokens, type ChymeTokens } from './chyme-tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The web prints toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:
// '2-digit' }), e.g. "Oct 8, 09:05 PM". Built by hand so it does not lean on the phone's Intl data.
function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hour12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const suffix = d.getHours() < 12 ? 'AM' : 'PM';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${String(hour12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

type ChatProps = {
  messages: ChymeMessage[];
  currentUserId: string;
  draft: string;
  onDraftChange: (_value: string) => void;
  onSend: () => void;
  sending: boolean;
  onEditMessage: (_id: string, _text: string) => void;
  onDeleteMessage: (_id: string) => void;
};

function confirmDelete(onDelete: () => void) {
  Alert.alert('Delete this message? This cannot be undone. To change it, delete and send again.', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', onPress: onDelete },
  ]);
}

function OwnActions({ message, t, onEdit, onDelete }: { message: ChymeMessage; t: ChymeTokens; onEdit: ChatProps['onEditMessage']; onDelete: ChatProps['onDeleteMessage'] }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.action} onPress={() => onEdit(message.id, message.text)} accessibilityRole="button" accessibilityLabel="Edit your message">
        <Pencil size={11} color={t.FAINT} />
        <Text style={[styles.actionText, { color: t.FAINT }]}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => confirmDelete(() => onDelete(message.id))} accessibilityRole="button" accessibilityLabel="Delete your message">
        <Trash2 size={11} color="#F87171" />
        <Text style={[styles.actionText, { color: '#F87171' }]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

function MessageRow({ message, isOwn, t, onEdit, onDelete }: { message: ChymeMessage; isOwn: boolean; t: ChymeTokens; onEdit: ChatProps['onEditMessage']; onDelete: ChatProps['onDeleteMessage'] }) {
  return (
    <View style={styles.message}>
      <View style={styles.meta}>
        <Text style={[styles.author, { color: isOwn ? t.ACCENT : '#A7F3D0' }]}>{chymeHandle(message.username, message.userId)}</Text>
        <Text style={styles.time}>{formatSentAt(message.sentAtIso)}</Text>
      </View>
      <Text style={[styles.text, { color: t.SUBTLE }]}>{message.text}</Text>
      {isOwn ? <OwnActions message={message} t={t} onEdit={onEdit} onDelete={onDelete} /> : null}
    </View>
  );
}

function Composer({ draft, onDraftChange, onSend, sending, t }: Pick<ChatProps, 'draft' | 'onDraftChange' | 'onSend' | 'sending'> & { t: ChymeTokens }) {
  const hasText = draft.trim().length > 0;
  return (
    <View style={[styles.composerWrap, { borderTopColor: t.BORDER }]}>
      <View style={[styles.composer, { backgroundColor: t.INPUT_BG, borderColor: t.BORDER, borderRadius: t.radius(10) }]}>
        <TextInput
          value={draft}
          onChangeText={onDraftChange}
          onSubmitEditing={onSend}
          returnKeyType="send"
          placeholder="Send a message…"
          placeholderTextColor={t.MUTED}
          style={[styles.input, { color: t.TEXT }]}
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={sending || !hasText}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, { borderRadius: t.radius(6), backgroundColor: hasText ? t.ACCENT : 'transparent' }]}
        >
          <Send size={12} color={hasText ? '#fff' : t.FAINT} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ChymeChatPanel(props: ChatProps) {
  const t = useChymeTokens();
  const listRef = useRef<ScrollView>(null);
  return (
    <View style={[styles.panel, { borderTopColor: t.BORDER, backgroundColor: t.HEADER }]}>
      <View style={[styles.head, { borderBottomColor: t.BORDER }]}>
        <Hash size={14} color={t.ACCENT} />
        <Text style={[styles.headTitle, { color: t.TITLE }]}>Room Chat</Text>
      </View>
      {/* A bounded window: it grows with the messages up to half the screen, then scrolls inside. */}
      <ScrollView
        ref={listRef}
        nestedScrollEnabled
        style={{ maxHeight: Dimensions.get('window').height * 0.5 }}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      >
        {props.messages.length === 0 ? (
          <Text style={[styles.empty, { color: t.FAINT }]}>No messages yet.</Text>
        ) : (
          props.messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              isOwn={message.userId === props.currentUserId}
              t={t}
              onEdit={props.onEditMessage}
              onDelete={props.onDeleteMessage}
            />
          ))
        )}
      </ScrollView>
      <Composer draft={props.draft} onDraftChange={props.onDraftChange} onSend={props.onSend} sending={props.sending} t={t} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', borderTopWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  headTitle: { fontSize: 14, fontFamily: interFamily('600') },
  list: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 200 },
  empty: { fontSize: 13, fontFamily: interFamily('400') },
  message: { marginBottom: 14 },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  author: { fontSize: 13, fontFamily: interFamily('600') },
  time: { fontSize: 11, color: '#374151', fontFamily: interFamily('400') },
  text: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11, fontFamily: interFamily('600') },
  composerWrap: { paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 13, padding: 0, fontFamily: interFamily('400') },
  send: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
