'use client';

import type { RefObject } from 'react';
import { Hash, Send } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle } from './chyme-shared';
import type { ChymeMessage } from 'lib/chyme/types';

export function ChymeChatPanel({
  messages,
  currentUserId,
  draft,
  onDraftChange,
  onSend,
  sending,
  messagesEndRef,
}: {
  messages: ChymeMessage[];
  currentUserId: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ width: '100%', borderLeft: 'none', borderTop: `1px solid ${t.BORDER}`, display: 'flex', flexDirection: 'column', background: t.HEADER, flexShrink: 0 }}>
      <div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Hash size={14} style={{ color: t.ACCENT }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>Room Chat</span>
      </div>
      {/* The message list is a bounded window: it grows with content up to ~half the viewport, then
          scrolls inside itself. This keeps the chat a fixed-size window (new messages scroll within
          it, they don't stretch the page) without a full-height lock that clipped the input below. */}
      <div style={{ overflowY: 'auto', padding: '12px 14px', minHeight: 200, maxHeight: '50vh' }}>
        {messages.length === 0 ? (
          <div style={{ color: t.FAINT, fontSize: 13 }}>No messages yet.</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: message.userId === currentUserId ? t.ACCENT : '#A7F3D0' }}>{chymeHandle(message.username, message.userId)}</span>
                <span style={{ fontSize: 11, color: '#374151' }}>{new Date(message.sentAtIso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5 }}>{message.text}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ flexShrink: 0, padding: '10px 14px', borderTop: `1px solid ${t.BORDER}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: '8px 12px' }}>
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            placeholder="Send a message…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: t.TEXT }}
          />
          <button
            onClick={onSend}
            aria-label="Send"
            disabled={sending || !draft.trim()}
            style={{ width: 28, height: 28, borderRadius: 6, background: draft.trim() ? t.ACCENT : 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.trim() ? 'pointer' : 'not-allowed' }}
          >
            <Send size={12} style={{ color: draft.trim() ? '#fff' : t.FAINT }} />
          </button>
        </div>
      </div>
    </div>
  );
}
