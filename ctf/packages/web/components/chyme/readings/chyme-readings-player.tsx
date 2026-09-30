'use client';

import { Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from '@/components/chyme/chyme-shared';
import { BLOG_READINGS_URL, loopPositionAt, nextIndex, parseBlogReadings, sourceAt, type ReadingsTrack } from 'lib/chyme/readings/schedule';

// The readings loop (a temporary module, owner decision 2026-09-28; see lib/chyme/readings/repository.ts).
// Shown on the Chyme page only while nobody is live and only while the owner has the loop switched
// on. The playlist is the blog's own list of recorded posts (lib/chyme/readings/schedule.ts). Every
// listener joins at the same point, worked out from the clock, so it behaves like a radio station
// rather than restarting for each visitor. Sound starts on a tap because phone browsers block
// audio that starts by itself. The file plays in this visitor's browser; nothing touches Stream.

const BLOG_URL = 'https://chargingthefuture.github.io/chargingthefuture';
// While a reading plays, check this often whether somebody has gone live, so the visitor is sent to
// the real room instead of listening to a recording over it.
const LIVE_CHECK_MS = 60_000;

const MEDIA_ERROR_REASON: Record<number, string> = {
  2: 'the network failed while downloading it',
  3: 'the file could not be decoded',
  4: 'the file or its address is not playable',
};

async function roomIsLive(): Promise<boolean> {
  try {
    const res = await fetch('/api/chyme/public/room');
    const data = (await res.json().catch(() => null)) as { ok?: boolean; isLive?: boolean } | null;
    return res.ok && data?.ok === true && data.isLive === true;
  } catch {
    // no-trace: a failed check keeps the reading playing; the next check runs in a minute.
    return false;
  }
}

async function loopEnabled(signal: AbortSignal): Promise<boolean> {
  const res = await fetch('/api/chyme/readings', { signal });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; enabled?: boolean } | null;
  return res.ok && data?.ok === true && data.enabled === true;
}

async function blogReadings(signal: AbortSignal): Promise<ReadingsTrack[]> {
  const res = await fetch(BLOG_READINGS_URL, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`The blog's list of readings answered HTTP ${res.status}.`);
  return parseBlogReadings(await res.json());
}

