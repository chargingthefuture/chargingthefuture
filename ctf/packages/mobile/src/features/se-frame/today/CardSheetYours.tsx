// The Android copy of the web's card-sheet-yours.tsx: in a card opened in place, on an ask or offer
// the viewer posted, when it leaves Today and the poster's own controls. Leaving Today closes
// nothing; the item stays where it lives. Done on an ask somebody offered to help with asks who did it,
// from those members, one choice; with nobody, Done closes it straight away.

import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_CARD_LIFETIME_WORDS as W, seOnTodayUntil, type SeCardAnswer, type SeTodayCard } from '@ctf/shared';
import type { CardSheetStyles } from './cardSheetStyles';
import { usePosterActions } from './usePosterActions';

type WhoProps = { s: CardSheetStyles; helpers: SeCardAnswer[]; busy: boolean; onPick: (_id: string) => void; onBack: () => void };

// Who did it: one button per member who answered I can help, and Back.
function WhoDidIt({ s, helpers, busy, onPick, onBack }: WhoProps) {
  return (
    <>
      <Text style={s.answersTitle}>{W.whoDidIt}</Text>
      <View style={s.yoursRow}>
        {helpers.map((helper) => (
          <TouchableOpacity key={helper.accountId} accessibilityRole="button" disabled={busy} style={s.talkPrimary} onPress={() => onPick(helper.accountId)}>
            <Text style={s.talkPrimaryLabel}>{helper.handle}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.talkButton} onPress={onBack}>
          <Text style={s.talkLabel}>{W.back}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export function SheetYours({ s, card, helpers, onChanged }: { s: CardSheetStyles; card: SeTodayCard; helpers: SeCardAnswer[]; onChanged?: () => void }) {
  const actions = usePosterActions(card.id, onChanged);
  const [picking, setPicking] = useState(false);
  const mine = card.mine;
  if (!mine) return null;
  const { status } = actions;
  const busy = status.kind === 'busy';
  return (
    <View style={s.answers} accessibilityLabel={W.yours}>
      <Text style={s.answersTitle}>
        {W.yours} · {seOnTodayUntil(mine.leavesIso)}
      </Text>
      {picking ? <WhoDidIt s={s} helpers={helpers} busy={busy} onPick={(id) => void actions.close('done', id)} onBack={() => setPicking(false)} /> : null}
      <View style={[s.yoursRow, picking ? { display: 'none' } : null]}>
        {mine.canClose ? (
          <>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.talkPrimary} onPress={() => (helpers.length > 0 ? setPicking(true) : void actions.close('done'))}>
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
