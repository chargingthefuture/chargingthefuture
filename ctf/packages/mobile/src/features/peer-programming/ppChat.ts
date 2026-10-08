// Name and time helpers for the Direct Line and the session roster, the same as the web shell's
// (web components/peer-programming/peer-programming-shell.tsx, pp-shared.ts, pp-chat-tab.tsx).
import type { RoomMember } from './PeerProgrammingApi';

// A member's username, or a short id when it could not be resolved.
export function memberName(member: RoomMember): string {
  return member.username ?? `Member ${member.userId.slice(0, 6)}`;
}

// The author's username from the cohort roster, or a short id when it could not be resolved.
export function authorName(authorUserId: string, members: RoomMember[]): string {
  const member = members.find((item) => item.userId === authorUserId);
  return member?.username ?? `Member ${authorUserId.slice(0, 6)}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Date and time, not time alone, so messages from different days can be told apart.
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
