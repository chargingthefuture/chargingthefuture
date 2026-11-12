'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SE_MEMBER_STORY_WORDS } from '@ctf/shared';
import { failureText } from 'lib/errors/client-failure';
import { getComicTokens } from './comic-shared';

// "What you have sent" on the Knowledge Library page: each contribution's status, Withdraw, and the
// choice to also show it as a story on Today (3.1.0 plan). The choice is saved on the server, per
// contribution, and is open before Unlock like contributing itself; the story shows once a person
// has accepted the writing and the writer's Unlock is approved.

export type SharedWritingSummary = {
  id: string;
  kind: 'links' | 'export';
  status: 'pending_review' | 'accepted' | 'declined' | 'withdrawn';
  entryCount: number;
  discardedSections: string[];
  declineReason: string;
  createdAtIso: string;
  showAsStory: boolean;
};

type ComicTokens = ReturnType<typeof getComicTokens>;

const STATUS_LABEL: Record<SharedWritingSummary['status'], string> = {
  pending_review: 'Waiting to be read',
  accepted: 'In the library',
  declined: 'Not used',
  withdrawn: 'Withdrawn',
};

const ERROR_COLOR = '#F87171';

function canShowAsStory(item: SharedWritingSummary): boolean {
  return item.status === 'pending_review' || item.status === 'accepted';
}

async function saveStoryChoice(id: string, show: boolean): Promise<string | null> {
  try {
    const res = await fetch(`/api/comic/shared-writing/${id}/story`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ show }),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return data?.message ?? SE_MEMBER_STORY_WORDS.failed;
  } catch (caught) {
    return failureText(caught, { area: 'comic', op: 'contribution_story', fallback: SE_MEMBER_STORY_WORDS.failed, audience: 'member' });
  }
}

export function HistorySection({
  t,
  history,
  onWithdraw,
  onChanged,
}: {
  t: ComicTokens;
  history: SharedWritingSummary[];
  onWithdraw: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStory(id: string, show: boolean) {
    setSaving(id);
    const failed = await saveStoryChoice(id, show);
    setError(failed);
    if (!failed) await onChanged();
    setSaving(null);
  }

  return (
    <section style={{ marginTop: 18, borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 18 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>What you have sent</h2>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: t.MUTED, margin: '0 0 6px' }}>
        {SE_MEMBER_STORY_WORDS.toggle}: {SE_MEMBER_STORY_WORDS.consent} {SE_MEMBER_STORY_WORDS.waitsForUnlock}
      </p>
      {error ? (
        <p role="alert" style={{ fontSize: 13, color: ERROR_COLOR, margin: '0 0 6px' }}>
          {error}
        </p>
      ) : null}
      {history.map((item) => (
        <HistoryRow
          key={item.id}
          t={t}
          item={item}
          saving={saving === item.id}
          onWithdraw={onWithdraw}
          onStory={(show) => void changeStory(item.id, show)}
        />
      ))}
    </section>
  );
}

function StoryChoice({ t, item, saving, onStory }: { t: ComicTokens; item: SharedWritingSummary; saving: boolean; onStory: (show: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: t.TEXT, cursor: 'pointer' }}>
      <input type="checkbox" checked={item.showAsStory} disabled={saving} onChange={(event) => onStory(event.target.checked)} />
      {SE_MEMBER_STORY_WORDS.toggle}
    </label>
  );
}

function HistoryRow({
  t,
  item,
  saving,
  onWithdraw,
  onStory,
}: {
  t: ComicTokens;
  item: SharedWritingSummary;
  saving: boolean;
  onWithdraw: (id: string) => void;
  onStory: (show: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${t.BORDER}` }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{STATUS_LABEL[item.status]}</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>
          {new Date(item.createdAtIso).toLocaleDateString()} ·{' '}
          {item.entryCount.toLocaleString()} {item.entryCount === 1 ? 'piece' : 'pieces'}
          {item.status === 'declined' && item.declineReason ? ` · ${item.declineReason}` : ''}
        </div>
        {canShowAsStory(item) ? <StoryChoice t={t} item={item} saving={saving} onStory={onStory} /> : null}
      </div>
      {item.status !== 'withdrawn' ? (
        <button
          type="button"
          onClick={() => void onWithdraw(item.id)}
          aria-label="Withdraw this contribution"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 12px',
            borderRadius: 8,
            background: 'transparent',
            border: `1px solid ${t.BORDER_SOLID}`,
            color: t.SUBTLE,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Trash2 size={14} /> Withdraw
        </button>
      ) : null}
    </div>
  );
}
