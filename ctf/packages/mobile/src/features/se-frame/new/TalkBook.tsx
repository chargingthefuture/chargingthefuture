// + New → Talk on Android, the copy of the web's talk-book.tsx, to the approved board "Schedule a
// talk": the seven days from today, every 90 minutes on the chosen day (open ones dashed and free to
// take, booked ones with their title and host), and the topic for the one picked.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  SE_TALK_WORDS as W,
  seSlotDay,
  seTalkBooked,
  seTalkDays,
  seTalkFirstOpenDay,
  seTalkPickedSpan,
  seTalkRow,
  type SeTalkDay,
  type SeTalkSlot,
  type SeThemeTokens,
} from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { SE_FONT } from '../fonts';
import { makeSheetStyles, type SheetStyles } from './sheetStyles';

// The same limit the web form and the route hold (lib/ti-radio/constants.ts).
const MAX_TITLE = 120;

function DayStrip({ sh, days, day, onDay }: { sh: SheetStyles; days: SeTalkDay[]; day: string | null; onDay: (_key: string) => void }) {
  return (
    <View accessibilityLabel={W.days} style={sh.days}>
      {days.map((item) => {
        const on = item.key === day;
        return (
          <TouchableOpacity key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: on }} onPress={() => onDay(item.key)} style={[sh.day, on ? sh.dayOn : null]}>
            <Text style={[sh.dayLetter, on ? sh.dayOnLabel : null]}>{item.letter}</Text>
            <Text style={[sh.dayDate, on ? sh.dayOnLabel : null]}>{item.date}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SlotRow({ sh, slot, picked, onPick }: { sh: SheetStyles; slot: SeTalkSlot; picked: string | null; onPick: (_slot: SeTalkSlot) => void }) {
  const row = seTalkRow(slot, picked);
  const on = row.look === 'picked';
  const body = (
    <>
      <Text style={[sh.slotTime, on ? sh.onPick : null]}>{row.time}</Text>
      <View style={sh.slotText}>
        <Text numberOfLines={1} style={[sh.slotTitle, on ? sh.onPick : null]}>
          {row.title}
        </Text>
        <Text style={[sh.slotSub, on ? sh.onPick : null]}>{row.sub}</Text>
      </View>
    </>
  );
  if (!row.pickable) return <View style={[sh.slot, sh.booked]}>{body}</View>;
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPick(slot)} style={[sh.slot, sh[row.look]]}>
      {body}
    </TouchableOpacity>
  );
}

function SlotList({ sh, slots, picked, onPick }: { sh: SheetStyles; slots: SeTalkSlot[]; picked: string | null; onPick: (_slot: SeTalkSlot) => void }) {
  if (!slots.some((slot) => slot.state === 'open' && !slot.isOnAir)) return <Text style={sh.sub}>{W.noneThisDay}</Text>;
  return (
    <View accessibilityLabel={W.slots} style={sh.slots}>
      {slots.map((slot) => (
        <SlotRow key={slot.slotStartIso} sh={sh} slot={slot} picked={picked} onPick={onPick} />
      ))}
    </View>
  );
}

// The day on show: the one chosen, else the first.
function shownDay(days: SeTalkDay[], key: string | null): { key: string | null; slots: SeTalkSlot[] } {
  const day = days.find((item) => item.key === key) ?? days[0];
  return day ? { key: day.key, slots: day.slots } : { key: null, slots: [] };
}

// The picked slot, the topic, and booking it through the TI Radio guide's own route.
function useBooking(reload: () => Promise<void>) {
  const [picked, setPicked] = useState<SeTalkSlot | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  async function submit() {
    if (!picked || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await authedFetchJson('/api/ti-radio/slots', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ slotStart: picked.slotStartIso, title: title.trim() }),
      });
      setBooked(picked.slotStartIso);
      setTitle('');
      setPicked(null);
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : W.failed);
    } finally {
      setBusy(false);
    }
  }
  return { picked, setPicked, title, setTitle, busy, error, booked, submit };
}

function AboutLabel({ s, sh, picked }: { s: Styles; sh: SheetStyles; picked: SeTalkSlot | null }) {
  return (
    <Text style={s.label}>
      {W.about} <Text style={sh.optional}>{picked ? seTalkPickedSpan(picked.slotStartIso, picked.slotEndIso) : W.pickFirst}</Text>
    </Text>
  );
}

export function TalkBook({ t, slots, reload }: { t: SeThemeTokens; slots: SeTalkSlot[]; reload: () => Promise<void> }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const sh = useMemo(() => makeSheetStyles(t), [t]);
  const days = seTalkDays(slots);
  const [day, setDay] = useState<string | null>(() => seTalkFirstOpenDay(days));
  const { picked, setPicked, title, setTitle, busy, error, booked, submit } = useBooking(reload);
  const shown = shownDay(days, day);
  const pickedIso = picked ? picked.slotStartIso : null;
  const disabled = busy || !picked || !title.trim();

  return (
    <View style={s.form}>
      {booked ? <Text style={s.done}>{seTalkBooked(seSlotDay(booked))}</Text> : null}
      <DayStrip sh={sh} days={days} day={shown.key} onDay={setDay} />
      <SlotList sh={sh} slots={shown.slots} picked={pickedIso} onPick={setPicked} />
      <AboutLabel s={s} sh={sh} picked={picked} />
      <TextInput accessibilityLabel={W.about} placeholder={W.aboutPlaceholder} placeholderTextColor={t.soft} style={sh.pill} value={title} maxLength={MAX_TITLE} onChangeText={setTitle} />
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => void submit()} style={[s.submit, disabled ? s.disabled : null]}>
        <Text style={s.submitLabel}>{busy ? W.submitting : W.submit}</Text>
      </TouchableOpacity>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    form: { gap: 12, alignSelf: 'stretch' },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    error: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    done: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.hair, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    submit: {
      minHeight: 54,
      marginTop: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.btn,
      boxShadow: `0px 4px 0px ${t.line}`,
    },
    submitLabel: { fontSize: 16, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    disabled: { opacity: 0.6 },
  });
}
