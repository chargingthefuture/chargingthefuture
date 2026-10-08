// The Direct Line message box, copied from the web's ChatComposer (web components/peer-programming/
// pp-chat-tab.tsx): one rounded box holding the text and a small square send button, the box growing
// from one line to six and then scrolling inside itself.
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { usePPTheme } from './usePPTheme';

// The routes refuse a message longer than this (PEER_PROGRAMMING_MAX_MESSAGE_LENGTH on the web).
const MAX_LENGTH = 2000;
const LINE_HEIGHT = 20;
const MAX_LINES = 6;
const PADDING_Y = 6;

export function ChatComposer({ onSend }: { onSend: (_body: string) => Promise<boolean> }) {
  const t = usePPTheme();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSend = text.trim().length > 0 && !submitting;
  const send = async () => {
    if (!canSend) return;
    setSubmitting(true);
    const ok = await onSend(text);
    setSubmitting(false);
    if (ok) setText('');
  };
  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { backgroundColor: t.INPUT_BG, borderColor: t.BORDER_HI, borderRadius: t.r(14) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message your cohort…"
          placeholderTextColor={t.MUTED}
          accessibilityLabel="Message your cohort"
          editable={!submitting}
          multiline
          maxLength={MAX_LENGTH}
          style={[styles.input, { color: t.TEXT }]}
        />
        <TouchableOpacity
          onPress={() => void send()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, { borderRadius: t.r(8), backgroundColor: canSend ? t.ACCENT : t.BORDER }]}
        >
          <Send size={14} color={canSend ? '#fff' : t.FAINT} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingHorizontal: 24, paddingBottom: 20 },
  box: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    maxHeight: LINE_HEIGHT * MAX_LINES + PADDING_Y * 2,
    paddingVertical: PADDING_Y,
    paddingHorizontal: 0,
    fontSize: 16,
    lineHeight: LINE_HEIGHT,
    fontFamily: interFamily('400'),
    textAlignVertical: 'top',
  },
  send: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
