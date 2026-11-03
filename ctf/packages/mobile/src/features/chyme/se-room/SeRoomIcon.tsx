// One of the live room's icons (packages/shared/src/design/se-room-icons.ts), the same lines the
// web draws (web components/chyme/se-room/se-room-icon.tsx). Decorative: the button carries the label.

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SE_ROOM_ICONS, SE_ROOM_ICON_SHAPES, type SeRoomIconName } from '@ctf/shared';

export function SeRoomIcon({ name, color, size = 20, strokeWidth = 2 }: { name: SeRoomIconName; color: string; size?: number; strokeWidth?: number }) {
  const { bringInHead: head, micBody: body, moreDots } = SE_ROOM_ICON_SHAPES;
  if (name === 'more') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {moreDots.map((dot) => (
          <Circle key={dot.cx} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </Svg>
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {name === 'bringIn' ? <Circle cx={head.cx} cy={head.cy} r={head.r} /> : null}
      {name === 'micOn' || name === 'micOff' ? <Rect x={body.x} y={body.y} width={body.width} height={body.height} rx={body.rx} /> : null}
      {SE_ROOM_ICONS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
