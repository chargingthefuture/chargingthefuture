'use client';

// Propose a problem that is not on the list. Listed problems that share words with what the member
// types appear as they type, so they can pick one instead; a proposal waits for review, and a
// duplicate is merged into the problem already listed.
import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens } from './ww-shared';

type Similar = { id: string; title: string };

function useSimilar(text: string): Similar[] {
  const [items, setItems] = useState<Similar[]>([]);
  useEffect(() => {
    if (text.trim().length < 3) {
      setItems([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      fetch(`/api/what-works/problems/similar?q=${encodeURIComponent(text.trim())}`, { cache: 'no-store' })
        .then(async (res) => ((await res.json().catch(() => null)) as { problems?: Similar[] } | null)?.problems ?? [])
        .then((problems) => {
          if (active) setItems(problems);
        })
        .catch(() => {
          // no-trace: the matches are a hint; without them the member can still propose.
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [text]);
  return items;
}

async function propose(title: string, context: string): Promise<string | null> {
  const res = await fetch('/api/what-works/problems', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ title, context }),
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? body.message : `The problem could not be saved (HTTP ${res.status}).`;
}

export function WhatWorksProposeProblem({ onPick }: { onPick: (_problemId: string) => void }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const similar = useSimilar(title);
  const field = { width: '100%', boxSizing: 'border-box' as const, padding: '11px 14px', background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 12, color: t.TITLE, fontSize: 14, fontFamily: 'inherit' };

  async function send() {
    setState({ kind: 'sending' });
    const failure = await propose(title.trim(), context.trim());
    if (failure) return setState({ kind: 'error', message: failure });
    setState({ kind: 'sent' });
    setTitle('');
    setContext('');
  }

  return (
    <div style={{ marginTop: 18, padding: 16, borderRadius: 14, border: `1px dashed ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Not on the list? Propose a problem</div>
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>
        It waits for review before it shows. A duplicate is merged into the problem already listed, so check the matches first.
      </div>
      <input aria-label="The problem" placeholder="The problem, in a few words" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} style={field} />
      {similar.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: t.MUTED }}>Already listed. Tap one to add your item there:</div>
          {similar.map((item) => (
            <button key={item.id} type="button" onClick={() => onPick(item.id)} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.ACCENT}50`, background: 'transparent', color: t.TITLE, fontSize: 13, cursor: 'pointer' }}>
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
      <textarea aria-label="When it happens (optional)" placeholder="When it happens (optional)" value={context} maxLength={280} rows={2} onChange={(event) => setContext(event.target.value)} style={field} />
      {state.kind === 'error' ? <div role="alert" style={{ fontSize: 13, color: t.TITLE }}>{state.message}</div> : null}
      {state.kind === 'sent' ? <div role="status" style={{ fontSize: 13, color: t.ACCENT }}>Sent for review. It shows on the list once approved.</div> : null}
      <button
        type="button"
        disabled={!title.trim() || state.kind === 'sending'}
        onClick={() => void send()}
        style={{ alignSelf: 'flex-start', padding: '10px 18px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !title.trim() || state.kind === 'sending' ? 0.6 : 1 }}
      >
        {state.kind === 'sending' ? 'Sending…' : 'Propose it'}
      </button>
    </div>
  );
}
