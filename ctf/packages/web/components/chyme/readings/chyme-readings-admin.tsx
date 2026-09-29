'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { requestJson } from '@/components/chyme/chyme-shared';
import type { ReadingsSetting } from 'lib/chyme/readings/repository';
import type { ReadingsTrack } from 'lib/chyme/readings/schedule';

// The readings loop's admin screen (temporary module, owner decision 2026-09-28): the on/off switch
// and the playlist. The recordings themselves are hosted elsewhere (for example uploaded to the blog's
// site); this screen stores the link and reads the file's length in this browser, so nobody has to
// type a duration.

type Tokens = ReturnType<typeof getPluginShellTokens>;
type AdminPayload = { ok: true; setting: ReadingsSetting; tracks: ReadingsTrack[] };

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

// Loads only the file's header in a detached audio element, the same way the player will.
function readAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(Math.round(audio.duration));
      else reject(new Error('The file loaded but reported no length. Is it an audio file?'));
    };
    audio.onerror = () => reject(new Error('The file could not be loaded from that link. Check that it opens in the browser.'));
    audio.src = url;
  });
}

function Section({ children, t }: { children: ReactNode; t: Tokens }) {
  return <section style={{ borderRadius: 14, border: `1px solid ${t.BORDER}`, padding: 16, marginBottom: 14 }}>{children}</section>;
}

const inputStyle = (t: Tokens) => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${t.BORDER}`,
  background: t.INPUT_BG,
  color: t.TEXT,
  fontSize: 14,
  marginBottom: 8,
  boxSizing: 'border-box' as const,
});

type ButtonProps = { busy: boolean; t: Tokens };

function SwitchSection({ enabled, disabled, onToggle, busy, t }: ButtonProps & { enabled: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <Section t={t}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{enabled ? 'On' : 'Off'}</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5, marginBottom: 12 }}>
        When on, the Chyme page offers these recordings to anyone who arrives while nobody is live. They stop by themselves
        when someone goes live. Turn it off when the room no longer needs it.
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

function TrackRow({ track, onRemove, busy, t }: ButtonProps & { track: ReadingsTrack; onRemove: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${t.BORDER}` }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
        <div style={{ color: t.SUBTLE }}>{formatDuration(track.durationSeconds)}</div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(track.id)}
        disabled={busy}
        style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.BORDER}`, background: 'transparent', color: t.TEXT, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}
      >
        Remove
      </button>
    </div>
  );
}

function TracksSection({ tracks, onRemove, busy, t }: ButtonProps & { tracks: ReadingsTrack[]; onRemove: (id: string) => void }) {
  const totalSeconds = tracks.reduce((sum, track) => sum + track.durationSeconds, 0);
  return (
    <Section t={t}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        Recordings · {tracks.length} · {formatDuration(totalSeconds)} in total
      </div>
      {tracks.length === 0 ? (
        <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5 }}>None yet. The loop shows nothing until at least one recording is added.</div>
      ) : (
        tracks.map((track) => <TrackRow key={track.id} track={track} onRemove={onRemove} busy={busy} t={t} />)
      )}
    </Section>
  );
}

type NewTrackFields = { title: string; audioUrl: string; postUrl: string };
const EMPTY_FIELDS: NewTrackFields = { title: '', audioUrl: '', postUrl: '' };

function AddSection({ onAdd, busy, t }: ButtonProps & { onAdd: (fields: NewTrackFields) => Promise<boolean> }) {
  const [fields, setFields] = useState<NewTrackFields>(EMPTY_FIELDS);
  const set = (key: keyof NewTrackFields) => (value: string) => setFields((prev) => ({ ...prev, [key]: value }));
  const ready = !busy && fields.title.trim() !== '' && fields.audioUrl.trim() !== '' && fields.postUrl.trim() !== '';
  const submit = async () => {
    if (await onAdd(fields)) setFields(EMPTY_FIELDS);
  };
  return (
    <Section t={t}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Add a recording</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5, marginBottom: 10 }}>
        Paste an https link to the audio file (MP3 or M4A). It goes to the end of the loop. The length is read from the file. The post link is required: it is the text version for anyone who cannot hear the recording.
      </div>
      <input style={inputStyle(t)} placeholder="Title, as listeners should see it" value={fields.title} onChange={(e) => set('title')(e.target.value)} />
      <input style={inputStyle(t)} placeholder="Link to the audio file (https://…)" value={fields.audioUrl} onChange={(e) => set('audioUrl')(e.target.value)} inputMode="url" />
      <input style={inputStyle(t)} placeholder="Link to the blog post it reads (https://…)" value={fields.postUrl} onChange={(e) => set('postUrl')(e.target.value)} inputMode="url" />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!ready}
        style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: t.ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: ready ? 1 : 0.6 }}
      >
        {busy ? 'Working…' : 'Add'}
      </button>
    </Section>
  );
}

function failureText(err: unknown): string {
  return err instanceof Error ? err.message : 'the request did not complete.';
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function ChymeReadingsAdmin() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('chyme', theme), theme);
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPayload(await requestJson<AdminPayload>('/api/chyme/readings/admin'));
      setError(null);
    } catch (err) {
      setError(`Could not load the readings: ${failureText(err)}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(`${failure}: ${failureText(err)}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const enabled = payload?.setting.enabled ?? false;

  const toggle = () =>
    void run(
      () => requestJson('/api/chyme/readings/admin', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ enabled: !enabled }) }),
      'Could not change the switch',
    );

  const add = (fields: NewTrackFields) =>
    run(async () => {
      const audioUrl = fields.audioUrl.trim();
      const durationSeconds = await readAudioDuration(audioUrl);
      await requestJson('/api/chyme/readings/admin/tracks', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ title: fields.title, audioUrl, postUrl: fields.postUrl.trim(), durationSeconds }),
      });
    }, 'Could not add the recording');

  const remove = (id: string) =>
    void run(() => requestJson(`/api/chyme/readings/admin/tracks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Could not remove the recording');

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Chyme readings loop" accent={t.ACCENT} icon={<Radio size={18} color={t.ACCENT} />} backHref="/admin" />
      <div style={{ padding: 16 }}>
        {error ? <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 12, wordBreak: 'break-word' }}>{error}</div> : null}
        <SwitchSection enabled={enabled} disabled={!payload} onToggle={toggle} busy={busy} t={t} />
        <TracksSection tracks={payload?.tracks ?? []} onRemove={remove} busy={busy} t={t} />
        <AddSection onAdd={add} busy={busy} t={t} />
      </div>
    </div>
  );
}
