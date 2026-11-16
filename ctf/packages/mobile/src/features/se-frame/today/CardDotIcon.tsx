// What a Today card's timeline dot shows, the Android copy of the web's card-dot-icon.tsx: the icon of
// its kind, as on the approved Today board, or the check mark once the card is done.

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { SE_CARD_DOT_CHECK, seCardDotIcon, type SeCardKind } from '@ctf/shared';

export function CardDotIcon({ kind, color, done = false }: { kind: SeCardKind; color: string; done?: boolean }) {
  if (done) {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path d={SE_CARD_DOT_CHECK} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }
  const icon = seCardDotIcon(kind);
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      {icon.paths.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={icon.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}
