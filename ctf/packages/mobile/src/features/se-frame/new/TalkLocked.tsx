// + New → Talk for a member not verified yet on Android, the copy of the web's talk-locked.tsx: why
// booking waits for Unlock, and the next talk on the schedule to listen to.

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_TALK_WORDS as W, seNextTalk, seNextTalkLine, seTalkCalendarEvent, type SeTalkSlot, type SeThemeTokens } from '@ctf/shared';
import { AddToCalendarButton } from '../../../components/shared/AddToCalendarButton';
import type { FeatureKey } from '../../../navigation/screens';
import { makeSheetStyles } from './sheetStyles';

export function TalkLocked({ t, slots, onOpen }: { t: SeThemeTokens; slots: SeTalkSlot[]; onOpen: (_key: FeatureKey) => void }) {
  const sh = useMemo(() => makeSheetStyles(t), [t]);
  const next = seNextTalk(slots);
  return (
    <>
      <View style={sh.lockCard}>
        <Text accessibilityRole="header" style={sh.lockTitle}>
          {W.lockedTitle}
        </Text>
        <Text style={sh.lockText}>{W.lockedText}</Text>
        <TouchableOpacity accessibilityRole="link" onPress={() => onOpen('unlock')} style={sh.lockButton}>
          <Text style={sh.lockButtonLabel}>{W.finishUnlock}</Text>
        </TouchableOpacity>
      </View>
      <View style={sh.nextCard}>
        <Text accessibilityRole="header" style={sh.nextLabel}>
          {W.nextTalk}
        </Text>
        {next ? (
          <>
            <Text style={sh.nextTitle}>{next.title}</Text>
            <Text style={sh.sub}>{seNextTalkLine(next)}</Text>
            <AddToCalendarButton color={t.ink} borderColor={t.line} event={seTalkCalendarEvent(next)} style={{ marginTop: 4 }} />
          </>
        ) : (
          <Text style={sh.sub}>{W.nothingBooked}</Text>
        )}
      </View>
    </>
  );
}
