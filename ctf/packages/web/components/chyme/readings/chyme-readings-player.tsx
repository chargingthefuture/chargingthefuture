'use client';

import { Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from '@/components/chyme/chyme-shared';
import { BLOG_READINGS_URL, loopPositionAt, parseBlogReadings, type ReadingsTrack } from 'lib/chyme/readings/schedule';

// The readings loop (a temporary module, owner decision 2026-09-28; see lib/chyme/readings/repository.ts).
// Shown on the Chyme page only while nobody is live and only while the owner has the loop switched
// on. The playlist is the blog's own list of recorded posts (lib/chyme/readings/schedule.ts). Every
// listener joins at the same point, worked out from the clock, so it behaves like a radio station
// rather than restarting for each visitor. Sound starts on a tap because phone browsers block
// audio that starts by itself. The file plays in this visitor's browser; nothing touches Stream.

const PEACE_BATTLE_URL = 'https://chargingthefuture.github.io/chargingthefuture/peace-battle-2';
// While a reading plays, check this often whether somebody has gone live, so the visitor is sent to
// the real room instead of listening to a recording over it.
const LIVE_CHECK_MS = 60_000;

type PlayableTrack = ReadingsTrack & { durationSeconds: number };

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

// The length of one recording, from its header only. The blog list carries no lengths (the build
// would need an audio parser for that), so they are read here, once, on the visitor's first tap.
function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? resolve(audio.duration) : reject(new Error('no length')));
    audio.onerror = () => reject(new Error('not loadable'));
    audio.src = url;
  });
}

// Recordings that could not be read are left out rather than stopping the loop.
async function withDurations(tracks: ReadingsTrack[]): Promise<PlayableTrack[]> {
  const results = await Promise.allSettled(tracks.map((track) => readDuration(track.audioUrl)));
  return tracks.flatMap((track, i) => {
    const result = results[i];
    return result.status === 'fulfilled' ? [{ ...track, durationSeconds: result.value }] : [];
  });
}

export function ChymeReadingsPlayer({ onRoomLive }: { onRoomLive?: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Where to seek once the new file's length is known; setting it earlier is ignored by some browsers.
  const pendingOffsetRef = useRef(0);
  const [tracks, setTracks] = useState<ReadingsTrack[]>([]);
  const [playable, setPlayable] = useState<PlayableTrack[] | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wentLive, setWentLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // The live check runs here as well as in the page around it: the signed-in screen has no live
    // signal before a member joins a room, and a recording must never be offered over a live one.
    Promise.all([loopEnabled(controller.signal), roomIsLive()])
      .then(async ([enabled, live]) => {
        if (enabled && !live) setTracks(await blogReadings(controller.signal));
      })
      .catch((error: unknown) => {
        // The loop is an extra; when it cannot be read the page shows what it showed before.
        if (!controller.signal.aborted) console.warn('[chyme/readings] could not load the readings', error);
      });
    return () => controller.abort();
  }, []);

  const playFrom = useCallback((list: PlayableTrack[], trackIndex: number, offsetSeconds: number) => {
    const audio = audioRef.current;
    const track = list[trackIndex];
    if (!audio || !track) return;
    setIndex(trackIndex);
    setProblem(null);
    pendingOffsetRef.current = offsetSeconds;
    audio.src = track.audioUrl;
    audio.play().then(
      () => setPlaying(true),
      (error: unknown) => {
        setPlaying(false);
        setProblem(`The recording did not start: ${error instanceof Error ? error.message : 'the browser refused to play it.'}`);
      },
    );
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!playable && audio && tracks[0]) {
      // Start the element, muted, inside the tap itself: Safari refuses play() once the tap is
      // followed by a network wait, and reading the recordings' lengths is one.
      audio.muted = true;
      audio.src = tracks[0].audioUrl;
      void audio.play().catch(() => undefined);
    }
    const list = playable ?? (await withDurations(tracks));
    if (audio) audio.muted = false;
    setPlayable(list);
    const position = loopPositionAt(list.map((track) => track.durationSeconds), Date.now());
    if (position) playFrom(list, position.index, position.offsetSeconds);
    else setProblem('None of the recordings could be loaded. Try again later.');
  }, [playable, tracks, playFrom]);

  const handleEnded = useCallback(() => {
    if (index === null || !playable || playable.length === 0) return;
    playFrom(playable, (index + 1) % playable.length, 0);
  }, [index, playable, playFrom]);

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

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && pendingOffsetRef.current > 0) audio.currentTime = pendingOffsetRef.current;
    pendingOffsetRef.current = 0;
  }, []);

  const handleError = useCallback(() => {
    setPlaying(false);
    setProblem('The recording could not be loaded. The file may have moved; try again later.');
  }, []);

  // Stop the sound when the player leaves the page (a room went live, or the visitor navigated away).
  useEffect(() => () => audioRef.current?.pause(), []);

  if (tracks.length === 0) return null;
  return (
    <ReadingsCard
      current={index === null || !playable ? null : playable[index]}
      playing={playing}
      wentLive={wentLive}
      problem={problem}
      onToggle={playing ? stop : () => void start()}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- every reading has a text version: the published blog post it reads, linked beside the player ("Read the post"; every entry in the blog's list carries its post link). That is the text alternative for prerecorded audio (WCAG 1.2.1). */}
      <audio ref={audioRef} onEnded={handleEnded} onLoadedMetadata={handleLoadedMetadata} onError={handleError} preload="none" />
    </ReadingsCard>
  );
}

type ReadingsCardProps = {
  current: ReadingsTrack | null;
  playing: boolean;
  wentLive: boolean;
  problem: string | null;
  onToggle: () => void;
  children: ReactNode;
};

function ReadingsCard({ current, playing, wentLive, problem, onToggle, children }: ReadingsCardProps) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${t.BORDER}`, padding: '14px', textAlign: 'left' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>While the room is empty</div>
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, marginBottom: 10 }}>
        Recorded readings of the{' '}
        <a href={PEACE_BATTLE_URL} target="_blank" rel="noreferrer" style={{ color: t.ACCENT }}>Peace Battle 2</a>{' '}
        blog posts, on a loop. This is a recording, not a live host. It stops when someone goes live.
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
            <a href={current.postUrl} target="_blank" rel="noreferrer" style={{ color: t.ACCENT }}>Read the post</a>
          </div>
        ) : null}
      </div>
      {problem ? <div style={{ fontSize: 12, color: t.MUTED, marginTop: 8, wordBreak: 'break-word' }}>{problem}</div> : null}
      {children}
    </div>
  );
}
