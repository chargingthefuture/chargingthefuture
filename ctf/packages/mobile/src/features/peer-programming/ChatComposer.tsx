// A text box with a send button, used for a new message and for a reply.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PPButton, PPTextBox } from './PPButton';

// The routes refuse a message longer than this (PEER_PROGRAMMING_MAX_MESSAGE_LENGTH on the web).
const MAX_LENGTH = 2000;

export function ChatComposer({ placeholder, sendLabel, onSend, onCancel }: {
  placeholder: string;
  sendLabel: string;
  onSend: (_body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    const ok = await onSend(text);
    setSending(false);
    if (ok) setText('');
  };
  return (
    <View style={styles.stack}>
      <PPTextBox value={text} onChange={setText} lines={2} maxLength={MAX_LENGTH} placeholder={placeholder} />
      <View style={styles.row}>
        <PPButton label={sending ? 'Sending…' : sendLabel} primary disabled={sending || text.trim().length === 0} onPress={() => void send()} />
        {onCancel ? <PPButton label="Cancel" disabled={sending} onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
});
