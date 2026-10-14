// The readings loop, copied from the web (web components/chyme/readings/chyme-readings-player.tsx):
// computer-voice readings of blog posts, on a loop, shown only while the owner has it switched on
// and nobody is live. Every listener joins at the same point, worked out from the clock. Sound
// starts on a tap. While a reading plays, the room is checked every minute and the recording stops
// when somebody goes live. Nothing here touches Stream.
//
// The web plays the file in an <audio> element; the app plays it with expo-video's player, which
// the app already carries for Beacon, with no video view attached. The web opens a reading partway
// in with a `#t=` mark on the address; the native player instead seeks once the file is ready.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { interFamily } from '../../components/ui';
import { authedFetch } from '../../auth/authedFetch';
import { useChymeTokens } from './chyme-tokens';
import { BLOG_READINGS_URL, BLOG_URL, loopPositionAt, nextIndex, parseBlogReadings, type ReadingsTrack } from './chyme-readings-schedule';

const LIVE_CHECK_MS = 60_000;

async function roomIsLive(): Promise<boolean> {
  try {
    const res = await authedFetch('/api/chyme/public/room');
    const data = (await res.json().catch(() => null)) as { ok?: boolean; isLive?: boolean } | null;
    return res.ok && data?.ok === true && data.isLive === true;
  } catch {
    // no-trace: a failed check keeps the reading playing; the next check runs in a minute.
    return false;
  }
}

async function loopEnabled(): Promise<boolean> {
  const res = await authedFetch('/api/chyme/readings');
  const data = (await res.json().catch(() => null)) as { ok?: boolean; enabled?: boolean } | null;
  return res.ok && data?.ok === true && data.enabled === true;
}

async function blogReadings(): Promise<ReadingsTrack[]> {
  const res = await fetch(BLOG_READINGS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`The blog's list of readings answered HTTP ${res.status}.`);
  return parseBlogReadings(await res.json());
}

// The list, read once: only while the loop is switched on and nobody is live.
function useTracks() {
  const [tracks, setTracks] = useState<ReadingsTrack[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([loopEnabled(), roomIsLive()])
      .then(async ([enabled, live]) => {
        if (!enabled || live) return;
        const list = await blogReadings();
        if (active) setTracks(list);
      })
      .catch((error: unknown) => {
        // The loop is an extra; when it cannot be read the screen shows what it showed before.
        if (active) console.warn('[chyme/readings] could not load the readings', error);
      });
    return () => {
      active = false;
    };
  }, []);
  return tracks;
}

type Playback = {
  index: number | null;
  playing: boolean;
  starting: boolean;
  problem: string | null;
  start: () => void;
  stop: () => void;
};

// Load a reading and play it; a reading that fails is tried again from its start, then the loop
// moves on, and the reason shows only once every reading has failed in a row.
function usePlayback(player: VideoPlayer, tracks: ReadingsTrack[]): Playback {
  const indexRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const seekRef = useRef(0);
  const failuresRef = useRef(0);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const playFrom = useCallback((trackIndex: number, offsetSeconds: number) => {
    const track = tracks[trackIndex];
    if (!track) return;
    indexRef.current = trackIndex;
    offsetRef.current = offsetSeconds;
    seekRef.current = offsetSeconds;
    setIndex(trackIndex);
    setProblem(null);
    player.replace({ uri: track.audioUrl });
    player.play();
    setPlaying(true);
  }, [player, tracks]);

  const stop = useCallback(() => {
    player.pause();
    setPlaying(false);
    setStarting(false);
  }, [player]);

  const start = useCallback(() => {
    const position = loopPositionAt(tracks.map((track) => track.durationSeconds), Date.now());
    if (!position) return;
    setStarting(true);
    failuresRef.current = 0;
    playFrom(position.index, position.offsetSeconds);
  }, [tracks, playFrom]);

  const onFailure = useCallback((message: string) => {
    const current = indexRef.current;
    if (current !== null && offsetRef.current >= 1) return playFrom(current, 0);
    failuresRef.current += 1;
    if (current !== null && failuresRef.current < tracks.length) return playFrom(nextIndex(current, tracks.length), 0);
    setPlaying(false);
    setStarting(false);
    setProblem(`The recording could not be loaded (${message}).`);
  }, [playFrom, tracks.length]);

  useEffect(() => {
    const status = player.addListener('statusChange', ({ status: next, error }) => {
      if (next === 'readyToPlay' && seekRef.current >= 1) {
        player.currentTime = seekRef.current;
        seekRef.current = 0;
      }
      if (next === 'error') onFailure(error?.message ?? 'no reason was given');
    });
    const ended = player.addListener('playToEnd', () => {
      const current = indexRef.current;
      if (current !== null) playFrom(nextIndex(current, tracks.length), 0);
    });
    const started = player.addListener('playingChange', ({ isPlaying }) => {
      if (!isPlaying) return;
      failuresRef.current = 0;
      setStarting(false);
    });
    return () => {
      status.remove();
      ended.remove();
      started.remove();
    };
  }, [player, onFailure, playFrom, tracks.length]);

  return { index, playing, starting, problem, start, stop };
}

