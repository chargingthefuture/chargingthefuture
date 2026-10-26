import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { SE_AVATAR_VIEWBOX, seAvatar } from '@ctf/shared';

// A member's generated picture, the same one the web draws (components/shared/se-avatar.tsx): a
// pattern from a hash of their account id. Decorative; the handle beside it carries the name.
export function SeAvatar({ accountId, size = 40 }: { accountId: string; size?: number }) {
  const { bg, fg, d, rotate } = seAvatar(accountId);
  const v = SE_AVATAR_VIEWBOX;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${v} ${v}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width={v} height={v} fill={bg} />
      <Path d={d} fill={fg} transform={`rotate(${rotate} ${v / 2} ${v / 2})`} />
    </Svg>
  );
}
