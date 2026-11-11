// People for a member not approved yet on Android, the copy of the web (components/se-frame/people/
// people-locked.tsx), built to the approved board "People, not yet verified".

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_PEOPLE_LOCKED_FACES, SE_PEOPLE_WORDS as W } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import type { PeopleStyles } from './peopleStyles';

type Props = { s: PeopleStyles; count: number | null; onUnlock: () => void; onToday: () => void };

export function PeopleLocked({ s, count, onUnlock, onToday }: Props) {
  return (
    <>
      <View style={s.faces} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {SE_PEOPLE_LOCKED_FACES.map((seed) => (
          <View key={seed} style={s.faceCell}>
            <View style={s.lockedFace}>
              <SeAvatar accountId={seed} size={52} />
            </View>
          </View>
        ))}
      </View>
      <View style={s.lockedCard}>
        {count !== null ? <Text style={s.lockedNumber}>{count}</Text> : null}
        <Text style={s.lockedLabel}>{W.lockedCount}</Text>
        <Text style={s.lockedText}>{W.lockedText}</Text>
        <TouchableOpacity accessibilityRole="link" onPress={onUnlock} style={s.finish}>
          <Text style={s.finishLabel}>{W.finishUnlock}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.openNow}>
        <Text style={s.openTitle}>{W.openNow}</Text>
        <Text style={s.lockedText}>{W.openNowText}</Text>
        <Text accessibilityRole="button" onPress={onToday} style={s.backLink}>
          {W.backToToday}
        </Text>
      </View>
    </>
  );
}
