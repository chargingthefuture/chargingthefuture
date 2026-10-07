// One message in the cohort chat, with the replies under it and, for a cohort member while the
// cohort is running, a Reply button that opens a reply box.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RoomMember, RoomMessage } from './PeerProgrammingApi';
import { authorName, formatStamp, type Thread } from './ppChat';
import { ChatComposer } from './ChatComposer';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';

function MessageBody({ message, members }: { message: RoomMessage; members: RoomMember[] }) {
  const { tokens } = usePPTheme();
  return (
    <View style={styles.message}>
      <Text style={[styles.meta, { color: tokens.textMuted }]}>
        {authorName(message.authorUserId, members)} · {formatStamp(message.createdAtIso)}
      </Text>
      <Text style={[styles.body, { color: tokens.textPrimary }]}>{message.body}</Text>
    </View>
  );
}

export function ChatThread({ thread, members, canPost, onReply }: {
  thread: Thread;
  members: RoomMember[];
  canPost: boolean;
  onReply: (_messageId: string, _body: string) => Promise<boolean>;
}) {
  const { tokens } = usePPTheme();
  const [replying, setReplying] = useState(false);
  const send = async (body: string) => {
    const ok = await onReply(thread.message.id, body);
    if (ok) setReplying(false);
    return ok;
  };
  return (
    <View style={[styles.thread, { borderColor: tokens.border, backgroundColor: tokens.surface, borderRadius: tokens.radius }]}>
      <MessageBody message={thread.message} members={members} />
      {thread.replies.length > 0 ? (
        <View style={[styles.replies, { borderLeftColor: tokens.border }]}>
          {thread.replies.map((reply) => <MessageBody key={reply.id} message={reply} members={members} />)}
        </View>
      ) : null}
      {canPost && replying ? (
        <ChatComposer placeholder="Reply to this message…" sendLabel="Send reply" onSend={send} onCancel={() => setReplying(false)} />
      ) : null}
      {canPost && !replying ? <PPButton label="Reply" onPress={() => setReplying(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { borderWidth: 1, padding: 10, gap: 8 },
  message: { gap: 3 },
  meta: { fontSize: 11 },
  body: { fontSize: 15, lineHeight: 21 },
  replies: { borderLeftWidth: 2, paddingLeft: 10, gap: 8 },
});
