// + New → Ask → "By when?" on Android, the copy of the web's ByWhen in ask-form.tsx: Today, This
// week, A date (Android's date picker) or No deadline. A deadline keeps the ask on Today until then;
// with none it stays 14 days and can be kept up longer.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SE_ASK_DUE_CHOICES, SE_CARD_LIFETIME_WORDS as L, seLocalDay, type SeAskDue, type SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../fonts';

type Props = { t: SeThemeTokens; due: SeAskDue; date: string; onDue: (_due: SeAskDue) => void; onDate: (_date: string) => void };

function openPicker(date: string, onDate: (_date: string) => void) {
  const [year, month, day] = date ? date.split('-').map(Number) : [];
  DateTimePickerAndroid.open({
    value: date ? new Date(year, month - 1, day) : new Date(),
    mode: 'date',
    minimumDate: new Date(),
    onChange: (event, picked) => {
      if (event.type === 'set' && picked) onDate(seLocalDay(picked));
    },
  });
}

export function AskByWhen({ t, due, date, onDue, onDate }: Props) {
  const s = makeStyles(t);
  return (
    <View style={s.group} accessibilityLabel={L.byWhen}>
      <Text style={s.label}>{L.byWhen}</Text>
      <View style={s.chips}>
        {SE_ASK_DUE_CHOICES.map((choice) => {
          const on = due === choice.key;
          return (
            <TouchableOpacity key={choice.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onDue(choice.key)} style={[s.chip, on ? s.chipOn : null]}>
              <Text style={[s.chipLabel, on ? s.chipOnLabel : null]}>{choice.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {due === 'date' ? (
        <>
          <Text style={s.label}>{L.date}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={L.date} onPress={() => openPicker(date, onDate)} style={s.input}>
            <Text style={s.inputText}>{date || L.date}</Text>
          </TouchableOpacity>
        </>
      ) : null}
      <Text style={s.text}>{L.byWhenHint}</Text>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    group: { gap: 8 },
    label: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 40, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.bg },
    chipOn: { borderColor: t.line, backgroundColor: t.btn },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sans },
    chipOnLabel: { color: t.onBtn, fontFamily: SE_FONT.sansBold },
    input: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg },
    inputText: { color: t.ink, fontSize: 16, fontFamily: SE_FONT.sans },
  });
}
