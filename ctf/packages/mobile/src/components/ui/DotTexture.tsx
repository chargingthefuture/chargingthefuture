// Comic newsprint halftone overlay.
//
// Mirrors the web token `--ctf-dot-bg: radial-gradient(#d4c49a1a 1px, transparent 1px)` tiled at
// `8px 8px`. React Native has no CSS background gradients, so the same effect is drawn with
// react-native-svg: a userSpaceOnUse pattern of a single faint cream dot repeated every 8px. The
// overlay fills its parent and never intercepts touches.

import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

type DotTextureProps = {
  style?: StyleProp<ViewStyle>;
};

// A stable pattern id. A single overlay per card is enough; a fixed id keeps the SVG defs simple
// and avoids per-render id churn.
const PATTERN_ID = 'ctf-dot-halftone';

export function DotTexture({ style }: DotTextureProps) {
  return (
    <Svg
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      width="100%"
      height="100%"
    >
      <Defs>
        <Pattern id={PATTERN_ID} width={8} height={8} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={1} fill="#D4C49A" fillOpacity={0.1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${PATTERN_ID})`} />
    </Svg>
  );
}
