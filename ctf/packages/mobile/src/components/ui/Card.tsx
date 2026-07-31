// Themed surface card.
//
// Default theme: rounded panel (tokens.radius = 14) on tokens.surface with a soft drop shadow and a
// hairline border — the look shipped screens already use.
//
// Comic theme (tokens.isComic): sharp corners, a hard cream border (1.5px, tokens.border = #D4C49A),
// and a hard OFFSET cream shadow. The web draws that shadow with `box-shadow: 3px 3px 0 #d4c49a`;
// React Native cannot render a hard, un-blurred offset shadow through the elevation/shadow* props
// (those are always soft and, on Android, tied to elevation), so it is drawn as an absolutely-
// positioned sibling View sitting behind the card — same size, shifted +4,+4 (4px reads better than
// 3px at RN density). The comic card also carries a faint halftone dot texture behind its content,
// mirroring web `--ctf-dot-bg`.

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { DotTexture } from './DotTexture';

type CardProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Toggle the comic halftone texture. Default: on in comic theme, ignored in default theme. */
  dots?: boolean;
};

// The hard offset shadow color + offset, matching web `3px 3px 0 #d4c49a` (4px at RN density).
const COMIC_SHADOW_COLOR = '#D4C49A';
const COMIC_SHADOW_OFFSET = 4;

export function Card({ children, style, dots }: CardProps) {
  const { tokens } = useTheme();
  const s = makeStyles(tokens);
  const showDots = dots ?? true;

  if (tokens.isComic) {
    return (
      <View style={s.comicWrap}>
        <View style={s.comicShadow} pointerEvents="none" />
        <View style={[s.comicCard, style]}>
          {showDots ? <DotTexture /> : null}
          {children}
        </View>
      </View>
    );
  }

  return <View style={[s.defaultCard, style]}>{children}</View>;
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    defaultCard: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    // Outer wrapper sits in normal flow and takes the card's size; the offset shadow anchors to it.
    comicWrap: {
      position: 'relative',
    },
    // Same size as the card, shifted +4,+4. left/top pull in by the offset, right/bottom push out by
    // the same amount, so the shadow keeps the card's dimensions while sitting down-and-right of it.
    comicShadow: {
      position: 'absolute',
      top: COMIC_SHADOW_OFFSET,
      left: COMIC_SHADOW_OFFSET,
      right: -COMIC_SHADOW_OFFSET,
      bottom: -COMIC_SHADOW_OFFSET,
      backgroundColor: COMIC_SHADOW_COLOR,
      borderRadius: 0,
    },
    comicCard: {
      backgroundColor: t.surface,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: t.border,
      overflow: 'hidden',
    },
  });
}
