'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Send, Archive, Link2, Pencil, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type { Announcement, FeedConfig } from 'lib/feed/types';
import { getFeedAnnouncementsTokens, type FeedAnnouncementsTokens } from './feed-announcements-shared';

type PluginOption = { slug: string; name: string };

// Admin design tokens (shared admin look) come from the theme tokens. Feed/announcements accent is
// the official purple; comic falls back to the neutral comic ink via getFeedAnnouncementsTokens.
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

function fieldStyle(t: FeedAnnouncementsTokens) {
  return {
    width: '100%',
    padding: '9px 12px',
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 14,
    color: t.TITLE,
    outline: 'none',
    boxSizing: 'border-box',
  } as const;
}

async function adminMutate(url: string, method: 'POST' | 'PUT', body?: unknown): Promise<{ ok: boolean; message?: string }> {
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
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; linkedPluginSlugs: string[] }>({ title: '', body: '', linkedPluginSlugs: [] });
  // When set, the form is editing this existing draft (PUT) instead of creating a new one (POST).
  const [editingId, setEditingId] = useState<string | null>(null);
  // Plugin registry options for the "Link a plugin" picker. Best-effort: a failed load just leaves the
  // picker empty and never blocks authoring. The server re-validates the chosen slug on submit.
  const [pluginOptions, setPluginOptions] = useState<PluginOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/plugins', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { plugins?: Array<{ slug: string; name: string }> } | null) => {
        if (!cancelled && payload && Array.isArray(payload.plugins)) {
          setPluginOptions(payload.plugins.map((p) => ({ slug: p.slug, name: p.name })));
        }
      })
      .catch(() => {
        /* picker is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cap on how many plugins one announcement can link — more than a few chips is information overload
  // for a reader (owner directive, 2026-07-18). The server enforces the same cap.
  const MAX_LINKED_PLUGINS = 3;
  const nameForSlug = (slug: string) => pluginOptions.find((p) => p.slug === slug)?.name ?? slug;
  const addLinkedPlugin = (slug: string) => {
    if (!slug) return;
    setDraft((d) =>
      d.linkedPluginSlugs.includes(slug) || d.linkedPluginSlugs.length >= MAX_LINKED_PLUGINS
        ? d
        : { ...d, linkedPluginSlugs: [...d.linkedPluginSlugs, slug] },
    );
  };
  const removeLinkedPlugin = (slug: string) => {
    setDraft((d) => ({ ...d, linkedPluginSlugs: d.linkedPluginSlugs.filter((s) => s !== slug) }));
  };

  const publishedCount = announcements.filter((a) => a.status === 'published').length;
  const draftCount = announcements.filter((a) => a.status === 'draft').length;

  async function act(fn: () => Promise<{ ok: boolean; message?: string }>, okMessage: string): Promise<{ ok: boolean; message?: string }> {
    if (busy) return { ok: false, message: 'Busy.' };
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
    return res;
  }

  // Load an existing draft into the form for editing (switches the form to PUT mode).
  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setDraft({ title: a.title, body: a.body, linkedPluginSlugs: a.linkedPluginSlugs ?? [] });
    setError(null);
    setMessage(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({ title: '', body: '', linkedPluginSlugs: [] });
    setError(null);
  }

  async function submitDraft() {
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    const payload = { title: draft.title.trim(), body: draft.body.trim(), scheduleAtIso: null, expiresAtIso: null, linkedPluginSlugs: draft.linkedPluginSlugs };
    const res = editingId
      ? await act(() => adminMutate(`/api/feed/admin/announcements/${editingId}`, 'PUT', payload), 'Draft saved.')
      : await act(() => adminMutate('/api/feed/admin/announcements', 'POST', payload), 'Draft created.');
    // Only clear the form on success — a failed submit must keep the typed title and message so the
    // author does not lose their work and can just retry.
    if (res.ok) {
      setDraft({ title: '', body: '', linkedPluginSlugs: [] });
      setEditingId(null);
    }
  }

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="Feed & Announcements Admin" accent={t.ACCENT} icon={<Megaphone size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/" accent={t.ACCENT} label="Commons" />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
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
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Edit announcement' : 'New announcement'}</div>
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Title" style={{ ...fieldStyle(t), marginBottom: 10 }} />
          <textarea value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} placeholder="Message" rows={3} style={{ ...fieldStyle(t), resize: 'none', marginBottom: 10 }} />
          {/* Optional: link up to 3 plugins. Each linked plugin adds an "Open <Plugin>" link to the
              published announcement so a reader can jump straight to that app. More than 3 is
              information overload, so the picker stops at 3 (the server enforces the same cap). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.MUTED }}>
              <Link2 size={14} /> Link plugins (optional, up to {MAX_LINKED_PLUGINS})
            </span>
            {draft.linkedPluginSlugs.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {draft.linkedPluginSlugs.map((slug) => (
                  <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 999, background: `${t.ACCENT}1f`, border: `1px solid ${t.ACCENT}4d`, color: t.ACCENT, fontSize: 13, fontWeight: 600 }}>
                    {nameForSlug(slug)}
                    <button type="button" aria-label={`Remove ${nameForSlug(slug)}`} onClick={() => removeLinkedPlugin(slug)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 999, background: 'transparent', border: 'none', color: t.ACCENT, cursor: 'pointer', padding: 0 }}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {draft.linkedPluginSlugs.length < MAX_LINKED_PLUGINS ? (
              <select
                value=""
                onChange={(e) => { addLinkedPlugin(e.target.value); e.currentTarget.value = ''; }}
                style={{ ...fieldStyle(t) }}
              >
                <option value="">{draft.linkedPluginSlugs.length === 0 ? 'No linked plugin' : 'Add another plugin…'}</option>
                {pluginOptions.filter((p) => !draft.linkedPluginSlugs.includes(p.slug)).map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: 12, color: t.MUTED }}>Maximum of {MAX_LINKED_PLUGINS} linked plugins reached.</span>
            )}
            {draft.linkedPluginSlugs.length > 0 ? (
              <span style={{ fontSize: 12, color: t.MUTED }}>Readers will see an “Open {nameForSlug(draft.linkedPluginSlugs[0])}” link{draft.linkedPluginSlugs.length > 1 ? ` and ${draft.linkedPluginSlugs.length - 1} more` : ''}.</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={() => void submitDraft()} style={{ padding: '10px 16px', borderRadius: 10, background: busy ? `${t.ACCENT}66` : t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Working…' : editingId ? 'Save changes' : 'Create draft'}
            </button>
            {editingId ? (
              <button type="button" disabled={busy} onClick={cancelEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                <X size={14} /> Cancel
              </button>
            ) : null}
          </div>
        </div>

        {announcements.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>No announcements yet.</div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{a.title}</span>
                <Pill label={a.status} color={STATUS_COLOR[a.status] ?? t.MUTED} />
              </div>
              <div style={{ fontSize: 12, color: t.MUTED, marginBottom: a.linkedPluginSlugs.length > 0 ? 6 : (a.status === 'archived' ? 0 : 8) }}>{a.body}</div>
              {a.linkedPluginSlugs.length > 0 ? (
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, fontSize: 12, color: t.ACCENT, marginBottom: a.status === 'archived' ? 0 : 8 }}>
                  <Link2 size={12} /> Links to{' '}
                  {a.linkedPluginSlugs.map((slug, index) => (
                    <span key={slug}>
                      <a href={`/apps/${slug}`} style={{ color: t.ACCENT, textDecoration: 'underline' }}>
                        {nameForSlug(slug)}
                      </a>
                      {index < a.linkedPluginSlugs.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.status === 'draft' ? (
                  <button type="button" disabled={busy} onClick={() => startEdit(a)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: `${t.ACCENT}1f`, border: `1px solid ${t.ACCENT}4d`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <Pencil size={13} /> Edit
                  </button>
                ) : null}
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