export function ChymeReadingsPlayer({ onRoomLive }: { onRoomLive?: () => void } = {}) {
  const tracks = useTracks();
  const player = useVideoPlayer(null);
  const playback = usePlayback(player, tracks);
  const [wentLive, setWentLive] = useState(false);
  const { playing, stop } = playback;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      void roomIsLive().then((live) => {
        if (!live) return;
        stop();
        setWentLive(true);
        onRoomLive?.();
      });
    }, LIVE_CHECK_MS);
    return () => clearInterval(timer);
  }, [playing, stop, onRoomLive]);

  if (tracks.length === 0) return null;
  const current = playback.index === null ? null : tracks[playback.index] ?? null;
  return <ReadingsCard current={current} playback={playback} wentLive={wentLive} />;
}

function openLink(url: string) {
  void Linking.openURL(url).catch(() => {
    /* no-trace: the phone has nothing to open a web address with */
  });
}

function ReadingsCard({ current, playback, wentLive }: { current: ReadingsTrack | null; playback: Playback; wentLive: boolean }) {
  const t = useChymeTokens();
  const { playing, starting, problem } = playback;
  return (
    <View style={[styles.card, { borderRadius: t.radius(10), borderColor: t.BORDER }]}>
      <Text style={[styles.title, { color: t.TITLE }]}>While you wait for someone to go live</Text>
      <Text style={[styles.body, { color: t.MUTED }]}>
        Computer-voice readings of posts from{' '}
        <Text accessibilityRole="link" onPress={() => openLink(BLOG_URL)} style={{ color: t.ACCENT }}>the blog</Text>, on a loop. This is a recording, not a live host. It stops when someone goes live.
      </Text>
      {wentLive ? <Text style={[styles.small, styles.wentLive, { color: t.TITLE }]}>Someone just went live. The recording has stopped.</Text> : null}
      <View style={styles.row}>
        <TouchableOpacity
          onPress={playing ? playback.stop : playback.start}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop the recording' : 'Play the recording'}
          style={[styles.play, { borderRadius: t.radius(999), backgroundColor: t.ACCENT }]}
        >
          {playing ? <Pause size={14} color="#fff" /> : <Play size={14} color="#fff" />}
          <Text style={styles.playText}>{playing ? 'Stop' : 'Play readings'}</Text>
        </TouchableOpacity>
        {current ? <Text numberOfLines={1} style={[styles.trackTitle, { color: t.TITLE }]}>{current.title}</Text> : null}
      </View>
      {starting ? <Text accessibilityRole="alert" style={[styles.small, styles.gap, { color: t.TITLE }]}>Audio will begin playing in a few seconds.</Text> : null}
      {current ? (
        <TouchableOpacity onPress={() => openLink(current.postUrl)} accessibilityRole="link" style={[styles.read, { borderRadius: t.radius(999), borderColor: t.ACCENT }]}>
          <Text style={[styles.readText, { color: t.ACCENT }]}>Read this post</Text>
        </TouchableOpacity>
      ) : null}
      {problem ? <Text style={[styles.small, styles.gap, { color: t.MUTED }]}>{problem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderWidth: 1, padding: 14 },
  title: { fontSize: 13, marginBottom: 4, fontFamily: interFamily('700') },
  body: { fontSize: 12, lineHeight: 18, marginBottom: 10, fontFamily: interFamily('400') },
  small: { fontSize: 12, fontFamily: interFamily('400') },
  wentLive: { marginBottom: 8 },
  gap: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14 },
  playText: { color: '#fff', fontSize: 13, fontFamily: interFamily('600') },
  trackTitle: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, fontFamily: interFamily('600') },
  read: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, alignItems: 'center' },
  readText: { fontSize: 13, fontFamily: interFamily('600') },
});
