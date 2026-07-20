/**
 * ChymeChatView — companion text-chat panel for an active room.
 * Bound to real data from:
 *   - GET /api/chyme/messages — message list (id, username, text, sentAtIso).
 *   - POST /api/chyme/messages — send a message.
 * Omissions from mockup (no backing API field):
 *   - Per-message reaction/heart counts (no backend field).
 */
import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { chymeHandle } from './api';

export type ChatMessage = {
  id: string;
  userId: string;
  username: string | null;
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

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Date + time, built manually so it does not depend on React Native's inconsistent Intl/toLocaleString
// support. Example: "Jun 19, 13:23".
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${time}`;
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
}) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('chyme', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
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
            <Text style={styles.messageAuthor}>{chymeHandle(item.username, item.userId)}</Text>
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
          placeholderTextColor={tokens.textMuted}
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, input.trim() && styles.sendBtnActive]}
          onPress={onSend}
          disabled={!input.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendBtnIcon}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  const PRIMARY = accent;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04160A' },
  statusBar: {
    height: 44,
    backgroundColor: '#030d05',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  clock: { fontSize: 13, fontWeight: '700', fontFamily: interFamily('700'), color: t.textShell },
  signal: { fontSize: 12, color: t.textSecondary, fontFamily: interFamily('400') },
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
  backBtnText: { color: PRIMARY, fontSize: 14, fontFamily: interFamily('400') },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: interFamily('700'),
    color: '#F0FDF4',
  },
  list: { flex: 1 },
  listContent: { padding: 16 },
  messageItem: { marginBottom: 16 },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 3,
  },
  messageAuthor: { fontSize: 13, fontWeight: '700', fontFamily: interFamily('700'), color: '#A7F3D0' },
  messageTime: { fontSize: 11, color: '#374151', fontFamily: interFamily('400') },
  messageText: { fontSize: 14, color: t.textSecondary, lineHeight: 21, fontFamily: interFamily('400') },
  empty: { flex: 1, alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: t.textMuted, textAlign: 'center', fontFamily: interFamily('400') },
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
  input: { flex: 1, fontSize: 14, color: t.textShell, fontFamily: interFamily('400') },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: PRIMARY },
  sendBtnIcon: { color: '#fff', fontSize: 20, fontWeight: '700', fontFamily: interFamily('700') },
  });
}
