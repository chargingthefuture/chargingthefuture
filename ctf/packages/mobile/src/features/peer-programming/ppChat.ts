// Chat helpers: author names and grouping replies under the message they answer.
import type { RoomMember, RoomMessage } from './PeerProgrammingApi';

export type Thread = { message: RoomMessage; replies: RoomMessage[] };

// The author's username from the cohort roster, or a short id when it could not be resolved. Same
// fallback as the web room, so one author reads the same way on both.
export function authorName(authorUserId: string, members: RoomMember[]): string {
  const member = members.find((item) => item.userId === authorUserId);
  return member?.username ?? `Member ${authorUserId.slice(0, 6)}`;
}

// Top-level messages in the order the room returns them, each with its replies. A reply whose parent
// is not in the list is shown as a top-level message so nothing goes missing.
export function groupThreads(messages: RoomMessage[]): Thread[] {
  const ids = new Set(messages.map((message) => message.id));
  const threads: Thread[] = [];
  const byId = new Map<string, Thread>();
  for (const message of messages) {
    if (message.parentMessageId && ids.has(message.parentMessageId)) continue;
    const thread = { message, replies: [] };
    threads.push(thread);
    byId.set(message.id, thread);
  }
  for (const message of messages) {
    if (message.parentMessageId) byId.get(message.parentMessageId)?.replies.push(message);
  }
  return threads;
}

// Date and time, not time alone, so messages from different days can be told apart.
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
