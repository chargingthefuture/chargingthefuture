import { SE_SCENE_SIZE, SE_SCENE_STRIPS, type SeShape } from '@ctf/shared';

// The picture of the day as SVG: all of it, or one horizontal strip of it.

function Shape({ shape }: { shape: SeShape }) {
  if (shape.kind === 'rect') return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill={shape.fill} />;
  if (shape.kind === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />;
  return <path d={shape.d} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.stroke ? 2 : undefined} />;
}

export function SceneSvg({ shapes, strip, label }: { shapes: SeShape[]; strip?: number; label?: string }) {
  const h = SE_SCENE_SIZE / SE_SCENE_STRIPS;
  const viewBox = strip === undefined ? `0 0 ${SE_SCENE_SIZE} ${SE_SCENE_SIZE}` : `0 ${strip * h} ${SE_SCENE_SIZE} ${h}`;
  return (
    <svg viewBox={viewBox} preserveAspectRatio="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block', width: '100%', height: '100%' }}>
      {shapes.map((shape, i) => (
        <Shape key={i} shape={shape} />
      ))}
    </svg>
  );
}
