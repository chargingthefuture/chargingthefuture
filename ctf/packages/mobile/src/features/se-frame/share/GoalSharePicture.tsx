// The share picture, the Android copy of the web's goal-share-picture.tsx: the same shapes from
// packages/shared/src/today/goal-share.ts, drawn with react-native-svg. The Svg's own toDataURL
// turns it into the PNG that is shared, so the saved picture is the one on screen.

import React, { forwardRef } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect, Text } from 'react-native-svg';
import { SE_AVATAR_VIEWBOX, SE_QR_DARK, SE_QR_LIGHT, seAvatar, type SeSharePicture, type SeSharePictureItem } from '@ctf/shared';
import { SE_FONT } from '../fonts';

function fontFor(item: Extract<SeSharePictureItem, { type: 'text' }>): string {
  if (item.font === 'serif') return SE_FONT.serif;
  return item.weight === 700 ? SE_FONT.sansBold : item.weight === 600 ? SE_FONT.sansSemi : SE_FONT.sans;
}

function Avatar({ item, index }: { item: Extract<SeSharePictureItem, { type: 'avatar' }>; index: number }) {
  const v = SE_AVATAR_VIEWBOX;
  const clip = `share-avatar-${index}`;
  const scale = item.size / v;
  return (
    <G transform={`translate(${item.x} ${item.y}) scale(${scale})`}>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={v / 2} cy={v / 2} r={v / 2} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        {seAvatar(item.accountId).shapes.map((s, i) => {
          if (s.type === 'rect') return <Rect key={i} width={v} height={v} fill={s.fill} />;
          const stroke = s.stroke ? { stroke: s.stroke.stroke, strokeWidth: s.stroke.strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {};
          if (s.type === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} {...stroke} />;
          return <Path key={i} d={s.d} fill={s.fill ?? 'none'} opacity={s.opacity} {...stroke} />;
        })}
      </G>
    </G>
  );
}

function Qr({ item }: { item: Extract<SeSharePictureItem, { type: 'qr' }> }) {
  const pad = 4;
  const scale = (item.size - pad * 2) / (item.modules + 2);
  return (
    <G>
      <Rect x={item.x} y={item.y} width={item.size} height={item.size} rx={6} fill={SE_QR_LIGHT} />
      <Path d={item.d} fill={SE_QR_DARK} transform={`translate(${item.x + pad + scale} ${item.y + pad + scale}) scale(${scale})`} />
    </G>
  );
}

function Item({ item, index }: { item: SeSharePictureItem; index: number }) {
  switch (item.type) {
    case 'rect':
      return <Rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.r} fill={item.fill} stroke={item.stroke} strokeWidth={item.strokeWidth} />;
    case 'path':
      return <Path d={item.d} fill={item.fill} />;
    case 'line':
      return <Line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={item.stroke} strokeWidth={item.strokeWidth} strokeDasharray={item.dash} />;
    case 'text':
      return (
        <Text x={item.x} y={item.y} fontSize={item.size} fontFamily={fontFor(item)} fill={item.fill} letterSpacing={item.letterSpacing}>
          {item.text}
        </Text>
      );
    case 'avatar':
      return <Avatar item={item} index={index} />;
    default:
      return <Qr item={item} />;
  }
}

export const GoalSharePicture = forwardRef<Svg, { picture: SeSharePicture; width: number; label: string }>(function GoalSharePicture({ picture, width, label }, ref) {
  const height = (width / picture.width) * picture.height;
  return (
    <Svg ref={ref} width={width} height={height} viewBox={`0 0 ${picture.width} ${picture.height}`} accessible accessibilityRole="image" accessibilityLabel={label}>
      {picture.items.map((item, index) => (
        <Item key={index} item={item} index={index} />
      ))}
    </Svg>
  );
});
