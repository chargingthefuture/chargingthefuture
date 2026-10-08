// "Coming up on TI Radio", copied from the web (web components/chyme/chyme-upcoming.tsx): the next
// booked slots on the TI Radio guide as a sideways row of cards, with the same loading, error and
// nothing-booked lines. The guide itself is a web page, so its links open the web app.

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Radio } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { formatUpcomingWhen, getChymeUpcoming, type ChymeUpcomingSlot } from './ChymeApi';
import { openWebPath, useChymeTokens, type ChymeTokens } from './chyme-tokens';

type UpcomingState =
  | { kind: 'loading' }
  | { kind: 'ready'; slots: ChymeUpcomingSlot[] }
  | { kind: 'error'; message: string };

// Read once when the screen opens, as the signed-in web page does.
export function ChymeUpcoming() {
  const t = useChymeTokens();
  const [state, setState] = useState<UpcomingState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', slots: await getChymeUpcoming() });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View accessibilityLabel="Coming up on TI Radio" style={[styles.section, { borderBottomColor: t.BORDER, backgroundColor: t.HEADER }]}>
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <CalendarClock size={13} color={t.FAINT} />
          <Text style={[styles.heading, { color: t.FAINT }]}>Coming up on TI Radio</Text>
        </View>
        <Text accessibilityRole="link" onPress={() => openWebPath('/ti-radio')} style={[styles.link, { color: t.ACCENT }]}>
          Full guide →
        </Text>
      </View>
      <UpcomingBody state={state} t={t} />
    </View>
  );
}

function UpcomingBody({ state, t }: { state: UpcomingState; t: ChymeTokens }) {
  if (state.kind === 'loading') {
    return <Text style={[styles.line, { color: t.FAINT }]}>Reading the guide…</Text>;
  }
  if (state.kind === 'error') {
    return <Text style={[styles.line, styles.lineLoose, { color: t.MUTED }]}>Couldn&apos;t read the TI Radio guide. {state.message}</Text>;
  }
  if (state.slots.length === 0) {
    return (
      <Text style={[styles.line, styles.lineLoose, { color: t.MUTED }]}>
        Nothing is scheduled this week. Any approved member can{' '}
        <Text accessibilityRole="link" onPress={() => openWebPath('/ti-radio')} style={[styles.inlineLink, { color: t.ACCENT }]}>
          book a slot on the guide
        </Text>{' '}
        and host a discussion here.
      </Text>
    );
  }
  return <UpcomingCards slots={state.slots} t={t} />;
}

function UpcomingCards({ slots, t }: { slots: ChymeUpcomingSlot[]; t: ChymeTokens }) {
  const now = new Date();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={`${slots.length} scheduled discussion${slots.length === 1 ? '' : 's'}, soonest first`}
      contentContainerStyle={styles.cards}
    >
      {slots.map((slot) => (
        <View
          key={slot.slotStartIso}
          style={[styles.card, { borderRadius: t.radius(10), backgroundColor: t.INPUT_BG, borderColor: slot.isOnAir ? t.ACCENT : t.BORDER }]}
        >
          <Text style={[styles.when, { color: slot.isOnAir ? t.ACCENT : t.TEXT }]}>{formatUpcomingWhen(slot.slotStartIso, slot.slotEndIso, now)}</Text>
          {slot.isOnAir ? (
            <View style={styles.onAirRow}>
              <Radio size={10} color={t.ACCENT} />
              <Text style={[styles.onAir, { color: t.ACCENT }]}>On air now</Text>
            </View>
          ) : null}
          <Text style={[styles.title, { color: t.TITLE }]}>{slot.title}</Text>
          <Text style={[styles.host, { color: t.SUBTLE }]}>Hosted by @{slot.hostUsername}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', fontFamily: interFamily('700') },
  link: { fontSize: 12, fontFamily: interFamily('600') },
  line: { fontSize: 12, fontFamily: interFamily('400') },
  lineLoose: { lineHeight: 18 },
  inlineLink: { fontFamily: interFamily('600') },
  cards: { gap: 8, paddingBottom: 2 },
  card: { width: 170, gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1 },
  when: { fontSize: 11, lineHeight: 15, fontFamily: interFamily('700') },
  onAirRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onAir: { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: interFamily('700') },
  title: { fontSize: 12.5, lineHeight: 16, fontFamily: interFamily('600') },
  host: { fontSize: 11, fontFamily: interFamily('400') },
});
