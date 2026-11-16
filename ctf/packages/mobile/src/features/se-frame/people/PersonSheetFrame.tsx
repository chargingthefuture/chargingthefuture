// The sheet People's profile and quote open in on Android, the copy of the web's
// person-sheet-frame.tsx. The Modal takes screen-reader focus while it is open and the back gesture
// closes it; the screen hands focus back to the button that opened it (PeopleScreen).

import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_PERSON_SHEET_WORDS as W, type SeThemeTokens } from '@ctf/shared';
import type { PersonSheetStyles } from './personSheetStyles';

type Props = { t: SeThemeTokens; s: PersonSheetStyles; title: string; label: string; onClose: () => void; children: ReactNode };

export function PersonSheetFrame({ t, s, title, label, onClose, children }: Props) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={W.close} style={{ height: 64 }} onPress={onClose} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={label}>
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.grip} />
            <View style={s.head}>
              <Text style={s.kicker}>{title}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} style={s.round} onPress={onClose}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </TouchableOpacity>
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Reading, or a failed read with Try again, shared by both sheets.
export function SheetStatus({ s, loading, failed, onRetry }: { s: PersonSheetStyles; loading: string | null; failed: string | null; onRetry: () => void }) {
  if (loading) return <Text accessibilityLiveRegion="polite" style={s.soft}>{loading}</Text>;
  if (!failed) return null;
  return (
    <Text accessibilityRole="alert" style={s.soft}>
      {failed}{' '}
      <Text accessibilityRole="button" onPress={onRetry} style={s.link}>
        {W.tryAgain}
      </Text>
    </Text>
  );
}
