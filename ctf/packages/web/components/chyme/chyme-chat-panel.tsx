'use client';

import type { RefObject } from 'react';
import { Hash, Send } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BORDER, PRIMARY, chymeHandle } from './chyme-shared';
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
  const isMobile = useIsMobile();
  return (
    <div style={{ width: isMobile ? '100%' : 300, borderLeft: isMobile ? 'none' : `1px solid ${BORDER}`, borderTop: isMobile ? `1px solid ${BORDER}` : undefined, display: 'flex', flexDirection: 'column', background: '#030d05', flexShrink: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Hash size={14} style={{ color: PRIMARY }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#F0FDF4' }}>Room Chat</span>
        <span style={{ marginLeft: 'auto', background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}25`, fontSize: 10, padding: '2px 8px', borderRadius: 12 }}>Encrypted</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: isMobile ? 220 : undefined }}>
        {messages.length === 0 ? (
          <div style={{ color: '#4B5563', fontSize: 13 }}>No messages yet.</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: message.userId === currentUserId ? PRIMARY : '#A7F3D0' }}>{chymeHandle(message.username, message.userId)}</span>
                <span style={{ fontSize: 11, color: '#374151' }}>{new Date(message.sentAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5 }}>{message.text}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px' }}>
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            placeholder="Send a message…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#E8EAF0' }}
          />
          <button
            onClick={onSend}
            disabled={sending || !draft.trim()}
            style={{ width: 28, height: 28, borderRadius: 6, background: draft.trim() ? PRIMARY : 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.trim() ? 'pointer' : 'not-allowed' }}
          >
            <Send size={12} style={{ color: draft.trim() ? '#fff' : '#4B5563' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
