/**
 * ChymeChatView — companion text-chat panel for an active room.
 * Bound to real data from:
 *   - GET /api/chyme/messages — message list (id, displayName, text, sentAtIso).
 *   - POST /api/chyme/messages — send a message.
 * Omissions from mockup (no backing API field):
 *   - Per-message reaction/heart counts (no backend field).
 */
import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#22C55E';

export type ChatMessage = {
  id: string;
  displayName: string;
  text: string;
  sentAtIso: string;
};

type Props = {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onChangeInput: (_text: string) => void;
  onSend: () => void;
  onBack: () => void;
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export const ChymeChatView: React.FC<Props> = ({
  messages,
  input,
  sending,
  onChangeInput,
  onSend,
  onBack,
}) => (
  <View style={styles.container}>
    <View style={styles.statusBar}>
      <Text style={styles.clock}>9:41</Text>
      <Text style={styles.signal}>•••</Text>
    </View>

    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>‹ Room</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Room Chat</Text>
      <View style={styles.encryptedBadge}>
        <Text style={styles.encryptedText}>Encrypted</Text>
      </View>
    </View>

    <FlatList
      data={[...messages].reverse()}
      keyExtractor={(item) => item.id}
      inverted
      style={styles.list}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.messageItem}>
          <View style={styles.messageMeta}>
            <Text style={styles.messageAuthor}>{item.displayName}</Text>
            <Text style={styles.messageTime}>{formatTime(item.sentAtIso)}</Text>
          </View>
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No messages yet. Be the first to speak.</Text>
        </View>
      }
    />

    <View style={styles.inputRow}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onChangeInput}
          placeholder="Say something…"
          placeholderTextColor="#4B5563"
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, input.trim() && styles.sendBtnActive]}
          onPress={onSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnIcon}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#021006' },
  statusBar: {
    height: 44,
    backgroundColor: '#030d05',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  clock: { fontSize: 13, fontWeight: '700', color: '#E8EAF0' },
  signal: { fontSize: 12, color: '#9CA3AF' },
  header: {
    height: 52,
    backgroundColor: '#030d05',
    borderBottomWidth: 1,
    borderBottomColor: '#052e16',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { color: PRIMARY, fontSize: 14 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#F0FDF4',
  },
  encryptedBadge: {
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  encryptedText: { fontSize: 10, color: PRIMARY },
  list: { flex: 1 },
  listContent: { padding: 16 },
  messageItem: { marginBottom: 16 },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 3,
  },
  messageAuthor: { fontSize: 13, fontWeight: '700', color: '#A7F3D0' },
  messageTime: { fontSize: 11, color: '#374151' },
  messageText: { fontSize: 14, color: '#9CA3AF', lineHeight: 21 },
  empty: { flex: 1, alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#4B5563', textAlign: 'center' },
  inputRow: {
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#052e16',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#052e16',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 14, color: '#E8EAF0' },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: PRIMARY },
  sendBtnIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
