'use client';

// Problem curation (functional admin surface). Problems are the admin-owned categories that
// members attach suggestions to; this is where they are created, renamed, and deactivated.
import { useState } from 'react';
import type { AdminProblem } from './ww-admin-shared';

type CreateDraft = { emoji: string; title: string; context: string };

type Props = {
  problems: AdminProblem[];
  busyId: string | null;
  creating: boolean;
  onCreate: (draft: CreateDraft) => Promise<boolean>;
  onToggleActive: (problem: AdminProblem) => void;
  onDelete: (problem: AdminProblem) => void;
};

export function WhatWorksAdminProblems({ problems, busyId, creating, onCreate, onToggleActive, onDelete }: Props) {
  const [emoji, setEmoji] = useState('');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');

  async function create(): Promise<void> {
    if (!title.trim() || creating) return;
    const ok = await onCreate({ emoji: emoji.trim(), title: title.trim(), context: context.trim() });
    if (ok) {
      setEmoji('');
      setTitle('');
      setContext('');
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5 text-sm space-y-4">
      <h2 className="text-lg font-medium">Problems</h2>

      <div className="grid gap-3 sm:grid-cols-[80px_1fr] rounded-lg border bg-background/40 p-4">
        <label className="text-xs text-muted-foreground sm:col-span-2">Add a problem category survivors can attach tools to.</label>
        <input value={emoji} onChange={(event) => setEmoji(event.target.value)} placeholder="Emoji" aria-label="Emoji" className="rounded-md border bg-background px-3 py-2" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Problem title (e.g. Sleep Disruption)" aria-label="Problem title" className="rounded-md border bg-background px-3 py-2" />
        <textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Short context shown under the title" aria-label="Problem context" rows={2} className="rounded-md border bg-background px-3 py-2 sm:col-span-2" />
        <div className="sm:col-span-2">
          <button type="button" disabled={!title.trim() || creating} onClick={() => void create()} className="rounded-md border border-primary bg-primary/10 px-4 py-2 text-xs font-medium text-primary disabled:opacity-50">
            {creating ? 'Adding…' : 'Add problem'}
          </button>
        </div>
      </div>

      {problems.length === 0 ? (
        <p className="text-muted-foreground">No problems yet. Add the first one above.</p>
      ) : (
        <ul className="space-y-2">
          {problems.map((problem) => (
            <li key={problem.id} className="rounded-lg border bg-background/40 p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span aria-hidden>{problem.emoji || '🧰'}</span>
                  <span className="font-semibold">{problem.title}</span>
                  {!problem.is_active ? <span className="rounded-md border border-muted px-2 py-0.5 text-[11px] text-muted-foreground">inactive</span> : null}
                </div>
                {problem.context ? <p className="text-xs text-muted-foreground mt-1">{problem.context}</p> : null}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {problem.approvedCount} approved · {problem.pendingCount} pending · {problem.productCount} total
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button type="button" disabled={busyId === problem.id} onClick={() => onToggleActive(problem)} className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50">
                  {problem.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" disabled={busyId === problem.id} onClick={() => onDelete(problem)} className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300 disabled:opacity-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
