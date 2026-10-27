'use client';

// Problems members proposed, oldest first. Each can be approved as new, merged into a problem
// already listed (anything suggested under it moves there), or deleted as spam. Who proposed it is
// never shown.
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { responseFailureText } from 'lib/errors/client-failure';
import { adminMutate, type AdminProblem } from './ww-admin-shared';
import { getWhatWorksTokens } from './ww-shared';

type Pending = { id: string; title: string; context: string; createdAt: string };
type Action = 'approve' | 'merge' | 'spam';

function usePending() {
  const [items, setItems] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/what-works/admin/problems/pending', { cache: 'no-store' });
      if (!res.ok) throw new Error(await responseFailureText(res, 'Could not load proposed problems.'));
      setItems(((await res.json()) as { problems?: Pending[] }).problems ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load proposed problems.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { items, error, reload: load };
}

function ProposalRow({ item, listed, onDone }: { item: Pending; listed: AdminProblem[]; onDone: () => Promise<void> }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const [intoId, setIntoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (action: Action) => {
    setBusy(true);
    const result = await adminMutate(`/api/what-works/admin/problems/${item.id}/review`, 'POST', { action, intoId: intoId || undefined });
    setBusy(false);
    if (!result.ok) return setMessage(result.message ?? 'The review could not be saved.');
    await onDone();
  };
  const button = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.BORDER_SOLID}`, background: t.INPUT_BG, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  return (
    <div style={{ padding: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{item.title}</div>
      {item.context ? <div style={{ fontSize: 13, color: t.MUTED }}>{item.context}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" disabled={busy} style={button} onClick={() => void run('approve')}>
          Approve as new
        </button>
        <select aria-label="Merge into" value={intoId} onChange={(event) => setIntoId(event.target.value)} style={{ ...button, cursor: 'pointer' }}>
          <option value="">Merge into…</option>
          {listed.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
            </option>
          ))}
        </select>
        <button type="button" disabled={busy || !intoId} style={button} onClick={() => void run('merge')}>
          Merge
        </button>
        <button type="button" disabled={busy} style={button} onClick={() => void run('spam')}>
          Delete as spam
        </button>
      </div>
      {message ? (
        <div role="alert" style={{ fontSize: 13, color: t.TITLE }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}

export function WhatWorksAdminProposals({ listed, onChanged }: { listed: AdminProblem[]; onChanged: () => Promise<void> }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const { items, error, reload } = usePending();
  const [listError, setListError] = useState<string | null>(null);
  const done = async () => {
    await reload();
    await onChanged().then(
      () => setListError(null),
      (changeError: unknown) => setListError(changeError instanceof Error ? changeError.message : 'Could not reload the problem list.'),
    );
  };
  return (
    <section aria-label="Proposed problems" style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: t.TITLE }}>Proposed problems · {items.length}</div>
      {error ?? listError ? <div role="alert" style={{ fontSize: 13, color: t.TITLE }}>{error ?? listError}</div> : null}
      {items.length === 0 && !error ? <div style={{ fontSize: 13, color: t.MUTED }}>Nothing waiting.</div> : null}
      {items.map((item) => (
        <ProposalRow key={item.id} item={item} listed={listed} onDone={done} />
      ))}
    </section>
  );
}
