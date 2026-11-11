import { forwardRef } from 'react';
import { SE_AVATAR_VIEWBOX, SE_GOAL_SHARE_WORDS, SE_QR_DARK, SE_QR_LIGHT, seAvatar, type SeSharePicture, type SeSharePictureItem } from '@ctf/shared';

// The share picture as one SVG, drawn from the shapes in packages/shared/src/today/goal-share.ts.
// The same element is shown in the sheet and turned into the saved PNG, so the saved picture is
// the one the member saw. Colors are plain values (not CSS variables) so they survive the export.

const FONTS = {
  serif: "'Newsreader Variable', Newsreader, Georgia, serif",
  sans: "'Figtree Variable', 'DM Sans', system-ui, sans-serif",
};

function Avatar({ item, index }: { item: Extract<SeSharePictureItem, { type: 'avatar' }>; index: number }) {
  const v = SE_AVATAR_VIEWBOX;
  const clip = `share-avatar-${index}`;
  return (
    <svg x={item.x} y={item.y} width={item.size} height={item.size} viewBox={`0 0 ${v} ${v}`}>
      <clipPath id={clip}>
        <circle cx={v / 2} cy={v / 2} r={v / 2} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {seAvatar(item.accountId).shapes.map((s, i) => {
          if (s.type === 'rect') return <rect key={i} width={v} height={v} fill={s.fill} />;
          const stroke = s.stroke ? { stroke: s.stroke.stroke, strokeWidth: s.stroke.strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {};
          if (s.type === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} {...stroke} />;
          return <path key={i} d={s.d} fill={s.fill ?? 'none'} opacity={s.opacity} {...stroke} />;
        })}
      </g>
    </svg>
  );
}

function Qr({ item }: { item: Extract<SeSharePictureItem, { type: 'qr' }> }) {
  const pad = 4;
  const scale = (item.size - pad * 2) / (item.modules + 2);
  return (
    <g role="img" aria-label={SE_GOAL_SHARE_WORDS.qr}>
      <rect x={item.x} y={item.y} width={item.size} height={item.size} rx={6} fill={SE_QR_LIGHT} />
      <path d={item.d} fill={SE_QR_DARK} transform={`translate(${item.x + pad + scale} ${item.y + pad + scale}) scale(${scale})`} />
    </g>
  );
}

function Item({ item, index }: { item: SeSharePictureItem; index: number }) {
  switch (item.type) {
    case 'rect':
      return <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.r} fill={item.fill} stroke={item.stroke} strokeWidth={item.strokeWidth} />;
    case 'path':
      return <path d={item.d} fill={item.fill} />;
    case 'line':
      return <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={item.stroke} strokeWidth={item.strokeWidth} strokeDasharray={item.dash} />;
    case 'text':
      return (
        <text x={item.x} y={item.y} fontSize={item.size} fontFamily={FONTS[item.font]} fontWeight={item.weight} fill={item.fill} letterSpacing={item.letterSpacing}>
          {item.text}
        </text>
      );
    case 'avatar':
      return <Avatar item={item} index={index} />;
    default:
      return <Qr item={item} />;
  }
}

export const GoalSharePicture = forwardRef<SVGSVGElement, { picture: SeSharePicture; label: string }>(function GoalSharePicture({ picture, label }, ref) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${picture.width} ${picture.height}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{ display: 'block', maxWidth: picture.width, margin: '0 auto' }}
    >
      {picture.items.map((item, index) => (
        <Item key={index} item={item} index={index} />
      ))}
    </svg>
  );
});
