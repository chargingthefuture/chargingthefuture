'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { connectCommonsLive, type CommonsLiveConnection, type CommonsTypingUser } from '../../lib/commons/live-stream';
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

// Pull the human-readable text off a caught error, falling back to a fixed message.
function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof Error) return caught.message;
  return fallback;
}

// Best-effort disconnect that tolerates a null connection.
function disconnectLive(live: CommonsLiveConnection | null): void {
  if (live) void live.disconnect();
}

// Poll DB-backed history on a fixed cadence; transient failures are covered by the next tick.
function startHistoryPoll(intervalMs: number, refresh: () => Promise<void>): number {
  return window.setInterval(() => {
    void refresh().catch(() => {
      // Keep polling while mounted; transient failures are covered by the next tick.
    });
  }, intervalMs);
}

type CommonsLiveHandlers = {
  onActivity: () => void;
  onTypingChange: (typing: CommonsTypingUser[]) => void;
};

// Open the Stream live layer when the join response is configured; otherwise there is no live layer.
async function connectLiveIfConfigured(
  join: GatedJoinResponse,
  handlers: CommonsLiveHandlers,
): Promise<CommonsLiveConnection | null> {
  if (!join.configured) return null;
  return connectCommonsLive(
    {
      streamApiKey: join.streamApiKey,
      streamToken: join.streamToken,
      streamUserId: join.streamUserId,
      streamChannelId: join.streamChannelId,
      streamChannelType: join.streamChannelType,
    },
    handlers,
  );
}

export function useGatedChat(currentUser: ShellCurrentUser) {
  const [messages, setMessages] = useState<GatedChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<GatedReplyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<CommonsTypingUser[]>([]);
  const liveConnectionRef = useRef<CommonsLiveConnection | null>(null);

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

    const poll = () => refreshHistoryRef.current();

    async function bootstrap() {
      try {
        await refreshHistory();
      } catch (loadError) {
        if (active) {
          setError(errorMessage(loadError, 'Unable to load the channel.'));
        }
      } finally {
        if (active) setIsLoading(false);
      }

      try {
        const join = await requestJson<GatedJoinResponse>('/api/contributor-access/channel/join', {
          method: 'POST',
          headers: { 'x-ctf-csrf': '1' },
        });
        if (!active) return;

        const live = await connectLiveIfConfigured(join, {
          onActivity: () => {
            void refreshHistoryRef.current().catch(() => undefined);
          },
          onTypingChange: (typing) => {
            if (active) setTypingUsers(typing);
          },
        });

        if (!active) {
          disconnectLive(live);
          return;
        }

        if (live) {
          liveConnectionRef.current = live;
          setIsLive(true);
          pollId = startHistoryPoll(POLL_INTERVAL_LIVE_MS, poll);
        } else {
          setTypingUsers([]);
          pollId = startHistoryPoll(POLL_INTERVAL_FALLBACK_MS, poll);
        }
      } catch {
        if (!active) return;
        // The live layer is best-effort — polling keeps the channel fully functional.
        pollId = startHistoryPoll(POLL_INTERVAL_FALLBACK_MS, poll);
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
      disconnectLive(live);
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
      setError(errorMessage(sendError, 'Unable to send your message right now.'));
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
      setError(errorMessage(deleteError, 'Unable to delete the message right now.'));
    }
  }, [refreshHistory]);

  // Edit one of the member's OWN messages. There is no in-place edit — editing is delete + repost —
  // so this loads the message text into the composer and deletes the original; the member tweaks it
  // and sends a fresh message. Clears any active reply so the reposted text starts clean.
  const editMessage = useCallback(
    (postId: string, text: string) => {
      setInput(text);
      void deleteMessage(postId);
    },
    [deleteMessage],
  );

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
      setError(errorMessage(reactError, 'Unable to update your reaction right now.'));
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
    editMessage,
    isLoading,
    isLive,
    isSending,
    error,
  };
}
