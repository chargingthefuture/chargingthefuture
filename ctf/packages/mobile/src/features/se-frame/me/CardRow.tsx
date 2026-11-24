// One card in a Me list (Open, Read, Hidden) on Android, the copy of the web's card-row.tsx. A card
// that opens a sheet on Today opens it in place here too; any other opens where it lives, and a 3.0
// page is never opened, so such a row is plain text.

import React, { type ReactNode } from 'react';
import { TouchableOpacity } from 'react-native';
import { seCardOpensSheet, seOpens30Page, type SeTodayCard } from '@ctf/shared';
import type { MeStyles } from './meStyles';

type Props = { s: MeStyles; card: SeTodayCard; onSheet: (_card: SeTodayCard) => void; go: (_href: string) => void; children: ReactNode };

export function CardRow({ s, card, onSheet, go, children }: Props) {
  const opensSheet = seCardOpensSheet(card);
  const still = !opensSheet && seOpens30Page(card.href);
  const press = opensSheet ? () => onSheet(card) : () => go(card.href);
  return (
    <TouchableOpacity accessibilityRole={still ? 'text' : 'button'} disabled={still} onPress={still ? undefined : press} style={s.listItem}>
      {children}
    </TouchableOpacity>
  );
}
