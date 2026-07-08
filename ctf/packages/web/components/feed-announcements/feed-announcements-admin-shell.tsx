'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Send, Archive } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getFeedAnnouncementsTokens, type FeedAnnouncementsTokens } from './feed-announcements-shared';
import type { Announcement, FeedConfig } from 'lib/feed/types';

// Admin chrome (shared admin look) comes from the theme tokens; the Feed/announcements accent is
// the official purple (see feed-announcements-shared.ts).

const STATUS_COLOR: Record<string, string> = {
  draft: '#F59E0B',
  published: '#22C55E',
  archived: '#6B7280',
};

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${color}1f`, color, border: `1px solid ${color}4d`, textTransform: 'capitalize' }}>{label}</span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const fieldStyle = (t: FeedAnnouncementsTokens) =>
  ({
    width: '100%',
    padding: '9px 12px',
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 14,
    color: t.TITLE,
    outline: 'none',
    boxSizing: 'border-box',
  }) as const;

async function adminMutate(url: string, method: 'POST', body?: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { message?: string; reason?: string; code?: string } | null;
    return { ok: false, message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).` };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}

export function FeedAnnouncementsAdminShell({
  config,
  announcements,
}: {
  config: FeedConfig;
  announcements: Announcement[];
}) {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '', priority: 0, mandatory: false });

  const publishedCount = announcements.filter((a) => a.status === 'published').length;
  const draftCount = announcements.filter((a) => a.status === 'draft').length;

  async function act(fn: () => Promise<{ ok: boolean; message?: string }>, okMessage: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fn();
    if (res.ok) {
      setMessage(okMessage);
      router.refresh();
    } else {
      setError(res.message ?? 'Action failed.');
    }
    setBusy(false);
  }

  async function createDraft() {
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    await act(
      () => adminMutate('/api/feed/admin/announcements', 'POST', { title: draft.title.trim(), body: draft.body.trim(), priority: draft.priority, mandatory: draft.mandatory, scheduleAtIso: null, expiresAtIso: null }),
      'Draft created.',
    );
    setDraft({ title: '', body: '', priority: 0, mandatory: false });
  }

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        ...(isMobile ? { minHeight: '100dvh' } : { height: '100dvh', overflowY: 'auto' }),
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="Feed & Announcements Admin" accent={t.ACCENT} icon={<Megaphone size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={18} color={t.ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Feed &amp; Announcements Admin</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Announcement lifecycle and feed config</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Announcements" value={announcements.length} accent={t.ACCENT} />
          <StatBlock label="Published" value={publishedCount} accent="#22C55E" />
          <StatBlock label="Drafts" value={draftCount} accent="#F59E0B" />
        </div>

        {/* Feed config (read-only) */}
        <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16, fontSize: 13, color: '#D1D5DB' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: t.TITLE }}>Feed config</div>
          <div style={{ marginBottom: 4 }}>Render mode: <span style={{ color: t.TITLE }}>{config.renderMode}</span></div>
          <div style={{ marginBottom: 4 }}>Max page size: <span style={{ color: t.TITLE }}>{config.maxTimelinePageSize}</span></div>
          <div>Channels: <span style={{ color: t.TITLE }}>{config.enabledChannels.join(', ')}</span></div>
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: t.ACCENT }}>{message}</div> : null}

        {/* Create draft */}
        <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>New announcement</div>
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Title" style={{ ...fieldStyle(t), marginBottom: 10 }} />
          <textarea value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} placeholder="Message" rows={3} style={{ ...fieldStyle(t), resize: 'none', marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.MUTED }}>
              <input type="checkbox" checked={draft.mandatory} onChange={(e) => setDraft((d) => ({ ...d, mandatory: e.target.checked }))} /> Mandatory
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.MUTED }}>
              Priority
              <input type="number" min={0} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} style={{ ...fieldStyle(t), width: 80 }} />
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void createDraft()} style={{ padding: '10px 16px', borderRadius: 10, background: busy ? `${t.ACCENT}66` : t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Working…' : 'Create draft'}
          </button>
        </div>

        {announcements.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>No announcements yet.</div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{a.title}</span>
                <Pill label={a.status} color={STATUS_COLOR[a.status] ?? t.MUTED} />
                {a.mandatory ? <Pill label="mandatory" color={t.ACCENT} /> : null}
              </div>
              <div style={{ fontSize: 12, color: t.MUTED, marginBottom: a.status === 'archived' ? 0 : 8 }}>{a.body}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.status === 'draft' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => adminMutate(`/api/feed/admin/announcements/${a.id}/publish`, 'POST', {}), 'Published.')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <Send size={13} /> Publish
                  </button>
                ) : null}
                {a.status === 'published' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => adminMutate(`/api/feed/admin/announcements/${a.id}/archive`, 'POST', {}), 'Archived.')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.3)', color: '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <Archive size={13} /> Archive
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
