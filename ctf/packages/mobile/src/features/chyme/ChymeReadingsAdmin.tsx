/**
 * ChymeReadingsAdmin — the readings loop's admin screen ("Chyme readings loop"), copied from the web
 * (web components/chyme/readings/chyme-readings-admin.tsx, at /admin/chyme/readings): the on/off
 * switch, and the blog's list of recordings, read-only, so the admin can see what the loop plays.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import { getReadingsSetting, postReadingsSetting } from './chyme-admin-api';
import { BLOG_READINGS_URL, parseBlogReadings, type ReadingsTrack } from './chyme-readings-schedule';
import { Section } from './chyme-usage-sections';
import { useShellTokens, type ChymeTokens } from './chyme-tokens';

type BlogList = { tracks: ReadingsTrack[] } | { error: string };

function failureText(err: unknown): string {
  return err instanceof Error ? err.message : 'the request did not complete.';
}

function SwitchSection({ enabled, disabled, onToggle, busy, t }: { enabled: boolean; disabled: boolean; onToggle: () => void; busy: boolean; t: ChymeTokens }) {
  return (
    <Section t={t}>
      <Text style={[styles.heading, { color: t.TEXT }]}>{enabled ? 'On' : 'Off'}</Text>
      <Text style={[styles.body, styles.gap12, { color: t.SUBTLE }]}>
        When on, the Chyme page offers the recorded blog readings to anyone who arrives while nobody is live. They stop by themselves when someone goes live. Turn it off when the room no longer needs it.
      </Text>
      <TouchableOpacity
        onPress={onToggle}
        disabled={busy || disabled}
        accessibilityRole="button"
        style={[styles.toggle, { borderRadius: t.radius(10), backgroundColor: enabled ? t.INPUT_BG : t.ACCENT }]}
      >
        <Text style={[styles.toggleText, { color: enabled ? t.TEXT : '#fff' }]}>{enabled ? 'Turn off' : 'Turn on'}</Text>
      </TouchableOpacity>
    </Section>
  );
}

function ListBody({ list, t }: { list: BlogList | null; t: ChymeTokens }) {
  if (list === null) return <Text style={[styles.body, { color: t.SUBTLE }]}>Reading the blog&apos;s list…</Text>;
  if ('error' in list) return <Text style={[styles.body, styles.errorText]}>{list.error}</Text>;
  if (list.tracks.length === 0) {
    return <Text style={[styles.body, { color: t.SUBTLE }]}>None yet. The loop shows nothing until the blog has at least one recording.</Text>;
  }
  return (
    <>
      {list.tracks.map((track) => (
        <View key={track.slug} style={[styles.track, { borderTopColor: t.BORDER }]}>
          <Text accessibilityRole="link" onPress={() => void Linking.openURL(track.postUrl).catch(() => undefined)} style={[styles.trackTitle, { color: t.TEXT }]}>
            {track.title}
          </Text>
        </View>
      ))}
    </>
  );
}

function ListSection({ list, t }: { list: BlogList | null; t: ChymeTokens }) {
  return (
    <Section t={t}>
      <Text style={[styles.heading, { color: t.TEXT }]}>Recordings{list && 'tracks' in list ? ` · ${list.tracks.length}` : ''}</Text>
      <Text style={[styles.body, styles.gap10, { color: t.SUBTLE }]}>
        To add one, upload <Text style={styles.code}>content/audio/&lt;post-slug&gt;.mp3</Text> to the blog repository. After the blog deploys, the post shows a “Listen to this post” player and the reading joins this list. To take one out, delete the file.
      </Text>
      <ListBody list={list} t={t} />
    </Section>
  );
}

function useBlogList(): BlogList | null {
  const [list, setList] = useState<BlogList | null>(null);
  useEffect(() => {
    fetch(BLOG_READINGS_URL, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`the blog answered HTTP ${res.status}`);
        setList({ tracks: parseBlogReadings(await res.json()) });
      })
      .catch((err: unknown) => setList({ error: `Could not read the blog's list of recordings: ${failureText(err)}` }));
  }, []);
  return list;
}

export function ChymeReadingsAdmin() {
  const t = useShellTokens();
  const [setting, setSetting] = useState<{ enabled: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useBlogList();

  const load = useCallback(async () => {
    try {
      setSetting(await getReadingsSetting());
      setError(null);
    } catch (err) {
      setError(`Could not read the switch: ${failureText(err)}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabled = setting?.enabled ?? false;
  const toggle = async () => {
    setBusy(true);
    try {
      await postReadingsSetting(!enabled);
      await load();
    } catch (err) {
      setError(`Could not change the switch: ${failureText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: t.BG }]} contentContainerStyle={styles.content}>
      {error ? <Text style={[styles.body, styles.errorText, styles.gap12]}>{error}</Text> : null}
      <SwitchSection enabled={enabled} disabled={!setting} onToggle={() => void toggle()} busy={busy} t={t} />
      <ListSection list={list} t={t} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Takes the app's content padding back and applies the web screen's.
  screen: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  content: { padding: 16 },
  heading: { fontSize: 15, marginBottom: 6, fontFamily: interFamily('700') },
  body: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  gap12: { marginBottom: 12 },
  gap10: { marginBottom: 10 },
  errorText: { color: '#fca5a5' },
  toggle: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16 },
  toggleText: { fontSize: 14, fontFamily: interFamily('700') },
  track: { paddingVertical: 8, borderTopWidth: 1 },
  trackTitle: { fontSize: 13, textDecorationLine: 'underline', fontFamily: interFamily('600') },
  code: { fontFamily: 'monospace' },
});
