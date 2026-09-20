'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Hash, LogIn } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, chymeHandle } from './chyme-shared';
import type { ChymeMessage } from 'lib/chyme/types';

// How often the signed-out page re-reads the room chat. The member room polls its own chat too; a
// guest has no Stream chat identity, so polling the public route is how new messages arrive.
const POLL_MS = 10_000;

type ChatState =
  | { kind: 'loading' }
  | { kind: 'ready'; messages: ChymeMessage[] }
  | { kind: 'error'; message: string };

function isMessageList(value: unknown): value is ChymeMessage[] {
  return Array.isArray(value);
}

// The route's own words when it gave any, then the status, so a 429 and a 503 read differently.
function failedRead(status: number, body: Record<string, unknown>): ChatState {
  const serverMessage =
    typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'The server returned an error.';
  return { kind: 'error', message: `${serverMessage} (HTTP ${status})` };
}

async function readPublicChat(): Promise<ChatState> {
  const res = await fetch('/api/chyme/public/messages?limit=50');
  const data: unknown = await res.json().catch(() => null);
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  if (!res.ok) {
    return failedRead(res.status, body);
  }
  return { kind: 'ready', messages: isMessageList(body.messages) ? body.messages : [] };
}

// The room chat for a signed-out visitor: the same messages members see, read-only, with one way
// in — sign in to write (owner directive, 2026-09-18). Rendered only while the room is live, under
// the stage, in the member panel's look so the two views read as one product.
//
// Closed until the visitor opens it (owner directive, 2026-09-20): open, it was half the phone
// screen, so the room, the schedule and the way in all sat below the fold on a page whose job is
// to get somebody listening. Closed it is one row, and the rest of the page fits one screen.
// Nothing is read while it is closed either — the poll starts on the first open.
//
// `refreshKey` is bumped by the page's refresh button; a change re-reads at once and restarts the poll.
export function ChymeGuestChat({ signInUrl, refreshKey = 0 }: { signInUrl: string; refreshKey?: number }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const [state, setState] = useState<ChatState>({ kind: 'loading' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    const load = async () => {
      try {
        const next = await readPublicChat();
        if (canceled) return;
        setState(next);
      } catch (error) {
        if (canceled) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [open, refreshKey]);

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${t.BORDER}`, background: t.HEADER, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="chyme-guest-chat-body"
        style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: t.TITLE }}
      >
        <Hash size={14} style={{ color: t.ACCENT }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>Room Chat</span>
        <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{open ? 'read-only' : 'read what members are saying'}</span>
        {open ? <ChevronDown size={16} style={{ color: t.MUTED }} /> : <ChevronRight size={16} style={{ color: t.MUTED }} />}
      </button>
      {open ? (
        <>
          <div id="chyme-guest-chat-body" style={{ overflowY: 'auto', overflowX: 'hidden', padding: '12px 14px', borderTop: `1px solid ${t.BORDER}`, minHeight: 120, maxHeight: '40vh' }}>
            <GuestChatBody state={state} />
          </div>
          <a
            href={signInUrl}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', borderTop: `1px solid ${t.BORDER}`, color: t.ACCENT, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
          >
            <LogIn size={13} /> Sign in to chat
          </a>
        </>
      ) : null}
    </div>
  );
}

function GuestChatBody({ state }: { state: ChatState }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  if (state.kind === 'loading') {
    return <div style={{ color: t.FAINT, fontSize: 13 }}>Loading the room chat…</div>;
  }
  if (state.kind === 'error') {
    return (
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, wordBreak: 'break-word' }}>
        Couldn&apos;t load the room chat. {state.message}
      </div>
    );
  }
  if (state.messages.length === 0) {
    return <div style={{ color: t.FAINT, fontSize: 13 }}>No messages yet.</div>;
  }
  return (
    <>
      {state.messages.map((message) => (
        <div key={message.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#A7F3D0' }}>{chymeHandle(message.username, message.userId)}</span>
            <span style={{ fontSize: 11, color: '#374151' }}>{new Date(message.sentAtIso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{message.text}</div>
        </div>
      ))}
    </>
  );
}
