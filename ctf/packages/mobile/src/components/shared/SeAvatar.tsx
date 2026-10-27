import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SE_AVATAR_VIEWBOX, seAvatar, type SeAvatarStroke } from '@ctf/shared';

// A member's generated picture, the same one the web draws (components/shared/se-avatar.tsx): a
// small landscape or cut paper from a hash of their account id. Decorative; the handle beside it
// carries the name.
function strokeProps(stroke: SeAvatarStroke | null) {
  return stroke
    ? { stroke: stroke.stroke, strokeWidth: stroke.strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
    : {};
}

export function SeAvatar({ accountId, size = 40 }: { accountId: string; size?: number }) {
  const v = SE_AVATAR_VIEWBOX;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${v} ${v}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {seAvatar(accountId).shapes.map((s, i) => {
        if (s.type === 'rect') return <Rect key={i} width={v} height={v} fill={s.fill} />;
        if (s.type === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} {...strokeProps(s.stroke)} />;
        return <Path key={i} d={s.d} fill={s.fill ?? 'none'} opacity={s.opacity} {...strokeProps(s.stroke)} />;
      })}
    </Svg>
  );
}
