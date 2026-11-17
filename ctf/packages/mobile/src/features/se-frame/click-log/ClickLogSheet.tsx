// + New → "Log what happened" on Android, the copy of the web's click-log-sheet.tsx: a quick pin that
// asks for the phone's location as it opens, with the 3.0 ClickLog entry form under it, logging
// through the same route. Once saved it says so and links to the 3.0 page for history and trends,
// opened in the browser. The phone's back button closes it.

import React, { useMemo } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_CLICK_LOG_WORDS as W, CLICK_LOG_HISTORY_HREF, type SeThemeTokens } from '@ctf/shared';
import { ClickLogForm } from './ClickLogForm';
import { makeClickLogSheetStyles, type ClickLogSheetStyles } from './clickLogSheetStyles';
import { useClickLogEntry, type ClickLogEntry } from './useClickLogEntry';

type Props = { t: SeThemeTokens; onClose: () => void; go: (_href: string) => void };

function Saved({ s, entry, onClose, go }: { s: ClickLogSheetStyles; entry: ClickLogEntry; onClose: () => void; go: Props['go'] }) {
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {W.savedTitle}
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.rule}>
        {W.saved}
      </Text>
      <TouchableOpacity accessibilityRole="link" onPress={() => go(CLICK_LOG_HISTORY_HREF)}>
        <Text style={s.historyLink}>{W.history}</Text>
      </TouchableOpacity>
      <View style={s.spacer} />
      <View style={s.actions}>
        <TouchableOpacity accessibilityRole="button" style={s.secondary} onPress={entry.reset}>
          <Text style={s.secondaryLabel}>{W.another}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={s.primary} onPress={onClose}>
          <Text style={s.primaryLabel}>{W.done}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function Body({ s, t, entry, onClose, go }: Props & { s: ClickLogSheetStyles; entry: ClickLogEntry }) {
  if (entry.saved) return <Saved s={s} entry={entry} onClose={onClose} go={go} />;
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {W.title}
      </Text>
      {entry.setup.loading ? <Text style={s.note}>{W.loading}</Text> : <ClickLogForm s={s} t={t} entry={entry} onCancel={onClose} />}
    </>
  );
}

export function ClickLogSheet({ t, onClose, go }: Props) {
  const s = useMemo(() => makeClickLogSheetStyles(t), [t]);
  const entry = useClickLogEntry();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={{ height: 48 }} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={W.title}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={s.top}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} style={s.close} onPress={onClose}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
                </Svg>
              </TouchableOpacity>
              <Text style={s.eyebrow}>{W.eyebrow}</Text>
            </View>
            <Body s={s} t={t} entry={entry} onClose={onClose} go={go} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
