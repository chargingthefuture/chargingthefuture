'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { connectHubLive, type HubLiveConnection, type HubTypingUser } from '../../lib/hub/live-stream';
import type { GatedChannelMessage } from '../../lib/contributor-access/channel-repository';
import type { ShellCurrentUser } from './shell-types';

// Gated contributor channel — client hook. A deliberately smaller sibling of useHomeChat: same
// architecture (DB-backed history over polling, Stream as a best-effort live layer for instant
// refresh + typing), none of the Commons extras (no AI assistant, no concierge, no filters).
// Threads are the same Signal-style quoted replies the Commons uses.

const POLL_INTERVAL_FALLBACK_MS = 10_000;
const POLL_INTERVAL_LIVE_MS = 30_000;

export type GatedReplyTarget = {
  postId: string;
  quote: { author: string; snippet: string };
};

type GatedJoinResponse =
  | {
    ok: true;
    configured: true;
    streamApiKey: string;
    streamChannelType: string;
    streamChannelId: string;
    streamUserId: string;
    streamToken: string;
  }
  | {
    ok: true;
    configured: false;
  };

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Now';
  const datePart = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  return `${datePart}, ${timePart}`;
}

export type GatedChatMessage = {
  id: string;
  from: 'user' | 'peer';
  senderLabel: string;
  text: string;
  timeLabel: string;
  sentAtIso: string;
  quotedMessage: { author: string; snippet: string; postId: string | null } | null;
  reactions: { emoji: string; count: number; reactedByMe: boolean }[];
};

