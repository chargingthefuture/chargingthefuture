// The week strip on Today on Android, the copy of the web's week-strip.tsx: Monday to Sunday of the
// reader's own week, today filled in. A day with a talk booked in the Main Room carries a dot;
// choosing a day says what is booked that day. Days already gone cannot be chosen.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_TODAY_ROOM_WORDS as W, seTalkTimes, seWeekDays, type SeThemeTokens, type SeTodayTalk, type SeWeekDay } from '@ctf/shared';
import { SE_FONT } from '../fonts';

type Styles = ReturnType<typeof makeStyles>;

function Day({ s, day, picked, onPick }: { s: Styles; day: SeWeekDay; picked: boolean; onPick: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={day.label}
      accessibilityState={{ selected: picked, disabled: day.past }}
      disabled={day.past}
      onPress={onPick}
      style={[s.day, day.past ? s.past : null]}
    >
      <Text style={s.letter}>{day.letter}</Text>
      <View style={[s.date, day.today ? s.today : null, picked ? s.picked : null]}>
        <Text style={[s.dateLabel, day.today ? s.todayLabel : null]}>{day.date}</Text>
      </View>
      <View style={[s.dot, day.talks.length > 0 ? s.dotOn : null]} />
    </TouchableOpacity>
  );
}

export function WeekStrip({ t, talks }: { t: SeThemeTokens; talks: SeTodayTalk[] }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const days = seWeekDays(talks);
  const [picked, setPicked] = useState<string | null>(null);
  const shown = days.find((day) => day.key === picked) ?? null;
  return (
    <>
      <View style={s.week} accessibilityLabel={W.weekLabel}>
        {days.map((day) => (
          <Day key={day.key} s={s} day={day} picked={picked === day.key} onPick={() => setPicked((value) => (value === day.key ? null : day.key))} />
        ))}
      </View>
      {shown ? (
        <View style={s.panel} accessibilityLiveRegion="polite">
          <Text style={s.panelDay}>{shown.label}</Text>
          {shown.talks.length === 0 ? <Text style={s.meta}>{W.noTalks}</Text> : null}
          {shown.talks.map((talk) => (
            <Text key={talk.startIso} style={s.talk}>
              <Text style={s.bold}>{talk.title}</Text> · {talk.host} · {seTalkTimes(talk)}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    week: { flexDirection: 'row', gap: 4 },
    day: { flex: 1, minHeight: 44, alignItems: 'center', gap: 4 },
    past: { opacity: 0.55 },
    letter: { fontSize: 11, color: t.soft, fontFamily: SE_FONT.sans },
    date: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    today: { backgroundColor: t.btn },
    picked: { borderWidth: 1.5, borderColor: t.line },
    dateLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    todayLabel: { color: t.onBtn },
    dot: { width: 5, height: 5, borderRadius: 999 },
    dotOn: { backgroundColor: t.liveBadge },
    panel: { gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    panelDay: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    talk: { fontSize: 14, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans },
    bold: { fontFamily: SE_FONT.sansBold },
  });
}
