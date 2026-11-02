// The picture of the day drawn with react-native-svg: all of it, or one horizontal strip of it, the
// Android copy of the web's scene-svg.tsx.

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SE_SCENE_SIZE, SE_SCENE_STRIPS, type SeShape } from '@ctf/shared';

function Shape({ shape }: { shape: SeShape }) {
  if (shape.kind === 'rect') return <Rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill={shape.fill} />;
  if (shape.kind === 'circle') return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />;
  return <Path d={shape.d} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.stroke ? 2 : undefined} />;
}

export function SceneSvg({ shapes, strip }: { shapes: SeShape[]; strip?: number }) {
  const h = SE_SCENE_SIZE / SE_SCENE_STRIPS;
  const viewBox = strip === undefined ? `0 0 ${SE_SCENE_SIZE} ${SE_SCENE_SIZE}` : `0 ${strip * h} ${SE_SCENE_SIZE} ${h}`;
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="none">
      {shapes.map((shape, i) => (
        <Shape key={i} shape={shape} />
      ))}
    </Svg>
  );
}