function mapMessage(message: GatedChannelMessage, currentUserId: string): GatedChatMessage {
  return {
    id: message.id,
    from: message.authorUserId === currentUserId ? 'user' : 'peer',
    senderLabel: message.displayName,
    text: message.body,
    timeLabel: formatTimeLabel(message.createdAtIso),
    sentAtIso: message.createdAtIso,
    quotedMessage: message.quotedMessage,
    reactions: message.reactions,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

// Flip the member's reaction on one message (optimistic; the poll reconciles).
function applyReactionToggle(message: GatedChatMessage, emoji: string): GatedChatMessage {
  const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
  if (existing) {
    const nextCount = existing.reactedByMe ? existing.count - 1 : existing.count + 1;
    const next = nextCount <= 0
      ? message.reactions.filter((reaction) => reaction.emoji !== emoji)
      : message.reactions.map((reaction) =>
        reaction.emoji === emoji ? { emoji, count: nextCount, reactedByMe: !existing.reactedByMe } : reaction,
      );
    return { ...message, reactions: next };
  }
  return { ...message, reactions: [...message.reactions, { emoji, count: 1, reactedByMe: true }] };
}

export function useGatedChat(currentUser: ShellCurrentUser) {
  const [messages, setMessages] = useState<GatedChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<GatedReplyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<HubTypingUser[]>([]);
  const liveConnectionRef = useRef<HubLiveConnection | null>(null);

  const refreshHistory = useCallback(async () => {
    const payload = await requestJson<{ ok: true; messages: GatedChannelMessage[] }>(
      '/api/contributor-access/channel/messages',
    );
    setMessages(payload.messages.map((message) => mapMessage(message, currentUser.userId)));
  }, [currentUser.userId]);

  const refreshHistoryRef = useRef(refreshHistory);
  useEffect(() => {
    refreshHistoryRef.current = refreshHistory;
  }, [refreshHistory]);

  useEffect(() => {
    let active = true;
    let pollId: number | undefined;
    setIsLoading(true);
    setError(null);
    setMessages([]);

    async function bootstrap() {
      try {
        await refreshHistory();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the channel.');
        }
      } finally {
        if (active) setIsLoading(false);
      }

      const startPoll = (intervalMs: number) => {
        pollId = window.setInterval(() => {
          void refreshHistoryRef.current().catch(() => {
            // Keep polling while mounted; transient failures are covered by the next tick.
          });
        }, intervalMs);
      };

      try {
        const join = await requestJson<GatedJoinResponse>('/api/contributor-access/channel/join', { method: 'POST' });
        if (!active) return;

        let live: HubLiveConnection | null = null;
        if (join.configured) {
          live = await connectHubLive(
            {
              streamApiKey: join.streamApiKey,
              streamToken: join.streamToken,
              streamUserId: join.streamUserId,
              streamChannelId: join.streamChannelId,
              streamChannelType: join.streamChannelType,
            },
            {
              onActivity: () => {
                void refreshHistoryRef.current().catch(() => undefined);
              },
              onTypingChange: (typing) => {
                if (active) setTypingUsers(typing);
              },
            },
          );
        }

        if (!active) {
          if (live) void live.disconnect();
          return;
        }

        if (live) {
          liveConnectionRef.current = live;
          setIsLive(true);
          startPoll(POLL_INTERVAL_LIVE_MS);
        } else {
          setTypingUsers([]);
          startPoll(POLL_INTERVAL_FALLBACK_MS);
        }
      } catch {
        if (!active) return;
        // The live layer is best-effort — polling keeps the channel fully functional.
        startPoll(POLL_INTERVAL_FALLBACK_MS);
      }
    }

    void bootstrap();

    return () => {
      active = false;
      if (pollId) {
        window.clearInterval(pollId);
      }
      const live = liveConnectionRef.current;
      liveConnectionRef.current = null;
      if (live) {
        void live.disconnect();
      }
    };
  }, [currentUser.userId, refreshHistory]);

  const notifyTyping = useCallback(() => {
    liveConnectionRef.current?.sendTyping();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) {
      return;
    }
    const activeReply = replyTarget;
    setIsSending(true);
    setError(null);
    setInput('');
    setReplyTarget(null);
    liveConnectionRef.current?.stopTyping();

    try {
      await requestJson<{ ok: true; message: GatedChannelMessage }>('/api/contributor-access/channel/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(activeReply ? { text, replyToPostId: activeReply.postId } : { text }),
      });
      await refreshHistory().catch(() => undefined);
    } catch (sendError) {
      if (activeReply) {
        setReplyTarget(activeReply);
      }
      setError(sendError instanceof Error ? sendError.message : 'Unable to send your message right now.');
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, refreshHistory, replyTarget]);

  // Delete a post (author-only server-side; admins may remove any post — the disclosed moderator
  // power). Same optimistic pattern as the Commons deleteMessage: drop it from the stream, then
  // DELETE; on failure restore it and surface the error.
  const deleteMessage = useCallback(async (postId: string) => {
    let removed: GatedChatMessage[] = [];
    setMessages((previous) => {
      removed = previous.filter((message) => message.id === postId);
      return previous.filter((message) => message.id !== postId);
    });

    try {
      await requestJson<{ ok: true; postId: string }>(
        `/api/contributor-access/channel/messages/${encodeURIComponent(postId)}`,
        {
          method: 'DELETE',
          headers: { 'x-ctf-csrf': '1' },
        },
      );
      await refreshHistory().catch(() => undefined);
    } catch (deleteError) {
      // Restore the optimistically removed post in time order and surface the error.
      if (removed.length > 0) {
        setMessages((previous) =>
          [...previous, ...removed].sort((a, b) => a.sentAtIso.localeCompare(b.sentAtIso)),
        );
      }
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the message right now.');
    }
  }, [refreshHistory]);

  const beginReply = useCallback((message: GatedChatMessage) => {
    setReplyTarget({
      postId: message.id,
      quote: { author: message.senderLabel, snippet: message.text.trim().slice(0, 120) },
    });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const toggleReaction = useCallback(async (postId: string, emoji: string) => {
    setMessages((previous) =>
      previous.map((message) => (message.id === postId ? applyReactionToggle(message, emoji) : message)),
    );
    try {
      await requestJson<{ ok: true; reacted: boolean }>(
        `/api/contributor-access/channel/messages/${encodeURIComponent(postId)}/reactions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify({ emoji }),
        },
      );
    } catch (reactError) {
      // Revert the optimistic flip (toggling again undoes it).
      setMessages((previous) =>
        previous.map((message) => (message.id === postId ? applyReactionToggle(message, emoji) : message)),
      );
      setError(reactError instanceof Error ? reactError.message : 'Unable to update your reaction right now.');
    }
  }, []);

  return {
    messages,
    input,
    setInput,
    notifyTyping,
    typingUsers,
    replyTarget,
    beginReply,
    cancelReply,
    sendMessage,
    toggleReaction,
    deleteMessage,
    isLoading,
    isLive,
    isSending,
    error,
  };
}
