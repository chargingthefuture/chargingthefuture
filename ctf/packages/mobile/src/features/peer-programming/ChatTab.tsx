// The cohort chat (the web's Direct Line): messages from GET /api/peer-programming/room with their
// replies, a box to post, and a notice instead of the box when the viewer cannot post (no cohort, an
// ended cohort, or listening in). After a post the room is reloaded, since the room route is the
// source of truth for the messages.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { failureOf, postMessage, postReply, type ActionResult, type Room } from './PeerProgrammingApi';
import { groupThreads } from './ppChat';
import { ChatComposer } from './ChatComposer';
import { ChatThread } from './ChatThread';
import { usePPTheme } from './usePPTheme';

// Why the viewer cannot post, or null when they can.
function postingBlocked(room: Room): string | null {
  if (!room.cohort) return 'Join a cohort to participate in chat';
  if (room.ended) return 'This cohort has ended — the conversation is read-only.';
  if (room.access !== 'member') return 'You’re listening in — only cohort members can post here.';
  return null;
}

export function ChatTab({ room, onPosted, onError }: {
  room: Room;
  onPosted: () => Promise<void>;
  onError: (_message: string | null) => void;
}) {
  const { tokens } = usePPTheme();
  const blocked = postingBlocked(room);
  const cohortId = room.cohort?.id ?? '';
  const threads = groupThreads(room.messages);

  const settle = async (result: ActionResult): Promise<boolean> => {
    onError(failureOf(result));
    if (result.ok) await onPosted();
    return result.ok;
  };

  return (
    <View style={styles.stack}>
      {threads.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.textSecondary }]}>No messages yet. Start the conversation!</Text>
      ) : (
        threads.map((thread) => (
          <ChatThread
            key={thread.message.id}
            thread={thread}
            members={room.members}
            canPost={blocked === null}
            onReply={async (messageId, body) => settle(await postReply(cohortId, messageId, body))}
          />
        ))
      )}
      {blocked ? (
        <Text style={[styles.notice, { color: tokens.textSecondary, borderColor: tokens.border }]}>{blocked}</Text>
      ) : (
        <ChatComposer placeholder="Message your cohort…" sendLabel="Send" onSend={async (body) => settle(await postMessage(cohortId, body))} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  empty: { fontSize: 15, textAlign: 'center', marginVertical: 24 },
  notice: { fontSize: 13, textAlign: 'center', paddingVertical: 12, borderTopWidth: 1 },
});
