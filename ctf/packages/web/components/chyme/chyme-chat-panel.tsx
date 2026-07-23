'use client';

import type { RefObject } from 'react';
import { Hash, Pencil, Send, Trash2 } from 'lucide-react';
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
  onEditMessage,
  onDeleteMessage,
}: {
  messages: ChymeMessage[];
  currentUserId: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  // Edit = delete + repost (loads the text into the composer, deletes the original); Delete removes
  // the member's own message. Both act on the member's own messages only.
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
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
      <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '12px 14px', minHeight: 200, maxHeight: '50vh' }}>
        {messages.length === 0 ? (
          <div style={{ color: t.FAINT, fontSize: 13 }}>No messages yet.</div>
        ) : (
          messages.map((message) => {
            const isOwn = message.userId === currentUserId;
            return (
              <div key={message.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isOwn ? t.ACCENT : '#A7F3D0' }}>{chymeHandle(message.username, message.userId)}</span>
                  <span style={{ fontSize: 11, color: '#374151' }}>{new Date(message.sentAtIso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {/* Wrap long unbroken strings (e.g. a pasted URL) so a message can never widen the
                    window and make it scroll left/right — the chat only scrolls up and down. */}
                <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{message.text}</div>
                {/* Edit / Delete on the member's own messages only (there is no in-place edit — edit
                    loads the text into the composer and deletes the original, so a fix is a fresh row). */}
                {isOwn ? (
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => onEditMessage(message.id, message.text)}
                      aria-label="Edit your message"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: t.FAINT, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this message? This cannot be undone. To change it, delete and send again.')) {
                          onDeleteMessage(message.id);
                        }
                      }}
                      aria-label="Delete your message"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#F87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
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
