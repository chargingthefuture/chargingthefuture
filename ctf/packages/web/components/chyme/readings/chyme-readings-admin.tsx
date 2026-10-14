'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { requestJson } from '@/components/chyme/chyme-shared';
import type { ReadingsSetting } from 'lib/chyme/readings/repository';
import { BLOG_READINGS_URL, parseBlogReadings, type ReadingsTrack } from 'lib/chyme/readings/schedule';

// The readings loop's admin screen (temporary module, owner decision 2026-09-28): the on/off switch.
// The playlist is the blog's own list of recorded posts, so there is nothing to add here: uploading
// content/audio/<post-slug>.mp3 to the blog adds the reading (owner decision, 2026-09-29). The list
// is shown read-only so the admin can see what the loop will play.

type Tokens = ReturnType<typeof getPluginShellTokens>;
type AdminPayload = { ok: true; setting: ReadingsSetting };
type BlogList = { tracks: ReadingsTrack[] } | { error: string };

function Section({ children, t }: { children: ReactNode; t: Tokens }) {
  return <section style={{ borderRadius: 14, border: `1px solid ${t.BORDER}`, padding: 16, marginBottom: 14 }}>{children}</section>;
}

function failureText(err: unknown): string {
  return err instanceof Error ? err.message : 'the request did not complete.';
}

function SwitchSection({ enabled, disabled, onToggle, busy, t }: { enabled: boolean; disabled: boolean; onToggle: () => void; busy: boolean; t: Tokens }) {
  return (
    <Section t={t}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{enabled ? 'On' : 'Off'}</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5, marginBottom: 12 }}>
        When on, the Chyme page offers the recorded blog readings to anyone who arrives while nobody is live. They stop by
        themselves when someone goes live. Turn it off when the room no longer needs it.
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy || disabled}
        style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: enabled ? t.INPUT_BG : t.ACCENT, color: enabled ? t.TEXT : '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
      >
        {enabled ? 'Turn off' : 'Turn on'}
      </button>
    </Section>
  );
}

function ListBody({ list, t }: { list: BlogList | null; t: Tokens }) {
  if (list === null) return <div style={{ fontSize: 13, color: t.SUBTLE }}>Reading the blog&apos;s list…</div>;
  if ('error' in list) return <div style={{ fontSize: 13, color: '#fca5a5', wordBreak: 'break-word' }}>{list.error}</div>;
  if (list.tracks.length === 0) {
    return <div style={{ fontSize: 13, color: t.SUBTLE }}>None yet. The loop shows nothing until the blog has at least one recording.</div>;
  }
  return (
    <>
      {list.tracks.map((track) => (
        <div key={track.slug} style={{ padding: '8px 0', borderTop: `1px solid ${t.BORDER}`, fontSize: 13 }}>
          <a href={track.postUrl} target="_blank" rel="noreferrer" style={{ color: t.TEXT, fontWeight: 600 }}>{track.title}</a>
        </div>
      ))}
    </>
  );
}

function ListSection({ list, t }: { list: BlogList | null; t: Tokens }) {
  return (
    <Section t={t}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        Recordings{list && 'tracks' in list ? ` · ${list.tracks.length}` : ''}
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5, marginBottom: 10 }}>
        To add one, upload <code>content/audio/&lt;post-slug&gt;.mp3</code> to the blog repository. After the blog deploys,
        the post shows a &ldquo;Listen to this post&rdquo; player and the reading joins this list. To take one out, delete the file.
      </div>
      <ListBody list={list} t={t} />
    </Section>
  );
}

export function ChymeReadingsAdmin() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('chyme', theme), theme);
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [list, setList] = useState<BlogList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPayload(await requestJson<AdminPayload>('/api/chyme/readings/admin'));
      setError(null);
    } catch (err) {
      setError(`Could not read the switch: ${failureText(err)}`);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch(BLOG_READINGS_URL, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`the blog answered HTTP ${res.status}`);
        setList({ tracks: parseBlogReadings(await res.json()) });
      })
      .catch((err: unknown) => setList({ error: `Could not read the blog's list of recordings: ${failureText(err)}` }));
  }, [load]);

  const enabled = payload?.setting.enabled ?? false;

  const toggle = async () => {
    setBusy(true);
    try {
      await requestJson('/api/chyme/readings/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) });
      await load();
    } catch (err) {
      setError(`Could not change the switch: ${failureText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Chyme readings loop" accent={t.ACCENT} icon={<Radio size={18} color={t.ACCENT} />} backHref="/admin" actions={<PluginUserShellButton href="/apps/chyme" accent={t.ACCENT} />} />
      <div style={{ padding: 16 }}>
        {error ? <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 12, wordBreak: 'break-word' }}>{error}</div> : null}
        <SwitchSection enabled={enabled} disabled={!payload} onToggle={() => void toggle()} busy={busy} t={t} />
        <ListSection list={list} t={t} />
      </div>
    </div>
  );
}