export function ChymeReadingsPlayer({ onRoomLive }: { onRoomLive?: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // The reading now loaded, and the list, kept outside React's state so the end-of-file handler
  // always reads the current values: a handler holding an out-of-date index moved to the same
  // "next" reading every time, which played one reading on repeat.
  const indexRef = useRef<number | null>(null);
  const tracksRef = useRef<ReadingsTrack[]>([]);
  const [tracks, setTracks] = useState<ReadingsTrack[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wentLive, setWentLive] = useState(false);
  // Between the tap and the first sound: the file has to arrive first, which takes a few seconds on
  // a phone, and an empty room with a silent button reads as broken (owner report, 2026-09-29).
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // The live check runs here as well as in the page around it: the signed-in screen has no live
    // signal before a member joins a room, and a recording must never be offered over a live one.
    Promise.all([loopEnabled(controller.signal), roomIsLive()])
      .then(async ([enabled, live]) => {
        if (!enabled || live) return;
        const list = await blogReadings(controller.signal);
        tracksRef.current = list;
        setTracks(list);
      })
      .catch((error: unknown) => {
        // The loop is an extra; when it cannot be read the page shows what it showed before.
        if (!controller.signal.aborted) console.warn('[chyme/readings] could not load the readings', error);
      });
    return () => controller.abort();
  }, []);

  // Called inside the tap (or the previous file's end), with no wait before play(): Safari refuses
  // audio that starts after a network wait.
  const playFrom = useCallback((trackIndex: number, offsetSeconds: number) => {
    const audio = audioRef.current;
    const track = tracksRef.current[trackIndex];
    if (!audio || !track) return;
    indexRef.current = trackIndex;
    setIndex(trackIndex);
    setProblem(null);
    audio.src = sourceAt(track.audioUrl, offsetSeconds);
    audio.play().then(
      () => setPlaying(true),
      (error: unknown) => {
        // A newer play() or a stop superseded this one; that one reports its own outcome.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPlaying(false);
        setStarting(false);
        setProblem(`The recording did not start: ${error instanceof Error ? error.message : 'the browser refused to play it.'}`);
      },
    );
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setStarting(false);
  }, []);

  const start = useCallback(() => {
    const position = loopPositionAt(tracksRef.current.map((track) => track.durationSeconds), Date.now());
    if (!position) return;
    setStarting(true);
    playFrom(position.index, position.offsetSeconds);
  }, [playFrom]);

  const handleEnded = useCallback(() => {
    const current = indexRef.current;
    if (current === null || tracksRef.current.length === 0) return;
    playFrom(nextIndex(current, tracksRef.current.length), 0);
  }, [playFrom]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      void roomIsLive().then((live) => {
        if (!live) return;
        stop();
        setWentLive(true);
        onRoomLive?.();
      });
    }, LIVE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [playing, stop, onRoomLive]);

  // The browser's own reason, so a report from a phone says which failure it was.
  const handleError = useCallback(() => {
    const failure = audioRef.current?.error;
    // A load that a newer file replaced is not a failure of the file.
    if (!failure || failure.code === MediaError.MEDIA_ERR_ABORTED) return;
    setPlaying(false);
    setStarting(false);
    const reason = MEDIA_ERROR_REASON[failure.code] ?? 'unknown media error';
    setProblem(`The recording could not be loaded (${reason}, code ${failure.code}${failure.message ? `: ${failure.message}` : ''}).`);
  }, []);

  // Stop the sound when the player leaves the page (a room went live, or the visitor navigated away).
  useEffect(() => () => audioRef.current?.pause(), []);

  if (tracks.length === 0) return null;
  return (
    <ReadingsCard
      current={index === null ? null : tracks[index] ?? null}
      playing={playing}
      starting={starting}
      wentLive={wentLive}
      problem={problem}
      onToggle={playing ? stop : start}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- every reading has a text version: the published blog post it reads, linked beside the player ("Read this post"; every entry in the blog's list carries its post link). That is the text alternative for prerecorded audio (WCAG 1.2.1). */}
      <audio ref={audioRef} onEnded={handleEnded} onPlaying={() => setStarting(false)} onError={handleError} preload="none" />
    </ReadingsCard>
  );
}

type ReadingsCardProps = {
  current: ReadingsTrack | null;
  playing: boolean;
  starting: boolean;
  wentLive: boolean;
  problem: string | null;
  onToggle: () => void;
  children: ReactNode;
};

function ReadingsCard({ current, playing, starting, wentLive, problem, onToggle, children }: ReadingsCardProps) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${t.BORDER}`, padding: '14px', textAlign: 'left' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>While you wait for someone to go live</div>
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, marginBottom: 10 }}>
        Computer-voice readings of posts from{' '}
        <a href={BLOG_URL} target="_blank" rel="noreferrer" style={{ color: t.ACCENT }}>the blog</a>, on a loop. This is a recording, not a live host. It stops when someone goes live.
      </div>
      {wentLive ? (
        <div style={{ fontSize: 12, color: t.TITLE, marginBottom: 8 }}>Someone just went live. The recording has stopped.</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? 'Stop the recording' : 'Play the recording'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: 'none', background: t.ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Stop' : 'Play readings'}
        </button>
        {current ? (
          <div style={{ minWidth: 0, fontSize: 12, color: t.MUTED, lineHeight: 1.4 }}>
            <div style={{ color: t.TITLE, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.title}</div>
          </div>
        ) : null}
      </div>
      {starting ? (
        <div role="status" style={{ fontSize: 12, color: t.TITLE, marginTop: 8 }}>
          Audio will begin playing in a few seconds.
        </div>
      ) : null}
      {/* A button rather than small text, so a listener can find the post the voice is reading
          without hunting for it (owner decision, 2026-09-29). */}
      {current ? (
        <a
          href={current.postUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'block', marginTop: 10, padding: '8px 14px', borderRadius: 999, border: `1px solid ${t.ACCENT}`, color: t.ACCENT, fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}
        >
          Read this post
        </a>
      ) : null}
      {problem ? <div style={{ fontSize: 12, color: t.MUTED, marginTop: 8, wordBreak: 'break-word' }}>{problem}</div> : null}
      {children}
    </div>
  );
}
