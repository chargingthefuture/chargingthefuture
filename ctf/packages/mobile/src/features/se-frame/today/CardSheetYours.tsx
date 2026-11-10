// The Android copy of the web's card-sheet-yours.tsx: in a card opened in place, on an ask or offer
// the viewer posted, when it leaves Today and the poster's own controls. Leaving Today closes
// nothing; the item stays where it lives.

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_CARD_LIFETIME_WORDS as W, seOnTodayUntil, type SeTodayCard } from '@ctf/shared';
import type { CardSheetStyles } from './cardSheetStyles';
import { usePosterActions } from './usePosterActions';

export function SheetYours({ s, card, onChanged }: { s: CardSheetStyles; card: SeTodayCard; onChanged?: () => void }) {
  const actions = usePosterActions(card.id, onChanged);
  const mine = card.mine;
  if (!mine) return null;
  const { status } = actions;
  const busy = status.kind === 'busy';
  return (
    <View style={s.answers} accessibilityLabel={W.yours}>
      <Text style={s.answersTitle}>
        {W.yours} · {seOnTodayUntil(mine.leavesIso)}
      </Text>
      <View style={s.yoursRow}>
        {mine.canClose ? (
          <>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.talkPrimary} onPress={() => void actions.close('done')}>
              <Text style={s.talkPrimaryLabel}>{W.done}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.talkButton} onPress={() => void actions.close('not_done')}>
              <Text style={s.talkLabel}>{W.notDone}</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {mine.canRenew ? (
          <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.talkButton} onPress={() => void actions.renew()}>
            <Text style={s.talkLabel}>{status.kind === 'busy' && status.what === 'renew' ? W.renewing : W.renew}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {status.kind === 'done' ? <Text style={s.hint}>{status.text}</Text> : null}
      {status.kind === 'error' ? (
        <Text accessibilityRole="alert" style={s.hint}>
          {status.text}
        </Text>
      ) : null}
    </View>
  );
}
