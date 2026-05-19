'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HubJoinResponse, HubMessage, HubMessagesResponse } from '../../lib/hub/types';
import type { ChatMessage, ShellCurrentUser } from './shell-types';

type ChatConnectionState = 'loading' | 'live' | 'fallback';

type MessageAction = Pick<ChatMessage, 'actionLabel' | 'actionSlug'>;

function formatTimeLabel(value: string | Date | null | undefined): string {
  if (!value) return 'Now';

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return 'Now';
  }

  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getActionForText(text: string): MessageAction | null {
  const normalized = text.toLowerCase();

  if (normalized.includes('housing') || normalized.includes('lighthouse')) {
    return { actionLabel: 'Open LightHouse →', actionSlug: 'lighthouse' };
  }

  if (normalized.includes('gdp') || normalized.includes('economy')) {
    return { actionLabel: 'Open GDP →', actionSlug: 'gdp' };
  }

  if (normalized.includes('service credit')) {
    return { actionLabel: 'Open Service Credits →', actionSlug: 'service-credits' };
  }

  if (normalized.includes('directory') || normalized.includes('provider')) {
    return { actionLabel: 'Open Directory →', actionSlug: 'directory' };
  }

  return null;
}

function buildChatMessage(
  id: string,
  from: 'hub' | 'user',
  text: string,
  time: string,
  senderLabel?: string,
): ChatMessage {
  const action = from === 'hub' ? getActionForText(text) : null;

  return {
    id,
    from,
    text,
    time,
    senderLabel,
    ...(action ?? {}),
  };
}

function mapStoredMessage(message: HubMessage, currentUserId: string): ChatMessage {
  const from = message.userId === currentUserId ? 'user' : 'hub';
  return buildChatMessage(
    message.id,
    from,
    message.text,
    formatTimeLabel(message.sentAtIso),
    message.displayName,
  );
}

function getMessageDedupKey(message: ChatMessage): string {
  return [message.from, message.senderLabel ?? '', message.text.trim().toLowerCase(), message.time].join('|');
}

function mergeMessages(existing: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const merged = [...existing];
  const seen = new Set(existing.map(getMessageDedupKey));

  for (const message of next) {
    const key = getMessageDedupKey(message);
    if (seen.has(key)) {
      continue;
    }

    merged.push(message);
    seen.add(key);
  }

  return merged;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? payload.message
      : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }

  return payload as T;
}

export function useHomeChat(currentUser: ShellCurrentUser) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('loading');
  const [isSending, setIsSending] = useState(false);

  const refreshHistory = useCallback(async () => {
    const payload = await requestJson<HubMessagesResponse>('/api/hub/messages?limit=50');
    const nextMessages = payload.messages.map((message) => mapStoredMessage(message, currentUser.userId));
    setMessages((previous) => mergeMessages(previous, nextMessages));
  }, [currentUser.userId]);

  useEffect(() => {
    let active = true;
    let pollId: number | undefined;

    setConnectionState('loading');
    setError(null);
    setMessages([]);

    async function bootstrapChat() {
      try {
        await refreshHistory();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load live chat history.');
        }
      }

      try {
        const join = await requestJson<HubJoinResponse>('/api/hub/join', { method: 'POST' });
        if (!active) return;
        void join;
        setConnectionState('live');
        setError(null);
        pollId = window.setInterval(() => {
          void refreshHistory().catch(() => {
            // Keep polling while the shell is mounted.
          });
        }, 10000);
      } catch (joinError) {
        if (!active) return;

        setConnectionState('fallback');
        setError(joinError instanceof Error ? joinError.message : 'Live chat is reconnecting.');
        pollId = window.setInterval(() => {
          void refreshHistory().catch(() => {
            // Polling keeps trying in fallback mode.
          });
        }, 15000);
      }
    }

    void bootstrapChat();

    return () => {
      active = false;
      if (pollId) {
        window.clearInterval(pollId);
      }
    };
  }, [currentUser.displayName, currentUser.userId, refreshHistory]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    setInput('');

    try {
      const payload = await requestJson<{ ok: true; message: HubMessage }>('/api/hub/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      const savedMessage = mapStoredMessage(payload.message, currentUser.userId);
      setMessages((previous) => mergeMessages(previous, [savedMessage]));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send your message right now.');
    } finally {
      setIsSending(false);
    }
  }, [currentUser.displayName, currentUser.userId, input, isSending]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isSending,
    isLoading: connectionState === 'loading',
    isLive: connectionState === 'live',
    error,
  };
}
